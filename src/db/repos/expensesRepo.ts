import { db } from '../dexie'
import { newId, nowIso } from './baseRepo'
import type { Expense } from '../../domain/types'

export const expensesRepo = {
  async create(data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Expense> {
    const timestamp = nowIso()
    const expense: Expense = { ...data, id: newId(), createdAt: timestamp, updatedAt: timestamp, deletedAt: null }
    await db.expenses.add(expense)
    return expense
  },

  async update(id: string, changes: Partial<Omit<Expense, 'id' | 'createdAt'>>): Promise<void> {
    await db.expenses.update(id, { ...changes, updatedAt: nowIso() })
  },

  async softDelete(id: string): Promise<void> {
    await db.expenses.update(id, { deletedAt: nowIso(), updatedAt: nowIso() })
  },

  async getById(id: string): Promise<Expense | undefined> {
    return db.expenses.get(id)
  },

  async listAll(): Promise<Expense[]> {
    return db.expenses.filter((e) => e.deletedAt === null).toArray()
  },

  async listByPeriod(periodId: string): Promise<Expense[]> {
    return db.expenses.filter((e) => e.deletedAt === null && e.periodId === periodId).toArray()
  },
}
