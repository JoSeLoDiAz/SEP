'use client'

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Reporte GENERAL consolidado de una convocatoria — se arma con los datos    ║
// ║ agregados de los proyectos guardados (analítica + listados). Branded SENA, ║
// ║ listo para imprimir / exportar a PDF (tamaño carta).                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import type { LucideIcon } from 'lucide-react'
import {
  Activity, ArrowLeft, BadgeCheck, Building2, FileText, GraduationCap,
  Layers, ListChecks, MapPin, Printer, TrendingUp, Users2, Wallet,
} from 'lucide-react'

const NAVY = '#00304D'

export interface ConvGrupo { clave: string; afs: number; proyectos: number; beneficiarios: number; cofinSena: number; valorTotal: number }
export interface ConvCob { clave: string; beneficiarios: number; afs: number }
export interface ConvTotales {
  proyectos: number; afs: number; unidades: number; grupos: number; beneficiarios: number; valorTotal: number; cofinSena: number
  especie: number; dinero: number; gastosOperacion: number; transferencia: number
}
export interface ConvPresupuesto {
  valorAFs: number; gastosOperacion: number; valorTransferencia: number; beneficiariosTransferencia: number
  cofinanciacionSena: number; contrapartidaEspecie: number; contrapartidaDinero: number; valorTotal: number; beneficiarios: number
  pctGO: number; topeGO: number; pctTransfValor: number; pctTransfBenef: number
}
export interface ConvProyecto { nit: string; razonSocial: string; nombreProyecto: string; numAF: number; numBenef: number; valorTotal: number; cofinSena: number }
export interface ConvAccion { proponente: string; proyecto: string; consecutivo: number; nombre: string; evento: string; modalidad: string; grupos: number; beneficiarios: number; uts: number; valorTotal: number; cofinSena: number }

const fmtCop = (v: number) => (v ?? 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const fmtNum = (v: number) => (v ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })
const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(2)}%` : '0.00%')
const pctv = (v: number) => `${(v ?? 0).toFixed(2)}%`

const thCls = 'border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-600'
const tdCls = 'border-b border-neutral-100 px-3 py-2 align-top text-neutral-800'

export function ReporteConvocatoria({
  convocatoria, totales: t, presupuesto: p, porEvento, porModalidad, porProponente,
  porDepartamento, porCiudad, proyectos, acciones, onVolver,
}: {
  convocatoria: string
  totales: ConvTotales
  presupuesto: ConvPresupuesto
  porEvento: ConvGrupo[]
  porModalidad: ConvGrupo[]
  porProponente: ConvGrupo[]
  porDepartamento: ConvCob[]
  porCiudad: ConvCob[]
  proyectos: ConvProyecto[]
  acciones: ConvAccion[]
  onVolver: () => void
}) {
  return (
    <div className="reporte-conv min-h-screen bg-neutral-50">
      <PrintStyles />

      {/* Barra de acciones (no se imprime) */}
      <div className="no-print sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <button onClick={onVolver} className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50">
            <ArrowLeft size={16} /> Volver
          </button>
          <p className="hidden truncate text-sm font-semibold text-neutral-500 sm:block">Reporte general de la convocatoria</p>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-600">
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="reporte-doc mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        {/* Portada */}
        <div className="avoid-break overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="px-6 py-8 text-center text-white" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0a4e78 100%)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/sena-logo.svg" alt="SENA" className="mx-auto h-14 w-14" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-white/85">Servicio Nacional de Aprendizaje — SENA</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/60">Dirección del Sistema Nacional de Formación para el Trabajo</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/60">Grupo de Gestión para la Productividad y la Competitividad</p>
            <p className="mt-1.5 text-[12px] font-semibold uppercase tracking-wide text-white/80">Programa de Formación Continua Especializada</p>
            <h1 className="mx-auto mt-5 max-w-3xl text-2xl font-extrabold leading-tight sm:text-[26px]">Reporte general de la convocatoria</h1>
            <p className="mt-1 text-sm font-medium text-white/80">{convocatoria || 'Convocatoria'}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <span className="rounded-md bg-white/15 px-3 py-1 text-xs font-semibold">{fmtNum(t.proyectos)} proyectos</span>
              <span className="rounded-md bg-white/15 px-3 py-1 text-xs font-semibold">{fmtNum(t.afs)} acciones de formación</span>
              <span className="rounded-md bg-white/15 px-3 py-1 text-xs font-semibold">{fmtNum(t.unidades)} unidades temáticas</span>
              <span className="rounded-md bg-white/15 px-3 py-1 text-xs font-semibold">{fmtNum(p.beneficiarios)} beneficiarios</span>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
            <Kpi icon={Building2} label="Proyectos" value={fmtNum(t.proyectos)} sub={`${fmtNum(t.afs)} AF · ${fmtNum(t.unidades)} UT`} />
            <Kpi icon={Users2} label="Beneficiarios" value={fmtNum(p.beneficiarios)} sub={`${fmtNum(p.beneficiariosTransferencia)} de transferencia`} />
            <Kpi icon={Wallet} label="Valor total" value={fmtCop(p.valorTotal)} money />
            <Kpi icon={BadgeCheck} label="Cofinanciación SENA" value={fmtCop(p.cofinanciacionSena)} sub={pct(p.cofinanciacionSena, p.valorTotal)} money />
          </div>
        </div>

        {/* Presupuesto consolidado */}
        <Section icon={Wallet} title="Presupuesto consolidado de la convocatoria" subtitle="Valores del presupuesto declarado de los proyectos" tone="green">
          <div className="overflow-hidden rounded-xl text-white" style={{ backgroundColor: NAVY }}>
            <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-3">
              <TotalCell label="Valor total del programa" value={fmtCop(p.valorTotal)} big />
              <TotalCell label="Cofinanciación SENA" value={fmtCop(p.cofinanciacionSena)} sub={pct(p.cofinanciacionSena, p.valorTotal)} />
              <TotalCell label="Contrapartida (especie + dinero)" value={fmtCop(p.contrapartidaEspecie + p.contrapartidaDinero)} sub={pct(p.contrapartidaEspecie + p.contrapartidaDinero, p.valorTotal)} />
              <TotalCell label="Contrapartida especie" value={fmtCop(p.contrapartidaEspecie)} sub={pct(p.contrapartidaEspecie, p.valorTotal)} />
              <TotalCell label="Contrapartida dinero" value={fmtCop(p.contrapartidaDinero)} sub={pct(p.contrapartidaDinero, p.valorTotal)} />
              <TotalCell label="Valor de las acciones de formación" value={fmtCop(p.valorAFs)} />
              <TotalCell label="Beneficiarios de las AF" value={fmtNum(p.beneficiarios)} />
              <TotalCell label="Acciones de formación" value={fmtNum(t.afs)} />
              <TotalCell label="Unidades temáticas" value={fmtNum(t.unidades)} />
            </div>
          </div>

          {/* Bolsas de cofinanciación y topes */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BolsaCard icon={FileText} titulo="Gastos de operación" valor={fmtCop(p.gastosOperacion)} alerta={p.pctGO > p.topeGO}
              rows={[
                ['% sobre las AF', pctv(p.pctGO)],
                ['Tope permitido', `${p.topeGO}%`],
                ['Estado', p.pctGO > p.topeGO ? '⚠ Supera el tope' : '✓ Dentro del tope'],
              ]} />
            <BolsaCard icon={BadgeCheck} titulo="Transferencia de conocimiento" valor={fmtCop(p.valorTransferencia)}
              rows={[
                ['Beneficiarios de transferencia', fmtNum(p.beneficiariosTransferencia)],
                ['% de beneficiarios (mín. 5%)', pctv(p.pctTransfBenef)],
                ['% del total AF + G.O. (mín. 1%)', pctv(p.pctTransfValor)],
              ]} />
          </div>
        </Section>

        {/* Cofinanciación por evento */}
        <Section icon={Activity} title="Cofinanciación por tipo de evento">
          <GrupoTabla col="Evento" rows={porEvento} valorTotal={t.valorTotal} />
        </Section>

        {/* Cofinanciación por modalidad */}
        <Section icon={Layers} title="Cofinanciación por modalidad de formación">
          <GrupoTabla col="Modalidad" rows={porModalidad} valorTotal={t.valorTotal} />
        </Section>

        {/* Ranking por proponente */}
        <Section icon={TrendingUp} title="Cofinanciación solicitada por proponente" subtitle="Ordenado de mayor a menor cofinanciación SENA">
          <GrupoTabla col="Proponente" rows={porProponente} valorTotal={t.valorTotal} proponente />
        </Section>

        {/* Cobertura territorial */}
        <Section icon={MapPin} title="Cobertura territorial" subtitle="Beneficiarios por lugar de ejecución de las acciones de formación">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CobTabla titulo="Por departamento" col="Departamento" rows={porDepartamento} />
            <CobTabla titulo="Por ciudad / municipio" col="Ciudad / municipio" rows={porCiudad} />
          </div>
        </Section>

        {/* Proyectos */}
        <Section icon={ListChecks} title={`Proyectos de la convocatoria (${proyectos.length})`}>
          <TableWrap minW={760}>
            <thead>
              <tr>
                <th className={thCls}>NIT</th>
                <th className={thCls}>Proponente</th>
                <th className={thCls}>Proyecto</th>
                <th className={`${thCls} text-right`}>AF</th>
                <th className={`${thCls} text-right`}>Benef.</th>
                <th className={`${thCls} text-right`}>Valor total</th>
                <th className={`${thCls} text-right`}>Cofin. SENA</th>
                <th className={`${thCls} text-right`}>% Cofin.</th>
              </tr>
            </thead>
            <tbody>
              {proyectos.length === 0
                ? <tr><td className={`${tdCls} text-center italic text-neutral-400`} colSpan={8}>Sin proyectos.</td></tr>
                : proyectos.map((p, i) => (
                    <tr key={i}>
                      <td className={`${tdCls} font-mono`}>{p.nit || '—'}</td>
                      <td className={`${tdCls} font-medium text-neutral-900`}>{p.razonSocial || '—'}</td>
                      <td className={tdCls}>{p.nombreProyecto || '—'}</td>
                      <td className={`${tdCls} text-right`}>{fmtNum(p.numAF)}</td>
                      <td className={`${tdCls} text-right`}>{fmtNum(p.numBenef)}</td>
                      <td className={`${tdCls} text-right font-semibold`}>{fmtCop(p.valorTotal)}</td>
                      <td className={`${tdCls} text-right`}>{fmtCop(p.cofinSena)}</td>
                      <td className={`${tdCls} text-right text-neutral-400`}>{pct(p.cofinSena, p.valorTotal)}</td>
                    </tr>
                  ))}
              {proyectos.length > 0 && (
                <tr className="bg-neutral-50 font-bold">
                  <td className={`${tdCls} border-neutral-200`} colSpan={3}>Total</td>
                  <td className={`${tdCls} border-neutral-200 text-right`}>{fmtNum(t.afs)}</td>
                  <td className={`${tdCls} border-neutral-200 text-right`}>{fmtNum(t.beneficiarios)}</td>
                  <td className={`${tdCls} border-neutral-200 text-right`}>{fmtCop(t.valorTotal)}</td>
                  <td className={`${tdCls} border-neutral-200 text-right`}>{fmtCop(t.cofinSena)}</td>
                  <td className={`${tdCls} border-neutral-200 text-right text-neutral-500`}>{pct(t.cofinSena, t.valorTotal)}</td>
                </tr>
              )}
            </tbody>
          </TableWrap>
        </Section>

        {/* Acciones de formación */}
        <Section icon={GraduationCap} title={`Acciones de formación (${acciones.length})`}>
          <TableWrap minW={900}>
            <thead>
              <tr>
                <th className={`${thCls} w-10`}>AF</th>
                <th className={thCls}>Acción de formación</th>
                <th className={thCls}>Proponente</th>
                <th className={thCls}>Evento</th>
                <th className={thCls}>Modalidad</th>
                <th className={`${thCls} text-right`}>Grupos</th>
                <th className={`${thCls} text-right`}>Benef.</th>
                <th className={`${thCls} text-right`}>UT</th>
                <th className={`${thCls} text-right`}>Valor total</th>
                <th className={`${thCls} text-right`}>Cofin. SENA</th>
              </tr>
            </thead>
            <tbody>
              {acciones.length === 0
                ? <tr><td className={`${tdCls} text-center italic text-neutral-400`} colSpan={10}>Sin acciones de formación.</td></tr>
                : acciones.map((a, i) => (
                    <tr key={i}>
                      <td className={`${tdCls} text-center font-bold`}>{a.consecutivo}</td>
                      <td className={`${tdCls} font-medium text-neutral-900`}>{a.nombre || '—'}</td>
                      <td className={tdCls}>{a.proponente || '—'}</td>
                      <td className={tdCls}>{a.evento || '—'}</td>
                      <td className={tdCls}>{a.modalidad || '—'}</td>
                      <td className={`${tdCls} text-right`}>{fmtNum(a.grupos)}</td>
                      <td className={`${tdCls} text-right`}>{fmtNum(a.beneficiarios)}</td>
                      <td className={`${tdCls} text-right`}>{fmtNum(a.uts)}</td>
                      <td className={`${tdCls} text-right font-semibold`}>{fmtCop(a.valorTotal)}</td>
                      <td className={`${tdCls} text-right`}>{fmtCop(a.cofinSena)}</td>
                    </tr>
                  ))}
            </tbody>
          </TableWrap>
        </Section>

        <p className="no-print pt-2 text-center text-xs text-neutral-400">
          Reporte general consolidado · SEP — SENA.
        </p>
      </div>
    </div>
  )
}

function GrupoTabla({ col, rows, valorTotal, proponente }: { col: string; rows: ConvGrupo[]; valorTotal: number; proponente?: boolean }) {
  return (
    <TableWrap minW={proponente ? 760 : 640}>
      <thead>
        <tr>
          <th className={thCls}>{col}</th>
          {proponente && <th className={`${thCls} text-right`}>Proy.</th>}
          <th className={`${thCls} text-right`}>AF</th>
          <th className={`${thCls} text-right`}>Beneficiarios</th>
          <th className={`${thCls} text-right`}>Cofin. SENA</th>
          <th className={`${thCls} text-right`}>% del total</th>
          <th className={`${thCls} text-right`}>Valor total</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0
          ? <tr><td className={`${tdCls} text-center italic text-neutral-400`} colSpan={proponente ? 7 : 6}>Sin datos.</td></tr>
          : rows.map((g, i) => (
              <tr key={i}>
                <td className={`${tdCls} font-medium text-neutral-900`}>{g.clave}</td>
                {proponente && <td className={`${tdCls} text-right`}>{fmtNum(g.proyectos)}</td>}
                <td className={`${tdCls} text-right`}>{fmtNum(g.afs)}</td>
                <td className={`${tdCls} text-right`}>{fmtNum(g.beneficiarios)}</td>
                <td className={`${tdCls} text-right font-semibold text-neutral-900`}>{fmtCop(g.cofinSena)}</td>
                <td className={`${tdCls} text-right text-neutral-400`}>{pct(g.cofinSena, valorTotal)}</td>
                <td className={`${tdCls} text-right`}>{fmtCop(g.valorTotal)}</td>
              </tr>
            ))}
      </tbody>
    </TableWrap>
  )
}

function BolsaCard({ icon: Icon, titulo, valor, rows, alerta }: {
  icon: LucideIcon; titulo: string; valor: string; rows: [string, string][]; alerta?: boolean
}) {
  return (
    <div className={`avoid-break rounded-xl border p-4 ${alerta ? 'border-red-200 bg-red-50/40' : 'border-neutral-200 bg-white'}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${alerta ? 'bg-red-100 text-red-600' : 'bg-green-50 text-green-600'}`}><Icon size={16} /></span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-neutral-900">{titulo}</p>
          <p className="text-[13px] font-extrabold" style={{ color: NAVY }}>{valor}</p>
        </div>
      </div>
      <dl className="space-y-1.5">
        {rows.map(([k, v], i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 border-b border-dashed border-neutral-100 pb-1.5 last:border-0">
            <dt className="text-xs text-neutral-500">{k}</dt>
            <dd className="text-sm font-bold text-neutral-900">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function CobTabla({ titulo, col, rows }: { titulo: string; col: string; rows: ConvCob[] }) {
  const totalBenef = rows.reduce((a, r) => a + (r.beneficiarios ?? 0), 0)
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200">
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2">
        <p className="text-[13px] font-bold" style={{ color: NAVY }}>{titulo}</p>
      </div>
      <TableWrap minW={360}>
        <thead>
          <tr>
            <th className={thCls}>{col}</th>
            <th className={`${thCls} text-right`}>AF</th>
            <th className={`${thCls} text-right`}>Beneficiarios</th>
            <th className={`${thCls} text-right`}>%</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td className={`${tdCls} text-center italic text-neutral-400`} colSpan={4}>Sin cobertura registrada.</td></tr>
            : rows.map((r, i) => (
                <tr key={i}>
                  <td className={`${tdCls} font-medium text-neutral-900`}>{r.clave}</td>
                  <td className={`${tdCls} text-right`}>{fmtNum(r.afs)}</td>
                  <td className={`${tdCls} text-right font-semibold`}>{fmtNum(r.beneficiarios)}</td>
                  <td className={`${tdCls} text-right text-neutral-400`}>{pct(r.beneficiarios, totalBenef)}</td>
                </tr>
              ))}
        </tbody>
      </TableWrap>
    </div>
  )
}

function Section({ icon: Icon, title, subtitle, children, tone = 'navy' }: {
  icon: LucideIcon; title: string; subtitle?: string; children: React.ReactNode; tone?: 'navy' | 'green'
}) {
  const bg = tone === 'green' ? '#0f7a3d' : NAVY
  return (
    <section className="scroll-mt-24 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="section-bar flex items-center gap-3 px-5 py-3.5 text-white" style={{ backgroundColor: bg }}>
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-white/15"><Icon size={18} strokeWidth={2.2} /></span>
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-bold leading-tight tracking-tight">{title}</h2>
          {subtitle && <p className="truncate text-xs font-medium text-white/70">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function TableWrap({ children, minW = 560 }: { children: React.ReactNode; minW?: number }) {
  return <div className="table-wrap -mx-1 overflow-x-auto rounded-xl border border-neutral-200"><table className="w-full border-collapse text-[13px]" style={{ minWidth: minW }}>{children}</table></div>
}

function Kpi({ icon: Icon, label, value, sub, money }: { icon: LucideIcon; label: string; value: string; sub?: string; money?: boolean }) {
  return (
    <div className="avoid-break flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-green-50 text-green-600"><Icon size={18} /></span>
      <div className="min-w-0">
        <p className={`font-extrabold leading-tight text-neutral-900 ${money ? 'break-words text-[13px]' : 'truncate text-[15px]'}`}>{value}</p>
        <p className="truncate text-[11px] font-medium text-neutral-500">{label}</p>
        {sub && <p className="truncate text-[11px] font-semibold text-green-600">{sub}</p>}
      </div>
    </div>
  )
}

function TotalCell({ label, value, sub, big }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div className="bg-transparent px-4 py-3.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-white/60">{label}</p>
      <p className={`font-extrabold ${big ? 'text-lg' : 'text-base'}`}>{value}</p>
      {sub && <p className="text-[11px] font-semibold text-white/70">{sub}</p>}
    </div>
  )
}

// ── Estilos de impresión (carta, sin recortes) ──────────────────────────────
function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page { size: letter; margin: 9mm; }
        aside, header, nav, .no-print { display: none !important; }
        html, body { height: auto !important; overflow: visible !important; }
        .h-screen.overflow-hidden { height: auto !important; overflow: visible !important; }
        .flex.flex-col.flex-1.min-w-0.overflow-hidden { height: auto !important; overflow: visible !important; }
        main.overflow-y-auto, main.flex-1 { height: auto !important; max-height: none !important; overflow: visible !important; flex: none !important; }
        .reporte-conv, .reporte-conv * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .reporte-conv { background: #fff !important; min-height: 0 !important; }
        .reporte-doc { max-width: 100% !important; padding: 0 !important; gap: 10px !important; }
        html[data-dark-mode="true"] .reporte-conv, html[data-dark-mode="true"] .reporte-conv .bg-white { background: #fff !important; }
        html[data-dark-mode="true"] .reporte-conv .bg-neutral-50 { background: #fafafa !important; }
        html[data-dark-mode="true"] .reporte-conv .text-neutral-900 { color: #171717 !important; }
        html[data-dark-mode="true"] .reporte-conv .text-neutral-800 { color: #262626 !important; }
        html[data-dark-mode="true"] .reporte-conv .text-neutral-700 { color: #404040 !important; }
        html[data-dark-mode="true"] .reporte-conv .text-neutral-600 { color: #525252 !important; }
        html[data-dark-mode="true"] .reporte-conv .text-neutral-500 { color: #737373 !important; }
        .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        .section-bar { break-after: avoid; page-break-after: avoid; }
        thead { display: table-header-group; }
        tr, td, th { break-inside: auto !important; page-break-inside: auto !important; }
        .table-wrap { overflow: visible !important; border: 0 !important; }
        .table-wrap table { min-width: 0 !important; width: 100% !important; table-layout: fixed !important; font-size: 7pt !important; }
        .table-wrap th, .table-wrap td { overflow-wrap: anywhere !important; word-break: break-word !important; white-space: normal !important; padding: 1.5px 4px !important; vertical-align: top; }
        .table-wrap tbody .text-right { white-space: nowrap !important; word-break: keep-all !important; overflow-wrap: normal !important; }
        section { box-shadow: none !important; }
      }
    `}</style>
  )
}
