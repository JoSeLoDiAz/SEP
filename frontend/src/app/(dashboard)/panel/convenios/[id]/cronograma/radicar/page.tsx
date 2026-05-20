'use client'

import { ConvenioNav } from '@/components/layout/convenio-nav'
import api from '@/lib/api'
import {
  AlertCircle, CheckCircle2, CheckCheck, ClipboardCheck, Eye, FileSignature,
  Loader2, Pencil, Send, Sparkles, Users, Video, X,
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Radicado {
  radicadoId: number
  numero: number
  fecha: string | null
  estado: string | null
  transferencia: number | null
}
interface PendienteSesion {
  id: number
  sigla: string | null
  nombre: string | null
  afNum: number | null
  af: string | null
  grupoNum: number | null
  utNum: number | null
  utNombre: string | null
}

interface SesionRadicada extends PendienteSesion {
  estadoRadicado: string | null
}

interface RadicadoDetalle {
  radicadoId: number
  proyectoId: number
  numero: number
  fecha: string | null
  fechaEstado: string | null
  estado: string | null
  observacion: string | null
  histPresencial: string | null
  histVirtual: string | null
  histInterventoriaP: string | null
  histInterventoriaV: string | null
  transferencia: number | null
  radicadoSena: string | null
  radicadoSenaFecha: string | null
  radicadoInter: string | null
  radicadoInterFecha: string | null
  nisSena: string | null
  fechaRemi: string | null
  obsSena: string | null
  interventorId: number | null
  interventorNombre: string | null
  interventorEmail: string | null
  presenciales: SesionRadicada[]
  virtuales: SesionRadicada[]
}

const TITLE = '#00304D'
const ACCENT = '#39A900'

function fmtFecha(d: string | null) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return d }
}

function fmtFechaHora(d: string | null) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
  } catch { return d }
}

function badgeEstadoRadicado(estado: string | null) {
  const up = (estado ?? '').toUpperCase().trim()
  if (up === 'APROBADO' || up === 'APROBADA') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{up}</span>
  if (up === 'MODIFICAR') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{up}</span>
  if (up === 'RADICADO') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{up}</span>
  if (up === 'REVERTIDO') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">{up}</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">{up || '—'}</span>
}

export default function RadicarCronogramaPage() {
  const { id } = useParams<{ id: string }>()
  const proyectoId = Number(id)

  const [radicados, setRadicados] = useState<Radicado[]>([])
  const [presenciales, setPresenciales] = useState<PendienteSesion[]>([])
  const [virtuales, setVirtuales] = useState<PendienteSesion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [radicando, setRadicando] = useState(false)
  const [exito, setExito] = useState<{ numero: number; sesiones: number; actividades: number } | null>(null)

  const [detalleOpen, setDetalleOpen] = useState<number | null>(null)
  const [detalle, setDetalle] = useState<RadicadoDetalle | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [accionMasiva, setAccionMasiva] = useState(false)
  const [marcandoId, setMarcandoId] = useState<{ tipo: 'P' | 'V'; id: number } | null>(null)
  const [enviandoCorr, setEnviandoCorr] = useState(false)

  async function cargar() {
    setCargando(true); setError(null)
    try {
      const [rR, rP] = await Promise.all([
        api.get<Radicado[]>(`/cronograma/proyecto/${proyectoId}/radicados`),
        api.get<{ presenciales: PendienteSesion[]; virtuales: PendienteSesion[] }>(`/cronograma/proyecto/${proyectoId}/pendientes-radicar`),
      ])
      setRadicados(rR.data ?? [])
      setPresenciales(rP.data?.presenciales ?? [])
      setVirtuales(rP.data?.virtuales ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error cargando información de radicación.')
    } finally { setCargando(false) }
  }

  useEffect(() => {
    document.title = 'Radicar Cronograma | SEP'
    cargar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId])

  async function abrirDetalle(radicadoId: number) {
    setDetalleOpen(radicadoId)
    setCargandoDetalle(true); setDetalle(null)
    try {
      const r = await api.get<RadicadoDetalle>(`/cronograma/radicado/${radicadoId}`)
      setDetalle(r.data)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudo cargar el detalle del radicado.')
      setDetalleOpen(null)
    } finally { setCargandoDetalle(false) }
  }

  async function recargarDetalle() {
    if (!detalleOpen) return
    try {
      const r = await api.get<RadicadoDetalle>(`/cronograma/radicado/${detalleOpen}`)
      setDetalle(r.data)
    } catch { /* silent */ }
  }

  async function marcarUna(tipo: 'P' | 'V', id: number) {
    setMarcandoId({ tipo, id })
    try {
      const url = tipo === 'P'
        ? `/cronograma/sesion-presencial/${id}/marcar-actualizada`
        : `/cronograma/sesion-virtual/${id}/marcar-actualizada`
      await api.post(url)
      await recargarDetalle()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudo marcar como actualizada.')
    } finally { setMarcandoId(null) }
  }

  async function marcarTodasMasivo() {
    if (!detalleOpen) return
    if (!confirm('¿Marcar TODAS las sesiones y actividades en estado MODIFICAR como ACTUALIZADAS? Úsalo cuando interventoría regresó muchas a la vez.')) return
    setAccionMasiva(true)
    try {
      await api.post(`/cronograma/radicado/${detalleOpen}/marcar-todas-actualizadas`)
      await recargarDetalle()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudo aplicar la acción masiva.')
    } finally { setAccionMasiva(false) }
  }

  async function enviarCorrecciones() {
    if (!detalleOpen) return
    setEnviandoCorr(true); setError(null)
    try {
      await api.post(`/cronograma/radicado/${detalleOpen}/enviar-correcciones`)
      await recargarDetalle()
      await cargar()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudo enviar correcciones.')
    } finally { setEnviandoCorr(false) }
  }

  async function radicar() {
    setRadicando(true); setError(null)
    try {
      const r = await api.post<{ numero: number; sesionesRadicadas: number; actividadesRadicadas: number }>(`/cronograma/proyecto/${proyectoId}/radicar`)
      setExito({
        numero: r.data.numero,
        sesiones: r.data.sesionesRadicadas,
        actividades: r.data.actividadesRadicadas,
      })
      setConfirmar(false)
      await cargar()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al radicar.')
      setConfirmar(false)
    } finally { setRadicando(false) }
  }

  const totalPendientes = presenciales.length + virtuales.length
  const puedeRadicar = totalPendientes > 0

  return (
    <div className="min-h-screen bg-[#F0F4F8] p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <ConvenioNav proyectoId={proyectoId} />

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl shadow-sm" style={{ backgroundColor: TITLE }}>
            <FileSignature size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: TITLE }}>Radicar cronograma</h1>
            <p className="text-xs text-neutral-500">Radica las sesiones y actividades del cronograma para iniciar el proceso de evaluación por interventoría.</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {exito && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 flex items-start gap-3">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Radicado #{exito.numero} creado correctamente.</p>
              <p className="text-xs mt-0.5">{exito.sesiones} sesiones presenciales y {exito.actividades} actividades virtuales fueron radicadas.</p>
            </div>
            <button onClick={() => setExito(null)} className="ml-auto text-emerald-700 hover:text-emerald-900"><X size={16} /></button>
          </div>
        )}

        {cargando ? (
          <div className="flex items-center gap-2 py-12 justify-center text-neutral-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        ) : (
          <>
            <HistorialRadicados radicados={radicados} onVer={abrirDetalle} />

            <PendientesPanel
              titulo="Sesiones presenciales pendientes"
              icono={<Users size={14} className="text-neutral-400" />}
              items={presenciales}
              vacioMsg="No hay sesiones presenciales pendientes por radicar."
            />

            <PendientesPanel
              titulo="Actividades virtuales pendientes"
              icono={<Video size={14} className="text-neutral-400" />}
              items={virtuales}
              vacioMsg="No hay actividades virtuales pendientes por radicar."
            />

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-[#00304D] via-[#39A900] to-[#00304D]" />
              <div className="p-5 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <ClipboardCheck size={18} style={{ color: TITLE }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: TITLE }}>
                      {totalPendientes > 0
                        ? `${totalPendientes} ${totalPendientes === 1 ? 'elemento pendiente' : 'elementos pendientes'} por radicar`
                        : 'Todo el cronograma está al día'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {totalPendientes > 0
                        ? `${presenciales.length} presenciales · ${virtuales.length} virtuales`
                        : 'Sin sesiones ni actividades pendientes.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmar(true)}
                  disabled={!puedeRadicar || radicando}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: ACCENT }}
                >
                  {radicando
                    ? <><Loader2 size={14} className="animate-spin" /> Radicando…</>
                    : <><Send size={14} /> Radicar cronograma</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {confirmar && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-[#00304D] via-[#39A900] to-[#00304D]" />
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base" style={{ color: TITLE }}>Confirmar radicación</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Estás a punto de radicar {totalPendientes} {totalPendientes === 1 ? 'elemento' : 'elementos'} para evaluación de interventoría.
                  </p>
                </div>
                <button onClick={() => setConfirmar(false)} className="text-neutral-400 hover:text-neutral-700"><X size={18} /></button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>Una vez radicadas, las sesiones y actividades quedarán bloqueadas para edición hasta que la interventoría las evalúe.</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-1 flex items-center gap-1">
                    <Users size={10} /> Presenciales
                  </p>
                  <p className="text-2xl font-bold" style={{ color: TITLE }}>{presenciales.length}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-1 flex items-center gap-1">
                    <Video size={10} /> Virtuales
                  </p>
                  <p className="text-2xl font-bold" style={{ color: TITLE }}>{virtuales.length}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  onClick={() => setConfirmar(false)}
                  disabled={radicando}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-600 hover:bg-neutral-100 transition disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={radicar}
                  disabled={radicando}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-40"
                  style={{ backgroundColor: ACCENT }}
                >
                  {radicando
                    ? <><Loader2 size={13} className="animate-spin" /> Radicando…</>
                    : <><Send size={13} /> Confirmar radicación</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detalleOpen && (
        <DetalleRadicadoModal
          detalle={detalle}
          cargando={cargandoDetalle}
          accionMasiva={accionMasiva}
          marcandoId={marcandoId}
          enviando={enviandoCorr}
          onClose={() => { setDetalleOpen(null); setDetalle(null) }}
          onMarcar={marcarUna}
          onMasivo={marcarTodasMasivo}
          onEnviar={enviarCorrecciones}
          onRecargar={recargarDetalle}
        />
      )}
    </div>
  )
}

function HistorialRadicados({ radicados, onVer }: { radicados: Radicado[]; onVer: (id: number) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-[#00304D] to-[#39A900]" />
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={14} className="text-neutral-400" />
          <span className="text-xs font-bold uppercase text-neutral-400 tracking-wide">Cronogramas radicados</span>
          {radicados.length > 0 && (
            <span className="text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{radicados.length}</span>
          )}
        </div>

        {radicados.length === 0 ? (
          <p className="text-xs text-neutral-400 italic py-3">Aún no se ha radicado ningún corte de cronograma.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-neutral-50 text-neutral-400 uppercase text-[10px] tracking-wide">
                  <th className="px-3 py-2 text-center w-16"># Radicado</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-center">Estado</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-center w-20">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {radicados.map(r => (
                  <tr key={r.radicadoId} className="hover:bg-neutral-50">
                    <td className="px-3 py-2.5 text-center font-bold text-[#00304D]">{r.numero}</td>
                    <td className="px-3 py-2.5">{fmtFecha(r.fecha)}</td>
                    <td className="px-3 py-2.5 text-center">{badgeEstadoRadicado(r.estado)}</td>
                    <td className="px-3 py-2.5 text-neutral-700">
                      {r.transferencia === 0 ? 'Convenio' : r.transferencia === 1 ? 'Eventos' : r.transferencia === 2 ? 'Transferencia' : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => onVer(r.radicadoId)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#00304D] hover:bg-[#00304D]/10 transition"
                        title="Ver detalle del radicado"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function PendientesPanel({
  titulo, icono, items, vacioMsg,
}: {
  titulo: string
  icono: React.ReactNode
  items: PendienteSesion[]
  vacioMsg: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-[#00304D] to-[#39A900]" />
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          {icono}
          <span className="text-xs font-bold uppercase text-neutral-400 tracking-wide">{titulo}</span>
          {items.length > 0 && (
            <span className="text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{items.length}</span>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-neutral-400 italic py-3">{vacioMsg}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-neutral-50 text-neutral-400 uppercase text-[10px] tracking-wide">
                  <th className="px-3 py-2 text-left">Sigla</th>
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-left">AF</th>
                  <th className="px-3 py-2 text-center">Grupo</th>
                  <th className="px-3 py-2 text-left">Unidad temática</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {items.map(s => (
                  <tr key={s.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2.5 font-mono text-[10px] text-neutral-500">{s.sigla ?? '—'}</td>
                    <td className="px-3 py-2.5 text-neutral-700 max-w-[200px] truncate" title={s.nombre ?? ''}>{s.nombre ?? '—'}</td>
                    <td className="px-3 py-2.5 text-neutral-700 max-w-[180px] truncate" title={s.af ?? ''}>AF {s.afNum} · {s.af}</td>
                    <td className="px-3 py-2.5 text-center font-semibold">{s.grupoNum}</td>
                    <td className="px-3 py-2.5 text-neutral-700 max-w-[160px] truncate" title={s.utNombre ?? ''}>UT {s.utNum} · {s.utNombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function DetalleRadicadoModal({
  detalle, cargando, accionMasiva, marcandoId, enviando,
  onClose, onMarcar, onMasivo, onEnviar, onRecargar,
}: {
  detalle: RadicadoDetalle | null
  cargando: boolean
  accionMasiva: boolean
  marcandoId: { tipo: 'P' | 'V'; id: number } | null
  enviando: boolean
  onClose: () => void
  onMarcar: (tipo: 'P' | 'V', id: number) => void
  onMasivo: () => void
  onEnviar: () => void
  onRecargar: () => void | Promise<void>
}) {
  const sesionesModificar = detalle?.presenciales.filter(s => (s.estadoRadicado ?? '').toUpperCase() === 'MODIFICAR') ?? []
  const virtualesModificar = detalle?.virtuales.filter(s => (s.estadoRadicado ?? '').toUpperCase() === 'MODIFICAR') ?? []
  const totalModificar = sesionesModificar.length + virtualesModificar.length
  const tieneCorrecciones = totalModificar > 0
  const estado = (detalle?.estado ?? '').toUpperCase()
  // Panel de correcciones: visible mientras el radicado está en revision
  // (REVERTIDO/MODIFICAR a nivel cabecera) — incluso cuando ya no quedan
  // items por corregir, para que el proponente pueda dar click a "Enviar
  // correcciones" y devolver el radicado a interventoría.
  const enRevision = estado === 'REVERTIDO' || estado === 'MODIFICAR' || tieneCorrecciones

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-6">
        <div className="bg-[#00324D] px-5 py-4 flex items-start justify-between gap-3 shrink-0">
          <div className="text-white">
            <h3 className="font-bold text-base flex items-center gap-2">
              <ClipboardCheck size={18} /> Radicado #{detalle?.numero ?? '…'}
            </h3>
            <p className="text-xs text-white/70 mt-0.5 flex items-center gap-2">
              {fmtFechaHora(detalle?.fecha ?? null)} {detalle && <>· {badgeEstadoRadicado(detalle.estado)}</>}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">

          {cargando || !detalle ? (
            <div className="flex items-center gap-2 py-12 justify-center text-neutral-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Cargando detalle…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-neutral-50 rounded-xl p-3 text-xs">
                <DatoRadicado label="Fecha radicado" valor={fmtFechaHora(detalle.fecha)} />
                <DatoRadicado label="Fecha cambio estado" valor={fmtFechaHora(detalle.fechaEstado)} />
                <DatoRadicado label="Fecha remisión convenio" valor={fmtFechaHora(detalle.fechaRemi)} />
                <DatoRadicado label="Radicado SENA" valor={detalle.radicadoSena} />
                <DatoRadicado label="Fecha radicado SENA" valor={fmtFechaHora(detalle.radicadoSenaFecha)} />
                <DatoRadicado label="NIS radicado SENA" valor={detalle.nisSena} />
                <DatoRadicado label="Radicado Interventoría" valor={detalle.radicadoInter} />
                <DatoRadicado label="Fecha radicado Interventoría" valor={fmtFechaHora(detalle.radicadoInterFecha)} />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500 font-bold">Interventor</p>
                  <p className="text-sm text-neutral-700 font-medium">{detalle.interventorNombre || '—'}</p>
                  {detalle.interventorEmail && (
                    <a href={`mailto:${detalle.interventorEmail}`} className="text-[10px] text-[#0070C0] underline break-all">
                      {detalle.interventorEmail}
                    </a>
                  )}
                </div>
              </div>

              {(detalle.observacion || detalle.obsSena) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {detalle.observacion && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <p className="font-bold text-amber-800 mb-1">Observación de Interventoría</p>
                      <p className="text-amber-900 whitespace-pre-wrap">{detalle.observacion}</p>
                    </div>
                  )}
                  {detalle.obsSena && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      <p className="font-bold text-blue-800 mb-1">Observación SENA</p>
                      <p className="text-blue-900 whitespace-pre-wrap">{detalle.obsSena}</p>
                    </div>
                  )}
                </div>
              )}

              {enRevision && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-amber-100 border-b border-amber-300 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-amber-700" />
                      <p className="text-sm font-bold text-amber-900">
                        {tieneCorrecciones
                          ? `${totalModificar} ${totalModificar === 1 ? 'elemento requiere' : 'elementos requieren'} corrección`
                          : 'Todas las correcciones están listas para enviar'}
                      </p>
                    </div>
                    {tieneCorrecciones && (
                      <button
                        onClick={onMasivo}
                        disabled={accionMasiva}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm disabled:opacity-40"
                        style={{ backgroundColor: ACCENT }}
                        title="Marca todas las sesiones MODIFICAR como ACTUALIZADAS de un solo movimiento"
                      >
                        {accionMasiva
                          ? <><Loader2 size={12} className="animate-spin" /> Aplicando…</>
                          : <><CheckCheck size={12} /> Marcar todas actualizadas</>}
                      </button>
                    )}
                  </div>

                  {tieneCorrecciones && (
                    <div className="p-3 space-y-3">
                      {sesionesModificar.length > 0 && (
                        <CorregirGrupo
                          titulo="Sesiones presenciales por corregir"
                          icono={<Users size={12} />}
                          items={sesionesModificar}
                          tipo="P"
                          marcandoId={marcandoId}
                          onMarcar={onMarcar}
                          onPatchHecho={onRecargar}
                        />
                      )}
                      {virtualesModificar.length > 0 && (
                        <CorregirGrupo
                          titulo="Actividades virtuales por corregir"
                          icono={<Video size={12} />}
                          items={virtualesModificar}
                          tipo="V"
                          marcandoId={marcandoId}
                          onMarcar={onMarcar}
                          onPatchHecho={onRecargar}
                        />
                      )}
                    </div>
                  )}

                  <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[11px] text-amber-800">
                      {tieneCorrecciones
                        ? 'Cuando termines de corregir todas las sesiones, envía las correcciones a interventoría.'
                        : 'Listo. Envía las correcciones a interventoría para que reanude la revisión.'}
                    </p>
                    <button
                      onClick={onEnviar}
                      disabled={enviando || totalModificar > 0}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: TITLE }}
                      title={totalModificar > 0 ? 'Falta marcar elementos como actualizados' : 'Enviar correcciones a interventoría'}
                    >
                      {enviando
                        ? <><Loader2 size={13} className="animate-spin" /> Enviando…</>
                        : <><Send size={13} /> Enviar correcciones</>}
                    </button>
                  </div>
                </div>
              )}

              <ListaSesiones titulo="Sesiones radicadas" icono={<Users size={12} />} items={detalle.presenciales} />
              <ListaSesiones titulo="Actividades radicadas" icono={<Video size={12} />} items={detalle.virtuales} />

              <div className="flex justify-end pt-3 border-t border-neutral-100">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-600 hover:bg-neutral-100 transition"
                >
                  Cerrar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DatoRadicado({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-neutral-500 font-bold">{label}</p>
      <p className="text-sm text-neutral-700 font-medium">{valor && valor.trim() ? valor : '—'}</p>
    </div>
  )
}

function CorregirGrupo({
  titulo, icono, items, tipo, marcandoId, onMarcar, onPatchHecho,
}: {
  titulo: string
  icono: React.ReactNode
  items: SesionRadicada[]
  tipo: 'P' | 'V'
  marcandoId: { tipo: 'P' | 'V'; id: number } | null
  onMarcar: (tipo: 'P' | 'V', id: number) => void
  onPatchHecho: () => void | Promise<void>
}) {
  const [expandidoId, setExpandidoId] = useState<number | null>(null)

  return (
    <div className="bg-white rounded-lg border border-amber-200">
      <div className="px-3 py-2 border-b border-amber-100 flex items-center gap-2 text-amber-900">
        {icono}
        <span className="text-[10px] font-bold uppercase tracking-wide">{titulo}</span>
        <span className="text-[10px] font-bold bg-amber-100 px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      <ul className="divide-y divide-amber-100">
        {items.map(s => {
          const marcando = marcandoId?.tipo === tipo && marcandoId.id === s.id
          const abierto = expandidoId === s.id
          return (
            <li key={s.id} className="hover:bg-amber-50/30">
              <div className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className="font-mono text-[10px] text-neutral-500 w-24 shrink-0">{s.sigla ?? '—'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-neutral-700" title={s.nombre ?? ''}>{s.nombre ?? '—'}</p>
                  <p className="text-[10px] text-neutral-500">AF {s.afNum} · Grupo {s.grupoNum} · UT {s.utNum}</p>
                </div>
                <button
                  onClick={() => setExpandidoId(abierto ? null : s.id)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                    abierto ? 'bg-[#00304D] text-white' : 'text-[#00304D] hover:bg-[#00304D]/10'
                  }`}
                  title="Editar sesión inline"
                >
                  <Pencil size={11} /> {abierto ? 'Cerrar' : 'Editar'}
                </button>
                <button
                  onClick={() => onMarcar(tipo, s.id)}
                  disabled={marcando}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-white shadow-sm disabled:opacity-40"
                  style={{ backgroundColor: ACCENT }}
                  title="Marcar como actualizada"
                >
                  {marcando
                    ? <Loader2 size={11} className="animate-spin" />
                    : <><CheckCheck size={11} /> Actualizada</>}
                </button>
              </div>
              {abierto && (
                <CorregirFormInline
                  tipo={tipo}
                  sesionId={s.id}
                  onCancelar={() => setExpandidoId(null)}
                  onGuardado={async () => { setExpandidoId(null); await onPatchHecho() }}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

interface Capacitador {
  capacitadorId: number
  tipo: 'PE' | 'EM'
  nombrePersona: string | null
  identificacionPersona: string | null
  razonSocial: string | null
  identificacionEmpresa: string | null
}
interface PerfilUT {
  perfilUTId: number
  rubroId: number
  nombre: string
}

function CorregirFormInline({
  tipo, sesionId, onCancelar, onGuardado,
}: {
  tipo: 'P' | 'V'
  sesionId: number
  onCancelar: () => void
  onGuardado: () => void | Promise<void>
}) {
  const [datos, setDatos] = useState<Record<string, any> | null>(null)
  const [caps, setCaps] = useState<Capacitador[]>([])
  const [perfiles, setPerfiles] = useState<PerfilUT[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [verSuplentes, setVerSuplentes] = useState(false)

  useEffect(() => {
    setCargando(true); setErr(null)
    const url = tipo === 'P' ? `/cronograma/sesion-presencial/${sesionId}` : `/cronograma/sesion-virtual/${sesionId}`
    api.get<Record<string, any>>(url)
      .then(async r => {
        const d = r.data
        const base: Record<string, any> = {
          capacitadorId: d.capacitadorId ?? 0,
          capSup1Id: d.capSup1Id ?? 0,
          capSup2Id: d.capSup2Id ?? 0,
          capSup3Id: d.capSup3Id ?? 0,
          capSup4Id: d.capSup4Id ?? 0,
          perfilUTId: d.perfilUTId ?? 0,
          perfilSup1Id: d.perfilSup1Id ?? 0,
          perfilSup2Id: d.perfilSup2Id ?? 0,
          perfilSup3Id: d.perfilSup3Id ?? 0,
          perfilSup4Id: d.perfilSup4Id ?? 0,
        }
        if (tipo === 'P') {
          setDatos({
            ...base,
            nombreSesion: d.nombreSesion ?? '',
            fechaInicio: toYMD(d.fechaInicio),
            horaInicio: toHHMM(d.horaInicio),
            horaFin: toHHMM(d.horaFin),
            nombreSede: d.nombreSede ?? '',
            direccion: d.direccion ?? '',
            aula: d.aula ?? '',
            herramienta: d.herramienta ?? '',
            url: d.url ?? '',
          })
        } else {
          setDatos({
            ...base,
            nombreActividad: d.nombreActividad ?? '',
            fechaInicio: toYMD(d.fechaInicio),
            fechaFin: toYMD(d.fechaFin),
            horas: d.horas != null ? String(d.horas) : '',
            plataforma: d.plataforma ?? '',
            url: d.url ?? '',
            usuarioSena: d.usuarioSena ?? '',
            claveSena: d.claveSena ?? '',
          })
        }
        const [rC, rP] = await Promise.all([
          api.get<Capacitador[]>(`/cronograma/proyecto/${d.proyectoId}/capacitadores-aprobados`),
          api.get<PerfilUT[]>(`/cronograma/unidad/${d.utId}/perfiles`),
        ])
        setCaps(rC.data ?? [])
        setPerfiles(rP.data ?? [])
      })
      .catch((e: any) => setErr(e?.response?.data?.message ?? 'No se pudo cargar la sesión.'))
      .finally(() => setCargando(false))
  }, [tipo, sesionId])

  function set(k: string, v: any) { setDatos(prev => prev ? { ...prev, [k]: v } : prev) }

  async function guardar() {
    if (!datos) return
    setErr(null); setGuardando(true)
    try {
      const url = tipo === 'P' ? `/cronograma/sesion-presencial/${sesionId}` : `/cronograma/sesion-virtual/${sesionId}`
      const body: Record<string, any> = { ...datos }
      if (tipo === 'V' && body.horas !== '') body.horas = Number(body.horas)
      Object.keys(body).forEach(k => {
        const v = body[k]
        if (v === '' || v === null || v === undefined) delete body[k]
      })
      await api.patch(url, body)
      await onGuardado()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo guardar.')
    } finally { setGuardando(false) }
  }

  if (cargando) {
    return (
      <div className="px-3 py-3 bg-amber-50/40 flex items-center gap-2 text-xs text-neutral-500">
        <Loader2 size={12} className="animate-spin" /> Cargando datos…
      </div>
    )
  }
  if (!datos) {
    return <div className="px-3 py-2 text-xs text-red-700">{err ?? 'Error.'}</div>
  }

  return (
    <div className="bg-amber-50/40 border-t border-amber-100 p-3 space-y-3">
      {err && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-[11px] text-red-700 flex items-center gap-2">
          <AlertCircle size={12} /> {err}
        </div>
      )}

      <input
        type="text" value={datos.nombreSesion ?? datos.nombreActividad ?? ''}
        onChange={e => set(tipo === 'P' ? 'nombreSesion' : 'nombreActividad', e.target.value)}
        placeholder="Nombre"
        className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
      />

      {tipo === 'P' ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Fecha">
              <input type="date" value={datos.fechaInicio} onChange={e => set('fechaInicio', e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
            </Field>
            <Field label="Hora inicio">
              <input type="time" value={datos.horaInicio} onChange={e => set('horaInicio', e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
            </Field>
            <Field label="Hora fin">
              <input type="time" value={datos.horaFin} onChange={e => set('horaFin', e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Sede">
              <input type="text" value={datos.nombreSede} onChange={e => set('nombreSede', e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
            </Field>
            <Field label="Aula">
              <input type="text" value={datos.aula} onChange={e => set('aula', e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
            </Field>
            <Field label="Dirección">
              <input type="text" value={datos.direccion} onChange={e => set('direccion', e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Herramienta">
              <input type="text" value={datos.herramienta} onChange={e => set('herramienta', e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
            </Field>
            <div className="col-span-2">
              <Field label="URL">
                <input type="url" value={datos.url} onChange={e => set('url', e.target.value)}
                  className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
              </Field>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Fecha inicio">
              <input type="date" value={datos.fechaInicio} onChange={e => set('fechaInicio', e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
            </Field>
            <Field label="Fecha fin">
              <input type="date" value={datos.fechaFin} onChange={e => set('fechaFin', e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
            </Field>
            <Field label="Horas">
              <input type="number" min={0.5} step={0.5} value={datos.horas} onChange={e => set('horas', e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Plataforma">
              <input type="text" value={datos.plataforma} onChange={e => set('plataforma', e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
            </Field>
            <div className="col-span-2">
              <Field label="URL">
                <input type="url" value={datos.url} onChange={e => set('url', e.target.value)}
                  className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
              </Field>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Usuario SENA">
              <input type="text" value={datos.usuarioSena} onChange={e => set('usuarioSena', e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
            </Field>
            <Field label="Clave SENA">
              <input type="text" value={datos.claveSena} onChange={e => set('claveSena', e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
            </Field>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Capacitador principal">
          <SelectCap value={datos.capacitadorId} onChange={v => set('capacitadorId', v)} caps={caps} />
        </Field>
        <Field label="Perfil principal">
          <SelectPerfil value={datos.perfilUTId} onChange={v => set('perfilUTId', v)} perfiles={perfiles} />
        </Field>
      </div>

      <button
        type="button"
        onClick={() => setVerSuplentes(v => !v)}
        className="text-[11px] font-semibold text-[#00304D] hover:underline"
      >
        {verSuplentes ? '− Ocultar suplentes' : '+ Capacitadores y perfiles suplentes (4)'}
      </button>

      {verSuplentes && (
        <div className="space-y-2 bg-white rounded-lg border border-amber-100 p-2">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="grid grid-cols-2 gap-2">
              <Field label={`Capacitador suplente ${n}`}>
                <SelectCap value={datos[`capSup${n}Id`]} onChange={v => set(`capSup${n}Id`, v)} caps={caps} />
              </Field>
              <Field label={`Perfil suplente ${n}`}>
                <SelectPerfil value={datos[`perfilSup${n}Id`]} onChange={v => set(`perfilSup${n}Id`, v)} perfiles={perfiles} />
              </Field>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancelar} disabled={guardando}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-100 disabled:opacity-40">
          Cancelar
        </button>
        <button onClick={guardar} disabled={guardando}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm disabled:opacity-40"
          style={{ backgroundColor: ACCENT }}>
          {guardando
            ? <><Loader2 size={11} className="animate-spin" /> Guardando…</>
            : <>Guardar cambios</>}
        </button>
      </div>
    </div>
  )
}

function SelectCap({ value, onChange, caps }: { value: number; onChange: (v: number) => void; caps: Capacitador[] }) {
  return (
    <select value={value} onChange={e => onChange(Number(e.target.value))}
      className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0070C0]">
      <option value={0}>— Sin capacitador —</option>
      {caps.map(c => (
        <option key={c.capacitadorId} value={c.capacitadorId}>
          {c.tipo === 'PE' ? c.nombrePersona : c.razonSocial} ({c.tipo === 'PE' ? c.identificacionPersona : c.identificacionEmpresa})
        </option>
      ))}
    </select>
  )
}

function SelectPerfil({ value, onChange, perfiles }: { value: number; onChange: (v: number) => void; perfiles: PerfilUT[] }) {
  return (
    <select value={value} onChange={e => onChange(Number(e.target.value))}
      className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0070C0]">
      <option value={0}>— Sin perfil —</option>
      {perfiles.map(p => (
        <option key={p.perfilUTId} value={p.perfilUTId}>{p.nombre.slice(0, 80)}{p.nombre.length > 80 ? '…' : ''}</option>
      ))}
    </select>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">{label}</label>
      {children}
    </div>
  )
}

function toYMD(d: any): string {
  if (!d) return ''
  try { return new Date(d).toISOString().slice(0, 10) } catch { return '' }
}
function toHHMM(d: any): string {
  if (!d) return ''
  try {
    const dt = new Date(d)
    return `${dt.getUTCHours().toString().padStart(2, '0')}:${dt.getUTCMinutes().toString().padStart(2, '0')}`
  } catch { return '' }
}

function ListaSesiones({ titulo, icono, items }: { titulo: string; icono: React.ReactNode; items: SesionRadicada[] }) {
  if (items.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-3 py-2 bg-neutral-50 border-b border-neutral-100 flex items-center gap-2 text-neutral-600 sticky top-0 z-10">
        {icono}
        <span className="text-[10px] font-bold uppercase tracking-wide">{titulo}</span>
        <span className="text-[10px] font-bold bg-neutral-100 px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      {/* Si hay muchos items la tabla hace su propio scroll para no estirar el modal */}
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <tbody className="divide-y divide-neutral-100">
            {items.map(s => (
              <tr key={s.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 font-mono text-[10px] text-neutral-500 w-24">{s.sigla ?? '—'}</td>
                <td className="px-3 py-2 text-neutral-700">
                  <p className="font-medium truncate max-w-[300px]" title={s.nombre ?? ''}>{s.nombre ?? '—'}</p>
                  <p className="text-[10px] text-neutral-500">AF {s.afNum} · Grupo {s.grupoNum} · UT {s.utNum}</p>
                </td>
                <td className="px-3 py-2 text-right">{badgeEstadoRadicado(s.estadoRadicado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
