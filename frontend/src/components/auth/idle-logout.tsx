'use client'

import { Modal } from '@/components/ui/modal'
import { clearSepAuth } from '@/lib/auth'
import { Clock, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

const IDLE_MINUTES = 20          // logout total tras inactividad
const WARN_BEFORE_MINUTES = 2    // mostrar aviso 2 min antes
const THROTTLE_MS = 1000         // resetear timer máximo 1 vez por segundo

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'
]

/**
 * Detecta inactividad del usuario y cierra la sesión automáticamente.
 * Mientras el usuario haga click, mueva el mouse, escriba o haga scroll
 * resetea el cronómetro. A los 18 min muestra un modal de aviso, a los
 * 20 min hace logout y redirige al login.
 *
 * Este componente es complementario al sliding-session JWT del backend.
 * El JWT caduca a los 30 min sin actividad real (defensa en profundidad).
 */
export function IdleLogout() {
  const router = useRouter()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(WARN_BEFORE_MINUTES * 60)

  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActivity = useRef<number>(Date.now())

  const doLogout = useCallback(() => {
    clearSepAuth()
    router.replace('/login?reason=idle')
  }, [router])

  const startWarningCountdown = useCallback(() => {
    setShowWarning(true)
    setSecondsLeft(WARN_BEFORE_MINUTES * 60)
    countdownTimer.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (countdownTimer.current) clearInterval(countdownTimer.current)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }, [])

  const resetTimers = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current)
    if (logoutTimer.current) clearTimeout(logoutTimer.current)
    if (countdownTimer.current) clearInterval(countdownTimer.current)
    setShowWarning(false)
    setSecondsLeft(WARN_BEFORE_MINUTES * 60)

    const warnAt = (IDLE_MINUTES - WARN_BEFORE_MINUTES) * 60 * 1000
    const logoutAt = IDLE_MINUTES * 60 * 1000

    warnTimer.current = setTimeout(startWarningCountdown, warnAt)
    logoutTimer.current = setTimeout(doLogout, logoutAt)
  }, [startWarningCountdown, doLogout])

  // Listener throttled de actividad
  useEffect(() => {
    const onActivity = () => {
      const now = Date.now()
      // Si el modal de aviso está abierto, NO resetear automáticamente
      // (evita que click accidental cancele el aviso). El user debe usar
      // el botón explícito.
      if (showWarning) return
      if (now - lastActivity.current < THROTTLE_MS) return
      lastActivity.current = now
      resetTimers()
    }
    ACTIVITY_EVENTS.forEach((ev) => document.addEventListener(ev, onActivity, { passive: true }))
    resetTimers()
    return () => {
      ACTIVITY_EVENTS.forEach((ev) => document.removeEventListener(ev, onActivity))
      if (warnTimer.current) clearTimeout(warnTimer.current)
      if (logoutTimer.current) clearTimeout(logoutTimer.current)
      if (countdownTimer.current) clearInterval(countdownTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWarning])

  function handleKeepSession() {
    lastActivity.current = Date.now()
    resetTimers()
  }

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`

  return (
    <Modal open={showWarning} onClose={() => { /* bloqueado: solo botones */ }} maxWidth="max-w-sm">
      <div className="p-6 flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
          <Clock size={28} className="text-amber-600" />
        </div>
        <h3 className="text-base font-bold text-neutral-800">Tu sesión va a expirar</h3>
        <p className="text-sm text-neutral-500">
          Por seguridad, tu sesión se cerrará por inactividad en
        </p>
        <div className="text-3xl font-extrabold text-amber-600 tabular-nums">{timeStr}</div>
        <p className="text-xs text-neutral-400">¿Sigues trabajando?</p>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full pt-2">
          <button
            onClick={doLogout}
            className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition-colors"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
          <button
            onClick={handleKeepSession}
            className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#39A900] hover:bg-[#2d8500] rounded-xl transition-colors"
          >
            Sigo aquí
          </button>
        </div>
      </div>
    </Modal>
  )
}
