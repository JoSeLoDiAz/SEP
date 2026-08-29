'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, BellRing, CalendarDays, CheckCircle2, Mail } from 'lucide-react'
import api from '@/lib/api'
import { fmtDateTime, fmtFecha } from '@/lib/format-date'
import {
  PRIMARY, Section, Vacio, Cargando, BotonesArchivo, mensajeError, type SetToast,
} from '@/components/mi-expediente/comunes'
import type { MiResumen, MiConvocatoria, MiEvidencia } from '@/lib/types/mi-expediente'

const CHIP = 'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide'

function peso(bytes: number): string {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return ''
  const kb = n / 1024
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`
}

function unDecimal(n: number | null): string {
  return n != null ? Number(n).toFixed(1) : '—'
}

function meta(partes: Array<string | number | null | undefined>): string {
  return partes.filter(p => p != null && p !== '' && p !== '—').join(' · ')
}

export default function TabTrayectoria({ setToast }: { setToast: SetToast }) {
  const [resumen, setResumen] = useState<MiResumen | null>(null)
  const [convocatorias, setConvocatorias] = useState<MiConvocatoria[]>([])
  const [evidencias, setEvidencias] = useState<MiEvidencia[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [r, c, e] = await Promise.all([
          api.get<MiResumen>('/mi-expediente/resumen'),
          api.get<MiConvocatoria[]>('/mi-expediente/convocatorias'),
          api.get<MiEvidencia[]>('/mi-expediente/evidencias'),
        ])
        if (!vivo) return
        setResumen(r.data)
        setConvocatorias(c.data ?? [])
        setEvidencias(e.data ?? [])
      } catch (err) {
        if (vivo) setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo cargar tu trayectoria') })
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [setToast])

  if (cargando) return <Cargando texto="Cargando tu trayectoria…" />

  const nueva = convocatorias.find(c => c.esNueva)
  const prueba = resumen?.pruebaVigente ?? null

  const kpis = resumen
    ? [
        {
          label: 'Años participados',
          valor: String(resumen.aniosParticipados),
          sub: resumen.primerAnio && resumen.ultimoAnio
            ? `de ${resumen.primerAnio} a ${resumen.ultimoAnio}`
            : 'sin registro',
        },
        {
          label: 'Participaciones',
          valor: String(resumen.totalParticipaciones),
          sub: 'ciclos en total',
        },
        {
          label: 'Proyectos evaluados',
          valor: String(resumen.totalProyectos),
          sub: 'a lo largo de tu historia',
        },
        {
          label: 'Certificados',
          valor: String(resumen.totalCertificados),
          sub: 'emitidos y vigentes',
        },
        {
          label: 'Retroalimentación',
          valor: unDecimal(resumen.promedioRetro),
          sub: resumen.totalRetroRecibidas > 0
            ? `${resumen.totalRetroRecibidas} recibidas · sobre 5`
            : 'sin datos aún',
        },
      ]
    : []

  return (
    <div className="flex flex-col gap-5">
      {nueva && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <BellRing size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-900">Te convocaron a una evaluación nueva</p>
              <p className="mt-0.5 text-[12px] font-semibold text-amber-800">
                {nueva.convocatoria || 'Sin convocatoria'} · {nueva.anio}
              </p>
              <p className="mt-1 text-[11px] text-amber-700">Todavía no has confirmado si participas.</p>
            </div>
          </div>
        </div>
      )}

      {resumen && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map(k => (
            <div key={k.label} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{k.label}</p>
              <p className="mt-1 text-xl font-bold leading-none" style={{ color: PRIMARY }}>{k.valor}</p>
              <p className="mt-1 text-[11px] text-neutral-500">{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      <Section titulo="Mi recorrido" ayuda="Un renglón por cada año en que participaste.">
        {prueba && (
          <div className="px-4 pt-3">
            {prueba.vigente ? (
              <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] text-emerald-800">
                <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                Tu prueba de conocimiento está vigente: la aprobaste en {prueba.anio}
                {prueba.puntaje != null && ` con ${prueba.puntaje} puntos`}.
              </p>
            ) : (
              <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
                <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                {prueba.aprobada
                  ? `Tu prueba de conocimiento ya no está vigente: la última que aprobaste fue la de ${prueba.anio}.`
                  : `No tienes una prueba vigente: la última que presentaste fue la de ${prueba.anio} y no quedó aprobada.`}
              </p>
            )}
          </div>
        )}

        {!resumen || resumen.recorrido.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12px] text-neutral-400">
            Todavía no hay años registrados en tu recorrido.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/60 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-2 text-left">Año</th>
                  <th className="px-4 py-2 text-right">Prueba (%)</th>
                  <th className="px-4 py-2 text-right">Intentos</th>
                  <th className="px-4 py-2 text-left">Estado</th>
                  <th className="px-4 py-2 text-right">Curso</th>
                  <th className="px-4 py-2 text-right">Retroalimentación</th>
                  <th className="px-4 py-2 text-right">Recomendado</th>
                </tr>
              </thead>
              <tbody>
                {resumen.recorrido.map(r => (
                  <tr key={r.anio} className="border-b border-neutral-50 last:border-0">
                    <td className="px-4 py-2 text-[13px] font-bold tabular-nums" style={{ color: PRIMARY }}>
                      {r.anio}
                    </td>
                    <td className="px-4 py-2 text-right text-[13px] tabular-nums text-neutral-800">
                      {r.porcentaje != null ? `${r.porcentaje}%` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-[13px] tabular-nums text-neutral-600">
                      {r.intentos != null ? r.intentos : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {r.pruebaAprobada === true ? (
                        <span className={`${CHIP} bg-emerald-50 text-emerald-700`}>Aprobada</span>
                      ) : r.pruebaAprobada === false ? (
                        <span className={`${CHIP} bg-red-50 text-red-700`}>No aprobada</span>
                      ) : (
                        <span className={`${CHIP} bg-neutral-100 text-neutral-700`}>Sin evaluar</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-[13px] tabular-nums text-neutral-800">
                      {r.curso != null ? r.curso : '—'}
                      {/* sin nota no hay nada que reprobar */}
                      {r.cursoAprobado === false && r.curso != null && (
                        <span className="ml-1 text-[10px] font-bold uppercase text-red-600">No aprobado</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-[13px] tabular-nums text-neutral-800">
                      {unDecimal(r.retro)}
                    </td>
                    <td className="px-4 py-2 text-right text-[13px] tabular-nums text-neutral-800">
                      {unDecimal(r.recomendado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section titulo="Mis convocatorias" ayuda="Cada ciclo al que te han convocado y en qué quedó.">
        <div className="p-3">
          {convocatorias.length === 0 ? (
            <Vacio
              icono={<CalendarDays size={28} className="mx-auto text-neutral-300" />}
              titulo="Todavía no te han convocado"
              detalle="Cuando te incluyan en una convocatoria, aparecerá aquí con su estado."
            />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {convocatorias.map(c => (
                <li key={c.participacionId} className="flex items-center gap-3 rounded-xl border border-neutral-100 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-neutral-800">
                      {c.convocatoria || 'Sin convocatoria'}
                    </p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {meta([c.anio, c.periodo && `Periodo ${c.periodo}`, c.rol, c.area, c.proceso]) || '—'}
                    </p>
                    {c.motivo && <p className="mt-0.5 text-[11px] text-neutral-500">{c.motivo}</p>}
                  </div>
                  <span
                    className={`${CHIP} shrink-0 ${
                      c.estadoNegativo ? 'bg-red-50 text-red-700'
                        : c.estado ? 'bg-blue-50 text-blue-700'
                        : 'bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    {c.estado || 'Sin definir'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section titulo="Correos y evidencias" ayuda="Los soportes de cada ciclo.">
        <div className="p-3">
          {evidencias.length === 0 ? (
            <Vacio
              icono={<Mail size={28} className="mx-auto text-neutral-300" />}
              titulo="Sin correos de autorización"
              detalle="Aquí quedan los correos con que tu jefe autorizó cada participación."
            />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {evidencias.map(e => (
                <li key={e.aprobacionId} className="flex items-center gap-3 rounded-xl border border-neutral-100 px-3 py-2">
                  <Mail size={14} className="shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-neutral-800">{e.nombre || 'Evidencia'}</p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {/* FECHAAPROBACION se guarda con TO_DATE('YYYY-MM-DD'): es de calendario */}
                      {meta([e.anio, e.convocatoria, fmtFecha(e.fecha), peso(e.bytes)]) || '—'}
                    </p>
                  </div>
                  <BotonesArchivo
                    url={'/mi-expediente/evidencias/' + e.aprobacionId + '/archivo'}
                    nombre={e.nombre}
                    setToast={setToast}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </div>
  )
}
