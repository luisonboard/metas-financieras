import { db, type GamificationRow } from '../dexie'
import { nowIso } from './baseRepo'
import type { GamificationState } from '../../domain/types'

const LOCAL_ID = 'local'

function rowId(userId: string | null): string {
  return userId ?? LOCAL_ID
}

export const gamificationRepo = {
  async get(userId: string | null): Promise<GamificationState | undefined> {
    return db.gamificationState.get(rowId(userId))
  },

  async getOrCreate(userId: string | null): Promise<GamificationState> {
    const existing = await db.gamificationState.get(rowId(userId))
    if (existing) return existing

    const timestamp = nowIso()
    const fresh: GamificationRow = {
      id: rowId(userId),
      userId,
      currentStreak: 0,
      bestStreak: 0,
      xp: 0,
      level: 1,
      achievements: [],
      lastStreakCheckDate: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    }
    await db.gamificationState.add(fresh)
    return fresh
  },

  async update(userId: string | null, changes: Partial<Omit<GamificationState, 'userId' | 'createdAt'>>): Promise<void> {
    await db.gamificationState.update(rowId(userId), { ...changes, updatedAt: nowIso() })
  },
}
