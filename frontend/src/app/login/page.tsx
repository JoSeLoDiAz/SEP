'use client'

import { Modal } from '@/components/ui/modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import api from '@/lib/api'
import { ArrowLeft, Building2, Loader2, LogIn, UserPlus } from 'lucide-react'
import Image from 'next/image'
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
  const [toast, setToast] = useState(false)
  const [toastNombre, setToastNombre] = useState('')
  const [registroModal, setRegistroModal] = useState(false)

  // Error banner: always in DOM, CSS-only visibility — timer lives in a ref so re-renders can't kill it
  const [errMsg, setErrMsg] = useState('')
  const [errVisible, setErrVisible] = useState(false)
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showErr(msg: string) {
    if (errTimer.current) clearTimeout(errTimer.current)
    setErrMsg(msg)
    setErrVisible(true)
    errTimer.current = setTimeout(() => setErrVisible(false), 6000)
  }

  function hideErr() {
    if (errTimer.current) clearTimeout(errTimer.current)
    setErrVisible(false)
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    hideErr()

    if (!email.trim() || !clave.trim()) {
      showErr('Correo y contraseña son requeridos')
      return
    }
    if (!captchaToken) {
      showErr('Por favor espera a que se complete la validación de seguridad')
      return
    }

    setLoading(true)
    try {
      const res = await api.post<{
        accessToken: string
        usuario: { perfilId: number; email: string; nombre: string }
      }>('/auth/login', { email, clave, captchaToken })

      localStorage.setItem('sep_token', res.data.accessToken)
      localStorage.setItem('sep_usuario', JSON.stringify({
        email: res.data.usuario.email,
        nombre: res.data.usuario.nombre,
        perfilId: res.data.usuario.perfilId,
      }))
      setToastNombre(res.data.usuario.nombre)
      setToast(true)
      setTimeout(() => router.push('/panel'), 1800)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Credenciales inválidas. Verifique e intente nuevamente.'
      setCaptchaToken('')
      turnstileRef.current?.reset()
      showErr(msg)
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
        mensaje={`Bienvenido: ${toastNombre}`}
      />

      {/* Error banner: siempre en el DOM, visible/oculto con CSS — inmune a re-renders */}
      <div
        role="alert"
        aria-live="assertive"
        onClick={hideErr}
        style={{
          position: 'fixed',
          top: 18,
          right: 18,
          width: 'min(480px, calc(100vw - 36px))',
          zIndex: 20000,
          pointerEvents: errVisible ? 'auto' : 'none',
          opacity: errVisible ? 1 : 0,
          transform: errVisible ? 'translateY(0) scale(1)' : 'translateY(-14px) scale(0.97)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          background: '#fdecec',
          border: '1px solid rgba(176,0,32,0.18)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          padding: '14px 16px 10px',
          display: 'grid',
          gridTemplateColumns: '38px 1fr 28px',
          gap: 10,
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        {/* Ícono */}
        <div style={{
          width: 38, height: 38, borderRadius: 999,
          display: 'grid', placeItems: 'center',
          fontWeight: 900, color: '#fff', fontSize: 20,
          background: 'linear-gradient(135deg,#b00020,#e11d48)',
          boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
          flexShrink: 0,
        }}>×</div>

        {/* Texto */}
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#7f1d1d', lineHeight: 1.1 }}>
            Acceso denegado
          </div>
          {errMsg && (
            <div style={{ marginTop: 3, fontSize: '.88rem', color: 'rgba(127,29,29,.82)', lineHeight: 1.3 }}>
              {errMsg}
            </div>
          )}
        </div>

        {/* Cerrar */}
        <button
          type="button"
          aria-label="Cerrar"
          onClick={hideErr}
          style={{
            border: 'none', background: 'transparent',
            fontSize: 26, lineHeight: 1, color: 'rgba(0,0,0,.40)',
            cursor: 'pointer', padding: 0, marginTop: -2, alignSelf: 'start',
          }}
        >×</button>

        {/* Barra de progreso animada con CSS puro — sin estado */}
        <div style={{ gridColumn: '1 / -1', height: 5, borderRadius: 999, background: 'rgba(0,0,0,.08)', overflow: 'hidden', marginTop: 8 }}>
          <div
            style={{
              height: '100%',
              background: 'linear-gradient(135deg,#b00020,#e11d48)',
              animation: errVisible ? 'sep-err-bar 6s linear forwards' : 'none',
            }}
          />
        </div>
      </div>
      <style>{`
        @keyframes sep-err-bar {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>

      <div className="min-h-screen flex flex-col bg-neutral-50">
        {/* GOV.CO bar */}
        <div className="w-full bg-[#3465CC] py-1.5 px-4 flex items-center">
          <div className="max-w-7xl w-full mx-auto flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://betowa.sena.edu.co/assets/logos/gov-logo-new.svg"
              alt="GOV.CO"
              className="h-5 w-auto object-contain"
            />
          </div>
        </div>

        {/* Cabecera institucional */}
        <div className="bg-white border-b border-neutral-200 py-3 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
            {/* Logo SENA */}
            <div className="flex-shrink-0">
              <Image src="/images/sena-logo.svg" alt="SENA" width={70} height={70} priority
                className="w-12 h-12 sm:w-16 sm:h-16 md:w-[70px] md:h-[70px] object-contain" />
            </div>
            <div className="w-px h-10 sm:h-14 bg-neutral-200 flex-shrink-0" />
            {/* Título */}
            <div className="flex-1 text-center px-1">
              <p className="text-cerulean-500 text-sm sm:text-base md:text-xl font-extrabold leading-tight tracking-wide uppercase">
                Sistema Especializado de
              </p>
              <p className="text-cerulean-500 text-sm sm:text-base md:text-xl font-extrabold leading-tight tracking-wide uppercase">
                Proyectos — SEP
              </p>
            </div>
            {/* Logo Trabajo */}
            <div className="flex-shrink-0">
              <Image src="/images/layout_set_logo_mintrabajo.png" alt="Ministerio del Trabajo"
                width={120} height={70} priority
                className="w-16 sm:w-24 md:w-[120px] object-contain h-auto" />
            </div>
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
                  className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mt-1 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {loading ? 'Verificando...' : 'Ingresar'}
                </button>
              </form>

              <p className="text-center text-xs text-neutral-400">
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setRegistroModal(true)}
                  className="text-green-500 hover:underline font-semibold"
                >
                  Registrarse en el SEP
                </button>
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

      {/* Modal selección tipo de registro */}
      <Modal open={registroModal} onClose={() => setRegistroModal(false)}>
        {/* Header */}
        <div className="bg-[#00304D] px-6 py-4">
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
