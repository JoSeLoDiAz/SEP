'use client'

import { Search, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CabeceraPagina } from '@/components/public/cabecera-pagina'

export default function VerificarBuscadorPage() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')

  function buscar() {
    const c = codigo.trim().toUpperCase()
    if (!c) return
    router.push(`/verificar/${encodeURIComponent(c)}`)
  }

  return (
    <div className="flex flex-col">
      <CabeceraPagina
        icono={ShieldCheck}
        titulo="Verificar un proyecto"
        descripcion="Comprueba si un proyecto fue presentado ante el SENA y consulta los datos básicos del registro guardado."
      />

      <div className="mx-auto w-full max-w-3xl px-6 pb-14 pt-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          <label htmlFor="codigo" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Código de versión
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="codigo"
              type="text"
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') buscar() }}
              placeholder="Ej.: PRY-3002-V1-A4F7B1C9"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2.5 font-mono text-sm transition focus:border-cerulean-500 focus:outline-none focus:ring-2 focus:ring-cerulean-500/30"
            />
            <button
              onClick={buscar}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-lime-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
            >
              <Search size={16} aria-hidden="true" />
              Verificar
            </button>
          </div>

          <p className="mt-3 text-[12px] text-neutral-400">
            El código tiene el formato <code className="font-mono text-neutral-500">PRY-{`<id>`}-V{`<n>`}-{`<hash>`}</code> y
            se imprime en la cabecera del reporte del proyecto.
          </p>
        </div>
      </div>
    </div>
  )
}
