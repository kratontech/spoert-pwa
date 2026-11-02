import { useEffect, useMemo, useState } from 'react'
import { cx } from '../lib/util'

export function usePaged<T>(items: T[], resetKey: string, initialSize = 10) {
  const [page, setPage] = useState(1); const [size, setSize] = useState(initialSize)
  useEffect(() => { setPage(1) }, [resetKey, size])
  const pages = Math.max(1, Math.ceil(items.length / size))
  const cur = Math.min(page, pages)
  const pageItems = useMemo(() => items.slice((cur - 1) * size, cur * size), [items, cur, size])
  return { page: cur, setPage, size, setSize, pages, pageItems, total: items.length, offset: (cur - 1) * size }
}

function windowPages(cur: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const s = new Set([1, pages, cur, cur - 1, cur + 1].filter(n => n >= 1 && n <= pages))
  const list = [...s].sort((a, b) => a - b); const out: (number | '…')[] = []
  list.forEach((n, i) => { if (i && n - list[i - 1] > 1) out.push('…'); out.push(n) })
  return out
}

export function Pagination({ p, sizes = [10, 25, 50, 100] }: { p: ReturnType<typeof usePaged>; sizes?: number[] }) {
  if (p.total === 0) return null
  const from = p.offset + 1, to = Math.min(p.offset + p.size, p.total)
  const btn = 'min-w-8 rounded-md border px-2 py-1 text-xs font-semibold tabular-nums transition disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
      <div className="flex items-center gap-2">
        <span>Menampilkan <b className="text-slate-700 dark:text-slate-200">{from.toLocaleString('id-ID')}–{to.toLocaleString('id-ID')}</b> dari <b className="text-slate-700 dark:text-slate-200">{p.total.toLocaleString('id-ID')}</b></span>
        <select aria-label="Baris per halaman" className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900" value={p.size} onChange={e => p.setSize(Number(e.target.value))}>
          {sizes.map(s => <option key={s} value={s}>{s} / hal</option>)}
        </select>
      </div>
      <nav className="flex items-center gap-1" aria-label="Halaman">
        <button className={cx(btn, 'border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900')} disabled={p.page <= 1} onClick={() => p.setPage(p.page - 1)}>‹ Prev</button>
        {windowPages(p.page, p.pages).map((n, i) => n === '…'
          ? <span key={'e' + i} className="px-1">…</span>
          : <button key={n} aria-current={n === p.page ? 'page' : undefined} onClick={() => p.setPage(n)}
              className={cx(btn, n === p.page ? 'border-turf-700 bg-turf-700 text-white' : 'border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900')}>{n}</button>)}
        <button className={cx(btn, 'border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900')} disabled={p.page >= p.pages} onClick={() => p.setPage(p.page + 1)}>Next ›</button>
      </nav>
    </div>
  )
}
