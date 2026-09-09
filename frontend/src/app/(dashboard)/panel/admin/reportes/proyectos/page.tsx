'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import { fmtDateTime } from '@/lib/format-date'
import { Archive, Download, FileBarChart, Loader2, Search } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

interface ProyectoConFinal {
  proyectoId: number
  nombre: string
  estado: number | null
  fechaConfirmacion: string | null
  convocatoria: string | null
  convocatoriaId: number | null
  modalidad: string | null
  empresa: string | null
  nit: number | string | null
  digitoV: number | string | null
  versionId: number
  versionNumero: number
  versionCodigo: string
  versionFinalFecha: string | null
}

const ESTADO_LABELS: Record<number, string> = {
  1: 'Confirmado',
  2: 'Reversado',
  3: 'Aprobado',
  4: 'Rechazado',
}

const ESTADO_COLORS: Record<number, string> = {
  1: 'bg-blue-50 text-blue-700 border-blue-200',
  3: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  4: 'bg-red-50 text-red-700 border-red-200',
}

export default function ReporteProyectosAdminPage() {
  const [proyectos, setProyectos] = useState<ProyectoConFinal[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [convFiltro, setConvFiltro] = useState<string>('')
  const [descargandoId, setDescargandoId] = useState<number | null>(null)

  // Descarga masiva en ZIP
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkConfirmado, setBulkConfirmado] = useState(true)
  const [bulkAprobado, setBulkAprobado] = useState(true)
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    document.title = 'Reporte de Proyectos | SEP'
    api.get<ProyectoConFinal[]>('/proyectos/admin/con-final')
      .then(r => setProyectos(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const convocatorias = useMemo(() => {
    if (!proyectos) return []
    const map = new Map<number, string>()
    proyectos.forEach(p => {
      if (p.convocatoriaId && p.convocatoria) map.set(p.convocatoriaId, p.convocatoria.trim())
    })
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [proyectos])

  const visibles = useMemo(() => {
    if (!proyectos) return []
    const q = busqueda.trim().toLowerCase()
    return proyectos.filter(p => {
      if (convFiltro && String(p.convocatoriaId) !== convFiltro) return false
      if (!q) return true
      const haystack = [
        p.proyectoId, p.nombre, p.empresa, p.nit, p.versionCodigo, p.convocatoria,
      ].map(v => String(v ?? '').toLowerCase()).join(' ')
      return haystack.includes(q)
    })
  }, [proyectos, busqueda, convFiltro])

  async function descargarExcel(p: ProyectoConFinal) {
    setDescargandoId(p.proyectoId)
    try {
      const resp = await api.get(`/proyectos/${p.proyectoId}/excel`, {
        responseType: 'blob',
        timeout: 60_000,
      })
      const blob = new Blob([resp.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${p.versionCodigo}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Error al descargar Excel', e)
      alert('No se pudo generar el Excel del proyecto. Revisa el log del backend.')
    } finally {
      setDescargandoId(null)
    }
  }

  async function descargarBulk() {
    const estados: number[] = []
    if (bulkConfirmado) estados.push(1)
    if (bulkAprobado)   estados.push(3)
    if (!estados.length) {
      alert('Selecciona al menos un estado.')
      return
    }
    setBulkLoading(true)
    try {
      // Usamos fetch nativo (no axios) porque maneja mejor las descargas
      // largas de blobs grandes — axios marca "Network Error" en el
      // navegador cuando la respuesta tarda y el blob excede ciertos
      // tamaños, aunque la descarga sí termine correctamente.
      const token = typeof window !== 'undefined' ? localStorage.getItem('sep_token') : null
      const baseURL = (api.defaults.baseURL ?? '').replace(/\/+$/, '')
      const url = `${baseURL}/proyectos/admin/excel-bulk?estados=${estados.join(',')}`
      const resp = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!resp.ok) {
        if (resp.status === 404) {
          alert('No hay proyectos con versión FINAL en los estados seleccionados.')
        } else {
          alert(`No se pudo generar la descarga masiva (HTTP ${resp.status}). Revisa el log del backend.`)
        }
        return
      }
      const blob = await resp.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      a.download = `reportes-${estados.join('-')}-${ts}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
      setBulkOpen(false)
    } catch (e) {
      console.error('Error al generar ZIP', e)
      alert('No se pudo generar la descarga masiva. Revisa el log del backend.')
    } finally {
      setBulkLoading(false)
    }
  }

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">

      {/* Header */}
      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex items-center gap-3">
        <FileBarChart size={22} className="text-white" />
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-base">Reporte de Proyectos por Convocatoria</h1>
          <p className="text-[11px] text-white/60">Solo aparecen proyectos con una versión marcada como FINAL.</p>
        </div>
        <button
          onClick={() => setBulkOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition">
          <Archive size={13} /> Descargar todos
        </button>
        <Link href="/panel"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition">
          ← Volver
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por código, nombre, empresa, NIT…"
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00304D]/30"
          />
        </div>
        <select
          value={convFiltro}
          onChange={e => setConvFiltro(e.target.value)}
          className="px-3 py-2.5 text-sm border border-neutral-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 sm:min-w-[280px]">
          <option value="">Todas las convocatorias</option>
          {convocatorias.map(c => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#00304D]" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center text-red-500 text-sm">
          Error al cargar el listado de proyectos. Revisa que el backend esté corriendo.
        </div>
      ) : !visibles.length ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-neutral-200 p-10 text-center text-neutral-400 text-sm">
          No hay proyectos que coincidan con los filtros.
          {proyectos?.length === 0 && ' Aún no hay proyectos con versión FINAL marcada.'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
              {visibles.length} proyecto{visibles.length === 1 ? '' : 's'} con versión FINAL
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50">
                <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3 font-semibold">Código</th>
                  <th className="px-4 py-3 font-semibold">Proyecto</th>
                  <th className="px-4 py-3 font-semibold">Empresa / NIT</th>
                  <th className="px-4 py-3 font-semibold">Convocatoria</th>
                  <th className="px-4 py-3 font-semibold">Modalidad</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Versión FINAL</th>
                  <th className="px-4 py-3 font-semibold text-right">Excel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visibles.map(p => (
                  <tr key={p.proyectoId} className="hover:bg-neutral-50/50">
                    <td className="px-4 py-3 font-mono text-neutral-700 whitespace-nowrap">{p.proyectoId}</td>
                    <td className="px-4 py-3">
                      <Link href={`/panel/proyectos/${p.proyectoId}/reporte`}
                        className="font-semibold text-[#00304D] hover:underline line-clamp-2">
                        {p.nombre || '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      <div className="font-medium line-clamp-1">{p.empresa?.trim() || '—'}</div>
                      <div className="text-[10px] text-neutral-400 font-mono">
                        {p.nit ? `${p.nit}${p.digitoV ? '-' + p.digitoV : ''}` : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 line-clamp-2">{p.convocatoria?.trim() || '—'}</td>
                    <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">{p.modalidad || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${ESTADO_COLORS[p.estado ?? 0] ?? 'bg-neutral-50 text-neutral-500 border-neutral-200'}`}>
                        {ESTADO_LABELS[p.estado ?? 0] ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-amber-700">V{p.versionNumero}</div>
                      <div className="text-[10px] text-neutral-400 font-mono">{p.versionCodigo}</div>
                      {p.versionFinalFecha && (
                        <div className="text-[10px] text-neutral-400 mt-0.5">{fmtDateTime(p.versionFinalFecha)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => descargarExcel(p)}
                        disabled={descargandoId === p.proyectoId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition">
                        {descargandoId === p.proyectoId
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Download size={13} />}
                        Excel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de descarga masiva */}
      <Modal open={bulkOpen} onClose={() => !bulkLoading && setBulkOpen(false)} maxWidth="max-w-md">
        <div className="p-6 flex flex-col gap-4">
          <h3 className="text-base font-bold text-neutral-800 flex items-center gap-2">
            <Archive size={18} className="text-emerald-600" />
            Descargar reportes masivamente
          </h3>
          <p className="text-sm text-neutral-600">
            Selecciona qué proyectos incluir. Se generará un archivo <code className="text-xs bg-neutral-100 px-1.5 py-0.5 rounded">.zip</code> con un Excel por cada proyecto que tenga versión FINAL.
          </p>
          <div className="flex flex-col gap-2.5">
            <label className="flex items-center gap-3 px-3 py-2.5 border border-neutral-200 rounded-xl cursor-pointer hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={bulkConfirmado}
                onChange={e => setBulkConfirmado(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                Confirmados
              </span>
              <span className="text-xs text-neutral-500">Estado 1 — con versión FINAL marcada</span>
            </label>
            <label className="flex items-center gap-3 px-3 py-2.5 border border-neutral-200 rounded-xl cursor-pointer hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={bulkAprobado}
                onChange={e => setBulkAprobado(e.target.checked)}
                className="w-4 h-4 accent-emerald-600"
              />
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                Aprobados
              </span>
              <span className="text-xs text-neutral-500">Estado 3 — ya aprobados por SENA</span>
            </label>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800">
            Si hay muchos proyectos puede tomar varios minutos. No cierres la pestaña durante la descarga.
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setBulkOpen(false)} disabled={bulkLoading}
              className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={descargarBulk} disabled={bulkLoading || (!bulkConfirmado && !bulkAprobado)}
              className="px-4 py-2 text-sm font-semibold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50 inline-flex items-center gap-1.5">
              {bulkLoading
                ? <><Loader2 size={14} className="animate-spin" /> Generando ZIP…</>
                : <><Download size={14} /> Descargar</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
