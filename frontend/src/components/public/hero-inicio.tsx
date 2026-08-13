import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ShieldCheck } from 'lucide-react'

export function HeroInicio() {
  return (
    <section className="relative isolate overflow-hidden">
      <Image
        src="/images/banner/bannerSena2-DoK8FAyn.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      {/* el degradado sostiene el texto sobre la foto: sin el, el titular se pierde */}
      <div className="absolute inset-0 bg-gradient-to-r from-cerulean-500/95 via-cerulean-500/75 to-cerulean-500/25" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 pb-24 pt-14 sm:pb-28 sm:pt-20 lg:pb-32 lg:pt-24">
        {/* max-w-full: sin el, w-fit toma el ancho del texto en una linea y desborda en movil */}
        <span className="inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm sm:text-[11px]">
          <ShieldCheck size={13} className="shrink-0" />
          <span className="min-w-0">SENA · Gestión para la Productividad y la Competitividad</span>
        </span>

        <h1 className="max-w-2xl text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
          Sistema Especializado de Proyectos
        </h1>

        <p className="max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
          Consulta convocatorias, inscríbete a eventos, descarga tus certificados
          y verifica su autenticidad.
        </p>

        <div className="mt-1 flex flex-wrap gap-3">
          <Link
            href="/certificados"
            className="inline-flex items-center gap-2 rounded-xl bg-lime-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90"
          >
            Descargar mi certificado
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/eventos"
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
          >
            Ver eventos
          </Link>
        </div>
      </div>

      <OlaInferior />
    </section>
  )
}

// separador en ola: cierra el hero contra el blanco de la pagina
function OlaInferior() {
  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 z-10 h-14 w-full sm:h-20 lg:h-24"
    >
      <path d="M0,120 L0,40 Q720,140 1440,40 L1440,120 Z" fill="white" />
      <path
        d="M0,40 Q720,140 1440,40"
        fill="none"
        stroke="#39a900"
        strokeWidth="6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
