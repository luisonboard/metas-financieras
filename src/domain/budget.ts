import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { Expense, ExtraIncome, Goal, ISODate, Period } from './types'

type PeriodDates = Pick<Period, 'initialMoney' | 'startDate' | 'nextPaydayDate'>
type GoalRange = Pick<Goal, 'targetAmount' | 'startDate' | 'endDate' | 'status' | 'updatedAt'>
type IncomeLike = Pick<ExtraIncome, 'amount' | 'date'>
type ExpenseLike = Pick<Expense, 'amount' | 'date'>

export function parseLocalDate(date: ISODate): Date {
  return parseISO(date)
}

export function todayLocalISODate(reference: Date = new Date()): ISODate {
  return format(reference, 'yyyy-MM-dd')
}

function inRange(date: ISODate, start: ISODate, end: ISODate): boolean {
  return date >= start && date <= end
}

export function diasTotales(period: PeriodDates): number {
  return differenceInCalendarDays(parseLocalDate(period.nextPaydayDate), parseLocalDate(period.startDate))
}

export function diasTranscurridos(period: PeriodDates, hoy: ISODate): number {
  const limite = addDays(parseLocalDate(period.nextPaydayDate), -1)
  const hoyDate = parseLocalDate(hoy)
  const efectiva = hoyDate < limite ? hoyDate : limite
  return differenceInCalendarDays(efectiva, parseLocalDate(period.startDate)) + 1
}

export function pdBase(period: PeriodDates): number {
  return period.initialMoney / diasTotales(period)
}

export function cuotaMeta(goal: Pick<Goal, 'targetAmount' | 'startDate' | 'endDate'>): number {
  const dias = differenceInCalendarDays(parseLocalDate(goal.endDate), parseLocalDate(goal.startDate)) + 1
  return goal.targetAmount / dias
}

/** Una meta descuenta en `dia` si estaba activa ese día: activa hoy, o lo estuvo hasta el día
 * de su cambio de estado (aproximado con `updatedAt`, ya que no hay historial de estados). */
function metaAplicaEnDia(goal: GoalRange, dia: ISODate): boolean {
  if (!inRange(dia, goal.startDate, goal.endDate)) return false
  if (goal.status === 'active') return true
  const fechaCambio = goal.updatedAt.slice(0, 10)
  return dia <= fechaCambio
}

export function pdEfectivo(period: PeriodDates, goals: GoalRange[], dia: ISODate): number {
  const base = pdBase(period)
  const descuento = goals
    .filter((g) => metaAplicaEnDia(g, dia))
    .reduce((sum, g) => sum + cuotaMeta(g), 0)
  return base - descuento
}

export function acumulado(
  period: PeriodDates,
  goals: GoalRange[],
  extraIncomes: IncomeLike[],
  hoy: ISODate,
): number {
  const dias = diasTranscurridos(period, hoy)
  let presupuesto = 0
  for (let i = 0; i < dias; i++) {
    const dia = format(addDays(parseLocalDate(period.startDate), i), 'yyyy-MM-dd')
    presupuesto += pdEfectivo(period, goals, dia)
  }
  const extras = extraIncomes.filter((e) => e.date <= hoy).reduce((sum, e) => sum + e.amount, 0)
  return presupuesto + extras
}

export function disponible(
  period: PeriodDates,
  goals: GoalRange[],
  extraIncomes: IncomeLike[],
  expenses: ExpenseLike[],
  hoy: ISODate,
): number {
  const acc = acumulado(period, goals, extraIncomes, hoy)
  const gastos = expenses.filter((e) => e.date <= hoy).reduce((sum, e) => sum + e.amount, 0)
  return acc - gastos
}

export function pdSugerido(
  period: PeriodDates,
  goals: GoalRange[],
  extraIncomes: IncomeLike[],
  expenses: ExpenseLike[],
  hoy: ISODate,
): number {
  const diasRestantes = differenceInCalendarDays(parseLocalDate(period.nextPaydayDate), parseLocalDate(hoy))
  if (diasRestantes <= 0) return 0

  const extras = extraIncomes.filter((e) => e.date <= hoy).reduce((sum, e) => sum + e.amount, 0)
  const gastos = expenses.filter((e) => e.date <= hoy).reduce((sum, e) => sum + e.amount, 0)
  const metasRestantes = goals
    .filter((g) => g.status === 'active' && g.endDate >= hoy)
    .reduce((sum, g) => {
      const inicioEfectivo = hoy >= g.startDate ? hoy : g.startDate
      const diasMetaRestantes = differenceInCalendarDays(parseLocalDate(g.endDate), parseLocalDate(inicioEfectivo)) + 1
      return sum + cuotaMeta(g) * diasMetaRestantes
    }, 0)

  return Math.max(0, (period.initialMoney + extras - gastos - metasRestantes) / diasRestantes)
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export interface DisponibleDia {
  date: ISODate
  disponible: number
  pdEfectivo: number
  esProyectado: boolean
  /** 'siguiente' cuando el día pertenece a la proyección de algún período hipotético posterior al actual. */
  periodo: 'actual' | 'siguiente'
  /** 0 = período actual; 1, 2, 3... = generación del período simulado (permite distinguir varios a futuro). */
  periodoIndex: number
}

/**
 * Disponible histórico y proyectado para cada día del período [startDate, nextPaydayDate).
 * Para días futuros no hay una fórmula nueva: reutiliza `disponible()`, que al no encontrar
 * gastos/ingresos registrados después de hoy, sigue acumulando PD_efectivo día a día.
 */
export function calendarioDisponible(
  period: PeriodDates,
  goals: GoalRange[],
  extraIncomes: IncomeLike[],
  expenses: ExpenseLike[],
  hoy: ISODate,
  periodoIndex = 0,
): DisponibleDia[] {
  const totalDias = diasTotales(period)
  const dias: DisponibleDia[] = []
  for (let i = 0; i < totalDias; i++) {
    const date = format(addDays(parseLocalDate(period.startDate), i), 'yyyy-MM-dd')
    dias.push({
      date,
      disponible: disponible(period, goals, extraIncomes, expenses, date),
      pdEfectivo: pdEfectivo(period, goals, date),
      esProyectado: date > hoy,
      periodo: periodoIndex === 0 ? 'actual' : 'siguiente',
      periodoIndex,
    })
  }
  return dias
}

type PeriodoSimulado = PeriodDates & { nextSalaryAmount?: number }

function simularPeriodoSiguiente(anterior: PeriodoSimulado, sobranteCierre: number): PeriodoSimulado | null {
  if (!anterior.nextSalaryAmount || anterior.nextSalaryAmount <= 0) return null
  const duracion = diasTotales(anterior)
  if (duracion <= 0) return null
  return {
    initialMoney: sobranteCierre + anterior.nextSalaryAmount,
    startDate: anterior.nextPaydayDate,
    nextPaydayDate: format(addDays(parseLocalDate(anterior.nextPaydayDate), duracion), 'yyyy-MM-dd'),
    // Se asume que el sueldo se repite con la misma cadencia y monto (única referencia disponible).
    nextSalaryAmount: anterior.nextSalaryAmount,
  }
}

/**
 * Extiende `calendarioDisponible` encadenando `periodosSiguientes` períodos hipotéticos, usando
 * `nextSalaryAmount` (monto esperado del próximo sueldo, capturado en Onboarding/CierrePeriodo).
 * Cada período simulado hereda su `initialMoney` del sobrante/faltante de cierre del anterior más
 * el sueldo esperado, y se asume la misma duración y monto de sueldo para los siguientes (única
 * referencia disponible). Si no hay `nextSalaryAmount`, no extiende más allá del período actual.
 */
export function calendarioDisponibleExtendido(
  period: PeriodoSimulado,
  goals: GoalRange[],
  extraIncomes: IncomeLike[],
  expenses: ExpenseLike[],
  hoy: ISODate,
  periodosSiguientes = 1,
): DisponibleDia[] {
  const dias = calendarioDisponible(period, goals, extraIncomes, expenses, hoy, 0)

  let periodoAnterior: PeriodoSimulado = period
  let extraIncomesAnterior = extraIncomes
  let expensesAnterior = expenses

  for (let i = 1; i <= periodosSiguientes; i++) {
    const ultimoDia = format(addDays(parseLocalDate(periodoAnterior.nextPaydayDate), -1), 'yyyy-MM-dd')
    const sobranteCierre = disponible(periodoAnterior, goals, extraIncomesAnterior, expensesAnterior, ultimoDia)
    const siguiente = simularPeriodoSiguiente(periodoAnterior, sobranteCierre)
    if (!siguiente) break

    // Cada período simulado es hipotético: sin gastos/ingresos propios todavía, e íntegramente proyectado.
    const diasSiguiente = calendarioDisponible(siguiente, goals, [], [], siguiente.startDate, i).map((dia) => ({
      ...dia,
      esProyectado: true,
    }))
    dias.push(...diasSiguiente)

    periodoAnterior = siguiente
    extraIncomesAnterior = []
    expensesAnterior = []
  }

  return dias
}

/**
 * Cuántos períodos hipotéticos (además del actual) hacen falta encadenar para que `hastaFecha`
 * quede cubierta por la proyección. Útil para asegurar que el calendario siempre muestre las
 * fechas de las metas, sin importar qué tan lejos estén.
 */
export function periodosNecesariosParaCubrir(period: PeriodDates, hastaFecha: ISODate): number {
  if (hastaFecha < period.nextPaydayDate) return 0
  const duracion = diasTotales(period)
  if (duracion <= 0) return 0
  const diasFaltantes = differenceInCalendarDays(parseLocalDate(hastaFecha), parseLocalDate(period.nextPaydayDate)) + 1
  return Math.ceil(diasFaltantes / duracion)
}
