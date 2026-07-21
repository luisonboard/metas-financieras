import { cuotaMeta } from '../../domain/budget'
import type { Category, Expense, ExtraIncome, Goal } from '../../domain/types'

interface Props {
  title: string
  expenses: Expense[]
  incomes: ExtraIncome[]
  goals: Goal[]
  categories: Category[]
  onGoalClick?: (goal: Goal) => void
}

export default function DiaResumen({ title, expenses, incomes, goals, categories, onGoalClick }: Props) {
  const hayContenido = expenses.length > 0 || incomes.length > 0 || goals.length > 0

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
      <p className="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">{title}</p>

      {!hayContenido && (
        <p className="mt-2 text-sm text-neutral-400 dark:text-neutral-500">Sin movimientos registrados.</p>
      )}

      {expenses.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {expenses.map((expense) => {
            const category = categories.find((c) => c.id === expense.categoryId)
            return (
              <div key={expense.id} className="flex items-center justify-between text-sm">
                <span className="text-neutral-700 dark:text-neutral-300">
                  {category ? `${category.icon} ${category.name}` : '💸 Sin categoría'}
                  {expense.note ? ` · ${expense.note}` : ''}
                </span>
                <span className="font-medium text-red-600 dark:text-red-400">-${expense.amount.toFixed(2)}</span>
              </div>
            )
          })}
        </div>
      )}

      {incomes.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {incomes.map((income) => (
            <div key={income.id} className="flex items-center justify-between text-sm">
              <span className="text-neutral-700 dark:text-neutral-300">{income.description || 'Ingreso extra'}</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">+${income.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {goals.length > 0 && (
        <div className="mt-3 flex flex-col gap-1 border-t border-neutral-100 pt-2 dark:border-neutral-800">
          {goals.map((goal) => (
            <button
              key={goal.id}
              type="button"
              onClick={() => onGoalClick?.(goal)}
              className="flex items-center justify-between text-left text-sm text-neutral-700 dark:text-neutral-300"
            >
              <span>🎯 {goal.name}</span>
              <span className="font-medium text-red-600 dark:text-red-400">
                -${cuotaMeta(goal).toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
