'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import {
  AlertCircle, ArrowRight, BookOpenCheck, CheckCircle2, IdCard, Loader2,
  Plus, Search, UserPlus, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

const TITLE = '#00304D'
const SENA = '#39A900'

interface TipoDoc { id: number; nombre: string }
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
interface BuscarResp {
  estado: 'sin-persona' | 'sin-postulacion' | 'desactualizada' | 'vigente'
  anoVigente: number
  persona: {
    personaId: number
    tipoDocumento: string | null
    identificacion: string
    nombres: string | null
    primerApellido: string | null
    segundoApellido: string | null
  } | null
  postulacion: { ano: number } | null
}

interface Props {
  open: boolean
  onClose: () => void
  proyectoId: number
  /** Refresca la tabla del padre tras asociar/remover. */
  onCambio?: () => void
  onToast?: (tipo: 'success' | 'error', mensaje: string) => void
  /** Para llevar al usuario al registrar si la postulación no está vigente. */
  onIrARegistrar?: (tipoDocumentoId: number, identificacion: string) => void
}

export function AsociarRapidoModal({ open, onClose, proyectoId, onCambio, onToast, onIrARegistrar }: Props) {
  const [tiposDoc, setTiposDoc] = useState<TipoDoc[]>([])
  const [cargandoCat, setCargandoCat] = useState(false)
  const [bTipoDocId, setBTipoDocId] = useState(0)
  const [bIdent, setBIdent] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultado, setResultado] = useState<BuscarResp | null>(null)
  const [acciones, setAcciones] = useState<AfItem[]>([])
  const [cargandoGrupos, setCargandoGrupos] = useState(false)
  const [trabajando, setTrabajando] = useState(false)

  /* Reset state cada vez que se abre */
  useEffect(() => {
    if (!open) return
    setResultado(null); setAcciones([]); setBIdent('')
    setCargandoCat(true)
    api.get<TipoDoc[]>('/auth/tipos-documento?para=persona')
      .then(r => {
        setTiposDoc(r.data ?? [])
        const cc = (r.data ?? []).find(t => /c[eé]dula/i.test(t.nombre) && /ciudadan/i.test(t.nombre))
        if (cc) setBTipoDocId(cc.id)
      })
      .catch(() => {})
      .finally(() => setCargandoCat(false))
  }, [open])

  async function buscar() {
    if (!bTipoDocId || !bIdent.trim()) {
      onToast?.('error', 'Selecciona el tipo de documento e ingresa el número.')
      return
    }
    setBuscando(true)
    try {
      const r = await api.get<BuscarResp>(`/convenios/${proyectoId}/beneficiarios/persona/buscar`, {
        params: { tipoDocumentoId: bTipoDocId, identificacion: bIdent.trim() },
      })
      setResultado(r.data)
      if (r.data.estado === 'vigente' && r.data.persona) {
        // Cargar AFs/grupos automáticamente.
        setCargandoGrupos(true)
        try {
          const rg = await api.get<{ acciones: AfItem[] }>(
            `/convenios/${proyectoId}/beneficiarios/persona/${r.data.persona.personaId}/grupos`,
          )
          setAcciones(rg.data?.acciones ?? [])
        } catch {
          setAcciones([])
        } finally { setCargandoGrupos(false) }
      } else {
        setAcciones([])
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      onToast?.('error', msg ?? 'No se pudo realizar la búsqueda.')
    } finally { setBuscando(false) }
  }

  async function recargarGrupos() {
    if (!resultado?.persona?.personaId) return
    try {
      const rg = await api.get<{ acciones: AfItem[] }>(
        `/convenios/${proyectoId}/beneficiarios/persona/${resultado.persona.personaId}/grupos`,
      )
      setAcciones(rg.data?.acciones ?? [])
    } catch { /* silent */ }
  }

  async function asociar(afGrupoId: number) {
    if (!resultado?.persona?.personaId) return
    const af = acciones.find(a => a.grupos.some(g => g.afGrupoId === afGrupoId))
    const grupo = af?.grupos.find(g => g.afGrupoId === afGrupoId)
    const etiqueta = af && grupo ? `AF ${af.numero ?? '?'} · Grupo ${grupo.numero ?? '?'}` : 'al grupo'
    setTrabajando(true)
    try {
      await api.post(`/convenios/${proyectoId}/beneficiarios/asociar`, {
        personaId: resultado.persona.personaId, afGrupoId,
      })
      onToast?.('success', `Beneficiario asociado a ${etiqueta}.`)
      await recargarGrupos()
      onCambio?.()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      onToast?.('error', msg ?? 'No se pudo asociar al grupo.')
    } finally { setTrabajando(false) }
  }

  async function remover(afGrupoBeneficiarioId: number) {
    let etiqueta = 'el grupo'
    for (const a of acciones) {
      const g = a.grupos.find(x => x.afGrupoBeneficiarioId === afGrupoBeneficiarioId)
      if (g) { etiqueta = `AF ${a.numero ?? '?'} · Grupo ${g.numero ?? '?'}`; break }
    }
    setTrabajando(true)
    try {
      await api.delete(`/convenios/${proyectoId}/beneficiarios/asociar/${afGrupoBeneficiarioId}`)
      onToast?.('success', `Beneficiario removido de ${etiqueta}.`)
      await recargarGrupos()
      onCambio?.()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      onToast?.('error', msg ?? 'No se pudo remover la asociación.')
    } finally { setTrabajando(false) }
  }

  const persona = resultado?.persona
  const nombreCompleto = persona ? [persona.nombres, persona.primerApellido, persona.segundoApellido]
    .map(x => (x ?? '').trim()).filter(Boolean).join(' ') : ''
  const totalActivas = acciones.flatMap(a => a.grupos).filter(g =>
    (g.estado ?? '').trim().toUpperCase() === 'ACTIVO',
  ).length

  function bannerEstado() {
    if (!resultado) return null
    const e = resultado.estado
    const docLinea = resultado.persona
      ? `${resultado.persona.tipoDocumento ?? '—'} · ${resultado.persona.identificacion ?? '—'}`
      : null

    if (e === 'sin-persona') return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-3">
        <AlertCircle size={18} />
        <div className="flex-1">
          <p className="font-bold">No existe persona con ese documento.</p>
          <p className="text-xs">Regístrala primero como beneficiaria para poder asociarla a un grupo.</p>
        </div>
        <button onClick={() => onIrARegistrar?.(bTipoDocId, bIdent.trim())}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm whitespace-nowrap"
          style={{ backgroundColor: TITLE }}>
          <UserPlus size={12} /> Registrar
        </button>
      </div>
    )
    if (e === 'sin-postulacion') return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-3">
        <AlertCircle size={18} />
        <div className="flex-1">
          <p className="font-bold">{nombreCompleto || 'Persona encontrada'}</p>
          <p className="text-xs">{docLinea ?? ''} {docLinea ? '·' : ''} Sin postulación para el año {resultado.anoVigente}. Debe diligenciarla antes de asociarla.</p>
        </div>
        <button onClick={() => onIrARegistrar?.(bTipoDocId, bIdent.trim())}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm whitespace-nowrap"
          style={{ backgroundColor: TITLE }}>
          Diligenciar postulación <ArrowRight size={12} />
        </button>
      </div>
    )
    if (e === 'desactualizada') return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-3">
        <AlertCircle size={18} />
        <div className="flex-1">
          <p className="font-bold">{nombreCompleto || 'Persona encontrada'}</p>
          <p className="text-xs">{docLinea ?? ''} {docLinea ? '·' : ''} Última postulación: año {resultado.postulacion?.ano}. Actualiza datos y postulación al año {resultado.anoVigente}.</p>
        </div>
        <button onClick={() => onIrARegistrar?.(bTipoDocId, bIdent.trim())}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm whitespace-nowrap"
          style={{ backgroundColor: TITLE }}>
          Actualizar datos <ArrowRight size={12} />
        </button>
      </div>
    )
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
        <CheckCircle2 size={18} />
        <div className="flex-1">
          <p className="font-bold">{nombreCompleto}</p>
          <p className="text-xs">{docLinea ?? ''} {docLinea ? '·' : ''} Postulación vigente {resultado.anoVigente}</p>
        </div>
        {totalActivas > 0 && (
          <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-2 py-1 rounded-full">
            {totalActivas} asociación{totalActivas === 1 ? '' : 'es'} activa{totalActivas === 1 ? '' : 's'}
          </span>
        )}
      </div>
    )
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-3xl">
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0 border-b border-neutral-100" style={{ backgroundColor: TITLE }}>
          <div className="p-2 rounded-lg bg-white/10">
            <BookOpenCheck size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-base">Asociar rápido</h2>
            <p className="text-white/70 text-xs">Busca a la persona por su documento y asóciala a un grupo si tiene postulación vigente.</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">
          {/* Buscador */}
          <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
            <div className="flex flex-col sm:flex-row items-end gap-3">
              <div className="flex items-center gap-2 text-[#00304D] font-bold text-sm shrink-0 self-start sm:self-end">
                <IdCard size={16} /> Buscar persona
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">Tipo Documento *</label>
                  <select value={bTipoDocId} onChange={e => setBTipoDocId(Number(e.target.value))}
                    className="h-10 rounded-lg border border-neutral-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0] bg-white">
                    <option value={0}>— Seleccione —</option>
                    {tiposDoc.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">Identificación *</label>
                  <input type="text" value={bIdent}
                    onChange={e => setBIdent(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => { if (e.key === 'Enter') buscar() }}
                    placeholder="1234567890" maxLength={20}
                    className="h-10 rounded-lg border border-neutral-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0] bg-white" />
                </div>
              </div>
              <button onClick={buscar} disabled={buscando || cargandoCat}
                className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-40 transition"
                style={{ backgroundColor: SENA }}>
                {buscando ? <><Loader2 size={13} className="animate-spin" /> Buscando…</> : <><Search size={13} /> Buscar</>}
              </button>
            </div>
          </div>

          {/* Banner estado */}
          {bannerEstado()}

          {/* Lista de AFs/Grupos solo si está vigente */}
          {resultado?.estado === 'vigente' && (
            cargandoGrupos ? (
              <div className="flex items-center gap-2 py-8 justify-center text-neutral-400 text-sm">
                <Loader2 size={16} className="animate-spin" /> Cargando acciones de formación…
              </div>
            ) : acciones.length === 0 ? (
              <div className="text-center text-sm text-neutral-500 py-6">
                Este proyecto aún no tiene acciones de formación registradas.
              </div>
            ) : acciones.map(af => {
              const grupoActivoEnAF = af.grupos.find(g => (g.estado ?? '').trim().toUpperCase() === 'ACTIVO')
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
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-between flex-shrink-0 bg-neutral-50">
          <span className="text-[11px] text-neutral-500 italic">
            Una persona solo puede estar en un grupo por AF. Máx. 5% de beneficiarios repetidos en AFs del proyecto.
          </span>
          <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow"
            style={{ backgroundColor: TITLE }}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}
