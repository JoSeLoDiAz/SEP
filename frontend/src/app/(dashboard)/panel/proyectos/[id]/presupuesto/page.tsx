'use client'

import { ProyectoTabs } from '@/components/proyecto-tabs'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import api from '@/lib/api'
import { fmtDateTimeFull } from '@/lib/format-date'
import {
  AlertTriangle, BarChart3, ChevronDown, ChevronRight,
  DollarSign,
  Layers, Loader2, PiggyBank, Save, Users, Wallet
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Fragment, useCallback, useEffect, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AfRow {
  afId: number; numero: number; nombre: string
  beneficiarios: number
  cofSena: number; porcSena: number
  contraEspecie: number; porcEspecie: number
  contraDinero: number; porcDinero: number
  total: number
}

interface RubroDetalle {
  afrubroid: number; rubroId: number; codigo: string; nombre: string; caso: number
  numHoras: number; cantidad: number; beneficiarios: number; dias: number
  totalRubro: number; cofSena: number; contraEspecie: number; contraDinero: number
  porcSena: number; porcEspecie: number; porcDinero: number
}

// Etiqueta de unidades según el caso del rubro (mismo patrón que rubros/page.tsx)
function unidadesLabel(r: RubroDetalle): string {
  if (r.caso === 8) {
    if (r.numHoras > 0 && r.beneficiarios > 0) return `${r.numHoras}h × ${r.beneficiarios} benef.`
    if (r.beneficiarios > 0) return `${r.beneficiarios} benef.`
    return '—'
  }
  if (r.caso === 3) return r.beneficiarios > 0 ? `${r.beneficiarios} benef.` : '—'
  if (r.numHoras > 0)      return `${r.numHoras} h`
  if (r.dias > 0)          return `${r.dias} d`
  if (r.cantidad > 0)      return `${r.cantidad} ${r.codigo?.trim().startsWith('R04') ? 'tiq.' : 'ud.'}`
  if (r.beneficiarios > 0) return `${r.beneficiarios} benef.`
  return '—'
}

// Valor unitario = totalRubro / cantidad de unidades (detecta por campo poblado)
function valorUnidad(r: RubroDetalle): number | null {
  if (!r.totalRubro || r.totalRubro <= 0) return null
  if (r.numHoras > 0 && r.beneficiarios > 0) return r.totalRubro / (r.numHoras * r.beneficiarios)
  if (r.numHoras > 0)      return r.totalRubro / r.numHoras
  if (r.dias > 0)          return r.totalRubro / r.dias
  if (r.cantidad > 0)      return r.totalRubro / r.cantidad
  if (r.beneficiarios > 0) return r.totalRubro / r.beneficiarios
  return null
}
interface GoRow {
  afId: number; numero: number; nombre: string
  cofSena: number; porcSena: number
  contraEspecie: number; porcEspecie: number
  contraDinero: number; porcDinero: number
  total: number
}
interface TransRow {
  afId: number; numero: number; nombre: string
  beneficiarios: number; porcBeneficiarios: number
  valor: number; porcValor: number
}

interface PresupuestoData {
  proyecto: { id: number; nombre: string; modalidadId: number; modalidad: string }
  afs: AfRow[]
  totalesAfs: {
    totalAfs: number; totalBeneficiarios: number
    totalCofSena: number; porcCofSena: number
    totalContraEspecie: number; porcContraEspecie: number
    totalContraDinero: number; porcContraDinero: number
    valorTotalAFs: number
  }
  go: {
    porAf: GoRow[]
    totalCofSena: number; porcCofSena: number
    totalContraEspecie: number; porcContraEspecie: number
    totalContraDinero: number; porcContraDinero: number
    total: number; porcSobreAFs: number
    topePermitido: number; codigo: string; mensaje: string
  }
  transferencia: {
    porAf: TransRow[]
    totalBeneficiarios: number; porcBeneficiarios: number
    totalValor: number; porcValor: number
  }
  totalProyecto: {
    cofSena: number; porcCofSena: number
    contraEspecie: number; porcContraEspecie: number
    contraDinero: number; porcContraDinero: number
    valorTotal: number
  }
  guardado: boolean
  fechaRegistro: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n ?? 0)
const pct = (n: number) => `${Number(n ?? 0).toFixed(2)}%`

// ══════════════════════════════════════════════════════════════════════════════

export default function PresupuestoProyectoPage() {
  const { id } = useParams<{ id: string }>()
  const proyectoId = Number(id)

  const [data, setData] = useState<PresupuestoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errores, setErrores] = useState<string[]>([])
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)
  const [toastK, setToastK] = useState(0)

  // Expansión por AF: detalle de rubros (excluye R09 GO y R015 Transferencia)
  const [expandedAfId, setExpandedAfId] = useState<number | null>(null)
  const [rubrosCache, setRubrosCache] = useState<Record<number, RubroDetalle[]>>({})
  const [loadingRubros, setLoadingRubros] = useState<number | null>(null)

  async function toggleExpandAf(afId: number) {
    if (expandedAfId === afId) { setExpandedAfId(null); return }
    setExpandedAfId(afId)
    if (!rubrosCache[afId]) {
      setLoadingRubros(afId)
      try {
        const r = await api.get<RubroDetalle[]>(`/proyectos/${proyectoId}/acciones/${afId}/rubros`)
        setRubrosCache(prev => ({ ...prev, [afId]: r.data }))
      } catch { showToast('error', 'Error cargando rubros de la AF') }
      finally { setLoadingRubros(null) }
    }
  }

  function showToast(tipo: 'success' | 'error', msg: string) {
    setToast({ tipo, msg })
    setToastK(k => k + 1)
  }

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get<PresupuestoData>(`/proyectos/${proyectoId}/presupuesto`)
      setData(r.data)
    } catch {
      showToast('error', 'Error cargando el presupuesto del proyecto')
    } finally {
      setLoading(false)
    }
  }, [proyectoId])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { document.title = 'Presupuesto del Proyecto | SEP' }, [])

  async function handleGuardar() {
    setErrores([])
    setSaving(true)
    try {
      const r = await api.post<{ message: string }>(`/proyectos/${proyectoId}/presupuesto/guardar`)
      showToast('success', r.data.message ?? 'Presupuesto guardado correctamente')
      await cargar()
    } catch (e: any) {
      const resp = e?.response?.data
      const errs: string[] = Array.isArray(resp?.errores) ? resp.errores
        : Array.isArray(resp?.message?.errores) ? resp.message.errores
        : []
      if (errs.length > 0) {
        setErrores(errs)
        showToast('error', 'No se pudo guardar — corrija los errores listados.')
      } else {
        showToast('error', resp?.message ?? 'Error al guardar el presupuesto')
      }
    } finally {
      setSaving(false)
    }
  }

  // Estilos compartidos
  const card = 'bg-white rounded-2xl border border-neutral-200 shadow-sm'
  const statBox = 'rounded-xl bg-neutral-50 border border-neutral-100 px-3 py-2.5 text-center'

  if (loading || !data) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-[#00304D]" size={32} />
    </div>
  )

  const { proyecto, afs, totalesAfs, go, transferencia, totalProyecto } = data

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa key={toastK} show onClose={() => setToast(null)}
          tipo={toast.tipo} titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg} duration={4500} />
      )}

      {/* Header */}
      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex flex-wrap items-center gap-3">
        <PiggyBank size={22} className="text-white flex-shrink-0" />
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 text-white/60 text-xs flex-wrap">
            <Link href="/panel/proyectos" className="hover:text-white transition">Proyectos</Link>
            <ChevronRight size={12} />
            <Link href={`/panel/proyectos/${proyectoId}`} className="hover:text-white transition truncate max-w-[200px]">{proyecto.nombre}</Link>
            <ChevronRight size={12} />
            <span>Presupuesto</span>
          </div>
          <h1 className="text-white font-bold text-sm">Presupuesto General del Proyecto</h1>
        </div>
        {data.guardado && data.fechaRegistro && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white text-[11px] font-semibold rounded-xl whitespace-nowrap">
            ✓ Guardado · {fmtDateTimeFull(data.fechaRegistro)}
          </span>
        )}
      </div>

      {/* Menú (uniforme) */}
      <ProyectoTabs proyectoId={proyectoId} active="presupuesto" />

      {/* Errores de validación */}
      {errores.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
            <AlertTriangle size={18} />
            <span>El presupuesto no se puede guardar — corrija lo siguiente:</span>
          </div>
          <ul className="flex flex-col gap-1.5 pl-1">
            {errores.map((er, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-red-200 text-red-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                {er}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Card 1 — Tabla AFs */}
      <div className={card}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100">
          <div className="w-8 h-8 rounded-xl bg-[#00304D] flex items-center justify-center flex-shrink-0">
            <Layers size={16} className="text-white" />
          </div>
          <h2 className="text-sm font-bold text-neutral-800">Acciones de Formación</h2>
          <span className="ml-auto text-xs text-neutral-400">{afs.length} AF{afs.length !== 1 ? 's' : ''}</span>
        </div>

        {afs.length === 0 ? (
          <div className="text-center py-10 text-neutral-400 text-sm">No hay acciones de formación con presupuesto registrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100">
                  <th className="text-left px-4 py-3 text-neutral-500 font-semibold whitespace-nowrap">Acción de Formación</th>
                  <th className="text-right px-3 py-3 text-neutral-500 font-semibold whitespace-nowrap">Beneficiarios</th>
                  <th className="text-right px-3 py-3 text-neutral-500 font-semibold whitespace-nowrap">Cofin. SENA</th>
                  <th className="text-right px-3 py-3 text-neutral-500 font-semibold">%</th>
                  <th className="text-right px-3 py-3 text-neutral-500 font-semibold whitespace-nowrap">C. Especie</th>
                  <th className="text-right px-3 py-3 text-neutral-500 font-semibold">%</th>
                  <th className="text-right px-3 py-3 text-neutral-500 font-semibold whitespace-nowrap">C. Dinero</th>
                  <th className="text-right px-3 py-3 text-neutral-500 font-semibold">%</th>
                  <th className="text-right px-4 py-3 text-neutral-500 font-semibold whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {afs.map(a => {
                  const isExpanded = expandedAfId === a.afId
                  const rubros = rubrosCache[a.afId] ?? []
                  return (
                  <Fragment key={a.afId}>
                    <tr onClick={() => toggleExpandAf(a.afId)}
                      className={`hover:bg-neutral-50 transition cursor-pointer ${isExpanded ? 'bg-neutral-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isExpanded
                            ? <ChevronDown size={14} className="text-[#00304D] flex-shrink-0" />
                            : <ChevronRight size={14} className="text-neutral-400 flex-shrink-0" />}
                          <div className="min-w-0">
                            <Link href={`/panel/proyectos/${proyectoId}/acciones/${a.afId}/rubros`}
                              onClick={e => e.stopPropagation()}
                              className="font-semibold text-[#00304D] hover:underline">AF {a.numero}</Link>
                            <div className="text-neutral-500 max-w-[300px] truncate">{a.nombre}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">{a.beneficiarios}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">{fmt(a.cofSena)}</td>
                      <td className="px-3 py-3 text-right text-neutral-400">{pct(a.porcSena)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">{fmt(a.contraEspecie)}</td>
                      <td className="px-3 py-3 text-right text-neutral-400">{pct(a.porcEspecie)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">{fmt(a.contraDinero)}</td>
                      <td className="px-3 py-3 text-right text-neutral-400">{pct(a.porcDinero)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#00304D] whitespace-nowrap">{fmt(a.total)}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-neutral-50/50">
                        <td colSpan={9} className="px-4 py-3">
                          {loadingRubros === a.afId ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="animate-spin text-[#00304D]" size={20} />
                            </div>
                          ) : rubros.length === 0 ? (
                            <p className="text-xs text-neutral-400 text-center py-3">Esta AF no tiene rubros registrados.</p>
                          ) : (
                            <div className="rounded-xl bg-white border border-neutral-200 overflow-hidden">
                              <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider px-4 py-2 bg-neutral-50 border-b border-neutral-100">
                                Rubros de la Acción de Formación {a.numero}
                                <span className="text-neutral-400 font-normal normal-case"> · excluye Gastos de Operación y Transferencia</span>
                              </p>
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="bg-white border-b border-neutral-100">
                                    <th className="text-left px-3 py-2 text-neutral-500 font-semibold">Rubro</th>
                                    <th className="text-right px-2 py-2 text-neutral-500 font-semibold whitespace-nowrap">Unidades</th>
                                    <th className="text-right px-2 py-2 text-neutral-500 font-semibold whitespace-nowrap">Valor Unidad</th>
                                    <th className="text-right px-2 py-2 text-neutral-500 font-semibold whitespace-nowrap">Cofin. SENA</th>
                                    <th className="text-right px-2 py-2 text-neutral-500 font-semibold">%</th>
                                    <th className="text-right px-2 py-2 text-neutral-500 font-semibold whitespace-nowrap">C. Especie</th>
                                    <th className="text-right px-2 py-2 text-neutral-500 font-semibold">%</th>
                                    <th className="text-right px-2 py-2 text-neutral-500 font-semibold whitespace-nowrap">C. Dinero</th>
                                    <th className="text-right px-2 py-2 text-neutral-500 font-semibold">%</th>
                                    <th className="text-right px-3 py-2 text-neutral-500 font-semibold whitespace-nowrap">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-50">
                                  {rubros.map(r => {
                                    const vu = valorUnidad(r)
                                    return (
                                    <tr key={r.afrubroid} className="hover:bg-neutral-50 transition">
                                      <td className="px-3 py-2">
                                        <div className="font-semibold text-[#00304D]">{r.codigo}</div>
                                        <div className="text-neutral-500 max-w-[260px] truncate">{r.nombre.replace(`${r.codigo} `, '')}</div>
                                      </td>
                                      <td className="px-2 py-2 text-right whitespace-nowrap text-neutral-700 font-medium">{unidadesLabel(r)}</td>
                                      <td className="px-2 py-2 text-right whitespace-nowrap text-neutral-600">{vu != null ? fmt(vu) : '—'}</td>
                                      <td className="px-2 py-2 text-right whitespace-nowrap">{fmt(r.cofSena ?? 0)}</td>
                                      <td className="px-2 py-2 text-right text-neutral-400">{pct(r.porcSena ?? 0)}</td>
                                      <td className="px-2 py-2 text-right whitespace-nowrap">{fmt(r.contraEspecie ?? 0)}</td>
                                      <td className="px-2 py-2 text-right text-neutral-400">{pct(r.porcEspecie ?? 0)}</td>
                                      <td className="px-2 py-2 text-right whitespace-nowrap">{fmt(r.contraDinero ?? 0)}</td>
                                      <td className="px-2 py-2 text-right text-neutral-400">{pct(r.porcDinero ?? 0)}</td>
                                      <td className="px-3 py-2 text-right font-bold text-[#00304D] whitespace-nowrap">{fmt(r.totalRubro ?? 0)}</td>
                                    </tr>
                                  )})}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )})}
              </tbody>
            </table>
          </div>
        )}

        {/* Totales generales de AFs */}
        <div className="p-5 border-t border-neutral-100">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Total General de las Acciones de Formación</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className={statBox}>
              <div className="text-xs text-neutral-500 mb-1">N° de AFs</div>
              <div className="font-bold text-[#00304D] text-sm">{totalesAfs.totalAfs}</div>
            </div>
            <div className={statBox}>
              <div className="text-xs text-neutral-500 mb-1">Total Beneficiarios</div>
              <div className="font-bold text-[#00304D] text-sm">{totalesAfs.totalBeneficiarios}</div>
            </div>
            <div className={statBox}>
              <div className="text-xs text-neutral-500 mb-1">Cofin. SENA</div>
              <div className="font-bold text-[#00304D] text-sm">{fmt(totalesAfs.totalCofSena)}</div>
              <div className="text-[11px] text-neutral-400">{pct(totalesAfs.porcCofSena)}</div>
            </div>
            <div className={statBox}>
              <div className="text-xs text-neutral-500 mb-1">Contra. Especie</div>
              <div className="font-bold text-[#00304D] text-sm">{fmt(totalesAfs.totalContraEspecie)}</div>
              <div className="text-[11px] text-neutral-400">{pct(totalesAfs.porcContraEspecie)}</div>
            </div>
            <div className={statBox}>
              <div className="text-xs text-neutral-500 mb-1">Contra. Dinero</div>
              <div className="font-bold text-[#00304D] text-sm">{fmt(totalesAfs.totalContraDinero)}</div>
              <div className="text-[11px] text-neutral-400">{pct(totalesAfs.porcContraDinero)}</div>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-[#00304D] text-white px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase">Valor Total de las Acciones de Formación</span>
            <span className="text-base font-bold">{fmt(totalesAfs.valorTotalAFs)}</span>
          </div>
        </div>
      </div>

      {/* Card 2 — Gastos de Operación */}
      <div className={card}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100">
          <div className="w-8 h-8 rounded-xl bg-amber-700 flex items-center justify-center flex-shrink-0">
            <DollarSign size={16} className="text-white" />
          </div>
          <h2 className="text-sm font-bold text-neutral-800">Presupuesto Gastos de Operación</h2>
          <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold whitespace-nowrap">
            {go.codigo} · máx. {go.topePermitido}%
          </span>
        </div>

        <div className="px-6 py-4 border-b border-neutral-100 rounded-none bg-amber-50/30 text-xs text-amber-900 leading-relaxed">
          {go.mensaje}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-100">
                <th className="text-left px-4 py-3 text-neutral-500 font-semibold whitespace-nowrap">Acción de Formación</th>
                <th className="text-right px-3 py-3 text-neutral-500 font-semibold whitespace-nowrap">Cofin. SENA</th>
                <th className="text-right px-3 py-3 text-neutral-500 font-semibold">%</th>
                <th className="text-right px-3 py-3 text-neutral-500 font-semibold whitespace-nowrap">C. Especie</th>
                <th className="text-right px-3 py-3 text-neutral-500 font-semibold">%</th>
                <th className="text-right px-3 py-3 text-neutral-500 font-semibold whitespace-nowrap">C. Dinero</th>
                <th className="text-right px-3 py-3 text-neutral-500 font-semibold">%</th>
                <th className="text-right px-4 py-3 text-neutral-500 font-semibold whitespace-nowrap">Total GO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {go.porAf.map(g => (
                <tr key={g.afId} className="hover:bg-neutral-50 transition">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-[#00304D]">AF {g.numero}</span>
                    <div className="text-neutral-500 max-w-[300px] truncate">{g.nombre}</div>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">{fmt(g.cofSena)}</td>
                  <td className="px-3 py-3 text-right text-neutral-400">{pct(g.porcSena)}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">{fmt(g.contraEspecie)}</td>
                  <td className="px-3 py-3 text-right text-neutral-400">{pct(g.porcEspecie)}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">{fmt(g.contraDinero)}</td>
                  <td className="px-3 py-3 text-right text-neutral-400">{pct(g.porcDinero)}</td>
                  <td className="px-4 py-3 text-right font-bold text-[#00304D] whitespace-nowrap">{fmt(g.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-5 border-t border-neutral-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className={statBox}>
              <div className="text-xs text-neutral-500 mb-1">Cofin. SENA</div>
              <div className="font-bold text-[#00304D] text-sm">{fmt(go.totalCofSena)}</div>
              <div className="text-[11px] text-neutral-400">{pct(go.porcCofSena)}</div>
            </div>
            <div className={statBox}>
              <div className="text-xs text-neutral-500 mb-1">C. Especie</div>
              <div className="font-bold text-[#00304D] text-sm">{fmt(go.totalContraEspecie)}</div>
              <div className="text-[11px] text-neutral-400">{pct(go.porcContraEspecie)}</div>
            </div>
            <div className={statBox}>
              <div className="text-xs text-neutral-500 mb-1">C. Dinero</div>
              <div className="font-bold text-[#00304D] text-sm">{fmt(go.totalContraDinero)}</div>
              <div className="text-[11px] text-neutral-400">{pct(go.porcContraDinero)}</div>
            </div>
            <div className={statBox}>
              <div className="text-xs text-neutral-500 mb-1">Total GO</div>
              <div className="font-bold text-[#00304D] text-sm">{fmt(go.total)}</div>
            </div>
            <div className={`${statBox} ${go.porcSobreAFs > go.topePermitido ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="text-xs text-neutral-500 mb-1">% sobre AFs</div>
              <div className={`font-bold text-sm ${go.porcSobreAFs > go.topePermitido ? 'text-red-700' : 'text-amber-700'}`}>{pct(go.porcSobreAFs)}</div>
              <div className="text-[11px] text-neutral-400">tope {go.topePermitido}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3 — Transferencia */}
      <div className={card}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100">
          <div className="w-8 h-8 rounded-xl bg-teal-700 flex items-center justify-center flex-shrink-0">
            <Users size={16} className="text-white" />
          </div>
          <h2 className="text-sm font-bold text-neutral-800">Presupuesto Transferencia de Conocimiento y Tecnología</h2>
          <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-[11px] font-semibold whitespace-nowrap">
            R015 · mín. 5% benef · 1% valor
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-100">
                <th className="text-left px-4 py-3 text-neutral-500 font-semibold whitespace-nowrap">Acción de Formación</th>
                <th className="text-right px-3 py-3 text-neutral-500 font-semibold whitespace-nowrap">N° Beneficiarios</th>
                <th className="text-right px-3 py-3 text-neutral-500 font-semibold">% benef.</th>
                <th className="text-right px-3 py-3 text-neutral-500 font-semibold whitespace-nowrap">Valor Transferencia</th>
                <th className="text-right px-4 py-3 text-neutral-500 font-semibold">% valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {transferencia.porAf.map(t => (
                <tr key={t.afId} className="hover:bg-neutral-50 transition">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-[#00304D]">AF {t.numero}</span>
                    <div className="text-neutral-500 max-w-[300px] truncate">{t.nombre}</div>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">{t.beneficiarios}</td>
                  <td className="px-3 py-3 text-right text-neutral-400">{pct(t.porcBeneficiarios)}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">{fmt(t.valor)}</td>
                  <td className="px-4 py-3 text-right text-neutral-400">{pct(t.porcValor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-5 border-t border-neutral-100">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={statBox}>
              <div className="text-xs text-neutral-500 mb-1">N° Beneficiarios</div>
              <div className="font-bold text-[#00304D] text-sm">{transferencia.totalBeneficiarios}</div>
            </div>
            <div className={`${statBox} ${transferencia.porcBeneficiarios < 5 ? 'bg-red-50 border-red-200' : 'bg-teal-50 border-teal-200'}`}>
              <div className="text-xs text-neutral-500 mb-1">% Benef. del Proyecto</div>
              <div className={`font-bold text-sm ${transferencia.porcBeneficiarios < 5 ? 'text-red-700' : 'text-teal-700'}`}>{pct(transferencia.porcBeneficiarios)}</div>
              <div className="text-[11px] text-neutral-400">mín. 5%</div>
            </div>
            <div className={statBox}>
              <div className="text-xs text-neutral-500 mb-1">Valor Transferencia</div>
              <div className="font-bold text-[#00304D] text-sm">{fmt(transferencia.totalValor)}</div>
            </div>
            <div className={`${statBox} ${transferencia.porcValor < 1 ? 'bg-red-50 border-red-200' : 'bg-teal-50 border-teal-200'}`}>
              <div className="text-xs text-neutral-500 mb-1">% del Total AFs</div>
              <div className={`font-bold text-sm ${transferencia.porcValor < 1 ? 'text-red-700' : 'text-teal-700'}`}>{pct(transferencia.porcValor)}</div>
              <div className="text-[11px] text-neutral-400">mín. 1%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Card 4 — Presupuesto Total del Proyecto */}
      <div className={card}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100">
          <div className="w-8 h-8 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0">
            <BarChart3 size={16} className="text-white" />
          </div>
          <h2 className="text-sm font-bold text-neutral-800">Presupuesto Total del Proyecto</h2>
          <span className="ml-auto text-xs text-neutral-400">Modalidad: <strong className="text-[#00304D]">{proyecto.modalidad || '—'}</strong></span>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className={statBox}>
              <div className="text-xs text-neutral-500 mb-1">Cofin. SENA</div>
              <div className="font-bold text-[#00304D] text-sm">{fmt(totalProyecto.cofSena)}</div>
              <div className="text-[11px] text-neutral-400">{pct(totalProyecto.porcCofSena)}</div>
            </div>
            <div className={statBox}>
              <div className="text-xs text-neutral-500 mb-1">Contra. Especie</div>
              <div className="font-bold text-[#00304D] text-sm">{fmt(totalProyecto.contraEspecie)}</div>
              <div className="text-[11px] text-neutral-400">{pct(totalProyecto.porcContraEspecie)}</div>
            </div>
            <div className={statBox}>
              <div className="text-xs text-neutral-500 mb-1">Contra. Dinero</div>
              <div className="font-bold text-[#00304D] text-sm">{fmt(totalProyecto.contraDinero)}</div>
              <div className="text-[11px] text-neutral-400">{pct(totalProyecto.porcContraDinero)}</div>
            </div>
            <div className="rounded-xl bg-green-600 text-white px-4 py-3 flex flex-col justify-center items-center text-center">
              <div className="text-xs uppercase font-semibold mb-1">Valor Total del Proyecto</div>
              <div className="font-bold text-base">{fmt(totalProyecto.valorTotal)}</div>
              <div className="text-[10px] opacity-80">AFs + GO + Transferencia</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            <button onClick={handleGuardar} disabled={saving}
              className="inline-flex items-center gap-2 bg-[#00304D] hover:bg-[#004a76] text-white text-xs font-semibold px-5 py-2.5 rounded-xl disabled:opacity-50 transition">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar Presupuesto del Proyecto
            </button>
          </div>
        </div>
      </div>

      {/* Espaciador */}
      <div className="flex justify-end">
        <Link href={`/panel/proyectos/${proyectoId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-neutral-200 text-[#00304D] text-xs font-semibold rounded-xl hover:bg-[#00304D] hover:text-white transition">
          <Wallet size={13} /> Volver al Proyecto
        </Link>
      </div>
    </div>
  )
}
