import { db } from '../dexie'
import { newId, nowIso } from './baseRepo'
import type { GoalMember } from '../../domain/types'

export const goalMembersRepo = {
  async create(data: Omit<GoalMember, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<GoalMember> {
    const timestamp = nowIso()
    const member: GoalMember = { ...data, id: newId(), createdAt: timestamp, updatedAt: timestamp, deletedAt: null }
    await db.goalMembers.add(member)
    return member
  },

  async listByGoal(goalId: string): Promise<GoalMember[]> {
    return db.goalMembers.filter((m) => m.deletedAt === null && m.goalId === goalId).toArray()
  },

  async listAll(): Promise<GoalMember[]> {
    return db.goalMembers.filter((m) => m.deletedAt === null).toArray()
  },
}
