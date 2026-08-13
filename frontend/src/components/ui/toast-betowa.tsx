'use client'

import { useEffect, useRef, useState } from 'react'

export type ToastTipo = 'success' | 'warning' | 'error'

export interface ToastBetowaPros {
  show: boolean
  onClose: () => void
  duration?: number
  tipo?: ToastTipo
  titulo?: string
  mensaje?: string
}

const BETOWA = 'linear-gradient(135deg,#00304d 0%,#6c29b3 100%)'

const V = {
  success: {
    bg: '#eefaf0',
    iconBg: BETOWA,
    iconShadow: '0 12px 26px rgba(108,41,179,.20)',
    titleColor: '#0f5132',
    textColor: 'rgba(15,81,50,.78)',
    progressBg: BETOWA,
    symbol: '✓',
  },
  warning: {
    bg: '#fff7e6',
    iconBg: 'linear-gradient(135deg,#f59e0b,#f97316)',
    iconShadow: '0 12px 26px rgba(0,0,0,.18)',
    titleColor: '#7a4a00',
    textColor: 'rgba(122,74,0,.82)',
    progressBg: 'linear-gradient(135deg,#f59e0b,#f97316)',
    symbol: '!',
  },
  error: {
    bg: '#fdecec',
    iconBg: 'linear-gradient(135deg,#b00020,#e11d48)',
    iconShadow: '0 12px 26px rgba(0,0,0,.18)',
    titleColor: '#7f1d1d',
    textColor: 'rgba(127,29,29,.82)',
    progressBg: 'linear-gradient(135deg,#b00020,#e11d48)',
    symbol: '×',
  },
} as const

export function ToastBetowa({
  show,
  onClose,
  duration = 4200,
  tipo = 'success',
  titulo = 'Éxito',
  mensaje = '',
}: ToastBetowaPros) {
  const [progress, setProgress] = useState(100)
  const [mounted, setMounted] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)

  function clear() {
    if (timer.current) clearTimeout(timer.current)
    if (tick.current) clearInterval(tick.current)
  }

  function close() {
    clear()
    setProgress(0)
    onClose()
  }

  useEffect(() => {
    if (!show) {
      setMounted(false)
      return
    }
    setMounted(true)
    setProgress(100)
    clear()

    const start = Date.now()
    tick.current = setInterval(() => {
      const elapsed = Date.now() - start
      setProgress(Math.max(0, 100 - Math.round((elapsed / duration) * 100)))
    }, 60)
    timer.current = setTimeout(close, duration)

    return clear
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  if (!mounted && !show) return null

  const v = V[tipo] ?? V.success

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 18,
        right: 18,
        width: 'min(520px, calc(100vw - 36px))',
        border: '1px solid rgba(0,0,0,.08)',
        borderRadius: 18,
        padding: '16px 16px 12px',
        boxShadow: '0 22px 70px rgba(0,0,0,.18)',
        display: 'grid',
        gridTemplateColumns: '40px 1fr 34px',
        gap: 12,
        zIndex: 20000,
        overflow: 'hidden',
        background: v.bg,
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(-10px)',
        transition: 'opacity .18s ease, transform .18s ease',
      }}
    >
      {/* Ícono */}
      <div style={{
        width: 40, height: 40, borderRadius: 999,
        display: 'grid', placeItems: 'center',
        fontWeight: 950, color: '#fff', fontSize: 18,
        background: v.iconBg,
        boxShadow: v.iconShadow,
      }}>
        {v.symbol}
      </div>

      {/* Contenido */}
      <div>
        <div style={{ fontWeight: 900, fontSize: '1.05rem', lineHeight: 1.1, color: v.titleColor }}>
          {titulo}
        </div>
        {mensaje && (
          <div style={{ marginTop: 4, fontSize: '.92rem', lineHeight: 1.25, color: v.textColor }}>
            {mensaje}
          </div>
        )}
      </div>

      {/* Cerrar */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={close}
        style={{
          border: 'none', background: 'transparent',
          fontSize: 30, lineHeight: 1, color: 'rgba(0,0,0,.45)',
          cursor: 'pointer', padding: 0, marginTop: -2,
        }}
      >
        ×
      </button>

      {/* Barra de progreso */}
      <div style={{
        gridColumn: '1 / -1', height: 6, borderRadius: 999,
        background: 'rgba(0,0,0,.10)', overflow: 'hidden', marginTop: 10,
      }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          transition: 'width .08s linear',
          background: v.progressBg,
        }} />
      </div>
    </div>
  )
}
