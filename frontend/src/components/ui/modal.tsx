'use client'

import { useEffect, useState } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}

/**
 * Modal base con transición moderna:
 * - Backdrop: fade negro suave
 * - Card: slide-up + fade + scale al entrar; reverso al salir
 */
export function Modal({ open, onClose, children, maxWidth = 'max-w-md' }: ModalProps) {
  const [render, setRender] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setRender(true)
      // Doble rAF: garantiza que el DOM está listo antes de iniciar la transición
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      )
    } else {
      setVisible(false)
      const t = setTimeout(() => setRender(false), 260)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!render) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: visible ? 'rgba(0,0,0,0.52)' : 'rgba(0,0,0,0)',
        transition: 'background-color 260ms ease',
      }}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} overflow-hidden`}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.96)',
          transition: 'opacity 260ms ease, transform 260ms ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
