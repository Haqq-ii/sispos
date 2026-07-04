/**
 * offline-db.ts — IndexedDB schema + helpers for SISPOS offline queue
 *
 * DB: sispos-offline v1
 * Stores:
 *   kehadiran_queue  — Meja 1 hadir/tangguhkan operations
 *   pemeriksaan_queue — Meja 2/3/4 create + patch operations
 *   meja5_queue      — Meja 5 immunization + selesai operations
 *   sync_errors      — Failed sync records for kader rekap harian
 *
 * UU PDP Note: Data stored plaintext in IndexedDB for offline usability (D-13).
 * Backend encryption applies on sync when catatanKlinis is persisted to PostgreSQL.
 */
import { openDB, type IDBPDatabase } from 'idb'

// ─── Schema Types ─────────────────────────────────────────────────────────────

interface SisposOfflineDB {
  kehadiran_queue: {
    key: string
    value: {
      id: string
      antrianId: string
      action: 'hadir' | 'tangguhkan'
      slotId: string
      balitaId?: string
      namaBalita?: string
      timestamp: number
    }
    indexes: { by_timestamp: number }
  }
  // UU PDP Note: Data stored plaintext in IndexedDB for offline usability (D-13). Backend encryption applies on sync.
  pemeriksaan_queue: {
    key: string
    value: {
      id: string
      /** Client-generated UUID; resolved to real server ID during syncAll() */
      tempPemeriksaanId: string
      type: 'create' | 'patch-tanda-klinis' | 'patch-catatan'
      data: Record<string, unknown>
      timestamp: number
    }
    indexes: { by_timestamp: number; by_type: string }
  }
  meja5_queue: {
    key: string
    value: {
      id: string
      type: 'immunization' | 'selesai'
      data: Record<string, unknown>
      timestamp: number
    }
    indexes: { by_timestamp: number }
  }
  sync_errors: {
    key: string
    value: {
      id: string
      originalOperation: Record<string, unknown>
      error: string
      statusCode: number
      timestamp: number
    }
    indexes: { by_timestamp: number }
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────

const DB_NAME = 'sispos-offline'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<SisposOfflineDB>> | null = null

/**
 * Returns a singleton Promise<IDBPDatabase>.
 * Upgrade runs only once per DB_VERSION bump; guards prevent duplicate store creation.
 */
export function getOfflineDB(): Promise<IDBPDatabase<SisposOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SisposOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('kehadiran_queue')) {
          const s = db.createObjectStore('kehadiran_queue', { keyPath: 'id' })
          s.createIndex('by_timestamp', 'timestamp')
        }
        if (!db.objectStoreNames.contains('pemeriksaan_queue')) {
          const s = db.createObjectStore('pemeriksaan_queue', { keyPath: 'id' })
          s.createIndex('by_timestamp', 'timestamp')
          s.createIndex('by_type', 'type')
        }
        if (!db.objectStoreNames.contains('meja5_queue')) {
          const s = db.createObjectStore('meja5_queue', { keyPath: 'id' })
          s.createIndex('by_timestamp', 'timestamp')
        }
        if (!db.objectStoreNames.contains('sync_errors')) {
          const s = db.createObjectStore('sync_errors', { keyPath: 'id' })
          s.createIndex('by_timestamp', 'timestamp')
        }
      },
    })
  }
  return dbPromise
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Generates a unique temporary ID for offline operations.
 *
 * Tries crypto.randomUUID() first (requires secure context — HTTPS or localhost).
 * Falls back to timestamp + Math.random() composite if unavailable (A3 — HTTP Docker dev).
 */
export function generateTempId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for HTTP-only (non-secure) context — Docker dev on port 80
  return 'temp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9)
}

/**
 * Writes a failed sync operation to the sync_errors store.
 * Kader can review errors via rekap harian (D-06).
 */
export async function logSyncError(
  operation: Record<string, unknown>,
  statusCode: number,
  error: string
): Promise<void> {
  const db = await getOfflineDB()
  await db.add('sync_errors', {
    id: generateTempId(),
    originalOperation: operation,
    error,
    statusCode,
    timestamp: Date.now(),
  })
}

/**
 * Returns the total count of pending (not yet synced) queue items
 * across all three queue stores. Does NOT include sync_errors.
 *
 * Used by SyncPendingBadge to display the pending count.
 */
export async function countPending(): Promise<number> {
  const db = await getOfflineDB()
  const [k, p, m] = await Promise.all([
    db.count('kehadiran_queue'),
    db.count('pemeriksaan_queue'),
    db.count('meja5_queue'),
  ])
  return k + p + m
}
