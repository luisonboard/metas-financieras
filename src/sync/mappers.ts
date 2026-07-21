import type {
  Category,
  Expense,
  ExtraIncome,
  Goal,
  GoalContribution,
  GoalMember,
  Period,
} from '../domain/types'
import type { GamificationRow } from '../db/dexie'

function requireUserId(userId: string | null, entityName: string): string {
  if (!userId) throw new Error(`No se puede sincronizar ${entityName} sin userId asignado`)
  return userId
}

// ---- Period ----

export interface PeriodRow {
  id: string
  user_id: string
  initial_money: number
  start_date: string
  next_payday_date: string
  next_salary_amount: number
  status: 'active' | 'closed'
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export function periodToRow(period: Period): PeriodRow {
  return {
    id: period.id,
    user_id: requireUserId(period.userId, 'un período'),
    initial_money: period.initialMoney,
    start_date: period.startDate,
    next_payday_date: period.nextPaydayDate,
    next_salary_amount: period.nextSalaryAmount,
    status: period.status,
    created_at: period.createdAt,
    updated_at: period.updatedAt,
    deleted_at: period.deletedAt,
  }
}

export function periodFromRow(row: PeriodRow): Period {
  return {
    id: row.id,
    userId: row.user_id,
    initialMoney: row.initial_money,
    startDate: row.start_date,
    nextPaydayDate: row.next_payday_date,
    nextSalaryAmount: row.next_salary_amount,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

// ---- Category ----

export interface CategoryRow {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export function categoryToRow(category: Category): CategoryRow {
  return {
    id: category.id,
    user_id: requireUserId(category.userId, 'una categoría'),
    name: category.name,
    icon: category.icon,
    color: category.color,
    created_at: category.createdAt,
    updated_at: category.updatedAt,
    deleted_at: category.deletedAt,
  }
}

export function categoryFromRow(row: CategoryRow): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

// ---- Expense ----

export interface ExpenseRow {
  id: string
  user_id: string
  period_id: string
  category_id: string | null
  amount: number
  date: string
  note: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export function expenseToRow(expense: Expense): ExpenseRow {
  return {
    id: expense.id,
    user_id: requireUserId(expense.userId, 'un gasto'),
    period_id: expense.periodId,
    category_id: expense.categoryId,
    amount: expense.amount,
    date: expense.date,
    note: expense.note ?? null,
    created_at: expense.createdAt,
    updated_at: expense.updatedAt,
    deleted_at: expense.deletedAt,
  }
}

export function expenseFromRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    userId: row.user_id,
    periodId: row.period_id,
    categoryId: row.category_id,
    amount: row.amount,
    date: row.date,
    note: row.note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

// ---- ExtraIncome ----

export interface ExtraIncomeRow {
  id: string
  user_id: string
  period_id: string
  amount: number
  date: string
  description: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export function extraIncomeToRow(income: ExtraIncome): ExtraIncomeRow {
  return {
    id: income.id,
    user_id: requireUserId(income.userId, 'un ingreso extra'),
    period_id: income.periodId,
    amount: income.amount,
    date: income.date,
    description: income.description ?? null,
    created_at: income.createdAt,
    updated_at: income.updatedAt,
    deleted_at: income.deletedAt,
  }
}

export function extraIncomeFromRow(row: ExtraIncomeRow): ExtraIncome {
  return {
    id: row.id,
    userId: row.user_id,
    periodId: row.period_id,
    amount: row.amount,
    date: row.date,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

// ---- Goal ----

export interface GoalRow {
  id: string
  owner_id: string
  name: string
  target_amount: number
  start_date: string
  end_date: string
  status: 'active' | 'achieved' | 'abandoned'
  is_shared: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export function goalToRow(goal: Goal): GoalRow {
  return {
    id: goal.id,
    owner_id: requireUserId(goal.ownerId, 'una meta'),
    name: goal.name,
    target_amount: goal.targetAmount,
    start_date: goal.startDate,
    end_date: goal.endDate,
    status: goal.status,
    is_shared: goal.isShared,
    created_at: goal.createdAt,
    updated_at: goal.updatedAt,
    deleted_at: goal.deletedAt,
  }
}

export function goalFromRow(row: GoalRow): Goal {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    targetAmount: row.target_amount,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    isShared: row.is_shared,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

// ---- GoalMember ----

export interface GoalMemberRow {
  id: string
  goal_id: string
  user_id: string
  role: 'owner' | 'member'
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export function goalMemberToRow(member: GoalMember): GoalMemberRow {
  return {
    id: member.id,
    goal_id: member.goalId,
    user_id: member.userId,
    role: member.role,
    created_at: member.createdAt,
    updated_at: member.updatedAt,
    deleted_at: member.deletedAt,
  }
}

export function goalMemberFromRow(row: GoalMemberRow): GoalMember {
  return {
    id: row.id,
    goalId: row.goal_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

// ---- GoalContribution ----

export interface GoalContributionRow {
  id: string
  goal_id: string
  user_id: string
  date: string
  amount: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export function goalContributionToRow(contribution: GoalContribution): GoalContributionRow {
  return {
    id: contribution.id,
    goal_id: contribution.goalId,
    user_id: requireUserId(contribution.userId, 'un aporte'),
    date: contribution.date,
    amount: contribution.amount,
    created_at: contribution.createdAt,
    updated_at: contribution.updatedAt,
    deleted_at: contribution.deletedAt,
  }
}

export function goalContributionFromRow(row: GoalContributionRow): GoalContribution {
  return {
    id: row.id,
    goalId: row.goal_id,
    userId: row.user_id,
    date: row.date,
    amount: row.amount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

// ---- Gamification ----
// Una fila por usuario; su `id` local coincide con el userId una vez sincronizada (ver sync.ts).

export interface GamificationRowDb {
  id: string
  user_id: string
  current_streak: number
  best_streak: number
  xp: number
  level: number
  achievements: string[]
  last_streak_check_date: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export function gamificationToRow(state: GamificationRow): GamificationRowDb {
  const userId = requireUserId(state.userId, 'el progreso de gamificación')
  return {
    id: userId,
    user_id: userId,
    current_streak: state.currentStreak,
    best_streak: state.bestStreak,
    xp: state.xp,
    level: state.level,
    achievements: state.achievements,
    last_streak_check_date: state.lastStreakCheckDate,
    created_at: state.createdAt,
    updated_at: state.updatedAt,
    deleted_at: state.deletedAt,
  }
}

export function gamificationFromRow(row: GamificationRowDb): GamificationRow {
  return {
    id: row.user_id,
    userId: row.user_id,
    currentStreak: row.current_streak,
    bestStreak: row.best_streak,
    xp: row.xp,
    level: row.level,
    achievements: row.achievements as GamificationRow['achievements'],
    lastStreakCheckDate: row.last_streak_check_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}
