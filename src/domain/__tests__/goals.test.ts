import { describe, expect, it } from 'vitest'
import { cuotaMetaPorMiembro, goalProgress, reachedMilestones } from '../goals'

describe('goals domain', () => {
  it('goalProgress calcula el porcentaje aportado sobre el objetivo', () => {
    expect(goalProgress({ targetAmount: 300 }, [{ amount: 150 }])).toBe(50)
    expect(goalProgress({ targetAmount: 300 }, [{ amount: 100 }, { amount: 50 }])).toBe(50)
    expect(goalProgress({ targetAmount: 300 }, [])).toBe(0)
  })

  it('goalProgress no supera 100 % aunque se aporte de más', () => {
    expect(goalProgress({ targetAmount: 100 }, [{ amount: 150 }])).toBe(100)
  })

  it('reachedMilestones devuelve los hitos alcanzados según el progreso', () => {
    expect(reachedMilestones(10)).toEqual([])
    expect(reachedMilestones(25)).toEqual([25])
    expect(reachedMilestones(60)).toEqual([25, 50])
    expect(reachedMilestones(100)).toEqual([25, 50, 75, 100])
  })

  it('cuotaMetaPorMiembro divide la cuota diaria entre los miembros', () => {
    const goal = { targetAmount: 300, startDate: '2026-01-01', endDate: '2026-01-30' } // cuotaMeta = 10
    expect(cuotaMetaPorMiembro(goal, 2)).toBe(5)
    expect(cuotaMetaPorMiembro(goal, 1)).toBe(10)
    expect(cuotaMetaPorMiembro(goal, 0)).toBe(0)
  })
})
