import { useEffect, useState } from 'react'
import { Field, Modal, useFormErrors } from './ui'
import { DAYS } from '../lib/util'

export interface FieldDef {
  key: string; label: string; hint?: string
  type: 'text' | 'number' | 'select' | 'textarea' | 'checkbox' | 'date' | 'time' | 'days' | 'password' | 'email'
  options?: { value: string; label: string }[]; required?: boolean
}
type Val = string | number | boolean | number[] | null
export type Values = Record<string, Val>

export function EditModal({ open, onClose, title, fields, initial, onSave }: {
  open: boolean; onClose: () => void; title: string; fields: FieldDef[]; initial: Values; onSave: (v: Values) => void
}) {
  const [v, setV] = useState<Values>(initial); const { errors, run } = useFormErrors()
  useEffect(() => { if (open) setV(initial) }, [open]) // eslint-disable-line
  const set = (k: string, val: Val) => setV(cur => ({ ...cur, [k]: val }))
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (run(() => { onSave(v); return true })) onClose() }
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-3">
        {fields.map(f => {
          const val = v[f.key]
          if (f.type === 'checkbox') return (
            <label key={f.key} className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-turf-700" checked={!!val} onChange={e => set(f.key, e.target.checked)} />{f.label}</label>
          )
          return (
            <Field key={f.key} label={f.label} hint={f.hint} error={errors[f.key]}>
              {f.type === 'textarea' ? <textarea className="input" rows={3} value={String(val ?? '')} onChange={e => set(f.key, e.target.value)} />
                : f.type === 'select' ? <select className="input" value={String(val ?? '')} onChange={e => set(f.key, e.target.value)}>{f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                : f.type === 'days' ? (
                  <div className="flex flex-wrap gap-1.5">{DAYS.map((n, i) => {
                    const arr = (val as number[]) ?? []; const on = arr.includes(i)
                    return <button type="button" key={n} aria-pressed={on} onClick={() => set(f.key, on ? arr.filter(x => x !== i) : [...arr, i].sort())}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${on ? 'border-turf-700 bg-turf-700 text-white' : 'border-slate-300 dark:border-slate-700'}`}>{n.slice(0, 3)}</button>
                  })}</div>)
                : <input className="input" type={f.type} value={String(val ?? '')} required={f.required}
                    onChange={e => set(f.key, f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />}
            </Field>
          )
        })}
        <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={onClose}>Batal</button><button className="btn-primary">Simpan</button></div>
      </form>
    </Modal>
  )
}
