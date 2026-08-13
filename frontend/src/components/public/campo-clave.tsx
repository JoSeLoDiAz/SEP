'use client'

import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CampoClave({
  value,
  onChange,
  id,
  placeholder = 'Mínimo 8 caracteres',
  autoComplete = 'current-password',
  className,
  onKeyDown,
}: {
  value: string
  onChange: (v: string) => void
  id?: string
  placeholder?: string
  autoComplete?: string
  className?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  const [visible, setVisible] = useState(false)
  const propio = useId()
  const idCampo = id ?? propio

  return (
    <div className="relative">
      <input
        id={idCampo}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn(
          'w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-3 pr-11 text-sm transition',
          'focus:border-cerulean-500 focus:outline-none focus:ring-2 focus:ring-cerulean-500/30',
          className,
        )}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        // tabIndex -1: al tabular desde la clave se espera ir al boton de enviar, no aqui
        tabIndex={-1}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-cerulean-500"
      >
        {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </div>
  )
}
