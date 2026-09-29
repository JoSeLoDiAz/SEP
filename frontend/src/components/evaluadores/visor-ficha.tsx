'use client'

import api from '@/lib/api'
import { Download, Loader2, Printer, X } from 'lucide-react'
import { useEffect, useState } from 'react'

const PRIMARY = '#00304D'

// muestra el mismo PDF que se imprime: se pide con token y se sirve desde memoria, sin URL pública
export function VisorFicha({
  evaluadorId, nombre, identificacion, onCerrar,
}: {
  evaluadorId: number
  nombre: string
  identificacion?: string | null
  onCerrar: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    let creada: string | null = null

    api.get(`/evaluadores/${evaluadorId}/ficha.pdf`, {
      responseType: 'blob',
      // la ficha recorre la trayectoria y embebe la foto: tarda
      timeout: 60_000,
    })
      .then(r => {
        if (!vivo) return
        creada = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
        setUrl(creada)
      })
      .catch(() => { if (vivo) setError('No se pudo generar la ficha') })

    return () => {
      vivo = false
      if (creada) URL.revokeObjectURL(creada)
    }
  }, [evaluadorId])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  const archivo = `ficha_evaluador_${identificacion ?? evaluadorId}.pdf`

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/60 p-3 sm:p-6"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={`Ficha de ${nombre}`}
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-neutral-800">{nombre}</p>
            <p className="text-[11px] text-neutral-500">
              Ficha del evaluador{identificacion ? ` · CC ${identificacion}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {url && (
              <>
                <a
                  href={url}
                  download={archivo}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  <Download size={13} /> Descargar
                </a>
                <button
                  onClick={() => window.open(url, '_blank')?.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <Printer size={13} /> Imprimir
                </button>
              </>
            )}
            <button
              onClick={onCerrar}
              title="Cerrar (Esc)"
              className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 bg-neutral-100">
          {error ? (
            <p className="p-10 text-center text-sm text-red-700">{error}</p>
          ) : !url ? (
            <p className="flex h-full items-center justify-center gap-2 text-sm text-neutral-500">
              <Loader2 size={15} className="animate-spin" /> Armando la ficha…
            </p>
          ) : (
            <iframe src={url} title={`Ficha de ${nombre}`} className="h-full w-full border-0" />
          )}
        </div>
      </div>
    </div>
  )
}
