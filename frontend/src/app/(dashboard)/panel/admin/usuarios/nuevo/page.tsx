'use client'

import api from '@/lib/api'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { ArrowLeft, ChevronRight, Eye, EyeOff, Loader2, RefreshCcw, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PerfilCat { perfilId: number; perfilNombre: string }
interface RespCrear { usuarioId: number; email: string; perfilId: number }

function generarClave(): string {
  // 10 caracteres mezclando letras, números y un símbolo
  const letras  = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
  const numeros = '23456789'
  const simbolo = '!@#$&*'
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  return [
    pick(letras), pick(letras), pick(letras), pick(letras),
    pick(numeros), pick(numeros), pick(numeros),
    pick(letras), pick(letras), pick(simbolo),
  ].sort(() => Math.random() - 0.5).join('')
}

export default function CrearUsuarioPage() {
  const router = useRouter()

  const [perfiles, setPerfiles] = useState<PerfilCat[]>([])
  const [email, setEmail] = useState('')
  const [perfilId, setPerfilId] = useState<number | ''>('')
  const [clave, setClave] = useState(generarClave())
  const [verClave, setVerClave] = useState(false)
  const [nombres, setNombres] = useState('')
  const [primerApellido, setPrimerApellido] = useState('')
  const [segundoApellido, setSegundoApellido] = useState('')
  const [identificacion, setIdentificacion] = useState('')

  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    api.get<PerfilCat[]>('/admin/usuarios/perfiles-catalogo')
      .then(r => setPerfiles(r.data ?? []))
      .catch(() => setErrMsg('No se pudo cargar el catálogo de perfiles'))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrMsg('')

    if (!email.trim() || !clave.trim() || !perfilId) {
      setErrMsg('Correo, contraseña y perfil son obligatorios')
      return
    }
    if (clave.trim().length < 6) {
      setErrMsg('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    try {
      const res = await api.post<RespCrear>('/admin/usuarios', {
        email: email.trim(),
        clave: clave.trim(),
        perfilId,
        nombres: nombres.trim() || undefined,
        primerApellido: primerApellido.trim() || undefined,
        segundoApellido: segundoApellido.trim() || undefined,
        identificacion: identificacion.trim() || undefined,
      })
      setToast({ tipo: 'success', msg: 'Usuario creado correctamente' })
      setTimeout(() => router.push(`/panel/admin/usuarios/${res.data.usuarioId}/perfiles`), 800)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErrMsg(msg ?? 'No se pudo crear el usuario')
    } finally {
      setLoading(false)
    }
  }

  const label    = 'block text-xs font-semibold text-neutral-700 mb-1'
  const input    = 'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D] disabled:bg-neutral-50'

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa
          show
          onClose={() => setToast(null)}
          tipo={toast.tipo}
          titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg}
          duration={3500}
        />
      )}

      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex items-center gap-3">
        <UserPlus size={22} className="text-white" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-white/60 text-xs flex-wrap">
            <Link href="/panel/admin/usuarios" className="hover:text-white">Usuarios</Link>
            <ChevronRight size={12} />
            <span>Nuevo</span>
          </div>
          <h1 className="text-white font-bold text-base sm:text-lg">Crear usuario interno</h1>
        </div>
      </div>

      <Link href="/panel/admin/usuarios" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D] w-fit">
        <ArrowLeft size={13} />
        Volver al listado
      </Link>

      {errMsg && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{errMsg}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-2xl p-6 flex flex-col gap-5 max-w-3xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Correo electrónico *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@dominio.com"
              autoComplete="off"
              className={input}
              required
            />
          </div>
          <div>
            <label className={label}>Perfil inicial *</label>
            <select
              value={perfilId}
              onChange={(e) => setPerfilId(e.target.value ? Number(e.target.value) : '')}
              className={input}
              required
            >
              <option value="">— Seleccionar —</option>
              {perfiles.map(p => (
                <option key={p.perfilId} value={p.perfilId}>{p.perfilNombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={label}>Contraseña inicial *</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={verClave ? 'text' : 'password'}
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                className={input + ' pr-10'}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setVerClave(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              >
                {verClave ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setClave(generarClave())}
              title="Generar nueva contraseña"
              className="inline-flex items-center gap-1 px-3 py-2 border border-neutral-300 rounded-lg text-xs hover:bg-neutral-50 transition"
            >
              <RefreshCcw size={13} />
              Generar
            </button>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1.5">
            Comparte esta contraseña con el usuario por un canal seguro. Podrá cambiarla después.
          </p>
        </div>

        <div className="border-t border-neutral-100 pt-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-3">Datos de la persona <span className="font-normal normal-case text-neutral-400">(opcional)</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Nombres</label>
              <input value={nombres} onChange={(e) => setNombres(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Primer apellido</label>
              <input value={primerApellido} onChange={(e) => setPrimerApellido(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Segundo apellido</label>
              <input value={segundoApellido} onChange={(e) => setSegundoApellido(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Identificación</label>
              <input value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} className={input} />
            </div>
          </div>
          <p className="text-[11px] text-neutral-500 mt-2">
            Si llenas estos campos, también se crea el registro en PERSONA. Si los dejas vacíos, solo se crea el USUARIO.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href="/panel/admin/usuarios"
            className="px-4 py-2 border border-neutral-300 text-neutral-700 text-sm font-semibold rounded-lg hover:bg-neutral-50 transition"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#00304D] hover:bg-[#001f33] text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Crear usuario
          </button>
        </div>
      </form>
    </div>
  )
}
