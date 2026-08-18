import Image from 'next/image'

type Entidad = { label: string; src: string; href: string }

// la lista va duplicada: al llegar a -50% el bucle reinicia sin salto visible
export function MinisteriosMarquee({ entidades }: { entidades: Entidad[] }) {
  return (
    <div
      className="group relative flex-1 overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
      }}
    >
      <ul className="flex w-max items-center gap-10 animate-[deslizar_45s_linear_infinite] group-hover:[animation-play-state:paused]">
        {[...entidades, ...entidades].map(({ label, src, href }, i) => (
          <li key={`${label}-${i}`} className="shrink-0">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              title={label}
              aria-hidden={i >= entidades.length}
              tabIndex={i >= entidades.length ? -1 : undefined}
              className="block transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-500"
            >
              <Image
                src={src}
                alt={i >= entidades.length ? '' : label}
                width={80}
                height={40}
                className="h-10 w-auto object-contain"
              />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
