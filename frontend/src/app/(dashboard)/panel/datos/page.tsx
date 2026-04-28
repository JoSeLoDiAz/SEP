'use client'

import api from '@/lib/api'
import { fmtDateTime } from '@/lib/format-date'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  ChevronDown, FileText, Loader2,
  MapPin, BarChart3, Scale, KeyRound, Handshake, Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// ── tipos ─────────────────────────────────────────────────────────────────────

interface Lookup { id: number; nombre: string }
interface DatosEmpresa {
  empresaId: number
  tipoDocNombre: string
  empresaIdentificacion: number
  empresaDigitoVerificacion: number
  empresaRazonSocial: string
  empresaSigla: string
  empresaEmail: string
  fechaRegistro: string
  perfilNombre: string
  coberturaEmpresaId: number
  departamentoEmpresaId: number
  ciudadEmpresaId: number
  empresaDireccion: string
  empresaTelefono: string
  empresaCelular: string
  empresaIndicativo: number
  empresaWebsite: string
  ciiuId: number
  ciiuDesc: string
  tipoEmpresaId: number
  tamanoEmpresaId: number
  empresaCertifComp: string
  empresaExpertTecn: string
  tipoIdentificacionRep: number
  empresaRepDocumento: string
  empresaRep: string
  empresaRepCargo: string
  empresaRepCorreo: string
  empresaRepTel: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

function Field({ label, children, req }: { label: string; children: React.ReactNode; req?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-neutral-600">
        {label}{req && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function ReadOnly({ value }: { value?: string | number | null }) {
  return (
    <div className="px-3 py-2 text-sm text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg min-h-[38px]">
      {value ?? '—'}
    </div>
  )
}

const inputCls = 'w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40 focus:border-[#00304D] transition bg-white'
const selectCls = inputCls + ' appearance-none cursor-pointer'

function Select({ value, onChange, options, placeholder }: {
  value: number | string; onChange: (v: number) => void
  options: Lookup[]; placeholder?: string
}) {
  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={e => onChange(Number(e.target.value))}
        className={selectCls}
      >
        <option value="">{placeholder ?? 'Seleccionar…'}</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
    </div>
  )
}

function SectionCard({ icon: Icon, title, color, children }: {
  icon: React.ElementType; title: string; color: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5" style={{ backgroundColor: color }}>
        <Icon size={18} className="text-white" />
        <h2 className="text-white font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function SaveBtn({ loading, label = 'Actualizar' }: { loading: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex items-center gap-2 px-6 py-2.5 bg-[#00304D] hover:bg-[#004a76] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {label}
    </button>
  )
}

// ── Buscador CIIU (debounced) ─────────────────────────────────────────────────

function CiiuSearch({ display, onChange }: {
  display: string; onChange: (id: number, nombre: string) => void
}) {
  const [q, setQ] = useState(display)
  const [results, setResults] = useState<Lookup[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setQ(display) }, [display])

  function handleInput(v: string) {
    setQ(v)
    if (timer.current) clearTimeout(timer.current)
    if (v.length < 2) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      try {
        const res = await api.get<Lookup[]>(`/empresa/ciiu?q=${encodeURIComponent(v)}`)
        setResults(res.data)
        setOpen(true)
      } catch { setResults([]) }
    }, 350)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={q}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => q.length >= 2 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Buscar por código o descripción…"
        className={inputCls}
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.id}
              type="button"
              onMouseDown={() => { onChange(r.id, r.nombre); setQ(r.nombre); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-xs hover:bg-neutral-50 border-b border-neutral-100 last:border-0"
            >
              {r.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DatosBasicosPage() {
  const [data, setData] = useState<DatosEmpresa | null>(null)
  const [loading, setLoading] = useState(true)

  // lookups
  const [departamentos, setDepartamentos] = useState<Lookup[]>([])
  const [ciudades, setCiudades] = useState<Lookup[]>([])
  const [coberturas, setCoberturas] = useState<Lookup[]>([])
  const [tiposOrg, setTiposOrg] = useState<Lookup[]>([])
  const [tamanos, setTamanos] = useState<Lookup[]>([])
  const [tiposDocRep, setTiposDocRep] = useState<Lookup[]>([])

  // section loading
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  // toast
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)
  const toastKey = useRef(0)
  const [toastKey2, setToastKey2] = useState(0)

  function showToast(tipo: 'success' | 'error', msg: string) {
    toastKey.current++
    setToast({ tipo, msg })
    setToastKey2(toastKey.current)
  }

  // form state mirrors
  const [razonSocial, setRazonSocial] = useState('')
  const [sigla, setSigla] = useState('')
  const [nuevaClave, setNuevaClave] = useState('')
  const [deptId, setDeptId] = useState<number>(0)
  const [ciudadId, setCiudadId] = useState<number>(0)
  const [coberturaId, setCoberturaId] = useState<number>(0)
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [celular, setCelular] = useState('')
  const [website, setWebsite] = useState('')
  const [ciiuId, setCiiuId] = useState<number>(0)
  const [ciiuDesc, setCiiuDesc] = useState('')
  const [tipoOrgId, setTipoOrgId] = useState<number>(0)
  const [tamanoId, setTamanoId] = useState<number>(0)
  const [indicativo, setIndicativo] = useState('')
  const [certif, setCertif] = useState('N')
  const [expert, setExpert] = useState('N')
  const [mesas, setMesas] = useState<Lookup[]>([])
  const [mesasEmpresa, setMesasEmpresa] = useState<{ id: number; nombre: string }[]>([])
  const [mesaSelId, setMesaSelId] = useState<number>(0)
  const [savingMesa, setSavingMesa] = useState(false)
  // sectores/subsectores
  const [sectores, setSectores] = useState<Lookup[]>([])
  const [subsectores, setSubsectores] = useState<Lookup[]>([])
  const [sectPertId, setSectPertId] = useState(0)
  const [subsectPertId, setSubsectPertId] = useState(0)
  const [sectRepId, setSectRepId] = useState(0)
  const [subsectRepId, setSubsectRepId] = useState(0)
  const [sectoresPertenece, setSectoresPertenece] = useState<{ id: number; nombre: string }[]>([])
  const [subsectoresPertenece, setSubsectoresPertenece] = useState<{ id: number; nombre: string }[]>([])
  const [sectoresRepresenta, setSectoresRepresenta] = useState<{ id: number; nombre: string }[]>([])
  const [subsectoresRepresenta, setSubsectoresRepresenta] = useState<{ id: number; nombre: string }[]>([])
  const [tipoDocRepId, setTipoDocRepId] = useState<number>(0)
  const [repDoc, setRepDoc] = useState('')
  const [repNombre, setRepNombre] = useState('')
  const [repCargo, setRepCargo] = useState('')
  const [repCorreo, setRepCorreo] = useState('')
  const [repTel, setRepTel] = useState('')

  // ── Load on mount ─────────────────────────────────────────────────────────

  useEffect(() => { document.title = 'Datos Básicos | SEP' }, [])

  useEffect(() => {
    async function load() {
      try {
        const [
          datosRes, deptsRes, cobRes, orgRes, tamRes, docRepRes,
          mesasRes, mesasEmpRes,
          sectRes, subsectRes,
          sPertRes, ssPertRes, sRepRes, ssRepRes,
        ] = await Promise.all([
          api.get<DatosEmpresa>('/empresa/datos'),
          api.get<Lookup[]>('/empresa/departamentos'),
          api.get<Lookup[]>('/empresa/coberturas'),
          api.get<Lookup[]>('/empresa/tipos-organizacion'),
          api.get<Lookup[]>('/empresa/tamanos'),
          api.get<Lookup[]>('/empresa/tipos-doc-rep'),
          api.get<Lookup[]>('/empresa/mesas-sectoriales'),
          api.get<{ id: number; nombre: string }[]>('/empresa/mesas-sectoriales/empresa'),
          api.get<Lookup[]>('/empresa/sectores'),
          api.get<Lookup[]>('/empresa/subsectores'),
          api.get<{ id: number; nombre: string }[]>('/empresa/sectores-pertenece'),
          api.get<{ id: number; nombre: string }[]>('/empresa/subsectores-pertenece'),
          api.get<{ id: number; nombre: string }[]>('/empresa/sectores-representa'),
          api.get<{ id: number; nombre: string }[]>('/empresa/subsectores-representa'),
        ])
        const d = datosRes.data
        setData(d)
        setDepartamentos(deptsRes.data)
        setCoberturas(cobRes.data)
        setTiposOrg(orgRes.data)
        setTamanos(tamRes.data)
        setTiposDocRep(docRepRes.data)
        setMesas(mesasRes.data)
        setMesasEmpresa(mesasEmpRes.data)
        setSectores(sectRes.data)
        setSubsectores(subsectRes.data)
        setSectoresPertenece(sPertRes.data)
        setSubsectoresPertenece(ssPertRes.data)
        setSectoresRepresenta(sRepRes.data)
        setSubsectoresRepresenta(ssRepRes.data)

        // populate form
        setRazonSocial(d.empresaRazonSocial ?? '')
        setSigla(d.empresaSigla ?? '')
        setIndicativo(String(d.empresaIndicativo ?? ''))
        setDeptId(d.departamentoEmpresaId ?? 0)
        setCiudadId(d.ciudadEmpresaId ?? 0)
        setCoberturaId(d.coberturaEmpresaId ?? 0)
        setDireccion(d.empresaDireccion ?? '')
        setTelefono(d.empresaTelefono ?? '')
        setCelular(d.empresaCelular ?? '')
        setWebsite(d.empresaWebsite ?? '')
        setCiiuId(d.ciiuId ?? 0)
        setCiiuDesc(d.ciiuDesc ?? '')
        setTipoOrgId(d.tipoEmpresaId ?? 0)
        setTamanoId(d.tamanoEmpresaId ?? 0)
        setCertif(['S', 'N'].includes((d.empresaCertifComp ?? '').trim()) ? (d.empresaCertifComp ?? '').trim() : 'N')
        setExpert(['S', 'N'].includes((d.empresaExpertTecn ?? '').trim()) ? (d.empresaExpertTecn ?? '').trim() : 'N')
        setTipoDocRepId(d.tipoIdentificacionRep ?? 0)
        setRepDoc(d.empresaRepDocumento ?? '')
        setRepNombre(d.empresaRep ?? '')
        setRepCargo(d.empresaRepCargo ?? '')
        setRepCorreo(d.empresaRepCorreo ?? '')
        setRepTel(d.empresaRepTel ?? '')

        // ciudades del departamento inicial
        if (d.departamentoEmpresaId) {
          const cRes = await api.get<Lookup[]>(`/empresa/ciudades?departamentoId=${d.departamentoEmpresaId}`)
          setCiudades(cRes.data)
        }
      } catch {
        showToast('error', 'Error al cargar los datos')
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onDeptChange(id: number) {
    setDeptId(id)
    setCiudadId(0)
    if (!id) { setCiudades([]); return }
    const res = await api.get<Lookup[]>(`/empresa/ciudades?departamentoId=${id}`)
    setCiudades(res.data)
  }

  async function submit(section: string, body: Record<string, unknown>) {
    setSaving(s => ({ ...s, [section]: true }))
    try {
      await api.put(`/empresa/${section}`, body)
      showToast('success', 'Datos actualizados correctamente')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar'
      showToast('error', msg)
    } finally {
      setSaving(s => ({ ...s, [section]: false }))
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-[#00304D]" />
    </div>
  )

  if (!data) return (
    <div className="p-8 text-center text-neutral-500">No se encontró información de la empresa.</div>
  )

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa
          key={toastKey2}
          show
          onClose={() => setToast(null)}
          tipo={toast.tipo}
          titulo={toast.tipo === 'success' ? 'Guardado' : 'Error'}
          mensaje={toast.msg}
          duration={4500}
        />
      )}

      {/* Título */}
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Datos Básicos</h1>
        <p className="text-xs text-neutral-400 mt-0.5">
          Empresa / Gremio / Asociación — puede actualizar la información que desee
        </p>
        <p className="text-[11px] text-red-500 mt-1">* Campos obligatorios</p>
      </div>

      {/* ── 1. Datos de Identificación ──────────────────────────────────── */}
      <SectionCard icon={FileText} title="Datos de Identificación" color="#00304D">
        <form
          onSubmit={e => { e.preventDefault(); submit('identificacion', { empresaRazonSocial: razonSocial, empresaSigla: sigla }) }}
          className="flex flex-col gap-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Field label="Tipo de Identificación"><ReadOnly value={data.tipoDocNombre} /></Field>
            <Field label="Número de Identificación"><ReadOnly value={data.empresaIdentificacion} /></Field>
            <Field label="Dígito de Verificación"><ReadOnly value={data.empresaDigitoVerificacion} /></Field>
            <Field label="Nombre de la Entidad Proponente" req>
              <input className={inputCls} value={razonSocial}
                onChange={e => setRazonSocial(e.target.value)} required />
            </Field>
            <Field label="Sigla">
              <input className={inputCls} value={sigla}
                onChange={e => setSigla(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end">
            <SaveBtn loading={saving.identificacion} />
          </div>
        </form>
      </SectionCard>

      {/* ── 2. Datos del Usuario ────────────────────────────────────────── */}
      <SectionCard icon={KeyRound} title="Datos del Usuario" color="#4A4A8A">
        <form
          onSubmit={e => { e.preventDefault(); if (!nuevaClave.trim()) return; submit('cambiar-clave', { nuevaClave }) }}
          className="flex flex-col gap-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Field label="Usuario (correo)"><ReadOnly value={data.empresaEmail} /></Field>
            <Field label="Perfil"><ReadOnly value={data.perfilNombre ?? 'EMPRESA'} /></Field>
            <Field label="Fecha de Registro">
              <ReadOnly value={fmtDateTime(data.fechaRegistro)} />
            </Field>
            <Field label="Nueva Contraseña">
              <input
                type="password" className={inputCls} value={nuevaClave}
                onChange={e => setNuevaClave(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
            </Field>
          </div>
          <p className="text-xs text-neutral-400 -mt-2">
            Solo complete este campo si desea cambiar la contraseña.
          </p>
          <div className="flex justify-end">
            <SaveBtn loading={saving['cambiar-clave']} label="Cambiar contraseña" />
          </div>
        </form>
      </SectionCard>

      {/* ── 3. Datos de Ubicación ───────────────────────────────────────── */}
      <SectionCard icon={MapPin} title="Datos de Ubicación Empresa / Gremio / Asociación" color="#006633">
        <form
          onSubmit={e => {
            e.preventDefault()
            submit('ubicacion', { departamentoEmpresaId: deptId, ciudadEmpresaId: ciudadId, coberturaEmpresaId: coberturaId, empresaDireccion: direccion, empresaTelefono: telefono, empresaCelular: celular, empresaIndicativo: indicativo ? Number(indicativo) : null, empresaWebsite: website })
          }}
          className="flex flex-col gap-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Field label="Departamento" req>
              <Select value={deptId} onChange={onDeptChange} options={departamentos} placeholder="Seleccionar departamento…" />
            </Field>
            <Field label="Ciudad de Domicilio" req>
              <Select value={ciudadId} onChange={setCiudadId} options={ciudades} placeholder="Seleccionar ciudad…" />
            </Field>
            <Field label="Cobertura" req>
              <Select value={coberturaId} onChange={setCoberturaId} options={coberturas} placeholder="Seleccionar cobertura…" />
            </Field>
            <Field label="Dirección de Domicilio" req>
              <input className={inputCls} value={direccion} onChange={e => setDireccion(e.target.value)} required />
            </Field>
            <Field label="Indicativo Telefónico (área)">
              <input className={inputCls} value={indicativo} onChange={e => setIndicativo(e.target.value)} placeholder="Ej: 7" type="number" />
            </Field>
            <Field label="Teléfono Fijo">
              <input className={inputCls} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Fijo" />
            </Field>
            <Field label="Número de Celular" req>
              <input className={inputCls} value={celular} onChange={e => setCelular(e.target.value)} required />
            </Field>
            <Field label="Página Web">
              <input className={inputCls} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://…" />
            </Field>
          </div>
          <div className="flex justify-end">
            <SaveBtn loading={saving.ubicacion} />
          </div>
        </form>
      </SectionCard>

      {/* ── 4. Datos Generales ──────────────────────────────────────────── */}
      <SectionCard icon={BarChart3} title="Datos Generales de la Empresa / Gremio Proponente" color="#00304D">
        <form
          onSubmit={e => {
            e.preventDefault()
            submit('economicos', { ciiuId, tipoEmpresaId: tipoOrgId, tamanoEmpresaId: tamanoId, empresaCertifComp: certif, empresaExpertTecn: expert })
          }}
          className="flex flex-col gap-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Actividad Económica según el RUT (CIIU)" req>
              <CiiuSearch display={ciiuDesc} onChange={(id, nom) => { setCiiuId(id); setCiiuDesc(nom) }} />
            </Field>
            <Field label="Tipo de Organización" req>
              <Select value={tipoOrgId} onChange={setTipoOrgId} options={tiposOrg} placeholder="Seleccionar tipo…" />
            </Field>
            <Field label="Tamaño de la Empresa / Gremio" req>
              <Select value={tamanoId} onChange={setTamanoId} options={tamanos} placeholder="Seleccionar tamaño…" />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="¿Trabajadores con certificación de competencias laborales SENA?">
              <div className="flex gap-4 mt-1">
                {['S', 'N'].map(v => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer text-sm text-neutral-700">
                    <input type="radio" name="certif" value={v} checked={certif === v} onChange={() => setCertif(v)} className="accent-[#00304D]" />
                    {v === 'S' ? 'Sí' : 'No'}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="¿Ha vinculado expertos técnicos para elaboración de competencias?">
              <div className="flex gap-4 mt-1">
                {['S', 'N'].map(v => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer text-sm text-neutral-700">
                    <input type="radio" name="expert" value={v} checked={expert === v} onChange={() => setExpert(v)} className="accent-[#00304D]" />
                    {v === 'S' ? 'Sí' : 'No'}
                  </label>
                ))}
              </div>
            </Field>
          </div>
          <div className="flex justify-end">
            <SaveBtn loading={saving.economicos} />
          </div>
        </form>
      </SectionCard>

      {/* ── 5. Mesas Sectoriales ────────────────────────────────────────── */}
      <SectionCard icon={Handshake} title="Datos de Mesas Sectoriales" color="#1a6b3c">
        <div className="flex flex-col gap-5">
          {/* Texto descriptivo */}
          <div className="text-sm text-neutral-700 leading-relaxed space-y-3">
            <p>
              Las <strong>Mesas Sectoriales</strong> son el espacio natural de concertación entre el sector productivo,
              gubernamental y académico, orientado al fortalecimiento de la gestión del talento humano por competencias.
              A través de ellas se genera conocimiento transferible a la formación profesional, se formulan proyectos,
              y se revisan las ocupaciones, cargos y competencias requeridas para la competitividad de los sectores productivos del país.
            </p>
            <p>
              Las Mesas contribuyen al mejoramiento de la <strong>cualificación del talento humano</strong>,
              la pertinencia de la formación para el trabajo y la articulación con las necesidades del entorno productivo.
              En ellas participan voluntariamente gremios, empresarios, sector público, organizaciones de trabajadores,
              centros de investigación y oferentes educativos.
            </p>
            <p>
              Actualmente operan <strong>85 Mesas Sectoriales en todo el país</strong>, con carácter nacional y sectorial,
              bajo la coordinación del SENA a través de las Secretarías Técnicas de cada Centro de Formación.
            </p>
          </div>

          {/* Botón externo */}
          <div className="flex justify-center">
            <a
              href="https://www.sena.edu.co/es-co/Empresarios/Paginas/mesasSectoriales.aspx"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#39A900] hover:bg-[#2d8700] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Handshake size={16} />
              Vincúlese o Actualice su Información Aquí
            </a>
          </div>

          {/* Registrar mesa */}
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">
                Registre las Mesas Sectoriales a las que se encuentra vinculado su empresa / gremio o asociación
              </label>
              <div className="relative">
                <select
                  value={mesaSelId}
                  onChange={e => setMesaSelId(Number(e.target.value))}
                  className={selectCls}
                >
                  <option value={0}>Seleccionar…</option>
                  {mesas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            </div>
            <button
              type="button"
              disabled={!mesaSelId || savingMesa}
              onClick={async () => {
                if (!mesaSelId) return
                setSavingMesa(true)
                try {
                  await api.post('/empresa/mesas-sectoriales/empresa', { mesaSectorialId: mesaSelId })
                  const res = await api.get<{ id: number; nombre: string }[]>('/empresa/mesas-sectoriales/empresa')
                  setMesasEmpresa(res.data)
                  setMesaSelId(0)
                  showToast('success', 'Mesa sectorial registrada')
                } catch (e: unknown) {
                  const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al registrar'
                  showToast('error', msg)
                } finally { setSavingMesa(false) }
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#39A900] hover:bg-[#2d8700] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
            >
              {savingMesa && <Loader2 size={14} className="animate-spin" />}
              Registrar
            </button>
          </div>

          {/* Tabla mesas registradas */}
          {mesasEmpresa.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-neutral-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#00304D] text-white">
                    <th className="text-left px-4 py-2.5 font-semibold">Mesa Sectorial</th>
                    <th className="text-center px-4 py-2.5 font-semibold w-32">Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {mesasEmpresa.map((m, i) => (
                    <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                      <td className="px-4 py-2.5 text-neutral-700">{m.nombre}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api.delete(`/empresa/mesas-sectoriales/empresa/${m.id}`)
                              setMesasEmpresa(prev => prev.filter(x => x.id !== m.id))
                              showToast('success', 'Mesa eliminada')
                            } catch { showToast('error', 'Error al eliminar') }
                          }}
                          className="text-red-500 hover:text-red-700 transition-colors p-1"
                          title="Eliminar mesa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── 6. Datos Representante Legal ────────────────────────────────── */}
      <SectionCard icon={Scale} title="Datos Representante Legal Empresa / Gremio / Asociación" color="#B00020">
        <form
          onSubmit={e => {
            e.preventDefault()
            submit('representante', { tipoIdentificacionRep: tipoDocRepId, empresaRepDocumento: repDoc, empresaRep: repNombre, empresaRepCargo: repCargo, empresaRepCorreo: repCorreo, empresaRepTel: repTel })
          }}
          className="flex flex-col gap-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Field label="Tipo de Identificación" req>
              <Select value={tipoDocRepId} onChange={setTipoDocRepId} options={tiposDocRep} placeholder="Seleccionar…" />
            </Field>
            <Field label="Número de Documento" req>
              <input className={inputCls} value={repDoc} onChange={e => setRepDoc(e.target.value)} required />
            </Field>
            <Field label="Nombre Completo" req>
              <input className={inputCls} value={repNombre} onChange={e => setRepNombre(e.target.value)} required />
            </Field>
            <Field label="Cargo en la Empresa" req>
              <input className={inputCls} value={repCargo} onChange={e => setRepCargo(e.target.value)} required />
            </Field>
            <Field label="Correo Electrónico" req>
              <input type="email" className={inputCls} value={repCorreo} onChange={e => setRepCorreo(e.target.value)} required />
            </Field>
            <Field label="Teléfono" req>
              <input className={inputCls} value={repTel} onChange={e => setRepTel(e.target.value)} required />
            </Field>
          </div>
          <div className="flex justify-end">
            <SaveBtn loading={saving.representante} label="Registrar / Actualizar" />
          </div>
        </form>
      </SectionCard>

      {/* Nota */}
      <p className="text-[11px] text-neutral-400 text-center pb-2">
        Todos los accesos y modificaciones son registrados y auditados — SEP GGPC SENA
      </p>
    </div>
  )
}
