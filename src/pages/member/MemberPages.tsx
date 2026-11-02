import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BookingSummary, Invoice, PaymentList, ProofUpload } from '../../components/BookingParts'
import { Badge, Confirm, Empty, PageTitle, useAction } from '../../components/ui'
import { cancelBooking, courtOf, timeRange } from '../../lib/logic'
import { mutate, useDB, useSession } from '../../lib/store'
import { rupiah, tglId } from '../../lib/util'

export function MemberBookings() {
  const d = useDB(); const u = useSession()!
  const list = d.bookings.filter(b => b.user_id === u.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
  return (
    <div>
      <PageTitle title="Booking saya" sub={`Halo, ${u.name}`} actions={<Link to="/" className="btn-primary">Booking lapangan</Link>} />
      {!list.length ? <Empty>Belum ada booking. Pilih jam kosong di <Link to="/" className="font-semibold underline">jadwal</Link>.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map(b => (
            <Link key={b.id} to={`/member/booking/${b.id}`} className="card block p-4 transition hover:border-turf-600">
              <div className="flex items-start justify-between"><b>{b.code}</b><Badge status={b.status} /></div>
              <p className="mt-1 text-sm">{courtOf(d, b.court_id)?.name} · {tglId(b.date)}</p>
              <p className="text-sm text-slate-500">{timeRange(b)} · {rupiah(b.total)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function MemberBookingDetail() {
  const { id } = useParams(); const d = useDB(); const u = useSession()!; const act = useAction(); const nav = useNavigate()
  const [cancel, setCancel] = useState(false); const [inv, setInv] = useState(false)
  const b = d.bookings.find(x => x.id === Number(id) && x.user_id === u.id)
  if (!b) return <Empty>Booking tidak ditemukan. <Link to="/member/booking" className="underline">Kembali</Link></Empty>
  const canCancel = ['pending', 'dp', 'lunas'].includes(b.status)
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BookingSummary b={b} />
      <ProofUpload booking={b} actor={u.name} />
      <section className="card p-5"><h2 className="mb-2 font-bold">Pembayaran</h2><PaymentList booking={b} /></section>
      <div className="flex flex-wrap gap-2">
        {b.payments.some(p => p.status === 'valid') && <button className="btn-ghost" onClick={() => setInv(v => !v)}>{inv ? 'Sembunyikan invoice' : 'Lihat invoice'}</button>}
        {canCancel && <button className="btn-danger" onClick={() => setCancel(true)}>Batalkan booking</button>}
      </div>
      {inv && <Invoice b={b} />}
      <Confirm open={cancel} onClose={() => setCancel(false)} title="Batalkan booking?" askReason="Alasan pembatalan" okLabel="Batalkan booking"
        text={`Pembatalan mandiri hanya bisa minimal ${d.settings.cancel_limit_hours} jam sebelum main. Biaya yang sudah dibayar tidak dapat dikembalikan.`}
        onConfirm={reason => { act(() => { mutate(db => cancelBooking(db, b.id, reason, u.name, true)); return true }, 'Booking dibatalkan.') && (setCancel(false), nav('/member/booking')) }} />
    </div>
  )
}
