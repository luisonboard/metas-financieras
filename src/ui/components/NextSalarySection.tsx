import { useState, type FormEvent } from 'react'
import { useBudgetStore } from '../../state/useBudgetStore'

export default function NextSalarySection() {
  const period = useBudgetStore((s) => s.period)
  const updateNextSalaryAmount = useBudgetStore((s) => s.updateNextSalaryAmount)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!period) return null

  function startEditing() {
    setValue(period!.nextSalaryAmount.toString())
    setError(null)
    setEditing(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const amount = Number(value)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Ingresa un monto válido mayor a cero.')
      return
    }
    setError(null)
    setSaving(true)
    await updateNextSalaryAmount(amount)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm dark:bg-neutral-900">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Próximo sueldo esperado</p>
      {editing ? (
        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-3">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-lg outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-emerald-500 py-2.5 font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="flex-1 rounded-xl border border-neutral-300 py-2.5 font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-1 flex items-center justify-between">
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">${period.nextSalaryAmount.toFixed(2)}</p>
          <button
            type="button"
            onClick={startEditing}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
          >
            Editar
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Se usa para proyectar tu Disponible en el calendario más allá de este período.
      </p>
    </div>
  )
}
