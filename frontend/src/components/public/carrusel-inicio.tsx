'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play, ShieldCheck } from 'lucide-react'

type Accion = { texto: string; href: string; externo?: boolean; principal?: boolean }

/** solo tonos oscuros del manual: sobre lime-500 el texto blanco no contrasta */
export type AcentoLamina = 'cerulean' | 'purpura' | 'green'

/** el texto puede ir a un lado u otro; el velo oscurece ese mismo lado */
export type LadoLamina = 'izquierda' | 'derecha'

/** como es el fondo del banner donde cae el texto: define si el texto va claro u oscuro */
export type TemaLamina = 'oscuro' | 'claro'

// clases literales: tailwind no compila nombres armados en ejecucion
const FONDO: Record<AcentoLamina, { solido: string; izquierda: string; derecha: string }> = {
  cerulean: {
    solido: 'bg-cerulean-500',
    izquierda: 'bg-gradient-to-r from-cerulean-500 via-cerulean-500/70 via-40% to-transparent',
    derecha: 'bg-gradient-to-l from-cerulean-500 via-cerulean-500/70 via-40% to-transparent',
  },
  purpura: {
    solido: 'bg-purpura-500',
    izquierda: 'bg-gradient-to-r from-purpura-500 via-purpura-500/70 via-40% to-transparent',
    derecha: 'bg-gradient-to-l from-purpura-500 via-purpura-500/70 via-40% to-transparent',
  },
  green: {
    solido: 'bg-green-500',
    izquierda: 'bg-gradient-to-r from-green-500 via-green-500/70 via-40% to-transparent',
    derecha: 'bg-gradient-to-l from-green-500 via-green-500/70 via-40% to-transparent',
  },
}

// los banners llegan ya compuestos, con su propio fondo. El velo toma ese mismo
// color, asi que sobre la zona libre es invisible y solo entra a tapar si el arte
// se corre hacia el texto.
//
// Arranca transparente y no en el borde: los banners traen iconos circulares
// pegados al canto (izquierda en los oscuros, derecha en los claros) y un velo
// que empiece en 0% los aplasta. Sube recien pasado el 10% del ancho, tiene su
// punto fuerte donde cae el titulo y se apaga antes de llegar al arte del otro lado.
const VELO: Record<TemaLamina, { izquierda: string; derecha: string }> = {
  oscuro: {
    izquierda: 'bg-gradient-to-r from-transparent from-10% via-cerulean-500/85 via-32% to-transparent to-70%',
    derecha: 'bg-gradient-to-l from-transparent from-10% via-cerulean-500/85 via-32% to-transparent to-70%',
  },
  claro: {
    izquierda: 'bg-gradient-to-r from-transparent from-10% via-white/85 via-32% to-transparent to-70%',
    derecha: 'bg-gradient-to-l from-transparent from-10% via-white/85 via-32% to-transparent to-70%',
  },
}

// El banner es 8:3 pero el hero es mas bajo y mas cuadrado en movil, asi que
// object-cover recorta por los lados y mete el arte debajo del texto. Corriendo
// el encuadre hacia la zona libre, lo que queda a la vista en pantalla angosta
// es el fondo vacio y no la ilustracion. En pantalla ancha no recorta a lo ancho,
// asi que esto no la afecta.
const ENCUADRE: Record<LadoLamina, string> = {
  izquierda: 'object-[25%_center]',
  derecha: 'object-[75%_center]',
}

// El texto se maqueta en pixeles (contenedor centrado de 72rem) pero la zona
// libre del banner esta en porcentaje del ancho. Los dos sistemas se desfasan
// entre 768px y 1366px y ahi el titulo se montaba sobre los iconos del costado.
// Con max() la sangria se mide en % mientras el contenedor no alcanza su ancho
// tope, y vuelve a alinearse con el resto de la pagina cuando ya lo alcanzo.
// El padding vive DENTRO del contenedor, que ya viene centrado: hay que restarle
// ese centrado o se cuenta dos veces y el texto termina en la mitad de la lamina.
const SANGRIA: Record<LadoLamina, string> = {
  izquierda: 'md:pl-[max(3.5rem,calc(13vw-max(0px,(100vw-72rem)/2)))]',
  derecha: 'md:pr-[max(3.5rem,calc(13vw-max(0px,(100vw-72rem)/2)))]',
}

const TEXTO: Record<TemaLamina, { pildora: string; titulo: string; parrafo: string; secundario: string }> = {
  oscuro: {
    pildora: 'bg-white/15 text-white',
    titulo: 'text-white',
    parrafo: 'text-white/85',
    secundario: 'border-white/30 bg-white/10 text-white hover:bg-white/20',
  },
  claro: {
    pildora: 'bg-cerulean-500/10 text-cerulean-500',
    titulo: 'text-cerulean-500',
    parrafo: 'text-cerulean-500/80',
    secundario: 'border-cerulean-500/30 bg-white/70 text-cerulean-500 hover:bg-white',
  },
}

const CONTROL: Record<TemaLamina, { boton: string; punto: string }> = {
  oscuro: {
    boton:
      'border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/25 focus-visible:outline-white',
    punto: 'bg-white/40 hover:bg-white/70',
  },
  claro: {
    boton:
      'border-cerulean-500/20 bg-white/70 text-cerulean-500 backdrop-blur-sm hover:bg-white focus-visible:outline-cerulean-500',
    punto: 'bg-cerulean-500/25 hover:bg-cerulean-500/60',
  },
}

export type Lamina = {
  id: string
  antetitulo: string
  titulo: string
  texto: string
  acciones: Accion[]
  acento?: AcentoLamina
  lado?: LadoLamina
  /** por defecto oscuro. 'claro' = el banner tiene fondo blanco, el texto va en navy */
  tema?: TemaLamina
  /** 2400x900. Si falta, la lámina se pinta solo con el degradado de color. */
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
        tema={laminas[actual]?.tema ?? 'oscuro'}
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
  const fondo = FONDO[lamina.acento ?? 'cerulean']
  const lado = lamina.lado ?? 'izquierda'
  const tema = lamina.tema ?? 'oscuro'
  const texto = TEXTO[tema]

  return (
    <div
      role="group"
      aria-roledescription="diapositiva"
      aria-label={`${indice + 1} de ${total}: ${lamina.titulo}`}
      aria-hidden={!visible}
      // el banner es 8:3 y su arte llega hasta el borde de arriba y el de abajo,
      // asi que cualquier recorte vertical decapita al modelo. Dandole al hero la
      // misma proporcion no hay nada que recortar. En pantallas chicas gana el
      // min-height del texto y el recorte pasa a ser lateral, que si es seguro.
      className={`aspect-[8/3] transition-opacity duration-700 ${
        visible ? 'relative opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'
      }`}
    >
      {/* fondo solido: sin el, las laminas sin imagen se aclaran sobre el blanco de la pagina */}
      <div className={`absolute inset-0 -z-20 ${lamina.imagen ? (tema === 'claro' ? 'bg-white' : 'bg-cerulean-500') : fondo.solido}`} />

      {lamina.imagen && (
        <Image
          src={lamina.imagen}
          alt=""
          fill
          priority={indice === 0}
          quality={90}
          sizes="100vw"
          className={`-z-10 object-cover ${ENCUADRE[lado]}`}
        />
      )}
      {/* con banner propio el velo solo lo protege el texto; sin banner pinta la lamina entera */}
      <div className={`absolute inset-0 -z-10 ${lamina.imagen ? VELO[tema][lado] : fondo[lado]}`} />

      {/* misma altura en todas: si no, la pagina salta al cambiar de lamina */}
      <div className={`mx-auto flex w-full min-h-[24rem] max-w-6xl px-6 pb-28 pt-14 sm:min-h-[26rem] sm:px-8 sm:pb-32 sm:pt-20 lg:min-h-[30rem] lg:pb-36 lg:pt-24 ${SANGRIA[lado]}`}>
      <div className={`flex max-w-xl flex-col justify-center gap-5 ${lado === 'derecha' ? 'ml-auto lg:text-right lg:items-end' : ''}`}>
        <span className={`inline-flex w-fit max-w-full items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm sm:text-[11px] ${texto.pildora}`}>
          <ShieldCheck size={13} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0">{lamina.antetitulo}</span>
        </span>

        <h2 className={`max-w-2xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl ${texto.titulo}`}>
          {lamina.titulo}
        </h2>

        <p className={`max-w-xl text-sm leading-relaxed sm:text-base ${texto.parrafo}`}>{lamina.texto}</p>

        <div className="mt-1 flex flex-wrap gap-3">
          {lamina.acciones.map(a => {
            const clase = a.principal
              ? 'inline-flex items-center gap-2 rounded-xl bg-lime-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90'
              : `inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold backdrop-blur-sm transition ${texto.secundario}`
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
    </div>
  )
}

function Controles({ total, actual, onIr, autoAvanza, onAlternar, tema }: {
  total: number
  actual: number
  onIr: (i: number) => void
  autoAvanza: boolean
  onAlternar: () => void
  tema: TemaLamina
}) {
  if (total < 2) return null

  const control = CONTROL[tema]
  const flecha = `absolute top-1/2 z-20 hidden -translate-y-1/2 rounded-full border p-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:block ${control.boton}`

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
                className={`h-2 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  i === actual ? 'w-7 bg-lime-500' : `w-2 ${control.punto}`
                }`}
              />
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onAlternar}
          aria-label={autoAvanza ? 'Pausar el carrusel' : 'Reanudar el carrusel'}
          className={`rounded-full border p-1.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${control.boton}`}
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
