import type { AchievementId, GamificationState } from './types'

export type XpAction = 'expense_logged' | 'green_day' | 'goal_contribution' | 'goal_achieved'

const XP_BY_ACTION: Record<XpAction, number> = {
  expense_logged: 5,
  green_day: 10,
  goal_contribution: 10,
  goal_achieved: 100,
}

export function xpForAction(action: XpAction): number {
  return XP_BY_ACTION[action]
}

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1
}

export function applyStreak(
  state: Pick<GamificationState, 'currentStreak' | 'bestStreak'>,
  dayWasGreen: boolean,
): Pick<GamificationState, 'currentStreak' | 'bestStreak'> {
  const currentStreak = dayWasGreen ? state.currentStreak + 1 : 0
  const bestStreak = Math.max(state.bestStreak, currentStreak)
  return { currentStreak, bestStreak }
}

export interface AchievementContext {
  expenseCount: number
  bestStreak: number
  goalsAchievedCount: number
  categorizedExpenseCount: number
  periodClosedWithSurplus: boolean
  /** La mutación actual hizo que el desvío de metas pasara de atraso (> 0) a al día/adelanto (≤ 0). */
  goalBackOnTrack: boolean
  alreadyUnlocked: AchievementId[]
}

/** Devuelve los logros recién desbloqueados (aún no presentes en `alreadyUnlocked`). */
export function evaluateAchievements(ctx: AchievementContext): AchievementId[] {
  const has = (id: AchievementId) => ctx.alreadyUnlocked.includes(id)
  const unlocked: AchievementId[] = []

  if (!has('first_expense') && ctx.expenseCount >= 1) unlocked.push('first_expense')
  if (!has('week_green') && ctx.bestStreak >= 7) unlocked.push('week_green')
  if (!has('first_goal_achieved') && ctx.goalsAchievedCount >= 1) unlocked.push('first_goal_achieved')
  if (!has('ten_categorized') && ctx.categorizedExpenseCount >= 10) unlocked.push('ten_categorized')
  if (!has('period_closed_surplus') && ctx.periodClosedWithSurplus) unlocked.push('period_closed_surplus')
  if (!has('streak_7') && ctx.bestStreak >= 7) unlocked.push('streak_7')
  if (!has('streak_30') && ctx.bestStreak >= 30) unlocked.push('streak_30')
  if (!has('goal_back_on_track') && ctx.goalBackOnTrack) unlocked.push('goal_back_on_track')

  return unlocked
}

/** La mutación actual (gasto/ingreso) sacó a las metas del atraso: pasaron de > 0 días a ≤ 0. */
export function goalBackOnTrack(diasDesvioAntes: number | null, diasDesvioDespues: number | null): boolean {
  return diasDesvioAntes !== null && diasDesvioAntes > 0 && diasDesvioDespues !== null && diasDesvioDespues <= 0
}

export interface CelebrationTriggers {
  leveledUp: boolean
  goalAchieved: boolean
  periodClosedWithSurplus: boolean
}

export function detectCelebrations(
  previousLevel: number,
  newLevel: number,
  goalJustAchieved: boolean,
  periodClosedWithSurplus: boolean,
): CelebrationTriggers {
  return {
    leveledUp: newLevel > previousLevel,
    goalAchieved: goalJustAchieved,
    periodClosedWithSurplus,
  }
}

export function homeGreetingMessage(disponible: number): string {
  if (disponible > 0) return '¡Vas muy bien! Sigue así 💪'
  if (disponible === 0) return 'Estás justo en el límite. ¡Con cuidado hoy!'
  return 'Vas en negativo, pero cada día es una nueva oportunidad para recuperarte.'
}

export function expenseFeedbackMessage(withinBudget: boolean): string {
  return withinBudget
    ? '¡Gasto registrado dentro de tu presupuesto! Buen control.'
    : 'Gasto registrado. Te pasaste un poco del presupuesto, ajusta mañana y sigue adelante.'
}

export function periodClosedMessage(surplus: number): string {
  return surplus >= 0
    ? `Cerraste el período con $${surplus.toFixed(2)} de sobrante. ¡Excelente manejo!`
    : `Cerraste el período con $${Math.abs(surplus).toFixed(2)} de faltante. El próximo período es una nueva oportunidad.`
}

/** Mensaje para Home ligando el estado del día con las metas. `diasDesvio` null ⇒ sin metas ⇒ ''. */
export function goalScheduleMessage(diasDesvio: number | null): string {
  if (diasDesvio === null) return ''
  if (diasDesvio > 0) return `Tus metas van ${diasDesvio} día(s) atrasadas. Un día en verde las acerca de nuevo 🎯`
  if (diasDesvio === 0) return 'Tus metas van justo al día. ¡Sigue así! 🎯'
  return `¡Vas ${-diasDesvio} día(s) por delante! Podrías cumplir tus metas antes 🚀`
}

/** Feedback tras registrar/editar un gasto: cómo cambió el desvío. Devuelve null si no cambió o no hay metas. */
export function expenseGoalImpactMessage(diasDesvioAntes: number | null, diasDesvioDespues: number | null): string | null {
  if (diasDesvioAntes === null || diasDesvioDespues === null) return null
  const delta = diasDesvioDespues - diasDesvioAntes
  if (delta === 0) return null
  if (delta > 0) return `Este gasto alejó tus metas ${delta} día(s) ⏳`
  return `¡Tus metas se acercaron ${-delta} día(s)! 🎯`
}
