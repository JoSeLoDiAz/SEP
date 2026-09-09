'use client'

import api from '@/lib/api'
import {
    Activity, ChevronRight, Loader2, ScrollText, Search,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

interface ConvenioItem {
  convenioId: number
  numeroSecop: string
  estadoNum: number | null
  estadoEtiqueta: string
  fechaSuscripcion: string | null
  fechaInicio: string | null
  fechaRegistro: string | null
  proyectoId: number
  proyectoNombre: string
  convocatoria: string | null
  modalidad: string | null
  convocatoriaId: number | null
}

const TITLE_COLOR = '#00304D'

function fmtFecha(d: string | null) {
  if (!d) return '—'
  try {
    const f = new Date(d)
    if (f.getFullYear() < 1950) return '—'
    return f.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return '—' }
}

function estadoColor(estadoEtiqueta: string) {
  const e = estadoEtiqueta?.toUpperCase() ?? ''
  if (e.includes('EJECUCI')) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (e.includes('CORREC') || e.includes('SUBSAN')) return 'bg-amber-50 text-amber-700 border-amber-200'
  if (e.includes('INACTIV') || e.includes('FINALIZ')) return 'bg-neutral-100 text-neutral-500 border-neutral-200'
  return 'bg-blue-50 text-blue-700 border-blue-200'
}

export default function ConveniosListadoPage() {
  const [data, setData] = useState<ConvenioItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    document.title = 'Convenios | SEP'
    api.get<ConvenioItem[]>('/convenios/mios')
      .then(r => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const visibles = useMemo(() => {
    if (!data) return []
    const q = busqueda.trim().toLowerCase()
    if (!q) return data
    return data.filter(c =>
      c.proyectoNombre?.toLowerCase().includes(q) ||
      c.numeroSecop?.toLowerCase().includes(q) ||
      c.convocatoria?.toLowerCase().includes(q) ||
      c.modalidad?.toLowerCase().includes(q),
    )
  }, [data, busqueda])

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={32} className="animate-spin" style={{ color: TITLE_COLOR }} />
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-10 text-center text-red-500 text-sm">
        Error al cargar tus convenios.
      </div>
    )
  }

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">

      {/* Header */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#39A900]" />
        <div className="p-5 sm:p-6 flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-xl bg-[#00304D]/10 flex items-center justify-center shrink-0">
            <ScrollText size={22} className="text-[#00304D]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Conviniente</p>
            <h1 className="text-lg sm:text-xl font-bold text-[#00304D]">Convenios</h1>
            <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
              Aquí encontrarás los convenios firmados entre tu Empresa / Gremio y el SENA, que han sido aprobados y han surtido el proceso respectivo.
              Para gestionar la información, ingresa al detalle del convenio deseado.
            </p>
          </div>
        </div>
      </div>

      {/* Buscador */}
      {(data?.length ?? 0) > 0 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por proyecto, número de convenio, convocatoria..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-neutral-200 rounded-xl outline-none focus:border-[#00304D] bg-white"
          />
        </div>
      )}

      {/* Listado */}
      {visibles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
          <ScrollText size={40} className="text-neutral-200" />
          {(data?.length ?? 0) === 0 ? (
            <>
              <p className="text-neutral-500 font-semibold text-sm">Aún no tienes convenios firmados</p>
              <p className="text-neutral-400 text-xs max-w-md leading-relaxed">
                Cuando uno de tus proyectos aprobados se firme con SENA y el administrador registre el convenio,
                aparecerá en esta sección.
              </p>
            </>
          ) : (
            <p className="text-neutral-400 text-xs">No hay convenios que coincidan con tu búsqueda.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibles.map(c => (
            <Link
              key={c.convenioId}
              href={`/panel/convenios/${c.proyectoId}`}
              className="group bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
            >
              <div className="h-1" style={{ backgroundColor: TITLE_COLOR }} />
              <div className="p-4 sm:p-5 flex flex-col gap-2.5 flex-1">
                <h2 className="text-sm font-bold text-[#00304D] leading-snug line-clamp-2 group-hover:text-[#0070C0] transition">
                  {c.proyectoNombre || 'Proyecto sin nombre'}
                </h2>
                <div className="flex flex-col gap-1 text-[11px] text-neutral-700">
                  <p>
                    <span className="font-semibold text-neutral-500">Convenio:</span>{' '}
                    <span className="font-mono text-neutral-800">{c.numeroSecop || '—'}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-neutral-500">Convocatoria:</span>{' '}
                    <span className="text-neutral-700">{c.convocatoria || '—'}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-neutral-500">Modalidad:</span>{' '}
                    <span>{c.modalidad || '—'}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-neutral-500">Suscripción:</span>{' '}
                    <span>{fmtFecha(c.fechaSuscripcion)}</span>
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border w-fit ${estadoColor(c.estadoEtiqueta)}`}>
                  <Activity size={10} />
                  {c.estadoEtiqueta || '—'}
                </span>
                <div className="mt-auto pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-neutral-400">
                    Registro: {fmtFecha(c.fechaRegistro)}
                  </span>
                  <span className="text-[11px] font-semibold text-[#00304D] inline-flex items-center gap-1 group-hover:gap-1.5 transition">
                    Detalle <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
