'use client'

import api from '@/lib/api'
import { ConvenioNav } from '@/components/layout/convenio-nav'
import { HabeasDataModal } from '@/components/public/registro/habeas-data-modal'
import { RegistrarEmpresaModal } from '@/components/convenios/registrar-empresa-modal'
import { AsociarGrupoModal } from '@/components/convenios/asociar-grupo-modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  AlertCircle, ArrowLeft, ArrowRight, Building2, CheckCircle2, ClipboardCheck,
  FileText, IdCard, Link2, Loader2, MapPin, Phone, Save, Search, ShieldCheck,
  User, UserPlus,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

const TITLE = '#00304D'
const SENA = '#39A900'

interface TipoDoc { id: number; nombre: string }
interface Catalogo { id: number; nombre: string }
interface EmpresaBenef {
  id: number
  tipoDocumentoId: number
  tipoDocumento: string | null
  numero: string | null
  nombre: string | null
  tamanoEmpresaId: number | null
  tamanoEmpresa: string | null
}

interface PersonaResp {
  personaId: number
  tipoDocumentoId: number
  tipoDocumento: string | null
  identificacion: string
  nombres: string | null
  primerApellido: string | null
  segundoApellido: string | null
  generoId: number | null
  estratoId: number | null
  fechaNacimiento: string | null
  celular: string | null
  departamentoId: number | null
  ciudadId: number | null
  email: string | null
  barrio: string | null
  direccion: string | null
  habeasData: string | null
}
interface PostulacionResp {
  ano: number
  antiguedad: string | null
  beneficiarioEmpresaId: number | null
  nivelOcupacionalId: number | null
  caracterizacionId: number | null
  perfilTrasferenciaId: number | null
  postulacionTrasferencia: string | null
  rangoEdadId: number | null
  empresaTipoDocumentoId: number | null
  empresaTipoDocumento: string | null
  empresaNumero: string | null
  empresaNombre: string | null
  tamanoEmpresaId: number | null
  tamanoEmpresaNombre: string | null
}
interface BuscarResp {
  estado: 'sin-persona' | 'sin-postulacion' | 'desactualizada' | 'vigente'
  anoVigente: number
  persona: PersonaResp | null
  postulacion: PostulacionResp | null
  asociacionesActivas?: number
}

function calcularEdad(fechaIso: string | null): number {
  if (!fechaIso) return 0
  const f = new Date(fechaIso)
  if (isNaN(f.getTime())) return 0
  const hoy = new Date()
  let edad = hoy.getFullYear() - f.getFullYear()
  const m = hoy.getMonth() - f.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < f.getDate())) edad--
  return Math.max(0, edad)
}

function rangoEdadIdParaEdad(edad: number): number {
  if (edad <= 17) return 1
  if (edad <= 24) return 2
  if (edad <= 30) return 3
  if (edad <= 40) return 4
  if (edad <= 55) return 5
  return 6
}

const labelCls = 'text-[11px] font-bold text-neutral-700 uppercase tracking-wide'
const inputCls = 'h-10 rounded-lg border border-neutral-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0] bg-white transition'

function ToggleSiNo({
  value, onChange, disabled,
}: { value: 'SI' | 'NO' | ''; onChange: (v: 'SI' | 'NO') => void; disabled?: boolean }) {
  return (
    <div className="inline-flex rounded-lg border border-neutral-300 overflow-hidden bg-white">
      {(['SI', 'NO'] as const).map((v, i) => {
        const activo = value === v
        return (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`px-6 h-10 text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed
              ${activo
                ? (v === 'SI' ? 'bg-[#39A900] text-white' : 'bg-neutral-600 text-white')
                : 'text-neutral-500 hover:bg-neutral-50'}
              ${i === 0 ? '' : 'border-l border-neutral-300'}`}
          >
            {v}
          </button>
        )
      })}
    </div>
  )
}

export default function RegistrarBeneficiarioPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const proyectoId = Number(params?.id)
  // evita que el auto-buscar se dispare dos veces si el efecto se re-evalúa
  const autoBuscadoRef = useRef(false)

  const [seccion, setSeccion] = useState<'basicos' | 'postulacion'>('basicos')

  /* Catálogos */
  const [tiposDocPersona, setTiposDocPersona] = useState<TipoDoc[]>([])
  const [tiposDocEmpresa, setTiposDocEmpresa] = useState<TipoDoc[]>([])
  const [generos, setGeneros] = useState<Catalogo[]>([])
  const [caracterizaciones, setCaracterizaciones] = useState<Catalogo[]>([])
  const [niveles, setNiveles] = useState<Catalogo[]>([])
  const [perfilesTransf, setPerfilesTransf] = useState<Catalogo[]>([])
  const [rangosEdad, setRangosEdad] = useState<Catalogo[]>([])
  const [departamentos, setDepartamentos] = useState<Catalogo[]>([])
  const [ciudades, setCiudades] = useState<Catalogo[]>([])

  const [cargandoCat, setCargandoCat] = useState(true)
  const [convenioEnEjecucion, setConvenioEnEjecucion] = useState<boolean | null>(null)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)
  const [habeasOpen, setHabeasOpen] = useState(false)

  /* Búsqueda de persona */
  const [bTipoDocId, setBTipoDocId] = useState(0)
  const [bIdent, setBIdent] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultado, setResultado] = useState<BuscarResp | null>(null)
  // el id del depto puede llegar antes que el catálogo; se aplica cuando cargue
  const [deptoPendiente, setDeptoPendiente] = useState<number | null>(null)

  /* Persona (form) */
  const [pPersonaId, setPPersonaId] = useState<number | null>(null)
  const [pNombres, setPNombres] = useState('')
  const [pPrimer, setPPrimer] = useState('')
  const [pSegundo, setPSegundo] = useState('')
  const [pGenero, setPGenero] = useState(0)
  const [pEstrato, setPEstrato] = useState(0)
  const [pFechaNac, setPFechaNac] = useState('')
  const [pCelular, setPCelular] = useState('')
  const [pDeptoId, setPDeptoId] = useState(0)
  const [pCiudadId, setPCiudadId] = useState(0)
  const [pEmail, setPEmail] = useState('')
  const [pBarrio, setPBarrio] = useState('')
  const [pDireccion, setPDireccion] = useState('')
  const [pHabeas, setPHabeas] = useState<'SI' | 'NO' | ''>('')
  const [guardandoPersona, setGuardandoPersona] = useState(false)

  /* Postulación (form) */
  const [xAntiguedad, setXAntiguedad] = useState<'SI' | 'NO' | ''>('')
  const [xEmpTipoDocId, setXEmpTipoDocId] = useState(0)
  const [xEmpNumero, setXEmpNumero] = useState('')
  const [xEmpresa, setXEmpresa] = useState<EmpresaBenef | null>(null)
  const [empNoEncontrada, setEmpNoEncontrada] = useState(false)
  const [buscandoEmp, setBuscandoEmp] = useState(false)
  const [xNivelId, setXNivelId] = useState(0)
  const [xCaracterizacionId, setXCaracterizacionId] = useState(0)
  const [xPerfilTransfId, setXPerfilTransfId] = useState(0)
  const [xTransferencia, setXTransferencia] = useState<'SI' | 'NO' | ''>('')
  const [guardandoPostu, setGuardandoPostu] = useState(false)
  const [empresaModalOpen, setEmpresaModalOpen] = useState(false)
  const [asociarModalOpen, setAsociarModalOpen] = useState(false)

  useEffect(() => {
    setCargandoCat(true)
    Promise.all([
      api.get<TipoDoc[]>('/auth/tipos-documento?para=persona').catch(() => ({ data: [] })),
      api.get<TipoDoc[]>('/auth/tipos-documento?para=empresa').catch(() => ({ data: [] })),
      api.get<{
        generos: Catalogo[]; caracterizaciones: Catalogo[]; niveles: Catalogo[]
        perfilesTransf: Catalogo[]; rangosEdad: Catalogo[]; departamentos: Catalogo[]
      }>('/convenios/beneficiarios/catalogos').catch(() => ({ data: { generos: [], caracterizaciones: [], niveles: [], perfilesTransf: [], rangosEdad: [], departamentos: [] } })),
    ]).then(([rTp, rTe, rC]) => {
      setTiposDocPersona(rTp.data ?? [])
      setTiposDocEmpresa(rTe.data ?? [])
      setGeneros(rC.data?.generos ?? [])
      setCaracterizaciones(rC.data?.caracterizaciones ?? [])
      setNiveles(rC.data?.niveles ?? [])
      setPerfilesTransf(rC.data?.perfilesTransf ?? [])
      setRangosEdad(rC.data?.rangosEdad ?? [])
      setDepartamentos((rC.data?.departamentos ?? []).map(d => ({ id: Number(d.id), nombre: d.nombre })))
      const cc = (rTp.data ?? []).find(t => /c[eé]dula/i.test(t.nombre) && /ciudadan/i.test(t.nombre))
      if (cc) setBTipoDocId(cc.id)
      const nit = (rTe.data ?? []).find(t => /nit/i.test(t.nombre))
      if (nit) setXEmpTipoDocId(nit.id)
    }).catch(() => setToast({ tipo: 'error', msg: 'No se pudieron cargar los catálogos.' }))
      .finally(() => setCargandoCat(false))
  }, [])

  useEffect(() => {
    if (!pDeptoId) { setCiudades([]); return }
    api.get<{ id: number; nombre: string }[]>('/convenios/beneficiarios/ciudades', { params: { departamentoId: pDeptoId } })
      .then(r => setCiudades((r.data ?? []).map(c => ({ id: Number(c.id), nombre: c.nombre }))))
      .catch(() => setCiudades([]))
  }, [pDeptoId])

  // el estado del convenio gatea los botones de guardar/asociar
  useEffect(() => {
    if (!proyectoId) return
    api.get<{ estadoNum: number | null }>(`/convenios/${proyectoId}`)
      .then(r => setConvenioEnEjecucion(Number(r.data?.estadoNum) === 1))
      .catch(() => setConvenioEnEjecucion(false))
  }, [proyectoId])

  useEffect(() => {
    if (deptoPendiente && departamentos.some(d => d.id === deptoPendiente)) {
      setPDeptoId(deptoPendiente)
      setDeptoPendiente(null)
    }
  }, [deptoPendiente, departamentos])

  // auto-búsqueda al llegar con ?tipoDocumentoId=&identificacion= desde la tabla
  useEffect(() => {
    if (autoBuscadoRef.current || cargandoCat) return
    const tdId = Number(searchParams?.get('tipoDocumentoId')) || 0
    const ident = searchParams?.get('identificacion')?.trim() || ''
    if (!tdId || !ident) return
    autoBuscadoRef.current = true
    setBTipoDocId(tdId)
    setBIdent(ident)
    void buscar({ tipoDocumentoId: tdId, identificacion: ident })
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [cargandoCat])

  function aplicarResultado(r: BuscarResp) {
    if (r.persona) {
      const p = r.persona
      setPPersonaId(Number(p.personaId))
      setPNombres(p.nombres ?? '')
      setPPrimer(p.primerApellido ?? '')
      setPSegundo(p.segundoApellido ?? '')
      setPGenero(Number(p.generoId) || 0)
      setPEstrato(Number(p.estratoId) || 0)
      setPFechaNac(p.fechaNacimiento ? String(p.fechaNacimiento).slice(0, 10) : '')
      setPCelular(p.celular ?? '')
      const deptoId = Number(p.departamentoId) || 0
      const ciudadId = Number(p.ciudadId) || 0
      setPDeptoId(deptoId)
      setPCiudadId(ciudadId)
      // el catálogo pudo cargar tarde: lo dejamos pendiente
      if (deptoId && !departamentos.some(d => d.id === deptoId)) {
        setDeptoPendiente(deptoId)
      }
      setPEmail(p.email ?? '')
      setPBarrio(p.barrio ?? '')
      setPDireccion(p.direccion ?? '')
      const hd = (p.habeasData ?? '').toUpperCase()
      setPHabeas(hd === 'SI' ? 'SI' : hd === 'NO' ? 'NO' : '')
    } else {
      setPPersonaId(null)
      setPNombres(''); setPPrimer(''); setPSegundo('')
      setPGenero(0); setPEstrato(0); setPFechaNac('')
      setPCelular(''); setPDeptoId(0); setPCiudadId(0)
      setPEmail(''); setPBarrio(''); setPDireccion(''); setPHabeas('')
    }
    if (r.postulacion) {
      const po = r.postulacion
      const ant = (po.antiguedad ?? '').toUpperCase()
      setXAntiguedad(ant.startsWith('S') ? 'SI' : ant.startsWith('N') ? 'NO' : '')
      setXNivelId(po.nivelOcupacionalId ?? 0)
      setXCaracterizacionId(po.caracterizacionId ?? 0)
      setXPerfilTransfId(po.perfilTrasferenciaId ?? 0)
      const tr = (po.postulacionTrasferencia ?? '').toUpperCase()
      setXTransferencia(tr === 'SI' ? 'SI' : tr === 'NO' ? 'NO' : '')
      // la empresa ya viene en esta respuesta (LEFT JOIN), no hace falta otra llamada
      if (po.beneficiarioEmpresaId && po.empresaNumero) {
        const emp: EmpresaBenef = {
          id: po.beneficiarioEmpresaId,
          tipoDocumentoId: po.empresaTipoDocumentoId ?? 0,
          tipoDocumento: po.empresaTipoDocumento,
          numero: po.empresaNumero,
          nombre: po.empresaNombre,
          tamanoEmpresaId: po.tamanoEmpresaId,
          tamanoEmpresa: po.tamanoEmpresaNombre,
        }
        setXEmpresa(emp); setEmpNoEncontrada(false)
        if (po.empresaTipoDocumentoId) setXEmpTipoDocId(po.empresaTipoDocumentoId)
        setXEmpNumero(po.empresaNumero)
      } else {
        setXEmpresa(null); setXEmpNumero(''); setEmpNoEncontrada(false)
      }
    } else {
      // "NO APLICA" es id 4 en PERFILTRASFERENCIA, fallback si no está en el catálogo
      const noAplica = perfilesTransf.find(p => /no\s*aplica/i.test(p.nombre))
      setXAntiguedad(''); setXNivelId(0); setXCaracterizacionId(0)
      setXPerfilTransfId(noAplica?.id ?? 4)
      setXTransferencia('NO')
      setXEmpresa(null); setXEmpNumero(''); setEmpNoEncontrada(false)
    }
  }

  async function buscar(opts?: { tipoDocumentoId?: number; identificacion?: string }) {
    const tdId = opts?.tipoDocumentoId ?? bTipoDocId
    const ident = (opts?.identificacion ?? bIdent).trim()
    if (!tdId || !ident) {
      setToast({ tipo: 'error', msg: 'Selecciona el tipo de documento e ingresa el número.' })
      return
    }
    setBuscando(true)
    try {
      const r = await api.get<BuscarResp>(`/convenios/${proyectoId}/beneficiarios/persona/buscar`, {
        params: { tipoDocumentoId: tdId, identificacion: ident },
      })
      setResultado(r.data)
      aplicarResultado(r.data)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo realizar la búsqueda.' })
    } finally { setBuscando(false) }
  }

  async function buscarEmpresa() {
    if (!xEmpTipoDocId || !xEmpNumero.trim()) {
      setToast({ tipo: 'error', msg: 'Selecciona tipo de documento y NIT de la empresa.' })
      return
    }
    setBuscandoEmp(true); setEmpNoEncontrada(false)
    try {
      const r = await api.get<EmpresaBenef | null>('/convenios/beneficiarios/empresas/buscar', {
        params: { tipoDocumentoId: xEmpTipoDocId, numero: xEmpNumero.trim() },
      })
      if (r.data) { setXEmpresa(r.data) }
      else { setXEmpresa(null); setEmpNoEncontrada(true) }
    } catch {
      setToast({ tipo: 'error', msg: 'Error al buscar la empresa.' })
    } finally { setBuscandoEmp(false) }
  }

  async function guardarPersona() {
    setGuardandoPersona(true)
    try {
      const r = await api.post<{ mensaje: string; accion: string; personaId: number }>(
        `/convenios/${proyectoId}/beneficiarios/persona`,
        {
          personaId: pPersonaId,
          tipoDocumentoId: bTipoDocId,
          identificacion: bIdent.trim(),
          nombres: pNombres.trim().toUpperCase(),
          primerApellido: pPrimer.trim().toUpperCase(),
          segundoApellido: pSegundo.trim().toUpperCase() || null,
          generoId: pGenero || null,
          estratoId: pEstrato || null,
          fechaNacimiento: pFechaNac || null,
          celular: pCelular.trim() || null,
          departamentoId: pDeptoId || null,
          ciudadId: pCiudadId || null,
          email: pEmail.trim(),
          barrio: pBarrio.trim() || null,
          direccion: pDireccion.trim() || null,
          habeasData: pHabeas === 'SI',
        },
      )
      setPPersonaId(r.data.personaId)
      setToast({ tipo: 'success', msg: r.data.mensaje })
      await buscar()
      setSeccion('postulacion')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo guardar la persona.' })
    } finally { setGuardandoPersona(false) }
  }

  async function guardarPostulacion() {
    if (!pPersonaId) {
      setToast({ tipo: 'error', msg: 'Primero guarda los datos de la persona.' })
      return
    }
    if (!xEmpresa) {
      setToast({ tipo: 'error', msg: 'Busca la empresa donde labora antes de guardar.' })
      return
    }
    setGuardandoPostu(true)
    try {
      const r = await api.post<{ mensaje: string; accion: string; ano: number }>(
        `/convenios/${proyectoId}/beneficiarios/postulacion`,
        {
          personaId: pPersonaId,
          antiguedad: xAntiguedad,
          beneficiarioEmpresaId: xEmpresa.id,
          nivelOcupacionalId: xNivelId,
          caracterizacionId: xCaracterizacionId,
          perfilTrasferenciaId: xPerfilTransfId,
          postulacionTrasferencia: xTransferencia,
          fechaNacimiento: pFechaNac || null,
        },
      )
      setToast({ tipo: 'success', msg: r.data.mensaje })
      await buscar()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo guardar la postulación.' })
    } finally { setGuardandoPostu(false) }
  }

  const edad = useMemo(() => calcularEdad(pFechaNac), [pFechaNac])
  const rangoEdad = useMemo(() => edad > 0 ? rangoEdadIdParaEdad(edad) : 0, [edad])
  const rangoEdadNombre = useMemo(
    () => rangosEdad.find(r => r.id === rangoEdad)?.nombre ?? null,
    [rangosEdad, rangoEdad],
  )
  const anoVigente = resultado?.anoVigente ?? new Date().getFullYear()

  const camposFaltantesPersona: string[] = []
  if (!bTipoDocId || !bIdent.trim()) camposFaltantesPersona.push('documento')
  if (!pNombres.trim()) camposFaltantesPersona.push('nombres')
  if (!pPrimer.trim()) camposFaltantesPersona.push('primer apellido')
  if (!pGenero) camposFaltantesPersona.push('género')
  if (!pEstrato) camposFaltantesPersona.push('estrato')
  if (!pFechaNac) camposFaltantesPersona.push('fecha de nacimiento')
  if (!pCelular.trim()) camposFaltantesPersona.push('celular')
  if (!pDeptoId) camposFaltantesPersona.push('departamento')
  if (!pCiudadId) camposFaltantesPersona.push('ciudad')
  if (!pEmail.trim()) camposFaltantesPersona.push('correo')
  if (!pBarrio.trim()) camposFaltantesPersona.push('barrio')
  if (!pDireccion.trim()) camposFaltantesPersona.push('dirección')
  if (!pHabeas) camposFaltantesPersona.push('habeas data')
  const bloqueadoPorConvenio = convenioEnEjecucion === false
  const puedeGuardarPersona = camposFaltantesPersona.length === 0 && !bloqueadoPorConvenio

  const camposFaltantesPostu: string[] = []
  if (!pPersonaId) camposFaltantesPostu.push('guardar persona')
  if (!xAntiguedad) camposFaltantesPostu.push('antigüedad')
  if (!xEmpresa) camposFaltantesPostu.push('empresa')
  if (!xCaracterizacionId) camposFaltantesPostu.push('caracterización')
  if (!xNivelId) camposFaltantesPostu.push('nivel ocupacional')
  if (!xTransferencia) camposFaltantesPostu.push('transferencia')
  if (!xPerfilTransfId) camposFaltantesPostu.push('perfil de transferencia')
  const puedeGuardarPostulacion = camposFaltantesPostu.length === 0 && !bloqueadoPorConvenio
  const puedeAsociar = resultado?.estado === 'vigente' && !bloqueadoPorConvenio

  function chipEstado() {
    if (!resultado) return null
    const map = {
      'sin-persona':     { bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle2, label: 'Nueva persona' },
      'sin-postulacion': { bg: 'bg-amber-50 border-amber-200 text-amber-700',       icon: AlertCircle,  label: `Sin postulación ${anoVigente}` },
      'desactualizada':  { bg: 'bg-amber-50 border-amber-200 text-amber-700',       icon: AlertCircle,  label: `Postulación ${resultado.postulacion?.ano}` },
      'vigente':         { bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle2, label: `Postulación vigente ${anoVigente}` },
    }[resultado.estado]
    const Icon = map.icon
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${map.bg}`}>
        <Icon size={12} /> {map.label}
      </span>
    )
  }

  function bannerEstado() {
    if (!resultado) return (
      <span className="text-neutral-500 italic">— busca primero la persona para ver el estado —</span>
    )
    if (resultado.estado === 'sin-persona') return (
      <span className="text-emerald-700 font-bold">Persona nueva: completa los datos básicos para registrarla.</span>
    )
    if (resultado.estado === 'sin-postulacion') return (
      <span className="text-amber-700 font-bold">PENDIENTE: la persona no tiene postulación para {anoVigente}. Diligénciala abajo.</span>
    )
    if (resultado.estado === 'desactualizada') return (
      <span className="text-amber-700 font-bold">DESACTUALIZADA: su última postulación es del año {resultado.postulacion?.ano}. Actualízala al {anoVigente}.</span>
    )
    return (
      <span className="text-emerald-700 font-bold">CORRECTO: ya puede participar en las acciones de formación de la convocatoria vigente.</span>
    )
  }

  function Step({ n, label, activo, completo, onClick, disabled }: {
    n: number; label: string; activo: boolean; completo: boolean
    onClick?: () => void; disabled?: boolean
  }) {
    const disponible = !activo && !completo && !disabled
    return (
      <button type="button" onClick={onClick} disabled={disabled}
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition group disabled:cursor-not-allowed
          ${activo
            ? 'bg-[#00304D] text-white shadow'
            : completo
              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : disponible
                ? 'bg-[#0070C0]/10 text-[#0070C0] border border-[#0070C0]/30 hover:bg-[#0070C0] hover:text-white hover:border-[#0070C0]'
                : 'bg-neutral-100 text-neutral-400'}`}>
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
          ${activo
            ? 'bg-white text-[#00304D]'
            : completo
              ? 'bg-emerald-500 text-white'
              : disponible
                ? 'bg-white text-[#0070C0] border border-[#0070C0] group-hover:bg-[#00304D] group-hover:text-white group-hover:border-white'
                : 'bg-white text-neutral-400 border border-neutral-300'}`}>
          {completo && !activo ? <CheckCircle2 size={14} /> : n}
        </span>
        <span className="text-sm font-semibold">{label}</span>
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-[#F0F4F8] p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <ConvenioNav proyectoId={proyectoId} />

        {bloqueadoPorConvenio && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertCircle size={16} />
            <span><strong>Convenio no está en ejecución.</strong> Esta página está en modo solo lectura: no se puede guardar persona, postulación ni asociar grupos.</span>
          </div>
        )}

        {toast && (
          <ToastBetowa show onClose={() => setToast(null)} tipo={toast.tipo}
            titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
            mensaje={toast.msg} duration={4000} />
        )}
        <HabeasDataModal open={habeasOpen} onClose={() => setHabeasOpen(false)} />
        <AsociarGrupoModal
          open={asociarModalOpen}
          onClose={() => setAsociarModalOpen(false)}
          proyectoId={proyectoId}
          personaId={pPersonaId}
          nombreCompleto={[pNombres, pPrimer, pSegundo].filter(Boolean).join(' ').trim() || '—'}
          onCambio={() => { void buscar() }}
          onToast={(tipo, msg) => setToast({ tipo, msg })}
        />
        <RegistrarEmpresaModal
          open={empresaModalOpen}
          onClose={() => setEmpresaModalOpen(false)}
          initialTipoDocId={xEmpTipoDocId}
          initialNumero={xEmpNumero}
          onSaved={emp => {
            setXEmpresa({
              id: emp.id,
              tipoDocumentoId: emp.tipoDocumentoId,
              tipoDocumento: emp.tipoDocumento,
              numero: emp.numero,
              nombre: emp.nombre,
              tamanoEmpresaId: emp.tamanoEmpresaId,
              tamanoEmpresa: emp.tamanoEmpresa,
            })
            setXEmpTipoDocId(emp.tipoDocumentoId)
            setXEmpNumero(emp.numero ?? '')
            setEmpNoEncontrada(false)
            setToast({ tipo: 'success', msg: 'Empresa registrada y cargada al formulario.' })
          }}
        />

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl shadow-sm" style={{ backgroundColor: TITLE }}>
            <UserPlus size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: TITLE }}>Registrar beneficiario</h1>
            <p className="text-xs text-neutral-500">Busca a la persona por su documento. Si no existe, la creas; si existe, valida su postulación al año {anoVigente}.</p>
          </div>
          <Link href={`/panel/convenios/${proyectoId}/beneficiarios`} className="ml-auto inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D]">
            <ArrowLeft size={13} /> Volver
          </Link>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-3 shadow-sm flex flex-wrap items-center gap-3">
          <Step n={1} label="Datos básicos" activo={seccion === 'basicos'} completo={!!pPersonaId} onClick={() => setSeccion('basicos')} />
          <ArrowRight size={14} className="text-neutral-300" />
          <Step n={2} label="Postulación" activo={seccion === 'postulacion'} completo={resultado?.estado === 'vigente'}
            onClick={() => setSeccion('postulacion')} disabled={!pPersonaId} />
          <ArrowRight size={14} className="text-neutral-300" />
          <Step n={3} label="Asociar a grupo"
            activo={false}
            completo={(resultado?.asociacionesActivas ?? 0) > 0}
            onClick={() => setAsociarModalOpen(true)}
            disabled={!puedeAsociar} />
          <div className="ml-auto">{chipEstado()}</div>
        </div>

        <div className="sticky top-2 z-20 bg-white border border-neutral-200 rounded-2xl p-4 shadow-md">
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="flex items-center gap-2 text-[#00304D] font-bold text-sm self-start sm:self-end shrink-0">
              <IdCard size={16} /> Buscar persona
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Tipo Documento *</label>
                <select value={bTipoDocId} onChange={e => setBTipoDocId(Number(e.target.value))} className={inputCls}>
                  <option value={0}>— Seleccione —</option>
                  {tiposDocPersona.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Identificación *</label>
                <input type="text" value={bIdent}
                  onChange={e => setBIdent(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter') buscar() }}
                  placeholder="1234567890" maxLength={20} className={inputCls} />
              </div>
            </div>
            <button onClick={() => buscar()} disabled={buscando}
              className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-40 transition"
              style={{ backgroundColor: SENA }}>
              {buscando ? <><Loader2 size={13} className="animate-spin" /> Buscando…</> : <><Search size={13} /> Buscar</>}
            </button>
          </div>
        </div>

        {cargandoCat ? (
          <div className="flex items-center gap-2 py-12 justify-center text-neutral-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Cargando catálogos…
          </div>
        ) : seccion === 'basicos' ? (
          <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#00304D]" />
            <div className="p-5 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <User size={16} className="text-[#0070C0]" />
                  <h2 className="text-sm font-bold text-[#00304D]">Identidad</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-12 flex flex-col gap-1">
                    <label className={labelCls}>Nombres *</label>
                    <input type="text" value={pNombres} onChange={e => setPNombres(e.target.value)}
                      placeholder="JUAN CARLOS" maxLength={100} className={inputCls + ' uppercase'} />
                  </div>
                  <div className="sm:col-span-6 flex flex-col gap-1">
                    <label className={labelCls}>Primer Apellido *</label>
                    <input type="text" value={pPrimer} onChange={e => setPPrimer(e.target.value)}
                      placeholder="GÓMEZ" maxLength={50} className={inputCls + ' uppercase'} />
                  </div>
                  <div className="sm:col-span-6 flex flex-col gap-1">
                    <label className={labelCls}>Segundo Apellido</label>
                    <input type="text" value={pSegundo} onChange={e => setPSegundo(e.target.value)}
                      placeholder="MARTÍNEZ" maxLength={50} className={inputCls + ' uppercase'} />
                  </div>
                  <div className="sm:col-span-4 flex flex-col gap-1">
                    <label className={labelCls}>Género *</label>
                    <select value={pGenero} onChange={e => setPGenero(Number(e.target.value))} className={inputCls}>
                      <option value={0}>— Seleccione —</option>
                      {generos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-4 flex flex-col gap-1">
                    <label className={labelCls}>Estrato *</label>
                    <select value={pEstrato} onChange={e => setPEstrato(Number(e.target.value))} className={inputCls}>
                      <option value={0}>— Seleccione —</option>
                      {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-4 flex flex-col gap-1">
                    <label className={labelCls}>Fecha de Nacimiento *</label>
                    <input type="date" value={pFechaNac} onChange={e => setPFechaNac(e.target.value)} className={inputCls} />
                    {edad > 0 && (
                      <span className="text-[10px] text-neutral-500 mt-0.5">
                        {edad} años · {rangoEdadNombre ?? `Rango ${rangoEdad}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Phone size={16} className="text-[#0070C0]" />
                  <h2 className="text-sm font-bold text-[#00304D]">Contacto</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4 flex flex-col gap-1">
                    <label className={labelCls}>Número de Celular *</label>
                    <input type="text" value={pCelular} onChange={e => setPCelular(e.target.value.replace(/\D/g, ''))}
                      placeholder="3001234567" maxLength={15} className={inputCls} />
                  </div>
                  <div className="sm:col-span-8 flex flex-col gap-1">
                    <label className={labelCls}>Correo Electrónico *</label>
                    <input type="email" value={pEmail} onChange={e => setPEmail(e.target.value)}
                      placeholder="usuario@dominio.com" maxLength={120} className={inputCls} />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={16} className="text-[#0070C0]" />
                  <h2 className="text-sm font-bold text-[#00304D]">Ubicación</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6 flex flex-col gap-1">
                    <label className={labelCls}>Departamento *</label>
                    <select value={pDeptoId} onChange={e => { setPDeptoId(Number(e.target.value)); setPCiudadId(0) }} className={inputCls}>
                      <option value={0}>— Seleccione —</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-6 flex flex-col gap-1">
                    <label className={labelCls}>Ciudad *</label>
                    <select value={pCiudadId} onChange={e => setPCiudadId(Number(e.target.value))} disabled={!pDeptoId}
                      className={inputCls + ' disabled:bg-neutral-50 disabled:text-neutral-400'}>
                      <option value={0}>{pDeptoId ? '— Seleccione —' : 'Selecciona departamento primero'}</option>
                      {ciudades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-4 flex flex-col gap-1">
                    <label className={labelCls}>Barrio/Vereda *</label>
                    <input type="text" value={pBarrio} onChange={e => setPBarrio(e.target.value)} maxLength={120} className={inputCls} />
                  </div>
                  <div className="sm:col-span-8 flex flex-col gap-1">
                    <label className={labelCls}>Dirección *</label>
                    <input type="text" value={pDireccion} onChange={e => setPDireccion(e.target.value)}
                      placeholder="Cra 56 No. 153 - 84" maxLength={200} className={inputCls} />
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-neutral-50 to-white border border-neutral-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#00304D]/10 mt-0.5">
                    <ShieldCheck size={18} className="text-[#00304D]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#00304D]">Habeas Data y Política de Tratamiento de Datos *</p>
                    <p className="text-xs text-neutral-600 mt-1">
                      El beneficiario debe autorizar el tratamiento de sus datos personales conforme a la Ley 1581 de 2012.{' '}
                      <button type="button" onClick={() => setHabeasOpen(true)}
                        className="text-[#0070C0] font-semibold underline hover:text-[#00304D]">
                        Leer términos completos
                      </button>
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <ToggleSiNo value={pHabeas} onChange={setPHabeas} />
                      {pHabeas === 'SI' && (
                        <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={13} /> Autorización registrada
                        </span>
                      )}
                      {pHabeas === 'NO' && (
                        <span className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                          <AlertCircle size={13} /> No podrá ser beneficiario sin autorizar
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-neutral-100">
                {!puedeGuardarPersona && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 flex-1">
                    <AlertCircle size={13} /> Faltan: <strong>{camposFaltantesPersona.slice(0, 4).join(', ')}{camposFaltantesPersona.length > 4 ? `, +${camposFaltantesPersona.length - 4}` : ''}</strong>
                  </p>
                )}
                {puedeGuardarPersona && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 flex-1">
                    <CheckCircle2 size={13} /> Todo listo para guardar
                  </p>
                )}
                <button onClick={guardarPersona} disabled={guardandoPersona || !puedeGuardarPersona}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white shadow disabled:opacity-40 transition"
                  style={{ backgroundColor: SENA }}>
                  {guardandoPersona ? <><Loader2 size={13} className="animate-spin" /> Guardando…</>
                    : <><Save size={13} /> {pPersonaId ? 'Actualizar y continuar' : 'Guardar y continuar'}</>}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#00304D] via-[#0070C0] to-[#00304D]" />
            <div className="p-5 space-y-5">
              <div className="bg-gradient-to-br from-neutral-50 to-white border border-neutral-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <ClipboardCheck size={20} className="text-[#0070C0]" />
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Estado de postulación</p>
                  <div className="text-sm">{bannerEstado()}</div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Edad</p>
                    <p className="text-base font-bold text-[#00304D]">{edad > 0 ? edad : '—'}</p>
                  </div>
                  <div className="border-l border-neutral-200 pl-3">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Rango</p>
                    <p className="text-xs font-bold text-[#00304D]">{rangoEdadNombre ?? (edad > 0 ? `Rango ${rangoEdad}` : '—')}</p>
                  </div>
                  <div className="border-l border-neutral-200 pl-3">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Año</p>
                    <p className="text-base font-bold text-[#00304D]">{anoVigente}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 py-1">
                <div className="flex-1">
                  <label className={labelCls}>¿Se ha beneficiado anteriormente? *</label>
                  <p className="text-[11px] text-neutral-500">¿La persona ya participó en otra convocatoria PFCE como beneficiario?</p>
                </div>
                <ToggleSiNo value={xAntiguedad} onChange={setXAntiguedad} />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={16} className="text-[#0070C0]" />
                  <h2 className="text-sm font-bold text-[#00304D]">Empresa donde labora</h2>
                </div>
                <p className="text-xs text-neutral-600 mb-3">
                  Busca la empresa beneficiaria a la cual está asociado el beneficiario. Si no aparece, regístrala aquí mismo y se cargará automáticamente.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4 flex flex-col gap-1">
                    <label className={labelCls}>Tipo Documento *</label>
                    <select value={xEmpTipoDocId}
                      onChange={e => { setXEmpTipoDocId(Number(e.target.value)); setXEmpresa(null); setEmpNoEncontrada(false) }}
                      className={inputCls}>
                      <option value={0}>— Seleccione —</option>
                      {tiposDocEmpresa.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-5 flex flex-col gap-1">
                    <label className={labelCls}>Identificación *</label>
                    <input type="text" value={xEmpNumero}
                      onChange={e => { setXEmpNumero(e.target.value.replace(/\D/g, '')); setXEmpresa(null); setEmpNoEncontrada(false) }}
                      onKeyDown={e => { if (e.key === 'Enter') buscarEmpresa() }}
                      placeholder="899999034" maxLength={20} className={inputCls} />
                  </div>
                  <div className="sm:col-span-3">
                    <button onClick={buscarEmpresa} disabled={buscandoEmp}
                      className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-40"
                      style={{ backgroundColor: SENA }}>
                      {buscandoEmp ? <><Loader2 size={13} className="animate-spin" /> Buscando…</> : <><Search size={13} /> Buscar</>}
                    </button>
                  </div>
                </div>

                {xEmpresa && (
                  <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="text-emerald-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-emerald-800">{xEmpresa.nombre}</p>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          <strong>Tamaño:</strong> {xEmpresa.tamanoEmpresa ?? '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {empNoEncontrada && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                    <AlertCircle size={18} className="text-amber-600" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-800">Esta empresa no está registrada</p>
                      <p className="text-xs text-amber-700 mt-0.5">Regístrala ahora y se cargará automáticamente al formulario.</p>
                    </div>
                    <button onClick={() => setEmpresaModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm whitespace-nowrap"
                      style={{ backgroundColor: TITLE }}>
                      <Building2 size={12} /> Registrar empresa
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-[#0070C0]" />
                  <h2 className="text-sm font-bold text-[#00304D]">Datos laborales</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6 flex flex-col gap-1">
                    <label className={labelCls}>Nivel Ocupacional *</label>
                    <select value={xNivelId} onChange={e => setXNivelId(Number(e.target.value))} className={inputCls}>
                      <option value={0}>— Seleccione —</option>
                      {niveles.map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-6 flex flex-col gap-1">
                    <label className={labelCls}>Caracterización *</label>
                    <select value={xCaracterizacionId} onChange={e => setXCaracterizacionId(Number(e.target.value))} className={inputCls}>
                      <option value={0}>— Seleccione —</option>
                      {caracterizaciones.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-neutral-50 to-white border border-neutral-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <p className="text-sm font-bold text-[#00304D] flex-1">¿Beneficiario de transferencia? *</p>
                  <ToggleSiNo value={xTransferencia} onChange={setXTransferencia} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Perfil de Transferencia *</label>
                  <select value={xPerfilTransfId} onChange={e => setXPerfilTransfId(Number(e.target.value))} className={inputCls}>
                    <option value={0}>— Seleccione —</option>
                    {perfilesTransf.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-neutral-100">
                {!puedeGuardarPostulacion && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 flex-1">
                    <AlertCircle size={13} /> Faltan: <strong>{camposFaltantesPostu.slice(0, 4).join(', ')}{camposFaltantesPostu.length > 4 ? `, +${camposFaltantesPostu.length - 4}` : ''}</strong>
                  </p>
                )}
                {puedeGuardarPostulacion && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 flex-1">
                    <CheckCircle2 size={13} /> Todo listo para guardar
                  </p>
                )}
                <button
                  onClick={() => setAsociarModalOpen(true)}
                  disabled={!puedeAsociar}
                  title={puedeAsociar ? 'Asociar a un grupo de acción de formación' : 'Disponible cuando la postulación esté vigente'}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold border-2 transition disabled:opacity-40 disabled:cursor-not-allowed border-[#0070C0] text-[#0070C0] hover:bg-[#0070C0] hover:text-white">
                  <Link2 size={13} /> Asociar a grupo
                </button>
                <button onClick={guardarPostulacion} disabled={guardandoPostu || !puedeGuardarPostulacion}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white shadow disabled:opacity-40"
                  style={{ backgroundColor: SENA }}>
                  {guardandoPostu ? <><Loader2 size={13} className="animate-spin" /> Guardando…</>
                    : <><Save size={13} /> {resultado?.estado === 'vigente' ? 'Actualizar postulación' : 'Guardar postulación'}</>}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
