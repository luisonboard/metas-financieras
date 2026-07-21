import { useMemo, useState, type FormEvent } from 'react'
import { useBudgetStore } from '../../state/useBudgetStore'
import { useGamificationStore } from '../../state/useGamificationStore'
import { disponible, round2, todayLocalISODate } from '../../domain/budget'
import { periodClosedMessage } from '../../domain/gamification'
import { celebrate } from '../gamification/confetti'
import type { Period } from '../../domain/types'

interface Props {
  period: Period
}

export default function CierrePeriodo({ period }: Props) {
  const goals = useBudgetStore((s) => s.goals)
  const extraIncomes = useBudgetStore((s) => s.extraIncomes)
  const expenses = useBudgetStore((s) => s.expenses)
  const categories = useBudgetStore((s) => s.categories)
  const closePeriod = useBudgetStore((s) => s.closePeriod)
  const gamification = useGamificationStore((s) => s.state)
  const unlockAchievements = useGamificationStore((s) => s.unlockAchievements)

  const sobrante = round2(disponible(period, goals, extraIncomes, expenses, todayLocalISODate()))
  const totalGastos = round2(expenses.reduce((sum, e) => sum + e.amount, 0))
  const totalExtras = round2(extraIncomes.reduce((sum, e) => sum + e.amount, 0))

  const topCategory = useMemo(() => {
    const totals = new Map<string, number>()
    for (const expense of expenses) {
      if (!expense.categoryId) continue
      totals.set(expense.categoryId, (totals.get(expense.categoryId) ?? 0) + expense.amount)
    }
    let bestId: string | null = null
    let bestAmount = 0
    for (const [id, amount] of totals) {
      if (amount > bestAmount) {
        bestId = id
        bestAmount = amount
      }
    }
    return bestId ? (categories.find((c) => c.id === bestId) ?? null) : null
  }, [expenses, categories])

  const sugeridoInicial = round2(sobrante + (period.nextSalaryAmount ?? 0))

  const [nextPaydayDate, setNextPaydayDate] = useState('')
  const [nextInitialMoney, setNextInitialMoney] = useState(() => Math.max(0, sugeridoInicial).toFixed(2))
  const [nextSalaryAmount, setNextSalaryAmount] = useState('')
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClose(event: FormEvent) {
    event.preventDefault()
    const money = Number(nextInitialMoney)
    if (!Number.isFinite(money) || money <= 0) {
      setError('Ingresa un monto inicial válido para el nuevo período.')
      return
    }
    if (!nextPaydayDate || nextPaydayDate <= todayLocalISODate()) {
      setError('La fecha del próximo sueldo debe ser posterior a hoy.')
      return
    }
    const salary = Number(nextSalaryAmount)
    if (!Number.isFinite(salary) || salary <= 0) {
      setError('Ingresa un monto válido para el sueldo que sigue después de este.')
      return
    }
    setError(null)
    setClosing(true)

    await unlockAchievements({
      expenseCount: expenses.length,
      categorizedExpenseCount: expenses.filter((e) => e.categoryId !== null).length,
      goalsAchievedCount: goals.filter((g) => g.status === 'achieved').length,
      periodClosedWithSurplus: sobrante >= 0,
      goalBackOnTrack: false,
    })
    if (sobrante >= 0) celebrate()

    await closePeriod(money, nextPaydayDate, salary)
    setClosing(false)
  }

  return (
    <div className="flex min-h-svh flex-col gap-6 bg-neutral-50 p-6 dark:bg-neutral-950">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">¡Cerremos tu período!</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">Llegó la fecha de tu próximo sueldo</p>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm dark:bg-neutral-900">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{periodClosedMessage(sobrante)}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-xs text-neutral-500 uppercase dark:text-neutral-400">Gastado</p>
            <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">${totalGastos.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase dark:text-neutral-400">Ingresos extra</p>
            <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">${totalExtras.toFixed(2)}</p>
          </div>
          {topCategory && (
            <div>
              <p className="text-xs text-neutral-500 uppercase dark:text-neutral-400">Categoría top</p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                {topCategory.icon} {topCategory.name}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-neutral-500 uppercase dark:text-neutral-400">Mejor racha</p>
            <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {gamification?.bestStreak ?? 0} días
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleClose} className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm dark:bg-neutral-900">
        <h2 className="font-semibold text-neutral-900 dark:text-neutral-50">Nuevo período</h2>
        <div>
          <label htmlFor="nextInitialMoney" className="mb-1 block text-sm text-neutral-700 dark:text-neutral-300">
            Dinero para empezar (sugerido: {sobrante >= 0 ? 'sobrante' : 'faltante'} + sueldo que recibiste)
          </label>
          <input
            id="nextInitialMoney"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={nextInitialMoney}
            onChange={(e) => setNextInitialMoney(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
          />
        </div>
        <div>
          <label htmlFor="nextPaydayDate" className="mb-1 block text-sm text-neutral-700 dark:text-neutral-300">
            ¿Cuándo recibes el sueldo que sigue después de este?
          </label>
          <input
            id="nextPaydayDate"
            type="date"
            value={nextPaydayDate}
            onChange={(e) => setNextPaydayDate(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
          />
        </div>
        <div>
          <label
            htmlFor="nextSalaryAmount"
            className="mb-1 block text-sm text-neutral-700 dark:text-neutral-300"
          >
            ¿Cuánto esperas recibir ese día?
          </label>
          <input
            id="nextSalaryAmount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={nextSalaryAmount}
            onChange={(e) => setNextSalaryAmount(e.target.value)}
            placeholder="$0.00"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={closing}
          className="rounded-xl bg-emerald-500 py-3 font-semibold text-white disabled:opacity-50"
        >
          Cerrar período y continuar
        </button>
      </form>
    </div>
  )
}
