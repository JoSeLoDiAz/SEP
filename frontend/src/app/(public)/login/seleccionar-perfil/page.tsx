'use client'

import { CabeceraPagina } from '@/components/public/cabecera-pagina'
import api from '@/lib/api'
import { ArrowLeft, CheckCircle2, Loader2, Star, UserCog } from 'lucide-react'
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
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-cerulean-500" aria-hidden="true" />
        <span className="sr-only">Cargando perfiles</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <CabeceraPagina
        icono={UserCog}
        titulo="Selecciona tu perfil"
        descripcion="Tu cuenta tiene varios perfiles activos. Elige con cuál deseas iniciar sesión en esta ocasión."
      />

      <div className="mx-auto w-full max-w-2xl px-6 pb-14 pt-2">
        <button
          type="button"
          onClick={handleVolver}
          className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-md text-xs font-medium text-neutral-500 transition-colors hover:text-lime-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cerulean-500"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Volver al inicio de sesión
        </button>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-bold text-cerulean-500 sm:text-lg">Hola, {data.usuario.nombre}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">{data.usuario.email}</p>

          {errMsg && (
            <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {errMsg}
            </p>
          )}

          <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Perfiles disponibles
          </p>

          <ul className="flex flex-col gap-2">
            {data.perfiles.map(p => {
              const activo = seleccionado === p.perfilId
              return (
                <li key={p.perfilId}>
                  <button
                    type="button"
                    onClick={() => setSeleccionado(p.perfilId)}
                    aria-pressed={activo}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cerulean-500 sm:px-4 ${
                      activo
                        ? 'border-cerulean-500 bg-cerulean-500/5'
                        : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
                        activo ? 'bg-cerulean-500 text-white' : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      <UserCog size={18} aria-hidden="true" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={`text-sm font-bold leading-tight ${activo ? 'text-cerulean-500' : 'text-neutral-800'}`}>
                          {p.perfilNombre}
                        </span>
                        {p.predeterminado && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                            <Star size={10} fill="currentColor" aria-hidden="true" />
                            Predeterminado
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-neutral-500">
                        {p.fechaUltimoAcceso
                          ? `Último ingreso: ${new Date(p.fechaUltimoAcceso).toLocaleString('es-CO', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}`
                          : 'Aún no has ingresado con este perfil'}
                      </span>
                    </span>

                    <CheckCircle2
                      size={20}
                      strokeWidth={2.4}
                      aria-hidden="true"
                      className={`shrink-0 transition ${activo ? 'text-lime-500' : 'text-neutral-200'}`}
                    />
                  </button>
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            onClick={handleEntrar}
            disabled={loading || !seleccionado}
            aria-busy={loading}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-lime-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
          >
            {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {loading ? 'Ingresando...' : 'Ingresar con este perfil'}
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] text-neutral-400">
          Todos los accesos quedan registrados.
        </p>
      </div>
    </div>
  )
}
