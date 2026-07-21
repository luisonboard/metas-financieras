import { useState, type FormEvent } from 'react'
import { useBudgetStore } from '../../state/useBudgetStore'
import { useGamificationStore } from '../../state/useGamificationStore'
import { pdEfectivo, todayLocalISODate } from '../../domain/budget'
import { expenseFeedbackMessage } from '../../domain/gamification'
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../components/categoryPresets'
import type { Category, Expense } from '../../domain/types'

type Tab = 'gastos' | 'ingresos' | 'categorias'

const TAB_LABELS: Record<Tab, string> = {
  gastos: 'Gastos',
  ingresos: 'Ingresos extra',
  categorias: 'Categorías',
}

export default function Gastos() {
  const [tab, setTab] = useState<Tab>('gastos')

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Gastos</h1>
      <div className="flex gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              tab === t
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'gastos' && <ExpensesTab />}
      {tab === 'ingresos' && <ExtraIncomesTab />}
      {tab === 'categorias' && <CategoriesTab />}
    </div>
  )
}

function ExpensesTab() {
  const period = useBudgetStore((s) => s.period)
  const expenses = useBudgetStore((s) => s.expenses)
  const categories = useBudgetStore((s) => s.categories)
  const goals = useBudgetStore((s) => s.goals)
  const addExpense = useBudgetStore((s) => s.addExpense)
  const updateExpense = useBudgetStore((s) => s.updateExpense)
  const deleteExpense = useBudgetStore((s) => s.deleteExpense)
  const awardXp = useGamificationStore((s) => s.awardXp)
  const unlockAchievements = useGamificationStore((s) => s.unlockAchievements)

  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayLocalISODate())
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0 || !period) return

    await addExpense({ amount: value, date, categoryId: categoryId || null, note: note || undefined })
    await awardXp('expense_logged')

    const categorizedCount = expenses.filter((e) => e.categoryId !== null).length + (categoryId ? 1 : 0)
    await unlockAchievements({
      expenseCount: expenses.length + 1,
      categorizedExpenseCount: categorizedCount,
      goalsAchievedCount: goals.filter((g) => g.status === 'achieved').length,
      periodClosedWithSurplus: false,
    })

    const pdHoy = pdEfectivo(period, goals, date)
    setFeedback(expenseFeedbackMessage(value <= pdHoy))
    setAmount('')
    setNote('')
    setTimeout(() => setFeedback(null), 4000)
  }

  const sorted = [...expenses].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
        <div className="flex gap-3">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="Monto"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-1/2 rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
            required
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-1/2 rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
            required
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Nota (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
        />
        <button type="submit" className="rounded-xl bg-neutral-900 py-2 font-medium text-white dark:bg-white dark:text-neutral-900">
          Agregar gasto
        </button>
        {feedback && <p className="text-sm text-emerald-600 dark:text-emerald-400">{feedback}</p>}
      </form>

      <ul className="flex flex-col gap-2">
        {sorted.map((expense) => {
          if (editingId === expense.id) {
            return (
              <EditExpenseForm
                key={expense.id}
                expense={expense}
                categories={categories}
                onCancel={() => setEditingId(null)}
                onSave={async (changes) => {
                  await updateExpense(expense.id, changes)
                  setEditingId(null)
                }}
              />
            )
          }
          const category = categories.find((c) => c.id === expense.categoryId)
          return (
            <li
              key={expense.id}
              className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-neutral-900"
            >
              <div>
                <p className="font-medium text-neutral-900 dark:text-neutral-50">
                  {category ? `${category.icon} ${category.name}` : 'Sin categoría'}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {expense.date}
                  {expense.note ? ` · ${expense.note}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-neutral-900 dark:text-neutral-50">${expense.amount.toFixed(2)}</span>
                <button onClick={() => setEditingId(expense.id)} className="text-sm text-emerald-600 dark:text-emerald-400">
                  Editar
                </button>
                <button onClick={() => deleteExpense(expense.id)} className="text-sm text-red-500">
                  Eliminar
                </button>
              </div>
            </li>
          )
        })}
        {sorted.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">Aún no registras gastos.</p>
        )}
      </ul>
    </div>
  )
}

interface EditExpenseFormProps {
  expense: Expense
  categories: Category[]
  onCancel: () => void
  onSave: (changes: { amount: number; date: string; categoryId: string | null; note?: string }) => Promise<void>
}

function EditExpenseForm({ expense, categories, onCancel, onSave }: EditExpenseFormProps) {
  const [amount, setAmount] = useState(expense.amount.toString())
  const [date, setDate] = useState(expense.date)
  const [categoryId, setCategoryId] = useState(expense.categoryId ?? '')
  const [note, setNote] = useState(expense.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Ingresa un monto válido mayor a cero.')
      return
    }
    setError(null)
    setSaving(true)
    await onSave({ amount: value, date, categoryId: categoryId || null, note: note || undefined })
    setSaving(false)
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl bg-white p-3 shadow-sm dark:bg-neutral-900">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex gap-3">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-1/2 rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
            required
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-1/2 rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
            required
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Nota (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl bg-emerald-500 py-2 font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-xl border border-neutral-300 py-2 font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
          >
            Cancelar
          </button>
        </div>
      </form>
    </li>
  )
}

function ExtraIncomesTab() {
  const extraIncomes = useBudgetStore((s) => s.extraIncomes)
  const addExtraIncome = useBudgetStore((s) => s.addExtraIncome)
  const deleteExtraIncome = useBudgetStore((s) => s.deleteExtraIncome)

  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayLocalISODate())
  const [description, setDescription] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return

    await addExtraIncome({ amount: value, date, description: description || undefined })
    setAmount('')
    setDescription('')
  }

  const sorted = [...extraIncomes].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
        <div className="flex gap-3">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="Monto"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-1/2 rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
            required
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-1/2 rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
            required
          />
        </div>
        <input
          type="text"
          placeholder="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
        />
        <button type="submit" className="rounded-xl bg-emerald-500 py-2 font-medium text-white">
          Agregar ingreso extra
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {sorted.map((income) => (
          <li
            key={income.id}
            className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-neutral-900"
          >
            <div>
              <p className="font-medium text-neutral-900 dark:text-neutral-50">{income.description || 'Ingreso extra'}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{income.date}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">+${income.amount.toFixed(2)}</span>
              <button onClick={() => deleteExtraIncome(income.id)} className="text-sm text-red-500">
                Eliminar
              </button>
            </div>
          </li>
        ))}
        {sorted.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">Aún no registras ingresos extra.</p>
        )}
      </ul>
    </div>
  )
}

function CategoriesTab() {
  const categories = useBudgetStore((s) => s.categories)
  const addCategory = useBudgetStore((s) => s.addCategory)
  const deleteCategory = useBudgetStore((s) => s.deleteCategory)

  const [name, setName] = useState('')
  const [icon, setIcon] = useState<string>(CATEGORY_ICONS[0])
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    await addCategory({ name: name.trim(), icon, color })
    setName('')
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
        <input
          type="text"
          placeholder="Nombre de la categoría"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
          required
        />
        <div>
          <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">Icono</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-xl ${
                  icon === i ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-100 dark:bg-neutral-800'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">Color</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`h-8 w-8 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-white' : ''}`}
              />
            ))}
          </div>
        </div>
        <button type="submit" className="rounded-xl bg-neutral-900 py-2 font-medium text-white dark:bg-white dark:text-neutral-900">
          Agregar categoría
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-neutral-900"
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
                style={{ backgroundColor: `${category.color}33` }}
              >
                {category.icon}
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-50">{category.name}</span>
            </div>
            <button onClick={() => deleteCategory(category.id)} className="text-sm text-red-500">
              Eliminar
            </button>
          </li>
        ))}
        {categories.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">Aún no tienes categorías.</p>
        )}
      </ul>
    </div>
  )
}
