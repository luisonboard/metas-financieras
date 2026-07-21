import Dexie, { type EntityTable } from 'dexie'
import type {
  Category,
  Expense,
  ExtraIncome,
  GamificationState,
  Goal,
  GoalContribution,
  GoalMember,
  Period,
} from '../domain/types'
import type { SyncEntity } from '../sync/entities'

/** Fila de gamificación persistida: id local fijo cuando no hay sesión (userId null). */
export interface GamificationRow extends GamificationState {
  id: string
}

/** Mutación local pendiente de subir a Supabase. La clave `${entity}:${rowId}` deduplica encolados repetidos. */
export interface OutboxEntry {
  id: string
  entity: SyncEntity
  rowId: string
  enqueuedAt: string
}

export class AppDatabase extends Dexie {
  periods!: EntityTable<Period, 'id'>
  categories!: EntityTable<Category, 'id'>
  expenses!: EntityTable<Expense, 'id'>
  extraIncomes!: EntityTable<ExtraIncome, 'id'>
  goals!: EntityTable<Goal, 'id'>
  goalMembers!: EntityTable<GoalMember, 'id'>
  goalContributions!: EntityTable<GoalContribution, 'id'>
  gamificationState!: EntityTable<GamificationRow, 'id'>
  outbox!: EntityTable<OutboxEntry, 'id'>

  constructor() {
    super('presupuesto-diario')
    this.version(1).stores({
      periods: 'id, userId, status, deletedAt',
      categories: 'id, userId, deletedAt',
      expenses: 'id, userId, periodId, categoryId, date, deletedAt',
      extraIncomes: 'id, userId, periodId, date, deletedAt',
      goals: 'id, ownerId, status, deletedAt',
      goalMembers: 'id, goalId, userId, deletedAt',
      goalContributions: 'id, goalId, userId, date, deletedAt',
      gamificationState: 'id, userId',
    })
    this.version(2).stores({
      outbox: 'id, entity, rowId',
    })
  }
}

export const db = new AppDatabase()
