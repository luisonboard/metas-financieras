import { useGamificationStore } from '../../state/useGamificationStore'
import { ACHIEVEMENT_LABELS } from '../gamification/achievementLabels'
import AccountSection from '../components/AccountSection'
import type { AchievementId } from '../../domain/types'

const ALL_ACHIEVEMENTS = Object.keys(ACHIEVEMENT_LABELS) as AchievementId[]

export default function Perfil() {
  const state = useGamificationStore((s) => s.state)

  if (!state) return null

  const xpForCurrentLevel = (state.level - 1) ** 2 * 100
  const xpForNextLevel = state.level ** 2 * 100
  const span = xpForNextLevel - xpForCurrentLevel
  const progressToNext = span === 0 ? 0 : ((state.xp - xpForCurrentLevel) / span) * 100

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Perfil</h1>

      <AccountSection />

      <div className="rounded-3xl bg-white p-6 text-center shadow-sm dark:bg-neutral-900">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Nivel</p>
        <p className="text-4xl font-bold text-neutral-900 dark:text-neutral-50">{state.level}</p>
        <div className="mx-auto mt-3 h-2 w-full max-w-xs rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div
            className="h-2 rounded-full bg-emerald-500"
            style={{ width: `${Math.min(100, Math.max(0, progressToNext))}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{state.xp} XP</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 uppercase dark:text-neutral-400">Racha actual</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">🔥 {state.currentStreak}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 uppercase dark:text-neutral-400">Mejor racha</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">🏅 {state.bestStreak}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold text-neutral-900 dark:text-neutral-50">Logros</h2>
        <div className="grid grid-cols-2 gap-3">
          {ALL_ACHIEVEMENTS.map((id) => {
            const unlocked = state.achievements.includes(id)
            const info = ACHIEVEMENT_LABELS[id]
            return (
              <div
                key={id}
                className={`rounded-2xl p-3 text-center shadow-sm ${
                  unlocked ? 'bg-white dark:bg-neutral-900' : 'bg-neutral-100 opacity-50 dark:bg-neutral-900/40'
                }`}
              >
                <p className="text-2xl">{info.icon}</p>
                <p className="mt-1 text-sm font-medium text-neutral-900 dark:text-neutral-50">{info.title}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{info.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
