import { db } from '../dexie'
import { newId, nowIso } from './baseRepo'
import type { ExtraIncome } from '../../domain/types'

export const extraIncomesRepo = {
  async create(data: Omit<ExtraIncome, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<ExtraIncome> {
    const timestamp = nowIso()
    const income: ExtraIncome = { ...data, id: newId(), createdAt: timestamp, updatedAt: timestamp, deletedAt: null }
    await db.extraIncomes.add(income)
    return income
  },

  async update(id: string, changes: Partial<Omit<ExtraIncome, 'id' | 'createdAt'>>): Promise<void> {
    await db.extraIncomes.update(id, { ...changes, updatedAt: nowIso() })
  },

  async softDelete(id: string): Promise<void> {
    await db.extraIncomes.update(id, { deletedAt: nowIso(), updatedAt: nowIso() })
  },

  async getById(id: string): Promise<ExtraIncome | undefined> {
    return db.extraIncomes.get(id)
  },

  async listAll(): Promise<ExtraIncome[]> {
    return db.extraIncomes.filter((e) => e.deletedAt === null).toArray()
  },

  async listByPeriod(periodId: string): Promise<ExtraIncome[]> {
    return db.extraIncomes.filter((e) => e.deletedAt === null && e.periodId === periodId).toArray()
  },
}
