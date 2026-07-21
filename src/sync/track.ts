import { outboxRepo } from '../db/repos/outboxRepo'
import { getCurrentUserId } from './session'
import type { SyncEntity } from './entities'

/** Encola la fila para subir a Supabase, solo si hay sesión activa. */
export async function trackMutation(entity: SyncEntity, rowId: string): Promise<void> {
  if (!getCurrentUserId()) return
  await outboxRepo.enqueue(entity, rowId)
}
