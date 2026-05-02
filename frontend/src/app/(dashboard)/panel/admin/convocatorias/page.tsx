'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { fmtDateTime } from '@/lib/format-date'
import {
  CalendarDays, CheckCircle2, ChevronLeft, Edit3, Eye, EyeOff,
  Loader2, Lock, LockOpen, Megaphone, Pencil,
  Plus, Search, ShieldCheck, Sparkles, XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Convocatoria {
  id: number
  nombre: string
  anio: number
  fechaInicio: string | null
  fechaCierre: string | null
  fechaRegistro: string | null
  presupuestoTotal: number
  presupuestoMaximo: number
  mesesProyecto: number
  tipoFinanciacion: string
  estadoEtiqueta: string
  estado: number               // 1 abierta, 0 cerrada
  ocultar: number              // 0/1
  resultadosPublicados: number // 0/1
  programaId: number
  totalProyectos: number
  sinConfirmar: number
  confirmados: number
  aprobados: number
  rechazados: number
}

interface FormConvocatoria {
  nombre: string
  anio: string
  presupuestoTotal: string
  presupuestoMaximo: string
  mesesProyecto: string
  tipoFinanciacion: 'ABIERTO' | 'COFINANCIACIÓN'
  fechaInicio: string
  fechaCierre: string
  programaId: string
}

const TITLE_COLOR = '#00304D'

const FORM_DEFAULTS: FormConvocatoria = {
  nombre: '',
  anio: String(new Date().getFullYear()),
  presupuestoTotal: '',
  presupuestoMaximo: '',
  mesesProyecto: '5',
  tipoFinanciacion: 'ABIERTO',
  fechaInicio: '',
  fechaCierre: '',
  programaId: '21',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCop(v: number) {
  if (!Number.isFinite(v)) return '$0'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}

function fmtFecha(d: string | null) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return '—' }
}

function toIsoDate(v: string) {
  // input type="date" devuelve "YYYY-MM-DD"; lo convertimos a ISO con hora 12:00 local
  if (!v) return null
  return `${v}T12:00:00`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConvocatoriasAdminPage() {
  const [data, setData] = useState<Convocatoria[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  // Toast
  const toastKey = useRef(0)
  const [toastK2, setToastK2] = useState(0)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error' | 'warning'; titulo: string; msg: string } | null>(null)
  function showToast(tipo: 'success' | 'error' | 'warning', titulo: string, msg: string) {
    toastKey.current++
    setToast({ tipo, titulo, msg })
    setToastK2(toastKey.current)
  }

  // Modales
  const [crearOpen, setCrearOpen] = useState(false)
  const [creando, setCreando] = useState(false)
  const [formCrear, setFormCrear] = useState<FormConvocatoria>(FORM_DEFAULTS)

  const [editarOpen, setEditarOpen] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [formEditar, setFormEditar] = useState<FormConvocatoria>(FORM_DEFAULTS)

  // Confirm: cambio de estado / ocultar / publicar
  const [accionOpen, setAccionOpen] = useState(false)
  const [accion, setAccion] = useState<null | {
    tipo: 'cerrar' | 'abrir' | 'ocultar' | 'mostrar' | 'publicar' | 'despublicar'
    convocatoria: Convocatoria
  }>(null)
  const [ejecutando, setEjecutando] = useState(false)

  // ── Cargar ────────────────────────────────────────────────────────────────

  async function cargar() {
    try {
      setLoading(true); setError(false)
      const r = await api.get<Convocatoria[]>('/proyectos/admin/convocatorias')
      setData(r.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    document.title = 'Gestión de Convocatorias | SEP'
    cargar()
  }, [])

  // ── Crear ─────────────────────────────────────────────────────────────────

  function abrirCrear() {
    setFormCrear(FORM_DEFAULTS)
    setCrearOpen(true)
  }
  async function handleCrear() {
    try {
      setCreando(true)
      await api.post('/proyectos/admin/convocatorias', {
        nombre: formCrear.nombre.trim(),
        anio: Number(formCrear.anio),
        presupuestoTotal: Number(formCrear.presupuestoTotal),
        presupuestoMaximo: Number(formCrear.presupuestoMaximo),
        mesesProyecto: Number(formCrear.mesesProyecto),
        tipoFinanciacion: formCrear.tipoFinanciacion,
        fechaInicio: toIsoDate(formCrear.fechaInicio),
        fechaCierre: toIsoDate(formCrear.fechaCierre),
        programaId: Number(formCrear.programaId) || 21,
      })
      showToast('success', 'Convocatoria creada', 'La nueva convocatoria ya aparece en el listado.')
      setCrearOpen(false)
      cargar()
    } catch (e: any) {
      showToast('error', 'No se pudo crear', e?.response?.data?.message ?? 'Error inesperado.')
    } finally { setCreando(false) }
  }

  // ── Editar ────────────────────────────────────────────────────────────────

  function abrirEditar(cv: Convocatoria) {
    setEditandoId(cv.id)
    setFormEditar({
      nombre: cv.nombre,
      anio: String(cv.anio),
      presupuestoTotal: String(cv.presupuestoTotal ?? ''),
      presupuestoMaximo: String(cv.presupuestoMaximo ?? ''),
      mesesProyecto: String(cv.mesesProyecto ?? ''),
      tipoFinanciacion: (cv.tipoFinanciacion === 'ABIERTO' ? 'ABIERTO' : 'COFINANCIACIÓN'),
      fechaInicio: cv.fechaInicio ? cv.fechaInicio.slice(0, 10) : '',
      fechaCierre: cv.fechaCierre ? cv.fechaCierre.slice(0, 10) : '',
      programaId: String(cv.programaId ?? '21'),
    })
    setEditarOpen(true)
  }
  async function handleEditar() {
    if (editandoId == null) return
    try {
      setGuardando(true)
      await api.put(`/proyectos/admin/convocatorias/${editandoId}`, {
        nombre: formEditar.nombre.trim(),
        anio: Number(formEditar.anio),
        presupuestoTotal: Number(formEditar.presupuestoTotal),
        presupuestoMaximo: Number(formEditar.presupuestoMaximo),
        mesesProyecto: Number(formEditar.mesesProyecto),
        tipoFinanciacion: formEditar.tipoFinanciacion,
        fechaInicio: toIsoDate(formEditar.fechaInicio),
        fechaCierre: toIsoDate(formEditar.fechaCierre),
      })
      showToast('success', 'Convocatoria actualizada', 'Los cambios fueron guardados.')
      setEditarOpen(false)
      cargar()
    } catch (e: any) {
      showToast('error', 'No se pudo guardar', e?.response?.data?.message ?? 'Error inesperado.')
    } finally { setGuardando(false) }
  }

  // ── Acciones (cerrar/abrir/ocultar/publicar) ──────────────────────────────

  function abrirAccion(tipo: typeof accion extends null ? never : NonNullable<typeof accion>['tipo'], cv: Convocatoria) {
    setAccion({ tipo, convocatoria: cv })
    setAccionOpen(true)
  }
  async function ejecutarAccion() {
    if (!accion) return
    const { tipo, convocatoria } = accion
    setEjecutando(true)
    try {
      let resp
      if (tipo === 'cerrar' || tipo === 'abrir') {
        resp = await api.post<{ message: string }>(
          `/proyectos/admin/convocatorias/${convocatoria.id}/estado`,
          { abrir: tipo === 'abrir' },
        )
      } else if (tipo === 'ocultar' || tipo === 'mostrar') {
        resp = await api.post<{ message: string }>(
          `/proyectos/admin/convocatorias/${convocatoria.id}/ocultar`,
          { ocultar: tipo === 'ocultar' },
        )
      } else {
        resp = await api.post<{ message: string }>(
          `/proyectos/admin/convocatorias/${convocatoria.id}/publicar-resultados`,
          { publicar: tipo === 'publicar' },
        )
      }
      showToast('success', 'Listo', resp.data?.message ?? '')
      setAccionOpen(false)
      cargar()
    } catch (e: any) {
      showToast('error', 'No se pudo ejecutar', e?.response?.data?.message ?? 'Error inesperado.')
    } finally { setEjecutando(false) }
  }

  // ── Filtros ───────────────────────────────────────────────────────────────

  const visibles = useMemo(() => {
    if (!data) return []
    const q = busqueda.trim().toLowerCase()
    if (!q) return data
    return data.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      String(c.anio).includes(q) ||
      String(c.id).includes(q),
    )
  }, [data, busqueda])

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={32} className="animate-spin" style={{ color: TITLE_COLOR }} />
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-10 text-center text-red-500 text-sm">
        Error al cargar las convocatorias.{' '}
        <button onClick={cargar} className="underline">Reintentar</button>
      </div>
    )
  }

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa
          key={toastK2}
          show
          onClose={() => setToast(null)}
          tipo={toast.tipo}
          titulo={toast.titulo}
          mensaje={toast.msg}
          duration={5500}
        />
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#39A900]" />
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <Link href="/panel"
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-[#00304D] transition w-fit">
            <ChevronLeft size={14} /> Inicio
          </Link>
          <div className="hidden sm:block w-px h-6 bg-neutral-200" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Administrador</p>
            <h1 className="text-lg sm:text-xl font-bold text-[#00304D] flex items-center gap-2">
              <Megaphone size={20} className="text-[#00304D] shrink-0" />
              Gestión de Convocatorias
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Crea, edita, abre/cierra y publica resultados de las convocatorias del programa.
            </p>
          </div>
          <button onClick={abrirCrear}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#00304D] hover:bg-[#004a76] text-white text-sm font-semibold rounded-xl transition">
            <Plus size={15} /> Nueva convocatoria
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, año o ID..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-neutral-200 rounded-xl outline-none focus:border-[#00304D] bg-white"
        />
      </div>

      {/* Listado */}
      {visibles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-10 text-center text-sm text-neutral-400">
          {busqueda ? 'No hay convocatorias que coincidan con tu búsqueda.' : 'No hay convocatorias registradas todavía.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibles.map(cv => (
            <ConvocatoriaCard
              key={cv.id}
              cv={cv}
              onEditar={() => abrirEditar(cv)}
              onAccion={(tipo) => abrirAccion(tipo, cv)}
            />
          ))}
        </div>
      )}

      {/* Modal: Crear */}
      <Modal open={crearOpen} onClose={() => !creando && setCrearOpen(false)} maxWidth="max-w-2xl">
        <div className="p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
          <h3 className="text-base font-bold text-neutral-800 flex items-center gap-2">
            <Sparkles size={18} className="text-[#00304D]" />
            Nueva Convocatoria
          </h3>
          <p className="text-xs text-neutral-500">
            Completa los datos básicos. La convocatoria se creará abierta y visible por defecto.
          </p>
          <ConvocatoriaFormFields form={formCrear} setForm={setFormCrear} />
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setCrearOpen(false)} disabled={creando}
              className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleCrear} disabled={creando || !formCrear.nombre.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition disabled:opacity-50 bg-[#00304D] hover:bg-[#004a76]">
              {creando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Crear convocatoria
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Editar */}
      <Modal open={editarOpen} onClose={() => !guardando && setEditarOpen(false)} maxWidth="max-w-2xl">
        <div className="p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
          <h3 className="text-base font-bold text-neutral-800 flex items-center gap-2">
            <Edit3 size={18} className="text-[#00304D]" />
            Editar Convocatoria
          </h3>
          <ConvocatoriaFormFields form={formEditar} setForm={setFormEditar} />
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setEditarOpen(false)} disabled={guardando}
              className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleEditar} disabled={guardando || !formEditar.nombre.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition disabled:opacity-50 bg-[#00304D] hover:bg-[#004a76]">
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
              Guardar cambios
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmación de acción */}
      <Modal open={accionOpen} onClose={() => !ejecutando && setAccionOpen(false)} maxWidth="max-w-lg">
        {accion && (
          <ConfirmAccionModal
            accion={accion}
            ejecutando={ejecutando}
            onCancel={() => setAccionOpen(false)}
            onConfirm={ejecutarAccion}
          />
        )}
      </Modal>
    </div>
  )
}

// ── Card de convocatoria ──────────────────────────────────────────────────────

function ConvocatoriaCard({
  cv, onEditar, onAccion,
}: {
  cv: Convocatoria
  onEditar: () => void
  onAccion: (tipo: 'cerrar' | 'abrir' | 'ocultar' | 'mostrar' | 'publicar' | 'despublicar') => void
}) {
  const abierta = cv.estado === 1
  const oculta = cv.ocultar === 1
  const publicada = cv.resultadosPublicados === 1

  const evaluados = (cv.aprobados ?? 0) + (cv.rechazados ?? 0)
  const pendientesPorEvaluar = Math.max(0, (cv.confirmados ?? 0))

  return (
    <article className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className={`px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between gap-3 flex-wrap`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              ID {cv.id} · {cv.anio}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              abierta
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {abierta ? <LockOpen size={10} /> : <Lock size={10} />}
              {abierta ? 'Abierta' : 'Cerrada'}
            </span>
            {oculta && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-neutral-50 text-neutral-500 border-neutral-200">
                <EyeOff size={10} /> Oculta
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              publicada
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-neutral-50 text-neutral-500 border-neutral-200'
            }`}>
              <ShieldCheck size={10} />
              {publicada ? 'Resultados publicados' : 'Resultados sin publicar'}
            </span>
          </div>
          <h3 className="mt-1 text-sm font-bold text-[#00304D] truncate">{cv.nombre}</h3>
        </div>
        <button onClick={onEditar}
          title="Editar convocatoria"
          className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-[#00304D] transition shrink-0">
          <Pencil size={14} />
        </button>
      </div>

      {/* Datos básicos */}
      <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
        <div>
          <p className="text-neutral-400 uppercase tracking-wide font-semibold">Tipo financiación</p>
          <p className="font-bold text-neutral-700">{cv.tipoFinanciacion ?? '—'}</p>
        </div>
        <div>
          <p className="text-neutral-400 uppercase tracking-wide font-semibold">Meses proyecto</p>
          <p className="font-bold text-neutral-700">{cv.mesesProyecto ?? '—'}</p>
        </div>
        <div>
          <p className="text-neutral-400 uppercase tracking-wide font-semibold">Programa ID</p>
          <p className="font-bold text-neutral-700">{cv.programaId ?? '—'}</p>
        </div>
        <div>
          <p className="text-neutral-400 uppercase tracking-wide font-semibold">Inicio</p>
          <p className="font-bold text-neutral-700">{fmtFecha(cv.fechaInicio)}</p>
        </div>
        <div>
          <p className="text-neutral-400 uppercase tracking-wide font-semibold">Cierre</p>
          <p className="font-bold text-neutral-700">{fmtFecha(cv.fechaCierre)}</p>
        </div>
        <div>
          <p className="text-neutral-400 uppercase tracking-wide font-semibold">Registrada</p>
          <p className="font-bold text-neutral-700">{cv.fechaRegistro ? fmtDateTime(cv.fechaRegistro) : '—'}</p>
        </div>
      </div>

      {/* Presupuestos */}
      <div className="px-5 pb-3 grid grid-cols-2 gap-3 text-[11px]">
        <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2">
          <p className="text-neutral-400 uppercase tracking-wide font-semibold">Presupuesto total</p>
          <p className="font-bold text-[#00304D]">{fmtCop(cv.presupuestoTotal)}</p>
        </div>
        <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2">
          <p className="text-neutral-400 uppercase tracking-wide font-semibold">Presupuesto máximo</p>
          <p className="font-bold text-[#00304D]">{fmtCop(cv.presupuestoMaximo)}</p>
        </div>
      </div>

      {/* Stats de proyectos */}
      <div className="px-5 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">Proyectos</p>
        <div className="grid grid-cols-5 gap-1.5">
          <Stat label="Total"        value={cv.totalProyectos} color="neutral" />
          <Stat label="Sin confirmar" value={cv.sinConfirmar}   color="neutral" />
          <Stat label="Confirmados"  value={cv.confirmados}    color="blue" />
          <Stat label="Aprobados"    value={cv.aprobados}      color="emerald" />
          <Stat label="Rechazados"   value={cv.rechazados}     color="red" />
        </div>
        {pendientesPorEvaluar > 0 && !publicada && (
          <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            ⚠️ Hay <strong>{pendientesPorEvaluar}</strong> proyecto(s) confirmado(s) sin evaluar todavía.
          </p>
        )}
        {publicada && evaluados === 0 && (
          <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            ⚠️ Está publicada pero todavía no hay proyectos evaluados.
          </p>
        )}
      </div>

      {/* Acciones */}
      <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/40 flex flex-wrap gap-2">
        {abierta ? (
          <button onClick={() => onAccion('cerrar')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 transition">
            <Lock size={12} /> Cerrar
          </button>
        ) : (
          <button onClick={() => onAccion('abrir')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 transition">
            <LockOpen size={12} /> Abrir
          </button>
        )}
        {oculta ? (
          <button onClick={() => onAccion('mostrar')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 transition">
            <Eye size={12} /> Mostrar
          </button>
        ) : (
          <button onClick={() => onAccion('ocultar')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 transition">
            <EyeOff size={12} /> Ocultar
          </button>
        )}
        {publicada ? (
          <button onClick={() => onAccion('despublicar')}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition">
            <ShieldCheck size={12} /> Despublicar resultados
          </button>
        ) : (
          <button onClick={() => onAccion('publicar')}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition">
            <ShieldCheck size={12} /> Publicar resultados
          </button>
        )}
      </div>
    </article>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: 'neutral' | 'blue' | 'emerald' | 'red' }) {
  const cfg = {
    neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    blue:    'bg-blue-50 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red:     'bg-red-50 text-red-700 border-red-200',
  }[color]
  return (
    <div className={`rounded-lg border px-2 py-1.5 text-center ${cfg}`}>
      <p className="text-base font-bold leading-none">{value ?? 0}</p>
      <p className="text-[9px] font-semibold uppercase tracking-wide mt-1 leading-none">{label}</p>
    </div>
  )
}

// ── Form fields compartidos crear/editar ──────────────────────────────────────

function ConvocatoriaFormFields({
  form, setForm,
}: {
  form: FormConvocatoria
  setForm: (f: FormConvocatoria) => void
}) {
  function set<K extends keyof FormConvocatoria>(k: K, v: FormConvocatoria[K]) {
    setForm({ ...form, [k]: v })
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">Nombre *</label>
        <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
          maxLength={200}
          placeholder="Ej.: CONVOCATORIA DSNFT-0001-FCE-2026"
          className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D]" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">Año *</label>
        <input type="number" min={2000} max={2100}
          value={form.anio} onChange={e => set('anio', e.target.value)}
          className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D]" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">Tipo de financiación *</label>
        <select value={form.tipoFinanciacion}
          onChange={e => set('tipoFinanciacion', e.target.value as 'ABIERTO' | 'COFINANCIACIÓN')}
          className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D] bg-white">
          <option value="ABIERTO">ABIERTO</option>
          <option value="COFINANCIACIÓN">COFINANCIACIÓN</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">Presupuesto total (COP) *</label>
        <input type="number" min={0}
          value={form.presupuestoTotal} onChange={e => set('presupuestoTotal', e.target.value)}
          className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D]" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">Presupuesto máximo (COP) *</label>
        <input type="number" min={0}
          value={form.presupuestoMaximo} onChange={e => set('presupuestoMaximo', e.target.value)}
          className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D]" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">Meses del proyecto *</label>
        <input type="number" min={1} max={36}
          value={form.mesesProyecto} onChange={e => set('mesesProyecto', e.target.value)}
          className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D]" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">Programa ID</label>
        <input type="number" min={1}
          value={form.programaId} onChange={e => set('programaId', e.target.value)}
          className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D]" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">Fecha inicio</label>
        <input type="date"
          value={form.fechaInicio} onChange={e => set('fechaInicio', e.target.value)}
          className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D]" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">Fecha cierre</label>
        <input type="date"
          value={form.fechaCierre} onChange={e => set('fechaCierre', e.target.value)}
          className="border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#00304D]" />
      </div>
    </div>
  )
}

// ── Modal de confirmación de acciones ─────────────────────────────────────────

function ConfirmAccionModal({
  accion, ejecutando, onCancel, onConfirm,
}: {
  accion: { tipo: 'cerrar' | 'abrir' | 'ocultar' | 'mostrar' | 'publicar' | 'despublicar'; convocatoria: Convocatoria }
  ejecutando: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { tipo, convocatoria } = accion
  const cfg = {
    cerrar:      { icon: Lock,         color: 'red',     titulo: 'Cerrar convocatoria',
                   texto: 'Los proponentes ya no podrán crear ni editar proyectos en esta convocatoria.' },
    abrir:       { icon: LockOpen,     color: 'emerald', titulo: 'Abrir convocatoria',
                   texto: 'Los proponentes podrán crear y editar proyectos en esta convocatoria.' },
    ocultar:     { icon: EyeOff,       color: 'neutral', titulo: 'Ocultar convocatoria',
                   texto: 'La convocatoria dejará de aparecer en el selector al crear un proyecto nuevo.' },
    mostrar:     { icon: Eye,          color: 'neutral', titulo: 'Mostrar convocatoria',
                   texto: 'La convocatoria volverá a aparecer en el selector al crear un proyecto nuevo.' },
    publicar:    { icon: ShieldCheck,  color: 'emerald', titulo: 'Publicar resultados de la convocatoria',
                   texto: 'TODOS los proponentes con proyectos evaluados de esta convocatoria verán simultáneamente el resultado: estado del proyecto y concepto por AF.' },
    despublicar: { icon: ShieldCheck,  color: 'amber',   titulo: 'Despublicar resultados de la convocatoria',
                   texto: 'Los proponentes volverán a ver sus proyectos como “Confirmado” y dejarán de ver el concepto por AF.' },
  }[tipo]
  const Icon = cfg.icon
  const colorBtn = {
    red: 'bg-red-600 hover:bg-red-700',
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
    neutral: 'bg-[#00304D] hover:bg-[#004a76]',
    amber: 'bg-amber-500 hover:bg-amber-600',
  }[cfg.color]
  const colorIcon = {
    red: 'text-red-600',
    emerald: 'text-emerald-600',
    neutral: 'text-[#00304D]',
    amber: 'text-amber-600',
  }[cfg.color]
  return (
    <div className="p-6 flex flex-col gap-4">
      <h3 className="text-base font-bold text-neutral-800 flex items-center gap-2">
        <Icon size={18} className={colorIcon} />
        {cfg.titulo}
      </h3>
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
        <p className="text-[10px] text-neutral-400 uppercase tracking-wide font-semibold">Convocatoria</p>
        <p className="text-sm font-bold text-[#00304D]">{convocatoria.nombre}</p>
        <p className="text-[11px] text-neutral-500">ID {convocatoria.id} · año {convocatoria.anio}</p>
      </div>
      <p className="text-sm text-neutral-700 leading-relaxed">{cfg.texto}</p>
      {tipo === 'publicar' && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900">
          ✅ Antes de publicar, asegúrate de haber terminado de evaluar todos los proyectos confirmados de esta convocatoria.
          Hay <strong>{convocatoria.confirmados}</strong> confirmado(s) sin evaluar y <strong>{(convocatoria.aprobados ?? 0) + (convocatoria.rechazados ?? 0)}</strong> ya evaluado(s).
        </div>
      )}
      {tipo === 'despublicar' && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
          ⚠️ Esta acción es reversible. Puedes volver a publicar después.
        </div>
      )}
      <div className="flex gap-3 justify-end pt-1">
        <button onClick={onCancel} disabled={ejecutando}
          className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition disabled:opacity-50">
          Cancelar
        </button>
        <button onClick={onConfirm} disabled={ejecutando}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition disabled:opacity-50 ${colorBtn}`}>
          {ejecutando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Confirmar
        </button>
      </div>
    </div>
  )
}
