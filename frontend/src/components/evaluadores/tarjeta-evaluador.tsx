'use client'

import { useFotoEvaluador } from '@/lib/use-foto-evaluador'
import { CreditCard, FolderKanban, ImageOff, Layers, MapPin, ShieldX, Star } from 'lucide-react'
import Link from 'next/link'

const PRIMARY = '#00304D'

// solo los 3 ciclos más recientes del evaluador
export interface CicloResumido {
  // un evaluador puede tener dos ciclos en el mismo año
  participacionId: number
  anio: number
  estadoCodigo: string | null
  estadoColor: string | null
}

export interface EvaluadorItem {
  evaluadorId: number
  personaId: number
  identificacion: string | null
  nombres: string | null
  primerApellido: string | null
  segundoApellido: string | null
  email: string | null
  cargo: string | null
  profesion: string | null
  regionalNombre: string | null
  activo: boolean
  tieneFoto: boolean
  tieneCedula: boolean
  pruebaVigente: boolean
  totalCiclos: number
  totalProyectos: number
  ultimoAnio: number | null
  promedioRetro: number | null
  ciclos: CicloResumido[]
}

// clases literales: Tailwind no las incluye en el bundle si se arman en runtime
const COLOR_ESTADO: Record<string, { chip: string; punto: string }> = {
  neutral: { chip: 'bg-neutral-100 text-neutral-700 border-neutral-200', punto: 'bg-neutral-400' },
  blue:    { chip: 'bg-blue-50 text-blue-700 border-blue-200',           punto: 'bg-blue-500' },
  indigo:  { chip: 'bg-indigo-50 text-indigo-700 border-indigo-200',     punto: 'bg-indigo-500' },
  cyan:    { chip: 'bg-cyan-50 text-cyan-700 border-cyan-200',           punto: 'bg-cyan-500' },
  amber:   { chip: 'bg-amber-50 text-amber-700 border-amber-200',        punto: 'bg-amber-500' },
  orange:  { chip: 'bg-orange-50 text-orange-700 border-orange-200',     punto: 'bg-orange-500' },
  green:   { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',  punto: 'bg-emerald-500' },
  red:     { chip: 'bg-red-50 text-red-700 border-red-200',              punto: 'bg-red-500' },
}
const colorDe = (token?: string | null) => COLOR_ESTADO[token ?? 'neutral'] ?? COLOR_ESTADO.neutral

interface Alerta {
  clave: string
  texto: string
  clase: string
  icono: React.ComponentType<{ size?: number; className?: string }>
}

export function TarjetaEvaluador({ item }: { item: EvaluadorItem }) {
  const nombreCompleto = [item.nombres, item.primerApellido, item.segundoApellido]
    .filter(Boolean).join(' ').trim()
  const inicial = (item.nombres?.[0] ?? '?').toUpperCase()
  const fotoSrc = useFotoEvaluador(item.evaluadorId, item.tieneFoto)

  // el backend no garantiza el orden de los ciclos
  const ciclos = [...item.ciclos].sort((a, b) => b.anio - a.anio)

  const alertas: Alerta[] = []
  if (!item.tieneCedula) alertas.push({ clave: 'cedula', texto: 'Sin cédula', clase: 'bg-red-100 text-red-700', icono: CreditCard })
  if (!item.tieneFoto) alertas.push({ clave: 'foto', texto: 'Sin foto', clase: 'bg-amber-100 text-amber-700', icono: ImageOff })
  if (!item.pruebaVigente) alertas.push({ clave: 'prueba', texto: 'Prueba no vigente', clase: 'bg-orange-100 text-orange-700', icono: ShieldX })

  return (
    <Link
      href={`/panel/evaluadores/${item.evaluadorId}`}
      className={`group rounded-2xl border overflow-hidden flex flex-col transition ${
        item.activo
          ? 'bg-white border-neutral-200 hover:border-[#00304D]/40 hover:shadow-lg'
          : 'bg-neutral-50 border-dashed border-neutral-300 hover:border-neutral-400'
      }`}
    >
      <div className="relative h-36 bg-gradient-to-br from-[#00304D]/5 via-white to-[#39a900]/5 flex items-center justify-center overflow-hidden">
        {fotoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fotoSrc}
            alt={nombreCompleto}
            className={`w-full h-full object-cover ${item.activo ? '' : 'grayscale opacity-70'}`}
          />
        ) : (
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md ${item.activo ? '' : 'grayscale opacity-70'}`}
            style={{ backgroundColor: PRIMARY }}
          >
            {inicial}
          </div>
        )}

        {!item.activo && (
          <span className="absolute top-2 left-2 rounded bg-neutral-800/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            Inactivo
          </span>
        )}

        {item.ultimoAnio != null && (
          <span className="absolute top-2 right-2 rounded bg-white/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-600 backdrop-blur-sm tabular-nums">
            Último {item.ultimoAnio}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <p className="text-sm font-bold text-neutral-900 leading-tight line-clamp-1">
          {nombreCompleto || item.email || 'Sin nombre'}
        </p>
        <p className="text-[11px] text-neutral-500 font-mono">CC {item.identificacion ?? '—'}</p>

        {item.cargo && (
          <p className="text-xs text-neutral-700 line-clamp-1 mt-1">
            <span className="font-semibold">{item.cargo}</span>
          </p>
        )}
        {item.profesion && <p className="text-[11px] text-neutral-500 line-clamp-1">{item.profesion}</p>}
        {item.regionalNombre && (
          <p className="text-[11px] text-neutral-500 line-clamp-1 flex items-center gap-1">
            <MapPin size={10} className="shrink-0 text-neutral-400" />
            {item.regionalNombre}
          </p>
        )}

        {ciclos.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {ciclos.map(c => {
              const color = colorDe(c.estadoColor)
              return (
                <span
                  key={c.participacionId}
                  title={c.estadoCodigo ?? 'Sin estado'}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums ${color.chip}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${color.punto}`} />
                  {c.anio}
                </span>
              )
            })}
          </div>
        )}

        <div className="grid grid-cols-3 gap-1 rounded-xl border border-neutral-100 bg-neutral-50/70 px-2 py-2 mt-2">
          <Contador icono={Layers} etiqueta="Ciclos" valor={String(item.totalCiclos)} />
          <Contador icono={FolderKanban} etiqueta="Proyectos" valor={String(item.totalProyectos)} />
          <Contador
            icono={Star}
            etiqueta="Retro /5"
            valor={item.promedioRetro != null ? item.promedioRetro.toFixed(1) : '—'}
          />
        </div>

        {alertas.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {alertas.map(a => {
              const Icono = a.icono
              return (
                <span
                  key={a.clave}
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${a.clase}`}
                >
                  <Icono size={10} />
                  {a.texto}
                </span>
              )
            })}
          </div>
        )}

        <p className="text-[11px] text-neutral-400 truncate mt-auto pt-2">{item.email ?? '—'}</p>
      </div>
    </Link>
  )
}

function Contador({
  icono: Icono, etiqueta, valor,
}: {
  icono: React.ComponentType<{ size?: number; className?: string }>
  etiqueta: string
  valor: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <Icono size={12} className="text-neutral-400" />
      <span className="text-sm font-bold text-neutral-800 leading-none tabular-nums">{valor}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">{etiqueta}</span>
    </div>
  )
}
