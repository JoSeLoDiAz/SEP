'use client'

import api from '@/lib/api'
import {
  Loader2,
  ShieldAlert,
  UserCog,
  CheckCircle2,
  XCircle,
  Clock,
  FileSignature,
  Filter,
  RotateCcw,
  UserCheck,
  CalendarClock,
  FileSpreadsheet,
  ArrowRight,
  Link2,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

// El backend (Oracle) devuelve los alias tal cual (minúsculas).
interface Director {
  proyectoid: number
  convocatoriaid: number
  convocatoria: string
  proyectonombre: string
  empresaidentificacion: string
  empresadigitoverificacion: string
  fecharemisionconviniente: string | null
  numradresouestainterventoria: string
  fecharesinterventoria: string | null
  nisradicadosena: string
  numradicadosena: string
  fecharadicadosena: string | null
  estado: number | string
  relacioncontractual: string // 'SI' | 'NO' | null
  tipodocumento: string
  numdocumento: string
  director: string
  telefono: string
  correo: string
  interventor: string
  validacionsena: string
  prefesionalsena: string
  aprobacionhv: string // 'SIN EVALUAR' | 'APROBADO' | 'CUMPLE PARCIALMENTE' | 'RECHAZADO'
}

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'
const PALETTE = ['#00304D', '#39A900', '#0070C0', '#C47900', '#7C3AED', '#0F766E', '#C4003D', '#0891B2']

const nfInt = new Intl.NumberFormat('es-CO')
const fmtInt = (n: number) => nfInt.format(Math.round(n || 0))

function parseFecha(s: string | null): number | null {
  if (!s) return null
  const t = new Date(s).getTime()
  if (isNaN(t)) return null
  // Descarta años inválidos por errores de digitación (p.ej. "0025").
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
function fmtDias(n: number | null) {
  if (n === null) return '—'
  return `${n} d`
}
function promedio(nums: (number | null)[]) {
  const v = nums.filter((n): n is number => n !== null)
  if (v.length === 0) return null
  return Math.round(v.reduce((s, n) => s + n, 0) / v.length)
}

export default function DirectoresPage() {
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [directores, setDirectores] = useState<Director[]>([])

  const [fConvocatoria, setFConvocatoria] = useState('')
  const [fProyecto, setFProyecto] = useState('')
  const [fDirector, setFDirector] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [fRelacion, setFRelacion] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    setErrMsg('')
    try {
      const res = await api.get<Director[]>('/dashboards/directores')
      setDirectores(res.data ?? [])
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      if (status === 403) setErrMsg('No tienes permisos para acceder al reporte de directores.')
      else setErrMsg(msg ?? 'Error cargando el reporte de Directores.')
    } finally {
      setLoading(false)
    }
  }

  function limpiarFiltros() {
    setFConvocatoria('')
    setFProyecto('')
    setFDirector('')
    setFEstado('')
    setFRelacion('')
  }

  // ── Deduplicar (el join con HVPersona puede multiplicar filas) ─────────────────
  const base = useMemo(
    () =>
      Array.from(
        new Map(directores.map((d) => [`${d.proyectoid}-${d.numdocumento}`, d])).values(),
      ),
    [directores],
  )

  // ── Opciones de filtro ─────────────────────────────────────────────────────────
  const convocatorias = useMemo(
    () =>
      Array.from(new Map(base.map((d) => [d.convocatoriaid, d])).values()).sort((a, b) =>
        (a.convocatoria || '').localeCompare(b.convocatoria || ''),
      ),
    [base],
  )
  const proyectos = useMemo(
    () =>
      Array.from(
        new Map(
          base
            .filter((d) => (fConvocatoria ? d.convocatoriaid === Number(fConvocatoria) : true))
            .map((d) => [d.proyectoid, d]),
        ).values(),
      ).sort((a, b) => (a.proyectonombre || '').localeCompare(b.proyectonombre || '')),
    [base, fConvocatoria],
  )
  const nombresDirectores = useMemo(
    () => Array.from(new Set(base.map((d) => d.director).filter(Boolean))).sort(),
    [base],
  )
  const estadosDisponibles = useMemo(
    () => Array.from(new Set(base.map((d) => d.aprobacionhv).filter(Boolean))).sort(),
    [base],
  )

  // ── Aplicar filtros ─────────────────────────────────────────────────────────────
  const filtrados = useMemo(
    () =>
      base.filter(
        (d) =>
          (fConvocatoria ? d.convocatoriaid === Number(fConvocatoria) : true) &&
          (fProyecto ? d.proyectoid === Number(fProyecto) : true) &&
          (fDirector ? d.director === fDirector : true) &&
          (fEstado ? d.aprobacionhv === fEstado : true) &&
          (fRelacion ? (d.relacioncontractual || 'Sin dato') === fRelacion : true),
      ),
    [base, fConvocatoria, fProyecto, fDirector, fEstado, fRelacion],
  )

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = filtrados.length
    const aprobados = filtrados.filter((d) => d.aprobacionhv === 'APROBADO').length
    const rechazados = filtrados.filter((d) => d.aprobacionhv === 'RECHAZADO').length
    const parciales = filtrados.filter((d) => d.aprobacionhv === 'CUMPLE PARCIALMENTE').length
    const conRelacion = filtrados.filter((d) => d.relacioncontractual === 'SI').length
    // Ambos intervalos se miden DESDE la remisión del conviniente.
    const promAInterv = promedio(filtrados.map((d) => diasPlazo(d.fecharemisionconviniente, d.fecharesinterventoria)))
    const promASena = promedio(filtrados.map((d) => diasPlazo(d.fecharemisionconviniente, d.fecharadicadosena)))
    return { total, aprobados, rechazados, parciales, conRelacion, promAInterv, promASena }
  }, [filtrados])

  const porEstado = useMemo(() => agrupar(filtrados, (d) => d.aprobacionhv || 'SIN ESTADO'), [filtrados])
  const porRelacion = useMemo(
    () => agrupar(filtrados, (d) => (d.relacioncontractual ? `Relación: ${d.relacioncontractual}` : 'Sin dato')),
    [filtrados],
  )
  const porInterventor = useMemo(
    () => agrupar(filtrados, (d) => d.interventor || 'Sin interventor').slice(0, 8),
    [filtrados],
  )

  const hayFiltros = fConvocatoria || fProyecto || fDirector || fEstado || fRelacion

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
            <UserCog size={28} className="text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: INSTITUTIONAL }}>
              Tablero de Seguimiento
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">Directores</h1>
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
                options={convocatorias.map((c) => ({ value: String(c.convocatoriaid), label: c.convocatoria }))}
              />
              <SelectFiltro
                label="Proyecto"
                value={fProyecto}
                onChange={setFProyecto}
                options={proyectos.map((p) => ({ value: String(p.proyectoid), label: p.proyectonombre }))}
              />
              <SelectFiltro
                label="Director"
                value={fDirector}
                onChange={setFDirector}
                options={nombresDirectores.map((d) => ({ value: d, label: d }))}
              />
              <SelectFiltro
                label="Estado"
                value={fEstado}
                onChange={setFEstado}
                options={estadosDisponibles.map((e) => ({ value: e, label: e }))}
              />
              <SelectFiltro
                label="Relación contractual"
                value={fRelacion}
                onChange={setFRelacion}
                options={[
                  { value: 'SI', label: 'Sí' },
                  { value: 'NO', label: 'No' },
                ]}
              />
            </div>
          </section>

          {/* ── KPIs ───────────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard icon={UserCog} color="#00304D" label="Directores" value={fmtInt(kpis.total)} hint="Total (sin duplicados)" />
            <KpiCard icon={CheckCircle2} color="#39A900" label="Aprobados" value={fmtInt(kpis.aprobados)} hint="Hoja de vida" />
            <KpiCard icon={XCircle} color="#C4003D" label="Rechazados" value={fmtInt(kpis.rechazados)} hint="Hoja de vida" />
            <KpiCard icon={FileSignature} color="#C47900" label="Cumple parcial" value={fmtInt(kpis.parciales)} hint="Requiere cambio/ajuste" />
            <KpiCard icon={Link2} color="#0F766E" label="Con relación" value={fmtInt(kpis.conRelacion)} hint="Relación contractual (SÍ)" />
            <KpiCard icon={Clock} color="#0070C0" label="Días trámite" value={fmtDias(kpis.promASena)} hint="Promedio remisión → SENA" />
          </section>

          {/* ── Tiempos de trámite (medidos desde la remisión) ─────────────────── */}
          <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
            <div className="flex items-center gap-2 text-[#00304D] font-bold text-sm mb-1">
              <CalendarClock size={16} /> Días promedio desde la remisión del conviniente
            </div>
            <p className="text-[11px] text-neutral-400 mb-4">
              Ambos plazos se cuentan desde la fecha de remisión del conviniente.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DuracionCard color="#0070C0" titulo="Remisión → Respuesta interventoría" dias={kpis.promAInterv} />
              <DuracionCard color="#39A900" titulo="Remisión → Radicado SENA" dias={kpis.promASena} />
            </div>
          </section>

          {/* ── Gráficos ───────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="Estado de la hoja de vida" icon={UserCheck}>
              <DonutChart data={porEstado} unit="directores" />
            </ChartCard>
            <ChartCard title="Relación contractual">
              <DonutChart data={porRelacion} unit="directores" />
            </ChartCard>
            <ChartCard title="Interventores" icon={UserCheck}>
              <BarList data={porInterventor} unit="directores" />
            </ChartCard>
          </section>

          {/* ── Tabla / informe ────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2 text-[#00304D] font-bold text-sm">
              <FileSpreadsheet size={16} /> Detalle de directores
              <span className="ml-auto text-xs font-semibold text-neutral-400">{fmtInt(filtrados.length)} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-400 bg-neutral-50">
                    <th className="px-4 py-3 font-semibold">Director / Proyecto</th>
                    <th className="px-4 py-3 font-semibold">Interventor</th>
                    <th className="px-4 py-3 font-semibold text-center">Rel. contractual</th>
                    <th className="px-4 py-3 font-semibold text-center">Días a interventoría</th>
                    <th className="px-4 py-3 font-semibold text-center">Días a SENA</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-neutral-400 text-sm">
                        No hay directores que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filtrados.map((d) => {
                      const dInterv = diasPlazo(d.fecharemisionconviniente, d.fecharesinterventoria)
                      const dSena = diasPlazo(d.fecharemisionconviniente, d.fecharadicadosena)
                      return (
                        <tr key={`${d.proyectoid}-${d.numdocumento}`} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="px-4 py-3 max-w-[260px]">
                            <p className="font-semibold text-[#00304D] truncate" title={d.director}>{d.director || '—'}</p>
                            <p className="text-[11px] text-neutral-400 truncate" title={d.proyectonombre}>{d.proyectonombre}</p>
                          </td>
                          <td className="px-4 py-3 max-w-[180px] text-neutral-700 truncate" title={d.interventor}>
                            {d.interventor || '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <RelacionBadge valor={d.relacioncontractual} />
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums text-neutral-700">{fmtDias(dInterv)}</td>
                          <td className="px-4 py-3 text-center tabular-nums font-semibold text-[#00304D]">{fmtDias(dSena)}</td>
                          <td className="px-4 py-3">
                            <EstadoBadge valor={d.aprobacionhv} />
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
function agrupar(items: Director[], keyFn: (d: Director) => string) {
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
        <p className="text-xs font-semibold text-neutral-500 mt-1 truncate">{titulo}</p>
      </div>
      <ArrowRight size={18} className="text-neutral-200 ml-auto shrink-0" />
    </div>
  )
}

function RelacionBadge({ valor }: { valor: string }) {
  if (valor === 'SI')
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Sí</span>
  if (valor === 'NO')
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200">No</span>
  return <span className="text-[11px] text-neutral-400">—</span>
}

function EstadoBadge({ valor }: { valor: string }) {
  const map: Record<string, string> = {
    APROBADO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    RECHAZADO: 'bg-red-50 text-red-700 border-red-200',
    'CUMPLE PARCIALMENTE': 'bg-amber-50 text-amber-800 border-amber-200',
    'SIN EVALUAR': 'bg-neutral-100 text-neutral-500 border-neutral-200',
  }
  const cls = map[valor] ?? 'bg-neutral-100 text-neutral-500 border-neutral-200'
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{valor || '—'}</span>
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
