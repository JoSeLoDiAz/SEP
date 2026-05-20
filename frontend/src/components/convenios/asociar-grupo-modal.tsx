'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import {
  BookOpenCheck, CheckCircle2, Link2, Loader2, Plus, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

const TITLE = '#00304D'
const SENA = '#39A900'

interface GrupoItem {
  afGrupoId: number
  numero: number | null
  afGrupoBeneficiarioId: number | null
  estado: string | null
  ano: number | null
}
interface AfItem {
  afId: number
  numero: number | null
  nombre: string | null
  transferencia: number | null
  grupos: GrupoItem[]
}
interface Resp { acciones: AfItem[] }

interface Props {
  open: boolean
  onClose: () => void
  proyectoId: number
  personaId: number | null
  nombreCompleto: string
  /** Llamado después de guardar/eliminar para refrescar la vista padre. */
  onCambio?: () => void
  /** Toast: éxitos y errores se delegan al padre. */
  onToast?: (tipo: 'success' | 'error', mensaje: string) => void
}

export function AsociarGrupoModal({ open, onClose, proyectoId, personaId, nombreCompleto, onCambio, onToast }: Props) {
  const [cargando, setCargando] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [acciones, setAcciones] = useState<AfItem[]>([])

  async function cargar() {
    if (!personaId) return
    setCargando(true)
    try {
      const r = await api.get<Resp>(`/convenios/${proyectoId}/beneficiarios/persona/${personaId}/grupos`)
      setAcciones(r.data?.acciones ?? [])
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      onToast?.('error', msg ?? 'No se pudieron cargar las acciones de formación.')
    } finally { setCargando(false) }
  }

  useEffect(() => { if (open && personaId) cargar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, personaId])

  async function asociar(afGrupoId: number) {
    if (!personaId) return
    // Resolver AF/Grupo para el mensaje del toast.
    const af = acciones.find(a => a.grupos.some(g => g.afGrupoId === afGrupoId))
    const grupo = af?.grupos.find(g => g.afGrupoId === afGrupoId)
    const etiqueta = af && grupo ? `AF ${af.numero ?? '?'} · Grupo ${grupo.numero ?? '?'}` : 'al grupo'
    setTrabajando(true)
    try {
      await api.post(`/convenios/${proyectoId}/beneficiarios/asociar`, { personaId, afGrupoId })
      onToast?.('success', `Beneficiario asociado a ${etiqueta}.`)
      await cargar()
      onCambio?.()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      onToast?.('error', msg ?? 'No se pudo asociar al grupo.')
    } finally { setTrabajando(false) }
  }

  async function remover(afGrupoBeneficiarioId: number) {
    // Resolver AF/Grupo del que se está removiendo.
    let etiqueta = 'el grupo'
    for (const a of acciones) {
      const g = a.grupos.find(x => x.afGrupoBeneficiarioId === afGrupoBeneficiarioId)
      if (g) { etiqueta = `AF ${a.numero ?? '?'} · Grupo ${g.numero ?? '?'}`; break }
    }
    setTrabajando(true)
    try {
      await api.delete(`/convenios/${proyectoId}/beneficiarios/asociar/${afGrupoBeneficiarioId}`)
      onToast?.('success', `Beneficiario removido de ${etiqueta}.`)
      await cargar()
      onCambio?.()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      onToast?.('error', msg ?? 'No se pudo remover la asociación.')
    } finally { setTrabajando(false) }
  }

  const totalActivas = acciones.flatMap(a => a.grupos).filter(g =>
    (g.estado ?? '').trim().toUpperCase() === 'ACTIVO',
  ).length

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-3xl">
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0 border-b border-neutral-100" style={{ backgroundColor: TITLE }}>
          <div className="p-2 rounded-lg bg-white/10">
            <BookOpenCheck size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-base">Asociar a acción de formación</h2>
            <p className="text-white/70 text-xs">
              {nombreCompleto} {totalActivas > 0 ? `· ${totalActivas} asociación${totalActivas === 1 ? '' : 'es'} activa${totalActivas === 1 ? '' : 's'}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-3">
          {cargando ? (
            <div className="flex items-center gap-2 py-12 justify-center text-neutral-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Cargando acciones de formación…
            </div>
          ) : acciones.length === 0 ? (
            <div className="text-center text-sm text-neutral-500 py-10">
              Este proyecto aún no tiene acciones de formación registradas.
            </div>
          ) : acciones.map(af => {
            const grupoActivoEnAF = af.grupos.find(
              g => (g.estado ?? '').trim().toUpperCase() === 'ACTIVO',
            )
            return (
              <div key={af.afId} className="border border-neutral-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-neutral-50 flex items-center gap-3">
                  <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-[#00304D] text-white text-xs font-bold">
                    AF {af.numero ?? '?'}
                  </span>
                  <p className="text-sm font-semibold text-[#00304D] flex-1 line-clamp-1" title={af.nombre ?? ''}>
                    {af.nombre || 'Sin nombre'}
                  </p>
                  {grupoActivoEnAF && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      ASOCIADO · Grupo {grupoActivoEnAF.numero ?? '?'}
                    </span>
                  )}
                  {af.transferencia === 1 && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">TRANSFERENCIA</span>
                  )}
                </div>
                <div className="p-3 flex flex-wrap gap-2">
                  {af.grupos.length === 0 ? (
                    <span className="text-xs text-neutral-400 italic px-2 py-1">Esta AF no tiene grupos.</span>
                  ) : af.grupos.map(g => {
                    const activo = (g.estado ?? '').trim().toUpperCase() === 'ACTIVO'
                    const retirado = (g.estado ?? '').trim().toUpperCase() === 'RETIRADO'
                    // Regla: una persona solo va en un grupo por AF. Si ya
                    // hay grupo activo en este AF, los demás no se pueden añadir.
                    const bloqueadoPorAF = !!grupoActivoEnAF && !activo
                    return (
                      <div key={g.afGrupoId} className={`inline-flex items-stretch border rounded-lg overflow-hidden
                        ${bloqueadoPorAF ? 'opacity-50' : ''}`}>
                        <span className={`px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5
                          ${activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : retirado ? 'bg-neutral-50 text-neutral-500 border-neutral-200'
                            : 'bg-white text-neutral-600 border-neutral-200'}`}>
                          {activo && <CheckCircle2 size={12} />}
                          Grupo {g.numero ?? '?'}
                          {retirado && <span className="text-[9px] uppercase">(retirado)</span>}
                        </span>
                        {activo && g.afGrupoBeneficiarioId ? (
                          <button onClick={() => remover(g.afGrupoBeneficiarioId!)} disabled={trabajando}
                            title="Remover del grupo"
                            className="px-2 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 border-l border-red-200">
                            <X size={13} />
                          </button>
                        ) : bloqueadoPorAF ? (
                          <span title="La persona ya está en otro grupo de esta AF"
                            className="px-2 bg-neutral-100 text-neutral-400 inline-flex items-center cursor-not-allowed border-l border-neutral-200">
                            <X size={13} />
                          </span>
                        ) : (
                          <button onClick={() => asociar(g.afGrupoId)} disabled={trabajando}
                            title="Asociar a este grupo"
                            className="px-2 text-white hover:opacity-90 disabled:opacity-40 border-l border-emerald-700"
                            style={{ backgroundColor: SENA }}>
                            <Plus size={13} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-between flex-shrink-0 bg-neutral-50">
          <div className="text-xs text-neutral-500 flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5">
              <Link2 size={12} />
              Verde = asociado · Toca <Plus size={11} className="inline" /> para añadir o <X size={11} className="inline" /> para remover
            </span>
            <span className="text-[11px] text-neutral-400 italic">
              Una persona solo puede estar en un grupo por AF. Máx. 5% de beneficiarios repetidos en AFs del proyecto.
            </span>
          </div>
          <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow"
            style={{ backgroundColor: TITLE }}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}
