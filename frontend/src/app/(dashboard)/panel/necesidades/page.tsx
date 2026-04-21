'use client'

import api from '@/lib/api'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { ClipboardList, FileText, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Diagnostico {
  numero: number
  necesidadId: number
  fechaRegistro: string | null
  totalNecesidades: number
}

export default function NecesidadesPage() {
  const router = useRouter()
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([])
  const [loading,   setLoading]   = useState(true)
  const [creando,   setCreando]   = useState(false)
  const [elimId,    setElimId]    = useState<number | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [toast,     setToast]     = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)
  const toastKey   = useRef(0)
  const [toastKey2, setToastKey2] = useState(0)

  function showToast(tipo: 'success' | 'error', msg: string) {
    toastKey.current++
    setToast({ tipo, msg })
    setToastKey2(toastKey.current)
  }

  async function cargar() {
    try {
      const res = await api.get<Diagnostico[]>('/necesidades')
      setDiagnosticos(res.data)
    } catch {
      showToast('error', 'Error al cargar los diagnósticos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.title = 'Mis Necesidades | SEP'
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function nuevoDiagnostico() {
    setCreando(true)
    try {
      const res = await api.post<{ necesidadId: number }>('/necesidades')
      showToast('success', 'Diagnóstico creado. Redirigiendo…')
      await cargar()
      setTimeout(() => router.push(`/panel/necesidades/${res.data.necesidadId}`), 2500)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al crear diagnóstico'
      showToast('error', msg)
      setCreando(false)
    }
  }

  async function confirmarEliminar() {
    if (!elimId) return
    setEliminando(true)
    try {
      await api.delete(`/necesidades/${elimId}`)
      showToast('success', 'Diagnóstico eliminado')
      setElimId(null)
      await cargar()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al eliminar el diagnóstico'
      showToast('error', msg)
      setElimId(null)
    } finally {
      setEliminando(false)
    }
  }

  function formatFecha(f: string | null) {
    if (!f) return '—'
    return new Date(f).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
  }

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa key={toastKey2} show onClose={() => setToast(null)}
          tipo={toast.tipo} titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg} duration={4500} />
      )}

      {/* Modal confirmar eliminar */}
      {elimId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full flex flex-col gap-4">
            <h3 className="text-base font-bold text-neutral-800">¿Eliminar diagnóstico?</h3>
            <p className="text-sm text-neutral-500">
              Se eliminarán también todas las herramientas y necesidades de formación asociadas. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setElimId(null)} disabled={eliminando}
                className="px-4 py-2 text-sm text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition">
                Cancelar
              </button>
              <button onClick={confirmarEliminar} disabled={eliminando}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl transition">
                {eliminando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Encabezado */}
      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex items-center gap-3">
        <ClipboardList size={22} className="text-white" />
        <h1 className="text-white font-bold text-base">
          Necesidades de Formación de la Empresa / Gremio / Asociación
        </h1>
      </div>

      {/* Instrucciones + botón */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-neutral-500 leading-relaxed">
          Cree un nuevo diagnóstico o acceda a los detalles de uno existente con{' '}
          <strong className="text-neutral-700">Detalles</strong>.
        </p>
        <button onClick={nuevoDiagnostico} disabled={creando}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00304D] hover:bg-[#004a76] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap flex-shrink-0">
          {creando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Nuevo Diagnóstico
        </button>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-[#00304D]" />
        </div>
      ) : diagnosticos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-10 text-center text-neutral-400 text-sm">
          No hay diagnósticos registrados. Cree uno con el botón <strong>Nuevo Diagnóstico</strong>.
        </div>
      ) : (
        <>
          {/* Tabla — desktop */}
          <div className="hidden sm:block bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#00304D] text-white">
                  <th className="px-4 py-3 text-center font-semibold w-14">#</th>
                  <th className="px-4 py-3 text-center font-semibold">Necesidades Registradas</th>
                  <th className="px-4 py-3 text-center font-semibold">Fecha de Registro</th>
                  <th className="px-4 py-3 text-center font-semibold w-24">Detalles</th>
                  <th className="px-4 py-3 text-center font-semibold w-24">Reporte</th>
                  <th className="px-4 py-3 text-center font-semibold w-24">Eliminar</th>
                </tr>
              </thead>
              <tbody>
                {diagnosticos.map((d, i) => (
                  <tr key={d.necesidadId} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                    <td className="px-4 py-3 text-center font-semibold text-neutral-500">{d.numero}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#00304D]/10 text-[#00304D] font-bold text-xs">
                        {Number(d.totalNecesidades)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-neutral-600">{formatFecha(d.fechaRegistro)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => router.push(`/panel/necesidades/${d.necesidadId}`)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#00304D]/10 hover:bg-[#00304D]/20 text-[#00304D] transition-colors"
                        title="Ver detalles">
                        <Search size={15} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => router.push(`/panel/necesidades/${d.necesidadId}/reporte`)}
                        disabled={Number(d.totalNecesidades) === 0}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#00304D]/10 hover:bg-[#00304D]/20 text-[#00304D] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={Number(d.totalNecesidades) === 0 ? 'Registre al menos una necesidad de formación para generar el reporte' : 'Ver reporte'}>
                        <FileText size={15} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setElimId(d.necesidadId)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
                        title="Eliminar diagnóstico">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards — mobile */}
          <div className="flex flex-col gap-3 sm:hidden">
            {diagnosticos.map(d => (
              <div key={d.necesidadId}
                className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs font-bold text-neutral-500">Diagnóstico #{d.numero}</span>
                  <span className="text-xs text-neutral-600">{formatFecha(d.fechaRegistro)}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-[#00304D] font-semibold mt-0.5">
                    <span className="w-5 h-5 rounded-full bg-[#00304D]/10 flex items-center justify-center text-[10px] font-bold">
                      {Number(d.totalNecesidades)}
                    </span>
                    necesidades registradas
                  </span>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => router.push(`/panel/necesidades/${d.necesidadId}`)}
                    className="inline-flex items-center justify-center w-8 h-8 bg-[#00304D] hover:bg-[#004a76] text-white rounded-xl transition"
                    title="Ver detalles">
                    <Search size={13} />
                  </button>
                  <button
                    onClick={() => router.push(`/panel/necesidades/${d.necesidadId}/reporte`)}
                    disabled={Number(d.totalNecesidades) === 0}
                    className="inline-flex items-center justify-center w-8 h-8 bg-[#00304D] hover:bg-[#004a76] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition"
                    title={Number(d.totalNecesidades) === 0 ? 'Sin necesidades' : 'Reporte'}>
                    <FileText size={13} />
                  </button>
                  <button onClick={() => setElimId(d.necesidadId)}
                    className="inline-flex items-center justify-center w-8 h-8 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition"
                    title="Eliminar">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
