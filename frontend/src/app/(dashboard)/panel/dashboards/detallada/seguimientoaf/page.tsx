'use client'

import api from '@/lib/api'
import { Loader2, ShieldAlert, } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface SeguimientoAF {
  proyectoId: number
  empresa: string
  sigla: string
  modalidad: string
  nit: string
  numSecop: string
  departamento: string
  proSeguimiento: string
  beneficiarios: number
  valorProyecto: number
  valorCofinanciacion: number
  valorEspecie: number
  valorDinero: number
  valorContrapartidas: number
  Representante: string
  tipoDocumento: string
  numDocumento: string
  estadoSuscripción: string
  fechaSuscripcion: Date
  polizaCumplimiento: string
  anexo: string
  fechaExpedicion: string
  fechaAprobacion: string
  polizaRCE: string
  anexoRCE: string
  fechaExpRCE: Date
  fechaAproRCE: Date
  aseguradora: string
}


const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

export default function SeguimientoAFPage() {
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  const [seguimientoaf, setSeguimientoAF] = useState<SeguimientoAF[]>([])

  useEffect(() => {
  cargar()
}, [])

  async function cargar() {
  setLoading(true)
  setErrMsg('')

  try {
    const res = await api.get<SeguimientoAF[]>('/dashboards/seguimientoaf')

setSeguimientoAF(res.data)

console.log(res.data)

  } catch (err: unknown) {

    const status = (err as { response?: { status?: number } })?.response?.status

    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message

    if (status === 403)
      setErrMsg('No tienes permisos para acceder al reporte de convenios.')
    else
      setErrMsg(msg ?? 'Error cargando el reporte de Convenios.')

  } finally {
    setLoading(false)
  }
}

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl shadow-lg" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #001f33 70%, #000a14 100%)` }}>
        
      </div>
        <p>Total SeguimientoAF: {seguimientoaf.length}</p>
      <div>

      </div>

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
    </div>
  )
}
