import { db } from '../dexie'
import { newId, nowIso } from './baseRepo'
import type { Category } from '../../domain/types'

export const categoriesRepo = {
  async create(data: Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Category> {
    const timestamp = nowIso()
    const category: Category = { ...data, id: newId(), createdAt: timestamp, updatedAt: timestamp, deletedAt: null }
    await db.categories.add(category)
    return category
  },

  async update(id: string, changes: Partial<Omit<Category, 'id' | 'createdAt'>>): Promise<void> {
    await db.categories.update(id, { ...changes, updatedAt: nowIso() })
  },

  async softDelete(id: string): Promise<void> {
    await db.categories.update(id, { deletedAt: nowIso(), updatedAt: nowIso() })
  },

  async getById(id: string): Promise<Category | undefined> {
    return db.categories.get(id)
  },

  async listAll(): Promise<Category[]> {
    return db.categories.filter((c) => c.deletedAt === null).toArray()
  },
}
