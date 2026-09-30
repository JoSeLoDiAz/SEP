'use client'

import api from '@/lib/api'
import {
  Loader2,
  ShieldAlert,
  Users,
  BadgeCheck,
  CircleSlash,
  UserPlus,
  History,
  UserCheck,
  VenetianMask,
  Filter,
  RotateCcw,
  FileSpreadsheet,
  MapPin,
  ListChecks,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

// El backend (Oracle) devuelve los alias tal cual (minúsculas).
interface Beneficiario {
  proyectoid: number
  proyecto: string
  convocatoriaid: number
  convocatoria: string
  empresa: string
  numconvenio: string
  modalidadparticipacion: string
  afid: number
  af: string
  modalidadformacion: string
  evento: string
  grupo: number
  tipoidbeneficiario: string
  numidentificacion: string
  nombres: string
  primerapellido: string
  segundoapellido: string
  genero: string
  edad: number
  rangoedad: string
  departamentodomicilio: string
  municipiodomicilio: string
  caracterizacion: string
  transferencia: string
  beneficiadoanteriormente: string // SI | NO
  porcentaje: number
  certifica: string // SI | NO
  estado: string
  estadointerventoria: string // VERIFICADO | SIN VERIFICAR
  estransferencia: string | number // "0" = no transferencia
}

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'
const PALETTE = ['#00304D', '#39A900', '#0070C0', '#C47900', '#7C3AED', '#0F766E', '#C4003D', '#0891B2']

const nfInt = new Intl.NumberFormat('es-CO')
const fmtInt = (n: number) => nfInt.format(Math.round(n || 0))
const norm = (s: string | null | undefined) => (s ?? '').trim().toUpperCase()
const esNoTransferencia = (b: Beneficiario) => String(b.estransferencia ?? '').trim() === '0'

function nombreCompleto(b: Beneficiario) {
  return [b.nombres, b.primerapellido, b.segundoapellido].map((s) => (s ?? '').trim()).filter(Boolean).join(' ') || '—'
}

export default function BeneficiariosPage() {
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([])

  const [fConvocatoria, setFConvocatoria] = useState('')
  const [fProyecto, setFProyecto] = useState('')
  const [fGenero, setFGenero] = useState('')
  const [fCertifica, setFCertifica] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    setErrMsg('')
    try {
      // TEMPORAL (diagnóstico): timeout amplio para medir cuánto tarda realmente.
      const res = await api.get<Beneficiario[]>('/dashboards/beneficiarios', { timeout: 180_000 })
      setBeneficiarios(res.data ?? [])
    } catch (err: unknown) {
      console.error('[beneficiarios] error al cargar:', err)
      const e = err as { code?: string; message?: string; response?: { status?: number; data?: { message?: string } } }
      const status = e?.response?.status
      if (e?.code === 'ECONNABORTED') setErrMsg('La consulta tardó demasiado y se canceló (timeout). El reporte es muy voluminoso.')
      else if (status === 403) setErrMsg('No tienes permisos para acceder al reporte de beneficiarios.')
      else if (status) setErrMsg(`Error ${status} del servidor: ${e?.response?.data?.message ?? 'sin detalle'}`)
      else setErrMsg(`No se pudo conectar con el servidor: ${e?.message ?? 'error de red'}`)
    } finally {
      setLoading(false)
    }
  }

  function limpiarFiltros() {
    setFConvocatoria('')
    setFProyecto('')
    setFGenero('')
    setFCertifica('')
  }

  // Todas las medidas excluyen los beneficiarios de transferencia (estransferencia = 0).
  const base = useMemo(() => beneficiarios.filter(esNoTransferencia), [beneficiarios])

  // ── Opciones de filtro ─────────────────────────────────────────────────────────
  const convocatorias = useMemo(
    () =>
      Array.from(new Map(base.map((b) => [b.convocatoriaid, b])).values()).sort((a, b) =>
        (a.convocatoria || '').localeCompare(b.convocatoria || ''),
      ),
    [base],
  )
  const proyectos = useMemo(
    () =>
      Array.from(
        new Map(
          base
            .filter((b) => (fConvocatoria ? b.convocatoriaid === Number(fConvocatoria) : true))
            .map((b) => [b.proyectoid, b]),
        ).values(),
      ).sort((a, b) => (a.proyecto || '').localeCompare(b.proyecto || '')),
    [base, fConvocatoria],
  )
  const generos = useMemo(() => Array.from(new Set(base.map((b) => b.genero).filter(Boolean))).sort(), [base])

  // ── Aplicar filtros ─────────────────────────────────────────────────────────────
  const filtrados = useMemo(
    () =>
      base.filter(
        (b) =>
          (fConvocatoria ? b.convocatoriaid === Number(fConvocatoria) : true) &&
          (fProyecto ? b.proyectoid === Number(fProyecto) : true) &&
          (fGenero ? b.genero === fGenero : true) &&
          (fCertifica ? norm(b.certifica) === fCertifica : true),
      ),
    [base, fConvocatoria, fProyecto, fGenero, fCertifica],
  )

  // ── KPIs (réplica de las medidas DAX) ─────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = filtrados.length
    const certificados = filtrados.filter((b) => norm(b.estadointerventoria) === 'VERIFICADO' && norm(b.certifica) === 'SI').length
    const sinCertificar = filtrados.filter((b) => norm(b.estadointerventoria) === 'SIN VERIFICAR' && norm(b.certifica) === 'NO').length
    const anteriores = filtrados.filter((b) => norm(b.beneficiadoanteriormente) === 'SI').length
    const nuevos = filtrados.filter((b) => norm(b.beneficiadoanteriormente) === 'NO').length
    const hombres = filtrados.filter((b) => norm(b.genero) === 'MASCULINO').length
    const mujeres = filtrados.filter((b) => norm(b.genero) === 'FEMENINO').length
    return { total, certificados, sinCertificar, anteriores, nuevos, hombres, mujeres }
  }, [filtrados])

  // ── Agrupaciones para gráficos ────────────────────────────────────────────────
  const porGenero = useMemo(() => agrupar(filtrados, (b) => b.genero || 'Sin dato'), [filtrados])
  const porNuevo = useMemo(
    () => agrupar(filtrados, (b) => (norm(b.beneficiadoanteriormente) === 'SI' ? 'Beneficiado anteriormente' : 'Nuevo beneficiario')),
    [filtrados],
  )
  const porRangoEdad = useMemo(() => agrupar(filtrados, (b) => b.rangoedad || 'Sin dato'), [filtrados])
  const porDepto = useMemo(
    () => agrupar(filtrados, (b) => b.departamentodomicilio || 'Sin dato').slice(0, 8),
    [filtrados],
  )

  const hayFiltros = fConvocatoria || fProyecto || fGenero || fCertifica

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
            <Users size={28} className="text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: INSTITUTIONAL }}>
              Tablero de Seguimiento
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">Beneficiarios</h1>
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
                label="Género"
                value={fGenero}
                onChange={setFGenero}
                options={generos.map((g) => ({ value: g, label: g }))}
              />
              <SelectFiltro
                label="Certifica"
                value={fCertifica}
                onChange={setFCertifica}
                options={[
                  { value: 'SI', label: 'Sí' },
                  { value: 'NO', label: 'No' },
                ]}
              />
            </div>
          </section>

          {/* ── KPIs ───────────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard icon={Users} color="#00304D" label="Beneficiarios" value={fmtInt(kpis.total)} hint="Total (sin transferencia)" />
            <KpiCard icon={BadgeCheck} color="#39A900" label="Certificados" value={fmtInt(kpis.certificados)} hint="Verificado + certifica SÍ" />
            <KpiCard icon={CircleSlash} color="#C4003D" label="Sin certificar" value={fmtInt(kpis.sinCertificar)} hint="Sin verificar + certifica NO" />
            <KpiCard icon={UserPlus} color="#0070C0" label="Nuevos" value={fmtInt(kpis.nuevos)} hint="No beneficiado antes" />
            <KpiCard icon={History} color="#C47900" label="Anteriores" value={fmtInt(kpis.anteriores)} hint="Beneficiado antes" />
            <KpiCard icon={UserCheck} color="#0F766E" label="Hombres / Mujeres" value={`${fmtInt(kpis.hombres)} / ${fmtInt(kpis.mujeres)}`} hint="Masculino / Femenino" />
          </section>

          {/* ── Gráficos ───────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Género" icon={VenetianMask}>
              <DonutChart data={porGenero} unit="beneficiarios" />
            </ChartCard>
            <ChartCard title="Nuevos vs. beneficiados anteriormente" icon={UserPlus}>
              <DonutChart data={porNuevo} unit="beneficiarios" />
            </ChartCard>
            <ChartCard title="Rango de edad" icon={ListChecks}>
              <BarList data={porRangoEdad} unit="beneficiarios" />
            </ChartCard>
            <ChartCard title="Cobertura por departamento" icon={MapPin}>
              <BarList data={porDepto} unit="beneficiarios" />
            </ChartCard>
          </section>

          {/* ── Tabla / informe ────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2 text-[#00304D] font-bold text-sm">
              <FileSpreadsheet size={16} /> Detalle de beneficiarios
              <span className="ml-auto text-xs font-semibold text-neutral-400">{fmtInt(filtrados.length)} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-400 bg-neutral-50">
                    <th className="px-4 py-3 font-semibold">Beneficiario</th>
                    <th className="px-4 py-3 font-semibold">Proyecto / AF</th>
                    <th className="px-4 py-3 font-semibold text-center">Género</th>
                    <th className="px-4 py-3 font-semibold text-center">¿Anterior?</th>
                    <th className="px-4 py-3 font-semibold text-center">Certifica</th>
                    <th className="px-4 py-3 font-semibold">Estado interventoría</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-neutral-400 text-sm">
                        No hay beneficiarios que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filtrados.slice(0, 500).map((b, idx) => (
                      <tr key={`${b.proyectoid}-${b.numidentificacion}-${idx}`} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="px-4 py-3 max-w-[240px]">
                          <p className="font-semibold text-[#00304D] truncate" title={nombreCompleto(b)}>{nombreCompleto(b)}</p>
                          <p className="text-[11px] text-neutral-400">{b.tipoidbeneficiario} {b.numidentificacion}</p>
                        </td>
                        <td className="px-4 py-3 max-w-[240px]">
                          <p className="truncate text-neutral-700" title={b.proyecto}>{b.proyecto}</p>
                          <p className="text-[11px] text-neutral-400 truncate" title={b.af}>{b.af} · Grupo {b.grupo}</p>
                        </td>
                        <td className="px-4 py-3 text-center text-neutral-700">{b.genero || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <SiNoBadge valor={b.beneficiadoanteriormente} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <SiNoBadge valor={b.certifica} verde />
                        </td>
                        <td className="px-4 py-3">
                          <EstadoBadge valor={b.estadointerventoria} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {filtrados.length > 500 && (
                <p className="px-5 py-3 text-[11px] text-neutral-400 border-t border-neutral-100">
                  Mostrando los primeros 500 de {fmtInt(filtrados.length)} registros. Los KPIs y gráficos consideran el total.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

// ── Agrupador genérico ──────────────────────────────────────────────────────────
function agrupar(items: Beneficiario[], keyFn: (b: Beneficiario) => string) {
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

function SiNoBadge({ valor, verde }: { valor: string; verde?: boolean }) {
  const v = norm(valor)
  if (v === 'SI')
    return (
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${verde ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
        Sí
      </span>
    )
  if (v === 'NO')
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200">No</span>
  return <span className="text-[11px] text-neutral-400">—</span>
}

function EstadoBadge({ valor }: { valor: string }) {
  const v = norm(valor)
  const cls =
    v === 'VERIFICADO'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : v === 'SIN VERIFICAR'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-neutral-100 text-neutral-500 border-neutral-200'
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
