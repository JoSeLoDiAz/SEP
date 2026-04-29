'use client'

import { ShieldCheck, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function VerificarBuscadorPage() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')

  function buscar() {
    const c = codigo.trim().toUpperCase()
    if (!c) return
    router.push(`/verificar/${encodeURIComponent(c)}`)
  }

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-7 py-12 flex flex-col gap-8">
      <div className="text-center flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-[#00304D] text-white flex items-center justify-center">
          <ShieldCheck size={32} strokeWidth={2.2} />
        </div>
        <h1 className="text-2xl font-bold text-[#00304D]">Verificación de Código de Proyecto</h1>
        <p className="text-sm text-neutral-600 max-w-xl">
          Pegue aquí el código de versión que aparece en el reporte del proyecto para
          comprobar su validez y obtener los datos básicos del registro guardado.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 sm:p-8 flex flex-col gap-4">
        <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Código de versión</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') buscar() }}
            placeholder="Ej.: PRY-3002-V1-A4F7B1C9"
            className="flex-1 border border-neutral-300 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-[#00304D]" />
          <button onClick={buscar}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#00304D] hover:bg-[#004a76] text-white text-sm font-semibold rounded-xl transition">
            <Search size={16} /> Verificar
          </button>
        </div>
        <p className="text-xs text-neutral-400">
          El código tiene el formato <code className="font-mono">PRY-{`<id>`}-V{`<n>`}-{`<hash>`}</code> y se imprime
          en la cabecera del reporte del proyecto.
        </p>
      </div>
    </div>
  )
}
