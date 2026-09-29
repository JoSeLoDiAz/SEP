'use client'

import { useState, type ReactNode } from 'react'
import { Download, Eye, Loader2 } from 'lucide-react'
import { abrirArchivo, descargarArchivoConNombreDelServidor } from '@/lib/descargar-archivo'

export const PRIMARY = '#00304D'
export const INSTITUTIONAL = '#39a900'

export type SetToast = (t: { tipo: 'success' | 'error'; msg: string } | null) => void

export function mensajeError(err: unknown, porDefecto: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? porDefecto
}

export const label = 'block text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
export const input = 'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40'
export const inputBloqueado = `${input} bg-neutral-50 text-neutral-500 cursor-not-allowed`

export function Section({ titulo, ayuda, accion, children }: {
  titulo: string
  ayuda?: string
  accion?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-neutral-900">{titulo}</p>
          {ayuda && <p className="text-[11px] text-neutral-500 mt-0.5">{ayuda}</p>}
        </div>
        {accion}
      </header>
      <div>{children}</div>
    </section>
  )
}

export function Vacio({ icono, titulo, detalle }: { icono: ReactNode; titulo: string; detalle?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-12 text-center">
      {icono}
      <p className="mt-3 text-sm font-semibold text-neutral-600">{titulo}</p>
      {detalle && <p className="mt-1 text-[12px] text-neutral-400">{detalle}</p>}
    </div>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center gap-2 px-5 py-10 text-sm text-neutral-500">
      <Loader2 size={14} className="animate-spin" /> {texto}
    </div>
  )
}

const SE_PUEDE_VER = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'txt']

export function sePuedeVer(nombre: string | null): boolean {
  const ext = (nombre ?? '').toLowerCase().split('.').pop() ?? ''
  return SE_PUEDE_VER.includes(ext)
}

// ver y descargar apuntan a /archivo: responderArchivo manda el nombre en las dos formas
export function BotonesArchivo({ url, nombre, setToast }: {
  url: string
  nombre: string | null
  setToast: SetToast
}) {
  const [ocupado, setOcupado] = useState<'ver' | 'bajar' | null>(null)
  const verSirve = sePuedeVer(nombre)

  async function accion(tipo: 'ver' | 'bajar') {
    setOcupado(tipo)
    try {
      if (tipo === 'ver') await abrirArchivo(url, nombre ?? undefined)
      else await descargarArchivoConNombreDelServidor(url, nombre ?? 'archivo')
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo abrir el archivo') })
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="flex shrink-0 gap-1">
      {verSirve && (
        <button onClick={() => accion('ver')} disabled={ocupado != null} title="Ver"
          className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-[#00304D] disabled:opacity-50">
          {ocupado === 'ver' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
        </button>
      )}
      <button onClick={() => accion('bajar')} disabled={ocupado != null} title="Descargar"
        className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-[#00304D] disabled:opacity-50">
        {ocupado === 'bajar' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      </button>
    </div>
  )
}
