import { describe, expect, it } from 'vitest'
import { applyStreak, evaluateAchievements, levelForXp, xpForAction } from '../gamification'

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
      alreadyUnlocked: ['first_expense'],
    })
    expect(unlocked).toEqual(['week_green', 'streak_7'])
  })
})
