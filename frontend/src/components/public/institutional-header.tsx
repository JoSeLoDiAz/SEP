// Header institucional: SENA | SEP | Ministerio de Trabajo + fecha
import Image from 'next/image'
import { CurrentDate } from './current-date'

function SenaLogo() {
  return (
    <Image
      src="/images/sena-logo.svg"
      alt="SENA"
      width={90}
      height={90}
      priority
    />
  )
}

function TrabajoLogo() {
  return (
    <Image
      src="/images/layout_set_logo_mintrabajo.png"
      alt="Ministerio del Trabajo"
      width={140}
      height={80}
      priority
      className="object-contain"
    />
  )
}


export function InstitutionalHeader() {
  return (
    <header className="w-full bg-white border-b border-neutral-200 py-3 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* SENA — más pequeño en móvil */}
        <div className="flex-shrink-0">
          <Image src="/images/sena-logo.svg" alt="SENA" width={90} height={90} priority
            className="w-12 h-12 sm:w-16 sm:h-16 md:w-[90px] md:h-[90px] object-contain" />
        </div>

        {/* Separador */}
        <div className="w-px h-10 sm:h-14 bg-neutral-200 flex-shrink-0" />

        {/* Título — escala en móvil */}
        <div className="flex-1 text-center px-1">
          <h1 className="text-cerulean-500 text-sm sm:text-lg md:text-2xl font-extrabold leading-tight tracking-wide uppercase">
            Sistema Especializado de
          </h1>
          <h1 className="text-cerulean-500 text-sm sm:text-lg md:text-2xl font-extrabold leading-tight tracking-wide uppercase">
            Proyectos — SEP
          </h1>
        </div>

        {/* Fecha + Trabajo */}
        <div className="flex flex-col items-end gap-1 sm:gap-2 flex-shrink-0">
          <CurrentDate />
          <Image src="/images/layout_set_logo_mintrabajo.png" alt="Ministerio del Trabajo"
            width={140} height={80} priority
            className="w-20 sm:w-28 md:w-[140px] object-contain h-auto" />
        </div>
      </div>
    </header>
  )
}
