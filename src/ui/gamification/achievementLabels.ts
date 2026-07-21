import type { AchievementId } from '../../domain/types'

export const ACHIEVEMENT_LABELS: Record<AchievementId, { title: string; description: string; icon: string }> = {
  first_expense: { title: 'Primer paso', description: 'Registraste tu primer gasto', icon: '📝' },
  week_green: { title: 'Semana en verde', description: 'Una semana completa con Disponible positivo', icon: '🌱' },
  first_goal_achieved: { title: 'Meta cumplida', description: 'Completaste tu primera meta de ahorro', icon: '🏆' },
  ten_categorized: { title: 'Organizado', description: 'Categorizaste 10 gastos', icon: '🗂️' },
  period_closed_surplus: { title: 'Cierre con sobrante', description: 'Cerraste un período con dinero de sobra', icon: '💰' },
  streak_7: { title: 'Racha de 7', description: '7 días seguidos en verde', icon: '🔥' },
  streak_30: { title: 'Racha de 30', description: '30 días seguidos en verde', icon: '🔥🔥' },
  goal_back_on_track: { title: 'Metas recuperadas', description: 'Sacaste tus metas del atraso', icon: '🎯' },
}
