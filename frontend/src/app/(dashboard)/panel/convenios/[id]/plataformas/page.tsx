'use client'

import api from '@/lib/api'
import { descargarArchivo } from '@/lib/descargar-archivo'
import { getSepUsuario } from '@/lib/auth'
import { ConvenioNav } from '@/components/layout/convenio-nav'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { PlataformaVirtualModal } from '@/components/convenios/plataforma-virtual-modal'
import {
  AlertCircle, ChevronLeft, Copy, ExternalLink, Eye, EyeOff,
  FileDown, Globe, Loader2, Lock, Pencil, Plus, Search, Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

const TITLE = '#00304D'
const SENA = '#39A900'
const MORADO = '#7C3AED'
const PERFIL_ADMIN = 1

interface PlataformaItem {
  id: number
  proyectoId: number
  link: string
  usuario: string
  clave: string
  estado: number
  fechaRemi: string | null
  valSena: number | null
  empresaRazonSocial: string | null
  empresaSigla: string | null
  convenioNumero: string | null
  estadoLabel: string
  valSenaLabel: string
}

interface ListaResp {
  plataformas: PlataformaItem[]
  convenioEnEjecucion: boolean
}

function chipEstado(value: number): string {
  if (value === 1) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (value === 2) return 'bg-red-50 text-red-700 border-red-200'
  if (value === 3) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-neutral-100 text-neutral-600 border-neutral-200'
}

export default function PlataformasVirtualesPage() {
  const { id } = useParams<{ id: string }>()
  const proyectoId = Number(id)

  const [data, setData] = useState<PlataformaItem[]>([])
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

  /** Filas con la clave revelada. Se guarda como Set<id>. */
  const [claveVisible, setClaveVisible] = useState<Set<number>>(new Set())

  const [toastVisible, setToastVisible] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; titulo: string; msg: string } | null>(null)
  function showToast(tipo: 'success' | 'error', titulo: string, msg: string) {
    setToast({ tipo, titulo, msg })
    setToastVisible(true)
  }

  async function cargar() {
    try {
      setLoading(true); setError(null)
      const r = await api.get<ListaResp>(`/plataformas-virtuales/proyecto/${proyectoId}`)
      setData(r.data?.plataformas ?? [])
      setConvenioEnEjecucion(r.data?.convenioEnEjecucion ?? null)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudieron cargar las plataformas virtuales.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.title = 'Plataformas Virtuales | SEP'
    setPerfilId(getSepUsuario()?.perfilId ?? 0)
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId])

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return data
    return data.filter(m =>
      `${m.empresaRazonSocial ?? ''} ${m.usuario} ${m.link} ${m.estadoLabel} ${m.id}`
        .toLowerCase()
        .includes(t),
    )
  }, [busqueda, data])

  const puedeEditar = convenioEnEjecucion !== false
  const esAdmin = perfilId === PERFIL_ADMIN

  function toggleVerClave(id: number) {
    setClaveVisible(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function copiar(texto: string, etiqueta: string) {
    try {
      await navigator.clipboard.writeText(texto)
      showToast('success', 'Copiado', `${etiqueta} copiado al portapapeles.`)
    } catch {
      showToast('error', 'No se pudo copiar', 'Tu navegador no permite acceso al portapapeles.')
    }
  }

  async function exportar() {
    setExportando(true)
    try {
      await descargarArchivo(
        `/plataformas-virtuales/proyecto/${proyectoId}/excel`,
        `Plataformas_Virtuales_proyecto_${proyectoId}.xlsx`,
      )
      showToast('success', 'Exportado', 'Reporte de plataformas virtuales descargado.')
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
      await api.delete(`/plataformas-virtuales/proyecto/${proyectoId}/${deleteId}`)
      showToast('success', 'Plataforma eliminada', 'La plataforma virtual fue eliminada correctamente.')
      setDeleteId(null)
      await cargar()
    } catch (e: any) {
      showToast('error', 'No se pudo eliminar', e?.response?.data?.message ?? 'Error al eliminar la plataforma.')
    } finally {
      setEliminando(false)
    }
  }

  function linkValido(url: string): boolean {
    return /^https?:\/\//i.test(url.trim())
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
        <div className="h-1.5" style={{ backgroundColor: MORADO }} />
        <div className="p-5 sm:p-6 flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${MORADO}15` }}>
            <Globe size={22} style={{ color: MORADO }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              Módulo · Plataformas Virtuales del Convenio
            </p>
            <h1 className="text-lg sm:text-xl font-bold" style={{ color: TITLE }}>
              Gestión de plataformas virtuales
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Registra accesos a las plataformas virtuales requeridas para la ejecución del convenio.
              Recuerda remitir un correo a la interventoría para dar continuidad al proceso.
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
              <Plus size={14} /> + Plataforma virtual
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
            placeholder="Buscar por usuario, link, estado…"
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
            style={{ backgroundColor: `${MORADO}15` }}>
            <Globe size={26} style={{ color: MORADO }} />
          </div>
          <p className="text-sm font-bold" style={{ color: TITLE }}>
            {busqueda ? 'Sin resultados' : 'Aún no hay plataformas virtuales registradas'}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {busqueda
              ? 'Prueba con otra búsqueda.'
              : 'Las plataformas virtuales del convenio aparecerán aquí.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3 text-left">Convenio</th>
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">Clave</th>
                  <th className="px-4 py-3 text-left">Link</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtrados.map(p => {
                  const claveOk = claveVisible.has(p.id)
                  return (
                    <tr key={p.id} className="hover:bg-neutral-50 transition">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold truncate max-w-[260px]" style={{ color: TITLE }}>
                          {p.empresaRazonSocial || '—'}
                        </p>
                        {p.empresaSigla && (
                          <p className="text-[11px] text-neutral-500 mt-0.5 truncate">{p.empresaSigla}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 max-w-[200px]">
                          <span className="text-xs truncate font-mono text-neutral-700">{p.usuario}</span>
                          <button
                            type="button"
                            onClick={() => copiar(p.usuario, 'Usuario')}
                            title="Copiar usuario"
                            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition shrink-0"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono text-neutral-700 select-all">
                            {claveOk ? p.clave : '•'.repeat(Math.min(10, Math.max(6, p.clave.length)))}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleVerClave(p.id)}
                            title={claveOk ? 'Ocultar clave' : 'Mostrar clave'}
                            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition shrink-0"
                          >
                            {claveOk ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copiar(p.clave, 'Clave')}
                            title="Copiar clave"
                            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition shrink-0"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 max-w-[260px]">
                          {linkValido(p.link) ? (
                            <a
                              href={p.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#0070C0] hover:underline truncate inline-flex items-center gap-1"
                            >
                              <ExternalLink size={11} className="shrink-0" />
                              <span className="truncate">{p.link}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-neutral-500 truncate">{p.link || '—'}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${chipEstado(Number(p.estado ?? 0))}`}>
                          {p.estadoLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { setModalEditarId(p.id); setModalOpen(true) }}
                            title="Editar"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white rounded-lg transition"
                            style={{ backgroundColor: TITLE }}
                          >
                            <Pencil size={12} /> Editar
                          </button>
                          {esAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeleteId(p.id)}
                              title="Eliminar (administrador)"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white rounded-lg transition bg-red-600 hover:bg-red-700"
                            >
                              <Trash2 size={12} />
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
      )}

      <PlataformaVirtualModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        proyectoId={proyectoId}
        plataformaId={modalEditarId}
        onSaved={(mensaje) => {
          setModalOpen(false)
          showToast('success', 'Plataforma guardada', mensaje)
          cargar()
        }}
        onError={(msg) => showToast('error', 'No se pudo guardar', msg)}
      />

      <ConfirmModal
        open={deleteId !== null}
        onClose={() => !eliminando && setDeleteId(null)}
        onConfirm={eliminar}
        tipo="delete"
        titulo="Eliminar plataforma virtual"
        mensaje={<>Esta acción no se puede deshacer. ¿Confirmas eliminar la plataforma <b>#{deleteId}</b>?</>}
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
