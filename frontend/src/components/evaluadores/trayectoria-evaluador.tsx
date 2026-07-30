'use client'

import api from '@/lib/api'
import { abrirArchivo, descargarArchivoConNombreDelServidor } from '@/lib/descargar-archivo'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import {
  AlertTriangle, Award, BadgeCheck, Briefcase, CalendarDays, Check, CheckCircle2,
  ChevronRight, Circle, ClipboardList, Copy, Download, Eye, FileText, FolderOpen,
  Loader2, MessageSquareQuote, Paperclip, Plus, ShieldCheck, Stamp, Users, XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

/* ────────────────────────────────────────────────────────────────────────────
 * Tipos — reflejan lo que devuelven /trayectoria, /resumen y /participaciones
 * ──────────────────────────────────────────────────────────────────────────── */

interface Hito { codigo: string; nombre: string; cumplido: boolean; detalle?: string | null }
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
  pruebaVigente: { anio: number; puntaje: number | null; aprobada: boolean; vigente: boolean } | null
}

interface Documento {
  documentoId: number
  tipoCodigo: string
  tipoNombre: string
  descripcion: string | null
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
  }>
  pruebas: Array<{
    pruebaId: number; anio: number; puntajeMayor: number | null
    puntajeMinimo: number | null; aprobada: boolean; fechaPresentacion: string | null
    intentos: number | null
  }>
  grupos: Array<{ partGrupoId: number; grupo: number; esPrincipal: boolean }>
  proyectos: Array<{
    partProyectoId: number; nombreProyecto: string | null; razonSocial: string | null
    nit: string | null; puntajeOtorgado: number | null; origen: string
  }>
  documentos: { propios: Documento[]; heredados: Documento[]; permanentes: Documento[] }
  certificado: { certificadoId: number; consecutivo: number; codigoVerificacion: string; anulado: boolean } | null
  retroalimentacion: { recibidas: number; promedio: number | null; asignadas: number; pendientes: number }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Colores de estado
 * Tailwind necesita las clases literales en el fuente; por eso el mapa completo
 * en vez de construir el nombre de la clase con template strings.
 * ──────────────────────────────────────────────────────────────────────────── */

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

/* ────────────────────────────────────────────────────────────────────────────
 * Componente principal
 * ──────────────────────────────────────────────────────────────────────────── */

export function TrayectoriaEvaluador({
  evaluadorId, setToast,
}: {
  evaluadorId: number
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
}) {
  const [rail, setRail] = useState<AnioRail[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [cargandoRail, setCargandoRail] = useState(true)
  const [seleccion, setSeleccion] = useState<number | null>(null)
  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [subTab, setSubTab] = useState<SubTab>('documentos')
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargandoRail(true)
      try {
        const [t, r] = await Promise.all([
          api.get<{ anios: AnioRail[] }>(`/evaluadores/${evaluadorId}/trayectoria`),
          api.get<Resumen>(`/evaluadores/${evaluadorId}/resumen`),
        ])
        if (!vivo) return
        const anios = t.data?.anios ?? []
        setRail(anios)
        setResumen(r.data)
        // Abrir el ciclo más reciente sin obligar a un clic extra.
        const primera = anios.find(a => a.participaciones?.length)?.participaciones?.[0]
        if (primera) setSeleccion(primera.participacionId)
      } catch (err) {
        if (vivo) setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo cargar la trayectoria') })
      } finally {
        if (vivo) setCargandoRail(false)
      }
    })()
    return () => { vivo = false }
  }, [evaluadorId, setToast])

  useEffect(() => {
    if (seleccion == null) { setDetalle(null); return }
    let vivo = true
    ;(async () => {
      setCargandoDetalle(true)
      try {
        const r = await api.get<Detalle>(`/evaluadores/participaciones/${seleccion}/detalle`)
        if (vivo) setDetalle(r.data)
      } catch (err) {
        if (vivo) setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo cargar el ciclo') })
      } finally {
        if (vivo) setCargandoDetalle(false)
      }
    })()
    return () => { vivo = false }
  }, [seleccion, recarga, setToast])

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
                <CabeceraCiclo detalle={detalle} />
                <Checklist progreso={detalle.progreso} />
                <PanelSubTabs
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

/* ── KPIs del hero ──────────────────────────────────────────────────────── */

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
      sub: prueba ? `${prueba.anio}${prueba.puntaje != null ? ` · ${prueba.puntaje} pts` : ''}` : 'sin registro',
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

/* ── Rail de años ───────────────────────────────────────────────────────── */

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

/* ── Cabecera del ciclo ─────────────────────────────────────────────────── */

function CabeceraCiclo({ detalle }: { detalle: Detalle }) {
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
      ? `${detalle.aprobacion.aprobadorNombre} · ${fecha(detalle.aprobacion.fechaAprobacion)}`
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
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${c.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${c.punto}`} />
          {detalle.estadoNombre ?? 'Sin estado'}
        </span>
      </header>

      {detalle.estadoNegativo && detalle.motivoNoParticipa && (
        <p className="border-b border-red-100 bg-red-50/60 px-5 py-2.5 text-[12px] text-red-800">
          <strong>Motivo:</strong> {detalle.motivoNoParticipa}
        </p>
      )}

      {divergente && (
        // El estado lo declara una persona; el checklist lo deduce de los datos.
        // Cuando no coinciden se avisa en vez de sobrescribir en silencio.
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

/* ── Checklist ──────────────────────────────────────────────────────────── */

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
              h.cumplido
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-neutral-200 bg-neutral-50 text-neutral-400'
            }`}
          >
            {h.cumplido
              ? <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
              : <Circle size={13} className="shrink-0 text-neutral-300" />}
            {h.nombre}
            {h.detalle && h.cumplido && (
              <span className="font-semibold text-emerald-700">· {h.detalle}</span>
            )}
          </span>
        ))}
      </div>
    </section>
  )
}

/* ── Sub-tabs del año ───────────────────────────────────────────────────── */

const SUBTABS: Array<{ id: SubTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: 'documentos', label: 'Documentos', icon: Paperclip },
  { id: 'formacion', label: 'Formación y pruebas', icon: Award },
  { id: 'proyectos', label: 'Proyectos evaluados', icon: FolderOpen },
  { id: 'retroalimentacion', label: 'Retroalimentación', icon: MessageSquareQuote },
  { id: 'certificado', label: 'Certificado', icon: BadgeCheck },
]

function PanelSubTabs({
  detalle, subTab, onSubTab, setToast, onRecargar,
}: {
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

      {subTab === 'documentos' && <TabDocumentos detalle={detalle} setToast={setToast} />}
      {subTab === 'formacion' && <TabFormacion detalle={detalle} setToast={setToast} />}
      {subTab === 'proyectos' && <TabProyectos detalle={detalle} />}
      {subTab === 'retroalimentacion' && <TabRetroalimentacion detalle={detalle} />}
      {subTab === 'certificado' && (
        <TabCertificado detalle={detalle} setToast={setToast} onRecargar={onRecargar} />
      )}
    </section>
  )
}

/* ── Documentos: propios / heredados / permanentes ──────────────────────── */

function TabDocumentos({
  detalle, setToast,
}: {
  detalle: Detalle
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
}) {
  const { propios, heredados, permanentes } = detalle.documentos
  if (!propios.length && !heredados.length && !permanentes.length) {
    return <Vacio texto="Este ciclo aún no tiene documentos." />
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-100">
      <BloqueDocs
        titulo="Propios del año"
        ayuda="Cargados para este evaluador en este ciclo."
        docs={propios}
        rutaBase="/evaluadores/documentos"
        setToast={setToast}
      />
      <BloqueDocs
        titulo={`Heredados de la convocatoria${detalle.convocatoriaNombre ? ` · ${detalle.convocatoriaNombre}` : ''}`}
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
      />
    </div>
  )
}

function BloqueDocs({
  titulo, ayuda, docs, rutaBase, setToast,
}: {
  titulo: string
  ayuda: string
  docs: Documento[]
  rutaBase: string
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
}) {
  if (!docs.length) return null

  const etiqueta = (d: Documento) =>
    d.ambito === 'HEREDADO' ? 'General' : d.ambito === 'PERMANENTE' ? 'Permanente' : null

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
          </li>
        ))}
      </ul>
    </div>
  )
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
      <button
        onClick={() => accion('ver')}
        disabled={ocupado != null}
        className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-[#00304D] disabled:opacity-50"
        title="Ver"
      >
        {ocupado === 'ver' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
      </button>
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

/* ── Formación y pruebas ────────────────────────────────────────────────── */

function TabFormacion({
  detalle, setToast,
}: {
  detalle: Detalle
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
}) {
  if (!detalle.capacitaciones.length && !detalle.pruebas.length) {
    return <Vacio texto="Sin curso ni prueba registrados en este ciclo." />
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-100">
      {detalle.capacitaciones.length > 0 && (
        <div className="px-5 py-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-neutral-600">
            Curso de formación
          </p>
          <ul className="flex flex-col gap-2">
            {detalle.capacitaciones.map(c => (
              <li key={c.capacitacionId} className="flex items-center gap-3 rounded-xl border border-neutral-100 px-3 py-2.5">
                <Award size={16} className={c.aprobado ? 'text-emerald-600' : 'text-neutral-300'} />
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
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  c.aprobado ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'
                }`}>
                  {c.aprobado ? 'Aprobado' : 'No aprobado'}
                </span>
                {c.tieneArchivo && (
                  <BotonesArchivo
                    verUrl={`/evaluadores/capacitaciones/${c.capacitacionId}/certificado`}
                    descargarUrl={`/evaluadores/capacitaciones/${c.capacitacionId}/certificado`}
                    nombreFallback={`certificado-curso-${c.capacitacionId}.pdf`}
                    setToast={setToast}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

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
                    Puntaje {p.puntajeMayor ?? '—'}
                    {p.puntajeMinimo != null && (
                      <span className="text-[11px] font-normal text-neutral-500"> · mínimo {p.puntajeMinimo}</span>
                    )}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {[fecha(p.fechaPresentacion), p.intentos != null ? `${p.intentos} intentos` : null]
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

/* ── Proyectos evaluados ────────────────────────────────────────────────── */

const ORIGEN_PROYECTO: Record<string, { texto: string; clase: string }> = {
  PROYECTO:  { texto: 'Ejecutado', clase: 'bg-emerald-100 text-emerald-700' },
  FORMULADO: { texto: 'Formulado', clase: 'bg-cyan-100 text-cyan-700' },
  HISTORICO: { texto: 'Histórico', clase: 'bg-neutral-100 text-neutral-600' },
}

function TabProyectos({ detalle }: { detalle: Detalle }) {
  if (!detalle.proyectos.length) {
    return <Vacio texto="Sin proyectos registrados en este ciclo." />
  }
  return (
    <ul className="flex flex-col divide-y divide-neutral-100">
      {detalle.proyectos.map(p => {
        const o = ORIGEN_PROYECTO[p.origen] ?? ORIGEN_PROYECTO.HISTORICO
        return (
          <li key={p.partProyectoId} className="flex items-center gap-3 px-5 py-3">
            <Briefcase size={15} className="shrink-0 text-neutral-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-neutral-800">
                {p.nombreProyecto || 'Sin nombre'}
              </p>
              <p className="truncate text-[11px] text-neutral-500">
                {[p.razonSocial, p.nit].filter(Boolean).join(' · ') || '—'}
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
          </li>
        )
      })}
    </ul>
  )
}

/* ── Retroalimentación ──────────────────────────────────────────────────── */

function TabRetroalimentacion({ detalle }: { detalle: Detalle }) {
  const r = detalle.retroalimentacion

  // El instrumento existe desde 2024. Antes de eso, "0 recibidas" no significa
  // mal desempeño: significa que no había con qué medir. Distinguirlo evita
  // que un año viejo se lea como una mala calificación.
  if (r.recibidas === 0 && detalle.anio < 2024) {
    return (
      <Vacio texto={`Sin retroalimentación — ${detalle.anio} es anterior al inicio del instrumento (2024).`} />
    )
  }
  if (r.recibidas === 0 && r.asignadas === 0) {
    return <Vacio texto="Todavía no se ha generado la matriz de retroalimentación para este ciclo." />
  }

  return (
    <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-3">
      <Tarjeta
        icono={<BadgeCheck size={16} className="text-emerald-600" />}
        titulo="Promedio recibido"
        valor={r.promedio != null ? `${r.promedio} / 5` : '—'}
        sub={`${r.recibidas} retroalimentaciones`}
      />
      <Tarjeta
        icono={<Users size={16} className="text-cyan-600" />}
        titulo="Le asignaron"
        valor={String(r.asignadas)}
        sub="personas por retroalimentar"
      />
      <Tarjeta
        icono={<ShieldCheck size={16} className={r.pendientes === 0 ? 'text-emerald-600' : 'text-amber-600'} />}
        titulo="Pendientes de diligenciar"
        valor={String(r.pendientes)}
        sub={r.asignadas === 0 ? 'sin asignaciones' : r.pendientes === 0 ? 'completó todas' : 'aún sin enviar'}
      />
      <p className="text-[11px] text-neutral-400 sm:col-span-3">
        El detalle por criterio y los comentarios llegan con el módulo de retroalimentación.
        Quién calificó no se muestra: el instrumento es anónimo para el evaluado.
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

/* ── Certificado ────────────────────────────────────────────────────────── */

function TabCertificado({
  detalle, setToast, onRecargar,
}: {
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
    const hitosPendientes = detalle.progreso.hitos.filter(h => !h.cumplido && h.codigo !== 'CERTIFICADO')
    return (
      <div className="px-5 py-8 text-center">
        <Stamp size={28} className="mx-auto text-neutral-300" />
        <p className="mt-3 text-sm font-semibold text-neutral-600">Sin certificado emitido</p>
        <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-500">
          El certificado se genera desde el sistema con número consecutivo y código de verificación.
          {hitosPendientes.length > 0 && (
            <> Quedan <strong>{hitosPendientes.length} hito(s)</strong> del ciclo sin cumplir; se puede
            emitir igual, pero conviene revisarlos.</>
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
            {/* Anulado: hay que poder emitir el reemplazo desde aquí. El botón
                de emitir vivía solo en la rama "sin certificado", así que tras
                anular uno el ciclo se quedaba sin salida en esta pantalla — el
                único camino era el lote de la convocatoria, en otro sitio. */}
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

      {/* El mismo modal de emisión que la rama "sin certificado": sin esto, el
          botón "Emitir uno nuevo" no tendría con qué confirmar. */}
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

/* ── Estados vacíos ─────────────────────────────────────────────────────── */

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

/* ── Utilidades ─────────────────────────────────────────────────────────── */

function fecha(d: string | null | undefined): string {
  if (!d) return '—'
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z` : d
  const parsed = new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Bogota',
  })
}

function mensajeError(err: unknown, porDefecto: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? porDefecto
}
