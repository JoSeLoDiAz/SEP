'use client'

import api from '@/lib/api'
import { Download, Filter, FilterX, Loader2, PowerOff, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

/**
 * Estado de la barra de filtros del banco.
 *
 * `''` significa "filtro sin usar" y no viaja al backend. Los booleanos solo
 * viajan cuando están en true porque el backend distingue "no filtrar" de
 * "filtrar por false": mandar `sinFoto=false` pediría los que SÍ tienen foto.
 */
export interface FiltrosBanco {
  anio: number | ''
  procesoId: number | ''
  rolEvaluadorId: number | ''
  areaId: number | ''
  estadoCodigo: string
  regionalId: number | ''
  centroId: number | ''
  sinCedula: boolean
  sinFoto: boolean
  sinPrueba: boolean
  incluirInactivos: boolean
}

export const FILTROS_VACIOS: FiltrosBanco = {
  anio: '',
  procesoId: '',
  rolEvaluadorId: '',
  areaId: '',
  estadoCodigo: '',
  regionalId: '',
  centroId: '',
  sinCedula: false,
  sinFoto: false,
  sinPrueba: false,
  incluirInactivos: false,
}

interface CatalogoItem { id: number; nombre: string }
interface EstadoItem { codigo: string; nombre: string }

/**
 * Traduce la barra a los query params del listado. El botón de exportar reusa
 * esta misma función, así el Excel sale con exactamente la consulta que hay en
 * pantalla y no con el banco entero.
 */
export function paramsDeFiltros(filtros: FiltrosBanco, busqueda: string): Record<string, string> {
  const p: Record<string, string> = {}
  const q = busqueda.trim()
  if (q) p.busqueda = q
  if (filtros.anio !== '') p.anio = String(filtros.anio)
  if (filtros.procesoId !== '') p.procesoId = String(filtros.procesoId)
  if (filtros.rolEvaluadorId !== '') p.rolEvaluadorId = String(filtros.rolEvaluadorId)
  if (filtros.areaId !== '') p.areaId = String(filtros.areaId)
  if (filtros.estadoCodigo !== '') p.estadoCodigo = filtros.estadoCodigo
  if (filtros.regionalId !== '') p.regionalId = String(filtros.regionalId)
  if (filtros.centroId !== '') p.centroId = String(filtros.centroId)
  if (filtros.sinCedula) p.sinCedula = 'true'
  if (filtros.sinFoto) p.sinFoto = 'true'
  // "Sin prueba vigente" no es un flag propio del backend: es el negativo de
  // `pruebaVigente`, que solo filtra cuando llega explícito.
  if (filtros.sinPrueba) p.pruebaVigente = 'false'
  if (filtros.incluirInactivos) p.incluirInactivos = 'true'
  return p
}

/** Cuántos filtros hay puestos — decide si se muestra "limpiar". */
export function contarFiltros(filtros: FiltrosBanco): number {
  return Object.values(filtros).filter(v => v !== '' && v !== false).length
}

const etiqueta = 'block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1'
const control = 'w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#00304D]/40 disabled:bg-neutral-50 disabled:text-neutral-400'

export function BarraFiltrosBanco({
  busqueda, busquedaAplicada, onBusquedaChange, onBuscar, onLimpiarBusqueda,
  filtros, onCambiarFiltros, onLimpiar,
  onExportar, exportando, cargando,
}: {
  busqueda: string
  /**
   * Lo que se está filtrando ahora mismo, que no es lo mismo que lo tecleado:
   * el listado no cambia hasta pulsar "Buscar". El chip debe reflejar lo que
   * el usuario está viendo, no lo que va escribiendo.
   */
  busquedaAplicada: string
  onBusquedaChange: (valor: string) => void
  onBuscar: () => void
  onLimpiarBusqueda: () => void
  filtros: FiltrosBanco
  onCambiarFiltros: (filtros: FiltrosBanco) => void
  onLimpiar: () => void
  onExportar: () => void
  exportando: boolean
  cargando: boolean
}) {
  const hayBusqueda = busquedaAplicada.trim() !== ''
  const [roles, setRoles] = useState<CatalogoItem[]>([])
  const [procesos, setProcesos] = useState<CatalogoItem[]>([])
  const [regionales, setRegionales] = useState<CatalogoItem[]>([])
  const [centros, setCentros] = useState<CatalogoItem[]>([])
  const [areas, setAreas] = useState<CatalogoItem[]>([])
  const [estados, setEstados] = useState<EstadoItem[]>([])
  const [catalogosFallaron, setCatalogosFallaron] = useState(false)

  // Los años salen de los datos, no de una ventana móvil calculada aquí: el
  // histórico llega a 2020 y con `anioActual + 1 - i` ese año no aparecía en
  // la lista, así que era imposible filtrar por él desde la pantalla.
  const [anios, setAnios] = useState<number[]>([])

  useEffect(() => {
    let vivo = true
    Promise.all([
      api.get<CatalogoItem[]>('/evaluadores/catalogos/roles'),
      api.get<CatalogoItem[]>('/evaluadores/catalogos/procesos'),
      api.get<CatalogoItem[]>('/evaluadores/catalogos/regionales'),
      api.get<CatalogoItem[]>('/evaluadores/catalogos/areas'),
      api.get<EstadoItem[]>('/evaluadores/catalogos/estados-participacion'),
      api.get<number[]>('/evaluadores/catalogos/anios'),
    ])
      .then(([r, p, g, a, e, y]) => {
        if (!vivo) return
        setRoles(r.data)
        setProcesos(p.data)
        setRegionales(g.data)
        setAreas(a.data)
        setEstados(e.data)
        setAnios(y.data)
      })
      // Un catálogo caído deja los selects vacíos. El listado sigue usable, pero
      // hay que decirlo: unos selects en "Todos" sin explicación se leen como
      // "no hay nada que filtrar", que es distinto de "no se pudo cargar".
      .catch(() => { if (vivo) setCatalogosFallaron(true) })
    return () => { vivo = false }
  }, [])

  // Los centros dependen de la regional elegida: sin regional la lista completa
  // es inmanejable en un select, así que el filtro queda deshabilitado.
  useEffect(() => {
    if (filtros.regionalId === '') { setCentros([]); return }
    let vivo = true
    api.get<CatalogoItem[]>('/evaluadores/catalogos/centros', { params: { regionalId: filtros.regionalId } })
      .then(r => { if (vivo) setCentros(r.data) })
      .catch(() => { if (vivo) setCentros([]) })
    return () => { vivo = false }
  }, [filtros.regionalId])

  const nombreDe = (lista: CatalogoItem[], id: number | '') =>
    id === '' ? '' : (lista.find(x => x.id === id)?.nombre ?? `#${id}`)

  // Cada chip lleva el estado que queda al quitarlo: evita repetir la lógica de
  // dependencias (quitar regional obliga a soltar el centro).
  const chips: Array<{ clave: string; texto: string; siguiente: FiltrosBanco }> = []
  if (filtros.anio !== '') chips.push({ clave: 'anio', texto: `Año ${filtros.anio}`, siguiente: { ...filtros, anio: '' } })
  if (filtros.procesoId !== '') chips.push({ clave: 'proceso', texto: nombreDe(procesos, filtros.procesoId), siguiente: { ...filtros, procesoId: '' } })
  if (filtros.rolEvaluadorId !== '') chips.push({ clave: 'rol', texto: nombreDe(roles, filtros.rolEvaluadorId), siguiente: { ...filtros, rolEvaluadorId: '' } })
  if (filtros.areaId !== '') chips.push({ clave: 'area', texto: nombreDe(areas, filtros.areaId), siguiente: { ...filtros, areaId: '' } })
  if (filtros.estadoCodigo !== '') {
    const e = estados.find(x => x.codigo === filtros.estadoCodigo)
    chips.push({ clave: 'estado', texto: e?.nombre ?? filtros.estadoCodigo, siguiente: { ...filtros, estadoCodigo: '' } })
  }
  if (filtros.regionalId !== '') chips.push({ clave: 'regional', texto: nombreDe(regionales, filtros.regionalId), siguiente: { ...filtros, regionalId: '', centroId: '' } })
  if (filtros.centroId !== '') chips.push({ clave: 'centro', texto: nombreDe(centros, filtros.centroId), siguiente: { ...filtros, centroId: '' } })
  if (filtros.sinCedula) chips.push({ clave: 'sinCedula', texto: 'Sin cédula', siguiente: { ...filtros, sinCedula: false } })
  if (filtros.sinFoto) chips.push({ clave: 'sinFoto', texto: 'Sin foto', siguiente: { ...filtros, sinFoto: false } })
  if (filtros.sinPrueba) chips.push({ clave: 'sinPrueba', texto: 'Sin prueba vigente', siguiente: { ...filtros, sinPrueba: false } })
  if (filtros.incluirInactivos) chips.push({ clave: 'inactivos', texto: 'Incluye inactivos', siguiente: { ...filtros, incluirInactivos: false } })

  const numero = (valor: string): number | '' => (valor ? Number(valor) : '')

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm">
      {/* Búsqueda + acciones */}
      <form
        onSubmit={(e) => { e.preventDefault(); onBuscar() }}
        className="p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Search size={16} className="text-neutral-400 ml-1" />
          <input
            value={busqueda}
            onChange={(e) => onBusquedaChange(e.target.value)}
            placeholder="Buscar por nombre, correo o identificación..."
            className="flex-1 text-sm focus:outline-none bg-transparent min-w-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={cargando}
            className="px-4 py-1.5 text-white text-xs font-semibold rounded-lg transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: PRIMARY }}
          >
            Buscar
          </button>
          <button
            type="button"
            onClick={onExportar}
            disabled={exportando}
            title="Exporta el banco con los filtros aplicados"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            {exportando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Exportar
          </button>
        </div>
      </form>

      {/* Selects */}
      {catalogosFallaron && (
        <p className="border-t border-neutral-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          No se pudieron cargar las listas de los filtros. El buscador y las alertas
          siguen funcionando; recargue la página para reintentar.
        </p>
      )}

      <div className="border-t border-neutral-100 px-3 py-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
        <div>
          <label className={etiqueta}>Año del ciclo</label>
          <select
            value={filtros.anio === '' ? '' : String(filtros.anio)}
            onChange={(e) => onCambiarFiltros({ ...filtros, anio: numero(e.target.value) })}
            className={control}
          >
            <option value="">Todos</option>
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className={etiqueta}>Proceso</label>
          <select
            value={filtros.procesoId === '' ? '' : String(filtros.procesoId)}
            onChange={(e) => onCambiarFiltros({ ...filtros, procesoId: numero(e.target.value) })}
            className={control}
          >
            <option value="">Todos</option>
            {procesos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className={etiqueta}>Rol</label>
          <select
            value={filtros.rolEvaluadorId === '' ? '' : String(filtros.rolEvaluadorId)}
            onChange={(e) => onCambiarFiltros({ ...filtros, rolEvaluadorId: numero(e.target.value) })}
            className={control}
          >
            <option value="">Todos</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className={etiqueta}>Área</label>
          <select
            value={filtros.areaId === '' ? '' : String(filtros.areaId)}
            onChange={(e) => onCambiarFiltros({ ...filtros, areaId: numero(e.target.value) })}
            className={control}
          >
            <option value="">Todas</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className={etiqueta}>Estado del ciclo</label>
          <select
            value={filtros.estadoCodigo}
            onChange={(e) => onCambiarFiltros({ ...filtros, estadoCodigo: e.target.value })}
            className={control}
          >
            <option value="">Todos</option>
            {estados.map(e => <option key={e.codigo} value={e.codigo}>{e.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className={etiqueta}>Regional</label>
          <select
            value={filtros.regionalId === '' ? '' : String(filtros.regionalId)}
            onChange={(e) => onCambiarFiltros({ ...filtros, regionalId: numero(e.target.value), centroId: '' })}
            className={control}
          >
            <option value="">Todas</option>
            {regionales.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className={etiqueta}>Centro</label>
          <select
            value={filtros.centroId === '' ? '' : String(filtros.centroId)}
            onChange={(e) => onCambiarFiltros({ ...filtros, centroId: numero(e.target.value) })}
            disabled={filtros.regionalId === ''}
            className={control}
          >
            <option value="">{filtros.regionalId === '' ? 'Elige regional' : 'Todos'}</option>
            {centros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* Inactivos + filtros aplicados */}
      <div className="border-t border-neutral-100 px-3 py-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onCambiarFiltros({ ...filtros, incluirInactivos: !filtros.incluirInactivos })}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
            filtros.incluirInactivos
              ? 'text-white border-transparent'
              : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
          }`}
          style={filtros.incluirInactivos ? { backgroundColor: INSTITUTIONAL } : undefined}
        >
          <PowerOff size={12} />
          {filtros.incluirInactivos ? 'Con inactivos' : 'Solo activos'}
        </button>

        <span className="w-px h-5 bg-neutral-200" />

        {chips.length === 0 && !hayBusqueda ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-400">
            <Filter size={12} />
            Sin filtros aplicados
          </span>
        ) : (
          <>
            {/* La búsqueda de texto también es un criterio: sin este chip, quien
                buscó "cardona" y obtuvo resultados no tenía forma de volver al
                listado completo salvo borrar el campo a mano. */}
            {hayBusqueda && (
              <button
                type="button"
                onClick={onLimpiarBusqueda}
                title="Quitar la búsqueda"
                className="inline-flex items-center gap-1 rounded-full border border-[#00304D]/20 bg-[#00304D]/5 px-2.5 py-1 text-[11px] font-semibold text-[#00304D] transition hover:bg-[#00304D]/10"
              >
                Búsqueda: {busquedaAplicada.trim()}
                <X size={11} />
              </button>
            )}
            {chips.map(chip => (
              <button
                key={chip.clave}
                type="button"
                onClick={() => onCambiarFiltros(chip.siguiente)}
                title="Quitar este filtro"
                className="inline-flex items-center gap-1 rounded-full border border-[#00304D]/20 bg-[#00304D]/5 px-2.5 py-1 text-[11px] font-semibold text-[#00304D] transition hover:bg-[#00304D]/10"
              >
                {chip.texto}
                <X size={11} />
              </button>
            ))}
            <button
              type="button"
              onClick={onLimpiar}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-[#00304D]"
            >
              <FilterX size={12} />
              Limpiar filtros
            </button>
          </>
        )}
      </div>
    </div>
  )
}
