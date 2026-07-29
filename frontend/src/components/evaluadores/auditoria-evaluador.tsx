'use client'

import api from '@/lib/api'
import { fmtDateTimeNumeric } from '@/lib/format-date'
import { ChevronDown, ChevronRight, History, Loader2, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

const PRIMARY = '#00304D'

interface Fila {
  logId: number
  tabla: string
  operacion: string
  registroId: number | null
  usuarioEmail: string
  usuarioPerfilId: number | null
  fecha: string
  comentario: string | null
  tieneAntes: boolean
  tieneDespues: boolean
}

interface Detalle { logId: number; valorAntes: unknown; valorDespues: unknown }

/** Etiquetas legibles. El backend guarda códigos; aquí se traducen. */
const OPERACION: Record<string, { texto: string; clase: string }> = {
  INSERT:  { texto: 'Creó',      clase: 'bg-emerald-100 text-emerald-700' },
  UPDATE:  { texto: 'Modificó',  clase: 'bg-blue-100 text-blue-700' },
  DELETE:  { texto: 'Eliminó',   clase: 'bg-red-100 text-red-700' },
  ESTADO:  { texto: 'Cambió estado', clase: 'bg-amber-100 text-amber-700' },
  GENERAR: { texto: 'Generó',    clase: 'bg-indigo-100 text-indigo-700' },
  ANULAR:  { texto: 'Anuló',     clase: 'bg-orange-100 text-orange-700' },
  EMITIR:  { texto: 'Emitió',    clase: 'bg-purple-100 text-purple-700' },
}

const TABLA_LEGIBLE: Record<string, string> = {
  EVALUADORPARTICIPACION: 'Ciclo',
  EVALUADORAPROBACION: 'Aprobación del jefe',
  EVALUADORCAPACITACION: 'Curso de formación',
  EVALUADORPARTPROYECTO: 'Proyecto evaluado',
  EVALUADORPARTGRUPO: 'Grupos del ciclo',
  EVALUADORCERTIFICADO: 'Certificado',
  RETROASIGNACION: 'Matriz de retroalimentación',
  RETRORESPUESTA: 'Retroalimentación',
}

export function AuditoriaEvaluador({
  evaluadorId, setToast,
}: {
  evaluadorId: number
  setToast: (t: { tipo: 'success' | 'error'; msg: string } | null) => void
}) {
  const [items, setItems] = useState<Fila[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [sinPermiso, setSinPermiso] = useState(false)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [detalles, setDetalles] = useState<Record<number, Detalle>>({})

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true)
      try {
        const r = await api.get<{ items: Fila[]; total: number }>(
          `/evaluadores/${evaluadorId}/auditoria`, { params: { limit: 100 } },
        )
        if (!vivo) return
        setItems(r.data?.items ?? [])
        setTotal(r.data?.total ?? 0)
      } catch (err) {
        if (!vivo) return
        // 403 no es un error que valga la pena gritar: significa que este perfil
        // simplemente no ve auditoría. Se explica en pantalla y ya.
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 403) setSinPermiso(true)
        else setToast({ tipo: 'error', msg: 'No se pudo cargar la auditoría' })
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [evaluadorId, setToast])

  async function alternar(logId: number, tieneSnapshot: boolean) {
    if (abierto === logId) { setAbierto(null); return }
    setAbierto(logId)
    if (!tieneSnapshot || detalles[logId]) return
    try {
      const r = await api.get<Detalle>(`/evaluadores/auditoria/${logId}`)
      setDetalles(prev => ({ ...prev, [logId]: r.data }))
    } catch {
      setToast({ tipo: 'error', msg: 'No se pudo cargar el detalle del registro' })
    }
  }

  if (sinPermiso) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white px-5 py-12 text-center shadow-sm">
        <ShieldAlert size={28} className="mx-auto text-neutral-300" />
        <p className="mt-3 text-sm font-semibold text-neutral-600">Auditoría restringida</p>
        <p className="mt-1 text-[12px] text-neutral-400">
          Solo coordinación y administración pueden consultar el registro de cambios.
        </p>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <History size={16} style={{ color: PRIMARY }} />
          <h3 className="text-sm font-bold text-neutral-800">Registro de cambios</h3>
        </div>
        {total > 0 && (
          <span className="text-[11px] text-neutral-500">
            {items.length} de {total}
          </span>
        )}
      </header>

      {cargando ? (
        <p className="flex items-center gap-2 px-5 py-8 text-sm text-neutral-500">
          <Loader2 size={14} className="animate-spin" /> Cargando…
        </p>
      ) : items.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-neutral-400">Sin movimientos registrados todavía.</p>
          <p className="mt-1 text-[11px] text-neutral-400">
            Se registran aprobaciones, calificaciones, cambios de estado, certificados y
            retroalimentación. Los cargues de documentos no se auditan.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map(f => {
            const op = OPERACION[f.operacion] ?? { texto: f.operacion, clase: 'bg-neutral-100 text-neutral-600' }
            const tieneSnapshot = f.tieneAntes || f.tieneDespues
            const expandido = abierto === f.logId
            return (
              <li key={f.logId}>
                <button
                  onClick={() => alternar(f.logId, tieneSnapshot)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-neutral-50"
                >
                  {tieneSnapshot
                    ? (expandido ? <ChevronDown size={14} className="shrink-0 text-neutral-400" />
                                 : <ChevronRight size={14} className="shrink-0 text-neutral-400" />)
                    : <span className="w-[14px] shrink-0" />}
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${op.clase}`}>
                    {op.texto}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-neutral-800">
                      {TABLA_LEGIBLE[f.tabla] ?? f.tabla}
                      {f.registroId != null && (
                        <span className="font-normal text-neutral-400"> #{f.registroId}</span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {f.usuarioEmail}
                      {f.comentario && ` · ${f.comentario}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-neutral-400">
                    {fmtDateTimeNumeric(f.fecha)}
                  </span>
                </button>

                {expandido && tieneSnapshot && (
                  <div className="grid grid-cols-1 gap-3 bg-neutral-50/70 px-5 py-3 sm:grid-cols-2">
                    <Snapshot titulo="Antes" valor={detalles[f.logId]?.valorAntes} cargado={!!detalles[f.logId]} />
                    <Snapshot titulo="Después" valor={detalles[f.logId]?.valorDespues} cargado={!!detalles[f.logId]} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Snapshot({ titulo, valor, cargado }: { titulo: string; valor: unknown; cargado: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{titulo}</p>
      {!cargado ? (
        <p className="flex items-center gap-1.5 text-[11px] text-neutral-400">
          <Loader2 size={11} className="animate-spin" /> cargando…
        </p>
      ) : valor == null ? (
        <p className="text-[11px] italic text-neutral-400">— sin datos —</p>
      ) : (
        <pre className="max-h-52 overflow-auto rounded-lg border border-neutral-200 bg-white p-2 text-[11px] leading-relaxed text-neutral-700">
          {typeof valor === 'string' ? valor : JSON.stringify(valor, null, 2)}
        </pre>
      )}
    </div>
  )
}
