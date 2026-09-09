'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  CalendarDays, ChevronDown, GraduationCap, Home,
  Users, UserSquare2,
} from 'lucide-react'

interface Child {
  label: string
  href?: string
  disabled?: boolean
}

interface NavItem {
  id: string
  label: string
  icon: typeof Home
  href?: string
  children?: Child[]
}

const COLOR = '#00304D'

function buildItems(id: number): NavItem[] {
  return [
    {
      id: 'inicio',
      label: 'Inicio',
      icon: Home,
      href: `/panel/convenios/${id}`,
    },
    {
      id: 'directores',
      label: 'Directores',
      icon: UserSquare2,
      children: [
        { label: 'Registrar Director', href: `/panel/convenios/${id}/directores/hv` },
        { label: 'Ver Directores', href: `/panel/convenios/${id}/directores` },
      ],
    },
    {
      id: 'capacitadores',
      label: 'Capacitadores',
      icon: GraduationCap,
      children: [
        { label: 'Registrar Natural', href: `/panel/convenios/${id}/directores/hv?modo=cap` },
        { label: 'Agregar Empresa', href: `/panel/convenios/${id}/capacitadores/empresa` },
        { label: 'Ver Capacitadores', href: `/panel/convenios/${id}/capacitadores` },
      ],
    },
    {
      id: 'cronograma',
      label: 'Cronograma',
      icon: CalendarDays,
      children: [
        { label: 'Ver Cronograma', href: `/panel/convenios/${id}/cronograma` },
        { label: 'Radicar Cronograma', href: `/panel/convenios/${id}/cronograma/radicar` },
      ],
    },
    {
      id: 'beneficiarios',
      label: 'Beneficiarios',
      icon: Users,
      children: [
        { label: 'Agregar Beneficiarios', href: `/panel/convenios/${id}/beneficiarios/registrar` },
        { label: 'AF Grupos', href: `/panel/convenios/${id}/grupos` },
        { label: 'Ver Beneficiarios', href: `/panel/convenios/${id}/beneficiarios` },
      ],
    },
  ]
}

export function ConvenioNav({ proyectoId }: { proyectoId: number }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const modoCap = searchParams?.get('modo') === 'cap'
  const base = `/panel/convenios/${proyectoId}`
  const items = buildItems(proyectoId)

  function active(item: NavItem) {
    if (item.id === 'inicio') return pathname === base
    // En modoCap, /directores/hv?modo=cap reutiliza el módulo de director
    // pero conceptualmente está bajo "Capacitadores".
    if (modoCap) {
      if (item.id === 'capacitadores') return true
      if (item.id === 'directores') return false
    }
    return pathname.startsWith(`${base}/${item.id}`)
  }

  return (
    <nav className="bg-white rounded-2xl border border-neutral-200 shadow-sm">
      <div className="h-0.5 rounded-t-2xl bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#00304D]" />
      <div className="flex items-center justify-center gap-1 px-4 py-2.5 flex-wrap">
        {items.map((item, idx) => {
          const Icon = item.icon
          const isActive = active(item)

          /* ── Leaf (sin hijos) ── */
          if (!item.children) {
            return (
              <Link
                key={item.id}
                href={item.href!}
                className={`
                  inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150
                  ${isActive
                    ? 'bg-[#00304D] text-white shadow-md'
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-[#00304D]'}
                `}
              >
                <Icon size={14} />
                {item.label}
              </Link>
            )
          }

          /* ── Dropdown ── */
          return (
            <div key={item.id} className="relative group">
              {idx > 0 && (
                <span className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-px h-4 bg-neutral-200 hidden sm:block pointer-events-none" />
              )}
              <button
                className={`
                  inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                  transition-all duration-150 select-none
                  ${isActive
                    ? 'bg-[#00304D] text-white shadow-md'
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-[#00304D] group-hover:bg-neutral-100 group-hover:text-[#00304D]'}
                `}
              >
                <Icon size={14} />
                {item.label}
                <ChevronDown
                  size={12}
                  className="transition-transform duration-200 group-hover:rotate-180 opacity-60"
                />
              </button>

              {/* Dropdown panel */}
              <div
                className="
                  absolute left-1/2 -translate-x-1/2 top-[calc(100%+6px)] z-50 min-w-[190px]
                  bg-white rounded-2xl border border-neutral-200 shadow-2xl
                  opacity-0 invisible translate-y-2
                  group-hover:opacity-100 group-hover:visible group-hover:translate-y-0
                  transition-all duration-150 ease-out
                  overflow-hidden
                "
              >
                <div className="h-0.5 bg-gradient-to-r from-[#00304D] to-[#0070C0]" />
                <div className="p-1.5 flex flex-col gap-0.5">
                  {item.children.map((child, i) =>
                    child.disabled ? (
                      <span
                        key={i}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-neutral-400 rounded-xl cursor-not-allowed"
                      >
                        {child.label}
                        <span className="text-[9px] font-bold bg-neutral-100 text-neutral-400 px-2 py-0.5 rounded-full whitespace-nowrap">
                          Próx.
                        </span>
                      </span>
                    ) : (
                      <Link
                        key={i}
                        href={child.href!}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 rounded-xl hover:bg-[#00304D] hover:text-white transition-colors duration-100"
                      >
                        {child.label}
                      </Link>
                    ),
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
