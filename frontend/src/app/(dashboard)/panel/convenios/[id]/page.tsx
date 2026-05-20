'use client'

import api from '@/lib/api'
import { fmtDateTimeNumeric as fmtDateTime } from '@/lib/format-date'
import {
  CalendarDays, ChevronLeft, ChevronRight, ExternalLink, FileEdit,
  GraduationCap, Landmark, Loader2, MonitorPlay, ScrollText, Shield, Users,
  UserSquare2,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface ConvenioDetalle {
  convenioId: number
  numeroSecop: string
  estadoNum: number | null
  fechaSuscripcion: string | null
  fechaInicio: string | null
  fechaRegistro: string | null
  fechaRp: string | null
  rp: number | null
  banco: string | null
  cuenta: string | null
  tipoCuenta: number | null
  poliza: string | null
  polizaAnexo: number | null
  fechaExpPoliza: string | null
  fechaAproPoliza: string | null
  aseguradora: string | null
  revision: number | null
  otrosi: number | null
  fechaOtrosi: string | null
  linkSecop: string | null
  radicadoPresupuesto: string | null
  proyectoId: number
  proyectoNombre: string
  convocatoria: string | null
  convocatoriaId: number | null
  modalidad: string | null
  empresaId: number
  empresa: string
}

const TITLE_COLOR = '#00304D'

function fmtFecha(d: string | null) {
  if (!d) return '—'
  try {
    const f = new Date(d)
    if (f.getFullYear() < 1950) return '—'
    return fmtDateTime(d)
  } catch { return '—' }
}

interface SubModulo {
  id: string
  titulo: string
  descripcion: string
  icon: typeof UserSquare2
  href?: string
  color: string
}

const SUBMODULOS = (proyectoId: number): SubModulo[] => [
  {
    id: 'directores',
    titulo: 'Directores',
    descripcion: 'Asignación y seguimiento del director del proyecto.',
    icon: UserSquare2,
    color: '#00304D',
    href: `/panel/convenios/${proyectoId}/directores`,
  },
  {
    id: 'capacitadores',
    titulo: 'Capacitadores',
    descripcion: 'Gestión de capacitadores naturales y jurídicos con sus perfiles y hojas de vida.',
    icon: GraduationCap,
    color: '#0070C0',
    href: `/panel/convenios/${proyectoId}/capacitadores`,
  },
  {
    id: 'cronograma',
    titulo: 'Cronograma',
    descripcion: 'Visualiza, actualiza y radica el cronograma del proyecto por cortes.',
    icon: CalendarDays,
    color: '#39A900',
    href: `/panel/convenios/${proyectoId}/cronograma`,
  },
  {
    id: 'beneficiarios',
    titulo: 'Beneficiarios',
    descripcion: 'Registro, control y certificación de los beneficiarios.',
    icon: Users,
    color: '#C47900',
    href: `/panel/convenios/${proyectoId}/beneficiarios`,
  },
  {
    id: 'modificaciones',
    titulo: 'Modificaciones',
    descripcion: 'Registra y gestiona las modificaciones del convenio (otrosíes, ajustes, prórrogas).',
    icon: FileEdit,
    color: '#C4003D',
    href: `/panel/convenios/${proyectoId}/modificaciones`,
  },
  {
    id: 'plataformas',
    titulo: 'Plataformas Virtuales',
    descripcion: 'Gestiona las plataformas virtuales que el convenio requiere para la ejecución de las AF.',
    icon: MonitorPlay,
    color: '#7C3AED',
    href: `/panel/convenios/${proyectoId}/plataformas`,
  },
]

export default function ConvenioDetallePage() {
  const { id } = useParams<{ id: string }>()
  const proyectoId = Number(id)
  const [data, setData] = useState<ConvenioDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Convenio | SEP'
    api.get<ConvenioDetalle>(`/convenios/${proyectoId}`)
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.message ?? 'Error al cargar el convenio'))
      .finally(() => setLoading(false))
  }, [proyectoId])

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={32} className="animate-spin" style={{ color: TITLE_COLOR }} />
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="p-10 text-center text-red-500 text-sm">
        {error ?? 'No se pudo cargar el convenio.'}{' '}
        <Link href="/panel/convenios" className="underline">Volver</Link>
      </div>
    )
  }

  const submodulos = SUBMODULOS(proyectoId)

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">

      {/* Breadcrumb */}
      <Link href="/panel/convenios"
        className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-[#00304D] transition w-fit">
        <ChevronLeft size={14} /> Convenios
      </Link>

      {/* Header — Información general del convenio */}
      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#39A900]" />
        <div className="p-5 sm:p-6 flex items-center gap-4 flex-wrap border-b border-neutral-100">
          <div className="w-12 h-12 rounded-xl bg-[#00304D]/10 flex items-center justify-center shrink-0">
            <ScrollText size={22} className="text-[#00304D]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Ejecución del convenio</p>
            <h1 className="text-lg sm:text-xl font-bold text-[#00304D] truncate">{data.proyectoNombre}</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Estas son las principales opciones de gestión disponibles para el desarrollo y seguimiento del convenio.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          <Field label="Código de Proyecto" value={String(data.proyectoId)} />
          <Field label="Nombre del Proyecto" value={data.proyectoNombre} />
          <Field label="Nombre de la Convocatoria" value={data.convocatoria} />
          <Field label="Modalidad de Participación" value={data.modalidad} />
          <Field label="Número de Convenio · SECOP II" value={data.numeroSecop} mono />
          <Field label="Empresa / Gremio" value={data.empresa} />
        </div>

        {/* Datos administrativos del convenio (segunda fila) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 pt-0">
          <Field label="Fecha de Suscripción" value={fmtFecha(data.fechaSuscripcion)} icon={CalendarDays} />
          <Field label="Fecha de Inicio" value={fmtFecha(data.fechaInicio)} icon={CalendarDays} />
          <Field label="Banco · Cuenta" value={[data.banco, data.cuenta].filter(Boolean).join(' · ') || '—'} icon={Landmark} />
          <Field label="Póliza · Aseguradora" value={[data.poliza, data.aseguradora].filter(Boolean).join(' · ') || '—'} icon={Shield} />
        </div>

        {data.linkSecop && data.linkSecop.trim().startsWith('http') && (
          <div className="px-5 pb-5">
            <a
              href={data.linkSecop.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0070C0] hover:underline"
            >
              <ExternalLink size={12} /> Ver convenio en SECOP II
            </a>
          </div>
        )}
      </section>

      {/* Sub-módulos del convenio:
          Directores · Capacitadores · Cronograma · Beneficiarios · Modificaciones · Plataformas Virtuales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {submodulos.map(s => {
          const Icon = s.icon
          const habilitado = !!s.href
          return habilitado ? (
            <Link
              key={s.id}
              href={s.href!}
              className="group bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
            >
              <div className="h-1" style={{ backgroundColor: s.color }} />
              <div className="p-5 flex flex-col items-center text-center gap-3 flex-1">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${s.color}15` }}
                >
                  <Icon size={26} style={{ color: s.color }} />
                </div>
                <h3 className="text-sm font-bold text-[#00304D]">{s.titulo}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">{s.descripcion}</p>
                <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-semibold text-white px-4 py-1.5 rounded-lg group-hover:gap-1.5 transition"
                  style={{ backgroundColor: s.color }}>
                  Gestionar <ChevronRight size={12} />
                </span>
              </div>
            </Link>
          ) : (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col opacity-70"
            >
              <div className="h-1" style={{ backgroundColor: s.color }} />
              <div className="p-5 flex flex-col items-center text-center gap-3 flex-1">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${s.color}15` }}
                >
                  <Icon size={26} style={{ color: s.color }} />
                </div>
                <h3 className="text-sm font-bold text-[#00304D]">{s.titulo}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">{s.descripcion}</p>
                <span className="mt-auto inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-400 px-3 py-1 rounded-full">
                  Próximamente
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Field({
  label, value, mono, icon: Icon,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
  icon?: typeof UserSquare2
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon && (
        <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={13} className="text-neutral-500" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
        <p className={`text-sm font-bold text-[#00304D] mt-0.5 break-words ${mono ? 'font-mono text-[13px]' : ''}`}>
          {value || '—'}
        </p>
      </div>
    </div>
  )
}
