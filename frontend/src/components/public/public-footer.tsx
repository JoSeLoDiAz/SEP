import { FacebookIcon, InstagramIcon, LinkedinIcon, MessageCircle, Radio, X, YoutubeIcon } from 'lucide-react'
import Image from 'next/image'
import { MinisteriosMarquee } from './ministerios-marquee'

function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
    </svg>
  )
}

const sectorTrabajo = [
  { label: 'Ministerio del Trabajo',    src: '/images/iMinTrabajo.png', href: 'http://www.mintrabajo.gov.co/' },
  { label: 'Organizaciones Solidarias', src: '/images/iOss.png',        href: 'http://www.orgsolidarias.gov.co/' },
  { label: 'Servicio de Empleo',        src: '/images/iEmpleo.png',     href: 'http://unidad.serviciodeempleo.gov.co/' },
  { label: 'SuperSubsidio',             src: '/images/iSuperSubsidio.png', href: 'http://www.ssf.gov.co/' },
  { label: 'Colpensiones',              src: '/images/iColpensiones.png',  href: 'http://www.colpensiones.gov.co/' },
]

const ministerios = [
  { label: 'Presidencia',      src: '/images/ministerios/logo_presidencia.png', href: 'http://es.presidencia.gov.co/' },
  { label: 'Vicepresidencia',  src: '/images/ministerios/logo_presidencia.png', href: 'http://www.vicepresidencia.gov.co/' },
  { label: 'MinJusticia',      src: '/images/ministerios/minjusticia.png',      href: 'http://www.minjusticia.gov.co/' },
  { label: 'MinDefensa',       src: '/images/ministerios/mindefensa.svg',       href: 'http://www.mindefensa.gov.co/' },
  { label: 'MinInterior',      src: '/images/ministerios/mininterior.png',      href: 'http://www.mininterior.gov.co/' },
  { label: 'MinRelaciones',    src: '/images/ministerios/minrelaciones.png',    href: 'http://www.cancilleria.gov.co/' },
  { label: 'MinHacienda',      src: '/images/ministerios/minhacienda.png',      href: 'http://www.minhacienda.gov.co/' },
  { label: 'MinEnergía',       src: '/images/ministerios/minenergia.png',       href: 'http://www.minminas.gov.co/' },
  { label: 'MinComercio',      src: '/images/ministerios/mincomercio.png',      href: 'http://www.mincit.gov.co/' },
  { label: 'MinEducación',     src: '/images/ministerios/mineducacion.png',     href: 'http://www.mineducacion.gov.co/' },
  { label: 'MinCultura',       src: '/images/ministerios/mincultura.png',       href: 'http://www.mincultura.gov.co/' },
  { label: 'MinAgricultura',   src: '/images/ministerios/minagricultura.png',   href: 'https://www.minagricultura.gov.co/' },
  { label: 'MinAmbiente',      src: '/images/ministerios/minambiente.png',      href: 'http://www.minambiente.gov.co/' },
  { label: 'MinTransporte',    src: '/images/ministerios/mintransporte.png',    href: 'http://www.mintransporte.gov.co/' },
  { label: 'MinVivienda',      src: '/images/ministerios/minvivienda.png',      href: 'http://www.minvivienda.gov.co/' },
  { label: 'MinTrabajo',       src: '/images/ministerios/mintrabajo.png',       href: 'http://www.mintrabajo.gov.co/' },
  { label: 'MinSalud',         src: '/images/ministerios/Logo-MinSalud.png',    href: 'http://www.minsalud.gov.co/' },
  { label: 'Urna de Cristal',  src: '/images/ministerios/urna.png',            href: 'http://www.urnadecristal.gov.co/' },
  { label: 'MinTic',           src: '/images/ministerios/mintic.svg',           href: 'http://www.mintic.gov.co/' },
]

// El nombre de la red va en el aria-label: sin el, Instagram y X quedan como
// dos enlaces «@SENACOMUNICA» identicos para un lector de pantalla.
const socialLinks = [
  { icon: FacebookIcon,   red: 'Facebook',          label: '@SENA',          href: 'https://www.facebook.com/SENA/' },
  { icon: InstagramIcon,  red: 'Instagram',         label: '@SENACOMUNICA',  href: 'https://www.instagram.com/senacomunica/' },
  { icon: YoutubeIcon,    red: 'YouTube',           label: '@SENATV',        href: 'https://www.youtube.com/user/SENATV' },
  { icon: X,              red: 'X (antes Twitter)', label: '@SENACOMUNICA',  href: 'https://x.com/SENAComunica' },
  { icon: MessageCircle,  red: 'WhatsApp',          label: '305 809 24 44',  href: 'https://wa.me/573058092444' },
  { icon: Radio,          red: 'Emisora SENA-Ra',   label: 'SENA-Ra',        href: 'https://sonic.paulatina.co/8176/stream' },
  { icon: LinkedinIcon,   red: 'LinkedIn',          label: 'SENA',           href: 'https://www.linkedin.com/school/servicio-nacional-de-aprendizaje-sena-/' },
  { icon: TikTokIcon,     red: 'TikTok',            label: '@senacomunica_', href: 'https://www.tiktok.com/@senacomunica_' },
]

// Las .aspx del portal viejo siguen vivas, pero mudadas a historico.sena.edu.co:
// en relativo apuntaban a este mismo host y morian en 404.
const PORTAL = 'https://www.sena.edu.co'
const HISTORICO = 'https://historico.sena.edu.co'

const directorioHref = `${PORTAL}/la-entidad/directorio-regionales?vista=lista&regional=bogota`

// El pie de la referencia agrupa los enlaces en filas: la primera va sola y las
// demas se reparten en dos bloques que envuelven.
const enlacesAtencion = [
  { label: 'PQRS',                              href: 'https://sciudadanos.sena.edu.co/SolicitudIndex.aspx' },
  { label: 'Chat en línea',                     href: `${HISTORICO}/es-co/ciudadano/Paginas/chat.aspx` },
  { label: 'Denuncias por actos de corrupción', href: `${HISTORICO}/es-co/ciudadano/Paginas/Denuncias_Corrupcion.aspx` },
  { label: 'Mapa del sitio',                    href: `${PORTAL}/mapa-del-sitio` },
  { label: 'Notificaciones judiciales',         href: `${PORTAL}/transparencia#transparency-10` },
]

const enlacesPoliticas = [
  { label: 'Derechos de autor y/o autorización de uso sobre contenidos', href: `${HISTORICO}/es-co/Paginas/politicasCondicionesUso.aspx#derechoAutor` },
  { label: 'Política de Tratamiento para Protección de Datos Personales', href: `${HISTORICO}/es-co/transparencia/Paginas/habeas_data.aspx` },
  // compromiso.sena.edu.co ya no responde: la politica vive en el portal nuevo.
  { label: 'Política de seguridad y privacidad de la información',        href: `${PORTAL}/transparencia/politicas-y-lineamientos` },
]

const datosSede: { etiqueta: string; valor: string; tel?: string }[] = [
  { etiqueta: 'Dirección',            valor: 'Calle 57 No. 8 - 69 Bogotá D.C. (Cundinamarca), Colombia' },
  { etiqueta: 'Código postal',        valor: '110231' },
  { etiqueta: 'Horario de atención',  valor: '8:00 a.m. a 12:30 p.m. y 2:00 p.m. a 5:30 p.m.' },
  { etiqueta: 'Atención presencial',  valor: '33 Regionales y 118 Centros de Formación' },
  { etiqueta: 'Teléfono conmutador',  valor: '+57 601 736 6060', tel: '+576017366060' },
  { etiqueta: 'Línea gratuita',       valor: '018000 910270',    tel: '018000910270' },
  { etiqueta: 'Línea anticorrupción', valor: '157',              tel: '157' },
]

const enlaceClaro =
  'text-white underline-offset-2 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500'

function Enlaces({ items }: { items: { label: string; href: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 lg:gap-x-4 lg:gap-y-1">
      {items.map(({ label, href }) => (
        <a key={href} href={href} target="_blank" rel="noreferrer" className={enlaceClaro}>
          {label}
        </a>
      ))}
    </div>
  )
}

export function PublicFooter() {
  return (
    <footer aria-label="Pie de página SENA">
      {/* Sector Trabajo — tarjeta blanca sobre gris para que flote */}
      <section aria-labelledby="pie-sector-trabajo" className="border-t border-neutral-200 bg-neutral-50 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 id="pie-sector-trabajo" className="text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-500 sm:text-left">
            Sector Trabajo
          </h2>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-8 sm:gap-10 lg:gap-14">
            {sectorTrabajo.map(({ label, src, href }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  title={label}
                  className="block grayscale transition hover:scale-105 hover:grayscale-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-500"
                >
                  <Image src={src} alt={label} width={200} height={80} className="h-12 w-auto object-contain sm:h-16" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Gobierno — ministerios en color */}
      <div className="bg-neutral-100 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-6 items-center justify-center sm:justify-start">
          {/* Logo Gobierno del Cambio */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <Image src="/images/logoGovCol.png" alt="Gobierno de Colombia" width={110} height={110} className="object-contain" />
          </div>
          {/* Separador vertical visible en sm+ */}
          <div className="hidden sm:block w-px self-stretch bg-neutral-300" />
          <MinisteriosMarquee entidades={ministerios} />
        </div>
      </div>

      {/* Bloque institucional — tarjeta azul flotando sobre la franja verde,
          igual que el pie nuevo de sena.edu.co */}
      <div className="bg-[linear-gradient(to_bottom,#ffffff_0%,#ffffff_30%,#39a900_30%,#39a900_100%)] px-4 py-10">
        <div className="relative mx-auto max-w-[96rem] overflow-hidden rounded-lg px-[1.7rem] py-14 shadow-lg">
          {/* textura geometrica sobre el degradado azul */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage:
                'url("/images/fondo-geometrico-sena.webp"), linear-gradient(to right, #010f1f 0%, #003366 100%)',
            }}
          />

          {/* Identidad + sede principal */}
          <div className="relative flex flex-col items-stretch gap-8 px-4 text-sm text-white md:text-base lg:flex-row lg:justify-between lg:gap-10 lg:px-8">
            <div className="flex w-full flex-1 flex-col gap-4 text-left lg:max-w-[70%]">
              <p className="text-left text-[clamp(0.95rem,4.2vw,1.35rem)] font-semibold uppercase leading-snug text-white lg:hidden">
                Servicio Nacional de Aprendizaje <b className="font-bold">SENA</b>
              </p>

              <div className="flex w-full flex-row items-center justify-between gap-4 lg:mb-2 lg:w-auto lg:justify-start lg:gap-4">
                <Image
                  src="/images/sena-logo.svg"
                  alt="SENA"
                  width={120}
                  height={114}
                  className="h-10 w-auto shrink-0 drop-shadow-[0_1px_3px_rgb(0_0_0/0.45)] md:h-12"
                />
                <Image
                  src="/images/sector-trabajo-logo.webp"
                  alt="Sector Trabajo — Gobierno de Colombia"
                  width={676}
                  height={472}
                  className="h-14 w-auto shrink-0 object-contain mix-blend-screen lg:hidden"
                />
                <p className="hidden text-[25px] font-semibold uppercase leading-snug text-white lg:block lg:max-w-[min(100%,28rem)]">
                  Servicio Nacional de Aprendizaje <b className="font-bold">SENA</b>
                </p>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wide text-white/70 md:text-sm">Dirección General</p>

              <div>
                <p className="text-base font-bold leading-snug md:text-lg">Sede principal</p>
              </div>

              <div className="[overflow-wrap:anywhere]">
                {datosSede.map(({ etiqueta, valor, tel }) => (
                  <p key={etiqueta} className="leading-relaxed">
                    {etiqueta}:{' '}
                    {tel ? (
                      <a href={`tel:${tel}`} className={`font-medium ${enlaceClaro}`}>
                        {valor}
                      </a>
                    ) : (
                      <span className="font-medium">{valor}</span>
                    )}
                  </p>
                ))}
                <p className="leading-relaxed">
                  Correo institucional:{' '}
                  <a
                    href="mailto:servicioalciudadano@sena.edu.co"
                    className="font-medium text-[#A4D78A] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
                  >
                    servicioalciudadano@sena.edu.co
                  </a>
                </p>
                <p className="leading-relaxed">
                  Horarios por sede en el{' '}
                  <a href={directorioHref} target="_blank" rel="noreferrer" className={enlaceClaro}>
                    Directorio SENA
                  </a>
                </p>
              </div>
            </div>

            {/* Logo Trabajo grande — solo en escritorio, el movil lo lleva arriba */}
            <div className="pointer-events-none absolute right-3 top-6 hidden lg:block xl:right-0 xl:top-8">
              <Image
                src="/images/sector-trabajo-logo.webp"
                alt=""
                aria-hidden="true"
                width={676}
                height={472}
                className="h-24 w-auto object-contain mix-blend-screen md:h-[11rem]"
              />
            </div>
          </div>

          {/* Redes, enlaces institucionales y certificaciones */}
          <div className="relative px-4 pt-8 text-xs font-semibold text-white md:text-sm lg:px-6">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-x-8 lg:gap-y-6">
              {/* Redes */}
              <nav aria-label="Redes sociales del SENA" className="order-1 min-w-0 lg:col-start-1 lg:row-start-1">
                <ul className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-3">
                  {socialLinks.map(({ icon: Icon, red, label, href }) => (
                    <li key={href}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${red}: ${label}`}
                        className="flex items-center gap-3 rounded outline-none focus-visible:ring-2 focus-visible:ring-white/80 sm:gap-2"
                      >
                        <span aria-hidden="true" className="shrink-0 text-[#6CC5FF]">
                          <Icon size={20} />
                        </span>
                        <span className="hover:underline">{label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Enlaces institucionales */}
              <div className="order-3 min-w-0 border-t border-white/15 pt-4 lg:order-2 lg:col-start-1 lg:row-start-2 lg:border-0 lg:pt-0 lg:pl-[10px]">
                <p className="mb-3 font-semibold text-white lg:hidden">Información institucional</p>
                <nav aria-label="Atención a la ciudadanía y políticas" className="flex flex-col gap-3 lg:gap-2">
                  <a href={directorioHref} target="_blank" rel="noreferrer" className={enlaceClaro}>
                    Directorio Institucional
                  </a>
                  <Enlaces items={enlacesAtencion} />
                  <Enlaces items={enlacesPoliticas} />
                </nav>
              </div>

              {/* Certificaciones ICONTEC / IQNET */}
              <div className="order-2 flex min-w-0 justify-center lg:order-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-w-[14rem] lg:shrink-0">
                <Image
                  src="/images/certificaciones-icontec-iqnet.webp"
                  alt="Certificaciones ISO de ICONTEC"
                  width={964}
                  height={312}
                  className="h-auto w-full max-w-[22rem] object-contain sm:h-32 sm:w-auto sm:max-w-full md:h-40 lg:h-44 xl:h-[8.75rem]"
                />
              </div>
            </div>

            <p className="mt-8 border-t border-white/10 pt-4 text-center text-[11px] font-normal text-white/60">
              © Equipo TIC — GGPC - DSNFT - SENA {new Date().getFullYear()} | v1.0 (Prueba)
            </p>
          </div>
        </div>
      </div>

      {/* Barra inferior GOV.CO */}
      <div className="bg-[#3366cc] px-4">
        <div className="mx-auto flex max-w-[96rem] justify-start py-2 pl-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/govco.svg" alt="Logo Gobierno de Colombia" className="h-6 w-auto" loading="lazy" />
        </div>
      </div>
    </footer>
  )
}
