// Dimuat lazy (dynamic import) supaya jsPDF & penulis xlsx tidak membebani halaman awal.
import type { Report } from './report'
import { METHOD_LABEL, PAY_STATUS_LABEL, fileBase } from './report'
import { STATUS_META } from './logic'
import { rupiah } from './util'

export interface ExportMeta { business: string; title: string; period: string; filters: string; printedBy: string; printedAt: string }
const num = (n: number) => n.toLocaleString('id-ID')
const dash = (n: number) => (n ? num(n) : '–')
/** Judul, isi, dan footer kolom angka sama-sama rata kanan. */
const alignRight = (cols: number[]) => ({ didParseCell: (d: { column: { index: number }; cell: { styles: { halign?: string } } }) => { if (cols.includes(d.column.index)) d.cell.styles.halign = 'right' } })

function save(blob: Blob, name: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export async function exportPdf(r: Report, m: ExportMeta, detail: Report['rows']) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(m.business, 14, 15)
  doc.setFontSize(11); doc.text(m.title.toUpperCase(), W - 14, 15, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90)
  doc.text(`Periode: ${m.period}`, 14, 21); doc.text(m.filters, 14, 26)
  doc.text(`Dicetak ${m.printedAt} oleh ${m.printedBy}`, W - 14, 21, { align: 'right' })
  doc.setTextColor(0)

  autoTable(doc, {
    startY: 31, theme: 'grid', styles: { fontSize: 9, cellPadding: 2 }, headStyles: { fillColor: [23, 99, 47] },
    head: [['Uang masuk', 'Transaksi valid', 'Rata-rata / transaksi', 'Void', 'Menunggu verifikasi', 'Piutang (sisa tagihan)']],
    body: [[rupiah(r.total), num(r.count), rupiah(r.avg), `${rupiah(r.voided)} (${r.voidCount})`, `${rupiah(r.pending)} (${r.pendingCount})`, rupiah(r.piutang)]],
  })
  type LastTable = { lastAutoTable?: { finalY: number } }
  let y = ((doc as unknown as LastTable).lastAutoTable?.finalY ?? 40) + 6

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Lifecycle booking (berdasarkan tanggal main)', 14, y)
  autoTable(doc, {
    startY: y + 2, theme: 'striped', styles: { fontSize: 8.5, cellPadding: 1.8 }, headStyles: { fillColor: [23, 99, 47] },
    head: [['Status', 'Jumlah booking', 'Total tagihan', 'Sudah dibayar', 'Sisa tagihan']],
    body: r.lifecycle.map(l => [STATUS_META[l.status].label, num(l.count), rupiah(l.total), rupiah(l.paid), rupiah(l.remaining)]),
    ...alignRight([1, 2, 3, 4]),
  })
  y = ((doc as unknown as LastTable).lastAutoTable?.finalY ?? y) + 8

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Rekap uang masuk per periode', 14, y)
  autoTable(doc, {
    startY: y + 2, theme: 'striped', styles: { fontSize: 8.5, cellPadding: 1.8 }, headStyles: { fillColor: [23, 99, 47] }, footStyles: { fillColor: [232, 240, 234], textColor: 0, fontStyle: 'bold' },
    head: [['Periode', 'Transaksi', 'Tunai', 'Transfer', 'QRIS', 'Kartu', 'Total']],
    body: r.buckets.map(b => [b.label, num(b.count), dash(b.tunai), dash(b.transfer), dash(b.qris), dash(b.kartu), dash(b.total)]),
    foot: [['TOTAL', num(r.count), num(r.buckets.reduce((s, b) => s + b.tunai, 0)), num(r.buckets.reduce((s, b) => s + b.transfer, 0)), num(r.buckets.reduce((s, b) => s + b.qris, 0)), num(r.buckets.reduce((s, b) => s + b.kartu, 0)), num(r.total)]],
    ...alignRight([1, 2, 3, 4, 5, 6]), showFoot: 'lastPage',
  })
  doc.addPage()
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(`Rincian transaksi (${num(detail.length)})`, 14, 14)
  const total = detail.filter(x => x.status === 'valid').reduce((s, x) => s + x.amount, 0)
  autoTable(doc, {
    startY: 17, theme: 'striped', styles: { fontSize: 8, cellPadding: 1.6, overflow: 'linebreak' }, headStyles: { fillColor: [23, 99, 47] }, footStyles: { fillColor: [232, 240, 234], textColor: 0, fontStyle: 'bold' },
    head: [['Tanggal', 'Kode booking', 'Pelanggan', 'Lapangan', 'Metode', 'Diterima oleh', 'Status', 'Jumlah (Rp)']],
    body: detail.map(x => [x.at, x.code, `${x.customer}\n${x.phone}`, x.court, METHOD_LABEL[x.method] + (x.channel ? ` · ${x.channel}` : ''), x.receiver, PAY_STATUS_LABEL[x.status], num(x.amount)]),
    foot: [[{ content: 'Total transaksi valid pada daftar ini', colSpan: 7 }, num(total)]], showFoot: 'lastPage',
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 36 } }, ...alignRight([7]),
  })
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.text(`Halaman ${i} / ${n}`, W - 14, doc.internal.pageSize.getHeight() - 6, { align: 'right' }); doc.text(m.business, 14, doc.internal.pageSize.getHeight() - 6) }
  doc.save(fileBase(r) + '.pdf')
}

export async function exportXlsx(r: Report, m: ExportMeta, detail: Report['rows']) {
  const { default: writeExcelFile } = await import('write-excel-file/universal')
  const head = (v: string, right = false) => ({ value: v, fontWeight: 'bold' as const, backgroundColor: '#17632f', textColor: '#ffffff', align: right ? 'right' as const : 'left' as const })
  const N = (v: number, bold = false) => ({ value: v, type: Number, format: '#,##0', ...(bold ? { fontWeight: 'bold' as const } : {}) })
  const B = (v: string) => ({ value: v, fontWeight: 'bold' as const })

  const ringkasan = [
    [B(m.business)], [B(m.title)], ['Periode', m.period], ['Filter', m.filters], ['Dicetak', `${m.printedAt} oleh ${m.printedBy}`], [],
    [head('Ringkasan'), head('Nilai', true)],
    ['Uang masuk (valid)', N(r.total, true)], ['Jumlah transaksi valid', N(r.count)], ['Rata-rata per transaksi', N(r.avg)],
    ['Void (nominal)', N(r.voided)], ['Menunggu verifikasi (nominal)', N(r.pending)], ['Piutang (sisa tagihan)', N(r.piutang)], [],
    [head('Lifecycle booking (tgl main)'), head('Jumlah', true), head('Total tagihan', true), head('Sudah dibayar', true), head('Sisa tagihan', true)],
    ...r.lifecycle.map(l => [STATUS_META[l.status].label, N(l.count), N(l.total), N(l.paid), N(l.remaining)]),
  ]
  const sum = (k: 'tunai' | 'transfer' | 'qris' | 'kartu') => r.buckets.reduce((s, b) => s + b[k], 0)
  const rekap = [
    [head('Periode'), head('Transaksi', true), head('Tunai', true), head('Transfer', true), head('QRIS', true), head('Kartu', true), head('Total', true)],
    ...r.buckets.map(b => [b.label, N(b.count), N(b.tunai), N(b.transfer), N(b.qris), N(b.kartu), N(b.total)]),
    [B('TOTAL'), N(r.count, true), N(sum('tunai'), true), N(sum('transfer'), true), N(sum('qris'), true), N(sum('kartu'), true), N(r.total, true)],
  ]
  const rincian = [
    [head('Tanggal'), head('Kode booking'), head('Pelanggan'), head('No. HP'), head('Lapangan'), head('Metode'), head('Kanal / referensi'), head('Diterima oleh'), head('Status'), head('Jumlah (Rp)', true)],
    ...detail.map(x => [x.at, x.code, x.customer, x.phone, x.court, METHOD_LABEL[x.method], [x.channel, x.reference].filter(Boolean).join(' · '), x.receiver, PAY_STATUS_LABEL[x.status], N(x.amount)]),
  ]
  const blob = await writeExcelFile([
    { data: ringkasan as never, sheet: 'Ringkasan', columns: [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }] },
    { data: rekap as never, sheet: 'Rekap', columns: [{ width: 24 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 18 }], stickyRowsCount: 1 },
    { data: rincian as never, sheet: 'Rincian', columns: [{ width: 17 }, { width: 22 }, { width: 22 }, { width: 16 }, { width: 14 }, { width: 12 }, { width: 22 }, { width: 18 }, { width: 18 }, { width: 16 }], stickyRowsCount: 1 },
  ]).toBlob()
  save(blob, fileBase(r) + '.xlsx')
}
