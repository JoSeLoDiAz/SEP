'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventInput, EventClickArg, EventDropArg, DateSelectArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import { useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

// tipos duplicados a proposito para no acoplar con la pagina del cronograma
export interface SesionPLite {
  sesionId: number
  numSesion: number | null
  nombreSesion: string | null
  fechaInicio: string | null
  horas: number | null
  horaInicio: string | null
  horaFin: string | null
  capacitadorNombre: string | null
  estadoRadicado: string | null
}
export interface SesionVLite {
  actividadId: number
  numSesion: number | null
  nombreActividad: string | null
  fechaInicio: string | null
  fechaFin: string | null
  horas: number | null
  capacitadorNombre: string | null
  estadoRadicado: string | null
}

interface Props {
  modalidadId: number  // 1=Presencial, 2=PAT, 3=Hibrida, 4=Virtual
  sesionesP: SesionPLite[]
  sesionesV: SesionVLite[]
  fechaCronoInicio: string | null
  fechaCronoFin: string | null
  onAgregarPresencial: (preset: { fecha: string; horaInicio: string; horaFin: string }) => void
  onAgregarVirtual: (preset: { fechaInicio: string; fechaFin: string }) => void
  onEditarPresencial: (sesionId: number) => void
  onEditarVirtual: (actividadId: number) => void
  // si la promesa falla, el calendario revierte el drag/resize
  onMoverPresencial: (sesionId: number, fecha: string, horaInicio: string, horaFin: string) => Promise<void>
  onMoverVirtual: (actividadId: number, fechaInicio: string, fechaFin: string) => Promise<void>
  onError?: (mensaje: string) => void
}

const COLOR_PRESENCIAL = '#0070C0'   // azul institucional
const COLOR_VIRTUAL    = '#6C29B3'   // violeta
const COLOR_PAT        = '#0891B2'   // cyan (PAT en tabla presencial pero asistido)
const COLOR_HIBRIDA    = '#0F766E'   // teal (modal 3 mezcla)
const COLOR_APROBADA   = '#15803D'   // verde — sesion aprobada por interventoria (no editable)

function pad(n: number) { return n < 10 ? `0${n}` : `${n}` }

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function fmtTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// TypeORM serializa el DATE de Oracle como ISO UTC: leer en UTC evita el desfase de zona
function parseHoraHHMM(hora: string): [number, number] | null {
  const m1 = hora.match(/^(\d{1,2}):(\d{2})/)
  if (m1) return [Number(m1[1]), Number(m1[2])]
  const m2 = hora.match(/T(\d{2}):(\d{2})/)
  if (m2) return [Number(m2[1]), Number(m2[2])]
  const d = new Date(hora)
  if (!isNaN(d.getTime())) return [d.getUTCHours(), d.getUTCMinutes()]
  return null
}

// ISO sin offset: FullCalendar lo toma como wall-clock y no aplica la zona del navegador
function combineIso(fecha: string, hora: string | null): string {
  const f = fecha.slice(0, 10)
  if (!hora) return f
  const parsed = parseHoraHHMM(hora)
  if (!parsed) return f
  return `${f}T${pad(parsed[0])}:${pad(parsed[1])}:00`
}

// para compensar el `end` exclusivo de los eventos all-day de FullCalendar
function addDaysStr(fecha: string, n: number): string {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

// ya radicada = no editable
function estaBloqueada(estadoRadicado: string | null | undefined): boolean {
  const e = (estadoRadicado ?? '').trim().toUpperCase()
  return e !== '' && e !== 'PENDIENTE' && e !== 'MODIFICAR'
}

// recibe numeros y no Date: FC entrega wall-clock en `arg.date.array`, sin offset
function formato12hHM(h: number, m: number): string {
  const sufijo = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`
}

export function CronogramaCalendario(props: Props) {
  const {
    modalidadId, sesionesP, sesionesV,
    fechaCronoInicio, fechaCronoFin,
    onAgregarPresencial, onAgregarVirtual,
    onEditarPresencial, onEditarVirtual,
    onMoverPresencial, onMoverVirtual,
    onError,
  } = props

  const errorMsg = (e: unknown): string => {
    const r = e as { response?: { data?: { message?: string } }; message?: string }
    return r?.response?.data?.message ?? r?.message ?? 'No se pudo guardar el cambio.'
  }

  const calRef = useRef<FullCalendar | null>(null)
  const [busy, setBusy] = useState(false)

  const hayPresencial = [1, 2, 3].includes(modalidadId)
  const hayVirtual    = [3, 4].includes(modalidadId)

  // eventos del calendario; `extendedProps.tipo` decide el handler
  const events = useMemo<EventInput[]>(() => {
    const out: EventInput[] = []
    const colorP = modalidadId === 2 ? COLOR_PAT : COLOR_PRESENCIAL
    const colorV = modalidadId === 3 ? COLOR_HIBRIDA : COLOR_VIRTUAL
    if (hayPresencial) {
      for (const s of sesionesP) {
        if (!s.fechaInicio || !s.horaInicio || !s.horaFin) continue
        const aprobada = estaBloqueada(s.estadoRadicado)
        out.push({
          id: `P-${s.sesionId}`,
          title: (aprobada ? '🔒 ' : '') + (s.nombreSesion ?? `Sesion ${s.numSesion ?? s.sesionId}`),
          start: combineIso(s.fechaInicio, s.horaInicio),
          end:   combineIso(s.fechaInicio, s.horaFin),
          backgroundColor: aprobada ? COLOR_APROBADA : colorP,
          borderColor:     aprobada ? COLOR_APROBADA : colorP,
          editable: !aprobada,
          extendedProps: { tipo: 'P', sesionId: s.sesionId, capacitador: s.capacitadorNombre, aprobada },
        })
      }
    }
    if (hayVirtual) {
      for (const a of sesionesV) {
        if (!a.fechaInicio) continue
        const aprobada = estaBloqueada(a.estadoRadicado)
        const ini = a.fechaInicio.slice(0, 10)
        const finBase = a.fechaFin ? a.fechaFin.slice(0, 10) : ini
        out.push({
          id: `V-${a.actividadId}`,
          title: (aprobada ? '🔒 ' : '') + (a.nombreActividad ?? `Actividad ${a.numSesion ?? a.actividadId}`),
          start: ini,
          end: addDaysStr(finBase, 1), // FC: `end` exclusivo en all-day
          allDay: true,
          backgroundColor: aprobada ? COLOR_APROBADA : colorV,
          borderColor:     aprobada ? COLOR_APROBADA : colorV,
          editable: !aprobada,
          extendedProps: { tipo: 'V', actividadId: a.actividadId, capacitador: a.capacitadorNombre, aprobada },
        })
      }
    }
    return out
  }, [hayPresencial, hayVirtual, sesionesP, sesionesV, modalidadId])

  const handleSelect = (sel: DateSelectArg) => {
    if (busy) return
    if (sel.allDay) {
      if (hayVirtual) {
        const ini = fmtDate(sel.start)
        // FC `end` es exclusivo en allDay -> restamos 1 dia para el rango real.
        const finReal = new Date(sel.end.getTime() - 86_400_000)
        const fin = fmtDate(finReal)
        onAgregarVirtual({ fechaInicio: ini, fechaFin: fin })
      } else if (hayPresencial) {
        onAgregarPresencial({ fecha: fmtDate(sel.start), horaInicio: '08:00', horaFin: '12:00' })
      }
    } else {
      if (hayPresencial) {
        onAgregarPresencial({
          fecha: fmtDate(sel.start),
          horaInicio: fmtTime(sel.start),
          horaFin: fmtTime(sel.end),
        })
      }
    }
    calRef.current?.getApi().unselect()
  }

  const handleEventClick = (arg: EventClickArg) => {
    // tambien se abre si esta aprobada: el modal queda en solo lectura
    const tipo = arg.event.extendedProps.tipo as 'P' | 'V' | undefined
    if (tipo === 'P') onEditarPresencial(arg.event.extendedProps.sesionId as number)
    else if (tipo === 'V') onEditarVirtual(arg.event.extendedProps.actividadId as number)
  }

  const handleEventDrop = async (arg: EventDropArg) => {
    const tipo = arg.event.extendedProps.tipo as 'P' | 'V'
    setBusy(true)
    try {
      if (tipo === 'P' && arg.event.start && arg.event.end) {
        await onMoverPresencial(
          arg.event.extendedProps.sesionId as number,
          fmtDate(arg.event.start),
          fmtTime(arg.event.start),
          fmtTime(arg.event.end),
        )
      } else if (tipo === 'V' && arg.event.start) {
        const finExclusive = arg.event.end ?? new Date(arg.event.start.getTime() + 86_400_000)
        const finReal = new Date(finExclusive.getTime() - 86_400_000)
        await onMoverVirtual(
          arg.event.extendedProps.actividadId as number,
          fmtDate(arg.event.start),
          fmtDate(finReal),
        )
      }
    } catch (e) {
      arg.revert()
      onError?.(errorMsg(e))
    } finally { setBusy(false) }
  }

  const handleEventResize = async (arg: EventResizeDoneArg) => {
    const tipo = arg.event.extendedProps.tipo as 'P' | 'V'
    setBusy(true)
    try {
      if (tipo === 'P' && arg.event.start && arg.event.end) {
        await onMoverPresencial(
          arg.event.extendedProps.sesionId as number,
          fmtDate(arg.event.start),
          fmtTime(arg.event.start),
          fmtTime(arg.event.end),
        )
      } else if (tipo === 'V' && arg.event.start && arg.event.end) {
        const finReal = new Date(arg.event.end.getTime() - 86_400_000)
        await onMoverVirtual(
          arg.event.extendedProps.actividadId as number,
          fmtDate(arg.event.start),
          fmtDate(finReal),
        )
      }
    } catch (e) {
      arg.revert()
      onError?.(errorMsg(e))
    } finally { setBusy(false) }
  }

  const initialView = hayPresencial ? 'timeGridWeek' : 'dayGridMonth'

  // sin colchon: el backend rechaza con 400 fuera del rango. +1 dia porque `end` es exclusivo
  const validRange = (() => {
    if (!fechaCronoInicio || !fechaCronoFin) return undefined
    const ini = new Date(fechaCronoInicio.slice(0, 10) + 'T00:00:00')
    const finIncl = new Date(fechaCronoFin.slice(0, 10) + 'T00:00:00')
    const finExcl = new Date(finIncl.getTime() + 86_400_000)
    return { start: ini, end: finExcl }
  })()

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-neutral-100 text-xs">
        <span className="font-bold uppercase tracking-wide text-neutral-500">Calendario del cronograma</span>
        <div className="flex items-center gap-3 ml-auto text-[11px] text-neutral-500">
          {hayPresencial && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: modalidadId === 2 ? COLOR_PAT : COLOR_PRESENCIAL }} />
              {modalidadId === 2 ? 'Sesiones PAT' : modalidadId === 3 ? 'Sesiones presenciales (hibrida)' : 'Sesiones presenciales'}
            </span>
          )}
          {hayVirtual && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: modalidadId === 3 ? COLOR_HIBRIDA : COLOR_VIRTUAL }} />
              Actividades virtuales
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR_APROBADA }} />
            🔒 Aprobada (no editable)
          </span>
          {busy && (
            <span className="inline-flex items-center gap-1 text-neutral-400">
              <Loader2 size={12} className="animate-spin" /> Guardando…
            </span>
          )}
        </div>
      </div>

      <div className="p-3 [&_.fc]:font-sans [&_.fc-button-primary]:bg-[#00304D] [&_.fc-button-primary]:border-[#00304D] [&_.fc-button-primary:hover]:bg-[#0070C0] [&_.fc-button-primary:hover]:border-[#0070C0] [&_.fc-button-primary:disabled]:opacity-60 [&_.fc-toolbar-title]:text-base [&_.fc-toolbar-title]:font-bold [&_.fc-toolbar-title]:text-[#00304D] [&_.fc-col-header-cell-cushion]:text-[11px] [&_.fc-col-header-cell-cushion]:uppercase [&_.fc-col-header-cell-cushion]:tracking-wide [&_.fc-event-title]:font-medium [&_.fc-event]:cursor-pointer [&_.fc-event]:rounded-md [&_.fc-event]:px-1 [&_.fc-day-today]:bg-[#0070C0]/5">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={initialView}
          locale="es"
          // con los eventos en ISO sin offset, los handlers pueden leer getHours() local
          timeZone="local"
          firstDay={1}
          // alto fijo: el scroll queda dentro del calendario y la pagina no se estira
          height="70vh"
          stickyHeaderDates
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          buttonText={{
            today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Dia', list: 'Lista',
          }}
          allDaySlot={hayVirtual}
          allDayText="Virtuales"
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          slotDuration="00:30:00"
          scrollTime="06:00:00"
          // `arg.date.array` viene en wall-clock; getHours() sobre el marker UTC desfasa
          slotLabelFormat={(arg) => {
            const a = (arg as { date: { array: number[] } }).date.array
            return formato12hHM(a[3] ?? 0, a[4] ?? 0)
          }}
          eventTimeFormat={(arg) => {
            const a = arg as {
              start: { array: number[] }
              end?: { array: number[] }
            }
            const ini = formato12hHM(a.start.array[3] ?? 0, a.start.array[4] ?? 0)
            if (!a.end) return ini
            const fin = formato12hHM(a.end.array[3] ?? 0, a.end.array[4] ?? 0)
            return `${ini} - ${fin}`
          }}
          nowIndicator
          selectable={!busy}
          selectMirror
          editable={!busy}
          eventStartEditable={!busy}
          eventDurationEditable={!busy}
          dayMaxEvents={3}
          weekends
          validRange={validRange}
          initialDate={fechaCronoInicio ?? undefined}
          events={events}
          select={handleSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
        />
      </div>

      <div className="px-4 py-2 border-t border-neutral-100 text-[11px] text-neutral-500">
        Tip: arrastra un hueco para crear una sesion. Arrastra una sesion existente para reprogramar; ajusta el borde inferior para cambiar la duracion.
      </div>
    </div>
  )
}
