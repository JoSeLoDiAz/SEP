'use client'

import api from '@/lib/api'
import { getSepUsuario } from '@/lib/auth'
import { AlertTriangle, Check, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'
// el cifrado del SEP trabaja sobre un bloque de 16 bytes
const MAX = 16
const MIN = 6

export default function MiClavePage() {
  const router = useRouter()
  const usuario = getSepUsuario()

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [verActual, setVerActual] = useState(false)
  const [verNueva, setVerNueva] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null)

  const largoOk = nueva.length >= MIN && new Blob([nueva]).size <= MAX
  const sinEspacios = nueva === nueva.trim() && nueva !== ''
  const distinta = nueva !== '' && nueva !== actual
  const coinciden = nueva !== '' && nueva === repetida
  const listo = actual !== '' && largoOk && sinEspacios && distinta && coinciden

  async function guardar() {
    if (!listo) return
    setGuardando(true)
    setAviso(null)
    try {
      const r = await api.put<{ message: string }>('/auth/mi-clave', {
        claveActual: actual,
        nuevaClave: nueva,
      })
      setAviso({ tipo: 'ok', msg: r.data.message })
      setActual(''); setNueva(''); setRepetida('')
    } catch (err) {
      const e = err as { response?: { data?: { message?: string | string[] } } }
      const m = e?.response?.data?.message
      setAviso({ tipo: 'error', msg: Array.isArray(m) ? m[0] : m ?? 'No se pudo cambiar la contraseña' })
    } finally {
      setGuardando(false)
    }
  }

  const campo = 'w-full rounded-lg border border-neutral-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40'
  const etiqueta = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500'

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ backgroundColor: `${PRIMARY}12` }}>
          <KeyRound size={19} style={{ color: PRIMARY }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: PRIMARY }}>Cambiar mi contraseña</h1>
          <p className="text-[12px] text-neutral-500">{usuario?.email ?? ''}</p>
        </div>
      </div>

      {aviso && (
        <p className={`mb-5 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[13px] ${
          aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
        }`}>
          {aviso.tipo === 'ok'
            ? <Check size={15} className="mt-0.5 shrink-0" />
            : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          {aviso.msg}
        </p>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <label className={etiqueta} htmlFor="actual">Contraseña actual</label>
          <div className="relative">
            <input
              id="actual"
              type={verActual ? 'text' : 'password'}
              value={actual}
              onChange={e => setActual(e.target.value)}
              autoComplete="current-password"
              className={campo}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setVerActual(v => !v)}
              aria-label={verActual ? 'Ocultar' : 'Mostrar'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:text-neutral-600"
            >
              {verActual ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className={etiqueta} htmlFor="nueva">Contraseña nueva</label>
          <div className="relative">
            <input
              id="nueva"
              type={verNueva ? 'text' : 'password'}
              value={nueva}
              onChange={e => setNueva(e.target.value)}
              autoComplete="new-password"
              maxLength={MAX}
              className={campo}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setVerNueva(v => !v)}
              aria-label={verNueva ? 'Ocultar' : 'Mostrar'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:text-neutral-600"
            >
              {verNueva ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            <Regla ok={largoOk} texto={`Entre ${MIN} y ${MAX} caracteres`} />
            <Regla ok={sinEspacios} texto="Sin espacios al principio ni al final" />
            <Regla ok={distinta} texto="Distinta de la actual" />
          </ul>
        </div>

        <div className="mb-5">
          <label className={etiqueta} htmlFor="repetida">Repite la nueva</label>
          <input
            id="repetida"
            type={verNueva ? 'text' : 'password'}
            value={repetida}
            onChange={e => setRepetida(e.target.value)}
            autoComplete="new-password"
            maxLength={MAX}
            onKeyDown={e => { if (e.key === 'Enter' && listo) void guardar() }}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
          />
          {repetida !== '' && !coinciden && (
            <p className="mt-1.5 text-[12px] text-red-600">Las dos no coinciden.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={guardar}
            disabled={!listo || guardando}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: INSTITUTIONAL }}
          >
            {guardando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Guardar
          </button>
          <button
            onClick={() => router.back()}
            className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Volver
          </button>
        </div>
      </div>

      <p className="mt-4 text-[12px] text-neutral-500">
        Si no recuerdas la actual, cierra sesión y usa <span className="font-semibold">¿Olvidaste tu
        contraseña?</span> en la pantalla de ingreso.
      </p>
    </div>
  )
}

function Regla({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-[12px] ${ok ? 'text-emerald-700' : 'text-neutral-500'}`}>
      <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
        ok ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-400'
      }`}>
        {ok ? '✓' : ''}
      </span>
      {texto}
    </li>
  )
}
