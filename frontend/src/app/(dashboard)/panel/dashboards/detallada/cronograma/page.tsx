'use client'

import api from '@/lib/api'
import {
  Loader2,
  ShieldAlert,
  CalendarRange,
  GraduationCap,
  Layers,
  BookOpen,
  Users,
  UserSquare2,
  Clock,
  MapPin,
  Filter,
  RotateCcw,
  CalendarClock,
  FileSpreadsheet,
  ArrowRight,
  ListChecks,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

// El backend (Oracle) devuelve los alias en minúsculas. Muchos IDs vienen como
// string (CAST a VARCHAR2); los conservamos como string para las claves.
interface Cronograma {
  proyectoid: string
  convocatoriaid: string
  convocatoria: string
  proyecto: string
  afid: string
  accionformacion: string
  modalidad: string
  grupo: string
  beneficiariosporgrupo: number
  unidadtematicaid: string
  numunidadtematica: string
  nombreunidadtematica: string
  fechainiciout: string | null
  fechafinalizacionut: string | null
  numsesionactividad: string
  fechainicio: string | null
  fechafin: string | null
  numhorastotales: number
  ciudad: string
  numdocumento: string
  capacitador: string
  estadoradicacion: string
  radicado: string
  coberturagrupo: string
  tipocronograma: string
  radicadointerventoria: string
  radicadosena: string
  fecharadicadosena: string | null
  fecharemision: string | null
  fecharadinterventoria: string | null
  estadocronograma: string
  cronogramatransferencia: number
}

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'
const PALETTE = ['#00304D', '#39A900', '#0070C0', '#C47900', '#7C3AED', '#0F766E', '#C4003D', '#0891B2']

const nfInt = new Intl.NumberFormat('es-CO')
const fmtInt = (n: number) => nfInt.format(Math.round(n || 0))

const norm = (s: string | null | undefined) => (s ?? '').trim().toUpperCase()
function num(v: unknown) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}
function parseFecha(s: string | null): number | null {
  if (!s) return null
  const t = new Date(s).getTime()
  if (isNaN(t)) return null
  if (new Date(t).getFullYear() < 2000) return null // descarta años inválidos
  return t
}
function diasEntre(a: string | null, b: string | null): number | null {
  const d1 = parseFecha(a)
  const d2 = parseFecha(b)
  if (d1 === null || d2 === null) return null
  return Math.round((d2 - d1) / 86_400_000)
}
// Plazo de trámite: un valor negativo (radicado antes de la remisión) es un dato
// inconsistente, se descarta para no mostrar días negativos ni sesgar el promedio.
function diasPlazo(a: string | null, b: string | null): number | null {
  const d = diasEntre(a, b)
  return d === null || d < 0 ? null : d
}
function promedio(nums: (number | null)[]) {
  const v = nums.filter((n): n is number => n !== null)
  if (v.length === 0) return null
  return Math.round(v.reduce((s, n) => s + n, 0) / v.length)
}

// Tipo Entrega (corte) según el número de radicado. Réplica de la medida DAX.
const CORTES: Record<string, string> = {
  '1': 'PRIMER CORTE',
  '2': 'SEGUNDO CORTE',
  '3': 'TERCER CORTE',
  '4': 'CUARTO CORTE',
  '5': 'QUINTO CORTE',
  '6': 'SEXTO CORTE',
}
const ORDEN_CORTE = ['PRIMER CORTE', 'SEGUNDO CORTE', 'TERCER CORTE', 'CUARTO CORTE', 'QUINTO CORTE', 'SEXTO CORTE', 'SIN RADICAR']
function tipoEntrega(radicado: string): string {
  return CORTES[String(radicado ?? '').trim()] ?? 'SIN RADICAR'
}

// Extrae los departamentos de "coberturagrupo" (formato: "DEPARTAMENTO: X - DEPARTAMENTO: Y").
function departamentosDe(c: Cronograma): string[] {
  if (!c.coberturagrupo) return []
  return c.coberturagrupo
    .split(' - ')
    .map((s) => s.replace(/DEPARTAMENTO:\s*/i, '').trim())
    .filter(Boolean)
}

export default function CronogramaPage() {
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [cronograma, setCronograma] = useState<Cronograma[]>([])

  const [fConvocatoria, setFConvocatoria] = useState('')
  const [fProyecto, setFProyecto] = useState('')
  const [fModalidad, setFModalidad] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [fCorte, setFCorte] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    setErrMsg('')
    try {
      // Este reporte es voluminoso; se amplía el timeout por encima del global (15 s).
      const res = await api.get<Cronograma[]>('/dashboards/cronograma', { timeout: 60_000 })
      setCronograma(res.data ?? [])
    } catch (err: unknown) {
      // Log completo para diagnóstico en consola del navegador.
      console.error('[cronograma] error al cargar:', err)
      const e = err as {
        code?: string
        message?: string
        response?: { status?: number; data?: { message?: string } }
      }
      const status = e?.response?.status
      const serverMsg = e?.response?.data?.message
      if (e?.code === 'ECONNABORTED') {
        setErrMsg('La consulta tardó demasiado y se canceló (timeout). El reporte es muy voluminoso.')
      } else if (status === 403) {
        setErrMsg('No tienes permisos para acceder al reporte de cronograma.')
      } else if (status) {
        setErrMsg(`Error ${status} del servidor: ${serverMsg ?? 'sin detalle'}`)
      } else {
        setErrMsg(`No se pudo conectar con el servidor: ${e?.message ?? 'error de red'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  function limpiarFiltros() {
    setFConvocatoria('')
    setFProyecto('')
    setFModalidad('')
    setFEstado('')
    setFCorte('')
  }

  // Este tablero corresponde al cronograma regular (CRONOGRAMA TRANSFERENCIA = 0).
  const baseTransfer = useMemo(() => cronograma.filter((c) => num(c.cronogramatransferencia) === 0), [cronograma])

  // ── Opciones de filtro ─────────────────────────────────────────────────────────
  const convocatorias = useMemo(
    () =>
      Array.from(new Map(baseTransfer.map((c) => [c.convocatoriaid, c])).values()).sort((a, b) =>
        (a.convocatoria || '').localeCompare(b.convocatoria || ''),
      ),
    [baseTransfer],
  )
  const proyectos = useMemo(
    () =>
      Array.from(
        new Map(
          baseTransfer
            .filter((c) => (fConvocatoria ? c.convocatoriaid === fConvocatoria : true))
            .map((c) => [c.proyectoid, c]),
        ).values(),
      ).sort((a, b) => (a.proyecto || '').localeCompare(b.proyecto || '')),
    [baseTransfer, fConvocatoria],
  )
  const modalidades = useMemo(
    () => Array.from(new Set(baseTransfer.map((c) => c.modalidad).filter(Boolean))).sort(),
    [baseTransfer],
  )
  const estados = useMemo(
    () => Array.from(new Set(baseTransfer.map((c) => c.estadocronograma).filter((e) => e && e.trim()))).sort(),
    [baseTransfer],
  )
  const cortes = useMemo(() => {
    const presentes = new Set(baseTransfer.map((c) => tipoEntrega(c.radicado)))
    return ORDEN_CORTE.filter((c) => presentes.has(c))
  }, [baseTransfer])

  // ── Aplicar filtros de UI ────────────────────────────────────────────────────────
  const filtrados = useMemo(
    () =>
      baseTransfer.filter(
        (c) =>
          (fConvocatoria ? c.convocatoriaid === fConvocatoria : true) &&
          (fProyecto ? c.proyectoid === fProyecto : true) &&
          (fModalidad ? c.modalidad === fModalidad : true) &&
          (fEstado ? c.estadocronograma === fEstado : true) &&
          (fCorte ? tipoEntrega(c.radicado) === fCorte : true),
      ),
    [baseTransfer, fConvocatoria, fProyecto, fModalidad, fEstado, fCorte],
  )

  // Filas "válidas": estado <> MODIFICAR / REVERTIDO (base de las medidas DAX).
  const activos = useMemo(
    () => filtrados.filter((c) => norm(c.estadocronograma) !== 'MODIFICAR' && norm(c.estadocronograma) !== 'REVERTIDO'),
    [filtrados],
  )

  // ── KPIs (réplica de las medidas DAX) ─────────────────────────────────────────
  const kpis = useMemo(() => {
    // CRONOGRAMAS TOTALES: distinct (proyecto-radicado), estado válido y no vacío.
    const setCronogramas = new Set<string>()
    filtrados.forEach((c) => {
      const e = norm(c.estadocronograma)
      if (e && e !== 'MODIFICAR' && e !== 'REVERTIDO') setCronogramas.add(`${c.proyectoid}-${c.radicado}`)
    })

    // Total Acciones de Formación: distinct afid.
    const afSet = new Set(activos.map((c) => c.afid).filter(Boolean))

    // Total Grupos: distinct (af-grupo).
    const grupoSet = new Set(activos.filter((c) => c.grupo).map((c) => `${c.afid}-${c.grupo}`))

    // Total UT: distinct (af, numero UT).
    const utSet = new Set(activos.filter((c) => c.numunidadtematica).map((c) => `${c.afid}-${c.numunidadtematica}`))

    // Total capacitadores: distinct numdocumento.
    const capSet = new Set(activos.map((c) => c.numdocumento).filter(Boolean))

    // Total beneficiarios: por (af-grupo) tomar MAX(beneficiariosporgrupo) y sumar.
    const grpBenef = new Map<string, number>()
    activos.forEach((c) => {
      if (!c.grupo) return
      const k = `${c.afid}-${c.grupo}`
      grpBenef.set(k, Math.max(grpBenef.get(k) ?? 0, num(c.beneficiariosporgrupo)))
    })
    const beneficiarios = Array.from(grpBenef.values()).reduce((s, v) => s + v, 0)

    // Total horas: suma de horas por sesión sobre las filas válidas.
    const horas = activos.reduce((s, c) => s + num(c.numhorastotales), 0)

    // Departamentos impactados (cobertura).
    const deptoSet = new Set<string>()
    activos.forEach((c) => departamentosDe(c).forEach((d) => deptoSet.add(d)))

    // Tiempos promedio.
    const promInterv = promedio(activos.map((c) => diasPlazo(c.fecharemision, c.fecharadinterventoria)))
    const promSena = promedio(activos.map((c) => diasPlazo(c.fecharemision, c.fecharadicadosena)))

    return {
      cronogramas: setCronogramas.size,
      af: afSet.size,
      grupos: grupoSet.size,
      ut: utSet.size,
      capacitadores: capSet.size,
      beneficiarios,
      horas,
      departamentos: deptoSet.size,
      promInterv,
      promSena,
    }
  }, [filtrados, activos])

  // Duración promedio del cronograma por proyecto (min inicio → max fin).
  const duracionProm = useMemo(() => {
    const rango = new Map<string, { ini: number; fin: number }>()
    activos.forEach((c) => {
      const ini = parseFecha(c.fechainicio)
      const fin = parseFecha(c.fechafin)
      if (ini === null && fin === null) return
      const cur = rango.get(c.proyectoid) ?? { ini: Infinity, fin: -Infinity }
      if (ini !== null) cur.ini = Math.min(cur.ini, ini)
      if (fin !== null) cur.fin = Math.max(cur.fin, fin)
      rango.set(c.proyectoid, cur)
    })
    const dur = Array.from(rango.values())
      .filter((r) => r.ini !== Infinity && r.fin !== -Infinity)
      .map((r) => Math.round((r.fin - r.ini) / 86_400_000))
    return promedio(dur)
  }, [activos])

  // ── Agrupaciones para gráficos ────────────────────────────────────────────────
  const porModalidad = useMemo(() => agrupar(activos, (c) => c.modalidad || 'Sin modalidad'), [activos])
  const porCorte = useMemo(
    () =>
      ORDEN_CORTE.map((label) => ({ label, value: activos.filter((c) => tipoEntrega(c.radicado) === label).length })).filter(
        (d) => d.value > 0,
      ),
    [activos],
  )
  const porEstado = useMemo(() => agrupar(filtrados, (c) => c.estadocronograma?.trim() || 'Sin estado'), [filtrados])
  const porDepto = useMemo(() => {
    const map = new Map<string, number>()
    activos.forEach((c) => departamentosDe(c).forEach((d) => map.set(d, (map.get(d) ?? 0) + 1)))
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [activos])

  // Tabla a nivel de cronograma (una fila por proyecto-radicado).
  const tabla = useMemo(() => {
    const map = new Map<string, Cronograma>()
    activos.forEach((c) => {
      const k = `${c.proyectoid}-${c.radicado}`
      if (!map.has(k)) map.set(k, c)
    })
    return Array.from(map.values())
  }, [activos])

  const hayFiltros = fConvocatoria || fProyecto || fModalidad || fEstado

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-3xl shadow-lg px-6 py-6 sm:px-8 sm:py-7"
        style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #001f33 70%, #000a14 100%)` }}
      >
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full opacity-10" style={{ background: INSTITUTIONAL }} />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0">
            <CalendarRange size={28} className="text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: INSTITUTIONAL }}>
              Tablero de Seguimiento
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">Cronograma</h1>
            <p className="text-sm text-white/60 mt-0.5">Programa de Formación Continua Especializada</p>
          </div>
        </div>
      </div>

      {errMsg && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <ShieldAlert size={16} />
          {errMsg}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-neutral-500 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Cargando reporte...
        </div>
      )}

      {!loading && !errMsg && (
        <>
          {/* ── Filtros ─────────────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-2 text-[#00304D] font-bold text-sm">
                <Filter size={16} /> Filtros
              </div>
              {hayFiltros && (
                <button
                  onClick={limpiarFiltros}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-[#C4003D] transition-colors"
                >
                  <RotateCcw size={13} /> Limpiar filtros
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
              <SelectFiltro
                label="Convocatoria"
                value={fConvocatoria}
                onChange={(v) => {
                  setFConvocatoria(v)
                  setFProyecto('')
                }}
                options={convocatorias.map((c) => ({ value: c.convocatoriaid, label: c.convocatoria }))}
              />
              <SelectFiltro
                label="Convenio / Proyecto"
                value={fProyecto}
                onChange={setFProyecto}
                options={proyectos.map((p) => ({ value: p.proyectoid, label: p.proyecto }))}
              />
              <SelectFiltro
                label="Modalidad"
                value={fModalidad}
                onChange={setFModalidad}
                options={modalidades.map((m) => ({ value: m, label: m }))}
              />
              <SelectFiltro
                label="Estado"
                value={fEstado}
                onChange={setFEstado}
                options={estados.map((e) => ({ value: e, label: e }))}
              />
              <SelectFiltro
                label="Corte"
                value={fCorte}
                onChange={setFCorte}
                options={cortes.map((c) => ({ value: c, label: c }))}
              />
            </div>
          </section>

          {/* ── KPIs ───────────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={CalendarRange} color="#00304D" label="Cronogramas" value={fmtInt(kpis.cronogramas)} hint="Radicados válidos" />
            <KpiCard icon={GraduationCap} color="#0070C0" label="Acciones de formación" value={fmtInt(kpis.af)} />
            <KpiCard icon={Layers} color="#7C3AED" label="Grupos" value={fmtInt(kpis.grupos)} />
            <KpiCard icon={BookOpen} color="#C47900" label="Unidades temáticas" value={fmtInt(kpis.ut)} />
            <KpiCard icon={UserSquare2} color="#0F766E" label="Capacitadores" value={fmtInt(kpis.capacitadores)} hint="Registrados" />
            <KpiCard icon={Users} color="#39A900" label="Beneficiarios" value={fmtInt(kpis.beneficiarios)} />
            <KpiCard icon={Clock} color="#0891B2" label="Horas" value={fmtInt(kpis.horas)} hint="Total programadas" />
            <KpiCard icon={MapPin} color="#C4003D" label="Departamentos" value={fmtInt(kpis.departamentos)} hint="Cobertura" />
          </section>

          {/* ── Tiempos ────────────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
            <div className="flex items-center gap-2 text-[#00304D] font-bold text-sm mb-1">
              <CalendarClock size={16} /> Tiempos promedio
            </div>
            <p className="text-[11px] text-neutral-400 mb-4">
              Plazos de radicación medidos desde la fecha de remisión; duración según fechas de inicio y fin del cronograma.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DuracionCard color="#0070C0" titulo="Remisión → Radicado interventoría" dias={kpis.promInterv} />
              <DuracionCard color="#39A900" titulo="Remisión → Radicado SENA" dias={kpis.promSena} />
              <DuracionCard color="#C47900" titulo="Duración del cronograma (inicio → fin)" dias={duracionProm} />
            </div>
          </section>

          {/* ── Gráficos ───────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Modalidad" icon={ListChecks}>
              <DonutChart data={porModalidad} unit="registros" />
            </ChartCard>
            <ChartCard title="Tipo de entrega (corte)" icon={CalendarClock}>
              <DonutChart data={porCorte} unit="registros" />
            </ChartCard>
            <ChartCard title="Estado del cronograma" icon={ListChecks}>
              <BarList data={porEstado} unit="registros" />
            </ChartCard>
            <ChartCard title="Cobertura por departamento" icon={MapPin}>
              <BarList data={porDepto} unit="registros" />
            </ChartCard>
          </section>

          {/* ── Tabla / informe ────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2 text-[#00304D] font-bold text-sm">
              <FileSpreadsheet size={16} /> Cronogramas radicados
              <span className="ml-auto text-xs font-semibold text-neutral-400">{fmtInt(tabla.length)} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-400 bg-neutral-50">
                    <th className="px-4 py-3 font-semibold">Proyecto</th>
                    <th className="px-4 py-3 font-semibold">Modalidad</th>
                    <th className="px-4 py-3 font-semibold">Corte</th>
                    <th className="px-4 py-3 font-semibold text-center">Rad. interv.</th>
                    <th className="px-4 py-3 font-semibold text-center">Rad. SENA</th>
                    <th className="px-4 py-3 font-semibold text-center">Días a interv.</th>
                    <th className="px-4 py-3 font-semibold text-center">Días a SENA</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {tabla.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-neutral-400 text-sm">
                        No hay cronogramas que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    tabla.map((c) => {
                      const dInterv = diasPlazo(c.fecharemision, c.fecharadinterventoria)
                      const dSena = diasPlazo(c.fecharemision, c.fecharadicadosena)
                      return (
                        <tr key={`${c.proyectoid}-${c.radicado}`} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="px-4 py-3 max-w-[260px]">
                            <p className="font-semibold text-[#00304D] truncate" title={c.proyecto}>{c.proyecto}</p>
                            <p className="text-[11px] text-neutral-400 truncate">{c.convocatoria}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#00304D]/5 text-[#00304D] border border-[#00304D]/10">
                              {c.modalidad || c.tipocronograma || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] text-neutral-600 whitespace-nowrap">{tipoEntrega(c.radicado)}</span>
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums text-neutral-600">{c.radicadointerventoria || '—'}</td>
                          <td className="px-4 py-3 text-center tabular-nums text-neutral-600">{c.radicadosena || '—'}</td>
                          <td className="px-4 py-3 text-center tabular-nums text-neutral-700">{dInterv === null ? '—' : `${dInterv} d`}</td>
                          <td className="px-4 py-3 text-center tabular-nums font-semibold text-[#00304D]">{dSena === null ? '—' : `${dSena} d`}</td>
                          <td className="px-4 py-3">
                            <EstadoBadge valor={c.estadocronograma} />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

// ── Agrupador genérico ──────────────────────────────────────────────────────────
function agrupar(items: Cronograma[], keyFn: (c: Cronograma) => string) {
  const map = new Map<string, number>()
  for (const it of items) {
    const k = keyFn(it)
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

// ── Subcomponentes ──────────────────────────────────────────────────────────────
function SelectFiltro({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-neutral-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#39A900]/30 focus:border-[#39A900] transition"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  color,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  color: string
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}14` }}>
        <Icon size={20} style={{ color }} />
      </span>
      <div>
        <p className="text-2xl font-bold text-neutral-900 leading-none tabular-nums">{value}</p>
        <p className="text-xs font-semibold text-neutral-500 mt-1">{label}</p>
        {hint && <p className="text-[10px] text-neutral-400 truncate">{hint}</p>}
      </div>
    </div>
  )
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 flex flex-col">
      <div className="flex items-center gap-2 text-[#00304D] font-bold text-sm mb-4">
        {Icon && <Icon size={16} />} {title}
      </div>
      {children}
    </div>
  )
}

function DuracionCard({ color, titulo, dias }: { color: string; titulo: string; dias: number | null }) {
  return (
    <div className="rounded-xl border border-neutral-100 p-4 bg-gradient-to-br from-white to-neutral-50 flex items-center gap-4">
      <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}14` }}>
        <CalendarClock size={20} style={{ color }} />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-neutral-900 leading-none tabular-nums">
          {dias === null ? '—' : dias}
          {dias !== null && <span className="text-sm font-semibold text-neutral-400 ml-1">días</span>}
        </p>
        <p className="text-xs font-semibold text-neutral-500 mt-1 truncate" title={titulo}>{titulo}</p>
      </div>
      <ArrowRight size={18} className="text-neutral-200 ml-auto shrink-0" />
    </div>
  )
}

function EstadoBadge({ valor }: { valor: string }) {
  const v = norm(valor)
  const map: Record<string, string> = {
    MODIFICAR: 'bg-amber-50 text-amber-800 border-amber-200',
    REVERTIDO: 'bg-red-50 text-red-700 border-red-200',
  }
  const cls = map[v] ?? 'bg-emerald-50 text-emerald-700 border-emerald-200'
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{valor?.trim() || '—'}</span>
}

function BarList({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  if (data.length === 0) return <EmptyChart />
  return (
    <div className="flex flex-col gap-3">
      {data.map((d, i) => (
        <div key={d.label} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-700 font-medium truncate pr-2" title={d.label}>{d.label}</span>
            <span className="text-neutral-500 font-semibold tabular-nums shrink-0">{fmtInt(d.value)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
            />
          </div>
        </div>
      ))}
      <p className="text-[10px] text-neutral-300 mt-1">Valores en {unit}</p>
    </div>
  )
}

function DonutChart({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <EmptyChart />
  let acc = 0
  const stops = data
    .map((d, i) => {
      const start = (acc / total) * 100
      acc += d.value
      const end = (acc / total) * 100
      return `${PALETTE[i % PALETTE.length]} ${start}% ${end}%`
    })
    .join(', ')
  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative w-36 h-36 rounded-full shrink-0" style={{ background: `conic-gradient(${stops})` }}>
        <div className="absolute inset-[22%] bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
          <span className="text-xl font-bold text-[#00304D] leading-none">{fmtInt(total)}</span>
          <span className="text-[10px] text-neutral-400">{unit}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-2 w-full">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            <span className="text-neutral-700 truncate flex-1" title={d.label}>{d.label}</span>
            <span className="font-semibold text-neutral-800 tabular-nums">{fmtInt(d.value)}</span>
            <span className="text-neutral-400 tabular-nums w-10 text-right">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EmptyChart() {
  return <div className="text-center text-neutral-400 text-sm py-8">Sin datos para mostrar.</div>
}
