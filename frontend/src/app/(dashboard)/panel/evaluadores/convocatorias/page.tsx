'use client'

import api from '@/lib/api'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import {
  ArrowLeft, CalendarDays, ChevronRight, Eye, FileText, Filter, Loader2, Megaphone,
  Plus, PowerOff, Search, ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { fmtFecha } from '@/lib/format-date'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

interface ConvocatoriaItem {
  id: number
  anio: number
  periodo: string | null
  nombre: string
  modalidadPart: string | null
  fechaInicio: string | null
  fechaFin: string | null
  observaciones: string | null
  activo: boolean
  numDocumentos: number
}

interface RespListado {
  items: ConvocatoriaItem[]
  total: number
  page: number
  limit: number
}

const MODALIDAD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PRESENCIAL: { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  PAT:        { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200' },
  VIRTUAL:    { bg: 'bg-cyan-50',   text: 'text-cyan-700',   border: 'border-cyan-200' },
  MIXTA:      { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
}
const MODALIDAD_FALLBACK = { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200' }

export default function ConvocatoriasListadoPage() {
  const currentYear = new Date().getFullYear()
  const anosDisponibles = Array.from({ length: 7 }, (_, i) => currentYear + 1 - i) // currentYear+1 .. currentYear-5

  const [busqueda, setBusqueda] = useState('')
  const [anio, setAnio] = useState<'' | number>('')
  const [soloActivos, setSoloActivos] = useState(true)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<RespListado | null>(null)
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)
  const [confirmDesactId, setConfirmDesactId] = useState<number | null>(null)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

  // Ref al AbortController vigente — cancela requests obsoletos cuando el
  // usuario cambia filtros más rápido de lo que el backend responde.
  const cargaCtrlRef = useRef<AbortController | null>(null)

  async function cargar(q: string, ano: '' | number, activos: boolean, p: number) {
    cargaCtrlRef.current?.abort()
    const ctrl = new AbortController()
    cargaCtrlRef.current = ctrl
    setLoading(true)
    setErrMsg('')
    try {
      const params: Record<string, unknown> = { page: p, limit: 20 }
      if (q.trim())   params.busqueda = q.trim()
      if (ano !== '') params.anio = ano
      // F6: solo mandamos `activo=1` cuando el usuario elige "Solo activas".
      // Cuando "Ver todas", omitimos el param para que el backend no filtre.
      if (activos)    params.activo = 1
      const res = await api.get<RespListado>('/evaluadores/convocatorias', { params, signal: ctrl.signal })
      setData(res.data)
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'CanceledError') return
      const status = (err as { response?: { status?: number } })?.response?.status
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      if (status === 403) setErrMsg('No tienes permisos para acceder a las convocatorias del banco.')
      else setErrMsg(msg ?? 'Error cargando las convocatorias')
      setData(null)
    } finally {
      if (cargaCtrlRef.current === ctrl) setLoading(false)
    }
  }

  useEffect(() => {
    cargar(busqueda, anio, soloActivos, page)
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [page])

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    cargar(busqueda, anio, soloActivos, 1)
  }

  function cambiarFiltroAnio(v: '' | number) {
    setAnio(v)
    setPage(1)
    cargar(busqueda, v, soloActivos, 1)
  }

  function toggleActivos() {
    const nuevo = !soloActivos
    setSoloActivos(nuevo)
    setPage(1)
    cargar(busqueda, anio, nuevo, 1)
  }

  async function desactivar(cid: number) {
    setCambiandoEstado(true)
    try {
      await api.put(`/evaluadores/convocatorias/${cid}/estado`, { activo: false })
      setToast({ tipo: 'success', msg: 'Convocatoria desactivada' })
      setConfirmDesactId(null)
      await cargar(busqueda, anio, soloActivos, page)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo desactivar la convocatoria' })
    } finally {
      setCambiandoEstado(false)
    }
  }

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const convAEliminar = confirmDesactId != null ? data?.items.find(c => c.id === confirmDesactId) : null

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa
          show
          onClose={() => setToast(null)}
          tipo={toast.tipo}
          titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg}
          duration={3500}
        />
      )}

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl shadow-lg" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #001f33 70%, #000a14 100%)` }}>
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-96 h-40 rounded-full" style={{ backgroundColor: `${INSTITUTIONAL}15`, filter: 'blur(60px)' }} />
        <div className="relative px-6 sm:px-10 py-8 sm:py-10 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 ring-1 ring-white/20">
            <Megaphone size={32} className="text-white" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-white/70 text-xs flex-wrap">
              <Link href="/panel/evaluadores" className="hover:text-white">Banco de Evaluadores</Link>
              <ChevronRight size={12} />
              <span>Convocatorias</span>
            </div>
            <h1 className="text-white font-bold text-2xl sm:text-3xl mt-1 leading-tight">Convocatorias del banco</h1>
            <p className="text-white/80 text-sm mt-2 max-w-2xl">
              Administra las convocatorias que abre la GGPC para conformar y ratificar el banco de evaluadores. Cada convocatoria mantiene su propio conjunto de documentos institucionales.
            </p>
          </div>
          <div className="shrink-0">
            <Link
              href="/panel/evaluadores/convocatorias/nueva"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white hover:opacity-95 font-bold text-sm rounded-xl shadow-md transition"
              style={{ backgroundColor: INSTITUTIONAL }}
            >
              <Plus size={15} />
              Nueva convocatoria
            </Link>
          </div>
        </div>
      </div>

      <Link href="/panel/evaluadores" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D] w-fit">
        <ArrowLeft size={13} />
        Volver al banco de evaluadores
      </Link>

      {/* Buscador + filtros */}
      <form onSubmit={handleBuscar} className="bg-white border border-neutral-200 rounded-2xl p-3 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Search size={16} className="text-neutral-400 ml-1" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre u observación..."
            className="flex-1 text-sm focus:outline-none bg-transparent min-w-0"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 pl-1">
            <Filter size={13} className="text-neutral-400" />
            <select
              value={anio === '' ? '' : String(anio)}
              onChange={(e) => cambiarFiltroAnio(e.target.value ? Number(e.target.value) : '')}
              className="border border-neutral-300 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
            >
              <option value="">Todos los años</option>
              {anosDisponibles.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={toggleActivos}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              soloActivos
                ? 'text-white border-transparent'
                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
            }`}
            style={soloActivos ? { backgroundColor: INSTITUTIONAL } : undefined}
            title={soloActivos ? 'Mostrando solo activas' : 'Mostrando todas'}
          >
            <ShieldCheck size={12} />
            {soloActivos ? 'Activas' : 'Todas'}
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 text-white text-xs font-semibold rounded-lg transition hover:opacity-90"
            style={{ backgroundColor: PRIMARY }}
          >
            Buscar
          </button>
        </div>
      </form>

      {errMsg && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <PowerOff size={16} />
          {errMsg}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-neutral-500 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Cargando...
        </div>
      )}

      {data && data.items.length === 0 && !loading && (
        <div className="bg-white border border-dashed border-neutral-300 rounded-2xl py-16 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center">
            <Megaphone size={26} className="text-neutral-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-700">Sin convocatorias registradas</p>
            <p className="text-xs text-neutral-500 mt-1">
              {busqueda || anio !== '' || !soloActivos
                ? 'Prueba con otros filtros o crea una nueva convocatoria.'
                : 'Empieza registrando la primera convocatoria del banco.'}
            </p>
          </div>
          <Link
            href="/panel/evaluadores/convocatorias/nueva"
            className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl shadow-sm transition hover:opacity-90"
            style={{ backgroundColor: INSTITUTIONAL }}
          >
            <Plus size={14} />
            Crear convocatoria
          </Link>
        </div>
      )}

      {/* Tabla */}
      {data && data.items.length > 0 && (
        <>
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3 text-left">Año / Período</th>
                    <th className="px-4 py-3 text-left">Nombre</th>
                    <th className="px-4 py-3 text-left">Modalidad</th>
                    <th className="px-4 py-3 text-left">Fecha inicio</th>
                    <th className="px-4 py-3 text-center">Docs</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {data.items.map(c => {
                    const modColor = c.modalidadPart ? (MODALIDAD_COLORS[c.modalidadPart] ?? MODALIDAD_FALLBACK) : MODALIDAD_FALLBACK
                    return (
                      <tr key={c.id} className="hover:bg-neutral-50/60 transition">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-lg bg-[#00304D]/5 text-[#00304D] flex items-center justify-center font-bold text-xs shrink-0">
                              {c.anio}
                            </div>
                            {c.periodo && (
                              <span className="text-[11px] font-semibold text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">
                                P {c.periodo}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 min-w-[220px]">
                          <p className="font-semibold text-neutral-800 line-clamp-2">{c.nombre}</p>
                          {c.observaciones && (
                            <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">{c.observaciones}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {c.modalidadPart ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${modColor.bg} ${modColor.text} ${modColor.border}`}>
                              {c.modalidadPart}
                            </span>
                          ) : (
                            <span className="text-neutral-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {c.fechaInicio ? (
                            <span className="inline-flex items-center gap-1 text-xs text-neutral-700">
                              <CalendarDays size={12} className="text-neutral-400" />
                              {fmtFecha(c.fechaInicio)}
                            </span>
                          ) : (
                            <span className="text-neutral-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00304D]/5 text-[#00304D]">
                            <FileText size={10} />
                            {c.numDocumentos}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                            c.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-700'
                          }`}>
                            {c.activo ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Link
                              href={`/panel/evaluadores/convocatorias/${c.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-white text-xs font-semibold rounded-lg transition hover:opacity-90"
                              style={{ backgroundColor: PRIMARY }}
                            >
                              <Eye size={12} />
                              Ver
                            </Link>
                            {c.activo && (
                              <button
                                onClick={() => setConfirmDesactId(c.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-100 hover:bg-red-100 text-neutral-700 hover:text-red-700 text-xs font-semibold rounded-lg transition"
                                title="Desactivar convocatoria"
                              >
                                <PowerOff size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">
              Página {data.page} de {totalPaginas} · {data.total} convocatoria{data.total === 1 ? '' : 's'}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 border border-neutral-200 rounded-lg disabled:opacity-50 hover:bg-neutral-50 transition text-xs font-semibold"
              >
                Anterior
              </button>
              <button
                disabled={page >= totalPaginas || loading}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 border border-neutral-200 rounded-lg disabled:opacity-50 hover:bg-neutral-50 transition text-xs font-semibold"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        open={confirmDesactId != null}
        onClose={() => setConfirmDesactId(null)}
        onConfirm={() => confirmDesactId != null && desactivar(confirmDesactId)}
        tipo="warning"
        titulo="Desactivar convocatoria"
        mensaje={
          <>
            La convocatoria <strong>{convAEliminar?.nombre ?? ''}</strong> dejará de aparecer en el listado activo.
            Podrás volver a activarla desde su ficha.
          </>
        }
        textoConfirmar="Desactivar"
        cargando={cambiandoEstado}
      />
    </div>
  )
}
