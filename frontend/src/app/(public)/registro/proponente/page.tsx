'use client'

import { CabeceraPagina } from '@/components/public/cabecera-pagina'
import { CampoClave } from '@/components/public/campo-clave'
import { HabeasDataModal } from '@/components/public/registro/habeas-data-modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import api from '@/lib/api'
import { AlertCircle, ArrowLeft, Building2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface TipoDoc { id: number; nombre: string; sigla: string }

const ETIQUETA = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500'
const CAMPO = 'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm transition focus:border-cerulean-500 focus:outline-none focus:ring-2 focus:ring-cerulean-500/30'
function Subtitulo({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="h-4 w-1 rounded-full bg-lime-500" aria-hidden="true" />
      <h2 className="text-xs font-bold uppercase tracking-wide text-cerulean-500">{children}</h2>
    </div>
  )
}

export default function RegistroProponentePage() {
  const router = useRouter()
  const [habeasOpen, setHabeasOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(false)
  const [tiposDoc, setTiposDoc] = useState<TipoDoc[]>([])

  useEffect(() => {
    api.get<TipoDoc[]>('/auth/tipos-documento?para=empresa')
      .then((r) => {
        setTiposDoc(r.data)
        if (r.data.length > 0) setForm((prev) => ({ ...prev, tipoDocumentoIdentidadId: r.data[0].id }))
      })
      .catch(() => {})
  }, [])

  const [form, setForm] = useState({
    tipoDocumentoIdentidadId: 0,
    empresaIdentificacion: '',
    empresaDigitoVerificacion: '',
    empresaRazonSocial: '',
    empresaSigla: '',
    usuarioEmail: '',
    usuarioClave: '',
    habeasData: false,
  })

  function set(field: string, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.empresaIdentificacion || !form.empresaRazonSocial || !form.usuarioEmail || !form.usuarioClave) {
      setError('Por favor completa todos los campos obligatorios (*).')
      return
    }
    if (!form.habeasData) {
      setError('Debes aceptar los Términos y Condiciones de Habeas Data.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/registrar-empresa', {
        tipoDocumentoIdentidadId: form.tipoDocumentoIdentidadId,
        empresaIdentificacion: Number(form.empresaIdentificacion),
        empresaDigitoVerificacion: Number(form.empresaDigitoVerificacion) || 0,
        empresaRazonSocial: form.empresaRazonSocial,
        empresaSigla: form.empresaSigla || form.empresaRazonSocial.substring(0, 10),
        usuarioEmail: form.usuarioEmail,
        usuarioClave: form.usuarioClave,
        habeasData: true,
      })
      setToast(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Error al registrar. Verifique los datos e intente nuevamente.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <CabeceraPagina
        icono={Building2}
        titulo="Registrarse como proponente"
        descripcion="Crea la cuenta de tu empresa, gremio o asociación para presentar proyectos en las convocatorias del SENA."
      />

      <div className="mx-auto w-full max-w-3xl px-6 pb-14 pt-2">
        <Link
          href="/login"
          className="mb-5 inline-flex w-fit items-center gap-1.5 text-xs text-neutral-500 transition hover:text-cerulean-500"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Volver al inicio de sesión
        </Link>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Subtitulo>Datos de la entidad</Subtitulo></div>

            <div>
              <label htmlFor="tipoDoc" className={ETIQUETA}>
                Tipo de identificación <span className="text-lime-500">*</span>
              </label>
              <select
                id="tipoDoc"
                value={form.tipoDocumentoIdentidadId}
                onChange={(e) => set('tipoDocumentoIdentidadId', Number(e.target.value))}
                className={CAMPO}
              >
                {tiposDoc.length === 0 && <option value={0}>Cargando...</option>}
                {tiposDoc.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre} {t.sigla ? `(${t.sigla})` : ''}</option>
                ))}
              </select>
            </div>

            {/* el digito de verificacion va pegado al numero, ocupa un tercio */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label htmlFor="identificacion" className={ETIQUETA}>
                  N.° de identificación <span className="text-lime-500">*</span>
                </label>
                <input
                  id="identificacion"
                  type="number"
                  value={form.empresaIdentificacion}
                  onChange={(e) => set('empresaIdentificacion', e.target.value)}
                  placeholder="900123456"
                  className={CAMPO}
                />
              </div>
              <div>
                <label htmlFor="digito" className={ETIQUETA}>Dígito</label>
                <input
                  id="digito"
                  type="number"
                  value={form.empresaDigitoVerificacion}
                  onChange={(e) => set('empresaDigitoVerificacion', e.target.value)}
                  placeholder="7"
                  min={0} max={9}
                  className={CAMPO}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="razonSocial" className={ETIQUETA}>
                Razón social <span className="text-lime-500">*</span>
              </label>
              <input
                id="razonSocial"
                type="text"
                value={form.empresaRazonSocial}
                onChange={(e) => set('empresaRazonSocial', e.target.value)}
                placeholder="EMPRESA EJEMPLO S.A.S."
                className={CAMPO}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="sigla" className={ETIQUETA}>Sigla o nombre corto</label>
              <input
                id="sigla"
                type="text"
                value={form.empresaSigla}
                onChange={(e) => set('empresaSigla', e.target.value)}
                placeholder="EE SAS (opcional)"
                className={CAMPO}
              />
            </div>

            <div className="mt-2 sm:col-span-2"><Subtitulo>Datos de acceso</Subtitulo></div>

            <div className="sm:col-span-2">
              <label htmlFor="correo" className={ETIQUETA}>
                Correo electrónico <span className="text-lime-500">*</span>
              </label>
              <input
                id="correo"
                type="email"
                value={form.usuarioEmail}
                onChange={(e) => set('usuarioEmail', e.target.value)}
                placeholder="empresa@ejemplo.com"
                autoComplete="email"
                className={CAMPO}
              />
            </div>

            <div>
              <label htmlFor="clave" className={ETIQUETA}>
                Contraseña <span className="text-lime-500">*</span>
              </label>
              <CampoClave
                id="clave"
                value={form.usuarioClave}
                onChange={(v) => set('usuarioClave', v)}
                autoComplete="new-password"
              />
            </div>

            <p className="self-end pb-2.5 text-xs leading-relaxed text-neutral-500">
              Usa mínimo 8 caracteres; combina letras, números y símbolos.
            </p>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <input
              id="habeas"
              type="checkbox"
              checked={form.habeasData}
              onChange={(e) => set('habeasData', e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-lime-500"
            />
            <label htmlFor="habeas" className="cursor-pointer text-xs leading-relaxed text-neutral-600">
              Acepto los Términos y Condiciones y autorizo el tratamiento de mis datos personales
              conforme a la Ley 1581 de 2012.{' '}
              <button
                type="button"
                onClick={() => setHabeasOpen(true)}
                className="font-semibold text-cerulean-500 underline hover:text-cerulean-700"
              >
                Ver Habeas Data
              </button>
            </label>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-6 py-2.5 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-50"
            >
              Volver
            </Link>
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-lime-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
            >
              {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              {loading ? 'Registrando...' : 'Registrarse'}
            </button>
          </div>
        </form>
      </div>

      <ToastBetowa
        show={toast}
        onClose={() => setToast(false)}
        tipo="success"
        titulo="¡Registro exitoso!"
        mensaje="Tu cuenta de proponente fue creada. Serás redirigido al inicio de sesión."
        duration={5000}
      />
      <HabeasDataModal open={habeasOpen} onClose={() => setHabeasOpen(false)} />
    </>
  )
}
