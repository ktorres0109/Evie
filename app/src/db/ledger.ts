/** The transfer ledger: one row each time anything leaves the device. */
import { db, type TransferRecord } from './schema'

export async function recordTransfer(kind: TransferRecord['kind'], destination: string, bytes: number): Promise<void> {
  await db.transfers.put({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    kind,
    destination,
    bytes,
  })
}
