'use client'

import api from '@/lib/api'
import { getSepUsuario } from '@/lib/auth'
import { AlertTriangle, Check, ChevronRight, Copy, History, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'
const PERFILES_GESTION = [1, 2, 15]

const TIPOS: Array<{ id: string; etiqueta: string; ayuda: string }> = [
  { id: 'ESCALA', etiqueta: 'Nota', ayuda: 'se responde con un número de la escala' },
  { id: 'TEXTO_POR_PERSONA', etiqueta: 'Texto', ayuda: 'por ejemplo SÍ / NO, Presencial / PAT' },
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
  cargadasEnElCiclo: number
  puedeCambiarPreguntas: boolean
  modelos: Modelo[]
}
interface Companero {
  participacionId: number
  evaluadorId: number
  nombre: string
  identificacion: string | null
  rol: string | null
  area: string | null
  /** El dinamizador del GGPC: no es del ciclo y va en su propio grupo. */
  esDinamizador?: boolean
  /** Quién dinamizó esta mesa, si quedó registrado. Solo para reconocerlo. */
  quienDinamizo?: string | null
}
interface Recibida {
  respuestaId: number
  autorParticipacionId: number
  promedio: number | null
  fecha: string | null
  autor: string
  historica: boolean
  escalas: Record<string, number>
  textos: Record<string, string>
}

// sugerencias segun lo que pregunta la hoja: son un atajo, el campo sigue siendo libre
function atajos(texto: string): string[] {
  const t = texto.toLowerCase()
  if (t.includes('presencial') || t.includes('pat')) return ['Presencial', 'PAT']
  if (t.includes('recomend')) return ['SÍ', 'NO']
  return []
}

// cargue a mano de las retroalimentaciones que esta persona recibió en un año anterior
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
  const [recibidas, setRecibidas] = useState<Recibida[]>([])
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null)
  const [rehacer, setRehacer] = useState(false)
  const [cambiado, setCambiado] = useState(false)

  // el ciclo se recarga al cerrar, no en cada guardado: recargarlo desmonta este panel
  function alternar() {
    if (abierto && cambiado) {
      setCambiado(false)
      onRecargar()
    }
    setAbierto(v => !v)
  }

  async function traer() {
    setCargando(true)
    setError(null)
    setAviso(null)
    try {
      const [i, c, r] = await Promise.all([
        api.get<Instrumento>(`/retroalimentacion/historico/participaciones/${participacionId}/instrumento`),
        api.get<Companero[]>(`/retroalimentacion/historico/participaciones/${participacionId}/companeros`),
        api.get<Recibida[]>(`/retroalimentacion/historico/participaciones/${participacionId}/recibidas`),
      ])
      setInstrumento(i.data)
      setCompaneros(c.data)
      setRecibidas(r.data)
      setRehacer(false)
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

  const registrando = instrumento?.faltaRegistrarPreguntas || rehacer

  return (
    <div className="mx-5 mb-5 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60">
      <button
        onClick={alternar}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <History size={16} className="text-neutral-500" />
        <span className="text-[13px] font-semibold text-neutral-700">
          Retroalimentación que recibió en {anio}
        </span>
        <span className="ml-auto text-[11px] text-neutral-500">{abierto ? 'Ocultar' : 'Abrir'}</span>
      </button>

      {abierto && (
        <div className="border-t border-neutral-200 px-4 py-4">
          <p className="text-[12px] text-neutral-600">
            {anio} nunca se diligenció en el sistema. Aquí se registra la retroalimentación que le
            hicieron a esta persona en <span className="font-semibold">{instrumento?.convocatoria ?? 'esa convocatoria'}</span>,
            y quién se la hizo.
          </p>

          {cargando && (
            <p className="mt-4 flex items-center gap-2 text-[12px] text-neutral-500">
              <Loader2 size={14} className="animate-spin" /> Cargando…
            </p>
          )}

          {error && <Nota tipo="error" texto={error} />}
          {aviso && <Nota tipo={aviso.tipo} texto={aviso.msg} />}

          {instrumento && !cargando && (
            registrando ? (
              <RegistroDePreguntas
                instrumento={instrumento}
                rehaciendo={rehacer}
                onCancelar={() => setRehacer(false)}
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
                recibidas={recibidas}
                setRecibidas={setRecibidas}
                setAviso={setAviso}
                onRehacerPreguntas={() => { setAviso(null); setRehacer(true) }}
                onCambio={() => setCambiado(true)}
                recargarTodo={traer}
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
  instrumento, rehaciendo, onCancelar, onListo, onError,
}: {
  instrumento: Instrumento
  rehaciendo: boolean
  onCancelar: () => void
  onListo: (msg: string) => Promise<void>
  onError: (msg: string) => void
}) {
  const [filas, setFilas] = useState<Array<{ texto: string; tipo: string }>>(
    rehaciendo && instrumento.preguntas.length > 0
      ? instrumento.preguntas.map(p => ({ texto: p.texto, tipo: p.tipo }))
      : [{ texto: '', tipo: 'ESCALA' }],
  )
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
          <AlertTriangle size={15} />
          {rehaciendo
            ? `Corregir las preguntas de ${instrumento.anio}`
            : `Falta registrar las preguntas de ${instrumento.anio}`}
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
          <li><span className="font-semibold">4.</span> Guarde. Desde ahí ya puede cargar las respuestas persona por persona.</li>
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
          <p className="w-full text-[11px] text-amber-700">
            Revísela antes de guardar: si el proceso usó otra hoja, las preguntas no sirven.
          </p>
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
          {rehaciendo && (
            <button
              onClick={onCancelar}
              className="rounded-xl border border-neutral-300 px-3 py-2 text-[13px] font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              Cancelar
            </button>
          )}
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

// ya con las preguntas registradas: se transcribe lo que le escribieron a esta persona
function CargueDeNotas({
  participacionId, instrumento, companeros, recibidas, setRecibidas,
  setAviso, onRehacerPreguntas, onCambio, recargarTodo,
}: {
  participacionId: number
  instrumento: Instrumento
  companeros: Companero[]
  recibidas: Recibida[]
  setRecibidas: (r: Recibida[]) => void
  setAviso: (a: { tipo: 'ok' | 'error'; msg: string } | null) => void
  onRehacerPreguntas: () => void
  onCambio: () => void
  recargarTodo: () => Promise<void>
}) {
  // null = cerrado, 'nueva' = cargando una, o el id de la que se está corrigiendo
  const [modo, setModo] = useState<null | 'nueva' | number>(null)
  const [autor, setAutor] = useState('')
  const [escalas, setEscalas] = useState<Record<string, number>>({})
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [porQuitar, setPorQuitar] = useState<Recibida | null>(null)
  // cuál está desplegada para ver sus respuestas una a una
  const [verDetalle, setVerDetalle] = useState<number | null>(null)

  // quien ya se la hizo no vuelve a la lista, y nadie se retroalimenta a sí mismo
  const disponibles = useMemo(() => {
    const usados = new Set(recibidas.map(r => r.autorParticipacionId))
    const yo = companeros.find(c => c.participacionId === participacionId)?.evaluadorId
    return companeros.filter(c =>
      c.participacionId !== participacionId && c.evaluadorId !== yo && !usados.has(c.participacionId))
  }, [companeros, recibidas, participacionId])

  // el dinamizador del GGPC no es compañero de ciclo: va en su propio grupo
  const delCiclo = disponibles.filter(c => !c.esDinamizador)
  const dinamizador = disponibles.find(c => c.esDinamizador) ?? null

  const escalaPreguntas = instrumento.preguntas.filter(p => p.tipo === 'ESCALA')
  const textoPreguntas = instrumento.preguntas.filter(p => p.tipo !== 'ESCALA')

  const corrigiendo = typeof modo === 'number'
  const enCurso = corrigiendo ? recibidas.find(r => r.respuestaId === modo) ?? null : null
  const completo = (corrigiendo || autor !== '')
    && escalaPreguntas.every(p => escalas[String(p.numero)] != null)

  function cerrar() {
    setModo(null)
    setAutor('')
    setEscalas({})
    setTextos({})
  }

  function abrirNueva() {
    setAviso(null)
    setAutor('')
    setEscalas({})
    setTextos({})
    setModo('nueva')
  }

  function abrirCorreccion(r: Recibida) {
    setAviso(null)
    setAutor('')
    setEscalas({ ...r.escalas })
    setTextos({ ...r.textos })
    setModo(r.respuestaId)
  }

  async function refrescar() {
    const r = await api.get<Recibida[]>(
      `/retroalimentacion/historico/participaciones/${participacionId}/recibidas`)
    setRecibidas(r.data)
  }

  // seguir = deja el formulario abierto y en blanco para la siguiente persona
  async function guardar(seguir: boolean) {
    if (!completo) return
    setGuardando(true)
    setAviso(null)
    const nombre = corrigiendo
      ? enCurso?.autor ?? ''
      : disponibles.find(c => c.participacionId === Number(autor))?.nombre ?? ''

    try {
      if (corrigiendo) {
        await api.put(`/retroalimentacion/historico/${modo}`, { escalas, textos })
      } else {
        await api.post('/retroalimentacion/historico', {
          evaluadorParticipacionId: Number(autor),
          evaluadoParticipacionId: participacionId,
          escalas,
          textos,
        })
      }
    } catch (err) {
      setAviso({ tipo: 'error', msg: mensaje(err, 'No se pudo guardar la retroalimentación') })
      setGuardando(false)
      return
    }

    // ya quedó guardada: si el refresco falla, el aviso no puede decir que no se guardó
    try {
      await refrescar()
      setAviso({
        tipo: 'ok',
        msg: corrigiendo
          ? `Corregida la que le hizo ${nombre}.`
          : seguir
            ? `Guardada la que le hizo ${nombre}. Siga con la siguiente.`
            : `Guardada la que le hizo ${nombre}.`,
      })
    } catch {
      setAviso({
        tipo: 'ok',
        msg: `Se guardó, pero no se pudo refrescar la lista. Recargue la página.`,
      })
    }

    setGuardando(false)
    onCambio()
    if (seguir && !corrigiendo) {
      setAutor('')
      setEscalas({})
      setTextos({})
    } else {
      cerrar()
    }
  }

  async function quitar(r: Recibida) {
    setGuardando(true)
    setAviso(null)
    try {
      await api.delete(`/retroalimentacion/historico/${r.respuestaId}`)
      if (modo === r.respuestaId) cerrar()
      // se recarga todo: al quedar el ciclo sin cargas, las preguntas se vuelven a poder cambiar
      await recargarTodo()
      setAviso({ tipo: 'ok', msg: `Se quitó la que le hizo ${r.autor}.` })
      onCambio()
    } catch (err) {
      setAviso({ tipo: 'error', msg: mensaje(err, 'No se pudo quitar la retroalimentación') })
    } finally {
      setGuardando(false)
      setPorQuitar(null)
    }
  }

  return (
    <>
      {recibidas.length > 0 && (
        <>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Ya cargadas ({recibidas.length})
          </p>
          <ul className="mt-1 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {recibidas.map(r => {
              const desplegada = verDetalle === r.respuestaId
              return (
              <li key={r.respuestaId}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    onClick={() => setVerDetalle(v => (v === r.respuestaId ? null : r.respuestaId))}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={desplegada}
                    title={desplegada ? 'Ocultar las respuestas' : 'Ver las respuestas una a una'}
                  >
                    <ChevronRight
                      size={13}
                      className={`shrink-0 text-neutral-400 transition-transform ${desplegada ? 'rotate-90' : ''}`}
                    />
                    <Check size={14} className="shrink-0 text-emerald-600" />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-700">{r.autor}</span>
                  </button>
                  <span className="text-[12px] font-bold" style={{ color: PRIMARY }}>
                    {r.promedio != null ? `${r.promedio} / ${instrumento.escalaMax}` : '—'}
                  </span>
                  {r.historica ? (
                    <>
                      <button
                        onClick={() => abrirCorreccion(r)}
                        className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                        aria-label={`Corregir la que le hizo ${r.autor}`}
                        title="Corregir"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setPorQuitar(r)}
                        className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`Quitar la que le hizo ${r.autor}`}
                        title="Quitar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  ) : (
                    <span
                      className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500"
                      title="La diligenció la persona en el sistema, no se corrige a mano"
                    >
                      del sistema
                    </span>
                  )}
                </div>

                {desplegada && (
                  <div className="border-t border-neutral-100 bg-neutral-50/70 px-3 py-3">
                    <ul className="space-y-2">
                      {instrumento.preguntas.map(p => {
                        const nota = r.escalas[String(p.numero)]
                        const texto = r.textos[String(p.numero)]
                        return (
                          <li key={p.preguntaId} className="flex items-start gap-2">
                            <span className="mt-0.5 w-4 shrink-0 text-[11px] font-bold text-neutral-400">
                              {p.numero}
                            </span>
                            <span className="min-w-0 flex-1 text-[11px] leading-snug text-neutral-600">
                              {p.texto}
                            </span>
                            {p.tipo === 'ESCALA' ? (
                              <span
                                className="shrink-0 rounded-md px-2 py-0.5 text-[12px] font-bold text-white"
                                style={{ backgroundColor: nota == null ? '#a3a3a3' : PRIMARY }}
                              >
                                {nota ?? '—'}
                              </span>
                            ) : (
                              <span className="max-w-[45%] shrink-0 text-right text-[11px] font-semibold text-neutral-800">
                                {texto || '—'}
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                    {r.fecha && (
                      <p className="mt-2.5 border-t border-neutral-200 pt-2 text-[10px] text-neutral-400">
                        {r.historica ? 'Cargada a mano el ' : 'Diligenciada el '}
                        {new Date(r.fecha).toLocaleDateString('es-CO', {
                          day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Bogota',
                        })}
                      </p>
                    )}
                  </div>
                )}
              </li>
              )
            })}
          </ul>
        </>
      )}

      {porQuitar && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-[12px] text-red-900">
            ¿Quitar la retroalimentación que <span className="font-semibold">{porQuitar.autor}</span> le
            hizo? Se borra con sus respuestas y no se puede deshacer.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => quitar(porQuitar)}
              disabled={guardando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-red-700 disabled:opacity-40"
            >
              {guardando ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Sí, quitarla
            </button>
            <button
              onClick={() => setPorQuitar(null)}
              className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-neutral-600 transition hover:bg-neutral-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {modo === null ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={abrirNueva}
            disabled={disponibles.length === 0}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: INSTITUTIONAL }}
          >
            <Plus size={15} />
            {recibidas.length === 0 ? 'Cargar la primera' : 'Cargar la de otra persona'}
          </button>
          {disponibles.length === 0 && (
            <span className="text-[11px] text-neutral-500">
              Ya están registrados todos los del ciclo que hay en el banco.
            </span>
          )}
          {instrumento.puedeCambiarPreguntas ? (
            <button
              onClick={onRehacerPreguntas}
              className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-semibold text-neutral-600 underline-offset-2 hover:underline"
            >
              <Pencil size={13} /> Corregir las preguntas de {instrumento.anio}
            </button>
          ) : (
            <span className="ml-auto text-[11px] text-neutral-400">
              Las preguntas quedaron fijas: ya hay {instrumento.cargadasEnElCiclo} retroalimentaciones
              cargadas en esta convocatoria.
            </span>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {corrigiendo ? 'Se la hizo' : '¿Quién le hizo esta retroalimentación?'}
              </label>
              {corrigiendo ? (
                <p className="text-sm font-semibold text-neutral-800">{enCurso?.autor}</p>
              ) : (
                <select
                  value={autor}
                  onChange={e => setAutor(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
                >
                  <option value="">Seleccione a la persona…</option>
                  {delCiclo.length > 0 && (
                    <optgroup label="Del ciclo">
                      {delCiclo.map(c => (
                        <option key={c.participacionId} value={c.participacionId}>
                          {c.nombre}{c.rol ? ` · ${c.rol}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {dinamizador && (
                    <optgroup label="Fuera del ciclo">
                      <option value={dinamizador.participacionId}>
                        {dinamizador.nombre}
                        {dinamizador.quienDinamizo ? ` · ${dinamizador.quienDinamizo}` : ''}
                      </option>
                    </optgroup>
                  )}
                </select>
              )}
              {!corrigiendo && dinamizador
                && String(dinamizador.participacionId) === autor && (
                <p className="mt-1.5 text-[11px] text-neutral-500">
                  {dinamizador.quienDinamizo
                    ? `Quien dinamizó esta mesa fue ${dinamizador.quienDinamizo}. `
                    : ''}
                  Se guarda como &quot;Dinamizador GGPC&quot;, con la misma hoja del año,
                  y entra al promedio junto con las del ciclo.
                </p>
              )}
            </div>
            <button
              onClick={cerrar}
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
            {corrigiendo ? (
              <button
                onClick={() => guardar(false)}
                disabled={!completo || guardando}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: INSTITUTIONAL }}
              >
                {guardando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Guardar la corrección
              </button>
            ) : (
              <>
                <button
                  onClick={() => guardar(true)}
                  disabled={!completo || guardando || disponibles.length <= 1}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ backgroundColor: INSTITUTIONAL }}
                >
                  {guardando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Guardar y seguir con otra
                </button>
                <button
                  onClick={() => guardar(false)}
                  disabled={!completo || guardando}
                  className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Guardar y cerrar
                </button>
              </>
            )}
            {!completo ? (
              <span className="text-[11px] text-neutral-500">
                {corrigiendo
                  ? `Falta alguna de las ${escalaPreguntas.length} notas.`
                  : `Falta la persona o alguna de las ${escalaPreguntas.length} notas.`}
              </span>
            ) : !corrigiendo && disponibles.length <= 1 && (
              <span className="text-[11px] text-neutral-500">
                Es la última del ciclo: guarde y cierre.
              </span>
            )}
          </div>
        </div>
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
