import { CalendarDays } from 'lucide-react'
import { CabeceraPagina } from '@/components/public/cabecera-pagina'
import { EventosList } from '@/components/public/eventos/eventos-list'

export const metadata = {
  title: 'Eventos Programados',
  description: 'Listado de eventos activos del Grupo de Gestión para la Productividad y la Competitividad.',
}

export default function EventosPage() {
  return (
    <div className="flex flex-col">
      <CabeceraPagina
        icono={CalendarDays}
        titulo="Eventos programados"
        descripcion="Socializaciones, capacitaciones y jornadas que desarrolla el Grupo de Gestión para la Productividad y la Competitividad en las convocatorias vigentes."
      />

      <div className="mx-auto w-full max-w-5xl px-6 pb-14 pt-2">
        <EventosList />
      </div>
    </div>
  )
}
