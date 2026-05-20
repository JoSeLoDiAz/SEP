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

// Tipos minimos compartidos con la pagina principal del cronograma. Se
// duplican aca a proposito para mantener este componente desacoplado.
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
  /** Click en un slot vacio -> abrir modal de agregar con prefill. */
  onAgregarPresencial: (preset: { fecha: string; horaInicio: string; horaFin: string }) => void
  onAgregarVirtual: (preset: { fechaInicio: string; fechaFin: string }) => void
  /** Click sobre un evento existente -> abrir modal editar. */
  onEditarPresencial: (sesionId: number) => void
  onEditarVirtual: (actividadId: number) => void
  /** Drag/resize -> persistir cambios. Devolver promise para revertir si falla. */
  onMoverPresencial: (sesionId: number, fecha: string, horaInicio: string, horaFin: string) => Promise<void>
  onMoverVirtual: (actividadId: number, fechaInicio: string, fechaFin: string) => Promise<void>
  /** Notifica errores del backend tras drag/resize (p.ej. fecha fuera de
   *  rango). Si no se provee, los errores quedan silenciosos en consola. */
  onError?: (mensaje: string) => void
}

const COLOR_PRESENCIAL = '#0070C0'   // azul institucional
const COLOR_VIRTUAL    = '#6C29B3'   // violeta
const COLOR_PAT        = '#0891B2'   // cyan (PAT en tabla presencial pero asistido)
const COLOR_HIBRIDA    = '#0F766E'   // teal (modal 3 mezcla)
const COLOR_APROBADA   = '#15803D'   // verde — sesion aprobada por interventoria (no editable)

function pad(n: number) { return n < 10 ? `0${n}` : `${n}` }

/** Toma un Date y devuelve "YYYY-MM-DD". */
function fmtDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** Toma un Date y devuelve "HH:MM". */
function fmtTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Extrae [hora, minuto] de un valor que puede venir como "HH:MM",
 *  "HH:MM:SS" o como ISO completo (p.ej. "1970-01-01T08:00:00.000Z" —
 *  Oracle DATE serializado por TypeORM). En el caso ISO usamos UTC para
 *  evitar desfaces de zona horaria locales (Oracle guarda el "wall time"
 *  pero el driver lo expone como UTC midnight + offset). */
function parseHoraHHMM(hora: string): [number, number] | null {
  // Caso 1: "HH:MM" o "HH:MM:SS" puro
  const m1 = hora.match(/^(\d{1,2}):(\d{2})/)
  if (m1) return [Number(m1[1]), Number(m1[2])]
  // Caso 2: ISO completo "YYYY-MM-DDTHH:MM:SS..."
  const m2 = hora.match(/T(\d{2}):(\d{2})/)
  if (m2) return [Number(m2[1]), Number(m2[2])]
  // Caso 3: parseable como Date — usamos UTC.
  const d = new Date(hora)
  if (!isNaN(d.getTime())) return [d.getUTCHours(), d.getUTCMinutes()]
  return null
}

/** Une fecha + hora en un string ISO LOCAL **sin offset** (p.ej.
 *  "2023-08-17T16:00:00"). FullCalendar lo interpreta como wall-clock
 *  literal, asi que se muestra exactamente esa hora sin importar la zona
 *  del navegador. Si no hay hora, devuelve solo "YYYY-MM-DD" (all-day). */
function combineIso(fecha: string, hora: string | null): string {
  const f = fecha.slice(0, 10)
  if (!hora) return f
  const parsed = parseHoraHHMM(hora)
  if (!parsed) return f
  return `${f}T${pad(parsed[0])}:${pad(parsed[1])}:00`
}

/** Suma `n` dias a "YYYY-MM-DD" y devuelve "YYYY-MM-DD". FullCalendar trata
 *  el `end` de eventos all-day como exclusivo. */
function addDaysStr(fecha: string, n: number): string {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** Una sesion/actividad esta "congelada" (no editable) si ya fue radicada
 *  (cualquier estado que no sea recien creada / sin radicar / devuelta para
 *  corregir: '', 'PENDIENTE', 'MODIFICAR'). */
function estaBloqueada(estadoRadicado: string | null | undefined): boolean {
  const e = (estadoRadicado ?? '').trim().toUpperCase()
  return e !== '' && e !== 'PENDIENTE' && e !== 'MODIFICAR'
}

/** Formatea hora+minuto (numeros) como "8:30 am" / "3:30 pm" (12h, minusculas,
 *  sin puntos). Recibe numeros para evitar problemas con timezones: FC
 *  expone `arg.date.array = [year, month, day, hour, minute, second, ms]`
 *  con valores en wall-clock (ya sin offset). */
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

  /** Extrae el mensaje legible de un error de axios o cualquier excepcion. */
  const errorMsg = (e: unknown): string => {
    const r = e as { response?: { data?: { message?: string } }; message?: string }
    return r?.response?.data?.message ?? r?.message ?? 'No se pudo guardar el cambio.'
  }

  const calRef = useRef<FullCalendar | null>(null)
  const [busy, setBusy] = useState(false)

  const hayPresencial = [1, 2, 3].includes(modalidadId)
  const hayVirtual    = [3, 4].includes(modalidadId)

  // Construye los eventos de FullCalendar a partir de sesiones presenciales y
  // actividades virtuales. Cada uno lleva un `extendedProps.tipo` para el
  // dispatching en los handlers.
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

  // Click en slot vacio -> agregar.
  const handleSelect = (sel: DateSelectArg) => {
    if (busy) return
    if (sel.allDay) {
      // Se selecciono en mes -> agregar virtual (si aplica) o presencial todo-el-dia.
      if (hayVirtual) {
        const ini = fmtDate(sel.start)
        // FC `end` es exclusivo en allDay -> restamos 1 dia para el rango real.
        const finReal = new Date(sel.end.getTime() - 86_400_000)
        const fin = fmtDate(finReal)
        onAgregarVirtual({ fechaInicio: ini, fechaFin: fin })
      } else if (hayPresencial) {
        // En vista mes seleccionando un dia, default 08:00-12:00.
        onAgregarPresencial({ fecha: fmtDate(sel.start), horaInicio: '08:00', horaFin: '12:00' })
      }
    } else {
      // Slot con horas -> presencial. Si la modalidad es solo virtual, no
      // hacemos nada (no deberia pasar porque hayPresencial=false bloquea).
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
    // Aprobadas o no, abrimos el modal: si la sesion esta aprobada el modal
    // se muestra de solo lectura (banner + sin boton Guardar).
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

  // Vista por defecto: si hay solo virtual, mes (mas natural para rangos de
  // dias). Si hay presencial, semana con horas.
  const initialView = hayPresencial ? 'timeGridWeek' : 'dayGridMonth'

  // Limites: el calendario solo navega dentro del rango exacto del
  // cronograma. Sin colchon — si dejaramos margen, el usuario podria
  // crear sesiones fuera y el backend las rechaza con 400. `end` es
  // exclusivo en FullCalendar, asi que sumamos 1 dia para que el ultimo
  // dia (fechaFin) sea seleccionable.
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
          // timeZone explicito: combinado con eventos en ISO local sin offset
          // ("2023-08-17T16:00:00"), FC muestra exactamente esa hora y los
          // handlers leen getHours()/getMinutes() (local) sin desfase.
          timeZone="local"
          firstDay={1}
          // Alto fijo: el body del calendario hace su propio scroll. Asi no
          // se "estira" la pagina cuando hay muchas semanas/eventos. 70vh
          // funciona bien en pantallas estandar y mantiene el header
          // (toolbar) y el footer del modulo siempre visibles.
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
          // Dia completo 00:00 → 24:00 para que puedan registrarse sesiones
          // a cualquier hora (madrugada, noche, etc.).
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          slotDuration="00:30:00"
          // Arranca el scroll en 6 am (horario habitual) sin ocultar el resto.
          scrollTime="06:00:00"
          // Formato 12h con am/pm minusculas tanto en las etiquetas de hora
          // del costado izquierdo como en cada bloque de evento. Usamos
          // `arg.date.array` que entrega [year,month,day,hour,minute,...]
          // en wall-clock (sin offset de timezone), evitando el desfase
          // que aparece al usar getHours() sobre el marker UTC.
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
