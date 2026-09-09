import { Search, Loader2, AlertCircle } from 'lucide-react'
import type { RegistroState } from '@/types'

const TIPOS_DOC = [
  { value: 'CC',  label: 'Cédula de Ciudadanía' },
  { value: 'CE',  label: 'Cédula de Extranjería' },
  { value: 'TI',  label: 'Tarjeta de Identidad' },
  { value: 'PA',  label: 'Pasaporte' },
  { value: 'NIT', label: 'NIT' },
]

interface Props {
  state: RegistroState
  loading: boolean
  alerta: { msg: string; tipo: 'error' | 'info' | 'success' } | null
  onChange: (field: keyof RegistroState, value: string | number | boolean | null) => void
  onBuscar: () => void
  onRegresar: () => void
}

export function StepBuscarPersona({ state, loading, alerta, onChange, onBuscar, onRegresar }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-neutral-500">
        <span className="text-red-500 font-bold">Nota:</span>{' '}
        Favor tener presente que todos los campos marcados con (*) son de carácter obligatorio.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <label className="text-sm font-semibold text-neutral-700">Tipo Documento</label>
          <select
            value={state.tipoIdentificacion}
            onChange={(e) => onChange('tipoIdentificacion', e.target.value)}
            className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">— Seleccione —</option>
            {TIPOS_DOC.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
          <label className="text-sm font-semibold text-neutral-700">N° Documento</label>
          <input
            type="text"
            value={state.identificacion}
            onChange={(e) => onChange('identificacion', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onBuscar()}
            placeholder="Número de identificación"
            className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onRegresar}
            className="px-4 py-2.5 text-sm font-medium border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Regresar
          </button>
          <button
            onClick={onBuscar}
            disabled={loading}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-semibold px-5 py-2.5 text-sm rounded-lg transition-colors"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Buscar
          </button>
        </div>
      </div>

      {alerta && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium
          ${alerta.tipo === 'error'
            ? 'bg-red-50 text-red-600 border border-red-200'
            : 'bg-green-50 text-green-600 border border-green-200'
          }`}>
          <AlertCircle size={16} className="flex-shrink-0" />
          {alerta.msg}
        </div>
      )}
    </div>
  )
}
