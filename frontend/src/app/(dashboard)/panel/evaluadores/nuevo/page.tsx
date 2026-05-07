'use client'

import api from '@/lib/api'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { ArrowLeft, ChevronRight, Loader2, Search, ShieldCheck, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface TipoDoc { id: number; nombre: string }
interface RespCrear { evaluadorId: number; personaId: number }

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
  const [centroId, setCentroId] = useState('')
  const [regionalId, setRegionalId] = useState('')
  const [cargo, setCargo] = useState('')
  const [profesion, setProfesion] = useState('')
  const [posgrado, setPosgrado] = useState('')
  const [otrosEstudios, setOtrosEstudios] = useState('')
  const [jefeDirecto, setJefeDirecto] = useState('')
  const [quienAprueba, setQuienAprueba] = useState('')

  const [loading, setLoading] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'info' | 'success' | 'warn'; msg: string; evaluadorId?: number } | null>(null)
  const [bloqueado, setBloqueado] = useState(false) // si la persona ya es evaluador
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    api.get<TipoDoc[]>('/auth/tipos-documento', { params: { para: 'persona' } })
      .then(r => setTiposDoc(r.data ?? []))
      .catch(() => setTiposDoc([]))
  }, [])

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
      // Precarga campos PERSONA
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
        centroId: centroId.trim() ? Number(centroId) : undefined,
        regionalId: regionalId.trim() ? Number(regionalId) : undefined,
        cargo: cargo.trim() || undefined,
        profesion: profesion.trim() || undefined,
        posgrado: posgrado.trim() || undefined,
        otrosEstudios: otrosEstudios.trim() || undefined,
        jefeDirecto: jefeDirecto.trim() || undefined,
        quienAprueba: quienAprueba.trim() || undefined,
      })
      setToast({ tipo: 'success', msg: 'Evaluador creado' })
      setTimeout(() => router.push(`/panel/evaluadores/${res.data.evaluadorId}`), 700)
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
        {/* Búsqueda previa */}
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

        {/* Datos personales */}
        <section className="border-t border-neutral-100 pt-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-3">Datos personales</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Nombres *</label>
              <input value={nombres} onChange={(e) => setNombres(e.target.value)} className={input} required disabled={bloqueado} />
            </div>
            <div>
              <label className={label}>Primer apellido *</label>
              <input value={primerApellido} onChange={(e) => setPrimerApellido(e.target.value)} className={input} required disabled={bloqueado} />
            </div>
            <div>
              <label className={label}>Segundo apellido</label>
              <input value={segundoApellido} onChange={(e) => setSegundoApellido(e.target.value)} className={input} disabled={bloqueado} />
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

        {/* Datos del banco */}
        <section className="border-t border-neutral-100 pt-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-3">Datos del banco de evaluadores</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Regional <span className="text-neutral-400 font-normal normal-case">(ID, opcional)</span></label>
              <input value={regionalId} onChange={(e) => setRegionalId(e.target.value)} placeholder="Ej: 17 (Caldas)" className={input} disabled={bloqueado} />
            </div>
            <div>
              <label className={label}>Centro de formación <span className="text-neutral-400 font-normal normal-case">(ID, opcional)</span></label>
              <input value={centroId} onChange={(e) => setCentroId(e.target.value)} placeholder="ID del centro" className={input} disabled={bloqueado} />
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
              <label className={label}>Otros estudios</label>
              <textarea value={otrosEstudios} onChange={(e) => setOtrosEstudios(e.target.value)} rows={3} className={textarea} disabled={bloqueado} />
            </div>
            <div>
              <label className={label}>Jefe directo</label>
              <input value={jefeDirecto} onChange={(e) => setJefeDirecto(e.target.value)} className={input} disabled={bloqueado} />
            </div>
            <div>
              <label className={label}>Quién aprueba participación</label>
              <input value={quienAprueba} onChange={(e) => setQuienAprueba(e.target.value)} className={input} disabled={bloqueado} />
            </div>
          </div>
          <p className="text-[11px] text-neutral-500 mt-3">
            La foto, certificados, experiencia, TIC y participaciones se cargan después desde la ficha del evaluador.
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
