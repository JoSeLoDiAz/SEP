'use client'

import { ConvenioNav } from '@/components/layout/convenio-nav'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Modal } from '@/components/ui/modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { UploadPdf, type DocumentoCargado } from '@/components/upload-pdf'
import api from '@/lib/api'
import { getSepUsuario } from '@/lib/auth'
import {
  AlertCircle, Briefcase, CheckCircle2, ChevronDown, FileText, FolderOpen, GraduationCap,
  IdCard, Loader2, Lock, Pencil, Plus, Save, Search, ShieldCheck, Trash2,
  UserPlus, UserSquare2,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface TipoDocumento { id: number; nombre: string }
interface TipoExperiencia { id: number; nombre: string }

interface Experiencia {
  experienciaId: number
  personaId: number
  tipoExperienciaId: number
  tipoExperiencia: string | null
  descripcion: string
  fechaInicio: string | null
  fechaFin: string | null
  fechaRegistro: string | null
  fechaActualizacion: string | null
  estadoArchivo: string | null
  proyectoOrigen: number | null
  convocatoriaOrigen: number | null
  convocatoriaActual: number | null
  // lo registró otro proyecto de la misma convocatoria: no editable aquí
  mismaConvocatoria: boolean
}

interface FormExperiencia {
  tipoExperienciaId: string
  descripcion: string
  fechaInicio: string
  fechaFin: string
}

const FORM_EXP_DEFAULTS: FormExperiencia = {
  tipoExperienciaId: '',
  descripcion: '',
  fechaInicio: '',
  fechaFin: '',
}

interface TipoTitulo { id: number; nombre: string; rango?: number | null }

interface Titulo {
  tituloId: number
  personaId: number
  tipoTituloId: number
  tipoTitulo: string | null
  descripcion: string
  fechaGraduacion: string | null
  fechaRegistro: string | null
  fechaActualizacion: string | null
  estadoArchivo: string | null
  proyectoOrigen: number | null
  convocatoriaOrigen: number | null
  convocatoriaActual: number | null
  mismaConvocatoria: boolean
}

interface FormTitulo {
  tipoTituloId: string
  descripcion: string
  fechaGraduacion: string
}

const FORM_TIT_DEFAULTS: FormTitulo = {
  tipoTituloId: '',
  descripcion: '',
  fechaGraduacion: '',
}

interface TipoDocAdicional { id: number; nombre: string; sigla: string }

interface DocAdicional {
  docAdicId: number
  personaId: number
  tipoDocId: number
  nombre: string
  sigla: string
  proyectoOrigen: number | null
  estado: string | null
  fechaRegistro: string | null
  documento: DocumentoCargado | null
}

interface Persona {
  personaId: number
  tipoDocumentoId: number
  identificacion: string
  nombres: string
  primerApellido: string
  segundoApellido: string | null
  email: string
  emailInstitucional: string | null
  celular: string | null
  telefono: string | null
  habeasData: string | null
  habeasDataE: string | null
  tipoDocumento?: string | null
  idEmpresa?: number | null
}

interface FormPersona {
  tipoDocumentoId: string
  identificacion: string
  nombres: string
  primerApellido: string
  segundoApellido: string
  email: string
  emailInstitucional: string
  celular: string
  telefono: string
  habeasData: boolean
}

const FORM_DEFAULTS: FormPersona = {
  tipoDocumentoId: '',
  identificacion: '',
  nombres: '',
  primerApellido: '',
  segundoApellido: '',
  email: '',
  emailInstitucional: '',
  celular: '',
  telefono: '',
  habeasData: false,
}

const TITLE_COLOR = '#00304D'

function formatDuracion(fi: Date | null, ff: Date | null): string {
  if (!fi || !ff) return '—'
  // inclusivo: el día final cuenta
  const ffIncl = new Date(ff.getTime() + 86400000)
  let anos = ffIncl.getFullYear() - fi.getFullYear()
  let meses = ffIncl.getMonth() - fi.getMonth()
  let dias = ffIncl.getDate() - fi.getDate()
  if (dias < 0) { meses--; dias += new Date(ffIncl.getFullYear(), ffIncl.getMonth(), 0).getDate() }
  if (meses < 0) { anos--; meses += 12 }
  const p: string[] = []
  if (anos > 0) p.push(`${anos} ${anos === 1 ? 'año' : 'años'}`)
  if (meses > 0) p.push(`${meses} ${meses === 1 ? 'mes' : 'meses'}`)
  if (dias > 0) p.push(`${dias} ${dias === 1 ? 'día' : 'días'}`)
  return p.join(' ') || '0 días'
}

function formatTotalDias(totalDias: number): string {
  const anos = Math.floor(totalDias / 365)
  const restante = totalDias % 365
  const meses = Math.floor(restante / 30)
  const dias = restante % 30
  const p: string[] = []
  if (anos > 0) p.push(`${anos} ${anos === 1 ? 'año' : 'años'}`)
  if (meses > 0) p.push(`${meses} ${meses === 1 ? 'mes' : 'meses'}`)
  if (dias > 0) p.push(`${dias} ${dias === 1 ? 'día' : 'días'}`)
  return p.join(' ') || '0 días'
}

export default function HVDirectorPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const proyectoId = Number(id)
  const personaIdQuery = Number(searchParams?.get('personaId') ?? 0)
  const modoCapacitador = searchParams?.get('modo') === 'cap'

  const [tiposDoc, setTiposDoc] = useState<TipoDocumento[]>([])
  const [perfilId, setPerfilId] = useState(0)

  const [busqueda, setBusqueda] = useState({ tipoDocumentoId: '', identificacion: '' })
  const [buscando, setBuscando] = useState(false)
  const [yaBuscado, setYaBuscado] = useState(false)

  const [persona, setPersona] = useState<Persona | null>(null)
  const [form, setForm] = useState<FormPersona>(FORM_DEFAULTS)
  const [guardando, setGuardando] = useState(false)

  const [hvDoc, setHvDoc] = useState<DocumentoCargado | null>(null)
  const [cargandoDoc, setCargandoDoc] = useState(false)

  const [tiposExp, setTiposExp] = useState<TipoExperiencia[]>([])
  const [experiencias, setExperiencias] = useState<Experiencia[]>([])
  const [docsEx, setDocsEx] = useState<Record<number, DocumentoCargado | null>>({})
  const [cargandoExp, setCargandoExp] = useState(false)
  const [expModalOpen, setExpModalOpen] = useState(false)
  const [expEditandoId, setExpEditandoId] = useState<number | null>(null)
  const [expForm, setExpForm] = useState<FormExperiencia>(FORM_EXP_DEFAULTS)
  const [expGuardando, setExpGuardando] = useState(false)
  const [expEliminandoId, setExpEliminandoId] = useState<number | null>(null)
  const [expConfirmEliminar, setExpConfirmEliminar] = useState<number | null>(null)

  const [tiposTit, setTiposTit] = useState<TipoTitulo[]>([])
  const [titulos, setTitulos] = useState<Titulo[]>([])
  const [docsTi, setDocsTi] = useState<Record<number, DocumentoCargado | null>>({})
  const [cargandoTit, setCargandoTit] = useState(false)
  const [titModalOpen, setTitModalOpen] = useState(false)
  const [titEditandoId, setTitEditandoId] = useState<number | null>(null)
  const [titForm, setTitForm] = useState<FormTitulo>(FORM_TIT_DEFAULTS)
  const [titGuardando, setTitGuardando] = useState(false)
  const [titEliminandoId, setTitEliminandoId] = useState<number | null>(null)
  const [titConfirmEliminar, setTitConfirmEliminar] = useState<number | null>(null)
  const [expandedTitId, setExpandedTitId] = useState<number | null>(null)

  const [tiposDA, setTiposDA] = useState<TipoDocAdicional[]>([])
  const [docsAdic, setDocsAdic] = useState<DocAdicional[]>([])
  const [cargandoDA, setCargandoDA] = useState(false)
  const [daModalOpen, setDAModalOpen] = useState(false)
  const [daForm, setDAForm] = useState({ tipoDocId: '' })
  const [daGuardando, setDAGuardando] = useState(false)
  const [daEliminandoId, setDAEliminandoId] = useState<number | null>(null)
  const [daConfirmEliminar, setDAConfirmEliminar] = useState<number | null>(null)
  const [expandedDAId, setExpandedDAId] = useState<number | null>(null)

  const [asociando, setAsociando] = useState(false)
  const [asociandoCap, setAsociandoCap] = useState(false)
  const [personaYaEsCapacitador, setPersonaYaEsCapacitador] = useState(false)

  const [personaEsDirectorActivo, setPersonaEsDirectorActivo] = useState(false)
  const [directorAprobadoEnProyecto, setDirectorAprobadoEnProyecto] = useState(false)

  const [habeasOpen, setHabeasOpen] = useState(false)

  const [expandedExpId, setExpandedExpId] = useState<number | null>(null)

  const [toastVisible, setToastVisible] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error' | 'warning'; titulo: string; msg: string } | null>(null)
  function showToast(tipo: 'success' | 'error' | 'warning', titulo: string, msg: string) {
    setToast({ tipo, titulo, msg })
    setToastVisible(true)
  }

  useEffect(() => {
    document.title = modoCapacitador ? 'Hoja de Vida — Capacitador | SEP' : 'Hoja de Vida — Director | SEP'
    setPerfilId(getSepUsuario()?.perfilId ?? 0)
    api.get<TipoDocumento[]>('/contactos/tipos-doc')
      .then(r => setTiposDoc(r.data ?? []))
      .catch(() => setTiposDoc([]))
    api.get<TipoExperiencia[]>('/personas/catalogos/tipos-experiencia')
      .then(r => setTiposExp(r.data ?? []))
      .catch(() => setTiposExp([]))
    api.get<TipoTitulo[]>('/personas/catalogos/tipos-titulo')
      .then(r => setTiposTit(r.data ?? []))
      .catch(() => setTiposTit([]))
    api.get<TipoDocAdicional[]>('/personas/catalogos/tipos-doc-adicional')
      .then(r => setTiposDA(r.data ?? []))
      .catch(() => setTiposDA([]))

    // con ?personaId=N se precarga todo y se salta el paso de búsqueda
    if (personaIdQuery > 0) {
      (async () => {
        try {
          const r = await api.get<Persona>(`/personas/${personaIdQuery}`)
          setPersona(r.data)
          fillFormFromPersona(r.data)
          setBusqueda({
            tipoDocumentoId: String(r.data.tipoDocumentoId ?? ''),
            identificacion: r.data.identificacion ?? '',
          })
          setYaBuscado(true)
          await recargarDocumentos(r.data.personaId)
          await recargarExperiencia(r.data.personaId)
          await recargarTitulos(r.data.personaId)
          await recargarDocsAdicionales(r.data.personaId)
          if (modoCapacitador) setPersonaYaEsCapacitador(true)
        } catch {
          // sin precarga queda el flujo manual de búsqueda
        }
        try {
          const rDir = await api.get<{ activo: { personaId: number; estadoInterventoria: string } | null }>(
            `/convenios/${proyectoId}/director`,
          )
          const a = rDir.data?.activo
          if (a && Number(a.personaId) === personaIdQuery) {
            setPersonaEsDirectorActivo(true)
            if ((a.estadoInterventoria ?? '').trim().toUpperCase() === 'APROBADO') {
              setDirectorAprobadoEnProyecto(true)
            }
          }
        } catch { /* ignore */ }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaIdQuery])

  function fillFormFromPersona(p: Persona) {
    setForm({
      tipoDocumentoId: String(p.tipoDocumentoId ?? ''),
      identificacion: p.identificacion ?? '',
      nombres: p.nombres ?? '',
      primerApellido: p.primerApellido ?? '',
      segundoApellido: p.segundoApellido ?? '',
      email: p.email ?? '',
      emailInstitucional: p.emailInstitucional ?? '',
      celular: p.celular ?? '',
      telefono: p.telefono ?? '',
      habeasData: (p.habeasDataE ?? p.habeasData ?? '').trim().toUpperCase() === 'SI',
    })
  }

  async function recargarPersona(personaId: number) {
    const r = await api.get<Persona>(`/personas/${personaId}`)
    setPersona(r.data)
    fillFormFromPersona(r.data)
  }

  async function recargarDocumentos(personaId: number) {
    try {
      setCargandoDoc(true)
      const r = await api.get<DocumentoCargado[]>(`/personas/${personaId}/documentos`, {
        params: { tipo: 'HV', num: 0 },
      })
      setHvDoc(r.data?.[0] ?? null)
    } catch {
      setHvDoc(null)
    } finally {
      setCargandoDoc(false)
    }
  }

  async function recargarExperiencia(personaId: number) {
    try {
      setCargandoExp(true)
      const [rExp, rDocsAll] = await Promise.all([
        api.get<Experiencia[]>(`/personas/${personaId}/experiencia`, { params: { proyectoId } }),
        api.get<DocumentoCargado[]>(`/personas/${personaId}/documentos`, { params: { tipo: 'EX' } }),
      ])
      setExperiencias(rExp.data ?? [])
      // los documentos EX se indexan por num = experienciaId
      const idx: Record<number, DocumentoCargado | null> = {}
      for (const exp of rExp.data ?? []) {
        idx[exp.experienciaId] = (rDocsAll.data ?? []).find((d: any) => Number(d.num) === exp.experienciaId) ?? null
      }
      setDocsEx(idx)
    } catch {
      setExperiencias([])
      setDocsEx({})
    } finally {
      setCargandoExp(false)
    }
  }

  function abrirExpModal(experienciaId: number | null) {
    if (experienciaId == null) {
      setExpEditandoId(null)
      setExpForm(FORM_EXP_DEFAULTS)
    } else {
      const exp = experiencias.find(e => e.experienciaId === experienciaId)
      if (!exp) return
      setExpEditandoId(experienciaId)
      setExpForm({
        tipoExperienciaId: String(exp.tipoExperienciaId ?? ''),
        descripcion: exp.descripcion ?? '',
        fechaInicio: exp.fechaInicio ? exp.fechaInicio.slice(0, 10) : '',
        fechaFin: exp.fechaFin ? exp.fechaFin.slice(0, 10) : '',
      })
    }
    setExpModalOpen(true)
  }

  function validarExpForm(): string | null {
    if (!expForm.tipoExperienciaId) return 'Debes seleccionar un tipo de experiencia.'
    if (!expForm.descripcion.trim()) return 'La descripción no puede estar vacía.'
    if (!expForm.fechaInicio) return 'Debes seleccionar la fecha de inicio.'
    if (!expForm.fechaFin) return 'Debes seleccionar la fecha de finalización.'
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const fi = new Date(expForm.fechaInicio)
    const ff = new Date(expForm.fechaFin)
    if (fi >= hoy) return 'La fecha de inicio no puede ser hoy ni en el futuro.'
    if (ff > hoy) return 'La fecha de finalización no puede ser superior a hoy.'
    if (ff < fi)  return 'La fecha de finalización no puede ser menor a la inicial.'
    return null
  }

  async function handleGuardarExp() {
    if (!persona) return
    const err = validarExpForm()
    if (err) {
      showToast('error', 'Datos inválidos', err)
      return
    }
    setExpGuardando(true)
    try {
      const dto = {
        tipoExperienciaId: Number(expForm.tipoExperienciaId),
        descripcion: expForm.descripcion.trim(),
        fechaInicio: expForm.fechaInicio,
        fechaFin: expForm.fechaFin,
        proyectoId,
      }
      if (expEditandoId) {
        const r = await api.put<{ message: string }>(`/personas/experiencia/${expEditandoId}`, dto)
        showToast('success', 'Experiencia actualizada', r.data?.message ?? 'Los cambios fueron guardados.')
      } else {
        await api.post(`/personas/${persona.personaId}/experiencia`, dto)
        showToast('success', 'Experiencia registrada', 'Ya puedes adjuntar el soporte en PDF.')
      }
      setExpModalOpen(false)
      await recargarExperiencia(persona.personaId)
    } catch (e: any) {
      showToast('error', 'No se pudo guardar', e?.response?.data?.message ?? 'Error inesperado.')
    } finally { setExpGuardando(false) }
  }

  async function handleEliminarExp() {
    if (!persona || expConfirmEliminar == null) return
    const experienciaId = expConfirmEliminar
    setExpEliminandoId(experienciaId)
    try {
      await api.delete(`/personas/experiencia/${experienciaId}`, { params: { proyectoId } })
      showToast('success', 'Experiencia eliminada', '')
      setExpConfirmEliminar(null)
      await recargarExperiencia(persona.personaId)
    } catch (e: any) {
      showToast('error', 'No se pudo eliminar', e?.response?.data?.message ?? 'Error inesperado.')
    } finally { setExpEliminandoId(null) }
  }

  async function recargarTitulos(personaId: number) {
    try {
      setCargandoTit(true)
      const [rTit, rDocs] = await Promise.all([
        api.get<Titulo[]>(`/personas/${personaId}/titulos`, { params: { proyectoId } }),
        api.get<DocumentoCargado[]>(`/personas/${personaId}/documentos`, { params: { tipo: 'TI' } }),
      ])
      setTitulos(rTit.data ?? [])
      const idx: Record<number, DocumentoCargado | null> = {}
      for (const t of rTit.data ?? []) {
        idx[t.tituloId] = (rDocs.data ?? []).find((d: any) => Number(d.num) === t.tituloId) ?? null
      }
      setDocsTi(idx)
    } catch {
      setTitulos([])
      setDocsTi({})
    } finally {
      setCargandoTit(false)
    }
  }

  function abrirTitModal(tituloId: number | null) {
    if (tituloId == null) {
      setTitEditandoId(null)
      setTitForm(FORM_TIT_DEFAULTS)
    } else {
      const t = titulos.find(x => x.tituloId === tituloId)
      if (!t) return
      setTitEditandoId(tituloId)
      setTitForm({
        tipoTituloId: String(t.tipoTituloId ?? ''),
        descripcion: t.descripcion ?? '',
        fechaGraduacion: t.fechaGraduacion ? t.fechaGraduacion.slice(0, 10) : '',
      })
    }
    setTitModalOpen(true)
  }

  function validarTitForm(): string | null {
    if (!titForm.tipoTituloId) return 'Debes seleccionar un tipo de título.'
    if (!titForm.descripcion.trim()) return 'La descripción no puede estar vacía.'
    if (!titForm.fechaGraduacion) return 'Debes seleccionar la fecha de graduación.'
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const fg = new Date(titForm.fechaGraduacion)
    if (fg > hoy) return 'La fecha de graduación no puede ser superior a hoy.'
    return null
  }

  async function handleGuardarTit() {
    if (!persona) return
    const err = validarTitForm()
    if (err) { showToast('error', 'Datos inválidos', err); return }
    setTitGuardando(true)
    try {
      const dto = {
        tipoTituloId: Number(titForm.tipoTituloId),
        descripcion: titForm.descripcion.trim(),
        fechaGraduacion: titForm.fechaGraduacion,
        proyectoId,
      }
      if (titEditandoId) {
        const r = await api.put<{ message: string }>(`/personas/titulos/${titEditandoId}`, dto)
        showToast('success', 'Título actualizado', r.data?.message ?? 'Los cambios fueron guardados.')
      } else {
        await api.post(`/personas/${persona.personaId}/titulos`, dto)
        showToast('success', 'Título registrado', 'Ya puedes adjuntar el soporte en PDF.')
      }
      setTitModalOpen(false)
      await recargarTitulos(persona.personaId)
    } catch (e: any) {
      showToast('error', 'No se pudo guardar', e?.response?.data?.message ?? 'Error inesperado.')
    } finally { setTitGuardando(false) }
  }

  async function handleEliminarTit() {
    if (!persona || titConfirmEliminar == null) return
    const tituloId = titConfirmEliminar
    setTitEliminandoId(tituloId)
    try {
      await api.delete(`/personas/titulos/${tituloId}`, { params: { proyectoId } })
      showToast('success', 'Título eliminado', '')
      setTitConfirmEliminar(null)
      await recargarTitulos(persona.personaId)
    } catch (e: any) {
      showToast('error', 'No se pudo eliminar', e?.response?.data?.message ?? 'Error inesperado.')
    } finally { setTitEliminandoId(null) }
  }

  async function recargarDocsAdicionales(personaId: number) {
    try {
      setCargandoDA(true)
      const r = await api.get<DocAdicional[]>(`/personas/${personaId}/docs-adicionales`)
      setDocsAdic(r.data ?? [])
    } catch (e: any) {
      setDocsAdic([])
      const msg = e?.response?.data?.message ?? e?.message ?? 'Error al cargar documentos adicionales'
      showToast('error', 'Documentos adicionales', msg)
      console.error('[DA query error]', e?.response?.data ?? e)
    } finally {
      setCargandoDA(false)
    }
  }

  async function handleGuardarDA() {
    if (!persona) return
    if (!daForm.tipoDocId) {
      showToast('error', 'Datos inválidos', 'Debes seleccionar un tipo de documento.')
      return
    }
    setDAGuardando(true)
    try {
      await api.post(`/personas/${persona.personaId}/docs-adicionales`, {
        tipoDocId: Number(daForm.tipoDocId),
        proyectoId,
      })
      showToast('success', 'Documento registrado', 'Ya puedes adjuntar el soporte en PDF.')
      setDAModalOpen(false)
      setDAForm({ tipoDocId: '' })
      await recargarDocsAdicionales(persona.personaId)
    } catch (e: any) {
      showToast('error', 'No se pudo guardar', e?.response?.data?.message ?? 'Error inesperado.')
    } finally { setDAGuardando(false) }
  }

  async function handleEliminarDA() {
    if (!persona || daConfirmEliminar == null) return
    const docAdicId = daConfirmEliminar
    setDAEliminandoId(docAdicId)
    try {
      await api.delete(`/personas/docs-adicionales/${docAdicId}`)
      showToast('success', 'Documento eliminado', '')
      setDAConfirmEliminar(null)
      await recargarDocsAdicionales(persona.personaId)
    } catch (e: any) {
      showToast('error', 'No se pudo eliminar', e?.response?.data?.message ?? 'Error inesperado.')
    } finally { setDAEliminandoId(null) }
  }

  // de esto depende si se muestra "Asociar" o las secciones de HV
  async function refrescarEstadoDirector(personaId: number) {
    try {
      const r = await api.get<{ activo: { personaId: number; estadoInterventoria: string } | null }>(
        `/convenios/${proyectoId}/director`,
      )
      const a = r.data?.activo
      const esActivo = !!a && Number(a.personaId) === personaId
      setPersonaEsDirectorActivo(esActivo)
      setDirectorAprobadoEnProyecto(
        esActivo && (a!.estadoInterventoria ?? '').trim().toUpperCase() === 'APROBADO',
      )
    } catch {
      setPersonaEsDirectorActivo(false)
      setDirectorAprobadoEnProyecto(false)
    }
  }

  async function handleBuscar() {
    if (!busqueda.tipoDocumentoId || !busqueda.identificacion.trim()) {
      showToast('error', 'Faltan datos', 'Selecciona el tipo de documento y escribe el número.')
      return
    }
    setBuscando(true)
    try {
      const r = await api.get<Persona | null>('/personas/buscar', {
        params: { tipoDoc: Number(busqueda.tipoDocumentoId), doc: busqueda.identificacion.trim() },
      })
      setYaBuscado(true)
      if (r.data) {
        setPersona(r.data)
        fillFormFromPersona(r.data)
        await recargarDocumentos(r.data.personaId)
        await recargarExperiencia(r.data.personaId)
        await recargarTitulos(r.data.personaId)
        await recargarDocsAdicionales(r.data.personaId)
        await refrescarEstadoDirector(r.data.personaId)
        if (modoCapacitador) {
          try {
            const rCap = await api.get<{ personaId: number }[]>(`/capacitadores/proyecto/${proyectoId}/personas`)
            setPersonaYaEsCapacitador(rCap.data?.some(c => Number(c.personaId) === r.data!.personaId) ?? false)
          } catch { setPersonaYaEsCapacitador(false) }
        }
        showToast('success', 'Persona encontrada', modoCapacitador
          ? 'Revisa los datos y asóciala como capacitador.'
          : 'Revisa los datos y, si todo está bien, asóciala como director.')
      } else {
        setPersona(null)
        setHvDoc(null)
        setForm({
          ...FORM_DEFAULTS,
          tipoDocumentoId: busqueda.tipoDocumentoId,
          identificacion: busqueda.identificacion.trim(),
        })
        showToast('warning', 'No existe en el sistema', 'Diligencia los datos y guarda. La persona será creada.')
      }
    } catch (e: any) {
      showToast('error', 'Error al buscar', e?.response?.data?.message ?? 'Error inesperado.')
    } finally {
      setBuscando(false)
    }
  }

  async function handleGuardar() {
    if (!form.habeasData) {
      showToast('error', 'Habeas Data', 'Debes aceptar el Habeas Data para guardar.')
      return
    }
    if (form.email.trim() && form.email.trim().toLowerCase() === form.emailInstitucional.trim().toLowerCase()) {
      showToast('error', 'Correos iguales', 'El correo institucional no puede ser igual al personal.')
      return
    }
    setGuardando(true)
    try {
      const dto = {
        tipoDocumentoId: Number(form.tipoDocumentoId),
        identificacion: form.identificacion.trim(),
        nombres: form.nombres.trim(),
        primerApellido: form.primerApellido.trim(),
        segundoApellido: form.segundoApellido.trim() || null,
        email: form.email.trim(),
        emailInstitucional: form.emailInstitucional.trim() || null,
        celular: form.celular.trim() || null,
        telefono: form.telefono.trim() || null,
        habeasData: form.habeasData,
      }
      if (persona) {
        await api.put(`/personas/${persona.personaId}`, dto)
        showToast('success', 'Datos actualizados', 'La información de la persona quedó guardada.')
        await recargarPersona(persona.personaId)
      } else {
        const r = await api.post<{ personaId: number; creada: boolean }>('/personas', dto)
        showToast('success', 'Persona registrada', 'Ahora puedes subir la Hoja de Vida.')
        await recargarPersona(r.data.personaId)
        await recargarDocumentos(r.data.personaId)
        await recargarExperiencia(r.data.personaId)
        await recargarDocsAdicionales(r.data.personaId)
      }
    } catch (e: any) {
      showToast('error', 'No se pudo guardar', e?.response?.data?.message ?? 'Error inesperado.')
    } finally {
      setGuardando(false)
    }
  }

  async function handleAsociar() {
    if (!persona) return
    setAsociando(true)
    try {
      await api.post(`/convenios/${proyectoId}/director/asociar`, {
        personaId: persona.personaId,
      })
      showToast('success', 'Director asociado',
        'Ahora puedes registrar la Hoja de Vida, experiencia y documentos. ' +
        'Queda pendiente de aprobación por la interventoría.')
      await refrescarEstadoDirector(persona.personaId)
    } catch (e: any) {
      showToast('error', 'No se pudo asociar', e?.response?.data?.message ?? 'Error inesperado.')
    } finally {
      setAsociando(false)
    }
  }

  async function handleAsociarCapacitador() {
    if (!persona) return
    setAsociandoCap(true)
    try {
      await api.post(`/capacitadores/proyecto/${proyectoId}/persona/${persona.personaId}`)
      showToast('success', 'Capacitador asociado',
        'La persona fue registrada como capacitador ACTIVO. Queda pendiente de aprobación.')
      setPersonaYaEsCapacitador(true)
    } catch (e: any) {
      showToast('error', 'No se pudo asociar', e?.response?.data?.message ?? 'Error inesperado.')
    } finally {
      setAsociandoCap(false)
    }
  }

  const PERFIL_EMPRESA = 7
  const PERFIL_ADMIN = 1
  const tienePerfilEditor = perfilId === PERFIL_EMPRESA || perfilId === PERFIL_ADMIN
  const [convenioEnEjecucion, setConvenioEnEjecucion] = useState<boolean | null>(null)
  useEffect(() => {
    if (!proyectoId) return
    api.get<{ estadoNum: number | null }>(`/convenios/${proyectoId}`)
      .then(r => setConvenioEnEjecucion(Number(r.data?.estadoNum) === 1))
      .catch(() => setConvenioEnEjecucion(false))
  }, [proyectoId])
  const bloqueadoPorConvenio = convenioEnEjecucion === false
  const puedeEditar = tienePerfilEditor && !directorAprobadoEnProyecto && !bloqueadoPorConvenio

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
          <span><strong>Convenio no está en ejecución.</strong> Esta hoja de vida está en modo solo lectura.</span>
        </div>
      )}

      {directorAprobadoEnProyecto && (
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Lock size={18} strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-900">
              Director aprobado por la interventoría
            </p>
            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
              La hoja de vida está bloqueada para edición porque el director ya fue aprobado
              en este proyecto. Puedes consultar y descargar los documentos cargados.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-[#00304D]" />
        <div className="p-5 sm:p-6 flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-xl bg-[#00304D]/10 flex items-center justify-center shrink-0">
            {modoCapacitador
              ? <GraduationCap size={22} className="text-[#00304D]" />
              : <UserSquare2 size={22} className="text-[#00304D]" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Convenio · Ejecución</p>
            <h1 className="text-lg sm:text-xl font-bold text-[#00304D]">
              Registro de Hoja de Vida — {modoCapacitador ? 'Capacitador' : 'Director'}
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
              Diligencia los datos personales y sube la Hoja de Vida en PDF. Si la persona ya existe en el sistema,
              busca por documento para reutilizar sus datos.
            </p>
          </div>
          <Link
            href={modoCapacitador
              ? `/panel/convenios/${proyectoId}/capacitadores`
              : `/panel/convenios/${proyectoId}/directores`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-500 border border-neutral-200 rounded-xl hover:bg-neutral-50 hover:text-[#00304D] transition shrink-0">
            ← {modoCapacitador ? 'Volver a Capacitadores' : 'Volver a Directores'}
          </Link>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <header className="px-5 py-3.5 border-b border-neutral-100 flex items-center gap-2 bg-gradient-to-r from-[#00304D]/5 to-transparent">
          <Search size={16} className="text-[#00304D]" />
          <h2 className="text-sm font-bold text-[#00304D]">1. Buscar persona</h2>
        </header>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Tipo de documento *</label>
            <select
              value={busqueda.tipoDocumentoId}
              onChange={e => setBusqueda(b => ({ ...b, tipoDocumentoId: e.target.value }))}
              className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] bg-white">
              <option value="">Seleccionar...</option>
              {tiposDoc.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Número de documento *</label>
            <input
              value={busqueda.identificacion}
              onChange={e => setBusqueda(b => ({ ...b, identificacion: e.target.value.replace(/[^0-9A-Za-z-]/g, '') }))}
              maxLength={40}
              className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D]"
              placeholder="Ej.: 1020304050"
            />
          </div>
          <button
            onClick={handleBuscar} disabled={buscando}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00304D] hover:bg-[#004a76] text-white text-sm font-semibold rounded-xl transition disabled:opacity-50">
            {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Buscar persona
          </button>
        </div>
      </section>

      {yaBuscado && (
        <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <header className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between gap-3 flex-wrap bg-gradient-to-r from-[#00304D]/5 to-transparent">
            <div className="flex items-center gap-2">
              <IdCard size={16} className="text-[#00304D]" />
              <h2 className="text-sm font-bold text-[#00304D]">2. Datos personales</h2>
            </div>
            {persona ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                <CheckCircle2 size={10} /> Persona existente
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                <UserPlus size={10} /> Persona nueva
              </span>
            )}
          </header>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Group label="Tipo de documento *">
              <select value={form.tipoDocumentoId}
                onChange={e => setForm({ ...form, tipoDocumentoId: e.target.value })}
                disabled={!puedeEditar || !!persona}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] bg-white disabled:bg-neutral-50">
                <option value="">Seleccionar...</option>
                {tiposDoc.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </Group>
            <Group label="Número de documento *">
              <input value={form.identificacion}
                onChange={e => setForm({ ...form, identificacion: e.target.value.replace(/[^0-9A-Za-z-]/g, '') })}
                disabled={!puedeEditar || !!persona}
                maxLength={40}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] disabled:bg-neutral-50" />
            </Group>
            <Group label="Nombres *">
              <input value={form.nombres}
                onChange={e => setForm({ ...form, nombres: e.target.value.toUpperCase() })}
                disabled={!puedeEditar} maxLength={200}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] disabled:bg-neutral-50 uppercase" />
            </Group>
            <div />
            <Group label="Primer apellido *">
              <input value={form.primerApellido}
                onChange={e => setForm({ ...form, primerApellido: e.target.value.toUpperCase() })}
                disabled={!puedeEditar} maxLength={40}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] disabled:bg-neutral-50 uppercase" />
            </Group>
            <Group label="Segundo apellido">
              <input value={form.segundoApellido}
                onChange={e => setForm({ ...form, segundoApellido: e.target.value.toUpperCase() })}
                disabled={!puedeEditar} maxLength={40}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] disabled:bg-neutral-50 uppercase" />
            </Group>
            <Group label="Correo electrónico personal *">
              <input type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                disabled={!puedeEditar} maxLength={200}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] disabled:bg-neutral-50" />
            </Group>
            <Group label="Correo electrónico institucional">
              <input type="email" value={form.emailInstitucional}
                onChange={e => setForm({ ...form, emailInstitucional: e.target.value })}
                disabled={!puedeEditar} maxLength={200}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] disabled:bg-neutral-50" />
            </Group>
            <Group label="Teléfono">
              <input value={form.telefono}
                onChange={e => setForm({ ...form, telefono: e.target.value.replace(/[^0-9+\-\s]/g, '') })}
                disabled={!puedeEditar} maxLength={40}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] disabled:bg-neutral-50" />
            </Group>
            <Group label="Celular *">
              <input value={form.celular}
                onChange={e => setForm({ ...form, celular: e.target.value.replace(/[^0-9+\-\s]/g, '') })}
                disabled={!puedeEditar} maxLength={40}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] disabled:bg-neutral-50" />
            </Group>
          </div>

          <div className="px-5 pb-5 flex flex-col gap-3">
            <div className={`flex items-start gap-3 p-3 rounded-xl border ${
              form.habeasData
                ? 'border-emerald-200 bg-emerald-50/60'
                : 'border-amber-200 bg-amber-50/60'
            }`}>
              <label className="flex-1 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.habeasData}
                  onChange={e => setForm({ ...form, habeasData: e.target.checked })}
                  disabled={!puedeEditar}
                  className="mt-0.5 w-4 h-4 accent-emerald-600"
                />
                <div className="text-xs text-neutral-700 leading-relaxed">
                  <p className="font-bold">Acepto el Habeas Data y la Política de Tratamiento de Datos *</p>
                  <p className="mt-0.5 text-neutral-500">
                    Necesario para guardar la información personal y la Hoja de Vida en el sistema.
                  </p>
                </div>
              </label>
              <button
                type="button"
                onClick={() => setHabeasOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 transition shrink-0 self-center"
              >
                <FileText size={12} /> Ver Habeas Data
              </button>
            </div>

            <div className="flex justify-end">
              <button onClick={handleGuardar} disabled={guardando || !puedeEditar}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00304D] hover:bg-[#004a76] text-white text-sm font-semibold rounded-xl transition disabled:opacity-50">
                {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {persona ? 'Actualizar datos' : 'Guardar persona'}
              </button>
            </div>
          </div>
        </section>
      )}

      {persona && !personaEsDirectorActivo && !modoCapacitador && (
        <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <header className="px-5 py-3.5 border-b border-neutral-100 flex items-center gap-2 bg-gradient-to-r from-[#00304D]/5 to-transparent">
            <ShieldCheck size={16} className="text-[#00304D]" />
            <h2 className="text-sm font-bold text-[#00304D]">3. Asociar como Director del Convenio</h2>
          </header>
          <div className="p-5 flex flex-col gap-3">
            <p className="text-sm text-neutral-700 leading-relaxed">
              Para registrar la <strong>Hoja de Vida</strong>, <strong>experiencia</strong>,
              <strong> títulos</strong> y <strong>otros documentos</strong> debes primero asociar a esta persona
              como director del convenio. Al asociarla quedará en estado <strong>ACTIVO</strong> con
              interventoría <strong>PENDIENTE</strong>. Si ya había un director activo, se inactiva
              automáticamente y queda en el historial.
            </p>
            <div className="flex justify-end gap-2">
              <Link href={`/panel/convenios/${proyectoId}/directores`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition">
                Cancelar
              </Link>
              <button onClick={handleAsociar} disabled={asociando || !tienePerfilEditor}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl transition disabled:opacity-50 bg-emerald-600 hover:bg-emerald-700">
                {asociando ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                Asociar como director
              </button>
            </div>
          </div>
        </section>
      )}

      {persona && personaEsDirectorActivo && !directorAprobadoEnProyecto && (
        <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <ShieldCheck size={18} strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-blue-900">
              Director asociado · pendiente de aprobación
            </p>
            <p className="text-xs text-blue-800 mt-1 leading-relaxed">
              Esta persona ya quedó asociada como director ACTIVO del convenio. Mientras la
              interventoría no apruebe, puedes seguir actualizando la hoja de vida, experiencia,
              títulos y otros documentos.
            </p>
          </div>
        </div>
      )}

      {modoCapacitador && persona && !personaYaEsCapacitador && (
        <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <header className="px-5 py-3.5 border-b border-neutral-100 flex items-center gap-2 bg-gradient-to-r from-[#00304D]/5 to-transparent">
            <GraduationCap size={16} className="text-[#00304D]" />
            <h2 className="text-sm font-bold text-[#00304D]">3. Asociar como Capacitador del Convenio</h2>
          </header>
          <div className="p-5 flex flex-col gap-3">
            <p className="text-sm text-neutral-700 leading-relaxed">
              Revisa los datos de la hoja de vida y, cuando estén completos, asocia a esta persona
              como capacitador del convenio. Quedará con estado <strong>ACTIVO</strong> y pendiente
              de aprobación por la interventoría.
            </p>
            <div className="flex justify-end gap-2">
              <Link href={`/panel/convenios/${proyectoId}/capacitadores`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition">
                Cancelar
              </Link>
              <button onClick={handleAsociarCapacitador} disabled={asociandoCap || !tienePerfilEditor}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl transition disabled:opacity-50 bg-emerald-600 hover:bg-emerald-700">
                {asociandoCap ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
                Asociar como Capacitador
              </button>
            </div>
          </div>
        </section>
      )}

      {modoCapacitador && persona && personaYaEsCapacitador && (
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <GraduationCap size={18} strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-900">Capacitador asociado</p>
            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
              Esta persona ya está registrada como capacitador ACTIVO del convenio. Puedes actualizar
              la hoja de vida, experiencia, títulos y otros documentos.
            </p>
          </div>
        </div>
      )}

      {persona && (personaEsDirectorActivo || modoCapacitador) && (
        <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <header className="px-5 py-3.5 border-b border-neutral-100 flex items-center gap-2 bg-gradient-to-r from-[#00304D]/5 to-transparent">
            <FileText size={16} className="text-[#00304D]" />
            <h2 className="text-sm font-bold text-[#00304D]">4. Hoja de Vida (PDF)</h2>
          </header>
          <div className="p-5 flex flex-col gap-3">
            <p className="text-xs text-neutral-500 leading-relaxed">
              Sube el archivo PDF de la Hoja de Vida de la persona. Solo se permite un archivo por persona;
              para reemplazarlo elimina el actual primero.
            </p>
            {cargandoDoc ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 flex items-center gap-2 text-xs text-neutral-500">
                <Loader2 size={14} className="animate-spin" /> Cargando…
              </div>
            ) : (
              <UploadPdf
                personaId={persona.personaId}
                tipo="HV"
                num={0}
                documento={hvDoc}
                bloqueado={!puedeEditar}
                onChange={() => recargarDocumentos(persona.personaId)}
              />
            )}
          </div>
        </section>
      )}

      {persona && (personaEsDirectorActivo || modoCapacitador) && (() => {
        const totalDias = experiencias.reduce((acc, e) => {
          if (!e.fechaInicio || !e.fechaFin) return acc
          // +1: inicio y fin cuentan
          return acc + Math.max(0, Math.floor((new Date(e.fechaFin).getTime() - new Date(e.fechaInicio).getTime()) / 86400000) + 1)
        }, 0)
        return (
          <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <header className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between gap-3 flex-wrap bg-gradient-to-r from-[#00304D]/5 to-transparent">
              <div className="flex items-center gap-2">
                <Briefcase size={16} className="text-[#00304D]" />
                <h2 className="text-sm font-bold text-[#00304D]">5. Experiencia laboral</h2>
                {experiencias.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-[#00304D]/10 text-[#00304D] text-[11px] font-bold">
                    {experiencias.length}
                  </span>
                )}
              </div>
              {puedeEditar && (
                <button onClick={() => abrirExpModal(null)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#00304D] hover:bg-[#004a76] text-white transition">
                  <Plus size={13} /> Agregar experiencia
                </button>
              )}
            </header>

            <div className="p-5 flex flex-col gap-3">
              {cargandoExp ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 flex items-center gap-2 text-xs text-neutral-500">
                  <Loader2 size={14} className="animate-spin" /> Cargando experiencia…
                </div>
              ) : experiencias.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 flex flex-col items-center gap-2 text-center">
                  <Briefcase size={24} className="text-neutral-300" />
                  <p className="text-sm text-neutral-500">Aún no hay experiencia registrada.</p>
                  {puedeEditar && (
                    <p className="text-xs text-neutral-400">Click en "Agregar experiencia" para registrar la primera.</p>
                  )}
                </div>
              ) : (
                <>
                  {experiencias.map((exp, idx) => {
                    const fi = exp.fechaInicio ? new Date(exp.fechaInicio) : null
                    const ff = exp.fechaFin ? new Date(exp.fechaFin) : null
                    const durStr = formatDuracion(fi, ff)
                    const fmt = (d: Date | null) => d ? d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
                    const fmtCorto = (d: Date | null) => d ? d.toLocaleDateString('es-CO', { month: '2-digit', year: 'numeric' }) : '—'
                    const aprobado = (exp.estadoArchivo ?? '').toUpperCase() === 'APROBADO'
                    // si viene de otra convocatoria sí se edita: pasa a este proyecto y vuelve a pendiente
                    const otroProyectoMismaConv = exp.mismaConvocatoria === true
                    const otroProyectoOtraConv = exp.proyectoOrigen != null
                      && Number(exp.proyectoOrigen) !== proyectoId
                      && !exp.mismaConvocatoria
                    const bloqueadoEx = !puedeEditar || aprobado || otroProyectoMismaConv
                    const expandida = expandedExpId === exp.experienciaId
                    const tieneDoc = !!docsEx[exp.experienciaId]
                    const resumen = (exp.descripcion ?? '').replace(/\s+/g, ' ').trim()
                    const resumenCorto = resumen.length > 110 ? resumen.slice(0, 110) + '…' : resumen
                    return (
                      <div key={exp.experienciaId}
                        className={`rounded-xl border bg-white overflow-hidden transition ${
                          expandida ? 'border-[#00304D] shadow-sm' : 'border-neutral-200'
                        }`}>
                        <button
                          type="button"
                          onClick={() => setExpandedExpId(expandida ? null : exp.experienciaId)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-neutral-50 transition text-left"
                          aria-expanded={expandida}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 shrink-0">#{idx + 1}</span>
                          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#00304D]/10 text-[#00304D] border border-[#00304D]/20">
                              {exp.tipoExperiencia ?? '—'}
                            </span>
                            {aprobado && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={10} /> Aprobado
                              </span>
                            )}
                            {otroProyectoMismaConv && !aprobado && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                                title={`Registrado por el proyecto ${exp.proyectoOrigen} de esta misma convocatoria — no editable`}>
                                Bloqueado · misma convocatoria
                              </span>
                            )}
                            {otroProyectoOtraConv && !aprobado && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200"
                                title={`Heredado del proyecto ${exp.proyectoOrigen} (otra convocatoria) — al editarlo se asigna a este proyecto y vuelve a estado pendiente`}>
                                Heredado de otra convocatoria
                              </span>
                            )}
                            {tieneDoc && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200" title="Tiene soporte PDF cargado">
                                <FileText size={10} /> PDF
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {!expandida && (
                              <p className="text-xs text-neutral-500 truncate">{resumenCorto || 'Sin descripción'}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-neutral-500 shrink-0">
                            <span className="hidden sm:inline">{fmtCorto(fi)} → {fmtCorto(ff)}</span>
                            <span className="font-bold text-[#00304D]">{durStr}</span>
                            <ChevronDown size={14} className={`text-neutral-400 transition-transform ${expandida ? 'rotate-180' : ''}`} />
                          </div>
                        </button>

                        {expandida && (
                          <div className="border-t border-neutral-100 p-4 flex flex-col gap-3 bg-neutral-50/30">
                            <div className="flex items-start justify-end gap-1.5 flex-wrap">
                              {!bloqueadoEx && (
                                <>
                                  <button
                                    type="button" onClick={(e) => { e.stopPropagation(); abrirExpModal(exp.experienciaId) }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-[#00304D] transition"
                                    title="Editar">
                                    <Pencil size={12} /> Editar
                                  </button>
                                  <button
                                    type="button" onClick={(e) => { e.stopPropagation(); setExpConfirmEliminar(exp.experienciaId) }}
                                    disabled={expEliminandoId === exp.experienciaId}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 transition disabled:opacity-50"
                                    title="Eliminar">
                                    {expEliminandoId === exp.experienciaId
                                      ? <Loader2 size={12} className="animate-spin" />
                                      : <Trash2 size={12} />}
                                    Eliminar
                                  </button>
                                </>
                              )}
                            </div>

                            <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
                              {exp.descripcion}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px] bg-white border border-neutral-200 rounded-lg p-3">
                              <div>
                                <p className="text-neutral-400 uppercase tracking-wide font-semibold text-[9px]">Fecha de inicio</p>
                                <p className="font-bold text-[#00304D]">{fmt(fi)}</p>
                              </div>
                              <div>
                                <p className="text-neutral-400 uppercase tracking-wide font-semibold text-[9px]">Fecha final</p>
                                <p className="font-bold text-[#00304D]">{fmt(ff)}</p>
                              </div>
                              <div>
                                <p className="text-neutral-400 uppercase tracking-wide font-semibold text-[9px]">Duración</p>
                                <p className="font-bold text-[#00304D]">{durStr}</p>
                              </div>
                            </div>

                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1.5">Soporte (PDF)</p>
                              <UploadPdf
                                personaId={persona.personaId}
                                tipo="EX"
                                num={exp.experienciaId}
                                documento={docsEx[exp.experienciaId] ?? null}
                                bloqueado={bloqueadoEx}
                                onChange={() => recargarExperiencia(persona.personaId)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <p className="text-right text-xs font-semibold text-[#00304D] pt-1">
                    Experiencia total: <span className="text-base font-bold">{formatTotalDias(totalDias)}</span>
                  </p>
                </>
              )}
            </div>
          </section>
        )
      })()}

      {persona && (personaEsDirectorActivo || modoCapacitador) && (
        <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <header className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between gap-3 flex-wrap bg-gradient-to-r from-[#00304D]/5 to-transparent">
            <div className="flex items-center gap-2">
              <GraduationCap size={16} className="text-[#00304D]" />
              <h2 className="text-sm font-bold text-[#00304D]">6. Títulos académicos</h2>
              {titulos.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-[#00304D]/10 text-[#00304D] text-[11px] font-bold">
                  {titulos.length}
                </span>
              )}
            </div>
            {puedeEditar && (
              <button onClick={() => abrirTitModal(null)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#00304D] hover:bg-[#004a76] text-white transition">
                <Plus size={13} /> Agregar título
              </button>
            )}
          </header>

          <div className="p-5 flex flex-col gap-3">
            {cargandoTit ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 flex items-center gap-2 text-xs text-neutral-500">
                <Loader2 size={14} className="animate-spin" /> Cargando títulos…
              </div>
            ) : titulos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 flex flex-col items-center gap-2 text-center">
                <GraduationCap size={24} className="text-neutral-300" />
                <p className="text-sm text-neutral-500">Aún no hay títulos registrados.</p>
                {puedeEditar && (
                  <p className="text-xs text-neutral-400">Click en "Agregar título" para registrar el primero.</p>
                )}
              </div>
            ) : (
              titulos.map((t, idx) => {
                const fg = t.fechaGraduacion ? new Date(t.fechaGraduacion) : null
                const fmt = (d: Date | null) => d ? d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
                const fmtCorto = (d: Date | null) => d ? d.toLocaleDateString('es-CO', { month: '2-digit', year: 'numeric' }) : '—'
                const aprobado = (t.estadoArchivo ?? '').toUpperCase() === 'APROBADO'
                const otroProyectoMismaConv = t.mismaConvocatoria === true
                const otroProyectoOtraConv = t.proyectoOrigen != null
                  && Number(t.proyectoOrigen) !== proyectoId
                  && !t.mismaConvocatoria
                const bloqueadoTi = !puedeEditar || aprobado || otroProyectoMismaConv
                const expandida = expandedTitId === t.tituloId
                const tieneDoc = !!docsTi[t.tituloId]
                const resumen = (t.descripcion ?? '').replace(/\s+/g, ' ').trim()
                const resumenCorto = resumen.length > 110 ? resumen.slice(0, 110) + '…' : resumen
                return (
                  <div key={t.tituloId}
                    className={`rounded-xl border bg-white overflow-hidden transition ${
                      expandida ? 'border-[#00304D] shadow-sm' : 'border-neutral-200'
                    }`}>
                    <button
                      type="button"
                      onClick={() => setExpandedTitId(expandida ? null : t.tituloId)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-neutral-50 transition text-left"
                      aria-expanded={expandida}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 shrink-0">#{idx + 1}</span>
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#00304D]/10 text-[#00304D] border border-[#00304D]/20">
                          {t.tipoTitulo ?? '—'}
                        </span>
                        {aprobado && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={10} /> Aprobado
                          </span>
                        )}
                        {otroProyectoMismaConv && !aprobado && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                            title={`Registrado por el proyecto ${t.proyectoOrigen} de esta misma convocatoria — no editable`}>
                            Bloqueado · misma convocatoria
                          </span>
                        )}
                        {otroProyectoOtraConv && !aprobado && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200"
                            title={`Heredado del proyecto ${t.proyectoOrigen} (otra convocatoria)`}>
                            Heredado de otra convocatoria
                          </span>
                        )}
                        {tieneDoc && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200" title="Tiene soporte PDF cargado">
                            <FileText size={10} /> PDF
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {!expandida && (
                          <p className="text-xs text-neutral-500 truncate">{resumenCorto || 'Sin descripción'}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-neutral-500 shrink-0">
                        <span className="hidden sm:inline">Grad.: {fmtCorto(fg)}</span>
                        <ChevronDown size={14} className={`text-neutral-400 transition-transform ${expandida ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {expandida && (
                      <div className="border-t border-neutral-100 p-4 flex flex-col gap-3 bg-neutral-50/30">
                        <div className="flex items-start justify-end gap-1.5 flex-wrap">
                          {!bloqueadoTi && (
                            <>
                              <button
                                type="button" onClick={(e) => { e.stopPropagation(); abrirTitModal(t.tituloId) }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-[#00304D] transition"
                                title="Editar">
                                <Pencil size={12} /> Editar
                              </button>
                              <button
                                type="button" onClick={(e) => { e.stopPropagation(); setTitConfirmEliminar(t.tituloId) }}
                                disabled={titEliminandoId === t.tituloId}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 transition disabled:opacity-50"
                                title="Eliminar">
                                {titEliminandoId === t.tituloId
                                  ? <Loader2 size={12} className="animate-spin" />
                                  : <Trash2 size={12} />}
                                Eliminar
                              </button>
                            </>
                          )}
                        </div>

                        <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
                          {t.descripcion}
                        </p>

                        <div className="bg-white border border-neutral-200 rounded-lg p-3 text-[11px]">
                          <p className="text-neutral-400 uppercase tracking-wide font-semibold text-[9px]">Fecha de graduación</p>
                          <p className="font-bold text-[#00304D]">{fmt(fg)}</p>
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1.5">Soporte (PDF)</p>
                          <UploadPdf
                            personaId={persona.personaId}
                            tipo="TI"
                            num={t.tituloId}
                            documento={docsTi[t.tituloId] ?? null}
                            bloqueado={bloqueadoTi}
                            onChange={() => recargarTitulos(persona.personaId)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}

      {persona && (personaEsDirectorActivo || modoCapacitador) && (
        <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <header className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between gap-3 flex-wrap bg-gradient-to-r from-[#00304D]/5 to-transparent">
            <div className="flex items-center gap-2">
              <FolderOpen size={16} className="text-[#00304D]" />
              <h2 className="text-sm font-bold text-[#00304D]">7. Otros Documentos</h2>
              {docsAdic.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-[#00304D]/10 text-[#00304D] text-[11px] font-bold">
                  {docsAdic.length}
                </span>
              )}
            </div>
            {puedeEditar && (
              <button onClick={() => { setDAForm({ tipoDocId: '' }); setDAModalOpen(true) }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#00304D] hover:bg-[#004a76] text-white transition">
                <Plus size={13} /> Agregar documento
              </button>
            )}
          </header>

          <div className="p-5 flex flex-col gap-3">
            <p className="text-xs text-neutral-500 leading-relaxed">
              A continuación podrá visualizar todos sus documentos adicionales requeridos. El soporte debe ser en formato PDF.
            </p>
            {cargandoDA ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 flex items-center gap-2 text-xs text-neutral-500">
                <Loader2 size={14} className="animate-spin" /> Cargando documentos…
              </div>
            ) : docsAdic.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 flex flex-col items-center gap-2 text-center">
                <FolderOpen size={24} className="text-neutral-300" />
                <p className="text-sm text-neutral-500">Aún no hay documentos adicionales registrados.</p>
                {puedeEditar && (
                  <p className="text-xs text-neutral-400">Click en "Agregar documento" para registrar el primero.</p>
                )}
              </div>
            ) : (
              docsAdic.map((da, idx) => {
                const aprobado = (da.estado ?? '').toUpperCase() === 'APROBADO'
                const bloqueadoDA = !puedeEditar || aprobado
                const expandida = expandedDAId === da.docAdicId
                const tieneDoc = !!da.documento
                return (
                  <div key={da.docAdicId}
                    className={`rounded-xl border bg-white overflow-hidden transition ${
                      expandida ? 'border-[#00304D] shadow-sm' : 'border-neutral-200'
                    }`}>
                    <button
                      type="button"
                      onClick={() => setExpandedDAId(expandida ? null : da.docAdicId)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-neutral-50 transition text-left"
                      aria-expanded={expandida}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 shrink-0">#{idx + 1}</span>
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#00304D]/10 text-[#00304D] border border-[#00304D]/20">
                          {da.sigla}
                        </span>
                        {aprobado && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={10} /> Aprobado
                          </span>
                        )}
                        {tieneDoc && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200" title="Tiene soporte PDF cargado">
                            <FileText size={10} /> PDF
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {!expandida && (
                          <p className="text-xs text-neutral-500 truncate">{da.nombre}</p>
                        )}
                      </div>
                      <ChevronDown size={14} className={`text-neutral-400 transition-transform shrink-0 ${expandida ? 'rotate-180' : ''}`} />
                    </button>

                    {expandida && (
                      <div className="border-t border-neutral-100 p-4 flex flex-col gap-3 bg-neutral-50/30">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Tipo de documento</p>
                            <p className="text-sm font-bold text-[#00304D]">{da.nombre}</p>
                          </div>
                          {!bloqueadoDA && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setDAConfirmEliminar(da.docAdicId) }}
                              disabled={daEliminandoId === da.docAdicId}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 transition disabled:opacity-50"
                              title="Eliminar">
                              {daEliminandoId === da.docAdicId
                                ? <Loader2 size={12} className="animate-spin" />
                                : <Trash2 size={12} />}
                              Eliminar
                            </button>
                          )}
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1.5">Soporte (PDF)</p>
                          <UploadPdf
                            personaId={persona.personaId}
                            tipo="DA"
                            num={da.docAdicId}
                            documento={da.documento}
                            bloqueado={bloqueadoDA}
                            onChange={() => recargarDocsAdicionales(persona.personaId)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}

      <Modal open={habeasOpen} onClose={() => setHabeasOpen(false)} maxWidth="max-w-2xl">
        <div className="flex flex-col max-h-[85vh]">
          <header className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2">
            <FileText size={18} className="text-[#00304D]" />
            <h3 className="text-base font-bold text-neutral-800">Política de Tratamiento de Datos · Habeas Data</h3>
          </header>
          <div className="p-6 overflow-y-auto text-[13px] text-neutral-700 leading-relaxed flex flex-col gap-3">
            <p>
              En cumplimiento de la <strong>Ley 1581 de 2012</strong> y del <strong>Decreto 1377 de 2013</strong>,
              el <strong>SERVICIO NACIONAL DE APRENDIZAJE — SENA</strong>, en su calidad de responsable del
              tratamiento de los datos personales recopilados a través del Sistema Especializado de Proyectos —
              SEP, informa a los titulares de la información lo siguiente:
            </p>
            <p>
              <strong>1. Finalidad.</strong> Los datos personales que aquí registres (nombres, identificación,
              correos, teléfonos, hoja de vida, títulos académicos, experiencia y demás documentos) serán
              utilizados con el fin de gestionar tu participación como Director de Proyecto o Capacitador en
              los convenios de Formación Continua Especializada, evaluar tu perfil, validar tu hoja de vida ante
              la interventoría, hacer seguimiento a la ejecución del convenio y cumplir las obligaciones legales
              y contractuales del SENA.
            </p>
            <p>
              <strong>2. Tratamiento autorizado.</strong> Autorizo de manera expresa, libre, voluntaria,
              inequívoca, previa e informada al SENA y a la interventoría externa designada por el SENA para
              recolectar, almacenar, usar, circular, suprimir, transmitir y/o transferir mis datos personales
              y los documentos cargados en el sistema, con las finalidades indicadas.
            </p>
            <p>
              <strong>3. Derechos del titular.</strong> Como titular tengo derecho a conocer, actualizar y
              rectificar mis datos, solicitar prueba de la autorización otorgada, ser informado sobre el uso
              dado a los mismos, presentar quejas ante la Superintendencia de Industria y Comercio por
              infracciones a la ley, revocar la autorización y/o solicitar la supresión de los datos cuando no
              se respeten los principios, derechos y garantías constitucionales y legales, y acceder en forma
              gratuita a los datos que hayan sido objeto de tratamiento.
            </p>
            <p>
              <strong>4. Conservación.</strong> Los datos serán conservados durante el tiempo necesario para
              cumplir las finalidades del tratamiento y los términos legales aplicables.
            </p>
            <p>
              <strong>5. Aceptación.</strong> Al marcar la casilla "Acepto el Habeas Data y la Política de
              Tratamiento de Datos", manifiesto que leí, comprendí y acepto íntegramente esta política, así
              como autorizo al SENA y a sus operadores a tratar mis datos personales en los términos descritos.
            </p>
            <p className="text-[11px] text-neutral-500 italic mt-2">
              Para más información puedes consultar la política completa de tratamiento de datos del SENA en{' '}
              <a href="https://www.sena.edu.co" target="_blank" rel="noopener noreferrer" className="text-[#0070C0] underline">www.sena.edu.co</a>.
            </p>
          </div>
          <footer className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex justify-end">
            <button
              onClick={() => setHabeasOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-white rounded-xl transition hover:opacity-90 bg-[#00304D]">
              Entendido
            </button>
          </footer>
        </div>
      </Modal>

      <Modal open={expModalOpen} onClose={() => !expGuardando && setExpModalOpen(false)} maxWidth="max-w-2xl">
        <div className="p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
          <h3 className="text-base font-bold text-neutral-800 flex items-center gap-2">
            <Briefcase size={18} className="text-[#00304D]" />
            {expEditandoId ? 'Editar experiencia' : 'Registrar experiencia laboral'}
          </h3>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Diligencia los datos de la experiencia. Una vez guardada, podrás adjuntar el soporte en PDF
            desde la card correspondiente.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Group label="Tipo de experiencia *">
              <select value={expForm.tipoExperienciaId}
                onChange={e => setExpForm({ ...expForm, tipoExperienciaId: e.target.value })}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] bg-white">
                <option value="">Seleccionar...</option>
                {tiposExp.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </Group>
            <div />
            <div className="sm:col-span-2">
              <Group label="Descripción *">
                <textarea value={expForm.descripcion}
                  onChange={e => setExpForm({ ...expForm, descripcion: e.target.value })}
                  maxLength={4000} rows={5}
                  placeholder="Describe la experiencia, responsabilidades, logros, etc."
                  className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] resize-y" />
              </Group>
              <p className="text-[10px] text-neutral-400 text-right mt-0.5">{expForm.descripcion.length}/4000</p>
            </div>
            <Group label="Fecha de inicio *">
              <input type="date" value={expForm.fechaInicio}
                onChange={e => setExpForm({ ...expForm, fechaInicio: e.target.value })}
                max={new Date(Date.now() - 86400000).toISOString().slice(0, 10)}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D]" />
            </Group>
            <Group label="Fecha de finalización *">
              <input type="date" value={expForm.fechaFin}
                onChange={e => setExpForm({ ...expForm, fechaFin: e.target.value })}
                max={new Date().toISOString().slice(0, 10)}
                min={expForm.fechaInicio || undefined}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D]" />
            </Group>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setExpModalOpen(false)} disabled={expGuardando}
              className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleGuardarExp} disabled={expGuardando}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition disabled:opacity-50 bg-[#00304D] hover:bg-[#004a76]">
              {expGuardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {expEditandoId ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={titModalOpen} onClose={() => !titGuardando && setTitModalOpen(false)} maxWidth="max-w-2xl">
        <div className="p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
          <h3 className="text-base font-bold text-neutral-800 flex items-center gap-2">
            <GraduationCap size={18} className="text-[#00304D]" />
            {titEditandoId ? 'Editar título' : 'Registrar título académico'}
          </h3>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Diligencia los datos del título. Una vez guardado, podrás adjuntar el soporte en PDF
            desde la card correspondiente.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Group label="Tipo de título *">
              <select value={titForm.tipoTituloId}
                onChange={e => setTitForm({ ...titForm, tipoTituloId: e.target.value })}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] bg-white">
                <option value="">Seleccionar...</option>
                {tiposTit.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </Group>
            <Group label="Fecha de graduación *">
              <input type="date" value={titForm.fechaGraduacion}
                onChange={e => setTitForm({ ...titForm, fechaGraduacion: e.target.value })}
                max={new Date().toISOString().slice(0, 10)}
                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D]" />
            </Group>
            <div className="sm:col-span-2">
              <Group label="Descripción / Nombre del título *">
                <textarea value={titForm.descripcion}
                  onChange={e => setTitForm({ ...titForm, descripcion: e.target.value })}
                  maxLength={4000} rows={4}
                  placeholder="Ej.: ECONOMISTA — UNIVERSIDAD DEL VALLE"
                  className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] resize-y" />
              </Group>
              <p className="text-[10px] text-neutral-400 text-right mt-0.5">{titForm.descripcion.length}/4000</p>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setTitModalOpen(false)} disabled={titGuardando}
              className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleGuardarTit} disabled={titGuardando}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition disabled:opacity-50 bg-[#00304D] hover:bg-[#004a76]">
              {titGuardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {titEditandoId ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={daModalOpen} onClose={() => !daGuardando && setDAModalOpen(false)} maxWidth="max-w-lg">
        <div className="p-6 flex flex-col gap-4">
          <h3 className="text-base font-bold text-neutral-800 flex items-center gap-2">
            <FolderOpen size={18} className="text-[#00304D]" />
            Agregar documento adicional
          </h3>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Selecciona el tipo de documento requerido. Una vez guardado, podrás adjuntar el soporte en PDF.
          </p>
          <Group label="Tipo de documento *">
            <select value={daForm.tipoDocId}
              onChange={e => setDAForm({ tipoDocId: e.target.value })}
              className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] bg-white">
              <option value="">Seleccionar...</option>
              {tiposDA.map(t => (
                <option key={t.id} value={t.id}>{t.nombre} — {t.sigla}</option>
              ))}
            </select>
          </Group>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setDAModalOpen(false)} disabled={daGuardando}
              className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleGuardarDA} disabled={daGuardando}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition disabled:opacity-50 bg-[#00304D] hover:bg-[#004a76]">
              {daGuardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={daConfirmEliminar != null}
        onClose={() => setDAConfirmEliminar(null)}
        onConfirm={handleEliminarDA}
        tipo="delete"
        titulo="Eliminar documento adicional"
        mensaje={
          <>
            ¿Seguro que quieres eliminar este documento adicional? Si tiene un PDF de soporte adjunto,
            también se eliminará. Esta acción no se puede deshacer.
          </>
        }
        textoConfirmar="Eliminar"
        cargando={daEliminandoId != null}
      />

      <ConfirmModal
        open={expConfirmEliminar != null}
        onClose={() => setExpConfirmEliminar(null)}
        onConfirm={handleEliminarExp}
        tipo="delete"
        titulo="Eliminar experiencia"
        mensaje={
          <>
            ¿Seguro que quieres eliminar esta experiencia? Si tiene un PDF de soporte adjunto,
            también se eliminará. Esta acción no se puede deshacer.
          </>
        }
        textoConfirmar="Eliminar"
        cargando={expEliminandoId != null}
      />

      <ConfirmModal
        open={titConfirmEliminar != null}
        onClose={() => setTitConfirmEliminar(null)}
        onConfirm={handleEliminarTit}
        tipo="delete"
        titulo="Eliminar título"
        mensaje={
          <>
            ¿Seguro que quieres eliminar este título académico? Si tiene un PDF de soporte adjunto,
            también se eliminará. Esta acción no se puede deshacer.
          </>
        }
        textoConfirmar="Eliminar"
        cargando={titEliminandoId != null}
      />
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
