import { db } from '../dexie'
import { newId, nowIso } from './baseRepo'
import type { Period } from '../../domain/types'

export const periodsRepo = {
  async create(data: Omit<Period, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Period> {
    const timestamp = nowIso()
    const period: Period = { ...data, id: newId(), createdAt: timestamp, updatedAt: timestamp, deletedAt: null }
    await db.periods.add(period)
    return period
  },

  async update(id: string, changes: Partial<Omit<Period, 'id' | 'createdAt'>>): Promise<void> {
    await db.periods.update(id, { ...changes, updatedAt: nowIso() })
  },

  async softDelete(id: string): Promise<void> {
    await db.periods.update(id, { deletedAt: nowIso(), updatedAt: nowIso() })
  },

  async getById(id: string): Promise<Period | undefined> {
    return db.periods.get(id)
  },

  async listAll(): Promise<Period[]> {
    return db.periods.filter((p) => p.deletedAt === null).toArray()
  },

  async getActive(): Promise<Period | undefined> {
    return db.periods.filter((p) => p.deletedAt === null && p.status === 'active').first()
  },

  async listClosed(): Promise<Period[]> {
    return db.periods.filter((p) => p.deletedAt === null && p.status === 'closed').toArray()
  },
}
