'use client'

import api from '@/lib/api'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { ArrowLeft, ChevronRight, Loader2, Plus, Power, PowerOff, Star, UserCog, X } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Asignado {
  usuarioPerfilId: number
  perfilId: number
  perfilNombre: string
  predeterminado: number
  estado: number
  fechaUltimoAcceso: string | null
  fechaCreacion: string
}
interface Disponible { perfilId: number; perfilNombre: string }
interface RespDetalle {
  usuario: { usuarioId: number; email: string; estado: number }
  asignados: Asignado[]
  disponibles: Disponible[]
}

export default function GestionPerfilesPage() {
  const params = useParams<{ id: string }>()
  const usuarioId = Number(params.id)

  const [data, setData] = useState<RespDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [perfilNuevo, setPerfilNuevo] = useState<number | ''>('')
  const [accion, setAccion] = useState<number | null>(null)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [confirmDesactivar, setConfirmDesactivar] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => { cargar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function cargar() {
    setLoading(true)
    setErrMsg('')
    try {
      const res = await api.get<RespDetalle>(`/admin/usuarios/${usuarioId}/perfiles`)
      setData(res.data)
    } catch (err: unknown) {
      setErrMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error cargando perfiles')
    } finally {
      setLoading(false)
    }
  }

  async function handleAgregar() {
    if (!perfilNuevo) return
    setAgregando(true)
    try {
      await api.post(`/admin/usuarios/${usuarioId}/perfiles`, { perfilId: perfilNuevo })
      setPerfilNuevo('')
      setToast({ tipo: 'success', msg: 'Perfil asignado' })
      await cargar()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo asignar' })
    } finally {
      setAgregando(false)
    }
  }

  function handleClickEstado() {
    if (!data) return
    if (data.usuario.estado === 1) setConfirmDesactivar(true)
    else cambiarEstado(true)
  }

  async function cambiarEstado(activar: boolean) {
    setCambiandoEstado(true)
    try {
      await api.put(`/admin/usuarios/${usuarioId}/estado`, { estado: activar })
      setToast({ tipo: 'success', msg: activar ? 'Usuario activado' : 'Usuario desactivado' })
      setConfirmDesactivar(false)
      await cargar()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo cambiar el estado' })
    } finally {
      setCambiandoEstado(false)
    }
  }

  async function handleActualizar(usuarioPerfilId: number, cambios: { predeterminado?: boolean; estado?: boolean }) {
    setAccion(usuarioPerfilId)
    try {
      await api.put(`/admin/usuarios/${usuarioId}/perfiles/${usuarioPerfilId}`, cambios)
      setToast({ tipo: 'success', msg: 'Asignación actualizada' })
      await cargar()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo actualizar' })
    } finally {
      setAccion(null)
    }
  }

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa
          show
          onClose={() => setToast(null)}
          tipo={toast.tipo}
          titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg}
          duration={3500}
        />
      )}

      {/* Encabezado */}
      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex items-center gap-3">
        <UserCog size={22} className="text-white" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-white/60 text-xs flex-wrap">
            <Link href="/panel/admin/usuarios" className="hover:text-white">Usuarios</Link>
            <ChevronRight size={12} />
            <span>Perfiles</span>
          </div>
          <h1 className="text-white font-bold text-sm">
            {data?.usuario.email ?? `Usuario #${usuarioId}`}
          </h1>
        </div>
      </div>

      <Link href="/panel/admin/usuarios" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D] w-fit">
        <ArrowLeft size={13} />
        Volver al listado
      </Link>

      {loading && (
        <div className="flex items-center gap-2 text-neutral-500 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Cargando...
        </div>
      )}

      {errMsg && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{errMsg}</div>
      )}

      {data && (
        <>
          {/* Estado del usuario */}
          <div className={`border rounded-xl p-4 flex items-center gap-3 ${
            data.usuario.estado === 1
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-neutral-100 border-neutral-300'
          }`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 ${
              data.usuario.estado === 1 ? 'bg-emerald-600' : 'bg-neutral-500'
            }`}>
              {data.usuario.estado === 1 ? <Power size={18} /> : <PowerOff size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Estado del usuario</p>
              <p className={`text-sm font-bold ${data.usuario.estado === 1 ? 'text-emerald-700' : 'text-neutral-600'}`}>
                {data.usuario.estado === 1 ? 'Activo — puede iniciar sesión' : 'Inactivo — no puede iniciar sesión'}
              </p>
            </div>
            <button
              onClick={handleClickEstado}
              disabled={cambiandoEstado}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition disabled:opacity-50 ${
                data.usuario.estado === 1
                  ? 'bg-neutral-200 hover:bg-red-100 text-neutral-700 hover:text-red-700'
                  : 'bg-[#00304D] hover:bg-[#001f33] text-white'
              }`}
            >
              {cambiandoEstado
                ? <Loader2 size={13} className="animate-spin" />
                : data.usuario.estado === 1 ? <PowerOff size={13} /> : <Power size={13} />}
              {data.usuario.estado === 1 ? 'Desactivar' : 'Activar'}
            </button>
          </div>

          {/* Asignar nuevo perfil */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-2">Asignar perfil</p>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={perfilNuevo}
                onChange={(e) => setPerfilNuevo(e.target.value ? Number(e.target.value) : '')}
                disabled={data.disponibles.length === 0 || agregando}
                className="border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D] disabled:bg-neutral-50"
              >
                <option value="">— Seleccionar perfil —</option>
                {data.disponibles.map(d => (
                  <option key={d.perfilId} value={d.perfilId}>{d.perfilNombre}</option>
                ))}
              </select>
              <button
                onClick={handleAgregar}
                disabled={!perfilNuevo || agregando}
                className="inline-flex items-center gap-1.5 bg-[#00304D] hover:bg-[#001f33] text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50 transition"
              >
                {agregando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Asignar
              </button>
              {data.disponibles.length === 0 && (
                <span className="text-xs text-neutral-400">No hay perfiles disponibles para asignar</span>
              )}
            </div>
          </div>

          {/* Perfiles asignados */}
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Perfiles asignados</p>
              <p className="text-[11px] text-neutral-400">
                {data.asignados.filter(a => a.estado === 1).length} activos · {data.asignados.length} totales
              </p>
            </div>
            {data.asignados.length === 0 && (
              <div className="px-4 py-6 text-center text-neutral-400 text-sm">Aún no tiene perfiles asignados</div>
            )}
            <ul>
              {data.asignados.map(a => {
                const procesando = accion === a.usuarioPerfilId
                return (
                  <li key={a.usuarioPerfilId} className="px-4 py-3 border-b border-neutral-100 last:border-b-0 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${a.estado === 1 ? 'text-neutral-900' : 'text-neutral-400 line-through'}`}>
                          {a.perfilNombre}
                        </span>
                        {a.predeterminado === 1 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            <Star size={10} fill="currentColor" />
                            Predeterminado
                          </span>
                        )}
                        {a.estado === 0 && (
                          <span className="inline-block text-[10px] font-bold text-neutral-500 bg-neutral-200 px-1.5 py-0.5 rounded">
                            Revocado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {a.fechaUltimoAcceso
                          ? `Último ingreso: ${new Date(a.fechaUltimoAcceso).toLocaleString('es-CO')}`
                          : 'Sin ingresos registrados'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {a.estado === 1 && (
                        <button
                          onClick={() => handleActualizar(a.usuarioPerfilId, { predeterminado: a.predeterminado !== 1 })}
                          disabled={procesando}
                          title={a.predeterminado === 1 ? 'Quitar como predeterminado' : 'Marcar como predeterminado'}
                          className="p-2 rounded-lg text-neutral-500 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-50 transition"
                        >
                          <Star size={14} fill={a.predeterminado === 1 ? 'currentColor' : 'none'} />
                        </button>
                      )}
                      {a.estado === 1 ? (
                        <button
                          onClick={() => handleActualizar(a.usuarioPerfilId, { estado: false })}
                          disabled={procesando}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-red-100 text-neutral-700 hover:text-red-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                        >
                          {procesando ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                          Revocar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActualizar(a.usuarioPerfilId, { estado: true })}
                          disabled={procesando}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#00304D] hover:bg-[#001f33] text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                        >
                          {procesando ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                          Reactivar
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}

      <ConfirmModal
        open={confirmDesactivar}
        onClose={() => setConfirmDesactivar(false)}
        onConfirm={() => cambiarEstado(false)}
        tipo="warning"
        titulo="Desactivar usuario"
        mensaje={
          <>
            ¿Seguro que deseas <strong>desactivar</strong> a <strong>{data?.usuario.email}</strong>? No podrá iniciar sesión hasta que se reactive.
          </>
        }
        textoConfirmar="Desactivar"
        cargando={cambiandoEstado}
      />
    </div>
  )
}
