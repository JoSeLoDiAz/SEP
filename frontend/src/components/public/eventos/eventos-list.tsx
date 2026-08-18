'use client'

import { useEffect, useState } from 'react'
import { CalendarX, ClipboardCheck, Loader2, ServerCrash } from 'lucide-react'
import type { Evento } from '@/types'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const abierto = (ev: Evento) => Boolean(ev.eventoActivo && ev.eventoVisible)

function Estado({ ev }: { ev: Evento }) {
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
        abierto(ev) ? 'bg-lime-50 text-green-700' : 'bg-neutral-100 text-neutral-500',
      )}
    >
      {abierto(ev) ? 'Inscripciones abiertas' : 'Cerrado'}
    </span>
  )
}

function BotonInscribirse({ ev }: { ev: Evento }) {
  if (!abierto(ev)) return <span className="text-[12px] text-neutral-400">No disponible</span>
  return (
    <a
      href={`/eventos/${ev.eventoId}/registrar`}
      className="inline-flex items-center gap-1.5 rounded-lg bg-lime-500 px-4 py-2 text-[13px] font-bold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
    >
      <ClipboardCheck size={14} aria-hidden="true" />
      Inscribirme
    </a>
  )
}

function Marco({ icono, titulo, detalle }: { icono: React.ReactNode; titulo: string; detalle: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
      {icono}
      <p className="mt-3 text-sm font-semibold text-neutral-600">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-400">{detalle}</p>
    </div>
  )
}

export function EventosList() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    let vivo = true
    api.get<Evento[]>('/eventos')
      .then(({ data }) => { if (vivo) setEventos(data) })
      .catch(() => { if (vivo) setFallo(true) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [])

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Cargando eventos…
      </div>
    )
  }

  if (fallo) {
    return (
      <Marco
        icono={<ServerCrash size={30} className="mx-auto text-neutral-300" aria-hidden="true" />}
        titulo="El listado no está disponible"
        detalle="No pudimos consultar los eventos en este momento. Intenta de nuevo más tarde."
      />
    )
  }

  if (!eventos.length) {
    return (
      <Marco
        icono={<CalendarX size={30} className="mx-auto text-neutral-300" aria-hidden="true" />}
        titulo="No hay eventos programados"
        detalle="Cuando el GGPC publique un nuevo evento, aparecerá aquí."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* movil: tarjetas. la tabla de 4 columnas no cabe en un telefono */}
      <ul className="flex flex-col gap-3 lg:hidden">
        {eventos.map(ev => (
          <li key={ev.eventoId} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <Estado ev={ev} />
            <p className="mt-2 text-[14px] font-semibold leading-snug text-cerulean-500">{ev.eventoNombre}</p>
            <p className="mt-1 text-[12px] text-neutral-500">
              {fecha(ev.eventoFechaInicio)} — {fecha(ev.eventoFechaFin)}
            </p>
            <div className="mt-3">
              <BotonInscribirse ev={ev} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 lg:block">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Eventos programados</caption>
          <thead>
            <tr className="bg-cerulean-500 text-left text-[11px] uppercase tracking-wide text-white">
              <th scope="col" className="px-4 py-3 font-semibold">Evento</th>
              <th scope="col" className="w-56 px-4 py-3 font-semibold">Fechas</th>
              <th scope="col" className="w-52 px-4 py-3 font-semibold">Estado</th>
              <th scope="col" className="w-40 px-4 py-3 text-right font-semibold">Inscripción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {eventos.map(ev => (
              <tr key={ev.eventoId} className="transition hover:bg-neutral-50">
                <td className="px-4 py-3 text-[13px] font-medium text-neutral-800">{ev.eventoNombre}</td>
                <td className="px-4 py-3 text-[12px] text-neutral-500 tabular-nums">
                  {fecha(ev.eventoFechaInicio)} — {fecha(ev.eventoFechaFin)}
                </td>
                <td className="px-4 py-3"><Estado ev={ev} /></td>
                <td className="px-4 py-3 text-right"><BotonInscribirse ev={ev} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
