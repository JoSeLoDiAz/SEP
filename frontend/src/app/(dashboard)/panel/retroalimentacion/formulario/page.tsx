'use client'

import api from '@/lib/api'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clock,
  Loader2, Send,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

interface Pregunta {
  preguntaId: number
  numero: number
  texto: string
  criterios: string | null
  tipo: 'ESCALA' | 'TEXTO_POR_PERSONA' | 'TEXTO_GENERAL'
  requerida: boolean
}

interface Formulario {
  nombre: string
  escalaMin: number
  escalaMax: number
  duracionMinutos: number
  /** { "1": "Deficiente", … "5": "Excelente" }. Puede venir null. */
  escalaEtiquetas: Record<string, string> | null
  preguntas: Pregunta[]
}

interface Persona {
  asignacionId: number
  estado: string
  nombre: string
  rolNombre: string | null
}

interface Sesion {
  fechaInicio: string
  duracionMinutos: number
  enviada: boolean
}

/** Respuestas en memoria: asignacionId → { escalas, comentario }. */
type Borrador = Record<number, { escalas: Record<number, number>; comentario: string }>

export default function FormularioPage() {
  return (
    <Suspense fallback={<Cargando texto="Preparando el formulario…" />}>
      <FormularioRetroalimentacion />
    </Suspense>
  )
}

function FormularioRetroalimentacion() {
  const router = useRouter()
  const params = useSearchParams()
  const sesionId = Number(params.get('sesion'))

  const [form, setForm] = useState<Formulario | null>(null)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [borrador, setBorrador] = useState<Borrador>({})
  const [sugerencia, setSugerencia] = useState('')
  const [indice, setIndice] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)
  const [transcurridos, setTranscurridos] = useState(0)
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!Number.isFinite(sesionId) || sesionId <= 0) {
      router.replace('/panel/retroalimentacion')
      return
    }
    let vivo = true
    ;(async () => {
      try {
        const [f, a, s] = await Promise.all([
          api.get<Formulario>('/retroalimentacion/formulario'),
          api.get<{ grupos: Array<{ personas: Persona[] }> }>('/retroalimentacion/mis-asignaciones'),
          api.get<Sesion>(`/retroalimentacion/sesion/${sesionId}`),
        ])
        if (!vivo) return
        if (s.data.enviada) {
          setToast({ tipo: 'error', msg: 'Esta sesión ya fue enviada' })
          setTimeout(() => router.replace('/panel/retroalimentacion'), 1500)
          return
        }
        setForm(f.data)
        setSesion(s.data)
        setPersonas(
          a.data.grupos.flatMap(g => g.personas).filter(p => p.estado === 'PENDIENTE'),
        )
      } catch (err) {
        if (vivo) setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo abrir el formulario') })
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [sesionId, router])

  // El cronómetro se calcula desde `fechaInicio` del servidor, no acumulando
  // segundos en el cliente: así recargar la página no lo reinicia ni permite
  // "pausarlo" cerrando la pestaña.
  useEffect(() => {
    if (!sesion) return
    const tic = () => {
      const inicio = new Date(
        /[Zz]|[+-]\d{2}:?\d{2}$/.test(sesion.fechaInicio) ? sesion.fechaInicio : `${sesion.fechaInicio}Z`,
      ).getTime()
      setTranscurridos(Math.max(0, Math.floor((Date.now() - inicio) / 1000)))
    }
    tic()
    const id = setInterval(tic, 1000)
    return () => clearInterval(id)
  }, [sesion])

  const escalas = useMemo(() => form?.preguntas.filter(p => p.tipo === 'ESCALA') ?? [], [form])
  const porPersona = useMemo(() => form?.preguntas.find(p => p.tipo === 'TEXTO_POR_PERSONA'), [form])
  const general = useMemo(() => form?.preguntas.find(p => p.tipo === 'TEXTO_GENERAL'), [form])

  const completa = useCallback(
    (asignacionId: number) => {
      const r = borrador[asignacionId]
      if (!r) return false
      return escalas.filter(q => q.requerida).every(q => Number.isFinite(r.escalas[q.numero]))
    },
    [borrador, escalas],
  )

  const listas = personas.filter(p => completa(p.asignacionId)).length
  const todoListo = personas.length > 0 && listas === personas.length

  function calificar(asignacionId: number, numero: number, valor: number) {
    setBorrador(b => ({
      ...b,
      [asignacionId]: {
        escalas: { ...(b[asignacionId]?.escalas ?? {}), [numero]: valor },
        comentario: b[asignacionId]?.comentario ?? '',
      },
    }))
  }

  function comentar(asignacionId: number, texto: string) {
    setBorrador(b => ({
      ...b,
      [asignacionId]: {
        escalas: b[asignacionId]?.escalas ?? {},
        comentario: texto,
      },
    }))
  }

  function irA(i: number) {
    setIndice(i)
    contenedor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function enviar() {
    setEnviando(true)
    try {
      const payload = {
        respuestas: personas.map(p => ({
          asignacionId: p.asignacionId,
          escalas: Object.fromEntries(
            Object.entries(borrador[p.asignacionId]?.escalas ?? {}).map(([k, v]) => [k, v]),
          ),
          comentario: borrador[p.asignacionId]?.comentario ?? '',
        })),
        sugerenciaGeneral: sugerencia.trim() || undefined,
      }
      const r = await api.post<{ message: string }>(
        `/retroalimentacion/sesion/${sesionId}/enviar`, payload,
      )
      setToast({ tipo: 'success', msg: r.data?.message ?? 'Retroalimentación enviada' })
      setTimeout(() => router.replace('/panel/retroalimentacion'), 1400)
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo enviar') })
      setEnviando(false)
      setConfirmar(false)
    }
  }

  if (cargando) return <Cargando texto="Cargando el formulario…" />
  if (!form || personas.length === 0) {
    return (
      <div className="p-5 sm:p-7 xl:p-10">
        <div className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <CheckCircle2 size={32} className="mx-auto text-neutral-300" />
          <p className="mt-3 text-sm font-semibold text-neutral-600">No hay nada pendiente</p>
          <Link
            href="/panel/retroalimentacion"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold"
            style={{ color: PRIMARY }}
          >
            <ArrowLeft size={14} /> Volver a mi panel
          </Link>
        </div>
      </div>
    )
  }

  const actual = personas[indice]
  const limite = (sesion?.duracionMinutos ?? 60) * 60
  const excedido = transcurridos > limite

  return (
    <div className="flex flex-col gap-5 p-5 sm:p-7 xl:p-10" ref={contenedor}>
      {toast && (
        <ToastBetowa
          show onClose={() => setToast(null)} tipo={toast.tipo}
          titulo={toast.tipo === 'success' ? 'Listo' : 'Error'} mensaje={toast.msg} duration={4000}
        />
      )}

      {/* Cabecera fija con el cronómetro y el avance */}
      <div className="sticky top-0 z-20 -mx-5 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-7 sm:px-7 xl:-mx-10 xl:px-10">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-neutral-800">{form.nombre}</p>
          <p className="text-[11px] text-neutral-500">
            {listas} de {personas.length} personas listas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-neutral-200 sm:w-44">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(listas / personas.length) * 100}%`, backgroundColor: INSTITUTIONAL }}
            />
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold tabular-nums ${
              excedido ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600'
            }`}
            title={excedido
              ? `Superaste los ${sesion?.duracionMinutos} minutos de referencia. Puedes enviar igual.`
              : `Referencia: ${sesion?.duracionMinutos} minutos`}
          >
            {excedido ? <AlertTriangle size={13} /> : <Clock size={13} />}
            {reloj(transcurridos)}
          </span>
        </div>
      </div>

      {/* Selector de persona */}
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-sm">
        {personas.map((p, i) => {
          const lista = completa(p.asignacionId)
          const activa = i === indice
          return (
            <button
              key={p.asignacionId}
              onClick={() => irA(i)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                activa ? 'text-white shadow-sm'
                  : lista ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
              style={activa ? { backgroundColor: PRIMARY } : undefined}
            >
              {lista && <CheckCircle2 size={12} className={activa ? 'text-white' : 'text-emerald-600'} />}
              {p.nombre.split(/\s+/).slice(0, 2).join(' ')}
            </button>
          )
        })}
      </div>

      {/* Preguntas de la persona actual */}
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <header className="border-b border-neutral-100 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Estás retroalimentando a
          </p>
          <h2 className="text-lg font-bold" style={{ color: PRIMARY }}>{actual.nombre}</h2>
          {actual.rolNombre && <p className="text-[12px] text-neutral-500">{actual.rolNombre}</p>}
        </header>

        <ol className="divide-y divide-neutral-100">
          {escalas.map(q => {
            const valor = borrador[actual.asignacionId]?.escalas[q.numero]
            const falta = q.requerida && !Number.isFinite(valor)
            return (
              <li key={q.preguntaId} className="px-5 py-4">
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-bold text-neutral-600">
                    {q.numero}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-relaxed text-neutral-800">{q.texto}</p>
                    {q.criterios && (
                      <p className="mt-0.5 text-[11px] italic text-neutral-400">{q.criterios}</p>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-start gap-1.5">
                      {rango(form.escalaMin, form.escalaMax).map(n => {
                        const etiqueta = form.escalaEtiquetas?.[String(n)]
                        return (
                          <button
                            key={n}
                            onClick={() => calificar(actual.asignacionId, q.numero, n)}
                            className={`flex min-w-[3.25rem] flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 transition ${
                              valor === n
                                ? 'border-transparent text-white shadow-sm'
                                : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                            }`}
                            style={valor === n ? { backgroundColor: PRIMARY } : undefined}
                            aria-label={etiqueta ? `${n} — ${etiqueta}` : `Calificar ${n}`}
                          >
                            <span className="text-[13px] font-bold leading-none">{n}</span>
                            {etiqueta && (
                              <span className={`text-[9px] leading-tight ${
                                valor === n ? 'text-white/80' : 'text-neutral-400'
                              }`}>
                                {etiqueta}
                              </span>
                            )}
                          </button>
                        )
                      })}
                      {falta && (
                        <span className="ml-1 self-center text-[11px] font-medium text-amber-700">
                          Falta responder
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}

          {porPersona && (
            <li className="px-5 py-4">
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-bold text-neutral-600">
                  {porPersona.numero}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-relaxed text-neutral-800">{porPersona.texto}</p>
                  <textarea
                    value={borrador[actual.asignacionId]?.comentario ?? ''}
                    onChange={e => comentar(actual.asignacionId, e.target.value)}
                    rows={3}
                    placeholder="Opcional"
                    className="mt-2 w-full resize-y rounded-lg border border-neutral-300 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
                  />
                </div>
              </div>
            </li>
          )}
        </ol>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/60 px-5 py-3">
          <button
            onClick={() => irA(Math.max(0, indice - 1))}
            disabled={indice === 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-white disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Anterior
          </button>
          <span className="text-[11px] text-neutral-400">
            {indice + 1} de {personas.length}
          </span>
          <button
            onClick={() => irA(Math.min(personas.length - 1, indice + 1))}
            disabled={indice === personas.length - 1}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-white disabled:opacity-40"
          >
            Siguiente <ChevronRight size={14} />
          </button>
        </div>
      </section>

      {/* Pregunta general del proceso */}
      {general && (
        <section className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Sobre el proceso · se responde una sola vez
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-800">{general.texto}</p>
          <textarea
            value={sugerencia}
            onChange={e => setSugerencia(e.target.value)}
            rows={3}
            placeholder="Opcional"
            className="mt-2 w-full resize-y rounded-lg border border-neutral-300 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
          />
          <p className="mt-1.5 text-[11px] text-neutral-400">
            Esta respuesta se guarda sin tu nombre.
          </p>
        </section>
      )}

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        {!todoListo && (
          <p className="text-[12px] text-amber-700 sm:mr-auto">
            Faltan {personas.length - listas} de {personas.length} personas por completar.
          </p>
        )}
        <button
          onClick={() => setConfirmar(true)}
          disabled={!todoListo || enviando}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: INSTITUTIONAL }}
        >
          {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          Enviar todo
        </button>
      </div>

      <ConfirmModal
        open={confirmar}
        onClose={() => setConfirmar(false)}
        onConfirm={enviar}
        tipo="warning"
        titulo="Enviar retroalimentación"
        mensaje={
          <>
            Vas a enviar <strong>{personas.length} retroalimentaciones</strong>.
            Una vez enviadas no se pueden modificar.
          </>
        }
        textoConfirmar="Enviar"
        cargando={enviando}
      />
    </div>
  )
}

function Cargando({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-2 p-10 text-sm text-neutral-500">
      <Loader2 size={14} className="animate-spin" /> {texto}
    </div>
  )
}

function rango(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
}

function reloj(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function mensajeError(err: unknown, porDefecto: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? porDefecto
}
