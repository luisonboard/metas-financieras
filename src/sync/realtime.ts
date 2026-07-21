import type { RealtimeChannel } from '@supabase/supabase-js'
import { db } from '../db/dexie'
import { useBudgetStore } from '../state/useBudgetStore'
import { useProfilesStore } from '../state/useProfilesStore'
import { useToastStore } from '../state/useToastStore'
import { supabase } from './supabaseClient'
import { goalContributionFromRow, goalMemberFromRow, type GoalContributionRow, type GoalMemberRow } from './mappers'

let channel: RealtimeChannel | null = null

/**
 * Suscripción Realtime a aportes y membresías de metas compartidas. Postgres Changes respeta
 * las políticas RLS de la tabla, así que solo llegan eventos de metas donde el usuario ya es
 * dueño o miembro: no hace falta filtrar por goal_id en el cliente.
 */
export function startRealtimeSync(currentUserId: string): void {
  if (!supabase || channel) return

  channel = supabase
    .channel('goal-contributions-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'goal_contributions' },
      async (payload) => {
        const row = payload.new as GoalContributionRow
        await db.goalContributions.put(goalContributionFromRow(row))
        await useBudgetStore.getState().refreshGoalsData()

        if (row.user_id !== currentUserId) {
          await useProfilesStore.getState().fetchProfiles([row.user_id])
          const name = useProfilesStore.getState().labelFor(row.user_id)
          useToastStore.getState().push(`¡${name} aportó $${row.amount.toFixed(2)}!`)
        }
      },
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'goal_members' },
      async (payload) => {
        const row = payload.new as GoalMemberRow
        await db.goalMembers.put(goalMemberFromRow(row))
        await useBudgetStore.getState().refreshGoalsData()
      },
    )
    .subscribe()
}

export function stopRealtimeSync(): void {
  if (channel && supabase) {
    supabase.removeChannel(channel)
  }
  channel = null
}
