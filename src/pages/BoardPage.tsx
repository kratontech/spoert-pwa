import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDB, useSession } from '../lib/store'
import { can, daySlots, type DaySlot } from '../lib/logic'
import { addDays, cx, rupiah, tglId, today } from '../lib/util'
import { Badge } from '../components/ui'

const STATE_STYLE: Record<string, string> = {
  free: 'border-turf-200 bg-turf-50 text-turf-800 hover:border-turf-600 hover:bg-turf-100 dark:border-turf-800 dark:bg-turf-900/40 dark:text-turf-100',
  selected: 'border-turf-700 bg-turf-700 text-white',
  booked: 'border-slate-300 bg-slate-200 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  blocked: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
  past: 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900',
  norule: 'border-dashed border-slate-300 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900',
  closed: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
}
const STATE_LABEL: Record<string, string> = { free: '', booked: 'Terisi', blocked: 'Blokir', past: 'Lewat', norule: 'Tanpa harga', closed: 'Maintenance' }
const STATE_ICON: Record<string, string> = { booked: '●', blocked: '⛔', past: '–', norule: '?', closed: '🔧' }

export default function BoardPage({ admin = false }: { admin?: boolean }) {
  const d = useDB(); const user = useSession(); const nav = useNavigate()
  const [date, setDate] = useState(today())
  const [sel, setSel] = useState<{ court: number; starts: string[] }>({ court: 0, starts: [] })
  const max = d.settings.max_slots_per_booking
  const courts = d.courts.filter(c => c.is_active)
  const cols = useMemo(() => courts.map(c => ({ court: c, slots: daySlots(d, c.id, date) })), [d, date]) // eslint-disable-line
  const rows = cols[0]?.slots.map(s => s.label) ?? []
  const minDate = today(), maxDate = addDays(today(), d.settings.max_days_ahead)
  const announcements = d.announcements.filter(a => a.is_active && (!a.starts_on || a.starts_on <= today()) && (!a.ends_on || a.ends_on >= today()))
  const promos = d.promos.filter(p => p.is_active && (!p.ends_on || p.ends_on >= today()))
  const canBook = admin ? can(user, 'booking.create') : true

  function click(courtId: number, s: DaySlot) {
    if (s.booking && (admin || user?.id === s.booking.user_id)) {
      nav(admin ? `/admin/bookings/${s.booking.id}` : `/member/booking/${s.booking.id}`); return
    }
    if (s.state !== 'free') return
    setSel(cur => {
      if (cur.court !== courtId) return { court: courtId, starts: [s.start] }
      if (cur.starts.includes(s.start)) return { ...cur, starts: cur.starts.filter(x => x !== s.start) }
      if (cur.starts.length >= max) return cur
      return { ...cur, starts: [...cur.starts, s.start] }
    })
  }
  const chosen = sel.starts.length ? cols.find(c => c.court.id === sel.court)!.slots.filter(s => sel.starts.includes(s.start)) : []
  const total = chosen.reduce((a, s) => a + s.price, 0)
  const target = admin ? '/admin/bookings/baru' : user?.role === 'member' ? '/member/booking/baru' : '/booking'
  const qs = `?court=${sel.court}&s=${encodeURIComponent(sel.starts.join(","))}`

  return (
    <div>
      {!admin && (
        <section className="pitch-lines mb-5 overflow-hidden rounded-2xl bg-turf-800 px-5 py-6 text-white">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Pilih jam, lapangan langsung terkunci.</h1>
          <p className="mt-1 max-w-xl text-sm text-turf-100">Ketuk jam kosong di jadwal, lalu isi nama dan no. HP. Tidak perlu akun untuk booking.</p>
        </section>
      )}
      {announcements.map(a => (
        <div key={a.id} className={cx('mb-3 rounded-lg border px-4 py-2.5 text-sm', a.level === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-900' : a.level === 'danger' ? 'border-red-300 bg-red-50 text-red-900' : 'border-sky-200 bg-sky-50 text-sky-900')}>
          <strong>{a.title}.</strong> {a.body}
        </div>
      ))}

      <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2">
          <button className="btn-ghost !px-3" disabled={date <= minDate} onClick={() => { setDate(addDays(date, -1)); setSel({ court: 0, starts: [] }) }} aria-label="Hari sebelumnya">‹</button>
          <input type="date" className="input !w-auto" value={date} min={minDate} max={maxDate} onChange={e => { if (e.target.value) { setDate(e.target.value); setSel({ court: 0, starts: [] }) } }} />
          <button className="btn-ghost !px-3" disabled={date >= maxDate} onClick={() => { setDate(addDays(date, 1)); setSel({ court: 0, starts: [] }) }} aria-label="Hari berikutnya">›</button>
          <span className="hidden text-sm font-semibold sm:block">{tglId(date)}</span>
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          <li><span className="mr-1 inline-block h-3 w-3 rounded border border-turf-200 bg-turf-50 align-middle" />Kosong</li>
          <li><span className="mr-1 inline-block h-3 w-3 rounded bg-turf-700 align-middle" />Dipilih</li>
          <li><span className="mr-1 inline-block h-3 w-3 rounded bg-slate-300 align-middle" />● Terisi</li>
          <li><span className="mr-1 inline-block h-3 w-3 rounded bg-red-200 align-middle" />⛔ Blokir</li>
        </ul>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[480px] border-separate border-spacing-1.5 p-1">
          <thead><tr>
            <th className="w-24 text-left text-xs font-semibold text-slate-500">Jam</th>
            {cols.map(c => <th key={c.court.id} className="text-sm font-bold">{c.court.name}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((label, i) => (
              <tr key={label}>
                <td className="whitespace-nowrap pr-1 text-xs font-semibold tabular-nums text-slate-500">{label}</td>
                {cols.map(c => {
                  const s = c.slots[i]
                  const isSel = sel.court === c.court.id && sel.starts.includes(s.start)
                  const st = isSel ? 'selected' : s.state
                  const clickable = s.state === 'free' || (s.booking && (admin || user?.id === s.booking.user_id))
                  return (
                    <td key={c.court.id}>
                      <button disabled={!clickable} onClick={() => click(c.court.id, s)} aria-pressed={isSel}
                        title={s.booking ? `${s.booking.customer_name}` : s.reason}
                        className={cx('flex h-14 w-full flex-col items-center justify-center rounded-lg border text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-turf-600', STATE_STYLE[st], !clickable && 'cursor-default')}>
                        {s.state === 'free' || isSel
                          ? <><span>{isSel ? '✓ Dipilih' : rupiah(s.price)}</span><span className="text-[10px] font-medium opacity-70">{s.rule_type === 'peak' ? 'Peak' : 'Off-peak'}</span></>
                          : <><span>{STATE_ICON[s.state]} {STATE_LABEL[s.state]}</span>{admin && s.booking && <span className="max-w-full truncate px-1 text-[10px] font-medium">{s.booking.customer_name}</span>}</>}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-6 text-center text-sm text-slate-500">Belum ada lapangan aktif.</p>}
      </div>

      {!admin && promos.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-bold">Promo</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {promos.map(p => (
              <article key={p.id} className="card p-4">
                <span className="rounded-full bg-turf-100 px-2.5 py-0.5 text-xs font-bold text-turf-800">{p.badge}</span>
                <h3 className="mt-2 font-bold">{p.title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{p.description}</p>
                {p.code && <p className="mt-2 text-xs">Kode: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-bold dark:bg-slate-800">{p.code}</code>{p.members_only && ' · khusus member'}</p>}
              </article>
            ))}
          </div>
        </section>
      )}
      {!admin && <p className="mt-6 text-center text-sm text-slate-500"><Link to="/booking/cek" className="font-semibold text-turf-700 underline">Sudah booking? Cek status di sini</Link></p>}

      {chosen.length > 0 && canBook && (
        <div className="fixed inset-x-0 bottom-14 z-40 px-3 sm:bottom-4 lg:left-[230px]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-xl">
            <div className="text-sm"><b>{cols.find(c => c.court.id === sel.court)?.court.name}</b> · {chosen.length} jam<div className="text-xs text-slate-300">{chosen.map(s => s.label.slice(0, 5)).join(', ')} · {rupiah(total)}</div></div>
            <div className="flex gap-2"><button className="btn bg-white/10 hover:bg-white/20" onClick={() => setSel({ court: 0, starts: [] })}>Batal</button>
              <Link to={target + qs} className="btn bg-turf-500 text-white hover:bg-turf-600">Lanjut booking</Link></div>
          </div>
        </div>
      )}
      {admin && <div className="mt-3 text-xs text-slate-500">Klik slot terisi untuk membuka detail booking. <Badge status="pending" /> bisa jatuh otomatis bila lewat batas bayar.</div>}
    </div>
  )
}
