import { FacebookIcon, InstagramIcon, LinkedinIcon, Radio, X, YoutubeIcon } from 'lucide-react'
import Image from 'next/image'

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

const legalLinks = [
  { label: 'Directorio SENA',                                    href: '/es-co/sena/Paginas/directorio.aspx' },
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

export function PublicFooter() {
  return (
    <footer>
      {/* Sector Trabajo */}
      <div className="bg-white border-t border-neutral-200 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-cerulean-500 font-bold text-base mb-6 flex items-center gap-2">
            💼 Sector Trabajo
          </h3>
          <div className="flex flex-wrap justify-center gap-10 items-center">
            {sectorTrabajo.map(({ label, src, href }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" title={label}
                className="flex items-center justify-center transition-all grayscale hover:grayscale-0 hover:scale-105">
                <Image src={src} alt={label} width={200} height={80} className="object-contain h-20 w-auto" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Gobierno — ministerios en color */}
      <div className="bg-neutral-100 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-6 items-center justify-center sm:justify-start">
          {/* Logo Gobierno del Cambio */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <Image src="/images/logoGovCol.png" alt="Gobierno de Colombia" width={110} height={110} className="object-contain" />
          </div>
          {/* Separador vertical visible en sm+ */}
          <div className="hidden sm:block w-px self-stretch bg-neutral-300" />
          {/* Ministerios */}
          <div className="flex flex-wrap gap-3 items-center justify-center flex-1">
            {ministerios.map(({ label, src, href }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" title={label}
                className="hover:scale-110 transition-transform">
                <Image src={src} alt={label} width={80} height={40} className="object-contain h-10 w-auto" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Footer SENA verde */}
      <div className="bg-lime-500 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 items-center lg:items-start justify-between">

          {/* Logo SENA — centrado en móvil */}
          <div className="flex-shrink-0 flex justify-center lg:justify-start">
            <Image
              src="/images/sena-logo.svg"
              alt="SENA"
              width={120}
              height={120}
              className="object-contain brightness-0 invert"
            />
          </div>

          {/* Info SENA */}
          <div className="text-white flex-1 text-center lg:text-left">
            <p className="font-bold text-sm mb-1">SERVICIO NACIONAL DE APRENDIZAJE SENA</p>
            <p className="font-semibold text-sm mb-3">DIRECCIÓN GENERAL</p>
            <div className="text-xs space-y-1 text-white/90">
              <p>Calle 57 No. 8 – 69 Bogotá D.C. (Cundinamarca), Colombia</p>
              <p>El SENA brinda atención presencial en las 33 Regionales y 118 Centros de Formación</p>
              <p>Línea de WhatsApp: <span className="font-semibold">3112545028</span></p>
              <p>Bogotá (+57) 601 736 60 60 — Línea gratuita: 018000 910270</p>
            </div>
            {/* Redes sociales — iconos + label */}
            <div className="mt-4">
              <p className="text-white font-semibold text-sm mb-2">Síguenos en redes</p>
              <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                {socialLinks.map(({ icon: Icon, label, href }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    title={label}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-cerulean-500 hover:bg-cerulean-700 text-white transition-colors text-xs font-medium"
                  >
                    <Icon size={14} />
                    <span>{label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Normas ISO — centrado en móvil */}
          <div className="flex-shrink-0 flex items-center justify-center lg:justify-end">
            <Image
              src="/images/normas-iso-logos.png"
              alt="Normas ISO"
              width={220}
              height={110}
              className="object-contain"
            />
          </div>
        </div>

        {/* Links legales — dos filas con | */}
        <div className="max-w-7xl mx-auto mt-6 pt-4 border-t border-white/30 text-center text-xs text-white/80">
          <p className="flex flex-wrap justify-center gap-1">
            {legalLinks.map(({ label, href }, i) => (
              <span key={label}>
                <a href={href} target="_blank" rel="noreferrer" className="hover:text-white hover:underline">{label}</a>
                {i < legalLinks.length - 1 && <span className="mx-1 text-white/40">|</span>}
              </span>
            ))}
          </p>
          <p className="flex flex-wrap justify-center gap-1 mt-1">
            {legalLinks2.map(({ label, href }, i) => (
              <span key={label}>
                <a href={href} target="_blank" rel="noreferrer" className="hover:text-white hover:underline">{label}</a>
                {i < legalLinks2.length - 1 && <span className="mx-1 text-white/40">|</span>}
              </span>
            ))}
          </p>
          <div className="mt-4 border-t border-white/30" />
          <p className="mt-3 text-white/60 text-right">
            © Equipo TIC — GGPC - DSNFT - SENA {new Date().getFullYear()} | v1.0 (Prueba)
          </p>
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
          src="https://betowa.sena.edu.co/assets/logos/gov-logo-new.svg"
          alt="GOV.CO"
          className="h-5 w-auto object-contain"
        />
      </div>
    </footer>
  )
}
