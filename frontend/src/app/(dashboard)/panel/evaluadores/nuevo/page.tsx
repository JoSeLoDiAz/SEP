'use client'

import api from '@/lib/api'
import { aTitleCase } from '@/lib/title-case'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  AlertTriangle, ArrowLeft, Check, ChevronRight, Copy, KeyRound, Loader2,
  Search, ShieldCheck, UserPlus,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface TipoDoc { id: number; nombre: string }
interface Acceso {
  creada: boolean
  perfilAgregado: boolean
  usuarioId: number | null
  /** Solo viene si se creó una cuenta nueva. Se muestra una única vez. */
  claveInicial: string | null
  /** Lo decide el backend: puede no ser el que se tecleó aquí. */
  email: string | null
  detalle: string
}
interface RespCrear { evaluadorId: number; personaId: number; acceso?: Acceso }
interface RegionalCat { id: number; nombre: string }
interface CentroCat { id: number; nombre: string }
interface CiudadCat { id: number; ciudad: string; depto: string }

interface RespBuscar {
  encontrado: boolean
  esEvaluador?: boolean
  evaluadorId?: number | null
  persona?: {
    personaId: number
    nombres: string
    primerApellido: string
    segundoApellido: string | null
    email: string
    emailInstitucional: string | null
    celular: string | null
  }
}

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

export default function NuevoEvaluadorPage() {
  const router = useRouter()

  const [tiposDoc, setTiposDoc] = useState<TipoDoc[]>([])

  // Datos personales
  const [tipoDocumentoIdentidadId, setTipoDocId] = useState<number | ''>('')
  const [identificacion, setIdentificacion] = useState('')
  const [nombres, setNombres] = useState('')
  const [primerApellido, setPrimerApellido] = useState('')
  const [segundoApellido, setSegundoApellido] = useState('')
  const [email, setEmail] = useState('')
  const [emailInstitucional, setEmailInst] = useState('')
  const [celular, setCelular] = useState('')

  // Datos del banco
  const [centroId, setCentroId] = useState<number | null>(null)
  const [regionalId, setRegionalId] = useState<number | null>(null)
  const [municipioId, setMunicipioId] = useState<number | null>(null)
  const [cargo, setCargo] = useState('')
  const [profesion, setProfesion] = useState('')
  const [posgrado, setPosgrado] = useState('')
  const [jefeNombre, setJefeNombre] = useState('')
  const [jefeEmail, setJefeEmail] = useState('')
  const [jefeCargo, setJefeCargo] = useState('')

  // Catálogos Regional / Centro
  const [regionales, setRegionales] = useState<RegionalCat[]>([])
  const [centros, setCentros] = useState<CentroCat[]>([])
  const [cargandoCentros, setCargandoCentros] = useState(false)

  const [loading, setLoading] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'info' | 'success' | 'warn'; msg: string; evaluadorId?: number } | null>(null)
  const [bloqueado, setBloqueado] = useState(false) // si la persona ya es evaluador
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)
  const [credenciales, setCredenciales] = useState<{
    evaluadorId: number; email: string; clave: string; detalle: string
  } | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    api.get<TipoDoc[]>('/auth/tipos-documento', { params: { para: 'persona' } })
      .then(r => setTiposDoc(r.data ?? []))
      .catch(() => setTiposDoc([]))
    api.get<RegionalCat[]>('/evaluadores/catalogos/regionales')
      .then(r => setRegionales(r.data ?? []))
      .catch(() => setRegionales([]))
  }, [])

  useEffect(() => {
    if (regionalId == null) {
      setCentros([])
      setCentroId(null)
      return
    }
    setCargandoCentros(true)
    const ctrl = new AbortController()
    api.get<CentroCat[]>('/evaluadores/catalogos/centros', { params: { regionalId }, signal: ctrl.signal })
      .then(r => setCentros(r.data ?? []))
      .catch(err => { if (err?.name !== 'CanceledError') setCentros([]) })
      .finally(() => setCargandoCentros(false))
    return () => ctrl.abort()
  }, [regionalId])

  async function buscarPersona() {
    if (!tipoDocumentoIdentidadId || !identificacion.trim()) {
      setToast({ tipo: 'error', msg: 'Selecciona tipo de documento e ingresa la identificación' })
      return
    }
    setBuscando(true)
    setAviso(null)
    setBloqueado(false)
    try {
      const res = await api.get<RespBuscar>('/evaluadores/buscar-persona', {
        params: { tipoDoc: tipoDocumentoIdentidadId, doc: identificacion.trim() },
      })
      if (!res.data.encontrado) {
        setAviso({ tipo: 'info', msg: 'No hay registro previo. Diligencia los datos para crear el evaluador.' })
        return
      }
      const p = res.data.persona!
      setNombres(p.nombres ?? '')
      setPrimerApellido(p.primerApellido ?? '')
      setSegundoApellido(p.segundoApellido ?? '')
      setEmail(p.email ?? '')
      setEmailInst(p.emailInstitucional ?? '')
      setCelular(p.celular ?? '')

      if (res.data.esEvaluador) {
        setBloqueado(true)
        setAviso({
          tipo: 'warn',
          msg: 'Esta persona ya está registrada como evaluador.',
          evaluadorId: res.data.evaluadorId ?? undefined,
        })
      } else {
        setAviso({
          tipo: 'success',
          msg: 'Persona encontrada en SEP. Datos personales precargados; completa los datos del banco.',
        })
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo buscar' })
    } finally {
      setBuscando(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (bloqueado) return

    if (!tipoDocumentoIdentidadId)         return setToast({ tipo: 'error', msg: 'Selecciona el tipo de documento' })
    if (!identificacion.trim())             return setToast({ tipo: 'error', msg: 'Identificación obligatoria' })
    if (!nombres.trim() || !primerApellido.trim()) return setToast({ tipo: 'error', msg: 'Nombres y primer apellido son obligatorios' })
    if (!email.trim())                      return setToast({ tipo: 'error', msg: 'Correo obligatorio' })
    if (!emailInstitucional.trim())         return setToast({ tipo: 'error', msg: 'Correo institucional obligatorio' })

    setLoading(true)
    try {
      const res = await api.post<RespCrear>('/evaluadores', {
        tipoDocumentoIdentidadId: Number(tipoDocumentoIdentidadId),
        identificacion: identificacion.trim(),
        nombres: nombres.trim(),
        primerApellido: primerApellido.trim(),
        segundoApellido: segundoApellido.trim() || undefined,
        email: email.trim().toLowerCase(),
        emailInstitucional: emailInstitucional.trim().toLowerCase(),
        celular: celular.trim() || undefined,
        centroId: centroId ?? undefined,
        regionalId: regionalId ?? undefined,
        municipioId: municipioId ?? undefined,
        cargo: cargo.trim() || undefined,
        profesion: profesion.trim() || undefined,
        posgrado: posgrado.trim() || undefined,
        jefeNombre: jefeNombre.trim() || undefined,
        jefeEmail: jefeEmail.trim().toLowerCase() || undefined,
        jefeCargo: jefeCargo.trim() || undefined,
      })
      const acceso = res.data.acceso
      if (acceso?.claveInicial) {
        // La clave solo existe en esta respuesta: si redirigimos, se pierde.
        setCredenciales({
          evaluadorId: res.data.evaluadorId,
          // El correo del backend, no el tecleado: es el único que sirve para entrar.
          email: acceso.email ?? emailInstitucional.trim().toLowerCase(),
          clave: acceso.claveInicial,
          detalle: acceso.detalle,
        })
        return
      }
      setToast({
        tipo: 'success',
        msg: acceso?.detalle ?? 'Evaluador creado',
      })
      setTimeout(() => router.push(`/panel/evaluadores/${res.data.evaluadorId}`), 3500)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo crear el evaluador' })
    } finally {
      setLoading(false)
    }
  }

  const label = 'block text-xs font-semibold text-neutral-700 mb-1'
  const input = 'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40 disabled:bg-neutral-50 disabled:text-neutral-500'
  const textarea = `${input} resize-y`

  // Reemplaza el formulario: no hay forma de salir sin ver la clave.
  if (credenciales) {
    const copiar = async () => {
      try {
        await navigator.clipboard.writeText(
          `SEP — Banco de Evaluadores\nUsuario: ${credenciales.email}\nClave: ${credenciales.clave}`,
        )
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2500)
      } catch {
        setToast({ tipo: 'error', msg: 'El navegador no dejó copiar. Selecciona el texto a mano.' })
      }
    }
    return (
      <div className="p-5 sm:p-7 xl:p-10 max-w-2xl">
        {toast && (
          <ToastBetowa
            show onClose={() => setToast(null)} tipo={toast.tipo}
            titulo={toast.tipo === 'success' ? 'Listo' : 'Error'} mensaje={toast.msg} duration={3500}
          />
        )}
        <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-lg">
          <header className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/70 px-6 py-4">
            <KeyRound size={18} className="text-emerald-700" />
            <h1 className="text-base font-bold text-emerald-900">Evaluador creado con acceso al SEP</h1>
          </header>

          <div className="px-6 py-5">
            <p className="text-[13px] text-neutral-600">{credenciales.detalle}</p>

            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Usuario <span className="normal-case font-normal text-neutral-400">(correo institucional)</span>
              </p>
              <p className="font-mono text-sm text-neutral-800">{credenciales.email}</p>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Clave inicial
              </p>
              <p className="select-all font-mono text-2xl font-bold tracking-widest" style={{ color: PRIMARY }}>
                {credenciales.clave}
              </p>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-[12px] text-amber-900">
                Esta clave <strong>no se puede volver a consultar</strong>: no queda guardada en texto
                plano en ningún lado. Cópiala y entrégasela al evaluador antes de continuar. Si se
                pierde, hay que restablecerla desde el panel de usuarios.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={copiar}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                {copiado ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                {copiado ? 'Copiado' : 'Copiar usuario y clave'}
              </button>
              <button
                onClick={() => router.push(`/panel/evaluadores/${credenciales.evaluadorId}`)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90"
                style={{ backgroundColor: INSTITUTIONAL }}
              >
                Ya la guardé, ir a la ficha
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6 max-w-4xl">
      {toast && (
        <ToastBetowa
          show
          onClose={() => setToast(null)}
          tipo={toast.tipo}
          titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg}
          duration={4000}
        />
      )}

      <div className="rounded-2xl px-6 py-4 flex items-center gap-3 text-white shadow-md" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #001f33 100%)` }}>
        <ShieldCheck size={22} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-white/70 text-xs flex-wrap">
            <Link href="/panel/evaluadores" className="hover:text-white">Banco de Evaluadores</Link>
            <ChevronRight size={12} />
            <span>Nuevo</span>
          </div>
          <h1 className="font-bold text-base sm:text-lg">Registrar nuevo evaluador</h1>
        </div>
      </div>

      <Link href="/panel/evaluadores" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D] w-fit">
        <ArrowLeft size={13} />
        Volver al banco
      </Link>

      <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
        <section>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-3">Buscar persona</p>
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr_auto] gap-3 items-end">
            <div>
              <label className={label}>Tipo de documento *</label>
              <select
                value={tipoDocumentoIdentidadId}
                onChange={(e) => { setTipoDocId(e.target.value ? Number(e.target.value) : ''); setAviso(null); setBloqueado(false) }}
                className={input}
                required
              >
                <option value="">— Seleccionar —</option>
                {tiposDoc.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Identificación *</label>
              <input
                value={identificacion}
                onChange={(e) => { setIdentificacion(e.target.value); setAviso(null); setBloqueado(false) }}
                className={input}
                required
              />
            </div>
            <button
              type="button"
              onClick={buscarPersona}
              disabled={buscando || !tipoDocumentoIdentidadId || !identificacion.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90"
              style={{ backgroundColor: PRIMARY }}
            >
              {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar
            </button>
          </div>

          {aviso && (
            <div className={`mt-3 rounded-lg px-3 py-2.5 text-xs flex items-center gap-2 ${
              aviso.tipo === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
              aviso.tipo === 'warn'    ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                          'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              <span className="flex-1">{aviso.msg}</span>
              {aviso.evaluadorId && (
                <Link
                  href={`/panel/evaluadores/${aviso.evaluadorId}`}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold rounded transition"
                >
                  Ver ficha
                </Link>
              )}
            </div>
          )}
        </section>

        <section className="border-t border-neutral-100 pt-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-3">Datos personales</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Nombres *</label>
              <input
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                onBlur={() => setNombres(v => aTitleCase(v) ?? '')}
                className={input}
                required
                disabled={bloqueado}
              />
            </div>
            <div>
              <label className={label}>Primer apellido *</label>
              <input
                value={primerApellido}
                onChange={(e) => setPrimerApellido(e.target.value)}
                onBlur={() => setPrimerApellido(v => aTitleCase(v) ?? '')}
                className={input}
                required
                disabled={bloqueado}
              />
            </div>
            <div>
              <label className={label}>Segundo apellido</label>
              <input
                value={segundoApellido}
                onChange={(e) => setSegundoApellido(e.target.value)}
                onBlur={() => setSegundoApellido(v => aTitleCase(v) ?? '')}
                className={input}
                disabled={bloqueado}
              />
            </div>
            <div>
              <label className={label}>Correo personal *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} required disabled={bloqueado} />
            </div>
            <div>
              <label className={label}>Correo institucional *</label>
              <input type="email" value={emailInstitucional} onChange={(e) => setEmailInst(e.target.value)} className={input} required disabled={bloqueado} />
            </div>
            <div>
              <label className={label}>Celular</label>
              <input value={celular} onChange={(e) => setCelular(e.target.value)} className={input} disabled={bloqueado} />
            </div>
          </div>
        </section>

        <section className="border-t border-neutral-100 pt-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-3">Datos del banco de evaluadores</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Regional</label>
              <select
                value={regionalId ?? ''}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null
                  setRegionalId(v)
                  setCentroId(null)
                }}
                className={input}
                disabled={bloqueado}
              >
                <option value="">— Seleccionar —</option>
                {regionales.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Centro de formación</label>
              <select
                value={centroId ?? ''}
                onChange={(e) => setCentroId(e.target.value ? Number(e.target.value) : null)}
                disabled={bloqueado || regionalId == null || cargandoCentros}
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
                initialLabel=""
                onChange={setMunicipioId}
                inputClass={input}
                disabled={bloqueado}
              />
            </div>
            <div>
              <label className={label}>Cargo</label>
              <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="INSTRUCTOR G20" className={input} disabled={bloqueado} />
            </div>
            <div>
              <label className={label}>Profesión (pregrado)</label>
              <input value={profesion} onChange={(e) => setProfesion(e.target.value)} className={input} disabled={bloqueado} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Posgrado</label>
              <input value={posgrado} onChange={(e) => setPosgrado(e.target.value)} className={input} disabled={bloqueado} />
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-2">Jefe directo</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={label}>Nombre</label>
                  <input
                    value={jefeNombre}
                    onChange={(e) => setJefeNombre(e.target.value)}
                    onBlur={() => setJefeNombre(v => aTitleCase(v) ?? '')}
                    className={input}
                    disabled={bloqueado}
                  />
                </div>
                <div>
                  <label className={label}>Correo institucional</label>
                  <input type="email" value={jefeEmail} onChange={(e) => setJefeEmail(e.target.value)} className={input} disabled={bloqueado} />
                </div>
                <div>
                  <label className={label}>Cargo</label>
                  <input value={jefeCargo} onChange={(e) => setJefeCargo(e.target.value)} className={input} disabled={bloqueado} />
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-neutral-500 mt-3">
            La foto, certificados, experiencia, TIC y participaciones se cargan después desde la ficha del evaluador.
            Los otros estudios se registran en <strong>Perfil → Hoja de vida y estudios</strong>, y la autorización del
            jefe en cada año de la <strong>Trayectoria</strong>.
          </p>
        </section>

        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
          <Link
            href="/panel/evaluadores"
            className="px-4 py-2 border border-neutral-300 text-neutral-700 text-sm font-semibold rounded-lg hover:bg-neutral-50 transition"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading || bloqueado}
            className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90"
            style={{ backgroundColor: INSTITUTIONAL }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Registrar evaluador
          </button>
        </div>
      </form>
    </div>
  )
}

function MunicipioAutocomplete({
  value,
  initialLabel,
  onChange,
  inputClass,
  disabled,
}: {
  value: number | null
  initialLabel: string
  onChange: (id: number | null) => void
  inputClass: string
  disabled?: boolean
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

  useEffect(() => {
    const q = texto.trim()
    if (q.length < 2) {
      setResultados([])
      setBuscando(false)
      return
    }
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
          onChange={(e) => {
            setTexto(e.target.value)
            setAbierto(true)
            if (value != null) onChange(null)
          }}
          onFocus={() => setAbierto(true)}
          placeholder="Escribe 2+ letras (ej: Bogotá)"
          className={`${inputClass} pr-8`}
          autoComplete="off"
          disabled={disabled}
        />
        {(texto || value != null) && !disabled && (
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
