'use client'

import Link from 'next/link'
import {
  Handshake,
  UserCog,
  GraduationCap,
  CalendarDays,
  Users,
  FilePenLine,
  MapPin,
  Building2,
  Wallet,
  Activity,
  MonitorPlay,
  BookOpen,
  Map,
  ArrowRight,
  LineChart,
  Share2,
  type LucideIcon,
} from 'lucide-react'

interface CardItem {
  id: string
  title: string
  href: string
  icon: LucideIcon
  color: string
}

// ── Programa de Formación Continua Especializada ────────────────────────────────
const CARDS: CardItem[] = [
  { id: 'convenios',       title: 'Convenios',                              href: '/panel/dashboards/detallada/convenios',       icon: Handshake,     color: '#00304D' },
  { id: 'directores',      title: 'Directores',                             href: '/panel/dashboards/detallada/directores',      icon: UserCog,       color: '#0070C0' },
  { id: 'capacitadores',   title: 'Capacitadores',                          href: '/panel/dashboards/detallada/capacitadores',   icon: GraduationCap, color: '#39A900' },
  { id: 'cronograma',      title: 'Cronograma',                             href: '/panel/dashboards/detallada/cronograma',      icon: CalendarDays,  color: '#C47900' },
  { id: 'beneficiarios',   title: 'Beneficiarios',                          href: '/panel/dashboards/detallada/beneficiarios',   icon: Users,         color: '#0F766E' },
  { id: 'modificaciones',  title: 'Modificaciones',                         href: '/panel/dashboards/detallada/modificaciones',  icon: FilePenLine,   color: '#7C3AED' },
  { id: 'visitascampo',    title: 'Visitas a las Acciones de Formación',    href: '/panel/dashboards/detallada/visitascampo',    icon: MapPin,        color: '#C4003D' },
  { id: 'visitassede',     title: 'Visitas en Sede',                        href: '/panel/dashboards/detallada/visitassede',     icon: Building2,     color: '#0891B2' },
  { id: 'desembolsos',     title: 'Desembolsos',                            href: '/panel/dashboards/detallada/desembolsos',     icon: Wallet,        color: '#B45309' },
  { id: 'seguimientoaf',   title: 'Seguimiento a las Acciones de Formación', href: '/panel/dashboards/detallada/seguimientoaf',  icon: Activity,      color: '#6366F1' },
  { id: 'plataformavirtual', title: 'Plataforma Virtual',                   href: '/panel/dashboards/detallada/plataformasvirtuales', icon: MonitorPlay, color: '#0070C0' },
  { id: 'imageninstitucional', title: 'Imagen Institucional',                   href: '/panel/dashboards/detallada/imageninstitucional', icon: MonitorPlay, color: '#0070C0' },
  { id: 'materialformacion', title: 'Materiales de Formación',              href: '/panel/dashboards/detallada/materialformacion', icon: BookOpen,    color: '#39A900' },
]

// ── Transferencia de Conocimiento y Tecnología ──────────────────────────────────
const CARDS_TRANSFERENCIA: CardItem[] = [
  { id: 'cobertura',        title: 'Cobertura',      href: '/panel/dashboards/detallada/transferencia/cobertura',     icon: Map,           color: '#00304D' },
  { id: 'captransferencia', title: 'Capacitadores',  href: '/panel/dashboards/detallada/transferencia/capacitadores', icon: GraduationCap, color: '#0070C0' },
  { id: 'cronotransferencia', title: 'Cronograma',   href: '/panel/dashboards/detallada/transferencia/cronograma',    icon: CalendarDays,  color: '#0F766E' },
  { id: 'benetransferencia', title: 'Beneficiarios', href: '/panel/dashboards/detallada/transferencia/beneficiarios', icon: Users,         color: '#39A900' },
]

function DashboardCard({ card }: { card: CardItem }) {
  return (
    <Link
      href={card.href}
      className="group bg-white rounded-2xl border border-neutral-200 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-transparent transition-all duration-200 overflow-hidden flex flex-col"
    >
      {/* Barra de color superior */}
      <div className="h-1.5" style={{ backgroundColor: card.color }} />

      <div className="flex flex-col items-center text-center px-5 pt-7 pb-6 gap-4 flex-1">
        {/* Ícono */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: `${card.color}14` }}
        >
          <card.icon size={30} strokeWidth={1.75} style={{ color: card.color }} />
        </div>

        {/* Título */}
        <h3 className="text-sm font-bold leading-snug text-[#00304D] group-hover:text-current"
            style={{ color: card.color }}>
          {card.title}
        </h3>

        {/* Enlace */}
        <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 transition-all">
          Ver detalle
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}

export default function PanelHome() {
  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-8">

      {/* ── Encabezado principal ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#00304D] via-[#39A900] to-[#00304D]" />
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#00304D]/10 flex items-center justify-center shrink-0">
            <LineChart size={24} className="text-[#00304D]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#39A900]">
              Herramienta de Seguimiento
            </p>
            <h1 className="text-lg sm:text-xl font-bold text-[#00304D] leading-tight">
              Tablero de Seguimiento a Convenios
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              Programa de Formación Continua Especializada
            </p>
          </div>
          <span className="hidden xl:flex flex-col items-end flex-shrink-0 text-right">
            <span className="text-[11px] text-neutral-400">Módulos</span>
            <span className="text-2xl font-bold text-[#39A900] leading-none">{CARDS.length}</span>
          </span>
        </div>
      </div>

      {/* ── Grid principal ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
        {CARDS.map((card) => (
          <DashboardCard key={card.id} card={card} />
        ))}
      </div>

      {/* ── Separador: Transferencia ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4 pt-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0070C0]/10 flex items-center justify-center shrink-0">
            <Share2 size={20} className="text-[#0070C0]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#00304D] leading-tight">
              Transferencia de Conocimiento y Tecnología
            </h2>
            <p className="text-xs text-neutral-500">Seguimiento del componente de transferencia</p>
          </div>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-neutral-200 to-transparent" />
      </div>

      {/* ── Grid transferencia ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
        {CARDS_TRANSFERENCIA.map((card) => (
          <DashboardCard key={card.id} card={card} />
        ))}
      </div>

    </div>
  )
}
