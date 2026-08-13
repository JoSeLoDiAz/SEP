import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Award,
  Calendar,
  ExternalLink,
  GraduationCap,
  Megaphone,
  Sprout,
  Tractor,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONS = {
  GraduationCap,
  Sprout,
  Tractor,
  Award,
  Calendar,
  Megaphone,
} satisfies Record<string, LucideIcon>

export type ModuleIcon = keyof typeof ICONS
export type ModuleAccent = 'lime' | 'green' | 'cerulean' | 'purpura'

// clases literales: tailwind no compila nombres de clase armados en ejecucion
const ACCENT: Record<ModuleAccent, { disco: string; borde: string; flecha: string; foco: string }> = {
  lime: {
    disco: 'bg-lime-500',
    borde: 'group-hover:border-lime-500',
    flecha: 'group-hover:text-lime-500',
    foco: 'focus-visible:outline-lime-500',
  },
  green: {
    disco: 'bg-green-500',
    borde: 'group-hover:border-green-500',
    flecha: 'group-hover:text-green-500',
    foco: 'focus-visible:outline-green-500',
  },
  cerulean: {
    disco: 'bg-cerulean-500',
    borde: 'group-hover:border-cerulean-500',
    flecha: 'group-hover:text-cerulean-500',
    foco: 'focus-visible:outline-cerulean-500',
  },
  purpura: {
    disco: 'bg-purpura-500',
    borde: 'group-hover:border-purpura-500',
    flecha: 'group-hover:text-purpura-500',
    foco: 'focus-visible:outline-purpura-500',
  },
}

export interface ModuleDef {
  id: string
  title: string
  description: string
  href: string
  icon: ModuleIcon
  accent: ModuleAccent
  /** 16:9. Si no viene, la tarjeta se pinta solo con el disco del icono. */
  image?: string
  external?: boolean
  disabled?: boolean
}

export function ModuleCard({ mod }: { mod: ModuleDef }) {
  const Icon = ICONS[mod.icon]
  const accent = ACCENT[mod.accent]

  const base = 'group flex h-full flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-200'

  const cuerpo = (
    <>
      {mod.image && (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-100">
          <Image
            src={mod.image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={cn(
              'object-cover transition-transform duration-300',
              !mod.disabled && 'group-hover:scale-105',
              mod.disabled && 'grayscale',
            )}
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
            mod.disabled ? 'bg-neutral-300' : accent.disco,
          )}
        >
          <Icon size={22} strokeWidth={2} className="text-white" aria-hidden="true" />
        </span>

        {mod.disabled && (
          <span className="rounded-full bg-neutral-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
            Pronto
          </span>
        )}
      </div>

      <h3
        className={cn(
          'mt-4 flex items-center gap-1.5 text-base font-bold leading-snug',
          mod.disabled ? 'text-neutral-400' : 'text-cerulean-500',
        )}
      >
        {mod.title}
        {mod.external && <ExternalLink size={13} className="shrink-0 text-neutral-300" aria-hidden="true" />}
      </h3>

      <p
        className={cn(
          'mt-1 line-clamp-2 text-[13px] leading-snug',
          mod.disabled ? 'text-neutral-400' : 'text-neutral-500',
        )}
      >
        {mod.description}
      </p>

      {!mod.disabled && (
        <span className="mt-auto flex justify-end pt-4">
          <ArrowRight
            size={18}
            aria-hidden="true"
            className={cn(
              'text-neutral-300 transition-all duration-200 group-hover:translate-x-1',
              accent.flecha,
            )}
          />
        </span>
      )}
      </div>
    </>
  )

  if (mod.disabled) {
    return (
      <div aria-disabled="true" className={cn(base, 'cursor-default border-neutral-200 bg-neutral-50/60 shadow-sm')}>
        {cuerpo}
      </div>
    )
  }

  const interactiva = cn(
    base,
    'border-neutral-200 shadow-sm hover:-translate-y-1 hover:shadow-lg',
    'focus-visible:outline-2 focus-visible:outline-offset-2',
    accent.borde,
    accent.foco,
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
