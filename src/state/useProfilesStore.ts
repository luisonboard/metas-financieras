import { create } from 'zustand'
import { supabase } from '../sync/supabaseClient'

interface ProfileInfo {
  id: string
  email: string
  displayName: string | null
}

interface ProfilesState {
  byId: Record<string, ProfileInfo>
  fetchProfiles: (ids: string[]) => Promise<void>
  labelFor: (id: string) => string
}

export const useProfilesStore = create<ProfilesState>((set, get) => ({
  byId: {},

  fetchProfiles: async (ids) => {
    if (!supabase) return
    const missing = [...new Set(ids)].filter((id) => !get().byId[id])
    if (missing.length === 0) return

    const { data } = await supabase.from('profiles').select('id, email, display_name').in('id', missing)
    if (!data) return

    set((state) => {
      const byId = { ...state.byId }
      for (const row of data as { id: string; email: string; display_name: string | null }[]) {
        byId[row.id] = { id: row.id, email: row.email, displayName: row.display_name }
      }
      return { byId }
    })
  },

  labelFor: (id) => {
    const profile = get().byId[id]
    if (!profile) return 'Alguien'
    return profile.displayName?.trim() || profile.email.split('@')[0]
  },
}))
