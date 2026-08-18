import Image from 'next/image'
import Link from 'next/link'
import { CurrentDate } from './current-date'

export function InstitutionalHeader() {
  return (
    <header className="w-full border-b border-neutral-200 bg-white" role="banner">
      <div className="mx-auto flex w-full max-w-[100rem] items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6 lg:px-8">
        <Link href="/inicio" className="shrink-0" aria-label="SEP — Inicio">
          <Image
            src="/images/sena-logo.svg"
            alt="SENA"
            width={90}
            height={90}
            priority
            className="h-10 w-10 object-contain sm:h-14 sm:w-14 lg:h-[72px] lg:w-[72px]"
          />
        </Link>

        <div className="h-9 w-px shrink-0 bg-neutral-200 sm:h-12" />

        {/* min-w-0: deja que el titulo encoja en vez de empujar la pagina */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase leading-tight tracking-wide text-lime-500 sm:text-xs">
            Servicio Nacional de Aprendizaje
          </p>
          <h1 className="text-sm font-extrabold uppercase leading-tight tracking-wide text-cerulean-500 sm:text-lg lg:text-2xl">
            Sistema Especializado de Proyectos
          </h1>
          <p className="mt-0.5 hidden text-[11px] text-neutral-500 lg:block">
            <CurrentDate />
          </p>
        </div>

      </div>
    </header>
  )
}
