import { describe, expect, it } from 'vitest'
import {
  cuotaMetaPorMiembro,
  diasDesvioMetas,
  fechaEstimadaFin,
  goalProgress,
  metasElasticas,
  reachedMilestones,
} from '../goals'

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

  describe('metas elásticas (fecha estimada de fin)', () => {
    const metaBase = {
      status: 'active' as const,
      targetAmount: 300,
      startDate: '2026-01-01',
      endDate: '2026-01-30', // cuotaMeta = 10
    }
    const hoy = '2026-01-15'

    it('caso 1: atraso redondea hacia arriba (ceil) y corre la fecha estimada', () => {
      const desvio = diasDesvioMetas(-25, [metaBase], hoy)
      expect(desvio).toBe(3)
      expect(fechaEstimadaFin(metaBase, desvio!)).toBe('2026-02-02')
    })

    it('caso 2: adelanto redondea hacia abajo (floor) y adelanta la fecha estimada', () => {
      const desvio = diasDesvioMetas(25, [metaBase], hoy)
      expect(desvio).toBe(-2)
      expect(fechaEstimadaFin(metaBase, desvio!)).toBe('2026-01-28')
    })

    it('caso 3: disponible 0 ⇒ desvío 0 ⇒ fechaEstimada = endDate', () => {
      const desvio = diasDesvioMetas(0, [metaBase], hoy)
      expect(desvio).toBe(0)
      expect(fechaEstimadaFin(metaBase, desvio!)).toBe(metaBase.endDate)
    })

    it('caso 4: el desvío es global y afecta por igual a todas las metas activas', () => {
      const metaA = { ...metaBase, endDate: '2026-01-30' } // cuota 10
      const metaB = { ...metaBase, targetAmount: 150, endDate: '2026-01-30' } // cuota 5
      const desvio = diasDesvioMetas(-30, [metaA, metaB], hoy)
      expect(desvio).toBe(2) // ceil(30/15)
      expect(fechaEstimadaFin(metaA, desvio!)).toBe('2026-02-01')
      expect(fechaEstimadaFin(metaB, desvio!)).toBe('2026-02-01')
    })

    it('caso 5: sin metas elásticas (ninguna activa, o vencidas) ⇒ null', () => {
      expect(diasDesvioMetas(-25, [], hoy)).toBeNull()
      expect(diasDesvioMetas(-25, [{ ...metaBase, status: 'achieved' }], hoy)).toBeNull()
      expect(diasDesvioMetas(-25, [{ ...metaBase, status: 'abandoned' }], hoy)).toBeNull()
      expect(diasDesvioMetas(-25, [{ ...metaBase, endDate: '2026-01-10' }], hoy)).toBeNull()
    })

    it('caso 6: metasElasticas excluye metas activas ya vencidas (endDate < hoy)', () => {
      const vencida = { ...metaBase, endDate: '2026-01-10' }
      expect(metasElasticas([metaBase, vencida], hoy)).toEqual([metaBase])
      expect(diasDesvioMetas(-10, [vencida], hoy)).toBeNull()
    })

    it('caso 8: fechaEstimadaFin cruza de mes/año correctamente', () => {
      expect(fechaEstimadaFin({ endDate: '2026-08-30' }, 3)).toBe('2026-09-02')
    })
  })
})
