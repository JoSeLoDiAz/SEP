'use client'

import api from '@/lib/api'
import {
  Loader2,
  ShieldAlert,
  Handshake,
  MapPin,
  Users,
  Wallet,
  Coins,
  HandCoins,
  Filter,
  RotateCcw,
  Building2,
  Layers,
  FileSpreadsheet,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

// El backend (Oracle) devuelve los alias en minúsculas y uno con espacio/acento.
interface Convenio {
  proyectoid: number
  proyecto: string
  convocatoriaid: number
  convocatoria: string
  empresa: string
  sigla: string
  modalidad: string
  nit: string
  codigosecop: string
  departamento: string
  profesionalseguimiento: string
  beneficiarios: number
  valorproyecto: number
  cofinanciacion: number
  contrapartidaespecie: number
  contrapartidadinero: number
  valorcontrapartidad: number
  representantelegal: string
  tipodocumento: string
  numdocumento: string
  'ESTADO SUSCRIPCIÓN': string
  fechasuscripcionsecop: string
  numpolizacumplimiento: string
}

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

const PALETTE = ['#00304D', '#39A900', '#0070C0', '#C47900', '#7C3AED', '#0F766E', '#C4003D', '#0891B2']

// ── Helpers de formato ──────────────────────────────────────────────────────────
const nfInt = new Intl.NumberFormat('es-CO')
const nfCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

function fmtInt(n: number) {
  return nfInt.format(Math.round(n || 0))
}
function fmtCOP(n: number) {
  return nfCOP.format(n || 0)
}
function fmtCompact(n: number) {
  const v = n || 0
  const abs = Math.abs(v)
  if (abs >= 1e12) return `$ ${(v / 1e12).toLocaleString('es-CO', { maximumFractionDigits: 1 })} B`
  if (abs >= 1e9) return `$ ${(v / 1e9).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MM`
  if (abs >= 1e6) return `$ ${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`
  if (abs >= 1e3) return `$ ${(v / 1e3).toLocaleString('es-CO', { maximumFractionDigits: 0 })} K`
  return fmtCOP(v)
}
function num(v: unknown) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export default function ConveniosPage() {
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [convenios, setConvenios] = useState<Convenio[]>([])

  // Filtros
  const [fConvocatoria, setFConvocatoria] = useState('')
  const [fProyecto, setFProyecto] = useState('')
  const [fDepartamento, setFDepartamento] = useState('')
  const [fModalidad, setFModalidad] = useState('')
  const [fEstado, setFEstado] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    setErrMsg('')
    try {
      const res = await api.get<Convenio[]>('/dashboards/convenios')
      setConvenios(res.data ?? [])
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      if (status === 403) setErrMsg('No tienes permisos para acceder al reporte de convenios.')
      else setErrMsg(msg ?? 'Error cargando el reporte de Convenios.')
    } finally {
      setLoading(false)
    }
  }

  function limpiarFiltros() {
    setFConvocatoria('')
    setFProyecto('')
    setFDepartamento('')
    setFModalidad('')
    setFEstado('')
  }

  // ── Opciones de filtro (dependientes de la convocatoria) ───────────────────────
  const convocatorias = useMemo(
    () =>
      Array.from(new Map(convenios.map((c) => [c.convocatoriaid, c])).values())
        .sort((a, b) => (a.convocatoria || '').localeCompare(b.convocatoria || '')),
    [convenios],
  )

  const baseConvocatoria = useMemo(
    () => convenios.filter((c) => (fConvocatoria ? c.convocatoriaid === Number(fConvocatoria) : true)),
    [convenios, fConvocatoria],
  )

  const proyectos = useMemo(
    () =>
      Array.from(new Map(baseConvocatoria.map((c) => [c.proyectoid, c])).values())
        .sort((a, b) => (a.proyecto || '').localeCompare(b.proyecto || '')),
    [baseConvocatoria],
  )

  const departamentos = useMemo(
    () => Array.from(new Set(baseConvocatoria.map((c) => c.departamento).filter(Boolean))).sort(),
    [baseConvocatoria],
  )
  const modalidades = useMemo(
    () => Array.from(new Set(convenios.map((c) => c.modalidad).filter(Boolean))).sort(),
    [convenios],
  )
  const estados = useMemo(
    () => Array.from(new Set(convenios.map((c) => c['ESTADO SUSCRIPCIÓN']).filter(Boolean))).sort(),
    [convenios],
  )

  // ── Aplicar filtros + deduplicar por proyecto ─────────────────────────────────
  const filtrados = useMemo(
    () =>
      convenios.filter(
        (c) =>
          (fConvocatoria ? c.convocatoriaid === Number(fConvocatoria) : true) &&
          (fProyecto ? c.proyectoid === Number(fProyecto) : true) &&
          (fDepartamento ? c.departamento === fDepartamento : true) &&
          (fModalidad ? c.modalidad === fModalidad : true) &&
          (fEstado ? c['ESTADO SUSCRIPCIÓN'] === fEstado : true),
      ),
    [convenios, fConvocatoria, fProyecto, fDepartamento, fModalidad, fEstado],
  )

  // Cada proyecto puede venir en varias filas (join de desembolsos) → deduplicar.
  const unicos = useMemo(
    () => Array.from(new Map(filtrados.map((c) => [c.proyectoid, c])).values()),
    [filtrados],
  )

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalConvenios = unicos.length
    const departamentosImpactados = new Set(unicos.map((c) => c.departamento).filter(Boolean)).size
    const beneficiarios = unicos.reduce((s, c) => s + num(c.beneficiarios), 0)
    const valorProyecto = unicos.reduce((s, c) => s + num(c.valorproyecto), 0)
    const cofinanciacion = unicos.reduce((s, c) => s + num(c.cofinanciacion), 0)
    const contrapartidas = unicos.reduce((s, c) => s + num(c.valorcontrapartidad), 0)
    return { totalConvenios, departamentosImpactados, beneficiarios, valorProyecto, cofinanciacion, contrapartidas }
  }, [unicos])

  // ── Agrupaciones para gráficos ────────────────────────────────────────────────
  const porModalidad = useMemo(() => agrupar(unicos, (c) => c.modalidad || 'Sin modalidad'), [unicos])
  const porEstado = useMemo(() => agrupar(unicos, (c) => c['ESTADO SUSCRIPCIÓN'] || 'SIN ESTADO'), [unicos])
  const topDeptos = useMemo(
    () => agrupar(unicos, (c) => c.departamento || 'Sin departamento').slice(0, 8),
    [unicos],
  )

  const hayFiltros = fConvocatoria || fProyecto || fDepartamento || fModalidad || fEstado

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
            <Handshake size={28} className="text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: INSTITUTIONAL }}>
              Tablero de Seguimiento
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">Convenios</h1>
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
          {/* ── Barra de filtros ───────────────────────────────────────────────── */}
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
                  setFDepartamento('')
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
                label="Departamento"
                value={fDepartamento}
                onChange={setFDepartamento}
                options={departamentos.map((d) => ({ value: d, label: d }))}
              />
              <SelectFiltro
                label="Modalidad"
                value={fModalidad}
                onChange={setFModalidad}
                options={modalidades.map((m) => ({ value: m, label: m }))}
              />
              <SelectFiltro
                label="Estado suscripción"
                value={fEstado}
                onChange={setFEstado}
                options={estados.map((e) => ({ value: e, label: e }))}
              />
            </div>
          </section>

          {/* ── KPIs ───────────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard icon={Handshake} color="#00304D" label="Convenios" value={fmtInt(kpis.totalConvenios)} hint="Sin duplicados" />
            <KpiCard icon={MapPin} color="#C4003D" label="Departamentos" value={fmtInt(kpis.departamentosImpactados)} hint="Impactados" />
            <KpiCard icon={Users} color="#0070C0" label="Beneficiarios" value={fmtInt(kpis.beneficiarios)} hint="Total" />
            <KpiCard icon={Wallet} color="#39A900" label="Valor proyectos" value={fmtCompact(kpis.valorProyecto)} hint={fmtCOP(kpis.valorProyecto)} />
            <KpiCard icon={Coins} color="#C47900" label="Cofinanciación" value={fmtCompact(kpis.cofinanciacion)} hint={fmtCOP(kpis.cofinanciacion)} />
            <KpiCard icon={HandCoins} color="#0F766E" label="Contrapartidas" value={fmtCompact(kpis.contrapartidas)} hint={fmtCOP(kpis.contrapartidas)} />
          </section>

          {/* ── Gráficos ───────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="Modalidad" icon={Layers} className="lg:col-span-1">
              <DonutChart data={porModalidad} unit="convenios" />
            </ChartCard>

            <ChartCard title="Estado de la suscripción" icon={Building2} className="lg:col-span-2">
              <BarList data={porEstado} unit="convenios" />
            </ChartCard>
          </section>

          <section className="grid grid-cols-1 gap-4">
            <ChartCard title="Top departamentos por convenios" icon={MapPin}>
              <BarList data={topDeptos} unit="convenios" />
            </ChartCard>
          </section>

          {/* ── Tabla / informe ────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2 text-[#00304D] font-bold text-sm">
              <FileSpreadsheet size={16} /> Detalle de convenios
              <span className="ml-auto text-xs font-semibold text-neutral-400">{fmtInt(unicos.length)} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-400 bg-neutral-50">
                    <th className="px-4 py-3 font-semibold">Proyecto</th>
                    <th className="px-4 py-3 font-semibold">Empresa</th>
                    <th className="px-4 py-3 font-semibold">Modalidad</th>
                    <th className="px-4 py-3 font-semibold">Departamento</th>
                    <th className="px-4 py-3 font-semibold text-right">Benef.</th>
                    <th className="px-4 py-3 font-semibold text-right">Valor proyecto</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {unicos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-neutral-400 text-sm">
                        No hay convenios que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    unicos.map((c) => (
                      <tr key={c.proyectoid} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="px-4 py-3 max-w-[240px]">
                          <p className="font-semibold text-[#00304D] truncate" title={c.proyecto}>{c.proyecto}</p>
                          <p className="text-[11px] text-neutral-400">{c.convocatoria}</p>
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="truncate text-neutral-700" title={c.empresa}>{c.empresa || '—'}</p>
                          {c.sigla && <p className="text-[11px] text-neutral-400">{c.sigla}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#00304D]/5 text-[#00304D] border border-[#00304D]/10">
                            {c.modalidad || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-700">{c.departamento || '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{fmtInt(num(c.beneficiarios))}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-neutral-700" title={fmtCOP(num(c.valorproyecto))}>
                          {fmtCompact(num(c.valorproyecto))}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] text-neutral-600">{c['ESTADO SUSCRIPCIÓN'] || '—'}</span>
                        </td>
                      </tr>
                    ))
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
function agrupar(items: Convenio[], keyFn: (c: Convenio) => string) {
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
      <div className="flex items-center justify-between">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}14` }}>
          <Icon size={20} style={{ color }} />
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold text-neutral-900 leading-none tabular-nums" title={hint}>{value}</p>
        <p className="text-xs font-semibold text-neutral-500 mt-1">{label}</p>
        {hint && <p className="text-[10px] text-neutral-400 truncate">{hint}</p>}
      </div>
    </div>
  )
}

function ChartCard({
  title,
  icon: Icon,
  children,
  className = '',
}: {
  title: string
  icon: LucideIcon
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 flex flex-col ${className}`}>
      <div className="flex items-center gap-2 text-[#00304D] font-bold text-sm mb-4">
        <Icon size={16} /> {title}
      </div>
      {children}
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

  // Construir el conic-gradient acumulando porcentajes.
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
      <div
        className="relative w-36 h-36 rounded-full shrink-0"
        style={{ background: `conic-gradient(${stops})` }}
      >
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
