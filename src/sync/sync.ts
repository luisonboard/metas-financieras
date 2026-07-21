import { db, type GamificationRow } from '../db/dexie'
import { outboxRepo } from '../db/repos/outboxRepo'
import { newId, nowIso } from '../db/repos/baseRepo'
import { supabase } from './supabaseClient'
import type { SyncEntity } from './entities'
import {
  categoryFromRow,
  categoryToRow,
  expenseFromRow,
  expenseToRow,
  extraIncomeFromRow,
  extraIncomeToRow,
  gamificationFromRow,
  gamificationToRow,
  goalContributionFromRow,
  goalContributionToRow,
  goalFromRow,
  goalMemberFromRow,
  goalMemberToRow,
  goalToRow,
  periodFromRow,
  periodToRow,
  type CategoryRow,
  type ExpenseRow,
  type ExtraIncomeRow,
  type GamificationRowDb,
  type GoalContributionRow,
  type GoalMemberRow,
  type GoalRow,
  type PeriodRow,
} from './mappers'

/** Reclama los datos locales creados sin sesión (userId null) para el usuario recién logueado. */
export async function mergeLocalDataToUser(userId: string): Promise<void> {
  const timestamp = nowIso()

  const orphanPeriods = await db.periods.filter((p) => p.userId === null).toArray()
  for (const period of orphanPeriods) {
    await db.periods.update(period.id, { userId, updatedAt: timestamp })
    await outboxRepo.enqueue('period', period.id)
  }

  const orphanCategories = await db.categories.filter((c) => c.userId === null).toArray()
  for (const category of orphanCategories) {
    await db.categories.update(category.id, { userId, updatedAt: timestamp })
    await outboxRepo.enqueue('category', category.id)
  }

  const orphanExpenses = await db.expenses.filter((e) => e.userId === null).toArray()
  for (const expense of orphanExpenses) {
    await db.expenses.update(expense.id, { userId, updatedAt: timestamp })
    await outboxRepo.enqueue('expense', expense.id)
  }

  const orphanIncomes = await db.extraIncomes.filter((e) => e.userId === null).toArray()
  for (const income of orphanIncomes) {
    await db.extraIncomes.update(income.id, { userId, updatedAt: timestamp })
    await outboxRepo.enqueue('extraIncome', income.id)
  }

  const orphanGoals = await db.goals.filter((g) => g.ownerId === null).toArray()
  for (const goal of orphanGoals) {
    await db.goals.update(goal.id, { ownerId: userId, updatedAt: timestamp })
    await outboxRepo.enqueue('goal', goal.id)
  }

  const orphanContributions = await db.goalContributions.filter((c) => c.userId === null).toArray()
  for (const contribution of orphanContributions) {
    await db.goalContributions.update(contribution.id, { userId, updatedAt: timestamp })
    await outboxRepo.enqueue('goalContribution', contribution.id)
  }

  // Toda meta del usuario necesita su fila de membresía (dueño), exista o no desde antes.
  const ownedGoals = await db.goals.filter((g) => g.ownerId === userId).toArray()
  for (const goal of ownedGoals) {
    const existingMembership = await db.goalMembers
      .filter((m) => m.goalId === goal.id && m.userId === userId)
      .first()
    if (!existingMembership) {
      const membership = {
        id: newId(),
        goalId: goal.id,
        userId,
        role: 'owner' as const,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      }
      await db.goalMembers.add(membership)
      await outboxRepo.enqueue('goalMember', membership.id)
    }
  }

  // Gamificación: la fila local vive bajo id='local' hasta el primer login.
  const localGamification = await db.gamificationState.get('local')
  if (localGamification) {
    const existingForUser = await db.gamificationState.get(userId)
    if (!existingForUser) {
      const migrated: GamificationRow = { ...localGamification, id: userId, userId, updatedAt: timestamp }
      await db.gamificationState.put(migrated)
    } else if (new Date(localGamification.updatedAt) > new Date(existingForUser.updatedAt)) {
      await db.gamificationState.update(userId, {
        currentStreak: localGamification.currentStreak,
        bestStreak: localGamification.bestStreak,
        xp: localGamification.xp,
        level: localGamification.level,
        achievements: localGamification.achievements,
        lastStreakCheckDate: localGamification.lastStreakCheckDate,
        updatedAt: timestamp,
      })
    }
    await db.gamificationState.delete('local')
    await outboxRepo.enqueue('gamification', userId)
  }
}

// Respeta las FK remotas: goal antes que goalMember/goalContribution, period antes que
// expense/extraIncome. El orden alfabético de las claves del outbox no garantiza esto.
const PUSH_ORDER: SyncEntity[] = [
  'period',
  'category',
  'expense',
  'extraIncome',
  'goal',
  'goalMember',
  'goalContribution',
  'gamification',
]

/** Sube todas las mutaciones encoladas. Silenciosamente deja en cola lo que falle (offline). */
export async function pushOutbox(): Promise<void> {
  if (!supabase) return
  const entries = await outboxRepo.listAll()
  if (entries.length === 0) return

  const byEntity = new Map<SyncEntity, string[]>()
  for (const entry of entries) {
    const ids = byEntity.get(entry.entity) ?? []
    ids.push(entry.rowId)
    byEntity.set(entry.entity, ids)
  }

  for (const entity of PUSH_ORDER) {
    const rowIds = byEntity.get(entity)
    if (!rowIds) continue
    try {
      const ok = await pushEntity(entity, rowIds)
      if (ok) {
        for (const rowId of rowIds) await outboxRepo.remove(`${entity}:${rowId}`)
      }
    } catch (err) {
      console.warn(`[sync] fallo al subir ${entity}`, err)
    }
  }
}

function reportError(entity: SyncEntity, error: { message: string } | null): boolean {
  if (error) console.warn(`[sync] fallo al subir ${entity}`, error)
  return !error
}

async function pushEntity(entity: SyncEntity, rowIds: string[]): Promise<boolean> {
  if (!supabase) return false

  switch (entity) {
    case 'period': {
      const rows = (await db.periods.bulkGet(rowIds)).filter((r): r is NonNullable<typeof r> => !!r)
      const { error } = await supabase.from('periods').upsert(rows.map(periodToRow))
      return reportError(entity, error)
    }
    case 'category': {
      const rows = (await db.categories.bulkGet(rowIds)).filter((r): r is NonNullable<typeof r> => !!r)
      const { error } = await supabase.from('categories').upsert(rows.map(categoryToRow))
      return reportError(entity, error)
    }
    case 'expense': {
      const rows = (await db.expenses.bulkGet(rowIds)).filter((r): r is NonNullable<typeof r> => !!r)
      const { error } = await supabase.from('expenses').upsert(rows.map(expenseToRow))
      return reportError(entity, error)
    }
    case 'extraIncome': {
      const rows = (await db.extraIncomes.bulkGet(rowIds)).filter((r): r is NonNullable<typeof r> => !!r)
      const { error } = await supabase.from('extra_incomes').upsert(rows.map(extraIncomeToRow))
      return reportError(entity, error)
    }
    case 'goal': {
      const rows = (await db.goals.bulkGet(rowIds)).filter((r): r is NonNullable<typeof r> => !!r)
      const { error } = await supabase.from('goals').upsert(rows.map(goalToRow))
      return reportError(entity, error)
    }
    case 'goalMember': {
      const rows = (await db.goalMembers.bulkGet(rowIds)).filter((r): r is NonNullable<typeof r> => !!r)
      const { error } = await supabase.from('goal_members').upsert(rows.map(goalMemberToRow))
      return reportError(entity, error)
    }
    case 'goalContribution': {
      const rows = (await db.goalContributions.bulkGet(rowIds)).filter((r): r is NonNullable<typeof r> => !!r)
      const { error } = await supabase.from('goal_contributions').upsert(rows.map(goalContributionToRow))
      return reportError(entity, error)
    }
    case 'gamification': {
      const rows = (await db.gamificationState.bulkGet(rowIds)).filter((r): r is NonNullable<typeof r> => !!r)
      const { error } = await supabase.from('gamification').upsert(rows.map(gamificationToRow))
      return reportError(entity, error)
    }
  }
}

function isRemoteNewer(remoteUpdatedAt: string, localUpdatedAt: string | undefined): boolean {
  if (!localUpdatedAt) return true
  return new Date(remoteUpdatedAt) > new Date(localUpdatedAt)
}

/** Trae los datos del usuario desde Supabase (acotados por RLS) y aplica last-write-wins por updatedAt. */
export async function pullAll(): Promise<void> {
  if (!supabase) return

  const [periods, categories, expenses, extraIncomes, goals, goalMembers, goalContributions, gamification] =
    await Promise.all([
      supabase.from('periods').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('extra_incomes').select('*'),
      supabase.from('goals').select('*'),
      supabase.from('goal_members').select('*'),
      supabase.from('goal_contributions').select('*'),
      supabase.from('gamification').select('*'),
    ])

  if (periods.data) {
    for (const row of periods.data as PeriodRow[]) {
      const local = await db.periods.get(row.id)
      if (isRemoteNewer(row.updated_at, local?.updatedAt)) await db.periods.put(periodFromRow(row))
    }
  }
  if (categories.data) {
    for (const row of categories.data as CategoryRow[]) {
      const local = await db.categories.get(row.id)
      if (isRemoteNewer(row.updated_at, local?.updatedAt)) await db.categories.put(categoryFromRow(row))
    }
  }
  if (expenses.data) {
    for (const row of expenses.data as ExpenseRow[]) {
      const local = await db.expenses.get(row.id)
      if (isRemoteNewer(row.updated_at, local?.updatedAt)) await db.expenses.put(expenseFromRow(row))
    }
  }
  if (extraIncomes.data) {
    for (const row of extraIncomes.data as ExtraIncomeRow[]) {
      const local = await db.extraIncomes.get(row.id)
      if (isRemoteNewer(row.updated_at, local?.updatedAt)) await db.extraIncomes.put(extraIncomeFromRow(row))
    }
  }
  if (goals.data) {
    for (const row of goals.data as GoalRow[]) {
      const local = await db.goals.get(row.id)
      if (isRemoteNewer(row.updated_at, local?.updatedAt)) await db.goals.put(goalFromRow(row))
    }
  }
  if (goalMembers.data) {
    for (const row of goalMembers.data as GoalMemberRow[]) {
      const local = await db.goalMembers.get(row.id)
      if (isRemoteNewer(row.updated_at, local?.updatedAt)) await db.goalMembers.put(goalMemberFromRow(row))
    }
  }
  if (goalContributions.data) {
    for (const row of goalContributions.data as GoalContributionRow[]) {
      const local = await db.goalContributions.get(row.id)
      if (isRemoteNewer(row.updated_at, local?.updatedAt)) await db.goalContributions.put(goalContributionFromRow(row))
    }
  }
  if (gamification.data) {
    for (const row of gamification.data as GamificationRowDb[]) {
      const local = await db.gamificationState.get(row.id)
      if (isRemoteNewer(row.updated_at, local?.updatedAt)) await db.gamificationState.put(gamificationFromRow(row))
    }
  }
}

/** Se ejecuta al detectar sesión activa: reclama datos locales, sube lo pendiente y trae lo remoto. */
export async function runFullSync(userId: string): Promise<void> {
  await mergeLocalDataToUser(userId)
  await pushOutbox()
  await pullAll()
}

// ---- Metas conjuntas: unirse por código/enlace de invitación (Fase 6) ----

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/** Acepta un UUID pelado o un enlace tipo `https://app/?join=<uuid>`. */
function extractGoalId(rawCode: string): string | null {
  const trimmed = rawCode.trim()
  try {
    const url = new URL(trimmed)
    const fromQuery = url.searchParams.get('join')
    if (fromQuery && UUID_RE.test(fromQuery)) return fromQuery.match(UUID_RE)?.[0] ?? null
  } catch {
    // no es una URL, seguir intentando extraer un UUID directo
  }
  return trimmed.match(UUID_RE)?.[0] ?? null
}

async function pullGoalRelations(goalId: string): Promise<void> {
  if (!supabase) return
  const [members, contributions] = await Promise.all([
    supabase.from('goal_members').select('*').eq('goal_id', goalId),
    supabase.from('goal_contributions').select('*').eq('goal_id', goalId),
  ])
  if (members.data) {
    for (const row of members.data as GoalMemberRow[]) await db.goalMembers.put(goalMemberFromRow(row))
  }
  if (contributions.data) {
    for (const row of contributions.data as GoalContributionRow[]) {
      await db.goalContributions.put(goalContributionFromRow(row))
    }
  }
}

export type JoinGoalResult = { ok: true; goalName: string } | { ok: false; error: string }

/**
 * Une al usuario a una meta compartida a partir de su código/enlace de invitación (el UUID de
 * la meta). Primero intenta leer la meta directamente: si ya es dueño o miembro, RLS deja verla
 * sin más pasos. Si no, inserta su propia fila en goal_members (autorizada por user_id =
 * auth.uid()) y recién entonces puede leer la meta para confirmar que es compartida.
 */
export async function joinSharedGoal(rawCode: string, userId: string): Promise<JoinGoalResult> {
  if (!supabase) return { ok: false, error: 'Necesitas conexión para unirte a una meta compartida.' }
  const goalId = extractGoalId(rawCode)
  if (!goalId) return { ok: false, error: 'Código de invitación inválido.' }

  const alreadyVisible = await supabase.from('goals').select('*').eq('id', goalId).maybeSingle()
  if (alreadyVisible.data) {
    const row = alreadyVisible.data as GoalRow
    await db.goals.put(goalFromRow(row))
    await pullGoalRelations(goalId)
    return { ok: true, goalName: row.name }
  }

  const timestamp = nowIso()
  const { error: memberError } = await supabase.from('goal_members').upsert(
    { id: newId(), goal_id: goalId, user_id: userId, role: 'member', created_at: timestamp, updated_at: timestamp, deleted_at: null },
    { onConflict: 'goal_id,user_id' },
  )
  if (memberError) {
    return memberError.code === '23503'
      ? { ok: false, error: 'No existe ninguna meta con ese código.' }
      : { ok: false, error: 'No se pudo unir a la meta. Intenta de nuevo.' }
  }

  const { data: goalData } = await supabase.from('goals').select('*').eq('id', goalId).maybeSingle()
  if (!goalData) return { ok: false, error: 'No se pudo cargar la meta.' }
  const goalRow = goalData as GoalRow
  if (!goalRow.is_shared) {
    await supabase.from('goal_members').delete().eq('goal_id', goalId).eq('user_id', userId)
    return { ok: false, error: 'Esa meta no es compartida.' }
  }

  await db.goals.put(goalFromRow(goalRow))
  await pullGoalRelations(goalId)
  return { ok: true, goalName: goalRow.name }
}
