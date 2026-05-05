'use client'

import api from '@/lib/api'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, RefreshCcw, Search, ShieldAlert, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface UsuarioItem {
  usuarioId: number
  email: string
  nombre: string
  estado: number
  perfiles: string[]
}
interface RespListado {
  items: UsuarioItem[]
  total: number
  page: number
  limit: number
}

function generarClave(): string {
  const letras  = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
  const numeros = '23456789'
  const simbolo = '!@#$&*'
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  return [
    pick(letras), pick(letras), pick(letras), pick(letras),
    pick(numeros), pick(numeros), pick(numeros),
    pick(letras), pick(letras), pick(simbolo),
  ].sort(() => Math.random() - 0.5).join('')
}

export default function CambiarClavePage() {
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<RespListado | null>(null)
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  const [seleccionado, setSeleccionado] = useState<UsuarioItem | null>(null)
  const [nueva, setNueva] = useState(generarClave())
  const [verClave, setVerClave] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => { cargar(busqueda, page) /* eslint-disable-next-line */ }, [page])

  async function cargar(q: string, p: number) {
    setLoading(true)
    setErrMsg('')
    try {
      const res = await api.get<RespListado>('/admin/usuarios', { params: { busqueda: q, page: p, limit: 20 } })
      setData(res.data)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) setErrMsg('Solo un administrador puede ver esta página.')
      else setErrMsg('Error cargando usuarios')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    cargar(busqueda, 1)
  }

  async function handleGuardar() {
    if (!seleccionado) return
    if (nueva.trim().length < 6) {
      setToast({ tipo: 'error', msg: 'La contraseña debe tener al menos 6 caracteres' })
      return
    }
    setGuardando(true)
    try {
      await api.put(`/admin/usuarios/${seleccionado.usuarioId}/clave`, { nuevaClave: nueva.trim() })
      setToast({ tipo: 'success', msg: `Contraseña actualizada para ${seleccionado.email}` })
      setSeleccionado(null)
      setNueva(generarClave())
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo cambiar la contraseña' })
    } finally {
      setGuardando(false)
    }
  }

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa
          show
          onClose={() => setToast(null)}
          tipo={toast.tipo}
          titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg}
          duration={4000}
        />
      )}

      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex items-center gap-3">
        <KeyRound size={22} className="text-white" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Administración</p>
          <h1 className="text-white font-bold text-base sm:text-lg">Cambiar contraseña de usuarios</h1>
        </div>
      </div>

      <Link href="/panel/admin/usuarios" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D] w-fit">
        <ArrowLeft size={13} />
        Volver a Gestión de perfiles de usuario
      </Link>

      <form onSubmit={handleBuscar} className="bg-white border border-neutral-200 rounded-xl p-3 flex items-center gap-2">
        <Search size={16} className="text-neutral-400 ml-1" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por correo, razón social, nombre..."
          className="flex-1 text-sm focus:outline-none bg-transparent"
        />
        <button type="submit" className="px-3 py-1.5 bg-[#00304D] hover:bg-[#001f33] text-white text-xs font-semibold rounded-lg transition">
          Buscar
        </button>
      </form>

      {errMsg && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <ShieldAlert size={16} />
          {errMsg}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-neutral-500 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Cargando...
        </div>
      )}

      {data && (
        <>
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-2.5 font-semibold">Usuario</th>
                  <th className="px-4 py-2.5 font-semibold">Perfiles</th>
                  <th className="px-4 py-2.5 font-semibold w-40"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-neutral-400 text-sm">Sin resultados</td></tr>
                )}
                {data.items.map(u => (
                  <tr key={u.usuarioId} className="border-b border-neutral-100 hover:bg-neutral-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-neutral-800">{u.nombre}</div>
                      <div className="text-xs text-neutral-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.perfiles.length === 0
                          ? <span className="text-xs text-neutral-400 italic">—</span>
                          : u.perfiles.map((p, i) => (
                            <span key={i} className="inline-flex items-center text-[11px] font-semibold text-[#00304D] bg-[#00304D]/10 px-2 py-0.5 rounded">{p}</span>
                          ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setSeleccionado(u); setNueva(generarClave()) }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#00304D] hover:bg-[#001f33] rounded-lg transition"
                      >
                        <KeyRound size={13} />
                        Cambiar contraseña
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Página {data.page} de {totalPaginas} · {data.total} usuarios</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border border-neutral-200 rounded-lg disabled:opacity-50 hover:bg-neutral-50 transition">Anterior</button>
                <button disabled={page >= totalPaginas} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border border-neutral-200 rounded-lg disabled:opacity-50 hover:bg-neutral-50 transition">Siguiente</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de cambio de clave */}
      {seleccionado && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => !guardando && setSeleccionado(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#00304D] px-5 py-4 flex items-center justify-between">
              <div className="min-w-0 flex items-center gap-3">
                <KeyRound size={18} className="text-white shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Nueva contraseña</p>
                  <h2 className="text-white font-bold text-sm truncate">{seleccionado.nombre}</h2>
                </div>
              </div>
              <button onClick={() => !guardando && setSeleccionado(null)} className="text-white/70 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div>
                <p className="text-xs text-neutral-500 mb-1">Cuenta</p>
                <p className="text-sm font-semibold text-neutral-800 truncate">{seleccionado.email}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Nueva contraseña</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={verClave ? 'text' : 'password'}
                      value={nueva}
                      onChange={(e) => setNueva(e.target.value)}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setVerClave(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                    >
                      {verClave ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNueva(generarClave())}
                    className="inline-flex items-center gap-1 px-3 py-2 border border-neutral-300 rounded-lg text-xs hover:bg-neutral-50 transition"
                    title="Generar contraseña"
                  >
                    <RefreshCcw size={13} />
                    Generar
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1.5">
                  Comparte la nueva contraseña con el usuario por un canal seguro. Podrá cambiarla luego desde su perfil.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  onClick={() => setSeleccionado(null)}
                  disabled={guardando}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 text-sm font-semibold rounded-lg hover:bg-neutral-50 disabled:opacity-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardar}
                  disabled={guardando || nueva.trim().length < 6}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#00304D] hover:bg-[#001f33] text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition"
                >
                  {guardando ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  Cambiar contraseña
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
