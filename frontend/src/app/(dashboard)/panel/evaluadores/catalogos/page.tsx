'use client'

import api from '@/lib/api'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { ArrowLeft, ChevronRight, Loader2, Plus, Power, PowerOff, Settings2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface CatItem { id: number; nombre: string; descripcion?: string | null; activo: number }

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

export default function CatalogosEvaluadoresPage() {
  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6 max-w-5xl">
      <div className="rounded-2xl px-6 py-4 flex items-center gap-3 text-white shadow-md" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #001f33 100%)` }}>
        <Settings2 size={22} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-white/70 text-xs flex-wrap">
            <Link href="/panel/evaluadores" className="hover:text-white">Banco de Evaluadores</Link>
            <ChevronRight size={12} />
            <span>Catálogos</span>
          </div>
          <h1 className="font-bold text-base sm:text-lg">Catálogos del banco</h1>
        </div>
      </div>

      <Link href="/panel/evaluadores" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D] w-fit">
        <ArrowLeft size={13} />
        Volver al banco
      </Link>

      <CatalogoBloque
        titulo="Roles del evaluador"
        descripcion="Roles que puede cumplir un evaluador en cada proceso (EVALUADOR, ANALISTA, COORDINADOR, ...)"
        endpoint="/evaluadores/catalogos/roles"
        soportaDescripcion
      />

      <CatalogoBloque
        titulo="Procesos de evaluación"
        descripcion="Procesos que evalúa el GGPC (FCE, FEEC, ...)"
        endpoint="/evaluadores/catalogos/procesos"
        soportaDescripcion
      />

      <CatalogoBloque
        titulo="Tipos de estudio"
        descripcion="HV, Pregrado, Posgrado, Diplomado, Certificado, Otro"
        endpoint="/evaluadores/catalogos/tipos-estudio"
      />
    </div>
  )
}

function CatalogoBloque({
  titulo, descripcion, endpoint, soportaDescripcion = false,
}: {
  titulo: string; descripcion: string; endpoint: string; soportaDescripcion?: boolean
}) {
  const [items, setItems] = useState<CatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState('')

  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoDesc, setNuevoDesc] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [accion, setAccion] = useState<number | null>(null)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => { cargar() /* eslint-disable-next-line */ }, [])

  async function cargar() {
    setLoading(true)
    setErrMsg('')
    try {
      const res = await api.get<CatItem[]>(endpoint, { params: { todos: 1 } })
      setItems(res.data ?? [])
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) setErrMsg('No tienes permisos para gestionar este catálogo.')
      else setErrMsg('No se pudo cargar el catálogo')
    } finally {
      setLoading(false)
    }
  }

  async function agregar() {
    if (!nuevoNombre.trim()) return
    setAgregando(true)
    try {
      await api.post(endpoint, {
        nombre: nuevoNombre.trim(),
        descripcion: soportaDescripcion ? (nuevoDesc.trim() || undefined) : undefined,
      })
      setNuevoNombre('')
      setNuevoDesc('')
      setToast({ tipo: 'success', msg: 'Agregado correctamente' })
      await cargar()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo agregar' })
    } finally {
      setAgregando(false)
    }
  }

  async function toggleEstado(it: CatItem) {
    setAccion(it.id)
    try {
      await api.put(`${endpoint}/${it.id}`, { activo: it.activo === 0 })
      setToast({ tipo: 'success', msg: it.activo === 0 ? 'Activado' : 'Desactivado' })
      await cargar()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo actualizar' })
    } finally {
      setAccion(null)
    }
  }

  return (
    <section className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
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

      <header className="px-5 py-4 border-b border-neutral-100">
        <p className="text-sm font-bold text-neutral-900">{titulo}</p>
        <p className="text-[11px] text-neutral-500 mt-0.5">{descripcion}</p>
      </header>

      {/* Formulario agregar */}
      <div className="px-5 py-4 bg-neutral-50/60 border-b border-neutral-100 flex flex-wrap gap-2 items-center">
        <input
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
          placeholder="Nombre..."
          className="flex-1 min-w-[160px] border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
        />
        {soportaDescripcion && (
          <input
            value={nuevoDesc}
            onChange={(e) => setNuevoDesc(e.target.value)}
            placeholder="Descripción (opcional)"
            className="flex-1 min-w-[200px] border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
          />
        )}
        <button
          onClick={agregar}
          disabled={!nuevoNombre.trim() || agregando}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90"
          style={{ backgroundColor: INSTITUTIONAL }}
        >
          {agregando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Agregar
        </button>
      </div>

      {errMsg && <p className="px-5 py-3 text-sm text-red-700 bg-red-50">{errMsg}</p>}

      {loading && (
        <div className="px-5 py-6 flex items-center gap-2 text-neutral-500 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Cargando...
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="px-5 py-6 text-sm text-neutral-400 text-center">Sin elementos en este catálogo</p>
      )}

      <ul>
        {items.map(it => {
          const procesando = accion === it.id
          return (
            <li key={it.id} className="px-5 py-3 border-b border-neutral-100 last:border-b-0 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${it.activo === 1 ? 'text-neutral-900' : 'text-neutral-400 line-through'}`}>
                  {it.nombre}
                </p>
                {it.descripcion && (
                  <p className="text-[11px] text-neutral-500 mt-0.5">{it.descripcion}</p>
                )}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                it.activo === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-500'
              }`}>
                {it.activo === 1 ? 'Activo' : 'Inactivo'}
              </span>
              <button
                onClick={() => toggleEstado(it)}
                disabled={procesando}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition disabled:opacity-50 ${
                  it.activo === 1
                    ? 'bg-neutral-100 hover:bg-red-100 text-neutral-700 hover:text-red-700'
                    : 'bg-[#39a900]/10 hover:bg-[#39a900]/20 text-[#39a900]'
                }`}
              >
                {procesando
                  ? <Loader2 size={12} className="animate-spin" />
                  : it.activo === 1 ? <PowerOff size={12} /> : <Power size={12} />}
                {it.activo === 1 ? 'Desactivar' : 'Activar'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
