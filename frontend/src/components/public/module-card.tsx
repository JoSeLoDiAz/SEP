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
const ACCENT: Record<ModuleAccent, { franja: string; velo: string; enlace: string; foco: string; borde: string }> = {
  lime: {
    franja: 'bg-gradient-to-br from-lime-500 to-green-500',
    velo: 'bg-gradient-to-t from-lime-600/85 via-lime-600/40 to-transparent',
    enlace: 'text-lime-600',
    foco: 'focus-visible:outline-lime-500',
    borde: 'group-hover:border-lime-500',
  },
  green: {
    franja: 'bg-gradient-to-br from-green-500 to-green-700',
    velo: 'bg-gradient-to-t from-green-700/85 via-green-700/40 to-transparent',
    enlace: 'text-green-500',
    foco: 'focus-visible:outline-green-500',
    borde: 'group-hover:border-green-500',
  },
  cerulean: {
    franja: 'bg-gradient-to-br from-cerulean-500 to-cerulean-700',
    velo: 'bg-gradient-to-t from-cerulean-500/85 via-cerulean-500/40 to-transparent',
    enlace: 'text-cerulean-500',
    foco: 'focus-visible:outline-cerulean-500',
    borde: 'group-hover:border-cerulean-500',
  },
  purpura: {
    franja: 'bg-gradient-to-br from-purpura-500 to-purpura-700',
    velo: 'bg-gradient-to-t from-purpura-500/85 via-purpura-500/40 to-transparent',
    enlace: 'text-purpura-500',
    foco: 'focus-visible:outline-purpura-500',
    borde: 'group-hover:border-purpura-500',
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
  /** 1000x400 (5:2). Ocupa la cabecera; sin ella queda el color. */
  imagen?: string
  external?: boolean
  disabled?: boolean
  /** ocupa toda la fila */
  ancha?: boolean
}

export function ModuleCard({ mod }: { mod: ModuleDef }) {
  const Icon = ICONS[mod.icon]
  const accent = ACCENT[mod.accent]

  const base = cn(
    'group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all duration-200',
    mod.ancha && 'sm:col-span-2 lg:col-span-3',
  )

  const cabecera = (
    <div
      className={cn(
        'relative aspect-[5/2] overflow-hidden',
        mod.disabled ? 'bg-neutral-300' : !mod.imagen && accent.franja,
      )}
    >
      {mod.imagen && (
        <>
          <Image
            src={mod.imagen}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 380px"
            className={cn(
              'object-cover transition-transform duration-300',
              !mod.disabled && 'group-hover:scale-105',
              mod.disabled && 'grayscale',
            )}
          />
          {/* velo de color: sostiene el icono blanco sobre cualquier foto */}
          <div className={cn('absolute inset-0', accent.velo)} />
        </>
      )}

      {!mod.imagen && (
        <Icon
          size={104}
          strokeWidth={1.25}
          aria-hidden="true"
          className="absolute -right-3 -top-4 text-white/20 transition-transform duration-300 group-hover:scale-110"
        />
      )}

      <Icon
        size={28}
        strokeWidth={2}
        aria-hidden="true"
        className="absolute bottom-4 left-5 text-white drop-shadow"
      />
    </div>
  )

  const cuerpo = (
    <>
      {cabecera}

      <div className="flex flex-1 flex-col p-5">
        <h3 className={cn('text-[15px] font-bold leading-snug', mod.disabled ? 'text-neutral-400' : 'text-cerulean-500')}>
          {mod.title}
        </h3>

        <p className={cn('mt-1.5 text-[13px] leading-snug', mod.disabled ? 'text-neutral-400' : 'text-neutral-500')}>
          {mod.description}
        </p>

        {mod.disabled ? (
          <span className="mt-4 inline-flex w-fit items-center rounded-full bg-neutral-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
            Pronto
          </span>
        ) : (
          <span className={cn('mt-auto inline-flex items-center gap-1.5 pt-4 text-[13px] font-semibold', accent.enlace)}>
            {mod.cta ?? 'Ir'}
            {mod.external ? (
              <ExternalLink size={13} aria-hidden="true" />
            ) : (
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
            )}
          </span>
        )}
      </div>
    </>
  )

  if (mod.disabled) {
    return (
      <div aria-disabled="true" className={cn(base, 'cursor-default bg-neutral-50')}>
        {cuerpo}
      </div>
    )
  }

  const interactiva = cn(
    base,
    accent.borde,
    accent.foco,
    'shadow-sm hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2',
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
