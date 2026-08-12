'use client'

// reporte del proyecto armado desde el excel parseado, sin importarlo a la bd

import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity, ArrowLeft, ArrowUp, BadgeCheck, BookOpen, Briefcase, Building2, CalendarDays,
  ClipboardList, Coins, Compass, FileText, FolderKanban, GraduationCap, Info,
  Layers, ListChecks, MapPin, Notebook, Package, Printer, Receipt, Search,
  Target, TrendingUp, UserCheck, UserCircle2, Users2, Wallet,
} from 'lucide-react'
import type {
  ExcelAFConDetalle, ExcelDiagnostico, ExcelRubro, PreviewImportacion,
} from '@/lib/types/importar-proyecto'

const NAVY = '#00304D'

// helpers de formato
function txt(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' || s === '—' ? null : s
}
function fmtCop(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}
function fmtNum(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })
}
function pct(v: number): string {
  return `${(Number.isFinite(v) ? v : 0).toFixed(2)}%`
}
const pctOf = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0)
const n0 = (x: number | null | undefined) => x ?? 0

// excel guarda las fechas como número de serie, no como fecha
function fmtFechaExcel(v: unknown): string | null {
  const s = txt(v)
  if (!s) return null
  const num = Number(s)
  if (Number.isFinite(num) && num > 20000 && num < 80000) {
    const d = new Date(Math.round((num - 25569) * 86400000))
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getUTCDate()).padStart(2, '0')
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      return `${dd}/${mm}/${d.getUTCFullYear()}`
    }
  }
  return s
}

const aplicaNum = (v: number | null | undefined) => (n0(v) > 0 ? fmtNum(v) : 'NO APLICA')

function scrollToId(id: string) {
  if (typeof document !== 'undefined') document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// finanzas por AF, calculadas desde los rubros del excel
const codeOf = (r: ExcelRubro) => (r.idRubro ?? '').trim()
const nameOf = (r: ExcelRubro) => (r.nombreRubro ?? '').trim()
const esGO = (r: ExcelRubro) => /^R0?9(\D|$)/i.test(codeOf(r)) || /GASTOS\s+DE\s+OPERACI/i.test(nameOf(r))
const esTransferencia = (r: ExcelRubro) =>
  /^R0?15(\D|$)/i.test(codeOf(r)) || /TRANSFERENCIA\s+DE\s+CONOCIMIENTO/i.test(nameOf(r))

// puesto de trabajo real: el valor hora × beneficiario usa 8 horas fijas, no las del grupo
const esPuestoTrabajo = (evento: string | null | undefined) => /puesto\s*de\s*trabajo/i.test(txt(evento) ?? '')

interface Bloque { cofSena: number; especie: number; dinero: number; total: number }
const sumBloque = (rs: ExcelRubro[]): Bloque => ({
  cofSena: rs.reduce((s, r) => s + n0(r.cofinanciacionSena), 0),
  especie: rs.reduce((s, r) => s + n0(r.contrapartidaEspecie), 0),
  dinero:  rs.reduce((s, r) => s + n0(r.contrapartidaDinero), 0),
  total:   rs.reduce((s, r) => s + n0(r.totalRubro), 0),
})

function finanzasAF(af: ExcelAFConDetalle) {
  const normales = af.rubros.filter(r => !esGO(r) && !esTransferencia(r))
  // una AF puede traer más de un rubro de GO o de transferencia
  const gosRubros = af.rubros.filter(esGO)
  const transRubros = af.rubros.filter(esTransferencia)
  const presupuestoAF = sumBloque(normales)
  const go = gosRubros.length ? sumBloque(gosRubros) : null
  const transferencia = transRubros.length
    ? { ...sumBloque(transRubros), beneficiarios: transRubros.reduce((s, r) => s + n0(r.numBeneficiarios), 0) }
    : null
  const totales = sumBloque(af.rubros) // AF + GO + transferencia
  const grupos = n0(af.numeroGrupos)
  const benefGrupo = n0(af.beneficiariosPresenciales) + n0(af.beneficiariosSincronicos)
  const totalBenef = grupos * benefGrupo
  const totalHoras = n0(af.horasPorGrupo) * grupos
  // el valor hora × beneficiario excluye la transferencia
  const esPuesto = esPuestoTrabajo(af.eventoFormacion)
  const horasCalc = esPuesto ? 8 : n0(af.horasPorGrupo)
  const den = horasCalc * totalBenef
  const numeradorHora = presupuestoAF.total + (go?.total ?? 0)
  const valorHoraBenef = den > 0 ? numeradorHora / den : 0
  return {
    normales, presupuestoAF, go, transferencia,
    totales, grupos, benefGrupo, totalBenef, totalHoras, horasCalc, esPuesto, valorHoraBenef,
  }
}

function unidades(r: ExcelRubro): number {
  return n0(r.numHoras) || n0(r.numPaginasUnidades) || n0(r.numBeneficiarios) || n0(r.numDias) || 0
}

function valorUnidad(r: ExcelRubro): number | null {
  const total = n0(r.totalRubro)
  const horas = n0(r.numHoras)
  const benef = n0(r.numBeneficiarios)
  const cant  = n0(r.numPaginasUnidades)
  const dias  = n0(r.numDias)
  if (horas > 0 && benef > 0) return total / (horas * benef)
  if (horas > 0)              return total / horas
  if (dias > 0 && benef > 0)  return total / (dias * benef)
  if (dias > 0)               return total / dias
  if (cant > 0)               return total / cant
  if (benef > 0)              return total / benef
  return null
}

// primitivas de presentación

function Section({
  icon: Icon, title, subtitle, id, children, tone = 'navy',
}: {
  icon: LucideIcon; title: string; subtitle?: string; id?: string
  children: React.ReactNode; tone?: 'navy' | 'green'
}) {
  const bg = tone === 'green' ? '#0f7a3d' : NAVY
  return (
    <section id={id} className="scroll-mt-24 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="section-bar flex items-center gap-3 px-5 py-3.5 text-white" style={{ backgroundColor: bg }}>
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-white/15">
          <Icon size={18} strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-bold leading-tight tracking-tight">{title}</h2>
          {subtitle && <p className="truncate text-xs font-medium text-white/70">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function SubHeader({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-1 flex items-center gap-2">
      <span className="grid h-6 w-6 place-items-center rounded-md bg-green-50 text-green-600">
        <Icon size={14} strokeWidth={2.4} />
      </span>
      <h3 className="text-[13px] font-bold uppercase tracking-wide text-neutral-900" style={{ color: NAVY }}>{children}</h3>
    </div>
  )
}

function FieldGrid({ cols = 2, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  const cls = cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4'
    : cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3'
    : 'sm:grid-cols-2'
  return <div className={`grid grid-cols-1 gap-x-6 gap-y-3.5 ${cls}`}>{children}</div>
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  const empty = value === null || value === undefined || value === ''
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm ${empty ? 'text-neutral-400' : 'text-neutral-900'} ${mono ? 'font-mono' : 'font-medium'}`}>
        {empty ? '—' : value}
      </dd>
    </div>
  )
}

function LongText({ label, value, emptyLabel = 'Sin información registrada.' }: { label: string; value: string | null | undefined; emptyLabel?: string }) {
  const v = txt(value)
  return (
    <div className="mt-3.5 first:mt-0">
      <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      {v
        ? <p className="whitespace-pre-line rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-[13px] leading-relaxed text-neutral-800">{v}</p>
        : <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-3 text-[13px] italic text-neutral-400">{emptyLabel}</p>}
    </div>
  )
}

function Chips({ label, items }: { label?: string; items: (string | null | undefined)[] }) {
  const clean = items.map(txt).filter((x): x is string => !!x)
  return (
    <div>
      {label && <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>}
      {clean.length
        ? <div className="flex flex-wrap gap-1.5">
            {clean.map((it, i) => (
              <span key={i} className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700">{it}</span>
            ))}
          </div>
        : <p className="text-xs italic text-neutral-400">Sin registros.</p>}
    </div>
  )
}

function TableWrap({ children, minW = 560 }: { children: React.ReactNode; minW?: number }) {
  return <div className="table-wrap -mx-1 overflow-x-auto rounded-xl border border-neutral-200"><table className="w-full border-collapse text-[13px]" style={{ minWidth: minW }}>{children}</table></div>
}

const thCls = 'border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-600'
const tdCls = 'border-b border-neutral-100 px-3 py-2 align-top text-neutral-800'

// el % de cada bucket se calcula sobre el total de su propia fila
interface BucketRow { label: string; cofSena: number; especie: number; dinero: number; total: number; strong?: boolean }
function BucketTable({ concepto, rows, minW = 720 }: { concepto: string; rows: BucketRow[]; minW?: number }) {
  return (
    <TableWrap minW={minW}>
      <colgroup>
        <col style={{ width: '38%' }} />
        <col style={{ width: '11%' }} />
        <col style={{ width: '5%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '5%' }} />
        <col style={{ width: '11%' }} />
        <col style={{ width: '5%' }} />
        <col style={{ width: '15%' }} />
      </colgroup>
      <thead>
        <tr>
          <th className={thCls}>{concepto}</th>
          <th className={`${thCls} text-right`}>Cofin. SENA</th>
          <th className={`${thCls} text-right`}>%</th>
          <th className={`${thCls} text-right`}>Contra. especie</th>
          <th className={`${thCls} text-right`}>%</th>
          <th className={`${thCls} text-right`}>Contra. dinero</th>
          <th className={`${thCls} text-right`}>%</th>
          <th className={`${thCls} text-right`}>Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const b = r.strong ? 'border-neutral-200' : ''
          return (
            <tr key={i} className={r.strong ? 'bg-neutral-50 font-bold' : ''}>
              <td className={`${tdCls} ${b} ${r.strong ? '' : 'font-medium'} text-neutral-900`}>{r.label}</td>
              <td className={`${tdCls} ${b} text-right`}>{fmtCop(r.cofSena)}</td>
              <td className={`${tdCls} ${b} text-right text-neutral-400`}>{pct(pctOf(r.cofSena, r.total))}</td>
              <td className={`${tdCls} ${b} text-right`}>{fmtCop(r.especie)}</td>
              <td className={`${tdCls} ${b} text-right text-neutral-400`}>{pct(pctOf(r.especie, r.total))}</td>
              <td className={`${tdCls} ${b} text-right`}>{fmtCop(r.dinero)}</td>
              <td className={`${tdCls} ${b} text-right text-neutral-400`}>{pct(pctOf(r.dinero, r.total))}</td>
              <td className={`${tdCls} ${b} text-right font-bold`}>{fmtCop(r.total)}</td>
            </tr>
          )
        })}
      </tbody>
    </TableWrap>
  )
}

function Kpi({ icon: Icon, label, value, sub, accent = 'green', money = false }: {
  icon: LucideIcon; label: string; value: string; sub?: string; accent?: 'green' | 'navy' | 'amber' | 'violet'; money?: boolean
}) {
  const styles: Record<string, string> = {
    green:  'bg-green-50 text-green-600',
    navy:   'bg-cerulean-50 text-cerulean-500',
    amber:  'bg-yellowrange-50 text-yellowrange-700',
    violet: 'bg-purpura-50 text-purpura-500',
  }
  return (
    <div className="avoid-break flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
      <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg ${styles[accent]}`}><Icon size={18} /></span>
      <div className="min-w-0">
        {/* los importes no se truncan para no cortar cifras largas */}
        <p className={`font-extrabold leading-tight text-neutral-900 ${money ? 'break-words text-[13px]' : 'truncate text-[15px]'}`}>{value}</p>
        <p className="truncate text-[11px] font-medium text-neutral-500">{label}</p>
        {sub && <p className="truncate text-[11px] font-semibold text-green-600">{sub}</p>}
      </div>
    </div>
  )
}

function MoneyMini({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'sena' | 'especie' | 'dinero' | 'neutral' | 'total' }) {
  const map: Record<string, string> = {
    sena:    'border-green-100 bg-green-50 text-green-700',
    especie: 'border-celeste-50 bg-celeste-50 text-celeste-700',
    dinero:  'border-yellowrange-50 bg-yellowrange-50 text-yellowrange-700',
    total:   'border-neutral-200 bg-neutral-900 text-white',
    neutral: 'border-neutral-200 bg-neutral-50 text-neutral-800',
  }
  return (
    <div className={`rounded-lg border px-3 py-2 ${map[tone]}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${tone === 'total' ? 'text-white/70' : 'opacity-70'}`}>{label}</p>
      <p className="text-sm font-bold">{fmtCop(value)}</p>
    </div>
  )
}

// <a> real para que el enlace siga siendo clicable en el PDF; en pantalla hace scroll suave
function NavBtn({ targetId, children }: { targetId: string; children: React.ReactNode }) {
  return (
    <a
      href={`#${targetId}`}
      onClick={(e) => { e.preventDefault(); scrollToId(targetId) }}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90 transition-colors hover:bg-white/20"
    >
      <ArrowUp size={12} /> {children}
    </a>
  )
}

// detalle completo de una acción de formación

function AfDetalle({ af, index }: { af: ExcelAFConDetalle; index: number }) {
  const f = finanzasAF(af)
  const modalidad = txt(af.modalidadFormacion)
  const evento = txt(af.eventoFormacion)
  const esHibrida = /h[íi]brid/i.test(modalidad ?? '')
  const labelSinc = esHibrida ? 'Beneficiarios sincrónicos / grupo' : 'Beneficiarios virtuales / grupo'

  const go = f.go ?? { cofSena: 0, especie: 0, dinero: 0, total: 0 }
  const tr = f.transferencia ?? { cofSena: 0, especie: 0, dinero: 0, total: 0, beneficiarios: 0 }
  const pctBenefTransf = pctOf(tr.beneficiarios, f.totalBenef)
  const presuRows: BucketRow[] = [
    { label: 'Subtotal rubros AF', ...f.presupuestoAF },
    { label: 'Gastos de operación', ...go },
    { label: `Transferencia — ${fmtNum(tr.beneficiarios)} benef. (${pct(pctBenefTransf)} de beneficiarios)`, cofSena: tr.cofSena, especie: tr.especie, dinero: tr.dinero, total: tr.total },
    { label: 'Total de la acción de formación', ...f.totales, strong: true },
  ]

  return (
    <section id={`af-${af.consecutivo}`} className="scroll-mt-24 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 px-5 py-4 text-white" style={{ backgroundColor: NAVY }}>
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-white/15 text-base font-extrabold">{af.consecutivo}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Acción de formación {index + 1} de la formulación</p>
            <NavBtn targetId="lista-afs">Volver al listado de AF</NavBtn>
          </div>
          <h2 className="text-[15px] font-bold leading-snug">{txt(af.nombre) ?? 'Acción de formación'}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {evento && <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold">{evento}</span>}
            {modalidad && <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold">{modalidad}</span>}
            <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold">{fmtNum(f.grupos)} grupo(s)</span>
            <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold">{fmtNum(f.totalBenef)} beneficiarios</span>
          </div>
        </div>
        <div className="hidden flex-shrink-0 text-right sm:block">
          <p className="text-[11px] font-medium text-white/60">Valor total AF</p>
          <p className="text-lg font-extrabold">{fmtCop(f.totales.total)}</p>
        </div>
      </div>

      <div className="space-y-6 p-5">
        <div>
          <SubHeader icon={Info}>Información de la acción de formación</SubHeader>
          <FieldGrid cols={3}>
            <Field label="Consecutivo" value={af.consecutivo} />
            <Field label="Necesidad asociada (N.º)" value={af.codigoNecesidad ?? null} />
            <Field label="Diagnóstico asociado (N.º)" value={af.codigoDiagnostico ?? null} />
            <Field label="Enfoque de la AF" value={txt(af.enfoque)} />
          </FieldGrid>
          <LongText label="Problema o necesidad detectada" value={af.diagnostico} />
          <LongText label="Justificación de la necesidad detectada" value={af.justificacion} />
          <LongText label="Causas del problema o necesidad" value={af.causasEfectos} />
          <LongText label="Efectos del problema o necesidad" value={af.efectos} />
          <LongText label="Objetivo de la acción de formación" value={af.objetivos} />
          {(f.esPuesto || txt(af.justificacionTallerPuesto)) && <LongText label="Justificación (formación en el puesto de trabajo)" value={af.justificacionTallerPuesto} />}
        </div>

        <div className="border-t border-neutral-100 pt-4">
          <SubHeader icon={CalendarDays}>Datos del evento</SubHeader>
          <FieldGrid cols={3}>
            <Field label="Evento de formación" value={txt(af.eventoFormacion)} />
            <Field label="Modalidad de formación" value={txt(af.modalidadFormacion)} />
            <Field label="Metodología de formación" value={txt(af.metodologia)} />
          </FieldGrid>
        </div>

        <div className="border-t border-neutral-100 pt-4">
          <SubHeader icon={Users2}>Grupos y beneficiarios</SubHeader>
          <FieldGrid cols={4}>
            <Field label="N.º de horas por grupo" value={fmtNum(af.horasPorGrupo)} />
            <Field label="N.º de grupos" value={fmtNum(af.numeroGrupos)} />
            <Field label="Beneficiarios presenciales / grupo" value={fmtNum(af.beneficiariosPresenciales)} />
            <Field label={labelSinc} value={fmtNum(af.beneficiariosSincronicos)} />
            <Field label="Total de horas de la AF" value={fmtNum(f.totalHoras)} />
            <Field label="Total de beneficiarios de la AF" value={fmtNum(f.totalBenef)} />
          </FieldGrid>
        </div>

        <div className="border-t border-neutral-100 pt-4">
          <SubHeader icon={UserCheck}>Perfil de los beneficiarios</SubHeader>
          <div className="space-y-4">
            <Chips label="Áreas funcionales" items={af.areas} />
            <LongText label="Justificación de áreas funcionales" value={af.justificacionAreas} />
            <Chips label="Niveles ocupacionales" items={af.niveles} />
            <LongText label="Justificación de niveles ocupacionales" value={af.justificacionNiveles} />
            <Chips label="Ocupaciones CUOC" items={af.ocupacionesCuoc} />

            <p className="pt-1 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">Datos numéricos de beneficiarios</p>
            <FieldGrid cols={3}>
              <Field label="Trabajadores mujeres" value={fmtNum(af.trabajadoresMujeres)} />
              <Field label="En condición de discapacidad" value={fmtNum(af.trabajadoresDiscapacidad)} />
              <Field label="Empresas con modelo BIC" value={fmtNum(af.empresasBic)} />
            </FieldGrid>

            <p className="pt-1 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">MiPymes (si aplica)</p>
            <FieldGrid cols={2}>
              <Field label="N.º de empresas MiPymes" value={aplicaNum(af.mipymesEmpresas)} />
              <Field label="N.º de trabajadores de empresas MiPymes" value={aplicaNum(af.mipymesTrabajadores)} />
            </FieldGrid>
            <LongText label="Justificación MiPymes y trabajadores a beneficiar" value={af.justificacionMipymes} emptyLabel="NO APLICA" />

            <p className="pt-1 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">Cadena productiva (si aplica)</p>
            <FieldGrid cols={2}>
              <Field label="N.º de empresas de la cadena productiva" value={aplicaNum(af.cadenaEmpresas)} />
              <Field label="N.º de trabajadores de la cadena productiva" value={aplicaNum(af.cadenaTrabajadores)} />
            </FieldGrid>
            <LongText label="Justificación cadena productiva" value={af.justificacionCadena} emptyLabel="NO APLICA" />

            <p className="pt-1 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">Economía campesina (si aplica)</p>
            <FieldGrid cols={2}>
              <Field label="N.º de trabajadores de la economía campesina" value={aplicaNum(af.trabajadoresCampesinos)} />
            </FieldGrid>
            <LongText label="Justificación trabajadores economía campesina" value={af.trabajadoresCampesinosTexto} emptyLabel="NO APLICA" />

            <p className="pt-1 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">Economía popular (si aplica)</p>
            <FieldGrid cols={2}>
              <Field label="N.º de trabajadores de la economía popular" value={aplicaNum(af.trabajadoresPopular)} />
            </FieldGrid>
            <LongText label="Justificación trabajadores economía popular" value={af.trabajadoresPopularTexto} emptyLabel="NO APLICA" />
          </div>
        </div>

        <div className="border-t border-neutral-100 pt-4">
          <SubHeader icon={Layers}>Sectores y subsectores del beneficiario</SubHeader>
          <div className="space-y-4">
            <Chips label="Sector(es) al que pertenecen los beneficiarios" items={af.sectoresPertenecen} />
            <Chips label="Subsector(es) al que pertenecen los beneficiarios" items={af.subsectoresPertenecen} />
            <Chips label="Clasificación de la AF por sector(es)" items={af.sectoresBeneficia} />
            <Chips label="Clasificación de la AF por subsector(es)" items={af.subsectoresBeneficia} />
            <LongText label="Justificación de sectores y subsectores" value={af.justificacionSectores} />
          </div>
        </div>

        <div className="border-t border-neutral-100 pt-4">
          <SubHeader icon={Notebook}>Unidades temáticas de la acción de formación ({af.uts.length})</SubHeader>
          {af.uts.length === 0
            ? <p className="text-xs italic text-neutral-400">Sin unidades temáticas registradas.</p>
            : <div className="space-y-3">
                {af.uts.map((u, i) => {
                  const total = n0(u.horasPracticas) + n0(u.horasTeoricas)
                  const art = u.esArticulacionTerritorial
                  return (
                    <div key={i} className={`overflow-hidden rounded-xl border-2 ${art ? 'border-purpura-300' : 'border-neutral-200'}`}>
                      <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 ${art ? 'border-purpura-200 bg-purpura-50' : 'border-neutral-200 bg-neutral-50'}`}>
                        <p className={`text-sm font-bold ${art ? 'text-purpura-700' : 'text-neutral-900'}`} style={art ? undefined : { color: NAVY }}>UT N.º {u.numeroUT} — {txt(u.nombre) ?? '—'}</p>
                        {art && <span className="rounded-full bg-purpura-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">Articulación con el territorio</span>}
                      </div>
                      <div className="space-y-3 p-4">
                        {art && txt(u.articulacionTerritorial) && (
                          <div className="rounded-lg border border-purpura-200 bg-purpura-50 px-3 py-2 text-[13px] text-purpura-700">
                            <span className="font-bold">Articulación: </span>{txt(u.articulacionTerritorial)}
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg bg-green-50 px-2 py-1.5"><p className="text-[10px] font-semibold uppercase text-green-700/70">Horas prácticas</p><p className="text-sm font-bold text-green-700">{fmtNum(u.horasPracticas)}</p></div>
                          <div className="rounded-lg bg-cerulean-50 px-2 py-1.5"><p className="text-[10px] font-semibold uppercase text-cerulean-500/70">Horas teóricas</p><p className="text-sm font-bold text-cerulean-500">{fmtNum(u.horasTeoricas)}</p></div>
                          <div className="rounded-lg bg-neutral-100 px-2 py-1.5"><p className="text-[10px] font-semibold uppercase text-neutral-500">Total de horas</p><p className="text-sm font-bold text-neutral-700">{fmtNum(total)}</p></div>
                        </div>
                        {u.perfiles.length > 0 && (
                          <div>
                            <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500">Perfil del capacitador</p>
                            <TableWrap>
                              <thead><tr><th className={thCls}>Perfil / rubro</th><th className={`${thCls} w-28 text-right`}>Horas</th></tr></thead>
                              <tbody>
                                {u.perfiles.map((p, j) => (
                                  <tr key={j}><td className={tdCls}>{txt(p.perfil) ?? '—'}</td><td className={`${tdCls} text-right font-semibold`}>{fmtNum(p.horas)}</td></tr>
                                ))}
                              </tbody>
                            </TableWrap>
                          </div>
                        )}
                        <LongText label="Contenido de la unidad temática" value={u.contenido} />
                        <LongText label="Competencia por adquirir" value={u.competencia} />
                        <Chips label="Actividades de aprendizaje" items={u.actividades} />
                        <LongText label="Justificación de la actividad de aprendizaje" value={u.descripcionActividad} />
                      </div>
                    </div>
                  )
                })}
              </div>}
        </div>

        <div className="border-t border-neutral-100 pt-4">
          <SubHeader icon={Compass}>Alineación de la acción de formación</SubHeader>
          <FieldGrid cols={2}>
            <Field label="Reto nacional" value={txt(af.componenteAlineacion)} />
            <Field label="Componente estratégico" value={txt(af.descripcionAlineacion)} />
          </FieldGrid>
          <LongText label="Justificación de la alineación" value={af.justificacionAlineacion} />
          <LongText label="Justificación de la acción de formación especializada" value={af.justificacionEspecializada} />
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ImpactoList titulo="Impacto en el desempeño del trabajador" items={af.impactosTrabajador} />
            <ImpactoList titulo="Impacto en la productividad y competitividad" items={af.impactosProductividad} />
          </div>
        </div>

        <div className="border-t border-neutral-100 pt-4">
          <SubHeader icon={MapPin}>Cobertura — lugares de ejecución ({af.cobertura.length} grupo{af.cobertura.length === 1 ? '' : 's'})</SubHeader>
          {af.cobertura.length === 0
            ? <p className="text-xs italic text-neutral-400">Sin grupos de cobertura registrados.</p>
            : <div className="space-y-3">
                {af.cobertura.map((c, i) => {
                  const deptos = c.departamentos.filter(d => txt(d.departamento))
                  const hayPresencial = !!(txt(c.departamentoPresencial) || txt(c.ciudadPresencial))
                  return (
                    <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
                      <p className="mb-2 text-sm font-bold text-neutral-900" style={{ color: NAVY }}>Grupo {i + 1}</p>
                      {hayPresencial && (
                        <FieldGrid cols={3}>
                          <Field label="Departamento (presencial)" value={txt(c.departamentoPresencial)} />
                          <Field label="Ciudad / municipio (presencial)" value={txt(c.ciudadPresencial)} />
                          <Field label="Beneficiarios" value={fmtNum(c.beneficiariosPresencial)} />
                        </FieldGrid>
                      )}
                      {deptos.length > 0 && (
                        <div className={hayPresencial ? 'mt-3' : ''}>
                          <TableWrap>
                            <thead><tr><th className={thCls}>Departamento</th><th className={`${thCls} w-32 text-right`}>Beneficiarios</th></tr></thead>
                            <tbody>
                              {deptos.map((d, j) => (
                                <tr key={j}><td className={tdCls}>{txt(d.departamento)}</td><td className={`${tdCls} text-right font-semibold`}>{fmtNum(d.beneficiarios)}</td></tr>
                              ))}
                            </tbody>
                          </TableWrap>
                        </div>
                      )}
                      {!hayPresencial && deptos.length === 0 && (
                        <p className="text-xs italic text-neutral-400">Sin lugares de ejecución registrados.</p>
                      )}
                      <LongText label="Justificación de la relación con los lugares de ejecución" value={c.justificacion} />
                    </div>
                  )
                })}
              </div>}
        </div>

        <div className="border-t border-neutral-100 pt-4">
          <SubHeader icon={Package}>Material de formación</SubHeader>
          <FieldGrid cols={3}>
            <Field label="Ambiente de aprendizaje" value={txt(af.ambiente)} />
            <Field label="Material de formación seleccionado" value={txt(af.material)} />
            <Field label="Gestión del conocimiento" value={txt(af.gestionConocimiento)} />
          </FieldGrid>
          <div className="mt-3.5"><Chips label="Recursos didácticos" items={(af.recursosDidacticos ?? '').split(/[,;]+/)} /></div>
          <LongText label="Justificación del material de formación" value={af.justificacionSiAplica} />
          <FieldGrid cols={2}>
            <Field label="Insumos" value={txt(af.insumos)} />
            <Field label="Justificación de los insumos" value={txt(af.justificacionInsumo)} />
          </FieldGrid>
        </div>

        <div className="border-t border-neutral-100 pt-4">
          <SubHeader icon={Receipt}>Rubros del presupuesto de la acción de formación</SubHeader>
          {f.normales.length === 0
            ? <p className="text-xs italic text-neutral-400">Sin rubros registrados.</p>
            : <div className="wide-table -mx-1 overflow-x-auto rounded-xl border border-neutral-200">
                <table className="w-full min-w-[1040px] border-collapse text-[12.5px]">
                  <colgroup>
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '26%' }} />
                    <col style={{ width: '3%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '11%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={thCls}>Rubro</th>
                      <th className={thCls}>Justificación</th>
                      <th className={`${thCls} text-right`}>Unid.</th>
                      <th className={`${thCls} text-right`}>Valor unidad</th>
                      <th className={`${thCls} text-right`}>Cofin. SENA</th>
                      <th className={`${thCls} text-right`}>%</th>
                      <th className={`${thCls} text-right`}>Especie</th>
                      <th className={`${thCls} text-right`}>%</th>
                      <th className={`${thCls} text-right`}>Dinero</th>
                      <th className={`${thCls} text-right`}>%</th>
                      <th className={`${thCls} text-right`}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.normales.map((r, i) => {
                      const t = n0(r.totalRubro)
                      const vu = valorUnidad(r)
                      return (
                        <tr key={i}>
                          <td className={`${tdCls} min-w-[160px]`}>
                            <p className="font-semibold text-neutral-900">{txt(r.nombreRubro) ?? txt(r.idRubro) ?? 'Rubro'}</p>
                            {txt(r.descripcion) && <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-700">{txt(r.descripcion)}</p>}
                          </td>
                          <td className={`${tdCls} min-w-[220px] text-[11.5px] leading-snug text-neutral-600`}>{txt(r.justificacion) ?? '—'}</td>
                          <td className={`${tdCls} text-right`}>{fmtNum(unidades(r))}</td>
                          <td className={`${tdCls} text-right`}>{vu !== null ? fmtCop(vu) : '—'}</td>
                          <td className={`${tdCls} text-right`}>{fmtCop(r.cofinanciacionSena)}</td>
                          <td className={`${tdCls} text-right text-neutral-400`}>{pct(pctOf(n0(r.cofinanciacionSena), t))}</td>
                          <td className={`${tdCls} text-right`}>{fmtCop(r.contrapartidaEspecie)}</td>
                          <td className={`${tdCls} text-right text-neutral-400`}>{pct(pctOf(n0(r.contrapartidaEspecie), t))}</td>
                          <td className={`${tdCls} text-right`}>{fmtCop(r.contrapartidaDinero)}</td>
                          <td className={`${tdCls} text-right text-neutral-400`}>{pct(pctOf(n0(r.contrapartidaDinero), t))}</td>
                          <td className={`${tdCls} text-right font-bold`}>{fmtCop(r.totalRubro)}</td>
                        </tr>
                      )
                    })}
                    <tr className="bg-neutral-50 font-bold">
                      <td className={`${tdCls} border-neutral-200`} colSpan={4}>Subtotal rubros AF</td>
                      <td className={`${tdCls} border-neutral-200 text-right`}>{fmtCop(f.presupuestoAF.cofSena)}</td>
                      <td className={`${tdCls} border-neutral-200 text-right text-neutral-400`}>{pct(pctOf(f.presupuestoAF.cofSena, f.presupuestoAF.total))}</td>
                      <td className={`${tdCls} border-neutral-200 text-right`}>{fmtCop(f.presupuestoAF.especie)}</td>
                      <td className={`${tdCls} border-neutral-200 text-right text-neutral-400`}>{pct(pctOf(f.presupuestoAF.especie, f.presupuestoAF.total))}</td>
                      <td className={`${tdCls} border-neutral-200 text-right`}>{fmtCop(f.presupuestoAF.dinero)}</td>
                      <td className={`${tdCls} border-neutral-200 text-right text-neutral-400`}>{pct(pctOf(f.presupuestoAF.dinero, f.presupuestoAF.total))}</td>
                      <td className={`${tdCls} border-neutral-200 text-right`}>{fmtCop(f.presupuestoAF.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>}
        </div>

        <div className="border-t border-neutral-100 pt-4">
          <SubHeader icon={TrendingUp}>Presupuesto total de la acción de formación</SubHeader>
          <BucketTable concepto="Concepto" rows={presuRows} />

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <MoneyMini label="Subtotal rubros AF" value={f.presupuestoAF.total} tone="neutral" />
            <MoneyMini label="Gastos de operación" value={f.go?.total ?? 0} tone="dinero" />
            <MoneyMini label="Transferencia" value={f.transferencia?.total ?? 0} tone="especie" />
            <MoneyMini label="Valor total AF" value={f.totales.total} tone="total" />
          </div>

          <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500">Valor hora × beneficiario</p>
              <p className="text-base font-extrabold" style={{ color: NAVY }}>{fmtCop(f.valorHoraBenef)}</p>
            </div>
            <p className="mt-1 text-[11px] italic leading-snug text-neutral-400">
              (Valor AF + Gastos de operación) / (N.º beneficiarios × horas por grupo) = {fmtCop(f.presupuestoAF.total + (f.go?.total ?? 0))} / ({fmtNum(f.totalBenef)} × {fmtNum(f.horasCalc)}){f.esPuesto ? ' · puesto de trabajo real: 8 horas fijas' : ''}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function ImpactoList({ titulo, items }: { titulo: string; items: string[] }) {
  const clean = items.map(txt).filter((x): x is string => !!x)
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500">{titulo}</p>
      {clean.length
        ? <ol className="space-y-2">
            {clean.map((it, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-neutral-800">
                <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-green-500 text-[10px] font-bold text-white">{i + 1}</span>
                <span>{it}</span>
              </li>
            ))}
          </ol>
        : <p className="text-xs italic text-neutral-400">Sin registros.</p>}
    </div>
  )
}

function DiagnosticoCard({ d }: { d: ExcelDiagnostico }) {
  const herr = d.herramientas.filter(h => txt(h.nombre))
  const fecha = fmtFechaExcel(d.fecha)
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">Diagnóstico {d.numero}</span>
        {fecha && <span className="text-xs text-neutral-500">Fecha: {fecha}</span>}
      </div>
      <FieldGrid cols={3}>
        <Field label="¿Herramienta de creación propia?" value={txt(d.herramientaPropia)} />
        <Field label="¿Cuenta con plan de capacitación?" value={txt(d.planCapacitacion)} />
        <Field label="Otro tipo de herramienta" value={txt(d.otraHerramienta)} />
      </FieldGrid>
      {herr.length > 0 && (
        <div className="mt-3">
          <TableWrap>
            <thead><tr><th className={thCls}>Herramienta / metodología</th><th className={`${thCls} w-40 text-right`}>Muestra poblacional</th></tr></thead>
            <tbody>
              {herr.map((h, i) => (
                <tr key={i}><td className={tdCls}>{txt(h.nombre)}</td><td className={`${tdCls} text-right`}>{txt(h.muestra) ?? '—'}</td></tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      )}
      <LongText label="Descripción de las herramientas utilizadas" value={d.descripcion} />
      <LongText label="Resumen de los principales resultados" value={d.resumen} />
    </div>
  )
}

// componente principal

export function ReportePreview({ preview, onVolver }: { preview: PreviewImportacion; onVolver: () => void }) {
  const { basicos: b, generalidades: g, contactos: c, proyecto, afs, diagnosticos, necesidades } = preview
  const pres = proyecto.presupuesto

  const [afQuery, setAfQuery] = useState('')

  const kpis = useMemo(() => {
    const beneficiarios = pres.beneficiarios || afs.reduce((s, af) => s + finanzasAF(af).totalBenef, 0)
    const totalUTs = afs.reduce((s, af) => s + af.uts.length, 0)
    const pctSena = pres.valorTotal > 0 ? (pres.cofinanciacionSena / pres.valorTotal) * 100 : 0
    return { beneficiarios, totalUTs, pctSena }
  }, [afs, pres])

  const plan = useMemo(() => afs.map(af => ({ af, f: finanzasAF(af) })), [afs])
  const planTot = useMemo(() => ({
    grupos: plan.reduce((s, p) => s + p.f.grupos, 0),
    benef: plan.reduce((s, p) => s + p.f.totalBenef, 0),
    cofSena: plan.reduce((s, p) => s + p.f.totales.cofSena, 0),
    especie: plan.reduce((s, p) => s + p.f.totales.especie, 0),
    dinero: plan.reduce((s, p) => s + p.f.totales.dinero, 0),
    total: plan.reduce((s, p) => s + p.f.totales.total, 0),
  }), [plan])

  // pres solo trae el valor de transferencia, no el desglose cof/contrapartida
  const transBuckets = useMemo(() => plan.reduce((acc, p) => {
    const t = p.f.transferencia
    if (t) { acc.cofSena += t.cofSena; acc.especie += t.especie; acc.dinero += t.dinero; acc.total += t.total }
    return acc
  }, { cofSena: 0, especie: 0, dinero: 0, total: 0 }), [plan])

  const resumenRubros = useMemo(() => {
    // el id del rubro no se muestra, solo sirve para ordenar
    const map = new Map<string, { orden: number; nombre: string; cofSena: number; especie: number; dinero: number; total: number }>()
    for (const af of afs) for (const r of af.rubros) {
      const key = `${codeOf(r).toUpperCase()}|${nameOf(r).toUpperCase()}`
      const label = txt(r.nombreRubro) ?? txt(r.idRubro) ?? 'Rubro'
      const orden = Number(r.idRubro)
      const cur = map.get(key) ?? { orden: Number.isFinite(orden) ? orden : Number.MAX_SAFE_INTEGER, nombre: label, cofSena: 0, especie: 0, dinero: 0, total: 0 }
      if (Number.isFinite(orden)) cur.orden = Math.min(cur.orden, orden)
      cur.cofSena += n0(r.cofinanciacionSena)
      cur.especie += n0(r.contrapartidaEspecie)
      cur.dinero += n0(r.contrapartidaDinero)
      cur.total += n0(r.totalRubro)
      map.set(key, cur)
    }
    return [...map.values()].sort((a, x) => a.orden - x.orden)
  }, [afs])

  const topeGO = pres.valorAFs > 200_000_000 ? 10 : 16
  const pctGO = pres.valorAFs > 0 ? (pres.gastosOperacion / pres.valorAFs) * 100 : 0
  const baseTransf = pres.valorAFs + pres.gastosOperacion
  const pctTransfValor = baseTransf > 0 ? (pres.valorTransferencia / baseTransf) * 100 : 0
  const pctTransfBenef = pres.beneficiarios > 0 ? (pres.beneficiariosTransferencia / pres.beneficiarios) * 100 : 0
  const pctTotSena = pres.valorTotal > 0 ? (pres.cofinanciacionSena / pres.valorTotal) * 100 : 0
  const pctTotEspecie = pres.valorTotal > 0 ? (pres.contrapartidaEspecie / pres.valorTotal) * 100 : 0
  const pctTotDinero = pres.valorTotal > 0 ? (pres.contrapartidaDinero / pres.valorTotal) * 100 : 0

  // filas de las tablas del presupuesto general
  const afOnly = plan.reduce((acc, p) => {
    acc.cofSena += p.f.presupuestoAF.cofSena; acc.especie += p.f.presupuestoAF.especie
    acc.dinero += p.f.presupuestoAF.dinero; acc.total += p.f.presupuestoAF.total
    return acc
  }, { cofSena: 0, especie: 0, dinero: 0, total: 0 })
  const afsRows: BucketRow[] = [
    ...plan.map(({ af, f }) => ({
      label: `AF ${af.consecutivo} · ${txt(af.nombre) ?? '—'}`,
      cofSena: f.presupuestoAF.cofSena, especie: f.presupuestoAF.especie, dinero: f.presupuestoAF.dinero, total: f.presupuestoAF.total,
    })),
    { label: 'Total acciones de formación', ...afOnly, strong: true },
  ]

  const goRows: BucketRow[] = [
    { label: 'Gastos de operación (R09)', cofSena: pres.gastosOpCofinSena, especie: pres.gastosOpContraEspecie, dinero: pres.gastosOpContraDinero, total: pres.gastosOperacion, strong: true },
  ]
  // sin desglose en los rubros R015, la transferencia va a contrapartida en dinero (así la registra el backend)
  const transRows: BucketRow[] = [
    transBuckets.total > 0
      ? { label: 'Transferencia de conocimiento (R015)', cofSena: transBuckets.cofSena, especie: transBuckets.especie, dinero: transBuckets.dinero, total: transBuckets.total, strong: true }
      : { label: 'Transferencia de conocimiento (R015)', cofSena: 0, especie: 0, dinero: pres.valorTransferencia, total: pres.valorTransferencia, strong: true },
  ]
  const totalRows: BucketRow[] = [
    { label: 'Presupuesto total del proyecto (AF + G.O. + transferencia)', cofSena: pres.cofinanciacionSena, especie: pres.contrapartidaEspecie, dinero: pres.contrapartidaDinero, total: pres.valorTotal, strong: true },
  ]
  const resumenRows: BucketRow[] = [
    ...resumenRubros.map(r => ({ label: r.nombre, cofSena: r.cofSena, especie: r.especie, dinero: r.dinero, total: r.total })),
    {
      label: 'Total del proyecto',
      cofSena: resumenRubros.reduce((s, r) => s + r.cofSena, 0),
      especie: resumenRubros.reduce((s, r) => s + r.especie, 0),
      dinero: resumenRubros.reduce((s, r) => s + r.dinero, 0),
      total: resumenRubros.reduce((s, r) => s + r.total, 0),
      strong: true,
    },
  ]

  const afsFiltradas = afs.filter(af => {
    const q = afQuery.trim().toLowerCase()
    if (!q) return true
    return (txt(af.nombre) ?? '').toLowerCase().includes(q) || String(af.consecutivo).includes(q)
  })

  const modalidad = (txt(b.modalidadParticipacion) ?? txt(proyecto.modalidadProyectoNombre) ?? '').toUpperCase()

  return (
    <div className="reporte-preview min-h-screen bg-neutral-50">
      <PrintStyles />

      <div className="no-print sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <button onClick={onVolver} className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50">
            <ArrowLeft size={16} /> Volver al preview
          </button>
          <p className="hidden truncate text-sm font-semibold text-neutral-500 sm:block">Reporte del proyecto · vista previa desde el formulador</p>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-600">
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="reporte-doc mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <div id="inicio-proyecto" className="avoid-break scroll-mt-24 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="px-6 py-8 text-center text-white" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0a4e78 100%)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/sena-logo.svg" alt="SENA" className="mx-auto h-14 w-14" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-white/85">Servicio Nacional de Aprendizaje — SENA</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/60">Dirección del Sistema Nacional de Formación para el Trabajo</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/60">Grupo de Gestión para la Productividad y la Competitividad</p>
            <p className="mt-1.5 text-[12px] font-semibold uppercase tracking-wide text-white/80">Programa de Formación Continua Especializada{txt(preview.convocatoria.nombre) ? ` · ${txt(preview.convocatoria.nombre)}` : ''}</p>
            <p className="mt-4 text-[13px] font-medium text-white/70">Reporte completo — Formulario digital del proyecto</p>
            <h1 className="mx-auto mt-1 max-w-3xl text-2xl font-extrabold leading-tight sm:text-[26px]">
              Proponente: {txt(b.razonSocial) ?? txt(proyecto.nombre) ?? 'Proyecto'}{txt(b.sigla) ? ` - ${txt(b.sigla)}` : ''}
            </h1>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {modalidad && <span className="rounded-md bg-white/15 px-3 py-1 text-xs font-semibold">MODALIDAD {modalidad}</span>}
              <span className="rounded-md bg-white/15 px-3 py-1 text-xs font-semibold">{fmtNum(afs.length)} acciones de formación</span>
              <span className="rounded-md bg-white/15 px-3 py-1 text-xs font-semibold">{fmtNum(kpis.beneficiarios)} beneficiarios</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
            <Kpi icon={BookOpen} label="Acciones de formación" value={fmtNum(afs.length)} sub={`${fmtNum(kpis.totalUTs)} unidades temáticas`} accent="navy" />
            <Kpi icon={Users2} label="Beneficiarios totales" value={fmtNum(kpis.beneficiarios)} accent="violet" />
            <Kpi icon={Wallet} label="Valor total del proyecto" value={fmtCop(pres.valorTotal)} accent="green" money />
            <Kpi icon={BadgeCheck} label="Cofinanciación SENA" value={fmtCop(pres.cofinanciacionSena)} sub={pct(kpis.pctSena)} accent="amber" money />
          </div>
        </div>

        <Section icon={Building2} title="Datos generales de la entidad proponente" subtitle="Organización proponente del proyecto">
          <FieldGrid cols={3}>
            <Field label="Razón social" value={txt(b.razonSocial)} />
            <Field label="Sigla" value={txt(b.sigla)} />
            <Field label="Tipo de identificación" value={txt(b.tipoIdentificacion)} />
            <Field label="N.º de identificación (NIT)" value={[txt(b.nit), txt(b.digitoVerificacion)].filter(Boolean).join(' - ')} mono />
            <Field label="Tipo de organización" value={txt(b.tipoOrganizacion)} />
            <Field label="Tamaño de la empresa" value={txt(b.tamanoEmpresa)} />
            <Field label="Actividad económica (CIIU)" value={txt(b.ciiu)} />
            <Field label="Modalidad de participación" value={txt(b.modalidadParticipacion)} />
            <Field label="Cobertura" value={txt(b.cobertura)} />
            <Field label="Departamento de domicilio" value={txt(b.departamentoDomicilio)} />
            <Field label="Ciudad / municipio" value={txt(b.ciudadDomicilio)} />
            <Field label="Dirección de domicilio" value={txt(b.direccionDomicilio)} />
            <Field label="Teléfono" value={[txt(b.codigoIndicativo), txt(b.telefono)].filter(Boolean).join(' ')} />
            <Field label="Celular" value={txt(b.celular)} />
            <Field label="Correo electrónico" value={txt(b.email)} />
            <Field label="Página web" value={txt(b.paginaWeb)} />
            <Field label="¿Certificación de competencias laborales?" value={txt(b.certificacionCompetencias)} />
            <Field label="¿Vinculó expertos técnicos?" value={txt(b.vinculoExpertosTecnicos)} />
          </FieldGrid>
          <div className="mt-4"><Chips label="Mesas sectoriales" items={[b.mesa1, b.mesa2, b.mesa3]} /></div>
        </Section>

        <Section icon={UserCircle2} title="Datos de contacto" subtitle="Representante legal y contactos del proyecto">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ContactoBloque titulo="Representante legal" c={c.representanteLegal} />
            <ContactoBloque titulo="Profesional de talento humano" c={c.contacto1} />
            <ContactoBloque titulo="Encargado de comunicaciones" c={c.contactoSustenta} />
          </div>
        </Section>

        <Section icon={Briefcase} title="Generalidades de la entidad proponente">
          <LongText label="Objeto social de la organización" value={g.objetoSocial} />
          <LongText label="Productos y/o servicios ofrecidos y mercado" value={g.productosServicios} />
          <LongText label="Situación actual y proyección de la organización" value={g.situacionActual} />
          <LongText label="Papel de la organización en el sector y/o región" value={g.papelSector} />
          <LongText label="Retos estratégicos vinculados a la formación" value={g.retos} />
          <LongText label="Experiencia en actividades formativas" value={g.experienciaFormativa} />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-4">
              <Field label="Sector al que pertenece la entidad" value={txt(g.sectorPertenece)} />
              <Field label="Subsector al que pertenece la entidad" value={txt(g.subsectorPertenece)} />
            </div>
            <div className="space-y-4">
              <Chips label="Sector(es) que representa" items={g.sectoresRepresenta} />
              <Chips label="Subsector(es) que representa" items={g.subsectoresRepresenta} />
            </div>
          </div>
          <LongText label="Eslabones de la cadena productiva" value={g.cadenaProductiva} />
          <LongText label="Interacciones con otros actores" value={g.interacciones} />
        </Section>

        {diagnosticos.length > 0 && (
          <Section icon={ClipboardList} title="Diagnóstico de necesidades de formación" subtitle={`${diagnosticos.length} diagnóstico(s)`}>
            <div className="space-y-3">
              {diagnosticos.map((d, i) => <DiagnosticoCard key={i} d={d} />)}
            </div>
          </Section>
        )}

        {necesidades.length > 0 && (
          <Section icon={Target} title="Necesidades o problemas puntuales detectados" subtitle={`${necesidades.length} necesidad(es)`}>
            <TableWrap>
              <thead>
                <tr>
                  <th className={`${thCls} w-14`}>N.º</th>
                  <th className={thCls}>Necesidad / problema detectado</th>
                  <th className={`${thCls} w-32 text-right`}>Beneficiarios</th>
                </tr>
              </thead>
              <tbody>
                {necesidades.map((ne, i) => (
                  <tr key={i}>
                    <td className={`${tdCls} font-semibold`}>{ne.numeroNecesidad}</td>
                    <td className={tdCls}>{txt(ne.necesidad) ?? '—'}</td>
                    <td className={`${tdCls} text-right font-semibold`}>{fmtNum(ne.numeroBeneficiarios)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Section>
        )}

        <Section icon={FolderKanban} title="Objetivo general del proyecto">
          <LongText label="Objetivo general del proyecto" value={g.objetivoProyecto} />
        </Section>

        <Section icon={Activity} title="Plan operativo del proyecto de formación" subtitle="Resumen de las acciones de formación">
          <div className="wide-table -mx-1 overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
              <colgroup>
                <col style={{ width: '3%' }} />
                <col style={{ width: '19%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={`${thCls} w-12`}>AF</th>
                  <th className={thCls}>Acción de formación</th>
                  <th className={thCls}>Modalidad</th>
                  <th className={thCls}>Evento</th>
                  <th className={`${thCls} text-right`}>Grupos</th>
                  <th className={`${thCls} text-right`}>Horas</th>
                  <th className={`${thCls} text-right`}>Benef.</th>
                  <th className={`${thCls} text-right`}>Cofin. SENA</th>
                  <th className={`${thCls} text-right`}>Especie</th>
                  <th className={`${thCls} text-right`}>Dinero</th>
                  <th className={`${thCls} text-right`}>Valor total AF</th>
                  <th className={`${thCls} text-right`}>Valor h×benef.</th>
                </tr>
              </thead>
              <tbody>
                {plan.map(({ af, f }) => (
                  <tr key={af.consecutivo}>
                    <td className={`${tdCls} text-center font-bold`}><a href={`#af-${af.consecutivo}`} onClick={(e) => { e.preventDefault(); scrollToId(`af-${af.consecutivo}`) }} className="text-green-600 hover:underline">{af.consecutivo}</a></td>
                    <td className={`${tdCls} min-w-[180px] font-medium`}>{txt(af.nombre) ?? '—'}</td>
                    <td className={tdCls}>{txt(af.modalidadFormacion) ?? '—'}</td>
                    <td className={tdCls}>{txt(af.eventoFormacion) ?? '—'}</td>
                    <td className={`${tdCls} text-right`}>{fmtNum(af.numeroGrupos)}</td>
                    <td className={`${tdCls} text-right`}>{fmtNum(af.horasPorGrupo)}</td>
                    <td className={`${tdCls} text-right`}>{fmtNum(f.totalBenef)}</td>
                    <td className={`${tdCls} text-right`}>{fmtCop(f.totales.cofSena)}</td>
                    <td className={`${tdCls} text-right`}>{fmtCop(f.totales.especie)}</td>
                    <td className={`${tdCls} text-right`}>{fmtCop(f.totales.dinero)}</td>
                    <td className={`${tdCls} text-right font-bold`}>{fmtCop(f.totales.total)}</td>
                    <td className={`${tdCls} text-right`}>{fmtCop(f.valorHoraBenef)}</td>
                  </tr>
                ))}
                <tr className="bg-neutral-50 font-bold">
                  <td className={`${tdCls} border-neutral-200`} colSpan={4}>Totales</td>
                  <td className={`${tdCls} border-neutral-200 text-right`}>{fmtNum(planTot.grupos)}</td>
                  <td className={`${tdCls} border-neutral-200`} />
                  <td className={`${tdCls} border-neutral-200 text-right`}>{fmtNum(planTot.benef)}</td>
                  <td className={`${tdCls} border-neutral-200 text-right`}>{fmtCop(planTot.cofSena)}</td>
                  <td className={`${tdCls} border-neutral-200 text-right`}>{fmtCop(planTot.especie)}</td>
                  <td className={`${tdCls} border-neutral-200 text-right`}>{fmtCop(planTot.dinero)}</td>
                  <td className={`${tdCls} border-neutral-200 text-right`}>{fmtCop(planTot.total)}</td>
                  <td className={`${tdCls} border-neutral-200`} />
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] italic leading-snug text-neutral-400">
            Las columnas de valor incluyen Acción de Formación + Gastos de Operación + Transferencia. Valor hora × beneficiario = (Valor AF + G.O.) / (N.º beneficiarios × horas por grupo). En puesto de trabajo real se usan 8 horas.
          </p>

          <div id="lista-afs" className="mt-5 scroll-mt-24 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-bold text-neutral-900" style={{ color: NAVY }}>Ir a una acción de formación</p>
              <div className="no-print relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  value={afQuery}
                  onChange={(e) => setAfQuery(e.target.value)}
                  placeholder="Buscar por nombre o número…"
                  className="w-64 max-w-full rounded-lg border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-sm text-neutral-700 outline-none focus:border-green-500"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {afsFiltradas.length === 0
                ? <p className="text-xs italic text-neutral-400">No hay acciones de formación que coincidan con la búsqueda.</p>
                : afsFiltradas.map(af => (
                    <a
                      key={af.consecutivo}
                      href={`#af-${af.consecutivo}`}
                      onClick={(e) => { e.preventDefault(); scrollToId(`af-${af.consecutivo}`) }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-left text-xs font-semibold text-neutral-700 transition-colors hover:border-green-500 hover:bg-green-50"
                    >
                      <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-md bg-neutral-100 text-[10px] font-bold text-neutral-600">{af.consecutivo}</span>
                      <span className="max-w-[220px] truncate">{txt(af.nombre) ?? 'Acción de formación'}</span>
                    </a>
                  ))}
            </div>
          </div>
        </Section>

        <div className="flex items-center gap-3 pt-1">
          <span className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ backgroundColor: NAVY }}><GraduationCap size={18} /></span>
          <h2 className="text-lg font-extrabold text-neutral-900" style={{ color: NAVY }}>Acciones de formación — detalle completo</h2>
        </div>
        {afs.map((af, i) => <AfDetalle key={af.consecutivo} af={af} index={i} />)}

        <Section icon={Wallet} title="Presupuesto del proyecto" subtitle="Consolidado financiero de la formulación" tone="green">
          <div className="overflow-hidden rounded-xl text-white" style={{ backgroundColor: NAVY }}>
            <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-3">
              <TotalCell label="Valor total del proyecto" value={fmtCop(pres.valorTotal)} big />
              <TotalCell label="Total de acciones de formación" value={fmtNum(pres.numeroAFs || afs.length)} />
              <TotalCell label="Beneficiarios de las AF" value={fmtNum(pres.beneficiarios || kpis.beneficiarios)} />
              <TotalCell label="Total cofinanciación SENA" value={fmtCop(pres.cofinanciacionSena)} sub={pct(pctTotSena)} />
              <TotalCell label="Total contrapartida especie" value={fmtCop(pres.contrapartidaEspecie)} sub={pct(pctTotEspecie)} />
              <TotalCell label="Total contrapartida dinero" value={fmtCop(pres.contrapartidaDinero)} sub={pct(pctTotDinero)} />
            </div>
          </div>

          <div className="mt-5">
            <SubHeader icon={BookOpen}>Acciones de formación (sin G.O. ni transferencia)</SubHeader>
            <BucketTable concepto="Acción de formación" rows={afsRows} />
          </div>

          <div className="mt-5">
            <SubHeader icon={FileText}>Gastos de operación</SubHeader>
            <BucketTable concepto="Concepto" rows={goRows} minW={640} />
            <p className="mt-2 text-[11px] italic text-neutral-400">
              % sobre las AF: {pct(pctGO)} · tope permitido: {topeGO}%{pctGO > topeGO ? ' — supera el tope' : ''}
            </p>
          </div>

          <div className="mt-5">
            <SubHeader icon={Coins}>Transferencia de conocimiento</SubHeader>
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">Beneficiarios de transferencia: <b>{fmtNum(pres.beneficiariosTransferencia)}</b></span>
              <span className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">% de beneficiarios: <b>{pct(pctTransfBenef)}</b></span>
              <span className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">% del total (AF + G.O.): <b>{pct(pctTransfValor)}</b></span>
            </div>
            <BucketTable concepto="Concepto" rows={transRows} minW={640} />
          </div>

          <div className="mt-5">
            <SubHeader icon={Wallet}>Sumas generales del proyecto</SubHeader>
            <BucketTable concepto="Concepto" rows={totalRows} minW={640} />
          </div>

          {resumenRubros.length > 0 && (
            <div className="mt-5">
              <SubHeader icon={ListChecks}>Resumen de rubros del proyecto</SubHeader>
              <BucketTable concepto="Rubro" rows={resumenRows} />
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <a
              href="#inicio-proyecto"
              onClick={(e) => { e.preventDefault(); scrollToId('inicio-proyecto') }}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 shadow-sm transition-colors hover:border-green-500 hover:bg-green-50"
            >
              <ArrowUp size={16} /> Ir al inicio del proyecto
            </a>
          </div>
        </Section>

        <p className="no-print pt-2 text-center text-xs text-neutral-400">
          Reporte generado en vista previa desde el formulador · SEP — SENA. El proyecto aún no ha sido importado.
        </p>
      </div>
    </div>
  )
}

function ContactoBloque({ titulo, c }: { titulo: string; c: { tipo: string; nombre: string; email: string; telefono: string; id: string } }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-900" style={{ color: NAVY }}>{titulo}</p>
      <div className="space-y-2.5">
        <Field label="Nombre completo" value={txt(c.nombre)} />
        <Field label="Identificación" value={[txt(c.tipo), txt(c.id)].filter(Boolean).join(' · ')} />
        <Field label="Correo electrónico" value={txt(c.email)} />
        <Field label="Teléfono / celular" value={txt(c.telefono)} />
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

function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page { size: letter; margin: 8mm; }
        aside, header, nav, .no-print { display: none !important; }
        /* el h-screen + overflow del layout recorta la impresión a una sola página */
        html, body { height: auto !important; overflow: visible !important; }
        .h-screen.overflow-hidden { height: auto !important; overflow: visible !important; }
        .flex.flex-col.flex-1.min-w-0.overflow-hidden { height: auto !important; overflow: visible !important; }
        main.overflow-y-auto, main.flex-1 { height: auto !important; max-height: none !important; overflow: visible !important; flex: none !important; }
        .reporte-preview, .reporte-preview * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .reporte-preview { background: #fff !important; min-height: 0 !important; }
        .reporte-doc { max-width: 100% !important; padding: 0 !important; gap: 10px !important; }
        /* en modo oscuro las reglas globales invierten bg/text con !important */
        html[data-dark-mode="true"] .reporte-preview,
        html[data-dark-mode="true"] .reporte-preview .bg-white { background: #fff !important; }
        html[data-dark-mode="true"] .reporte-preview .bg-neutral-50 { background: #fafafa !important; }
        html[data-dark-mode="true"] .reporte-preview .text-neutral-900 { color: #171717 !important; }
        html[data-dark-mode="true"] .reporte-preview .text-neutral-800 { color: #262626 !important; }
        html[data-dark-mode="true"] .reporte-preview .text-neutral-700 { color: #404040 !important; }
        html[data-dark-mode="true"] .reporte-preview .text-neutral-600 { color: #525252 !important; }
        html[data-dark-mode="true"] .reporte-preview .text-neutral-500 { color: #737373 !important; }
        /* las filas deben poder partirse: si no, una justificación alta deja hojas casi vacías */
        .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        .section-bar { break-after: avoid; page-break-after: avoid; }
        thead { display: table-header-group; } /* la cabecera se repite en cada página */
        tr, td, th { break-inside: auto !important; page-break-inside: auto !important; }
        /* las tablas anchas deben caber completas en la hoja, sin recortes a la derecha */
        .table-wrap, .wide-table { overflow: visible !important; border: 0 !important; }
        .table-wrap table, .wide-table table { min-width: 0 !important; width: 100% !important; table-layout: fixed !important; font-size: 6pt !important; }
        .table-wrap th, .table-wrap td, .wide-table th, .wide-table td { overflow-wrap: anywhere !important; word-break: break-word !important; white-space: normal !important; padding: 1.5px 4px !important; vertical-align: top; }
        .table-wrap tbody .text-right, .wide-table tbody .text-right { white-space: nowrap !important; word-break: keep-all !important; overflow-wrap: normal !important; }
        section { box-shadow: none !important; }
      }
    `}</style>
  )
}
