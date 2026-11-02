import { useSyncExternalStore } from 'react'
import type { DB, User } from './types'
import { makeSeed } from './seed'
import { autoCancel } from './logic'

/**
 * Mode demo: SEMUA data hanya hidup di memori (tidak ada localStorage).
 * - Refresh / tutup semua tab  -> kembali ke data awal (seed).
 * - Beberapa tab di browser yang sama saling sinkron lewat BroadcastChannel,
 *   jadi booking tamu langsung tampil di panel owner/kasir, dan sebaliknya.
 * - Booking yang dibuat tamu (ephemeral) milik tab tamu tersebut: hilang dari semua tab
 *   begitu tab tamu di-refresh, ditutup, atau pindah dari halaman bookingnya.
 */

const SESSION = 'spoert.session'
const LEGACY_DB_KEY = 'spoert.db.v1'
export const TAB_ID = Math.random().toString(36).slice(2, 10)

try { localStorage.removeItem(LEGACY_DB_KEY) } catch { /* abaikan */ }

let db: DB = makeSeed()
let rev = 0
autoCancel(db)
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

type Msg =
  | { t: 'state'; from: string; rev: number; db: DB }
  | { t: 'hello'; from: string }
  | { t: 'bye'; from: string }

const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('spoert-demo') : null
const post = (m: Msg) => { try { chan?.postMessage(m) } catch { /* abaikan */ } }
const broadcast = () => post({ t: 'state', from: TAB_ID, rev, db })

const deadOrigins = new Set<string>()

/** Hapus booking ephemeral milik satu tab beserta log-nya. */
function dropOrigin(d: DB, origin: string): boolean {
  const codes = new Set(d.bookings.filter(b => b.ephemeral === origin).map(b => b.code))
  if (!codes.size) return false
  d.bookings = d.bookings.filter(b => !codes.has(b.code))
  d.logs = d.logs.filter(l => !codes.has(l.object))
  return true
}

let helloDone: (() => void) | null = null

if (chan) {
  chan.onmessage = (ev: MessageEvent<Msg>) => {
    const m = ev.data
    if (!m || m.from === TAB_ID) return
    if (m.t === 'hello') broadcast()
    else if (m.t === 'bye') {
      deadOrigins.add(m.from)
      const draft = structuredClone(db)
      if (dropOrigin(draft, m.from)) { db = draft; emit() }
    } else if (m.t === 'state') {
      const newer = m.rev > rev || (m.rev === rev && m.from > TAB_ID)
      rev = Math.max(rev, m.rev)
      if (newer) {
        const next = m.db
        for (const o of deadOrigins) dropOrigin(next, o)
        db = next; emit()
      }
      if (helloDone) { helloDone(); helloDone = null }
    }
  }
  window.addEventListener('pagehide', () => post({ t: 'bye', from: TAB_ID }))
}

/** Dipanggil sekali sebelum render: ambil kondisi terkini dari tab lain (kalau ada). */
export function initSync(): Promise<void> {
  if (!chan) return Promise.resolve()
  return new Promise(resolve => {
    helloDone = resolve
    post({ t: 'hello', from: TAB_ID })
    setTimeout(() => { if (helloDone) { helloDone(); helloDone = null } }, 150)
  })
}

/** Ubah database. Kalau fn melempar error, perubahan dibatalkan. */
export function mutate<T>(fn: (d: DB) => T): T {
  const draft = structuredClone(db)
  const result = fn(draft)
  db = draft
  rev++
  emit(); broadcast()
  return result
}

export const getDB = () => db
export function useDB(): DB {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => db)
}

/** Kembalikan data ke awal di semua tab. */
export function resetDemo() { db = makeSeed(); rev++; setSession(null); emit(); broadcast() }

// ---------- Booking tamu (sementara) ----------
const discardTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** Hapus booking tamu milik tab ini. */
export function discardEphemeral(code: string) {
  if (!db.bookings.some(b => b.code === code && b.ephemeral === TAB_ID)) return
  mutate(d => {
    d.bookings = d.bookings.filter(b => !(b.code === code && b.ephemeral === TAB_ID))
    d.logs = d.logs.filter(l => l.object !== code)
  })
}

/**
 * Dipakai di halaman booking tamu: selama halaman terbuka booking tetap ada;
 * begitu ditinggalkan, booking dihapus (ditunda sebentar agar aman dari StrictMode).
 */
export function keepAlive(code: string): () => void {
  const t = discardTimers.get(code)
  if (t) { clearTimeout(t); discardTimers.delete(code) }
  return () => { discardTimers.set(code, setTimeout(() => { discardTimers.delete(code); discardEphemeral(code) }, 1200)) }
}

// ---------- Sesi login (per tab, jadi tamu & owner bisa dibuka berdampingan) ----------
let sessionId: number | null = (() => { try { const v = sessionStorage.getItem(SESSION); return v ? Number(v) : null } catch { return null } })()
const sListeners = new Set<() => void>()
export function setSession(id: number | null) {
  sessionId = id
  try { if (id === null) sessionStorage.removeItem(SESSION); else sessionStorage.setItem(SESSION, String(id)) } catch { /* abaikan */ }
  sListeners.forEach(l => l())
}
export function useSession(): User | null {
  const id = useSyncExternalStore(cb => { sListeners.add(cb); return () => { sListeners.delete(cb) } }, () => sessionId)
  const d = useDB()
  return d.users.find(u => u.id === id && u.is_active) ?? null
}

// Auto-cancel booking pending yang lewat batas bayar (setara scheduler tiap menit).
setInterval(() => {
  const draft = structuredClone(db)
  if (autoCancel(draft)) { db = draft; rev++; emit(); broadcast() }
}, 30_000)
