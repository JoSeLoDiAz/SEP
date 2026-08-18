'use client'

import api from '@/lib/api'
import { AlertTriangle, BadgeCheck, Loader2, Search, ShieldX } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

interface Respuesta {
  valido: boolean
  motivo: string | null
  certificado?: {
    numero: string
    nombre: string
    identificacion: string
    rol: string
    proceso: string
    anio: number
    horas: number | null
    fechaEmision: string
  }
}

// ruta aparte de /verificar/[codigo]: esa valida versiones de proyecto, otro formato de código
export default function VerificarCertificadoPage() {
  const params = useParams<{ codigo: string }>()
  const router = useRouter()
  const codigo = decodeURIComponent(params.codigo ?? '')

  const [res, setRes] = useState<Respuesta | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorRed, setErrorRed] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true)
      setErrorRed(false)
      try {
        const r = await api.get<Respuesta>(`/publico/certificados/${encodeURIComponent(codigo)}`)
        if (vivo) setRes(r.data)
      } catch {
        // fallo de red no es certificado inválido
        if (vivo) setErrorRed(true)
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [codigo])

  const valido = res?.valido === true

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <h1 className="text-center text-lg font-bold" style={{ color: PRIMARY }}>
        Verificación de certificados de evaluador
      </h1>
      <p className="mt-1 text-center text-[12px] text-neutral-500">
        Grupo de Gestión para la Productividad y la Competitividad
      </p>

      <section className="mt-6 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-lg">
        <div
          className="h-2"
          style={{ backgroundColor: cargando || errorRed ? '#a3a3a3' : valido ? INSTITUTIONAL : '#dc2626' }}
        />

        {cargando ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-neutral-500">
            <Loader2 size={16} className="animate-spin" /> Verificando…
          </div>
        ) : errorRed ? (
          <div className="px-6 py-12 text-center">
            <AlertTriangle size={34} className="mx-auto text-amber-500" />
            <p className="mt-3 text-base font-bold text-neutral-800">No se pudo verificar</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-neutral-500">
              Hubo un problema de conexión con el servidor. Esto <strong>no</strong> significa que el
              certificado sea inválido: vuelve a intentarlo en unos minutos.
            </p>
          </div>
        ) : valido ? (
          <div className="px-6 py-8">
            <div className="text-center">
              <BadgeCheck size={44} className="mx-auto text-emerald-600" />
              <p className="mt-2 text-lg font-bold text-emerald-800">Certificado válido</p>
              <p className="font-mono text-[13px] text-neutral-500">{res!.certificado!.numero}</p>
            </div>

            <dl className="mt-6 divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
              <Fila label="Nombre" valor={res!.certificado!.nombre} destacado />
              <Fila label="Documento" valor={res!.certificado!.identificacion} mono />
              <Fila label="Participó como" valor={res!.certificado!.rol} />
              <Fila label="Proceso" valor={res!.certificado!.proceso || '—'} />
              <Fila label="Vigencia" valor={String(res!.certificado!.anio)} />
              {res!.certificado!.horas != null && (
                <Fila label="Dedicación" valor={`${res!.certificado!.horas} horas`} />
              )}
              <Fila label="Fecha de emisión" valor={fecha(res!.certificado!.fechaEmision)} />
            </dl>

            <p className="mt-4 text-center text-[11px] text-neutral-400">
              El número de documento se muestra parcialmente por protección de datos personales.
            </p>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <ShieldX size={40} className="mx-auto text-red-500" />
            <p className="mt-3 text-base font-bold text-red-800">Certificado no válido</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-neutral-600">
              {res?.motivo ?? 'No existe un certificado con ese código.'}
            </p>
            <p className="mt-3 font-mono text-[12px] text-neutral-400">{codigo}</p>
          </div>
        )}
      </section>

      <form
        onSubmit={e => {
          e.preventDefault()
          const c = busqueda.trim()
          if (c) router.push(`/verificar-certificado/${encodeURIComponent(c)}`)
        }}
        className="mt-5 flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value.toUpperCase())}
          placeholder="Verificar otro código (ej. 2026-0001-AB3XYZ)"
          className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          style={{ backgroundColor: PRIMARY }}
        >
          <Search size={15} /> Verificar
        </button>
      </form>
    </div>
  )
}

function Fila({
  label, valor, mono, destacado,
}: { label: string; valor: string; mono?: boolean; destacado?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className={`text-right ${mono ? 'font-mono' : ''} ${
        destacado ? 'text-[15px] font-bold' : 'text-[13px]'
      } text-neutral-800`}>
        {valor}
      </dd>
    </div>
  )
}

function fecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Bogota',
  })
}
