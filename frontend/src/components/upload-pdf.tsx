'use client'

import api from '@/lib/api'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Download, FileText, Loader2, Trash2, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'

const MAX_BYTES = 8 * 1024 * 1024

export interface DocumentoCargado {
  documentoId?: number
  docId?: number
  nombreArchivo: string
  tamanoBytes: number | null
  fechaRegistro?: string | null
  tipo?: string
  num?: number
}

interface UploadPdfProps {
  // Modo personas
  personaId?: number
  tipo?: 'HV' | 'EX' | 'TI' | 'DA'
  num?: number
  documento?: DocumentoCargado | null
  bloqueado?: boolean
  onChange?: () => void

  // Modo custom (override de endpoints)
  label?: string
  endpoint?: string
  extraFields?: Record<string, string>
  docActual?: DocumentoCargado | null
  soloLectura?: boolean
  onUploadSuccess?: () => void | Promise<void>
  downloadUrl?: string
}

export function UploadPdf({
  personaId, tipo, num, documento, bloqueado, onChange,
  label, endpoint, extraFields, docActual, soloLectura, onUploadSuccess, downloadUrl,
}: UploadPdfProps) {
  const [subiendo, setSubiendo] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [confirmEliminarOpen, setConfirmEliminarOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const doc = docActual ?? documento ?? null
  const ro = soloLectura ?? bloqueado ?? false
  const onSuccess = onUploadSuccess ?? onChange
  const docId = doc?.documentoId ?? doc?.docId

  function fmtTamano(bytes: number | null) {
    if (bytes == null || !bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  function uploadEndpoint(): string {
    if (endpoint) return endpoint
    if (personaId) return `/personas/${personaId}/documentos`
    throw new Error('UploadPdf: falta `endpoint` o `personaId`.')
  }

  function downloadEndpoint(): string {
    if (downloadUrl) return downloadUrl
    if (docId != null) return `/personas/documentos/${docId}/archivo`
    throw new Error('UploadPdf: no se puede determinar el endpoint de descarga.')
  }
  function deleteEndpoint(): string {
    if (downloadUrl) {
      // en modo custom no hay endpoint de delete propio: se deriva del de download
      return downloadUrl.replace(/\/archivo$/, '')
    }
    return `/personas/documentos/${docId}`
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    if (file.type !== 'application/pdf') {
      setError('Solo se permiten archivos PDF.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`El archivo supera 8 MB (${(file.size / 1024 / 1024).toFixed(2)} MB).`)
      return
    }
    const fd = new FormData()
    fd.append('archivo', file)
    if (extraFields) {
      for (const [k, v] of Object.entries(extraFields)) fd.append(k, v)
    } else if (tipo != null) {
      fd.append('tipo', tipo)
      fd.append('num', String(num ?? 0))
    }
    try {
      setSubiendo(true)
      await api.post(uploadEndpoint(), fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000,
      })
      await onSuccess?.()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudo subir el archivo.')
    } finally {
      setSubiendo(false)
    }
  }

  function pedirEliminar() {
    if (!doc) return
    setConfirmEliminarOpen(true)
  }

  async function handleEliminar() {
    if (!doc) return
    try {
      setEliminando(true); setError(null)
      await api.delete(deleteEndpoint())
      setConfirmEliminarOpen(false)
      await onSuccess?.()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudo eliminar el archivo.')
    } finally {
      setEliminando(false)
    }
  }

  if (doc) {
    async function descargar() {
      try {
        const r = await api.get(downloadEndpoint(), { responseType: 'blob' })
        const url = URL.createObjectURL(r.data as Blob)
        const a = document.createElement('a')
        a.href = url
        a.download = doc!.nombreArchivo || 'archivo.pdf'
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 4000)
      } catch (e: any) {
        setError(e?.response?.data?.message ?? 'No se pudo descargar el archivo.')
      }
    }
    async function vista() {
      try {
        const r = await api.get(downloadEndpoint(), { responseType: 'blob' })
        const url = URL.createObjectURL(r.data as Blob)
        window.open(url, '_blank', 'noopener')
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } catch (e: any) {
        setError(e?.response?.data?.message ?? 'No se pudo abrir el archivo.')
      }
    }

    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
          <FileText size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-800 truncate">{doc.nombreArchivo}</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            {fmtTamano(doc.tamanoBytes)}
            {doc.fechaRegistro && ` · ${new Date(doc.fechaRegistro).toLocaleDateString('es-CO')}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button" onClick={vista}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-[#00304D] transition"
            title="Ver PDF en una nueva pestaña"
          >
            <FileText size={14} />
          </button>
          <button
            type="button" onClick={descargar}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-[#00304D] transition"
            title="Descargar"
          >
            <Download size={14} />
          </button>
          {!ro && (
            <button
              type="button" onClick={pedirEliminar}
              disabled={eliminando}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 transition disabled:opacity-50"
              title="Eliminar y reemplazar"
            >
              {eliminando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          )}
        </div>
        {error && (
          <div className="absolute mt-12 text-[11px] text-red-700">{error}</div>
        )}

        <ConfirmModal
          open={confirmEliminarOpen}
          onClose={() => setConfirmEliminarOpen(false)}
          onConfirm={handleEliminar}
          tipo="delete"
          titulo="Eliminar documento"
          mensaje={
            <>
              ¿Seguro que quieres eliminar el archivo <strong className="text-neutral-800">{doc.nombreArchivo}</strong>?
              Esta acción no se puede deshacer.
            </>
          }
          textoConfirmar="Eliminar"
          cargando={eliminando}
        />
      </div>
    )
  }

  if (ro) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[12px] text-neutral-500 italic">
        Sin documento cargado.
      </div>
    )
  }
  return (
    <div className="rounded-xl border-2 border-dashed border-neutral-300 hover:border-[#00304D] p-4 flex flex-col gap-2 items-center text-center transition">
      {label && <p className="text-xs font-semibold text-neutral-600">{label}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFile}
        disabled={subiendo}
      />
      <Upload size={20} className="text-neutral-400" />
      <p className="text-xs text-neutral-600">
        Arrastra un PDF aquí o
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="ml-1 font-semibold text-[#00304D] underline hover:text-[#0070C0] disabled:opacity-60"
        >
          {subiendo ? 'subiendo…' : 'selecciona un archivo'}
        </button>
      </p>
      <p className="text-[10px] text-neutral-400">PDF · máximo 8 MB</p>
      {subiendo && <Loader2 size={16} className="animate-spin text-[#00304D]" />}
      {error && (
        <div className="mt-1 inline-flex items-start gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
          <X size={12} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
