import type { LucideIcon } from 'lucide-react'

export function CabeceraPagina({ icono: Icono, titulo, descripcion }: {
  icono: LucideIcon
  titulo: string
  descripcion?: string
}) {
  return (
    <section className="relative isolate overflow-hidden bg-cerulean-500">
      <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10 sm:pb-20 sm:pt-12">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <Icono size={22} className="text-white" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-bold leading-tight text-white sm:text-2xl lg:text-3xl">{titulo}</h1>
        </div>
        {descripcion && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85">{descripcion}</p>
        )}
      </div>

      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-10 w-full sm:h-14"
      >
        <path d="M0,120 L0,50 Q720,140 1440,50 L1440,120 Z" fill="white" />
        <path d="M0,50 Q720,140 1440,50" fill="none" stroke="#39a900" strokeWidth="5" vectorEffect="non-scaling-stroke" />
      </svg>
    </section>
  )
}
