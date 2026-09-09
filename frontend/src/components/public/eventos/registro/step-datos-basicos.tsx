import { AlertCircle, Loader2 } from 'lucide-react'
import type { RegistroState } from '@/types'

const GENEROS = [
  { value: '1', label: 'Masculino' },
  { value: '2', label: 'Femenino' },
  { value: '3', label: 'No binario' },
  { value: '4', label: 'Prefiero no decir' },
]

const ESTRATOS = ['1','2','3','4','5','6'].map((e) => ({ value: e, label: `Estrato ${e}` }))

interface Props {
  state: RegistroState
  loading: boolean
  alerta: { msg: string; tipo: 'error' | 'info' | 'success' } | null
  personaExistente: boolean
  departamentos: { id: string; nombre: string }[]
  ciudades: { id: string; nombre: string }[]
  onChange: (field: keyof RegistroState, value: string | number | boolean | null) => void
  onDepartamentoChange: (deptoId: string) => void
  onGuardar: () => void
}

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

const inputCls = 'w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
const selectCls = `${inputCls} bg-white`

export function StepDatosBasicos({
  state, loading, alerta, personaExistente,
  departamentos, ciudades,
  onChange, onDepartamentoChange, onGuardar,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Título sección */}
      <div className="flex items-center gap-3 px-5 py-3 text-white font-semibold text-base rounded-lg shadow-sm" style={{ backgroundColor: '#00304D' }}>
        <span>👤</span> Datos Básicos
      </div>

      {/* Persona existente: mostrar nombre enmascarado */}
      {personaExistente && state.maskedNombreCompleto && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
          <span>Beneficiario encontrado:</span>
          <strong className="font-mono tracking-wider">{state.maskedNombreCompleto}</strong>
        </div>
      )}

      {/* Campos solo si es persona nueva */}
      {!personaExistente && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombres" required>
            <input className={inputCls} value={state.personaNombres} onChange={(e) => onChange('personaNombres', e.target.value)} placeholder="Nombres completos" />
          </Field>
          <Field label="Primer Apellido" required>
            <input className={inputCls} value={state.personaPrimerApellido} onChange={(e) => onChange('personaPrimerApellido', e.target.value)} placeholder="Primer apellido" />
          </Field>
          <Field label="Segundo Apellido">
            <input className={inputCls} value={state.personaSegundoApellido} onChange={(e) => onChange('personaSegundoApellido', e.target.value)} placeholder="Segundo apellido" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Género" required>
              <select className={selectCls} value={state.generoId} onChange={(e) => onChange('generoId', e.target.value)}>
                <option value="">— Seleccione —</option>
                {GENEROS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </Field>
            <Field label="Estrato" required>
              <select className={selectCls} value={state.personaEstrato} onChange={(e) => onChange('personaEstrato', e.target.value)}>
                <option value="">— Seleccione —</option>
                {ESTRATOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Fecha de Nacimiento" required>
            <input type="date" className={inputCls} value={state.personaFechaNacimiento}
              onChange={(e) => onChange('personaFechaNacimiento', e.target.value)} />
          </Field>
          <Field label="Celular" required>
            <input className={inputCls} value={state.personaCelular} onChange={(e) => onChange('personaCelular', e.target.value)} placeholder="Número de celular" />
          </Field>
          <Field label="Departamento" required>
            <select className={selectCls} value={state.personaDepartamentoId} onChange={(e) => onDepartamentoChange(e.target.value)}>
              <option value="">— Seleccione —</option>
              {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </Field>
          <Field label="Ciudad" required>
            <select className={selectCls} value={state.personaCiudad} onChange={(e) => onChange('personaCiudad', e.target.value)} disabled={!state.personaDepartamentoId}>
              <option value="">— Seleccione —</option>
              {ciudades.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Field>
          <Field label="Email" required>
            <input type="email" className={inputCls} value={state.personaEmail} onChange={(e) => onChange('personaEmail', e.target.value)} placeholder="correo@ejemplo.com" />
          </Field>
          <Field label="Barrio / Vereda" required>
            <input className={inputCls} value={state.personaBarrio} onChange={(e) => onChange('personaBarrio', e.target.value)} placeholder="Barrio o vereda" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Dirección" required>
              <input className={inputCls} value={state.personaDireccion} onChange={(e) => onChange('personaDireccion', e.target.value)} placeholder="Dirección completa" />
            </Field>
          </div>
        </div>
      )}

      {/* Solo Email editable si existe pero no tiene postulación (valiarRegistro=1) */}
      {personaExistente && state.valiarRegistro === 1 && (
        <Field label="Email" required>
          <input type="email" className={`${inputCls} max-w-md`} value={state.personaEmail} onChange={(e) => onChange('personaEmail', e.target.value)} placeholder="correo@ejemplo.com" />
        </Field>
      )}

      {alerta && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium
          ${alerta.tipo === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
          <AlertCircle size={16} className="flex-shrink-0" />
          {alerta.msg}
        </div>
      )}

      <div className="flex justify-start">
        <button onClick={onGuardar} disabled={loading}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors">
          {loading && <Loader2 size={15} className="animate-spin" />}
          {personaExistente ? 'Continuar' : 'Guardar datos básicos'}
        </button>
      </div>
    </div>
  )
}
