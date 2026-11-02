export type Role = 'owner' | 'kasir' | 'member'
export type BookingStatus = 'pending' | 'dp' | 'lunas' | 'selesai' | 'batal' | 'no_show'
export type PaymentStatus = 'valid' | 'pending' | 'void' | 'rejected'
export type PayMethod = 'tunai' | 'transfer' | 'qris' | 'kartu'
export type RuleType = 'peak' | 'off_peak'
export type PermissionKey =
  | 'booking.create' | 'booking.edit' | 'booking.cancel' | 'booking.status' | 'booking.discount'
  | 'payment.record' | 'payment.verify' | 'payment.void' | 'member.manage'

export interface User {
  id: number; name: string; email: string; phone: string; password: string
  role: Role; is_active: boolean; permissions: PermissionKey[] | null
}
export interface Category { id: number; name: string; description: string; is_active: boolean }
export interface Court {
  id: number; category_id: number; name: string; description: string
  status: 'tersedia' | 'maintenance'; is_active: boolean
}
export interface PricingRule {
  id: number; court_id: number | null; category_id: number | null
  days: number[]; start: string; end: string; type: RuleType; price: number; is_active: boolean
}
export interface Block { id: number; court_id: number; date: string; start: string; end: string; reason: string }
export interface Promo {
  id: number; title: string; badge: string; code: string | null; description: string
  discount_type: 'percent' | 'nominal' | null; discount_value: number
  valid_days: number[]; valid_from: string; valid_until: string
  starts_on: string | null; ends_on: string | null
  min_total: number; usage_limit: number; once_per_customer: boolean; members_only: boolean; is_active: boolean
}
export interface Announcement {
  id: number; title: string; body: string; level: 'info' | 'warning' | 'danger'
  starts_on: string | null; ends_on: string | null; is_active: boolean
}
export interface Slot { start: string; end: string; price: number; rule_type: RuleType } // "YYYY-MM-DD HH:mm"
export interface Payment {
  id: number; amount: number; method: PayMethod; channel: string; reference: string
  proof_name: string | null; proof_data: string | null
  status: PaymentStatus; paid_at: string; received_by: string; void_reason?: string
}
export interface Booking {
  id: number; code: string; court_id: number; user_id: number | null
  customer_name: string; phone: string; notes: string
  date: string; slots: Slot[]; status: BookingStatus
  subtotal: number; discount: number; total: number; dp_required: number
  promo_code: string | null; hold_expires_at: string | null
  cancel_reason?: string; ephemeral?: string /* id tab tamu pembuat; booking sementara */; created_at: string; created_by: string; payments: Payment[]
}
export interface LogEntry { id: number; at: string; user: string; action: string; object: string; detail: string }
export interface Settings {
  business_name: string; business_address: string; business_phone: string
  open_time: string; close_time: string; slot_minutes: number
  min_dp_percent: number; max_days_ahead: number; dp_timeout_minutes: number; cancel_limit_hours: number
  max_slots_per_booking: number; receipt_footer: string
  banks: { bank: string; account: string; holder: string }[]; qris_note: string; qris_image: string | null
  terms: string[]
}
export interface DB {
  v: number; seq: number
  settings: Settings; users: User[]; categories: Category[]; courts: Court[]
  rules: PricingRule[]; blocks: Block[]; promos: Promo[]; announcements: Announcement[]
  bookings: Booking[]; logs: LogEntry[]
}
