'use client'

import api from '@/lib/api'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Reporte {
  necesidadId: number
  fechaRegistro: string | null
  periodoI: string | null
  herrOtra: string | null
  herrCreacion: number | null
  planCapa: number | null
  herrDescrip: string | null
  herrResultados: string | null
  empresaNombre: string
  empresaSigla: string
  nit: string
  digitoV: string
  departamento: string
  ciudad: string
  direccion: string
  telefono: string
  celular: string
  website: string
  cobertura: string
  ciiuCodigo: string
  ciiuDescripcion: string
  tipoEmpresa: string
  tamanoEmpresa: string
  repNombre: string
  repCargo: string
  repCorreo: string
  repTel: string
  repDocumento: string
  repTipoDoc: string
  objeto: string | null
  productos: string | null
  situacion: string | null
  papel: string | null
  retos: string | null
  experiencia: string | null
  eslabones: string | null
  interacciones: string | null
  herramientas: { herramienta: string; muestra: number }[]
  necesidades: { numero: number; nombre: string; beneficiarios: number }[]
  mesasSectoriales: { nombre: string }[]
  sectoresPertenece: { nombre: string }[]
  subsectoresPertenece: { nombre: string }[]
  sectoresRepresenta: { nombre: string }[]
  subsectoresRepresenta: { nombre: string }[]
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="py-2 pr-4 text-xs font-semibold text-[#003366] whitespace-nowrap w-2/5 align-top">{label}</td>
      <td className="py-2 text-xs text-neutral-700 align-top">{value || '—'}</td>
    </tr>
  )
}

function SectionHeader({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-3 rounded-t-2xl" style={{ backgroundColor: color }}>
      <h2 className="text-white font-bold text-sm">{children}</h2>
    </div>
  )
}

function TextBlock({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold text-[#003366] mb-1">{label}</p>
      <p className="text-xs text-neutral-700 whitespace-pre-wrap leading-relaxed bg-neutral-50 rounded-xl p-3 border border-neutral-100">
        {value}
      </p>
    </div>
  )
}

function ListTable({ items }: { items: { nombre: string }[] }) {
  if (!items.length) return <p className="text-xs text-neutral-400 italic">Sin registros.</p>
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200">
      <table className="w-full text-xs">
        <tbody>{items.map((it, i) => (
          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
            <td className="px-3 py-2 text-neutral-700">{it.nombre}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

export default function ReporteDiagnosticoPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const [data,    setData]    = useState<Reporte | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    document.title = 'Reporte Diagnóstico | SEP'
    api.get<Reporte>(`/necesidades/${id}/reporte`)
      .then(r => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 size={32} className="animate-spin text-[#003366]" />
    </div>
  )
  if (error || !data) return (
    <div className="p-10 text-center text-red-500 text-sm">
      Error al cargar el reporte.{' '}
      <button onClick={() => router.back()} className="underline">Volver</button>
    </div>
  )

  const sn = (v: number | null) => v === 1 ? 'Sí' : 'No'
  const telCel = [data.repTel, data.celular].filter(Boolean).join(' / ') || '—'

  return (
    <>
    <style>{`
      @media print {
        aside, header { display: none !important; }
        body, html { overflow: visible !important; height: auto !important; }
        body > div { display: block !important; height: auto !important; overflow: visible !important; }
        body > div > div { height: auto !important; overflow: visible !important; }
        main { overflow: visible !important; height: auto !important; }
      }
    `}</style>
    <div className="p-5 sm:p-7 xl:p-10 max-w-5xl mx-auto flex flex-col gap-6 print:p-4 print:gap-4">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/sena-logo.svg" alt="SENA" className="h-14 w-14" />
          <div>
            <p className="text-lg font-bold text-[#39A900]">REPORTE DE NECESIDADES DE FORMACIÓN</p>
            <p className="text-xs text-neutral-400">Sistema Especializado de Proyectos — GGPC SENA</p>
          </div>
        </div>
        <div className="flex gap-3 print:hidden">
          <button onClick={() => router.back()}
            className="px-4 py-2 text-xs text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition">
            ← Volver
          </button>
          <button onClick={() => window.print()}
            className="px-4 py-2 text-xs font-semibold bg-[#003366] hover:bg-[#004080] text-white rounded-xl transition">
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Número y fecha */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Diagnóstico N°</span>
          <span className="text-2xl font-bold text-[#003366]">{data.necesidadId}</span>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Fecha y Hora de Registro</span>
          <span className="text-sm font-bold text-[#003366]">{fmtDateTime(data.fechaRegistro)}</span>
        </div>
      </div>

      {/* Datos Generales */}
      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <SectionHeader color="#003366">DATOS GENERALES DE LA EMPRESA / GREMIO</SectionHeader>
        <div className="p-5">
          <p className="text-[10px] font-bold text-[#003366] mb-3 uppercase tracking-wide">Datos del Proponente</p>
          <table className="w-full">
            <tbody>
              <Row label="Nombre / Razón Social"        value={data.empresaNombre} />
              <Row label="Sigla"                         value={data.empresaSigla} />
              <Row label="NIT"                           value={`${data.nit}-${data.digitoV}`} />
              <Row label="Departamento de Domicilio"     value={data.departamento} />
              <Row label="Ciudad / Municipio"            value={data.ciudad} />
              <Row label="Dirección de Domicilio"        value={data.direccion} />
              <Row label="Teléfono / Celular"            value={telCel} />
              <Row label="Página Web"                    value={data.website} />
              <Row label="Cobertura"                     value={data.cobertura} />
              <Row label="Código CIIU / Actividad Económica"
                   value={[data.ciiuCodigo, data.ciiuDescripcion].filter(Boolean).join(' — ')} />
              <Row label="Tipo de Empresa / Gremio"      value={data.tipoEmpresa} />
              <Row label="Tamaño de la Empresa / Gremio" value={data.tamanoEmpresa} />
            </tbody>
          </table>
        </div>
      </section>

      {/* Mesas Sectoriales */}
      {data.mesasSectoriales.length > 0 && (
        <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <SectionHeader color="#003366">MESAS SECTORIALES SENA</SectionHeader>
          <div className="p-5">
            <ListTable items={data.mesasSectoriales} />
          </div>
        </section>
      )}

      {/* Representante Legal */}
      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <SectionHeader color="#003366">DATOS DEL REPRESENTANTE LEGAL</SectionHeader>
        <div className="p-5">
          <table className="w-full">
            <tbody>
              <Row label="Tipo de Identificación"  value={data.repTipoDoc} />
              <Row label="N° de Identificación"    value={data.repDocumento} />
              <Row label="Nombre Completo"          value={data.repNombre} />
              <Row label="Cargo en la Empresa"      value={data.repCargo} />
              <Row label="Email"                    value={data.repCorreo} />
              <Row label="Teléfono / Celular"       value={data.repTel} />
            </tbody>
          </table>
        </div>
      </section>

      {/* Generalidades */}
      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <SectionHeader color="#003366">GENERALIDADES DE LA EMPRESA / GREMIO</SectionHeader>
        <div className="p-5 flex flex-col gap-4">
          <TextBlock label="Objeto social de la empresa / gremio" value={data.objeto} />
          <TextBlock label="Productos y/o servicios ofrecidos y mercado al que van dirigidos" value={data.productos} />
          <TextBlock label="Situación actual y proyección de la empresa / gremio" value={data.situacion} />
          <TextBlock label="Papel de la empresa / gremio en el sector y/o región que pertenece o representa" value={data.papel} />
          <TextBlock label="Retos estratégicos de la empresa / gremio, vinculados a la formación" value={data.retos} />
          <TextBlock label="Experiencia de la empresa / gremio en actividades formativas" value={data.experiencia} />

          {/* Sectores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-neutral-100 pt-4">
            <div>
              <p className="text-xs font-semibold text-[#003366] mb-2">Sector(es) al que Pertenece</p>
              <ListTable items={data.sectoresPertenece} />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#003366] mb-2">Subsector(es) al que Pertenece</p>
              <ListTable items={data.subsectoresPertenece} />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#003366] mb-2">Sector(es) que Representa</p>
              <ListTable items={data.sectoresRepresenta} />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#003366] mb-2">Subsector(es) que Representa</p>
              <ListTable items={data.subsectoresRepresenta} />
            </div>
          </div>

          {/* Cadena productiva */}
          {(data.eslabones || data.interacciones) && (
            <div className="flex flex-col gap-4 border-t border-neutral-100 pt-4">
              <TextBlock label="Identificación de los eslabones de la cadena productiva del proponente"
                value={data.eslabones} />
              <TextBlock label="Descripción de las interacciones del proponente con otros actores"
                value={data.interacciones} />
            </div>
          )}
        </div>
      </section>

      {/* Diagnóstico */}
      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <SectionHeader color="#003366">DIAGNÓSTICO DE NECESIDADES DE FORMACIÓN</SectionHeader>
        <div className="p-5 flex flex-col gap-5">
          <div>
            <p className="text-[10px] font-bold text-[#003366] mb-2 uppercase tracking-wide">
              Aplicación Diagnóstico de Necesidades de Formación
            </p>
            {data.herramientas.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-neutral-200">
                <table className="w-full text-xs">
                  <thead><tr className="bg-[#003366]/10">
                    <th className="text-left px-3 py-2 font-semibold text-[#003366]">Herramienta Utilizada</th>
                    <th className="text-center px-3 py-2 font-semibold text-[#003366] w-40">Muestra Poblacional</th>
                  </tr></thead>
                  <tbody>{data.herramientas.map((h, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                      <td className="px-3 py-2 text-neutral-700">{h.herramienta}</td>
                      <td className="px-3 py-2 text-center text-neutral-700">{h.muestra}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="text-xs text-neutral-400 italic">Sin herramientas registradas.</p>}
          </div>

          <table className="w-full">
            <tbody>
              <Row label="Fecha de Diagnóstico"                 value={fmtDate(data.periodoI)} />
              <Row label="Otro tipo de herramienta"             value={data.herrOtra} />
              <Row label="¿Herramienta de creación propia?"     value={sn(data.herrCreacion)} />
              <Row label="¿Cuenta con plan de capacitación?"    value={sn(data.planCapa)} />
            </tbody>
          </table>

          <TextBlock label="Descripción de la(s) herramienta(s) utilizada(s) y muestra poblacional"
            value={data.herrDescrip} />
          <TextBlock label="Resumen de los principales resultados cualitativos y cuantitativos"
            value={data.herrResultados} />
        </div>
      </section>

      {/* Necesidades detectadas */}
      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <SectionHeader color="#39A900">NECESIDADES DE FORMACIÓN DETECTADAS</SectionHeader>
        <div className="p-5">
          {data.necesidades.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-neutral-200">
              <table className="w-full text-xs">
                <thead><tr className="bg-[#39A900]/10">
                  <th className="text-center px-3 py-2 font-semibold text-[#39A900] w-12">#</th>
                  <th className="text-left px-3 py-2 font-semibold text-[#39A900]">
                    Necesidad o problema puntual — respuesta mediante formación
                  </th>
                  <th className="text-center px-3 py-2 font-semibold text-[#39A900] w-32">N° Beneficiarios</th>
                </tr></thead>
                <tbody>{data.necesidades.map((n, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                    <td className="px-3 py-2 text-center font-semibold text-neutral-500">{n.numero}</td>
                    <td className="px-3 py-2 text-neutral-700">{n.nombre}</td>
                    <td className="px-3 py-2 text-center text-neutral-700">{n.beneficiarios}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-neutral-400 text-center py-4 italic">Sin necesidades registradas.</p>
          )}
        </div>
      </section>

      <div className="h-4 print:hidden" />
    </div>
    </>
  )
}
