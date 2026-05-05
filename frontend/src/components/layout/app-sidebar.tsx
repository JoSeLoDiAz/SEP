'use client'

import { clearSepAuth, type SepUsuario } from '@/lib/auth'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useTieneConvenios } from '@/lib/use-tiene-convenios'
import type { LucideIcon } from 'lucide-react'
import {
  Award, Building2, CalendarDays, ChevronLeft, ChevronRight,
  ClipboardList, Cog, FileCheck2, FileText, FolderKanban,
  Home, LayoutDashboard, LogOut, ScrollText, Users, Wallet, X,
  BookUser, BarChart2,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

// ── Mapa URL GeneXus → ruta Next.js ─────────────────────────────────────────

const URL_MAP: Record<string, string> = {
  'InicioEmpresa.aspx':        '/panel',
  'InicioUsuario.aspx':        '/panel',
  'DatosBasicosEmpresa.aspx':  '/panel/datos',
  'Necesidades.aspx':          '/panel/necesidades',
  'Proyectos.aspx':            '/panel/proyectos',
  'WPConvenios.aspx':          '/panel/convenios',
  'wptratamientodatos.aspx':   '/panel/beneficiarios',
  'ContactosEmpresa.aspx':     '/panel/contactos',
  'AnalisisEmpresarial.aspx':  '/panel/analisis',
  'Empresas.aspx':             '/panel/empresas',
  'Convenios.aspx':            '/panel/convenios',
  'Cronograma.aspx':           '/panel/cronograma',
  'Certificados.aspx':         '/panel/certificacion',
  'Desembolsos.aspx':          '/panel/desembolsos',
  'Evaluaciones.aspx':         '/panel/evaluaciones',
}

// ── Mapa ícono FontAwesome → Lucide ─────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  'fa-home':              Home,
  'icon-home':            Home,
  'fa-address-card':      Building2,
  'icon-user':            Building2,
  'fa-list':              ClipboardList,
  'fa-tasks':             ClipboardList,
  'fa-clipboard-list':    ClipboardList,
  'fa-folder':            FolderKanban,
  'fa-project-diagram':   FolderKanban,
  'fa-handshake':         ScrollText,
  'fa-file-contract':     ScrollText,
  'fa-users':             Users,
  'icon-people':          Users,
  'fa-award':             FileCheck2,
  'fa-certificate':       Award,
  'fa-file-alt':          FileText,
  'fa-file':              FileText,
  'fa-calendar':          CalendarDays,
  'fa-calendar-alt':      CalendarDays,
  'fa-money-bill':        Wallet,
  'fa-money-bill-alt':    Wallet,
  'fa-clipboard-check':   ClipboardList,
  'fa-building':          Building2,
  'fa-cog':               Cog,
  'fa-tachometer-alt':    LayoutDashboard,
  'fa-chart-bar':         BarChart2,
  'fa-address-book':      BookUser,
}

function faToLucide(iconClass: string): LucideIcon {
  // e.g. "nav-icon fas fa-address-card" → "fa-address-card"
  const parts = iconClass.split(' ')
  for (const part of parts) {
    if (ICON_MAP[part]) return ICON_MAP[part]
  }
  return FileText // default
}

// ── Types ────────────────────────────────────────────────────────────────────

interface MenuItem { desc: string; url: string; icono: string }

interface AppSidebarProps {
  usuario: SepUsuario | null
  mobileOpen: boolean
  onMobileClose: () => void
}

// ── Component ────────────────────────────────────────────────────────────────

export function AppSidebar({ usuario, mobileOpen, onMobileClose }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const { tieneConvenios } = useTieneConvenios()

  const LABEL_OVERRIDE: Record<string, string> = {
    'Mis Proyectos': 'Proyectos',
    'Mis Necesidades': 'Necesidades',
  }

  const EXTRA_ITEMS: MenuItem[] = [
    { desc: 'Convenios', url: 'WPConvenios.aspx', icono: 'ScrollText' },
  ]

  useEffect(() => {
    api.get<MenuItem[]>('/empresa/menu')
      .then(r => {
        const items = r.data.map(item => ({
          ...item,
          desc: LABEL_OVERRIDE[item.desc] ?? item.desc,
        }))
        // Añadir items extra que no vengan del API
        for (const extra of EXTRA_ITEMS) {
          if (!items.some(it => it.url === extra.url)) {
            items.push(extra)
          }
        }
        setMenuItems(items)
      })
      .catch(() => setMenuItems([]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleLogout() {
    clearSepAuth()
    router.push('/login')
  }

  function renderNav(isMobile: boolean) {
    if (menuItems.length === 0) return null

    return (
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {menuItems.map((item, i) => {
          const path = URL_MAP[item.url] ?? null
          const Icon = faToLucide(item.icono)
          const active = path !== null && pathname === path
          const isDisabled = path === null

          if (isDisabled) {
            return (
              <span
                key={i}
                title={isMobile || !collapsed ? undefined : item.desc}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-white/30 cursor-not-allowed',
                  collapsed && !isMobile ? 'justify-center' : ''
                )}
              >
                <Icon size={17} className="flex-shrink-0" />
                {(!collapsed || isMobile) && (
                  <span className="truncate">{item.desc}
                    <span className="ml-1 text-[9px] bg-white/10 px-1 py-0.5 rounded">próximo</span>
                  </span>
                )}
              </span>
            )
          }

          return (
            <Link
              key={i}
              href={path}
              onClick={isMobile ? onMobileClose : undefined}
              title={collapsed && !isMobile ? item.desc : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 no-underline',
                active
                  ? 'bg-white/[0.15] text-white shadow-sm'
                  : 'text-white/65 hover:bg-white/[0.08] hover:text-white',
                collapsed && !isMobile ? 'justify-center' : ''
              )}
            >
              <Icon size={17} className="flex-shrink-0" />
              {(!collapsed || isMobile) && (
                <>
                  <span className="truncate">{item.desc}</span>
                  {active && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                  )}
                </>
              )}
            </Link>
          )
        })}
      </nav>
    )
  }

  function renderUser(isMobile: boolean) {
    return (
      <div className={cn(
        'flex items-center gap-3 mt-6 p-3 rounded-xl bg-white/[0.07] border border-white/10',
        collapsed && !isMobile ? 'flex-col gap-2' : ''
      )}>
        <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
          {(usuario?.nombre?.[0] ?? 'U').toUpperCase()}
        </div>
        {(!collapsed || isMobile) && (
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-white text-xs font-semibold truncate">
              {usuario?.nombre ?? usuario?.email ?? '—'}
            </span>
            <span className="text-white/50 text-[10px] truncate">
              {usuario?.perfilId === 7
                ? (tieneConvenios ? 'Conviniente' : 'Proponente')
                : 'Usuario interno'}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="p-1.5 rounded-lg hover:bg-red-500/30 text-white/50 hover:text-red-300 transition-colors flex-shrink-0"
        >
          <LogOut size={15} />
        </button>
      </div>
    )
  }

  function renderHeader(isMobile: boolean) {
    return (
      <div className={cn('flex items-center gap-3 mb-7 flex-shrink-0', collapsed && !isMobile ? 'justify-center' : '')}>
        <Image src="/images/sena-logo.svg" alt="SENA" width={34} height={34} className="flex-shrink-0" />
        {(!collapsed || isMobile) && (
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-white font-bold text-sm">SEP</span>
            <span className="text-white/60 text-[10px]">GGPC · SENA</span>
          </div>
        )}
        {isMobile && (
          <button onClick={onMobileClose}
            className="ml-auto p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            aria-label="Cerrar menú">
            <X size={18} />
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      {/* ── Desktop sidebar ────────────────────────────────────────────── */}
      <aside className={cn(
        'relative hidden lg:flex flex-col min-h-screen bg-[#00304D] flex-shrink-0 z-20 transition-all duration-250',
        collapsed ? 'w-[68px] px-3 py-5' : 'w-[240px] px-4 py-5'
      )}>
        {renderHeader(false)}
        {renderNav(false)}
        {renderUser(false)}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-[#00304D] border-2 border-neutral-200 flex items-center justify-center text-white hover:border-green-400 transition-colors z-10"
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
        </button>
      </aside>

      {/* ── Mobile backdrop + drawer ────────────────────────────────────── */}
      <div
        className={cn('fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity duration-200',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}
        onClick={onMobileClose} aria-hidden
      />
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 w-[260px] bg-[#00304D] px-4 py-5 flex flex-col lg:hidden transition-transform duration-250',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {renderHeader(true)}
        {renderNav(true)}
        {renderUser(true)}
      </div>
    </>
  )
}
