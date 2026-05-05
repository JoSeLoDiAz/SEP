'use client'

import api from '@/lib/api'
import { ArrowLeft, Loader2, Search, Settings2, ShieldAlert, UserCog } from 'lucide-react'
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

export default function AdminUsuariosPage() {
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<RespListado | null>(null)
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    cargar(busqueda, page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  async function cargar(q: string, p: number) {
    setLoading(true)
    setErrMsg('')
    try {
      const res = await api.get<RespListado>('/admin/usuarios', {
        params: { busqueda: q, page: p, limit: 20 },
      })
      setData(res.data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string }; status?: number } })?.response?.data?.message
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) setErrMsg('Solo un administrador puede ver esta página.')
      else setErrMsg(msg ?? 'Error cargando usuarios')
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

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {/* Encabezado */}
      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex items-center gap-3">
        <UserCog size={22} className="text-white" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Administración</p>
          <h1 className="text-white font-bold text-base sm:text-lg">Gestión de perfiles de usuario</h1>
        </div>
      </div>

      <Link href="/panel" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D] w-fit">
        <ArrowLeft size={13} />
        Volver al panel de administración
      </Link>

      {/* Buscador */}
      <form onSubmit={handleBuscar} className="bg-white border border-neutral-200 rounded-xl p-3 flex items-center gap-2">
        <Search size={16} className="text-neutral-400 ml-1" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por correo, razón social, nombre..."
          className="flex-1 text-sm focus:outline-none bg-transparent"
        />
        <button
          type="submit"
          className="px-3 py-1.5 bg-[#00304D] hover:bg-[#001f33] text-white text-xs font-semibold rounded-lg transition"
        >
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
                  <th className="px-4 py-2.5 font-semibold">Perfiles activos</th>
                  <th className="px-4 py-2.5 font-semibold">Estado</th>
                  <th className="px-4 py-2.5 font-semibold w-24"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-neutral-400 text-sm">Sin resultados</td></tr>
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
                          ? <span className="text-xs text-neutral-400 italic">Sin perfiles</span>
                          : u.perfiles.map((p, i) => (
                            <span key={i} className="inline-flex items-center text-[11px] font-semibold text-[#00304D] bg-[#00304D]/10 px-2 py-0.5 rounded">
                              {p}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-[11px] rounded font-semibold ${
                        u.estado === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        {u.estado === 1 ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/panel/admin/usuarios/${u.usuarioId}/perfiles`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00304D] hover:bg-[#00304D] hover:text-white px-3 py-1.5 rounded-lg transition"
                      >
                        <Settings2 size={13} />
                        Gestionar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">
                Página {data.page} de {totalPaginas} · {data.total} usuarios
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 border border-neutral-200 rounded-lg disabled:opacity-50 hover:bg-neutral-50 transition"
                >Anterior</button>
                <button
                  disabled={page >= totalPaginas}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 border border-neutral-200 rounded-lg disabled:opacity-50 hover:bg-neutral-50 transition"
                >Siguiente</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
