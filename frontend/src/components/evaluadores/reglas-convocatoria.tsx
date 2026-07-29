'use client'

import api from '@/lib/api'
import { AlertTriangle, Award, CheckCircle2, Loader2, Save, Target, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

/**
 * Reglas del ciclo: notas de corte y certificación.
 *
 * Vivía solo en el backend. Sin esta pantalla la gestora no podía poner los
 * cortes —y quedaban en null, con lo que ninguna prueba se marcaba aprobada—
 * ni habilitar la emisión, con lo que el botón "Emitir certificado" respondía
 * siempre "la convocatoria todavía no habilitó la emisión". Estaba construida
 * la mitad de arriba del embudo y faltaba la salida.
 */

export interface ReglasConvocatoria {
  puntajeMinimoPrueba: number | null
  calificacionMinimaCurso: number | null
  certificadoTexto: string | null
  certificadoFirmaId: number | null
  certificadoHabilitado: boolean
}

interface Firma { id: number; nombre: string; cargo: string | null; tieneImagen: boolean }
interface Pendiente { participacionId: number; nombre: string; rol: string | null }
interface ResultadoLote {
  total: number
  emitidos: Array<{ participacionId: number; nombre: string; consecutivo: number }>
  omitidos: Array<{ participacionId: number; nombre: string; motivo: string }>
}
type SetToast = (t: { tipo: 'success' | 'error'; msg: string }) => void

const etiqueta = 'block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
const control = 'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#00304D]/40 disabled:bg-neutral-50 disabled:text-neutral-400'

function mensajeError(err: unknown, porDefecto: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? porDefecto
}

export function ReglasDelCiclo({
  convocatoriaId, reglas, onChanged, setToast,
}: {
  convocatoriaId: number
  reglas: ReglasConvocatoria
  onChanged: () => void
  setToast: SetToast
}) {
  const [puntaje, setPuntaje] = useState(reglas.puntajeMinimoPrueba?.toString() ?? '')
  const [curso, setCurso] = useState(reglas.calificacionMinimaCurso?.toString() ?? '')
  const [texto, setTexto] = useState(reglas.certificadoTexto ?? '')
  const [firmaId, setFirmaId] = useState(reglas.certificadoFirmaId?.toString() ?? '')
  const [habilitado, setHabilitado] = useState(reglas.certificadoHabilitado)
  const [guardando, setGuardando] = useState(false)

  const [firmas, setFirmas] = useState<Firma[]>([])
  const [pendientes, setPendientes] = useState<Pendiente[] | null>(null)
  const [cargandoPend, setCargandoPend] = useState(false)
  const [emitiendo, setEmitiendo] = useState(false)
  const [resultado, setResultado] = useState<ResultadoLote | null>(null)

  useEffect(() => {
    let vivo = true
    api.get<Firma[]>('/evaluadores/catalogos/firmas')
      .then(r => { if (vivo) setFirmas(r.data) })
      // Sin firmas el certificado sale sin rúbrica, pero se puede emitir: el
      // select queda vacío y no se bloquea el resto de la pantalla.
      .catch(() => { if (vivo) setFirmas([]) })
    return () => { vivo = false }
  }, [])

  // Se resincroniza cuando el padre recarga la convocatoria tras guardar.
  useEffect(() => {
    setPuntaje(reglas.puntajeMinimoPrueba?.toString() ?? '')
    setCurso(reglas.calificacionMinimaCurso?.toString() ?? '')
    setTexto(reglas.certificadoTexto ?? '')
    setFirmaId(reglas.certificadoFirmaId?.toString() ?? '')
    setHabilitado(reglas.certificadoHabilitado)
  }, [reglas])

  const numeroONulo = (v: string) => {
    const t = v.trim()
    if (!t) return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }

  async function guardar() {
    // Se valida antes de mandar: un corte fuera de rango no rompe nada en la
    // base, pero deja un ciclo donde nadie aprueba nunca y eso no se nota
    // hasta que alguien reclama su certificado.
    const p = numeroONulo(puntaje)
    if (puntaje.trim() && (p == null || p < 0 || p > 100)) {
      return setToast({ tipo: 'error', msg: 'El puntaje mínimo debe estar entre 0 y 100' })
    }
    const c = numeroONulo(curso)
    if (curso.trim() && (c == null || c < 0 || c > 5)) {
      return setToast({ tipo: 'error', msg: 'La calificación mínima del curso debe estar entre 0 y 5' })
    }

    setGuardando(true)
    try {
      await api.put(`/evaluadores/convocatorias/${convocatoriaId}`, {
        puntajeMinimoPrueba: p,
        calificacionMinimaCurso: c,
        certificadoTexto: texto.trim() || null,
        certificadoFirmaId: numeroONulo(firmaId),
        certificadoHabilitado: habilitado,
      })
      setToast({ tipo: 'success', msg: 'Reglas del ciclo actualizadas' })
      onChanged()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudieron guardar las reglas') })
    } finally {
      setGuardando(false)
    }
  }

  async function verPendientes() {
    setCargandoPend(true)
    setResultado(null)
    try {
      const r = await api.get<Pendiente[]>(`/evaluadores/certificados/lote/${convocatoriaId}`)
      setPendientes(r.data)
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo consultar quiénes están listos') })
    } finally {
      setCargandoPend(false)
    }
  }

  async function emitirLote() {
    setEmitiendo(true)
    try {
      const r = await api.post<ResultadoLote>(`/evaluadores/certificados/lote/${convocatoriaId}`, {})
      setResultado(r.data)
      setPendientes(null)
      setToast({
        tipo: 'success',
        msg: `${r.data.emitidos.length} certificado(s) emitido(s)` +
          (r.data.omitidos.length ? ` · ${r.data.omitidos.length} omitido(s)` : ''),
      })
      onChanged()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo emitir el lote') })
    } finally {
      setEmitiendo(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Notas de corte ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3.5">
          <Target size={16} style={{ color: PRIMARY }} />
          <h2 className="text-sm font-bold" style={{ color: PRIMARY }}>Notas de corte del ciclo</h2>
        </header>
        <div className="px-5 py-4">
          <p className="mb-4 text-[12px] text-neutral-500">
            Se congelan en cada registro en el momento de cargarlo. Si el año siguiente cambian,
            lo ya cargado conserva la nota con la que se evaluó — por eso conviene ponerlas
            <strong> antes</strong> de empezar a registrar pruebas y cursos.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={etiqueta}>Puntaje mínimo de la prueba (0 a 100)</label>
              <input
                type="number" min={0} max={100} value={puntaje}
                onChange={e => setPuntaje(e.target.value)}
                placeholder="Ej. 80" className={control}
              />
            </div>
            <div>
              <label className={etiqueta}>Calificación mínima del curso (0 a 5)</label>
              <input
                type="number" min={0} max={5} step="0.1" value={curso}
                onChange={e => setCurso(e.target.value)}
                placeholder="Ej. 3.5" className={control}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Certificación ──────────────────────────────────────────── */}
      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3.5">
          <Award size={16} style={{ color: PRIMARY }} />
          <h2 className="text-sm font-bold" style={{ color: PRIMARY }}>Certificación</h2>
        </header>
        <div className="px-5 py-4">
          <button
            type="button"
            onClick={() => setHabilitado(v => !v)}
            className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
              habilitado
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100'
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition ${
                habilitado ? 'justify-end' : 'justify-start'
              }`}
              style={{ backgroundColor: habilitado ? INSTITUTIONAL : '#cbd5e1' }}
            >
              <span className="h-4 w-4 rounded-full bg-white shadow" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-neutral-800">
                {habilitado ? 'Emisión de certificados habilitada' : 'Emisión de certificados bloqueada'}
              </span>
              <span className="block text-[12px] text-neutral-500">
                {habilitado
                  ? 'Se pueden emitir certificados de este ciclo.'
                  : 'Actívela cuando el proceso haya cerrado. Mientras esté bloqueada, el botón de emitir responderá con un error.'}
              </span>
            </span>
          </button>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <div>
              <label className={etiqueta}>Firma que avala el certificado</label>
              <select value={firmaId} onChange={e => setFirmaId(e.target.value)} className={control}>
                <option value="">Sin firma</option>
                {firmas.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}{f.cargo ? ` — ${f.cargo}` : ''}{f.tieneImagen ? '' : ' (sin imagen)'}
                  </option>
                ))}
              </select>
              {firmas.length === 0 && (
                <p className="mt-1 text-[11px] text-amber-700">
                  No hay firmas registradas. El certificado saldrá sin rúbrica.
                </p>
              )}
            </div>
            <div>
              <label className={etiqueta}>Texto del certificado (opcional)</label>
              <textarea
                value={texto} onChange={e => setTexto(e.target.value)} rows={3}
                placeholder="Si se deja vacío, se usa el texto estándar del sistema."
                className={control}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={guardar} disabled={guardando}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: PRIMARY }}
        >
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Guardar reglas
        </button>
      </div>

      {/* ── Emisión en lote ────────────────────────────────────────── */}
      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3.5">
          <Users size={16} style={{ color: PRIMARY }} />
          <h2 className="text-sm font-bold" style={{ color: PRIMARY }}>Emitir certificados de todo el ciclo</h2>
        </header>
        <div className="px-5 py-4">
          {!reglas.certificadoHabilitado && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-[12px] text-amber-900">
                La emisión está bloqueada. Habilítela arriba y guarde antes de emitir.
              </p>
            </div>
          )}
          <p className="mb-4 text-[12px] text-neutral-500">
            Revise primero quiénes están al día. Al emitir, el sistema certifica a todos los que
            cumplen y le devuelve la lista de los que quedaron por fuera, con el motivo de cada uno.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={verPendientes} disabled={cargandoPend}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              {cargandoPend ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
              Ver quiénes están listos
            </button>
            <button
              onClick={emitirLote}
              disabled={emitiendo || !reglas.certificadoHabilitado}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: INSTITUTIONAL }}
            >
              {emitiendo ? <Loader2 size={14} className="animate-spin" /> : <Award size={14} />}
              Emitir a todos
            </button>
          </div>

          {pendientes && (
            <div className="mt-4 rounded-xl border border-neutral-200">
              <p className="border-b border-neutral-100 px-4 py-2.5 text-[12px] font-semibold text-neutral-700">
                {pendientes.length === 0
                  ? 'Nadie está pendiente de certificado en este ciclo.'
                  : `${pendientes.length} evaluador(es) sin certificado vigente`}
              </p>
              {pendientes.length > 0 && (
                <ul className="max-h-64 divide-y divide-neutral-100 overflow-y-auto">
                  {pendientes.map(p => (
                    <li key={p.participacionId} className="flex items-center justify-between px-4 py-2 text-[13px]">
                      <span className="text-neutral-800">{p.nombre}</span>
                      <span className="text-[11px] text-neutral-400">{p.rol ?? 'Sin rol'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {resultado && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <p className="text-[12px] text-emerald-900">
                  {resultado.emitidos.length} de {resultado.total} certificado(s) emitido(s).
                </p>
              </div>
              {resultado.omitidos.length > 0 && (
                <div className="rounded-xl border border-amber-200">
                  <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[12px] font-semibold text-amber-900">
                    {resultado.omitidos.length} quedaron por fuera
                  </p>
                  <ul className="max-h-64 divide-y divide-neutral-100 overflow-y-auto">
                    {resultado.omitidos.map(o => (
                      <li key={o.participacionId} className="px-4 py-2 text-[12px]">
                        <span className="font-medium text-neutral-800">{o.nombre}</span>
                        <span className="block text-[11px] text-neutral-500">{o.motivo}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
