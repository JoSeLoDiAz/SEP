'use client'

import { ScrollText } from 'lucide-react'

export default function ConveniosPage() {
  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      <div className="bg-[#0070C0] rounded-2xl px-6 py-4 flex items-center gap-3">
        <ScrollText size={22} className="text-white" />
        <h1 className="text-white font-bold text-base">Convenios</h1>
      </div>
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
        <ScrollText size={40} className="text-neutral-200" />
        <p className="text-neutral-500 font-semibold text-sm">Módulo próximamente disponible</p>
        <p className="text-neutral-400 text-xs">Este módulo está en desarrollo. Estará disponible en una próxima versión.</p>
      </div>
    </div>
  )
}
