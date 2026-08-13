'use client'

import api from '@/lib/api'
import { ArrowLeft, KeyRound, Loader2, MailCheck } from 'lucide-react'
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
    <div className="flex min-h-[70vh] items-center justify-center bg-gradient-to-br from-celeste-50 via-white to-lime-50 px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-5">
        <Link
          href="/login"
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-xs font-medium text-neutral-500 transition-colors hover:text-lime-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cerulean-500"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Volver al inicio de sesión
        </Link>

        {!enviado ? (
          <section className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cerulean-500 shadow-sm">
                <KeyRound size={24} className="text-white" aria-hidden="true" />
              </div>
              <h1 className="text-lg font-bold text-cerulean-500">¿Olvidaste tu contraseña?</h1>
              <p className="text-xs leading-relaxed text-neutral-500">
                Ingresa tu correo registrado y te enviaremos un enlace para crear una nueva contraseña.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="recuperar-email" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Correo electrónico
                </label>
                <input
                  id="recuperar-email"
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="correo@empresa.com"
                  autoComplete="email"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm transition focus:border-cerulean-500 focus:outline-none focus:ring-2 focus:ring-cerulean-500/30"
                />
              </div>

              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-lime-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
              >
                {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </form>
          </section>
        ) : (
          <section className="flex flex-col items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5 text-center shadow-sm sm:p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-lime-500 shadow-sm">
              <MailCheck size={30} className="text-white" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-cerulean-500">Revisa tu correo</h2>
            <p className="text-sm leading-relaxed text-neutral-600">
              Si <strong>{email}</strong> está registrado en el SEP,
              recibirás un enlace para restablecer tu contraseña en los próximos minutos.
            </p>
            <p className="text-xs text-neutral-400">El enlace tiene validez de 30 minutos.</p>
            <Link
              href="/login"
              className="mt-2 rounded-md text-sm font-semibold text-cerulean-500 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cerulean-500"
            >
              Volver al inicio de sesión
            </Link>
          </section>
        )}
      </div>
    </div>
  )
}
