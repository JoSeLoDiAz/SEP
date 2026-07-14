'use client'

import api from '@/lib/api'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  ArrowLeft, BadgeCheck, BarChart3, BookOpen, Clock, Coins, Download, FileText, Loader2, MapPin, Search, Trash2, Users2, Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ReportePreview } from '@/components/importar/reporte-preview'
import { ReporteConvocatoria } from '@/components/convocatoria/reporte-convocatoria'
import type { PreviewImportacion } from '@/lib/types/importar-proyecto'

const NAVY = '#00304D'

interface Conv { id: number; nombre: string; anio: number; guardados: number }
interface Grupo { clave: string; afs: number; proyectos: number; beneficiarios: number; cofinSena: number; valorTotal: number }
interface CobGrupo { clave: string; beneficiarios: number; afs: number }
interface Presupuesto {
  valorAFs: number; gastosOperacion: number; valorTransferencia: number; beneficiariosTransferencia: number
  cofinanciacionSena: number; contrapartidaEspecie: number; contrapartidaDinero: number; valorTotal: number; beneficiarios: number
  pctGO: number; topeGO: number; pctTransfValor: number; pctTransfBenef: number
}
interface Analitica {
  totales: {
    proyectos: number; afs: number; unidades: number; grupos: number; beneficiarios: number; valorTotal: number; cofinSena: number
    especie: number; dinero: number; gastosOperacion: number; transferencia: number
  }
  porEvento: Grupo[]; porModalidad: Grupo[]; porProponente: Grupo[]
  presupuesto: Presupuesto
  porDepartamento: CobGrupo[]; porCiudad: CobGrupo[]
}
interface Fila {
  id: number; nit: string; razonSocial: string; nombreProyecto: string; modalidad: string
  numAF: number; numBenef: number; valorTotal: number; cofinSena: number; fechaGuardado: string
}
interface Acc {
  guardadoId: number; nit: string; proponente: string; proyecto: string
  consecutivo: number; nombre: string; evento: string; modalidad: string; metodologia: string
  grupos: number; beneficiarios: number; horas: number; uts: number
  valorAF: number; gastosOperacion: number; transferencia: number; valorTotal: number; cofinSena: number
}

const fmtCop = (v: number) => (v ?? 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const fmtNum = (v: number) => (v ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })

export default function ConvocatoriaProyectosPage() {
  const [convs, setConvs] = useState<Conv[]>([])
  const [convId, setConvId] = useState<number | ''>('')
  const [proponente, setProponente] = useState('')
  const [evento, setEvento] = useState('')
  const [modalidad, setModalidad] = useState('')

  const [analitica, setAnalitica] = useState<Analitica | null>(null)
  const [lista, setLista] = useState<Fila[]>([])
  const [acciones, setAcciones] = useState<Acc[]>([])
  const [busqAf, setBusqAf] = useState('')
  const [cargando, setCargando] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [verPreview, setVerPreview] = useState<PreviewImportacion | null>(null)
  const [reporteConv, setReporteConv] = useState(false)
  const [abriendo, setAbriendo] = useState<string | null>(null)
  const reqRef = useRef(0)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    api.get<Conv[]>('/admin/convocatoria-proyectos/convocatorias')
      .then(r => {
        const list = r.data ?? []
        setConvs(list)
        // Por defecto la convocatoria con proyectos guardados más reciente (o la 1.ª).
        const conGuardados = list.find(c => c.guardados > 0)
        setConvId((conGuardados ?? list[0])?.id ?? '')
      })
      .catch(() => setConvs([]))
  }, [])

  const consultar = useCallback(async () => {
    const myReq = ++reqRef.current // guardia: solo la última consulta puede pintar
    setCargando(true)
    try {
      const params = {
        convocatoriaId: convId || undefined,
        proponente: proponente.trim() || undefined,
        evento: evento.trim() || undefined,
        modalidad: modalidad.trim() || undefined,
      }
      const [a, l, ac] = await Promise.all([
        api.get<Analitica>('/admin/convocatoria-proyectos/analitica', { params }),
        api.get<Fila[]>('/admin/convocatoria-proyectos', { params: { convocatoriaId: convId || undefined, q: proponente.trim() || undefined } }),
        api.get<Acc[]>('/admin/convocatoria-proyectos/acciones', { params }),
      ])
      if (reqRef.current !== myReq) return // llegó una respuesta obsoleta: la ignoramos
      setAnalitica(a.data)
      setLista(l.data ?? [])
      setAcciones(ac.data ?? [])
    } catch {
      if (reqRef.current === myReq) setToast({ tipo: 'error', msg: 'No se pudo cargar la analítica' })
    } finally {
      if (reqRef.current === myReq) setCargando(false)
    }
  }, [convId, proponente, evento, modalidad])

  // Recargar al cambiar de convocatoria.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (convId !== '') consultar() }, [convId])

  async function descargar() {
    setDescargando(true)
    try {
      const res = await api.get('/admin/convocatoria-proyectos/export', {
        params: {
          convocatoriaId: convId || undefined,
          proponente: proponente.trim() || undefined,
          evento: evento.trim() || undefined,
          modalidad: modalidad.trim() || undefined,
        },
        responseType: 'blob',
        timeout: 120_000,
      })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'sabana-convocatoria.xlsx'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch {
      setToast({ tipo: 'error', msg: 'No se pudo descargar la sábana' })
    } finally {
      setDescargando(false)
    }
  }

  async function verReporte(id: number, key: string) {
    setAbriendo(key)
    try {
      const res = await api.get<PreviewImportacion>(`/admin/convocatoria-proyectos/${id}`)
      setVerPreview(res.data)
    } catch {
      setToast({ tipo: 'error', msg: 'No se pudo abrir el reporte' })
    } finally {
      setAbriendo(null)
    }
  }

  async function eliminar(id: number) {
    if (!confirm('¿Eliminar este proyecto guardado? Esta acción no se puede deshacer.')) return
    try {
      await api.delete(`/admin/convocatoria-proyectos/${id}`)
      setToast({ tipo: 'success', msg: 'Proyecto eliminado' })
      consultar()
    } catch {
      setToast({ tipo: 'error', msg: 'No se pudo eliminar' })
    }
  }

  if (verPreview) {
    return <ReportePreview preview={verPreview} onVolver={() => setVerPreview(null)} />
  }

  const convNombre = convs.find(c => c.id === convId)?.nombre ?? 'Todas las convocatorias'
  if (reporteConv && analitica) {
    return (
      <ReporteConvocatoria
        convocatoria={convNombre}
        totales={analitica.totales}
        presupuesto={analitica.presupuesto}
        porEvento={analitica.porEvento}
        porModalidad={analitica.porModalidad}
        porProponente={analitica.porProponente}
        porDepartamento={analitica.porDepartamento}
        porCiudad={analitica.porCiudad}
        proyectos={lista}
        acciones={acciones}
        onVolver={() => setReporteConv(false)}
      />
    )
  }

  const t = analitica?.totales
  const pr = analitica?.presupuesto
  const qAf = busqAf.trim().toLowerCase()
  const accionesFiltradas = qAf
    ? acciones.filter(a => `${a.nombre} ${a.proyecto} ${a.proponente} ${a.evento} ${a.nit}`.toLowerCase().includes(qAf))
    : acciones

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-7 xl:p-10">
      {toast && (
        <ToastBetowa show onClose={() => setToast(null)} tipo={toast.tipo}
          titulo={toast.tipo === 'success' ? 'Listo' : 'Error'} mensaje={toast.msg} duration={3500} />
      )}

      {/* Encabezado */}
      <div className="flex items-center gap-3 rounded-2xl px-6 py-4" style={{ backgroundColor: NAVY }}>
        <BarChart3 size={22} className="text-white" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Administración</p>
          <h1 className="text-base font-bold text-white sm:text-lg">Reporte de proyectos guardados de la convocatoria</h1>
        </div>
        <button onClick={() => setReporteConv(true)} disabled={!analitica}
          className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/25 disabled:opacity-50">
          <FileText size={16} /> Reporte de la convocatoria
        </button>
        <Link href="/panel/admin/importar-proyecto"
          className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20">
          <ArrowLeft size={16} /> Importar
        </Link>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Convocatoria</span>
            <select value={convId} onChange={e => setConvId(e.target.value ? Number(e.target.value) : '')}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-green-500">
              <option value="">Todas</option>
              {convs.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.guardados})</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Proponente</span>
            <input value={proponente} onChange={e => setProponente(e.target.value)} placeholder="Razón social o NIT"
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-green-500" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Evento</span>
            <input value={evento} onChange={e => setEvento(e.target.value)} placeholder="Curso, taller, foro…"
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-green-500" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Modalidad</span>
            <input value={modalidad} onChange={e => setModalidad(e.target.value)} placeholder="Presencial, virtual…"
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-green-500" />
          </label>
          <div className="flex items-end gap-2">
            <button onClick={consultar} disabled={cargando}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: NAVY }}>
              {cargando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Consultar
            </button>
            <button onClick={descargar} disabled={descargando}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#39a900] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2f8c00] disabled:opacity-50"
              title="Descargar sábana Excel (respeta los filtros)">
              {descargando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Excel
            </button>
          </div>
        </div>
      </div>

      {/* Resumen / KPIs */}
      {t && pr && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-4">
          <Kpi icon={FileText} label="Proyectos" value={fmtNum(t.proyectos)} sub={`${fmtNum(t.afs)} AF · ${fmtNum(t.unidades)} UT`} />
          <Kpi icon={Users2} label="Beneficiarios" value={fmtNum(pr.beneficiarios)} sub={`${fmtNum(pr.beneficiariosTransferencia)} de transferencia`} />
          <Kpi icon={Coins} label="Cofinanciación SENA" value={fmtCop(pr.cofinanciacionSena)} sub={pr.valorTotal > 0 ? `${((pr.cofinanciacionSena / pr.valorTotal) * 100).toFixed(1)}% del total` : undefined} money />
          <Kpi icon={Wallet} label="Valor total del programa" value={fmtCop(pr.valorTotal)} money />
        </div>
      )}

      {/* Entregas recientes */}
      {lista.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Clock size={16} className="text-green-600" />
            <h2 className="text-sm font-bold" style={{ color: NAVY }}>Entregas recientes · últimos proyectos cargados</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lista.slice(0, 6).map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => verReporte(f.id, `ent-${f.id}`)}
                disabled={abriendo === `ent-${f.id}`}
                className="rounded-xl border border-neutral-200 bg-white p-3.5 text-left shadow-sm transition-colors hover:border-green-500 hover:bg-green-50 disabled:opacity-50"
              >
                <p className="truncate text-sm font-bold text-neutral-900">{f.razonSocial || '—'}</p>
                <p className="truncate text-xs text-neutral-500">{f.nombreProyecto || '—'}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                  <span className="inline-flex items-center gap-1">{abriendo === `ent-${f.id}` ? <Loader2 size={11} className="animate-spin" /> : <Clock size={11} />} {f.fechaGuardado}</span>
                  <span className="font-semibold text-neutral-700">{fmtNum(f.numAF)} AF · {fmtCop(f.valorTotal)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bolsas de cofinanciación y topes */}
      {pr && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <BolsaCard icon={BookOpen} titulo="Valor de las acciones de formación" valor={fmtCop(pr.valorAFs)} rows={[
            ['Cofinanciación SENA', fmtCop(pr.cofinanciacionSena)],
            ['Contrapartida especie', fmtCop(pr.contrapartidaEspecie)],
            ['Contrapartida dinero', fmtCop(pr.contrapartidaDinero)],
          ]} />
          <BolsaCard icon={FileText} titulo="Gastos de operación" valor={fmtCop(pr.gastosOperacion)} alerta={pr.pctGO > pr.topeGO} rows={[
            ['% sobre las AF', `${pr.pctGO.toFixed(2)}%`],
            ['Tope permitido', `${pr.topeGO}%`],
            ['Estado', pr.pctGO > pr.topeGO ? '⚠ Supera el tope' : '✓ Dentro del tope'],
          ]} />
          <BolsaCard icon={BadgeCheck} titulo="Transferencia de conocimiento" valor={fmtCop(pr.valorTransferencia)} rows={[
            ['Beneficiarios de transferencia', fmtNum(pr.beneficiariosTransferencia)],
            ['% de beneficiarios (mín. 5%)', `${pr.pctTransfBenef.toFixed(2)}%`],
            ['% del total AF+G.O. (mín. 1%)', `${pr.pctTransfValor.toFixed(2)}%`],
          ]} />
        </div>
      )}

      {/* Desgloses */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Desglose titulo="Por evento" col="Evento" rows={analitica?.porEvento ?? []} />
        <Desglose titulo="Por modalidad" col="Modalidad" rows={analitica?.porModalidad ?? []} />
      </div>
      <Desglose titulo="Por proponente (quién solicita más cofinanciación)" col="Proponente" rows={analitica?.porProponente ?? []} proponente />

      {/* Cobertura territorial */}
      {analitica && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <MapPin size={16} className="text-green-600" />
            <h2 className="text-sm font-bold" style={{ color: NAVY }}>Cobertura territorial · dónde se benefician las acciones de formación</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CobTabla titulo="Por departamento" col="Departamento" rows={analitica.porDepartamento ?? []} />
            <CobTabla titulo="Por ciudad / municipio" col="Ciudad / municipio" rows={analitica.porCiudad ?? []} />
          </div>
        </div>
      )}

      {/* Acciones de formación (todas) */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-5 py-3">
          <h2 className="text-sm font-bold" style={{ color: NAVY }}>Acciones de formación ({accionesFiltradas.length})</h2>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input value={busqAf} onChange={e => setBusqAf(e.target.value)} placeholder="Buscar AF, proyecto, proponente…"
              className="w-64 max-w-full rounded-lg border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-sm text-neutral-700 outline-none focus:border-green-500" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-[13px]">
            <thead>
              <tr>
                {['AF', 'Acción de formación', 'Proyecto / proponente', 'Evento', 'Modalidad', 'Grupos', 'Benef.', 'UT', 'Valor total AF', 'Cofin. SENA', ''].map((h, i) => (
                  <th key={i} className={`border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-600 ${i >= 5 && i <= 9 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accionesFiltradas.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-6 text-center text-sm italic text-neutral-400">No hay acciones de formación con estos filtros.</td></tr>
              ) : accionesFiltradas.map((a, i) => (
                <tr key={`${a.guardadoId}-${a.consecutivo}-${i}`} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-3 py-2 text-center font-bold text-neutral-700">{a.consecutivo}</td>
                  <td className="px-3 py-2 font-medium text-neutral-900">{a.nombre || '—'}</td>
                  <td className="px-3 py-2 text-neutral-600">
                    <span className="block">{a.proyecto || '—'}</span>
                    <span className="block text-[11px] text-neutral-400">{a.proponente || '—'}{a.nit ? ` · ${a.nit}` : ''}</span>
                  </td>
                  <td className="px-3 py-2 text-neutral-700">{a.evento || '—'}</td>
                  <td className="px-3 py-2 text-neutral-700">{a.modalidad || '—'}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(a.grupos)}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(a.beneficiarios)}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(a.uts)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmtCop(a.valorTotal)}</td>
                  <td className="px-3 py-2 text-right">{fmtCop(a.cofinSena)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => verReporte(a.guardadoId, `af-${a.guardadoId}`)} disabled={abriendo === `af-${a.guardadoId}`}
                      className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-700 transition-colors hover:border-green-500 hover:bg-green-50 disabled:opacity-50">
                      {abriendo === `af-${a.guardadoId}` ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lista de proyectos guardados */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-3">
          <h2 className="text-sm font-bold" style={{ color: NAVY }}>Proyectos guardados ({lista.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[13px]">
            <thead>
              <tr>
                {['NIT', 'Razón social', 'Proyecto', 'AF', 'Benef.', 'Valor total', 'Cofin. SENA', 'Guardado', ''].map((h, i) => (
                  <th key={i} className={`border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-600 ${i >= 3 && i <= 6 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-sm italic text-neutral-400">No hay proyectos guardados con estos filtros.</td></tr>
              ) : lista.map(f => (
                <tr key={f.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-3 py-2 font-mono text-neutral-700">{f.nit || '—'}</td>
                  <td className="px-3 py-2 font-medium text-neutral-900">{f.razonSocial || '—'}</td>
                  <td className="px-3 py-2 text-neutral-700">{f.nombreProyecto || '—'}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(f.numAF)}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(f.numBenef)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmtCop(f.valorTotal)}</td>
                  <td className="px-3 py-2 text-right">{fmtCop(f.cofinSena)}</td>
                  <td className="px-3 py-2 text-neutral-500">{f.fechaGuardado}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => verReporte(f.id, `proy-${f.id}`)} disabled={abriendo === `proy-${f.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-700 transition-colors hover:border-green-500 hover:bg-green-50 disabled:opacity-50">
                        {abriendo === `proy-${f.id}` ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} Ver reporte
                      </button>
                      <button onClick={() => eliminar(f.id)} title="Eliminar"
                        className="inline-flex items-center rounded-md border border-neutral-200 p-1.5 text-neutral-400 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, sub, money }: { icon: LucideIcon; label: string; value: string; sub?: string; money?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-green-50 text-green-600"><Icon size={18} /></span>
      <div className="min-w-0">
        <p className={`font-extrabold leading-tight text-neutral-900 ${money ? 'text-[13px]' : 'text-base'}`}>{value}</p>
        <p className="truncate text-[11px] font-medium text-neutral-500">{label}</p>
        {sub && <p className="truncate text-[11px] font-semibold text-green-600">{sub}</p>}
      </div>
    </div>
  )
}

function BolsaCard({ icon: Icon, titulo, valor, rows, alerta }: {
  icon: LucideIcon; titulo: string; valor: string; rows: [string, string][]; alerta?: boolean
}) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${alerta ? 'border-red-200 bg-red-50/40' : 'border-neutral-200 bg-white'}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-lg ${alerta ? 'bg-red-100 text-red-600' : 'bg-green-50 text-green-600'}`}><Icon size={18} /></span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-neutral-500">{titulo}</p>
          <p className="text-base font-extrabold" style={{ color: NAVY }}>{valor}</p>
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

function CobTabla({ titulo, col, rows }: { titulo: string; col: string; rows: CobGrupo[] }) {
  const total = rows.reduce((a, r) => a + (r.beneficiarios ?? 0), 0)
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-5 py-3"><h2 className="text-sm font-bold" style={{ color: NAVY }}>{titulo}</h2></div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-600">{col}</th>
              <th className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-neutral-600">AF</th>
              <th className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-neutral-600">Beneficiarios</th>
              <th className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-neutral-600">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={4} className="px-3 py-5 text-center text-sm italic text-neutral-400">Sin cobertura registrada.</td></tr>
              : rows.map((r, i) => (
                  <tr key={`${r.clave}-${i}`} className="border-b border-neutral-100">
                    <td className="px-3 py-2 font-medium text-neutral-900">{r.clave}</td>
                    <td className="px-3 py-2 text-right text-neutral-700">{fmtNum(r.afs)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtNum(r.beneficiarios)}</td>
                    <td className="px-3 py-2 text-right text-neutral-400">{total > 0 ? `${((r.beneficiarios / total) * 100).toFixed(1)}%` : '0%'}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Desglose({ titulo, col, rows, proponente }: { titulo: string; col: string; rows: Grupo[]; proponente?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-5 py-3">
        <h2 className="text-sm font-bold" style={{ color: NAVY }}>{titulo}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-600">{col}</th>
              {proponente && <th className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-neutral-600">Proy.</th>}
              <th className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-neutral-600">AF</th>
              <th className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-neutral-600">Benef.</th>
              <th className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-neutral-600">Cofin. SENA</th>
              <th className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-neutral-600">Valor total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={proponente ? 6 : 5} className="px-3 py-6 text-center text-sm italic text-neutral-400">Sin datos.</td></tr>
            ) : rows.map((g, i) => (
              <tr key={`${g.clave}-${i}`} className="border-b border-neutral-100">
                <td className="px-3 py-2 font-medium text-neutral-900">{g.clave}</td>
                {proponente && <td className="px-3 py-2 text-right text-neutral-700">{fmtNum(g.proyectos)}</td>}
                <td className="px-3 py-2 text-right text-neutral-700">{fmtNum(g.afs)}</td>
                <td className="px-3 py-2 text-right text-neutral-700">{fmtNum(g.beneficiarios)}</td>
                <td className="px-3 py-2 text-right font-semibold text-neutral-900">{fmtCop(g.cofinSena)}</td>
                <td className="px-3 py-2 text-right text-neutral-700">{fmtCop(g.valorTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
