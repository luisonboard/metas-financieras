import { useMemo, useState } from 'react'
import { addDays, eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { useBudgetStore } from '../../state/useBudgetStore'
import { calendarioDisponibleExtendido, disponible, periodosNecesariosParaCubrir, todayLocalISODate } from '../../domain/budget'
import type { DisponibleDia } from '../../domain/budget'
import { diasDesvioMetas, fechaEstimadaFin, metasElasticas } from '../../domain/goals'
import type { Category, Expense, ExtraIncome, Goal } from '../../domain/types'

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** Tope de períodos simulados hacia adelante: evita grillas descontroladamente grandes
 * si una meta tiene una fecha de fin muy lejana. Se puede seguir extendiendo a mano. */
const MAX_PERIODOS_SIGUIENTES = 24

export default function Calendario() {
  const period = useBudgetStore((s) => s.period)
  const goals = useBudgetStore((s) => s.goals)
  const extraIncomes = useBudgetStore((s) => s.extraIncomes)
  const expenses = useBudgetStore((s) => s.expenses)
  const categories = useBudgetStore((s) => s.categories)
  const hoy = todayLocalISODate()

  const [selectedDate, setSelectedDate] = useState(hoy)
  const [periodosExtra, setPeriodosExtra] = useState(0)

  const diasDesvio = period ? diasDesvioMetas(disponible(period, goals, extraIncomes, expenses, hoy), goals, hoy) : null

  const fechaEstimadaPorFecha = useMemo(() => {
    const map = new Map<string, Goal[]>()
    if (diasDesvio === null || diasDesvio === 0) return map
    for (const goal of metasElasticas(goals, hoy)) {
      const fecha = fechaEstimadaFin(goal, diasDesvio)
      if (fecha === goal.endDate) continue
      const lista = map.get(fecha) ?? []
      lista.push(goal)
      map.set(fecha, lista)
    }
    return map
  }, [goals, hoy, diasDesvio])

  const metaMasLejana = useMemo(() => {
    if (!period) return hoy
    let max = period.nextPaydayDate
    for (const g of goals) {
      if (g.status !== 'abandoned' && g.endDate > max) max = g.endDate
    }
    for (const fecha of fechaEstimadaPorFecha.keys()) {
      if (fecha > max) max = fecha
    }
    return max
  }, [goals, period, hoy, fechaEstimadaPorFecha])

  // La proyección siempre cubre al menos hasta la meta activa más lejana, para que ninguna
  // quede fuera del calendario; "Cargar más período" permite seguir explorando a mano.
  const periodosNecesarios = period ? periodosNecesariosParaCubrir(period, metaMasLejana) : 0
  const periodosBase = period?.nextSalaryAmount ? Math.max(1, periodosNecesarios) : 0
  const periodosSiguientes = Math.min(MAX_PERIODOS_SIGUIENTES, periodosBase + periodosExtra)
  const puedeCargarMas = period?.nextSalaryAmount != null && periodosSiguientes < MAX_PERIODOS_SIGUIENTES
  const metaFueraDeHorizonte = periodosBase > MAX_PERIODOS_SIGUIENTES

  const dias = useMemo(() => {
    if (!period) return []
    return calendarioDisponibleExtendido(period, goals, extraIncomes, expenses, hoy, periodosSiguientes)
  }, [period, goals, extraIncomes, expenses, hoy, periodosSiguientes])

  const porFecha = useMemo(() => new Map(dias.map((d) => [d.date, d])), [dias])

  const goalsPorFecha = useMemo(() => {
    const map = new Map<string, Goal[]>()
    for (const goal of goals) {
      if (goal.status === 'abandoned') continue
      let cursor = parseISO(goal.startDate)
      const fin = parseISO(goal.endDate)
      while (cursor <= fin) {
        const key = format(cursor, 'yyyy-MM-dd')
        const lista = map.get(key) ?? []
        lista.push(goal)
        map.set(key, lista)
        cursor = addDays(cursor, 1)
      }
    }
    return map
  }, [goals])

  const semanas = useMemo(() => {
    if (dias.length === 0) return []
    const inicioGrilla = startOfWeek(parseISO(dias[0].date), { weekStartsOn: 0 })
    const finGrilla = endOfWeek(parseISO(dias[dias.length - 1].date), { weekStartsOn: 0 })
    const todosLosDias = eachDayOfInterval({ start: inicioGrilla, end: finGrilla }).map((d) => format(d, 'yyyy-MM-dd'))

    const resultado: string[][] = []
    for (let i = 0; i < todosLosDias.length; i += 7) {
      resultado.push(todosLosDias.slice(i, i + 7))
    }
    return resultado
  }, [dias])

  if (!period) return null

  const seleccionado = porFecha.get(selectedDate)
  const inicioPeriodoSiguiente = dias.find((d) => d.periodo === 'siguiente')?.date

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Calendario</h1>

      {inicioPeriodoSiguiente && (
        <p className="rounded-xl bg-violet-50 p-3 text-xs text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
          A partir del {format(parseISO(inicioPeriodoSiguiente), "d 'de' MMMM", { locale: es })} se muestra una
          proyección de {periodosSiguientes} período(s) siguiente(s), estimada con tu próximo sueldo ($
          {period.nextSalaryAmount.toFixed(2)}).
        </p>
      )}

      {metaFueraDeHorizonte && (
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          Tienes una meta cuya fecha de fin está más allá de lo que se puede proyectar aquí (~{MAX_PERIODOS_SIGUIENTES}{' '}
          períodos). Usa "Cargar más período" para ir acercándote.
        </p>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="mt-2 flex flex-col gap-1">
          {semanas.map((semana) => (
            <div key={semana[0]} className="grid grid-cols-7 gap-1">
              {semana.map((fecha) => (
                <CalendarCell
                  key={fecha}
                  fecha={fecha}
                  dia={porFecha.get(fecha)}
                  goalsDelDia={goalsPorFecha.get(fecha)}
                  finEstimadoDelDia={fechaEstimadaPorFecha.get(fecha)}
                  esHoy={fecha === hoy}
                  esSeleccionado={fecha === selectedDate}
                  onSelect={() => setSelectedDate(fecha)}
                />
              ))}
            </div>
          ))}
        </div>

        {puedeCargarMas && (
          <button
            onClick={() => setPeriodosExtra((n) => n + 1)}
            className="mt-3 w-full rounded-xl border border-dashed border-neutral-300 py-2 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
          >
            Cargar más período →
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-neutral-500 dark:text-neutral-400">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-emerald-100 dark:bg-emerald-900/40" /> En positivo
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-red-100 dark:bg-red-900/40" /> En negativo
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-dashed border-neutral-400" /> Proyectado
        </span>
        {inicioPeriodoSiguiente && (
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded border-2 border-dashed border-violet-400" /> Período siguiente
          </span>
        )}
        <span className="flex items-center gap-1">🎯 Inicio de meta</span>
        <span className="flex items-center gap-1">🏁 Fin de meta</span>
        {fechaEstimadaPorFecha.size > 0 && <span className="flex items-center gap-1">🚩 Fin estimado</span>}
      </div>

      {seleccionado && (
        <DiaDetalle
          dia={seleccionado}
          hoy={hoy}
          goalsDelDia={goalsPorFecha.get(selectedDate)}
          metasFinEstimadoDelDia={fechaEstimadaPorFecha.get(selectedDate)}
          expensesDelDia={expenses.filter((e) => e.date === selectedDate)}
          incomesDelDia={extraIncomes.filter((e) => e.date === selectedDate)}
          categories={categories}
        />
      )}
    </div>
  )
}

interface CellProps {
  fecha: string
  dia: DisponibleDia | undefined
  goalsDelDia: Goal[] | undefined
  finEstimadoDelDia: Goal[] | undefined
  esHoy: boolean
  esSeleccionado: boolean
  onSelect: () => void
}

function CalendarCell({ fecha, dia, goalsDelDia, finEstimadoDelDia, esHoy, esSeleccionado, onSelect }: CellProps) {
  const numero = format(parseISO(fecha), 'd')

  if (!dia) {
    return (
      <span className="aspect-square rounded-lg text-center text-xs leading-[2.2rem] text-neutral-300 dark:text-neutral-700">
        {numero}
      </span>
    )
  }

  const colorClasses =
    dia.disponible >= 0
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'

  const bordeProyeccion =
    dia.periodo === 'siguiente'
      ? 'border-2 border-dashed border-violet-400 opacity-80'
      : dia.esProyectado
        ? 'border border-dashed border-current opacity-70'
        : ''

  const empiezaMeta = goalsDelDia?.some((g) => g.startDate === fecha)
  const terminaMeta = goalsDelDia?.some((g) => g.endDate === fecha)
  const finEstimado = finEstimadoDelDia && finEstimadoDelDia.length > 0
  const goalBadge = empiezaMeta ? '🎯' : terminaMeta ? '🏁' : finEstimado ? '🚩' : null

  return (
    <button
      onClick={onSelect}
      className={`relative aspect-square rounded-lg text-xs font-medium transition ${colorClasses} ${bordeProyeccion} ${
        esSeleccionado ? 'ring-2 ring-neutral-900 dark:ring-white' : esHoy ? 'ring-1 ring-neutral-400 dark:ring-neutral-500' : ''
      }`}
    >
      {numero}
      {goalBadge && <span className="absolute -top-1 -right-1 text-[0.6rem] leading-none">{goalBadge}</span>}
      {!goalBadge && goalsDelDia && goalsDelDia.length > 0 && (
        <span className="absolute right-1 bottom-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
      )}
    </button>
  )
}

interface DiaDetalleProps {
  dia: DisponibleDia
  hoy: string
  goalsDelDia: Goal[] | undefined
  metasFinEstimadoDelDia: Goal[] | undefined
  expensesDelDia: Expense[]
  incomesDelDia: ExtraIncome[]
  categories: Category[]
}

function DiaDetalle({ dia, hoy, goalsDelDia, metasFinEstimadoDelDia, expensesDelDia, incomesDelDia, categories }: DiaDetalleProps) {
  const etiqueta =
    dia.periodoIndex > 0
      ? `Período siguiente${dia.periodoIndex > 1 ? ` #${dia.periodoIndex}` : ''} (estimado)`
      : dia.esProyectado
        ? 'Proyección'
        : dia.date === hoy
          ? 'Hoy'
          : 'Histórico'

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
      <p className="text-sm font-medium text-neutral-900 capitalize dark:text-neutral-50">
        {format(parseISO(dia.date), "EEEE d 'de' MMMM", { locale: es })}
      </p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{etiqueta}</p>
      <div className="mt-3 grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-xs text-neutral-500 uppercase dark:text-neutral-400">PD efectivo</p>
          <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">${dia.pdEfectivo.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500 uppercase dark:text-neutral-400">
            Disponible{dia.esProyectado ? ' (proyectado)' : ''}
          </p>
          <p
            className={`text-lg font-semibold ${
              dia.disponible >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            ${dia.disponible.toFixed(2)}
          </p>
        </div>
      </div>

      {(() => {
        const finEstimadoIds = new Set((metasFinEstimadoDelDia ?? []).map((g) => g.id))
        const soloFinEstimado = (metasFinEstimadoDelDia ?? []).filter((g) => !goalsDelDia?.some((gd) => gd.id === g.id))
        const todasLasMetas = [...(goalsDelDia ?? []), ...soloFinEstimado]
        if (todasLasMetas.length === 0) return null
        return (
          <div className="mt-4 flex flex-col gap-1 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase dark:text-neutral-400">Metas este día</p>
            {todasLasMetas.map((goal) => {
              const esInicio = goal.startDate === dia.date
              const esFin = goal.endDate === dia.date
              const esFinEstimado = finEstimadoIds.has(goal.id)
              const notas = [
                esInicio && esFin ? 'inicio y fin' : esInicio ? 'inicio' : esFin ? 'fin' : null,
                esFinEstimado ? 'fin estimado' : null,
              ].filter((n): n is string => n !== null)
              const nota = notas.length > 0 ? notas.join(', ') : 'activa'
              return (
                <p key={goal.id} className="text-sm text-neutral-700 dark:text-neutral-300">
                  {goal.name} <span className="text-xs text-neutral-400 dark:text-neutral-500">({nota})</span>
                </p>
              )
            })}
          </div>
        )
      })()}

      {(expensesDelDia.length > 0 || incomesDelDia.length > 0) && (
        <div className="mt-4 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 uppercase dark:text-neutral-400">Gastos e ingresos este día</p>
          <div className="mt-2 flex flex-col gap-1">
            {expensesDelDia.map((expense) => {
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
            {incomesDelDia.map((income) => (
              <div key={income.id} className="flex items-center justify-between text-sm">
                <span className="text-neutral-700 dark:text-neutral-300">{income.description || 'Ingreso extra'}</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">+${income.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
