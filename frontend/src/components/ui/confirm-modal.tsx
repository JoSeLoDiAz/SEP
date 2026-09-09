'use client'

import { Modal } from '@/components/ui/modal'
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

type ConfirmTipo = 'delete' | 'warning' | 'info' | 'success'

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  /** Tipo del confirm — define color e ícono. */
  tipo?: ConfirmTipo
  titulo: string
  /** Mensaje principal. Puede ser string o ReactNode (para resaltar partes). */
  mensaje: ReactNode
  /** Texto del botón de confirmar. Default: "Aceptar". */
  textoConfirmar?: string
  /** Texto del botón de cancelar. Default: "Cancelar". */
  textoCancelar?: string
  /** Bloquea cerrar mientras se procesa la acción. */
  cargando?: boolean
}

/** Modal de confirmación reutilizable que reemplaza `window.confirm()`.
 *  Mantiene la UX moderna del sistema y deja `confirm()` nativo fuera. */
export function ConfirmModal({
  open, onClose, onConfirm,
  tipo = 'warning',
  titulo, mensaje,
  textoConfirmar = 'Aceptar',
  textoCancelar = 'Cancelar',
  cargando = false,
}: ConfirmModalProps) {
  const cfg = {
    delete: {
      Icon: Trash2,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50',
      iconBorder: 'border-red-100',
      btn: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      Icon: AlertTriangle,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      iconBorder: 'border-amber-100',
      btn: 'bg-amber-500 hover:bg-amber-600',
    },
    info: {
      Icon: AlertTriangle,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
      iconBorder: 'border-blue-100',
      btn: 'bg-[#00304D] hover:bg-[#004a76]',
    },
    success: {
      Icon: CheckCircle2,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      iconBorder: 'border-emerald-100',
      btn: 'bg-emerald-600 hover:bg-emerald-700',
    },
  }[tipo]
  const Icon = cfg.Icon

  return (
    <Modal open={open} onClose={() => !cargando && onClose()} maxWidth="max-w-md">
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-xl ${cfg.iconBg} ${cfg.iconColor} border ${cfg.iconBorder} flex items-center justify-center shrink-0`}>
            <Icon size={20} strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-neutral-800">{titulo}</h3>
            <div className="text-sm text-neutral-600 mt-1 leading-relaxed">{mensaje}</div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={cargando}
            className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition disabled:opacity-50"
          >
            {textoCancelar}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={cargando}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition disabled:opacity-50 ${cfg.btn}`}
          >
            {cargando && <Loader2 size={14} className="animate-spin" />}
            {textoConfirmar}
          </button>
        </div>
      </div>
    </Modal>
  )
}
