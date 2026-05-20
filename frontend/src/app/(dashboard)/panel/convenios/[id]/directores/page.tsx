'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { fmtDateTimeNumeric as fmtDateTime } from '@/lib/format-date'
import { getSepUsuario } from '@/lib/auth'
import {
  AlertCircle, CalendarDays, CheckCircle2, ChevronDown, FileText,
  History as HistoryIcon, Loader2, Mail, Phone, Plus, ShieldCheck,
  UserSquare2, XCircle,
} from 'lucide-react'
import { ConvenioNav } from '@/components/layout/convenio-nav'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Director {
  directorId: number
  personaId: number
  proyectoId: number
  fechaRegistro: string | null
  fechaActualizacion: string | null
  estado: string
  observacion: string | null
  estadoInterventoria: string
  fechaInterventoria: string | null
  interventorPersonaId: number | null
  radicadoSena: string | null
  fechaRadicadoSena: string | null
  radicadoInterventoria: string | null
  fechaRadicadoInterventoria: string | null
  nombres: string
  primerApellido: string
  segundoApellido: string | null
  identificacion: string
  tipoDocumentoId: number
  tipoDocumento: string | null
  email: string
  celular: string | null
  telefono: string | null
  ciudadId: number | null
  ciudad: string | null
}

interface DirectoresResp {
  activo: Director | null
  historial: Director[]
  convenioEnEjecucion?: boolean
}

const TITLE_COLOR = '#00304D'

const PERFIL_INTERVENTOR = 11
const PERFIL_COORD_INTERV = 10
const PERFIL_ADMIN = 1
const PERFIL_EMPRESA = 7

export default function DirectoresPage() {
  const { id } = useParams<{ id: string }>()
  const proyectoId = Number(id)

  const [director, setDirector] = useState<Director | null>(null)
  const [historial, setHistorial] = useState<Director[]>([])
  const [convenioEnEjecucion, setConvenioEnEjecucion] = useState<boolean | null>(null)
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [perfilId, setPerfilId] = useState<number>(0)

  const [validarOpen, setValidarOpen] = useState(false)
  const [validarAprobar, setValidarAprobar] = useState(true)
  const [observacion, setObservacion] = useState('')
  const [validando, setValidando] = useState(false)

  // Toast
  const [toastVisible, setToastVisible] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; titulo: string; msg: string } | null>(null)
  function showToast(tipo: 'success' | 'error', titulo: string, msg: string) {
    setToast({ tipo, titulo, msg })
    setToastVisible(true)
  }

  async function cargar() {
    try {
      setLoading(true); setError(null)
      const rD = await api.get<DirectoresResp>(`/convenios/${proyectoId}/director`)
      setDirector(rD.data?.activo ?? null)
      setHistorial(rD.data?.historial ?? [])
      setConvenioEnEjecucion(rD.data?.convenioEnEjecucion ?? null)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudo cargar el director.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    document.title = 'Director del Convenio | SEP'
    setPerfilId(getSepUsuario()?.perfilId ?? 0)
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId])

  function abrirValidar(aprobar: boolean) {
    setValidarAprobar(aprobar)
    setObservacion('')
    setValidarOpen(true)
  }

  async function handleValidar() {
    if (!validarAprobar && !observacion.trim()) {
      showToast('error', 'Observación obligatoria', 'Para rechazar al director debes escribir el motivo.')
      return
    }
    setValidando(true)
    try {
      await api.post(`/convenios/${proyectoId}/director/validar`, {
        aprobar: validarAprobar,
        observacion: observacion.trim() || null,
      })
      showToast('success',
        validarAprobar ? 'Director aprobado' : 'Director rechazado',
        validarAprobar
          ? 'La interventoría aprobó al director.'
          : 'El conviniente debe corregir y volver a registrar.')
      setValidarOpen(false)
      cargar()
    } catch (e: any) {
      showToast('error', 'No se pudo guardar', e?.response?.data?.message ?? 'Error inesperado.')
    } finally { setValidando(false) }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={32} className="animate-spin" style={{ color: TITLE_COLOR }} />
      </div>
    )
  }
  if (error) {
    return <div className="p-10 text-center text-red-500 text-sm">{error}</div>
  }

  const esConviniente = perfilId === PERFIL_EMPRESA
  const esInterventoria = perfilId === PERFIL_INTERVENTOR || perfilId === PERFIL_COORD_INTERV
  const esAdmin = perfilId === PERFIL_ADMIN
  const estadoInter = (director?.estadoInterventoria ?? '').trim().toUpperCase()
  const aprobado = estadoInter === 'APROBADO'
  const rechazado = estadoInter === 'RECHAZADO'
  const pendiente = estadoInter === 'PENDIENTE' || !estadoInter

  // Si el convenio no está en ejecución, todo el módulo es solo lectura.
  const bloqueadoPorConvenio = convenioEnEjecucion === false
  // El conviniente puede registrar/cambiar director si NO está aprobado todavía
  // (cuando está rechazado, registrar uno nuevo reemplaza al anterior) y el
  // convenio está en ejecución.
  const puedeRegistrarConviniente = esConviniente && !aprobado && !bloqueadoPorConvenio
  // La interventoría puede aprobar/rechazar mientras hay director pendiente
  // y el convenio está en ejecución.
  const puedeValidarInterventoria = (esInterventoria || esAdmin) && director && pendiente && !bloqueadoPorConvenio

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      <ToastBetowa
        show={toastVisible}
        onClose={() => setToastVisible(false)}
        tipo={toast?.tipo ?? 'success'}
        titulo={toast?.titulo ?? ''}
        mensaje={toast?.msg ?? ''}
        duration={5000}
      />

      <ConvenioNav proyectoId={proyectoId} />

      {bloqueadoPorConvenio && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle size={16} />
          <span><strong>Convenio no está en ejecución.</strong> Este módulo está en modo solo lectura: no se puede registrar, cambiar ni validar al director.</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-[#00304D]" />
        <div className="p-5 sm:p-6 flex items-start gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-xl bg-[#00304D]/10 flex items-center justify-center shrink-0">
            <UserSquare2 size={22} className="text-[#00304D]" />
          </div>
          <div className="flex-1 min-w-0" style={{ minWidth: '180px' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Convenio · Ejecución</p>
            <h1 className="text-lg sm:text-xl font-bold text-[#00304D]">Director del Proyecto</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Solo puede haber un director activo. La interventoría revisa los datos y aprueba o rechaza al director.
            </p>
          </div>
          {puedeRegistrarConviniente && (
            <Link href={`/panel/convenios/${proyectoId}/directores/hv`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00304D] hover:bg-[#004a76] text-white text-sm font-semibold rounded-xl transition w-full sm:w-auto">
              <Plus size={15} />
              {director ? 'Cambiar director' : 'Registrar director'}
            </Link>
          )}
        </div>
      </div>

      {/* Sin director registrado */}
      {!director && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
          <UserSquare2 size={40} className="text-neutral-200" />
          <p className="text-neutral-500 font-semibold text-sm">Aún no hay director registrado</p>
          <p className="text-neutral-400 text-xs max-w-md">
            {esConviniente
              ? 'Registra los datos del director del proyecto para que la interventoría pueda aprobarlo.'
              : 'El conviniente todavía no ha registrado al director del proyecto.'}
          </p>
        </div>
      )}

      {/* Director registrado */}
      {director && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className={`px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between gap-3 flex-wrap ${
            aprobado ? 'bg-emerald-50/50' : rechazado ? 'bg-red-50/50' : 'bg-amber-50/50'
          }`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                aprobado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                rechazado ? 'bg-red-50 text-red-700 border-red-200' :
                'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {aprobado ? <CheckCircle2 size={11} /> : rechazado ? <XCircle size={11} /> : <ShieldCheck size={11} />}
                Interventoría: {estadoInter || 'PENDIENTE'}
              </span>
              <span className="text-[11px] text-neutral-500">
                Última actualización: {director.fechaInterventoria ? fmtDateTime(director.fechaInterventoria) : '—'}
              </span>
            </div>
            {puedeValidarInterventoria && (
              <div className="flex gap-2">
                <button onClick={() => abrirValidar(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 transition">
                  <XCircle size={13} /> Rechazar
                </button>
                <button onClick={() => abrirValidar(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition">
                  <CheckCircle2 size={13} /> Aprobar
                </button>
              </div>
            )}
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Field label="Nombres y Apellidos" value={
              [director.nombres, director.primerApellido, director.segundoApellido].filter(Boolean).join(' ').trim() || '—'
            } />
            <Field label={director.tipoDocumento || 'Documento'} value={director.identificacion} mono />
            <Field label="Correo electrónico" value={director.email} icon={Mail} />
            <Field label="Celular" value={director.celular} icon={Phone} />
            <Field label="Teléfono" value={director.telefono} icon={Phone} />
            <Field label="Fecha de Registro en el Convenio" value={director.fechaRegistro ? fmtDateTime(director.fechaRegistro) : '—'} icon={CalendarDays} />
            <Field label="Radicado SENA" value={director.radicadoSena} mono />
            <Field label="Radicado Interventoría" value={director.radicadoInterventoria} mono />
          </div>

          {director.observacion && director.observacion.trim() && (
            <div className="px-5 pb-5">
              <div className={`rounded-xl border p-3 ${
                rechazado ? 'bg-red-50 border-red-200' : 'bg-neutral-50 border-neutral-200'
              }`}>
                <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${
                  rechazado ? 'text-red-700' : 'text-neutral-500'
                }`}>
                  Observación de la interventoría
                </p>
                <p className="text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed">{director.observacion}</p>
              </div>
            </div>
          )}

          {/* Acceso a la Hoja de Vida del director actual */}
          <div className="px-5 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[12px] text-neutral-500 leading-relaxed">
              Consulta la <strong>Hoja de Vida</strong> del director: archivo PDF, datos personales y, próximamente,
              experiencia laboral, títulos académicos y otros documentos.
            </p>
            <Link
              href={`/panel/convenios/${proyectoId}/directores/hv?personaId=${director.personaId}`}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[#00304D] hover:bg-[#004a76] text-white transition shrink-0"
            >
              <FileText size={13} /> Ver Hoja de Vida
            </Link>
          </div>
        </div>
      )}

      {/* Historial de directores anteriores (cuando hay reemplazos) */}
      {historial.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setHistorialAbierto(v => !v)}
            className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-neutral-50 transition"
            aria-expanded={historialAbierto}
          >
            <div className="flex items-center gap-2">
              <HistoryIcon size={16} className="text-neutral-500" />
              <span className="text-sm font-semibold text-neutral-700">
                Historial de directores anteriores
              </span>
              <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-neutral-100 text-neutral-700 text-[11px] font-bold">
                {historial.length}
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`text-neutral-400 transition-transform ${historialAbierto ? 'rotate-180' : ''}`}
            />
          </button>

          {historialAbierto && (
            <div className="border-t border-neutral-100 p-5 flex flex-col gap-3">
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Estos directores estuvieron asociados a este convenio en algún momento, pero fueron
                reemplazados. La información queda como registro histórico.
              </p>
              {historial.map(h => {
                const ei = (h.estadoInterventoria ?? '').trim().toUpperCase()
                const fueAprobado = ei === 'APROBADO'
                const fueRechazado = ei === 'RECHAZADO'
                return (
                  <div key={h.directorId}
                    className="rounded-xl border border-neutral-200 bg-neutral-50/40 p-4 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 shrink-0">
                          DIR-{h.directorId}
                        </span>
                        <p className="text-sm font-bold text-neutral-700 truncate">
                          {[h.nombres, h.primerApellido, h.segundoApellido].filter(Boolean).join(' ').trim() || '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600 border border-neutral-300">
                          INACTIVO
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                          fueAprobado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          fueRechazado ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {fueAprobado ? <CheckCircle2 size={10} /> : fueRechazado ? <XCircle size={10} /> : <ShieldCheck size={10} />}
                          {ei || 'PENDIENTE'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px]">
                      <div>
                        <p className="text-neutral-400 uppercase tracking-wide font-semibold text-[9px]">{h.tipoDocumento || 'Documento'}</p>
                        <p className="font-mono text-neutral-700">{h.identificacion || '—'}</p>
                      </div>
                      <div>
                        <p className="text-neutral-400 uppercase tracking-wide font-semibold text-[9px]">Correo</p>
                        <p className="text-neutral-700 truncate">{h.email || '—'}</p>
                      </div>
                      <div>
                        <p className="text-neutral-400 uppercase tracking-wide font-semibold text-[9px]">Período</p>
                        <p className="text-neutral-700">
                          {h.fechaRegistro ? fmtDateTime(h.fechaRegistro) : '—'}
                          {h.fechaActualizacion && (
                            <> → <span className="text-neutral-500">{fmtDateTime(h.fechaActualizacion)}</span></>
                          )}
                        </p>
                      </div>
                    </div>

                    {h.observacion && h.observacion.trim() && (
                      <div className={`rounded-lg border p-2.5 text-[11px] ${
                        fueRechazado ? 'bg-red-50 border-red-200 text-red-900' : 'bg-white border-neutral-200 text-neutral-700'
                      }`}>
                        <p className="text-[9px] font-semibold uppercase tracking-wide mb-0.5">
                          Observación de la interventoría
                        </p>
                        <p className="whitespace-pre-wrap leading-relaxed">{h.observacion}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: aprobar/rechazar (interventoría) */}
      <Modal open={validarOpen} onClose={() => !validando && setValidarOpen(false)} maxWidth="max-w-lg">
        <div className="p-6 flex flex-col gap-4">
          <h3 className="text-base font-bold text-neutral-800 flex items-center gap-2">
            {validarAprobar ? <CheckCircle2 size={18} className="text-emerald-600" /> : <XCircle size={18} className="text-red-600" />}
            {validarAprobar ? 'Aprobar director' : 'Rechazar director'}
          </h3>
          <p className="text-sm text-neutral-700 leading-relaxed">
            {validarAprobar
              ? 'Confirmas que los datos del director son correctos y la documentación está en orden.'
              : 'El conviniente recibirá la observación que escribas y deberá registrar nuevamente al director.'}
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Observación {validarAprobar ? '(opcional)' : '*'}
            </label>
            <textarea
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder={validarAprobar
                ? 'Si quieres dejar una observación general, escríbela aquí…'
                : 'Explica claramente qué falta o por qué se rechaza al director…'}
              className="w-full text-sm px-3 py-2 border border-neutral-200 rounded-xl outline-none focus:border-[#00304D] resize-y" />
            <p className="text-[10px] text-neutral-400 text-right">{observacion.length}/2000</p>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setValidarOpen(false)} disabled={validando}
              className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleValidar} disabled={validando}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition disabled:opacity-50 ${
                validarAprobar ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}>
              {validando
                ? <Loader2 size={14} className="animate-spin" />
                : (validarAprobar ? <CheckCircle2 size={14} /> : <XCircle size={14} />)}
              {validarAprobar ? 'Sí, aprobar' : 'Sí, rechazar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Field({
  label, value, mono, icon: Icon,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
  icon?: typeof UserSquare2
}) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && (
        <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={13} className="text-neutral-500" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
        <p className={`text-sm font-semibold text-[#00304D] mt-0.5 break-words ${mono ? 'font-mono text-[13px]' : ''}`}>
          {value || '—'}
        </p>
      </div>
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</label>
      {children}
    </div>
  )
}
