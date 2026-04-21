'use client'

import api from '@/lib/api'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { Modal } from '@/components/ui/modal'
import {
  AlertTriangle, ChevronDown, ClipboardList, FileText, Loader2, Pencil, Plus, Save, Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Fuente       { id: number; nombre: string }
interface Herramienta  { id: number; herramienta: string; muestra: number }
interface NecFormacion { id: number; numero: number; nombre: string; beneficiarios: number }

interface Diagnostico {
  necesidadId: number
  fechaRegistro: string | null
  periodoI: string | null
  herrOtra: string | null
  herrCreacion: number | null
  planCapa: number | null
  herrDescrip: string | null
  herrResultados: string | null
  herramientas: Herramienta[]
  necesidades: NecFormacion[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls    = 'w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 focus:border-[#00304D] transition bg-white'
const selectCls   = inputCls + ' appearance-none cursor-pointer'
const textareaCls = 'w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 focus:border-[#00304D] transition bg-white resize-y min-h-[110px]'

function SectionCard({ title, color = '#00304D', children }: {
  title: string; color?: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5" style={{ backgroundColor: color }}>
        <ClipboardList size={18} className="text-white" />
        <h2 className="text-white font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, req, hint, children }: {
  label: string; req?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-semibold text-neutral-700">
          {label}{req && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {hint && <span className="text-xs text-neutral-400 flex-shrink-0">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DetalleDiagnosticoPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const necesidadId = Number(id)

  const [loading,   setLoading]   = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [diag,      setDiag]      = useState<Diagnostico | null>(null)
  const [fuentes,   setFuentes]   = useState<Fuente[]>([])

  // ── Campos diagnóstico ────────────────────────────────────────────────────
  const [periodoI,      setPeriodoI]      = useState('')
  const [herrOtra,      setHerrOtra]      = useState('')
  const [herrCreacion,  setHerrCreacion]  = useState('0')
  const [planCapa,      setPlanCapa]      = useState('0')
  const [herrDescrip,   setHerrDescrip]   = useState('')
  const [herrResultados,setHerrResultados]= useState('')

  // ── Herramienta nueva ─────────────────────────────────────────────────────
  const [fuenteSelId, setFuenteSelId] = useState(0)
  const [muestra,     setMuestra]     = useState('')
  const [agHerr,      setAgHerr]      = useState(false)

  // ── Necesidad formación ───────────────────────────────────────────────────
  const [nfNombre, setNfNombre] = useState('')
  const [nfBenef,  setNfBenef]  = useState('')
  const [agNf,     setAgNf]     = useState(false)

  // ── Editar necesidad ──────────────────────────────────────────────────────
  const [editNf, setEditNf] = useState<NecFormacion | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editBenef,  setEditBenef]  = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // ── Modal eliminar ────────────────────────────────────────────────────────
  const [modalDel, setModalDel] = useState<{ tipo: 'herr' | 'nf'; id: number } | null>(null)

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast,    setToast]    = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)
  const toastKey   = useRef(0)
  const [toastKey2,setToastKey2]= useState(0)

  function showToast(tipo: 'success' | 'error', msg: string) {
    toastKey.current++
    setToast({ tipo, msg })
    setToastKey2(toastKey.current)
  }

  // ── Carga inicial ─────────────────────────────────────────────────────────

  async function cargar() {
    try {
      const [dRes, fRes] = await Promise.all([
        api.get<Diagnostico>(`/necesidades/${necesidadId}`),
        api.get<Fuente[]>('/necesidades/fuentes-herramienta'),
      ])
      const d = dRes.data
      setDiag(d)
      setPeriodoI(d.periodoI ? d.periodoI.slice(0, 10) : '')
      setHerrOtra(d.herrOtra ?? '')
      setHerrCreacion(String(d.herrCreacion ?? 0))
      setPlanCapa(String(d.planCapa ?? 0))
      setHerrDescrip(d.herrDescrip ?? '')
      setHerrResultados(d.herrResultados ?? '')
      setFuentes(fRes.data)
    } catch {
      showToast('error', 'Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.title = 'Detalle Diagnóstico | SEP'
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Guardar diagnóstico ───────────────────────────────────────────────────

  async function guardarDiagnostico() {
    if (!herrDescrip.trim() || !herrResultados.trim()) {
      showToast('error', 'La descripción y el resumen de resultados son obligatorios')
      return
    }
    setGuardando(true)
    try {
      await api.put(`/necesidades/${necesidadId}/diagnostico`, {
        periodoI: periodoI || null,
        herrOtra:     herrOtra || null,
        herrCreacion: Number(herrCreacion),
        planCapa:     Number(planCapa),
        herrDescrip,
        herrResultados,
      })
      showToast('success', 'Diagnóstico guardado correctamente')
      await cargar()
    } catch {
      showToast('error', 'Error al guardar el diagnóstico')
    } finally {
      setGuardando(false)
    }
  }

  // ── Herramientas ──────────────────────────────────────────────────────────

  async function agregarHerramienta() {
    if (!fuenteSelId || !muestra) {
      showToast('error', 'Seleccione la herramienta e ingrese la muestra poblacional')
      return
    }
    setAgHerr(true)
    try {
      await api.post(`/necesidades/${necesidadId}/herramientas`, {
        fuenteId: fuenteSelId, muestra: Number(muestra),
      })
      setFuenteSelId(0); setMuestra('')
      showToast('success', 'Herramienta registrada')
      await cargar()
    } catch {
      showToast('error', 'Error al registrar la herramienta')
    } finally {
      setAgHerr(false)
    }
  }

  async function eliminarHerramienta(hid: number) {
    try {
      await api.delete(`/necesidades/herramientas/${hid}`)
      showToast('success', 'Herramienta eliminada')
      await cargar()
    } catch {
      showToast('error', 'Error al eliminar')
    }
  }

  // ── Necesidades de formación ──────────────────────────────────────────────

  async function agregarNecesidad() {
    if (!nfNombre.trim() || !nfBenef) {
      showToast('error', 'Ingrese la necesidad y el número de beneficiarios')
      return
    }
    setAgNf(true)
    try {
      await api.post(`/necesidades/${necesidadId}/necesidades-formacion`, {
        nombre: nfNombre, benef: Number(nfBenef),
      })
      setNfNombre(''); setNfBenef('')
      showToast('success', 'Necesidad registrada')
      await cargar()
    } catch {
      showToast('error', 'Error al registrar la necesidad')
    } finally {
      setAgNf(false)
    }
  }

  function abrirEditar(nf: NecFormacion) {
    setEditNf(nf)
    setEditNombre(nf.nombre)
    setEditBenef(String(nf.beneficiarios))
  }

  async function guardarEdicion() {
    if (!editNf || !editNombre.trim() || !editBenef) return
    setSavingEdit(true)
    try {
      await api.put(`/necesidades/necesidades-formacion/${editNf.id}`, {
        nombre: editNombre, benef: Number(editBenef),
      })
      showToast('success', 'Necesidad actualizada')
      setEditNf(null)
      await cargar()
    } catch {
      showToast('error', 'Error al actualizar')
    } finally {
      setSavingEdit(false)
    }
  }

  async function confirmarEliminar() {
    if (!modalDel) return
    try {
      if (modalDel.tipo === 'herr') await eliminarHerramienta(modalDel.id)
      else {
        await api.delete(`/necesidades/necesidades-formacion/${modalDel.id}`)
        showToast('success', 'Necesidad eliminada')
        await cargar()
      }
    } catch {
      showToast('error', 'Error al eliminar')
    } finally {
      setModalDel(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 size={32} className="animate-spin text-[#00304D]" />
    </div>
  )

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa key={toastKey2} show onClose={() => setToast(null)}
          tipo={toast.tipo} titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg} duration={4500} />
      )}

      {/* Modal eliminar */}
      <Modal open={!!modalDel} onClose={() => setModalDel(null)}>
        <div className="flex flex-col items-center gap-4 p-2">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle size={24} className="text-red-500" />
          </div>
          <h3 className="font-bold text-neutral-800 text-base text-center">Confirmar eliminación</h3>
          <p className="text-sm text-neutral-500 text-center">
            {modalDel?.tipo === 'herr'
              ? '¿Desea eliminar esta herramienta del diagnóstico?'
              : '¿Desea eliminar esta necesidad de formación? Esta acción no se puede deshacer.'}
          </p>
          <div className="flex gap-3 w-full">
            <button onClick={() => setModalDel(null)}
              className="flex-1 py-2 text-sm text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition">
              Cancelar
            </button>
            <button onClick={confirmarEliminar}
              className="flex-1 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition">
              Eliminar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal editar necesidad */}
      {editNf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 flex flex-col gap-4">
            <h3 className="font-bold text-neutral-800 text-base">Editar necesidad #{editNf.numero}</h3>
            <Field label="Necesidad o problema puntual" req hint="Máx. 500 caracteres">
              <textarea maxLength={500} value={editNombre} onChange={e => setEditNombre(e.target.value)}
                className={textareaCls} rows={4} />
              <span className="text-xs text-neutral-400 text-right">{editNombre.length}/500</span>
            </Field>
            <Field label="Número posible de beneficiarios" req>
              <input type="number" min={1} value={editBenef} onChange={e => setEditBenef(e.target.value)}
                className={inputCls} />
            </Field>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditNf(null)}
                className="px-5 py-2 text-sm text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition">
                Cancelar
              </button>
              <button onClick={guardarEdicion} disabled={savingEdit}
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#00304D] hover:bg-[#004a76] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition">
                {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList size={22} className="text-white" />
          <h1 className="text-white font-bold text-base">
            Registrar Necesidades de Formación
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/panel/necesidades/${necesidadId}/reporte`)}
            className="inline-flex items-center gap-1.5 text-white/90 hover:text-white text-xs border border-white/30 hover:border-white rounded-lg px-3 py-1.5 transition">
            <FileText size={13} /> Ver Reporte
          </button>
          <button onClick={() => router.push('/panel/necesidades')}
            className="text-white/80 hover:text-white text-xs underline transition">
            ← Volver
          </button>
        </div>
      </div>

      {/* ── Diagnóstico de necesidades ──────────────────────────────────── */}
      <SectionCard title="Aplicación Diagnóstico de Necesidades de Formación" color="#00304D">
        {/* Herramientas utilizadas */}
        <div className="flex flex-col gap-4 mb-6">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            Herramientas y Muestra Poblacional
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">
                Herramienta utilizada <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select value={fuenteSelId} onChange={e => setFuenteSelId(Number(e.target.value))}
                  className={selectCls}>
                  <option value={0}>Seleccionar herramienta…</option>
                  {fuentes.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            </div>
            <div className="w-40">
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">
                Muestra poblacional <span className="text-red-500">*</span>
              </label>
              <input type="number" min={1} placeholder="0" value={muestra}
                onChange={e => setMuestra(e.target.value)} className={inputCls} />
            </div>
            <button onClick={agregarHerramienta} disabled={agHerr}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#39A900] hover:bg-[#2d8700] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition whitespace-nowrap">
              {agHerr ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Registrar
            </button>
          </div>

          {diag && diag.herramientas.length > 0 && (
            <>
              {/* Desktop */}
              <div className="hidden sm:block overflow-hidden rounded-xl border border-neutral-200">
                <table className="w-full text-sm">
                  <thead><tr className="bg-[#00304D] text-white">
                    <th className="text-left px-4 py-2 font-semibold">Herramienta Utilizada</th>
                    <th className="text-center px-4 py-2 font-semibold w-40">Muestra Poblacional</th>
                    <th className="text-center px-4 py-2 font-semibold w-20">Eliminar</th>
                  </tr></thead>
                  <tbody>{diag.herramientas.map((h, i) => (
                    <tr key={h.id} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                      <td className="px-4 py-2 text-neutral-700">{h.herramienta}</td>
                      <td className="px-4 py-2 text-center text-neutral-700">{h.muestra}</td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => setModalDel({ tipo: 'herr', id: h.id })}
                          className="text-red-500 hover:text-red-700 p-1 transition">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {/* Mobile */}
              <div className="flex flex-col gap-2 sm:hidden">
                {diag.herramientas.map(h => (
                  <div key={h.id} className="bg-neutral-50 rounded-xl border border-neutral-200 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs font-semibold text-neutral-700 truncate">{h.herramienta}</span>
                      <span className="text-xs text-neutral-500">Muestra: {h.muestra}</span>
                    </div>
                    <button onClick={() => setModalDel({ tipo: 'herr', id: h.id })}
                      className="text-red-500 hover:text-red-700 p-1 flex-shrink-0 transition">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Campos del diagnóstico */}
        <div className="flex flex-col gap-4 border-t border-neutral-100 pt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fecha de diagnóstico" req>
              <input type="date" value={periodoI} onChange={e => setPeriodoI(e.target.value)}
                className={inputCls} />
            </Field>
            <Field label="Otro tipo de herramienta, ¿cuál?">
              <input type="text" value={herrOtra} onChange={e => setHerrOtra(e.target.value)}
                className={inputCls} placeholder="Especifique si aplica…" />
            </Field>
            <Field label="¿La herramienta es de creación propia?">
              <div className="relative">
                <select value={herrCreacion} onChange={e => setHerrCreacion(e.target.value)}
                  className={selectCls}>
                  <option value="0">No</option>
                  <option value="1">Sí</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            </Field>
            <Field label="¿La empresa / gremio cuenta con plan de capacitación?">
              <div className="relative">
                <select value={planCapa} onChange={e => setPlanCapa(e.target.value)}
                  className={selectCls}>
                  <option value="0">No</option>
                  <option value="1">Sí</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            </Field>
          </div>

          <Field label="Descripción de la(s) herramienta(s) utilizada(s) y muestra poblacional" req hint="Máx. 3000 caracteres">
            <textarea maxLength={3000} value={herrDescrip}
              onChange={e => setHerrDescrip(e.target.value)}
              className={textareaCls} rows={5}
              placeholder="Describa la herramienta utilizada y la muestra poblacional analizada…" />
            <span className="text-xs text-neutral-400 text-right">{herrDescrip.length}/3000</span>
          </Field>

          <Field label="Resumen de los principales resultados cualitativos y cuantitativos del diagnóstico" req hint="Máx. 5000 caracteres">
            <textarea maxLength={5000} value={herrResultados}
              onChange={e => setHerrResultados(e.target.value)}
              className={textareaCls} rows={6}
              placeholder="Resumen de resultados principales del diagnóstico de necesidades…" />
            <span className="text-xs text-neutral-400 text-right">{herrResultados.length}/5000</span>
          </Field>

          <div className="flex justify-end">
            <button onClick={guardarDiagnostico} disabled={guardando}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#00304D] hover:bg-[#004a76] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition">
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar Diagnóstico
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── Necesidades de formación detectadas ────────────────────────── */}
      <SectionCard title="Necesidades de Formación Detectadas">
        <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
          A continuación podrá registrar la necesidad detectada y el número de posibles beneficiarios.
          Al dar clic en <strong>Guardar</strong>, podrá registrar nuevamente otra necesidad, y así sucesivamente.
        </p>

        <div className="flex flex-col gap-4 mb-6 border border-neutral-200 rounded-xl p-4">
          <Field label="Necesidad o problema puntual detectado en la empresa / gremio, a la que se puede dar respuesta total o parcial mediante formación" req hint="Máx. 500 caracteres">
            <textarea maxLength={500} value={nfNombre} onChange={e => setNfNombre(e.target.value)}
              className={textareaCls} rows={4}
              placeholder="Describa la necesidad o problema puntual…" />
            <span className="text-xs text-neutral-400 text-right">{nfNombre.length}/500</span>
          </Field>
          <Field label="Número posible de beneficiarios que requieren la formación" req>
            <input type="number" min={1} value={nfBenef} onChange={e => setNfBenef(e.target.value)}
              className={inputCls} placeholder="0" />
          </Field>
          <div className="flex justify-end">
            <button onClick={agregarNecesidad} disabled={agNf}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00304D] hover:bg-[#004a76] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition">
              {agNf ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar
            </button>
          </div>
        </div>

        {/* Lista de necesidades registradas */}
        {diag && diag.necesidades.length > 0 && (
          <>
            {/* Desktop */}
            <div className="hidden sm:block overflow-hidden rounded-xl border border-neutral-200">
              <table className="w-full text-sm">
                <thead><tr className="bg-[#00304D] text-white">
                  <th className="text-center px-4 py-2 font-semibold w-14">#</th>
                  <th className="text-left px-4 py-2 font-semibold">Nombre de la Necesidad de Formación</th>
                  <th className="text-center px-4 py-2 font-semibold w-28">Beneficiarios</th>
                  <th className="text-center px-4 py-2 font-semibold w-20">Editar</th>
                  <th className="text-center px-4 py-2 font-semibold w-20">Eliminar</th>
                </tr></thead>
                <tbody>{diag.necesidades.map((nf, i) => (
                  <tr key={nf.id} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                    <td className="px-4 py-2 text-center font-semibold text-neutral-500">{nf.numero}</td>
                    <td className="px-4 py-2 text-neutral-700">{nf.nombre}</td>
                    <td className="px-4 py-2 text-center text-neutral-700">{nf.beneficiarios}</td>
                    <td className="px-4 py-2 text-center">
                      <button onClick={() => abrirEditar(nf)}
                        className="text-amber-500 hover:text-amber-700 p-1 transition">
                        <Pencil size={16} />
                      </button>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button onClick={() => setModalDel({ tipo: 'nf', id: nf.id })}
                        className="text-red-500 hover:text-red-700 p-1 transition">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
                ))}</tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="flex flex-col gap-2 sm:hidden">
              {diag.necesidades.map(nf => (
                <div key={nf.id} className="bg-white rounded-xl border border-neutral-200 p-3 flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00304D]/10 text-[#00304D] text-xs font-bold flex items-center justify-center">{nf.numero}</span>
                    <p className="text-xs text-neutral-700 leading-snug flex-1">{nf.nombre}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">{nf.beneficiarios} beneficiarios</span>
                    <div className="flex gap-2">
                      <button onClick={() => abrirEditar(nf)} className="text-amber-500 hover:text-amber-700 p-1 transition">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setModalDel({ tipo: 'nf', id: nf.id })} className="text-red-500 hover:text-red-700 p-1 transition">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {diag && diag.necesidades.length === 0 && (
          <p className="text-center text-neutral-400 text-sm py-6">
            Aún no hay necesidades registradas para este diagnóstico.
          </p>
        )}
      </SectionCard>
    </div>
  )
}
