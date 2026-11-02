import { BookingForm, useAfterCreate, type FormMode } from '../components/BookingParts'
import { PageTitle } from '../components/ui'
import { useSession } from '../lib/store'

export default function BookingFormPage({ mode }: { mode: FormMode }) {
  const u = useSession(); const done = useAfterCreate(mode)
  return (<div><PageTitle title="Data pemesan" sub="Periksa jam yang dipilih, lalu isi data Anda." /><BookingForm mode={mode} user={u} onDone={done} /></div>)
}
