import { describe, expect, it } from 'vitest'
import {
  acumulado,
  calendarioDisponible,
  calendarioDisponibleExtendido,
  disponible,
  pdBase,
  pdEfectivo,
  periodosNecesariosParaCubrir,
} from '../budget'
import type { Expense, ExtraIncome, Goal, Period } from '../types'

const NOW = '2026-01-01T00:00:00.000Z'

function makePeriod(overrides: Partial<Period> = {}): Period {
  return {
    id: 'period-1',
    userId: null,
    initialMoney: 200,
    startDate: '2026-01-01',
    nextPaydayDate: '2026-01-11', // 10 días totales
    nextSalaryAmount: 0,
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  }
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    ownerId: null,
    name: 'Meta de prueba',
    targetAmount: 300,
    startDate: '2026-01-01',
    endDate: '2026-01-30', // 30 días inclusive
    status: 'active',
    isShared: false,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  }
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-1',
    userId: null,
    periodId: 'period-1',
    categoryId: null,
    amount: 0,
    date: '2026-01-01',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  }
}

function makeExtraIncome(overrides: Partial<ExtraIncome> = {}): ExtraIncome {
  return {
    id: 'income-1',
    userId: null,
    periodId: 'period-1',
    amount: 0,
    date: '2026-01-01',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  }
}

describe('budget domain', () => {
  it('caso 1: ejemplo canónico — PD_base $20, día 2, gastos $35 ⇒ Disponible $5', () => {
    const period = makePeriod({ initialMoney: 200, startDate: '2026-01-01', nextPaydayDate: '2026-01-11' })
    expect(pdBase(period)).toBe(20)

    const hoy = '2026-01-02'
    const acc = acumulado(period, [], [], hoy)
    expect(acc).toBe(40)

    const expenses = [makeExpense({ amount: 35, date: '2026-01-02' })]
    expect(disponible(period, [], [], expenses, hoy)).toBe(5)
  })

  it('caso 2: meta $300/30 días baja el PD_efectivo dentro del rango y lo restaura fuera de él', () => {
    const period = makePeriod({ initialMoney: 250, startDate: '2026-01-01', nextPaydayDate: '2026-01-11' }) // PD_base = 25
    const goal = makeGoal({ targetAmount: 300, startDate: '2026-01-01', endDate: '2026-01-30' }) // cuotaMeta = 10

    expect(pdBase(period)).toBe(25)
    expect(pdEfectivo(period, [goal], '2026-01-05')).toBe(15)
    expect(pdEfectivo(period, [goal], '2026-02-05')).toBe(25) // fuera del rango de la meta
  })

  it('caso 3: ingreso extra de $50 el día 3 sube el Acumulado desde ese día sin afectar PD_base', () => {
    const period = makePeriod({ initialMoney: 200, startDate: '2026-01-01', nextPaydayDate: '2026-01-11' })
    const extra = makeExtraIncome({ amount: 50, date: '2026-01-03' })

    const sinExtra = acumulado(period, [], [], '2026-01-03')
    const conExtra = acumulado(period, [], [extra], '2026-01-03')
    expect(conExtra - sinExtra).toBe(50)
    expect(pdBase(period)).toBe(20) // no cambia por el ingreso extra
  })

  it('caso 4: Disponible puede ser negativo sin lanzar error', () => {
    const period = makePeriod({ initialMoney: 200, startDate: '2026-01-01', nextPaydayDate: '2026-01-11' })
    const expenses = [makeExpense({ amount: 999, date: '2026-01-02' })]
    expect(() => disponible(period, [], [], expenses, '2026-01-02')).not.toThrow()
    expect(disponible(period, [], [], expenses, '2026-01-02')).toBeLessThan(0)
  })

  it('caso 5: una meta que pasa a "achieved" deja de descontar desde el día siguiente al cambio', () => {
    const period = makePeriod({ initialMoney: 250, startDate: '2026-01-01', nextPaydayDate: '2026-01-11' }) // PD_base = 25
    const goal = makeGoal({
      targetAmount: 300,
      startDate: '2026-01-01',
      endDate: '2026-01-30',
      status: 'achieved',
      updatedAt: '2026-01-05T10:00:00.000Z', // cambió de estado el 5 de enero
    })

    expect(pdEfectivo(period, [goal], '2026-01-05')).toBe(15) // día del cambio: sigue descontando
    expect(pdEfectivo(period, [goal], '2026-01-06')).toBe(25) // día siguiente: ya no descuenta
  })

  it('caso 6: gastos con fecha futura dentro del período solo cuentan cuando date ≤ hoy', () => {
    const period = makePeriod({ initialMoney: 200, startDate: '2026-01-01', nextPaydayDate: '2026-01-11' })
    const expenses = [
      makeExpense({ amount: 10, date: '2026-01-02' }),
      makeExpense({ amount: 999, date: '2026-01-09' }), // futuro respecto a "hoy"
    ]
    expect(disponible(period, [], [], expenses, '2026-01-02')).toBe(30) // 40 - 10, sin contar el gasto futuro
  })

  it('§6.1 calendarioDisponible: proyecta sumando PD_efectivo día a día tras un sobregasto', () => {
    // PD_base = 20 (sin metas). Un gasto de 110 el día 3 deja Disponible(hoy) en -50.
    const period = makePeriod({ initialMoney: 200, startDate: '2026-01-01', nextPaydayDate: '2026-01-11' })
    const expenses = [makeExpense({ amount: 110, date: '2026-01-03' })]
    const hoy = '2026-01-03'

    expect(disponible(period, [], [], expenses, hoy)).toBe(-50)

    const calendario = calendarioDisponible(period, [], [], expenses, hoy)
    const porFecha = new Map(calendario.map((d) => [d.date, d]))

    expect(porFecha.get('2026-01-03')).toMatchObject({ disponible: -50, esProyectado: false })
    expect(porFecha.get('2026-01-04')).toMatchObject({ disponible: -30, esProyectado: true })
    expect(porFecha.get('2026-01-05')).toMatchObject({ disponible: -10, esProyectado: true })
    expect(porFecha.get('2026-01-06')).toMatchObject({ disponible: 10, esProyectado: true })
  })

  it('calendarioDisponibleExtendido no extiende más allá del período si no hay nextSalaryAmount', () => {
    const period = makePeriod({ initialMoney: 200, startDate: '2026-01-01', nextPaydayDate: '2026-01-11' })
    const calendario = calendarioDisponibleExtendido(period, [], [], [], '2026-01-05')
    expect(calendario).toHaveLength(10)
    expect(calendario.every((d) => d.periodo === 'actual')).toBe(true)
  })

  it('calendarioDisponibleExtendido simula el período siguiente con initialMoney = sobrante + nextSalaryAmount', () => {
    // PD_base = 20, sin gastos ⇒ el período cierra con el initialMoney completo como sobrante ($200).
    const period = makePeriod({
      initialMoney: 200,
      startDate: '2026-01-01',
      nextPaydayDate: '2026-01-11', // 10 días
      nextSalaryAmount: 300,
    })

    const calendario = calendarioDisponibleExtendido(period, [], [], [], '2026-01-05')
    const porFecha = new Map(calendario.map((d) => [d.date, d]))

    // Período siguiente: initialMoney = 200 (sobrante) + 300 = 500, misma duración (10 días) ⇒ PD_base = 50.
    expect(porFecha.get('2026-01-11')).toMatchObject({ disponible: 50, pdEfectivo: 50, periodo: 'siguiente', esProyectado: true })
    expect(porFecha.get('2026-01-20')).toMatchObject({ disponible: 500, periodo: 'siguiente' })
    expect(calendario).toHaveLength(20) // 10 días del período actual + 10 del siguiente
  })

  it('calendarioDisponibleExtendido encadena varios períodos simulados (no se limita a uno)', () => {
    // Sin metas ni gastos: cada período cierra con su initialMoney completo como sobrante.
    const period = makePeriod({
      initialMoney: 200,
      startDate: '2026-01-01',
      nextPaydayDate: '2026-01-11', // 10 días
      nextSalaryAmount: 300,
    })

    const calendario = calendarioDisponibleExtendido(period, [], [], [], '2026-01-05', 3)
    const porFecha = new Map(calendario.map((d) => [d.date, d]))

    expect(calendario).toHaveLength(40) // período actual + 3 simulados, 10 días cada uno

    // Período 1: initialMoney = 200 + 300 = 500 ⇒ PD_base = 50.
    expect(porFecha.get('2026-01-11')).toMatchObject({ pdEfectivo: 50, periodoIndex: 1 })
    // Período 2: initialMoney = 500 (sobrante) + 300 = 800 ⇒ PD_base = 80.
    expect(porFecha.get('2026-01-21')).toMatchObject({ pdEfectivo: 80, periodoIndex: 2 })
    // Período 3: initialMoney = 800 (sobrante) + 300 = 1100 ⇒ PD_base = 110.
    expect(porFecha.get('2026-01-31')).toMatchObject({ pdEfectivo: 110, periodoIndex: 3 })
  })

  it('periodosNecesariosParaCubrir calcula cuántos períodos hacen falta para alcanzar una fecha lejana', () => {
    const period = makePeriod({ startDate: '2026-01-01', nextPaydayDate: '2026-01-11' }) // 10 días

    expect(periodosNecesariosParaCubrir(period, '2026-01-05')).toBe(0) // dentro del período actual
    expect(periodosNecesariosParaCubrir(period, '2026-01-11')).toBe(1) // primer día del período siguiente
    expect(periodosNecesariosParaCubrir(period, '2026-01-25')).toBe(2) // cae en el segundo período simulado
    expect(periodosNecesariosParaCubrir(period, '2026-06-01')).toBeGreaterThan(10) // meta muy lejana ⇒ muchos períodos
  })
})
