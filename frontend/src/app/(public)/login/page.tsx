'use client'

import { CampoClave } from '@/components/public/campo-clave'
import { CarruselLogin, type LaminaLogin } from '@/components/public/carrusel-login'
import { Modal } from '@/components/ui/modal'
import { ToastBetowa, type ToastTipo } from '@/components/ui/toast-betowa'
import api from '@/lib/api'
import { ArrowLeft, Building2, Loader2, LogIn, UserPlus } from 'lucide-react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

// Site key pública de Cloudflare Turnstile. Configurable por env.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '0x4AAAAAADD6VVCyoP6eM5Ao'

// las fotos las entrega diseño; sin ellas cada lámina queda con su color de marca
const LAMINAS: LaminaLogin[] = [
  {
    id: 'proyectos',
    titulo: 'Bienvenido al SEP',
    texto: 'Tus proyectos de formación en un solo lugar.',
    imagen: '/images/banner/bannerSena2-DoK8FAyn.webp',
    fondo: 'cerulean',
  },
  {
    id: 'convocatorias',
    titulo: 'Convocatorias abiertas',
    texto: 'Presenta tu proyecto y forma a tu talento humano con el SENA.',
    fondo: 'green',
  },
  {
    id: 'certificados',
    titulo: 'Certificados a un clic',
    texto: 'Descarga y verifica los certificados de tus eventos.',
    fondo: 'purpura',
  },
]

export default function LoginPage() {
  const router = useRouter()
  const turnstileRef = useRef<TurnstileInstance | null>(null)

  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [registroModal, setRegistroModal] = useState(false)
  const [toast, setToast] = useState<{ tipo: ToastTipo; msg: string } | null>(null)

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setToast(null)

    if (!email.trim() || !clave.trim()) {
      setToast({ tipo: 'error', msg: 'Correo y contraseña son requeridos' })
      return
    }
    if (!captchaToken) {
      setToast({ tipo: 'error', msg: 'Por favor espera a que se complete la validación de seguridad' })
      return
    }

    setLoading(true)
    try {
      const res = await api.post<
        | {
            multirol: true
            preauthToken: string
            usuario: { email: string; nombre: string; usuarioId: number }
            perfiles: Array<{ usuarioPerfilId: number; perfilId: number; perfilNombre: string; predeterminado: boolean }>
          }
        | {
            accessToken: string
            usuario: { perfilId: number; email: string; nombre: string; usuarioPerfilId?: number }
          }
      >('/auth/login', { email, clave, captchaToken })

      // Multirol: pasar a la pantalla de selección de perfil
      if ('multirol' in res.data && res.data.multirol) {
        sessionStorage.setItem('sep_preauth', JSON.stringify({
          preauthToken: res.data.preauthToken,
          usuario: res.data.usuario,
          perfiles: res.data.perfiles,
        }))
        router.push('/login/seleccionar-perfil')
        return
      }

      // Flujo de un único perfil — idéntico al anterior
      const ok = res.data as { accessToken: string; usuario: { perfilId: number; email: string; nombre: string; usuarioPerfilId?: number } }
      localStorage.setItem('sep_token', ok.accessToken)
      localStorage.setItem('sep_usuario', JSON.stringify({
        email: ok.usuario.email,
        nombre: ok.usuario.nombre,
        perfilId: ok.usuario.perfilId,
        usuarioPerfilId: ok.usuario.usuarioPerfilId,
      }))
      setToast({ tipo: 'success', msg: `Bienvenido: ${ok.usuario.nombre}` })
      setTimeout(() => router.push('/panel'), 1800)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Credenciales inválidas. Verifique e intente nuevamente.'
      setCaptchaToken('')
      turnstileRef.current?.reset()
      setToast({ tipo: 'error', msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {toast && (
        <ToastBetowa
          show
          onClose={() => setToast(null)}
          tipo={toast.tipo}
          titulo={toast.tipo === 'success' ? '¡Bienvenido!' : 'Acceso denegado'}
          mensaje={toast.msg}
          duration={4000}
        />
      )}

      <div className="relative isolate flex min-h-[72vh] items-center justify-center overflow-hidden bg-gradient-to-br from-celeste-50 via-white to-lime-50 px-4 py-12 sm:px-6">
        {/* manchas muy tenues: dan aire sin cargar de color */}
        <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-celeste-500/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-lime-500/10 blur-3xl" />

        <div className="relative flex w-full max-w-4xl flex-col gap-4">
          <Link
            href="/inicio"
            className="inline-flex w-fit items-center gap-1.5 rounded-md text-xs font-medium text-neutral-500 transition-colors hover:text-lime-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cerulean-500"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Volver al portal
          </Link>

          <section className="grid overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl lg:grid-cols-2">
            {/* en movil es una banda sobre el formulario; en escritorio, la columna izquierda */}
            <CarruselLogin laminas={LAMINAS} />

            <div className="flex flex-col gap-6 p-6 sm:p-9">
              <div className="flex flex-col gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-500 shadow-sm">
                  <LogIn size={22} className="text-white" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-bold text-cerulean-500">Iniciar sesión</h1>
                <p className="text-sm text-neutral-500">
                  Ingresa con la cuenta que registraste en el SEP.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="login-email" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Correo electrónico
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@sena.edu.co"
                    autoComplete="email"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm transition focus:border-cerulean-500 focus:outline-none focus:ring-2 focus:ring-cerulean-500/30"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="login-clave" className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      Contraseña
                    </label>
                    <Link
                      href="/recuperar-contrasena"
                      className="rounded-md text-xs font-medium text-cerulean-500 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cerulean-500"
                    >
                      ¿Olvidé mi contraseña?
                    </Link>
                  </div>
                  <CampoClave
                    id="login-clave"
                    value={clave}
                    onChange={setClave}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>

                {/* Cloudflare Turnstile — verificación automática, casi siempre invisible */}
                <div className="flex justify-center">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={TURNSTILE_SITE_KEY}
                    options={{ language: 'es', theme: 'light' }}
                    onSuccess={(token) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken('')}
                    onError={() => setCaptchaToken('')}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !captchaToken}
                  aria-busy={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-lime-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
                >
                  {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                  {loading ? 'Verificando...' : 'Ingresar'}
                </button>
              </form>

              <p className="text-center text-xs text-neutral-500">
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setRegistroModal(true)}
                  className="rounded-md font-semibold text-lime-600 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cerulean-500"
                >
                  Registrarse en el SEP
                </button>
              </p>
            </div>
          </section>

          <p className="text-center text-[11px] leading-relaxed text-neutral-400">
            Todos los accesos quedan registrados.
          </p>
        </div>
      </div>

      {/* Modal selección tipo de registro */}
      <Modal open={registroModal} onClose={() => setRegistroModal(false)}>
        {/* Header */}
        <div className="bg-cerulean-500 px-6 py-4">
          <h2 className="text-white font-semibold text-base">Registrarse en el SEP</h2>
        </div>

        {/* Opciones */}
        <div className="p-6 flex flex-col sm:flex-row gap-4">
          {/* Proponente */}
          <Link
            href="/registro/proponente"
            onClick={() => setRegistroModal(false)}
            className="flex-1 flex flex-col items-center gap-3 p-6 border-2 border-cerulean-500 rounded-xl hover:bg-cerulean-500 group transition-colors text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-cerulean-500 group-hover:bg-white flex items-center justify-center transition-colors shadow-md">
              <Building2 size={28} className="text-white group-hover:text-cerulean-500 transition-colors" />
            </div>
            <div>
              <p className="font-bold text-cerulean-500 group-hover:text-white text-sm transition-colors">
                Proponente
              </p>
              <p className="text-xs text-neutral-500 group-hover:text-white/80 mt-0.5 transition-colors">
                Empresa / Gremio / Asociación
              </p>
            </div>
          </Link>

          {/* Usuario / Persona */}
          <Link
            href="/registro/usuario"
            onClick={() => setRegistroModal(false)}
            className="flex-1 flex flex-col items-center gap-3 p-6 border-2 border-lime-500 rounded-xl hover:bg-lime-500 group transition-colors text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-lime-500 group-hover:bg-white flex items-center justify-center transition-colors shadow-md">
              <UserPlus size={28} className="text-white group-hover:text-lime-500 transition-colors" />
            </div>
            <div>
              <p className="font-bold text-lime-600 group-hover:text-white text-sm transition-colors">
                Usuario
              </p>
              <p className="text-xs text-neutral-500 group-hover:text-white/80 mt-0.5 transition-colors">
                Persona natural
              </p>
            </div>
          </Link>
        </div>

        <p className="text-center text-[11px] text-neutral-400 pb-5">
          Selecciona el tipo de cuenta que deseas crear
        </p>
      </Modal>
    </>
  )
}
