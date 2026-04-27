'use client'

import api from '@/lib/api'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  BookOpen, ChevronDown, ChevronRight, ChevronUp,
  ClipboardList, FolderKanban, Layers, Loader2, Plus, Save, Trash2, X,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AFDetalle {
  afId: number
  numero: number
  nombre: string
  modalidadFormacionId: number | null
  proyectoId: number
}

interface Proyecto {
  proyectoId: number
  nombre: string
}

interface UTResumen {
  utId: number
  numero: number
  nombre: string
  totalPrac: number
  totalTeor: number
  esTransversal: number
}

interface Actividad {
  actId: number
  actividadId: number
  nombre: string
  otro: string | null
}

interface PerfilCap {
  perfilId: number
  rubroId: number
  rubroNombre: string
  horasCap: number
  dias: number | null
}

interface UTDetalle {
  utId: number
  afId: number
  numero: number
  nombre: string
  competencias: string | null
  contenido: string | null
  justActividad: string | null
  horasPP: number | null
  horasPV: number | null
  horasPPAT: number | null
  horasPHib: number | null
  horasTP: number | null
  horasTV: number | null
  horasTPAT: number | null
  horasTHib: number | null
  esTransversal: number
  transversalId: number | null
  transversalNombre: string | null
  horasTransversal: number | null
  actividades: Actividad[]
  perfiles: PerfilCap[]
}

interface Opcion { id: number; nombre: string }

interface PerfilAddState { rubroId: string; horasCap: string; dias: string }

interface UTFormState {
  nombre: string
  competencias: string
  contenido: string
  justActividad: string
  horasPrac: string
  horasTeor: string
  esTransversal: boolean
  transversalId: string
  transversalNuevo: string
  horasTransversal: string
  usarNuevaHabilidad: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getHorasPrac(ut: UTDetalle) {
  return (ut.horasPP ?? 0) + (ut.horasPV ?? 0) + (ut.horasPPAT ?? 0) + (ut.horasPHib ?? 0)
}
function getHorasTeor(ut: UTDetalle) {
  return (ut.horasTP ?? 0) + (ut.horasTV ?? 0) + (ut.horasTPAT ?? 0) + (ut.horasTHib ?? 0)
}

function labelHoras(m: number | null): { prac: string; teor: string } {
  if (m === 2)                    return { prac: 'Horas Prácticas (PP-PAT)',  teor: 'Horas Teóricas (TP-PAT)' }
  if (m === 4)                    return { prac: 'Horas Prácticas (Virtual)', teor: 'Horas Teóricas (Virtual)' }
  if (m === 3 || m === 5 || m === 6) return { prac: 'Horas Prácticas (Híbrida)', teor: 'Horas Teóricas (Híbrida)' }
  return { prac: 'Horas Prácticas (Presencial)', teor: 'Horas Teóricas (Presencial)' }
}

const emptyForm = (): UTFormState => ({
  nombre: '', competencias: '', contenido: '', justActividad: '',
  horasPrac: '', horasTeor: '',
  esTransversal: false, transversalId: '', transversalNuevo: '', horasTransversal: '',
  usarNuevaHabilidad: false,
})

// ── Styles ────────────────────────────────────────────────────────────────────

const card = 'bg-white rounded-2xl border border-neutral-200 p-5 flex flex-col gap-4'
const lbl  = 'block text-xs font-medium text-neutral-600 mb-1'
const inp  = 'w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/20 focus:border-[#00304D] disabled:bg-neutral-50'
const ta   = `${inp} resize-none`
const btnP = 'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#00304D] text-white hover:bg-[#004d7a] disabled:opacity-50 transition'
const btnO = 'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-neutral-200 text-[#00304D] hover:bg-[#00304D] hover:text-white transition'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UnidadesPage() {
  const { id: proyIdStr, afId: afIdStr } = useParams<{ id: string; afId: string }>()
  const proyectoId = Number(proyIdStr)
  const afId = Number(afIdStr)

  const [af, setAf] = useState<AFDetalle | null>(null)
  const [proyecto, setProyecto] = useState<Proyecto | null>(null)
  const [uts, setUts] = useState<UTResumen[]>([])
  const [actividadesCat, setActividadesCat] = useState<Opcion[]>([])
  const [rubrosCat, setRubrosCat] = useState<Opcion[]>([])
  const [habilidadesCat, setHabilidadesCat] = useState<Opcion[]>([])
  const [cargando, setCargando] = useState(true)

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detalle, setDetalle] = useState<Record<number, UTDetalle>>({})
  const [creando, setCreando] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [utForm, setUtForm] = useState<UTFormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  const [actSelId, setActSelId]   = useState<Record<number, string>>({})
  const [actOtro, setActOtro]     = useState<Record<number, string>>({})
  const [actAdding, setActAdding] = useState<Record<number, boolean>>({})

  const [perfilAdd, setPerfilAdd]     = useState<Record<number, PerfilAddState>>({})
  const [perfilAdding, setPerfilAdding] = useState<Record<number, boolean>>({})

  const [toastK, setToastK] = useState(0)
  const [toast, setToast] = useState<{ msg: string; tipo: 'success' | 'error' } | null>(null)
  const showToast = (msg: string, tipo: 'success' | 'error' = 'success') => {
    setToastK(k => k + 1)
    setToast({ msg, tipo })
  }

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [rAf, rProy, rUts, rActs, rRubs, rHabs] = await Promise.all([
        api.get<AFDetalle>(`/proyectos/${proyectoId}/acciones/${afId}`),
        api.get<Proyecto>(`/proyectos/${proyectoId}`),
        api.get<UTResumen[]>(`/proyectos/${proyectoId}/acciones/${afId}/unidades`),
        api.get<Opcion[]>('/proyectos/actividadesut'),
        api.get<Opcion[]>(`/proyectos/${proyectoId}/rubrosperfilut`),
        api.get<Opcion[]>(`/proyectos/${proyectoId}/acciones/${afId}/habilidades`),
      ])
      setAf(rAf.data)
      setProyecto(rProy.data)
      setUts(rUts.data)
      setActividadesCat(rActs.data)
      setRubrosCat(rRubs.data)
      setHabilidadesCat(rHabs.data)
    } catch {
      showToast('Error al cargar datos', 'error')
    } finally {
      setCargando(false)
    }
  }, [proyectoId, afId])

  useEffect(() => { cargar() }, [cargar])

  const cargarDetalle = async (utId: number) => {
    try {
      const r = await api.get<UTDetalle>(`/proyectos/${proyectoId}/acciones/${afId}/unidades/${utId}`)
      setDetalle(prev => ({ ...prev, [utId]: r.data }))
    } catch {
      showToast('Error al cargar detalle de la unidad', 'error')
    }
  }

  const recargarDetalle = async (utId: number) => {
    try {
      const r = await api.get<UTDetalle>(`/proyectos/${proyectoId}/acciones/${afId}/unidades/${utId}`)
      setDetalle(prev => ({ ...prev, [utId]: r.data }))
    } catch { /* silencioso */ }
  }

  const toggleExpand = async (utId: number) => {
    if (expandedId === utId) {
      setExpandedId(null)
      setEditingId(null)
    } else {
      setExpandedId(utId)
      setEditingId(null)
      if (!detalle[utId]) await cargarDetalle(utId)
    }
  }

  const setF = (k: keyof UTFormState, v: string | boolean) =>
    setUtForm(prev => ({ ...prev, [k]: v }))

  const iniciarEdicion = (ut: UTDetalle) => {
    setUtForm({
      nombre: ut.nombre,
      competencias: ut.competencias ?? '',
      contenido: ut.contenido ?? '',
      justActividad: ut.justActividad ?? '',
      horasPrac: getHorasPrac(ut) > 0 ? String(getHorasPrac(ut)) : '',
      horasTeor: getHorasTeor(ut) > 0 ? String(getHorasTeor(ut)) : '',
      esTransversal: ut.esTransversal === 1,
      transversalId: ut.transversalId ? String(ut.transversalId) : '',
      transversalNuevo: '',
      horasTransversal: ut.horasTransversal ? String(ut.horasTransversal) : '',
      usarNuevaHabilidad: false,
    })
    setEditingId(ut.utId)
  }

  const buildBodyFromForm = () => {
    const transversalNombre = utForm.esTransversal
      ? (utForm.usarNuevaHabilidad
          ? utForm.transversalNuevo.trim() || null
          : habilidadesCat.find(h => h.id === Number(utForm.transversalId))?.nombre ?? null)
      : null
    return {
      nombre: utForm.nombre.trim(),
      competencias: utForm.competencias.trim() || null,
      contenido: utForm.contenido.trim() || null,
      justActividad: utForm.justActividad.trim() || null,
      horasPrac: utForm.horasPrac ? Number(utForm.horasPrac) : null,
      horasTeor: utForm.horasTeor ? Number(utForm.horasTeor) : null,
      esTransversal: utForm.esTransversal,
      transversalNombre,
      horasTransversal: utForm.esTransversal && utForm.horasTransversal ? Number(utForm.horasTransversal) : null,
    }
  }

  const guardarUT = async (utId: number | null) => {
    if (!utForm.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return }
    setSaving(true)
    try {
      const body = buildBodyFromForm()
      if (utId === null) {
        await api.post(`/proyectos/${proyectoId}/acciones/${afId}/unidades`, body)
        showToast('Unidad temática creada')
        setCreando(false)
      } else {
        await api.put(`/proyectos/${proyectoId}/acciones/${afId}/unidades/${utId}`, body)
        showToast('Unidad temática actualizada')
        setEditingId(null)
        await recargarDetalle(utId)
      }
      setUtForm(emptyForm())
      await cargar()
      const rHabs = await api.get<Opcion[]>(`/proyectos/${proyectoId}/acciones/${afId}/habilidades`)
      setHabilidadesCat(rHabs.data)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar'
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const eliminarUT = async (utId: number) => {
    if (!confirm('¿Eliminar esta unidad temática? Se perderán sus actividades y perfiles.')) return
    try {
      await api.delete(`/proyectos/${proyectoId}/acciones/${afId}/unidades/${utId}`)
      showToast('Unidad temática eliminada')
      if (expandedId === utId) setExpandedId(null)
      setDetalle(prev => { const n = { ...prev }; delete n[utId]; return n })
      await cargar()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al eliminar'
      showToast(msg, 'error')
    }
  }

  const agregarActividad = async (utId: number) => {
    const actividadId = Number(actSelId[utId])
    if (!actividadId) { showToast('Seleccione una actividad', 'error'); return }
    setActAdding(p => ({ ...p, [utId]: true }))
    try {
      const actNombre = actividadesCat.find(a => a.id === actividadId)?.nombre ?? ''
      const needsOtro = actNombre.toLowerCase().includes('otro')
      await api.post(`/proyectos/${proyectoId}/acciones/${afId}/unidades/${utId}/actividades`, {
        actividadId,
        otro: needsOtro ? actOtro[utId]?.trim() || null : null,
      })
      setActSelId(p => ({ ...p, [utId]: '' }))
      setActOtro(p => ({ ...p, [utId]: '' }))
      await recargarDetalle(utId)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'
      showToast(msg, 'error')
    } finally {
      setActAdding(p => ({ ...p, [utId]: false }))
    }
  }

  const eliminarActividad = async (utId: number, actId: number) => {
    try {
      await api.delete(`/proyectos/${proyectoId}/acciones/${afId}/unidades/${utId}/actividades/${actId}`)
      await recargarDetalle(utId)
    } catch { showToast('Error al eliminar actividad', 'error') }
  }

  const agregarPerfil = async (utId: number) => {
    const pa = perfilAdd[utId] ?? { rubroId: '', horasCap: '', dias: '' }
    if (!pa.rubroId) { showToast('Seleccione un rubro', 'error'); return }
    if (!pa.horasCap || Number(pa.horasCap) <= 0) { showToast('Ingrese las horas de capacitación', 'error'); return }
    setPerfilAdding(p => ({ ...p, [utId]: true }))
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afId}/unidades/${utId}/perfiles`, {
        rubroId: Number(pa.rubroId),
        horasCap: Number(pa.horasCap),
        dias: pa.dias ? Number(pa.dias) : null,
      })
      setPerfilAdd(p => ({ ...p, [utId]: { rubroId: '', horasCap: '', dias: '' } }))
      await recargarDetalle(utId)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'
      showToast(msg, 'error')
    } finally {
      setPerfilAdding(p => ({ ...p, [utId]: false }))
    }
  }

  const eliminarPerfil = async (utId: number, perfilId: number) => {
    try {
      await api.delete(`/proyectos/${proyectoId}/acciones/${afId}/unidades/${utId}/perfiles/${perfilId}`)
      await recargarDetalle(utId)
    } catch { showToast('Error al eliminar perfil', 'error') }
  }

  if (cargando) return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="animate-spin text-[#00304D]" size={28} />
    </div>
  )

  if (!af) return (
    <div className="p-6 text-sm text-neutral-500">No se encontró la acción de formación.</div>
  )

  const hLabels = labelHoras(af.modalidadFormacionId)
  const totalHorasAF = uts.reduce((a, u) => a + Number(u.totalPrac) + Number(u.totalTeor), 0)

  return (
    <div className="flex flex-col gap-4 p-4">
      {toast && (
        <ToastBetowa key={toastK} show onClose={() => setToast(null)}
          tipo={toast.tipo} titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg} duration={4500} />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl bg-[#00304D] px-5 py-4">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 text-white/60 text-xs flex-wrap">
            <Link href="/panel/proyectos" className="hover:text-white transition">Proyectos</Link>
            <ChevronRight size={12} />
            <Link href={`/panel/proyectos/${proyectoId}`} className="hover:text-white transition truncate max-w-[160px]">
              {proyecto?.nombre ?? `Proyecto ${proyectoId}`}
            </Link>
            <ChevronRight size={12} />
            <Link href={`/panel/proyectos/${proyectoId}/acciones`} className="hover:text-white transition">Acciones</Link>
            <ChevronRight size={12} />
            <Link href={`/panel/proyectos/${proyectoId}/acciones/${afId}`} className="hover:text-white transition">AF {af.numero}</Link>
            <ChevronRight size={12} />
            <span>Unidades Temáticas</span>
          </div>
          <h1 className="text-white font-bold text-sm mt-0.5">Unidades Temáticas — AF {af.numero}</h1>
          <p className="text-white/60 text-xs truncate">{af.nombre}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/panel/proyectos/${proyectoId}`} className={btnO}>
            <FolderKanban size={13} /> Generalidades
          </Link>
          <Link href={`/panel/proyectos/${proyectoId}/acciones`} className={btnO}>
            <Layers size={13} /> Acciones de Formación
          </Link>
          <Link href={`/panel/proyectos/${proyectoId}/acciones/${afId}`} className={btnO}>
            <ClipboardList size={13} /> Detalle AF {af.numero}
          </Link>
          <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 text-white text-xs font-semibold rounded-xl">
            <BookOpen size={13} /> Unidades Temáticas
          </span>
        </div>
      </div>

      {/* ── Barra superior: resumen + botón crear ──────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span>
            <span className="font-semibold text-[#00304D]">{uts.length}</span>
            <span className="text-neutral-500"> UT{uts.length !== 1 ? 's' : ''} registrada{uts.length !== 1 ? 's' : ''}</span>
          </span>
          {totalHorasAF > 0 && (
            <span className="text-neutral-400 text-xs">{totalHorasAF} horas totales en el AF</span>
          )}
        </div>
        {!creando && (
          <button onClick={() => { setCreando(true); setUtForm(emptyForm()); setExpandedId(null); setEditingId(null) }}
            className={btnP}>
            <Plus size={13} /> Nueva Unidad Temática
          </button>
        )}
      </div>

      {/* ── Formulario de creación ─────────────────────────────────────────── */}
      {creando && (
        <div className={`${card} border-[#00304D]/30 bg-[#00304D]/5`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#00304D] uppercase tracking-wider">Nueva Unidad Temática</h2>
            <button onClick={() => { setCreando(false); setUtForm(emptyForm()) }} className="text-neutral-400 hover:text-neutral-600">
              <X size={16} />
            </button>
          </div>
          <UTFormFields form={utForm} setF={setF} hLabels={hLabels} habilidadesCat={habilidadesCat} />
          <div className="flex gap-2">
            <button onClick={() => guardarUT(null)} disabled={saving} className={btnP}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Crear Unidad Temática
            </button>
            <button onClick={() => { setCreando(false); setUtForm(emptyForm()) }} className={btnO}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Lista vacía ────────────────────────────────────────────────────── */}
      {uts.length === 0 && !creando && (
        <div className="text-center py-16 text-neutral-400 text-sm flex flex-col items-center gap-3">
          <BookOpen size={32} className="text-neutral-200" />
          <p>No hay unidades temáticas registradas para esta acción de formación.</p>
          <button onClick={() => setCreando(true)} className={btnP}>
            <Plus size={13} /> Crear primera unidad temática
          </button>
        </div>
      )}

      {/* ── Lista de UTs ───────────────────────────────────────────────────── */}
      {uts.map(ut => {
        const isExpanded = expandedId === ut.utId
        const isEditing  = editingId === ut.utId
        const det = detalle[ut.utId]
        const totalHoras = Number(ut.totalPrac) + Number(ut.totalTeor)

        return (
          <div key={ut.utId} className={card}>
            {/* Cabecera de la UT */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#00304D]/10 flex items-center justify-center">
                <span className="text-sm font-bold text-[#00304D]">{ut.numero}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-neutral-800 leading-tight">{ut.nombre}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {totalHoras} h totales
                      {Number(ut.totalPrac) > 0 && ` · ${Number(ut.totalPrac)} prac.`}
                      {Number(ut.totalTeor) > 0 && ` · ${Number(ut.totalTeor)} teór.`}
                      {ut.esTransversal === 1 && (
                        <span className="ml-2 text-violet-500 font-medium">· Transversal</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleExpand(ut.utId)} className={btnO}>
                      {isExpanded ? <><ChevronUp size={13} /> Cerrar</> : <><ChevronDown size={13} /> Ver detalle</>}
                    </button>
                    <button onClick={() => eliminarUT(ut.utId)}
                      className="inline-flex items-center p-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-600 hover:text-white transition">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Detalle expandido */}
            {isExpanded && (
              <div className="border-t border-neutral-100 pt-4 flex flex-col gap-5">
                {!det ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="animate-spin text-neutral-300" size={20} />
                  </div>
                ) : isEditing ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-[#00304D] uppercase tracking-wider">Editar datos básicos</h3>
                      <button onClick={() => { setEditingId(null); setUtForm(emptyForm()) }}
                        className="text-neutral-400 hover:text-neutral-600"><X size={15} /></button>
                    </div>
                    <UTFormFields form={utForm} setF={setF} hLabels={hLabels} habilidadesCat={habilidadesCat} />
                    <div className="flex gap-2">
                      <button onClick={() => guardarUT(ut.utId)} disabled={saving} className={btnP}>
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Guardar cambios
                      </button>
                      <button onClick={() => { setEditingId(null); setUtForm(emptyForm()) }} className={btnO}>Cancelar</button>
                    </div>
                    <ActividadesSection
                      det={det} actividadesCat={actividadesCat}
                      actSelId={actSelId[ut.utId] ?? ''} actOtro={actOtro[ut.utId] ?? ''}
                      actAdding={actAdding[ut.utId] ?? false}
                      onActSelChange={v => setActSelId(p => ({ ...p, [ut.utId]: v }))}
                      onActOtroChange={v => setActOtro(p => ({ ...p, [ut.utId]: v }))}
                      onAgregar={() => agregarActividad(ut.utId)}
                      onEliminar={aId => eliminarActividad(ut.utId, aId)}
                    />
                    <PerfilSection
                      det={det} rubrosCat={rubrosCat}
                      perfilAdd={perfilAdd[ut.utId] ?? { rubroId: '', horasCap: '', dias: '' }}
                      perfilAdding={perfilAdding[ut.utId] ?? false}
                      onPerfilAddChange={v => setPerfilAdd(p => ({ ...p, [ut.utId]: { ...(p[ut.utId] ?? { rubroId: '', horasCap: '', dias: '' }), ...v } }))}
                      onAgregar={() => agregarPerfil(ut.utId)}
                      onEliminar={pId => eliminarPerfil(ut.utId, pId)}
                    />
                  </>
                ) : (
                  <>
                    {/* Vista de lectura */}
                    <div className="flex justify-end">
                      <button onClick={() => iniciarEdicion(det)} className={btnO}>Editar datos básicos</button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <InfoField label={hLabels.prac} value={getHorasPrac(det) || '—'} />
                      <InfoField label={hLabels.teor} value={getHorasTeor(det) || '—'} />
                      {det.esTransversal === 1 && (
                        <>
                          <InfoField label="Habilidad transversal" value={det.transversalNombre ?? '—'} highlight />
                          <InfoField label="Horas transversal" value={det.horasTransversal ?? '—'} />
                        </>
                      )}
                    </div>

                    {det.competencias && (
                      <InfoBlock label="Resultados de aprendizaje / Competencias" value={det.competencias} />
                    )}
                    {det.contenido && (
                      <InfoBlock label="Contenido temático" value={det.contenido} />
                    )}
                    {det.justActividad && (
                      <InfoBlock label="Justificación de actividades formativas" value={det.justActividad} />
                    )}

                    <ActividadesSection
                      det={det} actividadesCat={actividadesCat}
                      actSelId={actSelId[ut.utId] ?? ''} actOtro={actOtro[ut.utId] ?? ''}
                      actAdding={actAdding[ut.utId] ?? false}
                      onActSelChange={v => setActSelId(p => ({ ...p, [ut.utId]: v }))}
                      onActOtroChange={v => setActOtro(p => ({ ...p, [ut.utId]: v }))}
                      onAgregar={() => agregarActividad(ut.utId)}
                      onEliminar={aId => eliminarActividad(ut.utId, aId)}
                    />
                    <PerfilSection
                      det={det} rubrosCat={rubrosCat}
                      perfilAdd={perfilAdd[ut.utId] ?? { rubroId: '', horasCap: '', dias: '' }}
                      perfilAdding={perfilAdding[ut.utId] ?? false}
                      onPerfilAddChange={v => setPerfilAdd(p => ({ ...p, [ut.utId]: { ...(p[ut.utId] ?? { rubroId: '', horasCap: '', dias: '' }), ...v } }))}
                      onAgregar={() => agregarPerfil(ut.utId)}
                      onEliminar={pId => eliminarPerfil(ut.utId, pId)}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function InfoField({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-neutral-400 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-violet-700' : 'text-neutral-800'}`}>{value}</p>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-400 mb-1">{label}</p>
      <p className="text-sm text-neutral-700 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function UTFormFields({ form, setF, hLabels, habilidadesCat }: {
  form: UTFormState
  setF: (k: keyof UTFormState, v: string | boolean) => void
  hLabels: { prac: string; teor: string }
  habilidadesCat: Opcion[]
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={lbl}>Nombre <span className="text-red-500">*</span></label>
        <input value={form.nombre} onChange={e => setF('nombre', e.target.value)}
          maxLength={500} className={inp} placeholder="Nombre de la unidad temática…" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>{hLabels.prac}</label>
          <input type="number" min={0} value={form.horasPrac}
            onChange={e => setF('horasPrac', e.target.value)} className={inp} placeholder="0" />
        </div>
        <div>
          <label className={lbl}>{hLabels.teor}</label>
          <input type="number" min={0} value={form.horasTeor}
            onChange={e => setF('horasTeor', e.target.value)} className={inp} placeholder="0" />
        </div>
      </div>

      <div>
        <label className={lbl}>Resultados de aprendizaje / Competencias</label>
        <textarea value={form.competencias} onChange={e => setF('competencias', e.target.value)}
          rows={3} maxLength={3000} className={ta} placeholder="Describa los resultados de aprendizaje…" />
      </div>

      <div>
        <label className={lbl}>Contenido temático</label>
        <textarea value={form.contenido} onChange={e => setF('contenido', e.target.value)}
          rows={3} maxLength={3000} className={ta} placeholder="Describa el contenido temático…" />
      </div>

      <div>
        <label className={lbl}>Justificación de actividades formativas</label>
        <textarea value={form.justActividad} onChange={e => setF('justActividad', e.target.value)}
          rows={2} maxLength={3000} className={ta} placeholder="Justificación…" />
      </div>

      {/* Habilidad transversal */}
      <div className="border border-violet-100 rounded-xl p-3 bg-violet-50/40 flex flex-col gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={form.esTransversal}
            onChange={e => setF('esTransversal', e.target.checked)} className="rounded" />
          <span className="text-xs font-medium text-violet-700">Esta UT desarrolla una habilidad transversal</span>
        </label>

        {form.esTransversal && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <input type="radio" checked={!form.usarNuevaHabilidad}
                  onChange={() => setF('usarNuevaHabilidad', false)} />
                Habilidad existente
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <input type="radio" checked={form.usarNuevaHabilidad}
                  onChange={() => setF('usarNuevaHabilidad', true)} />
                Nueva habilidad
              </label>
            </div>

            {!form.usarNuevaHabilidad ? (
              <select value={form.transversalId} onChange={e => setF('transversalId', e.target.value)} className={inp}>
                <option value="">— Seleccione habilidad —</option>
                {habilidadesCat.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
              </select>
            ) : (
              <input value={form.transversalNuevo} onChange={e => setF('transversalNuevo', e.target.value)}
                className={inp} placeholder="Nombre de la nueva habilidad…" maxLength={200} />
            )}

            <div>
              <label className={lbl}>Horas transversales</label>
              <input type="number" min={0} value={form.horasTransversal}
                onChange={e => setF('horasTransversal', e.target.value)} className={inp} placeholder="0" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ActividadesSection({ det, actividadesCat, actSelId, actOtro, actAdding,
  onActSelChange, onActOtroChange, onAgregar, onEliminar }: {
  det: UTDetalle
  actividadesCat: Opcion[]
  actSelId: string
  actOtro: string
  actAdding: boolean
  onActSelChange: (v: string) => void
  onActOtroChange: (v: string) => void
  onAgregar: () => void
  onEliminar: (actId: number) => void
}) {
  const selNombre = actividadesCat.find(a => a.id === Number(actSelId))?.nombre ?? ''
  const needsOtro = selNombre.toLowerCase().includes('otro')
  const canAdd = det.actividades.length < 5

  return (
    <div className="border-t border-neutral-100 pt-4">
      <p className="text-xs font-semibold text-[#00304D] uppercase tracking-wider mb-3">
        Actividades de aprendizaje ({det.actividades.length}/5)
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {det.actividades.map(a => (
          <span key={a.actId}
            className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-full">
            {a.nombre}{a.otro ? `: ${a.otro}` : ''}
            <button onClick={() => onEliminar(a.actId)} className="text-blue-300 hover:text-red-500 transition">
              <X size={11} />
            </button>
          </span>
        ))}
        {det.actividades.length === 0 && (
          <span className="text-xs text-neutral-400">Sin actividades registradas</span>
        )}
      </div>

      {canAdd && (
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[180px]">
            <label className={lbl}>Agregar actividad</label>
            <select value={actSelId} onChange={e => onActSelChange(e.target.value)} className={inp}>
              <option value="">— Seleccione —</option>
              {actividadesCat
                .filter(a => !det.actividades.some(d => d.actividadId === a.id))
                .map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          {needsOtro && (
            <div className="flex-1 min-w-[140px]">
              <label className={lbl}>Especifique</label>
              <input value={actOtro} onChange={e => onActOtroChange(e.target.value)}
                className={inp} placeholder="Otra actividad…" maxLength={200} />
            </div>
          )}
          <button onClick={onAgregar} disabled={actAdding || !actSelId} className={btnP}>
            {actAdding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Agregar
          </button>
        </div>
      )}
    </div>
  )
}

function PerfilSection({ det, rubrosCat, perfilAdd, perfilAdding,
  onPerfilAddChange, onAgregar, onEliminar }: {
  det: UTDetalle
  rubrosCat: Opcion[]
  perfilAdd: PerfilAddState
  perfilAdding: boolean
  onPerfilAddChange: (v: Partial<PerfilAddState>) => void
  onAgregar: () => void
  onEliminar: (perfilId: number) => void
}) {
  const canAdd = det.perfiles.length < 5

  return (
    <div className="border-t border-neutral-100 pt-4">
      <p className="text-xs font-semibold text-[#00304D] uppercase tracking-wider mb-3">
        Perfil de capacitador ({det.perfiles.length}/5)
      </p>

      {det.perfiles.length > 0 && (
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-neutral-400 border-b border-neutral-100">
                <th className="text-left py-1.5 pr-3 font-medium">Perfil del Capacitador</th>
                <th className="text-center py-1.5 px-2 font-medium">Horas Cap.</th>
                <th className="text-center py-1.5 px-2 font-medium">Días</th>
                <th className="py-1.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {det.perfiles.map(p => (
                <tr key={p.perfilId} className="border-b border-neutral-50 hover:bg-neutral-50/80">
                  <td className="py-2 pr-3 text-neutral-800 font-medium">{p.rubroNombre}</td>
                  <td className="py-2 px-2 text-center text-neutral-700">{p.horasCap}</td>
                  <td className="py-2 px-2 text-center text-neutral-500">{p.dias ?? '—'}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => onEliminar(p.perfilId)}
                      className="text-red-300 hover:text-red-600 transition">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {det.perfiles.length === 0 && (
        <p className="text-xs text-neutral-400 mb-3">Sin perfiles de capacitador registrados</p>
      )}

      {canAdd && (
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[180px]">
            <label className={lbl}>Perfil del Capacitador</label>
            <select value={perfilAdd.rubroId}
              onChange={e => onPerfilAddChange({ rubroId: e.target.value })} className={inp}>
              <option value="">— Seleccione —</option>
              {rubrosCat.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div className="w-24">
            <label className={lbl}>Horas Cap.</label>
            <input type="number" min={1} value={perfilAdd.horasCap}
              onChange={e => onPerfilAddChange({ horasCap: e.target.value })} className={inp} placeholder="0" />
          </div>
          <div className="w-20">
            <label className={lbl}>Días</label>
            <input type="number" min={1} value={perfilAdd.dias}
              onChange={e => onPerfilAddChange({ dias: e.target.value })} className={inp} placeholder="—" />
          </div>
          <button onClick={onAgregar} disabled={perfilAdding || !perfilAdd.rubroId} className={btnP}>
            {perfilAdding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Agregar
          </button>
        </div>
      )}
    </div>
  )
}
