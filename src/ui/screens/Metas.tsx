import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuthStore } from '../../state/useAuthStore'
import { useBudgetStore } from '../../state/useBudgetStore'
import { useGamificationStore } from '../../state/useGamificationStore'
import { useProfilesStore } from '../../state/useProfilesStore'
import { cuotaMeta, disponible, todayLocalISODate } from '../../domain/budget'
import {
  cuotaMetaPorMiembro,
  diasDesvioMetas,
  fechaEstimadaFin,
  goalProgress,
  reachedMilestones,
  type Milestone,
} from '../../domain/goals'
import { celebrate } from '../gamification/confetti'
import type { Goal } from '../../domain/types'

const MILESTONE_MARKERS: Milestone[] = [25, 50, 75, 100]

interface Props {
  initialJoinCode?: string | null
}

export default function Metas({ initialJoinCode }: Props) {
  const goals = useBudgetStore((s) => s.goals)
  const addGoal = useBudgetStore((s) => s.addGoal)
  const isSupabaseConfigured = useAuthStore((s) => s.isSupabaseConfigured)
  const user = useAuthStore((s) => s.user)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [startDate, setStartDate] = useState(todayLocalISODate())
  const [endDate, setEndDate] = useState('')
  const [isShared, setIsShared] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showJoinForm, setShowJoinForm] = useState(Boolean(initialJoinCode))

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
    if (isShared && !user) {
      setError('Inicia sesión para crear una meta compartida.')
      return
    }
    setError(null)
    await addGoal({ name: name.trim(), targetAmount: amount, startDate, endDate, isShared })
    setName('')
    setTargetAmount('')
    setEndDate('')
    setIsShared(false)
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
          {isSupabaseConfigured && (
            <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
              />
              Meta compartida (podrás invitar a otras personas)
            </label>
          )}
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

      {isSupabaseConfigured && (
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
          <button
            type="button"
            onClick={() => setShowJoinForm((v) => !v)}
            className="w-full text-left text-sm font-semibold text-neutral-900 dark:text-neutral-50"
          >
            {showJoinForm ? '▾' : '▸'} Unirse a una meta compartida
          </button>
          {showJoinForm && <JoinGoalForm initialCode={initialJoinCode ?? ''} isLoggedIn={Boolean(user)} />}
        </div>
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

function JoinGoalForm({ initialCode, isLoggedIn }: { initialCode: string; isLoggedIn: boolean }) {
  const joinGoal = useBudgetStore((s) => s.joinGoal)
  const [code, setCode] = useState(initialCode)
  const [status, setStatus] = useState<{ type: 'ok' | 'error'; message: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!code.trim()) return
    setSubmitting(true)
    setStatus(null)
    const result = await joinGoal(code.trim())
    setStatus(
      result.ok ? { type: 'ok', message: `¡Te uniste a "${result.goalName}"!` } : { type: 'error', message: result.error },
    )
    if (result.ok) setCode('')
    setSubmitting(false)
  }

  if (!isLoggedIn) {
    return (
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        Inicia sesión en tu perfil para unirte a una meta compartida.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
      <input
        type="text"
        placeholder="Pega el código o enlace de invitación"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
      />
      {status && (
        <p className={`text-sm ${status.type === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
          {status.message}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-neutral-900 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        Unirme
      </button>
    </form>
  )
}

function GoalCard({ goal }: { goal: Goal }) {
  const allContributions = useBudgetStore((s) => s.goalContributions)
  const contributions = useMemo(
    () => allContributions.filter((c) => c.goalId === goal.id),
    [allContributions, goal.id],
  )
  const allGoalMembers = useBudgetStore((s) => s.goalMembers)
  const members = useMemo(() => allGoalMembers.filter((m) => m.goalId === goal.id), [allGoalMembers, goal.id])
  const fetchProfiles = useProfilesStore((s) => s.fetchProfiles)
  // Se suscribe a byId (no solo a labelFor, cuya referencia de función nunca cambia) para
  // que el componente vuelva a renderizar cuando lleguen los perfiles.
  useProfilesStore((s) => s.byId)
  const labelFor = useProfilesStore((s) => s.labelFor)

  const addGoalContribution = useBudgetStore((s) => s.addGoalContribution)
  const updateGoalStatus = useBudgetStore((s) => s.updateGoalStatus)
  const period = useBudgetStore((s) => s.period)
  const extraIncomes = useBudgetStore((s) => s.extraIncomes)
  const expenses = useBudgetStore((s) => s.expenses)
  const goals = useBudgetStore((s) => s.goals)
  const awardXp = useGamificationStore((s) => s.awardXp)
  const unlockAchievements = useGamificationStore((s) => s.unlockAchievements)

  const hoy = todayLocalISODate()
  const diasDesvio = period ? diasDesvioMetas(disponible(period, goals, extraIncomes, expenses, hoy), goals, hoy) : null
  const mostrarFechaEstimada = goal.status === 'active' && goal.endDate >= hoy && diasDesvio !== null

  const [amount, setAmount] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (goal.isShared && members.length > 0) fetchProfiles(members.map((m) => m.userId))
  }, [goal.isShared, members, fetchProfiles])

  const progress = goalProgress(goal, contributions)
  const milestones = reachedMilestones(progress)
  const daily = cuotaMeta(goal)
  const dailyPerMember = cuotaMetaPorMiembro(goal, members.length)

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
        goalBackOnTrack: false,
      })
      celebrate()
    }
  }

  async function handleCopyInvite() {
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('join', goal.id)
    await navigator.clipboard.writeText(url.toString())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div layout className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-neutral-900 dark:text-neutral-50">
            {goal.name} {goal.isShared && <span title="Meta compartida">👥</span>}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            ${goal.targetAmount.toFixed(2)} objetivo · ${daily.toFixed(2)}/día
          </p>
          {mostrarFechaEstimada && <FechaEstimada goal={goal} diasDesvio={diasDesvio!} />}
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

      {goal.isShared && (
        <div className="mt-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/60">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {members.length} miembro(s) · sugerido ${dailyPerMember.toFixed(2)}/día c/u
          </p>
          {members.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600 dark:text-neutral-300">
              {members.map((m) => (
                <li key={m.id}>
                  {labelFor(m.userId)}
                  {m.role === 'owner' ? ' (dueño)' : ''}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={handleCopyInvite}
            className="mt-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
          >
            {copied ? '¡Enlace copiado!' : 'Copiar enlace de invitación'}
          </button>
        </div>
      )}

      {goal.status === 'active' && (
        <form onSubmit={handleContribute} className="mt-3 flex flex-wrap gap-2">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="Aportar $"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Aportar
          </button>
          <button
            type="button"
            onClick={() => updateGoalStatus(goal.id, 'abandoned')}
            className="shrink-0 rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
          >
            Abandonar
          </button>
        </form>
      )}
    </motion.div>
  )
}

function FechaEstimada({ goal, diasDesvio }: { goal: Goal; diasDesvio: number }) {
  const fecha = format(parseISO(fechaEstimadaFin(goal, diasDesvio)), "d 'de' MMMM", { locale: es })

  if (diasDesvio > 0) {
    const color = diasDesvio <= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'
    return (
      <p className={`mt-1 text-xs ${color}`}>
        📅 Fin estimado: {fecha} (+{diasDesvio} día(s) de atraso)
      </p>
    )
  }

  if (diasDesvio === 0) {
    return <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">📅 Fin estimado: {fecha} (al día)</p>
  }

  return (
    <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
      📅 Podrías terminar el {fecha} ({-diasDesvio} día(s) antes)
    </p>
  )
}
