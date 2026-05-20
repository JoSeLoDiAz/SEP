'use client'

import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import api from '@/lib/api'
import {
  AlertCircle, Building2, CheckCircle2, ChevronRight, GraduationCap,
  Loader2, Power, Search, ShieldAlert, ShieldCheck, UserPlus, XCircle,
} from 'lucide-react'
import { ConvenioNav } from '@/components/layout/convenio-nav'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type Tab = 'personas' | 'empresas'

interface CapacitadorPersona {
  capacitadorId: number
  personaId: number
  estado: string
  estadoInterventoria: string
  observacion: string | null
  fechaRegistro: string | null
  nombreCompleto: string
  identificacion: string
  tipoDocumento: string
}

interface CapacitadorEmpresa {
  capacitadorId: number
  empresaId: number
  estado: string
  estadoInterventoria: string
  observacion: string | null
  fechaRegistro: string | null
  razonSocial: string
  sigla: string
  identificacion: string
  tipoDocumento: string
}

const TITLE_COLOR = '#0070C0'

function estadoBadge(estado: string) {
  const up = (estado ?? '').trim().toUpperCase()
  if (up === 'ACTIVO') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
      <CheckCircle2 size={10} /> ACTIVO
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
      <Power size={10} /> INACTIVO
    </span>
  )
}

function interBadge(estado: string) {
  const up = (estado ?? '').trim().toUpperCase()
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    'APROBADO': { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <CheckCircle2 size={10} /> },
    'RECHAZADO': { bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle size={10} /> },
    'PENDIENTE DE APROBACION': { bg: 'bg-amber-100', text: 'text-amber-700', icon: <ShieldAlert size={10} /> },
    'CAMBIO': { bg: 'bg-orange-100', text: 'text-orange-700', icon: <ShieldAlert size={10} /> },
    'MODIFICAR': { bg: 'bg-blue-100', text: 'text-blue-700', icon: <ShieldCheck size={10} /> },
  }
  const s = map[up] ?? map['PENDIENTE DE APROBACION']
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {s.icon} {up || 'PENDIENTE'}
    </span>
  )
}

export default function CapacitadoresPage() {
  const { id } = useParams<{ id: string }>()
  const proyectoId = Number(id)

  const [tab, setTab] = useState<Tab>('personas')
  const [personas, setPersonas] = useState<CapacitadorPersona[]>([])
  const [empresas, setEmpresas] = useState<CapacitadorEmpresa[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [convenioEnEjecucion, setConvenioEnEjecucion] = useState<boolean | null>(null)

  // Toggle estado
  const [confirmToggle, setConfirmToggle] = useState<{ capacitadorId: number; estado: string } | null>(null)
  const [toggling, setToggling] = useState(false)

  // Toast
  const [toastVisible, setToastVisible] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error' | 'warning'; titulo: string; msg: string } | null>(null)
  function showToast(tipo: 'success' | 'error' | 'warning', titulo: string, msg: string) {
    setToast({ tipo, titulo, msg })
    setToastVisible(true)
  }

  async function cargar() {
    setCargando(true)
    try {
      const [rP, rE, rC] = await Promise.all([
        api.get<CapacitadorPersona[]>(`/capacitadores/proyecto/${proyectoId}/personas`),
        api.get<CapacitadorEmpresa[]>(`/capacitadores/proyecto/${proyectoId}/empresas`),
        api.get<{ estadoNum: number | null }>(`/convenios/${proyectoId}`).catch(() => ({ data: { estadoNum: null } })),
      ])
      setPersonas(rP.data ?? [])
      setEmpresas(rE.data ?? [])
      setConvenioEnEjecucion(Number(rC.data?.estadoNum) === 1)
    } catch {
      showToast('error', 'Error', 'No se pudieron cargar los capacitadores.')
    } finally {
      setCargando(false)
    }
  }
  const bloqueadoPorConvenio = convenioEnEjecucion === false

  useEffect(() => {
    document.title = 'Capacitadores | SEP'
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId])

  async function handleToggle() {
    if (!confirmToggle) return
    setToggling(true)
    const nuevoEstado = confirmToggle.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    try {
      await api.put(`/capacitadores/${confirmToggle.capacitadorId}/estado`, { estado: nuevoEstado })
      showToast('success', 'Estado actualizado', `Capacitador marcado como ${nuevoEstado}.`)
      setConfirmToggle(null)
      await cargar()
    } catch (e: any) {
      showToast('error', 'Error', e?.response?.data?.message ?? 'No se pudo cambiar el estado.')
    } finally {
      setToggling(false)
    }
  }

  const q = filtro.trim().toLowerCase()
  const listaPersonas = q
    ? personas.filter(c =>
        c.nombreCompleto.toLowerCase().includes(q) ||
        c.identificacion.toLowerCase().includes(q),
      )
    : personas
  const listaEmpresas = q
    ? empresas.filter(e =>
        e.razonSocial.toLowerCase().includes(q) ||
        String(e.identificacion).toLowerCase().includes(q),
      )
    : empresas

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
          <span><strong>Convenio no está en ejecución.</strong> Este módulo está en modo solo lectura: no se puede registrar, activar ni inactivar capacitadores.</span>
        </div>
      )}

      {/* Header */}
      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="h-1.5" style={{ background: 'linear-gradient(to right, #0070C0, #00304D)' }} />
        <div className="p-5 sm:p-6 flex items-start gap-4 flex-wrap border-b border-neutral-100">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${TITLE_COLOR}15` }}>
            <GraduationCap size={22} style={{ color: TITLE_COLOR }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Capacitadores del Convenio</p>
            <h1 className="text-lg sm:text-xl font-bold text-[#00304D]">Gestión de Capacitadores</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Registra y gestiona los capacitadores naturales y jurídicos vinculados a este convenio.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            {bloqueadoPorConvenio ? (
              <>
                <span title="Convenio no está en ejecución"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-neutral-200 text-neutral-400 cursor-not-allowed">
                  <UserPlus size={15} /> Registrar Capacitador Natural
                </span>
                <span title="Convenio no está en ejecución"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-neutral-200 text-neutral-400 cursor-not-allowed">
                  <Building2 size={15} /> Registrar Capacitador Jurídico
                </span>
              </>
            ) : (
              <>
                <Link
                  href={`/panel/convenios/${proyectoId}/directores/hv?modo=cap`}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition"
                  style={{ backgroundColor: TITLE_COLOR }}>
                  <UserPlus size={15} /> Registrar Capacitador Natural
                </Link>
                <Link
                  href={`/panel/convenios/${proyectoId}/capacitadores/empresa`}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition bg-[#39A900] hover:bg-[#2d8800]">
                  <Building2 size={15} /> Registrar Capacitador Jurídico
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Tabs + buscador */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-neutral-50 border-b border-neutral-200">
          <div className="flex gap-1">
            <button onClick={() => { setTab('personas'); setFiltro('') }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${tab === 'personas' ? 'text-white' : 'text-neutral-500 hover:bg-neutral-200'}`}
              style={tab === 'personas' ? { backgroundColor: TITLE_COLOR } : {}}>
              Personas Naturales {personas.length > 0 && `(${personas.length})`}
            </button>
            <button onClick={() => { setTab('empresas'); setFiltro('') }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${tab === 'empresas' ? 'text-white' : 'text-neutral-500 hover:bg-neutral-200'}`}
              style={tab === 'empresas' ? { backgroundColor: '#39A900' } : {}}>
              Empresas Jurídicas {empresas.length > 0 && `(${empresas.length})`}
            </button>
          </div>
          <div className="sm:ml-auto flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-3 py-1.5 w-full sm:w-64">
            <Search size={13} className="text-neutral-400 shrink-0" />
            <input
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              placeholder={tab === 'personas' ? 'Buscar por nombre o documento…' : 'Buscar por razón social o NIT…'}
              className="flex-1 text-xs outline-none bg-transparent text-neutral-700 placeholder:text-neutral-400"
            />
            {filtro && (
              <button onClick={() => setFiltro('')} className="text-neutral-400 hover:text-neutral-600 text-sm leading-none">×</button>
            )}
          </div>
        </div>

        {/* Contenido */}
        <div className="p-5">
          {cargando ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-[#0070C0]" />
            </div>
          ) : tab === 'personas' ? (
            listaPersonas.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 text-sm">
                {q ? `Sin resultados para "${filtro}"` : 'No hay capacitadores naturales registrados.'}
                {!q && (
                  <>
                    <br />
                    <Link href={`/panel/convenios/${proyectoId}/directores/hv?modo=cap`}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-lg text-white"
                      style={{ backgroundColor: TITLE_COLOR }}>
                      <UserPlus size={13} /> Registrar el primero
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {listaPersonas.map((c, i) => (
                  <div key={c.capacitadorId}
                    className="rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden">
                    <div className="px-4 py-3 flex items-start gap-3 flex-wrap">
                      <span className="text-[10px] font-bold text-neutral-400 w-5 shrink-0 pt-0.5">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#00304D] truncate">{c.nombreCompleto}</p>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          {c.tipoDocumento} · {c.identificacion}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {estadoBadge(c.estado)}
                          {interBadge(c.estadoInterventoria)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/panel/convenios/${proyectoId}/directores/hv?personaId=${c.personaId}&modo=cap`}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white transition"
                          style={{ backgroundColor: TITLE_COLOR }}>
                          Ver HV <ChevronRight size={12} />
                        </Link>
                        <button
                          onClick={() => setConfirmToggle({ capacitadorId: c.capacitadorId, estado: c.estado })}
                          disabled={bloqueadoPorConvenio}
                          title={bloqueadoPorConvenio ? 'Convenio no está en ejecución' : (c.estado === 'ACTIVO' ? 'Inactivar' : 'Activar')}
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${c.estado === 'ACTIVO' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                          <Power size={12} /> {c.estado === 'ACTIVO' ? 'Inactivar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* ── Tab: Empresas Jurídicas ── */
            listaEmpresas.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 text-sm">
                {q ? `Sin resultados para "${filtro}"` : 'No hay empresas jurídicas registradas.'}
                {!q && (
                  <>
                    <br />
                    <Link href={`/panel/convenios/${proyectoId}/capacitadores/empresa`}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-lg text-white bg-[#39A900] hover:bg-[#2d8800] transition">
                      <Building2 size={13} /> Agregar la primera
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {listaEmpresas.map((e, i) => (
                  <div key={e.capacitadorId}
                    className="rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden">
                    <div className="px-4 py-3 flex items-start gap-3 flex-wrap">
                      <span className="text-[10px] font-bold text-neutral-400 w-5 shrink-0 pt-0.5">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#00304D] truncate">{e.razonSocial}</p>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          {e.tipoDocumento} · {e.identificacion}
                          {e.sigla && ` · ${e.sigla}`}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {estadoBadge(e.estado)}
                          {interBadge(e.estadoInterventoria)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/panel/convenios/${proyectoId}/capacitadores/empresa?empresaId=${e.empresaId}`}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white bg-[#39A900] hover:bg-[#2d8800] transition">
                          Ver HV <ChevronRight size={12} />
                        </Link>
                        <button
                          onClick={() => setConfirmToggle({ capacitadorId: e.capacitadorId, estado: e.estado })}
                          disabled={bloqueadoPorConvenio}
                          title={bloqueadoPorConvenio ? 'Convenio no está en ejecución' : (e.estado === 'ACTIVO' ? 'Inactivar' : 'Activar')}
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${e.estado === 'ACTIVO' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                          <Power size={12} /> {e.estado === 'ACTIVO' ? 'Inactivar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </section>

      {/* Confirm toggle estado */}
      <ConfirmModal
        open={!!confirmToggle}
        titulo={confirmToggle?.estado === 'ACTIVO' ? 'Inactivar capacitador' : 'Activar capacitador'}
        mensaje={`¿Confirmas que deseas ${confirmToggle?.estado === 'ACTIVO' ? 'inactivar' : 'activar'} este capacitador?`}
        onConfirm={handleToggle}
        onClose={() => setConfirmToggle(null)}
        cargando={toggling}
      />
    </div>
  )
}
