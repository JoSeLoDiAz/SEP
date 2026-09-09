'use client'

import api from '@/lib/api'
import { abrirArchivo, descargarArchivoConNombreDelServidor } from '@/lib/descargar-archivo'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { CargueRetroHistorica } from './cargue-retro-historica'
import {
  AlertTriangle, Award, BadgeCheck, Briefcase, CalendarDays, Check, CheckCircle2,
  ChevronRight, Circle, ClipboardList, Copy, Download, Eye, FileText, FolderOpen,
  Loader2, MessageSquareQuote, MinusCircle, Paperclip, Pencil, Plus, ShieldCheck, Stamp, Trash2, Upload, Users, XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtFecha } from '@/lib/format-date'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

interface Hito {
  codigo: string
  nombre: string
  cumplido: boolean
  detalle?: string | null
  /** false = este ciclo no puede cumplirlo; no cuenta para el anillo. */
  aplica?: boolean
  /** Cumplido, pero con un matiz (el certificado no lo emitio el SEP). */
  advertencia?: boolean
}
interface Progreso { cumplidos: number; total: number; hitos: Hito[] }

interface Participacion {
  participacionId: number
  anio: number
  periodo: string | null
  rolNombre: string | null
  procesoNombre: string | null
  modalidadNombre: string | null
  areaNombre: string | null
  estadoCodigo: string | null
  estadoNombre: string | null
  estadoColor: string | null
  estadoNegativo: boolean
  estadoSugerido: string
  convocatoriaNombre: string | null
  /** Hace falta para enlazar a la matriz, que se arma por ciclo. */
  convocatoriaId?: number | null
  /** Notas de corte del ciclo. Sin ellas nada puede marcarse aprobado. */
  corteCurso?: number | null
  cortePrueba?: number | null
  motivoNoParticipa: string | null
  mesa: string | null
  equipoEvaluador: string | null
  dinamizadorNombre: string | null
  esTransversal: boolean
  progreso: Progreso
  promedioRetro: number | null
  contadores: {
    documentos: number; proyectos: number
    retroAsignadas: number; retroPendientes: number; retroRecibidas: number
  }
}

interface AnioRail {
  anio?: number
  participaciones?: Participacion[]
  soloPrueba?: boolean
  pruebasSueltas?: number
  mejorPuntajeSuelto?: number | null
  /** Marcador de años sin registro entre dos años activos. */
  gap?: boolean
  desde?: number
  hasta?: number
  anios?: number
}

interface Resumen {
  aniosParticipados: number
  totalParticipaciones: number
  totalProyectos: number
  totalCertificados: number
  promedioRetro: number | null
  totalRetroRecibidas: number
  pruebaVigente: {
    anio: number; puntaje: number | null; porcentaje: number | null
    minimo: number | null; aprobada: boolean; vigente: boolean
  } | null
  /** Un renglón por año en que participó. `pruebaAprobada` en null = sin evaluar. */
  recorrido: Array<{
    anio: number
    porcentaje: number | null
    puntaje: number | null
    /** Cuántas pruebas hubo ese año. Con más de una se muestra la mejor. */
    pruebasDelAnio?: number
    pruebaAprobada: boolean | null
    curso: number | null
    cursoAprobado: boolean | null
    retro: number | null
  }>
}

interface Documento {
  documentoId: number
  tipoCodigo: string
  tipoNombre: string
  descripcion: string | null
  /** Año al que corresponde. Es lo que ata un documento permanente a un ciclo. */
  anioReferencia?: number | null
  archivoNombre: string | null
  ambito: 'PROPIO' | 'HEREDADO' | 'PERMANENTE'
  soloLectura?: boolean
}

interface Detalle extends Participacion {
  aprobacion: {
    aprobacionId: number; aprobadorNombre: string; aprobadorEmail: string
    aprobadorCargo: string | null; fechaAprobacion: string
    tieneEvidencia: boolean; observaciones: string | null
  } | null
  capacitaciones: Array<{
    capacitacionId: number; nombre: string; plataforma: string | null
    horas: number | null; calificacion: number | null; calificacionMinima: number | null
    aprobado: boolean; tieneArchivo: boolean
    fechaInicio: string | null; fechaFin: string | null; observaciones: string | null
  }>
  pruebas: Array<{
    pruebaId: number; anio: number; puntajeMayor: number | null; efectividad: number | null
    puntajeMinimo: number | null; aprobada: boolean; fechaPresentacion: string | null
    intentos: number | null
  }>
  grupos: Array<{ partGrupoId: number; grupo: number; esPrincipal: boolean }>
  proyectos: Array<{
    partProyectoId: number; nombreProyecto: string | null; razonSocial: string | null
    nit: string | null; puntajeOtorgado: number | null; origen: string
    proyectoId: number | null; guardadoId: number | null
  }>
  documentos: { propios: Documento[]; heredados: Documento[]; permanentes: Documento[] }
  certificado: { certificadoId: number; consecutivo: number; codigoVerificacion: string; anulado: boolean } | null
  retroalimentacion: {
    recibidas: number; promedio: number | null; asignadas: number; pendientes: number
    minimo: number | null; maximo: number | null
  }
}

// Tailwind necesita las clases literales en el fuente, no armadas con template strings
const COLOR_ESTADO: Record<string, { chip: string; punto: string; anillo: string }> = {
  neutral: { chip: 'bg-neutral-100 text-neutral-700 border-neutral-200', punto: 'bg-neutral-400', anillo: '#a3a3a3' },
  blue:    { chip: 'bg-blue-50 text-blue-700 border-blue-200',           punto: 'bg-blue-500',    anillo: '#3b82f6' },
  indigo:  { chip: 'bg-indigo-50 text-indigo-700 border-indigo-200',     punto: 'bg-indigo-500',  anillo: '#6366f1' },
  cyan:    { chip: 'bg-cyan-50 text-cyan-700 border-cyan-200',           punto: 'bg-cyan-500',    anillo: '#06b6d4' },
  amber:   { chip: 'bg-amber-50 text-amber-700 border-amber-200',        punto: 'bg-amber-500',   anillo: '#f59e0b' },
  orange:  { chip: 'bg-orange-50 text-orange-700 border-orange-200',     punto: 'bg-orange-500',  anillo: '#f97316' },
  green:   { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',  punto: 'bg-emerald-500', anillo: '#10b981' },
  red:     { chip: 'bg-red-50 text-red-700 border-red-200',              punto: 'bg-red-500',     anillo: '#ef4444' },
}
const colorDe = (token?: string | null) => COLOR_ESTADO[token ?? 'neutral'] ?? COLOR_ESTADO.neutral

type SubTab = 'documentos' | 'formacion' | 'proyectos' | 'retroalimentacion' | 'certificado'

export function TrayectoriaEvaluador({
  evaluadorId, setToast, refrescar = 0,
}: {
  evaluadorId: number
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  // sube de valor cuando algo cambia afuera (participaciones, pruebas)
  refrescar?: number
}) {
  const [rail, setRail] = useState<AnioRail[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [cargandoRail, setCargandoRail] = useState(true)
  const [seleccion, setSeleccion] = useState<number | null>(null)
  const [detalle, setDetalle] = useState<Detalle | null>(null)
  // que ciclo tiene pintado: distingue abrir otro (con spinner) de refrescar el
  // mismo porque se guardo algo abajo (sin parpadeo)
  const detalleRef = useRef<number | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [subTab, setSubTab] = useState<SubTab>('documentos')
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      // al refrescar no se vacía la pantalla: el spinner es solo de la primera carga
      setCargandoRail(v => (rail.length === 0 ? true : v))
      try {
        const [t, r] = await Promise.all([
          api.get<{ anios: AnioRail[] }>(`/evaluadores/${evaluadorId}/trayectoria`),
          api.get<Resumen>(`/evaluadores/${evaluadorId}/resumen`),
        ])
        if (!vivo) return
        const anios = t.data?.anios ?? []
        setRail(anios)
        setResumen(r.data)
        // se conserva el ciclo abierto; solo se escoge uno si no había o si ya no existe
        setSeleccion(prev => {
          const sigue = prev != null
            && anios.some(a => a.participaciones?.some(p => p.participacionId === prev))
          if (sigue) return prev
          return anios.find(a => a.participaciones?.length)?.participaciones?.[0]?.participacionId ?? null
        })
      } catch (err) {
        if (vivo) setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo cargar la trayectoria') })
      } finally {
        if (vivo) setCargandoRail(false)
      }
    })()
    return () => { vivo = false }
    // rail se lee solo para saber si es la primera carga; no debe disparar el efecto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluadorId, setToast, recarga, refrescar])

  useEffect(() => {
    if (seleccion == null) { setDetalle(null); return }
    let vivo = true
    // solo la primera vez que se abre un ciclo se muestra "Cargando el ciclo...";
    // los refrescos de abajo repintan por debajo, sin parpadeo
    const esOtroCiclo = detalleRef.current !== seleccion
    ;(async () => {
      if (esOtroCiclo) setCargandoDetalle(true)
      try {
        const r = await api.get<Detalle>(`/evaluadores/participaciones/${seleccion}/detalle`)
        detalleRef.current = seleccion
        if (vivo) setDetalle(r.data)
      } catch (err) {
        if (vivo) setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo cargar el ciclo') })
      } finally {
        if (vivo && esOtroCiclo) setCargandoDetalle(false)
      }
    })()
    return () => { vivo = false }
    // `refrescar` sube cuando se guarda algo en las secciones de abajo: sin él, el
    // checklist, el anillo y la subpestaña Formación del ciclo abierto se quedaban
    // con datos viejos y parecía que el registro no había funcionado.
  }, [seleccion, recarga, refrescar, setToast])

  const hayCiclos = useMemo(() => rail.some(a => a.participaciones?.length), [rail])

  if (cargandoRail) {
    return (
      <div className="flex items-center gap-2 px-5 py-10 text-sm text-neutral-500">
        <Loader2 size={14} className="animate-spin" />
        Cargando trayectoria…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {resumen && <FilaKpis resumen={resumen} />}
      {resumen && <FranjaRecorrido recorrido={resumen.recorrido} />}

      {rail.length === 0 ? (
        <VacioTotal />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">
          <Rail
            items={rail}
            seleccion={seleccion}
            onSelect={id => { setSeleccion(id); setSubTab('documentos') }}
          />

          <div className="min-w-0">
            {!hayCiclos ? (
              <SoloHistorico />
            ) : cargandoDetalle ? (
              <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-5 py-10 text-sm text-neutral-500 shadow-sm">
                <Loader2 size={14} className="animate-spin" />
                Cargando el ciclo…
              </div>
            ) : detalle ? (
              <div className="flex flex-col gap-5">
                <CabeceraCiclo
                  detalle={detalle}
                  setToast={setToast}
                  onRecargar={() => setRecarga(n => n + 1)}
                />
                <Checklist progreso={detalle.progreso} />
                <PanelSubTabs
                  evaluadorId={evaluadorId}
                  detalle={detalle}
                  subTab={subTab}
                  onSubTab={setSubTab}
                  setToast={setToast}
                  onRecargar={() => setRecarga(n => n + 1)}
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-10 text-center text-sm text-neutral-400">
                Selecciona un año en la línea de la izquierda.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FranjaRecorrido({ recorrido }: { recorrido: Resumen['recorrido'] }) {
  if (!recorrido?.length) return null

  const estado = (a: boolean | null) =>
    a === true ? { txt: 'Aprobada', clase: 'bg-emerald-100 text-emerald-700' }
    : a === false ? { txt: 'No aprobada', clase: 'bg-red-100 text-red-700' }
    // sin evaluar no es reprobada: las pruebas viejas no traen porcentaje ni corte
    : { txt: 'Sin evaluar', clase: 'bg-neutral-100 text-neutral-500' }

  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        Recorrido año por año
      </p>
      <div className="flex min-w-max gap-2">
        {recorrido.map(r => (
          <div key={r.anio} className="w-[136px] shrink-0 rounded-xl border border-neutral-100 px-3 py-2">
            <p className="text-[13px] font-bold" style={{ color: PRIMARY }}>{r.anio}</p>

            <p className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-neutral-400">Prueba</p>
            <p className="text-[13px] font-semibold text-neutral-800">
              {r.porcentaje != null ? `${r.porcentaje}%`
                : r.puntaje != null ? `${r.puntaje} pts`
                : '—'}
            </p>
            {(r.porcentaje != null || r.puntaje != null) && (
              <span className={`mt-0.5 inline-block rounded px-1.5 py-px text-[9px] font-bold uppercase ${estado(r.pruebaAprobada).clase}`}>
                {estado(r.pruebaAprobada).txt}
              </span>
            )}
            {/* con varias pruebas ese año se muestra la mejor: callarlo hacía
                parecer que las otras no existen */}
            {(r.pruebasDelAnio ?? 0) > 1 && (
              <p className="text-[9px] text-neutral-400">
                mejor de {r.pruebasDelAnio}
              </p>
            )}

            <p className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-neutral-400">Curso</p>
            <p className="text-[13px] font-semibold text-neutral-800">
              {r.curso != null ? String(r.curso) : '—'}
              {/* sin nota no hay nada que reprobar: APROBADO llega en 0 porque la
                  convocatoria no tiene corte, no porque la persona fallara */}
              {r.cursoAprobado === false && r.curso != null && (
                <span className="ml-1 text-[9px] font-bold uppercase text-red-600">No aprobado</span>
              )}
            </p>

            <p className="mt-2 text-[9px] font-semibold uppercase leading-tight tracking-wide text-neutral-400">
              Retroalimentación
            </p>
            <p className="text-[13px] font-semibold text-neutral-800">
              {r.retro != null ? `${r.retro} / 5` : '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function FilaKpis({ resumen }: { resumen: Resumen }) {
  const prueba = resumen.pruebaVigente
  const kpis: Array<{ label: string; valor: string; sub?: string; alerta?: boolean }> = [
    { label: 'Años en el banco', valor: String(resumen.aniosParticipados) },
    { label: 'Participaciones', valor: String(resumen.totalParticipaciones) },
    { label: 'Proyectos evaluados', valor: String(resumen.totalProyectos) },
    {
      label: 'Retroalimentación',
      valor: resumen.promedioRetro != null ? `${resumen.promedioRetro} / 5` : '—',
      sub: resumen.totalRetroRecibidas > 0
        ? `${resumen.totalRetroRecibidas} recibidas`
        : 'sin datos aún',
    },
    {
      label: 'Prueba',
      valor: prueba ? (prueba.aprobada ? 'Aprobada' : 'No aprobada') : '—',
      // el porcentaje es lo comparable con el mínimo; el puntaje son aciertos crudos
      sub: prueba
        ? `${prueba.anio}${prueba.porcentaje != null ? ` · ${prueba.porcentaje}%` : ''}`
        : 'sin registro',
      // Una prueba aprobada pero de hace más de un año ya no habilita.
      alerta: !!prueba && prueba.aprobada && !prueba.vigente,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map(k => (
        <div
          key={k.label}
          className={`rounded-2xl border bg-white px-4 py-3 shadow-sm ${
            k.alerta ? 'border-amber-300 bg-amber-50/40' : 'border-neutral-200'
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{k.label}</p>
          <p className="mt-1 text-xl font-bold leading-none" style={{ color: PRIMARY }}>{k.valor}</p>
          {k.sub && (
            <p className={`mt-1 text-[11px] ${k.alerta ? 'font-semibold text-amber-700' : 'text-neutral-500'}`}>
              {k.alerta ? 'vencida — ' : ''}{k.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function Rail({
  items, seleccion, onSelect,
}: {
  items: AnioRail[]
  seleccion: number | null
  onSelect: (participacionId: number) => void
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm lg:sticky lg:top-4">
      <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        Línea de tiempo
      </p>
      <ol className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto pb-1">
        {items.map((item, i) => {
          if (item.gap) {
            return (
              <li key={`gap-${i}`} className="flex items-center gap-2 px-3 py-2 text-[11px] text-neutral-400">
                <span className="ml-[7px] h-6 w-px bg-neutral-200" />
                {item.anios === 1 ? `${item.desde} sin registro` : `${item.desde}–${item.hasta} sin registro`}
              </li>
            )
          }

          if (item.soloPrueba) {
            return (
              <li key={item.anio} className="rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <Circle size={9} className="fill-neutral-300 text-neutral-300" />
                  <span className="text-sm font-bold text-neutral-500">{item.anio}</span>
                </div>
                <p className="ml-[17px] text-[11px] text-neutral-400">
                  Solo prueba
                  {item.mejorPuntajeSuelto != null && ` · ${item.mejorPuntajeSuelto} pts`}
                </p>
              </li>
            )
          }

          return (
            <li key={item.anio} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 px-3 pt-2">
                <Circle size={9} className="fill-[#00304D] text-[#00304D]" />
                <span className="text-sm font-bold" style={{ color: PRIMARY }}>{item.anio}</span>
              </div>
              {item.participaciones?.map(p => {
                const activo = p.participacionId === seleccion
                const c = colorDe(p.estadoColor)
                return (
                  <button
                    key={p.participacionId}
                    onClick={() => onSelect(p.participacionId)}
                    className={`ml-[17px] mr-2 rounded-xl border px-3 py-2 text-left transition ${
                      activo
                        ? 'border-[#00304D] bg-[#00304D]/5 shadow-sm'
                        : 'border-transparent hover:border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold text-neutral-800">
                        {p.rolNombre || 'Sin rol'}
                      </span>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.punto}`} />
                    </div>
                    <p className="truncate text-[11px] text-neutral-500">
                      {[p.procesoNombre, p.modalidadNombre, p.periodo && `P${p.periodo}`]
                        .filter(Boolean).join(' · ') || '—'}
                    </p>
                    <BarraProgreso progreso={p.progreso} color={c.anillo} />
                  </button>
                )
              })}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function BarraProgreso({ progreso, color }: { progreso: Progreso; color: string }) {
  const pct = progreso.total ? Math.round((progreso.cumplidos / progreso.total) * 100) : 0
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-semibold tabular-nums text-neutral-500">
        {progreso.cumplidos}/{progreso.total}
      </span>
    </div>
  )
}

// el motivo es obligatorio en los estados negativos: lo exige el backend
function CambiarEstado({
  detalle, setToast, onRecargar, onCerrar,
}: {
  detalle: Detalle
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  onRecargar: () => void
  onCerrar: () => void
}) {
  const [estados, setEstados] = useState<Array<{
    codigo: string; nombre: string; descripcion: string | null; esNegativo: boolean
  }>>([])
  const [codigo, setCodigo] = useState(detalle.estadoCodigo ?? '')
  const [motivo, setMotivo] = useState(detalle.motivoNoParticipa ?? '')
  const [guardando, setGuardando] = useState(false)

  const label = 'block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
  const input = 'w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40'

  useEffect(() => {
    let vivo = true
    api.get<Array<{ codigo: string; nombre: string; descripcion: string | null; esNegativo: boolean }>>(
      '/evaluadores/catalogos/estados-participacion')
      .then(r => { if (vivo) setEstados(r.data ?? []) })
      .catch(() => { if (vivo) setToast({ tipo: 'error', msg: 'No se pudieron cargar los estados' }) })
    return () => { vivo = false }
  }, [setToast])

  const elegido = estados.find(e => e.codigo === codigo)
  const exigeMotivo = elegido?.esNegativo === true

  async function guardar() {
    if (!codigo) return setToast({ tipo: 'error', msg: 'Escoja el estado' })
    if (exigeMotivo && !motivo.trim()) {
      return setToast({
        tipo: 'error',
        msg: `"${elegido?.nombre}" cierra el ciclo sin evaluación: escriba el motivo`,
      })
    }
    setGuardando(true)
    try {
      await api.put(`/evaluadores/participaciones/${detalle.participacionId}/estado`, {
        estadoCodigo: codigo,
        motivo: motivo.trim() || null,
      })
      setToast({ tipo: 'success', msg: 'Estado actualizado' })
      onCerrar()
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo cambiar el estado') })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 border-b border-neutral-100 bg-neutral-50/60 px-5 py-4 sm:grid-cols-2">
      <div>
        <label className={label}>Estado del ciclo *</label>
        <select value={codigo} onChange={e => setCodigo(e.target.value)} className={input}>
          <option value="">— Escoja el estado —</option>
          {estados.map(e => (
            <option key={e.codigo} value={e.codigo}>
              {e.nombre}{e.esNegativo ? ' (cierra el ciclo)' : ''}
            </option>
          ))}
        </select>
        {elegido?.descripcion && (
          <p className="mt-1 text-[11px] text-neutral-500">{elegido.descripcion}</p>
        )}
      </div>
      <div>
        <label className={label}>Motivo {exigeMotivo && '*'}</label>
        <input
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          maxLength={300}
          placeholder={exigeMotivo ? 'Obligatorio para este estado' : 'Opcional'}
          className={input}
        />
      </div>
      <p className="text-[11px] text-neutral-400 sm:col-span-2">
        El cambio queda en el control de cambios con su usuario y la fecha.
        {/* en un ciclo revocado o declinado el sugerido siempre diverge: proponer
            "FINALIZADO" sobre una participación revocada confunde en vez de ayudar */}
        {detalle.estadoSugerido && detalle.estadoSugerido !== codigo && !detalle.estadoNegativo && (
          <> Por lo que hay cargado correspondería <strong>{detalle.estadoSugerido}</strong>.</>
        )}
      </p>
      <div className="flex items-end justify-end gap-2 sm:col-span-2">
        <button
          onClick={onCerrar}
          disabled={guardando}
          className="rounded-lg bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={guardando}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: INSTITUTIONAL }}
        >
          {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Guardar estado
        </button>
      </div>
    </div>
  )
}

// se manda el conjunto completo: el backend reemplaza lo que haya
function EditarGrupos({
  detalle, setToast, onRecargar, onCerrar,
}: {
  detalle: Detalle
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  onRecargar: () => void
  onCerrar: () => void
}) {
  const [texto, setTexto] = useState(detalle.grupos.map(g => g.grupo).join(', '))
  const [guardando, setGuardando] = useState(false)

  /** Acepta "1, 3 5" y devuelve [1,3,5]; `malos` son los que no sirven. */
  const partes = texto.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean)
  const numeros = [...new Set(partes.map(Number))]
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 99)
    .sort((a, b) => a - b)
  const malos = partes.filter(p => {
    const n = Number(p)
    return !Number.isInteger(n) || n < 1 || n > 99
  })

  async function guardar() {
    if (malos.length) {
      return setToast({
        tipo: 'error',
        msg: `Los grupos van de 1 a 99. No sirve: ${malos.join(', ')}`,
      })
    }
    setGuardando(true)
    try {
      await api.put(`/evaluadores/participaciones/${detalle.participacionId}/grupos`, {
        grupos: numeros,
      })
      setToast({
        tipo: 'success',
        msg: numeros.length ? `Grupos ${numeros.join(', ')} asignados` : 'Grupos retirados',
      })
      onCerrar()
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudieron guardar los grupos') })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="border-b border-neutral-100 bg-neutral-50/60 px-5 py-4">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        Grupos del ciclo
      </label>
      <input
        value={texto}
        onChange={e => setTexto(e.target.value)}
        placeholder="1, 3, 5"
        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
      />
      <p className="mt-1 text-[11px] text-neutral-500">
        Separados por coma. Del 1 al 99. El primero queda como principal.
        {numeros.length > 0 && <> Quedará en: <strong>{numeros.join(', ')}</strong>.</>}
        {texto.trim() === '' && <> Vacío retira todos los grupos.</>}
      </p>
      {malos.length > 0 && (
        <p className="mt-1 text-[11px] text-red-700">No sirve: {malos.join(', ')}</p>
      )}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={onCerrar}
          disabled={guardando}
          className="rounded-lg bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={guardando || malos.length > 0}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: INSTITUTIONAL }}
        >
          {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Guardar grupos
        </button>
      </div>
    </div>
  )
}

function CabeceraCiclo({
  detalle, setToast, onRecargar,
}: {
  detalle: Detalle
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  onRecargar: () => void
}) {
  const [editando, setEditando] = useState<'estado' | 'grupos' | null>(null)
  const c = colorDe(detalle.estadoColor)
  const divergente =
    detalle.estadoCodigo != null &&
    detalle.estadoSugerido !== detalle.estadoCodigo &&
    !detalle.estadoNegativo

  const datos: Array<[string, string | null]> = [
    ['Rol', detalle.rolNombre],
    ['Área', [detalle.areaNombre, detalle.grupos.length ? `Grupos ${detalle.grupos.map(g => g.grupo).join(', ')}` : null].filter(Boolean).join(' · ') || null],
    ['Proceso', detalle.procesoNombre],
    ['Modalidad', detalle.modalidadNombre],
    ['Mesa y equipo', [detalle.mesa, detalle.equipoEvaluador].filter(Boolean).join(' · ') || null],
    ['Dinamizó', detalle.dinamizadorNombre],
    ['Autorizó', detalle.aprobacion
      ? `${detalle.aprobacion.aprobadorNombre} · ${fmtFecha(detalle.aprobacion.fechaAprobacion)}`
      : null],
    ['Convocatoria', detalle.convocatoriaNombre],
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
        <div className="flex items-center gap-3">
          <CalendarDays size={16} style={{ color: PRIMARY }} />
          <h3 className="text-sm font-bold text-neutral-800">
            {detalle.anio}{detalle.periodo ? ` · Periodo ${detalle.periodo}` : ''}
          </h3>
          {detalle.esTransversal && (
            <span className="rounded border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-purple-700">
              Transversal
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditando(v => (v === 'grupos' ? null : 'grupos'))}
            className="rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 transition hover:bg-neutral-50"
          >
            {detalle.grupos.length
              ? `Grupos ${detalle.grupos.map(g => g.grupo).join(', ')}`
              : 'Asignar grupos'}
          </button>
          <button
            onClick={() => setEditando(v => (v === 'estado' ? null : 'estado'))}
            title="Cambiar el estado del ciclo"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition hover:opacity-80 ${c.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${c.punto}`} />
            {detalle.estadoNombre ?? 'Sin estado'}
          </button>
        </div>
      </header>

      {editando === 'estado' && (
        <CambiarEstado
          detalle={detalle}
          setToast={setToast}
          onRecargar={onRecargar}
          onCerrar={() => setEditando(null)}
        />
      )}
      {editando === 'grupos' && (
        <EditarGrupos
          detalle={detalle}
          setToast={setToast}
          onRecargar={onRecargar}
          onCerrar={() => setEditando(null)}
        />
      )}

      {detalle.estadoNegativo && detalle.motivoNoParticipa && (
        <p className="border-b border-red-100 bg-red-50/60 px-5 py-2.5 text-[12px] text-red-800">
          <strong>Motivo:</strong> {detalle.motivoNoParticipa}
        </p>
      )}

      {divergente && (
        // el estado lo declara una persona y el checklist lo deduce de los datos
        <p className="border-b border-amber-100 bg-amber-50/60 px-5 py-2.5 text-[12px] text-amber-800">
          El estado guardado es <strong>{detalle.estadoNombre}</strong>, pero por lo que hay cargado
          correspondería <strong>{detalle.estadoSugerido}</strong>.
        </p>
      )}

      <div className="flex flex-col gap-5 px-5 py-4 sm:flex-row">
        <AnilloProgreso progreso={detalle.progreso} color={c.anillo} />
        <dl className="grid flex-1 grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {datos.map(([label, valor]) => (
            <div key={label}>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{label}</dt>
              <dd className="text-[13px] text-neutral-800">{valor || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function AnilloProgreso({ progreso, color }: { progreso: Progreso; color: string }) {
  const pct = progreso.total ? progreso.cumplidos / progreso.total : 0
  const R = 34
  const circ = 2 * Math.PI * R
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1">
      <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
        <circle cx="42" cy="42" r={R} fill="none" stroke="#e5e5e5" strokeWidth="7" />
        <circle
          cx="42" cy="42" r={R} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          className="transition-all duration-500"
        />
      </svg>
      <p className="-mt-[52px] text-center text-lg font-bold tabular-nums" style={{ color: PRIMARY }}>
        {progreso.cumplidos}<span className="text-xs text-neutral-400">/{progreso.total}</span>
      </p>
      <p className="mt-[30px] text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Progreso</p>
    </div>
  )
}

function Checklist({ progreso }: { progreso: Progreso }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        Hitos del ciclo
      </p>
      <div className="flex flex-wrap gap-2">
        {progreso.hitos.map(h => (
          <span
            key={h.codigo}
            title={h.detalle ?? undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
              h.aplica === false
                ? 'border-dashed border-neutral-200 bg-white text-neutral-400'
                : h.cumplido
                  ? h.advertencia
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-400'
            }`}
          >
            {h.aplica === false
              ? <MinusCircle size={13} className="shrink-0 text-neutral-300" />
              : h.cumplido
                ? <CheckCircle2 size={13} className={`shrink-0 ${h.advertencia ? 'text-amber-600' : 'text-emerald-600'}`} />
                : <Circle size={13} className="shrink-0 text-neutral-300" />}
            {h.nombre}
            {/* el detalle también cuando está apagado: "Efectividad 60% / mínimo 70%"
                dice algo que el círculo gris se callaba */}
            {h.detalle && (
              <span className={`font-semibold ${
                h.aplica === false ? 'text-neutral-400'
                  : h.cumplido ? (h.advertencia ? 'text-amber-700' : 'text-emerald-700')
                  : 'text-neutral-500'
              }`}>· {h.detalle}</span>
            )}
          </span>
        ))}
      </div>
    </section>
  )
}

const SUBTABS: Array<{ id: SubTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: 'documentos', label: 'Documentos', icon: Paperclip },
  { id: 'formacion', label: 'Formación y pruebas', icon: Award },
  { id: 'proyectos', label: 'Proyectos evaluados', icon: FolderOpen },
  { id: 'retroalimentacion', label: 'Retroalimentación', icon: MessageSquareQuote },
  { id: 'certificado', label: 'Certificado', icon: BadgeCheck },
]

function PanelSubTabs({
  evaluadorId, detalle, subTab, onSubTab, setToast, onRecargar,
}: {
  evaluadorId: number
  detalle: Detalle
  subTab: SubTab
  onSubTab: (t: SubTab) => void
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  onRecargar: () => void
}) {
  const conteos: Record<SubTab, number> = {
    documentos: detalle.documentos.propios.length + detalle.documentos.heredados.length,
    formacion: detalle.capacitaciones.length + detalle.pruebas.length,
    proyectos: detalle.proyectos.length,
    retroalimentacion: detalle.retroalimentacion.recibidas,
    certificado: detalle.certificado && !detalle.certificado.anulado ? 1 : 0,
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex gap-1 overflow-x-auto border-b border-neutral-100 p-2">
        {SUBTABS.map(t => {
          const Icon = t.icon
          const activo = subTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => onSubTab(t.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                activo ? 'text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
              style={activo ? { backgroundColor: PRIMARY } : undefined}
            >
              <Icon size={13} />
              {t.label}
              {conteos[t.id] > 0 && (
                <span className={`rounded px-1 text-[10px] font-bold ${
                  activo ? 'bg-white/20' : 'bg-neutral-200 text-neutral-600'
                }`}>
                  {conteos[t.id]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {subTab === 'documentos' && (
        <TabDocumentos
          evaluadorId={evaluadorId}
          detalle={detalle}
          setToast={setToast}
          onRecargar={onRecargar}
        />
      )}
      {subTab === 'formacion' && (
        <TabFormacion detalle={detalle} setToast={setToast} onRecargar={onRecargar} />
      )}
      {subTab === 'proyectos' && (
        <TabProyectos detalle={detalle} setToast={setToast} onRecargar={onRecargar} />
      )}
      {subTab === 'retroalimentacion' && (
        <TabRetroalimentacion detalle={detalle} onRecargar={onRecargar} />
      )}
      {subTab === 'certificado' && (
        <TabCertificado
          evaluadorId={evaluadorId}
          detalle={detalle}
          setToast={setToast}
          onRecargar={onRecargar}
        />
      )}
    </section>
  )
}

// la autorización es de un ciclo concreto, por eso va dentro del año
function BloqueAutorizacion({
  detalle, setToast, onRecargar,
}: {
  detalle: Detalle
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  onRecargar: () => void
}) {
  const a = detalle.aprobacion
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState('')
  const [fecha, setFecha] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [confirmBorrar, setConfirmBorrar] = useState(false)
  const archivoRef = useRef<HTMLInputElement>(null)

  const label = 'block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
  const input = 'w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40'

  async function registrar() {
    if (!nombre.trim()) return setToast({ tipo: 'error', msg: 'El nombre del jefe es obligatorio' })
    if (!email.trim()) return setToast({ tipo: 'error', msg: 'El correo del jefe es obligatorio' })
    if (!fecha) return setToast({ tipo: 'error', msg: 'La fecha de la autorización es obligatoria' })
    setGuardando(true)
    try {
      await api.post(`/evaluadores/participaciones/${detalle.participacionId}/aprobacion`, {
        aprobadorNombre: nombre.trim(),
        aprobadorEmail: email.trim(),
        aprobadorCargo: cargo.trim() || null,
        fechaAprobacion: fecha,
        observaciones: observaciones.trim() || null,
      })
      setToast({ tipo: 'success', msg: 'Autorización registrada' })
      setAbierto(false)
      setNombre(''); setEmail(''); setCargo(''); setFecha(''); setObservaciones('')
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo registrar la autorización') })
    } finally {
      setGuardando(false)
    }
  }

  /** Lo mismo que acepta el backend en esta ruta (MAX_EVIDENCIA_BYTES). */
  const MAX_EVIDENCIA_MB = 8

  async function subirEvidencia(archivo: File) {
    if (!a) return

    // se mide antes de mandarlo: el servidor lo rechaza al final, tras subirlo entero
    const mb = archivo.size / (1024 * 1024)
    if (mb > MAX_EVIDENCIA_MB) {
      setToast({
        tipo: 'error',
        msg: `El correo pesa ${mb.toFixed(1)} MB y el máximo son ${MAX_EVIDENCIA_MB} MB. ` +
          'Guárdelo sin los adjuntos, o imprímalo a PDF.',
      })
      if (archivoRef.current) archivoRef.current.value = ''
      return
    }

    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      await api.post(`/evaluadores/aprobaciones/${a.aprobacionId}/evidencia`, fd)
      setToast({ tipo: 'success', msg: 'Evidencia cargada' })
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo cargar la evidencia') })
    } finally {
      setSubiendo(false)
      if (archivoRef.current) archivoRef.current.value = ''
    }
  }

  async function borrar() {
    if (!a) return
    setGuardando(true)
    try {
      await api.delete(`/evaluadores/aprobaciones/${a.aprobacionId}`)
      setToast({ tipo: 'success', msg: 'Autorización eliminada' })
      setConfirmBorrar(false)
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo eliminar') })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-600">
            Autorización del jefe
          </p>
          <p className="text-[11px] text-neutral-400">
            Quién autorizó a este evaluador a participar en{' '}
            <strong className="text-neutral-500">
              {detalle.anio}{detalle.periodo ? `-${detalle.periodo}` : ''}
              {detalle.convocatoriaNombre ? ` · ${detalle.convocatoriaNombre}` : ''}
            </strong>
            , y el correo que lo prueba.
          </p>
        </div>
        {!a && (
          <button
            onClick={() => setAbierto(v => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: INSTITUTIONAL }}
          >
            <Plus size={13} /> {abierto ? 'Cerrar' : 'Registrar'}
          </button>
        )}
      </div>

      {!a && !abierto && (
        <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-5 text-center text-[12px] text-neutral-400">
          Sin autorización registrada.
        </p>
      )}

      {!a && abierto && (
        <div className="grid grid-cols-1 gap-3 rounded-xl bg-neutral-50/60 p-4 sm:grid-cols-2">
          <div>
            <label className={label}>Nombre del jefe *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Correo del jefe *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Cargo</label>
            <input value={cargo} onChange={e => setCargo(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Fecha de la autorización *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Observaciones</label>
            <input
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              maxLength={300}
              className={input}
            />
          </div>
          <div className="flex items-end justify-end sm:col-span-2">
            <button
              onClick={registrar}
              disabled={guardando}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: INSTITUTIONAL }}
            >
              {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Guardar autorización
            </button>
          </div>
          <p className="text-[11px] text-neutral-400 sm:col-span-2">
            La evidencia del correo se adjunta después de guardar.
          </p>
        </div>
      )}

      {a && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-neutral-800">{a.aprobadorNombre}</p>
              <p className="text-[11px] text-neutral-500">
                {[a.aprobadorCargo, a.aprobadorEmail].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                Autorizó el {fmtFecha(a.fechaAprobacion)}
              </p>
              {a.observaciones && (
                <p className="mt-1 text-[11px] text-neutral-500">{a.observaciones}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {a.tieneEvidencia ? (
                <button
                  onClick={() => descargarArchivoConNombreDelServidor(
                    `/evaluadores/aprobaciones/${a.aprobacionId}/evidencia`,
                    `autorizacion-${detalle.anio}`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  <Download size={12} /> Ver el correo
                </button>
              ) : (
                <button
                  onClick={() => archivoRef.current?.click()}
                  disabled={subiendo}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-50"
                >
                  {subiendo ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Adjuntar el correo
                </button>
              )}
              <button
                onClick={() => setConfirmBorrar(true)}
                title="Eliminar la autorización"
                className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          {!a.tieneEvidencia && (
            <p className="mt-2 text-[11px] text-amber-700">
              Falta el correo. Guárdelo desde Outlook (.msg en el de escritorio, .eml en el web)
              o adjunte el PDF impreso.
            </p>
          )}
          <input
            ref={archivoRef}
            type="file"
            accept=".msg,.eml,.html,.htm,.mht,.mhtml,.pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) subirEvidencia(f) }}
          />
        </div>
      )}

      <ConfirmModal
        open={confirmBorrar}
        onClose={() => setConfirmBorrar(false)}
        onConfirm={borrar}
        tipo="delete"
        titulo="Eliminar la autorización"
        mensaje={<>Se borra el registro y el correo adjunto. El hito del ciclo vuelve a apagarse.</>}
        textoConfirmar="Eliminar"
        cargando={guardando}
      />
    </div>
  )
}

function SubirDocumentoDelAnio({
  evaluadorId, detalle, setToast, onRecargar,
}: {
  evaluadorId: number
  detalle: Detalle
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  onRecargar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [tipos, setTipos] = useState<Array<{
    id: number; codigo: string; nombre: string
    extensiones?: string[]; esDelAnio?: boolean; admiteMultiple?: boolean
  }>>([])
  const [tipoSel, setTipoSel] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const archivoRef = useRef<HTMLInputElement>(null)

  const label = 'block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
  const input = 'w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40'

  useEffect(() => {
    if (!abierto || tipos.length) return
    let vivo = true
    api.get<Array<{
      id: number; codigo: string; nombre: string
      extensiones?: string[]; esDelAnio?: boolean; admiteMultiple?: boolean
    }>>('/evaluadores/catalogos/tipos-documento-evaluador')
      .then(r => { if (vivo) setTipos(r.data ?? []) })
      .catch(() => { if (vivo) setToast({ tipo: 'error', msg: 'No se pudo cargar el catálogo de tipos' }) })
    return () => { vivo = false }
  }, [abierto, tipos.length, setToast])

  // La cédula y la tarjeta profesional son del perfil y de instancia única: cargarlas
  // desde un año borraba la que ya estaba en el perfil. Aquí no se ofrecen.
  const ofrecidos = tipos.filter(t => t.esDelAnio || t.admiteMultiple !== false)

  const tipo = ofrecidos.find(t => String(t.id) === tipoSel)
  const exts = tipo?.extensiones?.length ? tipo.extensiones : ['pdf']

  async function subir() {
    if (!tipoSel) return setToast({ tipo: 'error', msg: 'Escoja el tipo de documento' })
    if (!archivo) return setToast({ tipo: 'error', msg: 'Escoja el archivo' })

    // se comprueba aquí para nombrar el tipo; el servidor solo devuelve un 400
    const ext = (archivo.name.split('.').pop() ?? '').toLowerCase()
    if (!exts.includes(ext)) {
      return setToast({
        tipo: 'error',
        msg: `"${tipo?.nombre}" admite ${exts.map(e => '.' + e).join(', ')}; el archivo es .${ext || 'sin extensión'}`,
      })
    }
    if (archivo.size > 8 * 1024 * 1024) {
      return setToast({ tipo: 'error', msg: 'El archivo supera los 8 MB' })
    }

    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      fd.append('tipoDocumentoEvalId', tipoSel)
      // sin participacionId el documento queda permanente y sale en todos los años
      fd.append('participacionId', String(detalle.participacionId))
      fd.append('anioReferencia', String(detalle.anio))
      if (descripcion.trim()) fd.append('descripcion', descripcion.trim())
      await api.post(`/evaluadores/${evaluadorId}/documentos`, fd)

      setToast({ tipo: 'success', msg: `Documento cargado en el ciclo ${detalle.anio}` })
      setAbierto(false); setTipoSel(''); setDescripcion(''); setArchivo(null)
      if (archivoRef.current) archivoRef.current.value = ''
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo cargar el documento') })
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-600">
            Documentos de este año
          </p>
          <p className="text-[11px] text-neutral-400">
            El acuerdo de confidencialidad y demás soportes de{' '}
            <strong className="text-neutral-500">
              {detalle.anio}{detalle.periodo ? `-${detalle.periodo}` : ''}
              {detalle.convocatoriaNombre ? ` · ${detalle.convocatoriaNombre}` : ''}
            </strong>
            .
          </p>
        </div>
        <button
          onClick={() => setAbierto(v => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: INSTITUTIONAL }}
        >
          <Plus size={13} /> {abierto ? 'Cerrar' : 'Cargar documento'}
        </button>
      </div>

      {abierto && (
        <div className="grid grid-cols-1 gap-3 rounded-xl bg-neutral-50/60 p-4 sm:grid-cols-2">
          <div>
            <label className={label}>Tipo de documento *</label>
            <select value={tipoSel} onChange={e => setTipoSel(e.target.value)} className={input}>
              <option value="">— Escoja el tipo —</option>
              {ofrecidos.map(t => <option key={t.id} value={String(t.id)}>{t.nombre}</option>)}
            </select>
            <p className="mt-1 text-[10px] text-neutral-400">
              La cédula y demás documentos del perfil se cargan en la pestaña Perfil, no aquí.
            </p>
          </div>
          <div>
            <label className={label}>
              Archivo * ({exts.map(e => e.toUpperCase()).join(', ')}, máx. 8 MB)
            </label>
            <input
              ref={archivoRef}
              type="file"
              accept={exts.map(e => '.' + e).join(',')}
              onChange={e => setArchivo(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-neutral-700 hover:file:bg-neutral-200"
            />
            {archivo && (
              <p className="mt-1 truncate text-[11px] text-neutral-500">
                {archivo.name} · {(archivo.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Descripción</label>
            <input
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              maxLength={300}
              className={input}
            />
          </div>
          <div className="flex items-end justify-end sm:col-span-2">
            <button
              onClick={subir}
              disabled={subiendo}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: INSTITUTIONAL }}
            >
              {subiendo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Cargar en {detalle.anio}{detalle.periodo ? `-${detalle.periodo}` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TabDocumentos({
  evaluadorId, detalle, setToast, onRecargar,
}: {
  evaluadorId: number
  detalle: Detalle
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  onRecargar: () => void
}) {
  const { propios, heredados, permanentes } = detalle.documentos
  const [porBorrar, setPorBorrar] = useState<Documento | null>(null)
  const [borrando, setBorrando] = useState(false)

  async function borrar() {
    if (!porBorrar) return
    setBorrando(true)
    try {
      await api.delete(`/evaluadores/documentos/${porBorrar.documentoId}`)
      setToast({ tipo: 'success', msg: 'Documento eliminado' })
      setPorBorrar(null)
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo eliminar el documento') })
    } finally {
      setBorrando(false)
    }
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-100">
      <BloqueAutorizacion detalle={detalle} setToast={setToast} onRecargar={onRecargar} />
      <SubirDocumentoDelAnio
        evaluadorId={evaluadorId}
        detalle={detalle}
        setToast={setToast}
        onRecargar={onRecargar}
      />
      <BloqueDocs
        titulo="Propios del año"
        ayuda="Cargados para este evaluador en este ciclo."
        docs={propios}
        rutaBase="/evaluadores/documentos"
        setToast={setToast}
        onBorrar={setPorBorrar}
      />
      <BloqueDocs
        titulo={`Documentos de la convocatoria${detalle.convocatoriaNombre ? ` · ${detalle.convocatoriaNombre}` : ''}`}
        ayuda="Un solo archivo compartido por todos los evaluadores del ciclo. Se gestiona desde Convocatorias."
        docs={heredados}
        rutaBase="/evaluadores/convocatorias/documentos"
        setToast={setToast}
      />
      <BloqueDocs
        titulo="Permanentes"
        ayuda="Documentos personales del evaluador, no atados a ningún año."
        docs={permanentes}
        rutaBase="/evaluadores/documentos"
        setToast={setToast}
        onBorrar={setPorBorrar}
      />

      <ConfirmModal
        open={!!porBorrar}
        tipo="delete"
        titulo="Eliminar documento"
        mensaje={
          porBorrar
            ? `Se va a eliminar "${porBorrar.descripcion || porBorrar.archivoNombre || porBorrar.tipoNombre}". El archivo no se puede recuperar.`
            : ''
        }
        textoConfirmar="Eliminar"
        cargando={borrando}
        onConfirm={borrar}
        onClose={() => setPorBorrar(null)}
      />
    </div>
  )
}

// sin onBorrar en los heredados: son un archivo único compartido por todo el ciclo
function BloqueDocs({
  titulo, ayuda, docs, rutaBase, setToast, onBorrar,
}: {
  titulo: string
  ayuda: string
  docs: Documento[]
  rutaBase: string
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  onBorrar?: (d: Documento) => void
}) {
  if (!docs.length) return null

  const etiqueta = (d: Documento) =>
    d.ambito === 'HEREDADO' ? 'De la convocatoria' : d.ambito === 'PERMANENTE' ? 'Permanente' : null

  return (
    <div className="px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-600">{titulo}</p>
      <p className="mb-3 text-[11px] text-neutral-400">{ayuda}</p>
      <ul className="flex flex-col gap-1.5">
        {docs.map(d => (
          <li key={`${d.ambito}-${d.documentoId}`} className="flex items-center gap-3 rounded-xl border border-neutral-100 px-3 py-2">
            <FileText size={15} className="shrink-0 text-neutral-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-neutral-800">
                {d.descripcion || d.archivoNombre || d.tipoNombre}
              </p>
              <p className="truncate text-[11px] text-neutral-500">{d.tipoNombre}</p>
            </div>
            {etiqueta(d) && (
              <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-500">
                {etiqueta(d)}
              </span>
            )}
            <BotonesArchivo
              verUrl={`${rutaBase}/${d.documentoId}/archivo`}
              descargarUrl={`${rutaBase}/${d.documentoId}/descargar`}
              nombreFallback={d.archivoNombre || `${d.tipoCodigo}.pdf`}
              setToast={setToast}
            />
            {onBorrar && (
              <button
                onClick={() => onBorrar(d)}
                title="Eliminar este documento"
                className="shrink-0 rounded-lg border border-neutral-200 p-1.5 text-neutral-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={13} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// extensiones que el navegador dibuja; al resto las baja con el uuid del blob por nombre
const SE_PUEDE_VER = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'txt']

function sePuedeVer(nombre: string): boolean {
  const ext = nombre.toLowerCase().split('.').pop() ?? ''
  return SE_PUEDE_VER.includes(ext)
}

function BotonesArchivo({
  verUrl, descargarUrl, nombreFallback = 'archivo', setToast,
}: {
  verUrl: string
  descargarUrl: string
  /** Se usa solo si el backend no manda nombre en el Content-Disposition. */
  nombreFallback?: string
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
}) {
  const [ocupado, setOcupado] = useState<'ver' | 'bajar' | null>(null)
  const verSirve = sePuedeVer(nombreFallback)

  async function accion(tipo: 'ver' | 'bajar') {
    setOcupado(tipo)
    try {
      if (tipo === 'ver') await abrirArchivo(verUrl)
      else await descargarArchivoConNombreDelServidor(descargarUrl, nombreFallback)
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo abrir el archivo') })
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="flex shrink-0 gap-1">
      {verSirve && (
        <button
          onClick={() => accion('ver')}
          disabled={ocupado != null}
          className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-[#00304D] disabled:opacity-50"
          title="Ver"
        >
          {ocupado === 'ver' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
        </button>
      )}
      <button
        onClick={() => accion('bajar')}
        disabled={ocupado != null}
        className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-[#00304D] disabled:opacity-50"
        title="Descargar"
      >
        {ocupado === 'bajar' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      </button>
    </div>
  )
}

// "aprobado" no se pide: lo deriva el backend contra la nota de corte del ciclo
function FormularioCurso({
  detalle, setToast, onRecargar, onCerrar, editando,
}: {
  detalle: Detalle
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  onRecargar: () => void
  onCerrar: () => void
  editando?: Detalle['capacitaciones'][number] | null
}) {
  const soloFecha = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '')
  const [nombre, setNombre] = useState(editando?.nombre ?? '')
  const [plataforma, setPlataforma] = useState(editando?.plataforma ?? '')
  const [horas, setHoras] = useState(editando?.horas != null ? String(editando.horas) : '')
  const [fechaInicio, setFechaInicio] = useState(soloFecha(editando?.fechaInicio))
  const [fechaFin, setFechaFin] = useState(soloFecha(editando?.fechaFin))
  const [calificacion, setCalificacion] = useState(
    editando?.calificacion != null ? String(editando.calificacion) : '')
  const [observaciones, setObservaciones] = useState(editando?.observaciones ?? '')
  const [guardando, setGuardando] = useState(false)

  const label = 'block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
  const input = 'w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40'

  /** Lo mismo que valida el backend, para no gastar un viaje en decirlo. */
  function problema(): string | null {
    if (!nombre.trim()) return 'El nombre del curso es obligatorio'
    if (horas && (!Number.isFinite(Number(horas)) || Number(horas) <= 0)) {
      return 'Las horas deben ser un número mayor que cero'
    }
    if (calificacion) {
      const n = Number(calificacion)
      if (!Number.isFinite(n) || n < 0 || n > 5) return 'La calificación va de 0 a 5'
    }
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      return 'La fecha de fin no puede ser anterior a la de inicio'
    }
    return null
  }

  async function guardar() {
    const mal = problema()
    if (mal) return setToast({ tipo: 'error', msg: mal })
    setGuardando(true)
    try {
      const datos = {
        nombre: nombre.trim(),
        plataforma: plataforma.trim() || null,
        horas: horas ? Number(horas) : null,
        fechaInicio: fechaInicio || null,
        fechaFin: fechaFin || null,
        calificacion: calificacion ? Number(calificacion) : null,
        observaciones: observaciones.trim() || null,
      }
      if (editando) {
        await api.put(`/evaluadores/capacitaciones/${editando.capacitacionId}`, datos)
      } else {
        await api.post(`/evaluadores/participaciones/${detalle.participacionId}/capacitacion`,
          { ...datos, origen: 'EXTERNO' })
      }
      setToast({ tipo: 'success', msg: editando ? 'Curso actualizado' : 'Curso registrado' })
      onCerrar()
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo registrar el curso') })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mb-3 grid grid-cols-1 gap-3 rounded-xl bg-neutral-50/60 p-4 sm:grid-cols-3">
      <div className="sm:col-span-2">
        <label className={label}>Nombre del curso *</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} maxLength={200} className={input} />
      </div>
      <div>
        <label className={label}>Plataforma</label>
        <input
          value={plataforma}
          onChange={e => setPlataforma(e.target.value)}
          placeholder="Sofia Plus, Territorium…"
          maxLength={100}
          className={input}
        />
      </div>
      <div>
        <label className={label}>Horas</label>
        <input type="number" min={1} value={horas} onChange={e => setHoras(e.target.value)} className={input} />
      </div>
      <div>
        <label className={label}>Fecha de inicio</label>
        <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className={input} />
      </div>
      <div>
        <label className={label}>Fecha de fin</label>
        <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className={input} />
      </div>
      <div>
        <label className={label}>Calificación (0 a 5)</label>
        <input
          type="number" step="0.1" min={0} max={5}
          value={calificacion}
          onChange={e => setCalificacion(e.target.value)}
          className={input}
        />
        <p className="mt-1 text-[10px] text-neutral-400">
          Aprobado se calcula solo, contra la nota de corte del ciclo.
        </p>
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Observaciones</label>
        <input
          value={observaciones}
          onChange={e => setObservaciones(e.target.value)}
          maxLength={300}
          className={input}
        />
      </div>
      {detalle.corteCurso == null && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800 sm:col-span-3">
          Este ciclo todavía no tiene <strong>calificación mínima del curso</strong>. El curso se
          guarda igual, pero quedará como &quot;no aprobado&quot; y el hito no se encenderá hasta que
          la defina en las reglas de la convocatoria.
        </p>
      )}
      <div className="flex items-end justify-end gap-2 sm:col-span-3">
        <button
          onClick={onCerrar}
          disabled={guardando}
          className="rounded-lg bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={guardando}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: INSTITUTIONAL }}
        >
          {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Guardar curso
        </button>
      </div>
    </div>
  )
}

function TabFormacion({
  detalle, setToast, onRecargar,
}: {
  detalle: Detalle
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  onRecargar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [destino, setDestino] = useState<number | null>(null)
  const [editando, setEditando] = useState<Detalle['capacitaciones'][number] | null>(null)
  const archivoRef = useRef<HTMLInputElement>(null)

  async function subirCertificado(capacitacionId: number, archivo: File) {
    setOcupado(capacitacionId)
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      await api.post(`/evaluadores/capacitaciones/${capacitacionId}/certificado`, fd)
      setToast({ tipo: 'success', msg: 'Certificado del curso cargado' })
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo cargar el certificado') })
    } finally {
      setOcupado(null); setDestino(null)
      if (archivoRef.current) archivoRef.current.value = ''
    }
  }

  async function eliminarCurso(capacitacionId: number) {
    setOcupado(capacitacionId)
    try {
      await api.delete(`/evaluadores/capacitaciones/${capacitacionId}`)
      setToast({ tipo: 'success', msg: 'Curso eliminado' })
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo eliminar') })
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-100">
      <div className="px-5 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-600">
              Curso de formación
            </p>
            <p className="text-[11px] text-neutral-400">
              El curso que habilita a evaluar en este ciclo, con su nota.
            </p>
          </div>
          <button
            onClick={() => setAbierto(v => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: INSTITUTIONAL }}
          >
            <Plus size={13} /> {abierto ? 'Cerrar' : 'Registrar curso'}
          </button>
        </div>

        {abierto && (
          <FormularioCurso
            key={editando?.capacitacionId ?? 'nuevo'}
            detalle={detalle}
            setToast={setToast}
            onRecargar={onRecargar}
            onCerrar={() => { setAbierto(false); setEditando(null) }}
            editando={editando}
          />
        )}

        <input
          ref={archivoRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f && destino != null) subirCertificado(destino, f)
          }}
        />

        {detalle.capacitaciones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-5 text-center text-[12px] text-neutral-400">
            Sin curso registrado en este ciclo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detalle.capacitaciones.map(c => (
              <li key={c.capacitacionId} className="flex items-center gap-3 rounded-xl border border-neutral-100 px-3 py-2.5">
                <Award size={16} className={
                  c.aprobado ? 'text-emerald-600'
                    : c.calificacionMinima == null ? 'text-amber-500' : 'text-neutral-300'
                } />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-neutral-800">{c.nombre}</p>
                  <p className="text-[11px] text-neutral-500">
                    {[c.plataforma, c.horas ? `${c.horas} h` : null].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums" style={{ color: PRIMARY }}>
                    {c.calificacion ?? '—'}
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    {c.calificacionMinima != null ? `mín. ${c.calificacionMinima}` : 'sin corte'}
                  </p>
                </div>
                {/* sin nota de corte no es "no aprobado": falta configurar el ciclo */}
                {c.calificacionMinima == null ? (
                  <span
                    title="Este ciclo no tiene calificación mínima. Se define en las reglas de la convocatoria."
                    className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800"
                  >
                    Falta la nota de corte
                  </span>
                ) : (
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    c.aprobado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {c.aprobado ? 'Aprobado' : 'No aprobado'}
                  </span>
                )}
                {c.tieneArchivo ? (
                  <BotonesArchivo
                    verUrl={`/evaluadores/capacitaciones/${c.capacitacionId}/certificado`}
                    descargarUrl={`/evaluadores/capacitaciones/${c.capacitacionId}/certificado`}
                    nombreFallback={`certificado-curso-${c.capacitacionId}.pdf`}
                    setToast={setToast}
                  />
                ) : (
                  <button
                    onClick={() => { setDestino(c.capacitacionId); archivoRef.current?.click() }}
                    disabled={ocupado === c.capacitacionId}
                    title="Adjuntar el certificado del curso"
                    className="shrink-0 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-[10px] font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-50"
                  >
                    {ocupado === c.capacitacionId
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Upload size={12} />}
                  </button>
                )}
                <button
                  onClick={() => { setEditando(c); setAbierto(true) }}
                  title="Corregir este curso"
                  className="shrink-0 rounded-lg border border-neutral-200 p-1.5 text-neutral-400 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => eliminarCurso(c.capacitacionId)}
                  disabled={ocupado === c.capacitacionId}
                  title="Eliminar el curso"
                  className="shrink-0 rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {detalle.pruebas.length > 0 && (
        <div className="px-5 py-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-neutral-600">
            Prueba de conocimiento
          </p>
          <ul className="flex flex-col gap-2">
            {detalle.pruebas.map(p => (
              <li key={p.pruebaId} className="flex items-center gap-3 rounded-xl border border-neutral-100 px-3 py-2.5">
                <ClipboardList size={16} className={p.aprobada ? 'text-emerald-600' : 'text-neutral-300'} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-neutral-800">
                    {/* PUNTAJEMINIMO es un corte porcentual: lo que se compara con
                        él es la efectividad, no los aciertos */}
                    {p.efectividad != null ? `Efectividad ${p.efectividad}%` : `Puntaje ${p.puntajeMayor ?? '—'}`}
                    {p.puntajeMinimo != null && (
                      <span className="text-[11px] font-normal text-neutral-500"> · mínimo {p.puntajeMinimo}%</span>
                    )}
                    {p.efectividad != null && p.puntajeMayor != null && (
                      <span className="text-[11px] font-normal text-neutral-400"> · {p.puntajeMayor} aciertos</span>
                    )}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {[fmtFecha(p.fechaPresentacion), p.intentos != null ? `${p.intentos} intentos` : null]
                      .filter(v => v && v !== '—').join(' · ') || '—'}
                  </p>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  p.aprobada ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'
                }`}>
                  {p.aprobada ? 'Aprobada' : 'No aprobada'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// para proyectos que no existen en el SEP; quedan marcados como "histórico"
function ManualProyecto({
  participacionId, sugerido, setToast, onRecargar,
}: {
  participacionId: number
  sugerido: string
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  onRecargar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [razonSocial, setRazonSocial] = useState('')
  const [nit, setNit] = useState('')
  const [nombreProyecto, setNombreProyecto] = useState('')
  const [guardando, setGuardando] = useState(false)

  const label = 'block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
  const input = 'w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40'

  function abrir() {
    // lo tecleado en el buscador suele ser la empresa: se arrastra
    if (!abierto && !razonSocial) setRazonSocial(sugerido.trim())
    setAbierto(v => !v)
  }

  async function guardar() {
    if (!razonSocial.trim() && !nombreProyecto.trim()) {
      return setToast({ tipo: 'error', msg: 'Escriba al menos el proponente o el nombre del proyecto' })
    }
    if (nit.trim() && !/^[\d.\-\s]{5,20}$/.test(nit.trim())) {
      return setToast({ tipo: 'error', msg: 'El NIT solo lleva números, puntos o guiones' })
    }
    setGuardando(true)
    try {
      await api.post(`/evaluadores/participaciones/${participacionId}/proyectos`, {
        razonSocial: razonSocial.trim() || null,
        nit: nit.trim() || null,
        nombreProyecto: nombreProyecto.trim() || null,
      })
      setToast({ tipo: 'success', msg: 'Proyecto registrado a mano' })
      setAbierto(false); setRazonSocial(''); setNit(''); setNombreProyecto('')
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo registrar el proyecto') })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mt-3 border-t border-dashed border-neutral-200 pt-3">
      <button
        onClick={abrir}
        className="text-[11px] font-semibold text-[#00304D] underline underline-offset-2 transition hover:opacity-70"
      >
        {abierto ? 'Cancelar' : '¿No está en la lista? Regístrelo a mano'}
      </button>

      {abierto && (
        <div className="mt-2 grid grid-cols-1 gap-3 rounded-xl bg-white p-3 ring-1 ring-neutral-200 sm:grid-cols-3">
          <div className="sm:col-span-2">
            {/* "Proponente" y no "empresa": así se llama en el resto del SEP */}
            <label className={label}>Proponente *</label>
            <input
              value={razonSocial}
              onChange={e => setRazonSocial(e.target.value)}
              placeholder="Cámara de Comercio de…"
              maxLength={300}
              className={input}
            />
          </div>
          <div>
            <label className={label}>NIT</label>
            <input value={nit} onChange={e => setNit(e.target.value)} maxLength={20} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Nombre o código del proyecto</label>
            <input
              value={nombreProyecto}
              onChange={e => setNombreProyecto(e.target.value)}
              maxLength={300}
              className={input}
            />
          </div>
          <div className="flex items-end justify-end">
            <button
              onClick={guardar}
              disabled={guardando}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: INSTITUTIONAL }}
            >
              {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Registrar
            </button>
          </div>
          <p className="text-[11px] text-neutral-400 sm:col-span-3">
            Queda marcado como <strong>Histórico</strong>: no apunta a un proyecto del SEP, así que
            se distingue de los que sí están cargados. Úselo solo cuando el proyecto de verdad no
            exista en el sistema.
          </p>
        </div>
      )}
    </div>
  )
}

const ORIGEN_PROYECTO: Record<string, { texto: string; clase: string }> = {
  PROYECTO:  { texto: 'Ejecutado', clase: 'bg-emerald-100 text-emerald-700' },
  FORMULADO: { texto: 'Formulado', clase: 'bg-cyan-100 text-cyan-700' },
  HISTORICO: { texto: 'Histórico', clase: 'bg-neutral-100 text-neutral-600' },
}

interface ProyectoCandidato {
  proyectoId: number | null
  guardadoId: number | null
  nit: string | null
  razonSocial: string | null
  nombreProyecto: string | null
  anio: number | null
  origen: string
}
interface RespProyectos {
  convocatoria: { id: number; nombre: string | null } | null
  motivo: string | null
  items: ProyectoCandidato[]
}

// los candidatos salen acotados a la convocatoria del ciclo
function TabProyectos({
  detalle, setToast, onRecargar,
}: {
  detalle: Detalle
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  onRecargar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [resp, setResp] = useState<RespProyectos | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [quitando, setQuitando] = useState<number | null>(null)

  const pid = detalle.participacionId

  // con la convocatoria puesta la lista sale sin escribir nada
  useEffect(() => {
    if (!abierto) return
    let vivo = true
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const r = await api.get<RespProyectos>('/evaluadores/buscar-proyectos', {
          params: { q: busqueda.trim(), participacionId: pid, limit: 60 },
        })
        if (vivo) setResp(r.data)
      } catch (err) {
        if (vivo) setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo buscar proyectos') })
      } finally {
        if (vivo) setBuscando(false)
      }
    }, 350)
    return () => { vivo = false; clearTimeout(t) }
  }, [abierto, busqueda, pid, setToast])

  const yaEsta = (c: ProyectoCandidato) => detalle.proyectos.some(p =>
    (c.proyectoId != null && p.proyectoId === c.proyectoId) ||
    (c.guardadoId != null && p.guardadoId === c.guardadoId))

  async function agregar(c: ProyectoCandidato) {
    const clave = `${c.proyectoId ?? 'g'}-${c.guardadoId ?? 'p'}`
    setGuardando(clave)
    try {
      await api.post(`/evaluadores/participaciones/${pid}/proyectos`, {
        proyectoId: c.proyectoId, guardadoId: c.guardadoId,
      })
      setToast({ tipo: 'success', msg: 'Proyecto agregado al ciclo' })
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo agregar el proyecto') })
    } finally {
      setGuardando(null)
    }
  }

  async function quitar(partProyectoId: number) {
    setQuitando(partProyectoId)
    try {
      await api.delete(`/evaluadores/proyectos-evaluados/${partProyectoId}`)
      setToast({ tipo: 'success', msg: 'Proyecto retirado del ciclo' })
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo retirar') })
    } finally {
      setQuitando(null)
    }
  }

  const etiqueta = (c: { nombreProyecto: string | null; razonSocial: string | null }) =>
    // el nombre del proyecto viene vacío en casi todos: identifica más la empresa
    c.razonSocial || c.nombreProyecto || 'Sin identificar'

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
        <p className="text-[12px] text-neutral-500">
          {detalle.proyectos.length === 0
            ? 'Sin proyectos registrados en este ciclo.'
            : `${detalle.proyectos.length} proyecto(s) evaluado(s)`}
        </p>
        <button
          onClick={() => setAbierto(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: INSTITUTIONAL }}
        >
          <Plus size={13} />
          {abierto ? 'Cerrar' : 'Agregar proyecto'}
        </button>
      </div>

      {abierto && (
        <div className="border-b border-neutral-100 bg-neutral-50/60 px-5 py-4">
          {resp?.convocatoria && (
            <p className="mb-2 text-[11px] text-neutral-500">
              Proyectos de <strong>{resp.convocatoria.nombre}</strong>. Puede escribir el número,
              por ejemplo <span className="font-mono font-semibold">1541</span>.
            </p>
          )}
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Número del proyecto, proponente, NIT o nombre..."
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
          />

          {buscando && (
            <p className="mt-3 flex items-center gap-2 text-[12px] text-neutral-500">
              <Loader2 size={13} className="animate-spin" /> Buscando...
            </p>
          )}

          {!buscando && resp?.motivo && (
            <p className="mt-3 text-[12px] text-amber-800">{resp.motivo}</p>
          )}

          {!buscando && (
            <ManualProyecto
              participacionId={pid}
              sugerido={busqueda}
              setToast={setToast}
              onRecargar={onRecargar}
            />
          )}

          {!buscando && resp && resp.items.length > 0 && (
            <ul className="mt-3 max-h-72 divide-y divide-neutral-100 overflow-y-auto rounded-xl border border-neutral-200 bg-white">
              {resp.items.map(c => {
                const clave = `${c.proyectoId ?? 'g'}-${c.guardadoId ?? 'p'}`
                const puesto = yaEsta(c)
                return (
                  <li key={clave} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-neutral-800">
                        <span className="font-mono font-bold" style={{ color: PRIMARY }}>
                          {c.proyectoId ?? c.guardadoId}
                        </span>
                        {' · '}{etiqueta(c)}
                      </p>
                      <p className="truncate text-[11px] text-neutral-500">
                        {[c.nombreProyecto, c.nit, c.anio].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <button
                      onClick={() => agregar(c)}
                      disabled={puesto || guardando === clave}
                      className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
                    >
                      {guardando === clave
                        ? <Loader2 size={12} className="animate-spin" />
                        : puesto ? 'Ya está' : 'Agregar'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {detalle.proyectos.length > 0 && (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {detalle.proyectos.map(p => {
            const o = ORIGEN_PROYECTO[p.origen] ?? ORIGEN_PROYECTO.HISTORICO
            return (
              <li key={p.partProyectoId} className="flex items-center gap-3 px-5 py-3">
                <Briefcase size={15} className="shrink-0 text-neutral-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-neutral-800">
                    {p.razonSocial || p.nombreProyecto || 'Sin identificar'}
                  </p>
                  <p className="truncate text-[11px] text-neutral-500">
                    {[p.nit, p.nombreProyecto].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                {p.puntajeOtorgado != null && (
                  <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: PRIMARY }}>
                    {p.puntajeOtorgado}
                  </span>
                )}
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${o.clase}`}>
                  {o.texto}
                </span>
                <button
                  onClick={() => quitar(p.partProyectoId)}
                  disabled={quitando === p.partProyectoId}
                  title="Retirar del ciclo"
                  className="shrink-0 rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                >
                  {quitando === p.partProyectoId
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Trash2 size={13} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function TabRetroalimentacion({
  detalle, onRecargar,
}: { detalle: Detalle; onRecargar: () => void }) {
  return (
    <>
      <ResumenRetroalimentacion detalle={detalle} />
      <CargueRetroHistorica
        participacionId={detalle.participacionId}
        anio={detalle.anio}
        onRecargar={onRecargar}
      />
    </>
  )
}

function ResumenRetroalimentacion({ detalle }: { detalle: Detalle }) {
  const r = detalle.retroalimentacion

  // el instrumento en línea existe desde 2026: lo anterior se transcribe abajo
  if (r.recibidas === 0 && detalle.anio < 2026) {
    return (
      <Vacio texto={`Sin retroalimentación registrada en ${detalle.anio}. Abajo se puede cargar la de la hoja de ese año.`} />
    )
  }
  if (r.recibidas === 0 && r.asignadas === 0) {
    // la matriz se arma para todo el ciclo, por eso se enlaza a la convocatoria
    return (
      <div className="px-5 py-8 text-center">
        <MessageSquareQuote size={26} className="mx-auto text-neutral-300" />
        <p className="mt-3 text-[13px] font-semibold text-neutral-600">
          Todavía no se ha generado la matriz de este ciclo
        </p>
        <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-500">
          La matriz se arma para todo el ciclo de una vez —define quién retroalimenta a quién—,
          así que no se genera desde aquí sino desde la convocatoria.
        </p>
        {detalle.convocatoriaId ? (
          <Link
            href={`/panel/evaluadores/convocatorias/${detalle.convocatoriaId}/matriz`}
            className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90"
            style={{ backgroundColor: INSTITUTIONAL }}
          >
            <MessageSquareQuote size={15} />
            Ir a la retroalimentación del ciclo
          </Link>
        ) : (
          <p className="mt-4 text-[12px] text-amber-700">
            Este ciclo no está atado a una convocatoria, así que no puede entrar en la matriz.
            Corrija la participación desde &quot;Historial de participaciones&quot;.
          </p>
        )}
      </div>
    )
  }

  // el ciclo en línea reparte asignaciones; el histórico no, y ahí esas tarjetas sobran
  const enLinea = r.asignadas > 0
  // "de una sola persona" solo si de verdad hay una. Con dos notas iguales el
  // rango es null, y antes eso caía en ese literal: con el dinamizador, dos notas
  // idénticas dejaron de ser raras (11 de las 12 respuestas de 2025 son un 5).
  const rango = r.minimo != null && r.maximo != null && r.minimo !== r.maximo
    ? `de ${r.minimo} a ${r.maximo}`
    : r.recibidas === 1
      ? 'de una sola persona'
      : `${r.recibidas} calificaciones`

  return (
    <div className={`grid grid-cols-1 gap-4 px-5 py-4 ${enLinea ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      <Tarjeta
        icono={<BadgeCheck size={16} className="text-emerald-600" />}
        titulo="Promedio recibido"
        valor={r.promedio != null ? `${r.promedio} / 5` : '—'}
        sub={rango}
      />
      <Tarjeta
        icono={<Users size={16} className="text-cyan-600" />}
        titulo="Quiénes lo retroalimentaron"
        valor={String(r.recibidas)}
        // ya no son solo los del ciclo: el dinamizador GGPC también cuenta aquí
        sub={r.recibidas === 1 ? 'retroalimentación' : 'retroalimentaciones'}
      />
      {enLinea && (
        <Tarjeta
          icono={<ShieldCheck size={16} className={r.pendientes === 0 ? 'text-emerald-600' : 'text-amber-600'} />}
          titulo="Le tocaba retroalimentar"
          valor={`${r.asignadas - r.pendientes} / ${r.asignadas}`}
          sub={r.pendientes === 0 ? 'las completó todas' : `le faltan ${r.pendientes}`}
        />
      )}
      <p className={`text-[11px] text-neutral-400 ${enLinea ? 'sm:col-span-3' : 'sm:col-span-2'}`}>
        Abajo está el detalle de quién se la hizo y con qué nota. Esos nombres solo los ve
        gestión: al evaluador la hoja le llega anónima.
      </p>
    </div>
  )
}

function Tarjeta({
  icono, titulo, valor, sub,
}: { icono: React.ReactNode; titulo: string; valor: string; sub: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 px-4 py-3">
      <div className="flex items-center gap-1.5">
        {icono}
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{titulo}</p>
      </div>
      <p className="mt-1 text-xl font-bold leading-none" style={{ color: PRIMARY }}>{valor}</p>
      <p className="mt-1 text-[11px] text-neutral-500">{sub}</p>
    </div>
  )
}

// se archiva como documento del ciclo: no entra al registro de consecutivos
function SubirCertificadoExistente({
  evaluadorId, participacionId, anio, setToast, onRecargar,
}: {
  evaluadorId: number
  participacionId: number
  anio: number
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  onRecargar: () => void
}) {
  const [subiendo, setSubiendo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function subir(archivo: File) {
    setSubiendo(true)
    try {
      const tipos = await api.get<Array<{ id: number; codigo: string }>>(
        '/evaluadores/catalogos/tipos-documento-evaluador')
      const tipo = tipos.data.find(t => t.codigo === 'CERTIFICADO_PARTICIPACION')
      if (!tipo) throw new Error('Falta el tipo "Certificado de participación" en los catálogos')

      const fd = new FormData()
      fd.append('archivo', archivo)
      fd.append('tipoDocumentoEvalId', String(tipo.id))
      // sin participacionId se iría a permanentes y saldría en todos los años
      fd.append('participacionId', String(participacionId))
      fd.append('anioReferencia', String(anio))
      fd.append('descripcion', `Certificado de participación ${anio} (cargado)`)
      await api.post(`/evaluadores/${evaluadorId}/documentos`, fd)

      setToast({ tipo: 'success', msg: `Certificado de ${anio} archivado` })
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo cargar el certificado') })
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) subir(f) }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={subiendo}
        className="mt-2 inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
      >
        {subiendo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Cargar certificado existente (PDF)
      </button>
      <p className="mt-1.5 text-[11px] text-neutral-400">
        Se archiva tal cual, sin número consecutivo ni código de verificación:
        el SEP no lo emitió y no puede responder por uno.
      </p>
    </>
  )
}

/** Los certificados de años anteriores ya archivados en este ciclo. */
function CertificadosCargados({
  docs, anio, setToast, onRecargar,
}: {
  docs: Array<{ documentoId: number; archivoNombre: string | null; descripcion: string | null }>
  anio: number
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  onRecargar: () => void
}) {
  const [ocupado, setOcupado] = useState<number | null>(null)

  async function quitar(documentoId: number) {
    setOcupado(documentoId)
    try {
      await api.delete(`/evaluadores/documentos/${documentoId}`)
      setToast({ tipo: 'success', msg: 'Certificado retirado' })
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo retirar') })
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="mx-auto mb-5 max-w-md text-left">
      <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wide text-emerald-700">
        Certificado de {anio} archivado
      </p>
      {docs.map(d => (
        <div
          key={d.documentoId}
          className="mb-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3"
        >
          <BadgeCheck size={16} className="shrink-0 text-emerald-600" />
          <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-neutral-700">
            {d.archivoNombre || d.descripcion || 'Certificado cargado'}
          </p>
          <button
            onClick={() => descargarArchivoConNombreDelServidor(
              `/evaluadores/documentos/${d.documentoId}/descargar`, `certificado-${anio}.pdf`)}
            title="Descargar"
            className="shrink-0 rounded-lg p-1.5 text-neutral-500 transition hover:bg-white"
          >
            <Download size={14} />
          </button>
          <button
            onClick={() => quitar(d.documentoId)}
            disabled={ocupado === d.documentoId}
            title="Retirar"
            className="shrink-0 rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          >
            {ocupado === d.documentoId
              ? <Loader2 size={14} className="animate-spin" />
              : <Trash2 size={14} />}
          </button>
        </div>
      ))}
    </div>
  )
}

function TabCertificado({
  evaluadorId, detalle, setToast, onRecargar,
}: {
  evaluadorId: number
  detalle: Detalle
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
  onRecargar: () => void
}) {
  const [emitiendo, setEmitiendo] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [confirmEmitir, setConfirmEmitir] = useState(false)
  const [confirmAnular, setConfirmAnular] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [copiado, setCopiado] = useState(false)

  const cert = detalle.certificado
  const vigente = cert && !cert.anulado

  // se miran los dos sitios: muchos se cargaron como permanentes con el año marcado
  const cargados = [
    ...detalle.documentos.propios.filter(d => d.tipoCodigo === 'CERTIFICADO_PARTICIPACION'),
    ...detalle.documentos.permanentes.filter(
      d => d.tipoCodigo === 'CERTIFICADO_PARTICIPACION' && d.anioReferencia === detalle.anio),
  ]

  async function emitir() {
    setEmitiendo(true)
    try {
      const r = await api.post<{ consecutivo: number; anio: number }>(
        `/evaluadores/participaciones/${detalle.participacionId}/certificado`, {},
      )
      setToast({ tipo: 'success', msg: `Certificado ${r.data.anio}-${String(r.data.consecutivo).padStart(4, '0')} emitido` })
      setConfirmEmitir(false)
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo emitir el certificado') })
    } finally {
      setEmitiendo(false)
    }
  }

  async function anular() {
    if (!cert) return
    setEmitiendo(true)
    try {
      await api.put(`/evaluadores/certificados/${cert.certificadoId}/anular`, { motivo })
      setToast({ tipo: 'success', msg: 'Certificado anulado' })
      setConfirmAnular(false)
      setMotivo('')
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo anular') })
    } finally {
      setEmitiendo(false)
    }
  }

  async function descargar() {
    if (!cert) return
    setDescargando(true)
    try {
      await descargarArchivoConNombreDelServidor(
        `/evaluadores/certificados/${cert.certificadoId}/pdf`,
        `certificado-${detalle.anio}.pdf`,
      )
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo descargar el certificado') })
    } finally {
      setDescargando(false)
    }
  }

  if (!cert) {
    // los que este ciclo no puede cumplir no son pendientes: contarlos inflaba el
    // aviso con hitos que nadie podia encender
    const hitosPendientes = detalle.progreso.hitos.filter(
      h => !h.cumplido && h.aplica !== false && h.codigo !== 'CERTIFICADO')
    return (
      <div className="px-5 py-8 text-center">
        {cargados.length > 0 ? (
          <CertificadosCargados docs={cargados} anio={detalle.anio} setToast={setToast} onRecargar={onRecargar} />
        ) : (
          <>
            <Stamp size={28} className="mx-auto text-neutral-300" />
            <p className="mt-3 text-sm font-semibold text-neutral-600">Sin certificado emitido</p>
          </>
        )}
        <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-500">
          El certificado se genera desde el sistema con número consecutivo y código de verificación.
          {hitosPendientes.length > 0 && (
            <> Falta{hitosPendientes.length === 1 ? '' : 'n'}{' '}
            <strong>{hitosPendientes.map(h => h.nombre.toLowerCase()).join(', ')}</strong>; se puede
            emitir igual, pero conviene revisarlo{hitosPendientes.length === 1 ? '' : 's'}.</>
          )}
        </p>
        <button
          onClick={() => setConfirmEmitir(true)}
          disabled={emitiendo}
          className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: INSTITUTIONAL }}
        >
          {emitiendo ? <Loader2 size={15} className="animate-spin" /> : <Stamp size={15} />}
          Emitir certificado
        </button>

        {/* los años anteriores ya tienen certificado en papel: reemitir cambiaría su número */}
        <div className="mx-auto mt-6 max-w-md border-t border-neutral-100 pt-5">
          <p className="text-[12px] text-neutral-500">
            ¿El certificado de <strong>{detalle.anio}</strong> ya existe y solo hay que archivarlo?
          </p>
          <SubirCertificadoExistente
            evaluadorId={evaluadorId}
            participacionId={detalle.participacionId}
            anio={detalle.anio}
            setToast={setToast}
            onRecargar={onRecargar}
          />
        </div>

        <ConfirmModal
          open={confirmEmitir}
          onClose={() => setConfirmEmitir(false)}
          onConfirm={emitir}
          tipo="warning"
          titulo="Emitir certificado"
          mensaje={
            <>
              Se emitirá el certificado de <strong>{detalle.anio}</strong> con un número consecutivo
              oficial. Una vez emitido no se borra: si hay un error, se anula y el número no se
              reutiliza.
            </>
          }
          textoConfirmar="Emitir"
          cargando={emitiendo}
        />
      </div>
    )
  }

  const numero = `${detalle.anio}-${String(cert.consecutivo).padStart(4, '0')}`

  return (
    <div className="px-5 py-4">
      <div className={`rounded-2xl border px-5 py-4 ${
        vigente ? 'border-emerald-200 bg-emerald-50/50' : 'border-neutral-200 bg-neutral-50'
      }`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {vigente
                ? <BadgeCheck size={18} className="text-emerald-600" />
                : <XCircle size={18} className="text-neutral-400" />}
              <p className={`text-[10px] font-bold uppercase tracking-wide ${
                vigente ? 'text-emerald-700' : 'text-neutral-500'
              }`}>
                {vigente ? 'Certificado vigente' : 'Certificado anulado'}
              </p>
            </div>
            <p className="mt-1 font-mono text-xl font-bold" style={{ color: PRIMARY }}>{numero}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={descargar}
              disabled={descargando}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              {descargando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Descargar PDF
            </button>
            {vigente && (
              <button
                onClick={() => setConfirmAnular(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
              >
                <XCircle size={13} /> Anular
              </button>
            )}
            {!vigente && (
              <button
                onClick={() => setConfirmEmitir(true)}
                disabled={emitiendo}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: INSTITUTIONAL }}
              >
                {emitiendo ? <Loader2 size={13} className="animate-spin" /> : <Stamp size={13} />}
                Emitir uno nuevo
              </button>
            )}
          </div>
        </div>

        {!vigente && (
          <p className="mt-3 text-[12px] text-neutral-600">
            Este número queda anulado y no se reutiliza. El nuevo certificado
            llevará el siguiente consecutivo del año.
          </p>
        )}

        <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Código de verificación
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code className="select-all font-mono text-sm font-bold text-neutral-800">
              {cert.codigoVerificacion}
            </code>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(cert.codigoVerificacion)
                  setCopiado(true)
                  setTimeout(() => setCopiado(false), 2000)
                } catch {
                  setToast({ tipo: 'error', msg: 'El navegador no dejó copiar' })
                }
              }}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-neutral-500 transition hover:bg-neutral-100"
            >
              {copiado ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500">
            Con este código cualquiera puede validar el documento sin tener cuenta en el SEP.
          </p>
        </div>

        {!vigente && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-[12px] text-amber-900">
              Este certificado está anulado y la verificación pública lo reporta como tal.
              El consecutivo <strong>{numero}</strong> no se reutiliza: al reemitir se asigna uno nuevo.
            </p>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmAnular}
        onClose={() => { setConfirmAnular(false); setMotivo('') }}
        onConfirm={anular}
        tipo="delete"
        titulo="Anular certificado"
        mensaje={
          <div className="flex flex-col gap-2">
            <span>
              El certificado <strong>{numero}</strong> quedará marcado como anulado y quien lo valide
              con el código verá que ya no es válido. No se borra.
            </span>
            <input
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Motivo de la anulación (obligatorio)"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>
        }
        textoConfirmar="Anular"
        cargando={emitiendo}
      />

      <ConfirmModal
        open={confirmEmitir}
        onClose={() => setConfirmEmitir(false)}
        onConfirm={emitir}
        tipo="warning"
        titulo="Emitir un certificado nuevo"
        mensaje={
          <>
            El anterior (<strong>{numero}</strong>) queda anulado y su número no se reutiliza.
            El nuevo llevará el siguiente consecutivo de <strong>{detalle.anio}</strong>.
          </>
        }
        textoConfirmar="Emitir"
        cargando={emitiendo}
      />
    </div>
  )
}

function Vacio({ texto }: { texto: string }) {
  return <p className="px-5 py-8 text-center text-sm text-neutral-400">{texto}</p>
}

function VacioTotal() {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-12 text-center">
      <CalendarDays size={28} className="mx-auto text-neutral-300" />
      <p className="mt-3 text-sm font-semibold text-neutral-600">Este evaluador no tiene trayectoria todavía</p>
      <p className="mt-1 text-[12px] text-neutral-400">
        Registra una participación para empezar a construir su historial por año.
      </p>
      <p className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: PRIMARY }}>
        <Plus size={13} /> Se agrega desde el tab de participaciones
        <ChevronRight size={13} />
      </p>
    </div>
  )
}

function SoloHistorico() {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-12 text-center">
      <ClipboardList size={28} className="mx-auto text-neutral-300" />
      <p className="mt-3 text-sm font-semibold text-neutral-600">Solo hay pruebas sueltas</p>
      <p className="mt-1 text-[12px] text-neutral-400">
        Este evaluador tiene pruebas de conocimiento sin un ciclo asociado.
        Al crear la participación del año correspondiente, quedarán enlazadas.
      </p>
    </div>
  )
}

function mensajeError(err: unknown, porDefecto: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? porDefecto
}
