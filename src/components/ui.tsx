import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AppError, STATUS_META } from '../lib/logic'
import type { BookingStatus, PaymentStatus } from '../lib/types'
import { cx } from '../lib/util'

export function Badge({ status }: { status: BookingStatus }) {
  const m = STATUS_META[status]
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', m.cls)}>{m.label}</span>
}
export function PayBadge({ status }: { status: PaymentStatus }) {
  const map = { valid: ['Valid', 'bg-emerald-100 text-emerald-800'], pending: ['Menunggu verifikasi', 'bg-amber-100 text-amber-800'], void: ['Void', 'bg-gray-200 text-gray-600'], rejected: ['Ditolak', 'bg-red-100 text-red-800'] } as const
  return <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', map[status][1])}>{map[status][0]}</span>
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}

/** Input nominal rupiah: prefix "Rp", pemisah ribuan otomatis (150000 -> 150.000), dan tombol nominal cepat. */
export function RupiahInput({ value, onChange, options, autoFocus, required }: {
  value: string; onChange: (digits: string) => void; options?: { value: number; label?: string }[]; autoFocus?: boolean; required?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null); const digitsBefore = useRef<number | null>(null)
  const text = value ? Number(value).toLocaleString('id-ID') : ''
  // jaga posisi kursor saat titik ribuan ditambahkan/dihapus
  useLayoutEffect(() => {
    const el = ref.current; const n = digitsBefore.current; digitsBefore.current = null
    if (!el || n === null || document.activeElement !== el) return
    let pos = 0, seen = 0
    while (pos < text.length && seen < n) { if (/\d/.test(text[pos])) seen++; pos++ }
    el.setSelectionRange(pos, pos)
  }, [text])
  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate-500">Rp</span>
        <input ref={ref} className="input pl-10 tabular-nums" inputMode="numeric" autoComplete="off" placeholder="0" value={text} autoFocus={autoFocus} required={required}
          onChange={e => {
            const el = e.target; const caret = el.selectionStart ?? el.value.length
            digitsBefore.current = el.value.slice(0, caret).replace(/\D/g, '').length
            onChange(el.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10))
          }} />
      </div>
      {!!options?.length && (
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map(o => {
            const on = Number(value) === o.value
            return (
              <button type="button" key={o.value} onClick={() => onChange(String(o.value))} aria-pressed={on}
                className={cx('rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition', on ? 'border-turf-700 bg-turf-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-turf-600 hover:bg-turf-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800')}>
                {o.value.toLocaleString('id-ID')}{o.label && <span className={cx('ml-1 font-medium', on ? 'text-white/80' : 'text-slate-500')}>· {o.label}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function PageTitle({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h1>{sub && <p className="mt-0.5 text-sm text-slate-500">{sub}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">{children}</div>
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 sm:rounded-b-xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Tutup">✕</button></div>
        {children}
      </div>
    </div>
  )
}

type Toast = { id: number; text: string; kind: 'ok' | 'err' }
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'err') => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const push = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random()
    setList(l => [...l, { id, text, kind }])
    setTimeout(() => setList(l => l.filter(t => t.id !== id)), 4500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3" aria-live="polite">
        {list.map(t => <div key={t.id} className={cx('pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg', t.kind === 'ok' ? 'bg-turf-700' : 'bg-red-600')}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}

/** Jalankan aksi yang bisa melempar AppError; tampilkan toast bila gagal. */
export function useAction() {
  const toast = useToast()
  return useCallback(<T,>(fn: () => T, okMsg?: string): T | undefined => {
    try { const r = fn(); if (okMsg) toast(okMsg); return r }
    catch (e) { toast(e instanceof Error ? e.message : 'Terjadi kesalahan', 'err'); return undefined }
  }, [toast])
}

/** Untuk form: simpan error per kolom. */
export function useFormErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const run = <T,>(fn: () => T): T | undefined => {
    try { setErrors({}); return fn() }
    catch (e) { if (e instanceof AppError) setErrors({ [e.field]: e.message }); else throw e; return undefined }
  }
  return { errors, run, setErrors }
}

export function Confirm({ open, onClose, onConfirm, title, text, askReason, danger = true, okLabel = 'Ya, lanjutkan' }: {
  open: boolean; onClose: () => void; onConfirm: (reason: string) => void; title: string; text?: string; askReason?: string; danger?: boolean; okLabel?: string
}) {
  const [reason, setReason] = useState('')
  useEffect(() => { if (open) setReason('') }, [open])
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {text && <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{text}</p>}
      {askReason && <Field label={askReason}><textarea className="input" rows={2} value={reason} onChange={e => setReason(e.target.value)} autoFocus /></Field>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Batal</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={() => onConfirm(reason)}>{okLabel}</button>
      </div>
    </Modal>
  )
}

export type TableHead = string | { label: ReactNode; key?: string; right?: boolean; className?: string }
export function Table({ head, children, foot }: { head: TableHead[]; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="card overflow-x-auto"><table className="w-full">
      <thead className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40"><tr>{head.map((h, i) => {
        const o = typeof h === 'string' ? { label: h } as Exclude<TableHead, string> : h
        return <th key={o.key ?? (typeof o.label === 'string' ? o.label : i)} className={cx('th whitespace-nowrap', o.right && 'text-right', o.className)}>{o.label}</th>
      })}</tr></thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
      {foot && <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold dark:border-slate-700 dark:bg-slate-800/50">{foot}</tfoot>}
    </table></div>
  )
}

/* Filter tanggal opsional: tampil placeholder saat kosong & tombol hapus saat terisi (supaya bisa kembali ke "semua") */
export function DateFilter({ value, onChange, placeholder = 'Semua tanggal' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <input type="date" className={cx('input', !value && 'date-empty')} value={value} onChange={e => onChange(e.target.value)} aria-label={placeholder} />
      {!value && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">{placeholder}</span>}
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Hapus filter tanggal"
          className="absolute right-9 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      )}
    </div>
  )
}
