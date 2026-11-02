import { Route, Routes } from 'react-router-dom'
import { AdminLayout, Guard, PublicLayout } from './components/Layout'
import { ToastProvider } from './components/ui'
import BoardPage from './pages/BoardPage'
import BookingFormPage from './pages/BookingFormPage'
import { CheckBookingPage, GuestBookingPage } from './pages/GuestPages'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import { MemberBookingDetail, MemberBookings } from './pages/member/MemberPages'
import Dashboard from './pages/admin/Dashboard'
import { BookingDetail, BookingsList, NewBooking } from './pages/admin/Bookings'
import { Announcements, Blocks, Courts, Pricing, Promos } from './pages/admin/Catalog'
import { Access, Logs, Members, Settings, Staff } from './pages/admin/Manage'
import Reports from './pages/admin/Reports'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<BoardPage />} />
          <Route path="/booking" element={<BookingFormPage mode="public" />} />
          <Route path="/booking/cek" element={<CheckBookingPage />} />
          <Route path="/booking/:code" element={<GuestBookingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<Guard roles={['member']} />}>
            <Route path="/member/booking" element={<MemberBookings />} />
            <Route path="/member/booking/baru" element={<BookingFormPage mode="member" />} />
            <Route path="/member/booking/:id" element={<MemberBookingDetail />} />
          </Route>
        </Route>
        <Route path="/admin" element={<Guard roles={['owner', 'kasir']}><AdminLayout /></Guard>}>
          <Route index element={<Dashboard />} />
          <Route path="board" element={<BoardPage admin />} />
          <Route path="bookings" element={<BookingsList />} />
          <Route path="bookings/baru" element={<NewBooking />} />
          <Route path="bookings/:id" element={<BookingDetail />} />
          <Route path="members" element={<Members />} />
          <Route path="reports" element={<Reports />} />
          <Route element={<Guard roles={['owner']} />}>
            <Route path="courts" element={<Courts />} />
            <Route path="blocks" element={<Blocks />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="promos" element={<Promos />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="staff" element={<Staff />} />
            <Route path="settings" element={<Settings />} />
            <Route path="access" element={<Access />} />
            <Route path="logs" element={<Logs />} />
          </Route>
        </Route>
        <Route path="*" element={<div className="p-10 text-center">Halaman tidak ditemukan.</div>} />
      </Routes>
    </ToastProvider>
  )
}
