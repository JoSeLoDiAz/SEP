'use client'

import api from '@/lib/api'
import { getSepUsuario } from '@/lib/auth'
import { AlertTriangle, Check, Copy, History, Loader2, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'
const PERFILES_GESTION = [1, 2, 15]

const TIPOS: Array<{ id: string; etiqueta: string; ayuda: string }> = [
  { id: 'ESCALA', etiqueta: 'Nota', ayuda: 'se responde con un número de la escala' },
  { id: 'TEXTO_POR_PERSONA', etiqueta: 'Texto sobre la persona', ayuda: 'por ejemplo SÍ / NO, Presencial / PAT' },
  { id: 'TEXTO_GENERAL', etiqueta: 'Texto sobre el proceso', ayuda: 'no se guarda por persona sino del ciclo' },
]

interface Pregunta {
  preguntaId: number
  numero: number
  texto: string
  tipo: string
  requerida: boolean
}
interface Modelo {
  convocatoriaId: number
  anio: number
  convocatoria: string
  preguntas: number
}
interface Instrumento {
  anio: number
  convocatoriaId: number
  convocatoria: string | null
  escalaMin: number
  escalaMax: number
  preguntas: Pregunta[]
  faltaRegistrarPreguntas: boolean
  modelos: Modelo[]
}
interface Companero {
  participacionId: number
  evaluadorId: number
  nombre: string
  identificacion: string | null
  rol: string | null
  area: string | null
}
interface Registrada {
  respuestaId: number
  evaluadorParticipacionId: number
  promedio: number | null
  fecha: string | null
  califico: string
  historica: boolean
}

// sugerencias segun lo que pregunta la hoja: son un atajo, el campo sigue siendo libre
function atajos(texto: string): string[] {
  const t = texto.toLowerCase()
  if (t.includes('presencial') || t.includes('pat')) return ['Presencial', 'PAT']
  if (t.includes('recomend')) return ['SÍ', 'NO']
  return []
}

// cargue a mano de las retroalimentaciones de los anios anteriores, desde las hojas del GGPC
export function CargueRetroHistorica({
  participacionId, anio, onRecargar,
}: {
  participacionId: number
  anio: number
  onRecargar: () => void
}) {
  const perfilId = getSepUsuario()?.perfilId ?? 0
  const puede = PERFILES_GESTION.includes(perfilId) && anio < 2026

  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [instrumento, setInstrumento] = useState<Instrumento | null>(null)
  const [companeros, setCompaneros] = useState<Companero[]>([])
  const [registradas, setRegistradas] = useState<Registrada[]>([])
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null)

  async function traer() {
    setCargando(true)
    setError(null)
    try {
      const [i, c, r] = await Promise.all([
        api.get<Instrumento>(`/retroalimentacion/historico/participaciones/${participacionId}/instrumento`),
        api.get<Companero[]>(`/retroalimentacion/historico/participaciones/${participacionId}/companeros`),
        api.get<Registrada[]>(`/retroalimentacion/historico/participaciones/${participacionId}/registradas`),
      ])
      setInstrumento(i.data)
      setCompaneros(c.data)
      setRegistradas(r.data)
    } catch (err) {
      setError(mensaje(err, 'No se pudo abrir el cargue del histórico'))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (!puede || !abierto) return
    void traer()
    // traer() depende solo de estos dos: el resto son setters estables
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puede, abierto, participacionId])

  if (!puede) return null

  return (
    <div className="mx-5 mb-5 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60">
      <button
        onClick={() => setAbierto(v => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <History size={16} className="text-neutral-500" />
        <span className="text-[13px] font-semibold text-neutral-700">
          Cargar la retroalimentación de {anio}
        </span>
        <span className="ml-auto text-[11px] text-neutral-500">{abierto ? 'Ocultar' : 'Abrir'}</span>
      </button>

      {abierto && (
        <div className="border-t border-neutral-200 px-4 py-4">
          <p className="text-[12px] text-neutral-600">
            {anio} nunca se diligenció en el sistema. Aquí se transcribe lo que quedó en la hoja
            de <span className="font-semibold">{instrumento?.convocatoria ?? 'esa convocatoria'}</span>,
            indicando en cada caso quién hizo la evaluación.
          </p>

          {cargando && (
            <p className="mt-4 flex items-center gap-2 text-[12px] text-neutral-500">
              <Loader2 size={14} className="animate-spin" /> Cargando…
            </p>
          )}

          {error && <Nota tipo="error" texto={error} />}
          {aviso && <Nota tipo={aviso.tipo} texto={aviso.msg} />}

          {instrumento && !cargando && (
            instrumento.faltaRegistrarPreguntas ? (
              <RegistroDePreguntas
                instrumento={instrumento}
                onListo={async msg => {
                  setAviso({ tipo: 'ok', msg })
                  await traer()
                }}
                onError={msg => setAviso({ tipo: 'error', msg })}
              />
            ) : (
              <CargueDeNotas
                participacionId={participacionId}
                instrumento={instrumento}
                companeros={companeros}
                registradas={registradas}
                setRegistradas={setRegistradas}
                setAviso={setAviso}
                onRecargar={onRecargar}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

// paso previo: cada convocatoria tuvo su propia hoja, asi que hay que registrarla antes de cargar
function RegistroDePreguntas({
  instrumento, onListo, onError,
}: {
  instrumento: Instrumento
  onListo: (msg: string) => Promise<void>
  onError: (msg: string) => void
}) {
  const [filas, setFilas] = useState<Array<{ texto: string; tipo: string }>>([
    { texto: '', tipo: 'ESCALA' },
  ])
  const [guardando, setGuardando] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const [origen, setOrigen] = useState('')

  const listas = filas.filter(f => f.texto.trim() !== '')
  const completo = listas.length > 0 && listas.some(f => f.tipo === 'ESCALA')

  async function guardar() {
    setGuardando(true)
    try {
      const r = await api.put<{ message: string }>(
        `/retroalimentacion/historico/convocatorias/${instrumento.convocatoriaId}/preguntas`,
        { preguntas: listas })
      await onListo(r.data.message)
    } catch (err) {
      onError(mensaje(err, 'No se pudieron guardar las preguntas'))
    } finally {
      setGuardando(false)
    }
  }

  async function copiar() {
    if (!origen) return
    setCopiando(true)
    try {
      const r = await api.post<{ message: string }>(
        `/retroalimentacion/historico/convocatorias/${instrumento.convocatoriaId}/preguntas/copiar`,
        { origenConvocatoriaId: Number(origen) })
      await onListo(r.data.message)
    } catch (err) {
      onError(mensaje(err, 'No se pudieron copiar las preguntas'))
    } finally {
      setCopiando(false)
    }
  }

  return (
    <div className="mt-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-900">
          <AlertTriangle size={15} /> Falta registrar las preguntas de {instrumento.anio}
        </p>
        <p className="mt-1 text-[12px] text-amber-800">
          La hoja cambió de un proceso a otro, así que las preguntas se guardan en cada
          convocatoria. Regístrelas una sola vez y quedan fijas para
          {' '}{instrumento.convocatoria ?? 'esta convocatoria'}.
        </p>
        <ol className="mt-3 space-y-1.5 text-[12px] text-amber-900">
          <li><span className="font-semibold">1.</span> Abra la hoja de retroalimentación que llenó el equipo ese año.</li>
          <li><span className="font-semibold">2.</span> Copie cada pregunta tal como está escrita, en el mismo orden.</li>
          <li><span className="font-semibold">3.</span> Marque si se respondía con una nota de {instrumento.escalaMin} a {instrumento.escalaMax} o con texto.</li>
          <li><span className="font-semibold">4.</span> Guarde. Desde ahí ya puede cargar las notas de cada persona.</li>
        </ol>
      </div>

      {instrumento.modelos.length > 0 && (
        <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Si la hoja fue la misma de otro proceso, cópiela
            </label>
            <select
              value={origen}
              onChange={e => setOrigen(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
            >
              <option value="">Seleccione la convocatoria…</option>
              {instrumento.modelos.map(m => (
                <option key={m.convocatoriaId} value={m.convocatoriaId}>
                  {m.anio} · {m.convocatoria} ({m.preguntas} preguntas)
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={copiar}
            disabled={!origen || copiando}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-[13px] font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copiando ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
            Copiar
          </button>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Preguntas de la hoja de {instrumento.anio}
        </p>
        <ul className="mt-2 space-y-2">
          {filas.map((f, i) => (
            <li key={i} className="flex flex-wrap items-start gap-2">
              <span className="mt-2 w-4 text-[12px] font-bold text-neutral-400">{i + 1}</span>
              <textarea
                value={f.texto}
                onChange={e => setFilas(v => v.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))}
                rows={2}
                placeholder="Escriba la pregunta tal como está en la hoja"
                className="min-w-[240px] flex-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
              />
              <select
                value={f.tipo}
                onChange={e => setFilas(v => v.map((x, j) => j === i ? { ...x, tipo: e.target.value } : x))}
                className="mt-0.5 rounded-lg border border-neutral-300 px-2 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
                title={TIPOS.find(t => t.id === f.tipo)?.ayuda}
              >
                {TIPOS.map(t => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
              </select>
              <button
                onClick={() => setFilas(v => v.length === 1 ? v : v.filter((_, j) => j !== i))}
                disabled={filas.length === 1}
                className="mt-1 rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-30"
                aria-label="Quitar la pregunta"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>

        <button
          onClick={() => setFilas(v => [...v, { texto: '', tipo: 'ESCALA' }])}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-[12px] font-semibold text-neutral-700 transition hover:bg-neutral-50"
        >
          <Plus size={14} /> Otra pregunta
        </button>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-3">
          <button
            onClick={guardar}
            disabled={!completo || guardando}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: INSTITUTIONAL }}
          >
            {guardando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Guardar las preguntas
          </button>
          {!completo && (
            <span className="text-[11px] text-neutral-500">
              Escriba al menos una pregunta, y que una de ellas sea de nota.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ya con las preguntas registradas: se transcribe lo que puso cada evaluador
function CargueDeNotas({
  participacionId, instrumento, companeros, registradas, setRegistradas, setAviso, onRecargar,
}: {
  participacionId: number
  instrumento: Instrumento
  companeros: Companero[]
  registradas: Registrada[]
  setRegistradas: (r: Registrada[]) => void
  setAviso: (a: { tipo: 'ok' | 'error'; msg: string } | null) => void
  onRecargar: () => void
}) {
  const [formulario, setFormulario] = useState(false)
  const [califico, setCalifico] = useState('')
  const [escalas, setEscalas] = useState<Record<string, number>>({})
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  // quien ya califico no vuelve a la lista, y nadie se califica a si mismo
  const disponibles = useMemo(() => {
    const usados = new Set(registradas.map(r => r.evaluadorParticipacionId))
    return companeros.filter(c => c.participacionId !== participacionId && !usados.has(c.participacionId))
  }, [companeros, registradas, participacionId])

  const escalaPreguntas = instrumento.preguntas.filter(p => p.tipo === 'ESCALA')
  const textoPreguntas = instrumento.preguntas.filter(p => p.tipo !== 'ESCALA')
  const completo = califico !== '' && escalaPreguntas.every(p => escalas[String(p.numero)] != null)

  function limpiar() {
    setCalifico('')
    setEscalas({})
    setTextos({})
  }

  async function guardar() {
    if (!completo) return
    setGuardando(true)
    setAviso(null)
    try {
      await api.post('/retroalimentacion/historico', {
        evaluadorParticipacionId: Number(califico),
        evaluadoParticipacionId: participacionId,
        escalas,
        textos,
      })
      const r = await api.get<Registrada[]>(
        `/retroalimentacion/historico/participaciones/${participacionId}/registradas`)
      setRegistradas(r.data)
      setAviso({ tipo: 'ok', msg: 'Retroalimentación registrada' })
      limpiar()
      setFormulario(false)
      onRecargar()
    } catch (err) {
      setAviso({ tipo: 'error', msg: mensaje(err, 'No se pudo registrar') })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      {registradas.length > 0 && (
        <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {registradas.map(r => (
            <li key={r.respuestaId} className="flex items-center gap-3 px-3 py-2">
              <Check size={14} className="shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-700">{r.califico}</span>
              {r.historica && (
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">
                  histórico
                </span>
              )}
              <span className="text-[12px] font-bold" style={{ color: PRIMARY }}>
                {r.promedio != null ? `${r.promedio} / ${instrumento.escalaMax}` : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!formulario ? (
        <button
          onClick={() => { setFormulario(true); setAviso(null) }}
          disabled={disponibles.length === 0}
          className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: INSTITUTIONAL }}
        >
          <Plus size={15} /> Registrar quién evaluó
        </button>
      ) : (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Quién hizo esta evaluación
              </label>
              <select
                value={califico}
                onChange={e => setCalifico(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
              >
                <option value="">Seleccione a la persona…</option>
                {disponibles.map(c => (
                  <option key={c.participacionId} value={c.participacionId}>
                    {c.nombre}{c.rol ? ` · ${c.rol}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => { setFormulario(false); limpiar() }}
              className="mt-5 rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="Cancelar"
            >
              <X size={16} />
            </button>
          </div>

          <ul className="mt-4 space-y-3">
            {escalaPreguntas.map(p => (
              <li key={p.preguntaId}>
                <p className="text-[12px] text-neutral-700">
                  <span className="font-semibold">{p.numero}.</span> {p.texto}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {rango(instrumento.escalaMin, instrumento.escalaMax).map(n => {
                    const activo = escalas[String(p.numero)] === n
                    return (
                      <button
                        key={n}
                        onClick={() => setEscalas(s => ({ ...s, [String(p.numero)]: n }))}
                        className={`h-8 w-8 rounded-lg border text-[13px] font-bold transition ${
                          activo
                            ? 'border-transparent text-white'
                            : 'border-neutral-300 text-neutral-600 hover:border-neutral-400'
                        }`}
                        style={activo ? { backgroundColor: PRIMARY } : undefined}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
              </li>
            ))}

            {textoPreguntas.map(p => (
              <li key={p.preguntaId}>
                <p className="text-[12px] text-neutral-700">
                  <span className="font-semibold">{p.numero}.</span> {p.texto}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {atajos(p.texto).map(s => (
                    <button
                      key={s}
                      onClick={() => setTextos(t => ({ ...t, [String(p.numero)]: s }))}
                      className={`rounded-lg border px-2.5 py-1 text-[12px] font-semibold transition ${
                        textos[String(p.numero)] === s
                          ? 'border-transparent text-white'
                          : 'border-neutral-300 text-neutral-600 hover:border-neutral-400'
                      }`}
                      style={textos[String(p.numero)] === s ? { backgroundColor: PRIMARY } : undefined}
                    >
                      {s}
                    </button>
                  ))}
                  <input
                    value={textos[String(p.numero)] ?? ''}
                    onChange={e => setTextos(t => ({ ...t, [String(p.numero)]: e.target.value }))}
                    placeholder="Escriba la respuesta tal como está en la hoja"
                    className="min-w-[200px] flex-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={guardar}
              disabled={!completo || guardando}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: INSTITUTIONAL }}
            >
              {guardando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Guardar
            </button>
            {!completo && (
              <span className="text-[11px] text-neutral-500">
                Faltan la persona que evaluó o alguna de las {escalaPreguntas.length} notas.
              </span>
            )}
          </div>
        </div>
      )}

      {disponibles.length === 0 && !formulario && (
        <p className="mt-3 text-[11px] text-neutral-500">
          Ya está registrado todo el equipo de {instrumento.anio} que hay en el banco. Si falta
          alguien, primero cárguelo como evaluador y vuelva aquí.
        </p>
      )}
    </>
  )
}

function Nota({ tipo, texto }: { tipo: 'ok' | 'error'; texto: string }) {
  return (
    <p className={`mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] ${
      tipo === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
    }`}>
      {tipo === 'ok'
        ? <Check size={14} className="mt-0.5 shrink-0" />
        : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
      {texto}
    </p>
  )
}

const rango = (desde: number, hasta: number) =>
  Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)

function mensaje(err: unknown, porDefecto: string): string {
  const e = err as { response?: { data?: { message?: string | string[] } } }
  const m = e?.response?.data?.message
  if (Array.isArray(m)) return m[0] ?? porDefecto
  return m ?? porDefecto
}
