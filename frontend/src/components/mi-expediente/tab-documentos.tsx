'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Loader2, Upload } from 'lucide-react'
import api from '@/lib/api'
import { fmtDateTime } from '@/lib/format-date'
import type { MiDocumento } from '@/lib/types/mi-expediente'
import {
  BotonesArchivo, Cargando, INSTITUTIONAL, Section, Vacio, mensajeError, type SetToast,
} from './comunes'

/** Un tipo del catálogo, tal como lo devuelve el backend. */
interface TipoDoc {
  id: number
  codigo: string
  nombre: string
  extensiones?: string[]
  esDelAnio?: boolean
  esDePerfil?: boolean
  admiteMultiple?: boolean
}

const MAX_MB = 8

export default function TabDocumentos({ setToast, inactivo = false }: {
  setToast: SetToast
  /** Ficha inactiva: el guard del backend rechaza toda escritura. */
  inactivo?: boolean
}) {
  const [docs, setDocs] = useState<MiDocumento[]>([])
  const [tipos, setTipos] = useState<TipoDoc[]>([])
  const [cargando, setCargando] = useState(true)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [r, rt] = await Promise.all([
          api.get<MiDocumento[]>('/mi-expediente/documentos'),
          api.get<TipoDoc[]>('/mi-expediente/catalogos/tipos-documento').catch(() => ({ data: [] as TipoDoc[] })),
        ])
        if (vivo) { setDocs(r.data ?? []); setTipos(rt.data ?? []) }
      } catch (err) {
        if (vivo) setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudieron cargar tus documentos') })
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [setToast, recarga])

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

  // Sin esto, la tarjeta profesional se convierte en recoger 72 PDF por correo.
  const subida = !inactivo && tipos.length > 0 ? (
    <Section
      titulo="Documentos de identificación"
      ayuda="Estos los puedes cargar tú mismo, sin pasar por la gestora."
    >
      <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
        {tipos.map(t => (
          <CargarTipo
            key={t.id}
            tipo={t}
            yaCargado={docs.some(d => d.tipoCodigo === t.codigo)}
            setToast={setToast}
            onSubido={() => setRecarga(n => n + 1)}
          />
        ))}
      </div>
    </Section>
  ) : null

  if (!docs.length) {
    return (
      <div className="flex flex-col gap-5">
        {subida}
        <Vacio
          icono={<FileText size={28} className="mx-auto text-neutral-300" />}
          titulo="Todavía no tienes documentos"
          detalle="Cuando el equipo del banco cargue algo a tu expediente, aparecerá aquí."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {subida}
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

/** Un tipo de documento del perfil, con su botón de cargar. */
function CargarTipo({ tipo, yaCargado, setToast, onSubido }: {
  tipo: TipoDoc
  yaCargado: boolean
  setToast: SetToast
  onSubido: () => void
}) {
  const [subiendo, setSubiendo] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const exts = tipo.extensiones?.length ? tipo.extensiones : ['pdf']

  async function subir(file: File) {
    // se comprueba aquí para poder nombrar el formato; el servidor solo da un 400
    const ext = (file.name.split('.').pop() ?? '').toLowerCase()
    if (!exts.includes(ext)) {
      setToast({
        tipo: 'error',
        msg: `${tipo.nombre} admite ${exts.map(e => '.' + e).join(', ')}; el archivo es .${ext || 'sin extensión'}`,
      })
      if (ref.current) ref.current.value = ''
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setToast({
        tipo: 'error',
        msg: `El archivo pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB y el máximo son ${MAX_MB} MB`,
      })
      if (ref.current) ref.current.value = ''
      return
    }
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      fd.append('tipoDocumentoEvalId', String(tipo.id))
      await api.post('/mi-expediente/documentos', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setToast({ tipo: 'success', msg: `${tipo.nombre}: listo` })
      onSubido()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo subir el documento') })
    } finally {
      setSubiendo(false)
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 px-4 py-3">
      <p className="text-[13px] font-semibold text-neutral-800">{tipo.nombre}</p>
      <p className="mt-0.5 text-[11px] text-neutral-500">
        {yaCargado ? 'Ya lo tienes cargado' : 'Todavía no lo has cargado'}
        {' \u00b7 '}
        {exts.map(e => e.toUpperCase()).join(', ')}, máx. {MAX_MB} MB
      </p>
      <input
        ref={ref}
        type="file"
        accept={exts.map(e => '.' + e).join(',')}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) subir(f) }}
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={subiendo}
        className="mt-2 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: INSTITUTIONAL }}
      >
        {subiendo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {yaCargado ? 'Reemplazar' : 'Cargar'}
      </button>
    </div>
  )
}
