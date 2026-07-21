import { useMemo, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { useBudgetStore } from '../../state/useBudgetStore'
import { useGamificationStore } from '../../state/useGamificationStore'
import { cuotaMeta, todayLocalISODate } from '../../domain/budget'
import { goalProgress, reachedMilestones, type Milestone } from '../../domain/goals'
import { celebrate } from '../gamification/confetti'
import type { Goal } from '../../domain/types'

const MILESTONE_MARKERS: Milestone[] = [25, 50, 75, 100]

export default function Metas() {
  const goals = useBudgetStore((s) => s.goals)
  const addGoal = useBudgetStore((s) => s.addGoal)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [startDate, setStartDate] = useState(todayLocalISODate())
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const amount = Number(targetAmount)
    if (!name.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Completa un nombre y un monto objetivo válido.')
      return
    }
    if (!endDate || endDate < startDate) {
      setError('La fecha de fin debe ser posterior o igual a la de inicio.')
      return
    }
    setError(null)
    await addGoal({ name: name.trim(), targetAmount: amount, startDate, endDate, isShared: false })
    setName('')
    setTargetAmount('')
    setEndDate('')
    setShowForm(false)
  }

  const active = goals.filter((g) => g.status === 'active')
  const finished = goals.filter((g) => g.status !== 'active')
  const canPreviewCuota = targetAmount !== '' && Number(targetAmount) > 0 && startDate && endDate && endDate >= startDate

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Metas</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          {showForm ? 'Cancelar' : '+ Nueva meta'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
          <input
            type="text"
            placeholder="Nombre de la meta"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
            required
          />
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="Monto objetivo"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
            required
          />
          <div className="flex gap-3">
            <div className="w-1/2">
              <label className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
                required
              />
            </div>
            <div className="w-1/2">
              <label className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
                required
              />
            </div>
          </div>
          {canPreviewCuota && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Cuota diaria estimada: ${cuotaMeta({ targetAmount: Number(targetAmount), startDate, endDate }).toFixed(2)}
            </p>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" className="rounded-xl bg-emerald-500 py-2 font-medium text-white">
            Crear meta
          </button>
        </form>
      )}

      {active.length === 0 && finished.length === 0 && (
        <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Aún no tienes metas. ¡Crea la primera!
        </p>
      )}

      <div className="flex flex-col gap-3">
        {active.map((goal) => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
        {finished.map((goal) => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
      </div>
    </div>
  )
}

function GoalCard({ goal }: { goal: Goal }) {
  const allContributions = useBudgetStore((s) => s.goalContributions)
  const contributions = useMemo(
    () => allContributions.filter((c) => c.goalId === goal.id),
    [allContributions, goal.id],
  )
  const addGoalContribution = useBudgetStore((s) => s.addGoalContribution)
  const updateGoalStatus = useBudgetStore((s) => s.updateGoalStatus)
  const expenses = useBudgetStore((s) => s.expenses)
  const goals = useBudgetStore((s) => s.goals)
  const awardXp = useGamificationStore((s) => s.awardXp)
  const unlockAchievements = useGamificationStore((s) => s.unlockAchievements)

  const [amount, setAmount] = useState('')

  const progress = goalProgress(goal, contributions)
  const milestones = reachedMilestones(progress)
  const daily = cuotaMeta(goal)

  async function handleContribute(event: FormEvent) {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return

    await addGoalContribution(goal.id, value, todayLocalISODate())
    const { leveledUp } = await awardXp('goal_contribution')
    if (leveledUp) celebrate()
    setAmount('')

    const newProgress = goalProgress(goal, [...contributions, { amount: value }])
    if (newProgress >= 100 && goal.status === 'active') {
      await updateGoalStatus(goal.id, 'achieved')
      await awardXp('goal_achieved')
      await unlockAchievements({
        expenseCount: expenses.length,
        categorizedExpenseCount: expenses.filter((e) => e.categoryId !== null).length,
        goalsAchievedCount: goals.filter((g) => g.status === 'achieved').length + 1,
        periodClosedWithSurplus: false,
      })
      celebrate()
    }
  }

  return (
    <motion.div layout className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-neutral-900 dark:text-neutral-50">{goal.name}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            ${goal.targetAmount.toFixed(2)} objetivo · ${daily.toFixed(2)}/día
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            goal.status === 'active'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
              : goal.status === 'achieved'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
          }`}
        >
          {goal.status === 'active' ? 'Activa' : goal.status === 'achieved' ? 'Cumplida' : 'Abandonada'}
        </span>
      </div>

      <div className="relative mt-3 h-3 rounded-full bg-neutral-100 dark:bg-neutral-800">
        <motion.div
          className="h-3 rounded-full bg-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
        {MILESTONE_MARKERS.map((m) => (
          <span
            key={m}
            className={`absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${
              milestones.includes(m) ? 'bg-emerald-700' : 'bg-neutral-300 dark:bg-neutral-600'
            }`}
            style={{ left: `calc(${m}% - 4px)` }}
          />
        ))}
      </div>
      <p className="mt-1 text-right text-xs text-neutral-500 dark:text-neutral-400">{progress.toFixed(0)}%</p>

      {goal.status === 'active' && (
        <form onSubmit={handleContribute} className="mt-3 flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="Aportar $"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
          />
          <button
            type="submit"
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Aportar
          </button>
          <button
            type="button"
            onClick={() => updateGoalStatus(goal.id, 'abandoned')}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
          >
            Abandonar
          </button>
        </form>
      )}
    </motion.div>
  )
}
