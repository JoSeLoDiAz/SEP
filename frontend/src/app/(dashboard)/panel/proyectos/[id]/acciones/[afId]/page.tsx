'use client'

import api from '@/lib/api'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  AlertCircle, BookOpen, CheckCircle2, ChevronDown, ChevronRight, ChevronUp,
  ClipboardList, FolderKanban, Layers, Loader2, LogOut, Plus, Save, Search, Trash2, Users, X,
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

interface AFDetalle {
  afId: number
  numero: number
  nombre: string
  necesidadFormacionId: number | null
  justnec: string | null
  causa: string | null
  efectos: string | null
  objetivo: string | null
  tipoEventoId: number | null
  tipoEvento: string | null
  modalidadFormacionId: number | null
  modalidadFormacion: string | null
  metodologiaAprendizajeId: number | null
  modeloAprendizajeId: number | null
  numHorasGrupo: number | null
  numGrupos: number | null
  benefGrupo: number | null
  benefViGrupo: number | null
  numTotHorasGrup: number | null
  numBenef: number | null
  proyectoModalidadId: number | null
  proyectoId: number
}

interface Perfil {
  afId: number
  afEnfoqueId: number | null
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

interface AreaItem       { aafId: number; areaId: number; nombre: string; otro: string | null }
interface NivelItem      { anId: number; nivelId: number; nombre: string }
interface CuocItem       { ocAfId: number; cuocId: number; nombre: string }
interface SectorBenef    { psId: number; sectorId: number; nombre: string }
interface SubSectorBenef { pssId: number; subsectorId: number; nombre: string }
interface SectorAf       { saId: number; sectorId: number; nombre: string }
interface SubSectorAf    { ssaId: number; subsectorId: number; nombre: string }

interface SectoresData {
  justificacion: string | null
  sectoresBenef: SectorBenef[]
  subsectoresBenef: SubSectorBenef[]
  sectoresAf: SectorAf[]
  subsectoresAf: SubSectorAf[]
}

// ── Unidades Temáticas types ──────────────────────────────────────────────────

interface UTResumen {
  utId: number
  numero: number
  nombre: string
  totalPrac: number
  totalTeor: number
  esTransversal: number
}

interface UTActividad {
  actId: number
  actividadId: number
  nombre: string
  otro: string | null
}

interface UTPerfilCap {
  perfilId: number
  rubroId: number
  rubroNombre: string
  horasCap: number
  dias: number | null
}

interface UTDetalle {
  utId: number
  numero: number
  nombre: string
  competencias: string | null
  contenido: string | null
  justActividad: string | null
  horasPP: number | null; horasPV: number | null
  horasPPAT: number | null; horasPHib: number | null
  horasTP: number | null; horasTV: number | null
  horasTPAT: number | null; horasTHib: number | null
  esTransversal: number
  horasTransversal: number | null
  articulacionTerritorialId: number | null
  articulacionTerritorialNombre: string | null
  actividades: UTActividad[]
  perfiles: UTPerfilCap[]
}

interface UTDetFormState {
  contenido: string
  competencias: string
  justActividad: string
  horasPrac: string
  horasTeor: string
}

function getHorasPrac(ut: UTDetalle) {
  return (ut.horasPP ?? 0) + (ut.horasPV ?? 0) + (ut.horasPPAT ?? 0) + (ut.horasPHib ?? 0)
}
function getHorasTeor(ut: UTDetalle) {
  return (ut.horasTP ?? 0) + (ut.horasTV ?? 0) + (ut.horasTPAT ?? 0) + (ut.horasTHib ?? 0)
}
function labelHorasUT(m: number | null) {
  if (m === 2) return { prac: 'Horas Prácticas (PP-PAT)', teor: 'Horas Teóricas (TP-PAT)' }
  if (m === 4) return { prac: 'Horas Prácticas (Virtual)', teor: 'Horas Teóricas (Virtual)' }
  if (m === 3 || m === 5 || m === 6) return { prac: 'Horas Prácticas (Híbrida)', teor: 'Horas Teóricas (Híbrida)' }
  return { prac: 'Horas Prácticas (Presencial)', teor: 'Horas Teóricas (Presencial)' }
}
function tieneActividadVirtualOAumentada(actividades: UTActividad[]) {
  return actividades.some(a => /virtual|aumentad/i.test(a.nombre))
}

interface Opcion    { id: number; nombre: string }
interface Necesidad { id: number; nombre: string; numero: number | null }

// ── Cascading maps ────────────────────────────────────────────────────────────

const EVENTO_MODALIDADES: Record<number, number[]> = {
  1: [1, 2, 3],
  2: [1, 3],
  3: [1, 2],
  4: [1, 2],
  5: [1, 2, 4],
  6: [2, 4, 1],
  8: [1],
  9: [1],
}
const EVENTO_METODOLOGIAS: Record<number, number[]> = {
  1: [1],
  2: [1],
  3: [2],
  4: [2, 3],
  5: [2],
  6: [2],
  8: [2, 3],
  9: [2, 3],
}
const MOD_CON_VIRTUAL = new Set([3, 4, 5, 6])
const MOD_SOLO_VIRTUAL = new Set([4])

// ── Alert messages (full VBA text) ────────────────────────────────────────────

function getMensajeAlerta(eventoId: number | null, modalidadId: number | null): string | null {
  if (!eventoId) return null
  const e = eventoId
  const m = modalidadId
  if (e === 1) {
    const base = 'Alerta: Para el evento CONFERENCIA, se permite un máximo de 2 grupos por Acción de Formación. El número de horas debe estar entre 1 y 4. Solo se permiten dos Acciónes de Formación de este tipo de evento por proyecto.'
    if (m === 1) return base + ' PRESENCIAL: Mínimo sesenta (60) y máximo doscientos cincuenta (250) beneficiarios por grupo.'
    if (m === 2) return base + ' PAT: Mínimo sesenta (60) y máximo doscientos cincuenta (250) beneficiarios por grupo.'
    if (m === 3) return base + ' Modalidad PRESENCIAL HÍBRIDA - Mínimo sesenta (60) y máximo doscientos cincuenta (250) beneficiarios por grupo. (Mínimo cincuenta (50) beneficiarios en modalidad presencial cuando el evento de formación beneficia a 60 personas y el restante de manera sincrónica). (Mínimo sesenta (60) beneficiarios en modalidad presencial cuando el evento de formación beneficia a más de 60 personas y el restante de manera sincrónica).'
    return base
  }
  if (e === 2) {
    const base = 'Alerta: Para el evento FORO, se permite un máximo de 2 grupos por Acción de Formación. El número de horas debe estar entre 1 y 4. Máximo dos (02) acciones de formación de este tipo de evento por proyecto.'
    if (m === 1) return base + ' Modalidad PRESENCIAL - Mínimo sesenta (60) y máximo doscientos cincuenta (250) beneficiarios por grupo.'
    if (m === 3) return base + ' Modalidad PRESENCIAL HÍBRIDA - Mínimo sesenta (60) y máximo doscientos cincuenta (250) beneficiarios por grupo. (Mínimo cincuenta (50) beneficiarios en modalidad presencial cuando el evento de formación beneficia a 60 personas y el restante de manera sincrónica). (Mínimo sesenta (60) beneficiarios en modalidad presencial cuando el evento de formación beneficia a más de 60 personas y el restante de manera sincrónica).'
    return base
  }
  if (e === 3) return 'Alerta: Para el evento SEMINARIO, el número de horas debe estar entre 8 y 16. Cada grupo debe tener mínimo 20 y máximo 50 beneficiarios.'
  if (e === 4) return 'Alerta: Para el evento TALLER, el número de horas debe estar entre 4 y 24. Cada grupo debe tener mínimo 20 y máximo 30 beneficiarios.'
  if (e === 8) return 'Alerta: Para el evento TALLER-PUESTO DE TRABAJO REAL, se permite un máximo de 2 grupos por Acción de Formación. La duración debe ser de 28 horas. Solo se permite una Acción de Formación de este tipo de evento por proyecto. Cada grupo debe tener exactamente 5 beneficiarios.'
  if (e === 9) return 'Alerta: Para el evento TALLER-BOOTCAMP, se permite un máximo de 2 grupos por Acción de Formación. La duración puede ser de 16 o 24 horas de inmersión (8 horas diarias). Solo se permite una Acción de Formación de este tipo de evento por proyecto. Mínimo 10 y máximo 30 beneficiarios por grupo.'
  if (e === 5) {
    if (m === 2) return 'Alerta: Evento CURSO en modalidad PAT (Presencial Asistida por Tecnologías). El número de horas debe estar entre 20 y 80. Mínimo 20 y máximo 30 beneficiarios por grupo. Se permite máximo 20 grupos por Acción de Formación.'
    if (m === 1) return 'Alerta: Evento CURSO en modalidad PRESENCIAL. El número de horas debe estar entre 20 y 80. Mínimo 20 y máximo 30 beneficiarios por grupo. Se permite máximo 20 grupos por Acción de Formación.'
    if (m === 4) return 'Alerta: Evento CURSO en modalidad VIRTUAL. La duración puede ser de 20 o 40 horas. Mínimo 20 y máximo 50 beneficiarios por grupo. Se permite máximo 20 grupos por Acción de Formación.'
    return 'Alerta: Evento CURSO. El número de horas debe estar entre 20 y 80. Mínimo 20 y máximo 30 beneficiarios por grupo. Se permite máximo 20 grupos por Acción de Formación.'
  }
  if (e === 6) {
    if (m === 2) return 'Alerta: Evento DIPLOMADO en modalidad PAT. El número de horas debe estar entre 80 y 120. Mínimo 20 y máximo 30 beneficiarios por grupo. Se permite máximo 20 grupos por Acción de Formación.'
    if (m === 1) return 'Alerta: Evento DIPLOMADO en modalidad PRESENCIAL. El número de horas debe estar entre 80 y 120. Mínimo 20 y máximo 30 beneficiarios por grupo. Se permite máximo 20 grupos por Acción de Formación.'
    if (m === 4) return 'Alerta: Evento DIPLOMADO en modalidad VIRTUAL. La duración puede ser de 80 o 120 horas. Mínimo 20 y máximo 50 beneficiarios por grupo. Se permite máximo 20 grupos por Acción de Formación.'
    return 'Alerta: Evento DIPLOMADO. El número de horas debe estar entre 80 y 120. Mínimo 20 y máximo 30 beneficiarios por grupo. Se permite máximo 20 grupos por Acción de Formación.'
  }
  return null
}

// ── Validation ────────────────────────────────────────────────────────────────

function validarCampos(form: FormState, proyectoModalidadId: number | null): string | null {
  if (!form.nombre.trim()) return 'El nombre de la acción de formación es obligatorio.'
  if (form.nombre.trim().length > 500) return 'El nombre no puede superar 500 caracteres.'
  if (!form.tipoEventoId) return 'Debe seleccionar un tipo de evento.'
  if (!form.modalidadFormacionId) return 'Debe seleccionar una modalidad de formación.'
  if (!form.metodologiaAprendizajeId) return 'Debe seleccionar una metodología de aprendizaje.'

  const eventoId = Number(form.tipoEventoId)
  const modalidadId = Number(form.modalidadFormacionId)
  const horas = Number(form.numHorasGrupo) || 0
  const grupos = Number(form.numGrupos) || 0
  const benef = Number(form.benefGrupo) || 0
  const benefVi = Number(form.benefViGrupo) || 0

  if (!form.numHorasGrupo || horas <= 0) return 'Ingrese el número de horas por grupo.'
  if (!form.numGrupos || grupos <= 0) return 'Ingrese el número de grupos.'
  if (horas > 120) return 'El número de horas no puede superar 120.'
  if (grupos > 20) return 'El número de grupos no puede superar 20.'

  const esPresencial = !MOD_CON_VIRTUAL.has(modalidadId)
  const esSoloVirtual = MOD_SOLO_VIRTUAL.has(modalidadId)
  const esHibrida = modalidadId === 3 || modalidadId === 5 || modalidadId === 6
  const esIndGremio = proyectoModalidadId === 1 || proyectoModalidadId === 3

  if (eventoId === 1) {
    if (horas < 1 || horas > 4) return 'CONFERENCIA: las horas deben estar entre 1 y 4.'
    if (grupos < 1 || grupos > 2) return 'CONFERENCIA: el número de grupos debe ser 1 o 2.'
    if (esPresencial && (benef < 60 || benef > 250)) return 'CONFERENCIA Presencial/PAT: beneficiarios entre 60 y 250 por grupo.'
    if (esHibrida) {
      const total = benef + benefVi
      if (benefVi < 1) return 'CONFERENCIA Híbrida: debe ingresar beneficiarios sincrónicos.'
      if (total > 250) return 'CONFERENCIA Híbrida: el total de beneficiarios no puede superar 250 por grupo.'
      if (total <= 60 && benef < 50) return 'CONFERENCIA Híbrida: mínimo 50 beneficiarios presenciales cuando el total es hasta 60.'
      if (total > 60 && benef < 60) return 'CONFERENCIA Híbrida: mínimo 60 beneficiarios presenciales cuando el total supera 60.'
    }
  }
  if (eventoId === 2) {
    if (horas < 1 || horas > 4) return 'FORO: las horas deben estar entre 1 y 4.'
    if (grupos < 1 || grupos > 2) return 'FORO: el número de grupos debe ser 1 o 2.'
    if (esPresencial && (benef < 60 || benef > 250)) return 'FORO Presencial: beneficiarios entre 60 y 250 por grupo.'
    if (esHibrida) {
      const total = benef + benefVi
      if (benefVi < 1) return 'FORO Híbrida: debe ingresar beneficiarios sincrónicos.'
      if (total > 250) return 'FORO Híbrida: el total de beneficiarios no puede superar 250 por grupo.'
      if (total <= 60 && benef < 50) return 'FORO Híbrida: mínimo 50 beneficiarios presenciales cuando el total es hasta 60.'
      if (total > 60 && benef < 60) return 'FORO Híbrida: mínimo 60 beneficiarios presenciales cuando el total supera 60.'
    }
  }
  if (esIndGremio) {
    if (eventoId === 3) {
      if (horas < 8 || horas > 16) return 'SEMINARIO: las horas deben estar entre 8 y 16.'
      if (benef < 20 || benef > 50) return 'SEMINARIO: beneficiarios entre 20 y 50 por grupo.'
    }
    if (eventoId === 4) {
      if (horas < 4 || horas > 24) return 'TALLER: las horas deben estar entre 4 y 24.'
      if (benef < 20 || benef > 30) return 'TALLER: beneficiarios entre 20 y 30 por grupo.'
    }
    if (eventoId === 8) {
      if (horas !== 28) return 'TALLER-PUESTO DE TRABAJO REAL: la duración debe ser exactamente 28 horas.'
      if (grupos > 2) return 'TALLER-PUESTO DE TRABAJO REAL: máximo 2 grupos.'
      if (benef !== 5) return 'TALLER-PUESTO DE TRABAJO REAL: exactamente 5 beneficiarios por grupo.'
    }
    if (eventoId === 9) {
      if (horas !== 16 && horas !== 24) return 'TALLER-BOOTCAMP: las horas deben ser 16 o 24.'
      if (grupos > 2) return 'TALLER-BOOTCAMP: máximo 2 grupos.'
      if (benef < 10 || benef > 30) return 'TALLER-BOOTCAMP: beneficiarios entre 10 y 30 por grupo.'
    }
    if (eventoId === 5) {
      if (esSoloVirtual) {
        if (horas !== 20 && horas !== 40) return 'CURSO Virtual: las horas deben ser 20 o 40.'
        if (benefVi < 20 || benefVi > 50) return 'CURSO Virtual: beneficiarios virtuales entre 20 y 50 por grupo.'
      } else {
        if (horas < 20 || horas > 80) return 'CURSO: las horas deben estar entre 20 y 80.'
        if (benef < 20 || benef > 30) return 'CURSO: beneficiarios entre 20 y 30 por grupo.'
      }
    }
    if (eventoId === 6) {
      if (esSoloVirtual) {
        if (horas !== 80 && horas !== 120) return 'DIPLOMADO Virtual: las horas deben ser 80 o 120.'
        if (benefVi < 20 || benefVi > 50) return 'DIPLOMADO Virtual: beneficiarios virtuales entre 20 y 50 por grupo.'
      } else {
        if (horas < 80 || horas > 120) return 'DIPLOMADO: las horas deben estar entre 80 y 120.'
        if (benef < 20 || benef > 30) return 'DIPLOMADO: beneficiarios entre 20 y 30 por grupo.'
      }
    }
  }
  if (!esSoloVirtual && !esHibrida && benef <= 0) return 'Ingrese el número de beneficiarios presenciales por grupo.'
  if (esSoloVirtual && benefVi <= 0) return 'Ingrese el número de beneficiarios virtuales por grupo.'
  return null
}

// ── Form State ────────────────────────────────────────────────────────────────

interface FormState {
  // AF campos
  necesidadFormacionId: string
  nombre: string
  justnec: string
  causa: string
  efectos: string
  objetivo: string
  tipoEventoId: string
  modalidadFormacionId: string
  metodologiaAprendizajeId: string
  numHorasGrupo: string
  numGrupos: string
  benefGrupo: string
  benefViGrupo: string
  // Sectores y sub-sectores
  justSecSub: string
  // Perfil beneficiarios
  afEnfoqueId: string
  justAreas: string
  justNivelesOcu: string
  trabDiscapac: string
  mujer: string
  trabajadorBic: string
  mipymes: string
  trabMipymes: string
  mipymesD: string
  cadenaProd: string
  trabCadProd: string
  cadenaProdD: string
  numCampesino: string
  justCampesino: string
  numPopular: string
  justPopular: string
}

function buildForm(af: AFDetalle, perfil: Perfil, justSec?: string | null): FormState {
  return {
    necesidadFormacionId: af.necesidadFormacionId ? String(af.necesidadFormacionId) : '',
    nombre: af.nombre ?? '',
    justnec: af.justnec ?? '',
    causa: af.causa ?? '',
    efectos: af.efectos ?? '',
    objetivo: af.objetivo ?? '',
    tipoEventoId: af.tipoEventoId ? String(af.tipoEventoId) : '',
    modalidadFormacionId: af.modalidadFormacionId ? String(af.modalidadFormacionId) : '',
    metodologiaAprendizajeId: af.metodologiaAprendizajeId ? String(af.metodologiaAprendizajeId) : '',
    numHorasGrupo: af.numHorasGrupo != null ? String(af.numHorasGrupo) : '',
    numGrupos: af.numGrupos != null ? String(af.numGrupos) : '',
    benefGrupo: af.benefGrupo != null ? String(af.benefGrupo) : '',
    benefViGrupo: af.benefViGrupo != null ? String(af.benefViGrupo) : '',
    justSecSub: justSec ?? '',
    afEnfoqueId: perfil.afEnfoqueId != null ? String(perfil.afEnfoqueId) : '',
    justAreas: perfil.justAreas ?? '',
    justNivelesOcu: perfil.justNivelesOcu ?? '',
    trabDiscapac: perfil.trabDiscapac != null ? String(perfil.trabDiscapac) : '',
    mujer: perfil.mujer != null ? String(perfil.mujer) : '',
    trabajadorBic: perfil.trabajadorBic != null ? String(perfil.trabajadorBic) : '',
    mipymes: perfil.mipymes != null ? String(perfil.mipymes) : '',
    trabMipymes: perfil.trabMipymes != null ? String(perfil.trabMipymes) : '',
    mipymesD: perfil.mipymesD ?? '',
    cadenaProd: perfil.cadenaProd != null ? String(perfil.cadenaProd) : '',
    trabCadProd: perfil.trabCadProd != null ? String(perfil.trabCadProd) : '',
    cadenaProdD: perfil.cadenaProdD ?? '',
    numCampesino: perfil.numCampesino != null ? String(perfil.numCampesino) : '',
    justCampesino: perfil.justCampesino ?? '',
    numPopular: perfil.numPopular != null ? String(perfil.numPopular) : '',
    justPopular: perfil.justPopular ?? '',
  }
}

function puedeEditar(p: Proyecto | null) {
  if (!p) return false
  const e = Number(p.estado)
  return e !== 1 && e !== 3 && e !== 4 && p.convocatoriaEstado !== 0
}
function mensajeNoEditable(p: Proyecto | null): string {
  if (!p) return ''
  if (p.convocatoriaEstado === 0) return 'La convocatoria está cerrada. No se puede editar.'
  if (Number(p.estado) === 3) return 'El proyecto está aprobado. No se puede editar.'
  if (Number(p.estado) === 4) return 'El proyecto está rechazado. No se puede editar.'
  if (Number(p.estado) === 1) return 'El proyecto está confirmado. No se puede editar.'
  return ''
}

function getFieldErrors(form: FormState, proyectoModalidadId: number | null) {
  const e = Number(form.tipoEventoId) || 0
  const m = Number(form.modalidadFormacionId) || 0
  if (!e || !m) return {} as Record<string, string>

  const horas    = Number(form.numHorasGrupo)
  const grupos   = Number(form.numGrupos)
  const benef    = Number(form.benefGrupo)
  const benefVi  = Number(form.benefViGrupo)
  const esIndGremio   = proyectoModalidadId === 1 || proyectoModalidadId === 3
  const esSoloVirtual = MOD_SOLO_VIRTUAL.has(m)
  const esHibrida     = m === 3 || m === 5 || m === 6

  const err: Record<string, string> = {}

  // ── Horas ─────────────────────────────────────────────────────────────────
  if (form.numHorasGrupo !== '') {
    if (horas <= 0) {
      err.horas = 'Ingrese un número de horas válido (mayor que 0)'
    } else if (e === 1 || e === 2) {
      if (horas < 1 || horas > 4) err.horas = `${e === 1 ? 'CONFERENCIA' : 'FORO'}: debe ser entre 1 y 4 horas`
    } else if (esIndGremio) {
      if (e === 3 && (horas < 8 || horas > 16))       err.horas = 'SEMINARIO: debe ser entre 8 y 16 horas'
      if (e === 4 && (horas < 4 || horas > 24))       err.horas = 'TALLER: debe ser entre 4 y 24 horas'
      if (e === 8 && horas !== 28)                    err.horas = 'TALLER-PUESTO: debe ser exactamente 28 horas'
      if (e === 9 && horas !== 16 && horas !== 24)    err.horas = 'TALLER-BOOTCAMP: debe ser 16 o 24 horas'
      if (e === 5) {
        if (esSoloVirtual && horas !== 20 && horas !== 40)  err.horas = 'CURSO Virtual: debe ser 20 o 40 horas'
        if (!esSoloVirtual && (horas < 20 || horas > 80))  err.horas = 'CURSO: debe ser entre 20 y 80 horas'
      }
      if (e === 6) {
        if (esSoloVirtual && horas !== 80 && horas !== 120)  err.horas = 'DIPLOMADO Virtual: debe ser 80 o 120 horas'
        if (!esSoloVirtual && (horas < 80 || horas > 120))  err.horas = 'DIPLOMADO: debe ser entre 80 y 120 horas'
      }
    }
  }

  // ── Grupos ────────────────────────────────────────────────────────────────
  if (form.numGrupos !== '') {
    if (grupos <= 0) {
      err.grupos = 'Ingrese un número de grupos válido (mayor que 0)'
    } else {
      if ((e === 1 || e === 2) && grupos > 2)  err.grupos = 'Máximo 2 grupos para este evento'
      if ((e === 8 || e === 9) && grupos > 2)  err.grupos = 'Máximo 2 grupos para este evento'
      if ((e === 5 || e === 6) && grupos > 20) err.grupos = 'Máximo 20 grupos'
    }
  }

  // ── Beneficiarios presenciales ────────────────────────────────────────────
  if (form.benefGrupo !== '' && !esSoloVirtual) {
    if (benef <= 0) {
      err.benef = 'Ingrese un número de beneficiarios válido (mayor que 0)'
    } else if (!esHibrida) {
      if ((e === 1 || e === 2) && (benef < 60 || benef > 250))  err.benef = 'Entre 60 y 250 beneficiarios presenciales por grupo'
      if (esIndGremio) {
        if (e === 3 && (benef < 20 || benef > 50))  err.benef = 'SEMINARIO: entre 20 y 50 beneficiarios'
        if (e === 4 && (benef < 20 || benef > 30))  err.benef = 'TALLER: entre 20 y 30 beneficiarios'
        if (e === 8 && benef !== 5)                  err.benef = 'TALLER-PUESTO: exactamente 5 beneficiarios'
        if (e === 9 && (benef < 10 || benef > 30))  err.benef = 'TALLER-BOOTCAMP: entre 10 y 30 beneficiarios'
        if ((e === 5 || e === 6) && (benef < 20 || benef > 30)) err.benef = 'Entre 20 y 30 beneficiarios'
      }
    } else {
      // Modalidad híbrida: validar total presencial + sincrónico
      const total = benef + benefVi
      if ((e === 1 || e === 2)) {
        if (total > 250)              err.benef = 'Total presencial + sincrónico no puede superar 250'
        else if (total <= 60 && benef < 50) err.benef = 'Con total ≤60: mínimo 50 beneficiarios presenciales'
        else if (total > 60 && benef < 60)  err.benef = 'Con total >60: mínimo 60 beneficiarios presenciales'
      }
    }
  }

  // ── Beneficiarios virtuales / sincrónicos ─────────────────────────────────
  if (form.benefViGrupo !== '' && MOD_CON_VIRTUAL.has(m)) {
    if (benefVi <= 0) {
      err.benefVi = 'Ingrese un número de beneficiarios válido (mayor que 0)'
    } else if (esSoloVirtual && esIndGremio && (e === 5 || e === 6)) {
      if (benefVi < 20 || benefVi > 50) err.benefVi = 'Entre 20 y 50 beneficiarios virtuales'
    } else if (esHibrida && (e === 1 || e === 2)) {
      const total = benef + benefVi
      if (total > 250) err.benefVi = 'Total presencial + sincrónico no puede superar 250'
    }
  }

  return err
}

// ── Component ─────────────────────────────────────────────────────────────────

// ── Helper component: dropdown buscable para selects largos ────────────────
function SearchableSelect({
  value, onChange, options, placeholder = '— Seleccione —',
  searchPlaceholder = 'Buscar…', disabled = false,
}: {
  value: number | null
  onChange: (id: number | null) => void
  options: Opcion[]
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busq, setBusq] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selectedName = value != null ? options.find(o => o.id === value)?.nombre ?? '' : ''
  const filtered = !busq.trim()
    ? options
    : options.filter(o => o.nombre.toLowerCase().includes(busq.toLowerCase()))

  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled}
        onClick={() => { setOpen(o => !o); setBusq('') }}
        className={`w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm flex items-center justify-between gap-2 bg-white text-left disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#00304D]`}>
        <span className={`${selectedName ? 'text-neutral-800' : 'text-neutral-400'} truncate`}>
          {selectedName || placeholder}
        </span>
        <ChevronDown size={14} className="text-neutral-400 flex-shrink-0" />
      </button>
      {open && !disabled && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg flex flex-col max-h-64 overflow-hidden">
          <div className="p-2 border-b border-neutral-100 sticky top-0 bg-white">
            <input autoFocus value={busq} onChange={e => setBusq(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full text-xs px-3 py-1.5 border border-neutral-200 rounded-lg outline-none focus:border-[#00304D]" />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0
              ? <p className="text-xs text-neutral-400 text-center py-4">Sin resultados</p>
              : filtered.map(o => (
                <button key={o.id} type="button"
                  onClick={() => { onChange(o.id); setOpen(false); setBusq('') }}
                  className={`w-full text-left text-xs px-4 py-2 hover:bg-[#00304D]/5 transition leading-relaxed whitespace-normal break-words ${value === o.id ? 'bg-[#00304D]/10 font-semibold text-[#00304D]' : 'text-neutral-700'}`}>
                  {o.nombre}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AFDetallePage() {
  const { id, afId } = useParams<{ id: string; afId: string }>()
  const proyectoId = Number(id)
  const afIdNum    = Number(afId)

  const [proyecto,  setProyecto]  = useState<Proyecto | null>(null)
  const [af,        setAf]        = useState<AFDetalle | null>(null)
  const [perfil,    setPerfil]    = useState<Perfil | null>(null)
  const [loading,   setLoading]   = useState(true)

  // Catálogos
  const [tiposEvento,  setTiposEvento]  = useState<Opcion[]>([])
  const [modalidades,  setModalidades]  = useState<Opcion[]>([])
  const [metodologias, setMetodologias] = useState<Opcion[]>([])
  const [necesidades,  setNecesidades]  = useState<Necesidad[]>([])
  const [enfoques,      setEnfoques]     = useState<Opcion[]>([])
  const [areasCat,      setAreasCat]     = useState<Opcion[]>([])
  const [nivelesCat,    setNivelesCat]   = useState<Opcion[]>([])
  const [cuocCat,       setCuocCat]      = useState<Opcion[]>([])
  const [sectoresCat,   setSectoresCat]  = useState<Opcion[]>([])
  const [subsectoresCat,setSubsectoresCat] = useState<Opcion[]>([])
  const [sectoresData,  setSectoresData] = useState<SectoresData | null>(null)

  const [form,      setForm]      = useState<FormState | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Necesidad dropdown
  const [necQuery, setNecQuery] = useState('')
  const [necOpen,  setNecOpen]  = useState(false)
  const necRef = useRef<HTMLDivElement>(null)

  // CUOC dropdown
  const [cuocQuery, setCuocQuery] = useState('')
  const [cuocOpen,  setCuocOpen]  = useState(false)
  const cuocRef = useRef<HTMLDivElement>(null)

  // Área selects
  const [areaSelId,        setAreaSelId]        = useState('')
  const [areaOtroText,     setAreaOtroText]      = useState('')
  const [nivelSelId,       setNivelSelId]        = useState('')
  // Sector selects
  const [sectorBenefSelId,    setSectorBenefSelId]    = useState('')
  const [subsectorBenefSelId, setSubsectorBenefSelId] = useState('')
  const [sectorAfSelId,       setSectorAfSelId]       = useState('')
  const [subsectorAfSelId,    setSubsectorAfSelId]    = useState('')

  // ── Unidades Temáticas state ──────────────────────────────────────────────
  const [actividadesCat,    setActividadesCat]    = useState<Opcion[]>([])
  const [rubrosCat,         setRubrosCat]         = useState<Opcion[]>([])
  const [articulacionesCat, setArticulacionesCat] = useState<Opcion[]>([])
  const [uts,               setUts]               = useState<UTResumen[]>([])
  const [detalleUT,         setDetalleUT]         = useState<UTDetalle | null>(null)
  const [expandedUtId,      setExpandedUtId]      = useState<number | null>(null)
  // Creación: paso 1 = tipo, paso 2 = nombre/articulación
  const [creandoUT,         setCreandoUT]         = useState(false)
  const [nuevoUtEsArt,      setNuevoUtEsArt]      = useState<boolean | null>(null) // null=no elegido
  const [nuevoUtNombre,     setNuevoUtNombre]     = useState('')
  const [nuevoUtArtId,      setNuevoUtArtId]      = useState('')
  const [savingNuevoUT,     setSavingNuevoUT]     = useState(false)
  // Edición detalle
  const [utDetForm,         setUtDetForm]         = useState<UTDetFormState | null>(null)
  const [savingUTDet,       setSavingUTDet]       = useState(false)
  // Actividades
  const [actSelUT,          setActSelUT]          = useState('')
  const [actOtroUT,         setActOtroUT]         = useState('')
  const [actAddingUT,       setActAddingUT]       = useState(false)
  const [actBusqueda,       setActBusqueda]       = useState('')
  const [actDropdownOpen,   setActDropdownOpen]   = useState(false)
  const actDropRef = useRef<HTMLDivElement>(null)
  // Perfil capacitador
  const [perfilAddUT,       setPerfilAddUT]       = useState({ rubroId: '', horasCap: '' })
  const [perfilAddingUT,    setPerfilAddingUT]    = useState(false)
  // Confirmación inline de eliminación
  const [deletingUtId,      setDeletingUtId]      = useState<number | null>(null)

  // ── Alineación state ─────────────────────────────────────────────────────
  interface AlineacionData { compod: string | null; justificacion: string | null; resDesem: string | null; resForm: string | null; componenteId: number | null; componenteNombre: string | null; retoNacionalId: number | null }
  const [retosCat,         setRetosCat]         = useState<Opcion[]>([])
  const [afComponentesCat, setAfComponentesCat] = useState<Opcion[]>([])
  const [alineacion,       setAlineacion]       = useState<AlineacionData | null>(null)
  const [alinRetoSel,      setAlinRetoSel]      = useState('')
  const [alinRetoBusq,       setAlinRetoBusq]       = useState('')
  const [alinRetoOpen,       setAlinRetoOpen]       = useState(false)
  const alinRetoRef = useRef<HTMLDivElement>(null)
  const [alinCompBusq,       setAlinCompBusq]       = useState('')
  const [alinCompSel,        setAlinCompSel]        = useState<number | null>(null)
  const [alinCompOpen,       setAlinCompOpen]       = useState(false)
  const alinCompRef = useRef<HTMLDivElement>(null)
  const [alinForm, setAlinForm] = useState({ compod: '', justificacion: '', resDesem: '', resForm: '' })
  const [savingAlin, setSavingAlin] = useState(false)

  // ── Cobertura state ───────────────────────────────────────────────────────
  interface GrupoCobertura {
    grupoId: number; grupoNumero: number; justificacion: string | null
    totalBenef: number; numCoberturas: number
  }
  interface CobEntry {
    cobId: number; deptoId: number; deptoNombre: string
    ciudadId: number | null; ciudadNombre: string | null
    benef: number; modal: string; rural: number
  }
  interface DeptoOpc  { id: number; nombre: string }
  interface CiudadOpc { id: number; nombre: string }
  interface CobRow    { deptoId: number | null; ciudadId: number | null; benef: string; rural: number }

  const [deptosCat,      setDeptosCat]      = useState<DeptoOpc[]>([])
  const [ciudadesCat,    setCiudadesCat]    = useState<Record<number, CiudadOpc[]>>({})
  const [grupos,         setGrupos]         = useState<GrupoCobertura[]>([])
  const [expandedGrupo,  setExpandedGrupo]  = useState<number | null>(null)
  const [grupoJust,      setGrupoJust]      = useState<Record<number, string>>({})
  const [savingJust,     setSavingJust]     = useState<number | null>(null)
  const [coberturas,     setCoberturas]     = useState<Record<number, CobEntry[]>>({})
  // form per grupo: presencial row + virtual rows
  const [cobPres,        setCobPres]        = useState<Record<number, CobRow>>({})
  const [cobVirt,        setCobVirt]        = useState<Record<number, CobRow[]>>({})
  const [savingCob,      setSavingCob]      = useState<number | null>(null)
  const [creatingGrupo,  setCreatingGrupo]  = useState(false)
  const [deletingGrupo,  setDeletingGrupo]  = useState<number | null>(null)

  // ── Material de Formación state ───────────────────────────────────────────
  interface RecursoEntry { rdafId: number; recursoId: number; nombre: string }
  interface MaterialData {
    tipoAmbienteId: number | null; gestionConocimientoId: number | null
    materialFormacionId: number | null; justMat: string | null
    insumo: string | null; justInsumo: string | null
    recursos: RecursoEntry[]
  }
  const [tiposAmbienteCat,    setTiposAmbienteCat]    = useState<Opcion[]>([])
  const [gestionCat,          setGestionCat]          = useState<Opcion[]>([])
  const [materialCat,         setMaterialCat]         = useState<Opcion[]>([])
  const [recursosCat,         setRecursosCat]         = useState<Opcion[]>([])
  const [materialData,        setMaterialData]        = useState<MaterialData | null>(null)
  const [matForm,             setMatForm]             = useState({
    tipoAmbienteId: '', gestionConocimientoId: '', materialFormacionId: '',
    justMat: '', insumo: '', justInsumo: '',
  })
  const [recursoSelId,        setRecursoSelId]        = useState('')
  const [addingRecurso,       setAddingRecurso]       = useState(false)
  const [savingMat,           setSavingMat]           = useState(false)

  // Toast
  const toastKey = useRef(0)
  const [toastK2, setToastK2] = useState(0)
  const [toast,   setToast]   = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  function showToast(tipo: 'success' | 'error', msg: string) {
    toastKey.current++
    setToast({ tipo, msg })
    setToastK2(toastKey.current)
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    try {
      const [rP, rAF, rPerfil, rSec, rT, rM, rMet, rNec, rEnf, rAr, rNiv, rCuoc, rSecCat, rSsubCat, rUts, rActs, rRubs, rArts, rRetos, rAlin, rDeptos, rAmb, rGest, rMatCat, rRecCat, rMat] = await Promise.all([
        api.get<Proyecto>(`/proyectos/${proyectoId}`),
        api.get<AFDetalle>(`/proyectos/${proyectoId}/acciones/${afIdNum}`),
        api.get<Perfil>(`/proyectos/${proyectoId}/acciones/${afIdNum}/beneficiarios`),
        api.get<SectoresData>(`/proyectos/${proyectoId}/acciones/${afIdNum}/sectores`),
        api.get<Opcion[]>('/proyectos/tiposevento'),
        api.get<Opcion[]>('/proyectos/modalidadesformacion'),
        api.get<Opcion[]>('/proyectos/metodologias'),
        api.get<Necesidad[]>('/proyectos/necesidadesformacion'),
        api.get<Opcion[]>('/proyectos/enfoques'),
        api.get<Opcion[]>('/proyectos/areasfuncionales'),
        api.get<Opcion[]>('/proyectos/nivelesocu'),
        api.get<Opcion[]>('/proyectos/cuoc'),
        api.get<Opcion[]>('/proyectos/sectoresaf'),
        api.get<Opcion[]>('/proyectos/subsectoresaf'),
        api.get<UTResumen[]>(`/proyectos/${proyectoId}/acciones/${afIdNum}/unidades`),
        api.get<Opcion[]>('/proyectos/actividadesut'),
        api.get<Opcion[]>(`/proyectos/${proyectoId}/rubrosperfilut`),
        api.get<Opcion[]>('/proyectos/articulacionesterr'),
        api.get<Opcion[]>('/proyectos/retonacionales'),
        api.get<AlineacionData>(`/proyectos/${proyectoId}/acciones/${afIdNum}/alineacion`),
        api.get<DeptoOpc[]>('/proyectos/departamentos'),
        api.get<Opcion[]>('/proyectos/tiposambiente'),
        api.get<Opcion[]>('/proyectos/gestionconocimientos'),
        api.get<Opcion[]>('/proyectos/materialformacion'),
        api.get<Opcion[]>('/proyectos/recursosdicacticos'),
        api.get<MaterialData>(`/proyectos/${proyectoId}/acciones/${afIdNum}/material`),
      ])
      setProyecto(rP.data)
      setAf(rAF.data)
      setPerfil(rPerfil.data)
      setSectoresData(rSec.data)
      setTiposEvento(rT.data)
      setModalidades(rM.data)
      setMetodologias(rMet.data)
      setNecesidades(rNec.data)
      setEnfoques(rEnf.data)
      setAreasCat(rAr.data)
      setNivelesCat(rNiv.data)
      setCuocCat(rCuoc.data)
      setSectoresCat(rSecCat.data)
      setSubsectoresCat(rSsubCat.data)
      setUts(rUts.data)
      setActividadesCat(rActs.data)
      setRubrosCat(rRubs.data)
      setArticulacionesCat(rArts.data)
      setRetosCat(rRetos.data)
      setAlineacion(rAlin.data)
      setAlinForm({
        compod: rAlin.data.compod ?? '',
        justificacion: rAlin.data.justificacion ?? '',
        resDesem: rAlin.data.resDesem ?? '',
        resForm: rAlin.data.resForm ?? '',
      })
      if (rAlin.data.retoNacionalId) {
        setAlinRetoSel(String(rAlin.data.retoNacionalId))
        setAlinCompSel(rAlin.data.componenteId)
        const rComps = await api.get<Opcion[]>(`/proyectos/componentesreto/${rAlin.data.retoNacionalId}`)
        setAfComponentesCat(rComps.data)
      }
      setDeptosCat(rDeptos.data)
      setTiposAmbienteCat(rAmb.data)
      setGestionCat(rGest.data)
      setMaterialCat(rMatCat.data)
      setRecursosCat(rRecCat.data)
      setMaterialData(rMat.data)
      setMatForm({
        tipoAmbienteId: rMat.data.tipoAmbienteId ? String(rMat.data.tipoAmbienteId) : '',
        gestionConocimientoId: rMat.data.gestionConocimientoId ? String(rMat.data.gestionConocimientoId) : '',
        materialFormacionId: rMat.data.materialFormacionId ? String(rMat.data.materialFormacionId) : '',
        justMat: rMat.data.justMat ?? '',
        insumo: rMat.data.insumo ?? '',
        justInsumo: rMat.data.justInsumo ?? '',
      })
      const rGrupos = await api.get<GrupoCobertura[]>(`/proyectos/${proyectoId}/acciones/${afIdNum}/grupos`)
      setGrupos(rGrupos.data)
      setGrupoJust(Object.fromEntries(rGrupos.data.map(g => [g.grupoId, g.justificacion ?? ''])))
      setForm(buildForm(rAF.data, rPerfil.data, rSec.data.justificacion))
    } catch {
      showToast('error', 'Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [proyectoId, afIdNum])

  // Recarga parcial — no toca el form ni el resto del estado
  async function recargarPerfil() {
    try {
      const r = await api.get<Perfil>(`/proyectos/${proyectoId}/acciones/${afIdNum}/beneficiarios`)
      setPerfil(r.data)
    } catch { /* silencioso */ }
  }

  async function recargarSectores() {
    try {
      const r = await api.get<SectoresData>(`/proyectos/${proyectoId}/acciones/${afIdNum}/sectores`)
      setSectoresData(r.data)
    } catch { /* silencioso */ }
  }

  useEffect(() => {
    document.title = 'Detalle AF | SEP'
    cargar()
  }, [cargar])

  useEffect(() => {
    function h(e: MouseEvent) {
      if (necRef.current     && !necRef.current.contains(e.target     as Node)) setNecOpen(false)
      if (cuocRef.current    && !cuocRef.current.contains(e.target    as Node)) setCuocOpen(false)
      if (alinCompRef.current && !alinCompRef.current.contains(e.target as Node)) setAlinCompOpen(false)
      if (alinRetoRef.current && !alinRetoRef.current.contains(e.target as Node)) setAlinRetoOpen(false)
      if (actDropRef.current && !actDropRef.current.contains(e.target as Node)) setActDropdownOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────

  const editable    = puedeEditar(proyecto)
  const eventoId    = form ? Number(form.tipoEventoId) || null : null
  const modalidadId = form ? Number(form.modalidadFormacionId) || null : null

  const modalidadesFiltradas = useMemo(() => {
    if (!eventoId) return modalidades
    const allowed = EVENTO_MODALIDADES[eventoId]
    return allowed ? modalidades.filter(m => allowed.includes(m.id)) : modalidades
  }, [modalidades, eventoId])

  const metodologiasFiltradas = useMemo(() => {
    if (!eventoId) return metodologias
    const allowed = EVENTO_METODOLOGIAS[eventoId]
    return allowed ? metodologias.filter(m => allowed.includes(m.id)) : metodologias
  }, [metodologias, eventoId])

  const showPresencial = modalidadId !== null && !MOD_SOLO_VIRTUAL.has(modalidadId)
  const showVirtual    = modalidadId !== null && MOD_CON_VIRTUAL.has(modalidadId)
  const mensajeAlerta  = getMensajeAlerta(eventoId, modalidadId)
  const fieldErrors    = form ? getFieldErrors(form, proyecto?.modalidadId ?? null) : {}

  const totalHoras = useMemo(() => {
    if (!form) return null
    const h = Number(form.numHorasGrupo), g = Number(form.numGrupos)
    return h > 0 && g > 0 ? h * g : null
  }, [form])

  const totalBenef = useMemo(() => {
    if (!form) return null
    const b = Number(form.benefGrupo) || 0, bv = Number(form.benefViGrupo) || 0, g = Number(form.numGrupos) || 0
    const t = (b + bv) * g
    return g > 0 && t > 0 ? t : null
  }, [form])

  const necFiltradas = useMemo(() => {
    if (!necQuery.trim()) return necesidades
    const q = necQuery.toLowerCase()
    return necesidades.filter(n => n.nombre.toLowerCase().includes(q) || String(n.numero ?? '').includes(q))
  }, [necesidades, necQuery])

  const necSeleccionada = useMemo(
    () => necesidades.find(n => String(n.id) === form?.necesidadFormacionId),
    [necesidades, form?.necesidadFormacionId],
  )

  const cuocFiltrados = useMemo(() => {
    const base = cuocQuery.trim() ? cuocCat.filter(c => c.nombre.toLowerCase().includes(cuocQuery.toLowerCase())) : cuocCat
    return base.slice(0, 50)
  }, [cuocCat, cuocQuery])

  const AREA_OTRA_ID = useMemo(() => areasCat.find(a => a.nombre.toLowerCase().includes('otr'))?.id ?? 11, [areasCat])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function set(field: keyof FormState, value: string) {
    setForm(prev => prev ? { ...prev, [field]: value } : prev)
  }

  function numOnly(v: string) { return v.replace(/\D/g, '').slice(0, 4) }

  function handleEventoChange(val: string) {
    const id = Number(val) || 0
    const mods = EVENTO_MODALIDADES[id] ?? []
    const mets = EVENTO_METODOLOGIAS[id] ?? []
    setForm(prev => prev ? {
      ...prev,
      tipoEventoId: val,
      modalidadFormacionId: mods.length === 1 ? String(mods[0]) : '',
      metodologiaAprendizajeId: mets.length === 1 ? String(mets[0]) : '',
      numHorasGrupo: '', numGrupos: '', benefGrupo: '', benefViGrupo: '',
    } : prev)
  }

  function handleModalidadChange(val: string) {
    setForm(prev => prev ? {
      ...prev, modalidadFormacionId: val,
      numHorasGrupo: '', numGrupos: '', benefGrupo: '', benefViGrupo: '',
    } : prev)
  }

  // ── Áreas / Niveles / CUOC ────────────────────────────────────────────────

  async function handleAgregarArea() {
    if (!areaSelId) { showToast('error', 'Seleccione un área funcional'); return }
    if ((perfil?.areas.length ?? 0) >= 5) { showToast('error', 'Máximo 5 áreas funcionales por acción de formación'); return }
    const areaId = Number(areaSelId)
    const otro = areaId === AREA_OTRA_ID ? (areaOtroText.trim() || null) : null
    if (areaId === AREA_OTRA_ID && !otro) { showToast('error', 'Especifique el área en el campo "Otra"'); return }
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/areas`, { areaId, otro })
      setAreaSelId(''); setAreaOtroText('')
      await recargarPerfil()
    } catch (e: unknown) {
      showToast('error', (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error')
    }
  }

  async function handleEliminarArea(aafId: number) {
    try { await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/areas/${aafId}`); await recargarPerfil() }
    catch { showToast('error', 'Error al eliminar área') }
  }

  async function handleAgregarNivel() {
    if (!nivelSelId) { showToast('error', 'Seleccione un nivel ocupacional'); return }
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/niveles`, { nivelId: Number(nivelSelId) })
      setNivelSelId(''); await recargarPerfil()
    } catch (e: unknown) {
      showToast('error', (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error')
    }
  }

  async function handleEliminarNivel(anId: number) {
    try { await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/niveles/${anId}`); await recargarPerfil() }
    catch { showToast('error', 'Error al eliminar nivel') }
  }

  async function handleAgregarCuoc(cuocId: number) {
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/cuoc`, { cuocId })
      setCuocQuery(''); setCuocOpen(false); await recargarPerfil()
    } catch (e: unknown) {
      showToast('error', (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error')
    }
  }

  async function handleEliminarCuoc(ocAfId: number) {
    try { await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/cuoc/${ocAfId}`); await recargarPerfil() }
    catch { showToast('error', 'Error al eliminar CUOC') }
  }

  // ── Sectores / Sub-sectores ───────────────────────────────────────────────

  async function handleAgregarSectorBenef() {
    if (!sectorBenefSelId) { showToast('error', 'Seleccione un sector'); return }
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/sectores-benef`, { sectorId: Number(sectorBenefSelId) })
      setSectorBenefSelId(''); await recargarSectores()
    } catch (e: unknown) {
      showToast('error', (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error')
    }
  }

  async function handleEliminarSectorBenef(psId: number) {
    try { await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/sectores-benef/${psId}`); await recargarSectores() }
    catch { showToast('error', 'Error al eliminar sector') }
  }

  async function handleAgregarSubSectorBenef() {
    if (!subsectorBenefSelId) { showToast('error', 'Seleccione un sub-sector'); return }
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/subsectores-benef`, { subsectorId: Number(subsectorBenefSelId) })
      setSubsectorBenefSelId(''); await recargarSectores()
    } catch (e: unknown) {
      showToast('error', (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error')
    }
  }

  async function handleEliminarSubSectorBenef(pssId: number) {
    try { await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/subsectores-benef/${pssId}`); await recargarSectores() }
    catch { showToast('error', 'Error al eliminar sub-sector') }
  }

  async function handleAgregarSectorAf() {
    if (!sectorAfSelId) { showToast('error', 'Seleccione un sector AF'); return }
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/sectores-af`, { sectorId: Number(sectorAfSelId) })
      setSectorAfSelId(''); await recargarSectores()
    } catch (e: unknown) {
      showToast('error', (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error')
    }
  }

  async function handleEliminarSectorAf(saId: number) {
    try { await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/sectores-af/${saId}`); await recargarSectores() }
    catch { showToast('error', 'Error al eliminar sector AF') }
  }

  async function handleAgregarSubSectorAf() {
    if (!subsectorAfSelId) { showToast('error', 'Seleccione un sub-sector AF'); return }
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/subsectores-af`, { subsectorId: Number(subsectorAfSelId) })
      setSubsectorAfSelId(''); await recargarSectores()
    } catch (e: unknown) {
      showToast('error', (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error')
    }
  }

  async function handleEliminarSubSectorAf(ssaId: number) {
    try { await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/subsectores-af/${ssaId}`); await recargarSectores() }
    catch { showToast('error', 'Error al eliminar sub-sector AF') }
  }

  // ── Unidades Temáticas handlers ───────────────────────────────────────────

  async function cargarUTs() {
    try {
      const r = await api.get<UTResumen[]>(`/proyectos/${proyectoId}/acciones/${afIdNum}/unidades`)
      setUts(r.data)
    } catch { /* silencioso */ }
  }

  async function cargarDetalleUT(utId: number) {
    try {
      const r = await api.get<UTDetalle>(`/proyectos/${proyectoId}/acciones/${afIdNum}/unidades/${utId}`)
      setDetalleUT(r.data)
    } catch { showToast('error', 'Error al cargar la unidad temática') }
  }

  function abrirFormUT(det: UTDetalle) {
    setUtDetForm({
      contenido: det.contenido ?? '',
      competencias: det.competencias ?? '',
      justActividad: det.justActividad ?? '',
      horasPrac: getHorasPrac(det) > 0 ? String(getHorasPrac(det)) : '',
      horasTeor: getHorasTeor(det) > 0 ? String(getHorasTeor(det)) : '',
    })
    setActSelUT('')
    setActOtroUT('')
    setPerfilAddUT({ rubroId: '', horasCap: '' })
  }

  async function handleCrearUT() {
    const esArt = nuevoUtEsArt === true
    const nombre = esArt
      ? articulacionesCat.find(a => a.id === Number(nuevoUtArtId))?.nombre ?? ''
      : nuevoUtNombre.trim()
    if (!nombre) { showToast('error', esArt ? 'Seleccione una articulación' : 'Ingrese el nombre'); return }
    setSavingNuevoUT(true)
    try {
      const r = await api.post<{ utId: number }>(`/proyectos/${proyectoId}/acciones/${afIdNum}/unidades`, {
        nombre,
        articulacionTerritorialId: esArt ? Number(nuevoUtArtId) : null,
      })
      const utId = r.data.utId
      setNuevoUtNombre(''); setNuevoUtArtId(''); setNuevoUtEsArt(null); setCreandoUT(false)
      await cargarUTs()
      const rd = await api.get<UTDetalle>(`/proyectos/${proyectoId}/acciones/${afIdNum}/unidades/${utId}`)
      setDetalleUT(rd.data)
      setExpandedUtId(utId)
      abrirFormUT(rd.data)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al crear'
      showToast('error', msg)
    } finally {
      setSavingNuevoUT(false)
    }
  }

  async function handleGuardarUTDet() {
    if (!expandedUtId || !utDetForm || !detalleUT) return

    // ── Validaciones ─────────────────────────────────────────────────────────
    const horasPracNum = utDetForm.horasPrac ? Number(utDetForm.horasPrac) : 0
    const horasTeorNum = utDetForm.horasTeor ? Number(utDetForm.horasTeor) : 0

    if (utDetForm.horasPrac && !Number.isInteger(horasPracNum))
      return showToast('error', 'Las horas prácticas deben ser un número entero.')
    if (utDetForm.horasTeor && !Number.isInteger(horasTeorNum))
      return showToast('error', 'Las horas teóricas deben ser un número entero.')

    const totalUtHoras = horasPracNum + horasTeorNum
    if (totalUtHoras <= 0) return showToast('error', 'Debe ingresar las horas de la unidad temática.')

    // Verificar que horas UT no superen las horas por grupo de la AF
    // (las UTs se formulan por grupo y se replican en cada uno)
    if (af?.numHorasGrupo) {
      const horasOtrasUts = uts
        .filter(u => u.utId !== expandedUtId)
        .reduce((sum, u) => sum + (u.totalPrac ?? 0) + (u.totalTeor ?? 0), 0)
      const disponibles = af.numHorasGrupo - horasOtrasUts
      if (totalUtHoras > disponibles) {
        return showToast('error',
          `Las horas de esta UT (${totalUtHoras}h) superan las disponibles por grupo en la AF (${disponibles}h de ${af.numHorasGrupo}h por grupo).`)
      }
    }

    if (!utDetForm.contenido.trim()) return showToast('error', 'El contenido de la unidad temática es obligatorio.')
    if (!utDetForm.competencias.trim()) return showToast('error', 'La competencia por adquirir es obligatoria.')
    if (detalleUT.actividades.length === 0) return showToast('error', 'Debe agregar al menos una actividad de aprendizaje.')

    // Descripción requerida si hay actividad virtual o aumentada
    if (tieneActividadVirtualOAumentada(detalleUT.actividades) && !utDetForm.justActividad.trim())
      return showToast('error', 'La descripción de actividades de aprendizaje es obligatoria cuando hay actividades virtuales o aumentadas.')

    // Validar perfil de capacitador vs horas UT
    const tipoEventoId = af?.tipoEventoId ?? null
    const totalPerfilHoras = detalleUT.perfiles.reduce((s, p) => s + (p.horasCap ?? 0), 0)
    if (tipoEventoId === 9) {
      // TALLER-BOOTCAMP: perfil ≤ ut×2 (puede no llenar el total)
      if (totalPerfilHoras > totalUtHoras * 2)
        return showToast('error', `Las horas del perfil (${totalPerfilHoras}h) no pueden superar el doble de las horas de la UT (${totalUtHoras * 2}h) para TALLER-BOOTCAMP.`)
    } else if (tipoEventoId === 2) {
      // FORO: perfil ≤ ut×4
      if (totalPerfilHoras > totalUtHoras * 4)
        return showToast('error', `Las horas del perfil (${totalPerfilHoras}h) no pueden superar cuatro veces las horas de la UT (${totalUtHoras * 4}h) para FORO.`)
    } else {
      // Demás eventos: perfil debe igualar exactamente las horas de la UT
      if (totalPerfilHoras === 0)
        return showToast('error', `Debe agregar el perfil de capacitador con ${totalUtHoras}h en total (igual a las horas de la UT).`)
      if (totalPerfilHoras < totalUtHoras)
        return showToast('error', `Faltan ${totalUtHoras - totalPerfilHoras}h por asignar en el perfil de capacitador. Las horas del perfil (${totalPerfilHoras}h) deben igualar las horas de la UT (${totalUtHoras}h).`)
      if (totalPerfilHoras > totalUtHoras)
        return showToast('error', `Las horas del perfil de capacitador (${totalPerfilHoras}h) no pueden superar las horas de la UT (${totalUtHoras}h).`)
    }

    setSavingUTDet(true)
    try {
      await api.put(`/proyectos/${proyectoId}/acciones/${afIdNum}/unidades/${expandedUtId}`, {
        nombre: detalleUT.nombre,
        contenido: utDetForm.contenido.trim() || null,
        competencias: utDetForm.competencias.trim() || null,
        justActividad: utDetForm.justActividad.trim() || null,
        horasPrac: horasPracNum || null,
        horasTeor: horasTeorNum || null,
        articulacionTerritorialId: detalleUT.articulacionTerritorialId ?? null,
      })
      showToast('success', 'Unidad temática guardada')
      setExpandedUtId(null); setDetalleUT(null); setUtDetForm(null)
      await cargarUTs()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar'
      showToast('error', msg)
    } finally {
      setSavingUTDet(false)
    }
  }

  async function handleConfirmarEliminarUT(utId: number) {
    try {
      await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/unidades/${utId}`)
      if (expandedUtId === utId) { setExpandedUtId(null); setDetalleUT(null); setUtDetForm(null) }
      setDeletingUtId(null)
      await cargarUTs()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al eliminar'
      showToast('error', msg)
    }
  }

  async function handleAgregarActividadUT() {
    if (!expandedUtId || !actSelUT) { showToast('error', 'Seleccione una actividad'); return }
    setActAddingUT(true)
    try {
      const actNombre = actividadesCat.find(a => a.id === Number(actSelUT))?.nombre ?? ''
      const needsOtro = /otro/i.test(actNombre)
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/unidades/${expandedUtId}/actividades`, {
        actividadId: Number(actSelUT),
        otro: needsOtro ? actOtroUT.trim() || null : null,
      })
      setActSelUT('')
      setActOtroUT('')
      setActBusqueda('')
      await cargarDetalleUT(expandedUtId)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'
      showToast('error', msg)
    } finally {
      setActAddingUT(false)
    }
  }

  async function handleEliminarActividadUT(actId: number) {
    if (!expandedUtId) return
    try {
      await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/unidades/${expandedUtId}/actividades/${actId}`)
      await cargarDetalleUT(expandedUtId)
    } catch { showToast('error', 'Error al eliminar actividad') }
  }

  async function handleAgregarPerfilUT() {
    if (!expandedUtId) return
    if (!perfilAddUT.rubroId) { showToast('error', 'Seleccione un rubro'); return }
    const horasCapNum = Number(perfilAddUT.horasCap)
    if (!perfilAddUT.horasCap || horasCapNum <= 0) { showToast('error', 'Ingrese las horas'); return }
    if (!Number.isInteger(horasCapNum)) { showToast('error', 'Las horas del capacitador deben ser un número entero.'); return }
    // Validar horas capacitador ≤ horas UT actual
    if (utDetForm && detalleUT) {
      const horasUt = (utDetForm.horasPrac ? Number(utDetForm.horasPrac) : 0) + (utDetForm.horasTeor ? Number(utDetForm.horasTeor) : 0)
      const yaAsignadas = detalleUT.perfiles.reduce((s, p) => s + (p.horasCap ?? 0), 0)
      const tipoEventoId = af?.tipoEventoId ?? null
      const maxMulti = tipoEventoId === 9 ? 2 : tipoEventoId === 2 ? 4 : 1
      if (horasUt > 0 && yaAsignadas + horasCapNum > horasUt * maxMulti) {
        showToast('error', `Las horas del perfil de capacitador no pueden superar ${horasUt * maxMulti}h (horas de la UT × ${maxMulti}).`)
        return
      }
    }
    setPerfilAddingUT(true)
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/unidades/${expandedUtId}/perfiles`, {
        rubroId: Number(perfilAddUT.rubroId),
        horasCap: Number(perfilAddUT.horasCap),
      })
      setPerfilAddUT({ rubroId: '', horasCap: '' })
      await cargarDetalleUT(expandedUtId)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'
      showToast('error', msg)
    } finally {
      setPerfilAddingUT(false)
    }
  }

  async function handleEliminarPerfilUT(perfilId: number) {
    if (!expandedUtId) return
    try {
      await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/unidades/${expandedUtId}/perfiles/${perfilId}`)
      await cargarDetalleUT(expandedUtId)
    } catch { showToast('error', 'Error al eliminar perfil') }
  }

  async function handleExpandUT(utId: number) {
    if (expandedUtId === utId) {
      setExpandedUtId(null); setDetalleUT(null); setUtDetForm(null)
    } else {
      setExpandedUtId(utId); setDetalleUT(null); setUtDetForm(null)
      try {
        const r = await api.get<UTDetalle>(`/proyectos/${proyectoId}/acciones/${afIdNum}/unidades/${utId}`)
        setDetalleUT(r.data)
        abrirFormUT(r.data)
      } catch { showToast('error', 'Error al cargar la unidad') }
    }
  }

  // ── Alineación handlers ───────────────────────────────────────────────────

  async function handleCargarComponentesByReto(retoId: string) {
    setAlinRetoSel(retoId)
    setAlinCompSel(null)
    setAlinCompBusq('')
    setAfComponentesCat([])
    if (!retoId) return
    try {
      const r = await api.get<Opcion[]>(`/proyectos/componentesreto/${retoId}`)
      setAfComponentesCat(r.data)
    } catch { showToast('error', 'Error al cargar componentes') }
  }

  async function handleGuardarAlineacion() {
    if (!alinCompSel) return showToast('error', 'Debe seleccionar un componente estratégico.')
    if (!alinForm.compod.trim()) return showToast('error', 'La justificación de la alineación es obligatoria.')
    if (!alinForm.justificacion.trim()) return showToast('error', '¿Por qué la AF es especializada? es obligatorio.')
    if (!alinForm.resDesem.trim()) return showToast('error', 'Debe redactar los resultados de impacto en el desempeño del trabajador.')
    if (!alinForm.resForm.trim()) return showToast('error', 'Debe redactar los resultados de impacto en la productividad y competitividad.')
    setSavingAlin(true)
    try {
      await api.put(`/proyectos/${proyectoId}/acciones/${afIdNum}/alineacion`, {
        componenteId: alinCompSel,
        compod: alinForm.compod.trim() || null,
        justificacion: alinForm.justificacion.trim() || null,
        resDesem: alinForm.resDesem.trim() || null,
        resForm: alinForm.resForm.trim() || null,
      })
      showToast('success', 'Alineación guardada')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar'
      showToast('error', msg)
    } finally { setSavingAlin(false) }
  }

  // ── Cobertura handlers ────────────────────────────────────────────────────

  async function cargarGrupos() {
    try {
      const r = await api.get<GrupoCobertura[]>(`/proyectos/${proyectoId}/acciones/${afIdNum}/grupos`)
      setGrupos(r.data)
      setGrupoJust(prev => {
        const next = { ...prev }
        for (const g of r.data) if (!(g.grupoId in next)) next[g.grupoId] = g.justificacion ?? ''
        return next
      })
    } catch { showToast('error', 'Error al cargar grupos') }
  }

  async function handleCrearGrupo() {
    setCreatingGrupo(true)
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/grupos`, {})
      await cargarGrupos()
    } catch { showToast('error', 'Error al crear grupo') }
    finally { setCreatingGrupo(false) }
  }

  async function handleEliminarGrupo(grupoId: number) {
    try {
      await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/grupos/${grupoId}`)
      setDeletingGrupo(null)
      if (expandedGrupo === grupoId) setExpandedGrupo(null)
      setCoberturas(prev => { const n = { ...prev }; delete n[grupoId]; return n })
      setCobPres(prev => { const n = { ...prev }; delete n[grupoId]; return n })
      setCobVirt(prev => { const n = { ...prev }; delete n[grupoId]; return n })
      setGrupoJust(prev => { const n = { ...prev }; delete n[grupoId]; return n })
      await cargarGrupos()
    } catch { showToast('error', 'Error al eliminar grupo') }
  }

  async function handleSaveJustificacion(grupoId: number) {
    setSavingJust(grupoId)
    try {
      await api.put(`/proyectos/${proyectoId}/acciones/${afIdNum}/grupos/${grupoId}/justificacion`, {
        justificacion: grupoJust[grupoId]?.trim() || null,
      })
      showToast('success', 'Justificación guardada')
      await cargarGrupos()
    } catch { showToast('error', 'Error al guardar justificación') } finally { setSavingJust(null) }
  }

  async function loadCiudades(deptoId: number) {
    if (ciudadesCat[deptoId]) return
    try {
      const r = await api.get<CiudadOpc[]>(`/proyectos/ciudades/${deptoId}`)
      setCiudadesCat(prev => ({ ...prev, [deptoId]: r.data }))
    } catch { /* silencioso */ }
  }

  function initCobFormFromData(grupoId: number, data: CobEntry[], modId: number | null) {
    if (modId === 1) {
      const row = data[0]
      setCobPres(prev => ({ ...prev, [grupoId]: row ? { deptoId: row.deptoId, ciudadId: row.ciudadId, benef: String(row.benef), rural: row.rural } : { deptoId: null, ciudadId: null, benef: '', rural: 0 } }))
      if (row?.deptoId) loadCiudades(row.deptoId)
    } else if (modId === 2 || modId === 4) {
      const rows = data.length ? data.map(d => ({ deptoId: d.deptoId, ciudadId: null, benef: String(d.benef), rural: d.rural })) : [{ deptoId: null, ciudadId: null, benef: '', rural: 0 }]
      setCobVirt(prev => ({ ...prev, [grupoId]: rows }))
    } else if (modId === 3 || modId === 5 || modId === 6) {
      const pRows = data.filter(d => d.modal === 'P')
      const sRows = data.filter(d => d.modal === 'S')
      const pRow = pRows[0]
      setCobPres(prev => ({ ...prev, [grupoId]: pRow ? { deptoId: pRow.deptoId, ciudadId: pRow.ciudadId, benef: String(pRow.benef), rural: pRow.rural } : { deptoId: null, ciudadId: null, benef: '', rural: 0 } }))
      if (pRow?.deptoId) loadCiudades(pRow.deptoId)
      setCobVirt(prev => ({ ...prev, [grupoId]: sRows.length ? sRows.map(d => ({ deptoId: d.deptoId, ciudadId: null, benef: String(d.benef), rural: d.rural })) : [{ deptoId: null, ciudadId: null, benef: '', rural: 0 }] }))
    }
  }

  async function handleExpandGrupo(grupoId: number) {
    if (expandedGrupo === grupoId) { setExpandedGrupo(null); return }
    setExpandedGrupo(grupoId)
    if (!coberturas[grupoId]) {
      try {
        const r = await api.get<CobEntry[]>(`/proyectos/${proyectoId}/acciones/${afIdNum}/grupos/${grupoId}/coberturas`)
        setCoberturas(prev => ({ ...prev, [grupoId]: r.data }))
        initCobFormFromData(grupoId, r.data, af?.modalidadFormacionId ?? null)
      } catch { showToast('error', 'Error al cargar coberturas') }
    }
  }

  async function handleSaveCoberturas(grupoId: number) {
    const mod = af?.modalidadFormacionId ?? null
    const list: { deptoId: number; ciudadId?: number | null; benef: number; modal: string; rural?: number }[] = []

    if (mod === 1) {
      const row = cobPres[grupoId]
      if (!row?.deptoId) return showToast('error', 'Seleccione un departamento')
      const benef = Number(row.benef) || 0
      if (benef <= 0) return showToast('error', 'Ingrese los beneficiarios')
      list.push({ deptoId: row.deptoId, ciudadId: row.ciudadId, benef, modal: 'P', rural: row.rural })
    } else if (mod === 2 || mod === 4) {
      const rows = cobVirt[grupoId] ?? []
      if (!rows.length) return showToast('error', 'Agregue al menos una fila')
      for (const row of rows) {
        if (!row.deptoId) return showToast('error', 'Seleccione departamento en todas las filas')
        const benef = Number(row.benef) || 0
        if (benef <= 0) return showToast('error', 'Ingrese beneficiarios en todas las filas')
        list.push({ deptoId: row.deptoId, ciudadId: null, benef, modal: mod === 2 ? 'P' : 'S', rural: row.rural })
      }
    } else if (mod === 3 || mod === 5 || mod === 6) {
      const pRow = cobPres[grupoId]
      if (!pRow?.deptoId) return showToast('error', 'Seleccione departamento en la parte presencial')
      const pBenef = Number(pRow.benef) || 0
      if (pBenef <= 0) return showToast('error', 'Ingrese beneficiarios presenciales')
      list.push({ deptoId: pRow.deptoId, ciudadId: pRow.ciudadId, benef: pBenef, modal: 'P', rural: pRow.rural })
      const sRows = cobVirt[grupoId] ?? []
      for (const row of sRows) {
        if (!row.deptoId) continue
        const benef = Number(row.benef) || 0
        if (benef > 0) list.push({ deptoId: row.deptoId, ciudadId: null, benef, modal: 'S', rural: row.rural })
      }
    }

    setSavingCob(grupoId)
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/grupos/${grupoId}/coberturas`, { coberturas: list })
      showToast('success', 'Cobertura guardada')
      const r = await api.get<CobEntry[]>(`/proyectos/${proyectoId}/acciones/${afIdNum}/grupos/${grupoId}/coberturas`)
      setCoberturas(prev => ({ ...prev, [grupoId]: r.data }))
      await cargarGrupos()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar'
      showToast('error', msg)
    } finally { setSavingCob(null) }
  }

  // ── Material de Formación handlers ───────────────────────────────────────

  async function handleAgregarRecurso() {
    if (!recursoSelId) return showToast('error', 'Seleccione un recurso didáctico')
    setAddingRecurso(true)
    try {
      await api.post(`/proyectos/${proyectoId}/acciones/${afIdNum}/recursos`, { recursoId: Number(recursoSelId) })
      setRecursoSelId('')
      const r = await api.get<MaterialData>(`/proyectos/${proyectoId}/acciones/${afIdNum}/material`)
      setMaterialData(r.data)
    } catch (e: unknown) {
      showToast('error', (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al agregar')
    } finally { setAddingRecurso(false) }
  }

  async function handleEliminarRecurso(rdafId: number) {
    try {
      await api.delete(`/proyectos/${proyectoId}/acciones/${afIdNum}/recursos/${rdafId}`)
      const r = await api.get<MaterialData>(`/proyectos/${proyectoId}/acciones/${afIdNum}/material`)
      setMaterialData(r.data)
    } catch { showToast('error', 'Error al eliminar recurso') }
  }

  async function handleGuardarMaterial() {
    if (!matForm.tipoAmbienteId)
      return showToast('error', 'Debe asignar el Ambiente de Aprendizaje.')
    if (!matForm.materialFormacionId || !matForm.gestionConocimientoId)
      return showToast('error', 'El Material de Formación y la Gestión del Conocimiento son obligatorios.')
    if (!matForm.justMat.trim())
      return showToast('error', 'Debe completar la Justificación del Material de Formación.')
    if (matForm.insumo.trim() && !matForm.justInsumo.trim())
      return showToast('error', 'Ha ingresado Insumos — debe agregar también la Justificación del Insumo.')

    setSavingMat(true)
    try {
      await api.put(`/proyectos/${proyectoId}/acciones/${afIdNum}/material`, {
        tipoAmbienteId: matForm.tipoAmbienteId ? Number(matForm.tipoAmbienteId) : null,
        gestionConocimientoId: matForm.gestionConocimientoId ? Number(matForm.gestionConocimientoId) : null,
        materialFormacionId: matForm.materialFormacionId ? Number(matForm.materialFormacionId) : null,
        justMat: matForm.justMat.trim() || null,
        insumo: matForm.insumo.trim() || null,
        justInsumo: matForm.justInsumo.trim() || null,
      })
      showToast('success', 'Material de formación guardado')
    } catch (e: unknown) {
      showToast('error', (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar')
    } finally { setSavingMat(false) }
  }

  // ── Guardar (unificado AF + Perfil) ───────────────────────────────────────

  async function handleGuardar() {
    if (!form || !af) return

    const errAf = validarCampos(form, proyecto?.modalidadId ?? null)
    if (errAf) { showToast('error', errAf); return }

    // Validaciones sectores
    if (!sectoresData || sectoresData.sectoresBenef.length === 0)
      return showToast('error', 'Debe agregar al menos un Sector de beneficiarios.')
    if (sectoresData.subsectoresBenef.length === 0)
      return showToast('error', 'Debe agregar al menos un Sub-sector de beneficiarios.')
    if (sectoresData.sectoresAf.length === 0)
      return showToast('error', 'Debe agregar la Clasificación por Sector de la AF.')
    if (sectoresData.subsectoresAf.length === 0)
      return showToast('error', 'Debe agregar la Clasificación por Sub-sector de la AF.')
    if (!form.justSecSub.trim())
      return showToast('error', 'La justificación de sectores y sub-sectores es obligatoria.')

    // Validaciones perfil
    const m1 = form.mipymes.trim(), m2 = form.trabMipymes.trim(), m3 = form.mipymesD.trim()
    if ((m1 || m2 || m3) && !(m1 && m2 && m3)) {
      showToast('error', 'Complete todos los campos de MiPymes o déjelos todos vacíos.'); return
    }
    const c1 = form.cadenaProd.trim(), c2 = form.trabCadProd.trim(), c3 = form.cadenaProdD.trim()
    if ((c1 || c2 || c3) && !(c1 && c2 && c3)) {
      showToast('error', 'Complete todos los campos de Cadena Productiva o déjelos todos vacíos.'); return
    }
    const ca1 = form.numCampesino.trim(), ca2 = form.justCampesino.trim()
    if ((ca1 || ca2) && !(ca1 && ca2)) {
      showToast('error', 'Complete el número y justificación de economía campesina, o déjelos vacíos.'); return
    }
    const p1 = form.numPopular.trim(), p2 = form.justPopular.trim()
    if ((p1 || p2) && !(p1 && p2)) {
      showToast('error', 'Complete el número y justificación de economía popular, o déjelos vacíos.'); return
    }

    const h = Number(form.numHorasGrupo) || null
    const g = Number(form.numGrupos) || null

    setGuardando(true)
    try {
      await Promise.all([
        api.put(`/proyectos/${proyectoId}/acciones/${afIdNum}/sectores`, {
          justificacion: form.justSecSub.trim() || null,
        }),
        api.put(`/proyectos/${proyectoId}/acciones/${afIdNum}`, {
          necesidadFormacionId: form.necesidadFormacionId ? Number(form.necesidadFormacionId) : null,
          nombre: form.nombre.trim(),
          justnec: form.justnec.trim() || null,
          causa: form.causa.trim() || null,
          efectos: form.efectos.trim() || null,
          objetivo: form.objetivo.trim() || null,
          tipoEventoId: Number(form.tipoEventoId),
          modalidadFormacionId: Number(form.modalidadFormacionId),
          metodologiaAprendizajeId: form.metodologiaAprendizajeId ? Number(form.metodologiaAprendizajeId) : null,
          numHorasGrupo: h,
          numGrupos: g,
          benefGrupo: showPresencial ? (Number(form.benefGrupo) || null) : null,
          benefViGrupo: showVirtual ? (Number(form.benefViGrupo) || null) : null,
          numTotHorasGrup: totalHoras,
          numBenef: totalBenef,
        }),
        api.put(`/proyectos/${proyectoId}/acciones/${afIdNum}/beneficiarios`, {
          afEnfoqueId:    form.afEnfoqueId    ? Number(form.afEnfoqueId)    : null,
          justAreas:      form.justAreas.trim()      || null,
          justNivelesOcu: form.justNivelesOcu.trim()  || null,
          trabDiscapac:   form.trabDiscapac.trim()  ? Number(form.trabDiscapac)  : null,
          mujer:          form.mujer.trim()         ? Number(form.mujer)         : null,
          trabajadorBic:  form.trabajadorBic.trim() ? Number(form.trabajadorBic) : null,
          mipymes:        m1 ? Number(form.mipymes)    : null,
          trabMipymes:    m2 ? Number(form.trabMipymes) : null,
          mipymesD:       m3 || null,
          cadenaProd:     c1 ? Number(form.cadenaProd)    : null,
          trabCadProd:    c2 ? Number(form.trabCadProd)   : null,
          cadenaProdD:    c3 || null,
          numCampesino:   ca1 ? Number(form.numCampesino)  : null,
          justCampesino:  ca2 || null,
          numPopular:     p1  ? Number(form.numPopular)    : null,
          justPopular:    p2  || null,
        }),
      ])
      showToast('success', 'Acción de formación guardada correctamente')
      await cargar()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar'
      showToast('error', msg)
    } finally {
      setGuardando(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 size={32} className="animate-spin text-[#00304D]" /></div>
  }
  if (!af || !form || !perfil) {
    return <p className="p-6 text-red-600">No se encontró la acción de formación.</p>
  }

  const esRadicado = Number(proyecto?.estado) === 1
  const esAprobado = Number(proyecto?.estado) === 3

  const card      = 'bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 flex flex-col gap-4'
  const label     = 'block text-sm font-medium text-neutral-700 mb-1'
  const input     = `w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D] disabled:bg-neutral-50 disabled:text-neutral-500`
  const textarea  = `w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#00304D] disabled:bg-neutral-50 disabled:text-neutral-500`
  const select    = `w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D] disabled:bg-neutral-50 disabled:text-neutral-500`
  const chip      = 'flex items-center justify-between gap-2 bg-[#00304D]/10 text-[#00304D] text-xs font-semibold px-3 py-1.5 rounded-lg'
  const secTitle  = 'text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2'

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">

      {toast && (
        <ToastBetowa key={toastK2} show onClose={() => setToast(null)}
          tipo={toast.tipo} titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg} duration={4500} />
      )}

      {/* Encabezado */}
      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex flex-wrap items-center gap-3">
        <ClipboardList size={22} className="text-white flex-shrink-0" />
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 text-white/60 text-xs flex-wrap">
            <Link href="/panel/proyectos" className="hover:text-white transition">Proyectos</Link>
            <ChevronRight size={12} />
            <Link href={`/panel/proyectos/${proyectoId}`} className="hover:text-white transition truncate max-w-[160px]">{proyecto?.nombre}</Link>
            <ChevronRight size={12} />
            <Link href={`/panel/proyectos/${proyectoId}/acciones`} className="hover:text-white transition">Acciones de Formación</Link>
            <ChevronRight size={12} />
            <span>AF {af.numero}</span>
          </div>
          <h1 className="text-white font-bold text-sm">Acción de Formación N° {af.numero}</h1>
        </div>
      </div>

      {/* Menú */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/panel/proyectos/${proyectoId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-neutral-200 text-[#00304D] text-xs font-semibold rounded-xl hover:bg-[#00304D] hover:text-white transition">
          <FolderKanban size={13} /> Generalidades
        </Link>
        <Link href={`/panel/proyectos/${proyectoId}/acciones`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-neutral-200 text-[#00304D] text-xs font-semibold rounded-xl hover:bg-[#00304D] hover:text-white transition">
          <Layers size={13} /> Acciones de Formación
        </Link>
        <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl">
          <ClipboardList size={13} /> Detalle AF {af.numero}
        </span>
        <Link href={`/panel/proyectos/${proyectoId}/acciones/${afId}/rubros`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-neutral-200 text-[#00304D] text-xs font-semibold rounded-xl hover:bg-[#00304D] hover:text-white transition">
          <BookOpen size={13} /> Rubros
        </Link>
        {!esAprobado && (
          <span className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border ${
            esRadicado ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-white border-neutral-200 text-neutral-400'
          }`}>
            {esRadicado ? <><LogOut size={13} /> Confirmado</> : <><CheckCircle2 size={13} /> Sin Confirmar</>}
          </span>
        )}
      </div>

      {!editable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {mensajeNoEditable(proyecto)}
        </div>
      )}

      {/* ── Card 1: Información básica ─────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#00304D] flex items-center justify-center flex-shrink-0">
            <ClipboardList size={16} className="text-white" />
          </div>
          <h2 className="text-sm font-bold text-neutral-800">Información de la Acción de Formación</h2>
        </div>

        <div>
          <label className={label}>Nombre de la Acción de Formación <span className="text-red-500">*</span></label>
          <textarea disabled={!editable} value={form.nombre} onChange={e => set('nombre', e.target.value)}
            maxLength={500} rows={3} className={textarea} placeholder="Nombre de la acción de formación…" />
          <p className="text-xs text-neutral-400 text-right mt-0.5">{form.nombre.length}/500</p>
        </div>

        <div>
          <label className={label}>Problema o necesidad detectada en el diagnóstico</label>
          <div ref={necRef} className="relative">
            <button type="button" disabled={!editable}
              onClick={() => { setNecOpen(v => !v); setNecQuery('') }}
              className="w-full flex items-center justify-between border border-neutral-300 rounded-xl px-3 py-2 text-sm text-left bg-white disabled:bg-neutral-50 disabled:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#00304D]">
              <span className={necSeleccionada ? 'text-neutral-900 truncate mr-2' : 'text-neutral-400'}>
                {necSeleccionada ? `${necSeleccionada.numero ? `[${necSeleccionada.numero}] ` : ''}${necSeleccionada.nombre}` : 'Seleccionar necesidad…'}
              </span>
              {form.necesidadFormacionId && editable
                ? <X size={15} className="shrink-0 text-neutral-400 hover:text-red-500" onClick={e => { e.stopPropagation(); set('necesidadFormacionId', ''); setNecOpen(false) }} />
                : <Search size={15} className="shrink-0 text-neutral-400" />}
            </button>
            {necOpen && editable && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-neutral-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                <div className="p-2 border-b border-neutral-100">
                  <input autoFocus type="text" placeholder="Buscar…" value={necQuery} onChange={e => setNecQuery(e.target.value)}
                    className="w-full text-sm border border-neutral-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#00304D]" />
                </div>
                {necFiltradas.length === 0
                  ? <p className="text-sm text-neutral-400 text-center py-4">Sin resultados</p>
                  : necFiltradas.map(n => (
                    <button key={n.id} type="button" onClick={() => { set('necesidadFormacionId', String(n.id)); setNecOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[#00304D]/10 ${String(n.id) === form.necesidadFormacionId ? 'bg-[#00304D]/10 font-medium text-[#00304D]' : 'text-neutral-700'}`}>
                      {n.numero ? <span className="text-neutral-400 mr-1">[{n.numero}]</span> : null}{n.nombre}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className={label}>Justificación del problema o necesidad detectada</label>
          <textarea disabled={!editable} value={form.justnec} onChange={e => set('justnec', e.target.value)}
            maxLength={5000} rows={5} className={textarea} placeholder="Justificación basada en resultados del diagnóstico…" />
          <p className="text-xs text-neutral-400 text-right mt-0.5">{form.justnec.length}/5000</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Causas del problema</label>
            <textarea disabled={!editable} value={form.causa} onChange={e => set('causa', e.target.value)}
              maxLength={2000} rows={4} className={textarea} placeholder="Causas identificadas…" />
            <p className="text-xs text-neutral-400 text-right mt-0.5">{form.causa.length}/2000</p>
          </div>
          <div>
            <label className={label}>Efectos del problema</label>
            <textarea disabled={!editable} value={form.efectos} onChange={e => set('efectos', e.target.value)}
              maxLength={2000} rows={4} className={textarea} placeholder="Efectos derivados…" />
            <p className="text-xs text-neutral-400 text-right mt-0.5">{form.efectos.length}/2000</p>
          </div>
        </div>

        <div>
          <label className={label}>Objetivo de la Acción de Formación</label>
          <textarea disabled={!editable} value={form.objetivo} onChange={e => set('objetivo', e.target.value)}
            maxLength={2000} rows={3} className={textarea} placeholder="Objetivo de la acción de formación…" />
          <p className="text-xs text-neutral-400 text-right mt-0.5">{form.objetivo.length}/2000</p>
        </div>
      </div>

      {/* ── Card 2: Datos del Evento ────────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#00304D] flex items-center justify-center flex-shrink-0">
            <Layers size={16} className="text-white" />
          </div>
          <h2 className="text-sm font-bold text-neutral-800">Datos del Evento</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={label}>Tipo de Evento <span className="text-red-500">*</span></label>
            <select disabled={!editable} value={form.tipoEventoId} onChange={e => handleEventoChange(e.target.value)} className={select}>
              <option value="">Seleccionar…</option>
              {tiposEvento.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Modalidad de Formación <span className="text-red-500">*</span></label>
            <select disabled={!editable || !form.tipoEventoId} value={form.modalidadFormacionId}
              onChange={e => handleModalidadChange(e.target.value)} className={select}>
              <option value="">Seleccionar…</option>
              {modalidadesFiltradas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Metodología de Aprendizaje <span className="text-red-500">*</span></label>
            <select disabled={!editable || !form.tipoEventoId} value={form.metodologiaAprendizajeId}
              onChange={e => set('metodologiaAprendizajeId', e.target.value)} className={select}>
              <option value="">Seleccionar…</option>
              {metodologiasFiltradas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
        </div>
        {mensajeAlerta && (
          <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">{mensajeAlerta}</p>
          </div>
        )}
      </div>

      {/* ── Card 3: Grupos y Beneficiarios ─────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#00304D] flex items-center justify-center flex-shrink-0">
            <Users size={16} className="text-white" />
          </div>
          <h2 className="text-sm font-bold text-neutral-800">Grupos y Beneficiarios</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>N° Horas por Grupo <span className="text-red-500">*</span></label>
            <input type="number" min={1} disabled={!editable || !form.modalidadFormacionId}
              value={form.numHorasGrupo} onChange={e => set('numHorasGrupo', e.target.value)} className={input} placeholder="Horas" />
            {fieldErrors.horas && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.horas}</p>}
          </div>
          <div>
            <label className={label}>N° de Grupos <span className="text-red-500">*</span></label>
            <input type="number" min={1} disabled={!editable || !form.modalidadFormacionId}
              value={form.numGrupos} onChange={e => set('numGrupos', e.target.value)} className={input} placeholder="Grupos" />
            {fieldErrors.grupos && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.grupos}</p>}
          </div>
          {showPresencial && (
            <div>
              <label className={label}>Beneficiarios Presenciales por Grupo <span className="text-red-500">*</span></label>
              <input type="number" min={0} disabled={!editable || !form.modalidadFormacionId}
                value={form.benefGrupo} onChange={e => set('benefGrupo', e.target.value)} className={input} placeholder="0" />
              {fieldErrors.benef && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.benef}</p>}
            </div>
          )}
          {showVirtual && (
            <div>
              <label className={label}>
                Beneficiarios {MOD_SOLO_VIRTUAL.has(modalidadId ?? 0) ? 'Virtuales' : 'Sincrónicos'} por Grupo
                <span className="text-red-500"> *</span>
              </label>
              <input type="number" min={0} disabled={!editable || !form.modalidadFormacionId}
                value={form.benefViGrupo} onChange={e => set('benefViGrupo', e.target.value)} className={input} placeholder="0" />
              {fieldErrors.benefVi && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.benefVi}</p>}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-100">
          <div className="bg-[#00304D]/5 rounded-xl px-4 py-3">
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-0.5">Total Horas AF</p>
            <p className="text-2xl font-bold text-[#00304D]">{totalHoras ?? '—'}</p>
            <p className="text-xs text-neutral-400 mt-0.5">Horas × Grupos (automático)</p>
          </div>
          <div className="bg-[#00304D]/5 rounded-xl px-4 py-3">
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-0.5">Total Beneficiarios AF</p>
            <p className="text-2xl font-bold text-[#00304D]">{totalBenef ?? '—'}</p>
            <p className="text-xs text-neutral-400 mt-0.5">Beneficiarios × Grupos (automático)</p>
          </div>
        </div>
      </div>

      {/* ── Card 4: Perfil de Beneficiarios ────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#00304D] flex items-center justify-center flex-shrink-0">
            <Users size={16} className="text-white" />
          </div>
          <h2 className="text-sm font-bold text-neutral-800">Perfil de los Beneficiarios</h2>
        </div>

        {/* Áreas funcionales */}
        <div className="flex flex-col gap-3">
          <p className={secTitle}>Área(s) Funcional(es) <span className="font-normal text-neutral-400">(máx. 5)</span></p>
          {editable && perfil.areas.length < 5 && (
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={areaSelId} onChange={e => { setAreaSelId(e.target.value); if (Number(e.target.value) !== AREA_OTRA_ID) setAreaOtroText('') }} className={select}>
                <option value="">Seleccionar área funcional…</option>
                {areasCat.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
              <button onClick={handleAgregarArea}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl hover:bg-[#004a76] transition">
                <Plus size={13} /> Agregar
              </button>
            </div>
          )}
          {Number(areaSelId) === AREA_OTRA_ID && editable && perfil.areas.length < 5 && (
            <div>
              <label className={label}>Especifique el área funcional <span className="text-red-500">*</span></label>
              <textarea value={areaOtroText} onChange={e => setAreaOtroText(e.target.value)}
                maxLength={500} rows={2} className={textarea} placeholder="Describa el área funcional…" />
              <p className="text-xs text-neutral-400 text-right mt-0.5">{(areaOtroText ?? '').length}/500</p>
            </div>
          )}
          {perfil.areas.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {perfil.areas.map(a => (
                <div key={a.aafId} className={chip}>
                  <span>{(a.nombre.toLowerCase().includes('otr') && a.otro) ? a.otro : a.nombre}</span>
                  {editable && <button onClick={() => handleEliminarArea(a.aafId)} className="text-[#00304D]/60 hover:text-red-500 transition"><Trash2 size={12} /></button>}
                </div>
              ))}
            </div>
          )}
          <div>
            <label className={label}>Justificación de Áreas Funcionales <span className="text-red-500">*</span></label>
            <textarea disabled={!editable} value={form.justAreas} onChange={e => set('justAreas', e.target.value)}
              maxLength={3000} rows={4} className={textarea} placeholder="Justifique las áreas funcionales a beneficiar…" />
            <p className="text-xs text-neutral-400 text-right mt-0.5">{form.justAreas.length}/3000</p>
          </div>
        </div>

        <div className="border-t border-neutral-100" />

        {/* Niveles ocupacionales */}
        <div className="flex flex-col gap-3">
          <p className={secTitle}>Niveles Ocupacionales <span className="font-normal text-neutral-400">(máx. 3)</span></p>
          {editable && (
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={nivelSelId} onChange={e => setNivelSelId(e.target.value)} className={select}>
                <option value="">Seleccionar nivel ocupacional…</option>
                {nivelesCat.map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
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
                <div key={n.anId} className={chip}>
                  <span>{n.nombre}</span>
                  {editable && <button onClick={() => handleEliminarNivel(n.anId)} className="text-[#00304D]/60 hover:text-red-500 transition"><Trash2 size={12} /></button>}
                </div>
              ))}
            </div>
          )}
          <div>
            <label className={label}>Justificación de Niveles Ocupacionales <span className="text-red-500">*</span></label>
            <textarea disabled={!editable} value={form.justNivelesOcu} onChange={e => set('justNivelesOcu', e.target.value)}
              maxLength={3000} rows={4} className={textarea} placeholder="Justifique los niveles ocupacionales…" />
            <p className="text-xs text-neutral-400 text-right mt-0.5">{form.justNivelesOcu.length}/3000</p>
          </div>
        </div>

        <div className="border-t border-neutral-100" />

        {/* CUOC */}
        <div className="flex flex-col gap-3">
          <p className={secTitle}>Clasificación Unificada de Ocupaciones CUOC <span className="font-normal text-neutral-400">(máx. 20)</span></p>
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
                    <input autoFocus type="text" placeholder="Buscar código o nombre…" value={cuocQuery}
                      onChange={e => setCuocQuery(e.target.value)}
                      className="w-full text-sm border border-neutral-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#00304D]" />
                  </div>
                  {cuocFiltrados.length === 0
                    ? <p className="text-sm text-neutral-400 text-center py-4">Sin resultados</p>
                    : cuocFiltrados.map(c => (
                      <button key={c.id} type="button" onClick={() => handleAgregarCuoc(c.id)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-[#00304D]/10 text-neutral-700">{c.nombre}</button>
                    ))}
                  {!cuocQuery.trim() && <p className="text-xs text-neutral-400 text-center py-2">Mostrando primeros 50. Escriba para filtrar.</p>}
                </div>
              )}
            </div>
          )}
          {perfil.cuoc.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {perfil.cuoc.map(c => (
                <div key={c.ocAfId} className={chip}>
                  <span className="truncate">{c.nombre}</span>
                  {editable && <button onClick={() => handleEliminarCuoc(c.ocAfId)} className="shrink-0 text-[#00304D]/60 hover:text-red-500 transition"><X size={12} /></button>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-100" />

        {/* Datos numéricos — orden: discapacidad, mujeres, BIC */}
        <div className="flex flex-col gap-3">
          <p className={secTitle}>Datos Numéricos de Beneficiarios</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={label}>N° Personas en Condición de Discapacidad</label>
              <input type="text" inputMode="numeric" disabled={!editable}
                value={form.trabDiscapac} onChange={e => set('trabDiscapac', numOnly(e.target.value))}
                className={input} placeholder="0" maxLength={4} />
            </div>
            <div>
              <label className={label}>N° Trabajadores Mujeres</label>
              <input type="text" inputMode="numeric" disabled={!editable}
                value={form.mujer} onChange={e => set('mujer', numOnly(e.target.value))}
                className={input} placeholder="0" maxLength={4} />
            </div>
            <div>
              <label className={label}>N° Empresas con Modelo BIC</label>
              <input type="text" inputMode="numeric" disabled={!editable}
                value={form.trabajadorBic} onChange={e => set('trabajadorBic', numOnly(e.target.value))}
                className={input} placeholder="0" maxLength={4} />
            </div>
          </div>
        </div>

        {/* MiPymes */}
        <div className="border-t border-neutral-100 pt-2 flex flex-col gap-3">
          <p className={secTitle}>MiPymes <span className="font-normal text-neutral-400">(si aplica)</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>N° Empresas MiPymes</label>
              <input type="text" inputMode="numeric" disabled={!editable}
                value={form.mipymes} onChange={e => set('mipymes', numOnly(e.target.value))} className={input} placeholder="0" maxLength={4} />
            </div>
            <div>
              <label className={label}>N° Trabajadores de Empresas MiPymes</label>
              <input type="text" inputMode="numeric" disabled={!editable}
                value={form.trabMipymes} onChange={e => set('trabMipymes', numOnly(e.target.value))} className={input} placeholder="0" maxLength={4} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Justificación MiPymes y Trabajadores a Beneficiar</label>
              <textarea disabled={!editable} value={form.mipymesD} onChange={e => set('mipymesD', e.target.value)}
                maxLength={3000} rows={3} className={textarea} placeholder="Justificación de inclusión de MiPymes…" />
              <p className="text-xs text-neutral-400 text-right mt-0.5">{form.mipymesD.length}/3000</p>
            </div>
          </div>
        </div>

        {/* Cadena Productiva */}
        <div className="border-t border-neutral-100 pt-2 flex flex-col gap-3">
          <p className={secTitle}>Cadena Productiva <span className="font-normal text-neutral-400">(si aplica)</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>N° Empresas de la Cadena Productiva</label>
              <input type="text" inputMode="numeric" disabled={!editable}
                value={form.cadenaProd} onChange={e => set('cadenaProd', numOnly(e.target.value))} className={input} placeholder="0" maxLength={4} />
            </div>
            <div>
              <label className={label}>N° Trabajadores de la Cadena Productiva</label>
              <input type="text" inputMode="numeric" disabled={!editable}
                value={form.trabCadProd} onChange={e => set('trabCadProd', numOnly(e.target.value))} className={input} placeholder="0" maxLength={4} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Justificación Cadena Productiva</label>
              <textarea disabled={!editable} value={form.cadenaProdD} onChange={e => set('cadenaProdD', e.target.value)}
                maxLength={3000} rows={3} className={textarea} placeholder="Justificación de empresas de la cadena productiva…" />
              <p className="text-xs text-neutral-400 text-right mt-0.5">{form.cadenaProdD.length}/3000</p>
            </div>
          </div>
        </div>

        {/* Economía Campesina */}
        <div className="border-t border-neutral-100 pt-2 flex flex-col gap-3">
          <p className={secTitle}>Economía Campesina <span className="font-normal text-neutral-400">(si aplica)</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>N° Trabajadores de la Economía Campesina</label>
              <input type="text" inputMode="numeric" disabled={!editable}
                value={form.numCampesino} onChange={e => set('numCampesino', numOnly(e.target.value))} className={input} placeholder="0" maxLength={4} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Justificación Trabajadores Economía Campesina</label>
              <textarea disabled={!editable} value={form.justCampesino} onChange={e => set('justCampesino', e.target.value)}
                maxLength={3000} rows={3} className={textarea} placeholder="Justificación de inclusión de trabajadores campesinos…" />
              <p className="text-xs text-neutral-400 text-right mt-0.5">{form.justCampesino.length}/3000</p>
            </div>
          </div>
        </div>

        {/* Economía Popular */}
        <div className="border-t border-neutral-100 pt-2 flex flex-col gap-3">
          <p className={secTitle}>Economía Popular <span className="font-normal text-neutral-400">(si aplica)</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>N° Trabajadores de la Economía Popular</label>
              <input type="text" inputMode="numeric" disabled={!editable}
                value={form.numPopular} onChange={e => set('numPopular', numOnly(e.target.value))} className={input} placeholder="0" maxLength={4} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Justificación Trabajadores Economía Popular</label>
              <textarea disabled={!editable} value={form.justPopular} onChange={e => set('justPopular', e.target.value)}
                maxLength={3000} rows={3} className={textarea} placeholder="Justificación de inclusión de trabajadores de la economía popular…" />
              <p className="text-xs text-neutral-400 text-right mt-0.5">{form.justPopular.length}/3000</p>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-100" />

        {/* Enfoque */}
        <div className="flex flex-col gap-2">
          <p className={secTitle}>Enfoque de la Acción de Formación</p>
          <div>
            <label className={label}>Enfoque <span className="text-red-500">*</span></label>
            <select disabled={!editable} value={form.afEnfoqueId} onChange={e => set('afEnfoqueId', e.target.value)} className={select}>
              <option value="">Seleccionar enfoque…</option>
              {enfoques.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Card 5: Sectores y Sub-sectores ────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#00304D] flex items-center justify-center flex-shrink-0">
            <FolderKanban size={16} className="text-white" />
          </div>
          <h2 className="text-sm font-bold text-neutral-800">Sectores y Sub-sectores</h2>
        </div>

        {/* Sectores a los cuales pertenecen los beneficiarios */}
        <div>
          <p className="text-xs font-semibold text-neutral-600 mb-3 uppercase tracking-wide">
            Sectores a los cuales pertenecen las empresas donde se desempeñan los trabajadores beneficiarios
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Sector(es) beneficiarios — max 5 */}
            <div className="flex flex-col gap-2">
              <p className={secTitle}>Sector(es)</p>
              {editable && (
                <div className="flex gap-2">
                  <select value={sectorBenefSelId} onChange={e => setSectorBenefSelId(e.target.value)} className={select}>
                    <option value="">Seleccionar sector…</option>
                    {sectoresCat.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                  <button onClick={handleAgregarSectorBenef}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl hover:bg-[#004a76] transition">
                    <Plus size={13} /> Agregar
                  </button>
                </div>
              )}
              {sectoresData && sectoresData.sectoresBenef.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {sectoresData.sectoresBenef.map(s => (
                    <div key={s.psId} className={chip}>
                      <span>{s.nombre}</span>
                      {editable && <button onClick={() => handleEliminarSectorBenef(s.psId)} className="text-[#00304D]/60 hover:text-red-500 transition"><Trash2 size={12} /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sub-sector(es) beneficiarios — max 5 */}
            <div className="flex flex-col gap-2">
              <p className={secTitle}>Sub-sector(es)</p>
              {editable && (
                <div className="flex gap-2">
                  <select value={subsectorBenefSelId} onChange={e => setSubsectorBenefSelId(e.target.value)} className={select}>
                    <option value="">Seleccionar sub-sector…</option>
                    {subsectoresCat.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                  <button onClick={handleAgregarSubSectorBenef}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl hover:bg-[#004a76] transition">
                    <Plus size={13} /> Agregar
                  </button>
                </div>
              )}
              {sectoresData && sectoresData.subsectoresBenef.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {sectoresData.subsectoresBenef.map(s => (
                    <div key={s.pssId} className={chip}>
                      <span>{s.nombre}</span>
                      {editable && <button onClick={() => handleEliminarSubSectorBenef(s.pssId)} className="text-[#00304D]/60 hover:text-red-500 transition"><Trash2 size={12} /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-100" />

        {/* Clasificación por sector y sub-sector de la AF */}
        <div>
          <p className="text-xs font-semibold text-neutral-600 mb-3 uppercase tracking-wide">
            Clasificación por sector y sub-sector de la Acción de Formación, según la temática desarrollada
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Sector AF — max 1 */}
            <div className="flex flex-col gap-2">
              <p className={secTitle}>Clasificación por Sector(es) <span className="font-normal text-neutral-400">(máx. 1)</span></p>
              {editable && !(sectoresData && sectoresData.sectoresAf.length >= 1) && (
                <div className="flex gap-2">
                  <select value={sectorAfSelId} onChange={e => setSectorAfSelId(e.target.value)} className={select}>
                    <option value="">Seleccionar sector…</option>
                    {sectoresCat.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                  <button onClick={handleAgregarSectorAf}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl hover:bg-[#004a76] transition">
                    <Plus size={13} /> Agregar
                  </button>
                </div>
              )}
              {sectoresData && sectoresData.sectoresAf.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {sectoresData.sectoresAf.map(s => (
                    <div key={s.saId} className={chip}>
                      <span>{s.nombre}</span>
                      {editable && <button onClick={() => handleEliminarSectorAf(s.saId)} className="text-[#00304D]/60 hover:text-red-500 transition"><Trash2 size={12} /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sub-sector AF — max 1 */}
            <div className="flex flex-col gap-2">
              <p className={secTitle}>Clasificación por Sub-sector(es) <span className="font-normal text-neutral-400">(máx. 1)</span></p>
              {editable && !(sectoresData && sectoresData.subsectoresAf.length >= 1) && (
                <div className="flex gap-2">
                  <select value={subsectorAfSelId} onChange={e => setSubsectorAfSelId(e.target.value)} className={select}>
                    <option value="">Seleccionar sub-sector…</option>
                    {subsectoresCat.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                  <button onClick={handleAgregarSubSectorAf}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl hover:bg-[#004a76] transition">
                    <Plus size={13} /> Agregar
                  </button>
                </div>
              )}
              {sectoresData && sectoresData.subsectoresAf.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {sectoresData.subsectoresAf.map(s => (
                    <div key={s.ssaId} className={chip}>
                      <span>{s.nombre}</span>
                      {editable && <button onClick={() => handleEliminarSubSectorAf(s.ssaId)} className="text-[#00304D]/60 hover:text-red-500 transition"><Trash2 size={12} /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-100" />

        {/* Justificación sectores/sub-sectores */}
        <div>
          <label className={label}>
            Justificación de los sectores y sub-sectores a beneficiar <span className="text-red-500">*</span>
            <span className="text-neutral-400 font-normal ml-1">(máx. 3000 caracteres)</span>
          </label>
          <textarea disabled={!editable} value={form.justSecSub} onChange={e => set('justSecSub', e.target.value)}
            maxLength={3000} rows={5} className={textarea}
            placeholder="Justifique los sectores y sub-sectores seleccionados para los beneficiarios de la acción de formación…" />
          <p className="text-xs text-neutral-400 text-right mt-0.5">{form.justSecSub.length}/3000</p>
        </div>
      </div>

      {/* ── Guardar ───────────────────────────────────────────────────────────── */}
      {editable && (
        <div className="flex justify-end pb-2">
          <button onClick={handleGuardar} disabled={guardando}
            className="inline-flex items-center gap-2 bg-[#00304D] hover:bg-[#004a76] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60">
            {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* ── Card 6: Unidades Temáticas ─────────────────────────────────────── */}
      {(() => {
        const hLabels = labelHorasUT(af.modalidadFormacionId)
        const esConfOForo = [1, 2].includes(Number(form.tipoEventoId))
        const actSelNombre = actividadesCat.find(a => a.id === Number(actSelUT))?.nombre ?? ''
        const actNeedsOtro = /otro/i.test(actSelNombre)
        const mostrarDescVirtual = detalleUT ? tieneActividadVirtualOAumentada(detalleUT.actividades) : false
        const canCrear = editable && !creandoUT && expandedUtId === null

        const horasUts    = uts.reduce((a, u) => a + Number(u.totalPrac) + Number(u.totalTeor), 0)
        const horasGrupo  = Number(af.numHorasGrupo) || 0
        const horasFaltan = Math.max(0, horasGrupo - horasUts)
        const horasExcede = Math.max(0, horasUts - horasGrupo)
        const utsCompleto = horasGrupo > 0 && horasUts === horasGrupo

        return (
          <div className={card}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-8 h-8 rounded-xl bg-[#00304D] flex items-center justify-center flex-shrink-0">
                  <BookOpen size={16} className="text-white" />
                </div>
                <h2 className="text-sm font-bold text-neutral-800">Unidades Temáticas</h2>
                {uts.length > 0 && (
                  <span className="text-xs text-neutral-400 ml-1">
                    {uts.length} UT{uts.length !== 1 ? 's' : ''} · {horasUts} h por grupo
                  </span>
                )}
                {horasGrupo > 0 && (
                  utsCompleto ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-[11px] font-semibold">
                      ✓ Completo · {horasUts}/{horasGrupo}h por grupo
                    </span>
                  ) : horasExcede > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold">
                      ⚠ Excede {horasExcede}h · {horasUts}/{horasGrupo}h por grupo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-[11px] font-semibold">
                      Faltan {horasFaltan}h · {horasUts}/{horasGrupo}h por grupo
                    </span>
                  )
                )}
              </div>
              {canCrear && (
                <button onClick={() => { setCreandoUT(true); setNuevoUtEsArt(null); setNuevoUtNombre(''); setNuevoUtArtId('') }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00304D] text-white text-xs font-semibold rounded-xl hover:bg-[#004a76] transition">
                  <Plus size={12} /> Nueva UT
                </button>
              )}
            </div>

            {/* ── Paso de creación ── */}
            {creandoUT && (
              <div className="p-4 bg-[#00304D]/5 rounded-xl border border-[#00304D]/20 flex flex-col gap-4">
                {/* Paso 1: tipo */}
                {nuevoUtEsArt === null && (
                  <>
                    <p className="text-sm font-medium text-[#00304D]">¿De qué tipo es la nueva Unidad Temática?</p>
                    {!esConfOForo && (
                      <button onClick={() => setNuevoUtEsArt(true)}
                        className="text-left w-full px-4 py-3 border-2 border-violet-200 bg-violet-50 rounded-xl hover:border-violet-400 transition group">
                        <p className="text-xs font-bold text-violet-700 mb-0.5">Articulación Territorial para el Desarrollo</p>
                        <p className="text-xs text-violet-500">Una de las 7 articulaciones del programa</p>
                      </button>
                    )}
                    <button onClick={() => setNuevoUtEsArt(false)}
                      className="text-left w-full px-4 py-3 border-2 border-neutral-200 bg-white rounded-xl hover:border-[#00304D] transition">
                      <p className="text-xs font-bold text-neutral-700 mb-0.5">Unidad Temática estándar</p>
                      <p className="text-xs text-neutral-400">Con nombre propio definido por el proponente</p>
                    </button>
                    <button onClick={() => { setCreandoUT(false); setNuevoUtEsArt(null) }}
                      className="self-start text-xs text-neutral-400 hover:text-neutral-600 transition">Cancelar</button>
                  </>
                )}

                {/* Paso 2a: Articulación → dropdown */}
                {nuevoUtEsArt === true && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Articulación Territorial para el Desarrollo</p>
                    <div>
                      <label className={label}>Seleccione la articulación <span className="text-red-500">*</span></label>
                      <select value={nuevoUtArtId} onChange={e => setNuevoUtArtId(e.target.value)} className={select} autoFocus>
                        <option value="">— Seleccione —</option>
                        {articulacionesCat.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleCrearUT} disabled={savingNuevoUT || !nuevoUtArtId}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl hover:bg-[#004a76] disabled:opacity-50 transition">
                        {savingNuevoUT ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Crear Unidad Temática
                      </button>
                      <button onClick={() => setNuevoUtEsArt(null)}
                        className="px-3 py-2 border border-neutral-200 rounded-xl text-xs text-neutral-500 hover:bg-neutral-100 transition">Atrás</button>
                    </div>
                  </div>
                )}

                {/* Paso 2b: Estándar → texto */}
                {nuevoUtEsArt === false && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className={label}>Nombre de la Unidad Temática <span className="text-red-500">*</span></label>
                      <input value={nuevoUtNombre} onChange={e => setNuevoUtNombre(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCrearUT()}
                        maxLength={500} className={input} placeholder="Nombre de la unidad temática…" autoFocus />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleCrearUT} disabled={savingNuevoUT || !nuevoUtNombre.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl hover:bg-[#004a76] disabled:opacity-50 transition">
                        {savingNuevoUT ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Crear Unidad Temática
                      </button>
                      <button onClick={() => setNuevoUtEsArt(null)}
                        className="px-3 py-2 border border-neutral-200 rounded-xl text-xs text-neutral-500 hover:bg-neutral-100 transition">Atrás</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Lista vacía */}
            {uts.length === 0 && !creandoUT && (
              <div className="text-center py-8 text-neutral-400 text-xs flex flex-col items-center gap-2">
                <BookOpen size={24} className="text-neutral-200" />
                <span>No hay unidades temáticas registradas</span>
              </div>
            )}

            {/* ── Lista de UTs ── */}
            <div className="flex flex-col gap-3">
              {uts.map(ut => {
                const isExpanded = expandedUtId === ut.utId
                const isDeleting = deletingUtId === ut.utId
                const totalH = Number(ut.totalPrac) + Number(ut.totalTeor)

                return (
                  <div key={ut.utId} className="border border-neutral-200 rounded-xl overflow-hidden">
                    {/* Cabecera UT */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-neutral-50">
                      <div className="w-7 h-7 rounded-lg bg-[#00304D]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-[#00304D]">{ut.numero}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-800 leading-tight">{ut.nombre}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {totalH > 0 ? `${totalH} h` : 'Sin horas aún'}
                          {Number(ut.totalPrac) > 0 && ` · ${Number(ut.totalPrac)} prac.`}
                          {Number(ut.totalTeor) > 0 && ` · ${Number(ut.totalTeor)} teór.`}
                          {ut.esTransversal === 1 && <span className="ml-1.5 text-violet-500 font-medium">· Art. Territorial</span>}
                        </p>
                      </div>
                      {!isDeleting ? (
                        <div className="flex gap-1.5">
                          <button onClick={() => handleExpandUT(ut.utId)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 border border-neutral-200 bg-white text-[#00304D] text-xs font-semibold rounded-lg hover:bg-[#00304D] hover:text-white transition">
                            {isExpanded ? <><ChevronUp size={12} /> Cerrar</> : <><ChevronDown size={12} /> {editable ? 'Editar' : 'Ver'}</>}
                          </button>
                          {editable && (
                            <button onClick={() => setDeletingUtId(ut.utId)}
                              className="p-1.5 border border-red-200 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ) : (
                        /* Confirmación inline sin alert del navegador */
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">
                          <span className="text-xs text-red-700 font-medium">¿Eliminar esta UT y sus datos?</span>
                          <button onClick={() => handleConfirmarEliminarUT(ut.utId)}
                            className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition">Sí, eliminar</button>
                          <button onClick={() => setDeletingUtId(null)}
                            className="px-3 py-1 border border-neutral-200 bg-white text-xs text-neutral-600 rounded-lg hover:bg-neutral-100 transition">Cancelar</button>
                        </div>
                      )}
                    </div>

                    {/* ── Formulario de detalle ── */}
                    {isExpanded && (
                      <div className="p-4 flex flex-col gap-5 border-t border-neutral-100">
                        {!detalleUT || !utDetForm ? (
                          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-neutral-300" size={22} /></div>
                        ) : (
                          <>
                            {/* Articulación territorial en modo lectura (si es de ese tipo) */}
                            {detalleUT.articulacionTerritorialId && (
                              <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-xl">
                                <span className="text-xs font-bold text-violet-700">Articulación Territorial:</span>
                                <span className="text-xs text-violet-700">{detalleUT.articulacionTerritorialNombre}</span>
                              </div>
                            )}

                            {/* Horas */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className={label}>{hLabels.prac}</label>
                                <input type="number" min={0} step={1} disabled={!editable} value={utDetForm.horasPrac}
                                  onChange={e => setUtDetForm(f => f ? { ...f, horasPrac: e.target.value } : f)}
                                  className={input} placeholder="0" />
                              </div>
                              <div>
                                <label className={label}>{hLabels.teor}</label>
                                <input type="number" min={0} step={1} disabled={!editable} value={utDetForm.horasTeor}
                                  onChange={e => setUtDetForm(f => f ? { ...f, horasTeor: e.target.value } : f)}
                                  className={input} placeholder="0" />
                              </div>
                            </div>

                            {/* Contenido */}
                            <div>
                              <label className={label}>Contenido de la Unidad Temática</label>
                              <textarea disabled={!editable} value={utDetForm.contenido}
                                onChange={e => setUtDetForm(f => f ? { ...f, contenido: e.target.value } : f)}
                                rows={3} maxLength={3000} className={textarea} placeholder="Describa el contenido temático…" />
                              <p className="text-xs text-neutral-400 text-right mt-0.5">{(utDetForm.contenido ?? '').length}/3000</p>
                            </div>

                            {/* Actividades de aprendizaje */}
                            <div className="flex flex-col gap-2">
                              <p className={secTitle}>Actividades de aprendizaje ({detalleUT.actividades.length})</p>
                              <div className="flex flex-wrap gap-2 mb-1">
                                {detalleUT.actividades.map(a => (
                                  <span key={a.actId}
                                    className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-full">
                                    {a.nombre}{a.otro ? `: ${a.otro}` : ''}
                                    {editable && (
                                      <button onClick={() => handleEliminarActividadUT(a.actId)} className="text-blue-300 hover:text-red-500 transition"><X size={11} /></button>
                                    )}
                                  </span>
                                ))}
                                {detalleUT.actividades.length === 0 && <span className="text-xs text-neutral-400">Sin actividades</span>}
                              </div>
                              {editable && (() => {
                                const actDisponibles = actividadesCat.filter(a => !detalleUT.actividades.some(d => d.actividadId === a.id))
                                const actFiltradas = !actBusqueda.trim()
                                  ? actDisponibles.slice(0, 50)
                                  : actDisponibles.filter(a => a.nombre.toLowerCase().includes(actBusqueda.trim().toLowerCase())).slice(0, 50)
                                return (
                                  <div className="flex gap-2 flex-wrap items-end">
                                    <div ref={actDropRef} className="relative flex-1 min-w-[200px]">
                                      <button type="button"
                                        onClick={() => { setActDropdownOpen(v => !v); setActBusqueda('') }}
                                        className="w-full flex items-center justify-between border border-neutral-300 rounded-xl px-3 py-2 text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-[#00304D]">
                                        <span className={actSelNombre ? 'text-neutral-800' : 'text-neutral-400'}>
                                          {actSelNombre || '— Seleccione actividad —'}
                                        </span>
                                        <Search size={13} className="shrink-0 text-neutral-400" />
                                      </button>
                                      {actDropdownOpen && (
                                        <div className="absolute z-50 mt-1 w-full bg-white border border-neutral-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                                          <div className="p-2 border-b border-neutral-100 sticky top-0 bg-white">
                                            <input autoFocus type="text" placeholder="Buscar actividad…"
                                              value={actBusqueda} onChange={e => setActBusqueda(e.target.value)}
                                              className="w-full text-sm border border-neutral-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#00304D]" />
                                          </div>
                                          {actFiltradas.length === 0
                                            ? <p className="text-sm text-neutral-400 text-center py-4">Sin resultados</p>
                                            : actFiltradas.map(a => (
                                              <button key={a.id} type="button"
                                                onClick={() => { setActSelUT(String(a.id)); setActDropdownOpen(false); setActBusqueda('') }}
                                                className={`w-full text-left px-3 py-2 text-xs hover:bg-[#00304D]/10 transition ${actSelUT === String(a.id) ? 'bg-[#00304D]/5 font-semibold text-[#00304D]' : 'text-neutral-700'}`}>
                                                {a.nombre}
                                              </button>
                                            ))}
                                          {actBusqueda.trim() === '' && actDisponibles.length > 50 && (
                                            <p className="text-xs text-neutral-400 text-center py-2">Mostrando primeros 50. Escriba para filtrar.</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    {actNeedsOtro && (
                                      <div className="flex-1 min-w-[140px]">
                                        <input value={actOtroUT} onChange={e => setActOtroUT(e.target.value)}
                                          className={input} placeholder="Especifique…" maxLength={200} />
                                      </div>
                                    )}
                                    <button onClick={handleAgregarActividadUT} disabled={actAddingUT || !actSelUT}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl hover:bg-[#004a76] disabled:opacity-50 transition">
                                      {actAddingUT ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Agregar
                                    </button>
                                  </div>
                                )
                              })()}
                            </div>

                            {/* Descripción de actividades (solo si virtual o aumentada) */}
                            {mostrarDescVirtual && (
                              <div>
                                <label className={label}>Descripción de las actividades de aprendizaje</label>
                                <textarea disabled={!editable} value={utDetForm.justActividad}
                                  onChange={e => setUtDetForm(f => f ? { ...f, justActividad: e.target.value } : f)}
                                  rows={3} maxLength={3000} className={textarea}
                                  placeholder="Describa cómo se desarrollarán las actividades virtuales o aumentadas…" />
                                <p className="text-xs text-neutral-400 text-right mt-0.5">{(utDetForm.justActividad ?? '').length}/3000</p>
                              </div>
                            )}

                            {/* Competencia por adquirir */}
                            <div>
                              <label className={label}>Competencia por adquirir</label>
                              <textarea disabled={!editable} value={utDetForm.competencias}
                                onChange={e => setUtDetForm(f => f ? { ...f, competencias: e.target.value } : f)}
                                rows={3} maxLength={3000} className={textarea} placeholder="Describa las competencias que adquirirán los beneficiarios…" />
                              <p className="text-xs text-neutral-400 text-right mt-0.5">{(utDetForm.competencias ?? '').length}/3000</p>
                            </div>

                            {/* Perfil de capacitador */}
                            <div className="flex flex-col gap-2">
                              <p className={secTitle}>Perfil de capacitador ({detalleUT.perfiles.length})</p>
                              {detalleUT.perfiles.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs mb-2">
                                    <thead><tr className="text-neutral-400 border-b border-neutral-100">
                                      <th className="text-left py-1.5 pr-3 font-medium">Perfil del Capacitador</th>
                                      <th className="text-center py-1.5 px-2 font-medium">Horas Capacitador</th>
                                      {editable && <th className="py-1.5 w-8" />}
                                    </tr></thead>
                                    <tbody>{detalleUT.perfiles.map(p => (
                                      <tr key={p.perfilId} className="border-b border-neutral-50">
                                        <td className="py-1.5 pr-3 font-medium text-neutral-800">{p.rubroNombre}</td>
                                        <td className="py-1.5 px-2 text-center">{p.horasCap}</td>
                                        {editable && (
                                          <td className="py-1.5 text-right">
                                            <button onClick={() => handleEliminarPerfilUT(p.perfilId)} className="text-red-300 hover:text-red-600 transition"><Trash2 size={12} /></button>
                                          </td>
                                        )}
                                      </tr>
                                    ))}</tbody>
                                  </table>
                                </div>
                              )}
                              {detalleUT.perfiles.length === 0 && <p className="text-xs text-neutral-400">Sin perfiles registrados</p>}
                              {editable && (
                                <div className="flex gap-2 flex-wrap items-end">
                                  <div className="flex-1 min-w-[200px]">
                                    <select value={perfilAddUT.rubroId} onChange={e => setPerfilAddUT(p => ({ ...p, rubroId: e.target.value }))} className={select}>
                                      <option value="">— Perfil del Capacitador —</option>
                                      {rubrosCat.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                                    </select>
                                  </div>
                                  <div className="w-28">
                                    <input type="number" min={1} step={1} value={perfilAddUT.horasCap}
                                      onChange={e => setPerfilAddUT(p => ({ ...p, horasCap: e.target.value }))}
                                      className={input} placeholder="Horas" />
                                  </div>
                                  <button onClick={handleAgregarPerfilUT} disabled={perfilAddingUT || !perfilAddUT.rubroId}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl hover:bg-[#004a76] disabled:opacity-50 transition">
                                    {perfilAddingUT ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Agregar
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Guardar / Cerrar UT */}
                            <div className="flex gap-2 pt-1 border-t border-neutral-100">
                              {editable && (
                                <button onClick={handleGuardarUTDet} disabled={savingUTDet}
                                  className="inline-flex items-center gap-2 bg-[#00304D] hover:bg-[#004a76] text-white px-5 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-60">
                                  {savingUTDet ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                  {savingUTDet ? 'Guardando…' : 'Guardar Unidad Temática'}
                                </button>
                              )}
                              <button onClick={() => { setExpandedUtId(null); setDetalleUT(null); setUtDetForm(null) }}
                                className="px-4 py-2 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition">
                                Cerrar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ════════════════════════════════════════════════════════════════════
          Card 7 — Alineación de la Acción de Formación
      ════════════════════════════════════════════════════════════════════ */}
      {(() => {
        const alinRetoFiltrados = retosCat.filter(r =>
          !alinRetoBusq || r.nombre.toLowerCase().includes(alinRetoBusq.toLowerCase()),
        )
        const alinRetoSelNombre = alinRetoSel
          ? (retosCat.find(r => String(r.id) === alinRetoSel)?.nombre ?? '')
          : ''
        const alinCompFiltrados = afComponentesCat.filter(c =>
          !alinCompBusq || c.nombre.toLowerCase().includes(alinCompBusq.toLowerCase()),
        )
        const alinSelNombre = alinCompSel ? (afComponentesCat.find(c => c.id === alinCompSel)?.nombre ?? alineacion?.componenteNombre ?? '') : ''

        return (
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100">
              <div className="w-8 h-8 rounded-xl bg-[#00304D] flex items-center justify-center">
                <ClipboardList size={16} className="text-white" />
              </div>
              <h2 className="text-base font-bold text-neutral-800">Alineación de la Acción de Formación</h2>
            </div>

            <div className="p-6 flex flex-col gap-6">

              {/* ── Componente estratégico único ── */}
              <div className="flex flex-col gap-3">
                <p className={secTitle}>Componente Estratégico</p>

                {/* Reto Nacional — combobox buscable */}
                <div>
                  <label className={label}>Reto Nacional</label>
                  <div className="relative" ref={alinRetoRef}>
                    <div
                      onClick={() => setAlinRetoOpen(o => !o)}
                      className={`${input} flex items-center justify-between gap-2 cursor-pointer`}
                    >
                      <span className={`${alinRetoSel ? 'text-neutral-800' : 'text-neutral-400'} line-clamp-2 leading-tight`}>
                        {alinRetoSel ? alinRetoSelNombre : '— Seleccione un reto —'}
                      </span>
                      <ChevronDown size={14} className="text-neutral-400 flex-shrink-0" />
                    </div>
                    {alinRetoOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg flex flex-col max-h-72 overflow-hidden">
                        <div className="p-2 border-b border-neutral-100">
                          <input
                            autoFocus
                            value={alinRetoBusq}
                            onChange={e => setAlinRetoBusq(e.target.value)}
                            className="w-full text-xs px-3 py-1.5 border border-neutral-200 rounded-lg outline-none focus:border-[#00304D]"
                            placeholder="Buscar reto…"
                          />
                        </div>
                        <div className="overflow-y-auto">
                          {alinRetoFiltrados.length === 0 && (
                            <p className="text-xs text-neutral-400 text-center py-4">Sin resultados</p>
                          )}
                          {alinRetoFiltrados.map(r => (
                            <button key={r.id}
                              onClick={() => { handleCargarComponentesByReto(String(r.id)); setAlinRetoOpen(false); setAlinRetoBusq('') }}
                              className={`w-full text-left text-xs px-4 py-2 hover:bg-[#00304D]/5 transition leading-relaxed whitespace-normal break-words ${alinRetoSel === String(r.id) ? 'bg-[#00304D]/10 font-semibold text-[#00304D]' : 'text-neutral-700'}`}>
                              {r.nombre}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Componente buscable */}
                <div>
                  <label className={label}>Componente Estratégico</label>
                  <div className="relative" ref={alinCompRef}>
                    <div
                      onClick={() => alinRetoSel && setAlinCompOpen(o => !o)}
                      className={`${input} flex items-center justify-between gap-2 cursor-pointer ${!alinRetoSel ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className={`${alinCompSel ? 'text-neutral-800' : 'text-neutral-400'} line-clamp-2 leading-tight`}>
                        {alinCompSel ? alinSelNombre : 'Seleccione o busque…'}
                      </span>
                      <ChevronDown size={14} className="text-neutral-400 flex-shrink-0" />
                    </div>
                    {alinCompOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg flex flex-col max-h-72 overflow-hidden">
                        <div className="p-2 border-b border-neutral-100">
                          <input
                            autoFocus
                            value={alinCompBusq}
                            onChange={e => setAlinCompBusq(e.target.value)}
                            className="w-full text-xs px-3 py-1.5 border border-neutral-200 rounded-lg outline-none focus:border-[#00304D]"
                            placeholder="Buscar componente…"
                          />
                        </div>
                        <div className="overflow-y-auto">
                          {alinCompFiltrados.length === 0 && (
                            <p className="text-xs text-neutral-400 text-center py-4">Sin resultados</p>
                          )}
                          {alinCompFiltrados.map(c => (
                            <button key={c.id}
                              onClick={() => { setAlinCompSel(c.id); setAlinCompOpen(false); setAlinCompBusq('') }}
                              className={`w-full text-left text-xs px-4 py-2 hover:bg-[#00304D]/5 transition leading-relaxed whitespace-normal break-words ${alinCompSel === c.id ? 'bg-[#00304D]/10 font-semibold text-[#00304D]' : 'text-neutral-700'}`}>
                              {c.nombre}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Justificación de la Alineación ── */}
              <div>
                <label className={label}>Justificación de la Alineación de Formación</label>
                <p className="text-[10px] text-neutral-400 mb-1">Máx. 3000 caracteres</p>
                <textarea value={alinForm.compod}
                  onChange={e => setAlinForm(f => ({ ...f, compod: e.target.value }))}
                  rows={4} maxLength={3000} className={textarea}
                  placeholder="Describa cómo esta acción de formación se alinea con los componentes seleccionados…" />
                <p className="text-xs text-neutral-400 text-right mt-0.5">{(alinForm.compod ?? '').length}/3000</p>
              </div>

              {/* ── ¿Por qué es especializada? ── */}
              <div>
                <label className={label}>¿Por qué la Acción de Formación es Especializada?</label>
                <p className="text-[10px] text-neutral-400 mb-1">Máx. 3000 caracteres</p>
                <textarea value={alinForm.justificacion}
                  onChange={e => setAlinForm(f => ({ ...f, justificacion: e.target.value }))}
                  rows={4} maxLength={3000} className={textarea}
                  placeholder="Justifique por qué esta acción de formación es especializada…" />
                <p className="text-xs text-neutral-400 text-right mt-0.5">{(alinForm.justificacion ?? '').length}/3000</p>
              </div>

              {/* ── Resultados Desempeño ── */}
              <div>
                <label className={label}>Resultados — Impacto en el desempeño del trabajador y aplicación de conocimientos en el puesto de trabajo</label>
                <p className="text-[10px] text-neutral-400 mb-1">Máx. 5000 caracteres</p>
                <textarea value={alinForm.resDesem}
                  onChange={e => setAlinForm(f => ({ ...f, resDesem: e.target.value }))}
                  rows={5} maxLength={5000} className={textarea}
                  placeholder="Describa los resultados esperados en el desempeño del trabajador…" />
                <p className="text-xs text-neutral-400 text-right mt-0.5">{(alinForm.resDesem ?? '').length}/5000</p>
              </div>

              {/* ── Resultados Productividad ── */}
              <div>
                <label className={label}>Resultados — Impacto en la productividad y competitividad de las empresas y gremios</label>
                <p className="text-[10px] text-neutral-400 mb-1">Máx. 5000 caracteres</p>
                <textarea value={alinForm.resForm}
                  onChange={e => setAlinForm(f => ({ ...f, resForm: e.target.value }))}
                  rows={5} maxLength={5000} className={textarea}
                  placeholder="Describa los resultados esperados en productividad y competitividad…" />
                <p className="text-xs text-neutral-400 text-right mt-0.5">{(alinForm.resForm ?? '').length}/5000</p>
              </div>

              {/* ── Guardar ── */}
              {editable && (
                <div className="flex pt-1 border-t border-neutral-100">
                  <button onClick={handleGuardarAlineacion} disabled={savingAlin}
                    className="inline-flex items-center gap-2 bg-[#00304D] hover:bg-[#004a76] text-white px-6 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-60">
                    {savingAlin ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    {savingAlin ? 'Guardando…' : 'Guardar Alineación'}
                  </button>
                </div>
              )}

            </div>
          </div>
        )
      })()}

      {/* ════════════════════════════════════════════════════════════════════
          Card 8 — Cobertura de la Acción de Formación
      ════════════════════════════════════════════════════════════════════ */}
      {(() => {
        const mod = af.modalidadFormacionId
        const esPresencial  = mod === 1
        const esPat         = mod === 2
        const esHibrida     = mod === 3 || mod === 5 || mod === 6
        const esVirtual     = mod === 4
        const benefTarget   = af.benefGrupo ?? 0
        const benefViTarget = af.benefViGrupo ?? 0

        return (
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100">
              <div className="w-8 h-8 rounded-xl bg-[#00304D] flex items-center justify-center">
                <Users size={16} className="text-white" />
              </div>
              <h2 className="text-base font-bold text-neutral-800">Cobertura de la Acción de Formación</h2>
            </div>

            <div className="p-6 flex flex-col gap-4">

              {/* Referencia de beneficiarios esperados */}
              <div className="flex flex-wrap gap-3">
                {(esPresencial || esPat || esHibrida) && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-800">
                    <span className="font-semibold">Benef. presenciales esperados por grupo:</span>
                    <span className="font-bold text-blue-900">{benefTarget}</span>
                  </div>
                )}
                {(esVirtual || esHibrida) && (
                  <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 text-xs text-purple-800">
                    <span className="font-semibold">Benef. virtuales/sincrónicos esperados por grupo:</span>
                    <span className="font-bold text-purple-900">{benefViTarget}</span>
                  </div>
                )}
              </div>

              {/* Grupos */}
              {grupos.map(grupo => {
                const isExpanded = expandedGrupo === grupo.grupoId
                const isDeleting = deletingGrupo === grupo.grupoId
                const isSavingJ  = savingJust === grupo.grupoId
                const isSavingC  = savingCob  === grupo.grupoId

                // Totales calculados en el formulario
                let formTotalPres = 0
                let formTotalVirt = 0
                if (esPresencial) {
                  formTotalPres = Number(cobPres[grupo.grupoId]?.benef) || 0
                } else if (esPat) {
                  formTotalPres = (cobVirt[grupo.grupoId] ?? []).reduce((s, r) => s + (Number(r.benef) || 0), 0)
                } else if (esVirtual) {
                  formTotalVirt = (cobVirt[grupo.grupoId] ?? []).reduce((s, r) => s + (Number(r.benef) || 0), 0)
                } else if (esHibrida) {
                  formTotalPres = Number(cobPres[grupo.grupoId]?.benef) || 0
                  formTotalVirt = (cobVirt[grupo.grupoId] ?? []).reduce((s, r) => s + (Number(r.benef) || 0), 0)
                }

                return (
                  <div key={grupo.grupoId} className="border border-neutral-200 rounded-xl overflow-hidden">
                    {/* Header del grupo */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition cursor-pointer select-none"
                      onClick={() => handleExpandGrupo(grupo.grupoId)}
                    >
                      {isExpanded ? <ChevronUp size={16} className="text-neutral-500 flex-shrink-0" /> : <ChevronDown size={16} className="text-neutral-500 flex-shrink-0" />}
                      <span className="font-bold text-sm text-neutral-800">Grupo {grupo.grupoNumero}</span>
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg font-medium">
                          {grupo.numCoberturas} cobertura{grupo.numCoberturas !== 1 ? 's' : ''}
                        </span>
                        {grupo.totalBenef > 0 && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-lg font-medium">
                            {grupo.totalBenef} benef. registrados
                          </span>
                        )}
                        {grupo.justificacion && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg font-medium">
                            Con justificación
                          </span>
                        )}
                      </div>
                      <div className="ml-auto flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {isDeleting ? (
                          <>
                            <span className="text-xs text-red-600">¿Eliminar?</span>
                            <button onClick={() => handleEliminarGrupo(grupo.grupoId)}
                              className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg hover:bg-red-700 transition">Sí</button>
                            <button onClick={() => setDeletingGrupo(null)}
                              className="text-xs bg-neutral-200 text-neutral-700 px-2 py-1 rounded-lg hover:bg-neutral-300 transition">No</button>
                          </>
                        ) : (
                          editable && (
                            <button onClick={() => setDeletingGrupo(grupo.grupoId)}
                              className="p-1 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition">
                              <Trash2 size={14} />
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Contenido expandido */}
                    {isExpanded && (
                      <div className="p-4 flex flex-col gap-5 border-t border-neutral-100">

                        {/* ── Formulario de cobertura según modalidad ── */}
                        <div>
                          <p className={secTitle}>
                            {esPresencial && 'Cobertura presencial (departamento + ciudad)'}
                            {esPat && 'Cobertura PAT — múltiples departamentos'}
                            {esVirtual && 'Cobertura virtual — múltiples departamentos'}
                            {esHibrida && 'Cobertura presencial e-híbrida'}
                          </p>

                          {/* PRESENCIAL (1): un solo par depto+ciudad */}
                          {esPresencial && (() => {
                            const row = cobPres[grupo.grupoId] ?? { deptoId: null, ciudadId: null, benef: '', rural: 0 }
                            return (
                              <div className="flex flex-col gap-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className={label}>Departamento</label>
                                    <SearchableSelect disabled={!editable} options={deptosCat}
                                      value={row.deptoId} placeholder="— Departamento —" searchPlaceholder="Buscar departamento…"
                                      onChange={deptoId => {
                                        setCobPres(prev => ({ ...prev, [grupo.grupoId]: { ...row, deptoId, ciudadId: null } }))
                                        if (deptoId) loadCiudades(deptoId)
                                      }} />
                                  </div>
                                  <div>
                                    <label className={label}>Ciudad / Municipio</label>
                                    <SearchableSelect disabled={!editable || !row.deptoId} options={ciudadesCat[row.deptoId ?? 0] ?? []}
                                      value={row.ciudadId} placeholder="— Ciudad —" searchPlaceholder="Buscar ciudad / municipio…"
                                      onChange={ciudadId => setCobPres(prev => ({ ...prev, [grupo.grupoId]: { ...row, ciudadId } }))} />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className={label}>Beneficiarios presenciales</label>
                                    <input type="number" min={0} disabled={!editable} className={input}
                                      value={row.benef}
                                      onChange={e => setCobPres(prev => ({ ...prev, [grupo.grupoId]: { ...row, benef: e.target.value } }))}
                                    />
                                    {benefTarget > 0 && (
                                      <p className={`text-xs mt-0.5 ${Number(row.benef) === benefTarget ? 'text-green-600' : 'text-amber-500'}`}>
                                        {Number(row.benef) === benefTarget ? '✓ Igual al total del grupo' : `Esperado: ${benefTarget}`}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })()}

                          {/* PAT (2) / VIRTUAL (4): múltiples filas sólo departamento */}
                          {(esPat || esVirtual) && (() => {
                            const rows = cobVirt[grupo.grupoId] ?? [{ deptoId: null, ciudadId: null, benef: '', rural: 0 }]
                            const total = rows.reduce((s, r) => s + (Number(r.benef) || 0), 0)
                            const target = esPat ? benefTarget : benefViTarget
                            return (
                              <div className="flex flex-col gap-3">
                                {rows.map((row, idx) => {
                                  const usadosEnOtras = new Set(rows.map((r, i) => i !== idx ? r.deptoId : null).filter((d): d is number => d != null))
                                  const optsFiltrados = deptosCat.filter(d => !usadosEnOtras.has(d.id))
                                  return (
                                  <div key={idx} className="flex gap-2 items-end">
                                    <div className="flex-1">
                                      {idx === 0 && <label className={label}>Departamento</label>}
                                      <SearchableSelect disabled={!editable} options={optsFiltrados}
                                        value={row.deptoId} placeholder="— Departamento —" searchPlaceholder="Buscar departamento…"
                                        onChange={deptoId => {
                                          const updated = rows.map((r, i) => i === idx ? { ...r, deptoId } : r)
                                          setCobVirt(prev => ({ ...prev, [grupo.grupoId]: updated }))
                                        }} />
                                    </div>
                                    <div className="w-28">
                                      {idx === 0 && <label className={label}>Beneficiarios</label>}
                                      <input type="number" min={0} disabled={!editable} className={input}
                                        value={row.benef}
                                        onChange={e => {
                                          const updated = rows.map((r, i) => i === idx ? { ...r, benef: e.target.value } : r)
                                          setCobVirt(prev => ({ ...prev, [grupo.grupoId]: updated }))
                                        }}
                                      />
                                    </div>
                                    {editable && rows.length > 1 && (
                                      <button onClick={() => setCobVirt(prev => ({ ...prev, [grupo.grupoId]: rows.filter((_, i) => i !== idx) }))}
                                        className="mb-0.5 p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition">
                                        <X size={13} />
                                      </button>
                                    )}
                                  </div>
                                  )
                                })}
                                {editable && (
                                  <button onClick={() => setCobVirt(prev => ({ ...prev, [grupo.grupoId]: [...rows, { deptoId: null, ciudadId: null, benef: '', rural: 0 }] }))}
                                    className="inline-flex items-center gap-1 text-xs text-[#00304D] hover:underline self-start">
                                    <Plus size={12} /> Agregar departamento
                                  </button>
                                )}
                                {target > 0 && (
                                  <p className={`text-xs font-medium ${total === target ? 'text-green-600' : 'text-amber-600'}`}>
                                    Total: {total} / {target} {total === target ? '✓' : `(faltan ${target - total})`}
                                  </p>
                                )}
                              </div>
                            )
                          })()}

                          {/* HÍBRIDA (3/5/6): presencial + sincrónico */}
                          {esHibrida && (() => {
                            const pRow = cobPres[grupo.grupoId] ?? { deptoId: null, ciudadId: null, benef: '', rural: 0 }
                            const sRows = cobVirt[grupo.grupoId] ?? [{ deptoId: null, ciudadId: null, benef: '', rural: 0 }]
                            const sTotal = sRows.reduce((s, r) => s + (Number(r.benef) || 0), 0)
                            return (
                              <div className="flex flex-col gap-5">
                                {/* Presencial */}
                                <div className="bg-blue-50 rounded-xl p-4 flex flex-col gap-3">
                                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Presencial</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className={label}>Departamento</label>
                                      <SearchableSelect disabled={!editable} options={deptosCat}
                                        value={pRow.deptoId} placeholder="— Departamento —" searchPlaceholder="Buscar departamento…"
                                        onChange={deptoId => {
                                          setCobPres(prev => ({ ...prev, [grupo.grupoId]: { ...pRow, deptoId, ciudadId: null } }))
                                          if (deptoId) loadCiudades(deptoId)
                                        }} />
                                    </div>
                                    <div>
                                      <label className={label}>Ciudad / Municipio</label>
                                      <SearchableSelect disabled={!editable || !pRow.deptoId} options={ciudadesCat[pRow.deptoId ?? 0] ?? []}
                                        value={pRow.ciudadId} placeholder="— Ciudad —" searchPlaceholder="Buscar ciudad / municipio…"
                                        onChange={ciudadId => setCobPres(prev => ({ ...prev, [grupo.grupoId]: { ...pRow, ciudadId } }))} />
                                    </div>
                                  </div>
                                  <div className="w-40">
                                    <label className={label}>Beneficiarios presenciales</label>
                                    <input type="number" min={0} disabled={!editable} className={input}
                                      value={pRow.benef}
                                      onChange={e => setCobPres(prev => ({ ...prev, [grupo.grupoId]: { ...pRow, benef: e.target.value } }))}
                                    />
                                    {benefTarget > 0 && (
                                      <p className={`text-xs mt-0.5 ${Number(pRow.benef) === benefTarget ? 'text-green-600' : 'text-amber-500'}`}>
                                        {Number(pRow.benef) === benefTarget ? '✓' : `Esperado: ${benefTarget}`}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Sincrónico */}
                                <div className="bg-purple-50 rounded-xl p-4 flex flex-col gap-3">
                                  <p className="text-xs font-semibold text-purple-800 uppercase tracking-wide">Sincrónico (virtual)</p>
                                  {sRows.map((row, idx) => {
                                    const usadosEnOtras = new Set(sRows.map((r, i) => i !== idx ? r.deptoId : null).filter((d): d is number => d != null))
                                    const optsFiltrados = deptosCat.filter(d => !usadosEnOtras.has(d.id))
                                    return (
                                    <div key={idx} className="flex gap-2 items-end">
                                      <div className="flex-1">
                                        {idx === 0 && <label className={label}>Departamento</label>}
                                        <SearchableSelect disabled={!editable} options={optsFiltrados}
                                          value={row.deptoId} placeholder="— Departamento —" searchPlaceholder="Buscar departamento…"
                                          onChange={deptoId => {
                                            const updated = sRows.map((r, i) => i === idx ? { ...r, deptoId } : r)
                                            setCobVirt(prev => ({ ...prev, [grupo.grupoId]: updated }))
                                          }} />
                                      </div>
                                      <div className="w-28">
                                        {idx === 0 && <label className={label}>Beneficiarios</label>}
                                        <input type="number" min={0} disabled={!editable} className={input}
                                          value={row.benef}
                                          onChange={e => {
                                            const updated = sRows.map((r, i) => i === idx ? { ...r, benef: e.target.value } : r)
                                            setCobVirt(prev => ({ ...prev, [grupo.grupoId]: updated }))
                                          }}
                                        />
                                      </div>
                                      {editable && sRows.length > 1 && (
                                        <button onClick={() => setCobVirt(prev => ({ ...prev, [grupo.grupoId]: sRows.filter((_, i) => i !== idx) }))}
                                          className="mb-0.5 p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition">
                                          <X size={13} />
                                        </button>
                                      )}
                                    </div>
                                    )
                                  })}
                                  {editable && (
                                    <button onClick={() => setCobVirt(prev => ({ ...prev, [grupo.grupoId]: [...sRows, { deptoId: null, ciudadId: null, benef: '', rural: 0 }] }))}
                                      className="inline-flex items-center gap-1 text-xs text-purple-700 hover:underline self-start">
                                      <Plus size={12} /> Agregar departamento
                                    </button>
                                  )}
                                  {benefViTarget > 0 && (
                                    <p className={`text-xs font-medium ${sTotal === benefViTarget ? 'text-green-600' : 'text-amber-600'}`}>
                                      Total sincrónico: {sTotal} / {benefViTarget} {sTotal === benefViTarget ? '✓' : `(faltan ${benefViTarget - sTotal})`}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          })()}
                        </div>

                        {/* Guardar cobertura */}
                        {editable && (
                          <div className="flex pt-2 border-t border-neutral-100">
                            <button onClick={() => handleSaveCoberturas(grupo.grupoId)} disabled={isSavingC}
                              className="inline-flex items-center gap-2 bg-[#00304D] hover:bg-[#004a76] text-white px-5 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-60">
                              {isSavingC ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                              {isSavingC ? 'Guardando…' : 'Guardar cobertura'}
                            </button>
                          </div>
                        )}

                        {/* Justificación de la cobertura del grupo (después de las coberturas) */}
                        <div className="pt-4 border-t border-neutral-100">
                          <label className={label}>Justificación de la cobertura del grupo</label>
                          <textarea
                            disabled={!editable}
                            rows={3}
                            maxLength={3000}
                            className={textarea}
                            value={grupoJust[grupo.grupoId] ?? ''}
                            onChange={e => setGrupoJust(prev => ({ ...prev, [grupo.grupoId]: e.target.value }))}
                            placeholder="Describa la justificación de la cobertura para este grupo…"
                          />
                          <p className="text-xs text-neutral-400 text-right mt-0.5">{(grupoJust[grupo.grupoId] ?? '').length}/3000</p>
                          {editable && (
                            <div className="flex mt-2">
                              <button onClick={() => handleSaveJustificacion(grupo.grupoId)} disabled={isSavingJ}
                                className="inline-flex items-center gap-2 bg-neutral-700 hover:bg-neutral-800 text-white px-4 py-1.5 rounded-xl text-xs font-semibold transition disabled:opacity-60">
                                {isSavingJ ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                {isSavingJ ? 'Guardando…' : 'Guardar justificación'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Agregar grupo */}
              {editable && (
                <div className="flex">
                  <button onClick={handleCrearGrupo} disabled={creatingGrupo || grupos.length >= (af.numGrupos ?? 20)}
                    className="inline-flex items-center gap-2 border-2 border-dashed border-[#00304D]/40 hover:border-[#00304D] text-[#00304D] hover:bg-[#00304D]/5 px-5 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">
                    {creatingGrupo ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    {creatingGrupo ? 'Creando…' : 'Agregar grupo'}
                  </button>
                  {grupos.length >= (af.numGrupos ?? 20) && (
                    <span className="ml-3 self-center text-xs text-amber-600">Límite de {af.numGrupos} grupos alcanzado</span>
                  )}
                </div>
              )}

              {grupos.length === 0 && (
                <p className="text-sm text-neutral-400 text-center py-4">No hay grupos registrados. Agregue el primer grupo para registrar la cobertura.</p>
              )}

            </div>
          </div>
        )
      })()}

      {/* ════════════════════════════════════════════════════════════════════
          Card 9 — Material de Formación
      ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100">
          <div className="w-8 h-8 rounded-xl bg-[#00304D] flex items-center justify-center">
            <Layers size={16} className="text-white" />
          </div>
          <h2 className="text-base font-bold text-neutral-800">Material de Formación</h2>
        </div>

        <div className="p-6 flex flex-col gap-5">

          {/* Tipo de ambiente + Gestión + Material */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={label}>Tipo de Ambiente de Aprendizaje</label>
              <select disabled={!editable} className={select}
                value={matForm.tipoAmbienteId}
                onChange={e => setMatForm(f => ({ ...f, tipoAmbienteId: e.target.value }))}>
                <option value="">— Seleccione —</option>
                {tiposAmbienteCat.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Gestión del Conocimiento</label>
              <select disabled={!editable} className={select}
                value={matForm.gestionConocimientoId}
                onChange={e => setMatForm(f => ({ ...f, gestionConocimientoId: e.target.value }))}>
                <option value="">— Seleccione —</option>
                {gestionCat.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Material de Formación</label>
              <select disabled={!editable} className={select}
                value={matForm.materialFormacionId}
                onChange={e => setMatForm(f => ({ ...f, materialFormacionId: e.target.value }))}>
                <option value="">— Seleccione —</option>
                {materialCat.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Recursos Didácticos */}
          <div>
            <p className={secTitle}>Recursos Didácticos</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {(materialData?.recursos ?? []).map(r => (
                <span key={r.rdafId}
                  className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-full">
                  {r.nombre}
                  {editable && (
                    <button onClick={() => handleEliminarRecurso(r.rdafId)} className="text-blue-300 hover:text-red-500 transition"><X size={11} /></button>
                  )}
                </span>
              ))}
              {(materialData?.recursos ?? []).length === 0 && (
                <span className="text-xs text-neutral-400">Sin recursos registrados</span>
              )}
            </div>
            {editable && (
              <div className="flex gap-2 items-end">
                <div className="flex-1 max-w-sm">
                  <select value={recursoSelId} onChange={e => setRecursoSelId(e.target.value)} className={select}>
                    <option value="">— Seleccione recurso —</option>
                    {recursosCat
                      .filter(r => !(materialData?.recursos ?? []).some(x => x.recursoId === r.id))
                      .map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>
                <button onClick={handleAgregarRecurso} disabled={addingRecurso || !recursoSelId}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl hover:bg-[#004a76] disabled:opacity-50 transition">
                  {addingRecurso ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Agregar
                </button>
              </div>
            )}
          </div>

          {/* Justificación material */}
          <div>
            <label className={label}>Justificación del tipo de material de formación y recursos didácticos (si aplica)</label>
            <p className="text-[10px] text-neutral-400 mb-1">Máx. 3000 caracteres</p>
            <textarea disabled={!editable} rows={4} maxLength={3000} className={textarea}
              value={matForm.justMat}
              onChange={e => setMatForm(f => ({ ...f, justMat: e.target.value }))}
              placeholder="Justifique el material seleccionado…" />
            <p className="text-xs text-neutral-400 text-right mt-0.5">{(matForm.justMat ?? '').length}/3000</p>
          </div>

          {/* Insumos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Insumos y/o equipos especializados (solo si aplica)</label>
              <p className="text-[10px] text-neutral-400 mb-1">Máx. 3000 caracteres</p>
              <textarea disabled={!editable} rows={4} maxLength={3000} className={textarea}
                value={matForm.insumo}
                onChange={e => setMatForm(f => ({ ...f, insumo: e.target.value }))}
                placeholder="Describa los insumos o equipos requeridos…" />
              <p className="text-xs text-neutral-400 text-right mt-0.5">{(matForm.insumo ?? '').length}/3000</p>
            </div>
            <div>
              <label className={label}>Justificación del insumo y/o equipos especializados (solo si aplica)</label>
              <p className="text-[10px] text-neutral-400 mb-1">Máx. 3000 caracteres</p>
              <textarea disabled={!editable} rows={4} maxLength={3000} className={textarea}
                value={matForm.justInsumo}
                onChange={e => setMatForm(f => ({ ...f, justInsumo: e.target.value }))}
                placeholder="Justifique los insumos o equipos descritos…" />
              <p className="text-xs text-neutral-400 text-right mt-0.5">{(matForm.justInsumo ?? '').length}/3000</p>
            </div>
          </div>

          {/* Guardar */}
          {editable && (
            <div className="flex pt-1 border-t border-neutral-100">
              <button onClick={handleGuardarMaterial} disabled={savingMat}
                className="inline-flex items-center gap-2 bg-[#00304D] hover:bg-[#004a76] text-white px-6 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-60">
                {savingMat ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {savingMat ? 'Guardando…' : 'Guardar Material de Formación'}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Navegación a Rubros */}
      <div className="flex justify-between items-center pt-2 pb-6">
        <button onClick={() => document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-[#00304D] text-xs font-semibold rounded-xl hover:bg-neutral-50 transition">
          <ChevronUp size={14} /> Volver arriba
        </button>
        <Link href={`/panel/proyectos/${proyectoId}/acciones/${afIdNum}/rubros`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00304D] hover:bg-[#004a76] text-white text-xs font-semibold rounded-xl transition">
          <BookOpen size={14} /> Ir a Rubros
        </Link>
      </div>

    </div>
  )
}
