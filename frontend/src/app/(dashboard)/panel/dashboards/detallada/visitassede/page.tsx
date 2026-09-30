'use client'

import api from '@/lib/api'
import {
  Loader2,
  ShieldAlert,
  Building2,
  MapPin,
  Clock,
  Filter,
  RotateCcw,
  CalendarClock,
  FileSpreadsheet,
  ArrowRight,
  ListChecks,
  CalendarDays,
  Gauge,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

// El backend (Oracle) devuelve los alias tal cual (minúsculas).
interface Visita {
  visitaid: number
  proyectoid: number
  proyecto: string
  convocatoriaid: number
  convocatoria: string
  numconvenio: string
  empresa: string
  sigla: string
  fechavisita: string | null
  horavisita: string
  departamento: string
  ciudad: string
  fechainformevisita: string | null
  numradicadosena: string
  fecharadicadosena: string | null
  porcentajeejecuciontecnica: number
  porcentajeejecucionfinanciera: number
  porcentajeejecucioncofinanciacion: number
  porcentajeejecucionespecie: number
  porcentajeejecuciondinero: number
  fecharemisionconviniente: string | null
  fecharespuestainterventoria: string | null
  nisradicadosena: string
  modalidadvisita: string // Presencial | Virtual | PAT
  tipovisita: string
  numvisita: number
  radicadointerventoria: string
  verificacionsena: string // CUMPLE | NO CUMPLE
  nombreusuario: string
}

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'
const PALETTE = ['#00304D', '#39A900', '#0070C0', '#C47900', '#7C3AED', '#0F766E', '#C4003D', '#0891B2']

const nfInt = new Intl.NumberFormat('es-CO')
const fmtInt = (n: number) => nfInt.format(Math.round(n || 0))
function num(v: unknown) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}
// Los porcentajes pueden venir como fracción (0-1) o como 0-100. Se normaliza a 0-100.
function pct(v: unknown) {
  const n = num(v)
  return n > 0 && n <= 1 ? n * 100 : n
}
function parseFecha(s: string | null): number | null {
  if (!s) return null
  const t = new Date(s).getTime()
  if (isNaN(t)) return null
  if (new Date(t).getFullYear() < 2000) return null
  return t
}
function diasEntre(a: string | null, b: string | null): number | null {
  const d1 = parseFecha(a)
  const d2 = parseFecha(b)
  if (d1 === null || d2 === null) return null
  return Math.round((d2 - d1) / 86_400_000)
}
// Plazo de trámite: un valor negativo (radicado antes de la remisión) es inconsistente.
function diasPlazo(a: string | null, b: string | null): number | null {
  const d = diasEntre(a, b)
  return d === null || d < 0 ? null : d
}
const fmtDias = (n: number | null) => (n === null ? '—' : `${n} d`)
function promedio(nums: (number | null)[]) {
  const v = nums.filter((n): n is number => n !== null)
  if (v.length === 0) return null
  return v.reduce((s, n) => s + n, 0) / v.length
}
function fmtFecha(s: string | null) {
  if (!s) return '—'
  const t = new Date(s)
  if (isNaN(t.getTime())) return '—'
  return t.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
function mesAnio(s: string | null): string | null {
  if (!s) return null
  const t = new Date(s)
  if (isNaN(t.getTime()) || t.getFullYear() < 2000) return null
  return `${MESES[t.getMonth()]} ${t.getFullYear()}`
}
function ordenMes(label: string): number {
  const [mes, anio] = label.split(' ')
  return Number(anio) * 12 + MESES.indexOf(mes)
}

export default function VisitasSedePage() {
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [visitas, setVisitas] = useState<Visita[]>([])

  const [fConvocatoria, setFConvocatoria] = useState('')
  const [fProyecto, setFProyecto] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    setErrMsg('')
    try {
      const res = await api.get<Visita[]>('/dashboards/visitassede', { timeout: 90_000 })
      setVisitas(res.data ?? [])
    } catch (err: unknown) {
      console.error('[visitassede] error al cargar:', err)
      const e = err as { code?: string; message?: string; response?: { status?: number; data?: { message?: string } } }
      const status = e?.response?.status
      if (e?.code === 'ECONNABORTED') setErrMsg('La consulta tardó demasiado y se canceló (timeout).')
      else if (status === 403) setErrMsg('No tienes permisos para acceder al reporte de visitas en sede.')
      else if (status) setErrMsg(`Error ${status} del servidor: ${e?.response?.data?.message ?? 'sin detalle'}`)
      else setErrMsg(`No se pudo conectar con el servidor: ${e?.message ?? 'error de red'}`)
    } finally {
      setLoading(false)
    }
  }

  function limpiarFiltros() {
    setFConvocatoria('')
    setFProyecto('')
  }

  // Deduplicar por visita (el join con Convenios puede multiplicar filas).
  const base = useMemo(
    () => Array.from(new Map(visitas.map((v) => [v.visitaid, v])).values()),
    [visitas],
  )

  // ── Opciones de filtro ─────────────────────────────────────────────────────────
  const convocatorias = useMemo(
    () =>
      Array.from(new Map(base.map((v) => [v.convocatoriaid, v])).values()).sort((a, b) =>
        (a.convocatoria || '').localeCompare(b.convocatoria || ''),
      ),
    [base],
  )
  const proyectos = useMemo(
    () =>
      Array.from(
        new Map(
          base
            .filter((v) => (fConvocatoria ? v.convocatoriaid === Number(fConvocatoria) : true))
            .map((v) => [v.proyectoid, v]),
        ).values(),
      ).sort((a, b) => (a.proyecto || '').localeCompare(b.proyecto || '')),
    [base, fConvocatoria],
  )

  // ── Aplicar filtros ─────────────────────────────────────────────────────────────
  const filtrados = useMemo(
    () =>
      base.filter(
        (v) =>
          (fConvocatoria ? v.convocatoriaid === Number(fConvocatoria) : true) &&
          (fProyecto ? v.proyectoid === Number(fProyecto) : true),
      ),
    [base, fConvocatoria, fProyecto],
  )

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalVisitas = filtrados.length
    const proyectosSet = new Set(filtrados.map((v) => v.proyectoid).filter(Boolean))
    const deptoSet = new Set(filtrados.map((v) => v.departamento).filter(Boolean))
    const promInterv = promedio(filtrados.map((v) => diasPlazo(v.fecharemisionconviniente, v.fecharespuestainterventoria)))
    const promSena = promedio(filtrados.map((v) => diasPlazo(v.fecharemisionconviniente, v.fecharadicadosena)))
    const ejecTecnica = promedio(filtrados.map((v) => pct(v.porcentajeejecuciontecnica)))
    return {
      totalVisitas,
      proyectos: proyectosSet.size,
      departamentos: deptoSet.size,
      promInterv: promInterv === null ? null : Math.round(promInterv),
      promSena: promSena === null ? null : Math.round(promSena),
      ejecTecnica,
    }
  }, [filtrados])

  // Ejecución promedio por rubro.
  const ejecucion = useMemo(
    () => [
      { label: 'Técnica', value: promedio(filtrados.map((v) => pct(v.porcentajeejecuciontecnica))) },
      { label: 'Financiera', value: promedio(filtrados.map((v) => pct(v.porcentajeejecucionfinanciera))) },
      { label: 'Cofinanciación', value: promedio(filtrados.map((v) => pct(v.porcentajeejecucioncofinanciacion))) },
      { label: 'Especie', value: promedio(filtrados.map((v) => pct(v.porcentajeejecucionespecie))) },
      { label: 'Dinero', value: promedio(filtrados.map((v) => pct(v.porcentajeejecuciondinero))) },
    ],
    [filtrados],
  )

  const porModalidad = useMemo(() => agrupar(filtrados, (v) => v.modalidadvisita || 'Sin modalidad'), [filtrados])
  const porTipo = useMemo(() => agrupar(filtrados, (v) => v.tipovisita || 'Sin tipo'), [filtrados])
  const porDepto = useMemo(() => agrupar(filtrados, (v) => v.departamento || 'Sin dato').slice(0, 8), [filtrados])
  const porMes = useMemo(() => {
    const map = new Map<string, number>()
    filtrados.forEach((v) => {
      const m = mesAnio(v.fechavisita)
      if (m) map.set(m, (map.get(m) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => ordenMes(a.label) - ordenMes(b.label))
  }, [filtrados])

  const hayFiltros = fConvocatoria || fProyecto

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
            <Building2 size={28} className="text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: INSTITUTIONAL }}>
              Tablero de Seguimiento
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">Visitas en Sede</h1>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectFiltro
                label="Convocatoria"
                value={fConvocatoria}
                onChange={(v) => {
                  setFConvocatoria(v)
                  setFProyecto('')
                }}
                options={convocatorias.map((c) => ({ value: String(c.convocatoriaid), label: c.convocatoria }))}
              />
              <SelectFiltro
                label="Proyecto"
                value={fProyecto}
                onChange={setFProyecto}
                options={proyectos.map((p) => ({ value: String(p.proyectoid), label: p.proyecto }))}
              />
            </div>
          </section>

          {/* ── KPIs ───────────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <KpiCard icon={Building2} color="#00304D" label="Visitas" value={fmtInt(kpis.totalVisitas)} hint="Total realizadas" />
            <KpiCard icon={MapPin} color="#C4003D" label="Departamentos" value={fmtInt(kpis.departamentos)} hint="Impactados" />
            <KpiCard icon={Clock} color="#0070C0" label="Días a interventoría" value={fmtDias(kpis.promInterv)} hint="Prom. remisión → respuesta" />
            <KpiCard icon={Clock} color="#0F766E" label="Días a SENA" value={fmtDias(kpis.promSena)} hint="Prom. remisión → radicado" />
            <KpiCard icon={Gauge} color="#39A900" label="Ejec. técnica" value={kpis.ejecTecnica === null ? '—' : `${Math.round(kpis.ejecTecnica)}%`} hint="Promedio" />
          </section>

          {/* ── Tiempos + Ejecución ────────────────────────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
              <div className="flex items-center gap-2 text-[#00304D] font-bold text-sm mb-1">
                <CalendarClock size={16} /> Tiempos de respuesta promedio
              </div>
              <p className="text-[11px] text-neutral-400 mb-4">Plazos contados desde la fecha de remisión del conviniente.</p>
              <div className="grid grid-cols-1 gap-3">
                <DuracionCard color="#0070C0" titulo="Remisión → Respuesta interventoría" dias={kpis.promInterv} />
                <DuracionCard color="#39A900" titulo="Remisión → Radicado SENA" dias={kpis.promSena} />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
              <div className="flex items-center gap-2 text-[#00304D] font-bold text-sm mb-4">
                <Gauge size={16} /> Ejecución promedio (%)
              </div>
              <div className="flex flex-col gap-3">
                {ejecucion.map((e, i) => (
                  <div key={e.label} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-700 font-medium">{e.label}</span>
                      <span className="text-neutral-500 font-semibold tabular-nums">
                        {e.value === null ? '—' : `${Math.round(e.value)}%`}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, e.value ?? 0)}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Gráficos ───────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Modalidad de la visita" icon={ListChecks}>
              <DonutChart data={porModalidad} unit="visitas" />
            </ChartCard>
            <ChartCard title="Tipo de visita" icon={ListChecks}>
              <DonutChart data={porTipo} unit="visitas" />
            </ChartCard>
            <ChartCard title="Departamentos impactados" icon={MapPin}>
              <BarList data={porDepto} unit="visitas" />
            </ChartCard>
            <ChartCard title="Visitas por mes" icon={CalendarDays}>
              <BarList data={porMes} unit="visitas" />
            </ChartCard>
          </section>

          {/* ── Tabla / informe ────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2 text-[#00304D] font-bold text-sm">
              <FileSpreadsheet size={16} /> Detalle de visitas
              <span className="ml-auto text-xs font-semibold text-neutral-400">{fmtInt(filtrados.length)} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-400 bg-neutral-50">
                    <th className="px-4 py-3 font-semibold">Proyecto</th>
                    <th className="px-4 py-3 font-semibold text-center"># Visita</th>
                    <th className="px-4 py-3 font-semibold text-center">Modalidad</th>
                    <th className="px-4 py-3 font-semibold">Ubicación</th>
                    <th className="px-4 py-3 font-semibold text-center">Fecha</th>
                    <th className="px-4 py-3 font-semibold text-center">Ejec. téc.</th>
                    <th className="px-4 py-3 font-semibold text-center">Días interv.</th>
                    <th className="px-4 py-3 font-semibold text-center">Días SENA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-neutral-400 text-sm">
                        No hay visitas que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filtrados.map((v) => {
                      const dInter = diasPlazo(v.fecharemisionconviniente, v.fecharespuestainterventoria)
                      const dSena = diasPlazo(v.fecharemisionconviniente, v.fecharadicadosena)
                      return (
                        <tr key={v.visitaid} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="px-4 py-3 max-w-[240px]">
                            <p className="font-semibold text-[#00304D] truncate" title={v.proyecto}>{v.proyecto}</p>
                            <p className="text-[11px] text-neutral-400 truncate">{v.sigla || v.convocatoria}</p>
                          </td>
                          <td className="px-4 py-3 text-center text-neutral-700">{v.numvisita || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#00304D]/5 text-[#00304D] border border-[#00304D]/10">
                              {v.modalidadvisita || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-[170px]">
                            <p className="truncate text-neutral-700" title={v.ciudad}>{v.ciudad || '—'}</p>
                            <p className="text-[11px] text-neutral-400">{v.departamento || '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums text-neutral-600 whitespace-nowrap">{fmtFecha(v.fechavisita)}</td>
                          <td className="px-4 py-3 text-center tabular-nums text-neutral-700">{Math.round(pct(v.porcentajeejecuciontecnica))}%</td>
                          <td className="px-4 py-3 text-center tabular-nums text-neutral-700">{fmtDias(dInter)}</td>
                          <td className="px-4 py-3 text-center tabular-nums font-semibold text-[#00304D]">{fmtDias(dSena)}</td>
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
function agrupar(items: Visita[], keyFn: (v: Visita) => string) {
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
        <p className="text-2xl font-bold text-neutral-900 leading-none tabular-nums" title={hint}>{value}</p>
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
