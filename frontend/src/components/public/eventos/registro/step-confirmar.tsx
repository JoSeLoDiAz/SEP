import { ClipboardCheck, AlertCircle, Loader2 } from 'lucide-react'
import type { RegistroState } from '@/types'

interface Props {
  state: RegistroState
  loading: boolean
  alerta: { msg: string; tipo: 'error' | 'info' | 'success' } | null
  conferencias: { id: string; nombre: string }[]
  onChange: (field: keyof RegistroState, value: string | number | boolean | null) => void
  onConfirmar: () => void
}

export function StepConfirmar({ state, loading, alerta, conferencias, onChange, onConfirmar }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Resumen */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 flex flex-col gap-3">
        <h3 className="font-semibold text-neutral-700 text-sm">Resumen de inscripción</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-neutral-500">Beneficiario:</span>
          <span className="font-mono font-semibold">{state.maskedNombreCompleto || '—'}</span>
          <span className="text-neutral-500">Documento:</span>
          <span>{state.tipoIdentificacion} {state.identificacion}</span>
        </div>
      </div>

      {/* Tipo de evento (condicional) */}
      {state.validarConferencia && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-green-600">
            ⚠ Nota: Favor seleccionar el tipo de evento al cual desea participar.
          </p>
          <div className="flex flex-col gap-1.5 max-w-sm">
            <label className="text-sm font-semibold text-neutral-700">
              Tipo de evento<span className="text-red-500 ml-0.5">*</span>
            </label>
            <select
              className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              value={state.conferenciaId}
              onChange={(e) => onChange('conferenciaId', e.target.value)}
            >
              <option value="">— Seleccione —</option>
              {conferencias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {alerta && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium
          ${alerta.tipo === 'error'
            ? 'bg-red-50 text-red-600 border border-red-200'
            : alerta.tipo === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-cerulean-50 text-cerulean-500 border border-cerulean-200'
          }`}>
          <AlertCircle size={16} className="flex-shrink-0" />
          {alerta.msg}
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={onConfirmar}
          disabled={loading}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-bold px-8 py-3 rounded-lg transition-colors shadow-sm text-base"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <ClipboardCheck size={18} />}
          Confirmar Inscripción
        </button>
      </div>
    </div>
  )
}
