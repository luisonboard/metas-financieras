import { useState, type FormEvent } from 'react'
import { useBudgetStore } from '../../state/useBudgetStore'
import { todayLocalISODate } from '../../domain/budget'

export default function Onboarding() {
  const startPeriod = useBudgetStore((s) => s.startPeriod)
  const [initialMoney, setInitialMoney] = useState('')
  const [nextPaydayDate, setNextPaydayDate] = useState('')
  const [nextSalaryAmount, setNextSalaryAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const money = Number(initialMoney)
    if (!Number.isFinite(money) || money <= 0) {
      setError('Ingresa un monto válido mayor a cero.')
      return
    }
    if (!nextPaydayDate || nextPaydayDate <= todayLocalISODate()) {
      setError('La fecha de tu próximo sueldo debe ser posterior a hoy.')
      return
    }
    const salary = Number(nextSalaryAmount)
    if (!Number.isFinite(salary) || salary <= 0) {
      setError('Ingresa un monto válido para tu próximo sueldo.')
      return
    }
    setError(null)
    setSubmitting(true)
    await startPeriod(money, nextPaydayDate, salary)
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-neutral-50 p-6 dark:bg-neutral-950">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Presupuesto Diario</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">Cuéntanos cómo va tu dinero hoy</p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div>
          <label htmlFor="initialMoney" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            ¿Cuánto dinero tienes ahora?
          </label>
          <input
            id="initialMoney"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={initialMoney}
            onChange={(e) => setInitialMoney(e.target.value)}
            placeholder="$0.00"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-lg outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50"
          />
        </div>

        <div>
          <label htmlFor="nextPaydayDate" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            ¿Cuándo recibes tu próximo sueldo?
          </label>
          <input
            id="nextPaydayDate"
            type="date"
            value={nextPaydayDate}
            onChange={(e) => setNextPaydayDate(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-lg outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50"
          />
        </div>

        <div>
          <label
            htmlFor="nextSalaryAmount"
            className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
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
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-lg outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50"
          />
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Nos ayuda a proyectar tu presupuesto más allá de este período.
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-xl bg-emerald-500 py-3 text-lg font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
        >
          Empezar
        </button>
      </form>
    </div>
  )
}
