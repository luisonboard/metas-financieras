import { cuotaMeta } from './budget'
import type { Goal, GoalContribution } from './types'

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
