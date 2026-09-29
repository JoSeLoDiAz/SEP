'use client'

import api from '@/lib/api'
import {
  Loader2,
  ShieldAlert,
  BookOpen,
  CheckCircle2,
  Clock,
  Filter,
  RotateCcw,
  CalendarClock,
  FileSpreadsheet,
  ArrowRight,
  ListChecks,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

// El backend (Oracle) devuelve los alias tal cual (minúsculas).
// Se omiten en esta interfaz las columnas de checklist de calidad (libro*, cartilla*,
// recursodidactico*, folleto*) que el tablero no usa.
interface Material {
  materialid: number
  convocatoriaid: number
  convocatoria: string
  proyectoid: number
  proyecto: string
  fecharemisionconvenio: string | null
  afid: number
  numaf: string
  accionformacion: string
  materialformacion: string
  fecharadremisioninterventoria: string | null
  remisionradinterventoria: string
  fecharespinterventoria: string | null
  fecharadsena: string | null
  nisradsena: string
  radicadosena: string
  estado: string // APROBADO | NO APROBADO | SIN RESPUESTA | SIN VALIDAR
  usuariointerventoria: string
  estadosena: string // CUMPLE | NO CUMPLE | SIN VALIDAR
  usuariosena: string
}

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'
const PALETTE = ['#00304D', '#39A900', '#0070C0', '#C47900', 'x', '#0F766E', '#C4003D', '#0891B2']

const nfInt = new Intl.NumberFormat('es-CO')
const fmtInt = (n: number) => nfInt.format(Math.round(n || 0))
const norm = (s: string | null | undefined) => (s ?? '').trim().toUpperCase()

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
  return Math.round(v.reduce((s, n) => s + n, 0) / v.length)
}

export default function MaterialFormacionPage() {
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [materiales, setMateriales] = useState<Material[]>([])

  const [fConvocatoria, setFConvocatoria] = useState('')
  const [fProyecto, setFProyecto] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [fMaterial, setFMaterial] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    setErrMsg('')
    try {
      const res = await api.get<Material[]>('/dashboards/materialformacion', { timeout: 60_000 })
      setMateriales(res.data ?? [])
    } catch (err: unknown) {
      console.error('[materialformacion] error al cargar:', err)
      const e = err as { code?: string; message?: string; response?: { status?: number; data?: { message?: string } } }
      const status = e?.response?.status
      if (e?.code === 'ECONNABORTED') setErrMsg('La consulta tardó demasiado y se canceló (timeout).')
      else if (status === 403) setErrMsg('No tienes permisos para acceder al reporte de materiales de formación.')
      else if (status) setErrMsg(`Error ${status} del servidor: ${e?.response?.data?.message ?? 'sin detalle'}`)
      else setErrMsg(`No se pudo conectar con el servidor: ${e?.message ?? 'error de red'}`)
    } finally {
      setLoading(false)
    }
  }

  function limpiarFiltros() {
    setFConvocatoria('')
    setFProyecto('')
    setFEstado('')
    setFMaterial('')
  }

  const base = useMemo(
    () => Array.from(new Map(materiales.map((m) => [m.materialid, m])).values()),
    [materiales],
  )

  // ── Opciones de filtro ─────────────────────────────────────────────────────────
  const convocatorias = useMemo(
    () =>
      Array.from(new Map(base.map((m) => [m.convocatoriaid, m])).values()).sort((a, b) =>
        (a.convocatoria || '').localeCompare(b.convocatoria || ''),
      ),
    [base],
  )
  const proyectos = useMemo(
    () =>
      Array.from(
        new Map(
          base
            .filter((m) => (fConvocatoria ? m.convocatoriaid === Number(fConvocatoria) : true))
            .map((m) => [m.proyectoid, m]),
        ).values(),
      ).sort((a, b) => (a.proyecto || '').localeCompare(b.proyecto || '')),
    [base, fConvocatoria],
  )
  const estados = useMemo(() => Array.from(new Set(base.map((m) => m.estado).filter(Boolean))).sort(), [base])
  const materialesTipo = useMemo(
    () => Array.from(new Set(base.map((m) => m.materialformacion).filter(Boolean))).sort(),
    [base],
  )

  // ── Aplicar filtros ─────────────────────────────────────────────────────────────
  const filtrados = useMemo(
    () =>
      base.filter(
        (m) =>
          (fConvocatoria ? m.convocatoriaid === Number(fConvocatoria) : true) &&
          (fProyecto ? m.proyectoid === Number(fProyecto) : true) &&
          (fEstado ? m.estado === fEstado : true) &&
          (fMaterial ? m.materialformacion === fMaterial : true),
      ),
    [base, fConvocatoria, fProyecto, fEstado, fMaterial],
  )

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = filtrados.length
    const aprobados = filtrados.filter((m) => norm(m.estado) === 'APROBADO').length
    const noAprobados = filtrados.filter((m) => norm(m.estado) === 'NO APROBADO').length
    const cumpleSena = filtrados.filter((m) => norm(m.estadosena) === 'CUMPLE').length
    // Plazo 1: remisión convenio → radicado remisión interventoría.
    const promInterv = promedio(filtrados.map((m) => diasPlazo(m.fecharemisionconvenio, m.fecharadremisioninterventoria)))
    // Plazo 2: radicado remisión interventoría → radicado SENA.
    const promSena = promedio(filtrados.map((m) => diasPlazo(m.fecharadremisioninterventoria, m.fecharadsena)))
    return { total, aprobados, noAprobados, cumpleSena, promInterv, promSena }
  }, [filtrados])

  const porEstado = useMemo(() => agrupar(filtrados, (m) => m.estado || 'SIN VALIDAR'), [filtrados])
  const porValidacion = useMemo(() => agrupar(filtrados, (m) => m.estadosena || 'SIN VALIDAR'), [filtrados])
  const porTipo = useMemo(() => agrupar(filtrados, (m) => m.materialformacion || 'Sin tipo'), [filtrados])

  const hayFiltros = fConvocatoria || fProyecto || fEstado || fMaterial

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
            <BookOpen size={28} className="text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: INSTITUTIONAL }}>
              Tablero de Seguimiento
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">Materiales de Formación</h1>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
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
              <SelectFiltro
                label="Material de formación"
                value={fMaterial}
                onChange={setFMaterial}
                options={materialesTipo.map((m) => ({ value: m, label: m }))}
              />
              <SelectFiltro
                label="Estado"
                value={fEstado}
                onChange={setFEstado}
                options={estados.map((e) => ({ value: e, label: e }))}
              />
            </div>
          </section>

          {/* ── KPIs ───────────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <KpiCard icon={BookOpen} color="#00304D" label="Materiales" value={fmtInt(kpis.total)} hint="Total registrados" />
            <KpiCard icon={CheckCircle2} color="#39A900" label="Aprobados" value={fmtInt(kpis.aprobados)} hint="Interventoría" />
            <KpiCard icon={ShieldCheck} color="#0070C0" label="Cumplen SENA" value={fmtInt(kpis.cumpleSena)} hint="Validación SENA" />
            <KpiCard icon={Clock} color="#C47900" label="Días a interventoría" value={fmtDias(kpis.promInterv)} hint="Prom. remisión → radicado" />
            <KpiCard icon={Clock} color="#0F766E" label="Días a SENA" value={fmtDias(kpis.promSena)} hint="Prom. radicado interv. → SENA" />
          </section>

          {/* ── Tiempos de respuesta ───────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
            <div className="flex items-center gap-2 text-[#00304D] font-bold text-sm mb-4">
              <CalendarClock size={16} /> Tiempos de respuesta promedio
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DuracionCard color="#0070C0" titulo="Remisión convenio → Radicado remisión interventoría" dias={kpis.promInterv} />
              <DuracionCard color="#39A900" titulo="Radicado remisión interventoría → Radicado SENA" dias={kpis.promSena} />
            </div>
          </section>

          {/* ── Gráficos ───────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="Tipo de material" icon={ListChecks}>
              <DonutChart data={porTipo} unit="materiales" />
            </ChartCard>
            <ChartCard title="Estado (interventoría)" icon={ListChecks}>
              <DonutChart data={porEstado} unit="materiales" />
            </ChartCard>
            <ChartCard title="Validación SENA" icon={ShieldCheck}>
              <DonutChart data={porValidacion} unit="materiales" />
            </ChartCard>
          </section>

          {/* ── Tabla / informe ────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2 text-[#00304D] font-bold text-sm">
              <FileSpreadsheet size={16} /> Detalle de materiales
              <span className="ml-auto text-xs font-semibold text-neutral-400">{fmtInt(filtrados.length)} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-400 bg-neutral-50">
                    <th className="px-4 py-3 font-semibold">Proyecto / AF</th>
                    <th className="px-4 py-3 font-semibold">Material</th>
                    <th className="px-4 py-3 font-semibold text-center">Días a interv.</th>
                    <th className="px-4 py-3 font-semibold text-center">Días a SENA</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Validación SENA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-neutral-400 text-sm">
                        No hay materiales que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filtrados.map((m) => {
                      const dInter = diasPlazo(m.fecharemisionconvenio, m.fecharadremisioninterventoria)
                      const dSena = diasPlazo(m.fecharadremisioninterventoria, m.fecharadsena)
                      return (
                        <tr key={m.materialid} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="px-4 py-3 max-w-[260px]">
                            <p className="font-semibold text-[#00304D] truncate" title={m.proyecto}>{m.proyecto}</p>
                            <p className="text-[11px] text-neutral-400 truncate" title={m.accionformacion}>
                              {m.numaf ? `AF ${m.numaf} · ` : ''}{m.accionformacion}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#00304D]/5 text-[#00304D] border border-[#00304D]/10">
                              {m.materialformacion || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums text-neutral-700">{fmtDias(dInter)}</td>
                          <td className="px-4 py-3 text-center tabular-nums font-semibold text-[#00304D]">{fmtDias(dSena)}</td>
                          <td className="px-4 py-3">
                            <EstadoBadge valor={m.estado} />
                          </td>
                          <td className="px-4 py-3">
                            <ValidacionBadge valor={m.estadosena} />
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
function agrupar(items: Material[], keyFn: (m: Material) => string) {
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

function EstadoBadge({ valor }: { valor: string }) {
  const v = norm(valor)
  const cls =
    v === 'APROBADO'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : v === 'NO APROBADO'
        ? 'bg-red-50 text-red-700 border-red-200'
        : v === 'SIN RESPUESTA'
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-neutral-100 text-neutral-500 border-neutral-200'
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{valor?.trim() || '—'}</span>
}

function ValidacionBadge({ valor }: { valor: string }) {
  const v = norm(valor)
  const cls =
    v === 'CUMPLE'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : v === 'NO CUMPLE'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-neutral-100 text-neutral-500 border-neutral-200'
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{valor?.trim() || '—'}</span>
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
