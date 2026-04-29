'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import { ProyectoTabs } from '@/components/proyecto-tabs'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  BookUser, ChevronRight, FileText, FolderKanban,
  Loader2, Plus, Save,
  Trash2, UserPlus, X,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Proyecto {
  proyectoId: number
  nombre: string
  convocatoriaId: number
  modalidadId: number
  convocatoria: string
  modalidad: string
  objetivo: string | null
  estado: number | null
  fechaRegistro: string | null
  fechaRadicacion: string | null
  empresaId: number
  convocatoriaEstado: number
}

interface Opcion    { id: number; nombre: string }
interface Contacto  {
  contactoId: number; nombre: string; cargo: string
  correo: string; telefono: string | null; documento: string | null
  tipoIdentificacionId: number | null
}
interface Disponible { contactoId: number; nombre: string; cargo: string; correo: string; proyectoActual: string | null }

const CARGOS = [
  'Representante Legal',
  'Persona encargada del área de Talento Humano',
  'Persona encargada del área de Comunicaciones',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function estadoInfo(e: number | null) {
  switch (Number(e)) {
    case 1: return { label: 'Confirmado',     cls: 'bg-blue-100 text-blue-700 border-blue-200' }
    case 2: return { label: 'Reversado',      cls: 'bg-amber-100 text-amber-700 border-amber-200' }
    case 3: return { label: 'Aprobado',       cls: 'bg-green-100 text-green-700 border-green-200' }
    case 4: return { label: 'Rechazado',      cls: 'bg-red-100 text-red-700 border-red-200' }
    default: return { label: 'Sin Confirmar', cls: 'bg-neutral-100 text-neutral-500 border-neutral-200' }
  }
}

function puedeEditar(p: Proyecto) {
  const estado = Number(p.estado)
  return estado !== 1 && estado !== 3 && estado !== 4 && p.convocatoriaEstado !== 0
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProyectoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const proyectoId = Number(id)

  const [proyecto, setProyecto]         = useState<Proyecto | null>(null)
  const [convocatorias, setConvocatorias] = useState<Opcion[]>([])
  const [modalidades, setModalidades]   = useState<Opcion[]>([])
  const [contactos, setContactos]       = useState<Contacto[]>([])
  const [disponibles, setDisponibles]   = useState<Disponible[]>([])
  const [loading, setLoading]           = useState(true)

  // Form generalidades
  const [nombre, setNombre]     = useState('')
  const [convId, setConvId]     = useState('')
  const [modalId, setModalId]   = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  // (La confirmación del proyecto se hace desde la página de Reporte.)

  // Asignar contacto existente
  const [modalAsignar, setModalAsignar]   = useState(false)
  const [asignandoId, setAsignandoId]     = useState<number | null>(null)

  // Nuevo contacto modal
  const [modalNuevo, setModalNuevo]       = useState(false)
  const [tiposDoc, setTiposDoc]           = useState<Array<{ id: number; nombre: string }>>([])
  const [formC, setFormC]                 = useState({ nombre: '', cargo: CARGOS[0], correo: '', telefono: '', documento: '', tipoIdentificacionId: '' })
  const [creandoC, setCreandoC]           = useState(false)

  // Desasignar contacto
  const [confirmQuitar, setConfirmQuitar] = useState<{ id: number; nombre: string } | null>(null)
  const [quitando, setQuitando]           = useState(false)

  // Toast
  const toastKey = useRef(0)
  const [toastKey2, setToastKey2]         = useState(0)
  const [toast, setToast]                 = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  function showToast(tipo: 'success' | 'error', msg: string) {
    toastKey.current++
    setToast({ tipo, msg })
    setToastKey2(toastKey.current)
  }

  // ── Data loading ─────────────────────────────────────────────────────────

  async function cargarProyecto() {
    try {
      const [rP, rC, rM] = await Promise.all([
        api.get<Proyecto>(`/proyectos/${proyectoId}`),
        api.get<Opcion[]>('/proyectos/convocatorias'),
        api.get<Opcion[]>('/proyectos/modalidades'),
      ])
      setProyecto(rP.data)
      setNombre(rP.data.nombre ?? '')
      setConvId(String(rP.data.convocatoriaId))
      setModalId(String(rP.data.modalidadId))
      setObjetivo(rP.data.objetivo ?? '')
      setConvocatorias(rC.data)
      setModalidades(rM.data)
    } catch {
      showToast('error', 'Error al cargar el proyecto')
    } finally {
      setLoading(false)
    }
  }

  async function cargarContactos() {
    try {
      const r = await api.get<Contacto[]>(`/proyectos/${proyectoId}/contactos`)
      setContactos(r.data)
    } catch { /* silencio */ }
  }

  useEffect(() => {
    document.title = 'Proyecto | SEP'
    cargarProyecto()
    cargarContactos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId])

  // ── Guardar generalidades ─────────────────────────────────────────────────

  async function guardar() {
    if (!nombre.trim() || !convId || !modalId) {
      showToast('error', 'Nombre, convocatoria y modalidad son obligatorios')
      return
    }
    setGuardando(true)
    try {
      await api.put(`/proyectos/${proyectoId}`, {
        nombre, convocatoriaId: Number(convId), modalidadId: Number(modalId), objetivo,
      })
      showToast('success', 'Datos guardados correctamente')
      await cargarProyecto()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar'
      showToast('error', msg)
    } finally {
      setGuardando(false)
    }
  }

  // (La confirmación/desconfirmación se ejecuta desde la página de Reporte.)

  // ── Asignar contacto existente ────────────────────────────────────────────

  async function abrirAsignar() {
    try {
      const r = await api.get<Disponible[]>(`/proyectos/${proyectoId}/contactos/disponibles`)
      setDisponibles(r.data)
      setModalAsignar(true)
    } catch {
      showToast('error', 'Error al cargar contactos disponibles')
    }
  }

  async function asignar(contactoId: number) {
    setAsignandoId(contactoId)
    try {
      await api.put(`/proyectos/${proyectoId}/contactos/${contactoId}/asignar`)
      showToast('success', 'Contacto asignado al proyecto')
      setModalAsignar(false)
      await cargarContactos()
    } catch {
      showToast('error', 'Error al asignar el contacto')
    } finally {
      setAsignandoId(null)
    }
  }

  // ── Crear nuevo contacto ──────────────────────────────────────────────────

  async function abrirNuevoContacto() {
    setFormC({ nombre: '', cargo: CARGOS[0], correo: '', telefono: '', documento: '', tipoIdentificacionId: '' })
    if (!tiposDoc.length) {
      try {
        const r = await api.get<Array<{ id: number; nombre: string }>>('/contactos/tipos-doc')
        setTiposDoc(r.data)
      } catch { /* ignore */ }
    }
    setModalNuevo(true)
  }

  async function crearContacto() {
    if (!formC.nombre.trim() || !formC.cargo || !formC.correo.trim()) {
      showToast('error', 'Nombre, cargo y correo son obligatorios')
      return
    }
    setCreandoC(true)
    try {
      await api.post(`/proyectos/${proyectoId}/contactos`, {
        nombre: formC.nombre,
        cargo: formC.cargo,
        correo: formC.correo,
        telefono: formC.telefono || undefined,
        documento: formC.documento || undefined,
        tipoIdentificacionId: formC.tipoIdentificacionId ? Number(formC.tipoIdentificacionId) : null,
      })
      showToast('success', 'Contacto creado y asociado al proyecto')
      setModalNuevo(false)
      await cargarContactos()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al crear'
      showToast('error', msg)
    } finally {
      setCreandoC(false)
    }
  }

  // ── Desasignar contacto ───────────────────────────────────────────────────

  async function confirmarQuitar() {
    if (!confirmQuitar) return
    setQuitando(true)
    try {
      await api.delete(`/proyectos/${proyectoId}/contactos/${confirmQuitar.id}`)
      showToast('success', 'Contacto removido del proyecto')
      setConfirmQuitar(null)
      await cargarContactos()
    } catch {
      showToast('error', 'Error al quitar el contacto')
    } finally {
      setQuitando(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 size={32} className="animate-spin text-[#00304D]" />
      </div>
    )
  }

  if (!proyecto) {
    return (
      <div className="p-10 text-center text-red-500 text-sm">Proyecto no encontrado.</div>
    )
  }

  const editable = puedeEditar(proyecto)
  const { label: estadoLabel, cls: estadoCls } = estadoInfo(proyecto.estado)

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa
          key={toastKey2}
          show
          onClose={() => setToast(null)}
          tipo={toast.tipo}
          titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg}
          duration={4500}
        />
      )}

      {/* ── Encabezado ─────────────────────────────────────────────────── */}
      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex flex-wrap items-center gap-3">
        <FolderKanban size={22} className="text-white flex-shrink-0" />
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 text-white/60 text-xs">
            <Link href="/panel/proyectos" className="hover:text-white transition">Proyectos</Link>
            <ChevronRight size={12} />
            <span className="truncate">{proyecto.nombre}</span>
          </div>
          <h1 className="text-white font-bold text-sm truncate">{proyecto.nombre}</h1>
        </div>
        <span className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full border ${estadoCls}`}>
          {estadoLabel}
        </span>
      </div>

      {/* ── Menú de secciones (uniforme) ─────────────────────────────── */}
      <ProyectoTabs proyectoId={proyectoId} active="generalidades" />

      {/* ── Dos columnas: Generalidades + Objetivo ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Generalidades */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm flex flex-col">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
            <FolderKanban size={15} className="text-[#00304D]" />
            <h2 className="text-sm font-bold text-neutral-700">Generalidades del Proyecto</h2>
          </div>
          <div className="px-5 py-5 flex flex-col gap-4 flex-1">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Código</span>
              <span className="text-sm font-bold text-[#00304D]">{proyecto.proyectoId}</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">
                Nombre del Proyecto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                disabled={!editable}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 disabled:bg-neutral-50 disabled:text-neutral-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Convocatoria</label>
              <select
                value={convId}
                onChange={e => setConvId(e.target.value)}
                disabled={!editable}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 disabled:bg-neutral-50 disabled:text-neutral-500 bg-white"
              >
                {convocatorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
                {!convocatorias.some(c => String(c.id) === convId) && (
                  <option value={convId}>{proyecto.convocatoria}</option>
                )}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Modalidad de Participación</label>
              <select
                value={modalId}
                onChange={e => setModalId(e.target.value)}
                disabled={!editable}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 disabled:bg-neutral-50 disabled:text-neutral-500 bg-white"
              >
                {modalidades.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </div>

            {!editable && (
              <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                {proyecto.convocatoriaEstado === 0
                  ? 'La convocatoria está cerrada, no es posible modificar los datos del proyecto.'
                  : Number(proyecto.estado) === 3
                    ? 'El proyecto está aprobado, los datos no son modificables.'
                    : Number(proyecto.estado) === 4
                      ? 'El proyecto está rechazado, los datos no son modificables.'
                      : 'Los datos no son editables mientras el proyecto esté confirmado.'}
              </p>
            )}
          </div>
        </div>

        {/* Descripción General */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm flex flex-col">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
            <FileText size={15} className="text-[#00304D]" />
            <h2 className="text-sm font-bold text-neutral-700">Descripción General del Proyecto</h2>
          </div>
          <div className="px-5 py-5 flex flex-col gap-3 flex-1">
            <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">
              Objetivo General del Proyecto
            </label>
            <textarea
              value={objetivo}
              onChange={e => setObjetivo(e.target.value)}
              disabled={!editable}
              rows={8}
              className="flex-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 resize-none disabled:bg-neutral-50 disabled:text-neutral-500"
              placeholder="Describa el objetivo general del proyecto de formación..."
            />
          </div>
        </div>
      </div>

      {/* Botón guardar */}
      {editable && (
        <div className="flex justify-end">
          <button
            onClick={guardar}
            disabled={guardando}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#00304D] hover:bg-[#004a76] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition"
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {guardando ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      )}

      {/* ── Contactos del Proyecto ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm flex flex-col">
        <div className="px-5 py-4 border-b border-neutral-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <BookUser size={15} className="text-[#00304D]" />
            <h2 className="text-sm font-bold text-neutral-700">Contactos del Proyecto</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={abrirAsignar}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00304D]/10 hover:bg-[#00304D]/20 text-[#00304D] text-xs font-semibold rounded-lg transition"
            >
              <UserPlus size={13} /> Agregar existente
            </button>
            <button
              onClick={abrirNuevoContacto}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00304D] hover:bg-[#004a76] text-white text-xs font-semibold rounded-lg transition"
            >
              <Plus size={13} /> Nuevo contacto
            </button>
          </div>
        </div>

        {contactos.length === 0 ? (
          <div className="px-5 py-10 text-center text-neutral-400 text-sm">
            No hay contactos asociados a este proyecto.
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="flex flex-col gap-3 p-4 sm:hidden">
              {contactos.map(c => (
                <div key={c.contactoId} className="border border-neutral-100 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-semibold bg-[#00304D]/10 text-[#00304D] px-2 py-1 rounded-lg">{c.cargo}</span>
                    <button
                      onClick={() => setConfirmQuitar({ id: c.contactoId, nombre: c.nombre })}
                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-neutral-800">{c.nombre}</p>
                  <p className="text-xs text-neutral-500">{c.correo}</p>
                  {c.telefono && <p className="text-xs text-neutral-400">Tel: {c.telefono}</p>}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#00304D]/10">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#00304D]">Cargo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#00304D]">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#00304D]">Correo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#00304D]">Teléfono</th>
                    <th className="px-4 py-3 w-16 text-xs font-semibold text-[#00304D]"></th>
                  </tr>
                </thead>
                <tbody>
                  {contactos.map((c, i) => (
                    <tr key={c.contactoId} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}>
                      <td className="px-4 py-3 text-neutral-700 font-medium text-xs whitespace-nowrap">{c.cargo}</td>
                      <td className="px-4 py-3 text-neutral-800 font-semibold text-xs">{c.nombre}</td>
                      <td className="px-4 py-3 text-neutral-600 text-xs">{c.correo}</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{c.telefono || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setConfirmQuitar({ id: c.contactoId, nombre: c.nombre })}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition"
                          title="Quitar del proyecto"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Modal asignar contacto existente ───────────────────────────── */}
      <Modal open={modalAsignar} onClose={() => setModalAsignar(false)} maxWidth="max-w-md">
        <div className="flex flex-col">
          <div className="flex items-center gap-3 px-6 py-4 bg-[#00304D]">
            <UserPlus size={16} className="text-white" />
            <h2 className="text-white font-bold text-sm flex-1">Agregar contacto existente</h2>
            <button onClick={() => setModalAsignar(false)} className="text-white/70 hover:text-white transition"><X size={16} /></button>
          </div>
          <div className="px-5 py-4 flex flex-col gap-3 max-h-80 overflow-y-auto">
            {disponibles.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-4">No hay contactos disponibles sin proyecto asignado.</p>
            ) : disponibles.map(d => (
              <div key={d.contactoId} className="flex items-center gap-3 border border-neutral-200 rounded-xl px-4 py-3">
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs font-bold text-neutral-800 truncate">{d.nombre}</span>
                  <span className="text-[10px] text-neutral-500">{d.cargo} · {d.correo}</span>
                  {d.proyectoActual && (
                    <span className="text-[10px] text-amber-600 mt-0.5">En: {d.proyectoActual}</span>
                  )}
                </div>
                <button
                  onClick={() => asignar(d.contactoId)}
                  disabled={asignandoId === d.contactoId}
                  className="flex-shrink-0 px-3 py-1.5 bg-[#00304D] hover:bg-[#004a76] text-white text-xs font-semibold rounded-lg transition disabled:opacity-60"
                >
                  {asignandoId === d.contactoId ? <Loader2 size={12} className="animate-spin" /> : 'Agregar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* ── Modal nuevo contacto ───────────────────────────────────────── */}
      <Modal open={modalNuevo} onClose={() => setModalNuevo(false)} maxWidth="max-w-lg">
        <div className="flex flex-col">
          <div className="flex items-center gap-3 px-6 py-4 bg-[#00304D]">
            <Plus size={16} className="text-white" />
            <h2 className="text-white font-bold text-sm flex-1">Nuevo contacto para este proyecto</h2>
            <button onClick={() => setModalNuevo(false)} className="text-white/70 hover:text-white transition"><X size={16} /></button>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Cargo <span className="text-red-500">*</span></label>
                <select value={formC.cargo} onChange={e => setFormC(f => ({ ...f, cargo: e.target.value }))}
                  className="border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 bg-white">
                  {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Nombre completo <span className="text-red-500">*</span></label>
                <input type="text" value={formC.nombre} onChange={e => setFormC(f => ({ ...f, nombre: e.target.value }))}
                  className="border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30"
                  placeholder="Nombre y apellidos" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Correo electrónico <span className="text-red-500">*</span></label>
                <input type="email" value={formC.correo} onChange={e => setFormC(f => ({ ...f, correo: e.target.value }))}
                  className="border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30"
                  placeholder="correo@ejemplo.com" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Tipo de identificación</label>
                <select value={formC.tipoIdentificacionId} onChange={e => setFormC(f => ({ ...f, tipoIdentificacionId: e.target.value }))}
                  className="border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 bg-white">
                  <option value="">— Seleccione —</option>
                  {tiposDoc.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Número de documento</label>
                <input type="text" value={formC.documento} onChange={e => setFormC(f => ({ ...f, documento: e.target.value }))}
                  className="border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30"
                  placeholder="Número de identificación" />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Teléfono</label>
                <input type="text" value={formC.telefono} onChange={e => setFormC(f => ({ ...f, telefono: e.target.value }))}
                  className="border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30"
                  placeholder="Ej. 6014567890" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setModalNuevo(false)}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition">
                Cancelar
              </button>
              <button onClick={crearContacto} disabled={creandoC}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-[#00304D] hover:bg-[#004a76] text-white transition disabled:opacity-60 flex items-center justify-center gap-1.5">
                {creandoC ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {creandoC ? 'Guardando...' : 'Crear contacto'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Modal confirmar quitar contacto ────────────────────────────── */}
      <Modal open={!!confirmQuitar} onClose={() => !quitando && setConfirmQuitar(null)} maxWidth="max-w-sm">
        <div className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold text-neutral-800">Quitar contacto del proyecto</h3>
            <p className="text-sm text-neutral-500">
              ¿Desea quitar a <strong className="text-neutral-700">{confirmQuitar?.nombre}</strong> de este proyecto?
              El contacto quedará disponible para ser asignado a otro proyecto.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setConfirmQuitar(null)} disabled={quitando}
              className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={confirmarQuitar} disabled={quitando}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition disabled:opacity-60">
              {quitando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Quitar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
