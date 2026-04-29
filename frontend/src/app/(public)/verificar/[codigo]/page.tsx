'use client'

import api from '@/lib/api'
import { fmtDateTimeFull } from '@/lib/format-date'
import {
  Award, Ban, CheckCircle2, Loader2, ShieldAlert, ShieldCheck, XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface ResultadoVerificacion {
  valido: boolean
  codigo: string
  version?: {
    numero: number
    fecha: string | null
    hash: string | null
    esFinal: boolean
    anulada: boolean
    finalFecha: string | null
  }
  proyecto?: {
    id: number
    nombre: string
    estado: number
    convocatoria: string | null
  }
  empresa?: {
    razonSocial: string
    nit: string
  }
}

const ESTADO_LABELS: Record<number, string> = {
  0: 'Sin Confirmar',
  1: 'Confirmado',
  2: 'Reversado',
  3: 'Aprobado',
  4: 'Rechazado',
}

export default function VerificarCodigoPage() {
  const { codigo: codigoParam } = useParams<{ codigo: string }>()
  const codigo = decodeURIComponent(codigoParam ?? '')

  const [result, setResult] = useState<ResultadoVerificacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    document.title = `Verificar ${codigo} | SEP`
    api.get<ResultadoVerificacion>(`/publico/verificar/${encodeURIComponent(codigo)}`)
      .then(r => setResult(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [codigo])

  if (loading) return (
    <div className="max-w-3xl mx-auto px-5 py-20 flex flex-col items-center gap-3">
      <Loader2 size={32} className="animate-spin text-[#00304D]" />
      <p className="text-sm text-neutral-500">Verificando código…</p>
    </div>
  )

  if (error) return (
    <div className="max-w-3xl mx-auto px-5 py-20">
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-3">
        <XCircle size={28} className="text-red-600 shrink-0" />
        <div>
          <h2 className="text-base font-bold text-red-900">No se pudo verificar el código</h2>
          <p className="text-sm text-red-700 mt-1">Hubo un problema al consultar el servidor. Intenta nuevamente más tarde.</p>
          <Link href="/verificar" className="inline-block mt-3 text-xs font-semibold text-red-700 underline hover:text-red-900">
            ← Volver al verificador
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-7 py-10 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <ShieldCheck size={22} className="text-[#00304D]" />
        <h1 className="text-lg font-bold text-[#00304D]">Resultado de la Verificación</h1>
      </div>

      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Código consultado</p>
        <p className="text-sm font-mono font-bold text-neutral-800 break-all">{codigo}</p>
      </div>

      {!result?.valido ? (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-6 flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0">
            <XCircle size={24} strokeWidth={2.4} />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-red-900">Código NO válido</p>
            <p className="text-sm text-red-800 mt-1">
              No se encontró ninguna versión de proyecto con este código. Verifica que el código sea exactamente
              el que aparece impreso en el reporte (incluyendo el guion y los caracteres alfanuméricos al final).
            </p>
            <Link href="/verificar" className="inline-block mt-3 text-xs font-semibold text-red-700 underline hover:text-red-900">
              ← Probar con otro código
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Estado principal */}
          {result.version?.anulada ? (
            <div className="rounded-2xl border-2 border-neutral-300 bg-neutral-50 p-5 flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-neutral-400 text-white flex items-center justify-center shrink-0">
                <Ban size={24} strokeWidth={2.4} />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-neutral-800">Versión ANULADA</p>
                <p className="text-sm text-neutral-600 mt-1">
                  El código existe pero corresponde a una versión que el proponente marcó como anulada.
                  Esta versión NO debe considerarse vigente.
                </p>
              </div>
            </div>
          ) : result.version?.esFinal ? (
            <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100 p-5 flex items-start gap-3">
              <div className="w-14 h-14 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Award size={26} strokeWidth={2.4} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Código válido · Versión FINAL</p>
                <p className="text-base font-bold text-amber-900 mt-0.5">Esta es la versión oficial lista para descarga y envío a SECOP</p>
                <p className="text-sm text-amber-800 mt-1">
                  El proponente marcó esta versión como definitiva. Es la que debe coincidir con la documentación
                  cargada en SECOP.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-white p-5 flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 size={24} strokeWidth={2.4} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Código válido</p>
                <p className="text-base font-bold text-emerald-900 mt-0.5">Versión registrada en el sistema</p>
                <p className="text-sm text-emerald-800 mt-1">
                  Existe en el histórico, pero no está marcada como FINAL. Puede ser una versión anterior o
                  un borrador que el proponente reemplazó por una más reciente.
                </p>
              </div>
            </div>
          )}

          {/* Datos del proyecto */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-[#00304D]">
              <h2 className="text-white font-bold text-sm uppercase tracking-wide">Datos del Registro</h2>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Row label="Empresa / Proponente" value={result.empresa?.razonSocial} />
              <Row label="NIT" value={result.empresa?.nit} />
              <Row label="Convocatoria" value={result.proyecto?.convocatoria ?? '—'} />
              <Row label="ID del Proyecto" value={result.proyecto?.id} />
              <Row label="Nombre del Proyecto" value={result.proyecto?.nombre}
                fullWidth />
              <Row label="Estado del Proyecto" value={ESTADO_LABELS[result.proyecto?.estado ?? 0] ?? '—'} />
              <Row label="N° de Versión" value={result.version ? `V${result.version.numero}` : '—'} />
              <Row label="Fecha de Confirmación" value={fmtDateTimeFull(result.version?.fecha ?? null)} />
              {result.version?.esFinal && result.version.finalFecha && (
                <Row label="Marcada como FINAL el" value={fmtDateTimeFull(result.version.finalFecha)} fullWidth />
              )}
              {result.version?.hash && (
                <div className="col-span-1 sm:col-span-2 mt-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">SHA-256 del snapshot</p>
                  <p className="text-[10px] font-mono text-neutral-500 break-all bg-neutral-50 border border-neutral-100 rounded-lg px-3 py-2">
                    {result.version.hash}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900">
            <div className="flex items-start gap-2">
              <ShieldAlert size={14} className="text-blue-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Esta verificación demuestra que el código fue generado por el sistema SEP y corresponde a un
                snapshot inmutable guardado al momento de la confirmación. El hash SHA-256 garantiza que el contenido
                no fue alterado.
              </p>
            </div>
          </div>

          <Link href="/verificar"
            className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-[#00304D] underline hover:text-[#004a76]">
            ← Verificar otro código
          </Link>
        </>
      )}
    </div>
  )
}

function Row({ label, value, fullWidth }: { label: string; value: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? 'col-span-1 sm:col-span-2' : ''}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="text-sm font-medium text-neutral-800 break-words">{value || '—'}</p>
    </div>
  )
}
