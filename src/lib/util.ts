export const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export const today = () => ymd(new Date())
export const addDays = (date: string, n: number) => { const d = parse(date); d.setDate(d.getDate() + n); return ymd(d) }
export const parse = (s: string) => {
  const [dp, tp] = s.split(' ')
  const [y, m, d] = dp.split('-').map(Number)
  const [h, mi] = (tp ?? '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, h, mi, 0, 0)
}
export const nowStr = () => `${ymd(new Date())} ${hm(new Date())}`
export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export const fromMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
export const dow = (date: string) => parse(date).getDay() // 0=Min .. 6=Sab
export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
export const tglId = (date: string, withDay = true) => {
  const d = parse(date)
  return `${withDay ? DAYS[d.getDay()] + ', ' : ''}${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
export const normPhone = (p: string) => p.replace(/\D/g, '').replace(/^0/, '62')
export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')
export const addMinutesStr = (s: string, min: number) => { const d = parse(s); d.setMinutes(d.getMinutes() + min); return `${ymd(d)} ${hm(d)}` }
