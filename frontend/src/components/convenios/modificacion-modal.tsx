'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import {
  AlertCircle, Building2, ClipboardCheck, FileText,
  Loader2, Lock, Save, ShieldCheck, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const TITLE = '#00304D'
const SENA = '#39A900'

interface TipoModificacion {
  id: number
  nombre: string
}

interface ModificacionDetalle {
  id: number
  proyectoId: number
  tipoModificacionId: number
  fechaEnvio: string | null
  fechaRecepcion: string | null
  concepto: number
  observaciones: string | null
  observacionesInterventoria: string | null
  nisSena: string | null
  radiSena: string | null
  radiSenaFecha: string | null
  radiInter: string | null
  radiInterFecha: string | null
  aprobacionSena: number | null
  nisAproSena: string | null
  radiSenaApro: string | null
  radiSenaAproFecha: string | null
  conceptoSena: number
  respuestaSena: number
  radiInterApro: string | null
  radiInterAproFecha: string | null
  valSena: number | null
  observacionesSena: string | null
  estado: number
}

interface Props {
  open: boolean
  onClose: () => void
  proyectoId: number
  modificacionId: number | null
  onSaved: (mensaje: string) => void
  onError: (mensaje: string) => void
}

const CONCEPTO_LBL: Record<number, string> = {
  1: 'VIABLE', 2: 'NO VIABLE', 3: 'VIABLE PARCIALMENTE', 4: 'PENDIENTE',
}
const CONCEPTO_SENA_LBL: Record<number, string> = {
  1: 'VIABLE', 2: 'NO VIABLE', 3: 'VIABLE PARCIALMENTE', 4: 'PENDIENTE', 5: 'NO APLICA',
}
const APROBACION_LBL: Record<number, string> = { 0: 'NA', 1: 'SI', 2: 'NO' }
const VAL_SENA_LBL: Record<number, string> = { 1: 'CUMPLE', 2: 'NO CUMPLE' }
const RESPUESTA_LBL: Record<number, string> = {
  1: 'SIN RESPONDER', 2: 'EN TRÁMITE', 3: 'RESPONDIDO',
}

/** Recorta una fecha ISO a `YYYY-MM-DD` para el input type="date". */
function toDateInput(value: string | null | undefined): string {
  if (!value) return ''
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime()) || d.getFullYear() < 1950) return ''
    return d.toISOString().slice(0, 10)
  } catch { return '' }
}

function fmtFecha(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime()) || d.getFullYear() < 1950) return '—'
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return '—' }
}

interface FormState {
  tipoModificacionId: number
  fechaEnvio: string
  observaciones: string
}

function emptyForm(): FormState {
  return { tipoModificacionId: 0, fechaEnvio: '', observaciones: '' }
}

export function ModificacionModal({
  open, onClose, proyectoId, modificacionId, onSaved, onError,
}: Props) {
  const editando = modificacionId != null
  const [tipos, setTipos] = useState<TipoModificacion[]>([])
  const [detalle, setDetalle] = useState<ModificacionDetalle | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErr(null); setForm(emptyForm()); setDetalle(null)
    setCargando(true)
    const calls: Promise<unknown>[] = [
      api.get<TipoModificacion[]>('/modificaciones/tipos').then(r => setTipos(r.data ?? [])),
    ]
    if (editando) {
      calls.push(
        api.get<ModificacionDetalle>(`/modificaciones/proyecto/${proyectoId}/${modificacionId}`)
          .then(r => {
            const d = r.data
            setDetalle(d)
            setForm({
              tipoModificacionId: Number(d.tipoModificacionId) || 0,
              fechaEnvio: toDateInput(d.fechaEnvio),
              observaciones: d.observaciones ?? '',
            })
          }),
      )
    }
    Promise.all(calls)
      .catch((e: any) => setErr(e?.response?.data?.message ?? 'No se pudo cargar la modificación.'))
      .finally(() => setCargando(false))
  }, [open, editando, modificacionId, proyectoId])

  /** El conveniente solo puede editar si la interventoría sigue Pendiente y
   *  el SENA aún no ha aprobado o rechazado la modificación. */
  const respondida = useMemo(() => {
    if (!detalle) return null
    const concepto = Number(detalle.concepto ?? 4)
    const aproSena = Number(detalle.aprobacionSena ?? 0)
    if (concepto !== 4) {
      return {
        bloqueado: true,
        motivo: `La interventoría ya emitió concepto (${CONCEPTO_LBL[concepto] ?? 'N/A'}). Ya no es posible modificarla desde el conveniente.`,
      }
    }
    if (aproSena === 1 || aproSena === 2) {
      return {
        bloqueado: true,
        motivo: `El SENA ya ${aproSena === 1 ? 'aprobó' : 'rechazó'} la modificación. Ya no es posible editarla.`,
      }
    }
    return { bloqueado: false, motivo: '' }
  }, [detalle])

  const soloLectura = editando && respondida?.bloqueado === true

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function guardar() {
    setErr(null)
    if (!form.tipoModificacionId) { setErr('Selecciona el tipo de modificación.'); return }
    if (!form.fechaEnvio) { setErr('Ingresa la fecha de envío del convenio.'); return }
    if (soloLectura) { setErr(respondida?.motivo ?? 'Esta modificación ya no puede editarse.'); return }

    const dto = {
      tipoModificacionId: Number(form.tipoModificacionId),
      fechaEnvio: form.fechaEnvio,
      observaciones: form.observaciones.trim() || null,
    }

    setGuardando(true)
    try {
      const r = editando
        ? await api.put<{ mensaje: string }>(`/modificaciones/proyecto/${proyectoId}/${modificacionId}`, dto)
        : await api.post<{ mensaje: string; id: number }>(`/modificaciones/proyecto/${proyectoId}`, dto)
      onSaved(r.data?.mensaje ?? 'Modificación guardada correctamente.')
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Error al guardar la modificación.'
      setErr(msg)
      onError(msg)
    } finally {
      setGuardando(false)
    }
  }

  const titulo = useMemo(
    () => editando ? 'Editar modificación' : 'Agregar modificación',
    [editando],
  )
  const subtitulo = useMemo(
    () => editando
      ? 'Edita los datos del convenio. Los campos de respuesta de interventoría y SENA son informativos.'
      : 'Registra la modificación que el convenio requiera para su correcta ejecución.',
    [editando],
  )

  // ¿La interventoría o SENA ya escribieron algo? Si sí, mostramos panel de respuesta readonly.
  const tieneRespuesta = useMemo(() => {
    if (!detalle) return false
    return (
      Number(detalle.concepto ?? 4) !== 4 ||
      Number(detalle.aprobacionSena ?? 0) !== 0 ||
      (detalle.observacionesInterventoria ?? '').trim() !== '' ||
      (detalle.radiSena ?? '').trim() !== '' ||
      (detalle.radiInter ?? '').trim() !== '' ||
      (detalle.observacionesSena ?? '').trim() !== ''
    )
  }, [detalle])

  return (
    <Modal open={open} onClose={() => !guardando && onClose()} maxWidth="max-w-4xl">
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${TITLE}15`, color: TITLE }}>
            <FileText size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold" style={{ color: TITLE }}>{titulo}</h2>
            <p className="text-xs text-neutral-500 mt-0.5">{subtitulo}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="p-2 rounded-lg hover:bg-neutral-100 transition disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-5">
          {cargando ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin" style={{ color: TITLE }} />
            </div>
          ) : (
            <>
              {soloLectura && (
                <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <Lock size={14} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold uppercase tracking-wider text-[10px] mb-0.5">
                      Modificación bloqueada
                    </p>
                    <p>{respondida?.motivo}</p>
                  </div>
                </div>
              )}

              {/* Sección Conviniente — campos editables */}
              <Seccion icon={Building2} titulo="Sección conviniente" color={TITLE}>
                <Grid>
                  <Field label="Tipo de modificación" required>
                    <select
                      value={form.tipoModificacionId}
                      onChange={e => set('tipoModificacionId', Number(e.target.value))}
                      disabled={soloLectura}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-xl bg-white outline-none transition focus:border-[#00304D]/40 focus:ring-2 focus:ring-[#00304D]/15 disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed"
                    >
                      <option value={0}>Selecciona…</option>
                      {tipos.map(t => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Fecha de envío del convenio" required>
                    <input type="date" value={form.fechaEnvio}
                      onChange={e => set('fechaEnvio', e.target.value)}
                      disabled={soloLectura}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-xl bg-white outline-none transition focus:border-[#00304D]/40 focus:ring-2 focus:ring-[#00304D]/15 disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed"
                    />
                  </Field>
                </Grid>
                <Field label="Observaciones del convenio" full>
                  <textarea rows={4} value={form.observaciones}
                    onChange={e => set('observaciones', e.target.value)}
                    disabled={soloLectura}
                    placeholder="Describe brevemente la modificación solicitada…"
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-xl bg-white outline-none transition resize-none focus:border-[#00304D]/40 focus:ring-2 focus:ring-[#00304D]/15 disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed"
                  />
                </Field>
              </Seccion>

              {/* Panel readonly: respuesta de interventoría y SENA cuando exista. */}
              {editando && detalle && tieneRespuesta && (
                <>
                  <Seccion icon={ClipboardCheck} titulo="Respuesta de la interventoría" color="#0070C0">
                    <Grid>
                      <Info label="Fecha de recepción" value={fmtFecha(detalle.fechaRecepcion)} />
                      <Info
                        label="Concepto"
                        value={CONCEPTO_LBL[Number(detalle.concepto ?? 4)] ?? 'PENDIENTE'}
                        chipColor={chipConcepto(CONCEPTO_LBL[Number(detalle.concepto ?? 4)] ?? 'PENDIENTE')}
                      />
                      <Info label="NIS Radicado SENA" value={detalle.nisSena || '—'} />
                      <Info label="Radicado SENA" value={detalle.radiSena || '—'} />
                      <Info label="Fecha Radicado SENA" value={fmtFecha(detalle.radiSenaFecha)} />
                      <Info label="Radicado interventoría" value={detalle.radiInter || '—'} />
                      <Info label="Fecha Radicado interventoría" value={fmtFecha(detalle.radiInterFecha)} />
                    </Grid>
                    {(detalle.observacionesInterventoria ?? '').trim() && (
                      <Info label="Observación de la interventoría" value={detalle.observacionesInterventoria!} full />
                    )}
                  </Seccion>

                  <Seccion icon={ShieldCheck} titulo="Respuesta del SENA" color="#7C3AED">
                    <Grid>
                      <Info
                        label="Aprobación SENA"
                        value={APROBACION_LBL[Number(detalle.aprobacionSena ?? 0)] ?? 'NA'}
                        chipColor={chipAprobacion(Number(detalle.aprobacionSena ?? 0))}
                      />
                      <Info
                        label="Concepto SENA"
                        value={CONCEPTO_SENA_LBL[Number(detalle.conceptoSena ?? 4)] ?? 'PENDIENTE'}
                      />
                      <Info
                        label="Estado respuesta SENA"
                        value={RESPUESTA_LBL[Number(detalle.respuestaSena ?? 1)] ?? 'SIN RESPONDER'}
                      />
                      <Info
                        label="Verificación SENA"
                        value={detalle.valSena != null ? (VAL_SENA_LBL[Number(detalle.valSena)] ?? '—') : '—'}
                      />
                      <Info label="NIS SENA de aprobación" value={detalle.nisAproSena || '—'} />
                      <Info label="Radicado SENA de aprobación" value={detalle.radiSenaApro || '—'} />
                      <Info label="Fecha Radicado SENA de aprobación" value={fmtFecha(detalle.radiSenaAproFecha)} />
                      <Info label="Radicado interventoría de aprobación" value={detalle.radiInterApro || '—'} />
                      <Info label="Fecha Radicado interventoría de aprobación" value={fmtFecha(detalle.radiInterAproFecha)} />
                    </Grid>
                    {(detalle.observacionesSena ?? '').trim() && (
                      <Info label="Observación del SENA" value={detalle.observacionesSena!} full />
                    )}
                  </Seccion>
                </>
              )}

              {err && (
                <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{err}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition disabled:opacity-50"
          >
            {soloLectura ? 'Cerrar' : 'Cancelar'}
          </button>
          {!soloLectura && (
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || cargando}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition disabled:opacity-50"
              style={{ backgroundColor: SENA }}
            >
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editando ? 'Guardar cambios' : 'Registrar'}
            </button>
          )}
        </div>
      </div>

    </Modal>
  )
}

function chipConcepto(label: string): string {
  const u = (label || '').toUpperCase()
  if (u.includes('NO VIABLE')) return 'bg-red-50 text-red-700 border-red-200'
  if (u.includes('PARCIAL')) return 'bg-amber-50 text-amber-700 border-amber-200'
  if (u.includes('VIABLE')) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (u.includes('PENDIENTE')) return 'bg-neutral-100 text-neutral-600 border-neutral-200'
  return 'bg-blue-50 text-blue-700 border-blue-200'
}

function chipAprobacion(value: number): string {
  if (value === 1) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (value === 2) return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-neutral-100 text-neutral-500 border-neutral-200'
}

function Seccion({
  icon: Icon, titulo, color, children,
}: {
  icon: LucideIcon
  titulo: string
  color: string
  children: React.ReactNode
}) {
  return (
    <section className="shrink-0 border border-neutral-200 rounded-2xl bg-white">
      <div className="h-1 rounded-t-2xl" style={{ backgroundColor: color }} />
      <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15`, color }}>
          <Icon size={14} />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
          {titulo}
        </h3>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {children}
      </div>
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
}

function Field({
  label, required, full, children,
}: {
  label: string
  required?: boolean
  full?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={full ? 'col-span-full' : ''}>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1 block">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

function Info({
  label, value, full, chipColor,
}: {
  label: string
  value: string
  full?: boolean
  chipColor?: string
}) {
  return (
    <div className={full ? 'col-span-full' : ''}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">{label}</p>
      {chipColor ? (
        <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${chipColor}`}>
          {value}
        </span>
      ) : (
        <p className="text-sm font-semibold text-neutral-700 break-words whitespace-pre-line">{value}</p>
      )}
    </div>
  )
}
