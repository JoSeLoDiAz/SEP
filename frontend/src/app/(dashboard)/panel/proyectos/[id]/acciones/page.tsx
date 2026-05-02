'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import { ProyectoTabs } from '@/components/proyecto-tabs'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  ChevronRight, ClipboardList, CheckCircle2, Eye, Layers,
  Loader2, LogOut, Plus, Save, Trash2, X,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Fragment, useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Proyecto {
  proyectoId: number
  nombre: string
  estado: number | null
  convocatoriaEstado: number
}

interface AF {
  afId: number
  numero: number
  nombre: string
  numBenef: number
  tipoEvento: string | null
  modalidad: string | null
  estadoAprobacion: number | null  // 1 aprobada, 0 rechazada, null sin evaluar
  motivoRechazo: string | null
}

interface Opcion { id: number; nombre: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function puedeEditar(p: Proyecto | null) {
  if (!p) return false
  const estado = Number(p.estado)
  // Estado 2 (Reversado/Subsanación) siempre editable. Estado 0 requiere
  // convocatoria abierta. Los demás estados son solo lectura.
  return estado === 2 || (estado === 0 && p.convocatoriaEstado !== 0)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AccionesPage() {
  const { id } = useParams<{ id: string }>()
  const proyectoId = Number(id)

  const [proyecto, setProyecto]   = useState<Proyecto | null>(null)
  const [afs, setAfs]             = useState<AF[]>([])
  const [loading, setLoading]     = useState(true)

  // Crear AF modal
  const [modalOpen, setModalOpen]             = useState(false)
  const [tiposEvento, setTiposEvento]         = useState<Opcion[]>([])
  const [modalidades, setModalidades]         = useState<Opcion[]>([])
  const [form, setForm]                       = useState({ nombre: '', tipoEventoId: '', modalidadFormacionId: '', numBenef: '' })
  const [creando, setCreando]                 = useState(false)
  const nombreRef                             = useRef<HTMLInputElement>(null)

  // Eliminar AF
  const [confirmElim, setConfirmElim]         = useState<{ id: number; nombre: string } | null>(null)
  const [eliminando, setEliminando]           = useState(false)

  // Toast
  const toastKey  = useRef(0)
  const [toastK2, setToastK2]                 = useState(0)
  const [toast, setToast]                     = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  function showToast(tipo: 'success' | 'error', msg: string) {
    toastKey.current++
    setToast({ tipo, msg })
    setToastK2(toastKey.current)
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  async function cargar() {
    try {
      const [rP, rAF] = await Promise.all([
        api.get<Proyecto>(`/proyectos/${proyectoId}`),
        api.get<AF[]>(`/proyectos/${proyectoId}/acciones`),
      ])
      setProyecto(rP.data)
      setAfs(rAF.data)
    } catch {
      showToast('error', 'Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.title = 'Acciones de Formación | SEP'
    cargar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId])

  // ── Crear AF ──────────────────────────────────────────────────────────────

  async function abrirModal() {
    setForm({ nombre: '', tipoEventoId: '', modalidadFormacionId: '', numBenef: '' })
    setModalOpen(true)
    if (!tiposEvento.length || !modalidades.length) {
      const [rT, rM] = await Promise.all([
        api.get<Opcion[]>('/proyectos/tiposevento'),
        api.get<Opcion[]>('/proyectos/modalidadesformacion'),
      ])
      setTiposEvento(rT.data)
      setModalidades(rM.data)
    }
    setTimeout(() => nombreRef.current?.focus(), 80)
  }

  async function handleCrear() {
    if (!form.nombre.trim() || !form.tipoEventoId || !form.modalidadFormacionId || !form.numBenef) {
      showToast('error', 'Todos los campos son obligatorios')
      return
    }
    const nb = Number(form.numBenef)
    if (!Number.isInteger(nb) || nb <= 0) {
      showToast('error', 'El número de beneficiarios debe ser un entero positivo')
      return
    }
    setCreando(true)
    try {
      await api.post(`/proyectos/${proyectoId}/acciones`, {
        nombre: form.nombre.trim(),
        tipoEventoId: Number(form.tipoEventoId),
        modalidadFormacionId: Number(form.modalidadFormacionId),
        numBenef: nb,
      })
      showToast('success', 'Acción de formación creada correctamente')
      setModalOpen(false)
      await cargar()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al crear'
      showToast('error', msg)
    } finally {
      setCreando(false)
    }
  }

  // ── Eliminar AF ───────────────────────────────────────────────────────────

  async function confirmarEliminar() {
    if (!confirmElim) return
    setEliminando(true)
    try {
      await api.delete(`/proyectos/${proyectoId}/acciones/${confirmElim.id}`)
      showToast('success', 'Acción de formación eliminada')
      setConfirmElim(null)
      await cargar()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al eliminar'
      showToast('error', msg)
    } finally {
      setEliminando(false)
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

  const editable = puedeEditar(proyecto)
  const esRadicado = Number(proyecto?.estado) === 1

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa
          key={toastK2}
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
        <Layers size={22} className="text-white flex-shrink-0" />
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 text-white/60 text-xs flex-wrap">
            <Link href="/panel/proyectos" className="hover:text-white transition">Proyectos</Link>
            <ChevronRight size={12} />
            <Link href={`/panel/proyectos/${proyectoId}`} className="hover:text-white transition truncate max-w-[160px]">
              {proyecto?.nombre}
            </Link>
            <ChevronRight size={12} />
            <span>Acciones de Formación</span>
          </div>
          <h1 className="text-white font-bold text-sm">Acciones de Formación del Proyecto</h1>
        </div>
      </div>

      {/* ── Menú secciones (uniforme) ────────────────────────────────── */}
      <ProyectoTabs proyectoId={proyectoId} active="acciones" extraTabs={
        Number(proyecto?.estado) !== 3 ? (
          <span className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border ${
            esRadicado
              ? 'bg-amber-50 text-amber-600 border-amber-200'
              : 'bg-white border-neutral-200 text-neutral-400'
          }`}>
            {esRadicado ? <><LogOut size={13} /> Confirmado</> : <><CheckCircle2 size={13} /> Sin Confirmar</>}
          </span>
        ) : null
      } />

      {/* ── Tabla / Cards ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm flex flex-col overflow-hidden">

        {/* Header de la sección */}
        <div className="px-5 py-4 border-b border-neutral-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <ClipboardList size={15} className="text-[#00304D]" />
            <h2 className="text-sm font-bold text-neutral-700">
              Listado de Acciones de Formación
            </h2>
            {afs.length > 0 && (
              <span className="text-xs font-semibold bg-[#00304D]/10 text-[#00304D] px-2 py-0.5 rounded-full">
                {afs.length}
              </span>
            )}
          </div>
          {editable && (
            <button
              onClick={abrirModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00304D] hover:bg-[#004a76] text-white text-xs font-semibold rounded-xl transition"
            >
              <Plus size={13} /> Crear AF
            </button>
          )}
        </div>

        {afs.length === 0 ? (
          <div className="px-5 py-14 text-center text-neutral-400 text-sm">
            No hay acciones de formación registradas para este proyecto.
            {editable && (
              <p className="mt-2 text-xs">Use el botón <strong>Crear AF</strong> para agregar una.</p>
            )}
          </div>
        ) : (
          <>
            {/* Mobile: tarjetas */}
            <div className="flex flex-col gap-3 p-4 sm:hidden">
              {afs.map(af => {
                const rechazada = af.estadoAprobacion === 0
                const aprobada  = af.estadoAprobacion === 1
                return (
                <div key={af.afId} className={`border rounded-xl p-4 flex flex-col gap-2 ${
                  rechazada ? 'border-red-200 bg-red-50/40' : 'border-neutral-100'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-[#00304D] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {af.numero}
                      </span>
                      {rechazada && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                          ✗ Rechazada
                        </span>
                      )}
                      {aprobada && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                          ✓ Aprobada
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Link
                        href={`/panel/proyectos/${proyectoId}/acciones/${af.afId}`}
                        className="p-1.5 rounded-lg bg-[#00304D]/10 hover:bg-[#00304D]/20 text-[#00304D] transition"
                        title="Ver detalles"
                      >
                        <Eye size={13} />
                      </Link>
                      {editable && (
                        <button
                          onClick={() => setConfirmElim({ id: af.afId, nombre: af.nombre })}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition"
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-neutral-800 leading-snug">{af.nombre}</p>
                  {rechazada && af.motivoRechazo && (
                    <div className="bg-white border border-red-200 rounded-lg px-3 py-2 text-xs">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-red-700 mb-0.5">Motivo del rechazo</p>
                      <p className="text-neutral-700 whitespace-pre-wrap">{af.motivoRechazo}</p>
                    </div>
                  )}
                  {af.estadoAprobacion === 1 && af.motivoRechazo && (
                    <div className="bg-white border border-emerald-200 rounded-lg px-3 py-2 text-xs">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-0.5">Concepto / observación</p>
                      <p className="text-neutral-700 whitespace-pre-wrap">{af.motivoRechazo}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                    {af.tipoEvento && <span><span className="font-medium">Evento:</span> {af.tipoEvento}</span>}
                    {af.modalidad  && <span><span className="font-medium">Modalidad:</span> {af.modalidad}</span>}
                    <span><span className="font-medium">Beneficiarios:</span> {af.numBenef ?? '—'}</span>
                  </div>
                </div>
                )
              })}
            </div>

            {/* Desktop: tabla */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#00304D]/10 text-[#00304D]">
                    <th className="px-4 py-3 text-center text-xs font-semibold w-16">N° AF</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Nombre de la Acción de Formación</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Evento</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Modalidad</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold w-28">N° Beneficiarios</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {afs.map((af, i) => {
                    const rechazada = af.estadoAprobacion === 0
                    const aprobada  = af.estadoAprobacion === 1
                    return (
                    <Fragment key={af.afId}>
                    <tr className={rechazada
                      ? 'bg-red-50/40'
                      : (i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50')}>
                      <td className="px-4 py-3 text-center">
                        <span className="w-7 h-7 rounded-lg bg-[#00304D] text-white text-xs font-bold inline-flex items-center justify-center">
                          {af.numero}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-800 font-semibold text-xs leading-snug max-w-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{af.nombre}</span>
                          {rechazada && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                              ✗ Rechazada
                            </span>
                          )}
                          {aprobada && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                              ✓ Aprobada
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 text-xs whitespace-nowrap">{af.tipoEvento || '—'}</td>
                      <td className="px-4 py-3 text-neutral-600 text-xs whitespace-nowrap">{af.modalidad  || '—'}</td>
                      <td className="px-4 py-3 text-center text-neutral-700 font-semibold text-xs">{af.numBenef ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/panel/proyectos/${proyectoId}/acciones/${af.afId}`}
                            className="p-1.5 rounded-lg bg-[#00304D]/10 hover:bg-[#00304D]/20 text-[#00304D] transition"
                            title="Ver detalles"
                          >
                            <Eye size={13} />
                          </Link>
                          {editable && (
                            <button
                              onClick={() => setConfirmElim({ id: af.afId, nombre: af.nombre })}
                              className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition"
                              title="Eliminar"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {rechazada && af.motivoRechazo && (
                      <tr className="bg-red-50/40">
                        <td colSpan={6} className="px-4 pb-3 pt-0">
                          <div className="bg-white border border-red-200 rounded-lg px-3 py-2 text-xs">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-red-700 mb-0.5">Motivo del rechazo</p>
                            <p className="text-neutral-700 whitespace-pre-wrap">{af.motivoRechazo}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                    {aprobada && af.motivoRechazo && (
                      <tr className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}>
                        <td colSpan={6} className="px-4 pb-3 pt-0">
                          <div className="bg-white border border-emerald-200 rounded-lg px-3 py-2 text-xs">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-0.5">Concepto / observación</p>
                            <p className="text-neutral-700 whitespace-pre-wrap">{af.motivoRechazo}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Modal crear AF ─────────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => !creando && setModalOpen(false)} maxWidth="max-w-lg">
        <div className="flex flex-col">
          <div className="flex items-center gap-3 px-6 py-4 bg-[#00304D]">
            <ClipboardList size={16} className="text-white" />
            <h2 className="text-white font-bold text-sm flex-1">Nueva Acción de Formación</h2>
            <button onClick={() => setModalOpen(false)} disabled={creando} className="text-white/70 hover:text-white transition">
              <X size={16} />
            </button>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4">

            {/* Nombre */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">
                Nombre de la Acción de Formación <span className="text-red-500">*</span>
              </label>
              <input
                ref={nombreRef}
                type="text"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className="border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30"
                placeholder="Ej. Formación en gestión empresarial"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tipo de evento */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">
                  Tipo de Evento <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.tipoEventoId}
                  onChange={e => setForm(f => ({ ...f, tipoEventoId: e.target.value }))}
                  className="border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 bg-white"
                >
                  <option value="">— Seleccione —</option>
                  {tiposEvento.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>

              {/* Modalidad de formación */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">
                  Modalidad <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.modalidadFormacionId}
                  onChange={e => setForm(f => ({ ...f, modalidadFormacionId: e.target.value }))}
                  className="border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 bg-white"
                >
                  <option value="">— Seleccione —</option>
                  {modalidades.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>

              {/* N° Beneficiarios */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">
                  Número de Beneficiarios <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.numBenef}
                  onChange={e => setForm(f => ({ ...f, numBenef: e.target.value }))}
                  className="border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30"
                  placeholder="Ej. 25"
                  onKeyDown={e => e.key === 'Enter' && handleCrear()}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setModalOpen(false)}
                disabled={creando}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrear}
                disabled={creando}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-[#00304D] hover:bg-[#004a76] text-white transition disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {creando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {creando ? 'Creando...' : 'Crear Acción'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Modal confirmar eliminar ────────────────────────────────────── */}
      <Modal open={!!confirmElim} onClose={() => !eliminando && setConfirmElim(null)} maxWidth="max-w-sm">
        <div className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold text-neutral-800">Eliminar Acción de Formación</h3>
            <p className="text-sm text-neutral-500">
              ¿Está seguro de eliminar la AF{' '}
              <strong className="text-neutral-700">&quot;{confirmElim?.nombre}&quot;</strong>?
              Esta acción no se puede deshacer.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setConfirmElim(null)}
              disabled={eliminando}
              className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarEliminar}
              disabled={eliminando}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition disabled:opacity-60"
            >
              {eliminando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Eliminar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
