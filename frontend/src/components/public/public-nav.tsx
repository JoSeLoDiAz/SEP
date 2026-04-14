'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogIn, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const navLinks = [
  { label: 'Inicio',                href: '/' },
  { label: 'Descargar Certificado', href: '/certificados' },
  { label: 'Eventos',               href: '/eventos' },
]

export function PublicNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <nav className="w-full bg-cerulean-500 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Links — ocultos en móvil */}
        <ul className="hidden sm:flex items-center">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  'block px-5 py-3 text-sm font-medium transition-colors',
                  pathname === link.href
                    ? 'text-white border-b-2 border-lime-500'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Hamburger en móvil */}
        <button
          className="sm:hidden p-2 text-white"
          onClick={() => setOpen(!open)}
          aria-label="Menú"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Iniciar sesión */}
        <Link
          href="/login"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors"
        >
          <LogIn size={16} />
          <span className="hidden xs:inline">Iniciar Sesión</span>
        </Link>
      </div>

      {/* Menú desplegable en móvil */}
      {open && (
        <div className="sm:hidden border-t border-white/20">
          <ul className="flex flex-col">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'block px-4 py-3 text-sm font-medium transition-colors',
                    pathname === link.href
                      ? 'text-white bg-white/10 border-l-4 border-lime-500'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  )
}
