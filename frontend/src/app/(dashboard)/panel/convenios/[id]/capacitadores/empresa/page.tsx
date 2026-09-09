'use client'

import { ConvenioNav } from '@/components/layout/convenio-nav'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Modal } from '@/components/ui/modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { UploadPdf, type DocumentoCargado } from '@/components/upload-pdf'
import api from '@/lib/api'
import {
  AlertCircle, Building2, CheckCircle2, ChevronDown, ChevronUp,
  FileText, FolderOpen, Loader2, Plus, Save, Search, Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const TITLE_COLOR = '#39A900'

interface TipoDocumento { id: number; nombre: string }
interface TipoDocAdicional { id: number; nombre: string; sigla: string }

interface Empresa {
  empresaId: number
  tipoDocumentoId: number
  tipoDocumento: string
  identificacion: string | number
  digitoVerificacion: number | null
  razonSocial: string
  sigla: string
  email: string
  telefono: string
  direccion: string
}

interface HVEmpresa {
  hvEmpresaId: number
  empresaId: number
  estado: string | null
  proyectoOrigen: number | null
  habeasData: string | null
  fechaRegistro: string | null
  observacion: string | null
}

interface DocAdicionalEmpresa {
  hvEmpresaDocId: number
  tipoDocId: number
  nombre: string
  sigla: string
  estado: string | null
  proyectoOrigen: number | null
  fechaRegistro: string | null
  documento: { docId: number; nombreArchivo: string; tamanoBytes: number | null } | null
}

export default function EmpresaCapacitadoraPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const proyectoId = Number(id)
  const empresaIdQuery = Number(searchParams?.get('empresaId') ?? 0)

  const [tiposDoc, setTiposDoc] = useState<TipoDocumento[]>([])
  const [tiposDA, setTiposDA] = useState<TipoDocAdicional[]>([])

  // Búsqueda
  const [busqueda, setBusqueda] = useState({ tipoDocumentoId: '', identificacion: '' })
  const [buscando, setBuscando] = useState(false)
  const [yaBuscado, setYaBuscado] = useState(false)

  // Empresa y form
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [form, setForm] = useState({ razonSocial: '', sigla: '', email: '', telefono: '', direccion: '', digitoVerificacion: '' })
  const [guardando, setGuardando] = useState(false)
  const [editando, setEditando] = useState(false)

  // HV
  const [hv, setHv] = useState<HVEmpresa | null>(null)
  const [hvDoc, setHvDoc] = useState<DocumentoCargado | null>(null)
  const [cargandoHv, setCargandoHv] = useState(false)

  // Registrar como capacitador
  const [registrando, setRegistrando] = useState(false)
  const [yaRegistrada, setYaRegistrada] = useState(false)

  // Otros documentos adicionales
  const [docsAdic, setDocsAdic] = useState<DocAdicionalEmpresa[]>([])
  const [cargandoDA, setCargandoDA] = useState(false)
  const [daModalOpen, setDAModalOpen] = useState(false)
  const [daForm, setDAForm] = useState({ tipoDocId: '' })
  const [daGuardando, setDAGuardando] = useState(false)
  const [daConfirmEliminar, setDAConfirmEliminar] = useState<number | null>(null)
  const [daEliminandoId, setDAEliminandoId] = useState<number | null>(null)
  const [expandedDAId, setExpandedDAId] = useState<number | null>(null)

  const [toastVisible, setToastVisible] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error' | 'warning'; titulo: string; msg: string } | null>(null)
  function showToast(tipo: 'success' | 'error' | 'warning', titulo: string, msg: string) {
    setToast({ tipo, titulo, msg })
    setToastVisible(true)
  }

  function fillForm(e: Empresa) {
    setForm({
      razonSocial: e.razonSocial ?? '',
      sigla: e.sigla ?? '',
      email: e.email ?? '',
      telefono: e.telefono ?? '',
      direccion: e.direccion ?? '',
      digitoVerificacion: String(e.digitoVerificacion ?? ''),
    })
  }

  async function cargarHV(empresaId: number) {
    try {
      setCargandoHv(true)
      const r = await api.get<HVEmpresa>(`/capacitadores/empresa/${empresaId}/hv`)
      setHv(r.data)
      if (r.data?.hvEmpresaId) {
        const rDoc = await api.get<DocumentoCargado[]>(`/capacitadores/empresa/${empresaId}/documentos`, {
          params: { tipo: 'HV', num: r.data.hvEmpresaId },
        })
        setHvDoc(rDoc.data?.[0] ?? null)
      }
    } catch {
      setHv(null)
      setHvDoc(null)
    } finally {
      setCargandoHv(false)
    }
  }

  async function cargarDocsAdic(empresaId: number) {
    try {
      setCargandoDA(true)
      const r = await api.get<DocAdicionalEmpresa[]>(`/capacitadores/empresa/${empresaId}/docs-adicionales`)
      setDocsAdic(r.data ?? [])
    } catch {
      setDocsAdic([])
    } finally {
      setCargandoDA(false)
    }
  }

  async function cargarEmpresa(empresaId: number) {
    const r = await api.get<Empresa>(`/capacitadores/empresa/${empresaId}`)
    setEmpresa(r.data)
    fillForm(r.data)
    setYaBuscado(true)
    await Promise.all([cargarHV(empresaId), cargarDocsAdic(empresaId)])
  }

  async function verificarRegistro(empresaId: number) {
    try {
      const r = await api.get<any[]>(`/capacitadores/proyecto/${proyectoId}/empresas`)
      setYaRegistrada((r.data ?? []).some((e: any) => Number(e.empresaId) === empresaId))
    } catch { setYaRegistrada(false) }
  }

  useEffect(() => {
    document.title = 'Empresa Capacitadora | SEP'
    api.get<TipoDocumento[]>('/capacitadores/empresa/tipos-doc').then(r => setTiposDoc(r.data ?? [])).catch(() => {})
    api.get<TipoDocAdicional[]>('/personas/catalogos/tipos-doc-adicional').then(r => setTiposDA(r.data ?? [])).catch(() => {})
    if (empresaIdQuery > 0) {
      cargarEmpresa(empresaIdQuery)
      verificarRegistro(empresaIdQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaIdQuery])

  async function handleBuscar() {
    if (!busqueda.tipoDocumentoId || !busqueda.identificacion.trim()) {
      showToast('warning', 'Incompleto', 'Selecciona tipo e ingresa número de documento.')
      return
    }
    setBuscando(true)
    setEmpresa(null)
    setHv(null)
    setHvDoc(null)
    setDocsAdic([])
    setYaBuscado(false)
    setYaRegistrada(false)
    try {
      const r = await api.get<Empresa | null>('/capacitadores/empresa/buscar', {
        params: { tipoDocId: busqueda.tipoDocumentoId, identificacion: busqueda.identificacion.trim() },
      })
      if (!r.data) {
        showToast('warning', 'No encontrada', 'La empresa no existe en el sistema. Completa el formulario para crearla.')
        setYaBuscado(true)
        return
      }
      setEmpresa(r.data)
      fillForm(r.data)
      setYaBuscado(true)
      await Promise.all([cargarHV(r.data.empresaId), cargarDocsAdic(r.data.empresaId), verificarRegistro(r.data.empresaId)])
    } catch (e: any) {
      showToast('error', 'Error', e?.response?.data?.message ?? 'Error al buscar.')
    } finally {
      setBuscando(false)
    }
  }

  async function handleGuardar() {
    if (!form.razonSocial.trim() || !form.sigla.trim() || !form.email.trim() || !form.telefono.trim() || !form.direccion.trim()) {
      showToast('warning', 'Incompleto', 'Completa todos los campos obligatorios.')
      return
    }
    setGuardando(true)
    try {
      let emp = empresa
      if (!emp) {
        const tipo = tiposDoc.find(t => String(t.id) === busqueda.tipoDocumentoId)
        const r = await api.post<{ empresaId: number }>('/capacitadores/empresa', {
          tipoDocumentoId: Number(busqueda.tipoDocumentoId),
          identificacion: busqueda.identificacion.trim(),
          digitoVerificacion: form.digitoVerificacion ? Number(form.digitoVerificacion) : 0,
          razonSocial: form.razonSocial.trim(),
          sigla: form.sigla.trim(),
          email: form.email.trim(),
          telefono: form.telefono.trim(),
          direccion: form.direccion.trim(),
        })
        await cargarEmpresa(r.data.empresaId)
        emp = { ...form, empresaId: r.data.empresaId, tipoDocumentoId: Number(busqueda.tipoDocumentoId), tipoDocumento: tipo?.nombre ?? '', identificacion: busqueda.identificacion, digitoVerificacion: Number(form.digitoVerificacion) }
        setEmpresa(emp as Empresa)
        showToast('success', 'Empresa creada', 'La empresa fue registrada exitosamente.')
      } else {
        await api.put(`/capacitadores/empresa/${emp.empresaId}`, {
          razonSocial: form.razonSocial.trim(),
          sigla: form.sigla.trim(),
          email: form.email.trim(),
          telefono: form.telefono.trim(),
          direccion: form.direccion.trim(),
          digitoVerificacion: form.digitoVerificacion ? Number(form.digitoVerificacion) : undefined,
        })
        showToast('success', 'Actualizada', 'Datos de la empresa actualizados.')
        setEditando(false)
        await cargarEmpresa(emp.empresaId)
      }
    } catch (e: any) {
      showToast('error', 'Error', e?.response?.data?.message ?? 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function handleIniciarHV() {
    if (!empresa) return
    try {
      await api.post(`/capacitadores/empresa/${empresa.empresaId}/hv`, { proyectoId })
      await cargarHV(empresa.empresaId)
      showToast('success', 'HV iniciada', 'Registro de hoja de vida creado.')
    } catch (e: any) {
      showToast('error', 'Error', e?.response?.data?.message ?? 'No se pudo iniciar la HV.')
    }
  }

  async function handleRegistrar() {
    if (!empresa) return
    setRegistrando(true)
    try {
      await api.post(`/capacitadores/proyecto/${proyectoId}/empresa/${empresa.empresaId}`)
      setYaRegistrada(true)
      showToast('success', 'Registrada', `${empresa.razonSocial} fue registrada como capacitadora del convenio.`)
    } catch (e: any) {
      showToast('error', 'Error', e?.response?.data?.message ?? 'No se pudo registrar.')
    } finally {
      setRegistrando(false)
    }
  }

  async function handleGuardarDA() {
    if (!empresa || !daForm.tipoDocId) { showToast('warning', 'Incompleto', 'Selecciona el tipo de documento.'); return }
    setDAGuardando(true)
    try {
      await api.post(`/capacitadores/empresa/${empresa.empresaId}/docs-adicionales`, {
        tipoDocId: Number(daForm.tipoDocId), proyectoId,
      })
      setDAModalOpen(false)
      setDAForm({ tipoDocId: '' })
      await cargarDocsAdic(empresa.empresaId)
      showToast('success', 'Documento agregado', 'El documento adicional fue agregado.')
    } catch (e: any) {
      showToast('error', 'Error', e?.response?.data?.message ?? 'No se pudo agregar.')
    } finally {
      setDAGuardando(false)
    }
  }

  async function handleEliminarDA(hvEmpresaDocId: number) {
    if (!empresa) return
    setDAEliminandoId(hvEmpresaDocId)
    try {
      await api.delete(`/capacitadores/empresa/docs-adicionales/${hvEmpresaDocId}`, {
        params: { empresaId: empresa.empresaId },
      })
      setDAConfirmEliminar(null)
      await cargarDocsAdic(empresa.empresaId)
      showToast('success', 'Eliminado', 'Documento adicional eliminado.')
    } catch (e: any) {
      showToast('error', 'Error', e?.response?.data?.message ?? 'No se pudo eliminar.')
    } finally {
      setDAEliminandoId(null)
    }
  }

  const puedeEditar = empresa !== null
  const [convenioEnEjecucion, setConvenioEnEjecucion] = useState<boolean | null>(null)
  useEffect(() => {
    if (!proyectoId) return
    api.get<{ estadoNum: number | null }>(`/convenios/${proyectoId}`)
      .then(r => setConvenioEnEjecucion(Number(r.data?.estadoNum) === 1))
      .catch(() => setConvenioEnEjecucion(false))
  }, [proyectoId])
  const bloqueadoPorConvenio = convenioEnEjecucion === false

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      <ToastBetowa
        show={toastVisible}
        onClose={() => setToastVisible(false)}
        tipo={toast?.tipo ?? 'success'}
        titulo={toast?.titulo ?? ''}
        mensaje={toast?.msg ?? ''}
        duration={5000}
      />

      <ConvenioNav proyectoId={proyectoId} />

      {bloqueadoPorConvenio && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle size={16} />
          <span><strong>Convenio no está en ejecución.</strong> Esta página está en modo solo lectura: no se puede crear, editar ni subir documentos de la empresa capacitadora.</span>
        </div>
      )}

      <div className={bloqueadoPorConvenio ? 'pointer-events-none opacity-60 select-none' : ''}>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="h-1.5" style={{ background: 'linear-gradient(to right,#39A900,#0070C0)' }} />
        <div className="p-5 sm:p-6 flex items-center gap-3 border-b border-neutral-100 flex-wrap">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${TITLE_COLOR}15` }}>
            <Building2 size={20} style={{ color: TITLE_COLOR }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Capacitador Jurídico — Empresa</p>
            <h1 className="text-base sm:text-lg font-bold text-[#00304D]">
              {empresa ? empresa.razonSocial : 'Buscar empresa capacitadora'}
            </h1>
          </div>
          <Link
            href={`/panel/convenios/${proyectoId}/capacitadores`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-500 border border-neutral-200 rounded-xl hover:bg-neutral-50 hover:text-[#00304D] transition shrink-0">
            ← Volver a Capacitadores
          </Link>
        </div>

        {/* 1. Búsqueda */}
        <section className="border-b border-neutral-100">
          <header className="px-5 py-3 flex items-center gap-2 bg-gradient-to-r from-[#39A900]/5 to-transparent border-b border-neutral-100">
            <Search size={15} style={{ color: TITLE_COLOR }} />
            <h2 className="text-sm font-bold text-[#00304D]">1. Buscar empresa</h2>
          </header>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Tipo de documento *</label>
              <select value={busqueda.tipoDocumentoId}
                onChange={e => setBusqueda(b => ({ ...b, tipoDocumentoId: e.target.value }))}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#39A900]">
                <option value="">Seleccionar</option>
                {tiposDoc.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Identificación / NIT *</label>
              <input value={busqueda.identificacion}
                onChange={e => setBusqueda(b => ({ ...b, identificacion: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleBuscar()}
                placeholder="Ej: 860078643"
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#39A900]" />
            </div>
            <button onClick={handleBuscar} disabled={buscando}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition"
              style={{ backgroundColor: TITLE_COLOR }}>
              {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar
            </button>
          </div>
        </section>

        {/* 2. Datos de la empresa */}
        {yaBuscado && (
          <section className="border-b border-neutral-100">
            <header className="px-5 py-3 flex items-center justify-between gap-2 bg-gradient-to-r from-[#39A900]/5 to-transparent border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Building2 size={15} style={{ color: TITLE_COLOR }} />
                <h2 className="text-sm font-bold text-[#00304D]">2. Datos de la empresa</h2>
              </div>
              {empresa && !editando && (
                <button onClick={() => setEditando(true)}
                  className="text-[11px] font-semibold px-3 py-1 rounded-lg border border-[#39A900] text-[#39A900] hover:bg-[#39A900]/5 transition">
                  Editar
                </button>
              )}
            </header>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Group label="Razón Social *">
                <input value={form.razonSocial} onChange={e => setForm(f => ({ ...f, razonSocial: e.target.value.toUpperCase() }))}
                  disabled={!!empresa && !editando} maxLength={200}
                  className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#39A900] disabled:bg-neutral-50 uppercase w-full" />
              </Group>
              <Group label="Sigla *">
                <input value={form.sigla} onChange={e => setForm(f => ({ ...f, sigla: e.target.value.toUpperCase() }))}
                  disabled={!!empresa && !editando} maxLength={100}
                  className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#39A900] disabled:bg-neutral-50 uppercase w-full" />
              </Group>
              <Group label="Dígito de verificación">
                <input value={form.digitoVerificacion} onChange={e => setForm(f => ({ ...f, digitoVerificacion: e.target.value }))}
                  disabled={!!empresa && !editando} maxLength={2} type="number"
                  className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#39A900] disabled:bg-neutral-50 w-full" />
              </Group>
              <Group label="Correo electrónico *">
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  disabled={!!empresa && !editando} maxLength={200}
                  className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#39A900] disabled:bg-neutral-50 w-full" />
              </Group>
              <Group label="Teléfono *">
                <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                  disabled={!!empresa && !editando} maxLength={20}
                  className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#39A900] disabled:bg-neutral-50 w-full" />
              </Group>
              <Group label="Dirección *">
                <input value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value.toUpperCase() }))}
                  disabled={!!empresa && !editando} maxLength={300}
                  className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#39A900] disabled:bg-neutral-50 uppercase w-full" />
              </Group>
            </div>

            {(!empresa || editando) && (
              <div className="px-5 pb-5 flex justify-end gap-2">
                {editando && (
                  <button onClick={() => { setEditando(false); if (empresa) fillForm(empresa) }}
                    className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition">
                    Cancelar
                  </button>
                )}
                <button onClick={handleGuardar} disabled={guardando}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition"
                  style={{ backgroundColor: TITLE_COLOR }}>
                  {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {empresa ? 'Actualizar' : 'Guardar empresa'}
                </button>
              </div>
            )}

            {/* Registrar como capacitadora */}
            {empresa && (
              <div className="px-5 pb-5">
                {yaRegistrada ? (
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
                    <CheckCircle2 size={14} /> Ya registrada como capacitadora del convenio
                  </div>
                ) : (
                  <button onClick={handleRegistrar} disabled={registrando}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition bg-[#0070C0] hover:bg-[#005a9e]">
                    {registrando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Registrar como Capacitadora del Convenio
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* 3. Hoja de Vida (HV PDF) */}
        {empresa && (
          <section className="border-b border-neutral-100">
            <header className="px-5 py-3 flex items-center gap-2 bg-gradient-to-r from-[#0070C0]/5 to-transparent border-b border-neutral-100">
              <FileText size={15} className="text-[#0070C0]" />
              <h2 className="text-sm font-bold text-[#00304D]">3. Hoja de Vida (PDF)</h2>
            </header>
            <div className="p-5">
              {cargandoHv ? (
                <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-[#0070C0]" /></div>
              ) : !hv ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-neutral-600">No hay registro de hoja de vida. Inicia el proceso para habilitar la carga del PDF.</p>
                  <button onClick={handleIniciarHV}
                    className="self-start inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition bg-[#0070C0] hover:bg-[#005a9e]">
                    <Plus size={14} /> Iniciar registro de HV
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${hv.estado === 'APROBADO' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {hv.estado ?? 'PENDIENTE'}
                    </span>
                  </div>
                  <UploadPdf
                    label="Cargar / reemplazar HV (PDF)"
                    endpoint={`/capacitadores/empresa/${empresa.empresaId}/documentos`}
                    extraFields={{ tipo: 'HV', num: String(hv.hvEmpresaId) }}
                    downloadUrl={hvDoc ? `/capacitadores/empresa/documentos/${hvDoc.docId}/archivo` : undefined}
                    docActual={hvDoc}
                    soloLectura={hv.estado === 'APROBADO'}
                    onUploadSuccess={async () => {
                      await cargarHV(empresa.empresaId)
                      showToast('success', 'Cargado', 'HV cargada correctamente.')
                    }}
                  />
                </div>
              )}
            </div>
          </section>
        )}

        {/* 4. Otros documentos adicionales */}
        {empresa && (
          <section>
            <header className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between gap-2 bg-gradient-to-r from-[#39A900]/5 to-transparent flex-wrap">
              <div className="flex items-center gap-2">
                <FolderOpen size={15} style={{ color: TITLE_COLOR }} />
                <h2 className="text-sm font-bold text-[#00304D]">4. Otros Documentos</h2>
                {docsAdic.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#39A900]/10 text-[#39A900]">
                    {docsAdic.length}
                  </span>
                )}
              </div>
              <button onClick={() => { setDAModalOpen(true); setDAForm({ tipoDocId: '' }) }}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white transition"
                style={{ backgroundColor: TITLE_COLOR }}>
                <Plus size={12} /> Agregar
              </button>
            </header>

            <div className="p-5">
              {cargandoDA ? (
                <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-[#39A900]" /></div>
              ) : docsAdic.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-6">Sin documentos adicionales registrados.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {docsAdic.map(da => {
                    const isOpen = expandedDAId === da.hvEmpresaDocId
                    const aprobado = (da.estado ?? '').trim().toUpperCase() === 'APROBADO'
                    return (
                      <div key={da.hvEmpresaDocId} className="rounded-xl border border-neutral-200 overflow-hidden">
                        <button
                          className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-neutral-50 transition"
                          onClick={() => setExpandedDAId(isOpen ? null : da.hvEmpresaDocId)}>
                          <FolderOpen size={15} style={{ color: TITLE_COLOR }} className="shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-[#00304D] truncate block">{da.nombre}</span>
                            <span className="text-[10px] text-neutral-500">{da.sigla}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${aprobado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {da.estado ?? 'PENDIENTE'}
                            </span>
                            {da.documento && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">PDF</span>
                            )}
                            {isOpen ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
                          </div>
                        </button>
                        {isOpen && (
                          <div className="border-t border-neutral-100 p-4 flex flex-col gap-3 bg-neutral-50">
                            <UploadPdf
                              label="Cargar documento (PDF)"
                              endpoint={`/capacitadores/empresa/${empresa.empresaId}/documentos`}
                              extraFields={{ tipo: 'DA', num: String(da.hvEmpresaDocId) }}
                              downloadUrl={da.documento ? `/capacitadores/empresa/documentos/${da.documento.docId}/archivo` : undefined}
                              docActual={da.documento ? {
                                docId: da.documento.docId,
                                nombreArchivo: da.documento.nombreArchivo,
                                tamanoBytes: da.documento.tamanoBytes,
                                tipo: 'DA',
                                num: da.hvEmpresaDocId,
                                fechaRegistro: null,
                              } : null}
                              soloLectura={aprobado}
                              onUploadSuccess={async () => {
                                await cargarDocsAdic(empresa.empresaId)
                                showToast('success', 'Cargado', 'Documento cargado correctamente.')
                              }}
                            />
                            {!aprobado && (
                              <button onClick={() => setDAConfirmEliminar(da.hvEmpresaDocId)}
                                className="self-start inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition">
                                <Trash2 size={12} /> Eliminar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Modal agregar DA */}
      <Modal open={daModalOpen} onClose={() => setDAModalOpen(false)} maxWidth="max-w-sm">
        <div className="flex flex-col gap-4 p-5">
          <h3 className="text-base font-bold text-[#00304D]">Agregar documento adicional</h3>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Tipo de documento *</label>
            <select value={daForm.tipoDocId} onChange={e => setDAForm({ tipoDocId: e.target.value })}
              className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#39A900]">
              <option value="">Seleccionar</option>
              {tiposDA.filter(t => !docsAdic.some(d => d.tipoDocId === t.id)).map(t => (
                <option key={t.id} value={t.id}>{t.nombre} ({t.sigla})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDAModalOpen(false)}
              className="px-4 py-2 text-sm text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition">
              Cancelar
            </button>
            <button onClick={handleGuardarDA} disabled={daGuardando || !daForm.tipoDocId}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition"
              style={{ backgroundColor: TITLE_COLOR }}>
              {daGuardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Agregar
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm eliminar DA */}
      <ConfirmModal
        open={daConfirmEliminar !== null}
        tipo="delete"
        titulo="Eliminar documento"
        mensaje="¿Confirmas que deseas eliminar este documento adicional? Esta acción no se puede deshacer."
        textoConfirmar="Eliminar"
        onConfirm={() => daConfirmEliminar !== null && handleEliminarDA(daConfirmEliminar)}
        onClose={() => setDAConfirmEliminar(null)}
        cargando={daEliminandoId !== null}
      />

      </div>
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</label>
      {children}
    </div>
  )
}
