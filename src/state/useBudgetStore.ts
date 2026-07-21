import { create } from 'zustand'
import { todayLocalISODate } from '../domain/budget'
import { categoriesRepo } from '../db/repos/categoriesRepo'
import { expensesRepo } from '../db/repos/expensesRepo'
import { extraIncomesRepo } from '../db/repos/extraIncomesRepo'
import { goalContributionsRepo } from '../db/repos/goalContributionsRepo'
import { goalsRepo } from '../db/repos/goalsRepo'
import { periodsRepo } from '../db/repos/periodsRepo'
import type { Category, Expense, ExtraIncome, Goal, GoalContribution, ISODate, Period } from '../domain/types'

interface NewExpenseInput {
  amount: number
  date: ISODate
  categoryId: string | null
  note?: string
}

interface NewExtraIncomeInput {
  amount: number
  date: ISODate
  description?: string
}

interface NewCategoryInput {
  name: string
  icon: string
  color: string
}

interface NewGoalInput {
  name: string
  targetAmount: number
  startDate: ISODate
  endDate: ISODate
  isShared: boolean
}

interface BudgetState {
  period: Period | null
  categories: Category[]
  expenses: Expense[]
  extraIncomes: ExtraIncome[]
  goals: Goal[]
  goalContributions: GoalContribution[]
  isLoading: boolean

  hydrate: () => Promise<void>
  startPeriod: (initialMoney: number, nextPaydayDate: ISODate, nextSalaryAmount: number) => Promise<void>
  closePeriod: (nextInitialMoney: number, nextPaydayDate: ISODate, nextSalaryAmount: number) => Promise<void>

  addExpense: (input: NewExpenseInput) => Promise<void>
  updateExpense: (id: string, changes: Partial<NewExpenseInput>) => Promise<void>
  deleteExpense: (id: string) => Promise<void>

  addExtraIncome: (input: NewExtraIncomeInput) => Promise<void>
  deleteExtraIncome: (id: string) => Promise<void>

  addCategory: (input: NewCategoryInput) => Promise<void>
  updateCategory: (id: string, changes: Partial<NewCategoryInput>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>

  addGoal: (input: NewGoalInput) => Promise<void>
  updateGoalStatus: (id: string, status: Goal['status']) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  addGoalContribution: (goalId: string, amount: number, date: ISODate) => Promise<void>
}

async function loadPeriodData(periodId: string) {
  const [expenses, extraIncomes] = await Promise.all([
    expensesRepo.listByPeriod(periodId),
    extraIncomesRepo.listByPeriod(periodId),
  ])
  return { expenses, extraIncomes }
}

async function loadGoalContributions(goals: Goal[]): Promise<GoalContribution[]> {
  const perGoal = await Promise.all(goals.map((g) => goalContributionsRepo.listByGoal(g.id)))
  return perGoal.flat()
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  period: null,
  categories: [],
  expenses: [],
  extraIncomes: [],
  goals: [],
  goalContributions: [],
  isLoading: true,

  hydrate: async () => {
    set({ isLoading: true })
    const [period, categories, goals] = await Promise.all([
      periodsRepo.getActive(),
      categoriesRepo.listAll(),
      goalsRepo.listAll(),
    ])
    const goalContributions = await loadGoalContributions(goals)
    if (period) {
      const { expenses, extraIncomes } = await loadPeriodData(period.id)
      set({ period, categories, goals, goalContributions, expenses, extraIncomes, isLoading: false })
    } else {
      set({ period: null, categories, goals, goalContributions, expenses: [], extraIncomes: [], isLoading: false })
    }
  },

  startPeriod: async (initialMoney, nextPaydayDate, nextSalaryAmount) => {
    const period = await periodsRepo.create({
      userId: null,
      initialMoney,
      startDate: todayLocalISODate(),
      nextPaydayDate,
      nextSalaryAmount,
      status: 'active',
    })
    set({ period, expenses: [], extraIncomes: [] })
  },

  closePeriod: async (nextInitialMoney, nextPaydayDate, nextSalaryAmount) => {
    const current = get().period
    if (!current) return
    await periodsRepo.update(current.id, { status: 'closed' })
    await get().startPeriod(nextInitialMoney, nextPaydayDate, nextSalaryAmount)
  },

  addExpense: async (input) => {
    const period = get().period
    if (!period) return
    await expensesRepo.create({ userId: null, periodId: period.id, ...input })
    set({ expenses: await expensesRepo.listByPeriod(period.id) })
  },

  updateExpense: async (id, changes) => {
    const period = get().period
    if (!period) return
    await expensesRepo.update(id, changes)
    set({ expenses: await expensesRepo.listByPeriod(period.id) })
  },

  deleteExpense: async (id) => {
    const period = get().period
    if (!period) return
    await expensesRepo.softDelete(id)
    set({ expenses: await expensesRepo.listByPeriod(period.id) })
  },

  addExtraIncome: async (input) => {
    const period = get().period
    if (!period) return
    await extraIncomesRepo.create({ userId: null, periodId: period.id, ...input })
    set({ extraIncomes: await extraIncomesRepo.listByPeriod(period.id) })
  },

  deleteExtraIncome: async (id) => {
    const period = get().period
    if (!period) return
    await extraIncomesRepo.softDelete(id)
    set({ extraIncomes: await extraIncomesRepo.listByPeriod(period.id) })
  },

  addCategory: async (input) => {
    await categoriesRepo.create({ userId: null, ...input })
    set({ categories: await categoriesRepo.listAll() })
  },

  updateCategory: async (id, changes) => {
    await categoriesRepo.update(id, changes)
    set({ categories: await categoriesRepo.listAll() })
  },

  deleteCategory: async (id) => {
    await categoriesRepo.softDelete(id)
    set({ categories: await categoriesRepo.listAll() })
  },

  addGoal: async (input) => {
    await goalsRepo.create({ ownerId: null, status: 'active', ...input })
    set({ goals: await goalsRepo.listAll() })
  },

  updateGoalStatus: async (id, status) => {
    await goalsRepo.update(id, { status })
    set({ goals: await goalsRepo.listAll() })
  },

  deleteGoal: async (id) => {
    await goalsRepo.softDelete(id)
    set({ goals: await goalsRepo.listAll() })
  },

  addGoalContribution: async (goalId, amount, date) => {
    await goalContributionsRepo.create({ goalId, userId: null, amount, date })
    set({ goalContributions: await loadGoalContributions(get().goals) })
  },
}))
