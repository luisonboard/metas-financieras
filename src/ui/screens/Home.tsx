import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useBudgetStore } from '../../state/useBudgetStore'
import { disponible, pdEfectivo, pdSugerido, todayLocalISODate } from '../../domain/budget'
import { diasDesvioMetas } from '../../domain/goals'
import { goalScheduleMessage, homeGreetingMessage } from '../../domain/gamification'
import type { Screen } from '../../App'
import type { GastosTab } from './Gastos'
import DiaResumen from '../components/DiaResumen'

interface Props {
  onNavigate: (screen: Screen, gastosTab?: GastosTab) => void
}

export default function Home({ onNavigate }: Props) {
  const period = useBudgetStore((s) => s.period)
  const goals = useBudgetStore((s) => s.goals)
  const extraIncomes = useBudgetStore((s) => s.extraIncomes)
  const expenses = useBudgetStore((s) => s.expenses)
  const categories = useBudgetStore((s) => s.categories)
  const hoy = todayLocalISODate()

  const expensesHoy = useMemo(() => expenses.filter((e) => e.date === hoy), [expenses, hoy])
  const incomesHoy = useMemo(() => extraIncomes.filter((e) => e.date === hoy), [extraIncomes, hoy])
  const goalsHoy = useMemo(() => goals.filter((g) => g.startDate <= hoy && hoy <= g.endDate), [goals, hoy])

  if (!period) return null

  const pd = pdEfectivo(period, goals, hoy)
  const disponibleHoy = disponible(period, goals, extraIncomes, expenses, hoy)
  const sugerido = pdSugerido(period, goals, extraIncomes, expenses, hoy)
  const isPositive = disponibleHoy >= 0
  const mensajeMetas = goalScheduleMessage(diasDesvioMetas(disponibleHoy, goals, hoy))

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="text-center">
        <p className="text-neutral-500 dark:text-neutral-400">{homeGreetingMessage(disponibleHoy)}</p>
        {mensajeMetas && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{mensajeMetas}</p>}
      </div>

      <motion.div
        key={Math.round(disponibleHoy * 100)}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={`rounded-3xl p-8 text-center shadow-sm ${
          isPositive ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-red-50 dark:bg-red-950/40'
        }`}
      >
        <p className="text-sm font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
          Disponible
        </p>
        <p
          className={`mt-2 text-5xl font-bold ${
            isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          ${disponibleHoy.toFixed(2)}
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 uppercase dark:text-neutral-400">PD de hoy</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">${pd.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 uppercase dark:text-neutral-400">PD sugerido</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">${sugerido.toFixed(2)}</p>
        </div>
      </div>

      <DiaResumen
        title="Hoy"
        expenses={expensesHoy}
        incomes={incomesHoy}
        goals={goalsHoy}
        categories={categories}
        onGoalClick={() => onNavigate('metas')}
      />

      <button
        onClick={() => onNavigate('calendario')}
        className="rounded-2xl border border-dashed border-neutral-300 p-4 text-left text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
      >
        📅 Ver calendario de Disponible y proyección →
      </button>

      <div className="flex gap-3">
        <button
          onClick={() => onNavigate('gastos', 'gastos')}
          className="flex-1 rounded-2xl bg-neutral-900 py-4 text-lg font-semibold text-white shadow-lg dark:bg-white dark:text-neutral-900"
        >
          + Gasto
        </button>
        <button
          onClick={() => onNavigate('gastos', 'ingresos')}
          className="flex-1 rounded-2xl bg-emerald-500 py-4 text-lg font-semibold text-white shadow-lg"
        >
          + Ingreso
        </button>
      </div>
    </div>
  )
}
