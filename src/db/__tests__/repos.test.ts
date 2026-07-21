import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../dexie'
import { periodsRepo } from '../repos/periodsRepo'
import { categoriesRepo } from '../repos/categoriesRepo'
import { expensesRepo } from '../repos/expensesRepo'
import { gamificationRepo } from '../repos/gamificationRepo'

beforeEach(async () => {
  await db.open()
})

afterEach(async () => {
  db.close()
  await db.delete()
})

describe('repos locales (Dexie)', () => {
  it('crea y recupera el período activo', async () => {
    const period = await periodsRepo.create({
      userId: null,
      initialMoney: 200,
      startDate: '2026-01-01',
      nextPaydayDate: '2026-01-11',
      nextSalaryAmount: 0,
      status: 'active',
    })

    const active = await periodsRepo.getActive()
    expect(active?.id).toBe(period.id)
  })

  it('el borrado lógico excluye la categoría de listAll', async () => {
    const category = await categoriesRepo.create({ userId: null, name: 'Comida', icon: '🍔', color: '#f00' })
    let all = await categoriesRepo.listAll()
    expect(all).toHaveLength(1)

    await categoriesRepo.softDelete(category.id)
    all = await categoriesRepo.listAll()
    expect(all).toHaveLength(0)
  })

  it('lista los gastos de un período específico', async () => {
    const period = await periodsRepo.create({
      userId: null,
      initialMoney: 200,
      startDate: '2026-01-01',
      nextPaydayDate: '2026-01-11',
      nextSalaryAmount: 0,
      status: 'active',
    })
    await expensesRepo.create({ userId: null, periodId: period.id, categoryId: null, amount: 10, date: '2026-01-02' })
    await expensesRepo.create({ userId: null, periodId: 'otro-periodo', categoryId: null, amount: 5, date: '2026-01-02' })

    const expenses = await expensesRepo.listByPeriod(period.id)
    expect(expenses).toHaveLength(1)
    expect(expenses[0]?.amount).toBe(10)
  })

  it('getOrCreate del perfil de gamificación local es idempotente', async () => {
    const first = await gamificationRepo.getOrCreate(null)
    await gamificationRepo.update(null, { xp: 50, level: 2 })
    const second = await gamificationRepo.getOrCreate(null)

    expect(second.xp).toBe(50)
    expect(second.level).toBe(2)
    expect(first.userId).toBeNull()
  })
})
