'use client'

import api from '@/lib/api'
import { fmtDateTime } from '@/lib/format-date'
import { ChevronRight, Loader2, Search, ShieldCheck } from 'lucide-react'
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
  1: 'Pendiente de aprobación',
  3: 'Aprobado',
}

const ESTADO_COLORS: Record<number, string> = {
  1: 'bg-amber-50 text-amber-700 border-amber-200',
  3: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export default function AprobacionProyectosPage() {
  const [proyectos, setProyectos] = useState<ProyectoConFinal[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [convFiltro, setConvFiltro] = useState<string>('')

  useEffect(() => {
    document.title = 'Aprobación de Proyectos | SEP'
    api.get<ProyectoConFinal[]>('/proyectos/admin/con-final')
      .then(r => setProyectos(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  // Solo proyectos con versión FINAL marcada y aún sin aprobar (estado=1) o
  // ya aprobados (estado=3) — para que admin vea el historial. Estado 2
  // (Reversado) no aplica: la marca FINAL fue retirada.
  const aprobables = useMemo(
    () => (proyectos ?? []).filter(p => p.estado === 1 || p.estado === 3),
    [proyectos],
  )

  const convocatorias = useMemo(() => {
    const map = new Map<number, string>()
    aprobables.forEach(p => {
      if (p.convocatoriaId && p.convocatoria) map.set(p.convocatoriaId, p.convocatoria.trim())
    })
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [aprobables])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return aprobables.filter(p => {
      if (convFiltro && String(p.convocatoriaId) !== convFiltro) return false
      if (!q) return true
      const haystack = [
        p.proyectoId, p.nombre, p.empresa, p.nit, p.versionCodigo, p.convocatoria,
      ].map(v => String(v ?? '').toLowerCase()).join(' ')
      return haystack.includes(q)
    })
  }, [aprobables, busqueda, convFiltro])

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">

      {/* Header */}
      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex items-center gap-3">
        <ShieldCheck size={22} className="text-white" />
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-base">Aprobación de Proyectos</h1>
          <p className="text-[11px] text-white/60">Selecciona un proyecto para abrir su reporte y aprobarlo desde ahí.</p>
        </div>
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
          Error al cargar el listado de proyectos.
        </div>
      ) : !visibles.length ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-neutral-200 p-10 text-center text-neutral-400 text-sm">
          No hay proyectos pendientes de aprobación.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
              {visibles.length} proyecto{visibles.length === 1 ? '' : 's'}
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
                  <th className="px-4 py-3 font-semibold">Versión FINAL</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold text-right">Acción</th>
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
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-amber-700">V{p.versionNumero}</div>
                      <div className="text-[10px] text-neutral-400 font-mono">{p.versionCodigo}</div>
                      {p.versionFinalFecha && (
                        <div className="text-[10px] text-neutral-400 mt-0.5">{fmtDateTime(p.versionFinalFecha)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${ESTADO_COLORS[p.estado ?? 0] ?? 'bg-neutral-50 text-neutral-500 border-neutral-200'}`}>
                        {ESTADO_LABELS[p.estado ?? 0] ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/panel/proyectos/${p.proyectoId}/reporte`}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-xl transition ${
                          p.estado === 3
                            ? 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}>
                        {p.estado === 3 ? 'Ver reporte' : 'Ir a aprobar'} <ChevronRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
