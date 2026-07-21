import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../sync/supabaseClient'
import { setCurrentUserId } from '../sync/session'
import { runFullSync } from '../sync/sync'
import { startRealtimeSync, stopRealtimeSync } from '../sync/realtime'
import { useBudgetStore } from './useBudgetStore'
import { useGamificationStore } from './useGamificationStore'

interface AuthState {
  user: User | null
  isLoading: boolean
  isSyncing: boolean
  error: string | null
  pendingEmailConfirmation: boolean
  isSupabaseConfigured: boolean

  init: () => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

async function reloadLocalStores(): Promise<void> {
  await Promise.all([useBudgetStore.getState().hydrate(), useGamificationStore.getState().hydrate()])
}

function syncInBackground(userId: string, set: (partial: Partial<AuthState>) => void): void {
  set({ isSyncing: true })
  runFullSync(userId)
    .then(reloadLocalStores)
    .catch((err: unknown) => console.warn('[auth] fallo la sincronización', err))
    .finally(() => set({ isSyncing: false }))
}

// Módulo-level (no en el store): evita registrar el listener de auth más de una vez si
// `init()` se llama varias veces (p. ej. el doble efecto de React StrictMode en desarrollo).
let hasInitialized = false

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isSyncing: false,
  error: null,
  pendingEmailConfirmation: false,
  isSupabaseConfigured,

  init: async () => {
    if (hasInitialized) return
    hasInitialized = true

    if (!supabase) {
      set({ isLoading: false })
      return
    }

    const { data } = await supabase.auth.getSession()
    const user = data.session?.user ?? null
    setCurrentUserId(user?.id ?? null)
    set({ user, isLoading: false })
    if (user) {
      syncInBackground(user.id, set)
      startRealtimeSync(user.id)
    }

    supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null
      setCurrentUserId(nextUser?.id ?? null)
      set({ user: nextUser })

      if (event === 'SIGNED_IN' && nextUser) {
        syncInBackground(nextUser.id, set)
        startRealtimeSync(nextUser.id)
      }
      if (event === 'SIGNED_OUT') {
        setCurrentUserId(null)
        stopRealtimeSync()
        reloadLocalStores()
      }
    })
  },

  signUp: async (email, password) => {
    if (!supabase) return
    set({ error: null, pendingEmailConfirmation: false })
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      set({ error: error.message })
      return
    }
    if (!data.session) set({ pendingEmailConfirmation: true })
  },

  signIn: async (email, password) => {
    if (!supabase) return
    set({ error: null })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) set({ error: error.message })
  },

  signOut: async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  },

  clearError: () => set({ error: null }),
}))
