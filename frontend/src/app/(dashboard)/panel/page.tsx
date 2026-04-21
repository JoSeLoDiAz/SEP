'use client'

import { getSepUsuario, isEmpresa } from '@/lib/auth'
import {
  BookUser,
  BarChart2,
  Building2,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  FolderKanban,
  ScrollText,
  Users,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

// ── Empresa home ──────────────────────────────────────────────────────────────

const EMPRESA_CARDS = [
  {
    id: 'datos',
    title: 'Datos Básicos',
    icon: Building2,
    color: '#00304D',
    href: '/panel/datos',
    objetivo: 'Diligenciar la información básica de la empresa o gremio.',
    descripcion: 'Permite gestionar la información empresarial o gremial, ubicación, datos económicos y representante legal.',
    accion: '¿Cómo hacerlo? Seleccionar "Datos Básicos" en el menú y completar la información solicitada.',
    btnLabel: 'Ir a Datos Básicos',
  },
  {
    id: 'contactos',
    title: 'Contactos',
    icon: BookUser,
    color: '#0070C0',
    href: '/panel/contactos',
    objetivo: 'Registrar las personas de contacto de la empresa o gremio.',
    descripcion: 'Permite gestionar los contactos asociados a la organización y vincularlos a un proyecto específico.',
    accion: '¿Cómo hacerlo? Seleccionar "Contactos" en el menú y agregar o editar los contactos.',
    btnLabel: 'Ir a Contactos',
  },
  {
    id: 'analisis',
    title: 'Análisis Empresarial',
    icon: BarChart2,
    color: '#00304D',
    href: '/panel/analisis',
    objetivo: 'Describir el análisis empresarial o gremial del proponente.',
    descripcion: 'Permite registrar el objeto social, productos, situación actual, retos estratégicos, cadena productiva e interacciones.',
    accion: '¿Cómo hacerlo? Seleccionar "Análisis" en el menú y completar cada sección del formulario.',
    btnLabel: 'Ir a Análisis',
  },
  {
    id: 'necesidades',
    title: 'Mis Necesidades',
    icon: ClipboardList,
    color: '#39A900',
    href: '/panel/necesidades',
    objetivo: 'Registrar las necesidades de formación identificadas.',
    descripcion: 'Permite gestionar el diagnóstico de necesidades a partir del cual se priorizan las acciones de formación del proyecto.',
    accion: '¿Cómo hacerlo? Una vez diligenciados los Datos Básicos, ir al menú "Mis Necesidades".',
    btnLabel: 'Ir a Mis Necesidades',
  },
  {
    id: 'proyectos',
    title: 'Mis Proyectos',
    icon: FolderKanban,
    color: '#C47900',
    href: '/panel/proyectos',
    objetivo: 'Registrar el proyecto de formación diseñado a la medida de sus necesidades.',
    descripcion: 'Permite gestionar la información del proyecto y las acciones de formación que lo conforman.',
    accion: '¿Cómo hacerlo? Luego de "Mis Necesidades", seleccionar "Mis Proyectos" en el menú.',
    btnLabel: 'Ir a Mis Proyectos',
  },
  {
    id: 'convenios',
    title: 'Mis Convenios',
    icon: ScrollText,
    color: '#C4003D',
    href: '/panel/convenios',
    objetivo: 'Registrar la información relacionada al Convenio una vez gestionada la suscripción.',
    descripcion: 'Permite gestionar la ejecución del convenio (proyecto de formación y acciones de formación).',
    accion: '¿Cómo hacerlo? Una vez suscrito el convenio, la información será cargada en esta sección.',
    btnLabel: 'Ir a Mis Convenios',
  },
]

// ── Admin home ────────────────────────────────────────────────────────────────

const ADMIN_STATS = [
  { label: 'Beneficiarios activos', value: '—', icon: Users,       color: 'bg-green-50 text-green-600'     },
  { label: 'Empresas vinculadas',   value: '—', icon: Building2,   color: 'bg-blue-50 text-blue-600'       },
  { label: 'Convenios vigentes',    value: '—', icon: ScrollText,  color: 'bg-purple-50 text-purple-600'   },
  { label: 'Certificados emitidos', value: '—', icon: FileCheck2,  color: 'bg-lime-50 text-lime-600'       },
]

const ADMIN_MODULES = [
  { label: 'Beneficiarios', icon: Users         },
  { label: 'Convenios',     icon: ScrollText    },
  { label: 'Cronograma',    icon: CalendarDays  },
  { label: 'Certificación', icon: FileCheck2    },
  { label: 'Desembolsos',   icon: Wallet        },
  { label: 'Evaluaciones',  icon: ClipboardList },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PanelHome() {
  const [usuario, setUsuario] = useState<ReturnType<typeof getSepUsuario>>(null)

  useEffect(() => { document.title = 'Inicio | SEP' }, [])

  useEffect(() => {
    setUsuario(getSepUsuario())
  }, [])

  const perfilId = usuario?.perfilId ?? 0

  if (isEmpresa(perfilId)) {
    return <EmpresaHome nombre={usuario?.nombre ?? ''} />
  }

  return <AdminHome />
}

// ── Empresa home view ─────────────────────────────────────────────────────────

function EmpresaHome({ nombre }: { nombre: string }) {
  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {/* Welcome banner */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#00304D] via-[#39A900] to-[#00304D]" />
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-[#00304D] truncate">
              {nombre || 'Bienvenido(a)'}
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              <strong className="text-[#00304D]">Señor Gremio / Empresario</strong>, le damos la bienvenida al{' '}
              <strong className="text-[#39A900]">Sistema Especializado de Proyectos — SEP</strong>.
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              A continuación le brindamos una breve explicación de las opciones disponibles para gestionar la información.
            </p>
          </div>
          <div className="hidden xl:flex flex-col items-end gap-0.5 flex-shrink-0 text-right">
            <span className="text-[11px] text-neutral-400">Módulos disponibles</span>
            <span className="text-2xl font-bold text-[#39A900]">6</span>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {EMPRESA_CARDS.map((card) => (
          <div
            key={card.id}
            className="bg-white rounded-2xl border border-neutral-200 shadow-sm flex flex-col overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
          >
            {/* Barra de color superior */}
            <div className="h-1.5" style={{ backgroundColor: card.color }} />

            {/* Ícono */}
            <div className="px-5 pt-6 pb-3 flex justify-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${card.color}12` }}
              >
                <card.icon size={30} style={{ color: card.color }} />
              </div>
            </div>

            {/* Título */}
            <div
              className="mx-4 rounded-xl px-3 py-2.5 text-center text-sm font-bold text-white mb-4"
              style={{ backgroundColor: card.color }}
            >
              {card.title}
            </div>

            {/* Contenido */}
            <div className="px-5 pb-5 flex flex-col gap-2.5 flex-1">
              <p className="text-xs text-neutral-700 leading-relaxed">
                <strong style={{ color: card.color }}>Objetivo:</strong>{' '}
                {card.objetivo}
              </p>
              <p className="text-xs text-neutral-500 leading-relaxed">
                {card.descripcion}
              </p>
              <p className="text-xs text-neutral-400 italic leading-relaxed">
                {card.accion}
              </p>

              <Link
                href={card.href}
                className="mt-auto block text-center text-xs font-semibold text-white py-2.5 px-4 rounded-xl transition-opacity hover:opacity-90 active:scale-95"
                style={{ backgroundColor: card.color }}
              >
                {card.btnLabel} →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Admin home view ───────────────────────────────────────────────────────────

function AdminHome() {
  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">Panel SEP</h1>
        <p className="text-sm text-neutral-500">Sistema Especializado de Proyectos — GGPC SENA</p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {ADMIN_STATS.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-4 p-5 bg-white rounded-xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-2xl font-bold text-neutral-900">{stat.value}</span>
              <span className="text-xs text-neutral-500 truncate">{stat.label}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-xl border border-neutral-200 p-6 flex flex-col gap-3">
        <h2 className="font-semibold text-neutral-900 text-sm">Módulos del sistema</h2>
        <p className="text-xs text-neutral-500">
          Los módulos se habilitan progresivamente. Usa el menú lateral para navegar.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-1">
          {ADMIN_MODULES.map((mod) => (
            <div
              key={mod.label}
              className="flex items-center gap-2 p-3 rounded-lg border border-neutral-100 bg-neutral-50 text-xs text-neutral-500"
            >
              <mod.icon size={15} />
              <span>{mod.label}</span>
              <span className="ml-auto text-[10px] bg-neutral-200 text-neutral-400 px-1.5 py-0.5 rounded-full">
                próximo
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
