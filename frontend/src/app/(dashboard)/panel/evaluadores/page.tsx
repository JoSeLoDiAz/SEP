'use client'

import api from '@/lib/api'
import { useFotoEvaluador } from '@/lib/use-foto-evaluador'
import { ArrowLeft, GraduationCap, ImageOff, Loader2, Plus, Search, Settings2, ShieldAlert, ShieldCheck, UserPlus, Users } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface EvaluadorItem {
  evaluadorId: number
  personaId: number
  identificacion: string
  nombres: string
  primerApellido: string
  segundoApellido: string | null
  email: string
  cargo: string | null
  profesion: string | null
  tieneFoto: boolean
}

interface RespListado {
  items: EvaluadorItem[]
  total: number
  page: number
  limit: number
}

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

export default function EvaluadoresDashboardPage() {
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<RespListado | null>(null)
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => { cargar(busqueda, page) /* eslint-disable-next-line */ }, [page])

  async function cargar(q: string, p: number) {
    setLoading(true)
    setErrMsg('')
    try {
      const res = await api.get<RespListado>('/evaluadores', { params: { busqueda: q, page: p, limit: 24 } })
      setData(res.data)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      if (status === 403) setErrMsg('No tienes permisos para acceder al banco de evaluadores.')
      else setErrMsg(msg ?? 'Error cargando el banco de evaluadores')
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
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl shadow-lg" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #001f33 70%, #000a14 100%)` }}>
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-96 h-40 rounded-full" style={{ backgroundColor: `${INSTITUTIONAL}15`, filter: 'blur(60px)' }} />
        <div className="relative px-6 sm:px-10 py-8 sm:py-10 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 ring-1 ring-white/20">
            <ShieldCheck size={32} className="text-white" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Administración GGPC</p>
            <h1 className="text-white font-bold text-2xl sm:text-3xl mt-1 leading-tight">Banco de Evaluadores</h1>
            <p className="text-white/80 text-sm mt-2 max-w-2xl">
              Hoja de vida, experiencia, formación TIC y participación en procesos de evaluación. Registra y consulta el banco que apoya las convocatorias del SENA.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Link
              href="/panel/evaluadores/nuevo"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white hover:opacity-95 font-bold text-sm rounded-xl shadow-md transition"
              style={{ backgroundColor: INSTITUTIONAL }}
            >
              <UserPlus size={15} />
              Nuevo evaluador
            </Link>
            <Link
              href="/panel/evaluadores/catalogos"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-sm rounded-xl backdrop-blur-sm transition"
            >
              <Settings2 size={15} />
              Catálogos
            </Link>
          </div>
        </div>
      </div>

      <Link href="/panel" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D] w-fit">
        <ArrowLeft size={13} />
        Volver al panel de administración
      </Link>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Total registrados"
          value={data ? data.total.toString() : '—'}
          color={PRIMARY}
          loading={loading && !data}
        />
        <StatCard
          icon={ShieldCheck}
          label="Visibles"
          value={data ? data.items.length.toString() : '—'}
          subtitle="en esta página"
          color={INSTITUTIONAL}
          loading={loading && !data}
        />
        <StatCard
          icon={GraduationCap}
          label="Con perfil completo"
          value={data ? data.items.filter(e => e.tieneFoto && e.profesion && e.cargo).length.toString() : '—'}
          subtitle="foto + cargo + profesión"
          color="#0891B2"
          loading={loading && !data}
        />
        <StatCard
          icon={ImageOff}
          label="Sin foto"
          value={data ? data.items.filter(e => !e.tieneFoto).length.toString() : '—'}
          subtitle="en esta página"
          color="#C2410C"
          loading={loading && !data}
        />
      </div>

      {/* Buscador */}
      <form onSubmit={handleBuscar} className="bg-white border border-neutral-200 rounded-2xl p-3 flex items-center gap-2 shadow-sm">
        <Search size={16} className="text-neutral-400 ml-1" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, correo o identificación..."
          className="flex-1 text-sm focus:outline-none bg-transparent"
        />
        <button
          type="submit"
          className="px-4 py-1.5 text-white text-xs font-semibold rounded-lg transition hover:opacity-90"
          style={{ backgroundColor: PRIMARY }}
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

      {loading && !data && (
        <div className="flex items-center gap-2 text-neutral-500 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Cargando...
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="bg-white border border-dashed border-neutral-300 rounded-2xl py-16 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center">
            <Users size={26} className="text-neutral-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-700">Sin evaluadores registrados</p>
            <p className="text-xs text-neutral-500 mt-1">Empieza registrando un evaluador para alimentar el banco.</p>
          </div>
          <Link
            href="/panel/evaluadores/nuevo"
            className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl shadow-sm transition hover:opacity-90"
            style={{ backgroundColor: INSTITUTIONAL }}
          >
            <Plus size={14} />
            Registrar primer evaluador
          </Link>
        </div>
      )}

      {/* Grid de cards */}
      {data && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.items.map(e => <EvaluadorCard key={e.evaluadorId} item={e} />)}
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">
                Página {data.page} de {totalPaginas} · {data.total} evaluadores
              </span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border border-neutral-200 rounded-lg disabled:opacity-50 hover:bg-neutral-50 transition">Anterior</button>
                <button disabled={page >= totalPaginas} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border border-neutral-200 rounded-lg disabled:opacity-50 hover:bg-neutral-50 transition">Siguiente</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Componentes ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, subtitle, color, loading,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string; value: string; subtitle?: string; color: string; loading?: boolean
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: color }}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
        <p className="text-2xl font-bold text-neutral-900 leading-tight mt-0.5">
          {loading ? <Loader2 size={20} className="inline animate-spin text-neutral-300" /> : value}
        </p>
        {subtitle && <p className="text-[11px] text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function EvaluadorCard({ item }: { item: EvaluadorItem }) {
  const fullName = [item.nombres, item.primerApellido, item.segundoApellido].filter(Boolean).join(' ').trim()
  const inicial = (item.nombres?.[0] ?? '?').toUpperCase()
  const fotoSrc = useFotoEvaluador(item.evaluadorId, item.tieneFoto)

  return (
    <Link
      href={`/panel/evaluadores/${item.evaluadorId}`}
      className="group bg-white border border-neutral-200 hover:border-[#00304D]/40 hover:shadow-lg rounded-2xl overflow-hidden flex flex-col transition"
    >
      <div className="relative h-40 bg-gradient-to-br from-[#00304D]/5 via-white to-[#39a900]/5 flex items-center justify-center overflow-hidden">
        {fotoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fotoSrc}
            alt={fullName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-md" style={{ backgroundColor: PRIMARY }}>
            {inicial}
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-1.5">
        <p className="text-sm font-bold text-neutral-900 leading-tight line-clamp-1">{fullName || item.email}</p>
        <p className="text-[11px] text-neutral-500 font-mono">CC {item.identificacion}</p>
        {item.cargo && (
          <p className="text-xs text-neutral-700 line-clamp-1 mt-1">
            <span className="font-semibold">{item.cargo}</span>
          </p>
        )}
        {item.profesion && (
          <p className="text-[11px] text-neutral-500 line-clamp-1">{item.profesion}</p>
        )}
        <p className="text-[11px] text-neutral-400 truncate mt-1">{item.email}</p>
      </div>
    </Link>
  )
}
