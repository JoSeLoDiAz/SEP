'use client'

import {
  BarraFiltrosBanco, contarFiltros, FILTROS_VACIOS, paramsDeFiltros, type FiltrosBanco,
} from '@/components/evaluadores/filtros-banco'
import { TarjetaEvaluador, type EvaluadorItem } from '@/components/evaluadores/tarjeta-evaluador'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import api from '@/lib/api'
import { getSepUsuario, isAdmin } from '@/lib/auth'
import { descargarArchivoConNombreDelServidor } from '@/lib/descargar-archivo'
import {
  ArrowLeft, CreditCard, ImageOff, Loader2, Plus, Settings2, ShieldAlert, ShieldCheck,
  ShieldX, UserPlus, Users,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'
const TAM_PAGINA = 24

interface RespListado {
  items: EvaluadorItem[]
  total: number
  page: number
  limit: number
}

interface Contadores {
  sinCedula: number
  sinFoto: number
  sinPrueba: number
}

export default function EvaluadoresDashboardPage() {
  const [busqueda, setBusqueda] = useState('')
  // La búsqueda solo se aplica al enviar el formulario; el Excel debe salir con
  // el texto YA aplicado, no con lo que el usuario esté tecleando.
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [filtros, setFiltros] = useState<FiltrosBanco>(FILTROS_VACIOS)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<RespListado | null>(null)
  const [contadores, setContadores] = useState<Contadores | null>(null)
  const [cargandoContadores, setCargandoContadores] = useState(false)
  const [contadoresFallaron, setContadoresFallaron] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [esAdmin, setEsAdmin] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  // Cancela la consulta anterior cuando el usuario cambia filtros más rápido de
  // lo que el backend responde.
  const cargaCtrlRef = useRef<AbortController | null>(null)
  // Los contadores viven aparte del listado: no dependen de la página, así que
  // tienen su propio ciclo de vida y su propia cancelación.
  const contadoresCtrlRef = useRef<AbortController | null>(null)
  const claveContadoresRef = useRef<string | null>(null)

  useEffect(() => { setEsAdmin(isAdmin(getSepUsuario()?.perfilId ?? 0)) }, [])

  useEffect(() => {
    cargar(busqueda, filtros, page)
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [page])

  async function cargar(q: string, f: FiltrosBanco, p: number) {
    cargaCtrlRef.current?.abort()
    const ctrl = new AbortController()
    cargaCtrlRef.current = ctrl
    setLoading(true)
    setErrMsg('')
    setBusquedaAplicada(q.trim())

    const base = paramsDeFiltros(f, q)
    void cargarContadores(base)

    try {
      const res = await api.get<RespListado>('/evaluadores', {
        params: { ...base, page: p, limit: TAM_PAGINA },
        signal: ctrl.signal,
      })
      setData(res.data)
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'CanceledError') return
      const status = (err as { response?: { status?: number } })?.response?.status
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      if (status === 403) setErrMsg('No tienes permisos para acceder al banco de evaluadores.')
      else setErrMsg(msg ?? 'Error cargando el banco de evaluadores')
      setData(null)
    } finally {
      if (cargaCtrlRef.current === ctrl) setLoading(false)
    }
  }

  /**
   * Contadores de alerta del banco filtrado. Se piden sin los flags de alerta
   * entre sí: si ya estás filtrando "sin foto", el contador de "sin cédula"
   * debe seguir midiendo el mismo universo y no el cruce de ambas.
   */
  async function cargarContadores(base: Record<string, string>) {
    const comun = { ...base }
    delete comun.sinCedula
    delete comun.sinFoto
    delete comun.pruebaVigente

    // Pasar de página no cambia el universo que miden las alertas: sin esta
    // guarda, cada clic en "Siguiente" repetía las tres consultas y dejaba las
    // tarjetas parpadeando en spinner.
    const clave = new URLSearchParams(comun).toString()
    if (clave === claveContadoresRef.current) return
    claveContadoresRef.current = clave

    contadoresCtrlRef.current?.abort()
    const ctrl = new AbortController()
    contadoresCtrlRef.current = ctrl
    setContadores(null)
    setContadoresFallaron(false)
    setCargandoContadores(true)

    const totalCon = async (extra: Record<string, string>) => {
      const r = await api.get<RespListado>('/evaluadores', {
        params: { ...comun, ...extra, page: 1, limit: 1 },
        signal: ctrl.signal,
      })
      return r.data.total
    }

    try {
      const [sinCedula, sinFoto, sinPrueba] = await Promise.all([
        totalCon({ sinCedula: 'true' }),
        totalCon({ sinFoto: 'true' }),
        totalCon({ pruebaVigente: 'false' }),
      ])
      setContadores({ sinCedula, sinFoto, sinPrueba })
    } catch {
      // Los contadores son informativos: si fallan, la pantalla sigue sirviendo.
      // Se olvida la clave para que el próximo cambio de criterios reintente.
      //
      // Pero hay que MARCAR el fallo: un "—" junto a "Filtrar por esta alerta"
      // se lee como cero, y "nadie le falta la cédula" es lo contrario de lo
      // que pasa cuando no se pudo contar.
      if (contadoresCtrlRef.current === ctrl) {
        claveContadoresRef.current = null
        setContadoresFallaron(true)
      }
    } finally {
      // Si esta carga ya fue reemplazada, el spinner lo apaga la nueva.
      if (contadoresCtrlRef.current === ctrl) setCargandoContadores(false)
    }
  }

  /**
   * Relanza la consulta con los criterios nuevos. Si ya estamos en la página 1
   * hay que pedirla a mano; si no, basta con volver a 1 y dejar que el efecto
   * de `page` dispare la carga, para no lanzar dos veces las mismas consultas.
   */
  function relanzar(q: string, f: FiltrosBanco) {
    if (page === 1) cargar(q, f, 1)
    else setPage(1)
  }

  function aplicarFiltros(nuevos: FiltrosBanco) {
    setFiltros(nuevos)
    relanzar(busqueda, nuevos)
  }

  function handleBuscar() {
    relanzar(busqueda, filtros)
  }

  function limpiarTodo() {
    setBusqueda('')
    setFiltros(FILTROS_VACIOS)
    relanzar('', FILTROS_VACIOS)
  }

  /** Quita solo la búsqueda de texto y conserva los filtros puestos. */
  function limpiarBusqueda() {
    setBusqueda('')
    relanzar('', filtros)
  }

  async function exportar() {
    setExportando(true)
    try {
      const qs = new URLSearchParams(paramsDeFiltros(filtros, busquedaAplicada)).toString()
      await descargarArchivoConNombreDelServidor(
        `/evaluadores/reportes/banco.xlsx${qs ? `?${qs}` : ''}`,
        'banco-evaluadores.xlsx',
        // La sábana recorre todo el banco filtrado: 15 s no alcanzan.
        60_000,
      )
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo exportar el banco' })
    } finally {
      setExportando(false)
    }
  }

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const numFiltros = contarFiltros(filtros)
  const hayCriterios = numFiltros > 0 || busquedaAplicada !== ''
  // "?" y no "—" cuando la consulta falló: el guion se confunde con un cero, y
  // decirle que a nadie le falta la cédula cuando no se pudo contar es peor que
  // no decir nada.
  const valorContador = (v: number | undefined) =>
    v != null ? String(v) : (contadoresFallaron ? '?' : '—')

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

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl shadow-lg" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #001f33 70%, #000a14 100%)` }}>
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-96 h-40 rounded-full" style={{ backgroundColor: `${INSTITUTIONAL}15`, filter: 'blur(60px)' }} />
        <div className="relative px-6 sm:px-10 py-8 sm:py-10 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 ring-1 ring-white/20">
            <ShieldCheck size={32} className="text-white" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Gestión GGPC</p>
            <h1 className="text-white font-bold text-2xl sm:text-3xl mt-1 leading-tight">Banco de Evaluadores</h1>
            <p className="text-white/80 text-sm mt-2 max-w-2xl">
              Hoja de vida, experiencia, formación TIC y participación en procesos de evaluación. Filtra por año, proceso, rol o territorio y detecta a quién le falta documentación antes de convocar.
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

      {esAdmin && (
        <Link href="/panel" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D] w-fit">
          <ArrowLeft size={13} />
          Volver al panel de administración
        </Link>
      )}

      {/* Métricas: las tres de alerta son además los filtros rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TarjetaMetrica
          icono={Users}
          etiqueta={hayCriterios ? 'Coinciden' : 'Total registrados'}
          valor={data ? String(data.total) : '—'}
          detalle={hayCriterios ? 'con los filtros aplicados' : 'evaluadores activos del banco'}
          color={PRIMARY}
          cargando={loading && !data}
        />
        <TarjetaMetrica
          icono={CreditCard}
          etiqueta="Sin cédula"
          valor={valorContador(contadores?.sinCedula)}
          detalle="Filtrar por esta alerta"
          color="#B91C1C"
          cargando={cargandoContadores}
          activo={filtros.sinCedula}
          onClick={() => aplicarFiltros({ ...filtros, sinCedula: !filtros.sinCedula })}
        />
        <TarjetaMetrica
          icono={ImageOff}
          etiqueta="Sin foto"
          valor={valorContador(contadores?.sinFoto)}
          detalle="Filtrar por esta alerta"
          color="#C2410C"
          cargando={cargandoContadores}
          activo={filtros.sinFoto}
          onClick={() => aplicarFiltros({ ...filtros, sinFoto: !filtros.sinFoto })}
        />
        <TarjetaMetrica
          icono={ShieldX}
          etiqueta="Sin prueba vigente"
          valor={valorContador(contadores?.sinPrueba)}
          detalle="Filtrar por esta alerta"
          color="#0891B2"
          cargando={cargandoContadores}
          activo={filtros.sinPrueba}
          onClick={() => aplicarFiltros({ ...filtros, sinPrueba: !filtros.sinPrueba })}
        />
      </div>

      <BarraFiltrosBanco
        busqueda={busqueda}
        busquedaAplicada={busquedaAplicada}
        onBusquedaChange={setBusqueda}
        onBuscar={handleBuscar}
        onLimpiarBusqueda={limpiarBusqueda}
        filtros={filtros}
        onCambiarFiltros={aplicarFiltros}
        onLimpiar={limpiarTodo}
        onExportar={exportar}
        exportando={exportando}
        cargando={loading}
      />

      {errMsg && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <ShieldAlert size={16} />
          {errMsg}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-neutral-500 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Cargando…
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="bg-white border border-dashed border-neutral-300 rounded-2xl py-16 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center">
            <Users size={26} className="text-neutral-400" />
          </div>
          {hayCriterios ? (
            <>
              <div>
                <p className="text-sm font-bold text-neutral-700">Ningún evaluador coincide</p>
                <p className="text-xs text-neutral-500 mt-1">Prueba quitando filtros o ampliando la búsqueda.</p>
              </div>
              <button
                type="button"
                onClick={limpiarTodo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Limpiar filtros
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${loading ? 'opacity-60 transition' : ''}`}>
            {data.items.map(e => <TarjetaEvaluador key={e.evaluadorId} item={e} />)}
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

function TarjetaMetrica({
  icono: Icono, etiqueta, valor, detalle, color, cargando, activo, onClick,
}: {
  icono: React.ComponentType<{ size?: number; className?: string }>
  etiqueta: string
  valor: string
  detalle?: string
  color: string
  cargando?: boolean
  activo?: boolean
  onClick?: () => void
}) {
  const contenido = (
    <>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: color }}>
        <Icono size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{etiqueta}</p>
        <p className="text-2xl font-bold text-neutral-900 leading-tight mt-0.5 tabular-nums">
          {cargando ? <Loader2 size={20} className="inline animate-spin text-neutral-300" /> : valor}
        </p>
        {detalle && <p className="text-[11px] text-neutral-500 mt-0.5">{activo ? 'Filtro aplicado · clic para quitar' : detalle}</p>}
      </div>
    </>
  )

  const base = 'bg-white border rounded-2xl p-4 flex items-start gap-3 shadow-sm'

  if (!onClick) {
    return <div className={`${base} border-neutral-200`}>{contenido}</div>
  }

  // El color del filtro activo es dato, no clase: va inline porque Tailwind no
  // puede generar utilidades con un valor de runtime.
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} w-full text-left transition hover:shadow-md ${activo ? '' : 'border-neutral-200'}`}
      style={activo ? { borderColor: color, backgroundColor: `${color}0D` } : undefined}
    >
      {contenido}
    </button>
  )
}
