'use client'

import api from '@/lib/api'
import { ConvenioNav } from '@/components/layout/convenio-nav'
import { Modal } from '@/components/ui/modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  AlertCircle, ArrowLeft, BadgeCheck, BookOpenCheck, CheckCircle2, ClipboardCheck,
  Clock, FileBarChart, Loader2, Save, Search, Sparkles, Wand2, Users, Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

const TITLE = '#00304D'
const SENA = '#39A900'

interface Cabecera {
  afGrupoId: number
  grupoNumero: number | null
  afId: number
  afNumero: number | null
  afNombre: string | null
  modalidadId: number | null
  modalidad: string | null
  tipoEvento: string | null
  totalHoras: number
  convenioEnEjecucion: boolean
}
interface UnidadTematica {
  utId: number
  numero: number
  nombre: string
  horas: number
  tieneSesiones: boolean
}
interface Sesion {
  sesionId: number
  numero: number
  maxHoras: number
}
interface Beneficiario {
  afGrupoBeneficiarioId: number
  personaId: number
  tipoDocumento: string | null
  identificacion: string | null
  nombreCompleto: string
  estado: string | null
  certifica: string | null
  validacionInterventor: string | null
  porcentajeCumplimiento: number
  uthorasId: number | null
  totalHoras: number
  horas: number[]   // 20 posiciones (0 si no aplica)
}

function chipInterv(v: string | null) {
  const e = (v ?? '').trim().toUpperCase()
  if (e === 'APROBADO' || e === 'VERIFICADO')
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 size={11} /> {e}</span>
  if (e === 'RECHAZADO')
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Rechazado</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{e || 'Pendiente'}</span>
}

export default function CertificarPage() {
  const params = useParams<{ id: string; afGrupoId: string }>()
  const proyectoId = Number(params?.id)
  const afGrupoId = Number(params?.afGrupoId)

  const [cab, setCab] = useState<Cabecera | null>(null)
  const [cargandoCab, setCargandoCab] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unidades, setUnidades] = useState<UnidadTematica[]>([])
  const [utId, setUtId] = useState(0)
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [benefs, setBenefs] = useState<Beneficiario[]>([])
  const [cargandoBenefs, setCargandoBenefs] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)
  const [trabajandoId, setTrabajandoId] = useState<number | null>(null)
  const [filtro, setFiltro] = useState('')
  const [masivoConfirm, setMasivoConfirm] = useState(false)
  const [masivoCargando, setMasivoCargando] = useState(false)

  useEffect(() => {
    document.title = 'Certificar | SEP'
    if (!proyectoId || !afGrupoId) return
    setCargandoCab(true)
    Promise.all([
      api.get<Cabecera>(`/certificacion/proyecto/${proyectoId}/grupo/${afGrupoId}`),
      api.get<UnidadTematica[]>(`/certificacion/proyecto/${proyectoId}/grupo/${afGrupoId}/unidades`),
    ]).then(([rC, rU]) => {
      setCab(rC.data)
      setUnidades(rU.data ?? [])
    }).catch((e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'No se pudo cargar la pantalla de certificación.')
    }).finally(() => setCargandoCab(false))
  }, [proyectoId, afGrupoId])

  useEffect(() => {
    if (!utId) { setSesiones([]); setBenefs([]); return }
    const ut = unidades.find(u => u.utId === utId)
    if (ut && !ut.tieneSesiones) {
      setToast({ tipo: 'error', msg: 'El cronograma no tiene sesiones registradas para esta UT.' })
      setSesiones([]); setBenefs([]); return
    }
    setCargandoBenefs(true)
    Promise.all([
      api.get<Sesion[]>(`/certificacion/proyecto/${proyectoId}/grupo/${afGrupoId}/unidad/${utId}/sesiones`),
      api.get<Beneficiario[]>(`/certificacion/proyecto/${proyectoId}/grupo/${afGrupoId}/unidad/${utId}/beneficiarios`),
    ]).then(([rS, rB]) => {
      setSesiones(rS.data ?? [])
      setBenefs(rB.data ?? [])
    }).catch(() => {
      setToast({ tipo: 'error', msg: 'No se pudo cargar la información de la UT.' })
    }).finally(() => setCargandoBenefs(false))
  }, [utId, proyectoId, afGrupoId, unidades])

  /** Actualiza el valor de horas en memoria y recalcula total local. */
  function setHora(personaId: number, sesionIdx: number, valor: number) {
    setBenefs(prev => prev.map(b => {
      if (b.personaId !== personaId) return b
      const nuevasHoras = [...b.horas]
      const sesion = sesiones[sesionIdx]
      const max = sesion?.maxHoras ?? 0
      // Cap local: no permitir más que el máximo de la sesión.
      nuevasHoras[sesionIdx] = Math.max(0, Math.min(valor, max))
      const total = nuevasHoras.reduce((a, n) => a + n, 0)
      return { ...b, horas: nuevasHoras, totalHoras: total }
    }))
  }

  async function guardar(b: Beneficiario) {
    setTrabajandoId(b.personaId)
    try {
      const r = await api.post<{ mensaje: string; total: number; porcentajeCumplimiento: number }>(
        `/certificacion/proyecto/${proyectoId}/grupo/${afGrupoId}/unidad/${utId}/persona/${b.personaId}`,
        { horas: b.horas.slice(0, sesiones.length) },
      )
      setToast({ tipo: 'success', msg: r.data.mensaje })
      // Reflejar en la fila el % cumplimiento actualizado.
      setBenefs(prev => prev.map(x => x.personaId === b.personaId
        ? { ...x, porcentajeCumplimiento: r.data.porcentajeCumplimiento, totalHoras: r.data.total }
        : x))
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudieron guardar las horas.' })
    } finally { setTrabajandoId(null) }
  }

  /** Llena las horas de UN beneficiario con el máximo de cada sesión.
   *  No guarda — el usuario revisa y luego hace clic en Guardar. */
  function llenarConMaximo(personaId: number) {
    setBenefs(prev => prev.map(b => {
      if (b.personaId !== personaId) return b
      const nuevasHoras = [...b.horas]
      sesiones.forEach((s, idx) => { nuevasHoras[idx] = Number(s.maxHoras) || 0 })
      const total = nuevasHoras.reduce((a, n) => a + n, 0)
      return { ...b, horas: nuevasHoras, totalHoras: total }
    }))
  }

  /** Certificación masiva: el backend asigna max horas a los beneficiarios
   *  sin horas (no sobrescribe los que ya tienen). Tras confirmar y guardar,
   *  recargamos la tabla. */
  async function ejecutarMasivo() {
    setMasivoCargando(true)
    try {
      const r = await api.post<{ actualizados: number; omitidos: number; sinSesiones?: boolean; mensaje: string }>(
        `/certificacion/proyecto/${proyectoId}/grupo/${afGrupoId}/unidad/${utId}/masivo`,
        {},
      )
      setToast({ tipo: r.data.sinSesiones ? 'error' : 'success', msg: r.data.mensaje })
      // Recargar beneficiarios para reflejar los nuevos totales y % cumplimiento.
      const rB = await api.get<Beneficiario[]>(
        `/certificacion/proyecto/${proyectoId}/grupo/${afGrupoId}/unidad/${utId}/beneficiarios`,
      )
      setBenefs(rB.data ?? [])
      setMasivoConfirm(false)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo ejecutar la certificación masiva.' })
    } finally { setMasivoCargando(false) }
  }

  const totalSesionesHoras = useMemo(() => sesiones.reduce((a, s) => a + Number(s.maxHoras), 0), [sesiones])
  const utActual = unidades.find(u => u.utId === utId) ?? null
  const bloqueado = cab?.convenioEnEjecucion === false

  /** Lista filtrada por texto en nombre o identificación. */
  const benefsFiltrados = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    if (!q) return benefs
    return benefs.filter(b =>
      (b.nombreCompleto ?? '').toLowerCase().includes(q)
      || (b.identificacion ?? '').toLowerCase().includes(q)
      || (b.tipoDocumento ?? '').toLowerCase().includes(q),
    )
  }, [benefs, filtro])

  return (
    <div className="min-h-screen bg-[#F0F4F8] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <ConvenioNav proyectoId={proyectoId} />

        {toast && (
          <ToastBetowa show onClose={() => setToast(null)} tipo={toast.tipo}
            titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
            mensaje={toast.msg} duration={4500} />
        )}

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2.5 rounded-xl shadow-sm" style={{ backgroundColor: TITLE }}>
            <ClipboardCheck size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: TITLE }}>Certificación de Beneficiarios</h1>
            <p className="text-xs text-neutral-500">
              Selecciona una Unidad Temática para registrar las horas de cada beneficiario por sesión.
            </p>
          </div>
          <Link href={`/panel/convenios/${proyectoId}/grupos/${afGrupoId}/asistencia`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#39A900] text-[#39A900] hover:bg-[#39A900] hover:text-white transition">
            <FileBarChart size={14} /> Reporte Asistencia
          </Link>
          <Link href={`/panel/convenios/${proyectoId}/grupos`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-neutral-500 hover:text-[#00304D]">
            <ArrowLeft size={13} /> Volver a Grupos
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {bloqueado && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertCircle size={16} />
            <span><strong>Convenio no está en ejecución.</strong> Solo consulta — no se pueden guardar horas.</span>
          </div>
        )}

        {cargandoCab ? (
          <div className="flex items-center gap-2 py-16 justify-center text-neutral-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        ) : cab && (
          <>
            {/* Tarjeta cabecera */}
            <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#39A900]" />
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Acción de Formación</p>
                  <p className="text-sm font-bold text-[#00304D] mt-0.5">AF {cab.afNumero} — {cab.afNombre}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Grupo</p>
                  <p className="text-sm font-bold text-[#00304D] mt-0.5">{cab.grupoNumero}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Modalidad / Evento</p>
                  <p className="text-sm font-bold text-[#0070C0] mt-0.5">{cab.modalidad ?? '—'} · {cab.tipoEvento ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Total Horas AF</p>
                  <p className="text-sm font-bold text-emerald-600 mt-0.5 inline-flex items-center gap-1">
                    <Clock size={14} /> {cab.totalHoras}
                  </p>
                </div>
              </div>
            </section>

            {/* Selector de UT */}
            <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-5">
              <div className="flex flex-col sm:flex-row items-end gap-3">
                <div className="flex items-center gap-2 text-[#00304D] font-bold text-sm shrink-0 self-start sm:self-end pb-1">
                  <BookOpenCheck size={16} /> Unidad Temática
                </div>
                <div className="flex-1 w-full flex flex-col gap-1">
                  <select value={utId} onChange={e => setUtId(Number(e.target.value))}
                    className="h-10 rounded-lg border border-neutral-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0070C0]">
                    <option value={0}>— Seleccione una UT —</option>
                    {unidades.map(u => (
                      <option key={u.utId} value={u.utId}>
                        UT {u.numero} — {u.nombre} ({u.horas}h) {u.tieneSesiones ? '' : '· sin sesiones'}
                      </option>
                    ))}
                  </select>
                </div>
                {utActual && (
                  <div className="flex items-center gap-3 text-xs text-neutral-600 pb-1">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold uppercase text-neutral-400">UT</span>
                      <span className="text-base font-bold text-[#0070C0]">{utActual.horas}h</span>
                    </div>
                    <div className="border-l border-neutral-200 h-8" />
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold uppercase text-neutral-400">Sesiones</span>
                      <span className="text-base font-bold text-[#00304D]">{sesiones.length}</span>
                    </div>
                    <div className="border-l border-neutral-200 h-8" />
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold uppercase text-neutral-400">Σ Sesiones</span>
                      <span className="text-base font-bold text-emerald-600">{totalSesionesHoras}h</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Tabla de beneficiarios */}
            {!utId ? (
              <div className="bg-white border border-dashed border-neutral-300 rounded-2xl p-12 text-center">
                <Users size={40} className="text-neutral-300 mx-auto mb-3" />
                <p className="text-sm text-neutral-500 font-semibold">Selecciona una Unidad Temática para certificar.</p>
              </div>
            ) : cargandoBenefs ? (
              <div className="flex items-center gap-2 py-12 justify-center text-neutral-400 text-sm">
                <Loader2 size={16} className="animate-spin" /> Cargando beneficiarios…
              </div>
            ) : sesiones.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
                <FileBarChart size={32} className="text-amber-500 mx-auto mb-3" />
                <p className="text-sm text-amber-700 font-semibold">Esta UT no tiene sesiones registradas en el cronograma.</p>
                <p className="text-xs text-amber-600 mt-1">Registra las sesiones desde el módulo Cronograma antes de certificar.</p>
              </div>
            ) : benefs.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center">
                <Users size={40} className="text-neutral-200 mx-auto mb-3" />
                <p className="text-sm text-neutral-500 font-semibold">Este grupo no tiene beneficiarios activos.</p>
              </div>
            ) : (
              <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
                {/* Toolbar: buscador + certificar masivo */}
                <div className="px-4 py-3 border-b border-neutral-100 flex flex-wrap items-center gap-3 bg-neutral-50">
                  <div className="flex-1 min-w-[200px] max-w-md relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={filtro}
                      onChange={e => setFiltro(e.target.value)}
                      placeholder="Buscar por nombre o identificación…"
                      className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                    />
                  </div>
                  <span className="text-xs text-neutral-500">
                    {filtro
                      ? <>Mostrando <strong>{benefsFiltrados.length}</strong> de {benefs.length}</>
                      : <>{benefs.length} beneficiario{benefs.length === 1 ? '' : 's'}</>}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => setMasivoConfirm(true)}
                      disabled={bloqueado || benefs.length === 0}
                      title={bloqueado ? 'Convenio no está en ejecución' : 'Certificar a todos los beneficiarios sin horas con el máximo del cronograma'}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border-2 border-[#7C3AED] text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#7C3AED]">
                      <Sparkles size={13} /> Certificar masivamente
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] font-bold uppercase tracking-wide bg-[#00304D] text-white">
                        <th className="px-3 py-2.5 w-10 text-center">#</th>
                        <th className="px-3 py-2.5">Documento</th>
                        <th className="px-3 py-2.5">Nombre</th>
                        <th className="px-3 py-2.5 text-center">Estado</th>
                        {sesiones.map(s => (
                          <th key={s.sesionId} className="px-2 py-2.5 text-center" title={`Máx: ${s.maxHoras}h`}>
                            S{s.numero}
                            <span className="block text-[9px] font-normal text-neutral-300">máx {s.maxHoras}h</span>
                          </th>
                        ))}
                        <th className="px-3 py-2.5 text-center">Total</th>
                        <th className="px-3 py-2.5 text-center">% Cumpl.</th>
                        <th className="px-3 py-2.5 text-center">Certifica</th>
                        <th className="px-3 py-2.5 text-center">Interv.</th>
                        <th className="px-3 py-2.5 text-center w-36">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {benefsFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={9 + sesiones.length} className="px-3 py-8 text-center text-sm text-neutral-400">
                            No hay beneficiarios que coincidan con la búsqueda.
                          </td>
                        </tr>
                      ) : benefsFiltrados.map((b, i) => {
                        const trabajando = trabajandoId === b.personaId
                        const totalRow = b.horas.slice(0, sesiones.length).reduce((a, n) => a + Number(n), 0)
                        return (
                          <tr key={b.personaId} className="hover:bg-neutral-50">
                            <td className="px-3 py-2 text-center text-neutral-500">{i + 1}</td>
                            <td className="px-3 py-2 text-neutral-700">
                              <span className="block text-[11px]">{b.tipoDocumento ?? '—'}</span>
                              <span className="block font-mono text-xs">{b.identificacion ?? '—'}</span>
                            </td>
                            <td className="px-3 py-2 font-medium text-neutral-800">{b.nombreCompleto || '—'}</td>
                            <td className="px-3 py-2 text-center">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={11} /> {b.estado}
                              </span>
                            </td>
                            {sesiones.map((s, idx) => (
                              <td key={s.sesionId} className="px-1 py-2 text-center">
                                <input type="number"
                                  value={b.horas[idx] ?? 0}
                                  min={0}
                                  max={s.maxHoras}
                                  step={1}
                                  disabled={bloqueado || trabajando}
                                  onChange={e => setHora(b.personaId, idx, Number(e.target.value) || 0)}
                                  className="w-14 h-8 px-1 text-center rounded-md border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0] disabled:bg-neutral-100 disabled:cursor-not-allowed" />
                              </td>
                            ))}
                            <td className="px-3 py-2 text-center font-bold text-[#0070C0]">{totalRow}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex items-center justify-center min-w-[36px] text-[11px] font-bold px-2 py-0.5 rounded-full ${b.porcentajeCumplimiento >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                {b.porcentajeCumplimiento}%
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {(b.certifica ?? '').toUpperCase() === 'SI'
                                ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700"><BadgeCheck size={12} /> SÍ</span>
                                : <span className="text-[10px] font-bold text-neutral-400">—</span>}
                            </td>
                            <td className="px-3 py-2 text-center">{chipInterv(b.validacionInterventor)}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1.5">
                                <button onClick={() => llenarConMaximo(b.personaId)} disabled={bloqueado || trabajando}
                                  title="Llenar con máx de cada sesión (no guarda; revisa y guarda)"
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border border-[#0070C0]/40 text-[#0070C0] hover:bg-[#0070C0] hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#0070C0]">
                                  <Wand2 size={11} />
                                </button>
                                <button onClick={() => guardar(b)} disabled={bloqueado || trabajando}
                                  title={bloqueado ? 'Convenio no está en ejecución' : 'Guardar horas'}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition"
                                  style={{ backgroundColor: SENA }}>
                                  {trabajando
                                    ? <><Loader2 size={12} className="animate-spin" /> Guardando…</>
                                    : <><Save size={12} /> Guardar</>}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {/* Modal: confirmar certificación masiva */}
        <Modal open={masivoConfirm} onClose={() => !masivoCargando && setMasivoConfirm(false)} maxWidth="max-w-lg">
          <div className="flex flex-col">
            <div className="px-5 py-4 flex items-center gap-3 border-b border-neutral-100" style={{ backgroundColor: '#7C3AED' }}>
              <div className="p-2 rounded-lg bg-white/15">
                <Sparkles size={18} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-white font-bold text-base">Certificación masiva</h2>
                <p className="text-white/80 text-xs">
                  UT {utActual?.numero ?? '?'} · {utActual?.nombre ?? '—'}
                </p>
              </div>
            </div>
            <div className="px-5 py-5 space-y-3 text-sm text-neutral-700">
              <p>
                Se asignarán las <strong>horas máximas de cada sesión</strong> del cronograma a <strong>todos los beneficiarios activos</strong> que aún no tengan horas registradas para esta UT.
              </p>
              <ul className="text-xs text-neutral-500 list-disc ml-5 space-y-1">
                <li>Beneficiarios con horas ya guardadas <strong>no se sobrescriben</strong>.</li>
                <li>El % de cumplimiento se recalcula automáticamente.</li>
                <li>El campo "Certifica" pasa a <strong>SÍ</strong> cuando el % es ≥ 80.</li>
              </ul>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                Total a aplicar por persona: <strong>{totalSesionesHoras}h</strong> distribuidas en <strong>{sesiones.length} sesión{sesiones.length === 1 ? '' : 'es'}</strong>.
              </div>
            </div>
            <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-end gap-2 bg-neutral-50">
              <button onClick={() => setMasivoConfirm(false)} disabled={masivoCargando}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-neutral-600 hover:bg-neutral-100 transition disabled:opacity-40">
                Cancelar
              </button>
              <button onClick={ejecutarMasivo} disabled={masivoCargando}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white shadow disabled:opacity-40"
                style={{ backgroundColor: '#7C3AED' }}>
                {masivoCargando
                  ? <><Loader2 size={13} className="animate-spin" /> Procesando…</>
                  : <><Sparkles size={13} /> Certificar a todos</>}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  )
}
