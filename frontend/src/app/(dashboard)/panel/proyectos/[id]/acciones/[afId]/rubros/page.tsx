'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import { NumberInput } from '@/components/ui/number-input'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  AlertTriangle, ArrowRightCircle, BookOpen, CheckCircle2, ChevronRight, ChevronUp,
  ClipboardList, DollarSign, FolderKanban, Layers, Loader2, LogOut, Plus, Save, Trash2, X,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AFInfo {
  afId: number; numero: number; nombre: string; modalidadId: number; modalidad: string
  numTotHorasGrup: number; numGrupos: number; numBenef: number
}

interface Proyecto { proyectoId: number; nombre: string; estado: number | null; convocatoriaEstado: number }

interface RubroCat {
  rubroId: number; codigo: string; nombre: string; descripcion: string
  tope: number; paquete: string; caso: number; perfilUt: number
  rubroAf: number; rubroProyecto: number
}

interface RubroAF {
  afrubroid: number; rubroId: number; codigo: string; nombre: string; paquete: string; caso: number
  justificacion: string; numHoras: number; cantidad: number; beneficiarios: number
  dias: number; numGrupos: number; totalRubro: number; cofSena: number
  contraEspecie: number; contraDinero: number; valorMaximo: number; valorBenef: number
  porcSena: number; porcEspecie: number; porcDinero: number
}

interface GOData { afrubroid?: number; cofSena: number; especie: number; dinero: number; total: number }
interface TransData { afrubroid?: number; beneficiarios: number; valor: number }

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n ?? 0)

const pct = (n: number) => `${Number(n ?? 0).toFixed(2)}%`

// Valor unitario — totalRubro / cantidad de unidades.
// Detecta la unidad por el campo poblado (no por el caso) para que también
// funcione con rubros abiertos como R04 (tiquetes) que no tienen caso 1-4/8.
function valorUnidad(r: RubroAF): number | null {
  if (!r.totalRubro || r.totalRubro <= 0) return null
  if (r.numHoras > 0 && r.beneficiarios > 0) return r.totalRubro / (r.numHoras * r.beneficiarios)
  if (r.numHoras > 0)      return r.totalRubro / r.numHoras
  if (r.dias > 0)          return r.totalRubro / r.dias
  if (r.cantidad > 0)      return r.totalRubro / r.cantidad
  if (r.beneficiarios > 0) return r.totalRubro / r.beneficiarios
  return null
}

function unidadesLabel(r: RubroAF): string {
  // caso 8 (R07.2.2/R07.2.3): tarifa × horas × benef → mostrar ambos
  if (r.caso === 8) {
    if (r.numHoras > 0 && r.beneficiarios > 0) return `${r.numHoras}h × ${r.beneficiarios} benef.`
    if (r.beneficiarios > 0) return `${r.beneficiarios} benef.`
    return '—'
  }
  // caso 3 (R010): solo beneficiarios
  if (r.caso === 3) {
    return r.beneficiarios > 0 ? `${r.beneficiarios} benef.` : '—'
  }
  if (r.numHoras > 0)      return `${r.numHoras} h`
  if (r.dias > 0)          return `${r.dias} d`
  if (r.cantidad > 0)      return `${r.cantidad} ${r.codigo?.trim().startsWith('R04') ? 'tiq.' : 'ud.'}`
  if (r.beneficiarios > 0) return `${r.beneficiarios} benef.`
  return '—'
}

function camposVisibles(caso: number) {
  return {
    // caso 8 (R07.2.2 / R07.2.3) pide horas Y beneficiarios → tope × horas × benef
    horas:    [1, 8].includes(caso),
    dias:     [4].includes(caso),
    unidades: [2].includes(caso),
    // caso 3 (R010 — formación virtual) y caso 8 piden beneficiarios
    benef:    [3, 8].includes(caso),
    autoCalc: [1, 2, 3, 4, 8].includes(caso),
    fijo:     [5, 20].includes(caso),
  }
}

function calcValorMaximo(caso: number, tope: number, horas: number, dias: number, cantidad: number, benef: number) {
  if (caso === 1) return tope * horas
  if (caso === 2) return tope * cantidad
  if (caso === 3) return tope * benef       // R010: tope × # beneficiarios
  if (caso === 4) return tope * dias
  if (caso === 8) return tope * horas * benef
  return 0
}

const emptyForm = {
  rubroId: 0, justificacion: '', numHoras: 0, cantidad: 1,
  beneficiarios: 0, dias: 0, numGrupos: 1, totalRubro: 0,
  cofSena: 0, contraEspecie: 0, contraDinero: 0,
  valorMaximo: 0, valorBenef: 0, paquete: '', caso: 0, tope: 0,
}

const emptyGO: GOData  = { cofSena: 0, especie: 0, dinero: 0, total: 0 }
const emptyTrans: TransData = { beneficiarios: 0, valor: 0 }

// ══════════════════════════════════════════════════════════════════════════════

export default function RubrosAFPage() {
  const { id, afId } = useParams<{ id: string; afId: string }>()
  const proyectoId = Number(id)
  const afIdNum    = Number(afId)

  const [proyecto, setProyecto]   = useState<Proyecto | null>(null)
  const [af, setAf]               = useState<AFInfo | null>(null)
  const [catalogo, setCatalogo]   = useState<RubroCat[]>([])
  const [rubrosAF, setRubrosAF]   = useState<RubroAF[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState(emptyForm)
  const [editId, setEditId]       = useState<number | null>(null)
  const [deletingRubroId, setDeletingRubroId] = useState<number | null>(null)
  const [toast, setToast]         = useState<{tipo:'success'|'error'; msg:string}|null>(null)
  const [toastK, setToastK]       = useState(0)

  // GO & Transferencia
  const [goForm, setGoForm]       = useState<GOData>(emptyGO)
  const [transForm, setTransForm] = useState<TransData>(emptyTrans)
  const [savingGO, setSavingGO]   = useState(false)
  const [savingTrans, setSavingTrans] = useState(false)

  // Prerequisitos
  const [prereqs, setPrereqs] = useState<{ ok: boolean; issues: string[] }>({ ok: true, issues: [] })

  // Confirmación con modal cuando hay advertencias antes de guardar
  const [confirmar, setConfirmar] = useState<{
    titulo: string
    razones: string[]
    onConfirm: () => Promise<void> | void
  } | null>(null)

  const showToast = (tipo: 'success'|'error', msg: string) => {
    setToast({ tipo, msg }); setToastK(k => k + 1)
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [rProy, rAf, rPre, rCat, rRubros, rGo, rTrans] = await Promise.all([
        api.get(`/proyectos/${proyectoId}`),
        api.get(`/proyectos/${proyectoId}/acciones/${afIdNum}`),
        api.get(`/proyectos/${proyectoId}/acciones/${afIdNum}/rubros/prereqs`),
        api.get(`/proyectos/${proyectoId}/acciones/${afIdNum}/rubros/catalogo`),
        api.get(`/proyectos/${proyectoId}/acciones/${afIdNum}/rubros`),
        api.get(`/proyectos/${proyectoId}/acciones/${afIdNum}/rubros/go`),
        api.get(`/proyectos/${proyectoId}/acciones/${afIdNum}/rubros/transferencia`),
      ])
      setProyecto(rProy.data)
      setAf(rAf.data)
      setPrereqs(rPre.data)
      setCatalogo(rCat.data)
      setRubrosAF(rRubros.data)
      setGoForm(rGo.data ?? emptyGO)
      setTransForm(rTrans.data ?? emptyTrans)
    } catch { showToast('error', 'Error cargando datos') }
    finally { setLoading(false) }
  }, [proyectoId, afIdNum])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    document.title = af ? `Rubros AF${af.numero} | SEP` : 'Rubros | SEP'
  }, [af])

  // Refrescos parciales — evitan que `cargar()` sobrescriba inputs no guardados
  // de otras secciones (p. ej. guardar GO no debe borrar Transferencia en edición).
  const refrescarRubros = useCallback(async () => {
    const [rRubros, rPre] = await Promise.all([
      api.get(`/proyectos/${proyectoId}/acciones/${afIdNum}/rubros`),
      api.get(`/proyectos/${proyectoId}/acciones/${afIdNum}/rubros/prereqs`),
    ])
    setRubrosAF(rRubros.data)
    setPrereqs(rPre.data)
  }, [proyectoId, afIdNum])

  const refrescarGO = useCallback(async () => {
    const r = await api.get(`/proyectos/${proyectoId}/acciones/${afIdNum}/rubros/go`)
    setGoForm(r.data ?? emptyGO)
  }, [proyectoId, afIdNum])

  const refrescarTrans = useCallback(async () => {
    const r = await api.get(`/proyectos/${proyectoId}/acciones/${afIdNum}/rubros/transferencia`)
    setTransForm(r.data ?? emptyTrans)
  }, [proyectoId, afIdNum])

  // ── Rubro select → fill form ──────────────────────────────────────────────

  function seleccionarRubro(rubroId: number) {
    const r = catalogo.find(c => c.rubroId === rubroId)
    if (!r) return
    // R013 (pólizas/garantías): solo Contrapartida en Dinero
    const soloDinero = r.codigo?.trim().startsWith('R013') ?? false
    const existing = rubrosAF.find(a => a.rubroId === rubroId)
    if (existing) {
      setEditId(existing.afrubroid)
      setForm({
        rubroId, justificacion: existing.justificacion ?? '',
        numHoras: existing.numHoras ?? 0, cantidad: existing.cantidad ?? 1,
        beneficiarios: existing.beneficiarios ?? 0, dias: existing.dias ?? 0,
        numGrupos: existing.numGrupos ?? 1, totalRubro: existing.totalRubro ?? 0,
        cofSena: soloDinero ? 0 : (existing.cofSena ?? 0),
        contraEspecie: soloDinero ? 0 : (existing.contraEspecie ?? 0),
        contraDinero: existing.contraDinero ?? 0, valorMaximo: existing.valorMaximo ?? 0,
        valorBenef: existing.valorBenef ?? 0, paquete: r.paquete, caso: r.caso, tope: r.tope,
      })
    } else {
      setEditId(null)
      setForm({ ...emptyForm, rubroId, paquete: r.paquete, caso: r.caso, tope: r.tope })
    }
  }

  function recalcMax(f: typeof form) {
    const vm = calcValorMaximo(f.caso, f.tope, f.numHoras, f.dias, f.cantidad, f.beneficiarios)
    return { ...f, valorMaximo: vm }
  }

  function setField(field: keyof typeof form, value: number | string) {
    setForm(prev => recalcMax({ ...prev, [field]: value }))
  }

  const totalCalc   = form.cofSena + form.contraEspecie + form.contraDinero
  const porcSena    = totalCalc > 0 ? (form.cofSena    / totalCalc * 100) : 0
  const porcEspecie = totalCalc > 0 ? (form.contraEspecie / totalCalc * 100) : 0
  const porcDinero  = totalCalc > 0 ? (form.contraDinero  / totalCalc * 100) : 0

  // ── Guardar rubro regular ─────────────────────────────────────────────────

  async function handleGuardar() {
    if (!form.rubroId) return showToast('error', 'Seleccione un rubro.')
    if (!form.justificacion.trim()) return showToast('error', 'La justificación del rubro es obligatoria.')
    const campos = camposVisibles(form.caso)
    if (campos.horas && form.numHoras < 1) return showToast('error', 'Ingrese la cantidad de horas.')
    if (campos.dias && form.dias < 1) return showToast('error', 'Ingrese la cantidad de días.')
    if (campos.unidades && form.cantidad < 1) return showToast('error', 'Ingrese la cantidad de unidades/páginas.')
    if (campos.benef && form.beneficiarios < 1) return showToast('error', 'Ingrese la cantidad de beneficiarios.')
    if (totalCalc < 1) return showToast('error', 'El valor total del rubro debe ser mayor a cero.')
    const r = catalogo.find(c => c.rubroId === form.rubroId)
    if (r && campos.autoCalc && form.valorMaximo > 0 && totalCalc > form.valorMaximo) {
      return showToast('error', `El valor total supera el tope máximo (${fmt(form.valorMaximo)}).`)
    }
    // Si el rubro pide beneficiarios, el valor por beneficiario se calcula
    // dinámicamente en vivo (total / beneficiarios). Si no, mantiene el del
    // form (ej. tiquetes que viene precargado).
    const valorBenefCalc = campos.benef && form.beneficiarios > 0
      ? totalCalc / form.beneficiarios
      : form.valorBenef

    setSaving(true)
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/rubros`, {
        rubroId: form.rubroId, justificacion: form.justificacion.toUpperCase(),
        numHoras: form.numHoras, cantidad: form.cantidad, beneficiarios: form.beneficiarios,
        dias: form.dias, numGrupos: form.numGrupos, totalRubro: totalCalc,
        cofSena: form.cofSena, contraEspecie: form.contraEspecie, contraDinero: form.contraDinero,
        valorMaximo: form.valorMaximo, valorBenef: valorBenefCalc, paquete: form.paquete,
      })
      showToast('success', editId ? 'Rubro actualizado.' : 'Rubro guardado.')
      setForm(emptyForm); setEditId(null)
      await refrescarRubros()
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Error al guardar.')
    } finally { setSaving(false) }
  }

  async function handleEliminar(afrubroid: number) {
    try {
      await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/rubros/${afrubroid}`)
      showToast('success', 'Rubro eliminado.')
      if (form.rubroId === rubrosAF.find(r => r.afrubroid === afrubroid)?.rubroId) {
        setForm(emptyForm); setEditId(null)
      }
      setDeletingRubroId(null)
      await refrescarRubros()
    } catch {
      showToast('error', 'Error al eliminar.')
      setDeletingRubroId(null)
    }
  }

  // ── Guardar GO ────────────────────────────────────────────────────────────

  // Persiste GO (sin chequeos, ya validados antes de llamar)
  async function persistirGO() {
    setSavingGO(true)
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/rubros/go`, {
        cofSena: goForm.cofSena ?? 0,
        especie: goForm.especie ?? 0,
        dinero:  goForm.dinero  ?? 0,
      })
      showToast('success', 'Gastos de Operación guardados.')
      await refrescarGO()
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Error al guardar GO.')
    } finally { setSavingGO(false) }
  }

  async function handleGuardarGO() {
    if (goTotal < 1) return showToast('error', 'El valor total de Gastos de Operación debe ser mayor a cero.')
    // Tope de GO: 10% si proyecto > $200M, 16% si ≤ $200M. Como aquí solo
    // tenemos el total de esta AF, usamos 10% (el más estricto) como umbral
    // del modal — el backend hará la validación final con el total de proyecto.
    const razones: string[] = []
    if (porcGOvsAF > 10) {
      razones.push(`Los Gastos de Operación representan el ${pct(porcGOvsAF)} del total de la AF, lo cual puede superar el tope del 10% (R09.1) si el proyecto es mayor a $200.000.000. El máximo permitido es 16% (R09.2) en proyectos ≤ $200.000.000.`)
    }
    if (razones.length > 0) {
      setConfirmar({
        titulo: 'Gastos de Operación por encima del tope sugerido',
        razones,
        onConfirm: async () => { setConfirmar(null); await persistirGO() },
      })
      return
    }
    await persistirGO()
  }

  // ── Guardar Transferencia ─────────────────────────────────────────────────

  async function persistirTrans() {
    setSavingTrans(true)
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/rubros/transferencia`, {
        beneficiarios: transForm.beneficiarios,
        valor:         transForm.valor,
      })
      showToast('success', 'Transferencia guardada.')
      await refrescarTrans()
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Error al guardar transferencia.')
    } finally { setSavingTrans(false) }
  }

  async function handleGuardarTrans() {
    if (!transForm.beneficiarios || transForm.beneficiarios < 1)
      return showToast('error', 'Ingrese el número de beneficiarios de transferencia.')
    if (!transForm.valor || transForm.valor < 1)
      return showToast('error', 'Ingrese el valor del presupuesto de transferencia.')

    const razones: string[] = []
    if (porcBenefTrans < 5)
      razones.push(`Los beneficiarios de Transferencia (${pct(porcBenefTrans)}) están por debajo del mínimo del 5% del total de beneficiarios del proyecto.`)
    if (porcValTrans < 1)
      razones.push(`El valor de Transferencia (${pct(porcValTrans)}) está por debajo del 1% del presupuesto base (AF + GO).`)

    if (razones.length > 0) {
      setConfirmar({
        titulo: 'Transferencia por debajo de los mínimos recomendados',
        razones,
        onConfirm: async () => { setConfirmar(null); await persistirTrans() },
      })
      return
    }
    await persistirTrans()
  }

  // ── Totales ───────────────────────────────────────────────────────────────

  const totales = rubrosAF.reduce((acc, r) => ({
    totalRubro:    acc.totalRubro    + (r.totalRubro ?? 0),
    cofSena:       acc.cofSena       + (r.cofSena ?? 0),
    contraEspecie: acc.contraEspecie + (r.contraEspecie ?? 0),
    contraDinero:  acc.contraDinero  + (r.contraDinero ?? 0),
  }), { totalRubro: 0, cofSena: 0, contraEspecie: 0, contraDinero: 0 })

  const totPorcSena    = totales.totalRubro > 0 ? (totales.cofSena    / totales.totalRubro * 100) : 0
  const totPorcEspecie = totales.totalRubro > 0 ? (totales.contraEspecie / totales.totalRubro * 100) : 0
  const totPorcDinero  = totales.totalRubro > 0 ? (totales.contraDinero  / totales.totalRubro * 100) : 0

  // GO computed
  const goCofSena  = Number(goForm?.cofSena ?? 0)
  const goEspecie  = Number(goForm?.especie ?? 0)
  const goDinero   = Number(goForm?.dinero  ?? 0)
  const goTotal       = goCofSena + goEspecie + goDinero
  const goPorcSena    = goTotal > 0 ? (goCofSena / goTotal * 100) : 0
  const goPorcEspecie = goTotal > 0 ? (goEspecie / goTotal * 100) : 0
  const goPorcDinero  = goTotal > 0 ? (goDinero  / goTotal * 100) : 0
  const porcGOvsAF    = totales.totalRubro > 0 ? (goTotal / totales.totalRubro * 100) : 0
  const totalAFconGO  = totales.totalRubro + goTotal

  // Transferencia computed
  const totalBenefAF   = af?.numBenef ?? 0
  const porcBenefTrans = totalBenefAF > 0 ? ((transForm?.beneficiarios ?? 0) / totalBenefAF * 100) : 0
  const porcValTrans   = totalAFconGO  > 0 ? ((transForm?.valor        ?? 0) / totalAFconGO  * 100) : 0

  // ── Editable ─────────────────────────────────────────────────────────────
  // Solo se puede editar cuando: NO está radicado (1), NO está aprobado (3)
  // y la convocatoria sigue activa.
  const editable = proyecto
    ? proyecto.estado !== 1 && proyecto.estado !== 3 && proyecto.convocatoriaEstado !== 0
    : false
  const motivoNoEditable = !proyecto
    ? ''
    : proyecto.convocatoriaEstado === 0
      ? 'La convocatoria está cerrada. Los rubros son de solo lectura.'
      : proyecto.estado === 3
        ? 'El proyecto está aprobado. Los rubros son de solo lectura.'
        : proyecto.estado === 1
          ? 'El proyecto está confirmado. Los rubros son de solo lectura.'
          : ''

  // ── Styles ────────────────────────────────────────────────────────────────

  const card  = 'bg-white rounded-2xl border border-neutral-200 shadow-sm'
  const inp   = 'w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D] disabled:bg-neutral-50'
  const lbl   = 'block text-xs font-medium text-neutral-600 mb-1'
  const statBox = 'rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3'

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-[#00304D]" size={32} />
    </div>
  )
  if (!af || !proyecto) return null

  const campos    = camposVisibles(form.caso)
  const rubroSel  = catalogo.find(c => c.rubroId === form.rubroId)
  const esTiquetes = rubroSel?.codigo?.trim().startsWith('R04') ?? false
  // R013 (pólizas/garantías) solo admite Contrapartida en Dinero
  const esSoloDinero = rubroSel?.codigo?.trim().startsWith('R013') ?? false

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">

      {toast && (
        <ToastBetowa key={toastK} show onClose={() => setToast(null)}
          tipo={toast.tipo} titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg} duration={4500} />
      )}

      {/* Modal de confirmación cuando hay advertencias antes de guardar */}
      <Modal open={!!confirmar} onClose={() => setConfirmar(null)} maxWidth="max-w-lg">
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-amber-700" />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <h3 className="text-base font-bold text-neutral-900">{confirmar?.titulo ?? ''}</h3>
              <p className="text-xs text-neutral-500">¿Está seguro de guardar así?</p>
            </div>
          </div>
          <ul className="flex flex-col gap-2 pl-1">
            {(confirmar?.razones ?? []).map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setConfirmar(null)}
              className="px-4 py-2 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition">
              Cancelar
            </button>
            <button onClick={() => confirmar?.onConfirm()}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition">
              Sí, guardar así
            </button>
          </div>
        </div>
      </Modal>

      {!editable && (
        <div className="flex items-center gap-3 px-5 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
          <span className="text-lg">🔒</span>
          <span>{motivoNoEditable}</span>
        </div>
      )}

      {/* Encabezado */}
      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex flex-wrap items-center gap-3">
        <DollarSign size={22} className="text-white flex-shrink-0" />
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 text-white/60 text-xs flex-wrap">
            <Link href="/panel/proyectos" className="hover:text-white transition">Proyectos</Link>
            <ChevronRight size={12} />
            <Link href={`/panel/proyectos/${proyectoId}`} className="hover:text-white transition truncate max-w-[160px]">{proyecto.nombre}</Link>
            <ChevronRight size={12} />
            <Link href={`/panel/proyectos/${proyectoId}/acciones`} className="hover:text-white transition">Acciones de Formación</Link>
            <ChevronRight size={12} />
            <Link href={`/panel/proyectos/${proyectoId}/acciones/${afIdNum}`} className="hover:text-white transition">AF {af.numero}</Link>
            <ChevronRight size={12} />
            <span>Rubros</span>
          </div>
          <h1 className="text-white font-bold text-sm">Rubros — Acción de Formación N° {af.numero}</h1>
        </div>
      </div>

      {/* Menú — mismo estilo que la página de detalle AF */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/panel/proyectos/${proyectoId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-neutral-200 text-[#00304D] text-xs font-semibold rounded-xl hover:bg-[#00304D] hover:text-white transition">
          <FolderKanban size={13} /> Generalidades
        </Link>
        <Link href={`/panel/proyectos/${proyectoId}/acciones`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-neutral-200 text-[#00304D] text-xs font-semibold rounded-xl hover:bg-[#00304D] hover:text-white transition">
          <Layers size={13} /> Acciones de Formación
        </Link>
        <Link href={`/panel/proyectos/${proyectoId}/acciones/${afIdNum}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-neutral-200 text-[#00304D] text-xs font-semibold rounded-xl hover:bg-[#00304D] hover:text-white transition">
          <ClipboardList size={13} /> Detalle AF {af.numero}
        </Link>
        <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl">
          <BookOpen size={13} /> Rubros
        </span>
        {proyecto && proyecto.estado !== 3 && (
          <span className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border ${
            proyecto.estado === 1 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-white border-neutral-200 text-neutral-400'
          }`}>
            {proyecto.estado === 1 ? <><LogOut size={13} /> Confirmado</> : <><CheckCircle2 size={13} /> Sin Confirmar</>}
          </span>
        )}
      </div>

      {editable && !prereqs.ok && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
            <AlertTriangle size={18} />
            <span>No es posible registrar rubros aún — complete primero los siguientes puntos:</span>
          </div>
          <ul className="flex flex-col gap-1.5 pl-1">
            {prereqs.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-red-200 text-red-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                {issue}
              </li>
            ))}
          </ul>
          <Link href={`/panel/proyectos/${proyectoId}/acciones/${afIdNum}`}
            className="self-start inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-red-700 text-white hover:bg-red-800 transition">
            <ClipboardList size={13} /> Volver al detalle del AF
          </Link>
        </div>
      )}

      {/* ── Formulario arriba, tabla debajo ── */}
      <div className="grid grid-cols-1 gap-6">

        {/* Formulario rubro — solo visible si editable y prereqs OK */}
        <div className={`${card} flex flex-col ${(!editable || !prereqs.ok) ? 'hidden' : ''}`}>
          <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100">
            <div className="w-8 h-8 rounded-xl bg-[#00304D] flex items-center justify-center flex-shrink-0">
              <DollarSign size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-bold text-neutral-800">
              {editId ? 'Editar Rubro' : 'Agregar Rubro'}
            </h2>
            {editId && (
              <button onClick={() => { setForm(emptyForm); setEditId(null) }}
                className="ml-auto text-neutral-400 hover:text-neutral-700">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="p-6 flex flex-col gap-4">
            <div>
              <label className={lbl}>Seleccione el Rubro *</label>
              <select className={inp} value={form.rubroId || ''}
                onChange={e => seleccionarRubro(Number(e.target.value))}>
                <option value="">— Seleccione —</option>
                {catalogo.map(r => (
                  <option key={r.rubroId} value={r.rubroId}>{r.nombre}</option>
                ))}
              </select>
            </div>

            {rubroSel && (
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3 text-xs text-neutral-600 leading-relaxed">
                <span className="font-semibold text-[#00304D] block mb-1">{rubroSel.codigo} — Descripción</span>
                {rubroSel.descripcion}
              </div>
            )}

            {rubroSel && rubroSel.tope > 0 && (
              <div className="flex gap-2 text-xs">
                <span className="text-neutral-500">Tarifa máxima:</span>
                <span className="font-semibold text-[#00304D]">{fmt(rubroSel.tope)}</span>
                <span className="text-neutral-400">/ unidad</span>
              </div>
            )}

            {form.rubroId > 0 && (
              <>
                {campos.horas && (
                  <div>
                    <label className={lbl}>N° de Horas *</label>
                    <NumberInput min={0} className={inp} value={form.numHoras}
                      onChange={v => setField('numHoras', v)} />
                  </div>
                )}
                {campos.dias && (
                  <div>
                    <label className={lbl}>N° de Días *</label>
                    <NumberInput min={0} className={inp} value={form.dias}
                      onChange={v => setField('dias', v)} />
                  </div>
                )}
                {campos.unidades && (
                  <div>
                    <label className={lbl}>Cantidad (unidades / páginas) *</label>
                    <NumberInput min={1} className={inp} value={form.cantidad}
                      onChange={v => setField('cantidad', v)} />
                  </div>
                )}
                {campos.benef && (
                  <div>
                    <label className={lbl}>N° Beneficiarios *</label>
                    <NumberInput min={0} className={inp} value={form.beneficiarios}
                      onChange={v => setField('beneficiarios', v)} />
                  </div>
                )}
                {esTiquetes && (
                  <div>
                    <label className={lbl}>N° de Tiquetes</label>
                    <NumberInput min={1} className={inp} value={form.cantidad}
                      onChange={v => setField('cantidad', v)} />
                    <p className="text-xs text-neutral-400 mt-1">Rubro abierto — la cantidad no define el valor máximo.</p>
                  </div>
                )}
                {campos.autoCalc && form.valorMaximo > 0 && (
                  <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2 text-xs flex justify-between">
                    <span className="text-blue-700">Valor máximo permitido</span>
                    <span className="font-bold text-blue-900">{fmt(form.valorMaximo)}</span>
                  </div>
                )}

                <div className="border-t border-neutral-100 pt-4 flex flex-col gap-3">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Distribución financiera</p>
                  {esSoloDinero && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-800">
                      Este rubro solo admite <strong>Contrapartida en Dinero</strong> a cargo del conviniente.
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className={lbl}>Cofin. SENA ($)</label>
                      <NumberInput min={0} disabled={esSoloDinero} className={inp} value={form.cofSena}
                        onChange={v => setField('cofSena', v)} />
                    </div>
                    <div>
                      <label className={lbl}>Contra. Especie ($)</label>
                      <NumberInput min={0} disabled={esSoloDinero} className={inp} value={form.contraEspecie}
                        onChange={v => setField('contraEspecie', v)} />
                    </div>
                    <div>
                      <label className={lbl}>Contra. Dinero ($)</label>
                      <NumberInput min={0} className={inp} value={form.contraDinero}
                        onChange={v => setField('contraDinero', v)} />
                    </div>
                  </div>
                  {totalCalc > 0 && (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-neutral-50 py-1.5 px-2">
                          <div className="text-neutral-500">% SENA</div>
                          <div className="font-bold text-[#00304D]">{pct(porcSena)}</div>
                        </div>
                        <div className="rounded-lg bg-neutral-50 py-1.5 px-2">
                          <div className="text-neutral-500">% Especie</div>
                          <div className="font-bold text-[#00304D]">{pct(porcEspecie)}</div>
                        </div>
                        <div className="rounded-lg bg-neutral-50 py-1.5 px-2">
                          <div className="text-neutral-500">% Dinero</div>
                          <div className="font-bold text-[#00304D]">{pct(porcDinero)}</div>
                        </div>
                      </div>
                      <div className="rounded-xl bg-[#00304D]/5 border border-[#00304D]/20 px-4 py-2 text-xs flex justify-between items-center">
                        <span className="text-[#00304D] font-medium">Total rubro</span>
                        <span className="font-bold text-[#00304D] text-sm">{fmt(totalCalc)}</span>
                      </div>
                      {campos.benef && form.beneficiarios > 0 && (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs flex justify-between items-center">
                          <span className="text-emerald-700 font-medium">Valor por beneficiario</span>
                          <span className="font-bold text-emerald-900 text-sm">{fmt(totalCalc / form.beneficiarios)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label className={lbl}>Justificación del Rubro *</label>
                  <textarea rows={3} className={inp} maxLength={2000}
                    placeholder="Justifique la inclusión de este rubro..."
                    value={form.justificacion}
                    onChange={e => setForm(p => ({ ...p, justificacion: e.target.value }))} />
                  <div className="text-right text-xs text-neutral-400 mt-0.5">{form.justificacion.length}/2000</div>
                </div>

                <button onClick={handleGuardar} disabled={saving}
                  className="flex items-center justify-center gap-2 bg-[#00304D] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#00304D]/90 disabled:opacity-50 transition">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  {editId ? 'Actualizar Rubro' : 'Guardar Rubro'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabla rubros registrados + resumen */}
        <div className="flex flex-col gap-4">
          <div className={card}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100">
              <div className="w-8 h-8 rounded-xl bg-[#00304D] flex items-center justify-center flex-shrink-0">
                <ClipboardList size={16} className="text-white" />
              </div>
              <h2 className="text-sm font-bold text-neutral-800">Rubros Registrados</h2>
              <span className="ml-auto text-xs text-neutral-400">{rubrosAF.length} rubros</span>
            </div>

            {rubrosAF.length === 0 ? (
              <div className="text-center py-10 text-neutral-400 text-sm">
                No hay rubros registrados para esta acción de formación.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-100">
                      <th className="text-left px-4 py-3 text-neutral-500 font-semibold">Rubro</th>
                      <th className="text-right px-3 py-3 text-neutral-500 font-semibold whitespace-nowrap">Unidades</th>
                      <th className="text-right px-3 py-3 text-neutral-500 font-semibold whitespace-nowrap">Valor Unidad</th>
                      <th className="text-right px-3 py-3 text-neutral-500 font-semibold whitespace-nowrap">Cofin. SENA</th>
                      <th className="text-right px-3 py-3 text-neutral-500 font-semibold">%</th>
                      <th className="text-right px-3 py-3 text-neutral-500 font-semibold whitespace-nowrap">C. Especie</th>
                      <th className="text-right px-3 py-3 text-neutral-500 font-semibold">%</th>
                      <th className="text-right px-3 py-3 text-neutral-500 font-semibold whitespace-nowrap">C. Dinero</th>
                      <th className="text-right px-3 py-3 text-neutral-500 font-semibold">%</th>
                      <th className="text-right px-4 py-3 text-neutral-500 font-semibold whitespace-nowrap">Total</th>
                      {editable && <th className="px-3 py-3"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {rubrosAF.map(r => (
                      <tr key={r.afrubroid}
                        className="hover:bg-neutral-50 transition">

                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#00304D]">{r.codigo}</div>
                          <div className="text-neutral-500 max-w-[220px] truncate">{r.nombre.replace(r.codigo + ' ', '')}</div>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap text-neutral-700 font-medium">{unidadesLabel(r)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap text-neutral-600">
                          {(() => { const v = valorUnidad(r); return v != null ? fmt(v) : '—' })()}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">{fmt(r.cofSena ?? 0)}</td>
                        <td className="px-3 py-3 text-right text-neutral-400">{pct(r.porcSena ?? 0)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">{fmt(r.contraEspecie ?? 0)}</td>
                        <td className="px-3 py-3 text-right text-neutral-400">{pct(r.porcEspecie ?? 0)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">{fmt(r.contraDinero ?? 0)}</td>
                        <td className="px-3 py-3 text-right text-neutral-400">{pct(r.porcDinero ?? 0)}</td>
                        <td className="px-4 py-3 text-right font-bold text-[#00304D] whitespace-nowrap">{fmt(r.totalRubro ?? 0)}</td>
                        {editable && (
                          <td className="px-3 py-3 whitespace-nowrap">
                            {deletingRubroId === r.afrubroid ? (
                              <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                                <span className="text-[11px] text-red-700 font-medium">¿Eliminar?</span>
                                <button onClick={e => { e.stopPropagation(); handleEliminar(r.afrubroid) }}
                                  className="px-2 py-0.5 bg-red-600 text-white text-[11px] font-bold rounded hover:bg-red-700 transition">Sí</button>
                                <button onClick={e => { e.stopPropagation(); setDeletingRubroId(null) }}
                                  className="px-2 py-0.5 border border-neutral-200 bg-white text-[11px] text-neutral-600 rounded hover:bg-neutral-100 transition">No</button>
                              </div>
                            ) : (
                              <button onClick={e => { e.stopPropagation(); setDeletingRubroId(r.afrubroid) }}
                                className="text-neutral-300 hover:text-red-500 transition">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Resumen presupuestal rubros */}
          {rubrosAF.length > 0 && (
            <div className={`${card} p-5`}>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Resumen Rubros AF</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Cofin. SENA', val: totales.cofSena, prc: totPorcSena },
                  { label: 'Contra. Especie', val: totales.contraEspecie, prc: totPorcEspecie },
                  { label: 'Contra. Dinero', val: totales.contraDinero, prc: totPorcDinero },
                  { label: 'Total AF', val: totales.totalRubro, prc: 100 },
                ].map(({ label: lb, val, prc: pc }) => (
                  <div key={lb} className={statBox}>
                    <div className="text-xs text-neutral-500 mb-1">{lb}</div>
                    <div className="font-bold text-[#00304D] text-sm">{fmt(val)}</div>
                    <div className="text-xs text-neutral-400">{pct(pc)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Gastos de Operación ────────────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100">
          <div className="w-8 h-8 rounded-xl bg-amber-700 flex items-center justify-center flex-shrink-0">
            <DollarSign size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-neutral-800">Gastos de Operación</h2>
            <p className="text-xs text-neutral-400">R09 — Gastos de operación del proyecto</p>
          </div>
          {goTotal > 0 && (
            <div className="ml-auto flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-neutral-400">% sobre total AF</div>
                <div className="font-bold text-amber-700">{pct(porcGOvsAF)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-neutral-400">Total AF + GO</div>
                <div className="font-bold text-[#00304D]">{fmt(totalAFconGO)}</div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">

            {/* Inputs GO */}
            <div className="flex flex-col gap-4">
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 leading-relaxed">
                Para proyectos &gt; $200.000.000: máximo 10% del total de las acciones de formación (R09.1).
                Para proyectos ≤ $200.000.000: máximo 16% del total de las acciones de formación (R09.2).
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={lbl}>Cofinanciación SENA ($)</label>
                  <NumberInput min={0} disabled={!editable} className={inp}
                    value={goForm?.cofSena ?? 0}
                    onChange={v => setGoForm(p => ({ ...p, cofSena: v }))} />
                </div>
                <div>
                  <label className={lbl}>Contrapartida Especie ($)</label>
                  <NumberInput min={0} disabled={!editable} className={inp}
                    value={goForm?.especie ?? 0}
                    onChange={v => setGoForm(p => ({ ...p, especie: v }))} />
                </div>
                <div>
                  <label className={lbl}>Contrapartida Dinero ($)</label>
                  <NumberInput min={0} disabled={!editable} className={inp}
                    value={goForm?.dinero ?? 0}
                    onChange={v => setGoForm(p => ({ ...p, dinero: v }))} />
                </div>
              </div>

              {goTotal > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                  <div className={statBox}>
                    <div className="text-neutral-500">% Cofin. SENA</div>
                    <div className="font-bold text-[#00304D]">{pct(goPorcSena)}</div>
                  </div>
                  <div className={statBox}>
                    <div className="text-neutral-500">% C. Especie</div>
                    <div className="font-bold text-[#00304D]">{pct(goPorcEspecie)}</div>
                  </div>
                  <div className={statBox}>
                    <div className="text-neutral-500">% C. Dinero</div>
                    <div className="font-bold text-[#00304D]">{pct(goPorcDinero)}</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                    <div className="text-amber-700">Total GO</div>
                    <div className="font-bold text-amber-800">{fmt(goTotal)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Botón guardar GO */}
            {editable && (
              <button onClick={handleGuardarGO} disabled={savingGO || !prereqs.ok}
                className="inline-flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold px-5 py-2.5 rounded-xl disabled:opacity-50 transition whitespace-nowrap">
                {savingGO ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Guardar GO
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Transferencia de Conocimiento y Tecnología ────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100">
          <div className="w-8 h-8 rounded-xl bg-teal-700 flex items-center justify-center flex-shrink-0">
            <ArrowRightCircle size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-neutral-800">Transferencia de Conocimiento y Tecnología</h2>
            <p className="text-xs text-neutral-400">R015 — A cargo de la contrapartida en dinero</p>
          </div>
          {(transForm?.valor ?? 0) > 0 && (
            <div className="ml-auto flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-neutral-400">% Benef. Transferencia</div>
                <div className="font-bold text-teal-700">{pct(porcBenefTrans)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-neutral-400">% Presupuesto</div>
                <div className="font-bold text-teal-700">{pct(porcValTrans)}</div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">

            <div className="flex flex-col gap-4">
              <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-xs text-teal-800 leading-relaxed">
                A cargo de la contrapartida en dinero del proponente. El número de beneficiarios de la Transferencia
                debe corresponder mínimo al <strong>5%</strong> de los beneficiarios del proyecto, y el valor de la
                Transferencia debe corresponder mínimo al <strong>1%</strong> del presupuesto del proyecto.
                El valor base de cálculo corresponde a la sumatoria de los demás rubros presupuestales más los
                Gastos de Operación.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>N° Beneficiarios Transferencia *</label>
                  <NumberInput min={0} disabled={!editable} className={inp}
                    value={transForm?.beneficiarios ?? 0}
                    onChange={v => setTransForm(p => ({ ...p, beneficiarios: v }))} />
                  {totalBenefAF > 0 && (
                    <div className="text-xs text-neutral-400 mt-1">
                      Total benef. AF: {totalBenefAF} — Mín. 5%: {Math.ceil(totalBenefAF * 0.05)} benef.
                    </div>
                  )}
                </div>
                <div>
                  <label className={lbl}>Valor Transferencia ($) *</label>
                  <NumberInput min={0} disabled={!editable} className={inp}
                    value={transForm?.valor ?? 0}
                    onChange={v => setTransForm(p => ({ ...p, valor: v }))} />
                  {totalAFconGO > 0 && (
                    <div className="text-xs text-neutral-400 mt-1">
                      Base: {fmt(totalAFconGO)} (Total AF + GO)
                    </div>
                  )}
                </div>
              </div>

              {((transForm?.beneficiarios ?? 0) > 0 || (transForm?.valor ?? 0) > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
                  <div className={statBox}>
                    <div className="text-neutral-500">% Benef. / Total AF</div>
                    <div className={`font-bold ${porcBenefTrans < 5 ? 'text-red-600' : 'text-teal-700'}`}>{pct(porcBenefTrans)}</div>
                    {porcBenefTrans < 5 && <div className="text-red-500 text-xs">Mínimo 5%</div>}
                  </div>
                  <div className={statBox}>
                    <div className="text-neutral-500">% Presupuesto / (AF+GO)</div>
                    <div className={`font-bold ${porcValTrans < 1 ? 'text-amber-600' : 'text-teal-700'}`}>{pct(porcValTrans)}</div>
                    {porcValTrans < 1 && porcValTrans > 0 && <div className="text-amber-500 text-xs">Recomendado mín. 1%</div>}
                  </div>
                  <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3">
                    <div className="text-teal-700">Valor Transferencia</div>
                    <div className="font-bold text-teal-800">{fmt(transForm?.valor ?? 0)}</div>
                  </div>
                </div>
              )}
            </div>

            {editable && (
              <button onClick={handleGuardarTrans} disabled={savingTrans || !prereqs.ok}
                className="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold px-5 py-2.5 rounded-xl disabled:opacity-50 transition whitespace-nowrap">
                {savingTrans ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Guardar Transferencia
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Volver arriba */}
      <div className="flex pt-2 pb-6">
        <button onClick={() => document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-[#00304D] text-xs font-semibold rounded-xl hover:bg-neutral-50 transition">
          <ChevronUp size={14} /> Volver arriba
        </button>
      </div>

    </div>
  )
}
