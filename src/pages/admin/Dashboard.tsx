import { Link } from 'react-router-dom'
import { Badge, PageTitle } from '../../components/ui'
import { courtOf, isBlocking, paidOf, pendingProof, timeRange } from '../../lib/logic'
import { useDB, useSession } from '../../lib/store'
import { rupiah, today } from '../../lib/util'

export default function Dashboard() {
  const d = useDB(); const u = useSession()!; const t = today()
  const todays = d.bookings.filter(b => b.date === t && isBlocking(b))
  const revenue = d.bookings.flatMap(b => b.payments).filter(p => p.status === 'valid' && p.paid_at.startsWith(t)).reduce((s, p) => s + p.amount, 0)
  const verify = d.bookings.filter(pendingProof)
  const waiting = d.bookings.filter(b => b.status === 'pending')
  const stat = (label: string, value: string, to?: string) => (
    <Link to={to ?? '#'} className="card p-4 transition hover:border-turf-600"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p></Link>
  )
  return (
    <div>
      <PageTitle title={`Halo, ${u.name.split(' ')[0]}`} sub="Ringkasan hari ini" actions={<Link to="/admin/board" className="btn-primary">Buka Booking Board</Link>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stat('Booking hari ini', String(todays.length), '/admin/bookings')}
        {stat('Pemasukan hari ini', rupiah(revenue))}
        {stat('Menunggu DP', String(waiting.length), '/admin/bookings')}
        {stat('Bukti perlu verifikasi', String(verify.length), '/admin/bookings')}
      </div>
      <h2 className="mb-2 font-bold">Jadwal hari ini</h2>
      {!todays.length ? <p className="text-sm text-slate-500">Belum ada booking hari ini.</p> : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {todays.sort((a, b) => a.slots[0].start.localeCompare(b.slots[0].start)).map(b => (
            <Link key={b.id} to={`/admin/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div><b className="tabular-nums">{timeRange(b)}</b> · {courtOf(d, b.court_id)?.name}<div className="text-sm text-slate-500">{b.customer_name} · dibayar {rupiah(paidOf(b))} / {rupiah(b.total)}</div></div><Badge status={b.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
