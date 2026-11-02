/** Cetak satu dokumen saja (elemen ber-atribut data-print-root). Tema gelap dimatikan sementara. */
export function printDoc(title: string, onDone?: () => void) {
  const root = document.documentElement, body = document.body
  const wasDark = root.classList.contains('dark'), oldTitle = document.title
  body.classList.add('print-doc'); root.classList.remove('dark'); document.title = title
  const done = () => {
    body.classList.remove('print-doc'); if (wasDark) root.classList.add('dark')
    document.title = oldTitle; window.removeEventListener('afterprint', done); onDone?.()
  }
  window.addEventListener('afterprint', done)
  window.print()
}
