'use client'

import { GovBar } from '@/components/public/gov-bar'
import { InstitutionalHeader } from '@/components/public/institutional-header'
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

      <div className="flex min-h-screen flex-col bg-neutral-50">
        <GovBar />
        <InstitutionalHeader />

        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
          <div className="flex w-full max-w-sm flex-col gap-5">
            <Link
              href="/inicio"
              className="inline-flex w-fit items-center gap-1.5 rounded-md text-xs font-medium text-neutral-500 transition-colors hover:text-lime-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cerulean-500"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Volver al portal
            </Link>

            <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-md">
              {/* filete verde: ata la tarjeta al color institucional */}
              <div className="h-1 w-full bg-lime-500" aria-hidden="true" />

              <div className="flex flex-col gap-6 p-6 sm:p-8">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-500 shadow-sm">
                    <LogIn size={24} className="text-white" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg font-bold text-cerulean-500">Iniciar sesión</h2>
                  <p className="text-xs text-neutral-500">
                    Acceso para usuarios registrados
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="login-email" className="text-xs font-semibold text-neutral-700">
                      Correo electrónico
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="correo@sena.edu.co"
                      autoComplete="email"
                      className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 focus:border-cerulean-500 focus:outline-none focus:ring-2 focus:ring-cerulean-500/40"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="login-clave" className="text-xs font-semibold text-neutral-700">
                        Contraseña
                      </label>
                      <Link
                        href="/recuperar-contrasena"
                        className="rounded-md text-xs text-cerulean-500 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cerulean-500"
                      >
                        ¿Olvidé mi contraseña?
                      </Link>
                    </div>
                    <input
                      id="login-clave"
                      type="password"
                      value={clave}
                      onChange={(e) => setClave(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 focus:border-cerulean-500 focus:outline-none focus:ring-2 focus:ring-cerulean-500/40"
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
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-lime-500 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-lime-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cerulean-500 disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="rounded-md font-semibold text-lime-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cerulean-500"
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
        </main>

        {/* franja fina de creditos: el pie completo del portal es demasiado para el login */}
        <footer className="bg-cerulean-500 py-3 text-center">
          <p className="text-[11px] text-white/80">
            © GGPC – DSNFT – SENA {new Date().getFullYear()}
          </p>
        </footer>
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
