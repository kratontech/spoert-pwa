import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Splash } from '../components/Splash'
import { Field, useFormErrors } from '../components/ui'
import { AppError, log, nextId } from '../lib/logic'
import { getDB, mutate, setSession } from '../lib/store'
import { normPhone } from '../lib/util'

export function LoginPage() {
  const nav = useNavigate(); const { errors, run } = useFormErrors()
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('')
  const [splash, setSplash] = useState<{ id: number; name: string; to: string } | null>(null)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (splash) return
    run(() => {
      const u = getDB().users.find(x => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === pw)
      if (!u) throw new AppError('Email atau password salah.', 'email')
      if (!u.is_active) throw new AppError('Akun ini dinonaktifkan.', 'email')
      // sesi baru dibuat setelah splash selesai
      setSplash({ id: u.id, name: u.name, to: u.role === 'member' ? '/member/booking' : '/admin' })
    })
  }
  return (
    <div className="mx-auto max-w-sm">
      {splash && <Splash name={splash.name} onDone={() => { setSession(splash.id); nav(splash.to) }} />}
      <h1 className="mb-4 text-2xl font-extrabold">Masuk</h1>
      <form onSubmit={submit} className="card space-y-4 p-5">
        <Field label="Email" error={errors.email}><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></Field>
        <Field label="Password"><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} required /></Field>
        <button className="btn-primary w-full" disabled={!!splash}>Masuk</button>
        <p className="text-center text-sm">Belum punya akun? <Link to="/register" className="font-semibold text-turf-700 underline">Daftar member</Link></p>
      </form>
      <div className="card mt-4 p-4 text-sm">
        <p className="mb-2 font-semibold">Akun demo (password: <code>password</code>)</p>
        {[['owner@spoert.test', 'Owner'], ['kasir@spoert.test', 'Kasir'], ['member@spoert.test', 'Member']].map(([m, r]) => (
          <button key={m} type="button" onClick={() => { setEmail(m); setPw('password') }} className="mr-2 mt-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">{r}</button>
        ))}
      </div>
    </div>
  )
}

export function RegisterPage() {
  const nav = useNavigate(); const { errors, run } = useFormErrors()
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(() => {
      const id = mutate(d => {
        if (d.users.some(u => u.email.toLowerCase() === f.email.trim().toLowerCase())) throw new AppError('Email sudah terdaftar.', 'email')
        if (normPhone(f.phone).length < 9) throw new AppError('No. HP tidak valid.', 'phone')
        if (f.password.length < 8) throw new AppError('Password minimal 8 karakter.', 'password')
        const u = { id: nextId(d), name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), password: f.password, role: 'member' as const, is_active: true, permissions: null }
        d.users.push(u); log(d, u.name, 'member.registered', u.email); return u.id
      })
      setSession(id); nav('/member/booking')
    })
  }
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-extrabold">Daftar member</h1>
      <form onSubmit={submit} className="card space-y-4 p-5">
        <Field label="Nama"><input className="input" value={f.name} onChange={set('name')} required /></Field>
        <Field label="Email" error={errors.email}><input className="input" type="email" value={f.email} onChange={set('email')} required /></Field>
        <Field label="No. HP" error={errors.phone}><input className="input" inputMode="tel" value={f.phone} onChange={set('phone')} required /></Field>
        <Field label="Password" error={errors.password} hint="Minimal 8 karakter."><input className="input" type="password" value={f.password} onChange={set('password')} required /></Field>
        <button className="btn-primary w-full">Daftar</button>
        <p className="text-center text-sm">Sudah punya akun? <Link to="/login" className="font-semibold text-turf-700 underline">Masuk</Link></p>
      </form>
    </div>
  )
}
