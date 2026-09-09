'use client'

import api from '@/lib/api'
import { descargarArchivoConNombreDelServidor } from '@/lib/descargar-archivo'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Clock, Download,
  Eye, Loader2, Lock, LockOpen, Network, RefreshCw, Users,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

interface ResumenPersona { participacionId: number; nombre: string; rol: string; area: string }

interface Preview {
  totalPares: number
  totalParticipantes: number
  sinEvaluar: ResumenPersona[]
  sinSerEvaluado: ResumenPersona[]
  porRegla: Record<string, number>
  asignacionesExistentes: number
  formulario: { retroFormularioId: number; nombre: string; abierto: boolean }
}

interface Avance {
  formulario: { nombre: string; abierto: boolean; anonimo: boolean }
  totales: {
    participantes: number; completos: number; sinAsignaciones: number
    asignaciones: number; enviadas: number
  }
  items: Array<{
    participacionId: number; nombre: string; rolNombre: string | null; areaNombre: string | null
    asignadas: number; enviadas: number; recibidas: number
    promedioRecibido: number | null; minutos: number | null; seExcedio: boolean; completo: boolean
  }>
}

export default function MatrizConvocatoriaPage() {
  const params = useParams<{ cid: string }>()
  const cid = Number(params.cid)

  const [preview, setPreview] = useState<Preview | null>(null)
  const [avance, setAvance] = useState<Avance | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [generando, setGenerando] = useState(false)
  const [cambiandoApertura, setCambiandoApertura] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [confirmGenerar, setConfirmGenerar] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  const cargar = async () => {
    setCargando(true)
    setErrorCarga('')
    try {
      const [p, a] = await Promise.all([
        api.get<Preview>(`/retroalimentacion/convocatorias/${cid}/matriz/preview`),
        api.get<Avance>(`/retroalimentacion/convocatorias/${cid}/avance`),
      ])
      setPreview(p.data)
      setAvance(a.data)
    } catch (err) {
      setPreview(null)
      setAvance(null)
      setErrorCarga(mensajeError(err, 'No se pudo cargar la matriz de este ciclo'))
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => { if (Number.isFinite(cid)) cargar() /* eslint-disable-next-line */ }, [cid])

  async function generar() {
    setGenerando(true)
    try {
      const r = await api.post<{ creados: number; omitidosPorExistir: number }>(
        `/retroalimentacion/convocatorias/${cid}/matriz/generar`,
      )
      setToast({
        tipo: 'success',
        msg: `${r.data.creados} pares creados` +
             (r.data.omitidosPorExistir ? ` · ${r.data.omitidosPorExistir} ya existían` : ''),
      })
      setConfirmGenerar(false)
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo generar la matriz') })
    } finally {
      setGenerando(false)
    }
  }

  async function alternarApertura(abierto: boolean) {
    setCambiandoApertura(true)
    try {
      await api.put(`/retroalimentacion/convocatorias/${cid}/apertura`, { abierto })
      setToast({ tipo: 'success', msg: abierto ? 'Instrumento abierto' : 'Instrumento cerrado' })
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo cambiar el estado') })
    } finally {
      setCambiandoApertura(false)
    }
  }

  async function descargarReporte() {
    setDescargando(true)
    try {
      await descargarArchivoConNombreDelServidor(
        `/retroalimentacion/convocatorias/${cid}/reporte.xlsx`,
        `retroalimentacion_${cid}.xlsx`,
      )
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo descargar el reporte') })
    } finally {
      setDescargando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 p-10 text-sm text-neutral-500">
        <Loader2 size={14} className="animate-spin" /> Cargando la matriz…
      </div>
    )
  }

  if (errorCarga) {
    return (
      <div className="flex flex-col gap-5 p-5 sm:p-7 xl:p-10">
        <Link
          href={`/panel/evaluadores/convocatorias/${cid}`}
          className="inline-flex w-fit items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D]"
        >
          <ArrowLeft size={13} /> Volver a la convocatoria
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-10 text-center">
          <AlertTriangle size={28} className="mx-auto text-red-500" />
          <p className="mt-3 text-sm font-semibold text-red-800">No se pudo cargar la matriz</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] text-red-700">{errorCarga}</p>
          <button
            onClick={cargar}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
          >
            <RefreshCw size={13} /> Reintentar
          </button>
        </div>
      </div>
    )
  }

  const abierto = preview?.formulario.abierto ?? false
  const yaGenerada = (preview?.asignacionesExistentes ?? 0) > 0
  const t = avance?.totales

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-7 xl:p-10">
      {toast && (
        <ToastBetowa
          show onClose={() => setToast(null)} tipo={toast.tipo}
          titulo={toast.tipo === 'success' ? 'Listo' : 'Error'} mensaje={toast.msg} duration={4500}
        />
      )}

      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <Link href="/panel/evaluadores/convocatorias" className="hover:text-[#00304D]">Convocatorias</Link>
          <ChevronRight size={12} />
          <Link href={`/panel/evaluadores/convocatorias/${cid}`} className="hover:text-[#00304D]">Ficha</Link>
          <ChevronRight size={12} />
          <span>Retroalimentación</span>
        </div>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-bold" style={{ color: PRIMARY }}>
          <Network size={20} /> {preview?.formulario.nombre ?? 'Matriz de retroalimentación'}
        </h1>
      </div>

      <Link
        href={`/panel/evaluadores/convocatorias/${cid}`}
        className="inline-flex w-fit items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D]"
      >
        <ArrowLeft size={13} /> Volver a la convocatoria
      </Link>

      {/* Estado y acciones */}
      <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
            abierto ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-600'
          }`}>
            {abierto ? <LockOpen size={12} /> : <Lock size={12} />}
            {abierto ? 'Abierto' : 'Cerrado'}
          </span>
          <p className="text-[12px] text-neutral-500">
            {abierto
              ? 'Los evaluadores pueden diligenciar en este momento.'
              : 'Nadie puede diligenciar hasta que lo abras.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={cargar}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
          >
            <RefreshCw size={13} /> Actualizar
          </button>
          <button
            onClick={descargarReporte}
            disabled={descargando}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            {descargando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Reporte Excel
          </button>
          <button
            onClick={() => alternarApertura(!abierto)}
            disabled={cambiandoApertura || (!abierto && !yaGenerada)}
            title={!abierto && !yaGenerada ? 'Primero genera la matriz' : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: abierto ? '#b45309' : INSTITUTIONAL }}
          >
            {cambiandoApertura ? <Loader2 size={13} className="animate-spin" />
              : abierto ? <Lock size={13} /> : <LockOpen size={13} />}
            {abierto ? 'Cerrar' : 'Abrir'}
          </button>
        </div>
      </section>

      {t && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Participantes" valor={t.participantes} />
          <Kpi label="Asignaciones" valor={t.asignaciones} />
          <Kpi label="Enviadas" valor={t.enviadas} />
          <Kpi
            label="Completaron"
            valor={`${t.completos} / ${t.participantes}`}
            alerta={t.completos < t.participantes}
          />
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Eye size={16} style={{ color: PRIMARY }} />
            <h2 className="text-sm font-bold text-neutral-800">Simulación de la matriz</h2>
          </div>
          <button
            onClick={() => setConfirmGenerar(true)}
            disabled={generando || (preview?.totalPares ?? 0) === 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: PRIMARY }}
          >
            {generando ? <Loader2 size={13} className="animate-spin" /> : <Network size={13} />}
            {yaGenerada ? 'Regenerar' : 'Generar'}
          </button>
        </header>

        <div className="grid grid-cols-1 gap-5 px-5 py-4 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-600">
              Pares que se generarían: {preview?.totalPares ?? 0}
            </p>
            <p className="mb-3 text-[11px] text-neutral-400">
              {yaGenerada
                ? `Ya hay ${preview?.asignacionesExistentes} asignaciones guardadas. Regenerar solo agrega las que falten.`
                : 'Sobre ' + (preview?.totalParticipantes ?? 0) + ' participantes del ciclo.'}
            </p>
            <ul className="flex flex-col gap-1">
              {Object.entries(preview?.porRegla ?? {})
                .sort((a, b) => b[1] - a[1])
                .map(([regla, n]) => (
                  <li key={regla} className="flex items-center gap-2 text-[12px]">
                    <span className="w-8 shrink-0 text-right font-bold tabular-nums" style={{ color: PRIMARY }}>
                      {n}
                    </span>
                    <span className="truncate text-neutral-600">{regla}</span>
                  </li>
                ))}
              {Object.keys(preview?.porRegla ?? {}).length === 0 && (
                <li className="text-[12px] text-neutral-400">
                  Ninguna regla aplicó. Verifica que las participaciones tengan rol, área y grupos.
                </li>
              )}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <Alerta
              titulo="No retroalimentan a nadie"
              personas={preview?.sinEvaluar ?? []}
              ayuda="Ninguna regla les asignó personas. Suele ser falta de grupo o de rol."
            />
            <Alerta
              titulo="Nadie los retroalimenta"
              personas={preview?.sinSerEvaluado ?? []}
              ayuda="Recibirán el ciclo sin desempeño medido. Si no es intencional, agrega el par a mano."
            />
          </div>
        </div>
      </section>

      {avance && avance.items.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3">
            <Users size={16} style={{ color: PRIMARY }} />
            <h2 className="text-sm font-bold text-neutral-800">Avance por persona</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-neutral-100 bg-neutral-50/60">
                <tr className="text-[10px] uppercase tracking-wide text-neutral-500">
                  <th className="px-5 py-2 font-semibold">Persona</th>
                  <th className="px-3 py-2 font-semibold">Rol</th>
                  <th className="px-3 py-2 text-center font-semibold">Asignadas</th>
                  <th className="px-3 py-2 text-center font-semibold">Enviadas</th>
                  <th className="px-3 py-2 text-center font-semibold">Recibidas</th>
                  <th className="px-3 py-2 text-center font-semibold">Promedio</th>
                  <th className="px-3 py-2 text-center font-semibold">Tiempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {avance.items.map(i => (
                  <tr key={i.participacionId} className={i.completo ? 'bg-emerald-50/30' : undefined}>
                    <td className="px-5 py-2.5 font-medium text-neutral-800">
                      <span className="inline-flex items-center gap-1.5">
                        {i.completo && <CheckCircle2 size={13} className="text-emerald-600" />}
                        {i.nombre}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-500">{i.rolNombre ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{i.asignadas}</td>
                    <td className={`px-3 py-2.5 text-center tabular-nums ${
                      i.asignadas > 0 && i.enviadas === 0 ? 'font-bold text-red-600' : ''
                    }`}>
                      {i.enviadas}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-neutral-500">{i.recibidas}</td>
                    <td className="px-3 py-2.5 text-center font-bold tabular-nums" style={{ color: PRIMARY }}>
                      {i.promedioRecibido ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {i.minutos == null ? <span className="text-neutral-300">—</span> : (
                        <span className={`inline-flex items-center gap-1 tabular-nums ${
                          i.seExcedio ? 'font-semibold text-amber-700' : 'text-neutral-500'
                        }`}>
                          {i.seExcedio && <Clock size={11} />}
                          {i.minutos}′
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ConfirmModal
        open={confirmGenerar}
        onClose={() => setConfirmGenerar(false)}
        onConfirm={generar}
        tipo="warning"
        titulo={yaGenerada ? 'Regenerar la matriz' : 'Generar la matriz'}
        mensaje={
          <>
            Se crearán las asignaciones que falten de <strong>{preview?.totalPares ?? 0} pares</strong>.
            {yaGenerada && ' Las que ya existen no se tocan, incluidas las diligenciadas.'}
          </>
        }
        textoConfirmar={yaGenerada ? 'Regenerar' : 'Generar'}
        cargando={generando}
      />
    </div>
  )
}

function Kpi({ label, valor, alerta }: { label: string; valor: number | string; alerta?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white px-4 py-3 shadow-sm ${
      alerta ? 'border-amber-300 bg-amber-50/40' : 'border-neutral-200'
    }`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-bold leading-none" style={{ color: PRIMARY }}>{valor}</p>
    </div>
  )
}

// se pinta aunque no haya nadie: "ninguno" también es un dato
function Alerta({
  titulo, personas, ayuda,
}: { titulo: string; personas: ResumenPersona[]; ayuda: string }) {
  const hay = personas.length > 0
  return (
    <div className={`rounded-xl border px-4 py-3 ${
      hay ? 'border-amber-200 bg-amber-50/60' : 'border-neutral-200 bg-neutral-50/60'
    }`}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-neutral-600">
        {hay ? <AlertTriangle size={12} className="text-amber-600" />
             : <CheckCircle2 size={12} className="text-emerald-600" />}
        {titulo} · {personas.length}
      </p>
      {hay ? (
        <>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {personas.map(p => (
              <li
                key={p.participacionId}
                className="rounded border border-amber-200 bg-white px-1.5 py-0.5 text-[11px] text-neutral-700"
                title={[p.rol, p.area].filter(Boolean).join(' · ')}
              >
                {p.nombre}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-neutral-500">{ayuda}</p>
        </>
      ) : (
        <p className="mt-1 text-[11px] text-neutral-400">Ninguno.</p>
      )}
    </div>
  )
}

function mensajeError(err: unknown, porDefecto: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? porDefecto
}
