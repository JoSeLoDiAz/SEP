'use client'

import api from '@/lib/api'
import { ConvenioNav } from '@/components/layout/convenio-nav'
import { AsociarGrupoModal } from '@/components/convenios/asociar-grupo-modal'
import { AsociarRapidoModal } from '@/components/convenios/asociar-rapido-modal'
import { Modal } from '@/components/ui/modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  AlertCircle, ArchiveX, Building2, Download, Layers, Link2, Loader2, Search,
  UserCog, UserPlus, Users, X, Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

const TITLE = '#00304D'

interface BeneficiarioRow {
  nro: number
  afGrupoBeneficiarioId: number
  personaId: number
  tipoDocumentoId: number | null
  tipoDocumento: string | null
  identificacion: string | null
  nombreCompleto: string
  estado: string | null
  afsGrupos: string[]
}
interface BeneficiariosResp {
  total: number
  totalRegistros: number
  puedeActualizar: boolean
  convenioEnEjecucion: boolean
  beneficiarios: BeneficiarioRow[]
  inactivos: BeneficiarioRow[]
}

function badgeEstado(estado: string | null) {
  const e = (estado ?? '').trim().toUpperCase()
  if (e === 'ACTIVO')   return <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Activo</span>
  if (e === 'INACTIVO' || e === 'RETIRADO') return <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200">{e === 'RETIRADO' ? 'Retirado' : 'Inactivo'}</span>
  return <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{estado || '—'}</span>
}

export default function BeneficiariosConvenioPage() {
  const params = useParams()
  const router = useRouter()
  const proyectoId = Number(params?.id)

  const [data, setData] = useState<BeneficiariosResp | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(25)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)
  const [inactivosOpen, setInactivosOpen] = useState(false)
  const [asociarPersona, setAsociarPersona] = useState<BeneficiarioRow | null>(null)
  const [asociarRapidoOpen, setAsociarRapidoOpen] = useState(false)

  function recargar() {
    if (!proyectoId) return
    api.get<BeneficiariosResp>(`/convenios/${proyectoId}/beneficiarios`)
      .then(r => setData(r.data)).catch(() => {})
  }

  useEffect(() => {
    if (!proyectoId) return
    setCargando(true); setError(null)
    api.get<BeneficiariosResp>(`/convenios/${proyectoId}/beneficiarios`)
      .then(r => setData(r.data))
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        setError(msg ?? 'No se pudieron cargar los beneficiarios.')
      })
      .finally(() => setCargando(false))
  }, [proyectoId])

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return data?.beneficiarios ?? []
    return (data?.beneficiarios ?? []).filter(b =>
      (b.nombreCompleto ?? '').toLowerCase().includes(t)
      || (b.identificacion ?? '').toLowerCase().includes(t)
      || (b.tipoDocumento ?? '').toLowerCase().includes(t)
      || (b.estado ?? '').toLowerCase().includes(t)
      || b.afsGrupos.some(x => x.toLowerCase().includes(t)),
    )
  }, [q, data])

  // Reiniciar a la página 1 cuando cambia el filtro o el tamaño de página.
  useEffect(() => { setPagina(1) }, [q, porPagina])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const desde = filtrados.length === 0 ? 0 : (paginaActual - 1) * porPagina + 1
  const hasta = Math.min(paginaActual * porPagina, filtrados.length)
  const pagFiltrados = useMemo(
    () => filtrados.slice((paginaActual - 1) * porPagina, paginaActual * porPagina),
    [filtrados, paginaActual, porPagina],
  )
  // Ventana de números de página alrededor de la actual.
  const numerosPagina = useMemo(() => {
    const max = 7
    if (totalPaginas <= max) return Array.from({ length: totalPaginas }, (_, i) => i + 1)
    const half = Math.floor(max / 2)
    let ini = Math.max(1, paginaActual - half)
    const fin = Math.min(totalPaginas, ini + max - 1)
    ini = Math.max(1, fin - max + 1)
    return Array.from({ length: fin - ini + 1 }, (_, i) => ini + i)
  }, [totalPaginas, paginaActual])

  async function descargarReporte() {
    if (!proyectoId) return
    try {
      const r = await api.get<Blob>(`/convenios/${proyectoId}/beneficiarios/reporte`, { responseType: 'blob' })
      const blob = new Blob([r.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Beneficiarios_proyecto_${proyectoId}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setToast({ tipo: 'error', msg: 'No se pudo descargar el reporte.' })
    }
  }

  function actualizarDatos(b: BeneficiarioRow) {
    // Navega al registrar pasando tipoDoc + identificación; la página
    // hace auto-buscar y precarga todos los campos de la persona.
    if (!b.tipoDocumentoId || !b.identificacion) {
      setToast({ tipo: 'error', msg: 'Este beneficiario no tiene tipo de documento e identificación registrados.' })
      return
    }
    const params = new URLSearchParams({
      tipoDocumentoId: String(b.tipoDocumentoId),
      identificacion: String(b.identificacion).trim(),
    })
    router.push(`/panel/convenios/${proyectoId}/beneficiarios/registrar?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-[#F0F4F8] p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <ConvenioNav proyectoId={proyectoId} />

        {toast && (
          <ToastBetowa show onClose={() => setToast(null)} tipo={toast.tipo} titulo={toast.tipo === 'success' ? 'Listo' : 'Error'} mensaje={toast.msg} duration={3500} />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="p-2.5 rounded-xl shadow-sm shrink-0" style={{ backgroundColor: TITLE }}>
            <Users size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-lg sm:text-xl font-bold" style={{ color: TITLE }}>Beneficiarios del proyecto</h1>
            <p className="text-xs text-neutral-500">Listado de beneficiarios asociados al convenio. Cada persona aparece una sola vez aunque participe en varias acciones de formación.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto flex-wrap">
            {data?.convenioEnEjecucion === false ? (
              <>
                <Link
                  href={`/panel/convenios/${proyectoId}/beneficiarios/empresas`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#39A900] text-[#39A900] hover:bg-[#39A900] hover:text-white transition"
                >
                  <Building2 size={14} /> Empresas beneficiarias
                </Link>
                <span title="Convenio no está en ejecución — solo lectura"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-neutral-300 text-neutral-400 cursor-not-allowed">
                  <UserPlus size={14} /> Registrar
                </span>
                <span title="Convenio no está en ejecución — solo lectura"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-neutral-300 text-neutral-400 cursor-not-allowed">
                  <Zap size={14} /> + Asociar
                </span>
                <Link
                  href={`/panel/convenios/${proyectoId}/grupos`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#39A900] text-[#39A900] hover:bg-[#39A900] hover:text-white transition"
                >
                  <Layers size={14} /> Grupos
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={`/panel/convenios/${proyectoId}/beneficiarios/empresas`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#39A900] text-[#39A900] hover:bg-[#39A900] hover:text-white transition"
                >
                  <Building2 size={14} /> Empresas beneficiarias
                </Link>
                <Link
                  href={`/panel/convenios/${proyectoId}/beneficiarios/registrar`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#00304D] text-[#00304D] hover:bg-[#00304D] hover:text-white transition"
                >
                  <UserPlus size={14} /> Registrar
                </Link>
                <button
                  onClick={() => setAsociarRapidoOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#00304D] text-[#00304D] hover:bg-[#00304D] hover:text-white transition"
                >
                  <Zap size={14} /> + Asociar
                </button>
                <Link
                  href={`/panel/convenios/${proyectoId}/grupos`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#39A900] text-[#39A900] hover:bg-[#39A900] hover:text-white transition"
                >
                  <Layers size={14} /> Grupos
                </Link>
              </>
            )}
          </div>
        </div>

        {data?.convenioEnEjecucion === false && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertCircle size={16} />
            <span><strong>Convenio no está en ejecución.</strong> Este módulo está en modo solo lectura: no se pueden registrar, editar ni asociar beneficiarios.</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {cargando ? (
          <div className="flex items-center gap-2 py-12 justify-center text-neutral-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Cargando beneficiarios…
          </div>
        ) : data && (
          <>
            {/* Stats + acciones */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-4 sm:gap-6 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Beneficiarios únicos</p>
                  <p className="text-xl sm:text-2xl font-bold" style={{ color: TITLE }}>{data.total}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Registros AF · Grupo</p>
                  <p className="text-xl sm:text-2xl font-bold text-neutral-500">{data.totalRegistros}</p>
                </div>
              </div>
              <div className="flex-1 min-w-full sm:min-w-[200px] sm:max-w-md sm:ml-auto order-3 sm:order-2 relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Buscar por nombre, identificación, estado, AF…"
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                />
              </div>
              <button
                onClick={descargarReporte}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm order-2 sm:order-3"
                style={{ backgroundColor: '#39A900' }}
              >
                <Download size={14} /> <span className="hidden sm:inline">Descargar reporte</span><span className="sm:hidden">Excel</span>
              </button>
            </div>

            {/* Tabla */}
            <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wide" style={{ backgroundColor: TITLE, color: 'white' }}>
                      <th className="px-3 py-2.5 w-12 text-center">N°</th>
                      <th className="px-3 py-2.5">Tipo de documento</th>
                      <th className="px-3 py-2.5">Identificación</th>
                      <th className="px-3 py-2.5">Nombre del beneficiario</th>
                      <th className="px-3 py-2.5">AFs / Grupos</th>
                      <th className="px-3 py-2.5 text-center">Estado</th>
                      <th className="px-3 py-2.5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {pagFiltrados.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-neutral-400 text-sm">
                        {q ? 'No hay beneficiarios que coincidan con la búsqueda.' : 'Este proyecto aún no tiene beneficiarios registrados.'}
                      </td></tr>
                    ) : pagFiltrados.map(b => (
                      <tr key={b.personaId} className="hover:bg-neutral-50">
                        <td className="px-3 py-2.5 text-center text-neutral-500">{b.nro}</td>
                        <td className="px-3 py-2.5 text-neutral-700">{b.tipoDocumento ?? '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-neutral-700">{b.identificacion ?? '—'}</td>
                        <td className="px-3 py-2.5 font-medium text-neutral-800">{b.nombreCompleto || '—'}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {b.afsGrupos.map(x => (
                              <span key={x} className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-[#0070C0]/10 text-[#0070C0] font-medium">{x}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">{badgeEstado(b.estado)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => actualizarDatos(b)}
                              disabled={data?.convenioEnEjecucion === false}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#00304D] border border-[#00304D]/30 hover:bg-[#00304D] hover:text-white hover:border-[#00304D] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#00304D]"
                              title={data?.convenioEnEjecucion === false ? 'Convenio no está en ejecución' : 'Actualizar datos del beneficiario'}
                            >
                              <UserCog size={13} /> Actualizar
                            </button>
                            <button
                              onClick={() => setAsociarPersona(b)}
                              disabled={data?.convenioEnEjecucion === false}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0070C0] border border-[#0070C0]/30 hover:bg-[#0070C0] hover:text-white hover:border-[#0070C0] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#0070C0]"
                              title={data?.convenioEnEjecucion === false ? 'Convenio no está en ejecución' : 'Cambiar de grupo o asociar a otra AF'}
                            >
                              <Link2 size={13} /> Grupos
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {filtrados.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-neutral-100 text-xs text-neutral-500">
                  <span>Mostrando <strong className="text-neutral-700">{desde}</strong>–<strong className="text-neutral-700">{hasta}</strong> de <strong className="text-neutral-700">{filtrados.length}</strong>{q ? ` (filtrado de ${data.total})` : ''}</span>
                  <div className="flex items-center gap-1.5">
                    <span>Por página:</span>
                    <select value={porPagina} onChange={e => setPorPagina(Number(e.target.value))}
                      className="h-7 rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0]">
                      {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => setPagina(1)} disabled={paginaActual === 1}
                      className="px-2 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed">Primera</button>
                    <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaActual === 1}
                      className="px-2 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed">Anterior</button>
                    {numerosPagina.map(n => (
                      <button key={n} onClick={() => setPagina(n)}
                        className={`px-2.5 py-1 rounded-lg border transition ${n === paginaActual ? 'bg-[#00304D] text-white border-[#00304D] font-semibold' : 'border-neutral-200 hover:bg-neutral-50'}`}>{n}</button>
                    ))}
                    <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas}
                      className="px-2 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed">Siguiente</button>
                    <button onClick={() => setPagina(totalPaginas)} disabled={paginaActual === totalPaginas}
                      className="px-2 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed">Última</button>
                  </div>
                </div>
              )}
            </div>

            {/* Botón ver inactivos al pie */}
            {(data.inactivos?.length ?? 0) > 0 && (
              <div className="flex justify-center pt-1">
                <button onClick={() => setInactivosOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-neutral-600 bg-white border border-neutral-200 hover:bg-neutral-50 hover:text-[#00304D] transition shadow-sm">
                  <ArchiveX size={14} /> Ver inactivos · <span className="font-bold">{data.inactivos.length}</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Modal: ver inactivos */}
        <Modal open={inactivosOpen} onClose={() => setInactivosOpen(false)} maxWidth="max-w-4xl">
          <div className="flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0 border-b border-neutral-100" style={{ backgroundColor: TITLE }}>
              <div className="p-2 rounded-lg bg-white/10">
                <ArchiveX size={18} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-white font-bold text-base">Beneficiarios inactivos</h2>
                <p className="text-white/70 text-xs">
                  Personas cuyas asociaciones a AFs están todas retiradas/inactivas. Total: {data?.inactivos?.length ?? 0}
                </p>
              </div>
              <button onClick={() => setInactivosOpen(false)} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wide bg-neutral-50 text-neutral-600 sticky top-0">
                    <th className="px-3 py-2.5 w-12 text-center">N°</th>
                    <th className="px-3 py-2.5">Tipo de documento</th>
                    <th className="px-3 py-2.5">Identificación</th>
                    <th className="px-3 py-2.5">Nombre</th>
                    <th className="px-3 py-2.5">AFs / Grupos (estado)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {(data?.inactivos ?? []).length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-neutral-400 text-sm">No hay beneficiarios inactivos.</td></tr>
                  ) : (data?.inactivos ?? []).map(b => (
                    <tr key={b.personaId} className="hover:bg-neutral-50">
                      <td className="px-3 py-2.5 text-center text-neutral-500">{b.nro}</td>
                      <td className="px-3 py-2.5 text-neutral-700">{b.tipoDocumento ?? '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-neutral-700">{b.identificacion ?? '—'}</td>
                      <td className="px-3 py-2.5 font-medium text-neutral-800">{b.nombreCompleto || '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {b.afsGrupos.map((x, i) => (
                            <span key={i} className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-medium">{x}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-end flex-shrink-0 bg-neutral-50">
              <button onClick={() => setInactivosOpen(false)} className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow"
                style={{ backgroundColor: TITLE }}>
                Cerrar
              </button>
            </div>
          </div>
        </Modal>

        {/* Modal: cambiar/asociar grupos (desde una fila de la tabla) */}
        <AsociarGrupoModal
          open={!!asociarPersona}
          onClose={() => setAsociarPersona(null)}
          proyectoId={proyectoId}
          personaId={asociarPersona?.personaId ?? null}
          nombreCompleto={asociarPersona?.nombreCompleto ?? '—'}
          onCambio={recargar}
          onToast={(tipo, msg) => setToast({ tipo, msg })}
        />

        {/* Modal: asociar rápido (buscar + asociar en una sola pantalla) */}
        <AsociarRapidoModal
          open={asociarRapidoOpen}
          onClose={() => setAsociarRapidoOpen(false)}
          proyectoId={proyectoId}
          onCambio={recargar}
          onToast={(tipo, msg) => setToast({ tipo, msg })}
          onIrARegistrar={(tipoDocumentoId, identificacion) => {
            setAsociarRapidoOpen(false)
            const params = new URLSearchParams({
              tipoDocumentoId: String(tipoDocumentoId),
              identificacion: identificacion.trim(),
            })
            router.push(`/panel/convenios/${proyectoId}/beneficiarios/registrar?${params.toString()}`)
          }}
        />
      </div>
    </div>
  )
}
