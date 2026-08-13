import { FacebookIcon, InstagramIcon, LinkedinIcon, MapPin, MessageCircle, Phone, PhoneCall, Radio, Users, X, YoutubeIcon } from 'lucide-react'
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

const socialLinks = [
  { icon: FacebookIcon,   label: '@SENA',          href: 'https://www.facebook.com/SENA/' },
  { icon: X,              label: '@SENACOMUNICA',  href: 'https://x.com/SENAComunica' },
  { icon: InstagramIcon,  label: '@SENACOMUNICA',  href: 'https://www.instagram.com/senacomunica/' },
  { icon: YoutubeIcon,    label: '@SENATV',        href: 'https://www.youtube.com/user/SENATV' },
  { icon: Radio,          label: 'SENA-Ra',        href: 'https://sonic.paulatina.co/8176/stream' },
  { icon: LinkedinIcon,   label: 'SENA',           href: 'https://www.linkedin.com/school/servicio-nacional-de-aprendizaje-sena-/' },
  { icon: TikTokIcon,     label: '@senacomunica_', href: 'https://www.tiktok.com/@senacomunica_' },
]

const directorioHref = '/es-co/sena/Paginas/directorio.aspx'

const legalLinks = [
  { label: 'Directorio SENA',                                    href: directorioHref },
  { label: 'PQRS',                                               href: 'http://sciudadanos.sena.edu.co/SolicitudIndex.aspx' },
  { label: 'Chat en línea',                                      href: '/es-co/ciudadano/Paginas/chat.aspx' },
  { label: 'Denuncias por actos de corrupción',                  href: '/es-co/ciudadano/Paginas/Denuncias_Corrupcion.aspx' },
  { label: 'Notificaciones judiciales',                          href: '/es-co/transparencia/Paginas/mecanismosContacto.aspx#notificacionesJudiciales' },
  { label: 'Mapa del sitio',                                     href: '/es-co/Paginas/mapaSitio.aspx' },
]

const legalLinks2 = [
  { label: 'Derechos de autor y/o autorización de uso sobre contenidos', href: '/es-co/Paginas/politicasCondicionesUso.aspx#derechoAutor' },
  { label: 'Política de Tratamiento para Protección de Datos Personales', href: '/es-co/transparencia/Paginas/habeas_data.aspx' },
  { label: 'Política de seguridad y privacidad de la información',        href: 'http://compromiso.sena.edu.co/index.php?text=inicio&id=27' },
]

const enlaceClaro =
  'text-white/80 transition hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500'

function TituloColumna({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold text-white">
      {children}
      <span aria-hidden="true" className="mx-auto mt-2 block h-0.5 w-10 rounded-full bg-lime-500 lg:mx-0" />
    </h3>
  )
}

function EnlacesLegales({ items, label }: { items: { label: string; href: string }[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        {items.map(({ label: texto, href }, i) => (
          <li key={href} className="flex items-center gap-2">
            <a href={href} target="_blank" rel="noreferrer" className={enlaceClaro}>
              {texto}
            </a>
            {i < items.length - 1 && <span aria-hidden="true" className="text-white/30">|</span>}
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function PublicFooter() {
  return (
    <footer>
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

      {/* Bloque institucional azul */}
      <div className="bg-cerulean-500">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:gap-12 lg:px-8">

          {/* Identidad + sellos */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <Image
              src="/images/sena-logo.svg"
              alt="SENA"
              width={120}
              height={120}
              className="h-20 w-20 object-contain brightness-0 invert"
            />
            <p className="mt-4 text-sm font-bold uppercase leading-snug text-white">
              Servicio Nacional de Aprendizaje SENA
            </p>
            <p className="text-sm font-semibold uppercase text-white/70">Dirección General</p>
            {/* el png de los sellos es oscuro: sobre azul necesita fondo blanco */}
            <div className="mt-6 rounded-xl bg-white px-4 py-3">
              <Image
                src="/images/normas-iso-logos.png"
                alt="Normas ISO"
                width={220}
                height={110}
                className="h-14 w-auto object-contain sm:h-16"
              />
            </div>
          </div>

          {/* Atención presencial */}
          <div className="text-center lg:text-left">
            <TituloColumna>Atención presencial</TituloColumna>
            <ul className="mt-4 space-y-3 text-xs leading-relaxed text-white/80">
              <li className="flex justify-center gap-2 lg:justify-start">
                <MapPin size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-lime-500" />
                <span>Calle 57 No. 8 – 69 Bogotá D.C. (Cundinamarca), Colombia</span>
              </li>
              <li className="flex justify-center gap-2 lg:justify-start">
                <Users size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-lime-500" />
                <span>El SENA brinda atención presencial en las 33 Regionales y 118 Centros de Formación</span>
              </li>
              <li className="flex justify-center gap-2 lg:justify-start">
                <Phone size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-lime-500" />
                <span>
                  Horarios de atención por sede en el{' '}
                  <a href={directorioHref} target="_blank" rel="noreferrer" className={enlaceClaro}>
                    Directorio SENA
                  </a>
                </span>
              </li>
            </ul>
          </div>

          {/* Líneas y redes */}
          <div className="text-center lg:text-left">
            <TituloColumna>Líneas de atención</TituloColumna>
            <ul className="mt-4 space-y-3 text-xs text-white/80">
              <li className="flex justify-center gap-2 lg:justify-start">
                <PhoneCall size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-lime-500" />
                <span>
                  Bogotá{' '}
                  <a href="tel:+576017366060" className={enlaceClaro}>(+57) 601 736 60 60</a>
                </span>
              </li>
              <li className="flex justify-center gap-2 lg:justify-start">
                <Phone size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-lime-500" />
                <span>
                  Línea gratuita{' '}
                  <a href="tel:018000910270" className={enlaceClaro}>018000 910270</a>
                </span>
              </li>
              <li className="flex justify-center gap-2 lg:justify-start">
                <MessageCircle size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-lime-500" />
                <span>WhatsApp <span className="font-semibold text-white">3112545028</span></span>
              </li>
            </ul>

            <div className="mt-8">
              <TituloColumna>Síguenos en redes</TituloColumna>
              <nav aria-label="Redes sociales del SENA" className="mt-4">
                <ul className="flex flex-wrap justify-center gap-2 lg:justify-start">
                  {socialLinks.map(({ icon: Icon, label, href }) => (
                    <li key={href}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        title={label}
                        className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-lime-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
                      >
                        <span aria-hidden="true" className="shrink-0">
                          <Icon size={14} />
                        </span>
                        <span>{label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        </div>

        {/* Legales */}
        <div className="border-t border-white/15">
          <div className="mx-auto max-w-7xl space-y-2 px-4 py-6 text-center text-[11px] sm:px-6 lg:px-8">
            <EnlacesLegales items={legalLinks} label="Atención a la ciudadanía" />
            <EnlacesLegales items={legalLinks2} label="Políticas y condiciones de uso" />
            <p className="border-t border-white/10 pt-4 text-white/60">
              © Equipo TIC — GGPC - DSNFT - SENA {new Date().getFullYear()} | v1.0 (Prueba)
            </p>
          </div>
        </div>
      </div>

      {/* Barra inferior: Marca Colombia + GOV.CO */}
      <div className="bg-[#015dca] py-2 px-4 flex items-center justify-center gap-4">
        <Image
          src="/images/channels-616_marca_colombia.png"
          alt="Colombia"
          width={20}
          height={20}
          className="object-contain"
        />
        <div className="w-px h-5 bg-white/30" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/govco.svg"
          alt="GOV.CO"
          className="h-5 w-auto object-contain"
        />
      </div>
    </footer>
  )
}
