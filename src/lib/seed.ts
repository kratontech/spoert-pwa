import type { DB, PricingRule, Booking } from './types'
import { addDays, today } from './util'

const TERMS = [
  'Segala kerusakan dan kehilangan barang pribadi penyewa/pemain/penonton, di luar tanggung jawab pihak pengelola lapangan.',
  'Dalam keadaan cuaca yang tidak mendukung bahkan membahayakan, maka pemain tidak dianjurkan berada di dalam lapangan.',
  'Kerusakan fasilitas lapangan/tribun akibat penyewa/pemain/penonton wajib diganti rugi.',
  'Dilarang bersandar, memanjat, dan menggantungi jaring gawang dan jaring keliling lapangan.',
  'Dilarang merokok di dalam lapangan.',
  'Dilarang membawa senjata tajam ketika memasuki area pengelolaan lapangan.',
  'Dilarang menggunakan sepatu dengan pul bagian bawah dari besi.',
  'Dilarang membawa makanan dan minuman selain air putih/mineral/isotonik ke dalam lapangan.',
  'Dilarang melontarkan kata-kata kasar atau unsur SARA yang menimbulkan keributan.',
  'Pengelola berhak menghentikan pertandingan dan mengusir pihak yang membuat keributan tanpa refund.',
  'Pemain dengan riwayat penyakit berat wajib memberitahu petugas lapangan.',
  'Jumlah pemain maksimal 9 vs 9, penonton berada di luar lapangan.',
]

export function makeSeed(): DB {
  const rules: PricingRule[] = []
  let rid = 1
  const all = [0, 1, 2, 3, 4, 5, 6]
  for (const courtId of [1, 2, 3]) {
    const futsal = courtId !== 3
    const weekendPeak = futsal
    rules.push({ id: rid++, court_id: courtId, category_id: null, days: all.filter(d => !(weekendPeak && (d === 0 || d === 6))), start: '08:00', end: '17:00', type: 'off_peak', price: futsal ? 150000 : 60000, is_active: true })
    if (weekendPeak) rules.push({ id: rid++, court_id: courtId, category_id: null, days: [0, 6], start: '08:00', end: '17:00', type: 'peak', price: 250000, is_active: true })
    rules.push({ id: rid++, court_id: courtId, category_id: null, days: all, start: '17:00', end: '23:00', type: 'peak', price: futsal ? 250000 : 90000, is_active: true })
  }
  const t = today()
  const mk = (id: number, code: string, court: number, who: string, phone: string, day: number, hours: string[], status: Booking['status'], paid: number, userId: number | null = null): Booking => {
    const date = addDays(t, day)
    const slots = hours.map(h => {
      const hh = Number(h.slice(0, 2)); const peak = hh >= 17 || (court !== 3 && [0, 6].includes(new Date(date).getDay()))
      const price = court === 3 ? (peak ? 90000 : 60000) : (peak ? 250000 : 150000)
      return { start: `${date} ${h}`, end: `${date} ${String(hh + 1).padStart(2, '0')}:00`, price, rule_type: peak ? 'peak' as const : 'off_peak' as const }
    })
    const total = slots.reduce((s, x) => s + x.price, 0)
    return {
      id, code, court_id: court, user_id: userId, customer_name: who, phone, notes: '', date, slots, status,
      subtotal: total, discount: 0, total, dp_required: Math.ceil(total * 0.3), promo_code: null,
      hold_expires_at: status === 'pending' ? `${t} 23:59` : null, created_at: `${t} 08:00`, created_by: 'Rina (Kasir)',
      payments: paid ? [{ id: id * 10, amount: paid, method: 'tunai', channel: '', reference: '', proof_name: null, proof_data: null, status: 'valid', paid_at: `${t} 08:05`, received_by: 'Rina (Kasir)' }] : [],
    }
  }
  const bookings = [
    mk(1, `BK-${t.replaceAll('-', '')}-0001`, 1, 'Tim Garuda', '081234567890', 0, ['19:00', '20:00'], 'dp', 150000),
    mk(2, `BK-${t.replaceAll('-', '')}-0002`, 2, 'Andi (Member)', '081200000003', 0, ['18:00'], 'pending', 0, 3),
    mk(3, `BK-${addDays(t, 1).replaceAll('-', '')}-0001`, 3, 'Sari', '081355577788', 1, ['17:00', '18:00'], 'lunas', 180000),
    mk(4, `BK-${addDays(t, 2).replaceAll('-', '')}-0001`, 1, 'Komunitas Jumat', '085211122233', 2, ['08:00', '09:00', '10:00'], 'lunas', 450000),
  ]
  return {
    v: 1, seq: 100,
    settings: {
      business_name: 'GOR Sport Center', business_address: 'Jl. Merdeka No. 1', business_phone: '021-1234567',
      open_time: '08:00', close_time: '23:00', slot_minutes: 60, min_dp_percent: 30, max_days_ahead: 30,
      dp_timeout_minutes: 60, cancel_limit_hours: 24, max_slots_per_booking: 6,
      receipt_footer: 'Terima kasih, selamat bermain!',
      banks: [{ bank: 'BRI', account: '0987654321', holder: 'GOR Sport Center' }, { bank: 'BCA', account: '1234567890', holder: 'GOR Sport Center' }],
      qris_note: 'Scan QRIS lewat aplikasi bank/e-wallet Anda, lalu simpan struknya sebagai bukti.',
      qris_image: null,
      terms: TERMS,
    },
    users: [
      { id: 1, name: 'Pak Budi (Owner)', email: 'owner@spoert.test', phone: '6281200000001', password: 'password', role: 'owner', is_active: true, permissions: null },
      { id: 2, name: 'Rina (Kasir)', email: 'kasir@spoert.test', phone: '6281200000002', password: 'password', role: 'kasir', is_active: true, permissions: ['booking.create', 'booking.edit', 'booking.cancel', 'booking.status', 'payment.record', 'payment.verify', 'member.manage'] },
      { id: 3, name: 'Andi (Member)', email: 'member@spoert.test', phone: '6281200000003', password: 'password', role: 'member', is_active: true, permissions: null },
    ],
    categories: [
      { id: 1, name: 'Futsal', description: 'Lapangan futsal rumput sintetis', is_active: true },
      { id: 2, name: 'Badminton', description: 'Lapangan badminton indoor', is_active: true },
    ],
    courts: [
      { id: 1, category_id: 1, name: 'Futsal A', description: 'Kapasitas 10 orang', status: 'tersedia', is_active: true },
      { id: 2, category_id: 1, name: 'Futsal B', description: 'Kapasitas 12 orang', status: 'tersedia', is_active: true },
      { id: 3, category_id: 2, name: 'Badminton 1', description: 'Karpet vinyl', status: 'tersedia', is_active: true },
    ],
    rules, blocks: [],
    promos: [
      { id: 1, title: 'Diskon Jam Pagi', badge: 'Diskon 20%', code: 'PAGI20', description: 'Main jam 08.00–11.00 Senin–Jumat. Semua lapangan.', discount_type: 'percent', discount_value: 20, valid_days: [1, 2, 3, 4, 5], valid_from: '08:00', valid_until: '11:00', starts_on: null, ends_on: null, min_total: 0, usage_limit: 0, once_per_customer: false, members_only: false, is_active: true },
      { id: 2, title: 'Member Baru', badge: 'Potongan Rp 25.000', code: 'WELCOME25', description: 'Khusus booking pertama member.', discount_type: 'nominal', discount_value: 25000, valid_days: [], valid_from: '', valid_until: '', starts_on: null, ends_on: null, min_total: 0, usage_limit: 0, once_per_customer: true, members_only: true, is_active: true },
      { id: 3, title: 'Paket 4x Main', badge: 'Gratis 1 jam', code: null, description: 'Booking 4 kali sebulan, dapat 1 jam gratis. Tanyakan ke kasir.', discount_type: null, discount_value: 0, valid_days: [], valid_from: '', valid_until: '', starts_on: null, ends_on: null, min_total: 0, usage_limit: 0, once_per_customer: false, members_only: false, is_active: true },
    ],
    announcements: [
      { id: 1, title: 'Buka setiap hari', body: 'GOR buka pukul 08.00–23.00, termasuk hari libur nasional.', level: 'info', starts_on: null, ends_on: null, is_active: true },
    ],
    bookings, logs: [],
  }
}
