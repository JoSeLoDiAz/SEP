'use client'

import Link from 'next/link'
import { BarChart3, Table } from 'lucide-react'

const CARDS = [
  {
    id: 'general',
    title: 'Información General',
    href: '/panel/dashboards/general',
    icon: BarChart3,
    color: '#00304D',
  },
  {
    id: 'detallada',
    title: 'Información Detallada',
    href: '/panel/dashboards/detallada',
    icon: Table,
    color: '#007A33',
  },
]

export default function PanelHome() {
  return (
    <div className="p-5 sm:p-7 xl:p-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {CARDS.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            className="bg-white rounded-2xl border border-neutral-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden"
          >
            <div
              className="h-2"
              style={{ backgroundColor: card.color }}
            />

            <div className="flex flex-col items-center justify-center p-10 gap-5">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${card.color}15` }}
              >
                <card.icon
                  size={40}
                  style={{ color: card.color }}
                />
              </div>

              <h2
                className="text-xl font-bold text-center"
                style={{ color: card.color }}
              >
                {card.title}
              </h2>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}