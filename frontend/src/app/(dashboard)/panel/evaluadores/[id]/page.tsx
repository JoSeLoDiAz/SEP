'use client'

import api from '@/lib/api'
import { abrirArchivo, descargarArchivo, descargarArchivoConNombreDelServidor } from '@/lib/descargar-archivo'
import { useFotoEvaluador } from '@/lib/use-foto-evaluador'
import { aTitleCase } from '@/lib/title-case'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { TrayectoriaEvaluador } from '@/components/evaluadores/trayectoria-evaluador'
import { ControlCambiosEvaluador } from '@/components/evaluadores/control-cambios-evaluador'
import { VisorFicha } from '@/components/evaluadores/visor-ficha'
import {
  ArrowLeft, Award, Briefcase, ChevronRight, Download, Eye, FileText,
  GraduationCap, History, IdCard, Loader2, Paperclip, Pencil, PowerOff, Save, Settings2,
  ShieldCheck, Trash2, Upload, UserCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fmtFecha, fmtMesAnio, fmtSoloDia } from '@/lib/format-date'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

interface Ficha {
  evaluadorId: number
  personaId: number
  centroId: number | null
  centroNombre?: string | null
  regionalId: number | null
  regionalNombre?: string | null
  municipioId?: number | null
  municipioNombre?: string | null
  municipioDeptoNombre?: string | null
  cargo: string | null
  profesion: string | null
  posgrado: string | null
  jefeNombre?: string | null
  jefeEmail?: string | null
  jefeCargo?: string | null
  activo: number
  tieneFoto: boolean
  identificacion: string
  nombres: string
  primerApellido: string
  segundoApellido: string | null
  email: string
  emailInstitucional: string | null
  celular: string | null
}

interface RegionalCat { id: number; nombre: string }
interface CentroCat { id: number; nombre: string }
interface CiudadCat { id: number; ciudad: string; depto: string }

type TabId = 'trayectoria' | 'perfil' | 'documentos' | 'control-cambios'
type PerfilSubTab = 'datos' | 'estudios' | 'tic' | 'experiencia'

interface Tab { id: TabId; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }
const TABS: Tab[] = [
  { id: 'trayectoria', label: 'Trayectoria', icon: ShieldCheck },
  { id: 'perfil',      label: 'Perfil',      icon: UserCircle2 },
  { id: 'documentos',  label: 'Documentos',  icon: Paperclip },
  { id: 'control-cambios',   label: 'Control de cambios',   icon: History },
]

interface SubTab { id: PerfilSubTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }
const PERFIL_SUBTABS: SubTab[] = [
  { id: 'datos',       label: 'Datos básicos',           icon: UserCircle2 },
  { id: 'estudios',    label: 'Hoja de vida y estudios', icon: GraduationCap },
  { id: 'tic',         label: 'Certificaciones TIC',     icon: Award },
  { id: 'experiencia', label: 'Experiencia',             icon: Briefcase },
]

export default function FichaEvaluadorPage() {
  const params = useParams<{ id: string }>()
  const evaluadorId = Number(params.id)

  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState('')
  const [tab, setTab] = useState<TabId>('trayectoria')
  const [perfilTab, setPerfilTab] = useState<PerfilSubTab>('datos')
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)
  // sube cuando participaciones o pruebas cambian: la trayectoria de arriba se refresca sola
  const [refresco, setRefresco] = useState(0)
  const subirRefresco = useCallback(() => setRefresco(n => n + 1), [])
  const [confirmDesactivar, setConfirmDesactivar] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [verFicha, setVerFicha] = useState(false)

  const cargar = async () => {
    setLoading(true)
    setErrMsg('')
    try {
      const res = await api.get<Ficha>(`/evaluadores/${evaluadorId}`)
      setFicha(res.data)
    } catch (err: unknown) {
      setErrMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error cargando la ficha')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { cargar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function toggleEstado(activar: boolean) {
    setCambiandoEstado(true)
    try {
      await api.put(`/evaluadores/${evaluadorId}/estado`, { activo: activar })
      setToast({ tipo: 'success', msg: activar ? 'Evaluador activado' : 'Evaluador desactivado' })
      setConfirmDesactivar(false)
      await cargar()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo cambiar el estado' })
    } finally {
      setCambiandoEstado(false)
    }
  }

  const fotoSrc = useFotoEvaluador(evaluadorId, ficha?.tieneFoto ?? false)

  if (loading) {
    return (
      <div className="p-10 flex items-center gap-2 text-neutral-500 text-sm">
        <Loader2 size={14} className="animate-spin" />
        Cargando ficha...
      </div>
    )
  }
  if (errMsg || !ficha) {
    return <div className="p-10 text-red-700 bg-red-50 border border-red-200 rounded-xl m-6">{errMsg || 'No se encontró el evaluador'}</div>
  }

  const fullName = [ficha.nombres, ficha.primerApellido, ficha.segundoApellido].filter(Boolean).join(' ').trim()

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa show onClose={() => setToast(null)} tipo={toast.tipo} titulo={toast.tipo === 'success' ? 'Listo' : 'Error'} mensaje={toast.msg} duration={3500} />
      )}

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl shadow-lg" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #001f33 70%, #000a14 100%)` }}>
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        <div className="relative px-6 sm:px-8 py-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur-sm overflow-hidden shrink-0 flex items-center justify-center">
            {fotoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoSrc} alt={fullName} className="w-full h-full object-cover" />
            ) : (
              <UserCircle2 size={48} className="text-white/70" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-white/70 text-xs flex-wrap">
              <Link href="/panel/evaluadores" className="hover:text-white">Banco de Evaluadores</Link>
              <ChevronRight size={12} />
              <span>Ficha</span>
            </div>
            <h1 className="text-white font-bold text-xl sm:text-2xl mt-1 leading-tight">{fullName}</h1>
            <p className="text-white/80 text-sm mt-0.5 font-mono">CC {ficha.identificacion}</p>
            {ficha.cargo && <p className="text-white/80 text-xs mt-1">{ficha.cargo}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                ficha.activo === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-700'
              }`}>
                {ficha.activo === 1 ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => setVerFicha(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold rounded-xl backdrop-blur-sm transition"
            >
              <FileText size={13} />
              Ver ficha
            </button>
            {ficha.activo === 1 ? (
              <button
                onClick={() => setConfirmDesactivar(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold rounded-xl backdrop-blur-sm transition"
              >
                <PowerOff size={13} />
                Desactivar
              </button>
            ) : (
              <button
                onClick={() => toggleEstado(true)}
                disabled={cambiandoEstado}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-[#00304D] hover:bg-white/95 text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50"
              >
                {cambiandoEstado ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                Activar
              </button>
            )}
          </div>
        </div>
      </div>

      <Link href="/panel/evaluadores" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D] w-fit">
        <ArrowLeft size={13} />
        Volver al banco
      </Link>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto bg-white border border-neutral-200 rounded-2xl p-1.5 shadow-sm">
        {TABS.map(t => {
          const Icon = t.icon
          const activo = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activo ? 'text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
              style={activo ? { backgroundColor: PRIMARY } : undefined}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'trayectoria' && (
        <>
          <TrayectoriaEvaluador evaluadorId={evaluadorId} setToast={setToast} refrescar={refresco} />
          <SeccionParticipaciones evaluadorId={evaluadorId} setToast={setToast} onCambio={subirRefresco} />
          <SeccionPruebas         evaluadorId={evaluadorId} setToast={setToast} onCambio={subirRefresco} />
        </>
      )}

      {tab === 'perfil' && (
        <>
          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-sm">
            {PERFIL_SUBTABS.map(t => {
              const Icon = t.icon
              const activo = perfilTab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setPerfilTab(t.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    activo ? 'text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-50'
                  }`}
                  style={activo ? { backgroundColor: PRIMARY } : undefined}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              )
            })}
          </div>

          {perfilTab === 'datos' && (
            <>
              <SeccionDatos ficha={ficha} onChanged={cargar} setToast={setToast} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SeccionFoto   ficha={ficha} onChanged={cargar} setToast={setToast} />
                <SeccionCedula evaluadorId={evaluadorId}       setToast={setToast} />
              </div>
            </>
          )}
          {perfilTab === 'estudios' && (
            <>
              <SeccionHV       evaluadorId={evaluadorId} setToast={setToast} />
              <SeccionEstudios evaluadorId={evaluadorId} setToast={setToast} />
            </>
          )}
          {perfilTab === 'tic'         && <SeccionTic         evaluadorId={evaluadorId} setToast={setToast} />}
          {perfilTab === 'experiencia' && <SeccionExperiencia evaluadorId={evaluadorId} setToast={setToast} />}
        </>
      )}

      {tab === 'documentos' && <SeccionDocumentos  evaluadorId={evaluadorId} setToast={setToast} />}
      {tab === 'control-cambios'  && <ControlCambiosEvaluador evaluadorId={evaluadorId} setToast={setToast} />}

      <ConfirmModal
        open={confirmDesactivar}
        onClose={() => setConfirmDesactivar(false)}
        onConfirm={() => toggleEstado(false)}
        tipo="warning"
        titulo="Desactivar evaluador"
        mensaje={<>El evaluador <strong>{fullName}</strong> dejará de aparecer en el banco activo.</>}
        textoConfirmar="Desactivar"
        cargando={cambiandoEstado}
      />

      {verFicha && (
        <VisorFicha
          evaluadorId={evaluadorId}
          nombre={fullName}
          identificacion={ficha.identificacion}
          onCerrar={() => setVerFicha(false)}
        />
      )}
    </div>
  )
}

type Toast = { tipo: 'success' | 'error'; msg: string }
type SetToast = (t: Toast | null) => void

function Section({ titulo, children, accion }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-neutral-900">{titulo}</p>
        {accion}
      </header>
      <div>{children}</div>
    </section>
  )
}

function manejarError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
}

function SeccionDatos({ ficha, onChanged, setToast }: { ficha: Ficha; onChanged: () => void; setToast: SetToast }) {
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  // EVALUADOR
  const [centroId, setCentroId] = useState<number | null>(ficha.centroId ?? null)
  const [regionalId, setRegionalId] = useState<number | null>(ficha.regionalId ?? null)
  const [municipioId, setMunicipioId] = useState<number | null>(ficha.municipioId ?? null)
  const [cargo, setCargo] = useState(ficha.cargo ?? '')
  const [profesion, setProfesion] = useState(ficha.profesion ?? '')
  const [posgrado, setPosgrado] = useState(ficha.posgrado ?? '')
  const [jefeNombre, setJefeNombre] = useState(ficha.jefeNombre ?? '')
  const [jefeEmail, setJefeEmail] = useState(ficha.jefeEmail ?? '')
  const [jefeCargo, setJefeCargo] = useState(ficha.jefeCargo ?? '')
  // PERSONA
  const [nombres, setNombres] = useState(ficha.nombres ?? '')
  const [primerApellido, setPrimerAp] = useState(ficha.primerApellido ?? '')
  const [segundoApellido, setSegundoAp] = useState(ficha.segundoApellido ?? '')
  const [email, setEmail] = useState(ficha.email ?? '')
  const [emailInst, setEmailInst] = useState(ficha.emailInstitucional ?? '')
  const [celular, setCelular] = useState(ficha.celular ?? '')

  const [regionales, setRegionales] = useState<RegionalCat[]>([])
  const [centros, setCentros] = useState<CentroCat[]>([])
  const [cargandoCentros, setCargandoCentros] = useState(false)

  useEffect(() => {
    if (!editando) return
    api.get<RegionalCat[]>('/evaluadores/catalogos/regionales')
      .then(r => setRegionales(r.data ?? []))
      .catch(() => setRegionales([]))
  }, [editando])

  useEffect(() => {
    if (!editando) return
    if (regionalId == null) {
      setCentros([])
      return
    }
    setCargandoCentros(true)
    const ctrl = new AbortController()
    api.get<CentroCat[]>('/evaluadores/catalogos/centros', { params: { regionalId }, signal: ctrl.signal })
      .then(r => setCentros(r.data ?? []))
      .catch(err => { if (err?.name !== 'CanceledError') setCentros([]) })
      .finally(() => setCargandoCentros(false))
    return () => ctrl.abort()
  }, [editando, regionalId])

  async function guardar() {
    if (!nombres.trim() || !primerApellido.trim()) {
      setToast({ tipo: 'error', msg: 'Nombres y primer apellido son obligatorios' })
      return
    }
    if (!email.trim() || !emailInst.trim()) {
      setToast({ tipo: 'error', msg: 'Correo personal e institucional son obligatorios' })
      return
    }
    setGuardando(true)
    try {
      await api.put(`/evaluadores/${ficha.evaluadorId}`, {
        centroId: centroId,
        regionalId: regionalId,
        municipioId: municipioId,
        cargo: cargo.trim() || null,
        profesion: profesion.trim() || null,
        posgrado: posgrado.trim() || null,
        jefeNombre: jefeNombre.trim() || null,
        jefeEmail: jefeEmail.trim().toLowerCase() || null,
        jefeCargo: jefeCargo.trim() || null,
        nombres: nombres.trim(),
        primerApellido: primerApellido.trim(),
        segundoApellido: segundoApellido.trim(),
        email: email.trim().toLowerCase(),
        emailInstitucional: emailInst.trim().toLowerCase(),
        celular: celular.trim(),
      })
      setToast({ tipo: 'success', msg: 'Datos actualizados' })
      setEditando(false)
      onChanged()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo guardar') })
    } finally {
      setGuardando(false)
    }
  }

  const label = 'block text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
  const input = 'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40'

  if (!editando) {
    return (
      <Section titulo="Datos del evaluador" accion={
        <button onClick={() => setEditando(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-[#00304D]/10 text-neutral-700 hover:text-[#00304D] text-xs font-semibold rounded-lg transition">
          <Pencil size={12} />
          Editar
        </button>
      }>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Dato label="Nombres" valor={ficha.nombres} />
          <Dato label="Apellidos" valor={`${ficha.primerApellido ?? ''} ${ficha.segundoApellido ?? ''}`.trim()} />
          <Dato label="Identificación" valor={ficha.identificacion} mono />
          <Dato label="Correo personal" valor={ficha.email} />
          <Dato label="Correo institucional" valor={ficha.emailInstitucional} />
          <Dato label="Celular" valor={ficha.celular} />
          <Dato label="Cargo" valor={ficha.cargo} />
          <Dato label="Profesión (pregrado)" valor={ficha.profesion} />
          <Dato label="Posgrado" valor={ficha.posgrado} />
          <Dato label="Regional" valor={ficha.regionalNombre} />
          <Dato label="Centro de formación" valor={ficha.centroNombre} />
          <Dato
            label="Municipio"
            valor={
              ficha.municipioNombre
                ? `${aTitleCase(ficha.municipioNombre) ?? ficha.municipioNombre}${
                    ficha.municipioDeptoNombre
                      ? `, ${aTitleCase(ficha.municipioDeptoNombre) ?? ficha.municipioDeptoNombre}`
                      : ''
                  }`
                : null
            }
          />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Jefe directo</p>
            {ficha.jefeNombre || ficha.jefeEmail || ficha.jefeCargo ? (
              <div className="text-sm text-neutral-800 space-y-0.5">
                <p className="truncate">{ficha.jefeNombre || '—'}</p>
                <p className="text-xs text-neutral-600 truncate">{ficha.jefeEmail || '—'}</p>
                <p className="text-xs text-neutral-600 truncate">{ficha.jefeCargo || '—'}</p>
              </div>
            ) : (
              <p className="text-sm text-neutral-800">—</p>
            )}
          </div>
          <div className="sm:col-span-2">
          </div>
        </div>
      </Section>
    )
  }

  return (
    <Section titulo="Editar datos del evaluador">
      <div className="px-5 py-4 flex flex-col gap-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-3">Datos personales</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={label}>Nombres *</label><input value={nombres} onChange={e => setNombres(e.target.value)} onBlur={() => setNombres(v => aTitleCase(v) ?? '')} className={input} /></div>
            <div><label className={label}>Primer apellido *</label><input value={primerApellido} onChange={e => setPrimerAp(e.target.value)} onBlur={() => setPrimerAp(v => aTitleCase(v) ?? '')} className={input} /></div>
            <div><label className={label}>Segundo apellido</label><input value={segundoApellido} onChange={e => setSegundoAp(e.target.value)} onBlur={() => setSegundoAp(v => aTitleCase(v) ?? '')} className={input} /></div>
            <div>
              <label className={label}>Identificación</label>
              <input value={ficha.identificacion} disabled className={`${input} bg-neutral-50 text-neutral-500 cursor-not-allowed`} />
              <p className="text-[10px] text-neutral-400 mt-0.5">No editable — para cambiar, eliminar y volver a registrar.</p>
            </div>
            <div><label className={label}>Correo personal *</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={input} /></div>
            <div><label className={label}>Correo institucional *</label><input type="email" value={emailInst} onChange={e => setEmailInst(e.target.value)} className={input} /></div>
            <div className="sm:col-span-2"><label className={label}>Celular</label><input value={celular} onChange={e => setCelular(e.target.value)} className={input} /></div>
          </div>
        </div>

        <div className="border-t border-neutral-100 pt-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-3">Datos del banco</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={label}>Cargo</label><input value={cargo} onChange={e => setCargo(e.target.value)} className={input} /></div>
            <div><label className={label}>Profesión</label><input value={profesion} onChange={e => setProfesion(e.target.value)} className={input} /></div>
            <div>
              <label className={label}>Regional</label>
              <select
                value={regionalId ?? ''}
                onChange={e => {
                  const v = e.target.value ? Number(e.target.value) : null
                  setRegionalId(v)
                  setCentroId(null)
                }}
                className={input}
              >
                <option value="">— Seleccionar —</option>
                {regionales.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Centro de formación</label>
              <select
                value={centroId ?? ''}
                onChange={e => setCentroId(e.target.value ? Number(e.target.value) : null)}
                disabled={regionalId == null || cargandoCentros}
                className={input}
              >
                <option value="">
                  {regionalId == null ? 'Selecciona una regional primero' : (cargandoCentros ? 'Cargando…' : '— Seleccionar —')}
                </option>
                {centros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Municipio</label>
              <MunicipioAutocomplete
                value={municipioId}
                initialLabel={
                  ficha.municipioNombre
                    ? `${aTitleCase(ficha.municipioNombre) ?? ficha.municipioNombre}${
                        ficha.municipioDeptoNombre
                          ? `, ${aTitleCase(ficha.municipioDeptoNombre) ?? ficha.municipioDeptoNombre}`
                          : ''
                      }`
                    : ''
                }
                onChange={setMunicipioId}
                inputClass={input}
              />
            </div>
            <div className="sm:col-span-2"><label className={label}>Posgrado</label><input value={posgrado} onChange={e => setPosgrado(e.target.value)} className={input} /></div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-2">Jefe directo</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={label}>Nombre</label>
                  <input
                    value={jefeNombre}
                    onChange={e => setJefeNombre(e.target.value)}
                    onBlur={() => setJefeNombre(v => aTitleCase(v) ?? '')}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Correo institucional</label>
                  <input type="email" value={jefeEmail} onChange={e => setJefeEmail(e.target.value)} className={input} />
                </div>
                <div>
                  <label className={label}>Cargo</label>
                  <input value={jefeCargo} onChange={e => setJefeCargo(e.target.value)} className={input} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="px-5 py-3 border-t border-neutral-100 flex justify-end gap-2 bg-neutral-50">
        <button onClick={() => setEditando(false)} className="px-4 py-2 border border-neutral-300 text-sm font-semibold rounded-lg hover:bg-white transition">Cancelar</button>
        <button onClick={guardar} disabled={guardando} className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90" style={{ backgroundColor: INSTITUTIONAL }}>
          {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar
        </button>
      </div>
    </Section>
  )
}

function Dato({ label, valor, mono, multiline }: { label: string; valor: string | number | null | undefined; mono?: boolean; multiline?: boolean }) {
  const v = valor === undefined || valor === null || valor === '' ? '—' : String(valor)
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : ''} text-neutral-800 ${multiline ? 'whitespace-pre-line' : 'truncate'}`}>{v}</p>
    </div>
  )
}

function MunicipioAutocomplete({
  value,
  initialLabel,
  onChange,
  inputClass,
}: {
  value: number | null
  initialLabel: string
  onChange: (id: number | null) => void
  inputClass: string
}) {
  const [texto, setTexto] = useState(initialLabel)
  const [resultados, setResultados] = useState<CiudadCat[]>([])
  const [buscando, setBuscando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // el abort descarta respuestas viejas que llegan después de la última tecla
  useEffect(() => {
    const q = texto.trim()
    if (q.length < 2) {
      setResultados([])
      setBuscando(false)
      return
    }
    // ya elegido: no rebuscar lo mismo
    if (value != null && q === initialLabel.trim()) {
      setResultados([])
      return
    }
    setBuscando(true)
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      api.get<CiudadCat[]>('/evaluadores/catalogos/ciudades/buscar', {
        params: { q, limite: 20 },
        signal: ctrl.signal,
      })
        .then(r => setResultados(r.data ?? []))
        .catch(err => { if (err?.name !== 'CanceledError') setResultados([]) })
        .finally(() => setBuscando(false))
    }, 280)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [texto, value, initialLabel])

  function elegir(c: CiudadCat) {
    onChange(c.id)
    const ciudadTC = aTitleCase(c.ciudad) ?? c.ciudad
    const deptoTC = aTitleCase(c.depto) ?? c.depto
    setTexto(deptoTC ? `${ciudadTC}, ${deptoTC}` : ciudadTC)
    setAbierto(false)
    setResultados([])
  }

  function limpiar() {
    onChange(null)
    setTexto('')
    setResultados([])
    setAbierto(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          value={texto}
          onChange={e => {
            setTexto(e.target.value)
            setAbierto(true)
            // al editar el texto el id deja de valer hasta que elija otro
            if (value != null) onChange(null)
          }}
          onFocus={() => setAbierto(true)}
          placeholder="Escribe 2+ letras (ej: Bogotá)"
          className={`${inputClass} pr-8`}
          autoComplete="off"
        />
        {(texto || value != null) && (
          <button
            type="button"
            onClick={limpiar}
            aria-label="Limpiar municipio"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>
      {abierto && texto.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg max-h-64 overflow-auto">
          {buscando ? (
            <p className="px-3 py-2 text-xs text-neutral-500 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              Buscando…
            </p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-2 text-xs text-neutral-500">Sin resultados</p>
          ) : (
            resultados.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => elegir(c)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 border-b border-neutral-50 last:border-b-0"
              >
                <span className="font-medium text-neutral-800">{aTitleCase(c.ciudad) ?? c.ciudad}</span>
                {c.depto && <span className="text-neutral-500"> — {aTitleCase(c.depto) ?? c.depto}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function SeccionFoto({ ficha, onChanged, setToast }: { ficha: Ficha; onChanged: () => void; setToast: SetToast }) {
  const [subiendo, setSubiendo] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const fotoSrc = useFotoEvaluador(ficha.evaluadorId, ficha.tieneFoto)

  async function subir(file: File) {
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      await api.post(`/evaluadores/${ficha.evaluadorId}/foto`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setToast({ tipo: 'success', msg: 'Foto actualizada' })
      onChanged()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo subir la foto') })
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function eliminar() {
    setEliminando(true)
    try {
      await api.delete(`/evaluadores/${ficha.evaluadorId}/foto`)
      setToast({ tipo: 'success', msg: 'Foto eliminada' })
      onChanged()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo eliminar') })
    } finally {
      setEliminando(false)
    }
  }

  return (
    <Section titulo="Foto del evaluador">
      <div className="px-5 py-5 flex flex-col sm:flex-row gap-5 items-start">
        <div className="w-44 h-44 rounded-2xl bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center shrink-0">
          {fotoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoSrc} alt="Foto" className="w-full h-full object-cover" />
          ) : (
            <UserCircle2 size={64} className="text-neutral-300" />
          )}
        </div>
        <div className="flex-1 flex flex-col gap-3">
          <p className="text-sm text-neutral-700">
            Sube una foto de tipo carné. Formatos JPG, PNG o WebP. Máximo 8 MB.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) subir(f) }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={subiendo}
              className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90"
              style={{ backgroundColor: INSTITUTIONAL }}
            >
              {subiendo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {ficha.tieneFoto ? 'Cambiar foto' : 'Subir foto'}
            </button>
            {ficha.tieneFoto && (
              <button
                onClick={() => descargarArchivoConNombreDelServidor(
                  `/evaluadores/${ficha.evaluadorId}/foto/descargar`,
                  `evaluador_${ficha.evaluadorId}_foto.jpg`,
                ).catch(() => {
                  setToast({ tipo: 'error', msg: 'No se pudo descargar la foto' })
                })}
                className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold rounded-lg transition"
              >
                <Download size={14} /> Descargar
              </button>
            )}
            {ficha.tieneFoto && (
              <button
                onClick={eliminar}
                disabled={eliminando}
                className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-red-100 text-neutral-700 hover:text-red-700 text-sm font-semibold rounded-lg disabled:opacity-50 transition"
              >
                {eliminando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>
    </Section>
  )
}

interface DocEvaluador {
  documentoId: number
  archivoNombre: string | null
  fechaCargue: string
}

interface TipoDocEval {
  id: number
  codigo: string
  nombre: string
}

function SeccionCedula({ evaluadorId, setToast }: { evaluadorId: number; setToast: SetToast }) {
  const [doc, setDoc] = useState<DocEvaluador | null>(null)
  const [tipoCedulaId, setTipoCedulaId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  async function cargar() {
    setLoading(true)
    try {
      const [rDoc, rTipos] = await Promise.all([
        api.get<DocEvaluador | null>(`/evaluadores/${evaluadorId}/cedula`),
        api.get<TipoDocEval[]>(`/evaluadores/catalogos/tipos-documento-evaluador`, { params: { soloActivos: true } }),
      ])
      setDoc(rDoc.data ?? null)
      const cedula = (rTipos.data ?? []).find(t => t.codigo === 'CEDULA')
      setTipoCedulaId(cedula?.id ?? null)
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo cargar la cédula') })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { cargar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [evaluadorId])

  async function subir(file: File) {
    if (!tipoCedulaId) {
      setToast({ tipo: 'error', msg: 'No se encontró el tipo de documento "CEDULA" en el catálogo' })
      return
    }
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      fd.append('tipoDocumentoEvalId', String(tipoCedulaId))
      await api.post(`/evaluadores/${evaluadorId}/documentos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setToast({ tipo: 'success', msg: doc ? 'Cédula reemplazada' : 'Cédula cargada' })
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo subir la cédula') })
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function eliminar() {
    if (!doc) return
    setEliminando(true)
    try {
      await api.delete(`/evaluadores/documentos/${doc.documentoId}`)
      setToast({ tipo: 'success', msg: 'Cédula eliminada' })
      setConfirmDel(false)
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo eliminar la cédula') })
    } finally {
      setEliminando(false)
    }
  }

  return (
    <Section titulo="Cédula de ciudadanía">
      <div className="px-5 py-5 flex flex-col sm:flex-row gap-5 items-start">
        <div className="w-44 h-44 rounded-2xl bg-[#00304D]/5 border border-[#00304D]/10 flex items-center justify-center shrink-0">
          <IdCard size={64} className={doc ? 'text-[#00304D]' : 'text-neutral-300'} />
        </div>
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {loading ? (
            <p className="text-sm text-neutral-500 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Cargando...
            </p>
          ) : doc ? (
            <>
              <p className="text-sm font-bold text-neutral-800 truncate">
                {doc.archivoNombre ?? 'cedula.pdf'}
              </p>
              <p className="text-[11px] text-neutral-500">
                Cargada el {new Date(doc.fechaCargue).toLocaleString('es-CO', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-neutral-700">No se ha subido la cédula</p>
              <p className="text-[11px] text-neutral-500">Formato PDF. Máximo 8 MB.</p>
            </>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) subir(f) }}
          />

          <div className="flex flex-wrap gap-2">
            {doc ? (
              <>
                <button
                  onClick={() => abrirArchivo(`/evaluadores/documentos/${doc.documentoId}/archivo`).catch(() => {
                    setToast({ tipo: 'error', msg: 'No se pudo abrir la cédula' })
                  })}
                  className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg transition hover:opacity-90"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <Eye size={14} />
                  Ver
                </button>
                <button
                  onClick={() => descargarArchivoConNombreDelServidor(
                    `/evaluadores/documentos/${doc.documentoId}/descargar`,
                    doc.archivoNombre ?? 'cedula.pdf',
                  ).catch(() => {
                    setToast({ tipo: 'error', msg: 'No se pudo descargar la cédula' })
                  })}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold rounded-lg transition"
                >
                  <Download size={14} />
                  Descargar
                </button>
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={subiendo}
                  className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90"
                  style={{ backgroundColor: INSTITUTIONAL }}
                >
                  {subiendo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Reemplazar
                </button>
                <button
                  onClick={() => setConfirmDel(true)}
                  disabled={eliminando}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-red-100 text-neutral-700 hover:text-red-700 text-sm font-semibold rounded-lg disabled:opacity-50 transition"
                >
                  {eliminando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Eliminar
                </button>
              </>
            ) : (
              <button
                onClick={() => inputRef.current?.click()}
                disabled={subiendo || !tipoCedulaId}
                title={!tipoCedulaId ? 'Catálogo de tipos de documento no disponible' : undefined}
                className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90"
                style={{ backgroundColor: INSTITUTIONAL }}
              >
                {subiendo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Subir cédula
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={eliminar}
        tipo="delete"
        titulo="Eliminar cédula"
        mensaje={<>¿Seguro que deseas eliminar la cédula de este evaluador? Esta acción no se puede deshacer.</>}
        textoConfirmar="Eliminar"
        cargando={eliminando}
      />
    </Section>
  )
}

interface Cat { id: number; nombre: string }
// 500 = tope de la columna en BD (migración v44)
const MAX_EQUIPO = 500

interface Participacion {
  participacionId: number
  anio: number
  periodo: string | null
  rolEvaluadorId: number | null
  rolNombre: string | null
  modalidadPart: string | null
  procesoId: number | null
  procesoNombre: string | null
  procesoRevocado: boolean
  convocatoriaId: number | null
  areaId: number | null
  estadoNombre?: string | null
  motivoNoParticipa?: string | null
  mesa: string | null
  equipoEvaluador: string | null
  dinamizadorPersonaId: number | null
  dinamizadorNombre: string | null
}

function SeccionParticipaciones({ evaluadorId, setToast, onCambio }: { evaluadorId: number; setToast: SetToast; onCambio: () => void }) {
  const [items, setItems] = useState<Participacion[]>([])
  const [roles, setRoles] = useState<Cat[]>([])
  const [procesos, setProcesos] = useState<Cat[]>([])
  const [areas, setAreas] = useState<Cat[]>([])
  const [convocatorias, setConvocatorias] = useState<Array<{ id: number; nombre: string; anio: number; periodo: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [agregar, setAgregar] = useState(false)

  // Form
  const [anio, setAnio] = useState<string>(new Date().getFullYear().toString())
  const [periodo, setPeriodo] = useState('')
  const [rolId, setRolId] = useState<string>('')
  const [modalidad, setModalidad] = useState('')
  const [procId, setProcId] = useState<string>('')
  const [convId, setConvId] = useState<string>('')
  const [areaId, setAreaId] = useState<string>('')
  const [revocado, setRevocado] = useState(false)
  const [mesa, setMesa] = useState('')
  const [equipo, setEquipo] = useState('')
  // texto libre: quien dinamizó no siempre está registrado en el SEP
  const [dinamizador, setDinamizador] = useState('')
  const [creando, setCreando] = useState(false)
  const [eliminando, setEliminando] = useState<number | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [expandido, setExpandido] = useState<number | null>(null)

  async function cargar() {
    setLoading(true)
    try {
      const [r1, r2, r3, r4, r5] = await Promise.all([
        api.get<Participacion[]>(`/evaluadores/${evaluadorId}/participaciones`),
        api.get<{ id: number; nombre: string }[]>(`/evaluadores/catalogos/roles`),
        api.get<{ id: number; nombre: string }[]>(`/evaluadores/catalogos/procesos`),
        api.get<{ id: number; nombre: string }[]>(`/evaluadores/catalogos/areas`),
        // este endpoint viene paginado: devuelve { items, ... }, no el arreglo pelado
        api.get<{ items: Array<{ id: number; nombre: string; anio: number; periodo: string | null }> }>(
          `/evaluadores/convocatorias`, { params: { limit: 100 } }),
      ])
      setItems(r1.data ?? [])
      setRoles(r2.data ?? [])
      setProcesos(r3.data ?? [])
      setAreas(r4.data ?? [])
      setConvocatorias(r5.data?.items ?? [])
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudieron cargar las participaciones') })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { cargar() /* eslint-disable-next-line */ }, [])

  function limpiarForm() {
    setEditandoId(null)
    setAnio(new Date().getFullYear().toString())
    setPeriodo(''); setRolId(''); setModalidad(''); setProcId(''); setConvId(''); setAreaId('')
    setRevocado(false); setMesa(''); setEquipo(''); setDinamizador('')
  }

  function editar(p: Participacion) {
    setEditandoId(p.participacionId)
    setExpandido(p.participacionId)
    setAnio(String(p.anio))
    setPeriodo(p.periodo ?? '')
    setRolId(p.rolEvaluadorId != null ? String(p.rolEvaluadorId) : '')
    setModalidad(p.modalidadPart ?? '')
    setProcId(p.procesoId != null ? String(p.procesoId) : '')
    setConvId(p.convocatoriaId != null ? String(p.convocatoriaId) : '')
    setAreaId(p.areaId != null ? String(p.areaId) : '')
    setRevocado(Boolean(p.procesoRevocado))
    setMesa(p.mesa ?? '')
    setEquipo(p.equipoEvaluador ?? '')
    setDinamizador(p.dinamizadorNombre ?? '')
    setAgregar(true)
  }

  async function crear() {
    if (!anio.trim()) return setToast({ tipo: 'error', msg: 'Año requerido' })
    setCreando(true)
    const cuerpo = {
      anio: Number(anio),
      periodo: periodo || null,
      rolEvaluadorId: rolId ? Number(rolId) : null,
      modalidadPart: modalidad || null,
      procesoId: procId ? Number(procId) : null,
      convocatoriaId: convId ? Number(convId) : null,
      areaId: areaId ? Number(areaId) : null,
      procesoRevocado: revocado,
      mesa: mesa || null,
      equipoEvaluador: equipo || null,
      dinamizador: dinamizador.trim() || null,
    }
    try {
      if (editandoId) {
        await api.put(`/evaluadores/participaciones/${editandoId}`, cuerpo)
        setToast({ tipo: 'success', msg: 'Participación actualizada' })
      } else {
        await api.post(`/evaluadores/${evaluadorId}/participaciones`, cuerpo)
        setToast({ tipo: 'success', msg: 'Participación agregada' })
      }
      setAgregar(false)
      limpiarForm()
      await cargar()
      onCambio()
    } catch (err) {
      setToast({
        tipo: 'error',
        msg: manejarError(err, editandoId ? 'No se pudo actualizar' : 'No se pudo agregar'),
      })
    } finally {
      setCreando(false)
    }
  }

  async function eliminar(pid: number) {
    setEliminando(pid)
    try {
      await api.delete(`/evaluadores/participaciones/${pid}`)
      setToast({ tipo: 'success', msg: 'Eliminada' })
      await cargar()
      onCambio()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo eliminar') })
    } finally {
      setEliminando(null)
    }
  }

  const label = 'block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
  const input = 'w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40'

  // constante y no componente: uno anidado se remonta en cada tecla y pierde el foco
  const formulario = (
        <div className="px-5 py-4 bg-neutral-50/60 border-b border-neutral-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className={label}>Año *</label><input value={anio} onChange={e => setAnio(e.target.value)} className={input} /></div>
          <div><label className={label}>Periodo</label><input value={periodo} onChange={e => setPeriodo(e.target.value)} placeholder="1 / 2" className={input} /></div>
          <div>
            <label className={label}>Rol</label>
            <select value={rolId} onChange={e => setRolId(e.target.value)} className={input}>
              <option value="">—</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Modalidad</label>
            <select value={modalidad} onChange={e => setModalidad(e.target.value)} className={input}>
              <option value="">—</option>
              <option>PRESENCIAL</option>
              <option>PAT</option>
              <option>VIRTUAL</option>
            </select>
          </div>
          <div>
            <label className={label}>Proceso</label>
            <select value={procId} onChange={e => setProcId(e.target.value)} className={input}>
              <option value="">—</option>
              {procesos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={label}>Convocatoria *</label>
            <select
              value={convId}
              onChange={e => {
                setConvId(e.target.value)
                const c = convocatorias.find(x => String(x.id) === e.target.value)
                if (c) { setAnio(String(c.anio)); if (c.periodo) setPeriodo(c.periodo) }
              }}
              className={input}
            >
              <option value="">— Sin convocatoria —</option>
              {convocatorias.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.anio}{c.periodo ? `-${c.periodo}` : ''})
                </option>
              ))}
            </select>
            {convocatorias.length === 0 ? (
              <p className="mt-1 text-[11px] text-amber-700">
                Todavía no hay ninguna convocatoria del banco.{' '}
                <Link href="/panel/evaluadores/convocatorias/nueva" className="font-semibold underline">
                  Cree primero el ciclo del año
                </Link>{' '}
                y vuelva: de él salen la invitación, las notas de corte y el certificado.
              </p>
            ) : !convId && (
              <p className="mt-1 text-[11px] text-amber-700">
                Sin convocatoria el ciclo no muestra los documentos de la
                convocatoria, no entra en la retroalimentación y no se podrá certificar.
              </p>
            )}
          </div>
          <div>
            <label className={label}>Área</label>
            <select value={areaId} onChange={e => setAreaId(e.target.value)} className={input}>
              <option value="">—</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
              <input type="checkbox" checked={revocado} onChange={e => setRevocado(e.target.checked)} className="rounded" />
              Proceso revocado
            </label>
          </div>
          <div className="sm:col-span-2"><label className={label}>Mesa</label><input value={mesa} onChange={e => setMesa(e.target.value)} className={input} /></div>
          <div className="col-span-2 sm:col-span-2">
            <label className={label}>Dinamizó</label>
            <input
              value={dinamizador}
              onChange={e => setDinamizador(e.target.value)}
              maxLength={500}
              placeholder="Nombre de quien dinamizó la mesa"
              className={input}
            />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <label className={label}>Equipo evaluador</label>
            <input
              value={equipo}
              onChange={e => setEquipo(e.target.value)}
              maxLength={MAX_EQUIPO}
              placeholder="Nombres de quienes lo integran, separados por coma"
              className={input}
            />
            {equipo.length > MAX_EQUIPO * 0.8 && (
              <p className={`mt-1 text-[11px] ${
                equipo.length >= MAX_EQUIPO ? 'text-red-700' : 'text-neutral-500'
              }`}>
                {equipo.length} de {MAX_EQUIPO} caracteres
                {equipo.length >= MAX_EQUIPO && ' — llegó al límite'}
              </p>
            )}
          </div>
          <div className="col-span-2 sm:col-span-4 flex justify-end">
            <button onClick={crear} disabled={creando} className="inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90" style={{ backgroundColor: INSTITUTIONAL }}>
              {creando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {editandoId ? 'Guardar cambios' : 'Guardar participación'}
            </button>
          </div>
        </div>
  )

  return (
    <Section titulo={`Historial de participaciones (${items.length})`} accion={
      <button onClick={() => setAgregar(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition hover:opacity-90" style={{ backgroundColor: PRIMARY }}>
        <Settings2 size={12} />
        {agregar ? 'Cerrar' : 'Agregar'}
      </button>
    }>
      {agregar && !editandoId && formulario}

      {loading ? (
        <p className="px-5 py-6 text-sm text-neutral-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Cargando...</p>
      ) : items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-neutral-400">Sin participaciones registradas</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map(p => {
            const abierto = expandido === p.participacionId
            const corrigiendo = editandoId === p.participacionId
            // el listado trae solo ids: los nombres salen de los catálogos ya cargados
            const conv = convocatorias.find(c => c.id === p.convocatoriaId)
            const area = areas.find(a => a.id === p.areaId)
            const detalle: Array<[string, string | null]> = [
              ['Convocatoria', conv ? conv.nombre : null],
              ['Proceso', p.procesoNombre],
              ['Área', area ? area.nombre : null],
              ['Modalidad', p.modalidadPart],
              ['Mesa', p.mesa],
              ['Equipo evaluador', p.equipoEvaluador],
              ['Dinamizó', p.dinamizadorNombre],
              ['Estado', p.estadoNombre ?? null],
            ]
            return (
              <li key={p.participacionId}>
                <div className="flex items-center gap-3 px-5 py-3">
                  <button
                    onClick={() => setExpandido(v => (v === p.participacionId ? null : p.participacionId))}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-expanded={abierto}
                  >
                    <ChevronRight
                      size={16}
                      className={`shrink-0 text-neutral-400 transition-transform ${abierto ? 'rotate-90' : ''}`}
                    />
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#00304D]/5 font-bold text-[#00304D]">
                      {p.anio}{p.periodo ? `-${p.periodo}` : ''}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-neutral-800">{p.rolNombre || '— Sin rol —'}</span>
                        {p.procesoNombre && (
                          <span className="rounded bg-[#00304D]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#00304D]">
                            {p.procesoNombre}{p.procesoRevocado ? ' · REVOCADO' : ''}
                          </span>
                        )}
                        {p.modalidadPart && (
                          <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[11px] font-semibold text-cyan-700">
                            {p.modalidadPart}
                          </span>
                        )}
                      </span>
                      {!abierto && (
                        <span className="mt-0.5 block truncate text-[11px] text-neutral-500">
                          {[p.mesa && `Mesa: ${p.mesa}`, p.equipoEvaluador && `Equipo: ${p.equipoEvaluador}`]
                            .filter(Boolean).join(' · ') || '—'}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    onClick={() => eliminar(p.participacionId)}
                    disabled={eliminando === p.participacionId}
                    title="Eliminar la participación y todo lo del año"
                    className="shrink-0 rounded-lg p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    {eliminando === p.participacionId
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Trash2 size={14} />}
                  </button>
                </div>

                {abierto && !corrigiendo && (
                  <div className="border-t border-neutral-100 bg-neutral-50/50 px-5 py-4 pl-14">
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                      {detalle.map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{k}</dt>
                          <dd className="text-[13px] text-neutral-800">{v || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                    {p.motivoNoParticipa && (
                      <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-800">
                        <strong>Motivo:</strong> {p.motivoNoParticipa}
                      </p>
                    )}
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => editar(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                      >
                        <Pencil size={13} /> Editar
                      </button>
                    </div>
                  </div>
                )}

                {corrigiendo && (
                  <div className="border-t border-neutral-100">
                    {formulario}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

// una sola hoja de vida por evaluador
interface HV {
  estudioId: number
  archivoNombre: string | null
  tieneArchivo: boolean
  fechaCargue: string
}

function SeccionHV({ evaluadorId, setToast }: { evaluadorId: number; setToast: SetToast }) {
  const [hv, setHv] = useState<HV | null>(null)
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  async function cargar() {
    setLoading(true)
    try {
      const r = await api.get<HV | null>(`/evaluadores/${evaluadorId}/hoja-vida`)
      setHv(r.data ?? null)
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo cargar la hoja de vida') })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { cargar() /* eslint-disable-next-line */ }, [])

  async function subir(file: File) {
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      await api.post(`/evaluadores/${evaluadorId}/hoja-vida`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setToast({ tipo: 'success', msg: 'Hoja de vida cargada' })
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo cargar la HV') })
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function eliminar() {
    setEliminando(true)
    try {
      await api.delete(`/evaluadores/${evaluadorId}/hoja-vida`)
      setToast({ tipo: 'success', msg: 'Hoja de vida eliminada' })
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo eliminar') })
    } finally {
      setEliminando(false)
    }
  }

  const url = hv?.tieneArchivo ? `/evaluadores/estudios/${hv.estudioId}/archivo` : null

  return (
    <Section titulo="Hoja de vida">
      <div className="px-5 py-5 flex flex-col sm:flex-row gap-5 items-start">
        <div className="w-20 h-24 rounded-xl bg-[#00304D]/5 border border-[#00304D]/10 flex items-center justify-center shrink-0">
          <FileText size={28} className="text-[#00304D]" />
        </div>
        <div className="flex-1 min-w-0">
          {loading ? (
            <p className="text-sm text-neutral-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Cargando...</p>
          ) : hv ? (
            <>
              <p className="text-sm font-bold text-neutral-800 truncate">{hv.archivoNombre ?? 'hoja-de-vida.pdf'}</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Cargada el {new Date(hv.fechaCargue).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-neutral-700">Sin hoja de vida cargada</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">Sube un único PDF con la hoja de vida del evaluador (máx 8 MB).</p>
            </>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) subir(f) }}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {url && (
              <>
                <button
                  onClick={() => abrirArchivo(url).catch(() => {})}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-[#00304D]/10 text-neutral-700 hover:text-[#00304D] text-xs font-semibold rounded-lg transition"
                >
                  <Eye size={13} />
                  Ver
                </button>
                <button
                  onClick={() => descargarArchivo(url, hv?.archivoNombre ?? 'hoja-de-vida.pdf').catch(() => {})}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-[#39a900]/10 text-neutral-700 hover:text-[#39a900] text-xs font-semibold rounded-lg transition"
                >
                  <Download size={13} />
                  Descargar
                </button>
              </>
            )}
            <button
              onClick={() => inputRef.current?.click()}
              disabled={subiendo}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90"
              style={{ backgroundColor: INSTITUTIONAL }}
            >
              {subiendo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {hv ? 'Reemplazar' : 'Cargar HV'}
            </button>
            {hv && (
              <button
                onClick={eliminar}
                disabled={eliminando}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-red-100 text-neutral-700 hover:text-red-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition"
              >
                {eliminando ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>
    </Section>
  )
}

// estudios, experiencia y tic comparten ListadoConArchivos
interface Estudio { estudioId: number; tipoEstudio: string | null; titulo: string | null; institucion: string | null; fechaGrado: string | null; archivoNombre: string | null; tieneArchivo: boolean }
interface Experiencia { experienciaId: number; cargo: string | null; entidad: string | null; fechaInicio: string | null; fechaFin: string | null; archivoNombre: string | null; tieneArchivo: boolean }
interface Tic { ticId: number; tipoEvento: string | null; nombre: string; horas: number | null; fechaFin: string | null; archivoNombre: string | null; tieneArchivo: boolean }

function SeccionEstudios({ evaluadorId, setToast }: { evaluadorId: number; setToast: SetToast }) {
  const [items, setItems] = useState<Estudio[]>([])
  const [tipos, setTipos] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [agregar, setAgregar] = useState(false)

  const [tipoId, setTipoId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [institucion, setInstitucion] = useState('')
  const [fechaGrado, setFechaGrado] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [creando, setCreando] = useState(false)
  const [eliminando, setEliminando] = useState<number | null>(null)

  async function cargar() {
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        api.get<Estudio[]>(`/evaluadores/${evaluadorId}/estudios`),
        api.get<Cat[]>(`/evaluadores/catalogos/tipos-estudio`, { params: { excluirHv: 1 } }),
      ])
      setItems(r1.data ?? [])
      setTipos(r2.data ?? [])
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudieron cargar los estudios') })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { cargar() /* eslint-disable-next-line */ }, [])

  async function crear() {
    if (!tipoId) return setToast({ tipo: 'error', msg: 'Selecciona el tipo de estudio' })
    setCreando(true)
    try {
      const fd = new FormData()
      fd.append('tipoEstudioId', tipoId)
      if (titulo) fd.append('titulo', titulo)
      if (institucion) fd.append('institucion', institucion)
      if (fechaGrado) fd.append('fechaGrado', fechaGrado)
      if (file) fd.append('archivo', file)
      await api.post(`/evaluadores/${evaluadorId}/estudios`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setToast({ tipo: 'success', msg: 'Estudio agregado' })
      setAgregar(false)
      setTipoId(''); setTitulo(''); setInstitucion(''); setFechaGrado(''); setFile(null)
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo agregar') })
    } finally {
      setCreando(false)
    }
  }

  async function eliminar(sid: number) {
    setEliminando(sid)
    try {
      await api.delete(`/evaluadores/estudios/${sid}`)
      setToast({ tipo: 'success', msg: 'Eliminado' })
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo eliminar') })
    } finally {
      setEliminando(null)
    }
  }

  return (
    <ListadoConArchivos
      titulo={`Estudios y certificados (${items.length})`}
      onAgregarToggle={() => setAgregar(v => !v)}
      agregarAbierto={agregar}
      formulario={
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Tipo *</label>
            <select value={tipoId} onChange={e => setTipoId(e.target.value)} className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40">
              <option value="">—</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Fecha de grado</label>
            <input type="date" value={fechaGrado} onChange={e => setFechaGrado(e.target.value)} className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Título</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Institución</label>
            <input value={institucion} onChange={e => setInstitucion(e.target.value)} className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Soporte (PDF, máx 8 MB)</label>
            <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
          </div>
        </div>
      }
      onCrear={crear}
      creando={creando}
      loading={loading}
      vacio="Sin estudios registrados"
      filas={items.map(it => ({
        id: it.estudioId,
        titulo: it.titulo || '— Sin título —',
        sub: [it.tipoEstudio, it.institucion, it.fechaGrado ? fmtFecha(it.fechaGrado) : null].filter(Boolean).join(' · ') || '—',
        archivoUrl: it.tieneArchivo ? `/evaluadores/estudios/${it.estudioId}/archivo` : null,
        archivoNombre: it.archivoNombre ?? `estudio-${it.estudioId}.pdf`,
        eliminando: eliminando === it.estudioId,
        onEliminar: () => eliminar(it.estudioId),
      }))}
    />
  )
}

function SeccionExperiencia({ evaluadorId, setToast }: { evaluadorId: number; setToast: SetToast }) {
  const [items, setItems] = useState<Experiencia[]>([])
  const [loading, setLoading] = useState(true)
  const [agregar, setAgregar] = useState(false)
  const [cargo, setCargo] = useState('')
  const [entidad, setEntidad] = useState('')
  const [fIni, setFIni] = useState('')
  const [fFin, setFFin] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [creando, setCreando] = useState(false)
  const [eliminando, setEliminando] = useState<number | null>(null)

  async function cargar() {
    setLoading(true)
    try {
      const r = await api.get<Experiencia[]>(`/evaluadores/${evaluadorId}/experiencia`)
      setItems(r.data ?? [])
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'Error cargando experiencia') })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { cargar() /* eslint-disable-next-line */ }, [])

  async function crear() {
    if (!cargo.trim() || !entidad.trim()) return setToast({ tipo: 'error', msg: 'Cargo y entidad son obligatorios' })
    setCreando(true)
    try {
      const fd = new FormData()
      fd.append('cargo', cargo); fd.append('entidad', entidad)
      if (fIni) fd.append('fechaInicio', fIni)
      if (fFin) fd.append('fechaFin', fFin)
      if (file) fd.append('archivo', file)
      await api.post(`/evaluadores/${evaluadorId}/experiencia`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setToast({ tipo: 'success', msg: 'Experiencia agregada' })
      setAgregar(false)
      setCargo(''); setEntidad(''); setFIni(''); setFFin(''); setFile(null)
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo agregar') })
    } finally {
      setCreando(false)
    }
  }

  async function eliminar(eid: number) {
    setEliminando(eid)
    try {
      await api.delete(`/evaluadores/experiencia/${eid}`)
      setToast({ tipo: 'success', msg: 'Eliminada' })
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo eliminar') })
    } finally {
      setEliminando(null)
    }
  }

  const fmt = (d: string | null) => d ? fmtMesAnio(d) : null

  return (
    <ListadoConArchivos
      titulo={`Experiencia laboral (${items.length})`}
      onAgregarToggle={() => setAgregar(v => !v)}
      agregarAbierto={agregar}
      formulario={
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Cargo *</label><input value={cargo} onChange={e => setCargo(e.target.value)} className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40" /></div>
          <div><label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Entidad *</label><input value={entidad} onChange={e => setEntidad(e.target.value)} className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40" /></div>
          <div><label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Inicio</label><input type="date" value={fIni} onChange={e => setFIni(e.target.value)} className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40" /></div>
          <div><label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Fin (vacío = vigente)</label><input type="date" value={fFin} onChange={e => setFFin(e.target.value)} className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40" /></div>
          <div className="sm:col-span-2"><label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Certificado (PDF, máx 8 MB)</label><input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-xs" /></div>
        </div>
      }
      onCrear={crear}
      creando={creando}
      loading={loading}
      vacio="Sin experiencia registrada"
      filas={items.map(it => ({
        id: it.experienciaId,
        titulo: it.cargo || '— Sin cargo —',
        sub: [it.entidad, [fmt(it.fechaInicio), it.fechaFin ? fmt(it.fechaFin) : 'Vigente'].filter(Boolean).join(' → ')].filter(Boolean).join(' · ') || '—',
        archivoUrl: it.tieneArchivo ? `/evaluadores/experiencia/${it.experienciaId}/archivo` : null,
        archivoNombre: it.archivoNombre ?? `experiencia-${it.experienciaId}.pdf`,
        eliminando: eliminando === it.experienciaId,
        onEliminar: () => eliminar(it.experienciaId),
      }))}
    />
  )
}

function SeccionTic({ evaluadorId, setToast }: { evaluadorId: number; setToast: SetToast }) {
  const [items, setItems] = useState<Tic[]>([])
  const [loading, setLoading] = useState(true)
  const [agregar, setAgregar] = useState(false)
  const [nombre, setNombre] = useState('')
  const [horas, setHoras] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [creando, setCreando] = useState(false)
  const [eliminando, setEliminando] = useState<number | null>(null)

  async function cargar() {
    setLoading(true)
    try {
      const r = await api.get<Tic[]>(`/evaluadores/${evaluadorId}/tic`)
      setItems(r.data ?? [])
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'Error cargando TIC') })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { cargar() /* eslint-disable-next-line */ }, [])

  async function crear() {
    if (!nombre.trim()) return setToast({ tipo: 'error', msg: 'Nombre obligatorio' })
    setCreando(true)
    try {
      const fd = new FormData()
      fd.append('nombre', nombre)
      if (horas) fd.append('horas', horas)
      if (fechaFin) fd.append('fechaFin', fechaFin)
      if (file) fd.append('archivo', file)
      await api.post(`/evaluadores/${evaluadorId}/tic`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setToast({ tipo: 'success', msg: 'TIC agregada' })
      setAgregar(false)
      setNombre(''); setHoras(''); setFechaFin(''); setFile(null)
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo agregar') })
    } finally {
      setCreando(false)
    }
  }

  async function eliminar(tid: number) {
    setEliminando(tid)
    try {
      await api.delete(`/evaluadores/tic/${tid}`)
      setToast({ tipo: 'success', msg: 'Eliminada' })
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo eliminar') })
    } finally {
      setEliminando(null)
    }
  }

  return (
    <ListadoConArchivos
      titulo={`Formación TIC complementaria (${items.length})`}
      onAgregarToggle={() => setAgregar(v => !v)}
      agregarAbierto={agregar}
      formulario={
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Nombre *</label><input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40" /></div>
          <div><label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Horas</label><input type="number" value={horas} onChange={e => setHoras(e.target.value)} className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40" /></div>
          <div><label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Fecha de finalización</label><input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40" /></div>
          <div className="sm:col-span-2"><label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Soporte (PDF, máx 8 MB)</label><input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-xs" /></div>
        </div>
      }
      onCrear={crear}
      creando={creando}
      loading={loading}
      vacio="Sin certificaciones TIC"
      filas={items.map(it => ({
        id: it.ticId,
        titulo: it.nombre,
        sub: [it.tipoEvento, it.horas ? `${it.horas}h` : null, it.fechaFin ? fmtFecha(it.fechaFin) : null].filter(Boolean).join(' · ') || '—',
        archivoUrl: it.tieneArchivo ? `/evaluadores/tic/${it.ticId}/archivo` : null,
        archivoNombre: it.archivoNombre ?? `tic-${it.ticId}.pdf`,
        eliminando: eliminando === it.ticId,
        onEliminar: () => eliminar(it.ticId),
      }))}
    />
  )
}

interface FilaListado {
  id: number
  titulo: string
  sub: string
  /** Path relativo al backend, ej: `/evaluadores/estudios/123/archivo` */
  archivoUrl: string | null
  archivoNombre: string | null
  eliminando: boolean
  onEliminar: () => void
}

function ListadoConArchivos({
  titulo, onAgregarToggle, agregarAbierto, formulario, onCrear, creando, loading, vacio, filas,
}: {
  titulo: string; onAgregarToggle: () => void; agregarAbierto: boolean
  formulario: React.ReactNode; onCrear: () => void; creando: boolean
  loading: boolean; vacio: string; filas: FilaListado[]
}) {
  return (
    <Section titulo={titulo} accion={
      <button onClick={onAgregarToggle} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition hover:opacity-90" style={{ backgroundColor: PRIMARY }}>
        <Settings2 size={12} />
        {agregarAbierto ? 'Cerrar' : 'Agregar'}
      </button>
    }>
      {agregarAbierto && (
        <div className="px-5 py-4 bg-neutral-50/60 border-b border-neutral-100">
          {formulario}
          <div className="flex justify-end mt-3">
            <button onClick={onCrear} disabled={creando} className="inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90" style={{ backgroundColor: INSTITUTIONAL }}>
              {creando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Guardar
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <p className="px-5 py-6 text-sm text-neutral-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Cargando...</p>
      ) : filas.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-neutral-400">{vacio}</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {filas.map(f => (
            <li key={f.id} className="px-5 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00304D]/5 text-[#00304D] flex items-center justify-center shrink-0">
                <FileText size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-neutral-800 truncate">{f.titulo}</p>
                <p className="text-[11px] text-neutral-500 truncate">{f.sub}</p>
              </div>
              {f.archivoUrl && (
                <>
                  <button
                    onClick={() => abrirArchivo(f.archivoUrl!).catch(() => {})}
                    title="Ver en nueva pestaña"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-100 hover:bg-[#00304D]/10 text-neutral-700 hover:text-[#00304D] text-xs font-semibold rounded-lg transition"
                  >
                    <Eye size={12} />
                    Ver
                  </button>
                  <button
                    onClick={() => descargarArchivo(f.archivoUrl!, f.archivoNombre ?? 'archivo.pdf').catch(() => {})}
                    title="Descargar"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-100 hover:bg-[#39a900]/10 text-neutral-700 hover:text-[#39a900] text-xs font-semibold rounded-lg transition"
                  >
                    <Download size={12} />
                  </button>
                </>
              )}
              <button onClick={f.onEliminar} disabled={f.eliminando} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50">
                {f.eliminando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

interface Prueba {
  pruebaId: number
  /** null = prueba suelta, sin ciclo */
  participacionId: number | null
  anio: number
  periodo: string | null
  fechaPresentacion: string | null
  horario: string | null
  intentos: number | null
  puntajeMayor: number | null
  pruebaNumero: number | null
  efectividad: number | null
  correctas: number | null
  incorrectas: number | null
  totalTiempo: string | null
  observacion: string | null
}

// pasarse de aquí revienta la columna NUMBER(5,2) con un 500 sin detalle
const MAX_PUNTAJE = 100

function SeccionPruebas({ evaluadorId, setToast, onCambio }: { evaluadorId: number; setToast: SetToast; onCambio: () => void }) {
  const [items, setItems] = useState<Prueba[]>([])
  // puede haber dos ciclos en el mismo año; el backend no adivina a cuál va la prueba
  const [ciclos, setCiclos] = useState<Participacion[]>([])
  const [participacionId, setParticipacionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [agregar, setAgregar] = useState(false)
  const [anio, setAnio] = useState(new Date().getFullYear().toString())
  const [periodo, setPeriodo] = useState('')
  const [fecha, setFecha] = useState('')
  const [puntaje, setPuntaje] = useState('')
  const [intentos, setIntentos] = useState('')
  // va a la columna EFECTIVIDAD
  const [porcentaje, setPorcentaje] = useState('')
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [creando, setCreando] = useState(false)
  const [eliminando, setEliminando] = useState<number | null>(null)

  async function cargar() {
    setLoading(true)
    try {
      const [rp, rc] = await Promise.all([
        api.get<Prueba[]>(`/evaluadores/${evaluadorId}/pruebas`),
        api.get<Participacion[]>(`/evaluadores/${evaluadorId}/participaciones`),
      ])
      setItems(rp.data ?? [])
      setCiclos(rc.data ?? [])
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'Error cargando pruebas') })
    } finally {
      setLoading(false)
    }
  }

  function elegirCiclo(valor: string) {
    setParticipacionId(valor)
    const c = ciclos.find(x => String(x.participacionId) === valor)
    if (c) { setAnio(String(c.anio)); setPeriodo(c.periodo ?? '') }
  }
  useEffect(() => { cargar() /* eslint-disable-next-line */ }, [])

  async function crear() {
    if (!anio.trim()) return setToast({ tipo: 'error', msg: 'Año requerido' })
    if (puntaje && (Number(puntaje) < 0 || Number(puntaje) > MAX_PUNTAJE)) {
      return setToast({ tipo: 'error', msg: `El puntaje va de 0 a ${MAX_PUNTAJE}` })
    }
    setCreando(true)
    try {
      const datos = {
        anio: Number(anio),
        periodo: periodo || null,
        participacionId: participacionId ? Number(participacionId) : null,
        fechaPresentacion: fecha || null,
        puntajeMayor: puntaje ? Number(puntaje) : null,
        efectividad: porcentaje ? Number(porcentaje) : null,
        intentos: intentos ? Number(intentos) : null,
      }
      if (editandoId != null) await api.put(`/evaluadores/pruebas/${editandoId}`, datos)
      else await api.post(`/evaluadores/${evaluadorId}/pruebas`, datos)
      setToast({ tipo: 'success', msg: editandoId != null ? 'Prueba actualizada' : 'Prueba registrada' })
      setAgregar(false)
      limpiar()
      await cargar()
      onCambio()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo agregar') })
    } finally {
      setCreando(false)
    }
  }

  function editar(p: Prueba) {
    setEditandoId(p.pruebaId)
    setParticipacionId(p.participacionId != null ? String(p.participacionId) : '')
    setAnio(String(p.anio))
    setPeriodo(p.periodo ?? '')
    setFecha(p.fechaPresentacion ? String(p.fechaPresentacion).slice(0, 10) : '')
    setPuntaje(p.puntajeMayor != null ? String(p.puntajeMayor) : '')
    setPorcentaje(p.efectividad != null ? String(p.efectividad) : '')
    setIntentos(p.intentos != null ? String(p.intentos) : '')
    setAgregar(true)
  }

  function limpiar() {
    setEditandoId(null)
    setParticipacionId('')
    setPeriodo(''); setFecha(''); setPuntaje(''); setIntentos(''); setPorcentaje('')
  }

  async function eliminar(pid: number) {
    setEliminando(pid)
    try {
      await api.delete(`/evaluadores/pruebas/${pid}`)
      setToast({ tipo: 'success', msg: 'Eliminada' })
      await cargar()
      onCambio()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo eliminar') })
    } finally {
      setEliminando(null)
    }
  }

  const label = 'block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
  const input = 'w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40'

  // con un solo ciclo ese año el backend lo ata solo; con dos o más exige elegir
  const mismosAnio = ciclos.filter(c => String(c.anio) === anio.trim()).length
  const ambiguo = mismosAnio > 1 && !participacionId

  return (
    <Section titulo={`Pruebas de conocimiento (${items.length})`} accion={
      <button onClick={() => setAgregar(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition hover:opacity-90" style={{ backgroundColor: PRIMARY }}>
        <Settings2 size={12} />
        {agregar ? 'Cerrar' : 'Agregar'}
      </button>
    }>
      {agregar && (
        <div className="px-5 py-4 bg-neutral-50/60 border-b border-neutral-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ciclos.length > 0 && (
            <div className="col-span-2 sm:col-span-4">
              <label className={label}>Ciclo al que pertenece {ambiguo && '*'}</label>
              <select value={participacionId} onChange={e => elegirCiclo(e.target.value)} className={input}>
                <option value="">— Sin ciclo (prueba suelta) —</option>
                {ciclos.map(c => (
                  <option key={c.participacionId} value={String(c.participacionId)}>
                    {c.anio}{c.periodo ? `-${c.periodo}` : ''} · {c.rolNombre ?? 'Sin rol'}
                    {c.procesoNombre ? ` · ${c.procesoNombre}` : ''}
                  </option>
                ))}
              </select>
              {ambiguo && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Tiene {mismosAnio} ciclos en {anio}: escoja a cuál pertenece esta prueba, o el
                  sistema no puede saber qué hito encender.
                </p>
              )}
            </div>
          )}
          <div><label className={label}>Año *</label><input value={anio} onChange={e => setAnio(e.target.value)} className={input} /></div>
          <div><label className={label}>Periodo</label><input value={periodo} onChange={e => setPeriodo(e.target.value)} className={input} /></div>
          <div><label className={label}>Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={input} /></div>
          <div>
            <label className={label}>Puntaje</label>
            <input
              type="number" step="0.01" min={0} max={MAX_PUNTAJE}
              value={puntaje}
              onChange={e => setPuntaje(e.target.value)}
              className={input}
            />
            {puntaje && Number(puntaje) > MAX_PUNTAJE && (
              <p className="mt-1 text-[11px] text-red-700">
                El puntaje va de 0 a {MAX_PUNTAJE}. ¿Sobra algún dígito?
              </p>
            )}
          </div>
          <div>
            <label className={label}>Porcentaje del puntaje</label>
            <div className="relative">
              <input
                type="number" step="0.01" min={0} max={100}
                value={porcentaje}
                onChange={e => setPorcentaje(e.target.value)}
                className={`${input} pr-7`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400">%</span>
            </div>
            {porcentaje && (Number(porcentaje) < 0 || Number(porcentaje) > 100) && (
              <p className="mt-1 text-[11px] text-red-700">El porcentaje va de 0 a 100.</p>
            )}
          </div>
          <div><label className={label}>Intentos</label><input type="number" value={intentos} onChange={e => setIntentos(e.target.value)} className={input} /></div>
          <div className="col-span-2 sm:col-span-3 flex items-end justify-end">
            <button onClick={crear} disabled={creando} className="inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90" style={{ backgroundColor: INSTITUTIONAL }}>
              {creando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {editandoId != null ? 'Guardar cambios' : 'Guardar prueba'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="px-5 py-6 text-sm text-neutral-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Cargando...</p>
      ) : items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-neutral-400">Sin pruebas registradas</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map(p => (
            <li key={p.pruebaId} className="px-5 py-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#00304D]/5 text-[#00304D] flex items-center justify-center shrink-0 font-bold">
                {p.anio}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-neutral-800">
                    {p.puntajeMayor != null ? `Puntaje ${p.puntajeMayor}` : '— Sin puntaje —'}
                  </span>
                  {p.efectividad != null && (
                    <span className="rounded-full bg-[#00304D]/5 px-2 py-0.5 text-[11px] font-semibold text-[#00304D]">
                      {p.efectividad}%
                    </span>
                  )}
                  {p.fechaPresentacion && (
                    <span className="text-[11px] text-neutral-500">{fmtFecha(p.fechaPresentacion)}</span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {[p.periodo && `Periodo ${p.periodo}`, p.intentos != null && `${p.intentos} intentos`, p.totalTiempo].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <button
                onClick={() => editar(p)}
                title="Corregir esta prueba"
                className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
              >
                <Pencil size={14} />
              </button>
              <button onClick={() => eliminar(p.pruebaId)} disabled={eliminando === p.pruebaId} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50">
                {eliminando === p.pruebaId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

interface DocumentoItem {
  documentoId: number
  evaluadorId: number
  tipoDocumentoEvalId: number
  tipoCodigo: string
  tipoNombre: string
  descripcion: string | null
  anioReferencia: number | null
  archivoNombre: string | null
  mime: string | null
  fechaCargue: string
}

interface TipoDocEvalCat {
  id: number
  codigo: string
  nombre: string
  admiteMultiple?: boolean
  /** del catálogo: el correo admite .msg/.eml/.html; el resto solo pdf */
  extensiones?: string[]
  /** el documento es del ciclo, no del evaluador */
  esDelAnio?: boolean
  orden?: number
  activo?: boolean
}

/** fallback si el catálogo no trae extensiones */
const EXT_POR_DEFECTO = ['pdf']

function formatosDe(tipo: TipoDocEvalCat | undefined) {
  const exts = tipo?.extensiones?.length ? tipo.extensiones : EXT_POR_DEFECTO
  return {
    accept: exts.map(e => '.' + e).join(','),
    etiqueta: exts.map(e => e.toUpperCase()).join(', '),
  }
}

// Tailwind JIT solo compila clases literales: por eso el hover va escrito aquí
const DOC_CHIP_COLORS: Record<string, { bg: string; text: string; border: string; hoverBg: string }> = {
  AUTORIZACION:             { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   hoverBg: 'hover:bg-blue-100'   },
  CONFIDENCIALIDAD:         { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', hoverBg: 'hover:bg-purple-100' },
  EXPERIENCIA_PROFESIONAL:  { bg: 'bg-cyan-50',   text: 'text-cyan-700',   border: 'border-cyan-200',   hoverBg: 'hover:bg-cyan-100'   },
  EXPERIENCIA_PROYECTOS:    { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200',   hoverBg: 'hover:bg-teal-100'   },
  CERTIFICADO_PARTICIPACION:{ bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  hoverBg: 'hover:bg-amber-100'  },
}
const DOC_CHIP_FALLBACK = { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200', hoverBg: 'hover:bg-neutral-200' }

function chipColor(codigo: string) {
  return DOC_CHIP_COLORS[codigo] ?? DOC_CHIP_FALLBACK
}

function SeccionDocumentos({ evaluadorId, setToast }: { evaluadorId: number; setToast: SetToast }) {
  const [items, setItems] = useState<DocumentoItem[]>([])
  const [tipos, setTipos] = useState<TipoDocEvalCat[]>([])
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<number | null>(null)
  const [formAbierto, setFormAbierto] = useState(false)
  const [filtroCodigo, setFiltroCodigo] = useState<string>('__TODOS__')

  // form state
  const [tipoSel, setTipoSel] = useState<string>('')
  const [descripcion, setDescripcion] = useState('')
  const [anio, setAnio] = useState<string>(new Date().getFullYear().toString())
  const [archivo, setArchivo] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function cargar() {
    setLoading(true)
    try {
      const [rDocs, rTipos] = await Promise.all([
        api.get<DocumentoItem[]>(`/evaluadores/${evaluadorId}/documentos`),
        api.get<TipoDocEvalCat[]>(`/evaluadores/catalogos/tipos-documento-evaluador`, { params: { soloActivos: true } }),
      ])
      setItems((rDocs.data ?? []).filter(d => d.tipoCodigo !== 'CEDULA'))
      setTipos((rTipos.data ?? []).filter(t => t.codigo !== 'CEDULA'))
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudieron cargar los documentos') })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { cargar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [evaluadorId])

  const tipoSeleccionado = tipos.find(t => String(t.id) === tipoSel)
  const requiereAnio = tipoSeleccionado?.codigo === 'CERTIFICADO_PARTICIPACION'
    || tipoSeleccionado?.codigo === 'EXPERIENCIA_PROYECTOS'
  const maxAnio = new Date().getFullYear() + 1

  function resetForm() {
    setTipoSel('')
    setDescripcion('')
    setAnio(new Date().getFullYear().toString())
    setArchivo(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function cerrarForm() {
    setFormAbierto(false)
    resetForm()
  }

  // abre el formulario con el tipo del chip que esté puesto
  function abrirForm() {
    const delChip = tipos.find(t => t.codigo === filtroCodigo && !t.esDelAnio)
    if (delChip) setTipoSel(String(delChip.id))
    setFormAbierto(true)
  }

  const chipEsDelAnio = tipos.some(t => t.codigo === filtroCodigo && t.esDelAnio)

  async function subir() {
    if (!tipoSel) {
      setToast({ tipo: 'error', msg: 'Selecciona el tipo de documento' })
      return
    }
    if (!archivo) {
      setToast({ tipo: 'error', msg: 'Adjunta un archivo PDF' })
      return
    }
    if (archivo.size > 8 * 1024 * 1024) {
      setToast({ tipo: 'error', msg: 'El archivo supera los 8 MB' })
      return
    }
    if (requiereAnio) {
      const n = Number(anio)
      if (!Number.isFinite(n) || n < 2000 || n > maxAnio) {
        setToast({ tipo: 'error', msg: `Año inválido (2000 - ${maxAnio})` })
        return
      }
    }
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      fd.append('tipoDocumentoEvalId', tipoSel)
      if (descripcion.trim()) fd.append('descripcion', descripcion.trim().slice(0, 300))
      if (requiereAnio) fd.append('anioReferencia', String(Number(anio)))
      await api.post(`/evaluadores/${evaluadorId}/documentos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setToast({ tipo: 'success', msg: 'Documento subido' })
      cerrarForm()
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo subir el documento') })
    } finally {
      setSubiendo(false)
    }
  }

  async function eliminar(docId: number) {
    setEliminandoId(docId)
    try {
      await api.delete(`/evaluadores/documentos/${docId}`)
      setToast({ tipo: 'success', msg: 'Documento eliminado' })
      setConfirmDelId(null)
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo eliminar el documento') })
    } finally {
      setEliminandoId(null)
    }
  }

  const label = 'block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
  const input = 'w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40'

  const conteoPorTipo: Record<string, number> = {}
  items.forEach(d => { conteoPorTipo[d.tipoCodigo] = (conteoPorTipo[d.tipoCodigo] ?? 0) + 1 })

  const itemsFiltrados = filtroCodigo === '__TODOS__'
    ? items
    : items.filter(d => d.tipoCodigo === filtroCodigo)

  const docAEliminar = confirmDelId != null ? items.find(d => d.documentoId === confirmDelId) : null

  return (
    <Section
      titulo={`Documentos personales (${items.length})`}
      accion={
        <button
          onClick={() => { if (formAbierto) cerrarForm(); else abrirForm() }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition hover:opacity-90"
          style={{ backgroundColor: PRIMARY }}
        >
          <Upload size={12} />
          {formAbierto ? 'Cerrar' : '+ Agregar'}
        </button>
      }
    >
      {/* Chips de filtro */}
      <div className="px-5 py-3 border-b border-neutral-100 flex flex-wrap gap-1.5 bg-neutral-50/40">
        <button
          onClick={() => setFiltroCodigo('__TODOS__')}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition border ${
            filtroCodigo === '__TODOS__'
              ? 'text-white border-transparent'
              : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
          }`}
          style={filtroCodigo === '__TODOS__' ? { backgroundColor: PRIMARY } : undefined}
        >
          Todos
          <span className={`px-1.5 py-px rounded-full text-[10px] ${filtroCodigo === '__TODOS__' ? 'bg-white/25' : 'bg-neutral-100'}`}>
            {items.length}
          </span>
        </button>
        {tipos.map(t => {
          const activo = filtroCodigo === t.codigo
          const c = chipColor(t.codigo)
          return (
            <button
              key={t.id}
              onClick={() => setFiltroCodigo(t.codigo)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition border ${
                activo
                  ? 'text-white border-transparent'
                  : `bg-white text-neutral-600 border-neutral-200 ${c.hoverBg}`
              }`}
              style={activo ? { backgroundColor: PRIMARY } : undefined}
              title={t.nombre}
            >
              {t.nombre}
              {t.esDelAnio && (
                <span className={`text-[9px] font-bold uppercase tracking-wide ${activo ? 'text-white/70' : 'text-neutral-400'}`}>
                  del año
                </span>
              )}
              <span className={`px-1.5 py-px rounded-full text-[10px] ${activo ? 'bg-white/25' : 'bg-neutral-100'}`}>
                {conteoPorTipo[t.codigo] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      {/* Formulario colapsable */}
      {formAbierto && chipEsDelAnio && (
        <div className="px-5 py-4 bg-amber-50/70 border-b border-amber-100">
          <p className="text-[12px] font-semibold text-amber-900">
            Ese documento se carga dentro del año, no aquí.
          </p>
          <p className="mt-1 text-[11px] text-amber-800">
            El correo de autorización, el acuerdo de confidencialidad y el certificado de
            participación pertenecen a un ciclo concreto, así que se cargan dentro de su año.
          </p>
          <ol className="mt-2 ml-4 list-decimal space-y-0.5 text-[11px] text-amber-800">
            <li>Entra a la pestaña <strong>Trayectoria</strong>.</li>
            <li>
              En <strong>Línea de tiempo</strong>, a la izquierda, pulsa el año que quieras —
              2024, 2025, el que sea.
            </li>
            <li>
              Abajo, en <strong>Documentos</strong>, usa <strong>Registrar</strong> para el
              correo de autorización de ese año, o <strong>Cargar documento</strong> para los
              demás soportes.
            </li>
          </ol>
          <p className="mt-2 text-[11px] text-amber-800">
            Si se carga aquí queda suelto, repetido en todos los años, y el hito del ciclo no
            se enciende.
          </p>
        </div>
      )}
      {formAbierto && !chipEsDelAnio && (
        <div className="px-5 py-4 bg-neutral-50/60 border-b border-neutral-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={requiereAnio ? '' : 'sm:col-span-2'}>
            <label className={label}>Tipo de documento *</label>
            {/* los tipos del ciclo no se ofrecen aquí: se cargan en Trayectoria */}
            <select
              value={tipoSel}
              onChange={e => setTipoSel(e.target.value)}
              className={input}
            >
              <option value="">— Selecciona un tipo —</option>
              {tipos.filter(t => !t.esDelAnio).map(t => (
                <option key={t.id} value={String(t.id)}>{t.nombre}</option>
              ))}
            </select>
            {tipos.some(t => t.esDelAnio) && (
              <p className="mt-1 text-[11px] text-neutral-500">
                El correo de autorización, el acuerdo de confidencialidad y el certificado de
                participación se cargan <strong>dentro del año</strong>, en Trayectoria, porque
                cada ciclo tiene el suyo.
              </p>
            )}
          </div>
          {requiereAnio && (
            <div>
              <label className={label}>Año de referencia *</label>
              <input
                type="number"
                min={2000}
                max={maxAnio}
                value={anio}
                onChange={e => setAnio(e.target.value)}
                className={input}
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={label}>Descripción (opcional)</label>
            <input
              type="text"
              maxLength={300}
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Contexto o notas del documento"
              className={input}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>
              Archivo {formatosDe(tipoSeleccionado).etiqueta} * (máximo 8 MB)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept={formatosDe(tipoSeleccionado).accept}
              onChange={e => setArchivo(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200"
            />
            {tipoSeleccionado?.extensiones?.includes('msg') && (
              <p className="mt-1 text-[11px] text-neutral-500">
                Guarde el correo desde Outlook con &quot;Guardar como&quot;: .msg en el de
                escritorio, .eml en el web. También sirve impreso a PDF.
              </p>
            )}
            {archivo && (
              <p className="mt-1 text-[11px] text-neutral-500 truncate">
                {archivo.name} · {(archivo.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            )}
          </div>
          <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-1">
            <button
              onClick={cerrarForm}
              disabled={subiendo}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={subir}
              disabled={subiendo}
              className="inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90"
              style={{ backgroundColor: INSTITUTIONAL }}
            >
              {subiendo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Subir documento
            </button>
          </div>
        </div>
      )}

      {/* Listado */}
      {loading ? (
        <p className="px-5 py-6 text-sm text-neutral-500 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Cargando documentos...
        </p>
      ) : items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-neutral-400">No hay documentos aún</p>
      ) : itemsFiltrados.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-neutral-400">
          No hay documentos de este tipo
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {itemsFiltrados.map(d => {
            const c = chipColor(d.tipoCodigo)
            return (
              <li key={d.documentoId} className="px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#00304D]/5 text-[#00304D] flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${c.bg} ${c.text} ${c.border}`}>
                      {d.tipoNombre}
                    </span>
                    {d.anioReferencia != null && (
                      <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                        Año {d.anioReferencia}
                      </span>
                    )}
                    <span className="text-[11px] text-neutral-500">
                      {fmtSoloDia(d.fechaCargue)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-neutral-800 mt-1 truncate">
                    {d.archivoNombre ?? 'documento.pdf'}
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                    {d.descripcion ?? '—'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <button
                    onClick={() => abrirArchivo(`/evaluadores/documentos/${d.documentoId}/archivo`).catch(() => {
                      setToast({ tipo: 'error', msg: 'No se pudo abrir el documento' })
                    })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition hover:opacity-90"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    <Eye size={13} />
                    Ver
                  </button>
                  <button
                    onClick={() => descargarArchivoConNombreDelServidor(
                      `/evaluadores/documentos/${d.documentoId}/descargar`,
                      d.archivoNombre ?? `documento_${d.documentoId}.pdf`,
                    ).catch(() => {
                      setToast({ tipo: 'error', msg: 'No se pudo descargar el documento' })
                    })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg transition"
                  >
                    <Download size={13} />
                    Descargar
                  </button>
                  <button
                    onClick={() => setConfirmDelId(d.documentoId)}
                    disabled={eliminandoId === d.documentoId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-red-100 text-neutral-700 hover:text-red-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                  >
                    {eliminandoId === d.documentoId ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Eliminar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmModal
        open={confirmDelId != null}
        onClose={() => setConfirmDelId(null)}
        onConfirm={() => confirmDelId != null && eliminar(confirmDelId)}
        tipo="delete"
        titulo="Eliminar documento"
        mensaje={
          <>
            ¿Seguro que deseas eliminar el documento{' '}
            <strong>{docAEliminar?.archivoNombre ?? ''}</strong>? Esta acción no se puede deshacer.
          </>
        }
        textoConfirmar="Eliminar"
        cargando={eliminandoId != null}
      />
    </Section>
  )
}
