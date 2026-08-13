import { CalendarDays } from 'lucide-react'
import { EventosList } from '@/components/public/eventos/eventos-list'

export const metadata = {
  title: 'Eventos Programados',
  description: 'Listado de eventos activos del Grupo de Gestión para la Productividad y la Competitividad.',
}

export default function EventosPage() {
  return (
    <div className="flex flex-col">
      {/* Barra de título — mismo estilo que Certificados */}
      <div
        className="w-full flex items-center gap-3 px-6 py-4 text-white font-semibold text-lg shadow-md"
        style={{ backgroundColor: '#00304D' }}
      >
        <CalendarDays size={22} className="flex-shrink-0" />
        Eventos Programados - SEP
      </div>

      {/* Contenido */}
      <div className="max-w-5xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
        {/* Descripción */}
        <p className="text-base text-neutral-700 text-justify">
          A continuación, encontrará el listado de eventos activos que desarrolla el Grupo de Gestión
          para la Productividad y la Competitividad en las diferentes convocatorias vigentes.
        </p>

        {/* Listado */}
        <EventosList />
      </div>
    </div>
  )
}
