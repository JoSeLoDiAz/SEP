'use client'

import api from '@/lib/api'
import { aTitleCase } from '@/lib/title-case'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { ArrowLeft, ChevronRight, Loader2, Megaphone, Save } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const PRIMARY = '#00304D'
const INSTITUTIONAL = '#39a900'

interface RespCrear { id: number }

const MODALIDADES = ['PRESENCIAL', 'PAT', 'VIRTUAL', 'MIXTA'] as const
const PERIODOS = ['01', '02'] as const

export default function NuevaConvocatoriaPage() {
  const router = useRouter()
  const currentYear = new Date().getFullYear()

  const [anio, setAnio] = useState<string>(String(currentYear))
  const [periodo, setPeriodo] = useState<string>('')
  const [nombre, setNombre] = useState('')
  const [modalidad, setModalidad] = useState<string>('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  const anioMin = 2020
  const anioMax = currentYear + 2

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const anioNum = Number(anio)
    if (!Number.isFinite(anioNum) || anioNum < anioMin || anioNum > anioMax) {
      return setToast({ tipo: 'error', msg: `El año debe estar entre ${anioMin} y ${anioMax}` })
    }
    if (!nombre.trim()) {
      return setToast({ tipo: 'error', msg: 'El nombre es obligatorio' })
    }
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      return setToast({ tipo: 'error', msg: 'La fecha de fin no puede ser anterior a la fecha de inicio' })
    }

    setLoading(true)
    try {
      const res = await api.post<RespCrear>('/evaluadores/convocatorias', {
        anio: anioNum,
        periodo: periodo || null,
        nombre: nombre.trim(),
        modalidadPart: modalidad || null,
        fechaInicio: fechaInicio || null,
        fechaFin: fechaFin || null,
        observaciones: observaciones.trim() || null,
      })
      setToast({ tipo: 'success', msg: 'Convocatoria creada' })
      setTimeout(() => router.push(`/panel/evaluadores/convocatorias/${res.data.id}`), 700)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo crear la convocatoria' })
    } finally {
      setLoading(false)
    }
  }

  const label = 'block text-xs font-semibold text-neutral-700 mb-1'
  const input = 'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40 disabled:bg-neutral-50 disabled:text-neutral-500'
  const textarea = `${input} resize-y`

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6 max-w-4xl">
      {toast && (
        <ToastBetowa
          show
          onClose={() => setToast(null)}
          tipo={toast.tipo}
          titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg}
          duration={4000}
        />
      )}

      <div className="rounded-2xl px-6 py-4 flex items-center gap-3 text-white shadow-md" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #001f33 100%)` }}>
        <Megaphone size={22} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-white/70 text-xs flex-wrap">
            <Link href="/panel/evaluadores" className="hover:text-white">Banco de Evaluadores</Link>
            <ChevronRight size={12} />
            <Link href="/panel/evaluadores/convocatorias" className="hover:text-white">Convocatorias</Link>
            <ChevronRight size={12} />
            <span>Nueva</span>
          </div>
          <h1 className="font-bold text-base sm:text-lg">Nueva convocatoria</h1>
        </div>
      </div>

      <Link href="/panel/evaluadores/convocatorias" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D] w-fit">
        <ArrowLeft size={13} />
        Volver al listado
      </Link>

      <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
        <section>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-3">Datos generales</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Año *</label>
              <input
                type="number"
                min={anioMin}
                max={anioMax}
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
                className={input}
                required
              />
              <p className="text-[10px] text-neutral-400 mt-0.5">Rango permitido: {anioMin} - {anioMax}</p>
            </div>
            <div>
              <label className={label}>Período</label>
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className={input}
              >
                <option value="">— Sin período —</option>
                {PERIODOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Nombre de la convocatoria *</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onBlur={() => setNombre(v => aTitleCase(v) ?? '')}
                placeholder="Ej: Convocatoria Ratificación Evaluadores 2026"
                className={input}
                maxLength={200}
                required
              />
            </div>
            <div>
              <label className={label}>Modalidad</label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value)}
                className={input}
              >
                <option value="">— Sin modalidad —</option>
                {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div />
            <div>
              <label className={label}>Fecha de inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Fecha de fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className={input}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Contexto, notas o alcance de la convocatoria..."
                className={textarea}
              />
              <p className="text-[10px] text-neutral-400 mt-0.5">Máximo 1000 caracteres.</p>
            </div>
          </div>
          <p className="text-[11px] text-neutral-500 mt-4">
            Los documentos institucionales (invitación, ratificación, listados PAT/presencial, Excel de selección…) se cargan después desde la ficha de la convocatoria.
          </p>
        </section>

        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
          <Link
            href="/panel/evaluadores/convocatorias"
            className="px-4 py-2 border border-neutral-300 text-neutral-700 text-sm font-semibold rounded-lg hover:bg-neutral-50 transition"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90"
            style={{ backgroundColor: INSTITUTIONAL }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Crear convocatoria
          </button>
        </div>
      </form>
    </div>
  )
}
