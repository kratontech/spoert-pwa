import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Invoice, BookingSummary, PaymentList, ProofUpload } from '../components/BookingParts'
import { Field, useFormErrors } from '../components/ui'
import { AppError } from '../lib/logic'
import { getDB, keepAlive, useDB } from '../lib/store'
import { normPhone } from '../lib/util'

const key = (code: string) => 'spoert.unlock.' + code

export function CheckBookingPage() {
  const nav = useNavigate(); const [sp] = useSearchParams(); const { errors, run } = useFormErrors()
  const [code, setCode] = useState(sp.get('code') ?? ''); const [phone, setPhone] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(() => {
      const c = code.trim().toUpperCase()
      const b = getDB().bookings.find(x => x.code === c)
      if (!b || normPhone(b.phone) !== normPhone(phone)) throw new AppError('Kode booking atau no. HP tidak cocok.', 'code')
      sessionStorage.setItem(key(b.code), '1'); nav(`/booking/${b.code}`)
    })
  }
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl font-extrabold">Cek booking</h1>
      <p className="mb-4 text-sm text-slate-500">Masukkan kode booking dan no. HP yang dipakai saat memesan.</p>
      <form onSubmit={submit} className="card space-y-4 p-5">
        <Field label="Kode booking" error={errors.code}><input className="input uppercase" value={code} onChange={e => setCode(e.target.value)} placeholder="BK-20261030-0001" required /></Field>
        <Field label="No. HP"><input className="input" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} required /></Field>
        <button className="btn-primary w-full">Buka booking</button>
      </form>
    </div>
  )
}

export function GuestBookingPage() {
  const { code = '' } = useParams(); const d = useDB(); const [showInvoice, setShowInvoice] = useState(false)
  useEffect(() => keepAlive(code), [code])
  const b = d.bookings.find(x => x.code === code)
  if (!b) return <div className="card p-6 text-center">Booking tidak ditemukan. <Link className="underline" to="/booking/cek">Cek lagi</Link></div>
  if (sessionStorage.getItem(key(code)) !== '1') return <Navigate to={`/booking/cek?code=${code}`} replace />
  const invoiceReady = b.payments.some(p => p.status === 'valid')
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BookingSummary b={b} />
      <ProofUpload booking={b} actor={`Tamu: ${b.customer_name}`} />
      <section className="card p-5"><h2 className="mb-2 font-bold">Pembayaran</h2><PaymentList booking={b} /></section>
      {invoiceReady && <button className="btn-ghost" onClick={() => setShowInvoice(v => !v)}>{showInvoice ? 'Sembunyikan invoice' : 'Lihat invoice'}</button>}
      {showInvoice && <Invoice b={b} />}
      <Link to="/" className="block text-center text-sm font-semibold text-turf-700 underline">Kembali ke jadwal</Link>
    </div>
  )
}
