import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Field, Modal, PayBadge, RupiahInput, useFormErrors, useToast, Badge } from './ui'
import { useDB, mutate, TAB_ID } from '../lib/store'
import { amountOptions, applyPromo, courtOf, createBooking, paidOf, pendingProof, plan, recordPayment, remaining, STATUS_META, timeRange } from '../lib/logic'
import type { Booking, PayMethod } from '../lib/types'
import { printDoc } from '../lib/print'
import { rupiah, tglId, cx, today } from '../lib/util'

export type FormMode = 'public' | 'member' | 'admin'

export function BookingForm({ mode, user, onDone }: { mode: FormMode; user: { id: number; name: string; phone: string } | null; onDone: (b: Booking) => void }) {
  const d = useDB(); const [sp] = useSearchParams(); const { errors, run } = useFormErrors()
  const courtId = Number(sp.get('court') ?? 0)
  const starts = (sp.get('s') ?? '').split(',').filter(Boolean).map(s => s.replace('+', ' '))
  const [f, setF] = useState({ name: user?.name.replace(/ \(.*\)$/, '') ?? '', phone: user?.phone ?? '', notes: '', promo: '' })
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const p = useMemo(() => { try { return plan(d, courtId, starts) } catch (e) { return e as Error } }, [d, courtId, sp]) // eslint-disable-line
  const court = courtOf(d, courtId)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  if (p instanceof Error) return (
    <div className="card p-6 text-center"><p className="mb-3 font-semibold">{p.message}</p><Link to={mode === 'admin' ? '/admin/board' : '/'} className="btn-primary">Kembali ke Booking Board</Link></div>
  )

  const checkPromo = () => {
    try {
      const r = applyPromo(d, f.promo, p.total, p.slots, user?.id ?? null, f.phone)
      setPromoMsg({ ok: true, text: `Hemat ${rupiah(r.discount)}. Total jadi ${rupiah(r.total)}.` })
    } catch (e) { setPromoMsg({ ok: false, text: (e as Error).message }) }
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const b = run(() => mutate(db => {
      const nb = createBooking(db, {
        courtId, starts, name: f.name, phone: f.phone, notes: f.notes, promoCode: mode === 'admin' ? '' : f.promo,
        userId: mode === 'member' ? user!.id : null, actor: mode === 'admin' ? user!.name : mode === 'member' ? user!.name : `Tamu: ${f.name}`,
      })
      if (mode === 'public') nb.ephemeral = TAB_ID // booking tamu: sementara, hilang saat tab tamu refresh/pindah
      return nb
    }))
    if (b) onDone(b)
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <form onSubmit={submit} className="card space-y-4 p-5 lg:order-1">
        <Field label="Nama pemesan" error={errors.customer_name}><input className="input" value={f.name} onChange={set('name')} required /></Field>
        <Field label="No. HP / WhatsApp" error={errors.phone} hint="Dipakai untuk membuka status booking Anda."><input className="input" inputMode="tel" value={f.phone} onChange={set('phone')} required /></Field>
        <Field label="Catatan (opsional)"><textarea className="input" rows={2} value={f.notes} onChange={set('notes')} /></Field>
        {mode !== 'admin' && (
          <Field label="Kode promo (opsional)" error={errors.promo_code}>
            <div className="flex gap-2"><input className="input uppercase" value={f.promo} onChange={set('promo')} placeholder="mis. PAGI20" />
              <button type="button" className="btn-ghost" onClick={checkPromo} disabled={!f.promo.trim()}>Cek</button></div>
            {promoMsg && <p className={cx('mt-1 text-xs font-medium', promoMsg.ok ? 'text-turf-700' : 'text-red-600')}>{promoMsg.text}</p>}
          </Field>
        )}
        {errors.slots && <p role="alert" className="text-sm font-medium text-red-600">{errors.slots}</p>}
        <button className="btn-primary w-full">Buat booking</button>
        {mode === 'public' && <p className="text-center text-xs text-slate-500">Punya kode member? <Link to="/login" className="underline">Masuk</Link> dulu supaya promo member bisa dipakai.</p>}
      </form>
      <aside className="card h-fit p-5 lg:order-2">
        <h2 className="font-bold">{court?.name}</h2>
        <p className="text-sm text-slate-500">{tglId(p.date)}</p>
        <ul className="my-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {p.slots.map(s => <li key={s.start} className="flex justify-between py-1.5"><span>{s.start.slice(11)} – {s.end.slice(11)} <span className="text-xs text-slate-500">{s.rule_type === 'peak' ? 'Peak' : 'Off-peak'}</span></span><span>{rupiah(s.price)}</span></li>)}
        </ul>
        <div className="flex justify-between font-bold"><span>Total</span><span>{rupiah(p.total)}</span></div>
        <p className="mt-1 text-xs text-slate-500">DP minimal {d.settings.min_dp_percent}% = {rupiah(p.dp_required)}. Booking ditahan {d.settings.dp_timeout_minutes} menit untuk menunggu pembayaran.</p>
      </aside>
    </div>
  )
}

export function PaymentInfo({ method = 'transfer' }: { method?: PayMethod }) {
  const s = useDB().settings
  if (method === 'qris') {
    return (
      <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
        <p className="mb-2 font-semibold">Scan QRIS untuk membayar</p>
        {s.qris_image ? (
          <div className="flex flex-col items-center gap-2">
            <img src={s.qris_image} alt="QRIS pembayaran" className="w-full max-w-xs rounded-lg border border-slate-200 bg-white p-2" />
            <a href={s.qris_image} download="qris.png" className="text-xs font-semibold text-turf-700 underline">Unduh gambar QRIS</a>
          </div>
        ) : <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Gambar QRIS belum tersedia. Silakan pilih Transfer bank atau hubungi pengelola.</p>}
        {s.qris_note && <p className="mt-2 text-xs text-slate-500">{s.qris_note}</p>}
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
      <p className="mb-1 font-semibold">Transfer ke salah satu rekening</p>
      <ul className="space-y-0.5">{s.banks.map(b => <li key={b.bank}><b>{b.bank}</b> <span className="tabular-nums">{b.account}</span> a.n. {b.holder}</li>)}</ul>
    </div>
  )
}

export function readProof(file: File): Promise<{ name: string; data: string }> {
  return new Promise((res, rej) => {
    if (file.size > 1_500_000) return rej(new Error('Ukuran file maksimal 1,5 MB.'))
    const r = new FileReader(); r.onload = () => res({ name: file.name, data: String(r.result) }); r.onerror = () => rej(new Error('Gagal membaca file.')); r.readAsDataURL(file)
  })
}

/** Unggah bukti transfer (tamu & member). Masuk berstatus "menunggu verifikasi". */
export function ProofUpload({ booking, actor }: { booking: Booking; actor: string }) {
  const toast = useToast(); const { errors, run, setErrors } = useFormErrors()
  const [amount, setAmount] = useState(String(Math.max(0, paidOf(booking) === 0 ? booking.dp_required : remaining(booking))))
  const [method, setMethod] = useState<PayMethod>('transfer'); const [file, setFile] = useState<File | null>(null)
  const waiting = pendingProof(booking)
  if (['batal', 'no_show', 'selesai'].includes(booking.status) || remaining(booking) === 0) return null
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return setErrors({ proof: 'Pilih foto/screenshot bukti transfer.' })
    try {
      const proof = await readProof(file)
      run(() => { mutate(d => recordPayment(d, booking.id, { amount: Number(amount), method, proof, pending: true }, actor)); toast('Bukti terkirim. Menunggu verifikasi kasir.') })
    } catch (err) { setErrors({ proof: (err as Error).message }) }
  }
  return (
    <section className="card p-5">
      <h2 className="mb-3 font-bold">Kirim bukti pembayaran</h2>
      <PaymentInfo method={method} />
      {waiting ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Bukti {rupiah(waiting.amount)} sedang menunggu verifikasi kasir.</p> : (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Jumlah dibayar" error={errors.amount} hint={`Sisa tagihan ${rupiah(remaining(booking))}`}><RupiahInput value={amount} onChange={setAmount} options={amountOptions(booking)} /></Field>
            <Field label="Metode"><select className="input" value={method} onChange={e => setMethod(e.target.value as PayMethod)}><option value="transfer">Transfer bank</option><option value="qris">QRIS</option></select></Field>
          </div>
          <Field label="Bukti (gambar)" error={errors.proof}><input type="file" accept="image/*" className="input" onChange={e => setFile(e.target.files?.[0] ?? null)} /></Field>
          <button className="btn-primary">Kirim bukti</button>
        </form>
      )}
    </section>
  )
}

export function PaymentList({ booking, children }: { booking: Booking; children?: (p: Booking['payments'][number]) => React.ReactNode }) {
  const [view, setView] = useState<string | null>(null)
  if (!booking.payments.length) return <p className="text-sm text-slate-500">Belum ada pembayaran.</p>
  return (
    <>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {booking.payments.map(p => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div><b>{rupiah(p.amount)}</b> <span className="text-slate-500">{p.method}{p.channel && ` · ${p.channel}`} · {p.paid_at}</span>{p.void_reason && <div className="text-xs text-slate-500">Void: {p.void_reason}</div>}</div>
            <div className="flex items-center gap-2"><PayBadge status={p.status} />
              {p.proof_data && <button className="text-xs font-semibold text-turf-700 underline" onClick={() => setView(p.proof_data)}>Lihat bukti</button>}
              {children?.(p)}</div>
          </li>
        ))}
      </ul>
      <Modal open={!!view} onClose={() => setView(null)} title="Bukti pembayaran">{view && <img src={view} alt="Bukti pembayaran" className="mx-auto max-h-[70vh] rounded" />}</Modal>
    </>
  )
}

export function BookingSummary({ b }: { b: Booking }) {
  const d = useDB()
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-xs text-slate-500">Kode booking</p><p className="text-xl font-extrabold tracking-tight">{b.code}</p></div><Badge status={b.status} />
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-500">Lapangan</dt><dd className="font-semibold">{courtOf(d, b.court_id)?.name}</dd></div>
        <div><dt className="text-slate-500">Jadwal</dt><dd className="font-semibold">{tglId(b.date)}, {timeRange(b)}</dd></div>
        <div><dt className="text-slate-500">Pemesan</dt><dd className="font-semibold">{b.customer_name} · {b.phone}</dd></div>
        <div><dt className="text-slate-500">Jam dipesan</dt><dd className="font-semibold">{b.slots.map(s => s.start.slice(11)).join(', ')}</dd></div>
      </dl>
      <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
        <div className="flex justify-between"><span>Subtotal</span><span>{rupiah(b.subtotal)}</span></div>
        {b.discount > 0 && <div className="flex justify-between text-turf-700"><span>Diskon{b.promo_code && ` (${b.promo_code})`}</span><span>− {rupiah(b.discount)}</span></div>}
        <div className="flex justify-between font-bold"><span>Total</span><span>{rupiah(b.total)}</span></div>
        <div className="flex justify-between"><span>Sudah dibayar</span><span>{rupiah(paidOf(b))}</span></div>
        <div className="flex justify-between font-semibold"><span>Sisa</span><span>{rupiah(remaining(b))}</span></div>
      </div>
      {b.status === 'pending' && b.hold_expires_at && <p className="mt-3 rounded-lg bg-orange-50 p-3 text-xs text-orange-900">Slot ditahan sampai {b.hold_expires_at}. Bayar DP minimal {rupiah(b.dp_required)} sebelum waktu itu, atau booking batal otomatis.</p>}
      {b.cancel_reason && <p className="mt-3 text-xs text-slate-500">Alasan batal: {b.cancel_reason}</p>}
    </section>
  )
}

/** Cetak hanya invoice (A4). Class `print-invoice` memicu CSS cetak di index.css. */
export function printInvoice(b: Booking) { printDoc(`Invoice-${b.code}`) }

export function Invoice({ b }: { b: Booking }) {
  const d = useDB(); const s = d.settings; const court = courtOf(d, b.court_id)
  const paid = paidOf(b), sisa = remaining(b)
  const valid = b.payments.filter(p => p.status === 'valid')
  const dead = b.status === 'batal' || b.status === 'no_show'
  const lunas = sisa === 0 && !dead
  const stamp = dead ? STATUS_META[b.status].label.toUpperCase() : lunas ? 'LUNAS' : paid > 0 ? 'BELUM LUNAS' : 'BELUM DIBAYAR'
  const stampCls = dead ? 'border-slate-400 text-slate-500' : lunas ? 'border-emerald-600 text-emerald-700' : 'border-amber-600 text-amber-700'
  const invNo = 'INV-' + b.code.replace(/^BK-/, '')
  const dateRange = `${b.slots[0].start.slice(11)} – ${b.slots[b.slots.length - 1].end.slice(11)}`
  return (
    <div className="mx-auto w-full max-w-3xl">
      <article id="invoice" data-print-root className="overflow-hidden rounded-xl border border-slate-200 bg-white text-[13px] leading-relaxed text-slate-800 shadow-sm">
        <div className="h-2 bg-turf-700" />
        <div className="p-6 sm:p-9 print:p-2">
          {/* Kepala */}
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-turf-800">{s.business_name}</h2>
              <p className="mt-1 max-w-xs text-xs text-slate-500">{s.business_address}</p>
              <p className="text-xs text-slate-500">Telp. {s.business_phone}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black tracking-[0.2em] text-slate-800">INVOICE</p>
              <p className="mt-1 text-sm font-bold">{invNo}</p>
              <p className="text-xs text-slate-500">Diterbitkan {tglId(today(), false)}</p>
              <span className={cx('mt-2 inline-block -rotate-3 rounded border-2 px-3 py-0.5 text-sm font-extrabold tracking-widest', stampCls)}>{stamp}</span>
            </div>
          </header>

          {/* Pemesan & detail */}
          <section className="mt-7 grid gap-5 border-y border-slate-200 py-4 sm:grid-cols-2 print:mt-4 print:py-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ditagihkan kepada</p>
              <p className="mt-1 text-base font-bold">{b.customer_name}</p>
              <p className="text-slate-600">{b.phone}</p>
              {b.notes && <p className="mt-1 text-xs text-slate-500">Catatan: {b.notes}</p>}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
              <dt className="text-slate-500">Kode booking</dt><dd className="font-semibold">{b.code}</dd>
              <dt className="text-slate-500">Lapangan</dt><dd className="font-semibold">{court?.name ?? '-'}</dd>
              <dt className="text-slate-500">Tanggal main</dt><dd className="font-semibold">{tglId(b.date)}</dd>
              <dt className="text-slate-500">Jam</dt><dd className="font-semibold">{dateRange}</dd>
            </dl>
          </section>

          {/* Rincian */}
          <table className="mt-5 w-full border-collapse print:mt-3">
            <thead>
              <tr className="bg-slate-100 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th className="w-10 px-3 py-2">No</th><th className="px-3 py-2">Deskripsi</th><th className="px-3 py-2">Jam</th><th className="px-3 py-2 text-right">Harga</th>
              </tr>
            </thead>
            <tbody>
              {b.slots.map((sl, i) => (
                <tr key={sl.start} className="border-b border-slate-100 [break-inside:avoid]">
                  <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2">Sewa {court?.name} · {tglId(sl.start.split(' ')[0], false)}<span className="ml-1 text-xs text-slate-400">({sl.rule_type === 'peak' ? 'Peak' : 'Off-peak'})</span></td>
                  <td className="px-3 py-2">{sl.start.slice(11)} – {sl.end.slice(11)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rupiah(sl.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div className="mt-3 flex justify-end [break-inside:avoid]">
            <dl className="w-full max-w-xs space-y-1">
              <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{rupiah(b.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Diskon{b.promo_code && ` (${b.promo_code})`}</dt><dd className="tabular-nums">− {rupiah(b.discount)}</dd></div>
              <div className="flex justify-between border-t border-slate-300 pt-1.5 text-base font-extrabold"><dt>Total</dt><dd className="tabular-nums">{rupiah(b.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Sudah dibayar</dt><dd className="tabular-nums">{rupiah(paid)}</dd></div>
              <div className={cx('flex justify-between rounded px-2 py-1.5 font-bold', sisa === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900')}><dt>Sisa tagihan</dt><dd className="tabular-nums">{rupiah(sisa)}</dd></div>
            </dl>
          </div>

          {/* Riwayat pembayaran */}
          {valid.length > 0 && (
            <section className="mt-6 print:mt-4 [break-inside:avoid]">
              <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Riwayat pembayaran</h3>
              <table className="w-full border-collapse text-xs">
                <thead><tr className="border-b border-slate-300 text-left text-slate-500"><th className="py-1 pr-2 font-semibold">Tanggal</th><th className="py-1 pr-2 font-semibold">Metode</th><th className="py-1 pr-2 font-semibold">Keterangan</th><th className="py-1 text-right font-semibold">Jumlah</th></tr></thead>
                <tbody>
                  {valid.map((p, i) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-1 pr-2">{tglId(p.paid_at.split(' ')[0], false)} {p.paid_at.slice(11)}</td>
                      <td className="py-1 pr-2 capitalize">{p.method}{p.channel && ` · ${p.channel}`}</td>
                      <td className="py-1 pr-2">{i === 0 ? 'DP' : 'Pelunasan / cicilan'}{p.reference && ` · ${p.reference}`}</td>
                      <td className="py-1 text-right tabular-nums">{rupiah(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Ketentuan */}
          <section className="mt-6 print:mt-4 [break-inside:avoid]">
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Ketentuan & tata tertib</h3>
            <ol className="list-decimal space-y-0.5 pl-5 text-[11px] leading-snug text-slate-600">{s.terms.map((t, i) => <li key={i}>{t}</li>)}</ol>
          </section>

          <footer className="mt-7 print:mt-4 border-t border-slate-200 pt-3 text-center text-xs text-slate-500">
            <p className="font-semibold text-slate-700">{s.receipt_footer}</p>
            <p className="mt-0.5">Invoice ini dibuat otomatis oleh sistem dan sah tanpa tanda tangan.</p>
          </footer>
        </div>
      </article>
      <div className="mt-4 text-center print:hidden"><button className="btn-primary" onClick={() => printInvoice(b)}>Cetak / simpan PDF</button></div>
    </div>
  )
}

export function useAfterCreate(mode: FormMode) {
  const nav = useNavigate(); const toast = useToast()
  return (b: Booking) => {
    toast(`Booking ${b.code} dibuat.`)
    if (mode === 'admin') nav(`/admin/bookings/${b.id}`)
    else if (mode === 'member') nav(`/member/booking/${b.id}`)
    else { sessionStorage.setItem('spoert.unlock.' + b.code, '1'); nav(`/booking/${b.code}`) }
  }
}
