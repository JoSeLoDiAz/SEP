'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { fmtDateTimeNumeric as fmtDateTime } from '@/lib/format-date'
import {
  Activity, BookOpen, Briefcase, Building2, CalendarDays, CheckCircle2,
  ClipboardList, Compass, FileText, FolderKanban, Info, Layers, Loader2,
  MapPin, Notebook, Package, Printer, Receipt, Repeat, Search, Target,
  TrendingUp, UserCheck, Users, Users2, Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

// ── Types base ────────────────────────────────────────────────────────────────

interface Empresa {
  razonSocial: string; sigla: string | null; nit: string | number; digitoV: string | number
  email: string | null; direccion: string | null; telefono: string | null; celular: string | null
  website: string | null; departamento: string | null; ciudad: string | null
  cobertura: string | null; ciiuCodigo: string | null; ciiuDescripcion: string | null
  tipoEmpresa: string | null; tamanoEmpresa: string | null
  repNombre: string | null; repCargo: string | null; repCorreo: string | null; repTel: string | null
  repDocumento: string | null; repTipoDoc: string | null
  objeto: string | null; productos: string | null; situacion: string | null; papel: string | null
  retos: string | null; experiencia: string | null
  eslabones: string | null; interacciones: string | null
}
interface Contacto { nombre: string; cargo: string; correo: string; telefono: string | null; documento: string | null; tipoDoc: string | null }
interface AfReporte {
  afId: number; numero: number; nombre: string
  justnec: string | null; causa: string | null; efectos: string | null; objetivo: string | null
  numHorasGrupo: number | null; numGrupos: number | null; numTotHoras: number | null
  benefGrupo: number | null; benefViGrupo: number | null; numBenef: number | null
  necesidadFormacionId: number | null; necesidadId: number | null
  necesidadFormacionNumero: number | null; necesidadFormacionNombre: string | null
  tipoEvento: string | null; modalidad: string | null; metodologia: string | null
}
interface DiagnosticoReporte {
  necesidadId: number
  fechaRegistro: string | null
  periodoI: string | null
  herrOtra: string | null
  herrCreacion: number | null
  planCapa: number | null
  herrDescrip: string | null
  herrResultados: string | null
  herramientas: { herramienta: string; muestra: number }[]
  necesidades: { numero: number; nombre: string; beneficiarios: number }[]
  empresaNombre: string
}
interface PresupuestoAf {
  afId: number; numero: number; nombre: string; beneficiarios: number
  cofSena: number; contraEspecie: number; contraDinero: number; total: number
}
interface PresupuestoGo {
  afId: number; numero: number; nombre: string
  cofSena: number; contraEspecie: number; contraDinero: number; total: number
}
interface PresupuestoData {
  afs: PresupuestoAf[]
  totalesAfs: { totalAfs: number; totalBeneficiarios: number; valorTotalAFs: number
    totalCofSena: number; totalContraEspecie: number; totalContraDinero: number
    porcCofSena: number; porcContraEspecie: number; porcContraDinero: number }
  go: { porAf: PresupuestoGo[]; total: number; porcSobreAFs: number; codigo: string; topePermitido: number
    totalCofSena: number; totalContraEspecie: number; totalContraDinero: number }
  transferencia: { totalBeneficiarios: number; porcBeneficiarios: number; totalValor: number; porcValor: number }
  totalProyecto: { cofSena: number; porcCofSena: number; contraEspecie: number; porcContraEspecie: number
    contraDinero: number; porcContraDinero: number; valorTotal: number }
}

interface Reporte {
  proyecto: {
    id: number; codigo: string | null; nombre: string; objetivo: string | null
    convocatoria: string | null; modalidad: string | null; modalidadId: number; estado: number
    fechaRegistro: string | null; fechaRadicacion: string | null
  }
  empresa: Empresa
  mesasSectoriales: string[]
  sectoresPertenece: string[]; subsectoresPertenece: string[]
  sectoresRepresenta: string[]; subsectoresRepresenta: string[]
  contactos: Contacto[]
  acciones: AfReporte[]
  diagnosticos: DiagnosticoReporte[]
  presupuesto: PresupuestoData | null
}

// ── Types detalle por AF (consumidos desde endpoints existentes) ─────────────

interface Opcion    { id: number; nombre: string }
interface AreaItem  { aafId: number; areaId: number; nombre: string; otro: string | null }
interface NivelItem { anId: number; nivelId: number; nombre: string }
interface CuocItem  { ocAfId: number; cuocId: number; nombre: string }
interface PerfilAf {
  afEnfoqueId: number | null; enfoque: string | null
  justAreas: string | null; justNivelesOcu: string | null
  mujer: number | null; numCampesino: number | null; justCampesino: string | null
  numPopular: number | null; justPopular: string | null
  trabDiscapac: number | null; trabajadorBic: number | null
  mipymes: number | null; trabMipymes: number | null; mipymesD: string | null
  cadenaProd: number | null; trabCadProd: number | null; cadenaProdD: string | null
  areas: AreaItem[]; niveles: NivelItem[]; cuoc: CuocItem[]
}
interface SectorItem  { psId?: number; saId?: number; sectorId: number; nombre: string }
interface SubSectorItem { pssId?: number; ssaId?: number; subsectorId: number; nombre: string }
interface SectoresAf {
  justificacion: string | null
  sectoresBenef: SectorItem[]; subsectoresBenef: SubSectorItem[]
  sectoresAf: SectorItem[]; subsectoresAf: SubSectorItem[]
}
interface CoberturaGrupo {
  cobId: number
  deptoId: number | null; deptoNombre: string | null
  ciudadId: number | null; ciudadNombre: string | null
  benef: number | null; modal: string | null; rural: number | null
}
interface GrupoAf {
  grupoId: number; grupoNumero: number
  justificacion: string | null
  totalBenef: number; numCoberturas: number
  coberturas: CoberturaGrupo[]
}
interface UTPerfilCap { perfilId: number; rubroId: number; rubroNombre: string; horasCap: number; dias: number | null }
interface UTActividad { actId: number; actividadId: number; nombre: string; otro: string | null }
interface UTDetalle {
  utId: number; numero: number; nombre: string
  competencias: string | null; contenido: string | null; justActividad: string | null
  horasPP: number | null; horasPV: number | null; horasPPAT: number | null; horasPHib: number | null
  horasTP: number | null; horasTV: number | null; horasTPAT: number | null; horasTHib: number | null
  esTransversal: number; horasTransversal: number | null
  articulacionTerritorialId: number | null; articulacionTerritorialNombre: string | null
  actividades: UTActividad[]; perfiles: UTPerfilCap[]
}
interface MaterialAf {
  tipoAmbienteId: number | null
  gestionConocimientoId: number | null
  materialFormacionId: number | null
  justMat: string | null; insumo: string | null; justInsumo: string | null
  recursos: { rdafId: number; recursoId: number; nombre: string }[]
}
interface AlineacionAf {
  compod: string | null; justificacion: string | null
  resDesem: string | null; resForm: string | null
  componenteId: number | null; componenteNombre: string | null
  retoNacionalId: number | null
}
interface RubroAf {
  afrubroid: number; rubroId: number; codigo: string; nombre: string
  paquete: string | null; caso: string | null
  justificacion: string | null
  numHoras: number | null; cantidad: number | null; beneficiarios: number | null
  dias: number | null; numGrupos: number | null
  totalRubro: number; cofSena: number; contraEspecie: number; contraDinero: number
  valorMaximo: number | null; valorBenef: number | null
  porcSena: number | null; porcEspecie: number | null; porcDinero: number | null
}
interface AfDetalle {
  perfil: PerfilAf | null
  sectores: SectoresAf | null
  grupos: GrupoAf[]
  unidadesTematicas: UTDetalle[]
  material: MaterialAf | null
  alineacion: AlineacionAf | null
  rubros: RubroAf[]
}

// ── Helpers UI ────────────────────────────────────────────────────────────────

const TITLE_COLOR = '#00304D'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n ?? 0)
const pct = (n: number) => `${Number(n ?? 0).toFixed(2)}%`
const yn  = (v: number | null | undefined) => v === 1 ? 'Sí' : v === 0 ? 'No' : '—'

function SectionHeader({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="px-4 sm:px-5 py-3 rounded-t-2xl flex items-center gap-3" style={{ backgroundColor: TITLE_COLOR }}>
      {Icon && (
        <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
          <Icon size={14} className="text-white" strokeWidth={2.2} />
        </div>
      )}
      <h2 className="text-white font-bold text-xs sm:text-sm tracking-wide uppercase">{children}</h2>
    </div>
  )
}
function SubHeader({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {Icon && <Icon size={13} className="shrink-0" style={{ color: TITLE_COLOR }} strokeWidth={2.2} />}
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: TITLE_COLOR }}>{children}</p>
    </div>
  )
}
function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="py-2 pr-4 text-xs font-semibold whitespace-nowrap w-2/5 align-top" style={{ color: TITLE_COLOR }}>{label}</td>
      <td className="py-2 text-xs text-neutral-700 align-top">{value || value === 0 ? value : '—'}</td>
    </tr>
  )
}
function TextBlock({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold mb-1" style={{ color: TITLE_COLOR }}>{label}</p>
      <p className="text-xs text-neutral-700 whitespace-pre-wrap leading-relaxed bg-neutral-50 rounded-xl p-3 border border-neutral-100">
        {value}
      </p>
    </div>
  )
}
// Variante que siempre renderiza (muestra "—" cuando está vacío)
function TextBlockAlways({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-1" style={{ color: TITLE_COLOR }}>{label}</p>
      <p className={`text-xs whitespace-pre-wrap leading-relaxed rounded-xl p-3 border border-neutral-100 ${value ? 'text-neutral-700 bg-neutral-50' : 'text-neutral-400 italic bg-white'}`}>
        {value || '—'}
      </p>
    </div>
  )
}
function ListTable({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-xs text-neutral-400 italic">Sin registros.</p>
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200">
      <table className="w-full text-xs">
        <tbody>{items.map((it, i) => (
          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
            <td className="px-3 py-2 text-neutral-700">{it}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════

export default function ReporteProyectoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData]       = useState<Reporte | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  // Detalle por AF (cargado tras el reporte base)
  const [afsDetalle, setAfsDetalle] = useState<Record<number, AfDetalle>>({})
  const [loadingDetalles, setLoadingDetalles] = useState(false)

  // Catálogos (para resolver IDs → nombres en alineación, ambiente, etc.)
  const [retos, setRetos]                     = useState<Opcion[]>([])
  const [tiposAmbiente, setTiposAmbiente]     = useState<Opcion[]>([])
  const [gestionConocs, setGestionConocs]     = useState<Opcion[]>([])
  const [materialesForm, setMaterialesForm]   = useState<Opcion[]>([])

  // Modal de confirmación del proyecto
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  // Toast estilo Betowa
  const toastKey = useRef(0)
  const [toastKey2, setToastKey2] = useState(0)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error' | 'warning'; titulo: string; msg: string } | null>(null)
  function showToast(tipo: 'success' | 'error' | 'warning', titulo: string, msg: string) {
    toastKey.current++
    setToast({ tipo, titulo, msg })
    setToastKey2(toastKey.current)
  }

  // Validación de completitud para confirmar
  const [validacion, setValidacion] = useState<{ ok: boolean; issues: string[] } | null>(null)
  const [validando, setValidando] = useState(false)

  useEffect(() => {
    document.title = 'Reporte del Proyecto | SEP'
    api.get<Reporte>(`/proyectos/${id}/reporte`)
      .then(r => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  // Catálogos auxiliares (una sola vez)
  useEffect(() => {
    api.get<Opcion[]>('/proyectos/retonacionales').then(r => setRetos(r.data)).catch(() => {})
    api.get<Opcion[]>('/proyectos/tiposambiente').then(r => setTiposAmbiente(r.data)).catch(() => {})
    api.get<Opcion[]>('/proyectos/gestionconocimientos').then(r => setGestionConocs(r.data)).catch(() => {})
    api.get<Opcion[]>('/proyectos/materialformacion').then(r => setMaterialesForm(r.data)).catch(() => {})
  }, [])

  // Una vez tenemos el reporte, cargar el detalle de cada AF en paralelo
  useEffect(() => {
    if (!data) return
    setLoadingDetalles(true)
    const fetchAf = async (afId: number): Promise<AfDetalle> => {
      const proyectoId = data.proyecto.id
      const [perfil, sectores, gruposBasicos, utsResumen, material, alineacion, rubros] = await Promise.all([
        api.get<PerfilAf>(`/proyectos/${proyectoId}/acciones/${afId}/beneficiarios`).then(r => r.data).catch(() => null),
        api.get<SectoresAf>(`/proyectos/${proyectoId}/acciones/${afId}/sectores`).then(r => r.data).catch(() => null),
        api.get<Omit<GrupoAf, 'coberturas'>[]>(`/proyectos/${proyectoId}/acciones/${afId}/grupos`).then(r => r.data).catch(() => [] as Omit<GrupoAf, 'coberturas'>[]),
        api.get<{ utId: number }[]>(`/proyectos/${proyectoId}/acciones/${afId}/unidades`).then(r => r.data).catch(() => [] as { utId: number }[]),
        api.get<MaterialAf>(`/proyectos/${proyectoId}/acciones/${afId}/material`).then(r => r.data).catch(() => null),
        api.get<AlineacionAf>(`/proyectos/${proyectoId}/acciones/${afId}/alineacion`).then(r => r.data).catch(() => null),
        api.get<RubroAf[]>(`/proyectos/${proyectoId}/acciones/${afId}/rubros`).then(r => r.data).catch(() => [] as RubroAf[]),
      ])

      const grupos: GrupoAf[] = await Promise.all(
        gruposBasicos.map(async (g) => ({
          ...g,
          coberturas: await api.get<CoberturaGrupo[]>(`/proyectos/${proyectoId}/acciones/${afId}/grupos/${g.grupoId}/coberturas`)
            .then(r => r.data).catch(() => []),
        })),
      )

      const unidadesTematicas: UTDetalle[] = (await Promise.all(
        utsResumen.map(async (ut) =>
          api.get<UTDetalle>(`/proyectos/${proyectoId}/acciones/${afId}/unidades/${ut.utId}`)
            .then(r => r.data).catch(() => null),
        ),
      )).filter((u): u is UTDetalle => u !== null)

      return { perfil, sectores, grupos, unidadesTematicas, material, alineacion, rubros }
    }

    Promise.all(
      data.acciones.map(async (a) => {
        try {
          const det = await fetchAf(a.afId)
          setAfsDetalle(prev => ({ ...prev, [a.afId]: det }))
        } catch { /* ignorar individuales */ }
      }),
    ).finally(() => setLoadingDetalles(false))
  }, [data])

  async function handleConfirmar() {
    setConfirmando(true)
    try {
      const resp = await api.post<{ message: string; estado: number }>(`/proyectos/${id}/radicar`)
      const reversado = resp.data?.estado === 2
      showToast(
        'success',
        reversado ? 'Proyecto reversado' : '¡Proyecto confirmado!',
        reversado
          ? 'La confirmación del proyecto fue revertida correctamente.'
          : 'El proyecto quedó listo para envío a la siguiente plataforma.',
      )
      setConfirmOpen(false)
      const r = await api.get<Reporte>(`/proyectos/${id}/reporte`)
      setData(r.data)
    } catch (e: any) {
      // Si el backend devuelve issues, los mostramos en el modal
      const respIssues = e?.response?.data?.issues
      if (Array.isArray(respIssues) && respIssues.length > 0) {
        setValidacion({ ok: false, issues: respIssues })
        showToast('warning', 'Faltan datos por completar', e?.response?.data?.message ?? 'Revise la lista de pendientes en el modal.')
      } else {
        showToast('error', 'No se pudo confirmar', e?.response?.data?.message ?? 'Ocurrió un error al confirmar el proyecto.')
      }
    } finally { setConfirmando(false) }
  }

  async function abrirConfirmar() {
    setConfirmOpen(true)
    // Solo validamos cuando vamos a confirmar (no al desconfirmar)
    if (data?.proyecto.estado !== 1) {
      setValidando(true)
      setValidacion(null)
      try {
        const r = await api.get<{ ok: boolean; issues: string[] }>(`/proyectos/${id}/validacion`)
        setValidacion(r.data)
      } catch {
        setValidacion({ ok: false, issues: ['No se pudo verificar la completitud del proyecto.'] })
      } finally { setValidando(false) }
    }
  }

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 size={32} className="animate-spin" style={{ color: TITLE_COLOR }} />
    </div>
  )
  if (error || !data) return (
    <div className="p-10 text-center text-red-500 text-sm">
      Error al cargar el reporte.{' '}
      <button onClick={() => router.back()} className="underline">Volver</button>
    </div>
  )

  const { proyecto, empresa, mesasSectoriales, sectoresPertenece, subsectoresPertenece,
          sectoresRepresenta, subsectoresRepresenta, contactos, acciones, diagnosticos, presupuesto } = data

  const telCel = [empresa.telefono, empresa.celular].filter(Boolean).join(' / ') || '—'
  const yaConfirmado = proyecto.estado === 1
  const aprobado = proyecto.estado === 3

  // ── Plan Operativo: cada fila combina AF + GO por contrapartida ─────────────
  // Override SOLO en este reporte: para TALLER-PUESTO DE TRABAJO REAL las horas
  // del Plan Operativo son siempre 8 (independiente de lo registrado en la AF).
  const esTallerPuestoTrabajo = (tipoEvento: string | null) =>
    !!tipoEvento && /puesto\s*de\s*trabajo/i.test(tipoEvento)
  const planOperativo = acciones.map(a => {
    const presu = presupuesto?.afs.find(p => p.afId === a.afId)
    const go    = presupuesto?.go.porAf.find(g => g.afId === a.afId)
    const cofSena       = (presu?.cofSena       ?? 0) + (go?.cofSena       ?? 0)
    const contraEspecie = (presu?.contraEspecie ?? 0) + (go?.contraEspecie ?? 0)
    const contraDinero  = (presu?.contraDinero  ?? 0) + (go?.contraDinero  ?? 0)
    const totalAf       = (presu?.total         ?? 0) + (go?.total         ?? 0)
    const horas         = esTallerPuestoTrabajo(a.tipoEvento) ? 8 : (Number(a.numHorasGrupo) || 0)
    const benef         = Number(a.numBenef) || 0
    const valorHoraBenef = (horas > 0 && benef > 0) ? totalAf / (benef * horas) : 0
    return { af: a, horas, cofSena, contraEspecie, contraDinero, totalAf, valorHoraBenef }
  })
  const totalCofSena  = planOperativo.reduce((s, r) => s + r.cofSena, 0)
  const totalEspecie  = planOperativo.reduce((s, r) => s + r.contraEspecie, 0)
  const totalDinero   = planOperativo.reduce((s, r) => s + r.contraDinero, 0)
  const totalAfMasGo  = planOperativo.reduce((s, r) => s + r.totalAf, 0)

  return (
    <>
    <style>{`
      html { scroll-behavior: smooth; scroll-padding-top: 80px; }
      @media print {
        @page { size: A4 landscape; margin: 8mm 8mm; }
        /* Forzar colores e impresión fiel */
        *, *::before, *::after {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        /* Layout: revelar todo */
        aside, header, .no-print { display: none !important; }
        html, body { overflow: visible !important; height: auto !important; background: white !important; }
        body > div { display: block !important; height: auto !important; overflow: visible !important; }
        body > div > div { height: auto !important; overflow: visible !important; }
        main { overflow: visible !important; height: auto !important; padding: 0 !important; }
        /* Reducir paddings del contenedor principal */
        .max-w-5xl { max-width: 100% !important; padding: 0 !important; gap: 8px !important; }
        /* Permitir que las secciones grandes fluyan entre páginas para no
           dejar grandes huecos en blanco. Solo evitamos cortar lo marcado
           explícitamente con .avoid-break y cabeceras / filas de tablas. */
        section { page-break-inside: auto; break-inside: auto; }
        .avoid-break { page-break-inside: avoid; break-inside: avoid; }
        /* Padding interno de las secciones más compacto al imprimir */
        section .p-5, section .p-4 { padding: 8px !important; }
        section .py-3 { padding-top: 6px !important; padding-bottom: 6px !important; }
        section .pt-4 { padding-top: 6px !important; }
        section .gap-6 { gap: 8px !important; }
        section .gap-5 { gap: 8px !important; }
        section .gap-4 { gap: 6px !important; }
        section .mb-3 { margin-bottom: 6px !important; }
        /* Tablas: permitir cortes entre filas pero no dentro de una fila */
        table { page-break-inside: auto; width: 100% !important; max-width: 100% !important; table-layout: auto; }
        thead { display: table-header-group; }
        tr, td, th { page-break-inside: avoid; }
        /* Evitar overflow horizontal: permitir wrap en celdas largas */
        .overflow-x-auto { overflow: visible !important; width: 100% !important; }
        td.whitespace-nowrap, th.whitespace-nowrap { white-space: normal !important; }
        /* Quitar truncados (e.g. título de la AF) para que el nombre completo salga */
        .truncate { overflow: visible !important; text-overflow: clip !important; white-space: normal !important; }
        /* Tablas anchas (Plan Operativo / Rubros): fuente y padding compactos
           para que entren en la página sin recortes */
        .print-wide-table {
          font-size: 7.5pt !important;
          table-layout: fixed !important;
          width: 100% !important;
        }
        .print-wide-table th, .print-wide-table td {
          padding: 3px 4px !important;
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
          white-space: normal !important;
        }
        /* Tipografía algo más compacta para impresión */
        body { font-size: 9.5pt; }
        h1, h2, h3 { page-break-after: avoid; }
        /* Sombras planas */
        .shadow-sm, .shadow-lg { box-shadow: none !important; }
      }
    `}</style>

    <div className="p-4 sm:p-7 xl:p-10 max-w-5xl mx-auto flex flex-col gap-5 sm:gap-6 print:p-4 print:gap-4 pb-32">

      {/* Encabezado tipo formulario SENA */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 sm:p-5 border-b border-neutral-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/sena-logo.svg" alt="SENA" className="h-14 w-14 sm:h-16 sm:w-16 shrink-0" />
          <div className="flex-1 text-center min-w-0">
            <p className="text-[11px] font-bold leading-tight" style={{ color: TITLE_COLOR }}>SERVICIO NACIONAL DE APRENDIZAJE - SENA</p>
            <p className="text-[11px] font-bold leading-tight" style={{ color: TITLE_COLOR }}>DIRECCIÓN DEL SISTEMA NACIONAL DE FORMACIÓN PARA EL TRABAJO</p>
            <p className="text-[11px] font-bold leading-tight" style={{ color: TITLE_COLOR }}>GRUPO DE GESTIÓN PARA LA PRODUCTIVIDAD Y LA COMPETITIVIDAD</p>
            <p className="text-[11px] font-bold leading-tight" style={{ color: TITLE_COLOR }}>PROGRAMA DE FORMACIÓN CONTINUA ESPECIALIZADA</p>
            {proyecto.convocatoria && (
              <p className="text-[11px] font-bold leading-tight" style={{ color: TITLE_COLOR }}>CONVOCATORIA — {proyecto.convocatoria}</p>
            )}
            <p className="text-[10px] text-neutral-500 mt-1">FORMULARIO DIGITAL DE PROYECTO</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button onClick={() => router.back()}
              className="px-3 py-2 text-xs text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition">
              ← Volver
            </button>
            <button onClick={() => window.print()}
              className="px-3 py-2 text-xs font-semibold text-white rounded-xl transition inline-flex items-center gap-1.5 hover:opacity-90"
              style={{ backgroundColor: TITLE_COLOR }}>
              <Printer size={13} /> Imprimir / PDF
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Código</span>
            <span className="text-sm font-bold" style={{ color: TITLE_COLOR }}>{proyecto.codigo ?? proyecto.id}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Modalidad</span>
            <span className="text-xs font-bold" style={{ color: TITLE_COLOR }}>{proyecto.modalidad ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Fecha de Registro</span>
            <span className="text-xs font-bold" style={{ color: TITLE_COLOR }}>{fmtDateTime(proyecto.fechaRegistro)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Fecha de Confirmación</span>
            <span className="text-xs font-bold" style={{ color: TITLE_COLOR }}>{proyecto.fechaRadicacion ? fmtDateTime(proyecto.fechaRadicacion) : '—'}</span>
          </div>
        </div>
      </div>

      {/* 1. DATOS GENERALES DE LA ENTIDAD PROPONENTE */}
      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <SectionHeader icon={Building2}>Datos Generales de la Entidad Proponente</SectionHeader>
        <div className="p-5">
          <table className="w-full"><tbody>
            <Row label="Nombre / Razón Social" value={empresa.razonSocial} />
            <Row label="Sigla" value={empresa.sigla} />
            <Row label="NIT" value={`${empresa.nit}-${empresa.digitoV}`} />
            <Row label="Departamento de Domicilio" value={empresa.departamento} />
            <Row label="Ciudad / Municipio" value={empresa.ciudad} />
            <Row label="Dirección de Domicilio" value={empresa.direccion} />
            <Row label="Teléfono / Celular" value={telCel} />
            <Row label="Correo Electrónico" value={empresa.email} />
            <Row label="Página Web" value={empresa.website} />
            <Row label="Cobertura" value={empresa.cobertura} />
            <Row label="Código CIIU / Actividad Económica"
                 value={[empresa.ciiuCodigo, empresa.ciiuDescripcion].filter(Boolean).join(' — ')} />
            <Row label="Tipo de Empresa / Gremio" value={empresa.tipoEmpresa} />
            <Row label="Tamaño de la Empresa / Gremio" value={empresa.tamanoEmpresa} />
            <Row label="Mesas Sectoriales SENA" value={mesasSectoriales.length ? mesasSectoriales.join(', ') : '—'} />
          </tbody></table>
        </div>
      </section>

      {/* 2. DATOS DE CONTACTO DEL PROYECTO */}
      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <SectionHeader icon={Users}>Datos de Contacto del Proyecto</SectionHeader>
        <div className="p-5 flex flex-col gap-5">
          <div>
            <SubHeader icon={UserCheck}>Representante Legal</SubHeader>
            <table className="w-full"><tbody>
              <Row label="Tipo de Identificación" value={empresa.repTipoDoc} />
              <Row label="N° de Identificación"   value={empresa.repDocumento} />
              <Row label="Nombre Completo"        value={empresa.repNombre} />
              <Row label="Cargo en la Empresa"    value={empresa.repCargo} />
              <Row label="Correo Electrónico"     value={empresa.repCorreo} />
              <Row label="Teléfono / Celular"     value={empresa.repTel} />
            </tbody></table>
          </div>

          {contactos.length > 0 && (
            <div className="border-t border-neutral-100 pt-4">
              <SubHeader icon={Users2}>Otros Contactos del Proyecto</SubHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-neutral-200">
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: TITLE_COLOR }}>Cargo</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: TITLE_COLOR }}>Nombre</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: TITLE_COLOR }}>Documento</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: TITLE_COLOR }}>Correo</th>
                    <th className="text-left py-2 px-2 font-semibold" style={{ color: TITLE_COLOR }}>Teléfono</th>
                  </tr></thead>
                  <tbody>{contactos.map((c, i) => (
                    <tr key={i} className="border-b border-neutral-100 last:border-0">
                      <td className="py-2 px-2 text-neutral-700">{c.cargo}</td>
                      <td className="py-2 px-2 text-neutral-700">{c.nombre}</td>
                      <td className="py-2 px-2 text-neutral-700">{c.tipoDoc ? `${c.tipoDoc} ` : ''}{c.documento || '—'}</td>
                      <td className="py-2 px-2 text-neutral-700">{c.correo || '—'}</td>
                      <td className="py-2 px-2 text-neutral-700">{c.telefono || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. GENERALIDADES DE LA ENTIDAD */}
      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <SectionHeader icon={Briefcase}>Generalidades de la Entidad</SectionHeader>
        <div className="p-5 flex flex-col gap-4">
          <TextBlock label="Objeto social del proponente" value={empresa.objeto} />
          <TextBlock label="Productos y/o servicios ofrecidos y mercado al que van dirigidos" value={empresa.productos} />
          <TextBlock label="Situación actual y proyección del proponente" value={empresa.situacion} />
          <TextBlock label="Papel del proponente en el sector y/o región que pertenece o representa" value={empresa.papel} />
          <TextBlock label="Retos estratégicos del proponente, vinculados a la formación" value={empresa.retos} />
          <TextBlock label="Experiencia del proponente en actividades formativas" value={empresa.experiencia} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-neutral-100 pt-4">
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: TITLE_COLOR }}>Sector(es) al que Pertenece</p>
              <ListTable items={sectoresPertenece} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: TITLE_COLOR }}>Subsector(es) al que Pertenece</p>
              <ListTable items={subsectoresPertenece} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: TITLE_COLOR }}>Sector(es) que Representa</p>
              <ListTable items={sectoresRepresenta} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: TITLE_COLOR }}>Subsector(es) que Representa</p>
              <ListTable items={subsectoresRepresenta} />
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-neutral-100 pt-4">
            <p className="text-xs font-semibold" style={{ color: TITLE_COLOR }}>Cadena productiva e interacciones</p>
            <TextBlock label="Identificación de los eslabones de la cadena productiva del proponente"
              value={empresa.eslabones || '—'} />
            <TextBlock label="Descripción de las interacciones del proponente con otros actores"
              value={empresa.interacciones || '—'} />
          </div>
        </div>
      </section>

      {/* 4. NECESIDADES (DIAGNÓSTICOS) */}
      {diagnosticos.length > 0 && (
        <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <SectionHeader icon={ClipboardList}>Necesidades de Formación</SectionHeader>
          <div className="p-5 flex flex-col gap-6">
            {diagnosticos.map((d) => (
              <div key={d.necesidadId} className="border border-neutral-200 rounded-xl overflow-hidden">
                <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-200 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs font-bold" style={{ color: TITLE_COLOR }}>
                    Diagnóstico N° {d.necesidadId}
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    {fmtDateTime(d.fechaRegistro)}
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  <div>
                    <SubHeader icon={Package}>Herramientas y muestra poblacional</SubHeader>
                    {d.herramientas.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic">Sin herramientas registradas.</p>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-neutral-200">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-neutral-50">
                            <th className="text-left px-3 py-2 font-semibold" style={{ color: TITLE_COLOR }}>Herramienta</th>
                            <th className="text-right px-3 py-2 font-semibold" style={{ color: TITLE_COLOR }}>Muestra</th>
                          </tr></thead>
                          <tbody>{d.herramientas.map((h, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                              <td className="px-3 py-2 text-neutral-700">{h.herramienta}</td>
                              <td className="px-3 py-2 text-right text-neutral-700">{h.muestra}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <table className="w-full"><tbody>
                    <Row label="Fecha de Diagnóstico"               value={d.periodoI ? new Date(d.periodoI).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Bogota' }) : '—'} />
                    <Row label="Otro tipo de herramienta"            value={d.herrOtra} />
                    <Row label="¿Herramienta de creación propia?"    value={yn(d.herrCreacion)} />
                    <Row label="¿Cuenta con plan de capacitación?"   value={yn(d.planCapa)} />
                  </tbody></table>

                  <TextBlock label="Descripción de la(s) herramienta(s) utilizada(s) y muestra poblacional"
                    value={d.herrDescrip} />
                  <TextBlock label="Resumen de los principales resultados cualitativos y cuantitativos"
                    value={d.herrResultados} />

                  <div>
                    <SubHeader icon={Target}>Necesidades de formación identificadas</SubHeader>
                    {d.necesidades.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic">Sin necesidades registradas.</p>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-neutral-200">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-neutral-50">
                            <th className="text-left px-3 py-2 font-semibold w-12" style={{ color: TITLE_COLOR }}>N°</th>
                            <th className="text-left px-3 py-2 font-semibold" style={{ color: TITLE_COLOR }}>Necesidad</th>
                            <th className="text-right px-3 py-2 font-semibold w-24" style={{ color: TITLE_COLOR }}>Beneficiarios</th>
                          </tr></thead>
                          <tbody>{d.necesidades.map((n) => (
                            <tr key={n.numero} className="border-t border-neutral-100">
                              <td className="px-3 py-2 text-neutral-700 font-semibold">{n.numero}</td>
                              <td className="px-3 py-2 text-neutral-700">{n.nombre}</td>
                              <td className="px-3 py-2 text-right text-neutral-700">{n.beneficiarios}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. DATOS DEL PROYECTO + OBJETIVO GENERAL */}
      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <SectionHeader icon={FolderKanban}>Datos del Proyecto</SectionHeader>
        <div className="p-5 flex flex-col gap-4">
          <table className="w-full"><tbody>
            <Row label="Nombre del Proyecto" value={proyecto.nombre} />
            <Row label="Código" value={proyecto.codigo ?? proyecto.id} />
            <Row label="Convocatoria" value={proyecto.convocatoria} />
            <Row label="Modalidad de Participación" value={proyecto.modalidad} />
          </tbody></table>
          <TextBlock label="Objetivo General del Proyecto de Formación" value={proyecto.objetivo} />
        </div>
      </section>

      {/* 6. PLAN OPERATIVO DEL PROYECTO (AF + GO combinados por contrapartida) */}
      {planOperativo.length > 0 && (
        <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Activity}>Plan Operativo del Proyecto de Formación</SectionHeader>
          <div className="p-5 overflow-x-auto">
            <table className="w-full text-[11px] border-collapse print-wide-table">
              <thead>
                <tr style={{ backgroundColor: '#E6EEF5' }}>
                  <th className="border border-neutral-200 px-2 py-2 text-center font-semibold" style={{ color: TITLE_COLOR }}>AF N°</th>
                  <th className="border border-neutral-200 px-2 py-2 text-left font-semibold" style={{ color: TITLE_COLOR }}>Acción Formación</th>
                  <th className="border border-neutral-200 px-2 py-2 text-center font-semibold" style={{ color: TITLE_COLOR }}>Modalidad</th>
                  <th className="border border-neutral-200 px-2 py-2 text-center font-semibold" style={{ color: TITLE_COLOR }}>Evento</th>
                  <th className="border border-neutral-200 px-2 py-2 text-center font-semibold" style={{ color: TITLE_COLOR }}>Metodología</th>
                  <th className="border border-neutral-200 px-2 py-2 text-center font-semibold" style={{ color: TITLE_COLOR }}>N° Grupos</th>
                  <th className="border border-neutral-200 px-2 py-2 text-center font-semibold" style={{ color: TITLE_COLOR }}>Horas * Grupo</th>
                  <th className="border border-neutral-200 px-2 py-2 text-center font-semibold" style={{ color: TITLE_COLOR }}>N° Beneficiarios Totales</th>
                  <th className="border border-neutral-200 px-2 py-2 text-right font-semibold" style={{ color: TITLE_COLOR }}>$ Cof. SENA</th>
                  <th className="border border-neutral-200 px-2 py-2 text-right font-semibold" style={{ color: TITLE_COLOR }}>Contrapartida Especie</th>
                  <th className="border border-neutral-200 px-2 py-2 text-right font-semibold" style={{ color: TITLE_COLOR }}>Contrapartida Dinero</th>
                  <th className="border border-neutral-200 px-2 py-2 text-right font-semibold" style={{ color: TITLE_COLOR }}>Valor Total AF</th>
                  <th className="border border-neutral-200 px-2 py-2 text-right font-semibold" style={{ color: TITLE_COLOR }}>Valor Hora * Beneficiario</th>
                </tr>
              </thead>
              <tbody>
                {planOperativo.map((r) => (
                  <tr key={r.af.afId} className="hover:bg-neutral-50">
                    <td className="border border-neutral-200 px-2 py-2 text-center font-semibold">{r.af.numero}</td>
                    <td className="border border-neutral-200 px-2 py-2 text-neutral-700 font-medium">{r.af.nombre}</td>
                    <td className="border border-neutral-200 px-2 py-2 text-center text-neutral-700">{r.af.modalidad ?? '—'}</td>
                    <td className="border border-neutral-200 px-2 py-2 text-center text-neutral-700">{r.af.tipoEvento ?? '—'}</td>
                    <td className="border border-neutral-200 px-2 py-2 text-center text-neutral-700">{r.af.metodologia ?? '—'}</td>
                    <td className="border border-neutral-200 px-2 py-2 text-center text-neutral-700">{r.af.numGrupos ?? '—'}</td>
                    <td className="border border-neutral-200 px-2 py-2 text-center text-neutral-700">{r.horas || '—'}</td>
                    <td className="border border-neutral-200 px-2 py-2 text-center text-neutral-700">{r.af.numBenef ?? '—'}</td>
                    <td className="border border-neutral-200 px-2 py-2 text-right text-neutral-700 whitespace-nowrap">{fmt(r.cofSena)}</td>
                    <td className="border border-neutral-200 px-2 py-2 text-right text-neutral-700 whitespace-nowrap">{fmt(r.contraEspecie)}</td>
                    <td className="border border-neutral-200 px-2 py-2 text-right text-neutral-700 whitespace-nowrap">{fmt(r.contraDinero)}</td>
                    <td className="border border-neutral-200 px-2 py-2 text-right font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt(r.totalAf)}</td>
                    <td className="border border-neutral-200 px-2 py-2 text-right font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{r.valorHoraBenef > 0 ? fmt(r.valorHoraBenef) : '—'}</td>
                  </tr>
                ))}
                {/* Totales por columna */}
                <tr style={{ backgroundColor: '#F5F8FB' }}>
                  <td colSpan={8} className="border border-neutral-200 px-2 py-2 text-right text-xs font-semibold" style={{ color: TITLE_COLOR }}>Totales</td>
                  <td className="border border-neutral-200 px-2 py-2 text-right text-xs font-bold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt(totalCofSena)}</td>
                  <td className="border border-neutral-200 px-2 py-2 text-right text-xs font-bold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt(totalEspecie)}</td>
                  <td className="border border-neutral-200 px-2 py-2 text-right text-xs font-bold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt(totalDinero)}</td>
                  <td className="border border-neutral-200 px-2 py-2 text-right text-xs font-bold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt(totalAfMasGo)}</td>
                  <td className="border border-neutral-200 px-2 py-2"></td>
                </tr>
                {/* Total combinado AF + GO en una sola celda */}
                <tr style={{ backgroundColor: TITLE_COLOR }}>
                  <td colSpan={11} className="border border-neutral-200 px-2 py-3 text-right text-xs font-bold text-white uppercase">Total AF + Gastos de Operación</td>
                  <td className="border border-neutral-200 px-2 py-3 text-right text-sm font-bold text-white whitespace-nowrap">{fmt(totalAfMasGo)}</td>
                  <td className="border border-neutral-200 px-2 py-3" style={{ backgroundColor: TITLE_COLOR }}></td>
                </tr>
              </tbody>
            </table>
            <p className="text-[10px] text-neutral-400 mt-2 italic">
              Cada fila incluye Acción de Formación + Gastos de Operación de la AF. Valor Hora * Beneficiario = Valor Total AF / (N° Beneficiarios × Horas por Grupo).
            </p>
          </div>
        </section>
      )}

      {/* 7. ACCIONES DE FORMACIÓN — lista con lupa que ancla al detalle */}
      <section id="lista-acciones" className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden scroll-mt-20">
        <SectionHeader icon={BookOpen}>Acciones de Formación ({acciones.length})</SectionHeader>
        <div className="p-5">
          {acciones.length === 0 ? (
            <p className="text-xs text-neutral-400 italic">Sin acciones de formación registradas.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-neutral-200">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ backgroundColor: '#E6EEF5' }}>
                    <th className="text-center px-3 py-2 font-semibold w-16" style={{ color: TITLE_COLOR }}>AF N°</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: TITLE_COLOR }}>Acción de Formación</th>
                    <th className="text-center px-3 py-2 font-semibold w-24" style={{ color: TITLE_COLOR }}>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {acciones.map((a, i) => (
                    <tr key={a.afId} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                      <td className="px-3 py-3 text-center font-semibold" style={{ color: TITLE_COLOR }}>{a.numero}</td>
                      <td className="px-3 py-3 text-neutral-700 font-medium">
                        {a.nombre}
                        {a.necesidadFormacionNumero != null && (
                          <span className="block text-[10px] text-neutral-400 mt-0.5">
                            Vinculada a la necesidad #{a.necesidadFormacionNumero}
                            {a.necesidadFormacionNombre ? ` — ${a.necesidadFormacionNombre}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <a
                          href={`#af-${a.afId}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-neutral-200 hover:bg-neutral-100 transition"
                          title={`Ver detalle de la AF ${a.numero}`}
                          style={{ color: TITLE_COLOR }}>
                          <Search size={14} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* 8. DETALLE COMPLETO DE CADA ACCIÓN DE FORMACIÓN */}
      {acciones.map((a) => (
        <AfDetalleSection
          key={a.afId}
          af={a}
          detalle={afsDetalle[a.afId]}
          loading={loadingDetalles && !afsDetalle[a.afId]}
          presupuestoAf={presupuesto?.afs.find(p => p.afId === a.afId) ?? null}
          presupuestoGoAf={presupuesto?.go.porAf.find(g => g.afId === a.afId) ?? null}
          retos={retos}
          tiposAmbiente={tiposAmbiente}
          gestionConocs={gestionConocs}
          materialesForm={materialesForm}
        />
      ))}

      {/* 9. PRESUPUESTO GENERAL DEL PROYECTO */}
      {presupuesto && (
        <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Wallet}>Presupuesto General del Proyecto</SectionHeader>
          <div className="p-5 flex flex-col gap-5">

            {/* Tarjetas KPI: AFs · GO · Transferencia */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Acciones de Formación — Azul (color principal) */}
              <div className="rounded-2xl border border-[#00304D]/20 overflow-hidden flex flex-col">
                <div className="px-4 py-2.5" style={{ backgroundColor: TITLE_COLOR }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Acciones de Formación</p>
                  <p className="text-base font-bold text-white">{fmt(presupuesto.totalesAfs.valorTotalAFs)}</p>
                </div>
                <div className="bg-[#F5F8FB] p-4 flex flex-col gap-1.5 flex-1">
                  <div className="flex justify-between text-[11px]"><span className="text-neutral-500">N° de AFs</span><span className="font-semibold text-neutral-700">{presupuesto.totalesAfs.totalAfs}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-neutral-500">Total Beneficiarios</span><span className="font-semibold text-neutral-700">{presupuesto.totalesAfs.totalBeneficiarios}</span></div>
                  <div className="border-t border-neutral-200 my-1" />
                  <div className="flex justify-between text-[11px]"><span className="text-neutral-500">Cofin. SENA</span><span className="font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt(presupuesto.totalesAfs.totalCofSena)} <span className="text-neutral-400 font-normal">({pct(presupuesto.totalesAfs.porcCofSena)})</span></span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-neutral-500">C. Especie</span><span className="font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt(presupuesto.totalesAfs.totalContraEspecie)} <span className="text-neutral-400 font-normal">({pct(presupuesto.totalesAfs.porcContraEspecie)})</span></span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-neutral-500">C. Dinero</span><span className="font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt(presupuesto.totalesAfs.totalContraDinero)} <span className="text-neutral-400 font-normal">({pct(presupuesto.totalesAfs.porcContraDinero)})</span></span></div>
                </div>
              </div>

              {/* Gastos de Operación — Ámbar */}
              <div className="rounded-2xl border border-amber-200 overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 bg-amber-600">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-50">Gastos de Operación · {presupuesto.go.codigo}</p>
                  <p className="text-base font-bold text-white">{fmt(presupuesto.go.total)}</p>
                </div>
                <div className="bg-amber-50 p-4 flex flex-col gap-1.5 flex-1">
                  <div className="flex justify-between text-[11px]"><span className="text-amber-700/70">Tope Permitido</span><span className="font-semibold text-amber-900">{presupuesto.go.topePermitido}%</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-amber-700/70">% Sobre AFs</span><span className={`font-semibold whitespace-nowrap ${presupuesto.go.porcSobreAFs > presupuesto.go.topePermitido ? 'text-red-600' : 'text-amber-900'}`}>{pct(presupuesto.go.porcSobreAFs)}</span></div>
                  <div className="border-t border-amber-200 my-1" />
                  <div className="flex justify-between text-[11px]"><span className="text-amber-700/70">Cofin. SENA</span><span className="font-semibold text-amber-900 whitespace-nowrap">{fmt(presupuesto.go.totalCofSena)}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-amber-700/70">C. Especie</span><span className="font-semibold text-amber-900 whitespace-nowrap">{fmt(presupuesto.go.totalContraEspecie)}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-amber-700/70">C. Dinero</span><span className="font-semibold text-amber-900 whitespace-nowrap">{fmt(presupuesto.go.totalContraDinero)}</span></div>
                </div>
              </div>

              {/* Transferencia — Esmeralda */}
              <div className="rounded-2xl border border-emerald-200 overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 bg-emerald-600">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-50">Transferencia de Conocimiento</p>
                  <p className="text-base font-bold text-white">{fmt(presupuesto.transferencia.totalValor)}</p>
                </div>
                <div className="bg-emerald-50 p-4 flex flex-col gap-1.5 flex-1">
                  <div className="flex justify-between text-[11px]"><span className="text-emerald-700/70">Beneficiarios</span><span className="font-semibold text-emerald-900">{presupuesto.transferencia.totalBeneficiarios}</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-emerald-700/70">% Sobre Beneficiarios</span><span className={`font-semibold whitespace-nowrap ${presupuesto.transferencia.porcBeneficiarios < 5 ? 'text-red-600' : 'text-emerald-900'}`}>{pct(presupuesto.transferencia.porcBeneficiarios)}</span></div>
                  <div className="border-t border-emerald-200 my-1" />
                  <div className="flex justify-between text-[11px]"><span className="text-emerald-700/70">% del Total AFs</span><span className={`font-semibold whitespace-nowrap ${presupuesto.transferencia.porcValor < 1 ? 'text-red-600' : 'text-emerald-900'}`}>{pct(presupuesto.transferencia.porcValor)}</span></div>
                </div>
              </div>
            </div>

            {/* Total del Proyecto — destacado */}
            <div className="rounded-2xl overflow-hidden border-2 border-[#00304D]/30">
              <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: TITLE_COLOR }}>
                <span className="text-xs font-bold uppercase tracking-wider text-white">Total del Proyecto</span>
                <span className="text-xl font-bold text-white">{fmt(presupuesto.totalProyecto.valorTotal)}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200 bg-[#F5F8FB]">
                <div className="p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Cofinanciación SENA</span>
                  <span className="text-sm font-bold" style={{ color: TITLE_COLOR }}>{fmt(presupuesto.totalProyecto.cofSena)}</span>
                  <span className="text-[10px] text-neutral-400">{pct(presupuesto.totalProyecto.porcCofSena)} del total</span>
                </div>
                <div className="p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Contrapartida en Especie</span>
                  <span className="text-sm font-bold" style={{ color: TITLE_COLOR }}>{fmt(presupuesto.totalProyecto.contraEspecie)}</span>
                  <span className="text-[10px] text-neutral-400">{pct(presupuesto.totalProyecto.porcContraEspecie)} del total</span>
                </div>
                <div className="p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Contrapartida en Dinero</span>
                  <span className="text-sm font-bold" style={{ color: TITLE_COLOR }}>{fmt(presupuesto.totalProyecto.contraDinero)}</span>
                  <span className="text-[10px] text-neutral-400">{pct(presupuesto.totalProyecto.porcContraDinero)} del total</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

    </div>

    {!aprobado && (
      <button onClick={abrirConfirmar}
        className={`fixed bottom-6 right-24 z-40 inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold rounded-2xl shadow-lg transition no-print ${
          yaConfirmado
            ? 'bg-amber-500 hover:bg-amber-600 text-white'
            : 'bg-[#00304D] hover:bg-[#004a76] text-white'
        }`}>
        <CheckCircle2 size={16} />
        {yaConfirmado ? 'Desconfirmar Proyecto' : 'Confirmar Proyecto'}
      </button>
    )}

    <Modal open={confirmOpen} onClose={() => !confirmando && setConfirmOpen(false)} maxWidth="max-w-lg">
      <div className="p-6 flex flex-col gap-5">
        <h3 className="text-base font-bold text-neutral-800">
          {yaConfirmado ? 'Desconfirmar proyecto' : 'Confirmar proyecto'}
        </h3>
        <p className="text-sm text-neutral-500">
          {yaConfirmado
            ? '¿Está seguro de revertir la confirmación de este proyecto?'
            : '¿Está seguro de confirmar este proyecto? Esta acción lo dejará listo para envío a la siguiente plataforma.'}
        </p>

        {!yaConfirmado && validando && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Loader2 size={14} className="animate-spin" /> Verificando completitud del proyecto…
          </div>
        )}

        {!yaConfirmado && !validando && validacion && validacion.ok && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <CheckCircle2 size={14} className="shrink-0" />
            El proyecto cumple con todos los requisitos para ser confirmado.
          </div>
        )}

        {!yaConfirmado && !validando && validacion && !validacion.ok && (
          <div className="flex flex-col gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide">
              Faltan datos por completar ({validacion.issues.length})
            </p>
            <ul className="text-xs text-red-700 list-disc list-inside flex flex-col gap-1 max-h-72 overflow-y-auto">
              {validacion.issues.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={() => setConfirmOpen(false)} disabled={confirmando}
            className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleConfirmar}
            disabled={confirmando || validando || (!yaConfirmado && validacion ? !validacion.ok : false)}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed ${
              yaConfirmado ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#00304D] hover:bg-[#004a76]'
            }`}>
            {confirmando
              ? <Loader2 size={14} className="animate-spin inline-block" />
              : yaConfirmado ? 'Sí, desconfirmar' : 'Sí, confirmar'}
          </button>
        </div>
      </div>
    </Modal>

    {toast && (
      <ToastBetowa
        key={toastKey2}
        show
        onClose={() => setToast(null)}
        tipo={toast.tipo}
        titulo={toast.titulo}
        mensaje={toast.msg}
        duration={4500}
      />
    )}
    </>
  )
}

// ── Helpers Rubros ───────────────────────────────────────────────────────────
// Replican la lógica de la tabla "Rubros Registrados" de la página de la AF.

function valorUnidad(r: RubroAf): number | null {
  const total = Number(r.totalRubro) || 0
  const horas = Number(r.numHoras) || 0
  const benef = Number(r.beneficiarios) || 0
  const cant  = Number(r.cantidad) || 0
  const dias  = Number(r.dias) || 0
  if (horas > 0 && benef > 0) return total / (horas * benef)
  if (horas > 0)              return total / horas
  if (dias > 0 && benef > 0)  return total / (dias * benef)
  if (dias > 0)               return total / dias
  if (cant > 0)               return total / cant
  if (benef > 0)              return total / benef
  return null
}
function unidadesLabel(r: RubroAf): string {
  const horas = Number(r.numHoras) || 0
  const benef = Number(r.beneficiarios) || 0
  const cant  = Number(r.cantidad) || 0
  const dias  = Number(r.dias) || 0
  if (horas > 0 && benef > 0) return `${horas}h × ${benef} benef.`
  if (dias > 0 && benef > 0)  return `${dias}d × ${benef} benef.`
  if (horas > 0)              return `${horas} h`
  if (dias > 0)               return `${dias} días`
  if (cant > 0) {
    const code = (r.codigo ?? '').trim()
    return `${cant} ${code.startsWith('R04') ? 'tiq.' : 'ud.'}`
  }
  if (benef > 0)              return `${benef} benef.`
  return '—'
}

// ── Componente: detalle completo de una AF dentro del reporte ────────────────

function AfDetalleSection({
  af, detalle, loading,
  presupuestoAf, presupuestoGoAf,
  retos, tiposAmbiente, gestionConocs, materialesForm,
}: {
  af: AfReporte
  detalle: AfDetalle | undefined
  loading: boolean
  presupuestoAf: PresupuestoAf | null
  presupuestoGoAf: PresupuestoGo | null
  retos: Opcion[]
  tiposAmbiente: Opcion[]
  gestionConocs: Opcion[]
  materialesForm: Opcion[]
}) {
  const retoNombre = detalle?.alineacion?.retoNacionalId
    ? retos.find(r => r.id === detalle.alineacion!.retoNacionalId)?.nombre ?? null
    : null
  const ambienteNombre = detalle?.material?.tipoAmbienteId
    ? tiposAmbiente.find(t => t.id === detalle.material!.tipoAmbienteId)?.nombre ?? null
    : null
  const gestionNombre = detalle?.material?.gestionConocimientoId
    ? gestionConocs.find(g => g.id === detalle.material!.gestionConocimientoId)?.nombre ?? null
    : null
  const matSelNombre = detalle?.material?.materialFormacionId
    ? materialesForm.find(m => m.id === detalle.material!.materialFormacionId)?.nombre ?? null
    : null

  return (
    <section id={`af-${af.afId}`} className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden scroll-mt-20">
      <div className="px-4 sm:px-5 py-3 rounded-t-2xl flex items-center justify-between gap-3 flex-wrap" style={{ backgroundColor: TITLE_COLOR }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            <BookOpen size={14} className="text-white" strokeWidth={2.2} />
          </div>
          <h2 className="text-white font-bold text-xs sm:text-sm tracking-wide uppercase truncate">AF {af.numero} — {af.nombre}</h2>
        </div>
        <a href="#lista-acciones"
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 hover:text-white bg-white/10 hover:bg-white/20 transition rounded-full px-3 py-1 no-print whitespace-nowrap">
          ← Volver al listado de AF
        </a>
      </div>
      <div className="p-5 flex flex-col gap-6">

        {/* 1. Información de la Acción de Formación */}
        <div>
          <SubHeader icon={Info}>Información de la Acción de Formación</SubHeader>
          <table className="w-full"><tbody>
            <Row label="Nombre de la Acción de Formación" value={af.nombre} />
            <Row label="Consecutivo" value={af.numero} />
            <Row label="Problema o Necesidad Detectada"
              value={af.necesidadFormacionNumero != null
                ? `#${af.necesidadFormacionNumero} — ${af.necesidadFormacionNombre ?? ''}`
                : af.necesidadFormacionNombre} />
            <Row label="Enfoque de la Acción de Formación" value={detalle?.perfil?.enfoque} />
          </tbody></table>
          <div className="flex flex-col gap-3 mt-3">
            <TextBlock label="Justificación de la Necesidad Detectada" value={af.justnec} />
            <TextBlock label="Causas del Problema o Necesidad Detectada" value={af.causa} />
            <TextBlock label="Efectos del Problema o Necesidad Detectada" value={af.efectos} />
            <TextBlock label="Objetivo de la Acción de Formación" value={af.objetivo} />
          </div>
        </div>

        {/* 2. Datos del Evento */}
        <div className="border-t border-neutral-100 pt-4">
          <SubHeader icon={CalendarDays}>Datos del Evento</SubHeader>
          <table className="w-full"><tbody>
            <Row label="Tipo de Evento de Formación" value={af.tipoEvento} />
            <Row label="Modalidad de Formación" value={af.modalidad} />
            <Row label="Metodología de Formación" value={af.metodologia} />
          </tbody></table>
        </div>

        {/* 3. Grupos y Beneficiarios */}
        <div className="border-t border-neutral-100 pt-4">
          <SubHeader icon={Users2}>Grupos y Beneficiarios</SubHeader>
          <table className="w-full"><tbody>
            <Row label="N° Horas por Grupo" value={af.numHorasGrupo} />
            <Row label="N° de Grupos" value={af.numGrupos} />
            <Row label="Beneficiarios Presenciales por Grupo" value={af.benefGrupo} />
            <Row label="Beneficiarios Virtuales / Sincrónicos por Grupo" value={af.benefViGrupo} />
            <Row label="Total de Horas de la Acción de Formación" value={af.numTotHoras} />
            <Row label="Total de Beneficiarios de la Acción de Formación" value={af.numBenef} />
          </tbody></table>
        </div>

        {loading && !detalle && (
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Loader2 size={14} className="animate-spin" /> Cargando detalle de la AF…
          </div>
        )}

        {detalle && (
          <>
            {/* 4. Perfil de los Beneficiarios */}
            {detalle.perfil && (
              <div className="border-t border-neutral-100 pt-4">
                <SubHeader icon={UserCheck}>Perfil de los Beneficiarios</SubHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: TITLE_COLOR }}>Áreas Funcionales de los Beneficiarios</p>
                    <ListTable items={detalle.perfil.areas.map(a => a.otro ? `${a.nombre} (${a.otro})` : a.nombre)} />
                  </div>
                  <div>
                    <TextBlockAlways label="Justificación Áreas Funcionales a Beneficiar" value={detalle.perfil.justAreas} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: TITLE_COLOR }}>Niveles Ocupacionales de los Beneficiarios</p>
                    <ListTable items={detalle.perfil.niveles.map(n => n.nombre)} />
                  </div>
                  <div>
                    <TextBlockAlways label="Justificación Niveles Ocupacionales" value={detalle.perfil.justNivelesOcu} />
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-xs font-semibold mb-2" style={{ color: TITLE_COLOR }}>Ocupación CUOC</p>
                  <ListTable items={detalle.perfil.cuoc.map(c => c.nombre)} />
                </div>

                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: TITLE_COLOR }}>Datos Numéricos de Beneficiarios</p>
                  <table className="w-full"><tbody>
                    <Row label="N° Trabajadores Mujeres" value={detalle.perfil.mujer} />
                    <Row label="N° Personas en Condición de Discapacidad" value={detalle.perfil.trabDiscapac} />
                    <Row label="N° Empresas con Modelo BIC" value={detalle.perfil.trabajadorBic} />
                  </tbody></table>
                </div>

                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: TITLE_COLOR }}>MiPymes (si aplica)</p>
                  <table className="w-full"><tbody>
                    <Row label="N° Empresas MiPymes" value={detalle.perfil.mipymes} />
                    <Row label="N° Trabajadores de Empresas MiPymes" value={detalle.perfil.trabMipymes} />
                  </tbody></table>
                  <div className="mt-2">
                    <TextBlockAlways label="Justificación MiPymes y Trabajadores a Beneficiar" value={detalle.perfil.mipymesD} />
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: TITLE_COLOR }}>Cadena Productiva (si aplica)</p>
                  <table className="w-full"><tbody>
                    <Row label="N° Empresas de la Cadena Productiva" value={detalle.perfil.cadenaProd} />
                    <Row label="N° Trabajadores de la Cadena Productiva" value={detalle.perfil.trabCadProd} />
                  </tbody></table>
                  <div className="mt-2">
                    <TextBlockAlways label="Justificación Cadena Productiva" value={detalle.perfil.cadenaProdD} />
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: TITLE_COLOR }}>Economía Campesina (si aplica)</p>
                  <table className="w-full"><tbody>
                    <Row label="N° Trabajadores de la Economía Campesina" value={detalle.perfil.numCampesino} />
                  </tbody></table>
                  <div className="mt-2">
                    <TextBlockAlways label="Justificación Trabajadores Economía Campesina" value={detalle.perfil.justCampesino} />
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: TITLE_COLOR }}>Economía Popular (si aplica)</p>
                  <table className="w-full"><tbody>
                    <Row label="N° Trabajadores de la Economía Popular" value={detalle.perfil.numPopular} />
                  </tbody></table>
                  <div className="mt-2">
                    <TextBlockAlways label="Justificación Trabajadores Economía Popular" value={detalle.perfil.justPopular} />
                  </div>
                </div>
              </div>
            )}

            {/* 5. Sectores y Sub-sectores */}
            {detalle.sectores && (
              <div className="border-t border-neutral-100 pt-4">
                <SubHeader icon={Layers}>Sectores y Sub-sectores del Beneficiario</SubHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: TITLE_COLOR }}>Sector(es) al que Pertenece los Beneficiarios</p>
                    <ListTable items={detalle.sectores.sectoresBenef.map(s => s.nombre)} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: TITLE_COLOR }}>Sub-sector(es) al que Pertenece los Beneficiarios</p>
                    <ListTable items={detalle.sectores.subsectoresBenef.map(s => s.nombre)} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: TITLE_COLOR }}>Clasificación de la AF por Sector(es) a Beneficiar</p>
                    <ListTable items={detalle.sectores.sectoresAf.map(s => s.nombre)} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: TITLE_COLOR }}>Clasificación de la AF por Sub-sector(es) a Beneficiar</p>
                    <ListTable items={detalle.sectores.subsectoresAf.map(s => s.nombre)} />
                  </div>
                </div>
                <div className="mt-3">
                  <TextBlock label="Justificación Sectores y Sub-sectores a Beneficiar" value={detalle.sectores.justificacion} />
                </div>
              </div>
            )}

            {/* 6. Unidades Temáticas */}
            <div className="border-t border-neutral-100 pt-4">
              <SubHeader icon={Notebook}>Unidades Temáticas de la Acción de Formación</SubHeader>
              {detalle.unidadesTematicas.length === 0 ? (
                <p className="text-xs text-neutral-400 italic">Sin unidades temáticas registradas.</p>
              ) : detalle.unidadesTematicas.map((ut) => {
                const horasPrac = (ut.horasPP ?? 0) + (ut.horasPV ?? 0) + (ut.horasPPAT ?? 0) + (ut.horasPHib ?? 0)
                const horasTeor = (ut.horasTP ?? 0) + (ut.horasTV ?? 0) + (ut.horasTPAT ?? 0) + (ut.horasTHib ?? 0)
                const esArticulacion = ut.articulacionTerritorialId != null
                return (
                  <div key={ut.utId}
                    className={`rounded-xl overflow-hidden mb-3 border-2 ${esArticulacion ? 'border-violet-300' : 'border-neutral-200'}`}>
                    <div className={`px-4 py-2 border-b flex items-center justify-between gap-3 flex-wrap ${esArticulacion ? 'bg-violet-50 border-violet-200' : 'bg-neutral-50 border-neutral-200'}`}>
                      <span className={`text-xs font-bold ${esArticulacion ? 'text-violet-700' : ''}`}
                        style={!esArticulacion ? { color: TITLE_COLOR } : undefined}>
                        UT N° {ut.numero} — {ut.nombre}
                      </span>
                      {esArticulacion && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 text-white text-[10px] font-semibold px-3 py-1 uppercase tracking-wide whitespace-nowrap">
                          Articulación con el Territorio
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-3">
                      {esArticulacion && ut.articulacionTerritorialNombre && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-xl">
                          <span className="text-xs font-bold text-violet-700">Articulación:</span>
                          <span className="text-xs text-violet-700">{ut.articulacionTerritorialNombre}</span>
                        </div>
                      )}
                      <table className="w-full"><tbody>
                        <Row label="Horas Prácticas a Impartir" value={horasPrac} />
                        <Row label="Horas Teóricas a Impartir" value={horasTeor} />
                        <Row label="Total de Horas de la Unidad" value={horasPrac + horasTeor} />
                      </tbody></table>
                      {ut.perfiles.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-2" style={{ color: TITLE_COLOR }}>Perfil del Capacitador</p>
                          <div className="overflow-hidden rounded-xl border border-neutral-200">
                            <table className="w-full text-xs">
                              <thead><tr className="bg-neutral-50">
                                <th className="text-left px-3 py-2 font-semibold" style={{ color: TITLE_COLOR }}>Perfil / Rubro</th>
                                <th className="text-right px-3 py-2 font-semibold" style={{ color: TITLE_COLOR }}>Horas a Impartir</th>
                              </tr></thead>
                              <tbody>{ut.perfiles.map((p) => (
                                <tr key={p.perfilId} className="border-t border-neutral-100">
                                  <td className="px-3 py-2 text-neutral-700">{p.rubroNombre}</td>
                                  <td className="px-3 py-2 text-right text-neutral-700">{p.horasCap}</td>
                                </tr>
                              ))}</tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      <TextBlock label="Contenido de la Unidad Temática" value={ut.contenido} />
                      <TextBlock label="Competencia por Adquirir" value={ut.competencias} />
                      {ut.actividades.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-2" style={{ color: TITLE_COLOR }}>Actividades de Aprendizaje</p>
                          <ListTable items={ut.actividades.map(a => a.otro ? `${a.nombre} — ${a.otro}` : a.nombre)} />
                        </div>
                      )}
                      <TextBlockAlways label="Justificación de la Actividad de Aprendizaje (si aplica)" value={ut.justActividad} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 7. Alineación de la Acción de Formación */}
            {detalle.alineacion && (
              <div className="border-t border-neutral-100 pt-4">
                <SubHeader icon={Compass}>Alineación de la Acción de Formación</SubHeader>
                <table className="w-full"><tbody>
                  <Row label="Reto Nacional" value={retoNombre} />
                  <Row label="Componente Estratégico" value={detalle.alineacion.componenteNombre} />
                </tbody></table>
                <div className="grid grid-cols-1 gap-3 mt-3">
                  <TextBlock label="Justificación de la Alineación de la Acción de Formación" value={detalle.alineacion.compod} />
                  <TextBlock label="Justificación Acción de Formación Especializada" value={detalle.alineacion.justificacion} />
                  <TextBlock label="Resultados — Impacto de la Formación en el Desempeño del Trabajador y Aplicación de Conocimientos en el Puesto de Trabajo" value={detalle.alineacion.resDesem} />
                  <TextBlock label="Resultados — Impacto de la Formación en la Productividad y Competitividad de las Empresas y Gremios" value={detalle.alineacion.resForm} />
                </div>
              </div>
            )}

            {/* 8. Cobertura de la Acción de Formación */}
            <div className="border-t border-neutral-100 pt-4">
              <SubHeader icon={MapPin}>Cobertura de la Acción de Formación</SubHeader>
              {detalle.grupos.length === 0 ? (
                <p className="text-xs text-neutral-400 italic">Sin grupos registrados.</p>
              ) : detalle.grupos.map((g) => (
                <div key={g.grupoId} className="border border-neutral-200 rounded-xl overflow-hidden mb-3">
                  <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200 flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: TITLE_COLOR }}>Grupo N° {g.grupoNumero}</span>
                    <span className="text-[10px] text-neutral-500">Total beneficiarios: {g.totalBenef}</span>
                  </div>
                  <div className="p-3 flex flex-col gap-3">
                    {g.coberturas.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic">Sin coberturas.</p>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-neutral-200">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-neutral-50">
                            <th className="text-left px-3 py-2 font-semibold" style={{ color: TITLE_COLOR }}>Departamento</th>
                            <th className="text-left px-3 py-2 font-semibold" style={{ color: TITLE_COLOR }}>Ciudad</th>
                            <th className="text-center px-3 py-2 font-semibold" style={{ color: TITLE_COLOR }}>Rural</th>
                            <th className="text-right px-3 py-2 font-semibold" style={{ color: TITLE_COLOR }}>Beneficiarios</th>
                          </tr></thead>
                          <tbody>{g.coberturas.map((c) => (
                            <tr key={c.cobId} className="border-t border-neutral-100">
                              <td className="px-3 py-2 text-neutral-700">{c.deptoNombre ?? '—'}</td>
                              <td className="px-3 py-2 text-neutral-700">{c.ciudadNombre ?? '—'}</td>
                              <td className="px-3 py-2 text-center text-neutral-700">{yn(c.rural)}</td>
                              <td className="px-3 py-2 text-right text-neutral-700">{c.benef ?? 0}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    )}
                    <TextBlockAlways label="Justificación del Grupo" value={g.justificacion} />
                  </div>
                </div>
              ))}
            </div>

            {/* 9. Material de Formación */}
            {detalle.material && (
              <div className="border-t border-neutral-100 pt-4">
                <SubHeader icon={Package}>Material de Formación</SubHeader>
                <table className="w-full"><tbody>
                  <Row label="Ambiente de Aprendizaje" value={ambienteNombre} />
                  <Row label="Material de Formación Seleccionado" value={matSelNombre} />
                  <Row label="Gestión del Conocimiento" value={gestionNombre} />
                </tbody></table>
                {detalle.material.recursos.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold mb-2" style={{ color: TITLE_COLOR }}>Recursos Didácticos</p>
                    <ListTable items={detalle.material.recursos.map(r => r.nombre)} />
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 mt-3">
                  <TextBlockAlways label="Justificación del Material de Formación (Si Aplica)" value={detalle.material.justMat} />
                  <TextBlockAlways label="Insumos (Si Aplica)" value={detalle.material.insumo} />
                  <TextBlockAlways label="Justificación de los Insumos (Si Aplica)" value={detalle.material.justInsumo} />
                </div>
              </div>
            )}

            {/* 10. Rubros del Presupuesto */}
            <div className="border-t border-neutral-100 pt-4">
              <SubHeader icon={Receipt}>Rubros del Presupuesto</SubHeader>
              {detalle.rubros.length === 0 ? (
                <p className="text-xs text-neutral-400 italic">Sin rubros registrados.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-neutral-200">
                  <table className="w-full text-[11px] border-collapse print-wide-table">
                    <thead>
                      <tr style={{ backgroundColor: '#E6EEF5' }}>
                        <th className="border border-neutral-200 px-2 py-2 text-left font-semibold" style={{ color: TITLE_COLOR }}>Rubro</th>
                        <th className="border border-neutral-200 px-2 py-2 text-left font-semibold" style={{ color: TITLE_COLOR }}>Justificación</th>
                        <th className="border border-neutral-200 px-2 py-2 text-right font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>Unidades</th>
                        <th className="border border-neutral-200 px-2 py-2 text-right font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>Valor Unidad</th>
                        <th className="border border-neutral-200 px-2 py-2 text-right font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>Cof. SENA</th>
                        <th className="border border-neutral-200 px-2 py-2 text-right font-semibold" style={{ color: TITLE_COLOR }}>%</th>
                        <th className="border border-neutral-200 px-2 py-2 text-right font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>C. Especie</th>
                        <th className="border border-neutral-200 px-2 py-2 text-right font-semibold" style={{ color: TITLE_COLOR }}>%</th>
                        <th className="border border-neutral-200 px-2 py-2 text-right font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>C. Dinero</th>
                        <th className="border border-neutral-200 px-2 py-2 text-right font-semibold" style={{ color: TITLE_COLOR }}>%</th>
                        <th className="border border-neutral-200 px-2 py-2 text-right font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>{detalle.rubros.map((r) => {
                      const vu = valorUnidad(r)
                      return (
                        <tr key={r.afrubroid} className="border-t border-neutral-100 hover:bg-neutral-50">
                          <td className="border border-neutral-200 px-2 py-2 text-neutral-700">{r.nombre ?? '—'}</td>
                          <td className="border border-neutral-200 px-2 py-2 text-neutral-600 align-top whitespace-pre-wrap leading-relaxed" style={{ minWidth: '180px' }}>{r.justificacion ?? '—'}</td>
                          <td className="border border-neutral-200 px-2 py-2 text-right text-neutral-700 whitespace-nowrap">{unidadesLabel(r)}</td>
                          <td className="border border-neutral-200 px-2 py-2 text-right text-neutral-700 whitespace-nowrap">{vu != null ? fmt(vu) : '—'}</td>
                          <td className="border border-neutral-200 px-2 py-2 text-right text-neutral-700 whitespace-nowrap">{fmt(Number(r.cofSena))}</td>
                          <td className="border border-neutral-200 px-2 py-2 text-right text-neutral-400">{pct(Number(r.porcSena ?? 0))}</td>
                          <td className="border border-neutral-200 px-2 py-2 text-right text-neutral-700 whitespace-nowrap">{fmt(Number(r.contraEspecie))}</td>
                          <td className="border border-neutral-200 px-2 py-2 text-right text-neutral-400">{pct(Number(r.porcEspecie ?? 0))}</td>
                          <td className="border border-neutral-200 px-2 py-2 text-right text-neutral-700 whitespace-nowrap">{fmt(Number(r.contraDinero))}</td>
                          <td className="border border-neutral-200 px-2 py-2 text-right text-neutral-400">{pct(Number(r.porcDinero ?? 0))}</td>
                          <td className="border border-neutral-200 px-2 py-2 text-right font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt(Number(r.totalRubro))}</td>
                        </tr>
                      )
                    })}</tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 11. Gastos de Operación de la AF (separado, fuera de la tabla de rubros) */}
            <div className="border-t border-neutral-100 pt-4">
              <SubHeader icon={FileText}>Gastos de Operación (R09)</SubHeader>
              {!presupuestoGoAf || presupuestoGoAf.total === 0 ? (
                <p className="text-xs text-neutral-400 italic">Sin gastos de operación registrados.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-amber-200" style={{ backgroundColor: '#FFFBEB' }}>
                  <table className="w-full text-xs">
                    <thead><tr style={{ backgroundColor: '#FEF3C7' }}>
                      <th className="text-right px-3 py-2 font-semibold whitespace-nowrap" style={{ color: '#8B5E00' }}>Cof. SENA</th>
                      <th className="text-right px-3 py-2 font-semibold whitespace-nowrap" style={{ color: '#8B5E00' }}>Contrapartida Especie</th>
                      <th className="text-right px-3 py-2 font-semibold whitespace-nowrap" style={{ color: '#8B5E00' }}>Contrapartida Dinero</th>
                      <th className="text-right px-3 py-2 font-semibold whitespace-nowrap" style={{ color: '#8B5E00' }}>Total Gastos de Operación</th>
                    </tr></thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-3 text-right text-neutral-700 whitespace-nowrap">{fmt(presupuestoGoAf.cofSena)}</td>
                        <td className="px-3 py-3 text-right text-neutral-700 whitespace-nowrap">{fmt(presupuestoGoAf.contraEspecie)}</td>
                        <td className="px-3 py-3 text-right text-neutral-700 whitespace-nowrap">{fmt(presupuestoGoAf.contraDinero)}</td>
                        <td className="px-3 py-3 text-right font-bold whitespace-nowrap" style={{ color: '#8B5E00' }}>{fmt(presupuestoGoAf.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 12. Presupuesto Total de la AF (AF + GO) */}
            {(() => {
              const afCof   = presupuestoAf?.cofSena ?? 0
              const afEsp   = presupuestoAf?.contraEspecie ?? 0
              const afDin   = presupuestoAf?.contraDinero ?? 0
              const afTot   = presupuestoAf?.total ?? 0
              const goCof   = presupuestoGoAf?.cofSena ?? 0
              const goEsp   = presupuestoGoAf?.contraEspecie ?? 0
              const goDin   = presupuestoGoAf?.contraDinero ?? 0
              const goTot   = presupuestoGoAf?.total ?? 0
              const totCof  = afCof + goCof
              const totEsp  = afEsp + goEsp
              const totDin  = afDin + goDin
              const totTot  = afTot + goTot
              const p = (n: number, d: number) => d > 0 ? `${((n / d) * 100).toFixed(2)}%` : '0,00%'
              return (
                <div className="border-t border-neutral-100 pt-4">
                  <SubHeader icon={TrendingUp}>Presupuesto Total de la Acción de Formación</SubHeader>
                  <div className="overflow-hidden rounded-xl border border-neutral-200">
                    <table className="w-full text-xs">
                      <thead><tr style={{ backgroundColor: '#E6EEF5' }}>
                        <th className="text-left px-3 py-2 font-semibold" style={{ color: TITLE_COLOR }}>Concepto</th>
                        <th className="text-right px-3 py-2 font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>Cof. SENA</th>
                        <th className="text-right px-3 py-2 font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>Contrapartida Especie</th>
                        <th className="text-right px-3 py-2 font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>Contrapartida Dinero</th>
                        <th className="text-right px-3 py-2 font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>Total</th>
                      </tr></thead>
                      <tbody>
                        <tr className="border-t border-neutral-100">
                          <td className="px-3 py-2 text-neutral-700">Subtotal Rubros AF</td>
                          <td className="px-3 py-2 text-right text-neutral-700 whitespace-nowrap">
                            {fmt(afCof)} <span className="text-neutral-400 ml-1">({p(afCof, afTot)})</span>
                          </td>
                          <td className="px-3 py-2 text-right text-neutral-700 whitespace-nowrap">
                            {fmt(afEsp)} <span className="text-neutral-400 ml-1">({p(afEsp, afTot)})</span>
                          </td>
                          <td className="px-3 py-2 text-right text-neutral-700 whitespace-nowrap">
                            {fmt(afDin)} <span className="text-neutral-400 ml-1">({p(afDin, afTot)})</span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt(afTot)}</td>
                        </tr>
                        <tr className="border-t border-neutral-100">
                          <td className="px-3 py-2 text-neutral-700">Gastos de Operación (R09)</td>
                          <td className="px-3 py-2 text-right text-neutral-700 whitespace-nowrap">
                            {fmt(goCof)} <span className="text-neutral-400 ml-1">({p(goCof, goTot)})</span>
                          </td>
                          <td className="px-3 py-2 text-right text-neutral-700 whitespace-nowrap">
                            {fmt(goEsp)} <span className="text-neutral-400 ml-1">({p(goEsp, goTot)})</span>
                          </td>
                          <td className="px-3 py-2 text-right text-neutral-700 whitespace-nowrap">
                            {fmt(goDin)} <span className="text-neutral-400 ml-1">({p(goDin, goTot)})</span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt(goTot)}</td>
                        </tr>
                        <tr style={{ backgroundColor: TITLE_COLOR }}>
                          <td className="px-3 py-3 font-bold text-white uppercase">Total AF + GO</td>
                          <td className="px-3 py-3 text-right font-bold text-white whitespace-nowrap">
                            {fmt(totCof)} <span className="text-white/70 ml-1">({p(totCof, totTot)})</span>
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-white whitespace-nowrap">
                            {fmt(totEsp)} <span className="text-white/70 ml-1">({p(totEsp, totTot)})</span>
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-white whitespace-nowrap">
                            {fmt(totDin)} <span className="text-white/70 ml-1">({p(totDin, totTot)})</span>
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-bold text-white whitespace-nowrap">{fmt(totTot)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}
          </>
        )}

        {/* Si aún no llegó el detalle pero hay datos del presupuesto base, mostrar resumen mínimo */}
        {!detalle && (presupuestoAf || presupuestoGoAf) && (
          <div className="border-t border-neutral-100 pt-4">
            <SubHeader icon={Wallet}>Resumen Presupuestal de la AF</SubHeader>
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-xs">
                <thead><tr className="bg-neutral-50">
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: TITLE_COLOR }}>Concepto</th>
                  <th className="text-right px-3 py-2 font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>Cof. SENA</th>
                  <th className="text-right px-3 py-2 font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>Especie</th>
                  <th className="text-right px-3 py-2 font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>Dinero</th>
                  <th className="text-right px-3 py-2 font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>Total</th>
                </tr></thead>
                <tbody>
                  {presupuestoAf && (
                    <tr className="border-t border-neutral-100">
                      <td className="px-3 py-2 text-neutral-700">Acciones de Formación (rubros)</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(presupuestoAf.cofSena)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(presupuestoAf.contraEspecie)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(presupuestoAf.contraDinero)}</td>
                      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt(presupuestoAf.total)}</td>
                    </tr>
                  )}
                  {presupuestoGoAf && (
                    <tr className="border-t border-neutral-100">
                      <td className="px-3 py-2 text-neutral-700">Gastos de Operación</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(presupuestoGoAf.cofSena)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(presupuestoGoAf.contraEspecie)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(presupuestoGoAf.contraDinero)}</td>
                      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt(presupuestoGoAf.total)}</td>
                    </tr>
                  )}
                  <tr style={{ backgroundColor: '#F5F8FB' }} className="border-t border-neutral-200">
                    <td className="px-3 py-2 font-semibold" style={{ color: TITLE_COLOR }}>Total AF + GO</td>
                    <td className="px-3 py-2 text-right font-bold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt((presupuestoAf?.cofSena ?? 0) + (presupuestoGoAf?.cofSena ?? 0))}</td>
                    <td className="px-3 py-2 text-right font-bold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt((presupuestoAf?.contraEspecie ?? 0) + (presupuestoGoAf?.contraEspecie ?? 0))}</td>
                    <td className="px-3 py-2 text-right font-bold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt((presupuestoAf?.contraDinero ?? 0) + (presupuestoGoAf?.contraDinero ?? 0))}</td>
                    <td className="px-3 py-2 text-right font-bold whitespace-nowrap" style={{ color: TITLE_COLOR }}>{fmt((presupuestoAf?.total ?? 0) + (presupuestoGoAf?.total ?? 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Volver al listado de Acciones de Formación */}
        <div className="border-t border-neutral-100 pt-4 flex justify-end no-print">
          <a href="#lista-acciones"
            className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-xl px-4 py-2 border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition">
            ← Volver al listado de Acciones de Formación
          </a>
        </div>
      </div>
    </section>
  )
}
