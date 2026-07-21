import { addDays, format } from 'date-fns'
import { cuotaMeta, parseLocalDate } from './budget'
import type { Goal, GoalContribution, ISODate } from './types'

export type Milestone = 25 | 50 | 75 | 100

const MILESTONES: Milestone[] = [25, 50, 75, 100]

export function goalProgress(goal: Pick<Goal, 'targetAmount'>, contributions: Pick<GoalContribution, 'amount'>[]): number {
  const aportado = contributions.reduce((sum, c) => sum + c.amount, 0)
  if (goal.targetAmount <= 0) return 0
  return Math.min(100, (aportado / goal.targetAmount) * 100)
}

/** Hitos alcanzados (25/50/75/100 %) dado el progreso actual. */
export function reachedMilestones(progressPercent: number): Milestone[] {
  return MILESTONES.filter((m) => progressPercent >= m)
}

/** Cuota diaria sugerida por miembro para una meta compartida entre `memberCount` personas. */
export function cuotaMetaPorMiembro(goal: Pick<Goal, 'targetAmount' | 'startDate' | 'endDate'>, memberCount: number): number {
  if (memberCount <= 0) return 0
  return cuotaMeta(goal) / memberCount
}

/** Metas cuyo fin estimado es elástico al comportamiento: activas y con fin hoy o en el futuro. */
export function metasElasticas<G extends Pick<Goal, 'status' | 'endDate'>>(goals: G[], hoy: ISODate): G[] {
  return goals.filter((g) => g.status === 'active' && g.endDate >= hoy)
}

/**
 * Desvío en días del plan de metas según el Disponible de hoy.
 * > 0 = días de atraso (ceil, pesimista); ≤ 0 = días de adelanto potencial (floor, conservador).
 * `null` si no hay metas elásticas o su cuota total es 0.
 */
export function diasDesvioMetas(
  disponibleHoy: number,
  goals: Pick<Goal, 'status' | 'endDate' | 'targetAmount' | 'startDate'>[],
  hoy: ISODate,
): number | null {
  const cuotaTotal = metasElasticas(goals, hoy).reduce((sum, g) => sum + cuotaMeta(g), 0)
  if (cuotaTotal <= 0) return null
  if (disponibleHoy < 0) return Math.ceil(-disponibleHoy / cuotaTotal)
  return -Math.floor(disponibleHoy / cuotaTotal) || 0
}

/** Fecha estimada de fin de una meta dado el desvío actual (endDate + diasDesvio). */
export function fechaEstimadaFin(goal: Pick<Goal, 'endDate'>, diasDesvio: number): ISODate {
  return format(addDays(parseLocalDate(goal.endDate), diasDesvio), 'yyyy-MM-dd')
}
