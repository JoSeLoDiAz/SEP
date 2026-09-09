'use client'

import api from '@/lib/api'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  CheckCircle2, ChevronRight, ClipboardList, Clock, Loader2, MessageSquareQuote,
  ShieldCheck, Users,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

interface Ciclo {
  participacionId: number
  anio: number
  convocatoriaNombre: string | null
  rolNombre: string | null
  areaNombre: string | null
  duracionMinutos: number
  nombres: string
  sinCiclo?: boolean
}

interface Persona {
  asignacionId: number
  estado: string
  nombre: string
  rolNombre: string | null
  areaNombre: string | null
}

interface Asignaciones {
  total: number
  pendientes: number
  enviadas: number
  grupos: Array<{ rol: string; personas: Persona[] }>
}

// el ciclo sale del JWT en el backend, no de la URL: nadie puede ver el de otro
export default function MiPanelRetroalimentacionPage() {
  const router = useRouter()
  const [ciclo, setCiclo] = useState<Ciclo | null>(null)
  const [asignaciones, setAsignaciones] = useState<Asignaciones | null>(null)
  const [cargando, setCargando] = useState(true)
  const [iniciando, setIniciando] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const c = await api.get<Ciclo>('/retroalimentacion/mi-ciclo')
        if (!vivo) return
        if (c.data?.sinCiclo) { setCiclo(null); return }
        setCiclo(c.data)
        const a = await api.get<Asignaciones>('/retroalimentacion/mis-asignaciones')
        if (vivo) setAsignaciones(a.data)
      } catch (err) {
        if (vivo) setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo cargar tu panel') })
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [])

  async function comenzar() {
    setIniciando(true)
    try {
      const r = await api.post<{ retroSesionId: number }>('/retroalimentacion/sesion')
      router.push(`/panel/retroalimentacion/formulario?sesion=${r.data.retroSesionId}`)
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo iniciar la sesión') })
      setIniciando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 p-10 text-sm text-neutral-500">
        <Loader2 size={14} className="animate-spin" /> Cargando tu panel…
      </div>
    )
  }

  if (!ciclo) {
    return (
      <div className="p-5 sm:p-7 xl:p-10">
        <div className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <ClipboardList size={34} className="mx-auto text-neutral-300" />
          <h1 className="mt-4 text-lg font-bold text-neutral-700">
            No tienes retroalimentación pendiente
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
            Esto aparece cuando el equipo del banco de evaluadores abre el instrumento
            del ciclo en el que participaste. Si crees que deberías tener acceso,
            escríbeles.
          </p>
        </div>
      </div>
    )
  }

  const completo = asignaciones != null && asignaciones.total > 0 && asignaciones.pendientes === 0
  const primerNombre = ciclo.nombres.split(/\s+/)[0] ?? ciclo.nombres

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-7 xl:p-10">
      {toast && (
        <ToastBetowa
          show onClose={() => setToast(null)} tipo={toast.tipo}
          titulo={toast.tipo === 'success' ? 'Listo' : 'Error'} mensaje={toast.msg} duration={4000}
        />
      )}

      <div
        className="relative overflow-hidden rounded-3xl shadow-lg"
        style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #001f33 70%, #000a14 100%)` }}
      >
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="relative px-6 py-7 sm:px-8">
          <p className="text-xs text-white/70">
            {ciclo.convocatoriaNombre ?? `Ciclo ${ciclo.anio}`}
          </p>
          <h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">
            Hola, {primerNombre}
          </h1>
          <p className="mt-1 text-sm text-white/80">
            {[ciclo.rolNombre, ciclo.areaNombre].filter(Boolean).join(' · ') || 'Participante'}
            {' · '}{ciclo.anio}
          </p>
        </div>
      </div>

      {asignaciones && asignaciones.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-12 text-center">
          <Users size={28} className="mx-auto text-neutral-300" />
          <p className="mt-3 text-sm font-semibold text-neutral-600">Aún no te asignaron personas</p>
          <p className="mt-1 text-[12px] text-neutral-400">
            El equipo del banco todavía no generó la matriz de este ciclo.
          </p>
        </div>
      ) : completo ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-12 text-center">
          <CheckCircle2 size={32} className="mx-auto text-emerald-600" />
          <p className="mt-3 text-base font-bold text-emerald-800">
            Ya completaste tus retroalimentaciones
          </p>
          <p className="mt-1 text-[13px] text-emerald-700">
            Enviaste las {asignaciones?.enviadas} que te correspondían. Gracias.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Kpi icono={<Users size={15} />} label="Asignadas" valor={asignaciones?.total ?? 0} />
            <Kpi icono={<ClipboardList size={15} />} label="Pendientes" valor={asignaciones?.pendientes ?? 0} alerta />
            <Kpi icono={<CheckCircle2 size={15} />} label="Enviadas" valor={asignaciones?.enviadas ?? 0} />
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Clock size={18} className="mt-0.5 shrink-0" style={{ color: PRIMARY }} />
              <div>
                <p className="text-sm font-semibold text-neutral-800">
                  Se diligencia de una sola vez
                </p>
                <p className="text-[12px] text-neutral-500">
                  Al comenzar arranca un cronómetro de referencia de {ciclo.duracionMinutos} minutos.
                  Pasarse no bloquea el envío, solo queda registrado.
                </p>
              </div>
            </div>
            <button
              onClick={comenzar}
              disabled={iniciando}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: INSTITUTIONAL }}
            >
              {iniciando ? <Loader2 size={15} className="animate-spin" /> : <MessageSquareQuote size={15} />}
              Comenzar
              <ChevronRight size={15} />
            </button>
          </div>

          <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3">
              <ShieldCheck size={16} style={{ color: PRIMARY }} />
              <h2 className="text-sm font-bold text-neutral-800">Personas por retroalimentar</h2>
            </header>
            {asignaciones?.grupos.map(g => (
              <div key={g.rol} className="border-b border-neutral-100 px-5 py-4 last:border-0">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  {g.rol} · {g.personas.length}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {g.personas.map(p => (
                    <li
                      key={p.asignacionId}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] ${
                        p.estado === 'ENVIADA'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-700'
                      }`}
                    >
                      {p.estado === 'ENVIADA' && <CheckCircle2 size={12} className="text-emerald-600" />}
                      {p.nombre}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <p className="text-[11px] text-neutral-400">
            Tus respuestas son anónimas para la persona evaluada: ella verá el promedio y los
            comentarios, nunca quién los escribió.
          </p>
        </>
      )}
    </div>
  )
}

function Kpi({
  icono, label, valor, alerta,
}: { icono: React.ReactNode; label: string; valor: number; alerta?: boolean }) {
  const resaltar = alerta && valor > 0
  return (
    <div className={`rounded-2xl border bg-white px-4 py-3 shadow-sm ${
      resaltar ? 'border-amber-300 bg-amber-50/40' : 'border-neutral-200'
    }`}>
      <div className="flex items-center gap-1.5 text-neutral-500">
        {icono}
        <p className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-bold leading-none" style={{ color: PRIMARY }}>{valor}</p>
    </div>
  )
}

function mensajeError(err: unknown, porDefecto: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? porDefecto
}
