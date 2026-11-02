import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BookingForm, BookingSummary, Invoice, PaymentList, useAfterCreate } from '../../components/BookingParts'
import { Badge, Confirm, DateFilter, Empty, Field, Modal, PageTitle, RupiahInput, Table, useAction, useFormErrors, useToast } from '../../components/ui'
import { Perm } from '../../components/Layout'
import { Pagination, usePaged } from '../../components/Pagination'
import { amountOptions, applyDiscount, cancelBooking, can, courtOf, daySlots, finishBooking, markNoShow, paidOf, pendingProof, recordPayment, remaining, reschedule, STATUS_META, timeRange, verifyPayment, voidPayment } from '../../lib/logic'
import { mutate, useDB, useSession } from '../../lib/store'
import type { BookingStatus, PayMethod } from '../../lib/types'
import { addDays, rupiah, tglId, today } from '../../lib/util'

export function NewBooking() {
  const u = useSession()!; const done = useAfterCreate('admin')
  if (!can(u, 'booking.create')) return <Empty>Akun Anda tidak punya hak membuat booking.</Empty>
  return (<div><PageTitle title="Booking walk-in" sub="Isi data pelanggan untuk jam yang dipilih di Booking Board." /><BookingForm mode="admin" user={u} onDone={done} /></div>)
}

export function BookingsList() {
  const d = useDB(); const [q, setQ] = useState(''); const [st, setSt] = useState<'' | BookingStatus>(''); const [date, setDate] = useState('')
  const list = useMemo(() => d.bookings.filter(b =>
    (!st || b.status === st) && (!date || b.date === date) &&
    (!q || (b.code + b.customer_name + b.phone).toLowerCase().includes(q.toLowerCase()))
  ).sort((a, b) => b.slots[0].start.localeCompare(a.slots[0].start)), [d, q, st, date])
  const pg = usePaged(list, `${q}|${st}|${date}`)
  return (
    <div>
      <PageTitle title="Semua booking" actions={<Link to="/admin/board" className="btn-primary">Booking baru</Link>} />
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <input className="input" placeholder="Cari kode / nama / HP" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input" value={st} onChange={e => setSt(e.target.value as BookingStatus | '')}><option value="">Semua status</option>{Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <DateFilter value={date} onChange={setDate} />
      </div>
      {!list.length ? <Empty>Tidak ada booking yang cocok.</Empty> : (
        <Table head={['Kode', 'Pelanggan', 'Lapangan', 'Jadwal', 'Total', 'Status']}>
          {pg.pageItems.map(b => (
            <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="td font-semibold"><Link to={`/admin/bookings/${b.id}`} className="text-turf-700 underline">{b.code}</Link></td>
              <td className="td">{b.customer_name}<div className="text-xs text-slate-500">{b.phone}</div></td>
              <td className="td">{courtOf(d, b.court_id)?.name}</td>
              <td className="td whitespace-nowrap">{tglId(b.date, false)}<div className="text-xs text-slate-500">{timeRange(b)}</div></td>
              <td className="td tabular-nums">{rupiah(b.total)}<div className="text-xs text-slate-500">sisa {rupiah(remaining(b))}</div></td>
              <td className="td"><Badge status={b.status} /></td>
            </tr>
          ))}
        </Table>
      )}
      <Pagination p={pg} />
    </div>
  )
}

type Dlg = null | 'cancel' | 'noshow' | 'discount' | 'reschedule' | 'pay' | 'invoice' | { void: number }

export function BookingDetail() {
  const { id } = useParams(); const d = useDB(); const u = useSession()!; const act = useAction(); const nav = useNavigate()
  const [dlg, setDlg] = useState<Dlg>(null)
  const b = d.bookings.find(x => x.id === Number(id))
  if (!b) return <Empty>Booking tidak ditemukan. <Link to="/admin/bookings" className="underline">Kembali</Link></Empty>
  const active = ['pending', 'dp', 'lunas'].includes(b.status)
  const run = (fn: () => void, msg: string) => { const ok = act(() => { fn(); return true }, msg); if (ok) setDlg(null) }
  const canFinish = b.status === 'lunas'
  return (
    <div className="space-y-4">
      <PageTitle title={b.code} sub={`Dibuat ${b.created_at} oleh ${b.created_by}`} actions={<Link to="/admin/bookings" className="btn-ghost">Kembali</Link>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <BookingSummary b={b} />
          <section className="card p-5">
            <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Pembayaran</h2>
              {active && <Perm p="payment.record"><button className="btn-primary !py-1.5" onClick={() => setDlg('pay')} disabled={remaining(b) === 0}>Catat pembayaran</button></Perm>}</div>
            <PaymentList booking={b}>{p => (<>
              {p.status === 'pending' && can(u, 'payment.verify') && <>
                <button className="rounded bg-turf-700 px-2 py-1 text-xs font-semibold text-white" onClick={() => run(() => mutate(db => verifyPayment(db, b.id, p.id, true, u.name)), 'Pembayaran diverifikasi.')}>Terima</button>
                <button className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white" onClick={() => run(() => mutate(db => verifyPayment(db, b.id, p.id, false, u.name)), 'Bukti ditolak.')}>Tolak</button></>}
              {p.status === 'valid' && can(u, 'payment.void') && <button className="text-xs font-semibold text-red-600 underline" onClick={() => setDlg({ void: p.id })}>Void</button>}
            </>)}</PaymentList>
          </section>
          {b.payments.some(p => p.status === 'valid') && <button className="btn-ghost" onClick={() => setDlg('invoice')}>Invoice & struk</button>}
        </div>
        <aside className="card h-fit space-y-2 p-5">
          <h2 className="mb-1 font-bold">Tindakan</h2>
          {pendingProof(b) && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Ada bukti transfer menunggu verifikasi.</p>}
          {active && <Perm p="booking.edit"><button className="btn-ghost w-full" onClick={() => setDlg('reschedule')}>Pindah jadwal</button></Perm>}
          {(b.status === 'pending' || b.status === 'dp') && <Perm p="booking.discount"><button className="btn-ghost w-full" onClick={() => setDlg('discount')}>Atur diskon</button></Perm>}
          {canFinish && <Perm p="booking.status"><button className="btn-ghost w-full" onClick={() => run(() => mutate(db => finishBooking(db, b.id, u.name)), 'Booking selesai.')}>Tandai selesai</button></Perm>}
          {(b.status === 'dp' || b.status === 'lunas') && <Perm p="booking.status"><button className="btn-ghost w-full" onClick={() => setDlg('noshow')}>Tandai no-show</button></Perm>}
          {active && <Perm p="booking.cancel"><button className="btn-danger w-full" onClick={() => setDlg('cancel')}>Batalkan booking</button></Perm>}
          {!active && <p className="text-sm text-slate-500">Tidak ada tindakan untuk status {STATUS_META[b.status].label}.</p>}
        </aside>
      </div>

      <Confirm open={dlg === 'cancel'} onClose={() => setDlg(null)} title="Batalkan booking?" askReason="Alasan pembatalan" okLabel="Batalkan booking" text="Slot akan dilepas dan bisa dibooking orang lain."
        onConfirm={r => run(() => mutate(db => cancelBooking(db, b.id, r, u.name)), 'Booking dibatalkan.')} />
      <Confirm open={dlg === 'noshow'} onClose={() => setDlg(null)} title="Tandai no-show?" text="Pelanggan tidak datang. Slot dilepas." onConfirm={() => run(() => mutate(db => markNoShow(db, b.id, u.name)), 'Ditandai no-show.')} />
      <Confirm open={typeof dlg === 'object' && dlg !== null} onClose={() => setDlg(null)} title="Void pembayaran?" askReason="Alasan void"
        onConfirm={r => run(() => mutate(db => voidPayment(db, b.id, (dlg as { void: number }).void, r, u.name)), 'Pembayaran di-void.')} />
      <PayDialog open={dlg === 'pay'} onClose={() => setDlg(null)} bookingId={b.id} />
      <DiscountDialog key={b.discount} open={dlg === 'discount'} onClose={() => setDlg(null)} bookingId={b.id} />
      <RescheduleDialog open={dlg === 'reschedule'} onClose={() => setDlg(null)} bookingId={b.id} onDone={() => nav(`/admin/bookings/${b.id}`)} />
      <Modal open={dlg === 'invoice'} onClose={() => setDlg(null)} title="Invoice"><Invoice b={b} /></Modal>
    </div>
  )
}

function PayDialog({ open, onClose, bookingId }: { open: boolean; onClose: () => void; bookingId: number }) {
  const d = useDB(); const u = useSession()!; const toast = useToast(); const { errors, run } = useFormErrors()
  const b = d.bookings.find(x => x.id === bookingId)!
  const first = paidOf(b) === 0
  const [amount, setAmount] = useState(''); const [method, setMethod] = useState<PayMethod>('tunai'); const [ref, setRef] = useState('')
  const change = method === 'tunai' && Number(amount) > remaining(b) ? Number(amount) - remaining(b) : 0
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const ok = run(() => { mutate(db => recordPayment(db, b.id, { amount: Math.min(Number(amount), remaining(b)), method, reference: ref }, u.name)); return true })
    if (ok) { toast(change ? `Pembayaran dicatat. Kembalian ${rupiah(change)}.` : 'Pembayaran dicatat.'); setAmount(''); setRef(''); onClose() }
  }
  return (
    <Modal open={open} onClose={onClose} title="Catat pembayaran">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-500">Sisa tagihan {rupiah(remaining(b))}{first && ` · DP minimal ${rupiah(Math.min(b.dp_required, b.total))}`}</p>
        <Field label="Jumlah" error={errors.amount}><RupiahInput value={amount} onChange={setAmount} options={amountOptions(b)} autoFocus required /></Field>
        <Field label="Metode"><select className="input" value={method} onChange={e => setMethod(e.target.value as PayMethod)}><option value="tunai">Tunai</option><option value="transfer">Transfer</option><option value="qris">QRIS</option><option value="kartu">Kartu</option></select></Field>
        {method !== 'tunai' && <Field label="Referensi (opsional)"><input className="input" value={ref} onChange={e => setRef(e.target.value)} /></Field>}
        {change > 0 && <p className="rounded-lg bg-turf-50 p-2 text-sm font-semibold text-turf-800">Kembalian: {rupiah(change)}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Batal</button><button className="btn-primary">Simpan</button></div>
      </form>
    </Modal>
  )
}

function DiscountDialog({ open, onClose, bookingId }: { open: boolean; onClose: () => void; bookingId: number }) {
  const d = useDB(); const u = useSession()!; const { errors, run } = useFormErrors(); const toast = useToast()
  const b = d.bookings.find(x => x.id === bookingId)!; const [v, setV] = useState(String(b.discount))
  return (
    <Modal open={open} onClose={onClose} title="Atur diskon">
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (run(() => { mutate(db => applyDiscount(db, b.id, Number(v), u.name)); return true })) { toast('Diskon diperbarui.'); onClose() } }}>
        <Field label="Diskon (Rp)" error={errors.discount} hint={`Subtotal ${rupiah(b.subtotal)}`}><RupiahInput value={v} onChange={setV} /></Field>
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Batal</button><button className="btn-primary">Simpan</button></div>
      </form>
    </Modal>
  )
}

function RescheduleDialog({ open, onClose, bookingId, onDone }: { open: boolean; onClose: () => void; bookingId: number; onDone: () => void }) {
  const d = useDB(); const u = useSession()!; const { errors, run } = useFormErrors(); const toast = useToast()
  const b = d.bookings.find(x => x.id === bookingId)!
  const [court, setCourt] = useState(b.court_id); const [date, setDate] = useState(b.date); const [sel, setSel] = useState<string[]>([])
  // slot milik booking ini sendiri tetap ditampilkan sebagai terisi; dilepas otomatis saat disimpan
  const slots = daySlots(d, court, date).map(s => (s.booking?.id === b.id ? { ...s, state: 'free' as const, booking: undefined } : s))
  return (
    <Modal open={open} onClose={onClose} title="Pindah jadwal">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lapangan"><select className="input" value={court} onChange={e => { setCourt(Number(e.target.value)); setSel([]) }}>{d.courts.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Tanggal"><input type="date" className="input" min={today()} max={addDays(today(), d.settings.max_days_ahead)} value={date} onChange={e => { setDate(e.target.value); setSel([]) }} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {slots.map(s => { const on = sel.includes(s.start); const ok = s.state === 'free'
            return <button key={s.start} disabled={!ok} aria-pressed={on} onClick={() => setSel(on ? sel.filter(x => x !== s.start) : [...sel, s.start])}
              className={`rounded-lg border px-1 py-2 text-xs font-semibold ${on ? 'border-turf-700 bg-turf-700 text-white' : ok ? 'border-turf-200 bg-turf-50 text-turf-800' : 'border-slate-200 bg-slate-100 text-slate-400'}`}>{s.label.slice(0, 5)}</button> })}
        </div>
        {errors.slots && <p className="text-xs font-medium text-red-600">{errors.slots}</p>}{errors.booking && <p className="text-xs font-medium text-red-600">{errors.booking}</p>}
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn-primary" onClick={() => { if (run(() => { mutate(db => reschedule(db, b.id, court, sel, u.name)); return true })) { toast('Jadwal dipindah.'); onClose(); onDone() } }}>Simpan jadwal</button></div>
      </div>
    </Modal>
  )
}
