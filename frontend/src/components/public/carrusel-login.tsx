'use client'

import { useEffect, useState } from 'react'

export type LaminaLogin = {
  id: string
  titulo: string
  texto: string
  /** 1200x1500 (4:5). Sin ella queda el color de marca. */
  imagen?: string
  fondo: 'cerulean' | 'purpura' | 'green'
}

const FONDO: Record<LaminaLogin['fondo'], string> = {
  cerulean: 'bg-gradient-to-br from-cerulean-500 to-cerulean-700',
  purpura: 'bg-gradient-to-br from-purpura-500 to-purpura-700',
  green: 'bg-gradient-to-br from-green-500 to-green-700',
}

const PAUSA_MS = 5000

export function CarruselLogin({ laminas }: { laminas: LaminaLogin[] }) {
  const [actual, setActual] = useState(0)
  const [quieto, setQuieto] = useState(false)

  // el panel de accesibilidad marca html[data-reduced-motion]; ahi no rota solo
  useEffect(() => {
    const revisar = () => setQuieto(document.documentElement.dataset.reducedMotion === 'true')
    revisar()
    const obs = new MutationObserver(revisar)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (quieto || laminas.length < 2) return
    const t = setInterval(() => setActual(i => (i + 1) % laminas.length), PAUSA_MS)
    return () => clearInterval(t)
  }, [quieto, laminas.length])

  return (
    <div
      className="relative isolate h-44 overflow-hidden lg:h-auto"
      aria-roledescription="carrusel"
      aria-label="Sobre el SEP"
    >
      {laminas.map((l, i) => (
        <div
          key={l.id}
          aria-hidden={i !== actual}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === actual ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className={`absolute inset-0 ${FONDO[l.fondo]}`} />
          {/* fondo CSS y no next/image: la foto es decorativa y asi no depende de la carga diferida */}
          {l.imagen && (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${l.imagen})` }}
            />
          )}
          {/* velo: sostiene el texto sobre cualquier foto */}
          <div className="absolute inset-0 bg-gradient-to-t from-cerulean-500/95 via-cerulean-500/50 to-transparent" />

          <div className="relative flex h-full flex-col justify-end p-6 lg:p-10">
            <h2 className="text-xl font-bold leading-tight text-white lg:text-3xl">{l.titulo}</h2>
            <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-white/85 lg:text-sm">{l.texto}</p>
          </div>
        </div>
      ))}

      <ul className="absolute bottom-4 left-6 z-10 flex gap-1.5 lg:left-10">
        {laminas.map((l, i) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => setActual(i)}
              aria-label={`Ver ${l.titulo}`}
              aria-current={i === actual}
              className={`h-1.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                i === actual ? 'w-6 bg-lime-500' : 'w-1.5 bg-white/50 hover:bg-white/80'
              }`}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
