'use client'

import api from '@/lib/api'
import { ArrowLeft, CheckCircle, Eye, EyeOff, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

function RestablecerForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [clave, setClave] = useState('')
  const [clave2, setClave2] = useState('')
  const [showClave, setShowClave] = useState(false)
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
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-md p-8 flex flex-col items-center gap-4 text-center">
        <ShieldAlert size={40} className="text-red-500" />
        <h2 className="text-lg font-bold text-neutral-900">Enlace inválido</h2>
        <p className="text-sm text-neutral-500">Este enlace no es válido. Solicita un nuevo correo de recuperación.</p>
        <Link href="/recuperar-contrasena" className="text-sm font-semibold text-[#00304D] hover:underline">
          Solicitar nuevo enlace →
        </Link>
      </div>
    )
  }

  if (exito) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-md p-8 flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500 flex items-center justify-center shadow-sm">
          <CheckCircle size={30} className="text-white" />
        </div>
        <h2 className="text-lg font-bold text-neutral-900">¡Contraseña actualizada!</h2>
        <p className="text-sm text-neutral-600">Tu contraseña fue cambiada correctamente. Serás redirigido al inicio de sesión.</p>
        <Link href="/login" className="text-sm font-semibold text-[#00304D] hover:underline">
          Ir al inicio de sesión →
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-md p-8 flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2">
        <div className="w-14 h-14 rounded-2xl bg-[#00304D] flex items-center justify-center shadow-sm">
          <ShieldCheck size={24} className="text-white" />
        </div>
        <h1 className="text-lg font-bold text-neutral-900">Nueva contraseña</h1>
        <p className="text-xs text-neutral-500 text-center">Crea una contraseña segura para tu cuenta del SEP.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Nueva clave */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Nueva contraseña</label>
          <div className="relative">
            <input
              type={showClave ? 'text' : 'password'}
              value={clave}
              onChange={e => { setClave(e.target.value); setError('') }}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              className="w-full border border-neutral-200 rounded-lg px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
            <button
              type="button"
              onClick={() => setShowClave(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showClave ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {/* Indicador longitud */}
          {clave.length > 0 && (
            <p className={`text-[11px] ${minLen ? 'text-green-600' : 'text-red-500'}`}>
              {minLen ? '✓ Longitud correcta' : `Faltan ${6 - clave.length} caracteres`}
            </p>
          )}
        </div>

        {/* Confirmar clave */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Confirmar contraseña</label>
          <input
            type={showClave ? 'text' : 'password'}
            value={clave2}
            onChange={e => { setClave2(e.target.value); setError('') }}
            placeholder="Repite la contraseña"
            autoComplete="new-password"
            className="w-full border border-neutral-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
          />
          {clave2.length > 0 && (
            <p className={`text-[11px] ${coinciden ? 'text-green-600' : 'text-red-500'}`}>
              {coinciden ? '✓ Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
            </p>
          )}
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
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
          className="w-full bg-[#00304D] hover:bg-[#004a76] disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mt-1 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
        </button>
      </form>
    </div>
  )
}

export default function RestablecerContrasenaPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-sm flex flex-col gap-6">
          <Link href="/login" className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-green-600 transition-colors w-fit">
            <ArrowLeft size={14} /> Volver al inicio de sesión
          </Link>

          <Suspense fallback={
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-md p-8 flex justify-center">
              <Loader2 size={24} className="animate-spin text-neutral-400" />
            </div>
          }>
            <RestablecerForm />
          </Suspense>
        </div>
      </div>
  )
}
