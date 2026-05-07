'use client'

import api from '@/lib/api'
import { ArrowLeft, CheckCircle2, Loader2, Star, UserCog } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PerfilOpcion {
  usuarioPerfilId: number
  perfilId: number
  perfilNombre: string
  predeterminado: boolean
  fechaUltimoAcceso?: string | null
}

interface Preauth {
  preauthToken: string
  usuario: { email: string; nombre: string; usuarioId: number }
  perfiles: PerfilOpcion[]
}

export default function SeleccionarPerfilPage() {
  const router = useRouter()
  const [data, setData] = useState<Preauth | null>(null)
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    const raw = sessionStorage.getItem('sep_preauth')
    if (!raw) {
      router.replace('/login')
      return
    }
    try {
      const parsed = JSON.parse(raw) as Preauth
      setData(parsed)
      const def = parsed.perfiles.find(p => p.predeterminado) ?? parsed.perfiles[0]
      if (def) setSeleccionado(def.perfilId)
    } catch {
      router.replace('/login')
    }
  }, [router])

  async function handleEntrar() {
    if (!data || !seleccionado) return
    setLoading(true)
    setErrMsg('')
    try {
      const res = await api.post<{
        accessToken: string
        usuario: { email: string; nombre: string; perfilId: number; usuarioPerfilId?: number }
      }>('/auth/seleccionar-perfil', {
        preauthToken: data.preauthToken,
        perfilId: seleccionado,
      })

      localStorage.setItem('sep_token', res.data.accessToken)
      localStorage.setItem('sep_usuario', JSON.stringify({
        email: res.data.usuario.email,
        nombre: res.data.usuario.nombre,
        perfilId: res.data.usuario.perfilId,
        usuarioPerfilId: res.data.usuario.usuarioPerfilId,
      }))
      sessionStorage.removeItem('sep_preauth')
      router.push('/panel')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'No se pudo continuar. Inicia sesión nuevamente.'
      setErrMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  function handleVolver() {
    sessionStorage.removeItem('sep_preauth')
    router.replace('/login')
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 size={28} className="animate-spin text-[#00304D]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      {/* GOV.CO bar */}
      <div className="w-full bg-[#3465CC] py-1.5 px-4 flex items-center">
        <div className="max-w-7xl w-full mx-auto flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://betowa.sena.edu.co/assets/logos/gov-logo-new.svg" alt="GOV.CO" className="h-5 w-auto object-contain" />
        </div>
      </div>

      <div className="bg-white border-b border-neutral-200 py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex-shrink-0">
            <Image src="/images/sena-logo.svg" alt="SENA" width={70} height={70} priority className="w-12 h-12 sm:w-16 sm:h-16 md:w-[70px] md:h-[70px] object-contain" />
          </div>
          <div className="w-px h-10 sm:h-14 bg-neutral-200 flex-shrink-0" />
          <div className="flex-1 text-center px-1">
            <p className="text-cerulean-500 text-sm sm:text-base md:text-xl font-extrabold leading-tight tracking-wide uppercase">Sistema Especializado de</p>
            <p className="text-cerulean-500 text-sm sm:text-base md:text-xl font-extrabold leading-tight tracking-wide uppercase">Proyectos — SEP</p>
          </div>
          <div className="flex-shrink-0">
            <Image src="/images/layout_set_logo_mintrabajo.png" alt="Ministerio del Trabajo" width={120} height={70} priority className="w-16 sm:w-24 md:w-[120px] object-contain h-auto" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl flex flex-col gap-6">
          <button onClick={handleVolver} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-green-600 transition-colors w-fit">
            <ArrowLeft size={14} />
            Volver al inicio de sesión
          </button>

          <div className="bg-white rounded-2xl border border-neutral-200 shadow-md p-8 flex flex-col gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#00304D] flex items-center justify-center shadow-sm">
                <UserCog size={24} className="text-white" />
              </div>
              <h1 className="text-lg font-bold text-neutral-900">Hola, {data.usuario.nombre}</h1>
              <p className="text-xs text-neutral-500 max-w-md">
                Tu cuenta tiene varios perfiles activos. Selecciona con cuál deseas iniciar sesión esta vez.
              </p>
            </div>

            {errMsg && (
              <div className="border border-red-200 bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2">
                {errMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.perfiles.map(p => {
                const activo = seleccionado === p.perfilId
                return (
                  <button
                    key={p.perfilId}
                    onClick={() => setSeleccionado(p.perfilId)}
                    className={`relative text-left p-4 rounded-xl border-2 transition flex flex-col gap-1.5 ${
                      activo
                        ? 'border-[#00304D] bg-[#00304D]/5'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    {p.predeterminado && (
                      <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        <Star size={10} fill="currentColor" />
                        PREDETERMINADO
                      </span>
                    )}
                    <p className={`text-sm font-bold leading-tight ${activo ? 'text-[#00304D]' : 'text-neutral-800'}`}>
                      {p.perfilNombre}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {p.fechaUltimoAcceso
                        ? `Último ingreso: ${new Date(p.fechaUltimoAcceso).toLocaleString('es-CO', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}`
                        : 'Aún no has ingresado con este perfil'}
                    </p>
                    {activo && (
                      <CheckCircle2 size={18} className="absolute bottom-3 right-3 text-[#00304D]" strokeWidth={2.4} />
                    )}
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleEntrar}
              disabled={loading || !seleccionado}
              className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Ingresando...' : 'Ingresar con este perfil'}
            </button>
          </div>
        </div>
      </div>

      <div className="py-3 text-center" style={{ backgroundColor: '#39a900' }}>
        <p className="text-white text-xs">© GGPC – DSNFT – SENA {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
