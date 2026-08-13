import { Search, PlusCircle, AlertCircle, Loader2 } from 'lucide-react'
import type { RegistroState } from '@/types'

const TIPOS_DOC = [
  { value: 'CC',  label: 'Cédula de Ciudadanía' },
  { value: 'CE',  label: 'Cédula de Extranjería' },
  { value: 'TI',  label: 'Tarjeta de Identidad' },
  { value: 'NIT', label: 'NIT' },
]

const ANTIGÜEDAD_OPTS = [
  { value: 'S', label: 'Sí' },
  { value: 'N', label: 'No' },
]

interface Props {
  state: RegistroState
  loading: boolean
  alerta: { msg: string; tipo: 'error' | 'info' | 'success' } | null
  caracterizaciones: { id: string; nombre: string }[]
  nivelesOcupacionales: { id: string; nombre: string }[]
  onChange: (field: keyof RegistroState, value: string | number | boolean | null) => void
  onBuscarEmpresa: () => void
  onCrearEmpresa: () => void
  onGuardarPost: () => void
}

const inputCls = 'w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
const selectCls = `${inputCls} bg-white`

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-neutral-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export function StepDatosEmpresa({
  state, loading, alerta,
  caracterizaciones, nivelesOcupacionales,
  onChange, onBuscarEmpresa, onCrearEmpresa, onGuardarPost,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Datos Empresariales */}
      <div className="flex items-center gap-3 px-5 py-3 text-white font-semibold text-base rounded-lg shadow-sm" style={{ backgroundColor: '#00304D' }}>
        <span>💼</span> Datos Empresariales
      </div>

      <p className="text-sm text-neutral-600">
        A continuación, podrá buscar la empresa beneficiaria a la cual está asociado.
        Si no existe en el sistema, proceda a crearla con el botón <strong>"Crear Empresa"</strong>.
      </p>

      {/* Buscar empresa */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5 min-w-[180px]">
          <label className="text-sm font-semibold text-neutral-700">Tipo Doc. Empresa</label>
          <select className={selectCls} value={state.tipoDocEmpresa} onChange={(e) => onChange('tipoDocEmpresa', e.target.value)}>
            <option value="">— Seleccione —</option>
            {TIPOS_DOC.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
          <label className="text-sm font-semibold text-neutral-700">Identificación</label>
          <input className={inputCls} value={state.beneficiarioEmpresaNumero}
            onChange={(e) => onChange('beneficiarioEmpresaNumero', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onBuscarEmpresa()}
            placeholder="NIT / Cédula empresa" />
        </div>
        <div className="flex gap-2">
          <button onClick={onBuscarEmpresa} disabled={loading}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-semibold px-4 py-2.5 text-sm rounded-lg transition-colors">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Buscar
          </button>
          <button onClick={onCrearEmpresa}
            className="flex items-center gap-1.5 bg-cerulean-500 hover:bg-cerulean-700 text-white font-semibold px-4 py-2.5 text-sm rounded-lg transition-colors">
            <PlusCircle size={14} />
            Crear Empresa
          </button>
        </div>
      </div>

      {/* Empresa encontrada */}
      {state.beneficiarioEmpresaId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div>
            <span className="text-xs font-semibold text-neutral-500">Empresa</span>
            <p className="text-sm font-semibold text-neutral-800">{state.beneficiarioEmpresaNombre}</p>
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-500">Tamaño</span>
            <p className="text-sm font-semibold text-neutral-800">{state.tamanoEmpresaNombre}</p>
          </div>
        </div>
      )}

      {/* Postulación */}
      <div className="h-px bg-neutral-200" />
      <p className="text-sm text-neutral-600">
        La información ingresada corresponde al perfil de beneficiario para participar en los
        diferentes eventos del Grupo de Gestión para la Productividad y la Competitividad.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Edad">
          <input className={`${inputCls} bg-neutral-50`} value={state.postulacionEdad || ''} readOnly placeholder="Se calcula automáticamente" />
        </Field>
        <Field label="Año">
          <input className={`${inputCls} bg-neutral-50`} value={state.postulacionAno || ''} readOnly />
        </Field>
        <Field label="Se ha Beneficiado Anteriormente" required>
          <select className={selectCls} value={state.postulacionAntiguedad} onChange={(e) => onChange('postulacionAntiguedad', e.target.value)}>
            <option value="">— Seleccione —</option>
            {ANTIGÜEDAD_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Caracterización" required>
          <select className={selectCls} value={state.caracterizacionId} onChange={(e) => onChange('caracterizacionId', e.target.value)}>
            <option value="">— Seleccione —</option>
            {caracterizaciones.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Field>
        <Field label="Nivel Ocupacional" required>
          <select className={selectCls} value={state.nivelOcupacionalId} onChange={(e) => onChange('nivelOcupacionalId', e.target.value)}>
            <option value="">— Seleccione —</option>
            {nivelesOcupacionales.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
          </select>
        </Field>
      </div>

      {alerta && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium
          ${alerta.tipo === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
          <AlertCircle size={16} className="flex-shrink-0" />
          {alerta.msg}
        </div>
      )}

      <div className="flex justify-start">
        <button onClick={onGuardarPost} disabled={loading}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors">
          {loading && <Loader2 size={15} className="animate-spin" />}
          Guardar datos empresariales
        </button>
      </div>
    </div>
  )
}
