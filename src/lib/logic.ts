import type { Booking, DB, Payment, PayMethod, PermissionKey, PricingRule, Promo, Slot, User } from './types'
import { addDays, addMinutesStr, dow, fromMin, hm, normPhone, nowStr, parse, rupiah, today, toMin, ymd, DAYS, tglId } from './util'

export class AppError extends Error {
  field: string
  constructor(message: string, field = 'form') { super(message); this.field = field }
}
function fail(m: string, f = 'form'): never { throw new AppError(m, f) }

export const ALL_PERMISSIONS: { key: PermissionKey; label: string; group: string }[] = [
  { key: 'booking.create', label: 'Buat booking (walk-in)', group: 'Booking' },
  { key: 'booking.edit', label: 'Ubah jadwal booking', group: 'Booking' },
  { key: 'booking.cancel', label: 'Batalkan booking', group: 'Booking' },
  { key: 'booking.status', label: 'Tandai no-show / selesai', group: 'Booking' },
  { key: 'booking.discount', label: 'Beri diskon', group: 'Booking' },
  { key: 'payment.record', label: 'Catat pembayaran', group: 'Pembayaran' },
  { key: 'payment.verify', label: 'Verifikasi bukti transfer', group: 'Pembayaran' },
  { key: 'payment.void', label: 'Void pembayaran', group: 'Pembayaran' },
  { key: 'member.manage', label: 'Kelola member', group: 'Member' },
]
export const KASIR_DEFAULTS: PermissionKey[] = ALL_PERMISSIONS.map(p => p.key).filter(k => k !== 'payment.void' && k !== 'booking.discount')

export function can(u: User | null, p: PermissionKey): boolean {
  if (!u) return false
  if (u.role === 'owner') return true
  if (u.role !== 'kasir') return false
  return (u.permissions ?? KASIR_DEFAULTS).includes(p)
}

export const nextId = (d: DB) => ++d.seq
export function log(d: DB, user: string, action: string, object: string, detail = '') {
  d.logs.unshift({ id: nextId(d), at: nowStr(), user, action, object, detail })
  if (d.logs.length > 300) d.logs.length = 300
}

// ---------- Status ----------
export const isBlocking = (b: Booking) => b.status !== 'batal' && b.status !== 'no_show'
export const paidOf = (b: Booking) => b.payments.filter(p => p.status === 'valid').reduce((s, p) => s + p.amount, 0)
export const pendingProof = (b: Booking) => b.payments.find(p => p.status === 'pending')
export const remaining = (b: Booking) => Math.max(0, b.total - paidOf(b))
export const bookingEnd = (b: Booking) => b.slots[b.slots.length - 1].end
export const bookingStart = (b: Booking) => b.slots[0].start
export const courtOf = (d: DB, id: number) => d.courts.find(c => c.id === id)

export const STATUS_META: Record<Booking['status'], { label: string; cls: string }> = {
  pending: { label: 'Menunggu DP', cls: 'bg-orange-100 text-orange-800 ring-orange-300' },
  dp: { label: 'DP', cls: 'bg-yellow-100 text-yellow-800 ring-yellow-300' },
  lunas: { label: 'Lunas', cls: 'bg-blue-100 text-blue-800 ring-blue-300' },
  selesai: { label: 'Selesai', cls: 'bg-emerald-100 text-emerald-800 ring-emerald-300' },
  batal: { label: 'Batal', cls: 'bg-gray-200 text-gray-700 ring-gray-300' },
  no_show: { label: 'No Show', cls: 'bg-red-100 text-red-800 ring-red-300' },
}

function sync(b: Booking) {
  if (b.status === 'batal' || b.status === 'no_show' || b.status === 'selesai') return
  const paid = paidOf(b)
  b.status = paid >= b.total ? 'lunas' : paid > 0 ? 'dp' : 'pending'
}

export function autoCancel(d: DB): number {
  const now = nowStr(); let n = 0
  for (const b of d.bookings) {
    if (b.status === 'pending' && b.hold_expires_at && b.hold_expires_at <= now && !pendingProof(b)) {
      b.status = 'batal'; b.cancel_reason = 'Otomatis dibatalkan: melewati batas pembayaran DP'; n++
      log(d, 'Sistem', 'booking.auto_cancel', b.code, b.cancel_reason)
    }
  }
  return n
}

// ---------- Harga & slot ----------
function ruleFor(d: DB, courtId: number, date: string, s: number, e: number): PricingRule | undefined {
  const court = d.courts.find(c => c.id === courtId)
  const day = dow(date)
  const ok = (r: PricingRule) => r.is_active && r.days.includes(day) && toMin(r.start) <= s && e <= toMin(r.end)
  return d.rules.find(r => r.court_id === courtId && ok(r)) ?? d.rules.find(r => !r.court_id && r.category_id === court?.category_id && ok(r))
}

export type SlotState = 'free' | 'booked' | 'blocked' | 'past' | 'norule' | 'closed'
export interface DaySlot {
  start: string; end: string; label: string; state: SlotState
  price: number; rule_type?: 'peak' | 'off_peak'; booking?: Booking; reason?: string
}

export function daySlots(d: DB, courtId: number, date: string): DaySlot[] {
  const court = d.courts.find(c => c.id === courtId)
  const { open_time, close_time, slot_minutes } = d.settings
  const out: DaySlot[] = []
  const now = new Date()
  for (let m = toMin(open_time); m + slot_minutes <= toMin(close_time); m += slot_minutes) {
    const start = `${date} ${fromMin(m)}`, end = `${date} ${fromMin(m + slot_minutes)}`
    const base = { start, end, label: `${fromMin(m)} - ${fromMin(m + slot_minutes)}`, price: 0 }
    const booking = d.bookings.find(b => b.court_id === courtId && isBlocking(b) && b.slots.some(s => s.start === start))
    const block = d.blocks.find(b => b.court_id === courtId && b.date === date && toMin(b.start) < m + slot_minutes && toMin(b.end) > m)
    const rule = ruleFor(d, courtId, date, m, m + slot_minutes)
    const info = { price: rule?.price ?? 0, rule_type: rule?.type }
    let state: SlotState = 'free'
    if (!court || !court.is_active || court.status !== 'tersedia') state = 'closed'
    else if (parse(start) <= now) state = 'past'
    else if (block) state = 'blocked'
    else if (booking) state = 'booked'
    else if (!rule) state = 'norule'
    // booking tetap terlihat walau jamnya sudah lewat
    if (booking && state === 'past') state = 'booked'
    out.push({ ...base, ...info, state, booking, reason: block?.reason })
  }
  return out
}

export interface Plan { court_id: number; date: string; slots: Slot[]; total: number; dp_required: number }

export function plan(d: DB, courtId: number, starts: string[]): Plan {
  const max = d.settings.max_slots_per_booking
  const list = [...new Set(starts.filter(Boolean))].sort()
  if (!list.length) fail('Pilih minimal 1 jam di Booking Board.', 'slots')
  if (list.length > max) fail(`Maksimal ${max} jam per booking.`, 'slots')
  const court = d.courts.find(c => c.id === courtId)
  if (!court || !court.is_active || court.status !== 'tersedia') fail('Lapangan sedang tidak tersedia (maintenance/nonaktif).', 'court_id')
  const dates = new Set(list.map(s => s.split(' ')[0]))
  if (dates.size > 1) fail('Semua jam harus pada tanggal yang sama.', 'slots')
  const date = [...dates][0]
  if (date > addDays(today(), d.settings.max_days_ahead)) fail(`Booking maksimal ${d.settings.max_days_ahead} hari ke depan.`, 'slots')
  const day = daySlots(d, courtId, date)
  const slots: Slot[] = []
  for (const s of list) {
    const at = s.split(' ')[1]
    const sl = day.find(x => x.start === s)
    if (!sl) fail(`Jam ${at} di luar jam operasional atau bukan slot yang valid.`, 'slots')
    else if (sl.state === 'past') fail(`Jam ${at} sudah lewat.`, 'slots')
    else if (sl.state === 'blocked') fail(`Jam ${at} diblokir (${sl.reason}).`, 'slots')
    else if (sl.state === 'booked') fail(`Jam ${at} sudah dibooking orang lain.`, 'slots')
    else if (sl.state === 'norule') fail(`Jam ${at} belum punya aturan harga, jadi tidak bisa dibooking.`, 'slots')
    else if (sl.state !== 'free') fail(`Jam ${at} tidak tersedia.`, 'slots')
    slots.push({ start: sl.start, end: sl.end, price: sl.price, rule_type: sl.rule_type! })
  }
  const total = slots.reduce((s, x) => s + x.price, 0)
  return { court_id: courtId, date, slots, total, dp_required: Math.ceil(total * d.settings.min_dp_percent / 100) }
}

// ---------- Promo ----------
export const promoRedeemable = (p: Promo) => !!p.code && !!p.discount_type && p.discount_value > 0
export const promoUsed = (d: DB, p: Promo) => d.bookings.filter(b => b.promo_code === p.code && isBlocking(b))
const promoDiscount = (p: Promo, subtotal: number) =>
  p.discount_type === 'percent' ? Math.floor(subtotal * Math.min(p.discount_value, 100) / 100) : Math.min(p.discount_value, subtotal)

export function applyPromo(d: DB, codeRaw: string, subtotal: number, slots: Slot[], userId: number | null, phone: string) {
  const code = codeRaw.trim().toUpperCase()
  const p = d.promos.find(x => x.code === code)
  const E = (m: string): never => fail(m, 'promo_code')
  if (!p) E('Kode promo tidak ditemukan. Periksa penulisannya.')
  const promo = p as Promo
  if (!promoRedeemable(promo)) E('Kode ini belum bisa dipakai langsung saat booking. Tunjukkan kode ke kasir.')
  if (!promo.is_active) E('Kode promo sedang tidak aktif.')
  if (promo.members_only && userId === null) E('Kode ini khusus member. Masuk atau daftar akun dulu, lalu buat booking dari akun Anda.')
  const t = today()
  if (promo.starts_on && promo.starts_on > t) E(`Promo ini baru berlaku mulai ${tglId(promo.starts_on, false)}.`)
  if (promo.ends_on && promo.ends_on < t) E('Kode promo sudah berakhir.')
  if (promo.valid_days.length) {
    for (const s of slots) {
      const iso = dow(s.start.split(' ')[0]) || 7
      if (!promo.valid_days.includes(iso)) E(`Promo ini hanya berlaku pada hari: ${promo.valid_days.map(x => DAYS[x % 7]).join(', ')}.`)
    }
  }
  if (promo.valid_from || promo.valid_until) {
    for (const s of slots) {
      const a = s.start.split(' ')[1], z = s.end.split(' ')[1]
      if ((promo.valid_from && a < promo.valid_from) || (promo.valid_until && z > promo.valid_until))
        E(`Promo ini hanya berlaku untuk jam main ${promo.valid_from || '…'}–${promo.valid_until || '…'}. Semua jam yang dipilih harus berada di rentang itu.`)
    }
  }
  if (promo.min_total && subtotal < promo.min_total) E(`Promo ini berlaku untuk tagihan minimal ${rupiah(promo.min_total)}.`)
  const used = promoUsed(d, promo)
  if (promo.usage_limit && used.length >= promo.usage_limit) E('Kuota promo ini sudah habis.')
  if (promo.once_per_customer && used.some(b => (userId !== null && b.user_id === userId) || (phone && normPhone(b.phone) === normPhone(phone))))
    E('Kode ini hanya bisa dipakai satu kali per pelanggan.')
  const discount = promoDiscount(promo, subtotal)
  if (discount <= 0) E('Kode promo ini tidak memberi potongan untuk booking Anda.')
  if (discount >= subtotal) E('Potongan promo sama dengan seluruh tagihan, jadi kode ini tidak bisa dipakai untuk booking ini.')
  return { promo, discount, total: subtotal - discount }
}

// ---------- Booking ----------
export interface NewBooking {
  courtId: number; starts: string[]; name: string; phone: string; notes?: string
  promoCode?: string; userId: number | null; actor: string
}

export function createBooking(d: DB, x: NewBooking): Booking {
  if (!x.name.trim()) fail('Nama wajib diisi.', 'customer_name')
  if (normPhone(x.phone).length < 9) fail('No. HP tidak valid.', 'phone')
  const p = plan(d, x.courtId, x.starts)
  let discount = 0, promoCode: string | null = null
  if (x.promoCode?.trim()) {
    const r = applyPromo(d, x.promoCode, p.total, p.slots, x.userId, x.phone)
    discount = r.discount; promoCode = r.promo.code
  }
  const total = p.total - discount
  const prefix = `BK-${ymd(new Date()).replaceAll('-', '')}-`
  const seq = d.bookings.reduce((m, b) => b.code.startsWith(prefix) ? Math.max(m, Number(b.code.slice(prefix.length)) || 0) : m, 0) + 1
  const b: Booking = {
    id: nextId(d), code: prefix + String(seq).padStart(4, '0'), court_id: x.courtId, user_id: x.userId,
    customer_name: x.name.trim(), phone: x.phone.trim(), notes: x.notes ?? '', date: p.date, slots: p.slots,
    status: 'pending', subtotal: p.total, discount, total,
    dp_required: Math.ceil(total * d.settings.min_dp_percent / 100), promo_code: promoCode,
    hold_expires_at: addMinutesStr(nowStr(), d.settings.dp_timeout_minutes),
    created_at: nowStr(), created_by: x.actor, payments: [],
  }
  d.bookings.push(b)
  log(d, x.actor, 'booking.created', b.code, `${courtOf(d, b.court_id)?.name} ${b.date}, total ${rupiah(total)}`)
  return b
}

export function recordPayment(d: DB, bookingId: number, x: { amount: number; method: PayMethod; channel?: string; reference?: string; proof?: { name: string; data: string } | null; pending?: boolean }, actor: string): Payment {
  const b = d.bookings.find(y => y.id === bookingId)!
  if (b.status === 'batal' || b.status === 'no_show') fail('Booking sudah dibatalkan, pembayaran tidak bisa dicatat.', 'amount')
  if (!(x.amount > 0)) fail('Jumlah pembayaran harus lebih dari 0.', 'amount')
  const paid = paidOf(b)
  if (x.pending) {
    if (pendingProof(b)) fail('Bukti pembayaran sebelumnya masih menunggu verifikasi kasir.', 'proof')
  } else if (paid === 0 && x.amount < Math.min(b.dp_required, b.total)) {
    fail(`Pembayaran pertama minimal DP ${rupiah(b.dp_required)} (${d.settings.min_dp_percent}%).`, 'amount')
  }
  if (x.amount > remaining(b)) fail(`Pembayaran melebihi sisa tagihan (${rupiah(remaining(b))}).`, 'amount')
  const pay: Payment = {
    id: nextId(d), amount: x.amount, method: x.method, channel: x.channel ?? '', reference: x.reference ?? '',
    proof_name: x.proof?.name ?? null, proof_data: x.proof?.data ?? null,
    status: x.pending ? 'pending' : 'valid', paid_at: nowStr(), received_by: actor,
  }
  b.payments.push(pay); sync(b)
  log(d, actor, 'payment.created', b.code, `${rupiah(x.amount)} via ${x.method}${x.pending ? ' (menunggu verifikasi)' : ''}`)
  return pay
}

export function voidPayment(d: DB, bookingId: number, paymentId: number, reason: string, actor: string) {
  if (!reason.trim()) fail('Alasan void wajib diisi.', 'void_reason')
  const b = d.bookings.find(y => y.id === bookingId)!
  const p = b.payments.find(y => y.id === paymentId)!
  if (p.status === 'void') fail('Pembayaran ini sudah di-void.', 'void_reason')
  p.status = 'void'; p.void_reason = reason.trim(); sync(b)
  log(d, actor, 'payment.void', b.code, `${rupiah(p.amount)}: ${reason}`)
}

export function verifyPayment(d: DB, bookingId: number, paymentId: number, accept: boolean, actor: string) {
  const b = d.bookings.find(y => y.id === bookingId)!
  const p = b.payments.find(y => y.id === paymentId)!
  if (p.status !== 'pending') fail('Hanya pembayaran berstatus menunggu verifikasi yang bisa diverifikasi.', 'payment')
  if (accept) {
    if (b.status === 'batal' || b.status === 'no_show') fail('Booking ini sudah dibatalkan dan slotnya dilepas.', 'payment')
    if (paidOf(b) === 0 && p.amount < Math.min(b.dp_required, b.total)) fail(`Nominal di bawah minimal DP ${rupiah(b.dp_required)}.`, 'payment')
    p.status = 'valid'; b.hold_expires_at = null
  } else {
    p.status = 'rejected'
    const min = addMinutesStr(nowStr(), d.settings.dp_timeout_minutes)
    if (b.hold_expires_at && b.hold_expires_at < min) b.hold_expires_at = min
  }
  sync(b)
  log(d, actor, accept ? 'payment.verified' : 'payment.rejected', b.code, rupiah(p.amount))
}

export function cancelBooking(d: DB, id: number, reason: string, actor: string, asMember = false) {
  const b = d.bookings.find(y => y.id === id)!
  if (!isBlocking(b)) fail(`Booking sudah berstatus ${STATUS_META[b.status].label}.`, 'booking')
  if (b.status === 'selesai') fail('Booking yang sudah selesai tidak bisa dibatalkan.', 'booking')
  if (!reason.trim()) fail('Alasan pembatalan wajib diisi.', 'reason')
  if (asMember) {
    const hours = (parse(bookingStart(b)).getTime() - Date.now()) / 3_600_000
    if (hours < d.settings.cancel_limit_hours) fail(`Pembatalan mandiri hanya bisa dilakukan minimal ${d.settings.cancel_limit_hours} jam sebelum main. Hubungi kasir.`, 'booking')
  }
  b.status = 'batal'; b.cancel_reason = reason.trim()
  log(d, actor, 'booking.cancelled', b.code, reason)
}

export function markNoShow(d: DB, id: number, actor: string) {
  const b = d.bookings.find(y => y.id === id)!
  if (b.status !== 'dp' && b.status !== 'lunas') fail('Hanya booking berstatus DP atau Lunas yang bisa ditandai no-show.', 'booking')
  b.status = 'no_show'; log(d, actor, 'booking.no_show', b.code)
}

export function finishBooking(d: DB, id: number, actor: string) {
  const b = d.bookings.find(y => y.id === id)!
  if (b.status !== 'lunas' || parse(bookingEnd(b)) > new Date()) fail('Booking hanya bisa diselesaikan setelah lunas dan jamnya berakhir.', 'booking')
  b.status = 'selesai'; log(d, actor, 'booking.finished', b.code)
}

export function applyDiscount(d: DB, id: number, discount: number, actor: string) {
  const b = d.bookings.find(y => y.id === id)!
  if (b.status !== 'pending' && b.status !== 'dp') fail('Diskon tidak bisa diubah pada status ini.', 'discount')
  if (discount < 0 || discount > b.subtotal) fail('Diskon tidak valid.', 'discount')
  if (b.subtotal - discount < paidOf(b)) fail('Diskon membuat total lebih kecil dari yang sudah dibayar.', 'discount')
  const old = b.discount
  b.discount = discount; b.total = b.subtotal - discount; b.dp_required = Math.ceil(b.total * d.settings.min_dp_percent / 100)
  sync(b); log(d, actor, 'booking.discount', b.code, `${rupiah(old)} → ${rupiah(discount)}`)
}

export function reschedule(d: DB, id: number, courtId: number, starts: string[], actor: string) {
  const b = d.bookings.find(y => y.id === id)!
  if (b.status !== 'pending' && b.status !== 'dp' && b.status !== 'lunas') fail(`Booking berstatus ${STATUS_META[b.status].label} tidak bisa diubah.`, 'booking')
  const old = { court: b.court_id, date: b.date, total: b.subtotal }
  // lepas slot lama dulu supaya tidak bentrok dengan dirinya sendiri
  const saved = b.status; b.status = 'batal'
  let p: Plan
  try { p = plan(d, courtId, starts) } catch (e) { b.status = saved; throw e }
  b.status = saved
  b.court_id = courtId; b.date = p.date; b.slots = p.slots; b.subtotal = p.total
  b.total = Math.max(0, p.total - b.discount); b.dp_required = Math.ceil(b.total * d.settings.min_dp_percent / 100)
  sync(b)
  log(d, actor, 'booking.rescheduled', b.code, `${old.date} → ${b.date}, selisih ${rupiah(p.total - old.total)}`)
}

/** Saran nominal cepat untuk pembayaran: DP minimal, separuh, kelipatan bulat, dan lunas. */
export interface AmountOption { value: number; label?: string }
export function amountOptions(b: Booking): AmountOption[] {
  const rem = remaining(b); if (rem <= 0) return []
  const first = paidOf(b) === 0
  const min = first ? Math.min(b.dp_required, b.total) : 1
  const map = new Map<number, string | undefined>()
  const add = (v: number, label?: string) => { if (v >= min && v <= rem && (!map.has(v) || (label && !map.get(v)))) map.set(v, label) }
  if (first) add(min, 'DP')
  const half = Math.ceil(b.total / 2 / 10_000) * 10_000
  if (first) add(half)
  for (const v of [50_000, 100_000, 150_000, 200_000, 250_000, 300_000, 500_000, 1_000_000]) if (v < rem) add(v)
  add(rem, 'Lunas')
  // maksimal 5 chip: DP & Lunas selalu ada, sisanya dipilih merata
  const all = [...map.entries()].sort((a, c) => a[0] - c[0])
  let keep = all
  if (all.length > 5) {
    const mids = all.filter(([, l]) => !l)
    const need = 5 - all.filter(([, l]) => l).length
    const pick = new Set(mids.filter((_, i) => i % Math.ceil(mids.length / need) === 0).slice(0, need).map(([v]) => v))
    keep = all.filter(([v, l]) => l || pick.has(v))
  }
  return keep.map(([value, label]) => ({ value, label }))
}

export const timeRange = (b: Booking) => `${bookingStart(b).split(' ')[1]} – ${bookingEnd(b).split(' ')[1]}`
export const nowHm = () => hm(new Date())
