import { create } from 'zustand'
import { gamificationRepo } from '../db/repos/gamificationRepo'
import { applyStreak, evaluateAchievements, levelForXp, xpForAction, type AchievementContext, type XpAction } from '../domain/gamification'
import type { AchievementId, GamificationState, ISODate } from '../domain/types'

interface GamificationStoreState {
  state: GamificationState | null
  isLoading: boolean

  hydrate: () => Promise<void>
  awardXp: (action: XpAction) => Promise<{ xp: number; level: number; leveledUp: boolean }>
  unlockAchievements: (ctx: Omit<AchievementContext, 'alreadyUnlocked' | 'bestStreak'>) => Promise<AchievementId[]>
  /** Evalúa la racha del día calendario anterior una sola vez, si aún no se hizo. */
  checkDailyStreak: (checkedDate: ISODate, previousDayWasGreen: boolean) => Promise<void>
}

export const useGamificationStore = create<GamificationStoreState>((set, get) => ({
  state: null,
  isLoading: true,

  hydrate: async () => {
    const state = await gamificationRepo.getOrCreate(null)
    set({ state, isLoading: false })
  },

  awardXp: async (action) => {
    const current = get().state ?? (await gamificationRepo.getOrCreate(null))
    const xp = current.xp + xpForAction(action)
    const previousLevel = current.level
    const level = levelForXp(xp)
    await gamificationRepo.update(null, { xp, level })
    const updated = { ...current, xp, level }
    set({ state: updated })
    return { xp, level, leveledUp: level > previousLevel }
  },

  unlockAchievements: async (ctx) => {
    const current = get().state ?? (await gamificationRepo.getOrCreate(null))
    const newlyUnlocked = evaluateAchievements({
      ...ctx,
      bestStreak: current.bestStreak,
      alreadyUnlocked: current.achievements,
    })
    if (newlyUnlocked.length === 0) return []

    const achievements = [...current.achievements, ...newlyUnlocked]
    await gamificationRepo.update(null, { achievements })
    set({ state: { ...current, achievements } })
    return newlyUnlocked
  },

  checkDailyStreak: async (checkedDate, previousDayWasGreen) => {
    const current = get().state ?? (await gamificationRepo.getOrCreate(null))
    if (current.lastStreakCheckDate === checkedDate) return

    const { currentStreak, bestStreak } = applyStreak(current, previousDayWasGreen)
    await gamificationRepo.update(null, { currentStreak, bestStreak, lastStreakCheckDate: checkedDate })
    set({ state: { ...current, currentStreak, bestStreak, lastStreakCheckDate: checkedDate } })
  },
}))
