'use client'

import api from '@/lib/api'
import { FileText, FolderKanban, Loader2, Plus, Settings, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

interface Proyecto {
  proyectoId: number
  nombre: string
  estado: number | null
  fechaRegistro: string | null
  fechaRadicacion: string | null
  convocatoria: string | null
  modalidad: string | null
}

interface Opcion { id: number; nombre: string }

function estadoLabel(e: number | null): string {
  switch (Number(e)) {
    case 1: return 'Radicado'
    case 2: return 'Reversado'
    case 3: return 'Aprobado'
    case 4: return 'Rechazado'
    default: return 'Sin Radicar'
  }
}

function estadoClasses(e: number | null): string {
  switch (Number(e)) {
    case 1: return 'bg-blue-100 text-blue-700 border-blue-200'
    case 2: return 'bg-amber-100 text-amber-700 border-amber-200'
    case 3: return 'bg-green-100 text-green-700 border-green-200'
    case 4: return 'bg-red-100 text-red-700 border-red-200'
    default: return 'bg-neutral-100 text-neutral-500 border-neutral-200'
  }
}

function estadoDot(e: number | null): string {
  switch (Number(e)) {
    case 1: return 'bg-blue-500'
    case 2: return 'bg-amber-500'
    case 3: return 'bg-green-500'
    case 4: return 'bg-red-500'
    default: return 'bg-neutral-400'
  }
}

function fmtFecha(f: string | null) {
  if (!f) return '—'
  return new Date(f).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [convocatorias, setConvocatorias] = useState<Opcion[]>([])
  const [modalidades, setModalidades] = useState<Opcion[]>([])
  const [convId, setConvId] = useState('')
  const [modalId, setModalId] = useState('')
  const [nombre, setNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [exito, setExito] = useState(false)
  const [errModal, setErrModal] = useState('')
  const nombreRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'Proyectos | SEP'
    cargarProyectos()
  }, [])

  function cargarProyectos() {
    setLoading(true)
    setError(false)
    api.get<Proyecto[]>('/proyectos')
      .then(r => setProyectos(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  async function abrirModal() {
    setConvId('')
    setModalId('')
    setNombre('')
    setErrModal('')
    setExito(false)
    setModalOpen(true)
    const [convRes, modalRes] = await Promise.all([
      api.get<Opcion[]>('/proyectos/convocatorias'),
      api.get<Opcion[]>('/proyectos/modalidades'),
    ])
    setConvocatorias(convRes.data)
    setModalidades(modalRes.data)
    setTimeout(() => nombreRef.current?.focus(), 50)
  }

  async function handleCrear() {
    setErrModal('')
    if (!convId || !modalId || !nombre.trim()) {
      setErrModal('Todos los campos son obligatorios.')
      return
    }
    setCreando(true)
    try {
      const res = await api.post<{ proyectoId: number }>('/proyectos', {
        convocatoriaId: Number(convId),
        modalidadId: Number(modalId),
        nombre: nombre.trim(),
      })
      setExito(true)
      cargarProyectos()
      setTimeout(() => {
        setModalOpen(false)
        setExito(false)
        window.location.href = `/panel/proyectos/${res.data.proyectoId}`
      }, 2000)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErrModal(msg ?? 'Error al crear el proyecto.')
    } finally {
      setCreando(false)
    }
  }

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">

      {/* Encabezado */}
      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex items-center gap-3">
        <FolderKanban size={22} className="text-white" />
        <h1 className="text-white font-bold text-base flex-1">Proyectos de Formación</h1>
        <button
          onClick={abrirModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-xl transition"
        >
          <Plus size={15} /> Nuevo Proyecto
        </button>
      </div>

      {/* Leyenda estados */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { label: 'Sin Radicar', cls: 'bg-neutral-100 text-neutral-500 border-neutral-200' },
          { label: 'Radicado',    cls: 'bg-blue-100 text-blue-700 border-blue-200' },
          { label: 'Reversado',   cls: 'bg-amber-100 text-amber-700 border-amber-200' },
          { label: 'Aprobado',    cls: 'bg-green-100 text-green-700 border-green-200' },
          { label: 'Rechazado',   cls: 'bg-red-100 text-red-700 border-red-200' },
        ].map(s => (
          <span key={s.label} className={`px-3 py-1 rounded-full border font-semibold ${s.cls}`}>
            {s.label}
          </span>
        ))}
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#00304D]" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center text-red-500 text-sm">
          Error al cargar los proyectos.
        </div>
      ) : proyectos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-10 text-center text-neutral-400 text-sm">
          No hay proyectos registrados para esta empresa.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {proyectos.map(p => (
            <div key={p.proyectoId}
              className="bg-white rounded-2xl border border-neutral-200 shadow-sm flex flex-col overflow-hidden">

              {/* Cabecera */}
              <div className="px-5 pt-5 pb-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-bold text-[#00304D] leading-snug flex-1">{p.nombre || '—'}</h2>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${estadoClasses(p.estado)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${estadoDot(p.estado)}`} />
                    {estadoLabel(p.estado)}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 font-semibold">Código: {p.proyectoId}</p>
              </div>

              {/* Info */}
              <div className="px-5 pb-4 flex flex-col gap-1.5 text-xs text-neutral-600 flex-1">
                <div className="flex gap-1"><span className="font-semibold text-neutral-400 w-24 flex-shrink-0">Convocatoria</span><span>{p.convocatoria || '—'}</span></div>
                <div className="flex gap-1"><span className="font-semibold text-neutral-400 w-24 flex-shrink-0">Modalidad</span><span>{p.modalidad || '—'}</span></div>
                <div className="flex gap-1"><span className="font-semibold text-neutral-400 w-24 flex-shrink-0">F. Registro</span><span>{fmtFecha(p.fechaRegistro)}</span></div>
                <div className="flex gap-1"><span className="font-semibold text-neutral-400 w-24 flex-shrink-0">F. Radicación</span><span>{fmtFecha(p.fechaRadicacion)}</span></div>
              </div>

              {/* Acciones */}
              <div className="border-t border-neutral-100 px-5 py-3 flex gap-2">
                <Link href={`/panel/proyectos/${p.proyectoId}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl bg-[#00304D] hover:bg-[#004a76] text-white transition">
                  <Settings size={13} /> Gestionar
                </Link>
                <a href={`https://sep.sena.edu.co/WPReporteProyecto.aspx?${p.proyectoId}`}
                  target="_blank" rel="noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl bg-[#00304D] hover:bg-[#004a76] text-white transition">
                  <FileText size={13} /> Reporte
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nuevo Proyecto */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">

            {/* Header modal */}
            <div className="flex items-center gap-3 px-6 py-4 bg-[#00304D]">
              <FolderKanban size={18} className="text-white" />
              <h2 className="text-white font-bold text-sm flex-1">Nuevo Proyecto de Formación</h2>
              <button onClick={() => setModalOpen(false)} className="text-white/70 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            {exito ? (
              <div className="px-6 py-10 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <FolderKanban size={22} className="text-green-600" />
                </div>
                <p className="text-green-700 font-bold text-sm">¡Proyecto creado exitosamente!</p>
                <p className="text-neutral-500 text-xs">Redirigiendo al panel del proyecto...</p>
              </div>
            ) : (
              <div className="px-6 py-5 flex flex-col gap-4">
                {/* Convocatoria */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-neutral-600">Convocatoria</label>
                  <select
                    value={convId}
                    onChange={e => setConvId(e.target.value)}
                    className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 focus:border-[#00304D]"
                  >
                    <option value="">Seleccione una convocatoria...</option>
                    {convocatorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Modalidad */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-neutral-600">Modalidad de participación</label>
                  <select
                    value={modalId}
                    onChange={e => setModalId(e.target.value)}
                    className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 focus:border-[#00304D]"
                  >
                    <option value="">Seleccione una modalidad...</option>
                    {modalidades.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Nombre */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-neutral-600">Nombre del proyecto</label>
                  <input
                    ref={nombreRef}
                    type="text"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="Ingrese el nombre del proyecto..."
                    className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 focus:border-[#00304D]"
                    onKeyDown={e => e.key === 'Enter' && handleCrear()}
                  />
                </div>

                {errModal && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{errModal}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCrear}
                    disabled={creando}
                    className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-[#00304D] hover:bg-[#004a76] text-white transition disabled:opacity-60 flex items-center justify-center gap-1.5"
                  >
                    {creando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    {creando ? 'Creando...' : 'Crear Proyecto'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
