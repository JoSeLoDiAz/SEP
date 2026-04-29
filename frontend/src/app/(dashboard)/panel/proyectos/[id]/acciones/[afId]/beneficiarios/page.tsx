'use client'

import api from '@/lib/api'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  AlertCircle, ChevronRight, ClipboardList, FolderKanban,
  Layers, Loader2, Plus, Save, Search, Trash2, Users, X,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Proyecto {
  proyectoId: number
  nombre: string
  estado: number | null
  convocatoriaEstado: number
  modalidadId: number
}

interface Opcion { id: number; nombre: string }

interface AreaItem  { aafId: number; areaId: number; nombre: string; otro: string | null }
interface NivelItem { anId: number;  nivelId: number; nombre: string }
interface CuocItem  { ocAfId: number; cuocId: number; nombre: string }

interface Perfil {
  afId: number
  afEnfoqueId: number | null
  enfoque: string | null
  justAreas: string | null
  justNivelesOcu: string | null
  mujer: number | null
  numCampesino: number | null
  justCampesino: string | null
  numPopular: number | null
  justPopular: string | null
  trabDiscapac: number | null
  trabajadorBic: number | null
  mipymes: number | null
  trabMipymes: number | null
  mipymesD: string | null
  cadenaProd: number | null
  trabCadProd: number | null
  cadenaProdD: string | null
  areas: AreaItem[]
  niveles: NivelItem[]
  cuoc: CuocItem[]
}

interface FormState {
  afEnfoqueId: string
  justAreas: string
  justNivelesOcu: string
  mujer: string
  numCampesino: string
  justCampesino: string
  numPopular: string
  justPopular: string
  trabDiscapac: string
  trabajadorBic: string
  mipymes: string
  trabMipymes: string
  mipymesD: string
  cadenaProd: string
  trabCadProd: string
  cadenaProdD: string
}

function perfilToForm(p: Perfil): FormState {
  return {
    afEnfoqueId:    p.afEnfoqueId  != null ? String(p.afEnfoqueId)  : '',
    justAreas:      p.justAreas    ?? '',
    justNivelesOcu: p.justNivelesOcu ?? '',
    mujer:          p.mujer        != null ? String(p.mujer)        : '',
    numCampesino:   p.numCampesino != null ? String(p.numCampesino) : '',
    justCampesino:  p.justCampesino  ?? '',
    numPopular:     p.numPopular   != null ? String(p.numPopular)   : '',
    justPopular:    p.justPopular    ?? '',
    trabDiscapac:   p.trabDiscapac != null ? String(p.trabDiscapac) : '',
    trabajadorBic:  p.trabajadorBic != null ? String(p.trabajadorBic) : '',
    mipymes:        p.mipymes      != null ? String(p.mipymes)      : '',
    trabMipymes:    p.trabMipymes  != null ? String(p.trabMipymes)  : '',
    mipymesD:       p.mipymesD     ?? '',
    cadenaProd:     p.cadenaProd   != null ? String(p.cadenaProd)   : '',
    trabCadProd:    p.trabCadProd  != null ? String(p.trabCadProd)  : '',
    cadenaProdD:    p.cadenaProdD  ?? '',
  }
}

function puedeEditar(p: Proyecto | null) {
  if (!p) return false
  const e = Number(p.estado)
  return e !== 1 && e !== 3 && e !== 4 && p.convocatoriaEstado !== 0
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PerfilBeneficiariosPage() {
  const { id, afId } = useParams<{ id: string; afId: string }>()
  const proyectoId = Number(id)
  const afIdNum    = Number(afId)

  const [proyecto,  setProyecto]  = useState<Proyecto | null>(null)
  const [perfil,    setPerfil]    = useState<Perfil | null>(null)
  const [loading,   setLoading]   = useState(true)

  // Catálogos
  const [enfoques,     setEnfoques]     = useState<Opcion[]>([])
  const [areas,        setAreas]        = useState<Opcion[]>([])
  const [niveles,      setNiveles]      = useState<Opcion[]>([])
  const [cuocCat,      setCuocCat]      = useState<Opcion[]>([])

  // Form
  const [form,      setForm]      = useState<FormState | null>(null)
  const [guardando, setGuardando] = useState(false)

  // CUOC searchable dropdown
  const [cuocQuery, setCuocQuery] = useState('')
  const [cuocOpen,  setCuocOpen]  = useState(false)
  const cuocRef = useRef<HTMLDivElement>(null)

  // Área "otro" text
  const [areaSelId,    setAreaSelId]    = useState('')
  const [areaOtroText, setAreaOtroText] = useState('')
  const [areaOtroOpen, setAreaOtroOpen] = useState(false)

  // Toast
  const toastKey = useRef(0)
  const [toastK2, setToastK2] = useState(0)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  function showToast(tipo: 'success' | 'error', msg: string) {
    toastKey.current++
    setToast({ tipo, msg })
    setToastK2(toastKey.current)
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    try {
      const [rP, rPerfil, rEnf, rAr, rNiv, rCuoc] = await Promise.all([
        api.get<Proyecto>(`/proyectos/${proyectoId}`),
        api.get<Perfil>(`/proyectos/${proyectoId}/acciones/${afIdNum}/beneficiarios`),
        api.get<Opcion[]>('/proyectos/enfoques'),
        api.get<Opcion[]>('/proyectos/areasfuncionales'),
        api.get<Opcion[]>('/proyectos/nivelesocu'),
        api.get<Opcion[]>('/proyectos/cuoc'),
      ])
      setProyecto(rP.data)
      setPerfil(rPerfil.data)
      setEnfoques(rEnf.data)
      setAreas(rAr.data)
      setNiveles(rNiv.data)
      setCuocCat(rCuoc.data)
      setForm(perfilToForm(rPerfil.data))
    } catch {
      showToast('error', 'Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [proyectoId, afIdNum])

  useEffect(() => {
    document.title = 'Perfil Beneficiarios | SEP'
    cargar()
  }, [cargar])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (cuocRef.current && !cuocRef.current.contains(e.target as Node)) setCuocOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────

  const editable = puedeEditar(proyecto)

  // CUOC filtered by search
  const cuocFiltrados = useMemo(() => {
    if (!cuocQuery.trim()) return cuocCat.slice(0, 50)
    const q = cuocQuery.toLowerCase()
    return cuocCat.filter(c => c.nombre.toLowerCase().includes(q)).slice(0, 50)
  }, [cuocCat, cuocQuery])

  // Area "otro" option ID (id=11 is "Otra" based on catalog)
  const AREA_OTRA_ID = useMemo(() => {
    return areas.find(a => a.nombre.toLowerCase().includes('otr'))?.id ?? 11
  }, [areas])

  // ── Field helper ──────────────────────────────────────────────────────────

  function set(field: keyof FormState, value: string) {
    setForm(prev => prev ? { ...prev, [field]: value } : prev)
  }

  function numericOnly(value: string) {
    return value.replace(/\D/g, '').slice(0, 4)
  }

  // ── Áreas ─────────────────────────────────────────────────────────────────

  async function handleAgregarArea() {
    if (!areaSelId) { showToast('error', 'Seleccione un área funcional'); return }
    const areaId = Number(areaSelId)
    const otro = areaId === AREA_OTRA_ID ? (areaOtroText.trim() || null) : null
    if (areaId === AREA_OTRA_ID && !otro) {
      showToast('error', 'Debe especificar el área en el campo "Otra"'); return
    }
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/areas`, { areaId, otro })
      setAreaSelId('')
      setAreaOtroText('')
      setAreaOtroOpen(false)
      await cargar()
      showToast('success', 'Área funcional agregada')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'
      showToast('error', msg)
    }
  }

  async function handleEliminarArea(aafId: number) {
    try {
      await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/areas/${aafId}`)
      await cargar()
    } catch { showToast('error', 'Error al eliminar área') }
  }

  // ── Niveles ───────────────────────────────────────────────────────────────

  const [nivelSelId, setNivelSelId] = useState('')

  async function handleAgregarNivel() {
    if (!nivelSelId) { showToast('error', 'Seleccione un nivel ocupacional'); return }
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/niveles`, { nivelId: Number(nivelSelId) })
      setNivelSelId('')
      await cargar()
      showToast('success', 'Nivel ocupacional agregado')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'
      showToast('error', msg)
    }
  }

  async function handleEliminarNivel(anId: number) {
    try {
      await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/niveles/${anId}`)
      await cargar()
    } catch { showToast('error', 'Error al eliminar nivel') }
  }

  // ── CUOC ──────────────────────────────────────────────────────────────────

  async function handleAgregarCuoc(cuocId: number) {
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/cuoc`, { cuocId })
      setCuocQuery('')
      setCuocOpen(false)
      await cargar()
      showToast('success', 'Ocupación CUOC agregada')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'
      showToast('error', msg)
    }
  }

  async function handleEliminarCuoc(ocAfId: number) {
    try {
      await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/cuoc/${ocAfId}`)
      await cargar()
    } catch { showToast('error', 'Error al eliminar CUOC') }
  }

  // ── Guardar campos principales ────────────────────────────────────────────

  function validar(): string | null {
    if (!form) return null
    if (!perfil?.areas.length && !perfil?.niveles.length && !perfil?.cuoc.length)
      return 'Debe registrar al menos un área funcional, nivel ocupacional u ocupación CUOC.'
    if (perfil!.areas.length > 0 && !form.justAreas.trim())
      return 'La justificación de áreas funcionales es obligatoria.'
    if (perfil!.niveles.length > 0 && !form.justNivelesOcu.trim())
      return 'La justificación de niveles ocupacionales es obligatoria.'
    if (!form.afEnfoqueId)
      return 'Debe seleccionar el enfoque de la Acción de Formación.'
    // Mipymes: todos o ninguno
    const m1 = form.mipymes.trim(), m2 = form.trabMipymes.trim(), m3 = form.mipymesD.trim()
    if ((m1 || m2 || m3) && !(m1 && m2 && m3))
      return 'Complete todos los campos de Empresas MiPymes o déjelos todos vacíos.'
    // Cadena: todos o ninguno
    const c1 = form.cadenaProd.trim(), c2 = form.trabCadProd.trim(), c3 = form.cadenaProdD.trim()
    if ((c1 || c2 || c3) && !(c1 && c2 && c3))
      return 'Complete todos los campos de Cadena Productiva o déjelos todos vacíos.'
    // Campesinos: ambos o ninguno
    const ca1 = form.numCampesino.trim(), ca2 = form.justCampesino.trim()
    if ((ca1 || ca2) && !(ca1 && ca2))
      return 'Complete el número y la justificación de trabajadores campesinos, o déjelos vacíos.'
    // Popular: ambos o ninguno
    const p1 = form.numPopular.trim(), p2 = form.justPopular.trim()
    if ((p1 || p2) && !(p1 && p2))
      return 'Complete el número y la justificación de trabajadores de economía popular, o déjelos vacíos.'
    return null
  }

  async function handleGuardar() {
    if (!form) return
    const err = validar()
    if (err) { showToast('error', err); return }

    setGuardando(true)
    try {
      await api.put(`/proyectos/${proyectoId}/acciones/${afIdNum}/beneficiarios`, {
        afEnfoqueId:    form.afEnfoqueId    ? Number(form.afEnfoqueId)    : null,
        justAreas:      form.justAreas.trim()    || null,
        justNivelesOcu: form.justNivelesOcu.trim() || null,
        mujer:          form.mujer.trim()    ? Number(form.mujer)        : null,
        numCampesino:   form.numCampesino.trim() ? Number(form.numCampesino) : null,
        justCampesino:  form.justCampesino.trim() || null,
        numPopular:     form.numPopular.trim()   ? Number(form.numPopular)   : null,
        justPopular:    form.justPopular.trim()  || null,
        trabDiscapac:   form.trabDiscapac.trim() ? Number(form.trabDiscapac) : null,
        trabajadorBic:  form.trabajadorBic.trim() ? Number(form.trabajadorBic) : null,
        mipymes:        form.mipymes.trim()      ? Number(form.mipymes)      : null,
        trabMipymes:    form.trabMipymes.trim()  ? Number(form.trabMipymes)  : null,
        mipymesD:       form.mipymesD.trim()     || null,
        cadenaProd:     form.cadenaProd.trim()   ? Number(form.cadenaProd)   : null,
        trabCadProd:    form.trabCadProd.trim()  ? Number(form.trabCadProd)  : null,
        cadenaProdD:    form.cadenaProdD.trim()  || null,
      })
      showToast('success', 'Perfil de beneficiarios guardado correctamente')
      await cargar()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar'
      showToast('error', msg)
    } finally {
      setGuardando(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const card     = 'bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 flex flex-col gap-4'
  const labelCls = 'block text-sm font-medium text-neutral-700 mb-1'
  const inputCls = `w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm
    focus:outline-none focus:ring-2 focus:ring-[#00304D]
    disabled:bg-neutral-50 disabled:text-neutral-500`
  const textareaCls = `w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm resize-y
    focus:outline-none focus:ring-2 focus:ring-[#00304D]
    disabled:bg-neutral-50 disabled:text-neutral-500`
  const selectCls = `w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm
    focus:outline-none focus:ring-2 focus:ring-[#00304D]
    disabled:bg-neutral-50 disabled:text-neutral-500`
  const chipCls = 'flex items-center justify-between gap-2 bg-[#00304D]/10 text-[#00304D] text-xs font-semibold px-3 py-1.5 rounded-lg'

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 size={32} className="animate-spin text-[#00304D]" />
      </div>
    )
  }

  if (!perfil || !form) {
    return <p className="p-6 text-red-600">No se encontró la acción de formación.</p>
  }

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">

      {toast && (
        <ToastBetowa key={toastK2} show onClose={() => setToast(null)}
          tipo={toast.tipo} titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg} duration={4500} />
      )}

      {/* ── Encabezado ───────────────────────────────────────────────────── */}
      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex flex-wrap items-center gap-3">
        <Users size={22} className="text-white flex-shrink-0" />
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 text-white/60 text-xs flex-wrap">
            <Link href="/panel/proyectos" className="hover:text-white transition">Proyectos</Link>
            <ChevronRight size={12} />
            <Link href={`/panel/proyectos/${proyectoId}`} className="hover:text-white transition truncate max-w-[160px]">
              {proyecto?.nombre}
            </Link>
            <ChevronRight size={12} />
            <Link href={`/panel/proyectos/${proyectoId}/acciones`} className="hover:text-white transition">
              Acciones de Formación
            </Link>
            <ChevronRight size={12} />
            <Link href={`/panel/proyectos/${proyectoId}/acciones/${afIdNum}`} className="hover:text-white transition">
              Detalle AF
            </Link>
            <ChevronRight size={12} />
            <span>Perfil Beneficiarios</span>
          </div>
          <h1 className="text-white font-bold text-sm">Perfil de los Beneficiarios — AF</h1>
        </div>
      </div>

      {/* ── Menú ─────────────────────────────────────────────────────────── */}
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
          <ClipboardList size={13} /> Detalle AF
        </Link>
        <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl">
          <Users size={13} /> Perfil Beneficiarios
        </span>
      </div>

      {!editable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este proyecto no es editable.
        </div>
      )}

      {/* ── Card 1: Áreas Funcionales ─────────────────────────────────────── */}
      <div className={card}>
        <h2 className="text-xs font-semibold text-[#00304D] uppercase tracking-wider">
          Área(s) Funcional(es) a la que Pertenecen los Beneficiarios
        </h2>
        <p className="text-xs text-neutral-500">Puede agregar hasta 5 áreas. Si el área no está en el listado, seleccione "Otra" y especifíquela.</p>

        {editable && (
          <div className="flex flex-col sm:flex-row gap-2">
            <select value={areaSelId} onChange={e => {
              setAreaSelId(e.target.value)
              setAreaOtroOpen(Number(e.target.value) === AREA_OTRA_ID)
              if (Number(e.target.value) !== AREA_OTRA_ID) setAreaOtroText('')
            }} className={selectCls}>
              <option value="">Seleccionar área funcional…</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
            <button onClick={handleAgregarArea}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl hover:bg-[#004a76] transition">
              <Plus size={13} /> Agregar
            </button>
          </div>
        )}

        {areaOtroOpen && editable && (
          <div>
            <label className={labelCls}>Especifique el área funcional <span className="text-red-500">*</span></label>
            <textarea value={areaOtroText} onChange={e => setAreaOtroText(e.target.value)}
              maxLength={500} rows={2} className={textareaCls}
              placeholder="Describa el área funcional…" />
          </div>
        )}

        {perfil.areas.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {perfil.areas.map(a => (
              <div key={a.aafId} className={chipCls}>
                <span>{a.nombre === 'Otra' || a.nombre === 'Otro' ? (a.otro ?? a.nombre) : a.nombre}</span>
                {editable && (
                  <button onClick={() => handleEliminarArea(a.aafId)} className="text-[#00304D]/60 hover:text-red-500 transition">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <label className={labelCls}>Justificación de Áreas Funcionales <span className="text-red-500">*</span></label>
          <textarea disabled={!editable} value={form.justAreas} onChange={e => set('justAreas', e.target.value)}
            maxLength={3000} rows={4} className={textareaCls}
            placeholder="Justifique las áreas funcionales a beneficiar…" />
          <p className="text-xs text-neutral-400 text-right mt-0.5">{form.justAreas.length}/3000</p>
        </div>
      </div>

      {/* ── Card 2: Niveles Ocupacionales ────────────────────────────────── */}
      <div className={card}>
        <h2 className="text-xs font-semibold text-[#00304D] uppercase tracking-wider">
          Niveles Ocupacionales de los Beneficiarios
        </h2>
        <p className="text-xs text-neutral-500">Máximo 3 niveles ocupacionales.</p>

        {editable && (
          <div className="flex flex-col sm:flex-row gap-2">
            <select value={nivelSelId} onChange={e => setNivelSelId(e.target.value)} className={selectCls}>
              <option value="">Seleccionar nivel ocupacional…</option>
              {niveles.map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
            </select>
            <button onClick={handleAgregarNivel}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl hover:bg-[#004a76] transition">
              <Plus size={13} /> Agregar
            </button>
          </div>
        )}

        {perfil.niveles.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {perfil.niveles.map(n => (
              <div key={n.anId} className={chipCls}>
                <span>{n.nombre}</span>
                {editable && (
                  <button onClick={() => handleEliminarNivel(n.anId)} className="text-[#00304D]/60 hover:text-red-500 transition">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <label className={labelCls}>Justificación de Niveles Ocupacionales <span className="text-red-500">*</span></label>
          <textarea disabled={!editable} value={form.justNivelesOcu} onChange={e => set('justNivelesOcu', e.target.value)}
            maxLength={3000} rows={4} className={textareaCls}
            placeholder="Justifique los niveles ocupacionales de los beneficiarios…" />
          <p className="text-xs text-neutral-400 text-right mt-0.5">{form.justNivelesOcu.length}/3000</p>
        </div>
      </div>

      {/* ── Card 3: Clasificación CUOC ───────────────────────────────────── */}
      <div className={card}>
        <h2 className="text-xs font-semibold text-[#00304D] uppercase tracking-wider">
          Clasificación Unificada de Ocupaciones CUOC
        </h2>
        <p className="text-xs text-neutral-500">Máximo 20 ocupaciones CUOC. Use el buscador para encontrar la ocupación.</p>

        {editable && (
          <div ref={cuocRef} className="relative">
            <button type="button" onClick={() => { setCuocOpen(v => !v); setCuocQuery('') }}
              className="w-full flex items-center justify-between border border-neutral-300 rounded-xl px-3 py-2 text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-[#00304D]">
              <span className="text-neutral-400">Buscar y agregar ocupación CUOC…</span>
              <Search size={15} className="shrink-0 text-neutral-400" />
            </button>
            {cuocOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-neutral-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                <div className="p-2 border-b border-neutral-100">
                  <input autoFocus type="text" placeholder="Buscar código o nombre…"
                    value={cuocQuery} onChange={e => setCuocQuery(e.target.value)}
                    className="w-full text-sm border border-neutral-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#00304D]" />
                </div>
                {cuocFiltrados.length === 0
                  ? <p className="text-sm text-neutral-400 text-center py-4">Sin resultados</p>
                  : cuocFiltrados.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => handleAgregarCuoc(c.id)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[#00304D]/10 text-neutral-700">
                      {c.nombre}
                    </button>
                  ))}
                {cuocQuery.trim() === '' && (
                  <p className="text-xs text-neutral-400 text-center py-2">Mostrando primeros 50. Escriba para filtrar.</p>
                )}
              </div>
            )}
          </div>
        )}

        {perfil.cuoc.length > 0 && (
          <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
            {perfil.cuoc.map(c => (
              <div key={c.ocAfId} className={chipCls}>
                <span className="truncate">{c.nombre}</span>
                {editable && (
                  <button onClick={() => handleEliminarCuoc(c.ocAfId)} className="shrink-0 text-[#00304D]/60 hover:text-red-500 transition">
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Card 4: Beneficiarios numéricos ──────────────────────────────── */}
      <div className={card}>
        <h2 className="text-xs font-semibold text-[#00304D] uppercase tracking-wider">Datos Numéricos de Beneficiarios</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>N° Trabajadores Mujeres</label>
            <input type="text" inputMode="numeric" disabled={!editable}
              value={form.mujer} onChange={e => set('mujer', numericOnly(e.target.value))}
              className={inputCls} placeholder="0" maxLength={4} />
          </div>
          <div>
            <label className={labelCls}>N° Personas en Condición de Discapacidad</label>
            <input type="text" inputMode="numeric" disabled={!editable}
              value={form.trabDiscapac} onChange={e => set('trabDiscapac', numericOnly(e.target.value))}
              className={inputCls} placeholder="0" maxLength={4} />
          </div>
          <div>
            <label className={labelCls}>N° Empresas con Modelo BIC</label>
            <input type="text" inputMode="numeric" disabled={!editable}
              value={form.trabajadorBic} onChange={e => set('trabajadorBic', numericOnly(e.target.value))}
              className={inputCls} placeholder="0" maxLength={4} />
          </div>
        </div>

        {/* MiPymes */}
        <div className="border-t border-neutral-100 pt-4">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">MiPymes (si aplica)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>N° Empresas MiPymes</label>
              <input type="text" inputMode="numeric" disabled={!editable}
                value={form.mipymes} onChange={e => set('mipymes', numericOnly(e.target.value))}
                className={inputCls} placeholder="0" maxLength={4} />
            </div>
            <div>
              <label className={labelCls}>N° Trabajadores de Empresas MiPymes</label>
              <input type="text" inputMode="numeric" disabled={!editable}
                value={form.trabMipymes} onChange={e => set('trabMipymes', numericOnly(e.target.value))}
                className={inputCls} placeholder="0" maxLength={4} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Justificación MiPymes</label>
              <textarea disabled={!editable} value={form.mipymesD} onChange={e => set('mipymesD', e.target.value)}
                maxLength={3000} rows={3} className={textareaCls} placeholder="Justificación de inclusión de MiPymes…" />
              <p className="text-xs text-neutral-400 text-right mt-0.5">{form.mipymesD.length}/3000</p>
            </div>
          </div>
        </div>

        {/* Cadena Productiva */}
        <div className="border-t border-neutral-100 pt-4">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Cadena Productiva (si aplica)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>N° Empresas de la Cadena Productiva</label>
              <input type="text" inputMode="numeric" disabled={!editable}
                value={form.cadenaProd} onChange={e => set('cadenaProd', numericOnly(e.target.value))}
                className={inputCls} placeholder="0" maxLength={4} />
            </div>
            <div>
              <label className={labelCls}>N° Trabajadores de la Cadena Productiva</label>
              <input type="text" inputMode="numeric" disabled={!editable}
                value={form.trabCadProd} onChange={e => set('trabCadProd', numericOnly(e.target.value))}
                className={inputCls} placeholder="0" maxLength={4} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Justificación Cadena Productiva</label>
              <textarea disabled={!editable} value={form.cadenaProdD} onChange={e => set('cadenaProdD', e.target.value)}
                maxLength={3000} rows={3} className={textareaCls} placeholder="Justificación de empresas de la cadena productiva…" />
              <p className="text-xs text-neutral-400 text-right mt-0.5">{form.cadenaProdD.length}/3000</p>
            </div>
          </div>
        </div>

        {/* Economía Campesina */}
        <div className="border-t border-neutral-100 pt-4">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Economía Campesina (si aplica)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>N° Trabajadores de la Economía Campesina</label>
              <input type="text" inputMode="numeric" disabled={!editable}
                value={form.numCampesino} onChange={e => set('numCampesino', numericOnly(e.target.value))}
                className={inputCls} placeholder="0" maxLength={4} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Justificación Trabajadores Economía Campesina</label>
              <textarea disabled={!editable} value={form.justCampesino} onChange={e => set('justCampesino', e.target.value)}
                maxLength={3000} rows={3} className={textareaCls} placeholder="Justificación de inclusión de trabajadores campesinos…" />
              <p className="text-xs text-neutral-400 text-right mt-0.5">{form.justCampesino.length}/3000</p>
            </div>
          </div>
        </div>

        {/* Economía Popular */}
        <div className="border-t border-neutral-100 pt-4">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Economía Popular (si aplica)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>N° Trabajadores de la Economía Popular</label>
              <input type="text" inputMode="numeric" disabled={!editable}
                value={form.numPopular} onChange={e => set('numPopular', numericOnly(e.target.value))}
                className={inputCls} placeholder="0" maxLength={4} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Justificación Trabajadores Economía Popular</label>
              <textarea disabled={!editable} value={form.justPopular} onChange={e => set('justPopular', e.target.value)}
                maxLength={3000} rows={3} className={textareaCls} placeholder="Justificación de inclusión de trabajadores de la economía popular…" />
              <p className="text-xs text-neutral-400 text-right mt-0.5">{form.justPopular.length}/3000</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Card 5: Enfoque ───────────────────────────────────────────────── */}
      <div className={card}>
        <h2 className="text-xs font-semibold text-[#00304D] uppercase tracking-wider">Enfoque de la Acción de Formación</h2>
        {!enfoques.length && (
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
            <AlertCircle size={15} />
            <span>No se encontraron enfoques en el catálogo.</span>
          </div>
        )}
        <div>
          <label className={labelCls}>Enfoque <span className="text-red-500">*</span></label>
          <select disabled={!editable} value={form.afEnfoqueId} onChange={e => set('afEnfoqueId', e.target.value)} className={selectCls}>
            <option value="">Seleccionar enfoque…</option>
            {enfoques.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* ── Guardar ───────────────────────────────────────────────────────── */}
      {editable && (
        <div className="flex justify-end pb-4">
          <button onClick={handleGuardar} disabled={guardando}
            className="inline-flex items-center gap-2 bg-[#00304D] hover:bg-[#004a76] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60">
            {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  )
}
