'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BadgeCheck, Download, FileText, GraduationCap, Loader2, ShieldAlert, UserCircle2,
} from 'lucide-react'
import api from '@/lib/api'
import { descargarArchivoConNombreDelServidor } from '@/lib/descargar-archivo'
import type { MiFicha } from '@/lib/types/mi-expediente'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { PRIMARY, mensajeError } from '@/components/mi-expediente/comunes'
import TabPerfil from '@/components/mi-expediente/tab-perfil'
import TabHojaVida from '@/components/mi-expediente/tab-hoja-vida'
import TabDocumentos from '@/components/mi-expediente/tab-documentos'
import TabTrayectoria from '@/components/mi-expediente/tab-trayectoria'

const TABS = [
  { id: 'trayectoria', label: 'Mi trayectoria', icon: BadgeCheck },
  { id: 'perfil', label: 'Mi perfil', icon: UserCircle2 },
  { id: 'hoja-vida', label: 'Hoja de vida', icon: GraduationCap },
  { id: 'documentos', label: 'Mis documentos', icon: FileText },
] as const

type TabId = (typeof TABS)[number]['id']

export default function MiExpedientePage() {
  const [ficha, setFicha] = useState<MiFicha | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errMsg, setErrMsg] = useState('')
  const [tab, setTab] = useState<TabId>('trayectoria')
  const [recarga, setRecarga] = useState(0)
  const [bajandoPdf, setBajandoPdf] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  const recargar = useCallback(() => setRecarga(n => n + 1), [])

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true)
      try {
        const r = await api.get<MiFicha>('/mi-expediente')
        if (vivo) { setFicha(r.data); setErrMsg('') }
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (vivo) {
          setErrMsg(status === 403
            ? mensajeError(err, 'Tu cuenta no está vinculada a una ficha del banco de evaluadores.')
            : mensajeError(err, 'No se pudo cargar tu expediente.'))
        }
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [recarga])

  async function bajarFicha() {
    setBajandoPdf(true)
    try {
      await descargarArchivoConNombreDelServidor('/mi-expediente/ficha.pdf', 'mi-ficha.pdf', 60_000)
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo generar tu ficha') })
    } finally {
      setBajandoPdf(false)
    }
  }

  if (cargando) {
    return (
      <div className="p-10 flex items-center gap-2 text-neutral-500 text-sm">
        <Loader2 size={14} className="animate-spin" /> Cargando tu expediente...
      </div>
    )
  }

  if (errMsg || !ficha) {
    return (
      <div className="p-5 sm:p-7 xl:p-10">
        <div className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <ShieldAlert size={34} className="mx-auto text-neutral-300" />
          <h1 className="mt-4 text-lg font-bold text-neutral-700">No pudimos abrir tu expediente</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">{errMsg}</p>
        </div>
      </div>
    )
  }

  const nombre = [ficha.nombres, ficha.primerApellido, ficha.segundoApellido]
    .filter(Boolean).join(' ').trim() || 'Evaluador'
  const inactivo = Number(ficha.activo) !== 1

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa
          show onClose={() => setToast(null)} tipo={toast.tipo}
          titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg} duration={3500}
        />
      )}

      <div className="relative overflow-hidden rounded-3xl shadow-lg"
           style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #001f33 70%, #000a14 100%)` }}>
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        <div className="relative px-6 sm:px-8 py-6 flex flex-col sm:flex-row gap-5 sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-white/70 text-xs">Banco de Evaluadores</p>
            <h1 className="text-white font-bold text-xl sm:text-2xl mt-1 leading-tight">{nombre}</h1>
            {ficha.identificacion && (
              <p className="text-white/80 text-sm mt-0.5 font-mono">CC {ficha.identificacion}</p>
            )}
            {inactivo && (
              <span className="mt-2 inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                Ficha inactiva · solo consulta
              </span>
            )}
          </div>
          <button onClick={bajarFicha} disabled={bajandoPdf}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-white text-[#00304D] hover:bg-white/95 text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50">
            {bajandoPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Descargar mi ficha
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto bg-white border border-neutral-200 rounded-2xl p-1.5 shadow-sm">
        {TABS.map(t => {
          const Icon = t.icon
          const activo = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activo ? 'text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
              style={activo ? { backgroundColor: PRIMARY } : undefined}>
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'trayectoria' && <TabTrayectoria setToast={setToast} />}
      {tab === 'perfil' && <TabPerfil ficha={ficha} setToast={setToast} onRecargar={recargar} />}
      {tab === 'hoja-vida' && <TabHojaVida setToast={setToast} />}
      {tab === 'documentos' && <TabDocumentos setToast={setToast} />}
    </div>
  )
}
