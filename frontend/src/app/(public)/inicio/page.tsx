import { FacebookWidget } from '@/components/public/facebook-widget'
import { InstagramWidget } from '@/components/public/instagram-widget'
import { ModuleCard, type ModuleDef } from '@/components/public/module-card'
import { SocialButtons } from '@/components/public/social-buttons'

const modules: ModuleDef[] = [
  {
    id: 'fce',
    image: '/images/modulos/Recurso 1.png',
    alt: 'Formación Continua Especializada — FCE',
    href: 'https://www.sena.edu.co/es-co/Empresarios/Paginas/GPC%202025/FCE%202025/FCE-2025.aspx',
    external: true,
    abbr: 'FCE',
    title: 'Formación Continua\nEspecializada',
    bg: 'from-lime-500 to-green-500',
    textColor: 'text-lime-500',
  },
  {
    id: 'feec',
    image: '/images/modulos/Recurso 2.png',
    alt: 'Formación Especializada para la Economía Campesina — FEEC',
    href: 'https://www.sena.edu.co/es-co/Empresarios/Paginas/GPC%202025/FEEC%202025/FEEC-2025.aspx',
    external: true,
    abbr: 'FEEC',
    title: 'Formación Especializada\npara la Economía Campesina',
    bg: 'from-purpura-500 to-purpura-700',
    textColor: 'text-purpura-500',
  },
  {
    id: 'campesena',
    image: '/images/modulos/Recurso 3.png',
    alt: 'CampeSENA',
    href: 'https://sena.edu.co/es-co/campesena/Paginas/index.aspx',
    external: true,
    abbr: 'Campe\nSENA',
    title: 'CampeSENA',
    bg: 'from-green-500 to-cerulean-500',
    textColor: 'text-green-500',
  },
  {
    id: 'certificados',
    image: '/images/modulos/Recurso 4.png',
    alt: 'Descargar Certificados',
    href: '/certificados',
    external: false,
    abbr: null,
    title: 'Descargar\nCertificados',
    iconName: 'Award',
    bg: 'from-cerulean-500 to-cerulean-700',
    textColor: 'text-cerulean-500',
  },
  {
    id: 'eventos',
    image: '/images/modulos/Recurso 5.png',
    alt: 'Eventos Programados',
    href: '/eventos',
    external: false,
    abbr: null,
    title: 'Eventos\nProgramados',
    iconName: 'Calendar',
    bg: 'from-celeste-500 to-cerulean-500',
    textColor: 'text-celeste-500',
  },
  {
    id: 'proximamente',
    image: '/images/modulos/Recurso 6.png',
    alt: 'Próximamente',
    href: '#',
    external: false,
    abbr: null,
    title: 'Próximamente',
    iconName: 'Megaphone',
    bg: 'from-neutral-300 to-neutral-400',
    textColor: 'text-neutral-400',
    disabled: true,
  },
]

export default function InicioPage() {
  return (
    <div className="flex flex-col">
      <section className="max-w-5xl mx-auto w-full px-6 py-10 flex flex-col gap-8">
        <div className="flex justify-center">
          <h2 className="text-green-500 text-xl font-bold border-b-4 border-green-500 pb-1">
            Gestión para la Productividad y la Competitividad
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((mod) => (
            <ModuleCard key={mod.id} mod={mod} />
          ))}
        </div>
      </section>

      <section className="w-full border-t border-neutral-100 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-6">
          <div className="flex justify-center">
            <h2 className="text-green-500 text-xl font-bold border-b-4 border-green-500 pb-1">
              Síguenos en redes
            </h2>
          </div>
          <SocialButtons />
          <div className="flex flex-col md:flex-row gap-6 w-full justify-center">
            <div className="w-full md:w-[500px] shrink-0"><FacebookWidget /></div>
            <div className="w-full md:w-[500px] shrink-0"><InstagramWidget /></div>
          </div>
        </div>
      </section>
    </div>
  )
}
