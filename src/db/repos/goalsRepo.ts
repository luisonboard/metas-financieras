import { db } from '../dexie'
import { newId, nowIso } from './baseRepo'
import type { Goal } from '../../domain/types'

export const goalsRepo = {
  async create(data: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Goal> {
    const timestamp = nowIso()
    const goal: Goal = { ...data, id: newId(), createdAt: timestamp, updatedAt: timestamp, deletedAt: null }
    await db.goals.add(goal)
    return goal
  },

  async update(id: string, changes: Partial<Omit<Goal, 'id' | 'createdAt'>>): Promise<void> {
    await db.goals.update(id, { ...changes, updatedAt: nowIso() })
  },

  async softDelete(id: string): Promise<void> {
    await db.goals.update(id, { deletedAt: nowIso(), updatedAt: nowIso() })
  },

  async getById(id: string): Promise<Goal | undefined> {
    return db.goals.get(id)
  },

  async listAll(): Promise<Goal[]> {
    return db.goals.filter((g) => g.deletedAt === null).toArray()
  },

  async listActive(): Promise<Goal[]> {
    return db.goals.filter((g) => g.deletedAt === null && g.status === 'active').toArray()
  },
}
