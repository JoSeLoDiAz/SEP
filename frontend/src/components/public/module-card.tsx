import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Award,
  Building2,
  CalendarCheck,
  ExternalLink,
  GraduationCap,
  Megaphone,
  UserPlus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONS = {
  GraduationCap,
  Award,
  CalendarCheck,
  Building2,
  UserPlus,
  Megaphone,
} satisfies Record<string, LucideIcon>

export type ModuleIcon = keyof typeof ICONS
export type ModuleAccent = 'lime' | 'green' | 'cerulean' | 'purpura'

// clases literales: tailwind no compila nombres armados en ejecucion
const ACCENT: Record<ModuleAccent, { disco: string; filete: string; enlace: string; foco: string }> = {
  lime: {
    disco: 'bg-lime-500',
    filete: 'before:bg-lime-500',
    enlace: 'text-lime-600',
    foco: 'focus-visible:outline-lime-500',
  },
  green: {
    disco: 'bg-green-500',
    filete: 'before:bg-green-500',
    enlace: 'text-green-500',
    foco: 'focus-visible:outline-green-500',
  },
  cerulean: {
    disco: 'bg-cerulean-500',
    filete: 'before:bg-cerulean-500',
    enlace: 'text-cerulean-500',
    foco: 'focus-visible:outline-cerulean-500',
  },
  purpura: {
    disco: 'bg-purpura-500',
    filete: 'before:bg-purpura-500',
    enlace: 'text-purpura-500',
    foco: 'focus-visible:outline-purpura-500',
  },
}

export interface ModuleDef {
  id: string
  title: string
  description: string
  href: string
  /** texto del enlace de accion; si falta se usa "Ir" */
  cta?: string
  icon: ModuleIcon
  accent: ModuleAccent
  /** 1200x900 (4:3). Banda lateral en escritorio, superior en movil. */
  imagen?: string
  external?: boolean
  disabled?: boolean
  /** ocupa toda la fila */
  ancha?: boolean
}

export function ModuleCard({ mod }: { mod: ModuleDef }) {
  const Icon = ICONS[mod.icon]
  const accent = ACCENT[mod.accent]

  // el filete de color va como pseudo-elemento para no desalinear el contenido
  const base = cn(
    'group relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white sm:flex-row',
    'before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-1 before:content-[""]',
    'transition-all duration-200',
    mod.ancha && 'md:col-span-2',
  )

  const banda = mod.imagen && (
    <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-neutral-100 sm:aspect-auto sm:w-40 lg:w-44">
      <Image
        src={mod.imagen}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, 176px"
        className={cn(
          'object-cover transition-transform duration-300',
          !mod.disabled && 'group-hover:scale-105',
          mod.disabled && 'grayscale',
        )}
      />
    </div>
  )

  // sin imagen la tarjeta se sostiene con el disco del icono
  const disco = !mod.imagen && (
    <span
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
        mod.disabled ? 'bg-neutral-300' : accent.disco,
      )}
    >
      <Icon size={20} strokeWidth={2} className="text-white" aria-hidden="true" />
    </span>
  )

  const cuerpo = (
    <>
      {banda}

      <div className="flex flex-1 gap-4 p-5">
      {disco}

      <div className="min-w-0 flex-1">
        <h3
          className={cn(
            'flex items-center gap-1.5 text-[15px] font-semibold leading-snug',
            mod.disabled ? 'text-neutral-400' : 'text-cerulean-500',
          )}
        >
          {mod.title}
        </h3>

        <p className={cn('mt-1 text-[13px] leading-snug', mod.disabled ? 'text-neutral-400' : 'text-neutral-500')}>
          {mod.description}
        </p>

        {!mod.disabled && (
          <span className={cn('mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold', accent.enlace)}>
            {mod.cta ?? 'Ir'}
            {mod.external ? (
              <ExternalLink size={13} aria-hidden="true" />
            ) : (
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
            )}
          </span>
        )}
      </div>

      {mod.disabled && (
        <span className="self-center rounded-full bg-neutral-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
          Pronto
        </span>
      )}
      </div>
    </>
  )

  if (mod.disabled) {
    return (
      <div aria-disabled="true" className={cn(base, 'cursor-default bg-neutral-50 before:bg-neutral-300')}>
        {cuerpo}
      </div>
    )
  }

  const interactiva = cn(
    base,
    accent.filete,
    accent.foco,
    'shadow-sm hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2',
  )

  if (mod.external) {
    return (
      <a
        href={mod.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${mod.title} (se abre en una pestaña nueva)`}
        className={interactiva}
      >
        {cuerpo}
      </a>
    )
  }

  return (
    <Link href={mod.href} aria-label={mod.title} className={interactiva}>
      {cuerpo}
    </Link>
  )
}
