import { useState } from 'react'
import { EditModal, type FieldDef, type Values } from '../../components/EditModal'
import { Confirm, Empty, PageTitle, Table, useAction } from '../../components/ui'
import { AppError, log, nextId } from '../../lib/logic'
import { mutate, useDB, useSession } from '../../lib/store'
import type { Announcement, Block, Court, PricingRule, Promo } from '../../lib/types'
import { DAYS, rupiah, tglId } from '../../lib/util'

const yesNo = (v: boolean) => (v ? <span className="font-semibold text-turf-700">Aktif</span> : <span className="text-slate-400">Nonaktif</span>)
const actions = (onEdit: () => void, onDel: () => void) => (
  <td className="td whitespace-nowrap text-right"><button className="mr-3 text-xs font-semibold text-turf-700 underline" onClick={onEdit}>Ubah</button><button className="text-xs font-semibold text-red-600 underline" onClick={onDel}>Hapus</button></td>
)
const req = (v: unknown, msg: string, field: string) => { if (v === '' || v == null) throw new AppError(msg, field) }

// ---------- Lapangan & kategori ----------
export function Courts() {
  const d = useDB(); const u = useSession()!; const act = useAction()
  const [edit, setEdit] = useState<Court | 'new' | null>(null); const [del, setDel] = useState<Court | null>(null)
  const [catEdit, setCatEdit] = useState(false)
  const fields: FieldDef[] = [
    { key: 'name', label: 'Nama lapangan', type: 'text', required: true },
    { key: 'category_id', label: 'Kategori', type: 'select', options: d.categories.map(c => ({ value: String(c.id), label: c.name })) },
    { key: 'description', label: 'Deskripsi', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: [{ value: 'tersedia', label: 'Tersedia' }, { value: 'maintenance', label: 'Maintenance' }] },
    { key: 'is_active', label: 'Aktif', type: 'checkbox' },
  ]
  const init = (c?: Court): Values => c ? { ...c, category_id: String(c.category_id) } : { name: '', category_id: String(d.categories[0]?.id ?? ''), description: '', status: 'tersedia', is_active: true }
  return (
    <div>
      <PageTitle title="Lapangan" actions={<><button className="btn-ghost" onClick={() => setCatEdit(true)}>Tambah kategori</button><button className="btn-primary" onClick={() => setEdit('new')}>Tambah lapangan</button></>} />
      <Table head={['Nama', 'Kategori', 'Status', '']}>
        {d.courts.map(c => (
          <tr key={c.id}><td className="td font-semibold">{c.name}<div className="text-xs font-normal text-slate-500">{c.description}</div></td>
            <td className="td">{d.categories.find(x => x.id === c.category_id)?.name}</td>
            <td className="td">{c.is_active ? (c.status === 'tersedia' ? yesNo(true) : <span className="text-amber-600">Maintenance</span>) : yesNo(false)}</td>
            {actions(() => setEdit(c), () => setDel(c))}</tr>
        ))}
      </Table>
      <EditModal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Tambah lapangan' : 'Ubah lapangan'} fields={fields} initial={init(edit && edit !== 'new' ? edit : undefined)}
        onSave={v => mutate(db => {
          req(String(v.name).trim(), 'Nama wajib diisi.', 'name')
          const data = { name: String(v.name).trim(), category_id: Number(v.category_id), description: String(v.description), status: v.status as Court['status'], is_active: !!v.is_active }
          if (edit === 'new') db.courts.push({ id: nextId(db), ...data }); else Object.assign(db.courts.find(c => c.id === (edit as Court).id)!, data)
          log(db, u.name, 'court.saved', data.name)
        })} />
      <EditModal open={catEdit} onClose={() => setCatEdit(false)} title="Tambah kategori" fields={[{ key: 'name', label: 'Nama kategori', type: 'text', required: true }, { key: 'description', label: 'Deskripsi', type: 'text' }]} initial={{ name: '', description: '' }}
        onSave={v => mutate(db => { db.categories.push({ id: nextId(db), name: String(v.name).trim(), description: String(v.description), is_active: true }); log(db, u.name, 'category.created', String(v.name)) })} />
      <Confirm open={!!del} onClose={() => setDel(null)} title="Hapus lapangan?" text={del && d.bookings.some(b => b.court_id === del.id) ? 'Lapangan ini punya riwayat booking, jadi hanya dinonaktifkan.' : 'Lapangan dihapus permanen.'}
        onConfirm={() => { act(() => mutate(db => { const c = db.courts.find(x => x.id === del!.id)!; if (db.bookings.some(b => b.court_id === c.id)) c.is_active = false; else { db.courts = db.courts.filter(x => x.id !== c.id); db.rules = db.rules.filter(r => r.court_id !== c.id) } log(db, u.name, 'court.deleted', c.name) }), 'Lapangan diperbarui.'); setDel(null) }} />
    </div>
  )
}

// ---------- Blokir jadwal ----------
export function Blocks() {
  const d = useDB(); const u = useSession()!; const [open, setOpen] = useState(false)
  const fields: FieldDef[] = [
    { key: 'court_id', label: 'Lapangan', type: 'select', options: d.courts.map(c => ({ value: String(c.id), label: c.name })) },
    { key: 'date', label: 'Tanggal', type: 'date', required: true }, { key: 'start', label: 'Mulai', type: 'time', required: true },
    { key: 'end', label: 'Selesai', type: 'time', required: true }, { key: 'reason', label: 'Alasan', type: 'text', required: true },
  ]
  return (
    <div>
      <PageTitle title="Blokir jadwal" sub="Jam yang diblokir tidak bisa dibooking." actions={<button className="btn-primary" onClick={() => setOpen(true)}>Tambah blokir</button>} />
      {!d.blocks.length ? <Empty>Belum ada jadwal yang diblokir.</Empty> : (
        <Table head={['Lapangan', 'Tanggal', 'Jam', 'Alasan', '']}>
          {[...d.blocks].sort((a, b) => a.date.localeCompare(b.date)).map((b: Block) => (
            <tr key={b.id}><td className="td font-semibold">{d.courts.find(c => c.id === b.court_id)?.name}</td><td className="td">{tglId(b.date)}</td><td className="td">{b.start}–{b.end}</td><td className="td">{b.reason}</td>
              <td className="td text-right"><button className="text-xs font-semibold text-red-600 underline" onClick={() => mutate(db => { db.blocks = db.blocks.filter(x => x.id !== b.id); log(db, u.name, 'block.deleted', b.reason) })}>Hapus</button></td></tr>
          ))}
        </Table>
      )}
      <EditModal open={open} onClose={() => setOpen(false)} title="Tambah blokir" fields={fields} initial={{ court_id: String(d.courts[0]?.id ?? ''), date: '', start: '08:00', end: '12:00', reason: '' }}
        onSave={v => mutate(db => {
          if (String(v.end) <= String(v.start)) throw new AppError('Jam selesai harus setelah jam mulai.', 'end')
          const cid = Number(v.court_id), date = String(v.date)
          const clash = db.bookings.find(b => b.court_id === cid && b.date === date && !['batal', 'no_show'].includes(b.status) && b.slots.some(s => s.start.slice(11) < String(v.end) && s.end.slice(11) > String(v.start)))
          if (clash) throw new AppError(`Bentrok dengan booking ${clash.code}. Batalkan booking itu dulu.`, 'start')
          db.blocks.push({ id: nextId(db), court_id: cid, date, start: String(v.start), end: String(v.end), reason: String(v.reason) }); log(db, u.name, 'block.created', String(v.reason))
        })} />
    </div>
  )
}

// ---------- Harga ----------
export function Pricing() {
  const d = useDB(); const u = useSession()!; const [edit, setEdit] = useState<PricingRule | 'new' | null>(null)
  const target = [...d.courts.map(c => ({ value: `c${c.id}`, label: c.name })), ...d.categories.map(c => ({ value: `k${c.id}`, label: `Semua lapangan ${c.name}` }))]
  const fields: FieldDef[] = [
    { key: 'target', label: 'Berlaku untuk', type: 'select', options: target }, { key: 'days', label: 'Hari', type: 'days' },
    { key: 'start', label: 'Mulai', type: 'time', required: true }, { key: 'end', label: 'Selesai', type: 'time', required: true },
    { key: 'type', label: 'Tipe', type: 'select', options: [{ value: 'off_peak', label: 'Off-peak' }, { value: 'peak', label: 'Peak' }] },
    { key: 'price', label: 'Harga per jam (Rp)', type: 'number', required: true }, { key: 'is_active', label: 'Aktif', type: 'checkbox' },
  ]
  const label = (r: PricingRule) => r.court_id ? d.courts.find(c => c.id === r.court_id)?.name : `Semua ${d.categories.find(c => c.id === r.category_id)?.name}`
  const sorted = [...d.rules].sort((a, b) => String(label(a)).localeCompare(String(label(b))) || a.start.localeCompare(b.start))
  return (
    <div>
      <PageTitle title="Aturan harga" sub="Harga dihitung per jam dan disimpan permanen di booking saat dibuat." actions={<button className="btn-primary" onClick={() => setEdit('new')}>Tambah aturan</button>} />
      <Table head={['Untuk', 'Hari', 'Jam', 'Tipe', 'Harga', 'Status', '']}>
        {sorted.map(r => (
          <tr key={r.id}><td className="td font-semibold">{label(r)}</td>
            <td className="td text-xs">{r.days.length === 7 ? 'Setiap hari' : r.days.map(x => DAYS[x].slice(0, 3)).join(', ')}</td>
            <td className="td tabular-nums">{r.start}–{r.end}</td><td className="td">{r.type === 'peak' ? 'Peak' : 'Off-peak'}</td><td className="td tabular-nums">{rupiah(r.price)}</td><td className="td">{yesNo(r.is_active)}</td>
            {actions(() => setEdit(r), () => mutate(db => { db.rules = db.rules.filter(x => x.id !== r.id); log(db, u.name, 'pricing.deleted', String(label(r))) }))}</tr>
        ))}
      </Table>
      <EditModal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Tambah aturan harga' : 'Ubah aturan harga'} fields={fields}
        initial={edit && edit !== 'new' ? { ...edit, target: edit.court_id ? `c${edit.court_id}` : `k${edit.category_id}` } : { target: target[0]?.value ?? '', days: [1, 2, 3, 4, 5], start: '08:00', end: '17:00', type: 'off_peak', price: 100000, is_active: true }}
        onSave={v => mutate(db => {
          const days = v.days as number[]
          if (!days.length) throw new AppError('Pilih minimal satu hari.', 'days')
          if (String(v.end) <= String(v.start)) throw new AppError('Jam selesai harus setelah jam mulai.', 'end')
          if (!(Number(v.price) > 0)) throw new AppError('Harga harus lebih dari 0.', 'price')
          const t = String(v.target), court_id = t[0] === 'c' ? Number(t.slice(1)) : null, category_id = t[0] === 'k' ? Number(t.slice(1)) : null
          const self = edit !== 'new' && edit ? edit.id : -1
          // validasi overlap pada lapangan/kategori & hari yang sama
          const clash = db.rules.find(r => r.id !== self && r.is_active && r.court_id === court_id && r.category_id === category_id && r.days.some(x => days.includes(x)) && r.start < String(v.end) && r.end > String(v.start))
          if (clash && v.is_active) throw new AppError(`Bentrok dengan aturan ${clash.start}–${clash.end} yang sudah ada.`, 'start')
          const data = { court_id, category_id, days, start: String(v.start), end: String(v.end), type: v.type as PricingRule['type'], price: Number(v.price), is_active: !!v.is_active }
          if (edit === 'new') db.rules.push({ id: nextId(db), ...data }); else Object.assign(db.rules.find(r => r.id === self)!, data)
          log(db, u.name, 'pricing.saved', `${data.start}–${data.end} ${rupiah(data.price)}`)
        })} />
    </div>
  )
}

// ---------- Promo ----------
export function Promos() {
  const d = useDB(); const u = useSession()!; const [edit, setEdit] = useState<Promo | 'new' | null>(null)
  const fields: FieldDef[] = [
    { key: 'title', label: 'Judul', type: 'text', required: true }, { key: 'badge', label: 'Label singkat', type: 'text' }, { key: 'description', label: 'Deskripsi', type: 'textarea' },
    { key: 'code', label: 'Kode promo', type: 'text', hint: 'Kosongkan bila promo hanya informasi (tunjukkan ke kasir).' },
    { key: 'discount_type', label: 'Jenis potongan', type: 'select', options: [{ value: '', label: 'Tidak ada' }, { value: 'percent', label: 'Persen' }, { value: 'nominal', label: 'Nominal (Rp)' }] },
    { key: 'discount_value', label: 'Nilai potongan', type: 'number' }, { key: 'valid_days', label: 'Hari berlaku (kosong = semua)', type: 'days' },
    { key: 'valid_from', label: 'Jam main mulai', type: 'time' }, { key: 'valid_until', label: 'Jam main sampai', type: 'time' },
    { key: 'starts_on', label: 'Berlaku dari', type: 'date' }, { key: 'ends_on', label: 'Berlaku sampai', type: 'date' },
    { key: 'min_total', label: 'Minimal tagihan (Rp)', type: 'number' }, { key: 'usage_limit', label: 'Kuota pemakaian (0 = tak terbatas)', type: 'number' },
    { key: 'once_per_customer', label: 'Satu kali per pelanggan', type: 'checkbox' }, { key: 'members_only', label: 'Khusus member', type: 'checkbox' }, { key: 'is_active', label: 'Aktif', type: 'checkbox' },
  ]
  // hari promo disimpan ISO 1-7 (Senin-Minggu); form memakai 0-6 (Minggu-Sabtu)
  const toForm = (p: Promo): Values => ({ ...p, valid_days: p.valid_days.map(x => x % 7) })
  return (
    <div>
      <PageTitle title="Promo" actions={<button className="btn-primary" onClick={() => setEdit('new')}>Tambah promo</button>} />
      <Table head={['Promo', 'Kode', 'Potongan', 'Pemakaian', 'Status', '']}>
        {d.promos.map(p => (
          <tr key={p.id}><td className="td font-semibold">{p.title}<div className="text-xs font-normal text-slate-500">{p.badge}</div></td><td className="td"><code>{p.code ?? '—'}</code>{p.members_only && <div className="text-xs text-slate-500">khusus member</div>}</td>
            <td className="td">{p.discount_type === 'percent' ? `${p.discount_value}%` : p.discount_type === 'nominal' ? rupiah(p.discount_value) : '—'}</td>
            <td className="td">{p.code ? d.bookings.filter(b => b.promo_code === p.code && !['batal', 'no_show'].includes(b.status)).length : '—'}{p.usage_limit ? ` / ${p.usage_limit}` : ''}</td><td className="td">{yesNo(p.is_active)}</td>
            {actions(() => setEdit(p), () => mutate(db => { db.promos = db.promos.filter(x => x.id !== p.id); log(db, u.name, 'promo.deleted', p.title) }))}</tr>
        ))}
      </Table>
      <EditModal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Tambah promo' : 'Ubah promo'} fields={fields}
        initial={edit && edit !== 'new' ? toForm(edit) : { title: '', badge: '', description: '', code: '', discount_type: '', discount_value: 0, valid_days: [], valid_from: '', valid_until: '', starts_on: '', ends_on: '', min_total: 0, usage_limit: 0, once_per_customer: false, members_only: false, is_active: true }}
        onSave={v => mutate(db => {
          const code = String(v.code ?? '').trim().toUpperCase() || null, self = edit !== 'new' && edit ? edit.id : -1
          if (code && db.promos.some(p => p.id !== self && p.code === code)) throw new AppError('Kode sudah dipakai promo lain.', 'code')
          const dt = (v.discount_type || null) as Promo['discount_type']
          if (code && dt && !(Number(v.discount_value) > 0)) throw new AppError('Isi nilai potongan.', 'discount_value')
          if (dt === 'percent' && Number(v.discount_value) > 100) throw new AppError('Persen maksimal 100.', 'discount_value')
          const data: Omit<Promo, 'id'> = { title: String(v.title).trim(), badge: String(v.badge), description: String(v.description), code, discount_type: dt, discount_value: Number(v.discount_value) || 0,
            valid_days: (v.valid_days as number[]).map(x => x || 7), valid_from: String(v.valid_from ?? ''), valid_until: String(v.valid_until ?? ''), starts_on: String(v.starts_on || '') || null, ends_on: String(v.ends_on || '') || null,
            min_total: Number(v.min_total) || 0, usage_limit: Number(v.usage_limit) || 0, once_per_customer: !!v.once_per_customer, members_only: !!v.members_only, is_active: !!v.is_active }
          if (edit === 'new') db.promos.push({ id: nextId(db), ...data }); else Object.assign(db.promos.find(p => p.id === self)!, data)
          log(db, u.name, 'promo.saved', data.title)
        })} />
    </div>
  )
}

// ---------- Pengumuman ----------
export function Announcements() {
  const d = useDB(); const u = useSession()!; const [edit, setEdit] = useState<Announcement | 'new' | null>(null)
  const fields: FieldDef[] = [
    { key: 'title', label: 'Judul', type: 'text', required: true }, { key: 'body', label: 'Isi', type: 'textarea' },
    { key: 'level', label: 'Tingkat', type: 'select', options: [{ value: 'info', label: 'Info' }, { value: 'warning', label: 'Peringatan' }, { value: 'danger', label: 'Penting' }] },
    { key: 'starts_on', label: 'Tampil dari', type: 'date' }, { key: 'ends_on', label: 'Tampil sampai', type: 'date' }, { key: 'is_active', label: 'Aktif', type: 'checkbox' },
  ]
  return (
    <div>
      <PageTitle title="Pengumuman" sub="Tampil di atas jadwal untuk semua pengunjung." actions={<button className="btn-primary" onClick={() => setEdit('new')}>Tambah pengumuman</button>} />
      {!d.announcements.length ? <Empty>Belum ada pengumuman.</Empty> : (
        <Table head={['Judul', 'Tingkat', 'Periode', 'Status', '']}>
          {d.announcements.map(a => (
            <tr key={a.id}><td className="td font-semibold">{a.title}<div className="text-xs font-normal text-slate-500">{a.body}</div></td><td className="td">{a.level}</td><td className="td text-xs">{a.starts_on ?? '…'} s/d {a.ends_on ?? '…'}</td><td className="td">{yesNo(a.is_active)}</td>
              {actions(() => setEdit(a), () => mutate(db => { db.announcements = db.announcements.filter(x => x.id !== a.id); log(db, u.name, 'announcement.deleted', a.title) }))}</tr>
          ))}
        </Table>
      )}
      <EditModal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Tambah pengumuman' : 'Ubah pengumuman'} fields={fields}
        initial={edit && edit !== 'new' ? { ...edit, starts_on: edit.starts_on ?? '', ends_on: edit.ends_on ?? '' } : { title: '', body: '', level: 'info', starts_on: '', ends_on: '', is_active: true }}
        onSave={v => mutate(db => {
          const data = { title: String(v.title).trim(), body: String(v.body), level: v.level as Announcement['level'], starts_on: String(v.starts_on || '') || null, ends_on: String(v.ends_on || '') || null, is_active: !!v.is_active }
          if (edit === 'new') db.announcements.push({ id: nextId(db), ...data }); else Object.assign(db.announcements.find(a => a.id === (edit as Announcement).id)!, data)
          log(db, u.name, 'announcement.saved', data.title)
        })} />
    </div>
  )
}
