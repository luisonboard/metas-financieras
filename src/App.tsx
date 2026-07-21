import { Suspense, lazy, useEffect, useState } from 'react'
import { addDays, format } from 'date-fns'
import { useBudgetStore } from './state/useBudgetStore'
import { useGamificationStore } from './state/useGamificationStore'
import { useAuthStore } from './state/useAuthStore'
import { pushOutbox } from './sync/sync'
import { disponible, parseLocalDate, todayLocalISODate } from './domain/budget'
import Onboarding from './ui/screens/Onboarding'
import Home from './ui/screens/Home'
import BottomNav from './ui/components/BottomNav'
import ToastStack from './ui/gamification/ToastStack'

const Gastos = lazy(() => import('./ui/screens/Gastos'))
const Calendario = lazy(() => import('./ui/screens/Calendario'))
const Metas = lazy(() => import('./ui/screens/Metas'))
const Perfil = lazy(() => import('./ui/screens/Perfil'))
const CierrePeriodo = lazy(() => import('./ui/screens/CierrePeriodo'))

export type Screen = 'home' | 'gastos' | 'calendario' | 'metas' | 'perfil'

const OUTBOX_FLUSH_INTERVAL_MS = 5 * 60 * 1000

function App() {
  const period = useBudgetStore((s) => s.period)
  const goals = useBudgetStore((s) => s.goals)
  const extraIncomes = useBudgetStore((s) => s.extraIncomes)
  const expenses = useBudgetStore((s) => s.expenses)
  const isLoading = useBudgetStore((s) => s.isLoading)
  const hydrateBudget = useBudgetStore((s) => s.hydrate)
  const gamificationState = useGamificationStore((s) => s.state)
  const hydrateGamification = useGamificationStore((s) => s.hydrate)
  const checkDailyStreak = useGamificationStore((s) => s.checkDailyStreak)
  const initAuth = useAuthStore((s) => s.init)
  const [screen, setScreen] = useState<Screen>('home')
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null)

  useEffect(() => {
    hydrateBudget()
    hydrateGamification()
    initAuth()
  }, [hydrateBudget, hydrateGamification, initAuth])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('join')
    if (!code) return
    setPendingJoinCode(code)
    setScreen('metas')
    const url = new URL(window.location.href)
    url.searchParams.delete('join')
    window.history.replaceState({}, '', url)
  }, [])

  useEffect(() => {
    const flush = () => {
      pushOutbox()
    }
    window.addEventListener('online', flush)
    const interval = setInterval(flush, OUTBOX_FLUSH_INTERVAL_MS)
    return () => {
      window.removeEventListener('online', flush)
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!period || !gamificationState) return
    const hoy = todayLocalISODate()
    if (gamificationState.lastStreakCheckDate === hoy) return
    const ayer = format(addDays(parseLocalDate(hoy), -1), 'yyyy-MM-dd')
    if (ayer < period.startDate) return
    const wasGreen = disponible(period, goals, extraIncomes, expenses, ayer) >= 0
    checkDailyStreak(hoy, wasGreen)
  }, [period, gamificationState, goals, extraIncomes, expenses, checkDailyStreak])

  if (isLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <p className="text-neutral-500 dark:text-neutral-400">Cargando…</p>
        <ToastStack />
      </main>
    )
  }

  if (!period) {
    return (
      <>
        <main>
          <Onboarding />
        </main>
        <ToastStack />
      </>
    )
  }

  const needsClosing = todayLocalISODate() >= period.nextPaydayDate
  if (needsClosing) {
    return (
      <>
        <main>
          <Suspense fallback={<ScreenFallback />}>
            <CierrePeriodo period={period} />
          </Suspense>
        </main>
        <ToastStack />
      </>
    )
  }

  return (
    <div className="min-h-svh bg-neutral-50 dark:bg-neutral-950">
      <main className="pb-20">
        {screen === 'home' && <Home onNavigate={setScreen} />}
        <Suspense fallback={<ScreenFallback />}>
          {screen === 'gastos' && <Gastos />}
          {screen === 'calendario' && <Calendario />}
          {screen === 'metas' && <Metas initialJoinCode={pendingJoinCode} />}
          {screen === 'perfil' && <Perfil />}
        </Suspense>
      </main>
      <BottomNav current={screen} onChange={setScreen} />
      <ToastStack />
    </div>
  )
}

function ScreenFallback() {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Cargando…</p>
    </div>
  )
}

export default App
