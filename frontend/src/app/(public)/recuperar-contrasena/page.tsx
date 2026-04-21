'use client'

import api from '@/lib/api'
import { ArrowLeft, KeyRound, Loader2, MailCheck } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Ingresa tu correo electrónico.'); return }

    setLoading(true)
    try {
      await api.post('/auth/recuperar-contrasena', { email: email.trim() })
      setEnviado(true)
    } catch {
      setError('Ocurrió un error. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      {/* GOV.CO bar */}
      <div className="w-full bg-[#3465CC] py-1.5 px-4">
        <div className="max-w-7xl w-full mx-auto flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://betowa.sena.edu.co/assets/logos/gov-logo-new.svg" alt="GOV.CO" className="h-5 w-auto" />
        </div>
      </div>

      {/* Cabecera institucional */}
      <div className="bg-white border-b border-neutral-200 py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Image src="/images/sena-logo.svg" alt="SENA" width={60} height={60} className="w-12 h-12 md:w-[60px] md:h-[60px] object-contain" />
          <div className="w-px h-10 bg-neutral-200 flex-shrink-0" />
          <div className="flex-1 text-center">
            <p className="text-cerulean-500 text-sm md:text-lg font-extrabold uppercase tracking-wide">Sistema Especializado de Proyectos — SEP</p>
          </div>
          <Image src="/images/layout_set_logo_mintrabajo.png" alt="Mintrabajo" width={100} height={60} className="w-14 md:w-[100px] object-contain h-auto" />
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm flex flex-col gap-6">
          <Link href="/login" className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-green-600 transition-colors w-fit">
            <ArrowLeft size={14} /> Volver al inicio de sesión
          </Link>

          {!enviado ? (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-md p-8 flex flex-col gap-6">
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-[#00304D] flex items-center justify-center shadow-sm">
                  <KeyRound size={24} className="text-white" />
                </div>
                <h1 className="text-lg font-bold text-neutral-900">¿Olvidaste tu contraseña?</h1>
                <p className="text-xs text-neutral-500 text-center">
                  Ingresa tu correo registrado y te enviaremos un enlace para crear una nueva contraseña.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-neutral-700">Correo electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError('') }}
                    placeholder="correo@empresa.com"
                    autoComplete="email"
                    className="w-full border border-neutral-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#00304D] hover:bg-[#004a76] disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mt-1 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {loading ? 'Enviando...' : 'Enviar enlace'}
                </button>
              </form>
            </div>
          ) : (
            /* Estado: correo enviado */
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-md p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-500 flex items-center justify-center shadow-sm">
                <MailCheck size={30} className="text-white" />
              </div>
              <h2 className="text-lg font-bold text-neutral-900">Revisa tu correo</h2>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Si <strong>{email}</strong> está registrado en el SEP,
                recibirás un enlace para restablecer tu contraseña en los próximos minutos.
              </p>
              <p className="text-xs text-neutral-400">El enlace tiene validez de 30 minutos.</p>
              <Link
                href="/login"
                className="mt-2 text-sm font-semibold text-[#00304D] hover:underline"
              >
                ← Volver al inicio de sesión
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="py-3 text-center" style={{ backgroundColor: '#39a900' }}>
        <p className="text-white text-xs">© GGPC – DSNFT – SENA {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
