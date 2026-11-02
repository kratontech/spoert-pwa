import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useDB, useSession, setSession, resetDemo } from '../lib/store'
import { can } from '../lib/logic'
import { cx } from '../lib/util'
import type { PermissionKey, Role } from '../lib/types'

interface BIPEvent extends Event { prompt: () => Promise<void> }
export function useInstall() {
  const [ev, setEv] = useState<BIPEvent | null>(null)
  const [done, setDone] = useState(window.matchMedia('(display-mode: standalone)').matches)
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEv(e as BIPEvent) }
    const i = () => setDone(true)
    window.addEventListener('beforeinstallprompt', h); window.addEventListener('appinstalled', i)
    return () => { window.removeEventListener('beforeinstallprompt', h); window.removeEventListener('appinstalled', i) }
  }, [])
  return ev && !done ? async () => { await ev.prompt(); setEv(null) } : null
}

export function useTheme() {
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const n = !dark; setDark(n)
    document.documentElement.classList.toggle('dark', n)
    localStorage.setItem('spoert.theme', n ? 'dark' : 'light')
  }
  return { dark, toggle }
}

function Brand() {
  const d = useDB()
  return (
    <Link to="/" className="flex items-center gap-2.5 font-extrabold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-turf-700 text-white" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="1"/><path d="M12 6v12"/><circle cx="12" cy="12" r="2.5"/></svg>
      </span>
      <span className="leading-tight">{d.settings.business_name}<span className="block text-[10px] font-medium text-slate-500">SPOERT · demo</span></span>
    </Link>
  )
}

function TopActions() {
  const user = useSession(); const nav = useNavigate(); const install = useInstall(); const { dark, toggle } = useTheme()
  return (
    <div className="flex items-center gap-2">
      {install && <button onClick={install} className="btn-ghost !px-3 !py-1.5 text-xs">Pasang aplikasi</button>}
      <button onClick={toggle} className="btn-ghost !px-2.5 !py-1.5" aria-label="Ganti tema">{dark ? '☀' : '☾'}</button>
      {user ? (
        <>
          <Link to={user.role === 'member' ? '/member/booking' : '/admin'} className="btn-ghost !px-3 !py-1.5 text-xs">{user.role === 'member' ? 'Booking saya' : 'Admin'}</Link>
          <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => { setSession(null); nav('/') }}>Keluar</button>
        </>
      ) : <Link to="/login" className="btn-primary !px-3 !py-1.5 text-xs">Masuk</Link>}
    </div>
  )
}

export function PublicLayout() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <Brand />
          <nav className="hidden items-center gap-1 text-sm font-semibold sm:flex">
            {[['/', 'Jadwal'], ['/booking/cek', 'Cek booking']].map(([to, l]) => (
              <NavLink key={to} to={to} end className={({ isActive }) => cx('rounded-lg px-3 py-1.5', isActive ? 'bg-turf-100 text-turf-800 dark:bg-turf-900 dark:text-turf-100' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>{l}</NavLink>
            ))}
          </nav>
          <TopActions />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5"><Outlet /></main>
      <footer className="mx-auto max-w-6xl px-4 pb-24 pt-4 text-center text-xs text-slate-500">
        Versi demo: data hanya di memori, kembali ke awal saat di-refresh. <button className="underline" onClick={() => { if (confirm('Kembalikan semua data demo ke awal?')) resetDemo() }}>Reset data demo</button>
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-slate-200 bg-white text-center text-xs font-semibold sm:hidden dark:border-slate-800 dark:bg-slate-950" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <NavLink to="/" end className={({ isActive }) => cx('py-3', isActive ? 'text-turf-700' : 'text-slate-500')}>Jadwal</NavLink>
        <NavLink to="/booking/cek" className={({ isActive }) => cx('py-3', isActive ? 'text-turf-700' : 'text-slate-500')}>Cek booking</NavLink>
      </nav>
    </div>
  )
}

export function Guard({ roles, children }: { roles: Role[]; children?: ReactNode }) {
  const u = useSession()
  if (!u) return <Navigate to="/login" replace />
  if (!roles.includes(u.role)) return <Navigate to={u.role === 'member' ? '/member/booking' : '/admin'} replace />
  return <>{children ?? <Outlet />}</>
}
export function Perm({ p, children }: { p: PermissionKey; children: ReactNode }) {
  return can(useSession(), p) ? <>{children}</> : null
}

const ADMIN_NAV: { to: string; label: string; owner?: boolean; perm?: PermissionKey }[] = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/board', label: 'Booking Board' },
  { to: '/admin/bookings', label: 'Semua booking' },
  { to: '/admin/reports', label: 'Laporan' },
  { to: '/admin/members', label: 'Member', perm: 'member.manage' },
  { to: '/admin/courts', label: 'Lapangan', owner: true },
  { to: '/admin/blocks', label: 'Blokir jadwal', owner: true },
  { to: '/admin/pricing', label: 'Harga', owner: true },
  { to: '/admin/promos', label: 'Promo', owner: true },
  { to: '/admin/announcements', label: 'Pengumuman', owner: true },
  { to: '/admin/staff', label: 'Staf', owner: true },
  { to: '/admin/settings', label: 'Pengaturan', owner: true },
  { to: '/admin/access', label: 'Hak akses', owner: true },
  { to: '/admin/logs', label: 'Activity log', owner: true },
]

export function AdminLayout() {
  const u = useSession()!; const [open, setOpen] = useState(false)
  const items = ADMIN_NAV.filter(n => (!n.owner || u.role === 'owner') && (!n.perm || can(u, n.perm)))
  const list = (
    <nav className="flex flex-col gap-0.5 p-3">
      {items.map(n => (
        <NavLink key={n.to} to={n.to} end={n.to === '/admin'} onClick={() => setOpen(false)}
          className={({ isActive }) => cx('rounded-lg px-3 py-2 text-sm font-semibold', isActive ? 'bg-turf-700 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>{n.label}</NavLink>
      ))}
    </nav>
  )
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[230px_1fr]">
      <aside className="hidden border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
        <div className="p-4"><Brand /></div>{list}
      </aside>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)}><aside className="h-full w-64 bg-white dark:bg-slate-900" onClick={e => e.stopPropagation()}><div className="p-4"><Brand /></div>{list}</aside></div>}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90" style={{ paddingTop: 'calc(0.625rem + env(safe-area-inset-top))' }}>
          <button className="btn-ghost !px-2.5 !py-1.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu">☰</button>
          <span className="hidden text-sm text-slate-500 lg:block">{u.name} · {u.role}</span>
          <TopActions />
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  )
}
