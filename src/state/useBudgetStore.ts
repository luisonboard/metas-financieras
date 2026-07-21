import { create } from 'zustand'
import { todayLocalISODate } from '../domain/budget'
import { categoriesRepo } from '../db/repos/categoriesRepo'
import { expensesRepo } from '../db/repos/expensesRepo'
import { extraIncomesRepo } from '../db/repos/extraIncomesRepo'
import { goalContributionsRepo } from '../db/repos/goalContributionsRepo'
import { goalMembersRepo } from '../db/repos/goalMembersRepo'
import { goalsRepo } from '../db/repos/goalsRepo'
import { periodsRepo } from '../db/repos/periodsRepo'
import { getCurrentUserId } from '../sync/session'
import { joinSharedGoal, type JoinGoalResult } from '../sync/sync'
import { trackMutation } from '../sync/track'
import type { Category, Expense, ExtraIncome, Goal, GoalContribution, GoalMember, ISODate, Period } from '../domain/types'

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
  goalMembers: GoalMember[]
  goalContributions: GoalContribution[]
  isLoading: boolean

  hydrate: () => Promise<void>
  refreshGoalsData: () => Promise<void>
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
  joinGoal: (code: string) => Promise<JoinGoalResult>
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
  goalMembers: [],
  goalContributions: [],
  isLoading: true,

  hydrate: async () => {
    set({ isLoading: true })
    const [period, categories, goals, goalMembers] = await Promise.all([
      periodsRepo.getActive(),
      categoriesRepo.listAll(),
      goalsRepo.listAll(),
      goalMembersRepo.listAll(),
    ])
    const goalContributions = await loadGoalContributions(goals)
    if (period) {
      const { expenses, extraIncomes } = await loadPeriodData(period.id)
      set({ period, categories, goals, goalMembers, goalContributions, expenses, extraIncomes, isLoading: false })
    } else {
      set({
        period: null,
        categories,
        goals,
        goalMembers,
        goalContributions,
        expenses: [],
        extraIncomes: [],
        isLoading: false,
      })
    }
  },

  refreshGoalsData: async () => {
    const [goals, goalMembers] = await Promise.all([goalsRepo.listAll(), goalMembersRepo.listAll()])
    const goalContributions = await loadGoalContributions(goals)
    set({ goals, goalMembers, goalContributions })
  },

  startPeriod: async (initialMoney, nextPaydayDate, nextSalaryAmount) => {
    const period = await periodsRepo.create({
      userId: getCurrentUserId(),
      initialMoney,
      startDate: todayLocalISODate(),
      nextPaydayDate,
      nextSalaryAmount,
      status: 'active',
    })
    await trackMutation('period', period.id)
    set({ period, expenses: [], extraIncomes: [] })
  },

  closePeriod: async (nextInitialMoney, nextPaydayDate, nextSalaryAmount) => {
    const current = get().period
    if (!current) return
    await periodsRepo.update(current.id, { status: 'closed' })
    await trackMutation('period', current.id)
    await get().startPeriod(nextInitialMoney, nextPaydayDate, nextSalaryAmount)
  },

  addExpense: async (input) => {
    const period = get().period
    if (!period) return
    const expense = await expensesRepo.create({ userId: getCurrentUserId(), periodId: period.id, ...input })
    await trackMutation('expense', expense.id)
    set({ expenses: await expensesRepo.listByPeriod(period.id) })
  },

  updateExpense: async (id, changes) => {
    const period = get().period
    if (!period) return
    await expensesRepo.update(id, changes)
    await trackMutation('expense', id)
    set({ expenses: await expensesRepo.listByPeriod(period.id) })
  },

  deleteExpense: async (id) => {
    const period = get().period
    if (!period) return
    await expensesRepo.softDelete(id)
    await trackMutation('expense', id)
    set({ expenses: await expensesRepo.listByPeriod(period.id) })
  },

  addExtraIncome: async (input) => {
    const period = get().period
    if (!period) return
    const income = await extraIncomesRepo.create({ userId: getCurrentUserId(), periodId: period.id, ...input })
    await trackMutation('extraIncome', income.id)
    set({ extraIncomes: await extraIncomesRepo.listByPeriod(period.id) })
  },

  deleteExtraIncome: async (id) => {
    const period = get().period
    if (!period) return
    await extraIncomesRepo.softDelete(id)
    await trackMutation('extraIncome', id)
    set({ extraIncomes: await extraIncomesRepo.listByPeriod(period.id) })
  },

  addCategory: async (input) => {
    const category = await categoriesRepo.create({ userId: getCurrentUserId(), ...input })
    await trackMutation('category', category.id)
    set({ categories: await categoriesRepo.listAll() })
  },

  updateCategory: async (id, changes) => {
    await categoriesRepo.update(id, changes)
    await trackMutation('category', id)
    set({ categories: await categoriesRepo.listAll() })
  },

  deleteCategory: async (id) => {
    await categoriesRepo.softDelete(id)
    await trackMutation('category', id)
    set({ categories: await categoriesRepo.listAll() })
  },

  addGoal: async (input) => {
    const ownerId = getCurrentUserId()
    const goal = await goalsRepo.create({ ownerId, status: 'active', ...input })
    await trackMutation('goal', goal.id)
    if (ownerId) {
      const membership = await goalMembersRepo.create({ goalId: goal.id, userId: ownerId, role: 'owner' })
      await trackMutation('goalMember', membership.id)
    }
    await get().refreshGoalsData()
  },

  updateGoalStatus: async (id, status) => {
    await goalsRepo.update(id, { status })
    await trackMutation('goal', id)
    set({ goals: await goalsRepo.listAll() })
  },

  deleteGoal: async (id) => {
    await goalsRepo.softDelete(id)
    await trackMutation('goal', id)
    set({ goals: await goalsRepo.listAll() })
  },

  addGoalContribution: async (goalId, amount, date) => {
    const contribution = await goalContributionsRepo.create({ goalId, userId: getCurrentUserId(), amount, date })
    await trackMutation('goalContribution', contribution.id)
    set({ goalContributions: await loadGoalContributions(get().goals) })
  },

  joinGoal: async (code) => {
    const userId = getCurrentUserId()
    if (!userId) return { ok: false, error: 'Inicia sesión para unirte a una meta compartida.' }
    const result = await joinSharedGoal(code, userId)
    if (result.ok) await get().refreshGoalsData()
    return result
  },
}))
