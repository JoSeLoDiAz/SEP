'use client'

import { useState } from 'react'
import { AlertCircle, Download, Loader2, Search, User, Hash } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

type Modo = 'persona' | 'codigo'

interface CertificadoRow {
  consecutivo: number
  tipo: 'BENEFICIARIO' | 'EVALUADOR'
  tipoNombre: string
  entidad: string
  concepto: string
  detalle: string
  fecha: string
  codigo: string
  /** La arma el backend: cada tipo tiene su propia ruta de descarga. */
  urlPdf: string
  personaId: number
}

const TIPOS_DOCUMENTO = [
  { value: 'CC',  label: 'Cédula de Ciudadanía' },
  { value: 'CE',  label: 'Cédula de Extranjería' },
  { value: 'TI',  label: 'Tarjeta de Identidad' },
  { value: 'PA',  label: 'Pasaporte' },
  { value: 'NIT', label: 'NIT' },
]

const campo =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm transition focus:border-cerulean-500 focus:outline-none focus:ring-2 focus:ring-cerulean-500/30'
const etiqueta = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500'

function Aviso({ mensaje }: { mensaje: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {mensaje}
    </div>
  )
}

function Insignia({ row }: { row: CertificadoRow }) {
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
        row.tipo === 'EVALUADOR'
          ? 'bg-purpura-50 text-purpura-700'
          : 'bg-lime-50 text-green-700',
      )}
    >
      {row.tipoNombre}
    </span>
  )
}

function BotonDescargar({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg bg-lime-500 px-4 py-2 text-[13px] font-bold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
    >
      <Download size={14} aria-hidden="true" />
      Descargar
    </button>
  )
}

function Resultados({ rows, onDescargar }: {
  rows: CertificadoRow[]
  onDescargar: (row: CertificadoRow) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-neutral-500">
        {rows.length === 1 ? 'Se encontró 1 certificado.' : `Se encontraron ${rows.length} certificados.`}
      </p>

      {/* movil: tarjetas. una tabla de 6 columnas no cabe en un telefono */}
      <ul className="flex flex-col gap-3 lg:hidden">
        {rows.map(row => (
          <li
            key={`${row.tipo}-${row.urlPdf}`}
            className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <Insignia row={row} />
              <span className="shrink-0 text-[11px] text-neutral-400">{row.fecha}</span>
            </div>
            <p className="mt-2 text-[13px] font-semibold leading-snug text-cerulean-500">{row.concepto}</p>
            {row.detalle && <p className="text-[11px] text-neutral-400">{row.detalle}</p>}
            <p className="mt-1 text-[12px] text-neutral-500">{row.entidad}</p>
            <div className="mt-3">
              <BotonDescargar onClick={() => onDescargar(row)} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 lg:block">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Certificados encontrados</caption>
          <thead>
            <tr className="bg-cerulean-500 text-left text-[11px] uppercase tracking-wide text-white">
              <th scope="col" className="w-10 px-3 py-3 font-semibold">No.</th>
              <th scope="col" className="w-32 px-3 py-3 font-semibold">Participación</th>
              <th scope="col" className="w-52 px-3 py-3 font-semibold">Entidad</th>
              <th scope="col" className="px-3 py-3 font-semibold">Certificado por</th>
              <th scope="col" className="w-28 px-3 py-3 font-semibold">Fecha</th>
              <th scope="col" className="w-36 px-3 py-3 text-right font-semibold">Ver</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map(row => (
              // el id no basta como key: beneficiario y evaluador pueden repetirlo
              <tr key={`${row.tipo}-${row.urlPdf}`} className="transition hover:bg-neutral-50">
                <td className="px-3 py-3 text-neutral-500 tabular-nums">{row.consecutivo}</td>
                <td className="px-3 py-3"><Insignia row={row} /></td>
                <td className="px-3 py-3 text-[13px] text-neutral-700">{row.entidad}</td>
                <td className="px-3 py-3">
                  <p className="text-[13px] font-medium text-neutral-800">{row.concepto}</p>
                  {row.detalle && <p className="mt-0.5 text-[11px] text-neutral-400">{row.detalle}</p>}
                </td>
                <td className="px-3 py-3 text-[12px] text-neutral-500">{row.fecha}</td>
                <td className="px-3 py-3 text-right">
                  <BotonDescargar onClick={() => onDescargar(row)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function CertificadosForm() {
  const [modo, setModo] = useState<Modo>('persona')
  const [tipoDoc, setTipoDoc] = useState('CC')
  const [numDoc, setNumDoc] = useState('')
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [alerta, setAlerta] = useState<string | null>(null)
  const [resultados, setResultados] = useState<CertificadoRow[] | null>(null)

  function cambiarModo(m: Modo) {
    setModo(m)
    setAlerta(null)
    setResultados(null)
    setNumDoc('')
    setCodigo('')
  }

  async function buscar() {
    setAlerta(null)
    setResultados(null)

    if (modo === 'persona') {
      if (!tipoDoc) return setAlerta('Selecciona un tipo de identificación.')
      if (!numDoc.trim()) return setAlerta('Escribe el número de identificación.')
    } else if (!codigo.trim()) {
      return setAlerta('Escribe el código del certificado.')
    }

    setLoading(true)
    try {
      const params =
        modo === 'persona'
          ? { tipoDocumento: tipoDoc, numero: numDoc.trim() }
          : { codigo: codigo.trim() }

      const { data } = await api.get<CertificadoRow[]>('/certificados', { params })

      if (!data.length) setAlerta('No encontramos certificados con esos datos. Revisa e intenta de nuevo.')
      else setResultados(data)
    } catch {
      setAlerta('No se pudo consultar. Revisa tu conexión e intenta más tarde.')
    } finally {
      setLoading(false)
    }
  }

  function descargar(row: CertificadoRow) {
    // baseURL de axios: en dev es localhost:4000 sin /api, en prod /api tras nginx
    const base = api.defaults.baseURL ?? ''
    window.open(`${base}${row.urlPdf}`, '_blank', 'noopener,noreferrer')
  }

  const pestana = (m: Modo, texto: string, Icono: typeof User) => (
    <button
      type="button"
      onClick={() => cambiarModo(m)}
      aria-pressed={modo === m}
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition',
        modo === m ? 'bg-white text-cerulean-500 shadow-sm' : 'text-neutral-500 hover:text-cerulean-500',
      )}
    >
      <Icono size={15} aria-hidden="true" />
      {texto}
    </button>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mx-auto flex max-w-md gap-1 rounded-xl bg-neutral-100 p-1">
          {pestana('persona', 'Por identificación', User)}
          {pestana('codigo', 'Por código', Hash)}
        </div>

        <div className="mt-5">
          {modo === 'persona' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="tipoDoc" className={etiqueta}>Tipo de documento</label>
                <select id="tipoDoc" value={tipoDoc} onChange={e => setTipoDoc(e.target.value)} className={campo}>
                  {TIPOS_DOCUMENTO.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="numDoc" className={etiqueta}>Número</label>
                <input
                  id="numDoc"
                  type="text"
                  inputMode="numeric"
                  value={numDoc}
                  onChange={e => setNumDoc(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscar()}
                  placeholder="Sin puntos ni comas"
                  className={campo}
                />
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-md">
              <label htmlFor="codigo" className={etiqueta}>Código del certificado</label>
              <input
                id="codigo"
                type="text"
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscar()}
                placeholder="El que aparece al pie del certificado"
                className={cn(campo, 'font-mono')}
              />
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-center">
          <button
            onClick={buscar}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-8 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
          >
            {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </div>

      {alerta && <Aviso mensaje={alerta} />}
      {resultados && <Resultados rows={resultados} onDescargar={descargar} />}
    </div>
  )
}
