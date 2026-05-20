'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import {
  AlertCircle, Building2, Loader2, MapPin, Users, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

const TITLE = '#00304D'

interface CoberturaRow {
  id: number
  departamentoId: number | null
  departamento: string | null
  ciudadId: number | null
  ciudad: string | null
  cupos: number
  justificacion: string | null
  rural: number | null
}
interface Resp {
  grupo: { afGrupoId: number; numero: number; afNumero: number; afNombre: string | null }
  coberturas: CoberturaRow[]
  totalCupos: number
}

interface Props {
  open: boolean
  onClose: () => void
  proyectoId: number
  afGrupoId: number | null
}

export function GrupoCoberturaModal({ open, onClose, proyectoId, afGrupoId }: Props) {
  const [cargando, setCargando] = useState(false)
  const [data, setData] = useState<Resp | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !afGrupoId) return
    setCargando(true); setError(null); setData(null)
    api.get<Resp>(`/grupos/proyecto/${proyectoId}/grupo/${afGrupoId}/cobertura`)
      .then(r => setData(r.data))
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        setError(msg ?? 'No se pudo cargar la cobertura del grupo.')
      })
      .finally(() => setCargando(false))
  }, [open, afGrupoId, proyectoId])

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-3xl">
      <div className="flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0 border-b border-neutral-100" style={{ backgroundColor: '#39A900' }}>
          <div className="p-2 rounded-lg bg-white/10">
            <MapPin size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-base">Cobertura del grupo</h2>
            <p className="text-white/80 text-xs">
              {data ? `AF ${data.grupo.afNumero} · Grupo ${data.grupo.numero} · ${data.totalCupos} cupos en total` : 'Cargando…'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {cargando ? (
            <div className="flex items-center gap-2 py-12 justify-center text-neutral-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Cargando…
            </div>
          ) : data && data.coberturas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-neutral-400">
              <Building2 size={32} className="text-neutral-200" />
              <p className="text-sm">Este grupo aún no tiene cobertura registrada.</p>
            </div>
          ) : data && (
            <>
              {/* Resumen */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <Users size={18} className="text-emerald-700" />
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Total de cupos</p>
                  <p className="text-2xl font-bold text-emerald-800">{data.totalCupos}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Cobertura</p>
                  <p className="text-sm font-semibold text-emerald-800">{data.coberturas.length} {data.coberturas.length === 1 ? 'cobertura' : 'coberturas'}</p>
                </div>
              </div>

              {/* Tabla */}
              <div className="border border-neutral-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wide bg-neutral-50 text-neutral-600">
                      <th className="px-3 py-2.5">Departamento</th>
                      <th className="px-3 py-2.5">Ciudad</th>
                      <th className="px-3 py-2.5 text-center">Cupos</th>
                      <th className="px-3 py-2.5 text-center">Rural</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data.coberturas.map(c => {
                      const esRural = Number(c.rural) >= 1
                      return (
                        <tr key={c.id} className="hover:bg-neutral-50">
                          <td className="px-3 py-2.5 font-medium text-[#00304D]">{c.departamento || '—'}</td>
                          <td className="px-3 py-2.5 text-neutral-700">{c.ciudad || '—'}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-[#00304D]">{c.cupos}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[36px] text-[10px] font-bold px-2 py-0.5 rounded-full border ${esRural
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}>
                              {esRural ? 'SÍ' : 'NO'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-neutral-100 flex justify-end flex-shrink-0 bg-neutral-50">
          <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow"
            style={{ backgroundColor: TITLE }}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}
