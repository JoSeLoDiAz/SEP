'use client'

import api from '@/lib/api'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { Modal } from '@/components/ui/modal'
import { BookUser, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Proyecto { proyectoId: number; proyectoNombre: string }
interface TipoDoc   { id: number; nombre: string }

interface Contacto {
  contactoId: number
  nombre: string
  cargo: string
  correo: string
  telefono: string | null
  documento: string | null
  tipoIdentificacionId: number | null
  proyectoId: number | null
  proyectoNombre: string | null
}

interface Form {
  nombre: string
  cargo: string
  correo: string
  telefono: string
  documento: string
  tipoIdentificacionId: string
  proyectoId: string
}

const CARGOS = ['Representante Legal', 'Responsable del Proyecto', 'Contacto Administrativo']
const FORM_VACIO: Form = {
  nombre: '', cargo: CARGOS[0], correo: '',
  telefono: '', documento: '', tipoIdentificacionId: '', proyectoId: '',
}

export default function ContactosPage() {
  const [contactos, setContactos]   = useState<Contacto[]>([])
  const [proyectos, setProyectos]   = useState<Proyecto[]>([])
  const [tiposDoc, setTiposDoc]     = useState<TipoDoc[]>([])
  const [loading, setLoading]       = useState(true)
  const [guardando, setGuardando]   = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState<{ id: number; nombre: string } | null>(null)
  const [form, setForm] = useState<Form>(FORM_VACIO)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)
  const toastKey = useRef(0)
  const [toastKey2, setToastKey2] = useState(0)

  function showToast(tipo: 'success' | 'error', msg: string) {
    toastKey.current++
    setToast({ tipo, msg })
    setToastKey2(toastKey.current)
  }

  async function cargar() {
    try {
      const [resC, resP, resT] = await Promise.all([
        api.get<Contacto[]>('/contactos'),
        api.get<Proyecto[]>('/contactos/proyectos'),
        api.get<TipoDoc[]>('/contactos/tipos-doc'),
      ])
      setContactos(resC.data)
      setProyectos(resP.data)
      setTiposDoc(resT.data)
    } catch {
      showToast('error', 'Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { document.title = 'Contactos | SEP' }, [])
  useEffect(() => { cargar() }, [])

  function abrirNuevo() {
    setEditandoId(null)
    setForm(FORM_VACIO)
    setMostrarForm(true)
  }

  function abrirEditar(c: Contacto) {
    setEditandoId(c.contactoId)
    setForm({
      nombre: c.nombre,
      cargo: c.cargo,
      correo: c.correo,
      telefono: c.telefono ?? '',
      documento: c.documento ?? '',
      tipoIdentificacionId: c.tipoIdentificacionId?.toString() ?? '',
      proyectoId: c.proyectoId?.toString() ?? '',
    })
    setMostrarForm(true)
  }

  function cancelar() {
    setMostrarForm(false)
    setEditandoId(null)
    setForm(FORM_VACIO)
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.cargo || !form.correo.trim()) {
      showToast('error', 'Nombre, cargo y correo son obligatorios')
      return
    }
    setGuardando(true)
    try {
      const payload = {
        nombre: form.nombre,
        cargo: form.cargo,
        correo: form.correo,
        telefono: form.telefono || undefined,
        documento: form.documento || undefined,
        tipoIdentificacionId: form.tipoIdentificacionId ? Number(form.tipoIdentificacionId) : null,
        proyectoId: form.proyectoId ? Number(form.proyectoId) : null,
      }
      if (editandoId !== null) {
        await api.put(`/contactos/${editandoId}`, payload)
        showToast('success', 'Contacto actualizado correctamente')
      } else {
        await api.post('/contactos', payload)
        showToast('success', 'Contacto registrado correctamente')
      }
      cancelar()
      await cargar()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar'
      showToast('error', msg)
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarEliminar() {
    if (!confirmEliminar) return
    setEliminando(true)
    try {
      await api.delete(`/contactos/${confirmEliminar.id}`)
      setConfirmEliminar(null)
      showToast('success', 'Contacto eliminado')
      await cargar()
    } catch {
      showToast('error', 'Error al eliminar el contacto')
    } finally {
      setEliminando(false)
    }
  }

  function labelProyecto(c: Contacto) {
    if (c.proyectoNombre) return c.proyectoNombre
    return 'No asignado a proyecto'
  }

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

      {/* Encabezado */}
      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex items-center gap-3">
        <BookUser size={22} className="text-white" />
        <h1 className="text-white font-bold text-base">
          Contactos de la Empresa / Gremio / Asociación
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-[#00304D]" />
        </div>
      ) : (
        <>
          {/* Tarjetas móvil / Tabla desktop */}
          {contactos.length > 0 && (
            <>
              {/* Móvil: tarjetas */}
              <div className="flex flex-col gap-3 md:hidden">
                {contactos.map(c => (
                  <div key={c.contactoId} className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-[#00304D] bg-[#00304D]/10 px-2 py-1 rounded-lg leading-tight">{c.cargo}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => abrirEditar(c)} className="p-1.5 rounded-lg bg-[#00304D]/10 hover:bg-[#00304D]/20 text-[#00304D] transition-colors" title="Editar"><Pencil size={14} /></button>
                        <button onClick={() => setConfirmEliminar({ id: c.contactoId, nombre: c.nombre })} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-neutral-800">{c.nombre}</p>
                    <p className="text-xs text-neutral-500">{c.correo}</p>
                    {c.telefono && <p className="text-xs text-neutral-500">Tel: {c.telefono}</p>}
                    <div className="pt-1">
                      {c.proyectoNombre
                        ? <span className="inline-flex items-center px-2 py-1 rounded-lg bg-[#00304D]/10 text-[#00304D] text-xs font-medium">{c.proyectoNombre}</span>
                        : <span className="text-neutral-400 text-xs italic">No asignado a proyecto</span>
                      }
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: tabla */}
              <div className="hidden md:block bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#00304D] text-white">
                    <th className="px-4 py-3 text-left font-semibold">Cargo</th>
                    <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                    <th className="px-4 py-3 text-left font-semibold">Correo</th>
                    <th className="px-4 py-3 text-left font-semibold">Proyecto</th>
                    <th className="px-4 py-3 text-center font-semibold">Teléfono</th>
                    <th className="px-4 py-3 text-center font-semibold w-20">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {contactos.map((c, i) => (
                    <tr key={c.contactoId} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                      <td className="px-4 py-3 text-neutral-700 font-medium whitespace-nowrap">{c.cargo}</td>
                      <td className="px-4 py-3 text-neutral-700">{c.nombre}</td>
                      <td className="px-4 py-3 text-neutral-600 text-xs">{c.correo}</td>
                      <td className="px-4 py-3">
                        {c.proyectoNombre
                          ? <span className="inline-flex items-center px-2 py-1 rounded-lg bg-[#00304D]/10 text-[#00304D] text-xs font-medium">{c.proyectoNombre}</span>
                          : <span className="text-neutral-400 text-xs italic">No asignado a proyecto</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-center text-neutral-600 text-xs">{c.telefono || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => abrirEditar(c)} className="p-1.5 rounded-lg bg-[#00304D]/10 hover:bg-[#00304D]/20 text-[#00304D] transition-colors" title="Editar"><Pencil size={14} /></button>
                          <button onClick={() => setConfirmEliminar({ id: c.contactoId, nombre: c.nombre })} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}

          {/* Formulario */}
          {mostrarForm && (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 flex flex-col gap-4">
              <h2 className="text-sm font-bold text-neutral-700">
                {editandoId !== null ? 'Editar contacto' : 'Nuevo contacto'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cargo */}
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Cargo <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.cargo}
                    onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
                    className="border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30"
                  >
                    {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Nombre */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Nombre completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    className="border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30"
                    placeholder="Nombre y apellidos"
                  />
                </div>

                {/* Correo */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Correo electrónico <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.correo}
                    onChange={e => setForm(f => ({ ...f, correo: e.target.value }))}
                    className="border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30"
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                {/* Tipo documento */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Tipo de identificación</label>
                  <select
                    value={form.tipoIdentificacionId}
                    onChange={e => setForm(f => ({ ...f, tipoIdentificacionId: e.target.value }))}
                    className="border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 bg-white"
                  >
                    <option value="">— Seleccione —</option>
                    {tiposDoc.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>

                {/* Número documento */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Número de documento</label>
                  <input
                    type="text"
                    value={form.documento}
                    onChange={e => setForm(f => ({ ...f, documento: e.target.value }))}
                    className="border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30"
                    placeholder="Número de identificación"
                  />
                </div>

                {/* Teléfono */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Teléfono</label>
                  <input
                    type="text"
                    value={form.telefono}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    className="border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30"
                    placeholder="Ej. 6014567890"
                  />
                </div>

                {/* Proyecto */}
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Proyecto asociado</label>
                  <select
                    value={form.proyectoId}
                    onChange={e => setForm(f => ({ ...f, proyectoId: e.target.value }))}
                    className="border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 bg-white"
                  >
                    <option value="">— No asignado a proyecto —</option>
                    {proyectos.map(p => (
                      <option key={p.proyectoId} value={p.proyectoId}>{p.proyectoNombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00304D] hover:bg-[#004a76] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Guardar
                </button>
                <button
                  onClick={cancelar}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-600 text-sm font-medium rounded-xl transition-colors"
                >
                  <X size={15} />
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Botón agregar */}
          {!mostrarForm && (
            <div className="flex justify-end">
              <button
                onClick={abrirNuevo}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00304D] hover:bg-[#004a76] text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Plus size={15} />
                Agregar contacto
              </button>
            </div>
          )}

          {contactos.length === 0 && !mostrarForm && (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-10 text-center text-neutral-400 text-sm">
              No hay contactos registrados. Use <strong>Agregar contacto</strong> para añadir uno.
            </div>
          )}
        </>
      )}

      {/* Modal confirmar eliminación */}
      <Modal open={!!confirmEliminar} onClose={() => !eliminando && setConfirmEliminar(null)} maxWidth="max-w-sm">
        <div className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold text-neutral-800">Eliminar contacto</h3>
            <p className="text-sm text-neutral-500">
              ¿Está seguro de eliminar a{' '}
              <strong className="text-neutral-700">{confirmEliminar?.nombre}</strong>?
              Esta acción no se puede deshacer.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setConfirmEliminar(null)}
              disabled={eliminando}
              className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarEliminar}
              disabled={eliminando}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-60"
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
