import { useState } from 'react'
import { Pagination, usePaged } from '../../components/Pagination'
import { EditModal, type FieldDef, type Values } from '../../components/EditModal'
import { readProof } from '../../components/BookingParts'
import { Empty, Field, PageTitle, Table, useFormErrors, useToast } from '../../components/ui'
import { ALL_PERMISSIONS, AppError, KASIR_DEFAULTS, can, log, nextId } from '../../lib/logic'
import { mutate, resetDemo, useDB, useSession } from '../../lib/store'
import type { PermissionKey, Role, User } from '../../lib/types'
import { normPhone } from '../../lib/util'

function UserTable({ role, title, sub }: { role: Role; title: string; sub: string }) {
  const d = useDB(); const me = useSession()!; const [edit, setEdit] = useState<User | 'new' | null>(null)
  const list = d.users.filter(u => (role === 'member' ? u.role === 'member' : u.role !== 'member'))
  const fields: FieldDef[] = [
    { key: 'name', label: 'Nama', type: 'text', required: true }, { key: 'email', label: 'Email', type: 'email', required: true },
    { key: 'phone', label: 'No. HP', type: 'text', required: true },
    { key: 'password', label: edit === 'new' ? 'Password' : 'Password baru (kosongkan bila tidak diubah)', type: 'password' },
    ...(role !== 'member' ? [{ key: 'role', label: 'Peran', type: 'select' as const, options: [{ value: 'kasir', label: 'Kasir' }, { value: 'owner', label: 'Owner' }] }] : []),
    { key: 'is_active', label: 'Aktif', type: 'checkbox' },
  ]
  return (
    <div>
      <PageTitle title={title} sub={sub} actions={<button className="btn-primary" onClick={() => setEdit('new')}>Tambah</button>} />
      <Table head={['Nama', 'Kontak', ...(role === 'member' ? ['Booking'] : ['Peran']), 'Status', '']}>
        {list.map(u => (
          <tr key={u.id}><td className="td font-semibold">{u.name}</td><td className="td">{u.email}<div className="text-xs text-slate-500">{u.phone}</div></td>
            <td className="td">{role === 'member' ? d.bookings.filter(b => b.user_id === u.id).length : u.role}</td>
            <td className="td">{u.is_active ? <span className="font-semibold text-turf-700">Aktif</span> : <span className="text-slate-400">Nonaktif</span>}</td>
            <td className="td text-right"><button className="text-xs font-semibold text-turf-700 underline" onClick={() => setEdit(u)}>Ubah</button></td></tr>
        ))}
      </Table>
      <EditModal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Tambah akun' : 'Ubah akun'} fields={fields}
        initial={edit && edit !== 'new' ? { ...edit, password: '' } as Values : { name: '', email: '', phone: '', password: '', role: 'kasir', is_active: true }}
        onSave={v => mutate(db => {
          const self = edit !== 'new' && edit ? edit.id : -1
          if (db.users.some(u => u.id !== self && u.email.toLowerCase() === String(v.email).trim().toLowerCase())) throw new AppError('Email sudah terdaftar.', 'email')
          if (normPhone(String(v.phone)).length < 9) throw new AppError('No. HP tidak valid.', 'phone')
          if (self === -1 && String(v.password).length < 8) throw new AppError('Password minimal 8 karakter.', 'password')
          if (self === me.id && !v.is_active) throw new AppError('Anda tidak bisa menonaktifkan akun sendiri.', 'is_active')
          const base = { name: String(v.name).trim(), email: String(v.email).trim(), phone: String(v.phone).trim(), is_active: !!v.is_active, role: (role === 'member' ? 'member' : v.role) as Role }
          if (self === -1) { db.users.push({ id: nextId(db), ...base, password: String(v.password), permissions: null }); log(db, me.name, 'user.created', base.email) }
          else { const u = db.users.find(x => x.id === self)!; Object.assign(u, base); if (v.password) u.password = String(v.password); log(db, me.name, 'user.updated', base.email) }
        })} />
    </div>
  )
}
export function Members() { return can(useSession(), 'member.manage') ? <UserTable role="member" title="Member" sub="Daftarkan dan kelola akun member." /> : <Empty>Tidak ada akses.</Empty> }
export function Staff() { return <UserTable role="kasir" title="Staf" sub="Akun Owner dan Kasir. Hanya Owner yang bisa membuat akun staf." /> }

export function Settings() {
  const d = useDB(); const u = useSession()!; const toast = useToast(); const { errors, run, setErrors } = useFormErrors()
  const [s, setS] = useState({ ...d.settings, termsText: d.settings.terms.join('\n'), banksText: d.settings.banks.map(b => `${b.bank}|${b.account}|${b.holder}`).join('\n') })
  const set = (k: string, num = false) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setS({ ...s, [k]: num ? Number(e.target.value) : e.target.value })
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    run(() => {
      if (s.close_time <= s.open_time) throw new AppError('Jam tutup harus setelah jam buka (demo ini belum mendukung tutup lewat tengah malam).', 'close_time')
      if (s.min_dp_percent < 0 || s.min_dp_percent > 100) throw new AppError('DP antara 0 dan 100 persen.', 'min_dp_percent')
      mutate(db => {
        const { termsText, banksText, ...rest } = s
        db.settings = { ...rest, terms: termsText.split('\n').map(x => x.trim()).filter(Boolean),
          banks: banksText.split('\n').map(l => l.split('|').map(x => x.trim())).filter(p => p[0] && p[1]).map(p => ({ bank: p[0], account: p[1], holder: p[2] ?? '' })) }
        log(db, u.name, 'settings.updated', 'Pengaturan usaha')
      })
      toast('Pengaturan disimpan.')
    })
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <PageTitle title="Pengaturan" actions={<button className="btn-primary">Simpan</button>} />
      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">Profil usaha</h2>
        <Field label="Nama usaha"><input className="input" value={s.business_name} onChange={set('business_name')} /></Field>
        <Field label="Telepon"><input className="input" value={s.business_phone} onChange={set('business_phone')} /></Field>
        <div className="sm:col-span-2"><Field label="Alamat"><input className="input" value={s.business_address} onChange={set('business_address')} /></Field></div>
        <div className="sm:col-span-2"><Field label="Footer struk"><input className="input" value={s.receipt_footer} onChange={set('receipt_footer')} /></Field></div>
      </section>
      <section className="card grid gap-4 p-5 sm:grid-cols-3">
        <h2 className="font-bold sm:col-span-3">Operasional & booking</h2>
        <Field label="Jam buka"><input type="time" className="input" value={s.open_time} onChange={set('open_time')} /></Field>
        <Field label="Jam tutup" error={errors.close_time}><input type="time" className="input" value={s.close_time} onChange={set('close_time')} /></Field>
        <Field label="Durasi slot"><select className="input" value={s.slot_minutes} onChange={set('slot_minutes', true)}><option value={60}>60 menit</option><option value={120}>120 menit</option></select></Field>
        <Field label="Minimal DP (%)" error={errors.min_dp_percent}><input type="number" className="input" value={s.min_dp_percent} onChange={set('min_dp_percent', true)} /></Field>
        <Field label="Batas hari booking ke depan"><input type="number" className="input" value={s.max_days_ahead} onChange={set('max_days_ahead', true)} /></Field>
        <Field label="Batas bayar DP (menit)"><input type="number" className="input" value={s.dp_timeout_minutes} onChange={set('dp_timeout_minutes', true)} /></Field>
        <Field label="Batas pembatalan (jam sebelum main)"><input type="number" className="input" value={s.cancel_limit_hours} onChange={set('cancel_limit_hours', true)} /></Field>
        <Field label="Maks. jam per booking"><input type="number" className="input" value={s.max_slots_per_booking} onChange={set('max_slots_per_booking', true)} /></Field>
      </section>
      <section className="card space-y-4 p-5">
        <h2 className="font-bold">Pembayaran & ketentuan</h2>
        <Field label="Rekening bank" hint="Satu per baris, format: Bank|No. rekening|Atas nama"><textarea className="input font-mono text-xs" rows={4} value={s.banksText} onChange={set('banksText')} /></Field>
        <Field label="Gambar QRIS statis" error={errors.qris_image} hint="Unggah gambar QRIS toko (PNG/JPG, maks. 1,5 MB). Ditampilkan ke pelanggan saat memilih metode QRIS.">
          <div className="space-y-2">
            {s.qris_image && (
              <div className="flex items-start gap-3">
                <img src={s.qris_image} alt="Pratinjau QRIS" className="h-40 w-40 rounded-lg border border-slate-200 bg-white object-contain p-1" />
                <button type="button" className="btn-ghost" onClick={() => setS({ ...s, qris_image: null })}>Hapus gambar</button>
              </div>
            )}
            <input type="file" accept="image/*" className="input" onChange={async e => {
              const f = e.target.files?.[0]; e.target.value = ''
              if (!f) return
              try { const r = await readProof(f); setErrors({}); setS(cur => ({ ...cur, qris_image: r.data })) }
              catch (err) { setErrors({ qris_image: (err as Error).message }) }
            }} />
          </div>
        </Field>
        <Field label="Catatan QRIS"><input className="input" value={s.qris_note} onChange={set('qris_note')} /></Field>
        <Field label="Ketentuan & tata tertib (satu per baris)"><textarea className="input" rows={6} value={s.termsText} onChange={set('termsText')} /></Field>
      </section>
      <section className="card p-5"><h2 className="font-bold">Data demo</h2><p className="mb-3 text-sm text-slate-500">Semua perubahan hanya di memori dan otomatis kembali ke data contoh saat halaman di-refresh. Reset ini mengembalikannya sekarang di semua tab.</p>
        <button type="button" className="btn-danger" onClick={() => { if (confirm('Hapus semua perubahan dan kembali ke data contoh?')) { resetDemo(); location.href = '/' } }}>Reset data demo</button></section>
    </form>
  )
}

export function Access() {
  const d = useDB(); const u = useSession()!; const toast = useToast()
  const kasir = d.users.filter(x => x.role === 'kasir')
  const toggle = (id: number, key: PermissionKey) => mutate(db => {
    const k = db.users.find(x => x.id === id)!; const cur = k.permissions ?? KASIR_DEFAULTS
    k.permissions = cur.includes(key) ? cur.filter(x => x !== key) : [...cur, key]
    log(db, u.name, 'access.updated', k.email, key); toast('Hak akses diperbarui.')
  })
  const groups = [...new Set(ALL_PERMISSIONS.map(p => p.group))]
  return (
    <div>
      <PageTitle title="Hak akses kasir" sub="Owner selalu punya semua hak. Atur apa saja yang boleh dilakukan tiap kasir." />
      {!kasir.length ? <Empty>Belum ada akun kasir.</Empty> : (
        <div className="space-y-4">{kasir.map(k => { const cur = k.permissions ?? KASIR_DEFAULTS; return (
          <section key={k.id} className="card p-5"><h2 className="mb-3 font-bold">{k.name}</h2>
            {groups.map(g => (<div key={g} className="mb-2"><p className="mb-1 text-xs font-semibold text-slate-500">{g}</p><div className="grid gap-1 sm:grid-cols-2">
              {ALL_PERMISSIONS.filter(p => p.group === g).map(p => (<label key={p.key} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-turf-700" checked={cur.includes(p.key)} onChange={() => toggle(k.id, p.key)} />{p.label}</label>))}
            </div></div>))}
          </section>) })}</div>
      )}
    </div>
  )
}

export function Logs() {
  const d = useDB(); const [q, setQ] = useState('')
  const list = d.logs.filter(l => !q || (l.action + l.object + l.user + l.detail).toLowerCase().includes(q.toLowerCase()))
  const pg = usePaged(list, q, 25)
  return (
    <div>
      <PageTitle title="Activity log" sub="Jejak perubahan finansial dan konfigurasi. Tidak bisa diedit atau dihapus." />
      <input className="input mb-3 max-w-sm" placeholder="Cari aksi / objek / pengguna" value={q} onChange={e => setQ(e.target.value)} />
      {!list.length ? <Empty>Belum ada aktivitas tercatat.</Empty> : (
        <Table head={['Waktu', 'Pengguna', 'Aksi', 'Objek', 'Detail']}>
          {pg.pageItems.map(l => (<tr key={l.id}><td className="td whitespace-nowrap text-xs">{l.at}</td><td className="td">{l.user}</td><td className="td"><code className="text-xs">{l.action}</code></td><td className="td">{l.object}</td><td className="td text-xs text-slate-500">{l.detail}</td></tr>))}
        </Table>
      )}
      <Pagination p={pg} />
    </div>
  )
}
