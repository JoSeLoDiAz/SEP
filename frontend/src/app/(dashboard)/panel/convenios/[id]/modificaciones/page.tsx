'use client'

import api from '@/lib/api'
import { descargarArchivo } from '@/lib/descargar-archivo'
import { getSepUsuario } from '@/lib/auth'
import { ConvenioNav } from '@/components/layout/convenio-nav'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { ModificacionModal } from '@/components/convenios/modificacion-modal'
import {
  AlertCircle, ChevronLeft, FileDown, FileEdit, FileText, Loader2,
  Lock, Pencil, Plus, Search, Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

const TITLE = '#00304D'
const SENA = '#39A900'
const ROJO = '#C4003D'
const PERFIL_ADMIN = 1

interface ModificacionItem {
  id: number
  proyectoId: number
  tipoModificacionId: number
  tipoModificacion: string
  convenioNumero: string | null
  empresaSigla: string | null
  empresaRazonSocial: string | null
  concepto: number
  conceptoLabel: string
  conceptoSena: number
  conceptoSenaLabel: string
  estado: number
  estadoLabel: string
  fechaEnvio: string | null
  fechaRecepcion: string | null
  fechaRegistro: string | null
}

interface ListaResp {
  modificaciones: ModificacionItem[]
  convenioEnEjecucion: boolean
}

function fmtFecha(d: string | null) {
  if (!d) return '—'
  try {
    const f = new Date(d)
    if (f.getFullYear() < 1950) return '—'
    return f.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return '—' }
}

function chipConcepto(label: string) {
  const u = (label || '').toUpperCase()
  if (u.includes('NO VIABLE')) return 'bg-red-50 text-red-700 border-red-200'
  if (u.includes('PARCIAL')) return 'bg-amber-50 text-amber-700 border-amber-200'
  if (u.includes('VIABLE')) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (u.includes('PENDIENTE')) return 'bg-neutral-100 text-neutral-600 border-neutral-200'
  if (u.includes('NO APLICA')) return 'bg-neutral-100 text-neutral-500 border-neutral-200'
  return 'bg-blue-50 text-blue-700 border-blue-200'
}

export default function ModificacionesPage() {
  const { id } = useParams<{ id: string }>()
  const proyectoId = Number(id)

  const [data, setData] = useState<ModificacionItem[]>([])
  const [convenioEnEjecucion, setConvenioEnEjecucion] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [perfilId, setPerfilId] = useState<number>(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalEditarId, setModalEditarId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [exportando, setExportando] = useState(false)

  const [toastVisible, setToastVisible] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; titulo: string; msg: string } | null>(null)
  function showToast(tipo: 'success' | 'error', titulo: string, msg: string) {
    setToast({ tipo, titulo, msg })
    setToastVisible(true)
  }

  async function cargar() {
    try {
      setLoading(true); setError(null)
      const r = await api.get<ListaResp>(`/modificaciones/proyecto/${proyectoId}`)
      setData(r.data?.modificaciones ?? [])
      setConvenioEnEjecucion(r.data?.convenioEnEjecucion ?? null)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudieron cargar las modificaciones.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.title = 'Modificaciones del Convenio | SEP'
    setPerfilId(getSepUsuario()?.perfilId ?? 0)
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId])

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return data
    return data.filter(m =>
      `${m.tipoModificacion} ${m.conceptoLabel} ${m.conceptoSenaLabel} ${m.estadoLabel} ${m.id}`
        .toLowerCase()
        .includes(t),
    )
  }, [busqueda, data])

  const puedeEditar = convenioEnEjecucion !== false
  const esAdmin = perfilId === PERFIL_ADMIN

  async function exportar() {
    setExportando(true)
    try {
      await descargarArchivo(
        `/modificaciones/proyecto/${proyectoId}/excel`,
        `Modificaciones_proyecto_${proyectoId}.xlsx`,
      )
      showToast('success', 'Exportado', 'Reporte de modificaciones descargado correctamente.')
    } catch (e: any) {
      showToast('error', 'No se pudo exportar', e?.response?.data?.message ?? 'Error al descargar el reporte.')
    } finally {
      setExportando(false)
    }
  }

  async function eliminar() {
    if (!deleteId) return
    setEliminando(true)
    try {
      await api.delete(`/modificaciones/proyecto/${proyectoId}/${deleteId}`)
      showToast('success', 'Modificación eliminada', 'La modificación fue eliminada correctamente.')
      setDeleteId(null)
      await cargar()
    } catch (e: any) {
      showToast('error', 'No se pudo eliminar', e?.response?.data?.message ?? 'Error al eliminar la modificación.')
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-5">
      <Link
        href={`/panel/convenios/${proyectoId}`}
        className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-[#00304D] transition w-fit"
      >
        <ChevronLeft size={14} /> Volver al convenio
      </Link>

      <ConvenioNav proyectoId={proyectoId} />

      {/* Header */}
      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: ROJO }} />
        <div className="p-5 sm:p-6 flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${ROJO}15` }}>
            <FileEdit size={22} style={{ color: ROJO }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              Módulo · Modificaciones del Convenio
            </p>
            <h1 className="text-lg sm:text-xl font-bold" style={{ color: TITLE }}>
              Otrosíes, ajustes y prórrogas
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Registra cada modificación enviada a la Interventoría y/o al SENA, su concepto y aprobación.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={exportar}
              disabled={exportando || data.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white rounded-xl shadow-sm transition disabled:opacity-50"
              style={{ backgroundColor: TITLE }}
            >
              {exportando ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              Exportar
            </button>
            <button
              type="button"
              onClick={() => { setModalEditarId(null); setModalOpen(true) }}
              disabled={!puedeEditar}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white rounded-xl shadow-sm transition disabled:opacity-50"
              style={{ backgroundColor: SENA }}
            >
              <Plus size={14} /> + Modificación
            </button>
          </div>
        </div>

        {convenioEnEjecucion === false && (
          <div className="px-5 sm:px-6 pb-4">
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Lock size={14} className="mt-0.5 shrink-0" />
              <span>
                El convenio <b>no está en ejecución</b>. La consulta sigue disponible, pero las acciones de
                registro y edición están deshabilitadas.
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Toolbar búsqueda */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar por tipo, concepto, estado…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#00304D]/20"
          />
        </div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-full">
          {filtrados.length} {filtrados.length === 1 ? 'registro' : 'registros'}
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: TITLE }} />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center gap-2 py-20 text-red-600 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-12 text-center">
          <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-3"
            style={{ backgroundColor: `${ROJO}15` }}>
            <FileText size={26} style={{ color: ROJO }} />
          </div>
          <p className="text-sm font-bold" style={{ color: TITLE }}>
            {busqueda ? 'Sin resultados' : 'Aún no hay modificaciones registradas'}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {busqueda
              ? 'Prueba con otra búsqueda.'
              : 'Las modificaciones del convenio aparecerán aquí.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3 text-left">N°</th>
                  <th className="px-4 py-3 text-left">Tipo de modificación</th>
                  <th className="px-4 py-3 text-left">Fecha envío</th>
                  <th className="px-4 py-3 text-left">Fecha recepción</th>
                  <th className="px-4 py-3 text-left">Concepto interventoría</th>
                  <th className="px-4 py-3 text-left">Concepto SENA</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtrados.map(m => (
                  <tr key={m.id} className="hover:bg-neutral-50 transition">
                    <td className="px-4 py-3 text-xs font-mono text-neutral-500">{m.id}</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: TITLE }}>
                      {m.tipoModificacion}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600">{fmtFecha(m.fechaEnvio)}</td>
                    <td className="px-4 py-3 text-xs text-neutral-600">{fmtFecha(m.fechaRecepcion)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${chipConcepto(m.conceptoLabel)}`}>
                        {m.conceptoLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${chipConcepto(m.conceptoSenaLabel)}`}>
                        {m.conceptoSenaLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        m.estado === 1
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                      }`}>
                        {m.estadoLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setModalEditarId(m.id); setModalOpen(true) }}
                          disabled={!puedeEditar}
                          title={puedeEditar ? 'Editar' : 'Convenio no en ejecución'}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white rounded-lg transition disabled:opacity-50"
                          style={{ backgroundColor: TITLE }}
                        >
                          <Pencil size={12} /> Editar
                        </button>
                        {esAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteId(m.id)}
                            title="Eliminar (administrador)"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white rounded-lg transition bg-red-600 hover:bg-red-700"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      <ModificacionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        proyectoId={proyectoId}
        modificacionId={modalEditarId}
        onSaved={(mensaje) => {
          setModalOpen(false)
          showToast('success', 'Modificación guardada', mensaje)
          cargar()
        }}
        onError={(msg) => showToast('error', 'No se pudo guardar', msg)}
      />

      {/* Confirmación eliminar */}
      <ConfirmModal
        open={deleteId !== null}
        onClose={() => !eliminando && setDeleteId(null)}
        onConfirm={eliminar}
        tipo="delete"
        titulo="Eliminar modificación"
        mensaje={<>Esta acción no se puede deshacer. ¿Confirmas eliminar la modificación <b>#{deleteId}</b>?</>}
        textoConfirmar="Eliminar"
        cargando={eliminando}
      />

      {toast && (
        <ToastBetowa
          show={toastVisible}
          onClose={() => setToastVisible(false)}
          tipo={toast.tipo}
          titulo={toast.titulo}
          mensaje={toast.msg}
        />
      )}
    </div>
  )
}
