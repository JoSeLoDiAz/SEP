'use client'

import { CampoClave } from '@/components/public/campo-clave'
import api from '@/lib/api'
import { ArrowLeft, CheckCircle, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

const TARJETA = 'rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6'
const ETIQUETA = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500'

function RestablecerForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [clave, setClave] = useState('')
  const [clave2, setClave2] = useState('')
  const [loading, setLoading] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState('')

  // Validaciones en vivo
  const minLen = clave.length >= 6
  const coinciden = clave === clave2 && clave2.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!token) { setError('Enlace inválido. Solicita uno nuevo.'); return }
    if (!minLen) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (!coinciden) { setError('Las contraseñas no coinciden.'); return }

    setLoading(true)
    try {
      await api.post('/auth/restablecer-contrasena', { token, nuevaClave: clave })
      setExito(true)
      setTimeout(() => router.push('/login'), 3000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'El enlace no es válido o ha expirado. Solicita uno nuevo.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <section className={`${TARJETA} flex flex-col items-center gap-4 text-center`}>
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
          <ShieldAlert size={30} className="text-red-500" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-cerulean-500">Enlace inválido</h2>
        <p className="text-sm leading-relaxed text-neutral-600">
          Este enlace no es válido. Solicita un nuevo correo de recuperación.
        </p>
        <Link
          href="/recuperar-contrasena"
          className="mt-2 rounded-md text-sm font-semibold text-cerulean-500 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cerulean-500"
        >
          Solicitar nuevo enlace
        </Link>
      </section>
    )
  }

  if (exito) {
    return (
      <section className={`${TARJETA} flex flex-col items-center gap-4 text-center`}>
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-lime-500 shadow-sm">
          <CheckCircle size={30} className="text-white" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-cerulean-500">¡Contraseña actualizada!</h2>
        <p className="text-sm leading-relaxed text-neutral-600">
          Tu contraseña fue cambiada correctamente. Serás redirigido al inicio de sesión.
        </p>
        <Link
          href="/login"
          className="mt-2 rounded-md text-sm font-semibold text-cerulean-500 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cerulean-500"
        >
          Ir al inicio de sesión
        </Link>
      </section>
    )
  }

  return (
    <section className={`${TARJETA} flex flex-col gap-6`}>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cerulean-500 shadow-sm">
          <ShieldCheck size={24} className="text-white" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-bold text-cerulean-500">Nueva contraseña</h1>
        <p className="text-xs leading-relaxed text-neutral-500">Crea una contraseña segura para tu cuenta del SEP.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="clave-nueva" className={ETIQUETA}>Nueva contraseña</label>
          <CampoClave
            id="clave-nueva"
            value={clave}
            onChange={v => { setClave(v); setError('') }}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
          />
          {clave.length > 0 && (
            <p className={`mt-1.5 text-[11px] ${minLen ? 'text-lime-600' : 'text-red-500'}`}>
              {minLen ? 'Longitud correcta' : `Faltan ${6 - clave.length} caracteres`}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="clave-confirmar" className={ETIQUETA}>Confirmar contraseña</label>
          <CampoClave
            id="clave-confirmar"
            value={clave2}
            onChange={v => { setClave2(v); setError('') }}
            placeholder="Repite la contraseña"
            autoComplete="new-password"
          />
          {clave2.length > 0 && (
            <p className={`mt-1.5 text-[11px] ${coinciden ? 'text-lime-600' : 'text-red-500'}`}>
              {coinciden ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
            </p>
          )}
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}{' '}
            {error.includes('expirado') || error.includes('válido') ? (
              <Link href="/recuperar-contrasena" className="font-semibold underline">
                Solicitar nuevo enlace
              </Link>
            ) : null}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !minLen || !coinciden}
          aria-busy={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-lime-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
        >
          {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
          {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
        </button>
      </form>
    </section>
  )
}

export default function RestablecerContrasenaPage() {
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

        <Suspense fallback={
          <div className={`${TARJETA} flex justify-center`}>
            <Loader2 size={24} className="animate-spin text-neutral-400" aria-hidden="true" />
          </div>
        }>
          <RestablecerForm />
        </Suspense>
      </div>
    </div>
  )
}
