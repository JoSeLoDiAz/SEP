'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import api from '@/lib/api'
import { fmtDateTime } from '@/lib/format-date'
import type { MiDocumento } from '@/lib/types/mi-expediente'
import { BotonesArchivo, Cargando, Section, Vacio, mensajeError, type SetToast } from './comunes'

export default function TabDocumentos({ setToast }: { setToast: SetToast }) {
  const [docs, setDocs] = useState<MiDocumento[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const r = await api.get<MiDocumento[]>('/mi-expediente/documentos')
        if (vivo) setDocs(r.data ?? [])
      } catch (err) {
        if (vivo) setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudieron cargar tus documentos') })
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [setToast])

  const { permanentes, porAnio } = useMemo(() => {
    const permanentes: MiDocumento[] = []
    const mapa = new Map<number, MiDocumento[]>()
    for (const d of docs) {
      if (d.anioReferencia == null) { permanentes.push(d); continue }
      const lista = mapa.get(d.anioReferencia) ?? []
      lista.push(d)
      mapa.set(d.anioReferencia, lista)
    }
    return { permanentes, porAnio: [...mapa.entries()].sort((a, b) => b[0] - a[0]) }
  }, [docs])

  if (cargando) return <Cargando texto="Cargando tus documentos…" />

  if (!docs.length) {
    return (
      <Vacio
        icono={<FileText size={28} className="mx-auto text-neutral-300" />}
        titulo="Todavía no tienes documentos"
        detalle="Cuando el equipo del banco cargue algo a tu expediente, aparecerá aquí."
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {permanentes.length > 0 && (
        <Section titulo="Permanentes" ayuda="No están atados a ningún año.">
          <Lista docs={permanentes} setToast={setToast} />
        </Section>
      )}
      {porAnio.map(([anio, lista]) => (
        <Section key={anio} titulo={String(anio)}>
          <Lista docs={lista} setToast={setToast} />
        </Section>
      ))}
    </div>
  )
}

function Lista({ docs, setToast }: { docs: MiDocumento[]; setToast: SetToast }) {
  return (
    <div className="px-5 py-4">
      <ul className="flex flex-col gap-1.5">
        {docs.map(d => (
          <li key={d.documentoId} className="flex items-center gap-3 rounded-xl border border-neutral-100 px-3 py-2">
            <FileText size={15} className="shrink-0 text-neutral-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-neutral-800">
                {d.tipoNombre || d.archivoNombre || 'Documento'}
              </p>
              <p className="truncate text-[11px] text-neutral-500">
                {[d.descripcion, d.archivoNombre, fmtDateTime(d.fechaCargue)].filter(Boolean).join(' · ')}
              </p>
            </div>
            <BotonesArchivo
              url={`/mi-expediente/documentos/${d.documentoId}/archivo`}
              nombre={d.archivoNombre}
              setToast={setToast}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
