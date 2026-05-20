'use client'

import { GrupoBeneficiariosModal } from '@/components/convenios/grupo-beneficiarios-modal'
import { GrupoCoberturaModal } from '@/components/convenios/grupo-cobertura-modal'
import { ConvenioNav } from '@/components/layout/convenio-nav'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import api from '@/lib/api'
import {
  AlertCircle, ArrowLeft, BadgeCheck, Clock, Download, Layers, Loader2, MapPin,
  Users, UsersRound,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const TITLE = '#00304D'

interface Accion {
  afId: number
  numero: number | null
  nombre: string | null
  transferencia: number | null
}
interface Grupo {
  afGrupoId: number
  grupoNumero: number | null
  cupos: number
  registrados: number
  certificados: number
  validacionInterventor: string | null
}

/** Badge segmentado: % certificados (verde) y % pendientes (amarillo)
 *  sobre el total de cupos del grupo. */
function chipCertificacion(certificados: number, registrados: number, cupos: number) {
  if (cupos === 0) {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-400 border border-neutral-200">
      Sin cupos
    </span>
  }
  const pctCert = Math.round((certificados / cupos) * 100)
  const pctPend = Math.round((Math.max(0, registrados - certificados) / cupos) * 100)
  return (
    <span className="inline-flex items-stretch rounded-full overflow-hidden border border-neutral-200 text-[10px] font-bold leading-tight"
      title={`${certificados} certificados · ${Math.max(0, registrados - certificados)} pendientes/ no conformes · ${cupos} cupos`}>
      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 inline-flex items-center gap-1">
        <BadgeCheck size={11} /> {pctCert}%
      </span>
      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 inline-flex items-center gap-1 border-l border-neutral-200">
        <Clock size={11} /> {pctPend}%
      </span>
    </span>
  )
}

export default function GruposPage() {
  const { id } = useParams<{ id: string }>()
  const proyectoId = Number(id)

  const [acciones, setAcciones] = useState<Accion[]>([])
  const [cargandoAfs, setCargandoAfs] = useState(true)
  const [afId, setAfId] = useState(0)
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [cargandoGrupos, setCargandoGrupos] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [descargando, setDescargando] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)
  const [convenioEnEjecucion, setConvenioEnEjecucion] = useState<boolean | null>(null)

  // Modales
  const [verBenefModal, setVerBenefModal] = useState<Grupo | null>(null)
  const [coberturaModal, setCoberturaModal] = useState<Grupo | null>(null)

  useEffect(() => {
    document.title = 'Grupos | SEP'
    if (!proyectoId) return
    setCargandoAfs(true)
    api.get<Accion[]>(`/grupos/proyecto/${proyectoId}/acciones`)
      .then(r => setAcciones(r.data ?? []))
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        setError(msg ?? 'No se pudieron cargar las acciones de formación.')
      })
      .finally(() => setCargandoAfs(false))
    // Estado del convenio: si != EN EJECUCIÓN, el toggle se deshabilita.
    api.get<{ estadoNum: number | null }>(`/convenios/${proyectoId}`)
      .then(r => setConvenioEnEjecucion(Number(r.data?.estadoNum) === 1))
      .catch(() => setConvenioEnEjecucion(false))
  }, [proyectoId])

  useEffect(() => {
    if (!afId) { setGrupos([]); return }
    setCargandoGrupos(true); setError(null)
    api.get<Grupo[]>(`/grupos/proyecto/${proyectoId}/af/${afId}/grupos`)
      .then(r => setGrupos(r.data ?? []))
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        setError(msg ?? 'No se pudieron cargar los grupos de la AF.')
      })
      .finally(() => setCargandoGrupos(false))
  }, [afId, proyectoId])

  async function descargarExcel() {
    setDescargando(true)
    try {
      const r = await api.get<Blob>(`/grupos/proyecto/${proyectoId}/exportar`, { responseType: 'blob' })
      const blob = new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Grupos_proyecto_${proyectoId}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setToast({ tipo: 'error', msg: 'No se pudo descargar el reporte.' })
    } finally { setDescargando(false) }
  }

  const afSeleccionada = acciones.find(a => a.afId === afId) ?? null
  const totalCupos = grupos.reduce((a, g) => a + Number(g.cupos), 0)
  const totalRegistrados = grupos.reduce((a, g) => a + Number(g.registrados), 0)

  return (
    <div className="min-h-screen bg-[#F0F4F8] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <ConvenioNav proyectoId={proyectoId} />

        {toast && (
          <ToastBetowa show onClose={() => setToast(null)} tipo={toast.tipo}
            titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
            mensaje={toast.msg} duration={4000} />
        )}

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-2.5 rounded-xl shadow-sm shrink-0" style={{ backgroundColor: TITLE }}>
            <Layers size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-lg sm:text-xl font-bold" style={{ color: TITLE }}>Grupos por Acción de Formación</h1>
            <p className="text-xs text-neutral-500">
              Consulta los grupos del proyecto: cupos, beneficiarios registrados, cobertura y certificación.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto flex-wrap">
            <button onClick={descargarExcel} disabled={descargando}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-40 transition"
              style={{ backgroundColor: '#39A900' }}>
              {descargando ? <><Loader2 size={14} className="animate-spin" /> Generando…</> : <><Download size={14} /> Exportar</>}
            </button>
            <Link href={`/panel/convenios/${proyectoId}/beneficiarios`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-neutral-500 hover:text-[#00304D]">
              <ArrowLeft size={13} /> Volver
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Selector AF */}
        <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#00304D]" />
          <div className="p-5 flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1 w-full flex flex-col gap-1">
              <label className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">Nombre de Acción de Formación *</label>
              {cargandoAfs ? (
                <div className="h-10 flex items-center gap-2 text-sm text-neutral-400">
                  <Loader2 size={14} className="animate-spin" /> Cargando…
                </div>
              ) : (
                <select value={afId} onChange={e => setAfId(Number(e.target.value))}
                  className="h-10 rounded-lg border border-neutral-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0070C0]">
                  <option value={0}>— Seleccione una AF para ver sus grupos —</option>
                  {acciones.map(a => (
                    <option key={a.afId} value={a.afId}>
                      AF {a.numero ?? '?'} — {a.nombre || 'Sin nombre'}
                      {a.transferencia === 1 ? ' · TRANSFERENCIA' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {afSeleccionada && (
              <div className="flex items-center justify-around sm:justify-start gap-3 sm:gap-4 text-xs text-neutral-600 self-start sm:self-end w-full sm:w-auto pb-1 pt-2 sm:pt-0 border-t sm:border-0 border-neutral-100">
                <div className="flex flex-col items-center sm:items-end">
                  <span className="text-[10px] font-bold uppercase text-neutral-400">Grupos</span>
                  <span className="text-base font-bold text-[#00304D]">{grupos.length}</span>
                </div>
                <div className="border-l border-neutral-200 h-8" />
                <div className="flex flex-col items-center sm:items-end">
                  <span className="text-[10px] font-bold uppercase text-neutral-400">Meta</span>
                  <span className="text-base font-bold text-[#0070C0]">{totalCupos}</span>
                </div>
                <div className="border-l border-neutral-200 h-8" />
                <div className="flex flex-col items-center sm:items-end">
                  <span className="text-[10px] font-bold uppercase text-neutral-400">Registrados</span>
                  <span className="text-base font-bold text-emerald-600">{totalRegistrados}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Cards de grupos */}
        {!afId ? (
          <div className="bg-white border border-dashed border-neutral-300 rounded-2xl p-12 text-center">
            <UsersRound size={40} className="text-neutral-300 mx-auto mb-3" />
            <p className="text-sm text-neutral-500 font-semibold">Selecciona una Acción de Formación</p>
            <p className="text-xs text-neutral-400 mt-1">Los grupos asociados se mostrarán aquí.</p>
          </div>
        ) : cargandoGrupos ? (
          <div className="flex items-center gap-2 py-16 justify-center text-neutral-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Cargando grupos…
          </div>
        ) : grupos.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center">
            <Layers size={40} className="text-neutral-200 mx-auto mb-3" />
            <p className="text-sm text-neutral-500 font-semibold">Esta AF aún no tiene grupos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {grupos.map(g => {
              const pct = g.cupos > 0 ? Math.round((g.registrados / g.cupos) * 100) : 0
              const pctBarra = Math.min(100, pct)   // visual cap a 100%
              const cumplido = g.cupos > 0 && g.registrados >= g.cupos
              const sobreEjecutado = pct > 100
              return (
                <div key={g.afGrupoId} className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition">
                  <div className="h-1 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#39A900]" />
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Grupo</p>
                        <p className="text-3xl font-bold text-[#00304D] leading-tight">{g.grupoNumero ?? '?'}</p>
                      </div>
                      {chipCertificacion(g.certificados, g.registrados, g.cupos)}
                    </div>

                    {/* Beneficiarios registrados vs meta */}
                    <div className="space-y-1.5">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold text-neutral-600">Beneficiarios</span>
                        <span className="font-bold">
                          <span className="text-emerald-600">{g.registrados}</span>
                          <span className="text-neutral-400"> / {g.cupos} meta</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div className={`h-full transition-all ${cumplido ? 'bg-emerald-500' : 'bg-[#0070C0]'}`}
                          style={{ width: `${pctBarra}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-neutral-500">
                        <span>{pct}% de la meta</span>
                        {sobreEjecutado && <span className="text-emerald-600 font-bold">SOBRE-EJECUTADO</span>}
                        {cumplido && !sobreEjecutado && <span className="text-emerald-600 font-bold">META CUMPLIDA</span>}
                      </div>
                    </div>

                    <div className="border-t border-neutral-100" />

                    {/* Acciones */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button onClick={() => setVerBenefModal(g)}
                        title="Ver beneficiarios del grupo"
                        className="inline-flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-bold border border-[#00304D]/30 text-[#00304D] hover:bg-[#00304D] hover:text-white transition">
                        <Users size={14} /> Beneficiarios
                      </button>
                      <button onClick={() => setCoberturaModal(g)}
                        title="Ver cobertura (depto/ciudad/cupos)"
                        className="inline-flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-bold border border-[#39A900]/40 text-[#39A900] hover:bg-[#39A900] hover:text-white transition">
                        <MapPin size={14} /> Cobertura
                      </button>
                      <Link
                        href={`/panel/convenios/${proyectoId}/grupos/${g.afGrupoId}/certificar`}
                        title="Certificar beneficiarios del grupo"
                        className="inline-flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-bold border border-[#7C3AED]/40 text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition">
                        <BadgeCheck size={14} /> Certificar
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modales */}
        <GrupoBeneficiariosModal
          open={verBenefModal !== null}
          onClose={() => setVerBenefModal(null)}
          proyectoId={proyectoId}
          afGrupoId={verBenefModal?.afGrupoId ?? null}
          afNumero={afSeleccionada?.numero ?? null}
          grupoNumero={verBenefModal?.grupoNumero ?? null}
          convenioEnEjecucion={convenioEnEjecucion ?? undefined}
          onToast={(tipo, msg) => {
            setToast({ tipo, msg })
            // Refresca las cards para que los contadores reflejen el cambio.
            if (tipo === 'success' && afId) {
              api.get<Grupo[]>(`/grupos/proyecto/${proyectoId}/af/${afId}/grupos`)
                .then(r => setGrupos(r.data ?? []))
                .catch(() => {})
            }
          }}
        />
        <GrupoCoberturaModal
          open={coberturaModal !== null}
          onClose={() => setCoberturaModal(null)}
          proyectoId={proyectoId}
          afGrupoId={coberturaModal?.afGrupoId ?? null}
        />
      </div>
    </div>
  )
}
