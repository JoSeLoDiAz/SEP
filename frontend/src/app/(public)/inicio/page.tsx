import { FacebookWidget } from '@/components/public/facebook-widget'
import { CarruselInicio, type Lamina } from '@/components/public/carrusel-inicio'
import { InstagramWidget } from '@/components/public/instagram-widget'
import { ModuleCard, type ModuleDef } from '@/components/public/module-card'
import { SocialButtons } from '@/components/public/social-buttons'

const laminas: Lamina[] = [
  {
    id: 'sep',
    acento: 'cerulean',
    lado: 'izquierda',
    antetitulo: 'SENA · Gestión para la Productividad y la Competitividad',
    titulo: 'Sistema Especializado de Proyectos',
    texto: 'Consulta convocatorias, inscríbete a eventos, descarga tus certificados y verifica proyectos presentados.',
    imagen: '/images/banner/bannerSena2-DoK8FAyn.webp',
    acciones: [
      { texto: 'Descargar mi certificado', href: '/certificados', principal: true },
      { texto: 'Ver eventos', href: '/eventos' },
    ],
  },
  {
    id: 'registro',
    acento: 'purpura',
    lado: 'derecha',
    antetitulo: 'Crea tu cuenta',
    titulo: 'Regístrate en el SEP',
    texto: 'Si vas a presentar un proyecto, entra como proponente. Si solo necesitas certificados o inscribirte a eventos, entra como usuario.',
    acciones: [
      { texto: 'Registrarme como proponente', href: '/registro/proponente', principal: true },
      { texto: 'Registrarme como usuario', href: '/registro/usuario' },
    ],
  },
  {
    id: 'fce',
    acento: 'green',
    lado: 'izquierda',
    antetitulo: 'Convocatoria abierta',
    titulo: 'Formación Continua Especializada',
    texto: 'El SENA cofinancia la formación que tu empresa o gremio necesita: tú presentas el proyecto y capacitas a tus trabajadores.',
    acciones: [
      {
        texto: 'Conocer la convocatoria',
        href: 'https://www.sena.edu.co/es-co/Empresarios/Paginas/GPC%202025/FCE%202025/FCE-2025.aspx',
        externo: true,
        principal: true,
      },
    ],
  },
  {
    id: 'verificar',
    acento: 'cerulean',
    lado: 'derecha',
    antetitulo: 'Transparencia',
    titulo: 'Verifica un certificado o un proyecto',
    texto: 'Comprueba en segundos si un certificado es auténtico o si un proyecto fue presentado ante el SENA.',
    acciones: [{ texto: 'Verificar ahora', href: '/verificar', principal: true }],
  },
]

const modules: ModuleDef[] = [
  {
    id: 'fce',
    title: 'Formación Continua Especializada',
    description: 'Convocatoria dirigida a empresas para cofinanciar programas de formación de su talento humano.',
    href: 'https://www.sena.edu.co/es-co/Empresarios/Paginas/GPC%202025/FCE%202025/FCE-2025.aspx',
    cta: 'Conocer la convocatoria',
    icon: 'GraduationCap',
    accent: 'lime',
    external: true,
  },
  {
    id: 'certificados',
    title: 'Descargar Certificados',
    description: 'Consulta y descarga los certificados de las acciones de formación en las que participaste.',
    href: '/certificados',
    cta: 'Descargar',
    icon: 'Award',
    accent: 'cerulean',
  },
  {
    id: 'eventos',
    title: 'Eventos Programados',
    description: 'Revisa el cronograma de socializaciones, capacitaciones y jornadas del programa.',
    href: '/eventos',
    cta: 'Ver cronograma',
    icon: 'CalendarCheck',
    accent: 'cerulean',
  },
  {
    id: 'proponente',
    title: 'Regístrese como Proponente',
    description: 'Si desea presentar sus proyectos en las convocatorias, debe registrarse como Empresa.',
    href: '/registro/proponente',
    cta: 'Crear registro',
    icon: 'Building2',
    accent: 'green',
  },
  {
    id: 'usuario',
    title: 'Regístrese como Usuario',
    description: 'Si cumple un rol diferente al de los proponentes, debe registrarse como Persona.',
    href: '/registro/usuario',
    cta: 'Crear registro',
    icon: 'UserPlus',
    accent: 'purpura',
  },
  {
    id: 'proximamente',
    title: 'Próximamente',
    description: 'Estamos preparando nuevos servicios para el ecosistema de proyectos del SENA.',
    href: '#',
    icon: 'Megaphone',
    accent: 'cerulean',
    disabled: true,
  },
]

export default function InicioPage() {
  return (
    <div className="flex flex-col">
      <CarruselInicio laminas={laminas} />

      <section className="mx-auto w-full max-w-6xl px-6 pb-12 pt-4 flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-2xl font-bold text-cerulean-500 sm:text-3xl">
            Gestión para la Productividad y la Competitividad
          </h2>
          <span aria-hidden="true" className="h-1 w-24 rounded-full bg-gradient-to-r from-lime-500 to-cerulean-500" />
          <p className="max-w-2xl text-sm text-neutral-500">
            Accede a las convocatorias, gestiona tu registro y consulta tus certificados y eventos.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
