import { describe, expect, it } from 'vitest'
import {
  applyStreak,
  evaluateAchievements,
  expenseGoalImpactMessage,
  goalBackOnTrack,
  goalScheduleMessage,
  levelForXp,
  xpForAction,
} from '../gamification'

describe('gamification domain', () => {
  it('xpForAction otorga el XP correcto por cada acción', () => {
    expect(xpForAction('expense_logged')).toBe(5)
    expect(xpForAction('green_day')).toBe(10)
    expect(xpForAction('goal_contribution')).toBe(10)
    expect(xpForAction('goal_achieved')).toBe(100)
  })

  it('levelForXp calcula el nivel como floor(sqrt(xp/100)) + 1', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(100)).toBe(2)
    expect(levelForXp(400)).toBe(3)
    expect(levelForXp(900)).toBe(4)
  })

  it('applyStreak incrementa la racha en día verde y la rompe en día negativo', () => {
    const state = { currentStreak: 3, bestStreak: 5 }
    expect(applyStreak(state, true)).toEqual({ currentStreak: 4, bestStreak: 5 })
    expect(applyStreak(state, false)).toEqual({ currentStreak: 0, bestStreak: 5 })
  })

  it('applyStreak actualiza bestStreak cuando la racha actual la supera', () => {
    const state = { currentStreak: 5, bestStreak: 5 }
    expect(applyStreak(state, true)).toEqual({ currentStreak: 6, bestStreak: 6 })
  })

  it('evaluateAchievements solo devuelve logros nuevos, no repite los ya desbloqueados', () => {
    const unlocked = evaluateAchievements({
      expenseCount: 1,
      bestStreak: 7,
      goalsAchievedCount: 0,
      categorizedExpenseCount: 0,
      periodClosedWithSurplus: false,
      goalBackOnTrack: false,
      alreadyUnlocked: ['first_expense'],
    })
    expect(unlocked).toEqual(['week_green', 'streak_7'])
  })

  it('evaluateAchievements desbloquea goal_back_on_track cuando las metas salen del atraso', () => {
    const unlocked = evaluateAchievements({
      expenseCount: 0,
      bestStreak: 0,
      goalsAchievedCount: 0,
      categorizedExpenseCount: 0,
      periodClosedWithSurplus: false,
      goalBackOnTrack: true,
      alreadyUnlocked: [],
    })
    expect(unlocked).toEqual(['goal_back_on_track'])
  })

  it('goalBackOnTrack detecta la transición de atraso (>0) a al día/adelanto (≤0)', () => {
    expect(goalBackOnTrack(3, 0)).toBe(true)
    expect(goalBackOnTrack(1, -2)).toBe(true)
    expect(goalBackOnTrack(0, -2)).toBe(false)
    expect(goalBackOnTrack(3, 1)).toBe(false)
    expect(goalBackOnTrack(null, -1)).toBe(false)
    expect(goalBackOnTrack(3, null)).toBe(false)
  })

  it('goalScheduleMessage devuelve texto según atraso/al día/adelanto, vacío si no hay metas', () => {
    expect(goalScheduleMessage(null)).toBe('')
    expect(goalScheduleMessage(3)).toMatch(/atrasad/i)
    expect(goalScheduleMessage(0)).toMatch(/al día/i)
    expect(goalScheduleMessage(-2)).toMatch(/delante/i)
  })

  it('caso 7: expenseGoalImpactMessage refleja el cambio de desvío o null si no cambió', () => {
    expect(expenseGoalImpactMessage(1, 3)).toMatch(/alejó.*2/)
    expect(expenseGoalImpactMessage(3, 1)).toMatch(/acercaron.*2/)
    expect(expenseGoalImpactMessage(2, 2)).toBeNull()
    expect(expenseGoalImpactMessage(null, null)).toBeNull()
  })
})
