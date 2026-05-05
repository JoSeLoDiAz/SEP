'use client'

import api from '@/lib/api'
import { clearSepAuth, type SepUsuario } from '@/lib/auth'
import { useTieneConvenios } from '@/lib/use-tiene-convenios'
import { Check, ChevronDown, Loader2, LogOut, Menu, UserCog } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface PerfilOpcion {
  usuarioPerfilId: number
  perfilId: number
  perfilNombre: string
  predeterminado: boolean
  fechaUltimoAcceso?: string | null
}

interface PanelTopbarProps {
  usuario: SepUsuario | null
  onMenuOpen: () => void
}

export function PanelTopbar({ usuario, onMenuOpen }: PanelTopbarProps) {
  const router = useRouter()
  const { tieneConvenios } = useTieneConvenios()

  const [perfiles, setPerfiles] = useState<PerfilOpcion[]>([])
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelado = false
    api.get<PerfilOpcion[]>('/auth/mis-perfiles')
      .then(r => { if (!cancelado) setPerfiles(r.data ?? []) })
      .catch(() => { /* silencio: si falla, simplemente no se muestra el selector */ })
    return () => { cancelado = true }
  }, [])

  useEffect(() => {
    if (!menuAbierto) return
    function onClickOut(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false)
    }
    document.addEventListener('mousedown', onClickOut)
    return () => document.removeEventListener('mousedown', onClickOut)
  }, [menuAbierto])

  function handleLogout() {
    clearSepAuth()
    router.push('/login')
  }

  async function handleCambiar(perfilId: number) {
    if (!usuario || perfilId === usuario.perfilId || cambiando) return
    setCambiando(true)
    try {
      const res = await api.post<{
        accessToken: string
        usuario: { email: string; nombre: string; perfilId: number; usuarioPerfilId?: number }
      }>('/auth/cambiar-perfil', { perfilId })
      localStorage.setItem('sep_token', res.data.accessToken)
      localStorage.setItem('sep_usuario', JSON.stringify({
        email: res.data.usuario.email,
        nombre: res.data.usuario.nombre,
        perfilId: res.data.usuario.perfilId,
        usuarioPerfilId: res.data.usuario.usuarioPerfilId,
      }))
      setMenuAbierto(false)
      // Recarga completa para refrescar menú lateral, permisos, layout, etc.
      window.location.assign('/panel')
    } catch {
      setCambiando(false)
    }
  }

  const perfilActual = perfiles.find(p => p.perfilId === usuario?.perfilId)
  const tieneVarios = perfiles.length > 1

  return (
    <header className="sticky top-0 z-30 flex items-center h-14 px-4 bg-white border-b border-neutral-200 gap-3 lg:px-6">
      <button
        onClick={onMenuOpen}
        className="lg:hidden p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2 lg:hidden">
        <Image src="/images/sena-logo.svg" alt="SENA" width={28} height={28} />
        <span className="font-bold text-sm text-[#00304D]">SEP</span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex flex-col items-end leading-tight">
          <span className="text-sm font-semibold text-neutral-800 max-w-[180px] truncate">
            {usuario?.nombre ?? usuario?.email ?? '—'}
          </span>
          <span className="text-[10px] text-neutral-400">
            {usuario?.perfilId === 7
              ? (tieneConvenios ? 'Conviniente' : 'Proponente')
              : perfilActual?.perfilNombre ?? 'Usuario interno'}
          </span>
        </div>
        <div className="w-8 h-8 rounded-lg bg-[#00304D] flex items-center justify-center text-white text-xs font-bold">
          {(usuario?.nombre?.[0] ?? 'U').toUpperCase()}
        </div>

        {tieneVarios && (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuAbierto(v => !v)}
              title="Cambiar perfil"
              className="flex items-center gap-1 p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-[#00304D] transition-colors"
            >
              <UserCog size={17} />
              <ChevronDown size={13} />
            </button>
            {menuAbierto && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden z-40">
                <div className="px-3 py-2 border-b border-neutral-100">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Cambiar perfil</p>
                </div>
                <ul className="max-h-72 overflow-y-auto">
                  {perfiles.map(p => {
                    const activo = p.perfilId === usuario?.perfilId
                    return (
                      <li key={p.perfilId}>
                        <button
                          onClick={() => handleCambiar(p.perfilId)}
                          disabled={activo || cambiando}
                          className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 transition ${
                            activo ? 'bg-[#00304D]/5 cursor-default' : 'hover:bg-neutral-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold truncate ${activo ? 'text-[#00304D]' : 'text-neutral-800'}`}>
                              {p.perfilNombre}
                            </p>
                            {p.predeterminado && (
                              <p className="text-[10px] text-amber-600 font-semibold">Predeterminado</p>
                            )}
                          </div>
                          {activo
                            ? <Check size={14} className="text-[#00304D] shrink-0" />
                            : cambiando
                              ? <Loader2 size={13} className="animate-spin text-neutral-400 shrink-0" />
                              : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="p-2 rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  )
}
