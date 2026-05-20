'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import {
  AlertCircle, Building2, ClipboardCheck, Eye, EyeOff, Globe,
  Loader2, Lock, Save, ShieldCheck, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const TITLE = '#00304D'
const SENA = '#39A900'

interface PlataformaDetalle {
  id: number
  proyectoId: number
  fechaRemi: string | null
  link: string
  usuario: string
  clave: string
  estado: number
  radInter: string
  radResInter: string
  fecRadRes: string | null
  observacion: string
  usuRegistro: number
  nisSena: string
  radSena: string
  fecRadSena: string | null
  obsSena: string
  valSena: number
  usuSena: number
}

interface Props {
  open: boolean
  onClose: () => void
  proyectoId: number
  plataformaId: number | null
  onSaved: (mensaje: string) => void
  onError: (mensaje: string) => void
}

const ESTADO_LBL: Record<number, string> = {
  1: 'APROBADO', 2: 'NO APROBADO', 3: 'SIN RESPUESTA',
}
const VAL_SENA_LBL: Record<number, string> = { 1: 'CUMPLE', 2: 'NO CUMPLE' }

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
  fechaRemi: string
  link: string
  usuario: string
  clave: string
}

function emptyForm(): FormState {
  return { fechaRemi: '', link: '', usuario: '', clave: '' }
}

export function PlataformaVirtualModal({
  open, onClose, proyectoId, plataformaId, onSaved, onError,
}: Props) {
  const editando = plataformaId != null
  const [detalle, setDetalle] = useState<PlataformaDetalle | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [verClave, setVerClave] = useState(false)

  useEffect(() => {
    if (!open) return
    setErr(null); setForm(emptyForm()); setDetalle(null); setVerClave(false)
    if (!editando) return
    setCargando(true)
    api.get<PlataformaDetalle>(`/plataformas-virtuales/proyecto/${proyectoId}/${plataformaId}`)
      .then(r => {
        const d = r.data
        setDetalle(d)
        setForm({
          fechaRemi: toDateInput(d.fechaRemi),
          link: d.link ?? '',
          usuario: d.usuario ?? '',
          clave: d.clave ?? '',
        })
      })
      .catch((e: any) => setErr(e?.response?.data?.message ?? 'No se pudo cargar la plataforma virtual.'))
      .finally(() => setCargando(false))
  }, [open, editando, plataformaId, proyectoId])

  /** Bloqueada si la interventoría ya aprobó/rechazó o si SENA ya validó. */
  const respondida = useMemo(() => {
    if (!detalle) return null
    const estado = Number(detalle.estado ?? 0)
    if (estado === 1 || estado === 2) {
      return {
        bloqueado: true,
        motivo: `La interventoría ya ${estado === 1 ? 'aprobó' : 'rechazó'} la plataforma virtual (${ESTADO_LBL[estado]}). Ya no es posible editarla desde el conveniente.`,
      }
    }
    const val = Number(detalle.valSena ?? 0)
    if (val === 1 || val === 2) {
      return {
        bloqueado: true,
        motivo: `El SENA ya validó la plataforma virtual (${VAL_SENA_LBL[val]}). Ya no es posible editarla.`,
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
    if (!form.fechaRemi) { setErr('Ingresa la fecha de remisión.'); return }
    if (!form.link.trim()) { setErr('Ingresa el link de la plataforma virtual.'); return }
    if (!form.usuario.trim()) { setErr('Ingresa el usuario de acceso.'); return }
    if (!form.clave.trim()) { setErr('Ingresa la clave de acceso.'); return }
    if (soloLectura) { setErr(respondida?.motivo ?? 'Esta plataforma ya no puede editarse.'); return }

    const dto = {
      fechaRemi: form.fechaRemi,
      link: form.link.trim(),
      usuario: form.usuario.trim(),
      clave: form.clave.trim(),
    }

    setGuardando(true)
    try {
      const r = editando
        ? await api.put<{ mensaje: string }>(`/plataformas-virtuales/proyecto/${proyectoId}/${plataformaId}`, dto)
        : await api.post<{ mensaje: string; id: number }>(`/plataformas-virtuales/proyecto/${proyectoId}`, dto)
      onSaved(r.data?.mensaje ?? 'Plataforma virtual guardada correctamente.')
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Error al guardar la plataforma virtual.'
      setErr(msg)
      onError(msg)
    } finally {
      setGuardando(false)
    }
  }

  const titulo = editando ? 'Editar plataforma virtual' : 'Agregar plataforma virtual'
  const subtitulo = editando
    ? 'Edita los datos de acceso. Los campos de respuesta de interventoría y SENA son informativos.'
    : 'Registra una plataforma virtual que el convenio requiera para su correcta ejecución.'

  const tieneRespuesta = useMemo(() => {
    if (!detalle) return false
    return (
      Number(detalle.estado ?? 0) !== 0 ||
      Number(detalle.valSena ?? 0) !== 0 ||
      (detalle.observacion ?? '').trim() !== '' ||
      (detalle.radInter ?? '').trim() !== '' ||
      (detalle.radResInter ?? '').trim() !== '' ||
      (detalle.radSena ?? '').trim() !== '' ||
      (detalle.obsSena ?? '').trim() !== ''
    )
  }, [detalle])

  const inputCls = 'w-full px-3 py-2 text-sm border border-neutral-300 rounded-xl bg-white outline-none transition focus:border-[#00304D]/40 focus:ring-2 focus:ring-[#00304D]/15 disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed'

  return (
    <Modal open={open} onClose={() => !guardando && onClose()} maxWidth="max-w-4xl">
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${TITLE}15`, color: TITLE }}>
            <Globe size={18} />
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
                      Plataforma virtual bloqueada
                    </p>
                    <p>{respondida?.motivo}</p>
                  </div>
                </div>
              )}

              {/* Sección Conviniente */}
              <Seccion icon={Building2} titulo="Datos de la plataforma" color={TITLE}>
                <Grid>
                  <Field label="Fecha de remisión" required>
                    <input type="date" value={form.fechaRemi}
                      onChange={e => set('fechaRemi', e.target.value)}
                      disabled={soloLectura}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Usuario de acceso" required>
                    <input type="text" value={form.usuario}
                      onChange={e => set('usuario', e.target.value)}
                      disabled={soloLectura}
                      maxLength={160}
                      placeholder="usuario@dominio.com"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Clave de acceso" required>
                    <div className="relative">
                      <input type={verClave ? 'text' : 'password'} value={form.clave}
                        onChange={e => set('clave', e.target.value)}
                        disabled={soloLectura}
                        maxLength={60}
                        placeholder="••••••••"
                        className={inputCls + ' pr-10'}
                      />
                      <button
                        type="button"
                        onClick={() => setVerClave(v => !v)}
                        tabIndex={-1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition"
                      >
                        {verClave ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </Field>
                </Grid>
                <Field label="Link de la plataforma virtual" full required>
                  <textarea rows={3} value={form.link}
                    onChange={e => set('link', e.target.value)}
                    disabled={soloLectura}
                    maxLength={1200}
                    placeholder="https://…"
                    className={inputCls + ' resize-none'}
                  />
                </Field>
              </Seccion>

              {/* Panel readonly: respuesta interventoría / SENA. */}
              {editando && detalle && tieneRespuesta && (
                <>
                  <Seccion icon={ClipboardCheck} titulo="Respuesta de la interventoría" color="#0070C0">
                    <Grid>
                      <Info
                        label="Estado"
                        value={ESTADO_LBL[Number(detalle.estado ?? 0)] ?? 'SIN EVALUAR'}
                        chipColor={chipEstado(Number(detalle.estado ?? 0))}
                      />
                      <Info label="Radicado remisión" value={detalle.radInter || '—'} />
                      <Info label="Radicado respuesta" value={detalle.radResInter || '—'} />
                      <Info label="Fecha respuesta" value={fmtFecha(detalle.fecRadRes)} />
                    </Grid>
                    {(detalle.observacion ?? '').trim() && (
                      <Info label="Observación de la interventoría" value={detalle.observacion} full />
                    )}
                  </Seccion>

                  <Seccion icon={ShieldCheck} titulo="Respuesta del SENA" color="#7C3AED">
                    <Grid>
                      <Info
                        label="Validación SENA"
                        value={Number(detalle.valSena ?? 0) === 0
                          ? 'SIN VALIDAR'
                          : (VAL_SENA_LBL[Number(detalle.valSena)] ?? 'SIN VALIDAR')}
                        chipColor={chipValSena(Number(detalle.valSena ?? 0))}
                      />
                      <Info label="NIS SENA" value={detalle.nisSena || '—'} />
                      <Info label="Radicado SENA" value={detalle.radSena || '—'} />
                      <Info label="Fecha radicado SENA" value={fmtFecha(detalle.fecRadSena)} />
                    </Grid>
                    {(detalle.obsSena ?? '').trim() && (
                      <Info label="Observación del SENA" value={detalle.obsSena} full />
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

function chipEstado(value: number): string {
  if (value === 1) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (value === 2) return 'bg-red-50 text-red-700 border-red-200'
  if (value === 3) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-neutral-100 text-neutral-500 border-neutral-200'
}

function chipValSena(value: number): string {
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
