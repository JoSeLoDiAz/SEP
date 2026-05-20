'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import {
  AlertCircle, BadgeCheck, CheckCircle2, IdCard, Loader2, Power, ShieldCheck,
  Users, X, XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'

const TITLE = '#00304D'

interface BenefRow {
  afGrupoBeneficiarioId: number
  personaId: number
  tipoDocumento: string | null
  identificacion: string | null
  nombreCompleto: string
  estado: string | null
  certifica: string | null
  validacionInterventor: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  proyectoId: number
  afGrupoId: number | null
  afNumero: number | null
  grupoNumero: number | null
  /** Si el convenio no está en ejecución, el toggle queda deshabilitado. */
  convenioEnEjecucion?: boolean
  onToast?: (tipo: 'success' | 'error', mensaje: string) => void
}

function chipEstado(estado: string | null) {
  const e = (estado ?? '').trim().toUpperCase()
  if (e === 'ACTIVO')
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 size={11} /> Activo</span>
  if (e === 'RETIRADO' || e === 'INACTIVO')
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200"><XCircle size={11} /> {e === 'RETIRADO' ? 'Retirado' : 'Inactivo'}</span>
  return <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{estado || '—'}</span>
}

function chipInter(estado: string | null) {
  const e = (estado ?? '').trim().toUpperCase()
  if (e === 'APROBADO' || e === 'VERIFICADO')
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><ShieldCheck size={11} /> {e}</span>
  if (e === 'RECHAZADO')
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200"><XCircle size={11} /> Rechazado</span>
  if (e === 'PENDIENTE' || !e)
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"><ShieldCheck size={11} /> Pendiente</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">{estado}</span>
}

export function GrupoBeneficiariosModal({ open, onClose, proyectoId, afGrupoId, afNumero, grupoNumero, convenioEnEjecucion, onToast }: Props) {
  const [cargando, setCargando] = useState(false)
  const [rows, setRows] = useState<BenefRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [trabajandoId, setTrabajandoId] = useState<number | null>(null)

  async function cargar() {
    if (!afGrupoId) return
    setCargando(true); setError(null)
    try {
      const r = await api.get<BenefRow[]>(`/grupos/proyecto/${proyectoId}/grupo/${afGrupoId}/beneficiarios`)
      setRows(r.data ?? [])
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'No se pudieron cargar los beneficiarios del grupo.')
    } finally { setCargando(false) }
  }

  useEffect(() => {
    if (!open || !afGrupoId) return
    void cargar()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [open, afGrupoId, proyectoId])

  async function toggleEstado(b: BenefRow) {
    const actual = (b.estado ?? '').trim().toUpperCase()
    const siguiente: 'ACTIVO' | 'RETIRADO' = actual === 'ACTIVO' ? 'RETIRADO' : 'ACTIVO'
    setTrabajandoId(b.afGrupoBeneficiarioId)
    try {
      await api.post(
        `/grupos/proyecto/${proyectoId}/beneficiario/${b.afGrupoBeneficiarioId}/estado`,
        { estado: siguiente },
      )
      onToast?.('success', siguiente === 'ACTIVO' ? 'Beneficiario activado.' : 'Beneficiario retirado.')
      await cargar()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      onToast?.('error', msg ?? 'No se pudo cambiar el estado.')
    } finally { setTrabajandoId(null) }
  }

  const activos = rows.filter(r => (r.estado ?? '').trim().toUpperCase() === 'ACTIVO').length

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-5xl">
      <div className="flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0 border-b border-neutral-100" style={{ backgroundColor: TITLE }}>
          <div className="p-2 rounded-lg bg-white/10">
            <Users size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-base">Beneficiarios del grupo</h2>
            <p className="text-white/70 text-xs">
              AF {afNumero ?? '?'} · Grupo {grupoNumero ?? '?'} · {activos} activos
              {rows.length > activos ? ` · ${rows.length - activos} inactivos` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {error && (
            <div className="m-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {cargando ? (
            <div className="flex items-center gap-2 py-12 justify-center text-neutral-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Cargando…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-neutral-400">
              <IdCard size={32} className="text-neutral-200" />
              <p className="text-sm">Este grupo aún no tiene beneficiarios asociados.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wide bg-neutral-50 text-neutral-600 sticky top-0">
                  <th className="px-3 py-2.5 w-12 text-center">N°</th>
                  <th className="px-3 py-2.5">Tipo Documento</th>
                  <th className="px-3 py-2.5">Identificación</th>
                  <th className="px-3 py-2.5">Nombre</th>
                  <th className="px-3 py-2.5 text-center">Estado</th>
                  <th className="px-3 py-2.5 text-center">Certifica</th>
                  <th className="px-3 py-2.5 text-center">Interventoría</th>
                  <th className="px-3 py-2.5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((b, i) => {
                  const esActivo = (b.estado ?? '').trim().toUpperCase() === 'ACTIVO'
                  const trabajando = trabajandoId === b.afGrupoBeneficiarioId
                  const disabled = convenioEnEjecucion === false || trabajando
                  return (
                    <tr key={b.afGrupoBeneficiarioId} className="hover:bg-neutral-50">
                      <td className="px-3 py-2.5 text-center text-neutral-500">{i + 1}</td>
                      <td className="px-3 py-2.5 text-neutral-700">{b.tipoDocumento ?? '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-neutral-700">{b.identificacion ?? '—'}</td>
                      <td className="px-3 py-2.5 font-medium text-neutral-800">{b.nombreCompleto || '—'}</td>
                      <td className="px-3 py-2.5 text-center">{chipEstado(b.estado)}</td>
                      <td className="px-3 py-2.5 text-center">
                        {(b.certifica ?? '').trim().toUpperCase() === 'SI'
                          ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700"><BadgeCheck size={12} /> SÍ</span>
                          : <span className="text-[10px] font-bold text-neutral-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">{chipInter(b.validacionInterventor)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => toggleEstado(b)}
                          disabled={disabled}
                          title={convenioEnEjecucion === false
                            ? 'Convenio no está en ejecución'
                            : (esActivo ? 'Retirar del grupo' : 'Activar en el grupo')}
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed
                            ${esActivo
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                          {trabajando
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Power size={12} />}
                          {esActivo ? 'Retirar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
