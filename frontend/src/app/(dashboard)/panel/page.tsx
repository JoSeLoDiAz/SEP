'use client'

import api from '@/lib/api'
import { getSepUsuario, isEmpresa } from '@/lib/auth'
import {
  BellRing,
  BookUser,
  BarChart2,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Database,
  FileBarChart,
  FileSpreadsheet,
  FolderKanban,
  GraduationCap,
  Handshake,
  Loader2,
  Megaphone,
  Receipt,
  ScrollText,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

// ── Empresa home ──────────────────────────────────────────────────────────────

const EMPRESA_CARDS = [
  {
    id: 'datos',
    title: 'Datos Básicos',
    icon: Building2,
    color: '#00304D',
    href: '/panel/datos',
    objetivo: 'Diligenciar la información básica de la empresa o gremio.',
    descripcion: 'Permite gestionar la información empresarial o gremial, ubicación, datos económicos y representante legal.',
    accion: '¿Cómo hacerlo? Seleccionar "Datos Básicos" en el menú y completar la información solicitada.',
    btnLabel: 'Ir a Datos Básicos',
  },
  {
    id: 'contactos',
    title: 'Contactos',
    icon: BookUser,
    color: '#0070C0',
    href: '/panel/contactos',
    objetivo: 'Registrar las personas de contacto de la empresa o gremio.',
    descripcion: 'Permite gestionar los contactos asociados a la organización y vincularlos a un proyecto específico.',
    accion: '¿Cómo hacerlo? Seleccionar "Contactos" en el menú y agregar o editar los contactos.',
    btnLabel: 'Ir a Contactos',
  },
  {
    id: 'analisis',
    title: 'Análisis Empresarial',
    icon: BarChart2,
    color: '#00304D',
    href: '/panel/analisis',
    objetivo: 'Describir el análisis empresarial o gremial del proponente.',
    descripcion: 'Permite registrar el objeto social, productos, situación actual, retos estratégicos, cadena productiva e interacciones.',
    accion: '¿Cómo hacerlo? Seleccionar "Análisis" en el menú y completar cada sección del formulario.',
    btnLabel: 'Ir a Análisis',
  },
  {
    id: 'necesidades',
    title: 'Mis Necesidades',
    icon: ClipboardList,
    color: '#39A900',
    href: '/panel/necesidades',
    objetivo: 'Registrar las necesidades de formación identificadas.',
    descripcion: 'Permite gestionar el diagnóstico de necesidades a partir del cual se priorizan las acciones de formación del proyecto.',
    accion: '¿Cómo hacerlo? Una vez diligenciados los Datos Básicos, ir al menú "Mis Necesidades".',
    btnLabel: 'Ir a Mis Necesidades',
  },
  {
    id: 'proyectos',
    title: 'Mis Proyectos',
    icon: FolderKanban,
    color: '#C47900',
    href: '/panel/proyectos',
    objetivo: 'Registrar el proyecto de formación diseñado a la medida de sus necesidades.',
    descripcion: 'Permite gestionar la información del proyecto y las acciones de formación que lo conforman.',
    accion: '¿Cómo hacerlo? Luego de "Mis Necesidades", seleccionar "Mis Proyectos" en el menú.',
    btnLabel: 'Ir a Mis Proyectos',
  },
  {
    id: 'convenios',
    title: 'Mis Convenios',
    icon: ScrollText,
    color: '#C4003D',
    href: '/panel/convenios',
    objetivo: 'Registrar la información relacionada al Convenio una vez gestionada la suscripción.',
    descripcion: 'Permite gestionar la ejecución del convenio (proyecto de formación y acciones de formación).',
    accion: '¿Cómo hacerlo? Una vez suscrito el convenio, la información será cargada en esta sección.',
    btnLabel: 'Ir a Mis Convenios',
  },
]

// ── Admin home ────────────────────────────────────────────────────────────────

interface ConvocatoriaResumen {
  id: number
  nombre: string
  anio: number
  estado: number
  resultadosPublicados: number
  totalProyectos: number
  sinConfirmar: number
  confirmados: number
  aprobados: number
  rechazados: number
}

interface AdminCardLink {
  label: string
  href?: string
  disabled?: boolean
}
interface AdminCard {
  id: string
  title: string
  icon: LucideIcon
  color: string
  links: AdminCardLink[]
}

const ADMIN_CARDS: AdminCard[] = [
  {
    id: 'convocatorias',
    title: 'Gestión de Convocatorias',
    icon: Megaphone,
    color: '#00304D',
    links: [
      { label: 'Ver, crear y editar convocatorias',  href: '/panel/admin/convocatorias' },
      { label: 'Cerrar / abrir convocatoria',         href: '/panel/admin/convocatorias' },
      { label: 'Publicar resultados al proponente',   href: '/panel/admin/convocatorias' },
    ],
  },
  {
    id: 'rubros',
    title: 'Gestión de Rubros por Convocatoria',
    icon: Receipt,
    color: '#0070C0',
    links: [
      { label: 'Ver y editar rubros (R01, R02, ...)',  disabled: true },
      { label: 'Clonar rubros desde otra convocatoria', disabled: true },
      { label: 'Ajustar topes y porcentajes',           disabled: true },
      { label: 'Activar / desactivar rubros',           disabled: true },
    ],
  },
  {
    id: 'catalogos',
    title: 'Catálogos del Sistema',
    icon: Database,
    color: '#39A900',
    links: [
      { label: 'Tipos de Evento',           disabled: true },
      { label: 'Modalidades de Formación',  disabled: true },
      { label: 'Material y Recursos',       disabled: true },
      { label: 'Tipos de Ambiente',         disabled: true },
      { label: 'Articulación Territorial',  disabled: true },
      { label: 'Retos Nacionales',          disabled: true },
      { label: 'Sectores y Subsectores',    disabled: true },
    ],
  },
  {
    id: 'reportes',
    title: 'Evaluación y Reportes',
    icon: FileBarChart,
    color: '#7C3AED',
    links: [
      { label: 'Aprobación de Proyectos',  href: '/panel/admin/aprobacion/proyectos' },
      { label: 'Reporte de Proyectos',     href: '/panel/admin/reportes/proyectos' },
      { label: 'Dashboard histórico',       disabled: true },
      { label: 'Reporte por usuario',       disabled: true },
    ],
  },
  {
    id: 'usuarios',
    title: 'Gestión de Usuarios',
    icon: Users,
    color: '#C47900',
    links: [
      { label: 'Crear usuario',                disabled: true },
      { label: 'Asignar perfil de usuario',    disabled: true },
      { label: 'Cambiar contraseña Persona',   disabled: true },
      { label: 'Cambiar contraseña Empresa',   disabled: true },
    ],
  },
  {
    id: 'comunicaciones',
    title: 'Comunicaciones',
    icon: BellRing,
    color: '#C4003D',
    links: [
      { label: 'Notificar publicación de resultados',  disabled: true },
      { label: 'Plantillas de correo',                  disabled: true },
      { label: 'Avisos en el panel del proponente',     disabled: true },
    ],
  },
  {
    id: 'convenios',
    title: 'Gestión de Convenios',
    icon: Handshake,
    color: '#0F766E',
    links: [
      { label: 'Asignar proyectos a Usuarios',    disabled: true },
      { label: 'Asignar Convenios',               disabled: true },
      { label: 'Banco de Capacitadores',          disabled: true },
      { label: 'Registrar Firmas',                disabled: true },
      { label: 'Registrar Logo',                  disabled: true },
    ],
  },
  {
    id: 'af',
    title: 'Acciones de Formación',
    icon: GraduationCap,
    color: '#B45309',
    links: [
      { label: 'Cambiar Corte de Radicación',   disabled: true },
      { label: 'Validaciones del pliego',       disabled: true },
    ],
  },
  {
    id: 'eventos',
    title: 'Eventos',
    icon: CalendarDays,
    color: '#6366F1',
    links: [
      { label: 'Crear Eventos',  disabled: true },
    ],
  },
  {
    id: 'imp-exp',
    title: 'Importar / Exportar',
    icon: FileSpreadsheet,
    color: '#0891B2',
    links: [
      { label: 'Importar catálogos desde CSV',  disabled: true },
      { label: 'Exportar catálogos a CSV',      disabled: true },
      { label: 'Importar rubros de convocatoria', disabled: true },
    ],
  },
  {
    id: 'config',
    title: 'Configuración General',
    icon: SettingsIcon,
    color: '#525252',
    links: [
      { label: 'Programas GGPC',          disabled: true },
      { label: 'Departamentos / Ciudades', disabled: true },
      { label: 'Mesas Sectoriales',        disabled: true },
      { label: 'Tipos de Empresa / Tamaño / Cobertura', disabled: true },
      { label: 'Configuración del Menú',   disabled: true },
    ],
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PanelHome() {
  const [usuario, setUsuario] = useState<ReturnType<typeof getSepUsuario>>(null)

  useEffect(() => { document.title = 'Inicio | SEP' }, [])

  useEffect(() => {
    setUsuario(getSepUsuario())
  }, [])

  const perfilId = usuario?.perfilId ?? 0

  if (isEmpresa(perfilId)) {
    return <EmpresaHome nombre={usuario?.nombre ?? ''} />
  }

  return <AdminHome />
}

// ── Empresa home view ─────────────────────────────────────────────────────────

function EmpresaHome({ nombre }: { nombre: string }) {
  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {/* Welcome banner */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#00304D] via-[#39A900] to-[#00304D]" />
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-[#00304D] truncate">
              {nombre || 'Bienvenido(a)'}
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              <strong className="text-[#00304D]">Señor Gremio / Empresario</strong>, le damos la bienvenida al{' '}
              <strong className="text-[#39A900]">Sistema Especializado de Proyectos — SEP</strong>.
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              A continuación le brindamos una breve explicación de las opciones disponibles para gestionar la información.
            </p>
          </div>
          <div className="hidden xl:flex flex-col items-end gap-0.5 flex-shrink-0 text-right">
            <span className="text-[11px] text-neutral-400">Módulos disponibles</span>
            <span className="text-2xl font-bold text-[#39A900]">6</span>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {EMPRESA_CARDS.map((card) => (
          <div
            key={card.id}
            className="bg-white rounded-2xl border border-neutral-200 shadow-sm flex flex-col overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
          >
            {/* Barra de color superior */}
            <div className="h-1.5" style={{ backgroundColor: card.color }} />

            {/* Ícono */}
            <div className="px-5 pt-6 pb-3 flex justify-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${card.color}12` }}
              >
                <card.icon size={30} style={{ color: card.color }} />
              </div>
            </div>

            {/* Título */}
            <div
              className="mx-4 rounded-xl px-3 py-2.5 text-center text-sm font-bold text-white mb-4"
              style={{ backgroundColor: card.color }}
            >
              {card.title}
            </div>

            {/* Contenido */}
            <div className="px-5 pb-5 flex flex-col gap-2.5 flex-1">
              <p className="text-xs text-neutral-700 leading-relaxed">
                <strong style={{ color: card.color }}>Objetivo:</strong>{' '}
                {card.objetivo}
              </p>
              <p className="text-xs text-neutral-500 leading-relaxed">
                {card.descripcion}
              </p>
              <p className="text-xs text-neutral-400 italic leading-relaxed">
                {card.accion}
              </p>

              <Link
                href={card.href}
                className="mt-auto block text-center text-xs font-semibold text-white py-2.5 px-4 rounded-xl transition-opacity hover:opacity-90 active:scale-95"
                style={{ backgroundColor: card.color }}
              >
                {card.btnLabel} →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Admin home view ───────────────────────────────────────────────────────────

function AdminHome() {
  const [convocatorias, setConvocatorias] = useState<ConvocatoriaResumen[] | null>(null)
  const [kpiLoading, setKpiLoading] = useState(true)

  useEffect(() => {
    api.get<ConvocatoriaResumen[]>('/proyectos/admin/convocatorias')
      .then(r => setConvocatorias(r.data))
      .catch(() => setConvocatorias([]))
      .finally(() => setKpiLoading(false))
  }, [])

  // La "última convocatoria" es la más reciente (mayor año, luego mayor id).
  // El backend ya las ordena así, basta con tomar la primera.
  const ultima = convocatorias?.[0] ?? null
  const evaluados = ultima ? (ultima.aprobados ?? 0) + (ultima.rechazados ?? 0) : 0
  const pendientes = ultima ? (ultima.confirmados ?? 0) : 0
  const publicada = ultima?.resultadosPublicados === 1
  const abierta = ultima?.estado === 1

  const kpis: Array<{ label: string; value: number; icon: LucideIcon; bg: string; fg: string }> = ultima ? [
    { label: 'Proyectos totales', value: ultima.totalProyectos, icon: FolderKanban, bg: 'bg-[#00304D]/10', fg: 'text-[#00304D]' },
    { label: 'Confirmados',       value: ultima.confirmados,    icon: CheckCircle2, bg: 'bg-blue-50',      fg: 'text-blue-600' },
    { label: 'Aprobados',         value: ultima.aprobados,      icon: TrendingUp,   bg: 'bg-emerald-50',   fg: 'text-emerald-600' },
    { label: 'Rechazados',        value: ultima.rechazados,     icon: XCircle,      bg: 'bg-red-50',       fg: 'text-red-600' },
  ] : []

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">

      {/* Welcome banner */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#00304D] via-[#39A900] to-[#00304D]" />
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-neutral-600">
              <strong className="text-[#00304D]">Señor Administrador</strong>, le damos la bienvenida al{' '}
              <strong className="text-[#39A900]">Sistema Especializado de Proyectos — SEP</strong>.
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              A continuación, se listan las opciones disponibles para gestionar la información.
            </p>
          </div>
          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00304D]/5 border border-[#00304D]/10 text-[11px] font-semibold text-[#00304D]">
            <ShieldAlert size={12} /> Vista Administrador
          </span>
        </div>
      </div>

      {/* Convocatoria actual + KPIs reales */}
      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#39A900]" />
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#00304D]/10 flex items-center justify-center shrink-0">
                <Megaphone size={18} className="text-[#00304D]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Última convocatoria</p>
                {kpiLoading ? (
                  <p className="text-sm text-neutral-400 inline-flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Cargando...
                  </p>
                ) : ultima ? (
                  <p className="text-sm font-bold text-[#00304D] truncate">{ultima.nombre}</p>
                ) : (
                  <p className="text-sm text-neutral-400">No hay convocatorias registradas.</p>
                )}
              </div>
            </div>
            {ultima && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${
                  abierta
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {abierta ? 'Abierta' : 'Cerrada'}
                </span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${
                  publicada
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-neutral-50 text-neutral-500 border-neutral-200'
                }`}>
                  <ShieldCheck size={10} />
                  {publicada ? 'Resultados publicados' : 'Resultados sin publicar'}
                </span>
                <Link href="/panel/admin/convocatorias"
                  className="text-[11px] font-semibold text-[#00304D] hover:underline">
                  Gestionar →
                </Link>
              </div>
            )}
          </div>

          {ultima && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {kpis.map((kpi) => (
                  <div key={kpi.label}
                    className="flex items-center gap-3 p-4 rounded-xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${kpi.bg}`}>
                      <kpi.icon size={20} className={kpi.fg} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-2xl font-bold text-neutral-900 leading-none">{kpi.value}</span>
                      <span className="text-[11px] text-neutral-500 mt-1">{kpi.label}</span>
                    </div>
                  </div>
                ))}
              </div>
              {pendientes > 0 && !publicada && (
                <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  ⚠️ Hay <strong>{pendientes}</strong> proyecto(s) confirmado(s) por evaluar antes de publicar resultados.
                </p>
              )}
              {publicada && evaluados > 0 && (
                <p className="text-[12px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  ✅ Resultados publicados. Los proponentes ya ven el estado de sus <strong>{evaluados}</strong> proyecto(s) evaluado(s).
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* Cards de módulos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {ADMIN_CARDS.map((card) => (
          <div key={card.id}
            className="bg-white rounded-2xl border border-neutral-200 shadow-sm flex flex-col overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">

            {/* Barra superior */}
            <div className="h-1.5" style={{ backgroundColor: card.color }} />

            {/* Ícono */}
            <div className="px-5 pt-6 pb-3 flex justify-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${card.color}12` }}>
                <card.icon size={30} style={{ color: card.color }} />
              </div>
            </div>

            {/* Título */}
            <div className="mx-4 rounded-xl px-3 py-2.5 text-center text-sm font-bold text-white mb-4"
              style={{ backgroundColor: card.color }}>
              {card.title}
            </div>

            {/* Lista de opciones */}
            <ul className="px-5 pb-5 flex flex-col gap-2 flex-1">
              {card.links.map((link, idx) => (
                <li key={idx}>
                  {link.disabled ? (
                    <span
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs text-neutral-400 bg-neutral-50 border border-neutral-100 cursor-not-allowed"
                      title="Próximamente">
                      <span className="truncate">→ {link.label}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-neutral-200 text-neutral-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        Próx.
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={link.href!}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white transition hover:opacity-90 active:scale-95"
                      style={{ backgroundColor: card.color }}>
                      <span className="truncate">→ {link.label}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
