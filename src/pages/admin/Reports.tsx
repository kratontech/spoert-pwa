import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Pagination, usePaged } from '../../components/Pagination'
import { Badge, Empty, PageTitle, PayBadge, Table, useToast } from '../../components/ui'
import { printDoc } from '../../lib/print'
import {
  GRAN_LABEL, METHODS, METHOD_LABEL, PAY_STATUS_LABEL, PRESETS, buildReport, fileBase, filterText, periodText, presetRange,
  type Filters, type Gran, type PayRow, type Preset, type Report,
} from '../../lib/report'
import { STATUS_META } from '../../lib/logic'
import { useDB, useSession } from '../../lib/store'
import type { PaymentStatus } from '../../lib/types'
import { cx, nowStr, rupiah, tglId } from '../../lib/util'

type Tab = 'rekap' | 'rincian'
type Sort = { key: 'at' | 'amount'; dir: 'asc' | 'desc' }
const n0 = (n: number) => n.toLocaleString('id-ID')

function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'warn' }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={cx('mt-1 text-xl font-extrabold tabular-nums sm:text-2xl', tone === 'ok' && 'text-turf-700', tone === 'warn' && 'text-amber-700')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function BarChart({ r, gran }: { r: Report; gran: Gran }) {
  const max = Math.max(1, ...r.buckets.map(b => b.total))
  const first = r.buckets[0], last = r.buckets[r.buckets.length - 1]
  const short = (l: string) => gran === 'day' ? l.split(', ')[1] ?? l : l
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-baseline justify-between"><h2 className="text-sm font-bold">Uang masuk per {gran === 'day' ? 'hari' : gran === 'month' ? 'bulan' : 'tahun'}</h2><span className="text-xs text-slate-500">tertinggi {rupiah(max === 1 ? 0 : max)}</span></div>
      <div className="flex h-36 items-end gap-px border-b border-slate-200 dark:border-slate-700" role="img" aria-label="Grafik uang masuk per periode">
        {r.buckets.map(b => (
          <div key={b.key} title={`${b.label}: ${rupiah(b.total)} (${b.count} transaksi)`} className="group flex h-full flex-1 items-end">
            <div className={cx('w-full rounded-t-sm transition-colors', b.total ? 'bg-turf-600 group-hover:bg-turf-800' : 'bg-slate-200 dark:bg-slate-700')} style={{ height: `${b.total ? Math.max(3, (b.total / max) * 100) : 2}%` }} />
          </div>
        ))}
      </div>
      {first && last && <div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>{short(first.label)}</span><span>{short(last.label)}</span></div>}
    </div>
  )
}

export default function Reports() {
  const d = useDB(); const u = useSession()!; const toast = useToast()
  const [preset, setPreset] = useState<Preset>('month')
  const [[from, to], setRange] = useState<[string, string]>(() => presetRange('month'))
  const [gran, setGran] = useState<Gran>('day')
  const [method, setMethod] = useState<Filters['method']>('')
  const [courtId, setCourtId] = useState(0)
  const [receiver, setReceiver] = useState('')
  const [tab, setTab] = useState<Tab>('rekap')
  const [q, setQ] = useState(''); const [status, setStatus] = useState<'' | PaymentStatus | 'all'>('')
  const [sort, setSort] = useState<Sort>({ key: 'at', dir: 'desc' })
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null)
  const [printing, setPrinting] = useState(false)

  const filters: Filters = { from, to, gran, method, courtId, receiver }
  const report = useMemo(() => buildReport(d, filters), [d, from, to, gran, method, courtId, receiver]) // eslint-disable-line react-hooks/exhaustive-deps
  const receivers = useMemo(() => [...new Set(d.bookings.flatMap(b => b.payments.map(p => p.received_by)))].sort(), [d])

  const pickPreset = (p: Preset) => {
    setPreset(p)
    if (p !== 'custom') { setRange(presetRange(p)); setGran(p === 'year' ? 'month' : 'day') }
  }
  const setDate = (k: 0 | 1, v: string) => { if (!v) return; setPreset('custom'); setRange(k === 0 ? [v, to] : [from, v]) }

  // rincian: filter status + cari + urut
  const detail = useMemo(() => {
    const st = status || 'valid'; const s = q.trim().toLowerCase()
    const rows = report.rows.filter(r => (st === 'all' || r.status === st) && (!s || `${r.code} ${r.customer} ${r.phone} ${r.reference} ${r.receiver}`.toLowerCase().includes(s)))
    const dir = sort.dir === 'asc' ? 1 : -1
    return rows.sort((a, b) => (sort.key === 'amount' ? a.amount - b.amount : a.at.localeCompare(b.at) || a.id - b.id) * dir)
  }, [report, status, q, sort])
  const detailValid = detail.filter(r => r.status === 'valid').reduce((s, r) => s + r.amount, 0)

  const keyBase = `${from}|${to}|${gran}|${method}|${courtId}|${receiver}`
  const pgRekap = usePaged(report.buckets, keyBase, 10)
  const pgDetail = usePaged(detail, `${keyBase}|${q}|${status}|${sort.key}${sort.dir}`, 10)
  const sumM = (k: 'tunai' | 'transfer' | 'qris' | 'kartu') => report.buckets.reduce((s, b) => s + b[k], 0)

  const meta = { business: d.settings.business_name, title: 'Laporan Uang Masuk', period: periodText(report), filters: filterText(d, filters), printedBy: u.name, printedAt: nowStr() }

  // cetak: render lembar cetak penuh hanya saat dibutuhkan, lalu panggil dialog print
  useEffect(() => {
    if (!printing) return
    const t = setTimeout(() => printDoc(`${fileBase(report)}`, () => setPrinting(false)), 80)
    return () => clearTimeout(t)
  }, [printing]) // eslint-disable-line react-hooks/exhaustive-deps

  const doExport = async (kind: 'pdf' | 'xlsx') => {
    setBusy(kind)
    try {
      const ex = await import('../../lib/exporters')
      await (kind === 'pdf' ? ex.exportPdf : ex.exportXlsx)(report, meta, detail)
      toast(`Laporan ${kind === 'pdf' ? 'PDF' : 'Excel'} diunduh.`)
    } catch (e) { toast(`Gagal membuat file: ${(e as Error).message}`, 'err') } finally { setBusy(null) }
  }

  const sortBtn = (key: Sort['key'], label: string) => (
    <button type="button" className="inline-flex items-center gap-1 font-semibold hover:text-slate-800 dark:hover:text-slate-200" onClick={() => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))}>
      {label}<span aria-hidden className={cx('text-[10px]', sort.key === key ? 'text-turf-700' : 'text-slate-300')}>{sort.key === key && sort.dir === 'asc' ? '▲' : '▼'}</span>
    </button>
  )

  return (
    <div>
      <PageTitle title="Laporan" sub="Uang masuk dan lifecycle pendapatan. Atur periode dan filter sesuai kebutuhan, lalu ekspor."
        actions={
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Ekspor / unduh data laporan:</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => doExport('pdf')} disabled={!!busy}>{busy === 'pdf' ? 'Membuat PDF…' : 'PDF'}</button>
              <button className="btn-primary" onClick={() => doExport('xlsx')} disabled={!!busy}>{busy === 'xlsx' ? 'Membuat Excel…' : 'Excel'}</button>
            </div>
          </div>
        } />

      {/* Filter */}
      <section className="card mb-4 space-y-3 p-4" aria-label="Filter laporan">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Periode cepat">
          {PRESETS.map(p => (
            <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => pickPreset(p.id)}
              className={cx('rounded-full border px-3 py-1 text-xs font-semibold transition', preset === p.id ? 'border-turf-700 bg-turf-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200')}>{p.label}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Dari<input type="date" className="input mt-1" value={from} max={to} onChange={e => setDate(0, e.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Sampai<input type="date" className="input mt-1" value={to} min={from} onChange={e => setDate(1, e.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Rekap per
            <select className="input mt-1" value={gran} onChange={e => setGran(e.target.value as Gran)}>{(Object.keys(GRAN_LABEL) as Gran[]).map(g => <option key={g} value={g}>{GRAN_LABEL[g]}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Metode bayar
            <select className="input mt-1" value={method} onChange={e => setMethod(e.target.value as Filters['method'])}><option value="">Semua metode</option>{METHODS.map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Lapangan
            <select className="input mt-1" value={courtId} onChange={e => setCourtId(Number(e.target.value))}><option value={0}>Semua lapangan</option>{d.courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Diterima oleh
            <select className="input mt-1" value={receiver} onChange={e => setReceiver(e.target.value)}><option value="">Semua penerima</option>{receivers.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
        </div>
        <p className="text-xs text-slate-500">Periode: <b className="text-slate-700 dark:text-slate-200">{periodText(report)}</b> · {report.buckets.length} {gran === 'day' ? 'hari' : gran === 'month' ? 'bulan' : 'tahun'}</p>
      </section>

      {/* Ringkasan */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Uang masuk (valid)" value={rupiah(report.total)} tone="ok" sub={`${n0(report.count)} transaksi`} />
        <Stat label="Rata-rata / transaksi" value={rupiah(report.avg)} sub={`${n0(report.bookingCount)} booking pada periode`} />
        <Stat label="Piutang (sisa tagihan)" value={rupiah(report.piutang)} tone={report.piutang ? 'warn' : undefined} sub="booking aktif, berdasar tanggal main" />
        <Stat label="Void / menunggu verifikasi" value={`${rupiah(report.voided)}`} sub={`${n0(report.voidCount)} void · ${n0(report.pendingCount)} menunggu (${rupiah(report.pending)})`} />
      </div>

      <section className="mb-4" aria-label="Lifecycle booking">
        <h2 className="mb-2 text-sm font-bold">Lifecycle booking <span className="font-normal text-slate-500">(berdasarkan tanggal main)</span></h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {report.lifecycle.map(l => (
            <div key={l.status} className="card flex flex-col gap-1 p-3">
              <Badge status={l.status} />
              <p className="text-lg font-extrabold tabular-nums">{n0(l.count)}</p>
              <p className="text-[11px] leading-tight text-slate-500">tagihan {rupiah(l.total)}<br />dibayar {rupiah(l.paid)}{l.remaining > 0 && <><br /><span className="font-semibold text-amber-700">sisa {rupiah(l.remaining)}</span></>}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-4"><BarChart r={report} gran={gran} /></div>

      {/* Tab */}
      <div className="mb-3 inline-flex rounded-lg border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900" role="tablist">
        {([['rekap', `Rekap ${GRAN_LABEL[gran].toLowerCase()}`], ['rincian', 'Rincian transaksi']] as [Tab, string][]).map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cx('rounded-md px-4 py-1.5 text-sm font-semibold transition', tab === t ? 'bg-turf-700 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>{l}</button>
        ))}
      </div>

      {tab === 'rekap' ? (
        <>
          <Table
            head={['Periode', { label: 'Transaksi', right: true }, { label: 'Tunai', right: true }, { label: 'Transfer', right: true }, { label: 'QRIS', right: true }, { label: 'Kartu', right: true }, { label: 'Total', right: true }]}
            foot={<tr><td className="td">TOTAL</td><td className="td text-right tabular-nums">{n0(report.count)}</td><td className="td text-right tabular-nums">{n0(sumM('tunai'))}</td><td className="td text-right tabular-nums">{n0(sumM('transfer'))}</td><td className="td text-right tabular-nums">{n0(sumM('qris'))}</td><td className="td text-right tabular-nums">{n0(sumM('kartu'))}</td><td className="td whitespace-nowrap text-right tabular-nums text-turf-700">{rupiah(report.total)}</td></tr>}>
            {pgRekap.pageItems.map(b => (
              <tr key={b.key} className={cx('even:bg-slate-50/60 dark:even:bg-slate-800/20', !b.total && 'text-slate-400')}>
                <td className="td whitespace-nowrap font-medium">{b.label}</td>
                <td className="td text-right tabular-nums">{n0(b.count)}</td>
                <td className="td text-right tabular-nums">{b.tunai ? n0(b.tunai) : '–'}</td>
                <td className="td text-right tabular-nums">{b.transfer ? n0(b.transfer) : '–'}</td>
                <td className="td text-right tabular-nums">{b.qris ? n0(b.qris) : '–'}</td>
                <td className="td text-right tabular-nums">{b.kartu ? n0(b.kartu) : '–'}</td>
                <td className="td text-right font-semibold tabular-nums">{b.total ? n0(b.total) : '–'}</td>
              </tr>
            ))}
          </Table>
          <Pagination p={pgRekap} />
        </>
      ) : (
        <>
          <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_220px]">
            <input className="input" placeholder="Cari kode booking / pelanggan / HP / referensi" value={q} onChange={e => setQ(e.target.value)} aria-label="Cari transaksi" />
            <select className="input" value={status} onChange={e => setStatus(e.target.value as typeof status)} aria-label="Status pembayaran">
              <option value="">Status: Valid saja</option><option value="all">Semua status</option>
              {(Object.keys(PAY_STATUS_LABEL) as PaymentStatus[]).filter(s => s !== 'valid').map(s => <option key={s} value={s}>{PAY_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          {!detail.length ? <Empty>Tidak ada transaksi pada filter ini.</Empty> : (
            <>
              <Table
                head={[{ label: sortBtn('at', 'Tanggal'), key: 'at' }, 'Kode booking', 'Pelanggan', 'Lapangan', 'Metode', 'Diterima oleh', 'Status', { label: sortBtn('amount', 'Jumlah'), key: 'amount', right: true }]}
                foot={<tr><td className="td" colSpan={7}>Total transaksi valid pada daftar ({n0(detail.length)} baris)</td><td className="td whitespace-nowrap text-right tabular-nums text-turf-700">{rupiah(detailValid)}</td></tr>}>
                {pgDetail.pageItems.map((r: PayRow) => (
                  <tr key={r.id} className="even:bg-slate-50/60 dark:even:bg-slate-800/20">
                    <td className="td whitespace-nowrap text-xs">{tglId(r.date, false)}<div className="text-slate-500">{r.at.slice(11)}</div></td>
                    <td className="td whitespace-nowrap font-semibold"><Link to={`/admin/bookings/${r.bookingId}`} className="text-turf-700 underline">{r.code}</Link></td>
                    <td className="td">{r.customer}<div className="text-xs text-slate-500">{r.phone}</div></td>
                    <td className="td whitespace-nowrap">{r.court}</td>
                    <td className="td whitespace-nowrap">{METHOD_LABEL[r.method]}{(r.channel || r.reference) && <div className="text-xs text-slate-500">{[r.channel, r.reference].filter(Boolean).join(' · ')}</div>}</td>
                    <td className="td">{r.receiver}</td>
                    <td className="td"><PayBadge status={r.status} /></td>
                    <td className={cx('td text-right font-semibold tabular-nums', r.status !== 'valid' && 'text-slate-400 line-through')}>{n0(r.amount)}</td>
                  </tr>
                ))}
              </Table>
              <Pagination p={pgDetail} />
            </>
          )}
        </>
      )}

      {printing && <PrintSheet report={report} meta={meta} tab={tab} detail={detail} detailValid={detailValid} />}
    </div>
  )
}

/** Lembar cetak (A4 landscape): hanya dirender saat tombol Cetak ditekan, berisi SEMUA baris tab yang aktif. */
function PrintSheet({ report: r, meta, tab, detail, detailValid }: { report: Report; meta: { business: string; title: string; period: string; filters: string; printedBy: string; printedAt: string }; tab: Tab; detail: PayRow[]; detailValid: number }) {
  const th = 'border-b-2 border-slate-400 px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wide text-slate-600'
  const td = 'border-b border-slate-200 px-2 py-1 align-top'
  const sumM = (k: 'tunai' | 'transfer' | 'qris' | 'kartu') => r.buckets.reduce((s, b) => s + b[k], 0)
  return (
    <div data-print-root className="report-sheet bg-white text-[11px] leading-snug text-slate-800">
      <header className="mb-3 flex items-start justify-between border-b-2 border-turf-700 pb-2">
        <div><h1 className="text-lg font-extrabold text-turf-800">{meta.business}</h1><p className="text-slate-500">Dicetak {meta.printedAt} oleh {meta.printedBy}</p></div>
        <div className="text-right"><p className="text-sm font-black uppercase tracking-widest">{meta.title}</p><p>Periode: <b>{meta.period}</b></p><p className="text-slate-500">{meta.filters}</p></div>
      </header>
      <table className="mb-3 w-full border-collapse">
        <thead><tr>{['Uang masuk', 'Transaksi valid', 'Rata-rata', 'Void', 'Menunggu verifikasi', 'Piutang'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody><tr className="text-sm font-bold"><td className={td}>{rupiah(r.total)}</td><td className={td}>{n0(r.count)}</td><td className={td}>{rupiah(r.avg)}</td><td className={td}>{rupiah(r.voided)} ({r.voidCount})</td><td className={td}>{rupiah(r.pending)} ({r.pendingCount})</td><td className={td}>{rupiah(r.piutang)}</td></tr></tbody>
      </table>
      <table className="mb-4 w-full border-collapse">
        <thead><tr>{['Lifecycle booking (tgl main)', 'Jumlah', 'Total tagihan', 'Sudah dibayar', 'Sisa tagihan'].map((h, i) => <th key={h} className={cx(th, i > 0 && 'text-right')}>{h}</th>)}</tr></thead>
        <tbody>{r.lifecycle.map(l => <tr key={l.status}><td className={td}>{STATUS_META[l.status].label}</td><td className={cx(td, 'text-right')}>{n0(l.count)}</td><td className={cx(td, 'text-right')}>{n0(l.total)}</td><td className={cx(td, 'text-right')}>{n0(l.paid)}</td><td className={cx(td, 'text-right')}>{n0(l.remaining)}</td></tr>)}</tbody>
      </table>
      {tab === 'rekap' ? (
        <table className="w-full border-collapse">
          <thead><tr>{['Periode', 'Transaksi', 'Tunai', 'Transfer', 'QRIS', 'Kartu', 'Total'].map((h, i) => <th key={h} className={cx(th, i > 0 && 'text-right')}>{h}</th>)}</tr></thead>
          <tbody>{r.buckets.map(b => <tr key={b.key}><td className={td}>{b.label}</td><td className={cx(td, 'text-right')}>{n0(b.count)}</td><td className={cx(td, 'text-right')}>{b.tunai ? n0(b.tunai) : '–'}</td><td className={cx(td, 'text-right')}>{b.transfer ? n0(b.transfer) : '–'}</td><td className={cx(td, 'text-right')}>{b.qris ? n0(b.qris) : '–'}</td><td className={cx(td, 'text-right')}>{b.kartu ? n0(b.kartu) : '–'}</td><td className={cx(td, 'text-right font-semibold')}>{b.total ? n0(b.total) : '–'}</td></tr>)}</tbody>
          <tfoot><tr className="font-bold"><td className={td}>TOTAL</td><td className={cx(td, 'text-right')}>{n0(r.count)}</td><td className={cx(td, 'text-right')}>{n0(sumM('tunai'))}</td><td className={cx(td, 'text-right')}>{n0(sumM('transfer'))}</td><td className={cx(td, 'text-right')}>{n0(sumM('qris'))}</td><td className={cx(td, 'text-right')}>{n0(sumM('kartu'))}</td><td className={cx(td, 'whitespace-nowrap text-right')}>{rupiah(r.total)}</td></tr></tfoot>
        </table>
      ) : (
        <table className="w-full border-collapse">
          <thead><tr>{['Tanggal', 'Kode booking', 'Pelanggan', 'Lapangan', 'Metode', 'Diterima oleh', 'Status', 'Jumlah'].map((h, i) => <th key={h} className={cx(th, i === 7 && 'text-right')}>{h}</th>)}</tr></thead>
          <tbody>{detail.map(x => <tr key={x.id}><td className={cx(td, 'whitespace-nowrap')}>{x.at}</td><td className={cx(td, 'whitespace-nowrap font-semibold')}>{x.code}</td><td className={td}>{x.customer} · {x.phone}</td><td className={td}>{x.court}</td><td className={td}>{METHOD_LABEL[x.method]}{x.channel && ` · ${x.channel}`}</td><td className={td}>{x.receiver}</td><td className={td}>{PAY_STATUS_LABEL[x.status]}</td><td className={cx(td, 'text-right font-semibold')}>{n0(x.amount)}</td></tr>)}</tbody>
          <tfoot><tr className="font-bold"><td className={td} colSpan={7}>Total transaksi valid pada daftar ({n0(detail.length)} baris)</td><td className={cx(td, 'whitespace-nowrap text-right')}>{rupiah(detailValid)}</td></tr></tfoot>
        </table>
      )}
    </div>
  )
}
