'use client'

import { ConvenioNav } from '@/components/layout/convenio-nav'
import { CronogramaCalendario } from '@/components/cronograma/cronograma-calendario'
import api from '@/lib/api'
import {
  AlertCircle, BookOpen, CalendarDays, CheckCircle2, ChevronRight,
  Clock, Download, Eye, FileSignature, GraduationCap, Hash, LayoutList, Loader2, MapPin,
  Pencil, Plus, Save, Search, Settings, Trash2, User, Users, Video, X,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

// ─────────────────────────────────── tipos ────────────────────────────────────

interface AF {
  afId: number
  numero: number
  nombre: string
  modalidadId: number
  modalidad: string
  tipoEventoId: number
  tipoEvento: string
  numBenef: number
  numGrupos: number
  benefGrupo: number
  benefViGrupo: number
}
interface Grupo { grupoId: number; grupoNumero: number; totalBenef: number }
interface UT {
  utId: number
  numero: number
  nombre: string
  horasPP: number
  horasTP: number
  horasPV: number
  horasTV: number
  horasPPAT: number
  horasTPAT: number
  horasPHib: number
  horasTHib: number
  nActividad: number
}
interface Crono {
  cronogramaId: number
  grupoId: number
  utId: number
  fechaInicio: string | null
  fechaFin: string | null
  numSesiones: number | null
  numActividades: number | null
  estado: string | null
  proyectoId: number | null
}

interface SesionP {
  sesionId: number
  numSesion: number | null
  nombreSesion: string | null
  fechaInicio: string | null
  horas: number | null
  horaInicio: string | null
  horaFin: string | null
  nombreSede: string | null
  aula: string | null
  direccion: string | null
  sigla: string | null
  herramienta: string | null
  url: string | null
  estado: string | null
  estadoRadicado: string | null
  capacitadorId: number | null
  capacitadorNombre: string | null
  perfilUTId: number | null
  capSup1Id?: number | null
  capSup2Id?: number | null
  capSup3Id?: number | null
  capSup4Id?: number | null
  perfilSup1Id?: number | null
  perfilSup2Id?: number | null
  perfilSup3Id?: number | null
  perfilSup4Id?: number | null
  coberturaId?: number | null
  departamentoNombre?: string | null
  ciudadNombre?: string | null
}

interface CoberturaGrupo {
  coberturaId: number
  departamentoId: number | null
  departamentoNombre: string | null
  ciudadId: number | null
  ciudadNombre: string | null
  beneficiarios: number | null
  modalidad: string | null
}

interface SesionV {
  actividadId: number
  numSesion: number | null
  nombreActividad: string | null
  fechaInicio: string | null
  fechaFin: string | null
  horas: number | null
  plataforma: string | null
  url: string | null
  usuarioSena: string | null
  claveSena: string | null
  sigla: string | null
  estado: string | null
  estadoRadicado: string | null
  capacitadorId: number | null
  capacitadorNombre: string | null
  perfilUTId: number | null
  capSup1Id?: number | null
  capSup2Id?: number | null
  capSup3Id?: number | null
  capSup4Id?: number | null
  perfilSup1Id?: number | null
  perfilSup2Id?: number | null
  perfilSup3Id?: number | null
  perfilSup4Id?: number | null
}

interface Capacitador {
  capacitadorId: number
  tipo: 'PE' | 'EM'
  nombrePersona: string | null
  identificacionPersona: string | null
  razonSocial: string | null
  identificacionEmpresa: string | null
}

interface PerfilUT {
  perfilUTId: number
  rubroId: number
  nombre: string
  horasCap: number
}

// ─────────────────────────────── helpers ─────────────────────────────────────

const TITLE = '#00304D'
const ACCENT = '#0070C0'

function fmt(d: string | null) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return d }
}

/** Extrae "HH:MM" de cualquier formato: "HH:MM", "HH:MM:SS", ISO completo
 *  o un Date serializado. El backend de cronograma ahora envia "HH:MM"
 *  directo (via TO_CHAR), pero seguimos tolerando lo antiguo. */
function horaToHHMM(d: string | null) {
  if (!d) return ''
  const s = String(d).trim()
  const m1 = s.match(/^(\d{1,2}):(\d{2})/)
  if (m1) return `${m1[1].padStart(2, '0')}:${m1[2]}`
  const m2 = s.match(/T(\d{2}):(\d{2})/)
  if (m2) return `${m2[1]}:${m2[2]}`
  try {
    const dt = new Date(s)
    if (!isNaN(dt.getTime())) {
      return `${dt.getUTCHours().toString().padStart(2, '0')}:${dt.getUTCMinutes().toString().padStart(2, '0')}`
    }
  } catch { /* fallthrough */ }
  return ''
}

function fmtHora(d: string | null) {
  const hhmm = horaToHHMM(d)
  return hhmm || '—'
}

/** Una sesión/actividad NO se puede editar si ya fue radicada (cualquier
 *  estado que no sea recién creada / sin radicar / devuelta para corregir). */
function noEditablePorRadicado(estadoRadicado: string | null | undefined): boolean {
  const e = (estadoRadicado ?? '').trim().toUpperCase()
  return e !== '' && e !== 'PENDIENTE' && e !== 'MODIFICAR'
}

/** Mensaje según el estado de radicación, para el banner de solo lectura. */
function mensajeBloqueo(estadoRadicado: string | null | undefined, sustantivo: 'sesión' | 'actividad'): string {
  const e = (estadoRadicado ?? '').trim().toUpperCase()
  if (e === 'APROBADA')   return `Esta ${sustantivo} fue aprobada por interventoría. Solo lectura — no se puede modificar.`
  if (e === 'RECHAZADA')  return `Esta ${sustantivo} fue rechazada por interventoría. Solo lectura.`
  if (e === 'ACTUALIZADA') return `Esta ${sustantivo} ya fue corregida y enviada a interventoría. Solo lectura hasta que la revisen.`
  if (e === 'RADICADO' || e === 'RADICADA') return `Esta ${sustantivo} ya fue radicada y está en revisión por interventoría. Solo lectura hasta que la devuelvan para corrección.`
  return `Esta ${sustantivo} no se puede modificar en su estado actual${e ? ` ("${estadoRadicado}")` : ''}. Solo lectura.`
}

function badgeRadicado(estado: string | null) {
  const up = (estado ?? '').toUpperCase().trim()
  if (up === 'APROBADA') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Aprobada</span>
  }
  if (up === 'RECHAZADA') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Rechazada</span>
  }
  if (up === 'PENDIENTE' || !up) {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Pendiente</span>
  }
  return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">{up}</span>
}

function modalidadColor(id: number) {
  return ({
    1: 'bg-blue-100 text-blue-700 border-blue-200',
    2: 'bg-purple-100 text-purple-700 border-purple-200',
    3: 'bg-teal-100 text-teal-700 border-teal-200',
    4: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  } as Record<number, string>)[id] ?? 'bg-neutral-100 text-neutral-600 border-neutral-200'
}

/** Horas P + T efectivas de la UT según la modalidad de la AF (igual que &TotalEventoFor en GX). */
function horasUtSegunModalidad(ut: UT, modalidadId: number) {
  switch (modalidadId) {
    case 1: return { prac: Number(ut.horasPP), teor: Number(ut.horasTP), label: 'Presencial' }
    case 2: return { prac: Number(ut.horasPPAT), teor: Number(ut.horasTPAT), label: 'PAT' }
    case 3: return { prac: Number(ut.horasPHib), teor: Number(ut.horasTHib), label: 'Híbrida' }
    case 4: return { prac: Number(ut.horasPV), teor: Number(ut.horasTV), label: 'Virtual' }
    default: return { prac: 0, teor: 0, label: '—' }
  }
}

// ─────────────────────────────────── page ────────────────────────────────────

export default function CronogramaPage() {
  const { id } = useParams<{ id: string }>()
  const proyectoId = Number(id)

  const [afs, setAfs] = useState<AF[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [unidades, setUnidades] = useState<UT[]>([])
  const [afId, setAfId] = useState(0)
  const [grupoId, setGrupoId] = useState(0)
  const [utId, setUtId] = useState(0)

  const [afSel, setAfSel] = useState<AF | null>(null)
  const [grupoSel, setGrupoSel] = useState<Grupo | null>(null)
  const [utSel, setUtSel] = useState<UT | null>(null)
  const [crono, setCrono] = useState<Crono | null>(null)

  const [cargandoAfs, setCargandoAfs] = useState(true)
  const [cargandoGrupos, setCargandoGrupos] = useState(false)
  const [cargandoUts, setCargandoUts] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [convenioEnEjecucion, setConvenioEnEjecucion] = useState<boolean | null>(null)

  // Exportar a Excel (Fase 4)
  const [descargandoExcel, setDescargandoExcel] = useState(false)

  // Edición de cabecera del cronograma (Fase 2)
  const [editandoCabecera, setEditandoCabecera] = useState(false)
  const [formFI, setFormFI] = useState('')
  const [formFF, setFormFF] = useState('')
  const [guardandoCab, setGuardandoCab] = useState(false)
  const [errCab, setErrCab] = useState<string | null>(null)

  // Sesiones presenciales (Fase 3)
  const [sesionesP, setSesionesP] = useState<SesionP[]>([])
  const [capacitadores, setCapacitadores] = useState<Capacitador[]>([])
  const [perfilesUT, setPerfilesUT] = useState<PerfilUT[]>([])
  const [cargandoSes, setCargandoSes] = useState(false)
  // Vista del cronograma: calendario interactivo (default) o lista clasica.
  const [vistaModo, setVistaModo] = useState<'calendario' | 'lista'>('calendario')
  const [modoSes, setModoSes] = useState<'agregar' | 'editar' | null>(null)
  const [editandoSesId, setEditandoSesId] = useState<number | null>(null)
  // Si la sesion abierta en el modal ya fue radicada/aprobada: solo lectura
  // (banner + boton Guardar oculto). Guardamos tambien el estado para el texto.
  const [sesAprobadaReadOnly, setSesAprobadaReadOnly] = useState(false)
  const [sesEstadoRad, setSesEstadoRad] = useState<string | null>(null)
  const [errSes, setErrSes] = useState<string | null>(null)
  const [guardandoSes, setGuardandoSes] = useState(false)
  const [eliminandoSesId, setEliminandoSesId] = useState<number | null>(null)
  // Form fields sesión presencial
  const [fNombre, setFNombre] = useState('')
  const [fFecha, setFFecha] = useState('')
  const [fHoraIni, setFHoraIni] = useState('')
  const [fHoraFin, setFHoraFin] = useState('')
  const [fSede, setFSede] = useState('')
  const [fDireccion, setFDireccion] = useState('')
  const [fAula, setFAula] = useState('')
  const [fHerramienta, setFHerramienta] = useState('')
  const [fUrl, setFUrl] = useState('')
  const [fCapId, setFCapId] = useState(0)
  const [fPerfilId, setFPerfilId] = useState(0)
  const [fCoberturaId, setFCoberturaId] = useState(0)
  const [fCapSup, setFCapSup] = useState<[number, number, number, number]>([0, 0, 0, 0])
  const [fPerfilSup, setFPerfilSup] = useState<[number, number, number, number]>([0, 0, 0, 0])
  const [verSuplentesP, setVerSuplentesP] = useState(false)
  const [coberturasGrupo, setCoberturasGrupo] = useState<CoberturaGrupo[]>([])

  // Actividades virtuales (Fase 4)
  const [sesionesV, setSesionesV] = useState<SesionV[]>([])
  const [modoVir, setModoVir] = useState<'agregar' | 'editar' | null>(null)
  const [editandoVirId, setEditandoVirId] = useState<number | null>(null)
  const [virAprobadaReadOnly, setVirAprobadaReadOnly] = useState(false)
  const [virEstadoRad, setVirEstadoRad] = useState<string | null>(null)
  const [errVir, setErrVir] = useState<string | null>(null)
  const [guardandoVir, setGuardandoVir] = useState(false)
  const [eliminandoVirId, setEliminandoVirId] = useState<number | null>(null)
  // Form fields virtual
  const [vNombre, setVNombre] = useState('')
  const [vFechaIni, setVFechaIni] = useState('')
  const [vFechaFin, setVFechaFin] = useState('')
  const [vHoras, setVHoras] = useState('')
  const [vPlataforma, setVPlataforma] = useState('')
  const [vUrl, setVUrl] = useState('')
  const [vUsuarioSena, setVUsuarioSena] = useState('')
  const [vClaveSena, setVClaveSena] = useState('')
  const [vCapId, setVCapId] = useState(0)
  const [vPerfilId, setVPerfilId] = useState(0)
  const [vCapSup, setVCapSup] = useState<[number, number, number, number]>([0, 0, 0, 0])
  const [vPerfilSup, setVPerfilSup] = useState<[number, number, number, number]>([0, 0, 0, 0])
  const [verSuplentesV, setVerSuplentesV] = useState(false)

  useEffect(() => {
    document.title = 'Cronograma | SEP'
    api.get<AF[]>(`/cronograma/proyecto/${proyectoId}/acciones`)
      .then(r => setAfs(r.data ?? []))
      .catch(() => setError('No se pudieron cargar las Acciones de Formación.'))
      .finally(() => setCargandoAfs(false))
    // Estado del convenio (para modo solo-lectura cuando no está en ejecución).
    api.get<{ estadoNum: number | null }>(`/convenios/${proyectoId}`)
      .then(r => setConvenioEnEjecucion(Number(r.data?.estadoNum) === 1))
      .catch(() => setConvenioEnEjecucion(false))
  }, [proyectoId])

  const bloqueadoPorConvenio = convenioEnEjecucion === false

  useEffect(() => {
    if (!afId) {
      setGrupos([]); setUnidades([])
      setGrupoId(0); setUtId(0)
      setAfSel(null); setGrupoSel(null); setUtSel(null); setCrono(null); setBuscado(false)
      return
    }
    setAfSel(afs.find(a => a.afId === afId) ?? null)
    setGrupoSel(null); setUtSel(null); setCrono(null); setBuscado(false)
    setCargandoGrupos(true); setCargandoUts(true)
    Promise.all([
      api.get<Grupo[]>(`/cronograma/accion/${afId}/grupos`),
      api.get<UT[]>(`/cronograma/accion/${afId}/unidades`),
    ]).then(([rG, rU]) => { setGrupos(rG.data ?? []); setUnidades(rU.data ?? []) })
      .catch(() => setError('Error cargando grupos o unidades temáticas.'))
      .finally(() => { setCargandoGrupos(false); setCargandoUts(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afId])

  async function buscar() {
    if (!grupoId || !utId) return
    setError(null); setBuscando(true); setBuscado(false); setCrono(null)
    setUtSel(unidades.find(u => u.utId === utId) ?? null)
    setGrupoSel(grupos.find(g => g.grupoId === grupoId) ?? null)
    try {
      const r = await api.get<Crono[]>(`/cronograma/buscar?grupoId=${grupoId}&utId=${utId}`)
      const lista = r.data ?? []
      setCrono(lista[0] ?? null)
      setBuscado(true)
    } catch (e: any) {
      setError(`Error: ${e?.response?.data?.message ?? e?.message ?? 'Error desconocido'}`)
    } finally { setBuscando(false) }
  }

  async function descargarExcel() {
    setError(null); setDescargandoExcel(true)
    try {
      const r = await api.get(`/cronograma/proyecto/${proyectoId}/exportar`, { responseType: 'blob' })
      const cd: string = r.headers?.['content-disposition'] ?? ''
      const m = cd.match(/filename="?([^"]+)"?/i)
      const filename = m?.[1] ?? `Cronograma_proyecto-${proyectoId}.xlsx`
      const url = window.URL.createObjectURL(new Blob([r.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }))
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      // El error viene como Blob — intentar leerlo como JSON
      let msg = 'Error al descargar Excel.'
      try {
        const txt = await (e?.response?.data as Blob)?.text()
        const json = JSON.parse(txt)
        msg = json?.message ?? msg
      } catch { /* ignore */ }
      setError(msg)
    } finally { setDescargandoExcel(false) }
  }

  function abrirEditorCabecera() {
    setFormFI(crono?.fechaInicio ? new Date(crono.fechaInicio).toISOString().slice(0, 10) : '')
    setFormFF(crono?.fechaFin ? new Date(crono.fechaFin).toISOString().slice(0, 10) : '')
    setErrCab(null)
    setEditandoCabecera(true)
  }

  // Fase 3/4 — cargar sesiones + catálogos según modalidad
  useEffect(() => {
    if (!crono || !afSel || !utSel) {
      setSesionesP([]); setSesionesV([]); setCapacitadores([]); setPerfilesUT([]); setCoberturasGrupo([])
      return
    }
    const modal = afSel.modalidadId
    const hayPresencial = [1, 2, 3].includes(modal)
    const hayVirtual = [3, 4].includes(modal)
    if (!hayPresencial && !hayVirtual) {
      setSesionesP([]); setSesionesV([]); setCapacitadores([]); setPerfilesUT([]); setCoberturasGrupo([])
      return
    }
    setCargandoSes(true)
    const calls: Promise<any>[] = [
      api.get<Capacitador[]>(`/cronograma/proyecto/${proyectoId}/capacitadores-aprobados`),
      api.get<PerfilUT[]>(`/cronograma/unidad/${utSel.utId}/perfiles`),
      hayPresencial
        ? api.get<SesionP[]>(`/cronograma/${crono.cronogramaId}/sesiones-presenciales`)
        : Promise.resolve({ data: [] }),
      hayVirtual
        ? api.get<SesionV[]>(`/cronograma/${crono.cronogramaId}/sesiones-virtuales`)
        : Promise.resolve({ data: [] }),
      (hayPresencial || hayVirtual)
        ? api.get<CoberturaGrupo[]>(`/cronograma/${crono.cronogramaId}/coberturas-grupo`)
        : Promise.resolve({ data: [] }),
    ]
    Promise.all(calls).then(([rC, rP, rSP, rSV, rCob]) => {
      setCapacitadores(rC.data ?? [])
      setPerfilesUT(rP.data ?? [])
      setSesionesP(rSP.data ?? [])
      setSesionesV(rSV.data ?? [])
      setCoberturasGrupo(rCob.data ?? [])
    }).catch(() => setError('Error cargando sesiones, capacitadores o perfiles.'))
      .finally(() => setCargandoSes(false))
  }, [crono, afSel, utSel, proyectoId])

  function abrirAgregarSesion(preset?: { fecha?: string; horaInicio?: string; horaFin?: string }) {
    setFNombre('')
    setFFecha(preset?.fecha ?? (crono?.fechaInicio ? new Date(crono.fechaInicio).toISOString().slice(0, 10) : ''))
    setFHoraIni(preset?.horaInicio ?? '')
    setFHoraFin(preset?.horaFin ?? '')
    setFSede(''); setFDireccion(''); setFAula('')
    setFHerramienta(''); setFUrl('')
    setFCapId(capacitadores[0]?.capacitadorId ?? 0)
    setFPerfilId(perfilesUT[0]?.perfilUTId ?? 0)
    setFCoberturaId(coberturasGrupo.find(c => c.ciudadId != null)?.coberturaId ?? 0)
    setFCapSup([0, 0, 0, 0]); setFPerfilSup([0, 0, 0, 0])
    setVerSuplentesP(false)
    setErrSes(null)
    setEditandoSesId(null)
    setSesAprobadaReadOnly(false); setSesEstadoRad(null)
    setModoSes('agregar')
  }

  function abrirEditarSesion(s: SesionP) {
    setFNombre(s.nombreSesion ?? '')
    setFFecha(s.fechaInicio ? new Date(s.fechaInicio).toISOString().slice(0, 10) : '')
    setFHoraIni(s.horaInicio ? horaToHHMM(s.horaInicio) : '')
    setFHoraFin(s.horaFin ? horaToHHMM(s.horaFin) : '')
    setFSede(s.nombreSede ?? '')
    setFDireccion(s.direccion ?? '')
    setFAula(s.aula ?? '')
    setFHerramienta(s.herramienta ?? '')
    setFUrl(s.url ?? '')
    setFCapId(s.capacitadorId ?? 0)
    setFPerfilId(s.perfilUTId ?? 0)
    setFCoberturaId(s.coberturaId ?? coberturasGrupo.find(c => c.ciudadId != null)?.coberturaId ?? 0)
    setFCapSup([s.capSup1Id ?? 0, s.capSup2Id ?? 0, s.capSup3Id ?? 0, s.capSup4Id ?? 0])
    setFPerfilSup([s.perfilSup1Id ?? 0, s.perfilSup2Id ?? 0, s.perfilSup3Id ?? 0, s.perfilSup4Id ?? 0])
    const algunSup = (s.capSup1Id || s.capSup2Id || s.capSup3Id || s.capSup4Id) ? true : false
    setVerSuplentesP(algunSup)
    setErrSes(null)
    setEditandoSesId(s.sesionId)
    setSesAprobadaReadOnly(noEditablePorRadicado(s.estadoRadicado)); setSesEstadoRad(s.estadoRadicado ?? null)
    setModoSes('editar')
  }

  async function guardarSesion() {
    if (!crono || !afSel) return
    setErrSes(null)
    if (!fNombre.trim()) { setErrSes('Nombre de la sesión obligatorio.'); return }
    if (!fFecha) { setErrSes('Fecha obligatoria.'); return }
    if (!fHoraIni || !fHoraFin) { setErrSes('Horas inicio y fin obligatorias.'); return }
    if (fHoraFin <= fHoraIni) { setErrSes('La hora fin debe ser posterior a la hora inicio.'); return }
    if (!fCapId) { setErrSes('Seleccione un capacitador.'); return }
    if (!fPerfilId) { setErrSes('Seleccione el perfil del capacitador.'); return }

    setGuardandoSes(true)
    try {
      const body: any = {
        nombreSesion: fNombre.trim(),
        fechaInicio: fFecha,
        horaInicio: fHoraIni,
        horaFin: fHoraFin,
        capacitadorId: fCapId,
        perfilUTId: fPerfilId,
        modalidadId: afSel.modalidadId,
        capSup1Id: fCapSup[0], capSup2Id: fCapSup[1], capSup3Id: fCapSup[2], capSup4Id: fCapSup[3],
        perfilSup1Id: fPerfilSup[0], perfilSup2Id: fPerfilSup[1], perfilSup3Id: fPerfilSup[2], perfilSup4Id: fPerfilSup[3],
      }
      if (fCoberturaId) body.coberturaId = fCoberturaId
      if (afSel.modalidadId === 1 || afSel.modalidadId === 3) {
        body.nombreSede = fSede || null
        body.direccion = fDireccion || null
        body.aula = fAula || null
      }
      if (afSel.modalidadId === 2 || afSel.modalidadId === 3) {
        body.herramienta = fHerramienta || null
        body.url = fUrl || null
      }

      if (modoSes === 'editar' && editandoSesId) {
        await api.put(`/cronograma/sesion-presencial/${editandoSesId}`, body)
      } else {
        await api.post(`/cronograma/${crono.cronogramaId}/sesion-presencial`, body)
      }

      const [rS, rC] = await Promise.all([
        api.get<SesionP[]>(`/cronograma/${crono.cronogramaId}/sesiones-presenciales`),
        api.get<Crono[]>(`/cronograma/buscar?grupoId=${crono.grupoId}&utId=${crono.utId}`),
      ])
      setSesionesP(rS.data ?? [])
      setCrono((rC.data ?? [])[0] ?? null)
      setModoSes(null)
      setEditandoSesId(null)
    } catch (e: any) {
      setErrSes(e?.response?.data?.message ?? e?.message ?? 'Error al guardar sesión.')
    } finally { setGuardandoSes(false) }
  }

  async function eliminarSesion(sesionId: number) {
    if (!crono) return
    if (!confirm('¿Eliminar esta sesión? Esta acción no se puede deshacer.')) return
    setEliminandoSesId(sesionId)
    try {
      await api.delete(`/cronograma/sesion-presencial/${sesionId}`)
      const [rS, rC] = await Promise.all([
        api.get<SesionP[]>(`/cronograma/${crono.cronogramaId}/sesiones-presenciales`),
        api.get<Crono[]>(`/cronograma/buscar?grupoId=${crono.grupoId}&utId=${crono.utId}`),
      ])
      setSesionesP(rS.data ?? [])
      setCrono((rC.data ?? [])[0] ?? null)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Error al eliminar')
    } finally { setEliminandoSesId(null) }
  }

  // Virtuales
  function abrirAgregarVirtual(preset?: { fechaInicio?: string; fechaFin?: string }) {
    setVNombre('')
    setVFechaIni(preset?.fechaInicio ?? (crono?.fechaInicio ? new Date(crono.fechaInicio).toISOString().slice(0, 10) : ''))
    setVFechaFin(preset?.fechaFin ?? (crono?.fechaFin ? new Date(crono.fechaFin).toISOString().slice(0, 10) : ''))
    setVHoras(''); setVPlataforma(''); setVUrl('')
    setVUsuarioSena(''); setVClaveSena('')
    setVCapId(capacitadores[0]?.capacitadorId ?? 0)
    setVPerfilId(perfilesUT[0]?.perfilUTId ?? 0)
    setVCapSup([0, 0, 0, 0]); setVPerfilSup([0, 0, 0, 0])
    setVerSuplentesV(false)
    setErrVir(null)
    setEditandoVirId(null)
    setVirAprobadaReadOnly(false); setVirEstadoRad(null)
    setModoVir('agregar')
  }

  function abrirEditarVirtual(s: SesionV) {
    setVNombre(s.nombreActividad ?? '')
    setVFechaIni(s.fechaInicio ? new Date(s.fechaInicio).toISOString().slice(0, 10) : '')
    setVFechaFin(s.fechaFin ? new Date(s.fechaFin).toISOString().slice(0, 10) : '')
    setVHoras(s.horas != null ? String(s.horas) : '')
    setVPlataforma(s.plataforma ?? '')
    setVUrl(s.url ?? '')
    setVUsuarioSena(s.usuarioSena ?? '')
    setVClaveSena(s.claveSena ?? '')
    setVCapId(s.capacitadorId ?? 0)
    setVPerfilId(s.perfilUTId ?? 0)
    setVCapSup([s.capSup1Id ?? 0, s.capSup2Id ?? 0, s.capSup3Id ?? 0, s.capSup4Id ?? 0])
    setVPerfilSup([s.perfilSup1Id ?? 0, s.perfilSup2Id ?? 0, s.perfilSup3Id ?? 0, s.perfilSup4Id ?? 0])
    const algunSup = (s.capSup1Id || s.capSup2Id || s.capSup3Id || s.capSup4Id) ? true : false
    setVerSuplentesV(algunSup)
    setErrVir(null)
    setEditandoVirId(s.actividadId)
    setVirAprobadaReadOnly(noEditablePorRadicado(s.estadoRadicado)); setVirEstadoRad(s.estadoRadicado ?? null)
    setModoVir('editar')
  }

  async function guardarVirtual() {
    if (!crono || !afSel) return
    setErrVir(null)
    if (!vNombre.trim()) { setErrVir('Nombre de la actividad obligatorio.'); return }
    if (!vFechaIni || !vFechaFin) { setErrVir('Fechas inicio y fin obligatorias.'); return }
    if (vFechaFin < vFechaIni) { setErrVir('La fecha fin no puede ser menor a la fecha inicio.'); return }
    const horasNum = Number(vHoras)
    if (!horasNum || horasNum <= 0) { setErrVir('Horas debe ser un número mayor a 0.'); return }
    if (!vPlataforma.trim()) { setErrVir('Plataforma obligatoria.'); return }
    if (!vUrl.trim()) { setErrVir('URL obligatoria.'); return }
    if (!vCapId) { setErrVir('Seleccione un capacitador.'); return }
    if (!vPerfilId) { setErrVir('Seleccione el perfil del capacitador.'); return }

    setGuardandoVir(true)
    try {
      const body = {
        nombreActividad: vNombre.trim(),
        fechaInicio: vFechaIni,
        fechaFin: vFechaFin,
        horas: horasNum,
        plataforma: vPlataforma.trim(),
        url: vUrl.trim(),
        usuarioSena: vUsuarioSena.trim() || undefined,
        claveSena: vClaveSena.trim() || undefined,
        capacitadorId: vCapId,
        perfilUTId: vPerfilId,
        modalidadId: afSel.modalidadId,
        capSup1Id: vCapSup[0], capSup2Id: vCapSup[1], capSup3Id: vCapSup[2], capSup4Id: vCapSup[3],
        perfilSup1Id: vPerfilSup[0], perfilSup2Id: vPerfilSup[1], perfilSup3Id: vPerfilSup[2], perfilSup4Id: vPerfilSup[3],
      }
      if (modoVir === 'editar' && editandoVirId) {
        await api.put(`/cronograma/sesion-virtual/${editandoVirId}`, body)
      } else {
        await api.post(`/cronograma/${crono.cronogramaId}/sesion-virtual`, body)
      }
      const [rV, rC] = await Promise.all([
        api.get<SesionV[]>(`/cronograma/${crono.cronogramaId}/sesiones-virtuales`),
        api.get<Crono[]>(`/cronograma/buscar?grupoId=${crono.grupoId}&utId=${crono.utId}`),
      ])
      setSesionesV(rV.data ?? [])
      setCrono((rC.data ?? [])[0] ?? null)
      setModoVir(null); setEditandoVirId(null)
    } catch (e: any) {
      setErrVir(e?.response?.data?.message ?? e?.message ?? 'Error al guardar actividad.')
    } finally { setGuardandoVir(false) }
  }

  async function eliminarVirtual(actividadId: number) {
    if (!crono) return
    if (!confirm('¿Eliminar esta actividad? Esta acción no se puede deshacer.')) return
    setEliminandoVirId(actividadId)
    try {
      await api.delete(`/cronograma/sesion-virtual/${actividadId}`)
      const [rV, rC] = await Promise.all([
        api.get<SesionV[]>(`/cronograma/${crono.cronogramaId}/sesiones-virtuales`),
        api.get<Crono[]>(`/cronograma/buscar?grupoId=${crono.grupoId}&utId=${crono.utId}`),
      ])
      setSesionesV(rV.data ?? [])
      setCrono((rC.data ?? [])[0] ?? null)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Error al eliminar')
    } finally { setEliminandoVirId(null) }
  }

  async function guardarCabecera() {
    if (!grupoId || !utId) return
    setErrCab(null)
    if (!formFI || !formFF) { setErrCab('Las dos fechas son obligatorias.'); return }
    if (formFF < formFI) { setErrCab('La fecha fin no puede ser menor a la fecha inicio.'); return }

    setGuardandoCab(true)
    try {
      await api.post(`/cronograma/proyecto/${proyectoId}`, {
        grupoId, utId, fechaInicio: formFI, fechaFin: formFF,
      })
      const r = await api.get<Crono[]>(`/cronograma/buscar?grupoId=${grupoId}&utId=${utId}`)
      setCrono((r.data ?? [])[0] ?? null)
      setEditandoCabecera(false)
    } catch (e: any) {
      setErrCab(e?.response?.data?.message ?? e?.message ?? 'Error al guardar')
    } finally { setGuardandoCab(false) }
  }

  const canBuscar = grupoId > 0 && utId > 0

  const horas = afSel && utSel ? horasUtSegunModalidad(utSel, afSel.modalidadId) : null
  const totalEvento = horas ? horas.prac + horas.teor : 0

  // Coberturas del grupo: las que tienen ciudad son para sesiones presenciales;
  // los departamentos (sin repetir) son la cobertura de las actividades virtuales.
  const coberturasPresenciales = coberturasGrupo.filter(c => c.ciudadId != null)
  const departamentosGrupo = Array.from(
    new Set(coberturasGrupo.map(c => (c.departamentoNombre ?? '').trim()).filter(Boolean)),
  )

  return (
    <div className="min-h-screen bg-[#F0F4F8] p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <ConvenioNav proyectoId={proyectoId} />

        {bloqueadoPorConvenio && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertCircle size={16} />
            <span><strong>Convenio no está en ejecución.</strong> El cronograma está en modo solo lectura: no se puede crear, editar, eliminar ni radicar sesiones.</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl shadow-sm" style={{ backgroundColor: TITLE }}>
              <CalendarDays size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: TITLE }}>Cronograma del Proyecto</h1>
              <p className="text-xs text-neutral-500">Configurar el cronograma detallado para cada grupo de Acción de Formación</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {bloqueadoPorConvenio ? (
              <span title="Convenio no está en ejecución"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-neutral-200 text-neutral-400 cursor-not-allowed">
                <FileSignature size={14} /> Radicar
              </span>
            ) : (
              <Link
                href={`/panel/convenios/${proyectoId}/cronograma/radicar`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                style={{ backgroundColor: TITLE }}
                title="Ir a radicar el cronograma"
              >
                <FileSignature size={14} /> Radicar
              </Link>
            )}
            <button
              onClick={descargarExcel}
              disabled={descargandoExcel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#2E7D32' }}
              title="Descargar todo el cronograma del proyecto en Excel"
            >
              {descargandoExcel
                ? <><Loader2 size={14} className="animate-spin" /> Generando…</>
                : <><Download size={14} /> Descargar Excel</>}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* ── Cascada ───────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#00304D]" />
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Search size={14} className="text-neutral-400" />
              <p className="text-sm font-semibold text-neutral-600">Seleccionar grupo y unidad temática</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Acción de Formación</label>
                {cargandoAfs
                  ? <div className="flex items-center gap-2 h-10 text-sm text-neutral-400"><Loader2 size={14} className="animate-spin" /> Cargando…</div>
                  : <select value={afId} onChange={e => { setAfId(Number(e.target.value)); setGrupoId(0); setUtId(0) }}
                      className="h-10 rounded-xl border border-neutral-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0070C0]">
                      <option value={0}>— Seleccione AF —</option>
                      {afs.map(a => <option key={a.afId} value={a.afId}>AF {a.numero} — {a.nombre}</option>)}
                    </select>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Grupo</label>
                {cargandoGrupos
                  ? <div className="flex items-center gap-2 h-10 text-sm text-neutral-400"><Loader2 size={14} className="animate-spin" /> Cargando…</div>
                  : <select value={grupoId} onChange={e => setGrupoId(Number(e.target.value))} disabled={!afId}
                      className="h-10 rounded-xl border border-neutral-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0070C0] disabled:opacity-40">
                      <option value={0}>— Seleccione grupo —</option>
                      {grupos.map(g => <option key={g.grupoId} value={g.grupoId}>Grupo {g.grupoNumero} ({g.totalBenef} benef.)</option>)}
                    </select>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Unidad Temática</label>
                {cargandoUts
                  ? <div className="flex items-center gap-2 h-10 text-sm text-neutral-400"><Loader2 size={14} className="animate-spin" /> Cargando…</div>
                  : <select value={utId} onChange={e => setUtId(Number(e.target.value))} disabled={!afId}
                      className="h-10 rounded-xl border border-neutral-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0070C0] disabled:opacity-40">
                      <option value={0}>— Seleccione UT —</option>
                      {unidades.map(u => <option key={u.utId} value={u.utId}>UT {u.numero} — {u.nombre}</option>)}
                    </select>}
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={buscar} disabled={!canBuscar || buscando}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: ACCENT }}>
                {buscando ? <><Loader2 size={14} className="animate-spin" /> Buscando…</> : <><Search size={14} /> Buscar Cronograma</>}
              </button>
            </div>
          </div>
        </div>

        {/* ── Estado de búsqueda ───────────────────────────────────────────── */}
        {buscando && (
          <div className="flex items-center justify-center py-12 text-neutral-400 gap-2">
            <Loader2 size={18} className="animate-spin" /> Consultando cronograma…
          </div>
        )}

        {/* ── Información AF + UT + Cronograma ──────────────────────────────── */}
        {!buscando && buscado && afSel && utSel && grupoSel && (
          <>
            <InfoCards af={afSel} ut={utSel} grupo={grupoSel} horas={horas!} totalEvento={totalEvento} />
            <CronogramaCard
              crono={crono}
              modalidadId={afSel.modalidadId}
              totalEvento={totalEvento}
              nActividad={Number(utSel.nActividad)}
              onEditar={abrirEditorCabecera}
            />

            {/* ── Sesiones presenciales / PAT / Híbrida (Fase 3) ────────────── */}
            {crono && (
              <div className="flex items-center gap-1.5 bg-white rounded-xl border border-neutral-200 p-1 w-fit shadow-sm">
                <button
                  onClick={() => setVistaModo('calendario')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    vistaModo === 'calendario'
                      ? 'bg-[#00304D] text-white shadow-sm'
                      : 'text-neutral-500 hover:text-[#00304D] hover:bg-neutral-50'
                  }`}
                >
                  <CalendarDays size={13} /> Calendario
                </button>
                <button
                  onClick={() => setVistaModo('lista')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    vistaModo === 'lista'
                      ? 'bg-[#00304D] text-white shadow-sm'
                      : 'text-neutral-500 hover:text-[#00304D] hover:bg-neutral-50'
                  }`}
                >
                  <LayoutList size={13} /> Lista
                </button>
              </div>
            )}

            {crono && vistaModo === 'calendario' && (
              <CronogramaCalendario
                modalidadId={afSel.modalidadId}
                sesionesP={sesionesP}
                sesionesV={sesionesV}
                fechaCronoInicio={crono.fechaInicio ?? null}
                fechaCronoFin={crono.fechaFin ?? null}
                onAgregarPresencial={preset => abrirAgregarSesion(preset)}
                onAgregarVirtual={preset => abrirAgregarVirtual(preset)}
                onEditarPresencial={id => {
                  const s = sesionesP.find(x => x.sesionId === id)
                  if (s) abrirEditarSesion(s)
                }}
                onEditarVirtual={id => {
                  const a = sesionesV.find(x => x.actividadId === id)
                  if (a) abrirEditarVirtual(a)
                }}
                onMoverPresencial={async (id, fecha, horaInicio, horaFin) => {
                  await api.patch(`/cronograma/sesion-presencial/${id}`, { fechaInicio: fecha, horaInicio, horaFin })
                  // Refrescar localmente para que el calendario muestre el nuevo estado.
                  setSesionesP(arr => arr.map(s => s.sesionId === id
                    ? { ...s, fechaInicio: fecha, horaInicio, horaFin }
                    : s))
                }}
                onMoverVirtual={async (id, fechaInicio, fechaFin) => {
                  await api.patch(`/cronograma/sesion-virtual/${id}`, { fechaInicio, fechaFin })
                  setSesionesV(arr => arr.map(a => a.actividadId === id
                    ? { ...a, fechaInicio, fechaFin }
                    : a))
                }}
                onError={msg => setError(msg)}
              />
            )}

            {crono && vistaModo === 'lista' && [1, 2, 3].includes(afSel.modalidadId) && (
              <SesionesPresencialesPanel
                modalidadId={afSel.modalidadId}
                sesiones={sesionesP}
                cargando={cargandoSes}
                eliminandoSesId={eliminandoSesId}
                horasReg={sesionesP.reduce((acc, s) => acc + Number(s.horas ?? 0), 0)}
                totalEvento={totalEvento}
                onAgregar={() => abrirAgregarSesion()}
                onEditar={abrirEditarSesion}
                onEliminar={eliminarSesion}
                capacitadoresMap={capacitadores}
              />
            )}

            {/* ── Actividades virtuales / Híbrida (Fase 4) ──────────────────── */}
            {crono && vistaModo === 'lista' && [3, 4].includes(afSel.modalidadId) && (
              <SesionesVirtualesPanel
                modalidadId={afSel.modalidadId}
                actividades={sesionesV}
                cargando={cargandoSes}
                eliminandoVirId={eliminandoVirId}
                horasReg={
                  sesionesV.reduce((acc, s) => acc + Number(s.horas ?? 0), 0) +
                  (afSel.modalidadId === 3 ? sesionesP.reduce((acc, s) => acc + Number(s.horas ?? 0), 0) : 0)
                }
                totalEvento={totalEvento}
                onAgregar={() => abrirAgregarVirtual()}
                onEditar={abrirEditarVirtual}
                onEliminar={eliminarVirtual}
                capacitadoresMap={capacitadores}
              />
            )}
          </>
        )}

      </div>

      {/* ── Modal cabecera del cronograma ─────────────────────────────────── */}
      {editandoCabecera && afSel && utSel && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#00304D]" />
            <div className="p-5 space-y-4">

              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base" style={{ color: TITLE }}>
                    {crono ? 'Editar' : 'Crear'} cronograma
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Período de la unidad temática · {totalEvento} h. planificadas
                  </p>
                </div>
                <button
                  onClick={() => setEditandoCabecera(false)}
                  className="text-neutral-400 hover:text-neutral-700 transition"
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              {errCab && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle size={14} /> {errCab}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Fecha inicio</label>
                  <input
                    type="date"
                    value={formFI}
                    onChange={e => setFormFI(e.target.value)}
                    className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Fecha fin</label>
                  <input
                    type="date"
                    value={formFF}
                    min={formFI || undefined}
                    onChange={e => setFormFF(e.target.value)}
                    className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                  />
                </div>
              </div>

              {formFI && formFF && formFF >= formFI && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 flex items-center gap-3">
                  <CalendarDays size={14} className="shrink-0" />
                  <span>
                    <strong>{Math.round((new Date(formFF).getTime() - new Date(formFI).getTime()) / 86400000) + 1}</strong> días
                    {' · '}
                    <strong>{totalEvento} h.</strong> a distribuir
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  onClick={() => setEditandoCabecera(false)}
                  disabled={guardandoCab}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-600 hover:bg-neutral-100 transition disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarCabecera}
                  disabled={guardandoCab || !formFI || !formFF}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-40"
                  style={{ backgroundColor: ACCENT }}
                >
                  {guardandoCab
                    ? <><Loader2 size={13} className="animate-spin" /> Guardando…</>
                    : <><Save size={13} /> Guardar</>}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Modal Agregar / Editar sesión presencial (Fase 3) ─────────────── */}
      {modoSes && afSel && crono && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden my-8">
            <div className="h-0.5 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#00304D]" />
            <div className="p-5 space-y-4">

              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base" style={{ color: TITLE }}>
                    {sesAprobadaReadOnly ? 'Ver' : modoSes === 'editar' ? 'Editar' : 'Agregar'} sesión {afSel.modalidad.toLowerCase()}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {modoSes === 'editar'
                      ? `Sesión existente · ${totalEvento - sesionesP.reduce((a, s) => a + Number(s.horas ?? 0), 0) + Number(sesionesP.find(s => s.sesionId === editandoSesId)?.horas ?? 0)} h. disponibles`
                      : `Sesión #${(crono.numSesiones ?? 0) + 1} · ${totalEvento - sesionesP.reduce((a, s) => a + Number(s.horas ?? 0), 0)} h. disponibles`}
                  </p>
                </div>
                <button onClick={() => { setModoSes(null); setEditandoSesId(null) }} className="text-neutral-400 hover:text-neutral-700"><X size={18} /></button>
              </div>

              {errSes && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle size={14} /> {errSes}
                </div>
              )}

              {sesAprobadaReadOnly && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle size={14} /> {mensajeBloqueo(sesEstadoRad, 'sesión')}
                </div>
              )}

              {/* Nombre */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Nombre de la sesión</label>
                <input
                  type="text"
                  value={fNombre}
                  onChange={e => setFNombre(e.target.value)}
                  placeholder="Ej. CONFERENCIA DE EXPERTO"
                  className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                />
              </div>

              {/* Fecha + Horas */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Fecha</label>
                  <input
                    type="date"
                    value={fFecha}
                    min={crono.fechaInicio ? new Date(crono.fechaInicio).toISOString().slice(0, 10) : undefined}
                    max={crono.fechaFin ? new Date(crono.fechaFin).toISOString().slice(0, 10) : undefined}
                    onChange={e => setFFecha(e.target.value)}
                    className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Hora inicio</label>
                  <input
                    type="time"
                    value={fHoraIni}
                    onChange={e => setFHoraIni(e.target.value)}
                    className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Hora fin</label>
                  <input
                    type="time"
                    value={fHoraFin}
                    onChange={e => setFHoraFin(e.target.value)}
                    className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                  />
                </div>
              </div>

              {fHoraIni && fHoraFin && fHoraFin > fHoraIni && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs text-blue-700 flex items-center gap-2">
                  <Clock size={12} />
                  <strong>{((parseInt(fHoraFin.slice(0, 2)) * 60 + parseInt(fHoraFin.slice(3))) - (parseInt(fHoraIni.slice(0, 2)) * 60 + parseInt(fHoraIni.slice(3)))) / 60}</strong>
                  &nbsp;horas
                </div>
              )}

              {/* Cobertura del grupo (depto/ciudad) — solo Presencial/PAT/Híbrida */}
              {[1, 2, 3].includes(afSel.modalidadId) && coberturasPresenciales.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1">
                    <MapPin size={11} /> Cobertura del grupo (departamento · ciudad)
                  </label>
                  {coberturasPresenciales.length === 1 ? (
                    <div className="h-10 rounded-xl border border-neutral-200 px-3 text-sm flex items-center bg-neutral-50 text-neutral-600">
                      {coberturasPresenciales[0].departamentoNombre ?? '—'} · {coberturasPresenciales[0].ciudadNombre ?? '—'}
                    </div>
                  ) : (
                    <select
                      value={fCoberturaId}
                      onChange={e => setFCoberturaId(Number(e.target.value))}
                      className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                    >
                      {coberturasPresenciales.map(c => (
                        <option key={c.coberturaId} value={c.coberturaId}>
                          {c.departamentoNombre ?? '—'} · {c.ciudadNombre ?? '—'}
                          {c.beneficiarios ? ` (${c.beneficiarios} benef.)` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-[10px] text-neutral-400">El grupo tiene {coberturasPresenciales.length} cobertura(s) presencial(es); elige la que aplica a esta sesión.</p>
                </div>
              )}

              {/* Sede + Aula + Dirección — solo Presencial (1) o Híbrida (3) */}
              {(afSel.modalidadId === 1 || afSel.modalidadId === 3) && (
                <div className="space-y-2 bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                  <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1">
                    <MapPin size={11} /> Lugar presencial
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text" value={fSede} onChange={e => setFSede(e.target.value)} placeholder="Sede"
                      className="h-9 rounded-lg border border-neutral-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                    />
                    <input
                      type="text" value={fAula} onChange={e => setFAula(e.target.value)} placeholder="Aula"
                      className="h-9 rounded-lg border border-neutral-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                    />
                  </div>
                  <input
                    type="text" value={fDireccion} onChange={e => setFDireccion(e.target.value)} placeholder="Dirección"
                    className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                  />
                </div>
              )}

              {/* Herramienta + URL — solo PAT (2) o Híbrida (3) */}
              {(afSel.modalidadId === 2 || afSel.modalidadId === 3) && (
                <div className="space-y-2 bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                  <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1">
                    <Video size={11} /> Plataforma virtual
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={fHerramienta}
                      onChange={e => setFHerramienta(e.target.value)}
                      className="h-9 rounded-lg border border-neutral-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0] bg-white"
                    >
                      <option value="">Herramienta…</option>
                      <option value="ZOOM">ZOOM</option>
                      <option value="TEAMS">TEAMS</option>
                      <option value="MEET">MEET</option>
                      <option value="WEBEX">WEBEX</option>
                      <option value="OTRA">OTRA</option>
                    </select>
                    <input
                      type="url" value={fUrl} onChange={e => setFUrl(e.target.value)} placeholder="https://…"
                      className="col-span-2 h-9 rounded-lg border border-neutral-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                    />
                  </div>
                </div>
              )}

              {/* Capacitador + Perfil */}
              <div className="grid grid-cols-1 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1">
                    <User size={10} /> Capacitador
                  </label>
                  {capacitadores.length === 0 ? (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      No hay capacitadores aprobados en este proyecto.
                    </p>
                  ) : (
                    <select
                      value={fCapId}
                      onChange={e => setFCapId(Number(e.target.value))}
                      className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0] bg-white"
                    >
                      <option value={0}>— Seleccione capacitador —</option>
                      {capacitadores.map(c => (
                        <option key={c.capacitadorId} value={c.capacitadorId}>
                          {c.tipo === 'PE' ? c.nombrePersona : c.razonSocial} ({c.tipo === 'PE' ? c.identificacionPersona : c.identificacionEmpresa})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Perfil del capacitador</label>
                  {perfilesUT.length === 0 ? (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Esta unidad temática no tiene perfiles configurados.
                    </p>
                  ) : (
                    <select
                      value={fPerfilId}
                      onChange={e => setFPerfilId(Number(e.target.value))}
                      className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0] bg-white"
                    >
                      <option value={0}>— Seleccione perfil —</option>
                      {perfilesUT.map(p => (
                        <option key={p.perfilUTId} value={p.perfilUTId}>{p.nombre.slice(0, 80)}{p.nombre.length > 80 ? '…' : ''}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setVerSuplentesP(v => !v)}
                className="text-xs font-semibold text-[#00304D] hover:underline self-start"
              >
                {verSuplentesP ? '− Ocultar suplentes' : '+ Capacitadores y perfiles suplentes (4)'}
              </button>

              {verSuplentesP && (
                <div className="space-y-2 bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Capacitador suplente {i + 1}</label>
                        <select
                          value={fCapSup[i]}
                          onChange={e => {
                            const v = Number(e.target.value)
                            setFCapSup(prev => { const c = [...prev] as [number, number, number, number]; c[i] = v; return c })
                          }}
                          className="h-9 rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0] bg-white"
                        >
                          <option value={0}>— Sin capacitador —</option>
                          {capacitadores.map(c => (
                            <option key={c.capacitadorId} value={c.capacitadorId}>
                              {c.tipo === 'PE' ? c.nombrePersona : c.razonSocial}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Perfil suplente {i + 1}</label>
                        <select
                          value={fPerfilSup[i]}
                          onChange={e => {
                            const v = Number(e.target.value)
                            setFPerfilSup(prev => { const p = [...prev] as [number, number, number, number]; p[i] = v; return p })
                          }}
                          className="h-9 rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0] bg-white"
                        >
                          <option value={0}>— Sin perfil —</option>
                          {perfilesUT.map(p => (
                            <option key={p.perfilUTId} value={p.perfilUTId}>{p.nombre.slice(0, 60)}{p.nombre.length > 60 ? '…' : ''}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  onClick={() => { setModoSes(null); setEditandoSesId(null) }}
                  disabled={guardandoSes}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-600 hover:bg-neutral-100 transition disabled:opacity-40"
                >
                  Cancelar
                </button>
                {!sesAprobadaReadOnly && (
                  <button
                    onClick={guardarSesion}
                    disabled={guardandoSes || capacitadores.length === 0 || perfilesUT.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-40"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {guardandoSes
                      ? <><Loader2 size={13} className="animate-spin" /> Guardando…</>
                      : <><Save size={13} /> Guardar sesión</>}
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Modal Agregar / Editar actividad virtual (Fase 4) ───────────────── */}
      {modoVir && afSel && crono && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden my-8">
            <div className="h-0.5 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#00304D]" />
            <div className="p-5 space-y-4">

              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2" style={{ color: TITLE }}>
                    <Video size={16} />
                    {virAprobadaReadOnly ? 'Ver' : modoVir === 'editar' ? 'Editar' : 'Agregar'} actividad virtual
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {modoVir === 'editar'
                      ? `Actividad existente · ${totalEvento - sesionesV.reduce((a, s) => a + Number(s.horas ?? 0), 0) - (afSel.modalidadId === 3 ? sesionesP.reduce((a, s) => a + Number(s.horas ?? 0), 0) : 0) + Number(sesionesV.find(s => s.actividadId === editandoVirId)?.horas ?? 0)} h. disponibles`
                      : `Actividad #${(crono.numActividades ?? 0) + 1} · ${totalEvento - sesionesV.reduce((a, s) => a + Number(s.horas ?? 0), 0) - (afSel.modalidadId === 3 ? sesionesP.reduce((a, s) => a + Number(s.horas ?? 0), 0) : 0)} h. disponibles`}
                  </p>
                </div>
                <button onClick={() => { setModoVir(null); setEditandoVirId(null) }} className="text-neutral-400 hover:text-neutral-700"><X size={18} /></button>
              </div>

              {errVir && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle size={14} /> {errVir}
                </div>
              )}

              {virAprobadaReadOnly && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle size={14} /> {mensajeBloqueo(virEstadoRad, 'actividad')}
                </div>
              )}

              {/* Nombre */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Nombre de la actividad</label>
                <input
                  type="text"
                  value={vNombre}
                  onChange={e => setVNombre(e.target.value)}
                  placeholder="Ej. EVALUACIÓN INICIAL"
                  className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                />
              </div>

              {/* Período + Horas */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Fecha inicio</label>
                  <input
                    type="date"
                    value={vFechaIni}
                    min={crono.fechaInicio ? new Date(crono.fechaInicio).toISOString().slice(0, 10) : undefined}
                    max={crono.fechaFin ? new Date(crono.fechaFin).toISOString().slice(0, 10) : undefined}
                    onChange={e => setVFechaIni(e.target.value)}
                    className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Fecha fin</label>
                  <input
                    type="date"
                    value={vFechaFin}
                    min={vFechaIni || (crono.fechaInicio ? new Date(crono.fechaInicio).toISOString().slice(0, 10) : undefined)}
                    max={crono.fechaFin ? new Date(crono.fechaFin).toISOString().slice(0, 10) : undefined}
                    onChange={e => setVFechaFin(e.target.value)}
                    className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Horas totales</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={vHoras}
                    onChange={e => setVHoras(e.target.value)}
                    placeholder="16"
                    className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                  />
                </div>
              </div>

              {/* Plataforma — cada campo con su encabezado */}
              <div className="space-y-3 bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1">
                  <Video size={11} /> Plataforma virtual
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Proveedor de formación *</label>
                    <input
                      type="text"
                      value={vPlataforma}
                      onChange={e => setVPlataforma(e.target.value)}
                      placeholder="Ej. TECNOVERTICE"
                      className="h-9 rounded-lg border border-neutral-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                    />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">URL de plataforma *</label>
                    <input
                      type="url"
                      value={vUrl}
                      onChange={e => setVUrl(e.target.value)}
                      placeholder="https://plataforma.com/curso"
                      className="h-9 rounded-lg border border-neutral-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Usuario SENA</label>
                    <input
                      type="text" value={vUsuarioSena} onChange={e => setVUsuarioSena(e.target.value)} placeholder="usuario.sena"
                      className="h-9 rounded-lg border border-neutral-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Clave SENA</label>
                    <input
                      type="text" value={vClaveSena} onChange={e => setVClaveSena(e.target.value)} placeholder="clave"
                      className="h-9 rounded-lg border border-neutral-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                    />
                  </div>
                </div>
              </div>

              {/* Cobertura del grupo (departamentos) — read-only, para virtuales */}
              {departamentosGrupo.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1">
                    <MapPin size={11} /> Cobertura del grupo (departamentos)
                  </label>
                  <div className="rounded-xl border border-neutral-200 px-3 py-2 text-sm bg-neutral-50 text-neutral-600 flex flex-wrap gap-x-2 gap-y-1">
                    {departamentosGrupo.map(d => (
                      <span key={d} className="inline-flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-neutral-400" /> {d}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-neutral-400">Departamentos donde están los beneficiarios del grupo. La actividad virtual los cubre a todos.</p>
                </div>
              )}

              {/* Capacitador + Perfil */}
              <div className="grid grid-cols-1 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1">
                    <User size={10} /> Capacitador
                  </label>
                  {capacitadores.length === 0 ? (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      No hay capacitadores aprobados en este proyecto.
                    </p>
                  ) : (
                    <select
                      value={vCapId}
                      onChange={e => setVCapId(Number(e.target.value))}
                      className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0] bg-white"
                    >
                      <option value={0}>— Seleccione capacitador —</option>
                      {capacitadores.map(c => (
                        <option key={c.capacitadorId} value={c.capacitadorId}>
                          {c.tipo === 'PE' ? c.nombrePersona : c.razonSocial} ({c.tipo === 'PE' ? c.identificacionPersona : c.identificacionEmpresa})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Perfil del capacitador</label>
                  {perfilesUT.length === 0 ? (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Esta unidad temática no tiene perfiles configurados.
                    </p>
                  ) : (
                    <select
                      value={vPerfilId}
                      onChange={e => setVPerfilId(Number(e.target.value))}
                      className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0] bg-white"
                    >
                      <option value={0}>— Seleccione perfil —</option>
                      {perfilesUT.map(p => (
                        <option key={p.perfilUTId} value={p.perfilUTId}>{p.nombre.slice(0, 80)}{p.nombre.length > 80 ? '…' : ''}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setVerSuplentesV(v => !v)}
                className="text-xs font-semibold text-[#00304D] hover:underline self-start"
              >
                {verSuplentesV ? '− Ocultar suplentes' : '+ Capacitadores y perfiles suplentes (4)'}
              </button>

              {verSuplentesV && (
                <div className="space-y-2 bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Capacitador suplente {i + 1}</label>
                        <select
                          value={vCapSup[i]}
                          onChange={e => {
                            const val = Number(e.target.value)
                            setVCapSup(prev => { const c = [...prev] as [number, number, number, number]; c[i] = val; return c })
                          }}
                          className="h-9 rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0] bg-white"
                        >
                          <option value={0}>— Sin capacitador —</option>
                          {capacitadores.map(c => (
                            <option key={c.capacitadorId} value={c.capacitadorId}>
                              {c.tipo === 'PE' ? c.nombrePersona : c.razonSocial}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Perfil suplente {i + 1}</label>
                        <select
                          value={vPerfilSup[i]}
                          onChange={e => {
                            const val = Number(e.target.value)
                            setVPerfilSup(prev => { const p = [...prev] as [number, number, number, number]; p[i] = val; return p })
                          }}
                          className="h-9 rounded-lg border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0070C0] bg-white"
                        >
                          <option value={0}>— Sin perfil —</option>
                          {perfilesUT.map(p => (
                            <option key={p.perfilUTId} value={p.perfilUTId}>{p.nombre.slice(0, 60)}{p.nombre.length > 60 ? '…' : ''}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  onClick={() => { setModoVir(null); setEditandoVirId(null) }}
                  disabled={guardandoVir}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-600 hover:bg-neutral-100 transition disabled:opacity-40"
                >
                  Cancelar
                </button>
                {!virAprobadaReadOnly && (
                  <button
                    onClick={guardarVirtual}
                    disabled={guardandoVir || capacitadores.length === 0 || perfilesUT.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-40"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {guardandoVir
                      ? <><Loader2 size={13} className="animate-spin" /> Guardando…</>
                      : <><Save size={13} /> Guardar actividad</>}
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── SesionesPresencialesPanel ───────────────────────

function SesionesPresencialesPanel({
  modalidadId, sesiones, cargando, eliminandoSesId, horasReg, totalEvento,
  onAgregar, onEditar, onEliminar, capacitadoresMap,
}: {
  modalidadId: number
  sesiones: SesionP[]
  cargando: boolean
  eliminandoSesId: number | null
  horasReg: number
  totalEvento: number
  onAgregar: () => void
  onEditar: (s: SesionP) => void
  onEliminar: (sesionId: number) => void
  capacitadoresMap: Capacitador[]
}) {
  const fillPct = totalEvento > 0 ? Math.min(100, (horasReg / totalEvento) * 100) : 0
  const completo = totalEvento > 0 && horasReg >= totalEvento
  const titulo =
    modalidadId === 2 ? 'Sesiones PAT (asistidas por tecnologías)' :
    modalidadId === 3 ? 'Sesiones presenciales híbridas' :
    'Sesiones presenciales'

  function nombreCap(capId: number | null) {
    if (!capId) return '—'
    const c = capacitadoresMap.find(x => x.capacitadorId === capId)
    if (!c) return '—'
    return c.tipo === 'PE' ? c.nombrePersona : c.razonSocial
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#00304D]" />
      <div className="p-5 space-y-4">

        {/* Header con progreso */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-neutral-400" />
            <span className="text-xs font-bold uppercase text-neutral-400 tracking-wide">{titulo}</span>
            {sesiones.length > 0 && (
              <span className="text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{sesiones.length}</span>
            )}
          </div>
          <button
            onClick={onAgregar}
            disabled={completo}
            title={completo ? 'Ya alcanzó el total de horas de la UT' : 'Agregar nueva sesión'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: ACCENT }}
          >
            <Plus size={12} /> Agregar sesión
          </button>
        </div>

        {/* Barra de progreso de horas */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Horas registradas</span>
            <span><strong className={completo ? 'text-emerald-600' : 'text-neutral-700'}>{horasReg}</strong> / {totalEvento} h.</span>
          </div>
          <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${completo ? 'bg-emerald-500' : 'bg-[#0070C0]'}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        {/* Loading / vacío / tabla */}
        {cargando ? (
          <div className="flex items-center gap-2 py-6 justify-center text-neutral-400 text-xs">
            <Loader2 size={14} className="animate-spin" /> Cargando sesiones…
          </div>
        ) : sesiones.length === 0 ? (
          <div className="text-center py-6 text-neutral-400 text-xs">
            <CalendarDays size={24} className="mx-auto mb-1 opacity-30" />
            Aún no hay sesiones registradas. Agrega la primera.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-neutral-50 text-neutral-400 uppercase text-[10px] tracking-wide">
                  <th className="px-3 py-2 text-center w-8">#</th>
                  <th className="px-3 py-2 text-left">Sigla</th>
                  <th className="px-3 py-2 text-left">Sesión</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-center">Horario</th>
                  <th className="px-3 py-2 text-center">Hrs.</th>
                  <th className="px-3 py-2 text-left">Lugar / Plataforma</th>
                  <th className="px-3 py-2 text-left">Capacitador</th>
                  <th className="px-3 py-2 text-center">Interventoría</th>
                  <th className="px-3 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sesiones.map(s => {
                  const aprobada = noEditablePorRadicado(s.estadoRadicado)
                  return (
                    <tr key={s.sesionId} className="hover:bg-neutral-50">
                      <td className="px-3 py-2.5 text-center font-semibold text-neutral-400">{s.numSesion ?? '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-neutral-500">{s.sigla ?? '—'}</td>
                      <td className="px-3 py-2.5 text-neutral-700 max-w-[180px] truncate" title={s.nombreSesion ?? ''}>
                        {s.nombreSesion ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 font-medium">{fmt(s.fechaInicio)}</td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {s.horaInicio ? `${fmtHora(s.horaInicio)} – ${fmtHora(s.horaFin)}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-[#0070C0]">{s.horas ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        {(s.departamentoNombre || s.ciudadNombre) && (
                          <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                            <MapPin size={10} /> {s.departamentoNombre ?? '—'}{s.ciudadNombre && ` · ${s.ciudadNombre}`}
                          </p>
                        )}
                        {s.nombreSede && <p className="font-medium text-neutral-700">{s.nombreSede}{s.aula && ` · ${s.aula}`}</p>}
                        {s.herramienta && (
                          <p className="text-neutral-500 flex items-center gap-1">
                            <Video size={10} /> {s.herramienta}
                            {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-500 ml-1 underline truncate max-w-[140px]">link</a>}
                          </p>
                        )}
                        {!s.nombreSede && !s.herramienta && !s.departamentoNombre && '—'}
                      </td>
                      <td className="px-3 py-2.5 text-neutral-700">{s.capacitadorNombre ?? nombreCap(s.capacitadorId)}</td>
                      <td className="px-3 py-2.5 text-center">{badgeRadicado(s.estadoRadicado)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {aprobada ? (
                          <button
                            onClick={() => onEditar(s)}
                            className="text-neutral-400 hover:text-[#00304D] transition p-1"
                            title="Ver detalle (solo lectura — ya radicada)"
                          >
                            <Eye size={14} />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => onEditar(s)}
                              className="text-neutral-300 hover:text-[#0070C0] transition p-1"
                              title="Editar sesión"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => onEliminar(s.sesionId)}
                              disabled={eliminandoSesId === s.sesionId}
                              className="text-neutral-300 hover:text-red-500 transition p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Eliminar sesión"
                            >
                              {eliminandoSesId === s.sesionId
                                ? <Loader2 size={13} className="animate-spin" />
                                : <Trash2 size={13} />}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}

// ─────────────────────────── SesionesVirtualesPanel ──────────────────────────

function SesionesVirtualesPanel({
  modalidadId, actividades, cargando, eliminandoVirId, horasReg, totalEvento,
  onAgregar, onEditar, onEliminar, capacitadoresMap,
}: {
  modalidadId: number
  actividades: SesionV[]
  cargando: boolean
  eliminandoVirId: number | null
  horasReg: number
  totalEvento: number
  onAgregar: () => void
  onEditar: (s: SesionV) => void
  onEliminar: (actividadId: number) => void
  capacitadoresMap: Capacitador[]
}) {
  const fillPct = totalEvento > 0 ? Math.min(100, (horasReg / totalEvento) * 100) : 0
  const completo = totalEvento > 0 && horasReg >= totalEvento
  const titulo = modalidadId === 3 ? 'Actividades virtuales híbridas' : 'Actividades virtuales'

  function nombreCap(capId: number | null) {
    if (!capId) return '—'
    const c = capacitadoresMap.find(x => x.capacitadorId === capId)
    if (!c) return '—'
    return c.tipo === 'PE' ? c.nombrePersona : c.razonSocial
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#00304D]" />
      <div className="p-5 space-y-4">

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Video size={14} className="text-neutral-400" />
            <span className="text-xs font-bold uppercase text-neutral-400 tracking-wide">{titulo}</span>
            {actividades.length > 0 && (
              <span className="text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{actividades.length}</span>
            )}
          </div>
          <button
            onClick={onAgregar}
            disabled={completo}
            title={completo ? 'Ya alcanzó el total de horas de la UT' : 'Agregar nueva actividad virtual'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: ACCENT }}
          >
            <Plus size={12} /> Agregar actividad
          </button>
        </div>

        {modalidadId === 3 && (
          <p className="text-[11px] text-neutral-500 italic">
            En modalidad híbrida, las horas presenciales y virtuales suman al total de la UT.
          </p>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Horas registradas</span>
            <span><strong className={completo ? 'text-emerald-600' : 'text-neutral-700'}>{horasReg}</strong> / {totalEvento} h.</span>
          </div>
          <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${completo ? 'bg-emerald-500' : 'bg-[#0070C0]'}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        {cargando ? (
          <div className="flex items-center gap-2 py-6 justify-center text-neutral-400 text-xs">
            <Loader2 size={14} className="animate-spin" /> Cargando actividades…
          </div>
        ) : actividades.length === 0 ? (
          <div className="text-center py-6 text-neutral-400 text-xs">
            <Video size={24} className="mx-auto mb-1 opacity-30" />
            Aún no hay actividades virtuales registradas.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-neutral-50 text-neutral-400 uppercase text-[10px] tracking-wide">
                  <th className="px-3 py-2 text-center w-8">#</th>
                  <th className="px-3 py-2 text-left">Sigla</th>
                  <th className="px-3 py-2 text-left">Actividad</th>
                  <th className="px-3 py-2 text-left">Período</th>
                  <th className="px-3 py-2 text-center">Hrs.</th>
                  <th className="px-3 py-2 text-left">Plataforma / URL</th>
                  <th className="px-3 py-2 text-left">Capacitador</th>
                  <th className="px-3 py-2 text-center">Interventoría</th>
                  <th className="px-3 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {actividades.map(s => {
                  const aprobada = noEditablePorRadicado(s.estadoRadicado)
                  return (
                    <tr key={s.actividadId} className="hover:bg-neutral-50">
                      <td className="px-3 py-2.5 text-center font-semibold text-neutral-400">{s.numSesion ?? '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-neutral-500">{s.sigla ?? '—'}</td>
                      <td className="px-3 py-2.5 text-neutral-700 max-w-[180px] truncate" title={s.nombreActividad ?? ''}>
                        {s.nombreActividad ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium">
                        {fmt(s.fechaInicio)}
                        {s.fechaFin && s.fechaFin !== s.fechaInicio && <> → {fmt(s.fechaFin)}</>}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-[#0070C0]">{s.horas ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        {s.plataforma && <p className="font-medium text-neutral-700">{s.plataforma}</p>}
                        {s.url && (
                          <a href={s.url} target="_blank" rel="noreferrer"
                            className="text-blue-500 hover:text-blue-700 underline truncate inline-block max-w-[180px]">
                            {s.url}
                          </a>
                        )}
                        {!s.plataforma && !s.url && '—'}
                      </td>
                      <td className="px-3 py-2.5 text-neutral-700">{s.capacitadorNombre ?? nombreCap(s.capacitadorId)}</td>
                      <td className="px-3 py-2.5 text-center">{badgeRadicado(s.estadoRadicado)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {aprobada ? (
                          <button
                            onClick={() => onEditar(s)}
                            className="text-neutral-400 hover:text-[#00304D] transition p-1"
                            title="Ver detalle (solo lectura — ya radicada)"
                          >
                            <Eye size={14} />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => onEditar(s)}
                              className="text-neutral-300 hover:text-[#0070C0] transition p-1"
                              title="Editar actividad"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => onEliminar(s.actividadId)}
                              disabled={eliminandoVirId === s.actividadId}
                              className="text-neutral-300 hover:text-red-500 transition p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Eliminar actividad"
                            >
                              {eliminandoVirId === s.actividadId
                                ? <Loader2 size={13} className="animate-spin" />
                                : <Trash2 size={13} />}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}

// ─────────────────────────────── InfoCards ───────────────────────────────────

function InfoCards({ af, ut, grupo, horas, totalEvento }: {
  af: AF
  ut: UT
  grupo: Grupo
  horas: { prac: number; teor: number; label: string }
  totalEvento: number
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* AF */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-[#00304D] to-[#0070C0]" />
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-neutral-400" />
              <span className="text-xs font-bold uppercase text-neutral-400 tracking-wide">Acción de Formación</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${modalidadColor(af.modalidadId)}`}>{af.modalidad}</span>
          </div>
          <p className="text-sm font-bold leading-snug" style={{ color: TITLE }}>AF {af.numero} — {af.nombre}</p>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Stat icon={<Users size={12} />} label="Beneficiarios" value={af.numBenef} />
            <Stat icon={<ChevronRight size={12} />} label="Grupos" value={af.numGrupos} />
            <Stat icon={<GraduationCap size={12} />} label="Tipo evento" value={af.tipoEvento} mono />
            <Stat icon={<Users size={12} />} label="Grupo seleccionado" value={`Grupo ${grupo.grupoNumero} · ${grupo.totalBenef}`} mono />
          </div>
        </div>
      </div>

      {/* UT */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-[#00304D] to-[#0070C0]" />
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Hash size={14} className="text-neutral-400" />
            <span className="text-xs font-bold uppercase text-neutral-400 tracking-wide">Unidad Temática</span>
          </div>
          <p className="text-sm font-bold leading-snug" style={{ color: TITLE }}>UT {ut.numero} — {ut.nombre}</p>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <Stat icon={<Clock size={12} />} label={`Prácticas (${horas.label})`} value={`${horas.prac} h.`} />
            <Stat icon={<Clock size={12} />} label={`Teóricas (${horas.label})`} value={`${horas.teor} h.`} />
            <Stat icon={<Clock size={12} />} label="Total evento" value={`${totalEvento} h.`} highlight />
          </div>

          {af.modalidadId === 4 && (
            <p className="text-xs text-neutral-500 pt-1">
              Actividades virtuales esperadas: <strong>{Number(ut.nActividad)}</strong>
            </p>
          )}
        </div>
      </div>

    </div>
  )
}

function Stat({ icon, label, value, mono, highlight }: {
  icon: React.ReactNode
  label: string
  value: string | number
  mono?: boolean
  highlight?: boolean
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-400 font-semibold">
        {icon}{label}
      </div>
      <p className={`text-sm ${highlight ? 'font-bold text-[#0070C0]' : 'font-semibold text-neutral-700'} ${mono ? 'truncate' : ''}`}>
        {value}
      </p>
    </div>
  )
}

// ─────────────────────────────── CronogramaCard ──────────────────────────────

function CronogramaCard({ crono, modalidadId, totalEvento, nActividad, onEditar }: {
  crono: Crono | null
  modalidadId: number
  totalEvento: number
  nActividad: number
  onEditar: () => void
}) {
  const existe = !!crono
  const esVirtual = modalidadId === 4

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#00304D]" />
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-neutral-400" />
            <span className="text-xs font-bold uppercase text-neutral-400 tracking-wide">Cronograma</span>
          </div>
          {existe
            ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 size={10} /> Registrado
              </span>
            : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle size={10} /> No registrado
              </span>}
        </div>

        {existe ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={<CalendarDays size={12} />} label="Fecha inicio" value={fmt(crono!.fechaInicio)} />
            <Stat icon={<CalendarDays size={12} />} label="Fecha fin" value={fmt(crono!.fechaFin)} />
            {!esVirtual && (
              <Stat icon={<Hash size={12} />} label="# sesiones" value={Number(crono!.numSesiones ?? 0)} highlight />
            )}
            {esVirtual && (
              <Stat icon={<Hash size={12} />} label="# actividades" value={Number(crono!.numActividades ?? 0)} highlight />
            )}
            <Stat icon={<Clock size={12} />} label="Total horas evento" value={`${totalEvento} h.`} />
          </div>
        ) : (
          <div className="text-center py-6 text-neutral-400">
            <CalendarDays size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay cronograma registrado para esta combinación.</p>
            <p className="text-xs mt-1">
              {esVirtual
                ? `Total esperado: ${totalEvento} h. en ${nActividad} actividades virtuales.`
                : `Total esperado: ${totalEvento} h.`}
            </p>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-neutral-100">
          <button
            onClick={onEditar}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 shadow-sm"
            style={{ backgroundColor: ACCENT }}
          >
            {existe ? <Pencil size={13} /> : <Plus size={13} />}
            {existe ? 'Editar cronograma' : 'Crear cronograma'}
          </button>
        </div>
      </div>
    </div>
  )
}
