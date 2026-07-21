import { db } from '../dexie'
import { newId, nowIso } from './baseRepo'
import type { GoalContribution } from '../../domain/types'

export const goalContributionsRepo = {
  async create(
    data: Omit<GoalContribution, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<GoalContribution> {
    const timestamp = nowIso()
    const contribution: GoalContribution = {
      ...data,
      id: newId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    }
    await db.goalContributions.add(contribution)
    return contribution
  },

  async update(id: string, changes: Partial<Omit<GoalContribution, 'id' | 'createdAt'>>): Promise<void> {
    await db.goalContributions.update(id, { ...changes, updatedAt: nowIso() })
  },

  async softDelete(id: string): Promise<void> {
    await db.goalContributions.update(id, { deletedAt: nowIso(), updatedAt: nowIso() })
  },

  async listByGoal(goalId: string): Promise<GoalContribution[]> {
    return db.goalContributions.filter((c) => c.deletedAt === null && c.goalId === goalId).toArray()
  },
}
