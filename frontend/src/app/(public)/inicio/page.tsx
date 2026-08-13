import { FacebookWidget } from '@/components/public/facebook-widget'
import { HeroInicio } from '@/components/public/hero-inicio'
import { InstagramWidget } from '@/components/public/instagram-widget'
import { ModuleCard, type ModuleDef } from '@/components/public/module-card'
import { SocialButtons } from '@/components/public/social-buttons'

const modules: ModuleDef[] = [
  {
    id: 'fce',
    title: 'Formación Continua Especializada',
    description: 'Convocatoria para empresas y gremios que quieren formar a su talento.',
    href: 'https://www.sena.edu.co/es-co/Empresarios/Paginas/GPC%202025/FCE%202025/FCE-2025.aspx',
    icon: 'GraduationCap',
    accent: 'lime',
    external: true,
  },
  {
    id: 'feec',
    title: 'Formación Especializada para la Economía Campesina',
    description: 'Convocatoria dirigida a organizaciones y asociaciones del campo colombiano.',
    href: 'https://www.sena.edu.co/es-co/Empresarios/Paginas/GPC%202025/FEEC%202025/FEEC-2025.aspx',
    icon: 'Sprout',
    accent: 'green',
    external: true,
  },
  {
    id: 'campesena',
    title: 'CampeSENA',
    description: 'Formación, emprendimiento y empleo para las comunidades rurales.',
    href: 'https://sena.edu.co/es-co/campesena/Paginas/index.aspx',
    icon: 'Tractor',
    accent: 'green',
    external: true,
  },
  {
    id: 'certificados',
    title: 'Descargar Certificados',
    description: 'Descarga el certificado de un evento al que asististe.',
    href: '/certificados',
    icon: 'Award',
    accent: 'cerulean',
  },
  {
    id: 'eventos',
    title: 'Eventos Programados',
    description: 'Consulta la agenda de eventos e inscríbete en línea.',
    href: '/eventos',
    icon: 'Calendar',
    accent: 'cerulean',
  },
  {
    id: 'proximamente',
    title: 'Próximamente',
    description: 'Estamos preparando un nuevo servicio para ti.',
    href: '#',
    icon: 'Megaphone',
    accent: 'cerulean',
    disabled: true,
  },
]

export default function InicioPage() {
  return (
    <div className="flex flex-col">
      <HeroInicio />

      <section className="mx-auto w-full max-w-6xl px-6 pb-12 pt-4 flex flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime-500">
            Nuestros servicios
          </span>
          <h2 className="text-2xl font-bold text-cerulean-500 sm:text-3xl">
            Gestión para la Productividad y la Competitividad
          </h2>
          <p className="max-w-2xl text-sm text-neutral-500">
            Programas, trámites y servicios del SENA para proponentes como empresas
            y gremios, y para beneficiarios de formación.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((mod) => (
            <ModuleCard key={mod.id} mod={mod} />
          ))}
        </div>
      </section>

      <section className="w-full bg-neutral-50 px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime-500">
              Mantente al día
            </span>
            <h2 className="text-2xl font-bold text-cerulean-500">Síguenos en redes</h2>
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
