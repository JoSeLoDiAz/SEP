'use client'

import api from '@/lib/api'
import { abrirArchivo, descargarArchivo } from '@/lib/descargar-archivo'
import { useFotoEvaluador } from '@/lib/use-foto-evaluador'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  ArrowLeft, Award, Briefcase, Camera, ChevronRight, ClipboardList, Download, Eye, FileText,
  GraduationCap, Loader2, Pencil, PowerOff, Save, Settings2, ShieldCheck,
  Trash2, Upload, UserCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

interface Ficha {
  evaluadorId: number
  personaId: number
  centroId: number | null
  regionalId: number | null
  cargo: string | null
  profesion: string | null
  posgrado: string | null
  otrosEstudios: string | null
  jefeDirecto: string | null
  quienAprueba: string | null
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

type TabId = 'datos' | 'estudios' | 'tic' | 'experiencia' | 'pruebas' | 'participaciones'

interface Tab { id: TabId; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }
const TABS: Tab[] = [
  { id: 'datos',           label: 'Datos',                  icon: UserCircle2 },
  { id: 'estudios',        label: 'Hoja de vida y estudios', icon: GraduationCap },
  { id: 'tic',             label: 'Certificaciones TIC',    icon: Award },
  { id: 'experiencia',     label: 'Experiencia',            icon: Briefcase },
  { id: 'pruebas',         label: 'Pruebas',                icon: ClipboardList },
  { id: 'participaciones', label: 'Participaciones',        icon: ShieldCheck },
]

export default function FichaEvaluadorPage() {
  const params = useParams<{ id: string }>()
  const evaluadorId = Number(params.id)

  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState('')
  const [tab, setTab] = useState<TabId>('datos')
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)
  const [confirmDesactivar, setConfirmDesactivar] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

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
          <div className="shrink-0">
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

      {/* Contenido del tab */}
      {tab === 'datos' && (
        <>
          <SeccionDatos ficha={ficha} onChanged={cargar} setToast={setToast} />
          <SeccionFoto  ficha={ficha} onChanged={cargar} setToast={setToast} />
        </>
      )}
      {tab === 'estudios' && (
        <>
          <SeccionHV        evaluadorId={evaluadorId} setToast={setToast} />
          <SeccionEstudios  evaluadorId={evaluadorId} setToast={setToast} />
        </>
      )}
      {tab === 'tic'             && <SeccionTic             evaluadorId={evaluadorId} setToast={setToast} />}
      {tab === 'experiencia'     && <SeccionExperiencia     evaluadorId={evaluadorId} setToast={setToast} />}
      {tab === 'pruebas'         && <SeccionPruebas         evaluadorId={evaluadorId} setToast={setToast} />}
      {tab === 'participaciones' && <SeccionParticipaciones evaluadorId={evaluadorId} setToast={setToast} />}

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
    </div>
  )
}

// ── Helpers UI ─────────────────────────────────────────────────────────────────

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

// ── Sección DATOS ──────────────────────────────────────────────────────────────

function SeccionDatos({ ficha, onChanged, setToast }: { ficha: Ficha; onChanged: () => void; setToast: SetToast }) {
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  // EVALUADOR
  const [centroId, setCentroId] = useState(ficha.centroId?.toString() ?? '')
  const [regionalId, setRegionalId] = useState(ficha.regionalId?.toString() ?? '')
  const [cargo, setCargo] = useState(ficha.cargo ?? '')
  const [profesion, setProfesion] = useState(ficha.profesion ?? '')
  const [posgrado, setPosgrado] = useState(ficha.posgrado ?? '')
  const [otrosEstudios, setOtros] = useState(ficha.otrosEstudios ?? '')
  const [jefeDirecto, setJefe] = useState(ficha.jefeDirecto ?? '')
  const [quienAprueba, setAprueba] = useState(ficha.quienAprueba ?? '')
  // PERSONA
  const [nombres, setNombres] = useState(ficha.nombres ?? '')
  const [primerApellido, setPrimerAp] = useState(ficha.primerApellido ?? '')
  const [segundoApellido, setSegundoAp] = useState(ficha.segundoApellido ?? '')
  const [email, setEmail] = useState(ficha.email ?? '')
  const [emailInst, setEmailInst] = useState(ficha.emailInstitucional ?? '')
  const [celular, setCelular] = useState(ficha.celular ?? '')

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
        centroId: centroId.trim() ? Number(centroId) : null,
        regionalId: regionalId.trim() ? Number(regionalId) : null,
        cargo: cargo.trim() || null,
        profesion: profesion.trim() || null,
        posgrado: posgrado.trim() || null,
        otrosEstudios: otrosEstudios.trim() || null,
        jefeDirecto: jefeDirecto.trim() || null,
        quienAprueba: quienAprueba.trim() || null,
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
          <Dato label="Regional / Centro" valor={[ficha.regionalId, ficha.centroId].filter(Boolean).join(' / ') || '—'} />
          <Dato label="Jefe directo" valor={ficha.jefeDirecto} />
          <Dato label="Quién aprueba" valor={ficha.quienAprueba} />
          <div className="sm:col-span-2">
            <Dato label="Otros estudios" valor={ficha.otrosEstudios} multiline />
          </div>
        </div>
      </Section>
    )
  }

  return (
    <Section titulo="Editar datos del evaluador">
      <div className="px-5 py-4 flex flex-col gap-5">
        {/* Datos personales */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-3">Datos personales</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={label}>Nombres *</label><input value={nombres} onChange={e => setNombres(e.target.value)} className={input} /></div>
            <div><label className={label}>Primer apellido *</label><input value={primerApellido} onChange={e => setPrimerAp(e.target.value)} className={input} /></div>
            <div><label className={label}>Segundo apellido</label><input value={segundoApellido} onChange={e => setSegundoAp(e.target.value)} className={input} /></div>
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

        {/* Datos del banco */}
        <div className="border-t border-neutral-100 pt-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-3">Datos del banco</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={label}>Cargo</label><input value={cargo} onChange={e => setCargo(e.target.value)} className={input} /></div>
            <div><label className={label}>Profesión</label><input value={profesion} onChange={e => setProfesion(e.target.value)} className={input} /></div>
            <div><label className={label}>Regional (ID)</label><input value={regionalId} onChange={e => setRegionalId(e.target.value)} className={input} /></div>
            <div><label className={label}>Centro (ID)</label><input value={centroId} onChange={e => setCentroId(e.target.value)} className={input} /></div>
            <div className="sm:col-span-2"><label className={label}>Posgrado</label><input value={posgrado} onChange={e => setPosgrado(e.target.value)} className={input} /></div>
            <div className="sm:col-span-2"><label className={label}>Otros estudios</label><textarea value={otrosEstudios} onChange={e => setOtros(e.target.value)} rows={3} className={`${input} resize-y`} /></div>
            <div><label className={label}>Jefe directo</label><input value={jefeDirecto} onChange={e => setJefe(e.target.value)} className={input} /></div>
            <div><label className={label}>Quién aprueba</label><input value={quienAprueba} onChange={e => setAprueba(e.target.value)} className={input} /></div>
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

// ── Sección FOTO ───────────────────────────────────────────────────────────────

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
            Sube una foto de tipo carné. Formatos JPG o PNG. Máximo 4 MB.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
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

// ── Sección PARTICIPACIONES ────────────────────────────────────────────────────

interface Cat { id: number; nombre: string }
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
  mesa: string | null
  equipoEvaluador: string | null
  dinamizadorPersonaId: number | null
  dinamizadorNombre: string | null
}

function SeccionParticipaciones({ evaluadorId, setToast }: { evaluadorId: number; setToast: SetToast }) {
  const [items, setItems] = useState<Participacion[]>([])
  const [roles, setRoles] = useState<Cat[]>([])
  const [procesos, setProcesos] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [agregar, setAgregar] = useState(false)

  // Form
  const [anio, setAnio] = useState<string>(new Date().getFullYear().toString())
  const [periodo, setPeriodo] = useState('')
  const [rolId, setRolId] = useState<string>('')
  const [modalidad, setModalidad] = useState('')
  const [procId, setProcId] = useState<string>('')
  const [revocado, setRevocado] = useState(false)
  const [mesa, setMesa] = useState('')
  const [equipo, setEquipo] = useState('')
  const [creando, setCreando] = useState(false)
  const [eliminando, setEliminando] = useState<number | null>(null)

  async function cargar() {
    setLoading(true)
    try {
      const [r1, r2, r3] = await Promise.all([
        api.get<Participacion[]>(`/evaluadores/${evaluadorId}/participaciones`),
        api.get<{ id: number; nombre: string }[]>(`/evaluadores/catalogos/roles`),
        api.get<{ id: number; nombre: string }[]>(`/evaluadores/catalogos/procesos`),
      ])
      setItems(r1.data ?? [])
      setRoles(r2.data ?? [])
      setProcesos(r3.data ?? [])
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudieron cargar las participaciones') })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { cargar() /* eslint-disable-next-line */ }, [])

  async function crear() {
    if (!anio.trim()) return setToast({ tipo: 'error', msg: 'Año requerido' })
    setCreando(true)
    try {
      await api.post(`/evaluadores/${evaluadorId}/participaciones`, {
        anio: Number(anio),
        periodo: periodo || null,
        rolEvaluadorId: rolId ? Number(rolId) : null,
        modalidadPart: modalidad || null,
        procesoId: procId ? Number(procId) : null,
        procesoRevocado: revocado,
        mesa: mesa || null,
        equipoEvaluador: equipo || null,
      })
      setToast({ tipo: 'success', msg: 'Participación agregada' })
      setAgregar(false)
      setPeriodo(''); setRolId(''); setModalidad(''); setProcId(''); setRevocado(false); setMesa(''); setEquipo('')
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo agregar') })
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
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo eliminar') })
    } finally {
      setEliminando(null)
    }
  }

  const label = 'block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
  const input = 'w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40'

  return (
    <Section titulo={`Historial de participaciones (${items.length})`} accion={
      <button onClick={() => setAgregar(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition hover:opacity-90" style={{ backgroundColor: PRIMARY }}>
        <Settings2 size={12} />
        {agregar ? 'Cerrar' : 'Agregar'}
      </button>
    }>
      {agregar && (
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
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
              <input type="checkbox" checked={revocado} onChange={e => setRevocado(e.target.checked)} className="rounded" />
              Proceso revocado
            </label>
          </div>
          <div className="sm:col-span-2"><label className={label}>Mesa</label><input value={mesa} onChange={e => setMesa(e.target.value)} className={input} /></div>
          <div className="col-span-2 sm:col-span-4"><label className={label}>Equipo evaluador</label><input value={equipo} onChange={e => setEquipo(e.target.value)} className={input} /></div>
          <div className="col-span-2 sm:col-span-4 flex justify-end">
            <button onClick={crear} disabled={creando} className="inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90" style={{ backgroundColor: INSTITUTIONAL }}>
              {creando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Guardar participación
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="px-5 py-6 text-sm text-neutral-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Cargando...</p>
      ) : items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-neutral-400">Sin participaciones registradas</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map(p => (
            <li key={p.participacionId} className="px-5 py-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#00304D]/5 text-[#00304D] flex items-center justify-center shrink-0 font-bold">
                {p.anio}{p.periodo ? `-${p.periodo}` : ''}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-neutral-800">{p.rolNombre || '— Sin rol —'}</span>
                  {p.procesoNombre && (
                    <span className="text-[11px] font-semibold text-[#00304D] bg-[#00304D]/10 px-1.5 py-0.5 rounded">
                      {p.procesoNombre}{p.procesoRevocado ? ' · REVOCADO' : ''}
                    </span>
                  )}
                  {p.modalidadPart && (
                    <span className="text-[11px] font-semibold text-cyan-700 bg-cyan-100 px-1.5 py-0.5 rounded">{p.modalidadPart}</span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {p.mesa && <>Mesa: {p.mesa} · </>}
                  {p.equipoEvaluador && <>Equipo: {p.equipoEvaluador}</>}
                  {!p.mesa && !p.equipoEvaluador && '—'}
                </p>
              </div>
              <button
                onClick={() => eliminar(p.participacionId)}
                disabled={eliminando === p.participacionId}
                className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
              >
                {eliminando === p.participacionId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

// ── Sección HOJA DE VIDA (1:1 con el evaluador) ────────────────────────────────

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

// ── Sección genérica con archivos: ESTUDIOS / EXPERIENCIA / TIC ────────────────

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
        sub: [it.tipoEstudio, it.institucion, it.fechaGrado ? new Date(it.fechaGrado).toLocaleDateString('es-CO') : null].filter(Boolean).join(' · ') || '—',
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

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }) : null

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
        sub: [it.tipoEvento, it.horas ? `${it.horas}h` : null, it.fechaFin ? new Date(it.fechaFin).toLocaleDateString('es-CO') : null].filter(Boolean).join(' · ') || '—',
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

// ── Sección PRUEBAS ────────────────────────────────────────────────────────────

interface Prueba {
  pruebaId: number
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

function SeccionPruebas({ evaluadorId, setToast }: { evaluadorId: number; setToast: SetToast }) {
  const [items, setItems] = useState<Prueba[]>([])
  const [loading, setLoading] = useState(true)
  const [agregar, setAgregar] = useState(false)
  const [anio, setAnio] = useState(new Date().getFullYear().toString())
  const [periodo, setPeriodo] = useState('')
  const [fecha, setFecha] = useState('')
  const [puntaje, setPuntaje] = useState('')
  const [intentos, setIntentos] = useState('')
  const [creando, setCreando] = useState(false)
  const [eliminando, setEliminando] = useState<number | null>(null)

  async function cargar() {
    setLoading(true)
    try {
      const r = await api.get<Prueba[]>(`/evaluadores/${evaluadorId}/pruebas`)
      setItems(r.data ?? [])
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'Error cargando pruebas') })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { cargar() /* eslint-disable-next-line */ }, [])

  async function crear() {
    if (!anio.trim()) return setToast({ tipo: 'error', msg: 'Año requerido' })
    setCreando(true)
    try {
      await api.post(`/evaluadores/${evaluadorId}/pruebas`, {
        anio: Number(anio),
        periodo: periodo || null,
        fechaPresentacion: fecha || null,
        puntajeMayor: puntaje ? Number(puntaje) : null,
        intentos: intentos ? Number(intentos) : null,
      })
      setToast({ tipo: 'success', msg: 'Prueba registrada' })
      setAgregar(false)
      setPeriodo(''); setFecha(''); setPuntaje(''); setIntentos('')
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo agregar') })
    } finally {
      setCreando(false)
    }
  }

  async function eliminar(pid: number) {
    setEliminando(pid)
    try {
      await api.delete(`/evaluadores/pruebas/${pid}`)
      setToast({ tipo: 'success', msg: 'Eliminada' })
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo eliminar') })
    } finally {
      setEliminando(null)
    }
  }

  const label = 'block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
  const input = 'w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40'

  return (
    <Section titulo={`Pruebas de conocimiento (${items.length})`} accion={
      <button onClick={() => setAgregar(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition hover:opacity-90" style={{ backgroundColor: PRIMARY }}>
        <Settings2 size={12} />
        {agregar ? 'Cerrar' : 'Agregar'}
      </button>
    }>
      {agregar && (
        <div className="px-5 py-4 bg-neutral-50/60 border-b border-neutral-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className={label}>Año *</label><input value={anio} onChange={e => setAnio(e.target.value)} className={input} /></div>
          <div><label className={label}>Periodo</label><input value={periodo} onChange={e => setPeriodo(e.target.value)} className={input} /></div>
          <div><label className={label}>Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={input} /></div>
          <div><label className={label}>Puntaje mayor</label><input type="number" step="0.01" value={puntaje} onChange={e => setPuntaje(e.target.value)} className={input} /></div>
          <div><label className={label}>Intentos</label><input type="number" value={intentos} onChange={e => setIntentos(e.target.value)} className={input} /></div>
          <div className="col-span-2 sm:col-span-3 flex items-end justify-end">
            <button onClick={crear} disabled={creando} className="inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90" style={{ backgroundColor: INSTITUTIONAL }}>
              {creando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Guardar prueba
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
                  {p.fechaPresentacion && (
                    <span className="text-[11px] text-neutral-500">{new Date(p.fechaPresentacion).toLocaleDateString('es-CO')}</span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {[p.periodo && `Periodo ${p.periodo}`, p.intentos != null && `${p.intentos} intentos`, p.totalTiempo].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
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
