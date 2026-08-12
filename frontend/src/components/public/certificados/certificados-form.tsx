'use client'

import { useState } from 'react'
import { Search, Download, AlertCircle, Loader2 } from 'lucide-react'
import api from '@/lib/api'

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

function Alert({ message, type }: { message: string; type: 'error' | 'info' }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium
      ${type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-cerulean-50 text-cerulean-500 border border-cerulean-200'}`}>
      <AlertCircle size={16} className="flex-shrink-0" />
      {message}
    </div>
  )
}

function ResultsTable({ rows, onDescargar }: { rows: CertificadoRow[]; onDescargar: (row: CertificadoRow) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-cerulean-500 text-white">
            <th className="px-4 py-3 text-left font-semibold w-12">No.</th>
            <th className="px-4 py-3 text-left font-semibold w-32">Participación</th>
            <th className="px-4 py-3 text-left font-semibold w-1/4">Entidad</th>
            <th className="px-4 py-3 text-left font-semibold">Certificado por</th>
            <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Fecha</th>
            <th className="px-4 py-3 text-center font-semibold w-32">Ver</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              // el id no basta como key: beneficiario y evaluador pueden repetirlo
              key={`${row.tipo}-${row.urlPdf}`}
              className={`border-t border-neutral-100 ${i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}`}
            >
              <td className="px-4 py-3 text-neutral-600">{row.consecutivo}</td>
              <td className="px-4 py-3">
                {/* celeste y no cerulean: esa paleta solo define 50/500/700 */}
                <span className={`inline-block px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${
                  row.tipo === 'EVALUADOR'
                    ? 'bg-celeste-50 text-celeste-700 border border-celeste-500/40'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {row.tipoNombre}
                </span>
              </td>
              <td className="px-4 py-3 text-neutral-800 font-medium">{row.entidad}</td>
              <td className="px-4 py-3 text-neutral-700">
                {row.concepto}
                {row.detalle && (
                  <span className="block text-xs text-neutral-400 mt-0.5">{row.detalle}</span>
                )}
              </td>
              <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">{row.fecha}</td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => onDescargar(row)}
                  className="inline-flex items-center gap-1.5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold text-sm px-4 py-2 rounded transition-colors"
                >
                  <Download size={14} />
                  Descargar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CertificadosForm() {
  const [modo, setModo] = useState<Modo>('persona')

  const [tipoDoc, setTipoDoc]   = useState('CC')
  const [numDoc,  setNumDoc]    = useState('')

  const [codigo, setCodigo] = useState('')

  const [loading, setLoading]   = useState(false)
  const [alerta,  setAlerta]    = useState<{ msg: string; tipo: 'error' | 'info' } | null>(null)
  const [resultados, setResultados] = useState<CertificadoRow[] | null>(null)

  function resetForm() {
    setAlerta(null)
    setResultados(null)
    setNumDoc('')
    setCodigo('')
  }

  function switchModo(m: Modo) {
    setModo(m)
    resetForm()
  }

  async function buscar() {
    setAlerta(null)
    setResultados(null)

    if (modo === 'persona') {
      if (!tipoDoc)       return setAlerta({ msg: 'Debe seleccionar un Tipo de identificación', tipo: 'error' })
      if (!numDoc.trim()) return setAlerta({ msg: 'Número de identificación vacío', tipo: 'error' })
    } else {
      if (!codigo.trim()) return setAlerta({ msg: 'Código del certificado vacío', tipo: 'error' })
    }

    setLoading(true)
    try {
      const params =
        modo === 'persona'
          ? { tipoDocumento: tipoDoc, numero: numDoc.trim() }
          : { codigo: codigo.trim() }

      const { data } = await api.get<CertificadoRow[]>('/certificados', { params })

      if (!data.length) {
        setAlerta({ msg: 'No hay certificados registrados con esos datos', tipo: 'error' })
      } else {
        setResultados(data)
      }
    } catch {
      setAlerta({ msg: 'Error al consultar. Verifique su conexión o intente más tarde.', tipo: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function descargar(row: CertificadoRow) {
    // baseURL de axios: en dev es localhost:4000 sin /api, en prod /api tras nginx
    const base = api.defaults.baseURL ?? ''
    window.open(`${base}${row.urlPdf}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3 justify-center flex-wrap">
        <button
          onClick={() => switchModo('persona')}
          className={`px-6 py-2.5 rounded font-semibold text-sm transition-colors
            ${modo === 'persona'
              ? 'bg-green-500 text-white shadow-sm'
              : 'bg-white border border-green-500 text-green-600 hover:bg-green-50'}`}
        >
          Consulta por Persona
        </button>
        <button
          onClick={() => switchModo('codigo')}
          className={`px-6 py-2.5 rounded font-semibold text-sm transition-colors
            ${modo === 'codigo'
              ? 'bg-green-500 text-white shadow-sm'
              : 'bg-white border border-green-500 text-green-600 hover:bg-green-50'}`}
        >
          Consultar por Código
        </button>
      </div>

      <p className="text-center text-sm text-neutral-500">
        En este espacio podrá descargar sus certificados de participación en los eventos del GGPC,
        como beneficiario de una acción de formación o como evaluador del banco de evaluadores.
      </p>

      <div className="h-px bg-neutral-200" />

      {modo === 'persona' ? (
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-sm font-semibold text-neutral-700">Tipo Documento</label>
            <select
              value={tipoDoc}
              onChange={(e) => setTipoDoc(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
            <label className="text-sm font-semibold text-neutral-700">No.</label>
            <input
              type="text"
              value={numDoc}
              onChange={(e) => setNumDoc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscar()}
              placeholder="Número de documento"
              className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 max-w-sm mx-auto w-full">
          <label className="text-sm font-semibold text-neutral-700">Código del Certificado</label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="Ingrese el código"
            className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={buscar}
          disabled={loading}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-semibold px-8 py-2.5 rounded transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {alerta && <Alert message={alerta.msg} type={alerta.tipo} />}

      {resultados && (
        <ResultsTable rows={resultados} onDescargar={descargar} />
      )}
    </div>
  )
}
