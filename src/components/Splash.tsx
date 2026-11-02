import { useEffect } from 'react'

/**
 * Splash screen layar penuh yang tampil sesaat setelah login berhasil.
 * Memanggil onDone setelah `duration` ms (default 1800).
 */
export function Splash({ name, subtitle = 'Menyiapkan akun kamu…', duration = 1800, onDone }: {
  name?: string; subtitle?: string; duration?: number; onDone: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDone, duration)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div role="status" aria-live="polite" aria-label="Sedang masuk"
      className="splash-bg fixed inset-0 z-[80] flex flex-col items-center justify-center px-6 text-white">
      <div className="splash-pop relative">
        <span className="splash-ring absolute inset-0 rounded-[28px]" aria-hidden />
        <svg viewBox="0 0 512 512" className="relative h-28 w-28 drop-shadow-xl" aria-hidden>
          <rect width="512" height="512" rx="96" fill="#17632f" />
          <g fill="none" stroke="#fff" strokeWidth="16" strokeLinecap="round">
            <rect className="splash-draw" x="96" y="136" width="320" height="240" rx="12" />
            <line className="splash-draw" x1="256" y1="136" x2="256" y2="376" />
            <circle className="splash-draw" cx="256" cy="256" r="48" />
          </g>
          <circle className="splash-ball" cx="256" cy="256" r="14" fill="#fff" />
        </svg>
      </div>

      <h1 className="splash-fade mt-6 text-2xl font-extrabold tracking-tight">GOR Sport Center</h1>
      {name && <p className="splash-fade mt-1 text-sm font-semibold text-turf-200" style={{ animationDelay: '.25s' }}>Halo, {name}!</p>}
      <p className="splash-fade mt-1 text-sm text-white/70" style={{ animationDelay: '.4s' }}>{subtitle}</p>

      <div className="mt-8 h-1.5 w-48 overflow-hidden rounded-full bg-white/15" aria-hidden>
        <div className="splash-bar h-full rounded-full bg-turf-200" style={{ animationDuration: `${duration}ms` }} />
      </div>
    </div>
  )
}
