'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play, ShieldCheck } from 'lucide-react'

type Accion = { texto: string; href: string; externo?: boolean; principal?: boolean }

export type Lamina = {
  id: string
  antetitulo: string
  titulo: string
  texto: string
  acciones: Accion[]
  /** 2400x900. Si falta, la lámina se pinta solo con el degradado. */
  imagen?: string
}

const PAUSA_MS = 7000

export function CarruselInicio({ laminas }: { laminas: Lamina[] }) {
  const [actual, setActual] = useState(0)
  const [enPausa, setEnPausa] = useState(false)
  const [sinMovimiento, setSinMovimiento] = useState(false)
  const region = useRef<HTMLElement>(null)

  // el panel de accesibilidad marca html[data-reduced-motion]; ahi no se auto-avanza
  useEffect(() => {
    const revisar = () => setSinMovimiento(document.documentElement.dataset.reducedMotion === 'true')
    revisar()
    const obs = new MutationObserver(revisar)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] })
    return () => obs.disconnect()
  }, [])

  const ir = useCallback((i: number) => setActual((i + laminas.length) % laminas.length), [laminas.length])

  useEffect(() => {
    if (enPausa || sinMovimiento || laminas.length < 2) return
    const t = setInterval(() => setActual(i => (i + 1) % laminas.length), PAUSA_MS)
    return () => clearInterval(t)
  }, [enPausa, sinMovimiento, laminas.length])

  function teclas(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') { e.preventDefault(); ir(actual + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); ir(actual - 1) }
  }

  const autoAvanza = !enPausa && !sinMovimiento && laminas.length > 1

  return (
    <section
      ref={region}
      aria-roledescription="carrusel"
      aria-label="Destacados del portal"
      onMouseEnter={() => setEnPausa(true)}
      onMouseLeave={() => setEnPausa(false)}
      onFocus={() => setEnPausa(true)}
      onBlur={() => setEnPausa(false)}
      onKeyDown={teclas}
      className="relative isolate overflow-hidden"
    >
      {laminas.map((l, i) => (
        <Diapositiva key={l.id} lamina={l} visible={i === actual} indice={i} total={laminas.length} />
      ))}

      <Controles
        total={laminas.length}
        actual={actual}
        onIr={ir}
        autoAvanza={autoAvanza}
        onAlternar={() => setEnPausa(p => !p)}
      />

      <OlaInferior />
    </section>
  )
}

function Diapositiva({ lamina, visible, indice, total }: {
  lamina: Lamina
  visible: boolean
  indice: number
  total: number
}) {
  return (
    <div
      role="group"
      aria-roledescription="diapositiva"
      aria-label={`${indice + 1} de ${total}: ${lamina.titulo}`}
      aria-hidden={!visible}
      className={`transition-opacity duration-700 ${
        visible ? 'relative opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'
      }`}
    >
      {/* fondo solido: sin el, las laminas sin imagen se aclaran sobre el blanco de la pagina */}
      <div className="absolute inset-0 -z-20 bg-cerulean-500" />

      {lamina.imagen && (
        <Image
          src={lamina.imagen}
          alt=""
          fill
          priority={indice === 0}
          sizes="100vw"
          className="-z-10 object-cover object-center"
        />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-cerulean-500/95 via-cerulean-500/80 to-cerulean-500/40" />

      {/* misma altura en todas: si no, la pagina salta al cambiar de lamina */}
      <div className="mx-auto flex w-full min-h-[24rem] max-w-6xl flex-col justify-center gap-5 px-6 pb-28 pt-14 sm:min-h-[26rem] sm:pb-32 sm:pt-20 lg:min-h-[30rem] lg:pb-36 lg:pt-24">
        <span className="inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm sm:text-[11px]">
          <ShieldCheck size={13} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0">{lamina.antetitulo}</span>
        </span>

        <h2 className="max-w-2xl text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
          {lamina.titulo}
        </h2>

        <p className="max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">{lamina.texto}</p>

        <div className="mt-1 flex flex-wrap gap-3">
          {lamina.acciones.map(a => {
            const clase = a.principal
              ? 'inline-flex items-center gap-2 rounded-xl bg-lime-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90'
              : 'inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20'
            const contenido = (
              <>
                {a.texto}
                {a.principal && <ArrowRight size={16} aria-hidden="true" />}
              </>
            )
            return a.externo ? (
              <a
                key={a.texto}
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={visible ? undefined : -1}
                className={clase}
              >
                {contenido}
              </a>
            ) : (
              <Link key={a.texto} href={a.href} tabIndex={visible ? undefined : -1} className={clase}>
                {contenido}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Controles({ total, actual, onIr, autoAvanza, onAlternar }: {
  total: number
  actual: number
  onIr: (i: number) => void
  autoAvanza: boolean
  onAlternar: () => void
}) {
  if (total < 2) return null

  const flecha =
    'absolute top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/25 bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:block'

  return (
    <>
      <button type="button" onClick={() => onIr(actual - 1)} aria-label="Anterior" className={`${flecha} left-4`}>
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => onIr(actual + 1)} aria-label="Siguiente" className={`${flecha} right-4`}>
        <ChevronRight size={20} aria-hidden="true" />
      </button>

      <div className="absolute inset-x-0 bottom-14 z-20 mx-auto flex w-full max-w-6xl items-center gap-3 px-6 sm:bottom-16 lg:bottom-20">
        <ul className="flex items-center gap-2">
          {Array.from({ length: total }, (_, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onIr(i)}
                aria-label={`Ir a la diapositiva ${i + 1}`}
                aria-current={i === actual}
                className={`h-2 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  i === actual ? 'w-7 bg-lime-500' : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
              />
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onAlternar}
          aria-label={autoAvanza ? 'Pausar el carrusel' : 'Reanudar el carrusel'}
          className="rounded-full border border-white/25 bg-white/10 p-1.5 text-white backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {autoAvanza ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
        </button>
      </div>
    </>
  )
}

function OlaInferior() {
  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 z-10 h-14 w-full sm:h-20 lg:h-24"
    >
      <path d="M0,120 L0,40 Q720,140 1440,40 L1440,120 Z" fill="white" />
      <path d="M0,40 Q720,140 1440,40" fill="none" stroke="#39a900" strokeWidth="6" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
