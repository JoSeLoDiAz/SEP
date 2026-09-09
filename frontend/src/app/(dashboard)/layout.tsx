'use client'

import { AppSidebar } from '@/components/layout/app-sidebar'
import { PanelTopbar } from '@/components/layout/panel-topbar'
import { IdleLogout } from '@/components/auth/idle-logout'
import { getSepToken, getSepUsuario, type SepUsuario } from '@/lib/auth'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

// ── Preloader de pantalla completa ───────────────────────────────────────────

function PanelPreloader() {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    let val = 0
    const iv = setInterval(() => {
      val += Math.random() * 18 + 6
      if (val >= 100) { val = 100; clearInterval(iv) }
      setPct(Math.round(val))
    }, 80)
    return () => clearInterval(iv)
  }, [])

  const r = 54
  const circ = 2 * Math.PI * r          // ≈ 339.3
  const dash = (pct / 100) * circ

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white gap-5">
      {/* Círculo de progreso con logo SENA girando */}
      <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
        {/* Track */}
        <svg width={140} height={140} className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={70} cy={70} r={r} fill="none" stroke="#e5e7eb" strokeWidth={10} />
          <circle
            cx={70} cy={70} r={r} fill="none"
            stroke="#39A900" strokeWidth={10} strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 0.1s linear' }}
          />
        </svg>
        {/* Logo girando */}
        <Image
          src="/images/sena-logo.svg"
          alt="SENA"
          width={60}
          height={60}
          className="z-10"
          style={{ animation: 'sep-spin 1s linear infinite' }}
        />
      </div>

      {/* Porcentaje */}
      <p className="text-3xl font-bold text-[#00304D]">{pct}%</p>

      {/* Textos */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-semibold text-neutral-700">
          Sistema Especializado de Proyectos
        </p>
        <p className="text-xs text-neutral-400">Cargando tu espacio de trabajo…</p>
      </div>

      <style>{`
        @keyframes sep-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ── Layout principal ─────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [usuario, setUsuario] = useState<SepUsuario | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const minDelayDone = useRef(false)
  const authDone = useRef(false)

  function tryShow() {
    if (minDelayDone.current && authDone.current) setReady(true)
  }

  useEffect(() => {
    // Mínimo 1 segundo de preloader
    const t = setTimeout(() => { minDelayDone.current = true; tryShow() }, 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const token = getSepToken()
    if (!token) {
      router.replace('/login')
      return
    }
    setUsuario(getSepUsuario())
    authDone.current = true
    tryShow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  if (!ready) return <PanelPreloader />

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <AppSidebar
        usuario={usuario}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <PanelTopbar
          usuario={usuario}
          onMenuOpen={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <IdleLogout />
    </div>
  )
}
