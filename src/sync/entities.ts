/** Identifica cada tipo de fila sincronizable con Supabase (usado por el outbox y los mappers). */
export type SyncEntity =
  | 'period'
  | 'category'
  | 'expense'
  | 'extraIncome'
  | 'goal'
  | 'goalMember'
  | 'goalContribution'
  | 'gamification'
