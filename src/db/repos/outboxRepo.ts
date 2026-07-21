import { db } from '../dexie'
import { nowIso } from './baseRepo'
import type { SyncEntity } from '../../sync/entities'

export const outboxRepo = {
  async enqueue(entity: SyncEntity, rowId: string): Promise<void> {
    await db.outbox.put({ id: `${entity}:${rowId}`, entity, rowId, enqueuedAt: nowIso() })
  },

  async listAll() {
    return db.outbox.toArray()
  },

  async remove(id: string): Promise<void> {
    await db.outbox.delete(id)
  },
}
