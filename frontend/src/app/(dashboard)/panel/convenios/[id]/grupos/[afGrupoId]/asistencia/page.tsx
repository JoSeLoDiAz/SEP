'use client'

import api from '@/lib/api'
import { ConvenioNav } from '@/components/layout/convenio-nav'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  AlertCircle, ArrowLeft, BadgeCheck, ClipboardCheck, Download, ExternalLink,
  Loader2, Search,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

const TITLE = '#00304D'

interface Cabecera {
  afGrupoId: number
  grupoNumero: number | null
  afId: number
  afNumero: number | null
  afNombre: string | null
  modalidadId: number | null
  modalidad: string | null
  tipoEvento: string | null
  totalHoras: number
  formato: string
  empresaRazonSocial: string | null
  convenioNumero: string | null
  convocatoria: string | null
  programa: string | null
  director: string | null
  plataforma: string | null
  linkAsistencia: string | null
  fechaInicio: string | null
  fechaCorte: string
  totalSesionesAF: number
}
interface UnidadTematica {
  utId: number
  numero: number
  nombre: string
  numSesiones: number
}
interface Beneficiario {
  nro: number
  personaId: number
  nombreCompleto: string
  tipoDocSigla: string | null
  identificacion: string | null
  email: string | null
  celular: string | null
  departamento: string | null
  ciudad: string | null
  transferencia: string | null
  perfilTransferencia: string | null
  certifica: string | null
  horasPorUT: Record<number, number[]>
  totalHoras: number
  porcentajeAvance: number
}
interface Reporte {
  cabecera: Cabecera
  unidades: UnidadTematica[]
  beneficiarios: Beneficiario[]
}

export default function AsistenciaPage() {
  const params = useParams<{ id: string; afGrupoId: string }>()
  const proyectoId = Number(params?.id)
  const afGrupoId = Number(params?.afGrupoId)

  const [data, setData] = useState<Reporte | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')
  const [descargando, setDescargando] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    document.title = 'Reporte Asistencia | SEP'
    if (!proyectoId || !afGrupoId) return
    setCargando(true)
    api.get<Reporte>(`/certificacion/proyecto/${proyectoId}/grupo/${afGrupoId}/asistencia`)
      .then(r => setData(r.data))
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        setError(msg ?? 'No se pudo cargar el reporte de asistencia.')
      })
      .finally(() => setCargando(false))
  }, [proyectoId, afGrupoId])

  async function descargarExcel() {
    setDescargando(true)
    try {
      const r = await api.get<Blob>(
        `/certificacion/proyecto/${proyectoId}/grupo/${afGrupoId}/asistencia/excel`,
        { responseType: 'blob' },
      )
      const blob = new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Asistencia_AF${data?.cabecera.afNumero}_G${data?.cabecera.grupoNumero}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setToast({ tipo: 'error', msg: 'No se pudo descargar el reporte.' })
    } finally { setDescargando(false) }
  }

  const benefsFiltrados = useMemo(() => {
    if (!data) return []
    const q = filtro.trim().toLowerCase()
    if (!q) return data.beneficiarios
    return data.beneficiarios.filter(b =>
      (b.nombreCompleto ?? '').toLowerCase().includes(q)
      || (b.identificacion ?? '').toLowerCase().includes(q)
      || (b.email ?? '').toLowerCase().includes(q),
    )
  }, [data, filtro])

  return (
    <div className="min-h-screen bg-[#F0F4F8] p-4 md:p-6">
      <div className="max-w-[1600px] mx-auto space-y-4">
        <ConvenioNav proyectoId={proyectoId} />

        {toast && (
          <ToastBetowa show onClose={() => setToast(null)} tipo={toast.tipo}
            titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
            mensaje={toast.msg} duration={4000} />
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2.5 rounded-xl shadow-sm" style={{ backgroundColor: TITLE }}>
            <ClipboardCheck size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: TITLE }}>Reporte de Asistencia</h1>
            <p className="text-xs text-neutral-500">
              Visualiza el avance de cumplimiento de los beneficiarios y descarga este formato.
            </p>
          </div>
          <Link href={`/panel/convenios/${proyectoId}/grupos/${afGrupoId}/certificar`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-neutral-500 hover:text-[#00304D]">
            <ArrowLeft size={13} /> Volver a Certificar
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {cargando ? (
          <div className="flex items-center gap-2 py-16 justify-center text-neutral-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Cargando reporte…
          </div>
        ) : data && (
          <>
            {/* Encabezado formal (F2.x / F3.1) */}
            <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-5 text-center space-y-1">
              <h2 className="text-sm font-bold text-neutral-700">SERVICIO NACIONAL DE APRENDIZAJE</h2>
              <p className="text-xs text-neutral-500">DIRECCIÓN DEL SISTEMA NACIONAL DE FORMACIÓN PARA EL TRABAJO</p>
              <p className="text-xs text-neutral-500">
                SISTEMA ESPECIALIZADO DE PROYECTOS — SEP — PROGRAMA {data.cabecera.programa ?? '—'} — CONVOCATORIA {data.cabecera.convocatoria ?? '—'}
              </p>
            </section>

            {/* Card formato */}
            <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#39A900]" />
              <div className="px-5 py-3 bg-[#00304D] text-white text-sm font-bold flex items-center gap-2">
                <ClipboardCheck size={16} /> {data.cabecera.formato}
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                <Row label="NOMBRE DEL CONVINIENTE" value={data.cabecera.empresaRazonSocial} />
                <Row label="NOMBRE DEL DIRECTOR DE PROYECTO" value={data.cabecera.director} />
                <Row label="NÚMERO DE CONVENIO" value={data.cabecera.convenioNumero} mono />
                <Row label="NÚMERO DE HORAS TOTALES AF" value={String(data.cabecera.totalHoras)} />
                <Row label="FECHA INICIO AF" value={data.cabecera.fechaInicio} />
                <Row label="FECHA DE CORTE" value={data.cabecera.fechaCorte} />
                <Row label="TIPO DE EVENTO" value={data.cabecera.tipoEvento} />
                <Row label="CANTIDAD DE SESIONES" value={String(data.cabecera.totalSesionesAF)} />
                <Row label="GRUPO N°" value={String(data.cabecera.grupoNumero ?? '—')} />
                <Row label={Number(data.cabecera.modalidadId) === 4 ? 'PROVEEDOR DE LA AF' : 'PLATAFORMA USADA'}
                  value={data.cabecera.plataforma} />
                <Row label={Number(data.cabecera.modalidadId) === 4 ? 'LINK DE ASISTENCIA' : 'LINK DE GRABACIÓN'}
                  value={data.cabecera.linkAsistencia}
                  link={data.cabecera.linkAsistencia ?? undefined} />
                <Row label="NOMBRE ACCIÓN DE FORMACIÓN" value={data.cabecera.afNombre} />
              </div>
              <div className="mx-5 mb-5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-[11px] text-emerald-800">
                <strong>* Tiempo de entrega a la interventoría:</strong> dentro de los cinco (5) días hábiles siguientes a la finalización
                de cada grupo por acción de formación. Sin perjuicio de lo anterior, terminada cada jornada de unidad temática por
                acción de formación, el conviniente debe remitir a la interventoría las listas de asistencia.
              </div>
            </section>

            {/* Toolbar */}
            <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 flex flex-wrap items-center gap-3 bg-neutral-50">
                <div className="flex-1 min-w-[200px] max-w-md relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={filtro}
                    onChange={e => setFiltro(e.target.value)}
                    placeholder="Buscar por nombre, identificación o correo…"
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]"
                  />
                </div>
                <span className="text-xs text-neutral-500">
                  {filtro
                    ? <>Mostrando <strong>{benefsFiltrados.length}</strong> de {data.beneficiarios.length}</>
                    : <>{data.beneficiarios.length} beneficiario{data.beneficiarios.length === 1 ? '' : 's'}</>}
                </span>
                <button onClick={descargarExcel} disabled={descargando}
                  className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-40 transition"
                  style={{ backgroundColor: '#39A900' }}>
                  {descargando ? <><Loader2 size={14} className="animate-spin" /> Generando…</> : <><Download size={14} /> Descargar Excel</>}
                </button>
              </div>

              {/* Tabla densa (scroll horizontal). */}
              <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
                <table className="text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#00304D] text-white text-left">
                      <th className="px-2 py-2 w-10 text-center sticky left-0 bg-[#00304D]">N°</th>
                      <th className="px-3 py-2 sticky left-10 bg-[#00304D] min-w-[200px]">NOMBRES Y APELLIDOS</th>
                      <th className="px-2 py-2">TIPO DOC</th>
                      <th className="px-2 py-2">N° IDENT.</th>
                      <th className="px-2 py-2">CORREO</th>
                      <th className="px-2 py-2">CELULAR</th>
                      <th className="px-2 py-2">DEPARTAMENTO</th>
                      <th className="px-2 py-2">MUNICIPIO</th>
                      <th className="px-2 py-2 text-center">¿TRANSF?</th>
                      <th className="px-2 py-2">PERFIL BENEFICIARIO</th>
                      {data.unidades.map(u => (
                        Array.from({ length: u.numSesiones }, (_, i) => (
                          <th key={`${u.utId}-${i}`}
                            className="px-2 py-2 text-center align-bottom min-w-[110px] max-w-[140px]"
                            title={`UT ${u.numero} · ${u.nombre} · Sesión ${i + 1}`}>
                            <span className="block text-[9px] text-neutral-300 font-normal normal-case leading-tight line-clamp-2">
                              {u.nombre}
                            </span>
                            <span className="block mt-1">S{i + 1}</span>
                          </th>
                        ))
                      ))}
                      <th className="px-2 py-2 text-center bg-[#0070C0]">TOTAL</th>
                      <th className="px-2 py-2 text-center bg-[#0070C0]">% AVANCE</th>
                      <th className="px-2 py-2 text-center bg-[#0070C0]">CERTIFICA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {benefsFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={11 + data.unidades.reduce((a, u) => a + u.numSesiones, 0)}
                          className="px-3 py-8 text-center text-sm text-neutral-400">
                          No hay beneficiarios que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : benefsFiltrados.map(b => (
                      <tr key={b.personaId} className="hover:bg-neutral-50">
                        <td className="px-2 py-1.5 text-center text-neutral-500 sticky left-0 bg-white">{b.nro}</td>
                        <td className="px-3 py-1.5 font-medium text-neutral-800 sticky left-10 bg-white">{b.nombreCompleto || '—'}</td>
                        <td className="px-2 py-1.5">{b.tipoDocSigla ?? '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{b.identificacion ?? '—'}</td>
                        <td className="px-2 py-1.5 text-[#0070C0] truncate max-w-[180px]" title={b.email ?? ''}>{b.email ?? '—'}</td>
                        <td className="px-2 py-1.5">{b.celular ?? '—'}</td>
                        <td className="px-2 py-1.5">{b.departamento ?? '—'}</td>
                        <td className="px-2 py-1.5">{b.ciudad ?? '—'}</td>
                        <td className="px-2 py-1.5 text-center font-bold">{b.transferencia ?? '—'}</td>
                        <td className="px-2 py-1.5">{b.perfilTransferencia ?? '—'}</td>
                        {data.unidades.map(u => {
                          const horas = b.horasPorUT[u.utId] ?? Array(20).fill(0)
                          return Array.from({ length: u.numSesiones }, (_, i) => (
                            <td key={`${u.utId}-${i}`} className="px-2 py-1.5 text-center">
                              {horas[i] ?? 0}
                            </td>
                          ))
                        })}
                        <td className="px-2 py-1.5 text-center font-bold text-[#0070C0]">{b.totalHoras}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[36px] text-[11px] font-bold px-2 py-0.5 rounded-full ${b.porcentajeAvance >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {b.porcentajeAvance}%
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {(b.certifica ?? '').toUpperCase() === 'SI'
                            ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700"><BadgeCheck size={12} /> SÍ</span>
                            : <span className="text-[11px] font-bold text-neutral-400">NO</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

/** Pequeño helper para imprimir un campo del header en dos columnas. */
function Row({ label, value, mono, link }: { label: string; value: string | null; mono?: boolean; link?: string }) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 py-1.5 border-b border-neutral-100 last:border-0">
      <span className="font-bold text-neutral-600 uppercase tracking-wide text-[10px] sm:w-56 shrink-0">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer"
          className="text-[#0070C0] hover:underline inline-flex items-center gap-1 break-all">
          {value || '—'} {value && <ExternalLink size={11} />}
        </a>
      ) : (
        <span className={`text-neutral-800 ${mono ? 'font-mono' : ''} break-words`}>{value || '—'}</span>
      )}
    </div>
  )
}
