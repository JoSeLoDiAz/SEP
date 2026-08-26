'use client'

import api from '@/lib/api'
import { abrirArchivo, descargarArchivoConNombreDelServidor } from '@/lib/descargar-archivo'
import { aTitleCase } from '@/lib/title-case'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ReglasDelCiclo } from '@/components/evaluadores/reglas-convocatoria'
import {
  ArrowLeft, Award, CalendarDays, ChevronRight, Download, Eye, FileText, Loader2, Megaphone,
  Network, Paperclip, Pencil, PowerOff, Save, ShieldCheck, Trash2, Upload, UserCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { fmtFecha } from '@/lib/format-date'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

interface Convocatoria {
  id: number
  anio: number
  periodo: string | null
  nombre: string
  modalidadPart: string | null
  fechaInicio: string | null
  fechaFin: string | null
  observaciones: string | null
  activo: boolean
  puntajeMinimoPrueba: number | null
  calificacionMinimaCurso: number | null
  certificadoTexto: string | null
  certificadoFirmaId: number | null
  certificadoHabilitado: boolean
  convocatoriaSepId: number | null
  convocatoriaSepNombre: string | null
  convocatoriaSepAnio: number | null
}

type TabId = 'datos' | 'reglas' | 'documentos'
interface Tab {
  id: TabId
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}
const TABS: Tab[] = [
  { id: 'datos',      label: 'Datos',            icon: UserCircle2 },
  { id: 'reglas',     label: 'Reglas y certificados', icon: Award },
  { id: 'documentos', label: 'Documentos',       icon: Paperclip },
]

const MODALIDADES = ['PRESENCIAL', 'PAT', 'VIRTUAL', 'MIXTA'] as const
const PERIODOS = ['01', '02'] as const

type Toast = { tipo: 'success' | 'error'; msg: string }
type SetToast = (t: Toast | null) => void

function manejarError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
}

export default function FichaConvocatoriaPage() {
  const params = useParams<{ cid: string }>()
  const cid = Number(params.cid)

  const [conv, setConv] = useState<Convocatoria | null>(null)
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState('')
  const [tab, setTab] = useState<TabId>('datos')
  const [toast, setToast] = useState<Toast | null>(null)
  const [confirmDesactivar, setConfirmDesactivar] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

  const cargar = async () => {
    setLoading(true)
    setErrMsg('')
    try {
      const res = await api.get<Convocatoria>(`/evaluadores/convocatorias/${cid}`)
      setConv(res.data)
    } catch (err: unknown) {
      setErrMsg(manejarError(err, 'Error cargando la convocatoria'))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { cargar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function toggleEstado(activar: boolean) {
    setCambiandoEstado(true)
    try {
      await api.put(`/evaluadores/convocatorias/${cid}/estado`, { activo: activar })
      setToast({ tipo: 'success', msg: activar ? 'Convocatoria activada' : 'Convocatoria desactivada' })
      setConfirmDesactivar(false)
      await cargar()
    } catch (err: unknown) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo cambiar el estado') })
    } finally {
      setCambiandoEstado(false)
    }
  }

  if (loading) {
    return (
      <div className="p-10 flex items-center gap-2 text-neutral-500 text-sm">
        <Loader2 size={14} className="animate-spin" />
        Cargando convocatoria...
      </div>
    )
  }
  if (errMsg || !conv) {
    return <div className="p-10 text-red-700 bg-red-50 border border-red-200 rounded-xl m-6">{errMsg || 'No se encontró la convocatoria'}</div>
  }

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa show onClose={() => setToast(null)} tipo={toast.tipo} titulo={toast.tipo === 'success' ? 'Listo' : 'Error'} mensaje={toast.msg} duration={3500} />
      )}

      <div className="relative overflow-hidden rounded-3xl shadow-lg" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #001f33 70%, #000a14 100%)` }}>
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        <div className="relative px-6 sm:px-8 py-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur-sm shrink-0 flex items-center justify-center">
            <Megaphone size={40} className="text-white/90" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-white/70 text-xs flex-wrap">
              <Link href="/panel/evaluadores" className="hover:text-white">Banco de Evaluadores</Link>
              <ChevronRight size={12} />
              <Link href="/panel/evaluadores/convocatorias" className="hover:text-white">Convocatorias</Link>
              <ChevronRight size={12} />
              <span>Ficha</span>
            </div>
            <h1 className="text-white font-bold text-xl sm:text-2xl mt-1 leading-tight">{conv.nombre}</h1>
            <p className="text-white/80 text-sm mt-0.5">
              Año {conv.anio}{conv.periodo ? ` · Período ${conv.periodo}` : ''}{conv.modalidadPart ? ` · ${conv.modalidadPart}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                conv.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-700'
              }`}>
                {conv.activo ? 'Activa' : 'Inactiva'}
              </span>
              {conv.convocatoriaSepNombre ? (
                <span className="inline-flex items-center gap-1 rounded bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/90">
                  SEP · {conv.convocatoriaSepNombre}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  Sin convocatoria del SEP
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0">
            {conv.activo ? (
              <button
                onClick={() => setConfirmDesactivar(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold rounded-xl backdrop-blur-sm transition"
              >
                <PowerOff size={13} />
                Desactivar
              </button>
            ) : (
              <button
                onClick={() => toggleEstado(true)}
                disabled={cambiandoEstado}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-[#00304D] hover:bg-white/95 text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50"
              >
                {cambiandoEstado ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                Activar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/panel/evaluadores/convocatorias" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D] w-fit">
          <ArrowLeft size={13} />
          Volver al listado
        </Link>

        <Link
          href={`/panel/evaluadores/convocatorias/${cid}/matriz`}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: PRIMARY }}
        >
          <Network size={13} />
          Retroalimentación del ciclo
          <ChevronRight size={13} />
        </Link>
      </div>

      <div className="flex gap-1 overflow-x-auto bg-white border border-neutral-200 rounded-2xl p-1.5 shadow-sm">
        {TABS.map(t => {
          const Icon = t.icon
          const activo = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activo ? 'text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
              style={activo ? { backgroundColor: PRIMARY } : undefined}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'datos'      && <SeccionDatos      conv={conv} onChanged={cargar} setToast={setToast} />}
      {tab === 'reglas' && (
        <ReglasDelCiclo
          convocatoriaId={cid}
          reglas={{
            puntajeMinimoPrueba: conv.puntajeMinimoPrueba,
            calificacionMinimaCurso: conv.calificacionMinimaCurso,
            certificadoTexto: conv.certificadoTexto,
            certificadoFirmaId: conv.certificadoFirmaId,
            certificadoHabilitado: conv.certificadoHabilitado,
          }}
          onChanged={cargar}
          setToast={setToast}
        />
      )}

      {tab === 'documentos' && <SeccionDocumentosConvocatoria convocatoriaId={cid} setToast={setToast} />}

      <ConfirmModal
        open={confirmDesactivar}
        onClose={() => setConfirmDesactivar(false)}
        onConfirm={() => toggleEstado(false)}
        tipo="warning"
        titulo="Desactivar convocatoria"
        mensaje={<>La convocatoria <strong>{conv.nombre}</strong> dejará de aparecer en el listado activo.</>}
        textoConfirmar="Desactivar"
        cargando={cambiandoEstado}
      />
    </div>
  )
}

function Section({ titulo, children, accion }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-neutral-900">{titulo}</p>
        {accion}
      </header>
      <div>{children}</div>
    </section>
  )
}

function Dato({ label, valor, multiline }: { label: string; valor: string | number | null | undefined; multiline?: boolean }) {
  const v = valor === undefined || valor === null || valor === '' ? '—' : String(valor)
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`text-sm text-neutral-800 ${multiline ? 'whitespace-pre-line' : 'truncate'}`}>{v}</p>
    </div>
  )
}

function SeccionDatos({ conv, onChanged, setToast }: { conv: Convocatoria; onChanged: () => void; setToast: SetToast }) {
  const currentYear = new Date().getFullYear()
  const anioMin = 2020
  const anioMax = currentYear + 2

  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const [anio, setAnio] = useState(String(conv.anio))
  const [periodo, setPeriodo] = useState(conv.periodo ?? '')
  const [nombre, setNombre] = useState(conv.nombre)
  const [modalidad, setModalidad] = useState(conv.modalidadPart ?? '')
  const [fechaInicio, setFechaInicio] = useState(conv.fechaInicio ? conv.fechaInicio.substring(0, 10) : '')
  const [fechaFin, setFechaFin] = useState(conv.fechaFin ? conv.fechaFin.substring(0, 10) : '')
  const [observaciones, setObservaciones] = useState(conv.observaciones ?? '')
  const [convSepId, setConvSepId] = useState(conv.convocatoriaSepId?.toString() ?? '')
  const [convsSep, setConvsSep] = useState<Array<{ id: number; nombre: string; anio: number }>>([])

  useEffect(() => {
    let vivo = true
    api.get<Array<{ id: number; nombre: string; anio: number }>>(
      '/evaluadores/catalogos/convocatorias-sep')
      .then(r => { if (vivo) setConvsSep(r.data) })
      .catch(() => { if (vivo) setConvsSep([]) })
    return () => { vivo = false }
  }, [])

  function iniciarEdicion() {
    setAnio(String(conv.anio))
    setPeriodo(conv.periodo ?? '')
    setNombre(conv.nombre)
    setModalidad(conv.modalidadPart ?? '')
    setFechaInicio(conv.fechaInicio ? conv.fechaInicio.substring(0, 10) : '')
    setFechaFin(conv.fechaFin ? conv.fechaFin.substring(0, 10) : '')
    setObservaciones(conv.observaciones ?? '')
    setConvSepId(conv.convocatoriaSepId?.toString() ?? '')
    setEditando(true)
  }

  async function guardar() {
    const anioNum = Number(anio)
    if (!Number.isFinite(anioNum) || anioNum < anioMin || anioNum > anioMax) {
      return setToast({ tipo: 'error', msg: `El año debe estar entre ${anioMin} y ${anioMax}` })
    }
    if (!nombre.trim()) {
      return setToast({ tipo: 'error', msg: 'El nombre es obligatorio' })
    }
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      return setToast({ tipo: 'error', msg: 'La fecha de fin no puede ser anterior a la fecha de inicio' })
    }

    setGuardando(true)
    try {
      await api.put(`/evaluadores/convocatorias/${conv.id}`, {
        anio: anioNum,
        periodo: periodo || null,
        nombre: nombre.trim(),
        modalidadPart: modalidad || null,
        fechaInicio: fechaInicio || null,
        fechaFin: fechaFin || null,
        observaciones: observaciones.trim() || null,
        convocatoriaSepId: convSepId ? Number(convSepId) : null,
      })
      setToast({ tipo: 'success', msg: 'Datos actualizados' })
      setEditando(false)
      onChanged()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo guardar') })
    } finally {
      setGuardando(false)
    }
  }

  const label = 'block text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
  const input = 'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40'
  const textarea = `${input} resize-y`

  if (!editando) {
    return (
      <Section titulo="Datos de la convocatoria" accion={
        <button onClick={iniciarEdicion} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-[#00304D]/10 text-neutral-700 hover:text-[#00304D] text-xs font-semibold rounded-lg transition">
          <Pencil size={12} />
          Editar
        </button>
      }>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div className="sm:col-span-2">
            <Dato
              label="Convocatoria del SEP"
              valor={conv.convocatoriaSepNombre
                ? `${conv.convocatoriaSepNombre} (${conv.convocatoriaSepAnio})`
                : null}
            />
          </div>
          <Dato label="Año" valor={conv.anio} />
          <Dato label="Período" valor={conv.periodo} />
          <Dato label="Modalidad" valor={conv.modalidadPart} />
          <Dato label="Fecha de inicio" valor={conv.fechaInicio ? fmtFecha(conv.fechaInicio) : null} />
          <Dato label="Fecha de fin" valor={conv.fechaFin ? fmtFecha(conv.fechaFin) : null} />
          <div />
          <div className="sm:col-span-2">
            <Dato label="Observaciones" valor={conv.observaciones} multiline />
          </div>
        </div>
      </Section>
    )
  }

  return (
    <Section titulo="Editar datos de la convocatoria">
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={label}>Convocatoria del SEP</label>
          <select
            value={convSepId}
            onChange={e => {
              setConvSepId(e.target.value)
              const c = convsSep.find(x => String(x.id) === e.target.value)
              // el backend rechaza el año si no cuadra con la convocatoria del SEP
              if (c) setAnio(String(c.anio))
            }}
            className={input}
          >
            <option value="">— Sin convocatoria del SEP —</option>
            {convsSep.map(c => (
              <option key={c.id} value={c.id}>{c.nombre} ({c.anio})</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Año *</label>
          <input
            type="number"
            min={anioMin}
            max={anioMax}
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Período</label>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={input}>
            <option value="">— Sin período —</option>
            {PERIODOS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Nombre *</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => setNombre(v => aTitleCase(v) ?? '')}
            maxLength={200}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Modalidad</label>
          <select value={modalidad} onChange={(e) => setModalidad(e.target.value)} className={input}>
            <option value="">— Sin modalidad —</option>
            {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div />
        <div>
          <label className={label}>Fecha de inicio</label>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={input} />
        </div>
        <div>
          <label className={label}>Fecha de fin</label>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={4}
            maxLength={1000}
            className={textarea}
          />
        </div>
        <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
          <button
            onClick={() => setEditando(false)}
            disabled={guardando}
            className="px-4 py-2 border border-neutral-300 text-neutral-700 text-sm font-semibold rounded-lg hover:bg-neutral-50 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90"
            style={{ backgroundColor: INSTITUTIONAL }}
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar cambios
          </button>
        </div>
      </div>
    </Section>
  )
}

interface DocumentoConvocatoria {
  documentoId: number
  convocatoriaId: number
  tipoDocumentoConvId: number
  tipoCodigo: string
  tipoNombre: string
  descripcion: string | null
  archivoNombre: string | null
  mime: string | null
  fechaCargue: string
}

interface TipoDocConvCat {
  id: number
  codigo: string
  nombre: string
  extensiones?: string[]
  admiteMultiple?: boolean
  orden?: number
  activo?: boolean
}

// Tailwind JIT solo compila clases literales del source: por eso el hover va escrito aquí
const DOC_CHIP_COLORS: Record<string, { bg: string; text: string; border: string; hoverBg: string }> = {
  INVITACION:         { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   hoverBg: 'hover:bg-blue-100'   },
  RATIFICACION:       { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', hoverBg: 'hover:bg-purple-100' },
  LISTADO_ASISTENCIA_PRESENCIAL: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', hoverBg: 'hover:bg-cyan-100' },
  LISTADO_ASISTENCIA_PAT:        { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', hoverBg: 'hover:bg-teal-100' },
  EXCEL_SELECCION:    { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  hoverBg: 'hover:bg-amber-100'  },
}
const DOC_CHIP_FALLBACK = { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200', hoverBg: 'hover:bg-neutral-200' }

function chipColor(codigo: string) {
  return DOC_CHIP_COLORS[codigo] ?? DOC_CHIP_FALLBACK
}

// para armar el accept del input file
const EXT_TO_MIME: Record<string, string> = {
  pdf:  'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:  'application/vnd.ms-excel',
  msg:  'application/vnd.ms-outlook',
}

function extensionesAAccept(exts: string[] | undefined): string {
  if (!exts || exts.length === 0) return ''
  const partes: string[] = []
  for (const ext of exts) {
    const key = ext.replace(/^\./, '').toLowerCase()
    if (EXT_TO_MIME[key]) partes.push(EXT_TO_MIME[key])
    partes.push(`.${key}`)
  }
  return Array.from(new Set(partes)).join(',')
}

function SeccionDocumentosConvocatoria({ convocatoriaId, setToast }: { convocatoriaId: number; setToast: SetToast }) {
  const [items, setItems] = useState<DocumentoConvocatoria[]>([])
  const [tipos, setTipos] = useState<TipoDocConvCat[]>([])
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<number | null>(null)
  const [formAbierto, setFormAbierto] = useState(false)
  const [filtroCodigo, setFiltroCodigo] = useState<string>('__TODOS__')

  // form state
  const [tipoSel, setTipoSel] = useState<string>('')
  const [descripcion, setDescripcion] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function cargar() {
    setLoading(true)
    try {
      const [rDocs, rTipos] = await Promise.all([
        api.get<DocumentoConvocatoria[]>(`/evaluadores/convocatorias/${convocatoriaId}/documentos`),
        api.get<TipoDocConvCat[]>(`/evaluadores/catalogos/tipos-documento-convocatoria`, { params: { soloActivos: true } }),
      ])
      setItems(rDocs.data ?? [])
      setTipos(rTipos.data ?? [])
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudieron cargar los documentos') })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { cargar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [convocatoriaId])

  const tipoSeleccionado = tipos.find(t => String(t.id) === tipoSel)
  const acceptFile = extensionesAAccept(tipoSeleccionado?.extensiones)

  function resetForm() {
    setTipoSel('')
    setDescripcion('')
    setArchivo(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function cerrarForm() {
    setFormAbierto(false)
    resetForm()
  }

  async function subir() {
    if (!tipoSel) {
      setToast({ tipo: 'error', msg: 'Selecciona el tipo de documento' })
      return
    }
    if (!archivo) {
      setToast({ tipo: 'error', msg: 'Adjunta un archivo' })
      return
    }
    if (archivo.size > 8 * 1024 * 1024) {
      setToast({ tipo: 'error', msg: 'El archivo supera los 8 MB' })
      return
    }
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      fd.append('tipoDocumentoConvId', tipoSel)
      if (descripcion.trim()) fd.append('descripcion', descripcion.trim().slice(0, 300))
      await api.post(`/evaluadores/convocatorias/${convocatoriaId}/documentos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setToast({ tipo: 'success', msg: 'Documento subido' })
      cerrarForm()
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo subir el documento') })
    } finally {
      setSubiendo(false)
    }
  }

  async function eliminar(docId: number) {
    setEliminandoId(docId)
    try {
      await api.delete(`/evaluadores/convocatorias/documentos/${docId}`)
      setToast({ tipo: 'success', msg: 'Documento eliminado' })
      setConfirmDelId(null)
      await cargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: manejarError(err, 'No se pudo eliminar el documento') })
    } finally {
      setEliminandoId(null)
    }
  }

  const label = 'block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
  const input = 'w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40'

  const conteoPorTipo: Record<string, number> = {}
  items.forEach(d => { conteoPorTipo[d.tipoCodigo] = (conteoPorTipo[d.tipoCodigo] ?? 0) + 1 })

  const itemsFiltrados = filtroCodigo === '__TODOS__'
    ? items
    : items.filter(d => d.tipoCodigo === filtroCodigo)

  const docAEliminar = confirmDelId != null ? items.find(d => d.documentoId === confirmDelId) : null

  return (
    <Section
      titulo={`Documentos institucionales (${items.length})`}
      accion={
        <button
          onClick={() => { if (formAbierto) cerrarForm(); else setFormAbierto(true) }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition hover:opacity-90"
          style={{ backgroundColor: PRIMARY }}
        >
          <Upload size={12} />
          {formAbierto ? 'Cerrar' : '+ Agregar documento'}
        </button>
      }
    >
      <div className="px-5 py-3 border-b border-neutral-100 flex flex-wrap gap-1.5 bg-neutral-50/40">
        <button
          onClick={() => setFiltroCodigo('__TODOS__')}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition border ${
            filtroCodigo === '__TODOS__'
              ? 'text-white border-transparent'
              : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
          }`}
          style={filtroCodigo === '__TODOS__' ? { backgroundColor: PRIMARY } : undefined}
        >
          Todos
          <span className={`px-1.5 py-px rounded-full text-[10px] ${filtroCodigo === '__TODOS__' ? 'bg-white/25' : 'bg-neutral-100'}`}>
            {items.length}
          </span>
        </button>
        {tipos.map(t => {
          const activo = filtroCodigo === t.codigo
          const c = chipColor(t.codigo)
          return (
            <button
              key={t.id}
              onClick={() => setFiltroCodigo(t.codigo)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition border ${
                activo
                  ? 'text-white border-transparent'
                  : `bg-white text-neutral-600 border-neutral-200 ${c.hoverBg}`
              }`}
              style={activo ? { backgroundColor: PRIMARY } : undefined}
              title={t.nombre}
            >
              {t.nombre}
              <span className={`px-1.5 py-px rounded-full text-[10px] ${activo ? 'bg-white/25' : 'bg-neutral-100'}`}>
                {conteoPorTipo[t.codigo] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      {formAbierto && (
        <div className="px-5 py-4 bg-neutral-50/60 border-b border-neutral-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={label}>Tipo de documento *</label>
            <select
              value={tipoSel}
              onChange={(e) => { setTipoSel(e.target.value); setArchivo(null); if (fileRef.current) fileRef.current.value = '' }}
              className={input}
            >
              <option value="">— Selecciona un tipo —</option>
              {tipos.map(t => (
                <option key={t.id} value={String(t.id)}>{t.nombre}</option>
              ))}
            </select>
            {tipoSeleccionado?.extensiones && tipoSeleccionado.extensiones.length > 0 && (
              <p className="mt-1 text-[10px] text-neutral-500">
                Extensiones aceptadas: <span className="font-mono font-semibold">{tipoSeleccionado.extensiones.map(e => `.${e.replace(/^\./, '')}`).join(', ')}</span>
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Descripción (opcional)</label>
            <input
              type="text"
              maxLength={300}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Contexto o notas del documento"
              className={input}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Archivo * (máximo 8 MB)</label>
            <input
              ref={fileRef}
              type="file"
              accept={acceptFile || undefined}
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200"
            />
            {archivo && (
              <p className="mt-1 text-[11px] text-neutral-500 truncate">
                {archivo.name} · {(archivo.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            )}
          </div>
          <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-1">
            <button
              onClick={cerrarForm}
              disabled={subiendo}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={subir}
              disabled={subiendo}
              className="inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90"
              style={{ backgroundColor: INSTITUTIONAL }}
            >
              {subiendo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Subir documento
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="px-5 py-6 text-sm text-neutral-500 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Cargando documentos...
        </p>
      ) : items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-neutral-400">Sin documentos aún</p>
      ) : itemsFiltrados.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-neutral-400">
          No hay documentos de este tipo
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {itemsFiltrados.map(d => {
            const c = chipColor(d.tipoCodigo)
            return (
              <li key={d.documentoId} className="px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#00304D]/5 text-[#00304D] flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${c.bg} ${c.text} ${c.border}`}>
                      {d.tipoNombre}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
                      <CalendarDays size={11} />
                      {fmtFecha(d.fechaCargue)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-neutral-800 mt-1 truncate">
                    {d.archivoNombre ?? 'documento'}
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                    {d.descripcion ?? '—'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <button
                    onClick={() => abrirArchivo(`/evaluadores/convocatorias/documentos/${d.documentoId}/archivo`).catch(() => {
                      setToast({ tipo: 'error', msg: 'No se pudo abrir el documento' })
                    })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition hover:opacity-90"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    <Eye size={13} />
                    Ver
                  </button>
                  <button
                    onClick={() => descargarArchivoConNombreDelServidor(
                      `/evaluadores/convocatorias/documentos/${d.documentoId}/descargar`,
                      d.archivoNombre ?? `documento_${d.documentoId}`,
                    ).catch(() => {
                      setToast({ tipo: 'error', msg: 'No se pudo descargar el documento' })
                    })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg transition"
                  >
                    <Download size={13} />
                    Descargar
                  </button>
                  <button
                    onClick={() => setConfirmDelId(d.documentoId)}
                    disabled={eliminandoId === d.documentoId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-red-100 text-neutral-700 hover:text-red-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                  >
                    {eliminandoId === d.documentoId ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Eliminar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmModal
        open={confirmDelId != null}
        onClose={() => setConfirmDelId(null)}
        onConfirm={() => confirmDelId != null && eliminar(confirmDelId)}
        tipo="delete"
        titulo="Eliminar documento"
        mensaje={
          <>
            ¿Seguro que deseas eliminar el documento{' '}
            <strong>{docAEliminar?.archivoNombre ?? ''}</strong>? Esta acción no se puede deshacer.
          </>
        }
        textoConfirmar="Eliminar"
        cargando={eliminandoId != null}
      />
    </Section>
  )
}
