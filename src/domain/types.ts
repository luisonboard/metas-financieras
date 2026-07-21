export type ISODate = string // YYYY-MM-DD
export type ISODateTime = string // full ISO 8601 timestamp

interface BaseEntity {
  createdAt: ISODateTime
  updatedAt: ISODateTime
  deletedAt: ISODateTime | null
}

export interface Period extends BaseEntity {
  id: string
  userId: string | null
  initialMoney: number
  startDate: ISODate
  nextPaydayDate: ISODate // exclusiva: el período cubre [startDate, nextPaydayDate)
  /** Monto esperado del próximo sueldo; permite proyectar el calendario más allá de este período. */
  nextSalaryAmount: number
  status: 'active' | 'closed'
}

export interface Category extends BaseEntity {
  id: string
  userId: string | null
  name: string
  icon: string
  color: string
}

export interface Expense extends BaseEntity {
  id: string
  userId: string | null
  periodId: string
  categoryId: string | null
  amount: number
  date: ISODate
  note?: string
}

export interface ExtraIncome extends BaseEntity {
  id: string
  userId: string | null
  periodId: string
  amount: number
  date: ISODate
  description?: string
}

export interface Goal extends BaseEntity {
  id: string
  ownerId: string | null
  name: string
  targetAmount: number
  startDate: ISODate
  endDate: ISODate // rango inclusivo de días en que descuenta cuota
  status: 'active' | 'achieved' | 'abandoned'
  isShared: boolean
}

export interface GoalMember extends BaseEntity {
  id: string
  goalId: string
  userId: string
  role: 'owner' | 'member'
}

export interface GoalContribution extends BaseEntity {
  id: string
  goalId: string
  userId: string | null
  date: ISODate
  amount: number
}

export interface GamificationState extends BaseEntity {
  userId: string | null
  currentStreak: number
  bestStreak: number
  xp: number
  level: number
  achievements: AchievementId[]
  /** Último día calendario evaluado para la racha, evita contarlo dos veces. */
  lastStreakCheckDate: ISODate | null
}

export type AchievementId =
  | 'first_expense'
  | 'week_green'
  | 'first_goal_achieved'
  | 'ten_categorized'
  | 'period_closed_surplus'
  | 'streak_7'
  | 'streak_30'
  | 'goal_back_on_track'
