'use client'

import { ToastBetowa } from '@/components/ui/toast-betowa'
import api from '@/lib/api'
import { AlertCircle, ArrowLeft, Loader2, LogIn } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'

// Para producción, reemplaza con tu site key de https://www.google.com/recaptcha/admin
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'

export default function LoginPage() {
  const router = useRouter()
  const recaptchaRef = useRef<ReCAPTCHA>(null)

  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [captchaOk, setCaptchaOk] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(false)
  const [toastEmail, setToastEmail] = useState('')
  const [toastError, setToastError] = useState(false)
  const [toastErrorMsg, setToastErrorMsg] = useState('')

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setError('')

    if (!email.trim() || !clave.trim()) {
      setError('Correo y contraseña son requeridos')
      return
    }
    if (!captchaOk) {
      setError('Por favor completa el reCAPTCHA')
      return
    }

    setLoading(true)
    try {
      const res = await api.post<{
        accessToken: string
        usuario: { perfilId: number; email: string }
      }>('/auth/login', { email, clave })

      localStorage.setItem('sep_token', res.data.accessToken)
      setToastEmail(res.data.usuario.email)
      setToast(true)
      setTimeout(() => router.push('/panel'), 1800)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Credenciales incorrectas. Verifique e intente nuevamente.'
      setError(msg)
      setToastErrorMsg(msg)
      setToastError(true)
      recaptchaRef.current?.reset()
      setCaptchaOk(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <ToastBetowa
        show={toast}
        onClose={() => setToast(false)}
        tipo="success"
        titulo="¡Bienvenido!"
        mensaje={`Ingreso exitoso: ${toastEmail}`}
      />
      <ToastBetowa
        show={toastError}
        onClose={() => setToastError(false)}
        tipo="error"
        titulo="Acceso denegado"
        mensaje={toastErrorMsg}
        duration={6000}
      />

      <div className="min-h-screen flex flex-col bg-neutral-50">
        {/* GOV.CO */}
        <div className="w-full py-1.5 flex items-center justify-center gap-2" style={{ backgroundColor: '#3465CC' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="8" fill="white" fillOpacity="0.25" />
            <path d="M8 3L10 7H6L8 3Z" fill="white" />
            <rect x="5" y="7" width="6" height="5" rx="1" fill="white" />
          </svg>
          <span className="text-white text-xs font-semibold tracking-wide">GOV.CO</span>
        </div>

        {/* Cabecera */}
        <div className="bg-white border-b border-neutral-200 py-3 px-6">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-lime-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black text-[10px]">SENA</span>
            </div>
            <div className="w-px h-8 bg-neutral-200" />
            <span className="font-bold text-sm uppercase tracking-wide" style={{ color: '#00304D' }}>
              Sistema Especializado de Proyectos — SEP
            </span>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm flex flex-col gap-6">
            <Link
              href="/inicio"
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-green-600 transition-colors w-fit"
            >
              <ArrowLeft size={14} />
              Volver al portal
            </Link>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-md p-8 flex flex-col gap-6">
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-green-500 flex items-center justify-center shadow-sm">
                  <LogIn size={24} className="text-white" />
                </div>
                <h1 className="text-lg font-bold text-neutral-900">Iniciar Sesión</h1>
                <p className="text-xs text-neutral-500 text-center">
                  Acceso usuarios registrados
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-neutral-700">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@sena.edu.co"
                    autoComplete="email"
                    className="w-full border border-neutral-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-700">
                      Contraseña
                    </label>
                    <Link
                      href="/recuperar-contrasena"
                      className="text-xs text-green-600 hover:underline"
                    >
                      ¿Olvidé mi contraseña?
                    </Link>
                  </div>
                  <input
                    type="password"
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full border border-neutral-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  />
                </div>

                {/* reCAPTCHA */}
                <div className="flex justify-center">
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={RECAPTCHA_SITE_KEY}
                    onChange={(token) => setCaptchaOk(!!token)}
                    onExpired={() => setCaptchaOk(false)}
                    hl="es"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !captchaOk}
                  className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mt-1 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {loading ? 'Verificando...' : 'Ingresar'}
                </button>
              </form>

              <p className="text-center text-xs text-neutral-400">
                ¿No tienes cuenta?{' '}
                <Link href="/eventos" className="text-green-500 hover:underline">
                  Registrate en el SEP
                </Link>
              </p>
            </div>

            <p className="text-center text-[11px] text-neutral-400 leading-relaxed">
              Todos los accesos son registrados y auditados.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="py-3 text-center" style={{ backgroundColor: '#39a900' }}>
          <p className="text-white text-xs">
            © GGPC – DSNFT – SENA {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </>
  )
}
