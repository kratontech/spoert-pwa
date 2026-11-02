import type { BookingStatus, DB, PayMethod, PaymentStatus } from './types'
import { isBlocking, paidOf, remaining } from './logic'
import { addDays, tglId, today, ymd } from './util'

export type Gran = 'day' | 'month' | 'year'
export const GRAN_LABEL: Record<Gran, string> = { day: 'Harian', month: 'Bulanan', year: 'Tahunan' }
export const METHODS: PayMethod[] = ['tunai', 'transfer', 'qris', 'kartu']
export const METHOD_LABEL: Record<PayMethod, string> = { tunai: 'Tunai', transfer: 'Transfer', qris: 'QRIS', kartu: 'Kartu' }
export const PAY_STATUS_LABEL: Record<PaymentStatus, string> = { valid: 'Valid', pending: 'Menunggu verifikasi', void: 'Void', rejected: 'Ditolak' }
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export interface Filters { from: string; to: string; gran: Gran; method: '' | PayMethod; courtId: number; receiver: string }
export interface PayRow {
  id: number; at: string; date: string; bookingId: number; code: string; customer: string; phone: string
  court: string; method: PayMethod; channel: string; reference: string; receiver: string; status: PaymentStatus; amount: number
}
export interface Bucket { key: string; label: string; count: number; tunai: number; transfer: number; qris: number; kartu: number; total: number }
export interface Lifecycle { status: BookingStatus; count: number; total: number; paid: number; remaining: number }
export interface Report {
  from: string; to: string
  rows: PayRow[]; valid: PayRow[]; buckets: Bucket[]
  total: number; count: number; avg: number
  voided: number; voidCount: number; pending: number; pendingCount: number; rejectedCount: number
  lifecycle: Lifecycle[]; piutang: number; bookingCount: number; bookingTotal: number
}

// ---------- Periode ----------
export type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastmonth' | 'year' | 'custom'
export const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Hari ini' }, { id: 'yesterday', label: 'Kemarin' }, { id: '7d', label: '7 hari' }, { id: '30d', label: '30 hari' },
  { id: 'month', label: 'Bulan ini' }, { id: 'lastmonth', label: 'Bulan lalu' }, { id: 'year', label: 'Tahun ini' }, { id: 'custom', label: 'Kustom' },
]
export function presetRange(p: Exclude<Preset, 'custom'>): [string, string] {
  const t = today(); const now = new Date(); const y = now.getFullYear(), m = now.getMonth()
  switch (p) {
    case 'today': return [t, t]
    case 'yesterday': { const d = addDays(t, -1); return [d, d] }
    case '7d': return [addDays(t, -6), t]
    case '30d': return [addDays(t, -29), t]
    case 'month': return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))]
    case 'lastmonth': return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))]
    case 'year': return [`${y}-01-01`, `${y}-12-31`]
  }
}

const keyOf = (date: string, g: Gran) => g === 'day' ? date : g === 'month' ? date.slice(0, 7) : date.slice(0, 4)
export function bucketLabel(key: string, g: Gran) {
  if (g === 'day') return tglId(key)
  if (g === 'month') return `${MONTHS_LONG[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`
  return key
}
function allKeys(from: string, to: string, g: Gran): string[] {
  const out: string[] = []; let cur = from
  for (let i = 0; i < 4000 && cur <= to; i++) {
    const k = keyOf(cur, g); if (out[out.length - 1] !== k) out.push(k)
    if (g === 'day') cur = addDays(cur, 1)
    else if (g === 'month') { const [y, m] = cur.split('-').map(Number); cur = ymd(new Date(y, m, 1)) }
    else cur = `${Number(cur.slice(0, 4)) + 1}-01-01`
  }
  return out
}

// ---------- Hitung laporan ----------
export function buildReport(d: DB, f: Filters): Report {
  const from = f.from <= f.to ? f.from : f.to, to = f.from <= f.to ? f.to : f.from
  const courtName = (id: number) => d.courts.find(c => c.id === id)?.name ?? '-'
  const rows: PayRow[] = []
  for (const b of d.bookings) {
    if (f.courtId && b.court_id !== f.courtId) continue
    for (const p of b.payments) {
      const date = p.paid_at.slice(0, 10)
      if (date < from || date > to) continue
      if (f.method && p.method !== f.method) continue
      if (f.receiver && p.received_by !== f.receiver) continue
      rows.push({
        id: p.id, at: p.paid_at, date, bookingId: b.id, code: b.code, customer: b.customer_name, phone: b.phone, court: courtName(b.court_id),
        method: p.method, channel: p.channel, reference: p.reference, receiver: p.received_by, status: p.status, amount: p.amount,
      })
    }
  }
  rows.sort((a, c) => c.at.localeCompare(a.at) || c.id - a.id)
  const valid = rows.filter(r => r.status === 'valid')

  const map = new Map<string, Bucket>()
  for (const k of allKeys(from, to, f.gran)) map.set(k, { key: k, label: bucketLabel(k, f.gran), count: 0, tunai: 0, transfer: 0, qris: 0, kartu: 0, total: 0 })
  for (const r of valid) {
    const k = keyOf(r.date, f.gran); const b = map.get(k); if (!b) continue
    b.count++; b[r.method] += r.amount; b.total += r.amount
  }
  const total = valid.reduce((s, r) => s + r.amount, 0)
  const sum = (st: PaymentStatus) => rows.filter(r => r.status === st)

  const order: BookingStatus[] = ['pending', 'dp', 'lunas', 'selesai', 'batal', 'no_show']
  const bks = d.bookings.filter(b => b.date >= from && b.date <= to && (!f.courtId || b.court_id === f.courtId))
  const lifecycle = order.map(status => {
    const l = bks.filter(b => b.status === status)
    return { status, count: l.length, total: l.reduce((s, b) => s + b.total, 0), paid: l.reduce((s, b) => s + paidOf(b), 0), remaining: l.reduce((s, b) => s + (isBlocking(b) ? remaining(b) : 0), 0) }
  })
  return {
    from, to, rows, valid, buckets: [...map.values()],
    total, count: valid.length, avg: valid.length ? Math.round(total / valid.length) : 0,
    voided: sum('void').reduce((s, r) => s + r.amount, 0), voidCount: sum('void').length,
    pending: sum('pending').reduce((s, r) => s + r.amount, 0), pendingCount: sum('pending').length, rejectedCount: sum('rejected').length,
    lifecycle, piutang: lifecycle.reduce((s, l) => s + l.remaining, 0),
    bookingCount: bks.length, bookingTotal: bks.filter(isBlocking).reduce((s, b) => s + b.total, 0),
  }
}

export function periodText(r: Report) { return r.from === r.to ? tglId(r.from) : `${tglId(r.from, false)} – ${tglId(r.to, false)}` }
export function filterText(d: DB, f: Filters) {
  const parts = [`Rekap ${GRAN_LABEL[f.gran].toLowerCase()}`]
  if (f.method) parts.push(`Metode: ${METHOD_LABEL[f.method]}`)
  if (f.courtId) parts.push(`Lapangan: ${d.courts.find(c => c.id === f.courtId)?.name ?? '-'}`)
  if (f.receiver) parts.push(`Diterima oleh: ${f.receiver}`)
  return parts.join(' · ')
}
export const fileBase = (r: Report) => `laporan-uang-masuk_${r.from}_${r.to}`
