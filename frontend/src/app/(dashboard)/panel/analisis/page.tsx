'use client'

import api from '@/lib/api'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { BarChart2, ChevronDown, Loader2, Save, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Lookup { id: number; nombre: string }
interface Item   { id: number; nombre: string }

interface Analisis {
  objeto?: string; productos?: string; situacion?: string
  papel?: string;  retos?: string;     experiencia?: string
  eslabones?: string; interacciones?: string
}

const inputCls   = 'w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 focus:border-[#00304D] transition bg-white'
const selectCls  = inputCls + ' appearance-none cursor-pointer'
const textareaCls = 'w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/30 focus:border-[#00304D] transition bg-white resize-y min-h-[120px]'

function SectionCard({ title, color = '#00304D', children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5" style={{ backgroundColor: color }}>
        <BarChart2 size={18} className="text-white" />
        <h2 className="text-white font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, req, hint, children }: { label: string; req?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-semibold text-neutral-700">
          {label}{req && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {hint && <span className="text-xs text-neutral-400 flex-shrink-0">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export default function AnalisisPage() {
  const [loading, setLoading]       = useState(true)
  const [guardando, setGuardando]   = useState(false)

  const [objeto,        setObjeto]        = useState('')
  const [productos,     setProductos]     = useState('')
  const [situacion,     setSituacion]     = useState('')
  const [papel,         setPapel]         = useState('')
  const [retos,         setRetos]         = useState('')
  const [experiencia,   setExperiencia]   = useState('')
  const [eslabones,     setEslabones]     = useState('')
  const [interacciones, setInteracciones] = useState('')

  const [sectores,    setSectores]    = useState<Lookup[]>([])
  const [subsectores, setSubsectores] = useState<Lookup[]>([])

  const [sectPertId,  setSectPertId]  = useState(0)
  const [subsectPertId, setSubsectPertId] = useState(0)
  const [sectRepId,   setSectRepId]   = useState(0)
  const [subsectRepId, setSubsectRepId] = useState(0)

  const [sectoresPertenece,    setSectoresPertenece]    = useState<Item[]>([])
  const [subsectoresPertenece, setSubsectoresPertenece] = useState<Item[]>([])
  const [sectoresRepresenta,   setSectoresRepresenta]   = useState<Item[]>([])
  const [subsectoresRepresenta, setSubsectoresRepresenta] = useState<Item[]>([])

  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)
  const toastKey = useRef(0)
  const [toastKey2, setToastKey2] = useState(0)

  function showToast(tipo: 'success' | 'error', msg: string) {
    toastKey.current++
    setToast({ tipo, msg })
    setToastKey2(toastKey.current)
  }

  useEffect(() => { document.title = 'Análisis del Proponente | SEP' }, [])

  useEffect(() => {
    async function load() {
      try {
        const [analRes, sectRes, subsectRes, spRes, subspRes, srRes, subsrRes] = await Promise.all([
          api.get<Analisis>('/empresa/analisis'),
          api.get<Lookup[]>('/empresa/sectores'),
          api.get<Lookup[]>('/empresa/subsectores'),
          api.get<Item[]>('/empresa/sectores-pertenece'),
          api.get<Item[]>('/empresa/subsectores-pertenece'),
          api.get<Item[]>('/empresa/sectores-representa'),
          api.get<Item[]>('/empresa/subsectores-representa'),
        ])
        const d = analRes.data
        setObjeto(d.objeto ?? '')
        setProductos(d.productos ?? '')
        setSituacion(d.situacion ?? '')
        setPapel(d.papel ?? '')
        setRetos(d.retos ?? '')
        setExperiencia(d.experiencia ?? '')
        setEslabones(d.eslabones ?? '')
        setInteracciones(d.interacciones ?? '')
        setSectores(sectRes.data)
        setSubsectores(subsectRes.data)
        setSectoresPertenece(spRes.data)
        setSubsectoresPertenece(subspRes.data)
        setSectoresRepresenta(srRes.data)
        setSubsectoresRepresenta(subsrRes.data)
      } catch {
        showToast('error', 'Error al cargar los datos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])


  const LIMITS_GEN: [string, string, number][] = [
    [objeto,      'Objeto social', 5000],
    [productos,   'Productos y/o servicios', 3000],
    [situacion,   'Situación actual y proyección', 3000],
    [papel,       'Papel en el sector', 3000],
    [retos,       'Retos estratégicos', 3000],
    [experiencia, 'Experiencia en actividades formativas', 3000],
  ]

  const LIMITS_CAD: [string, string, number][] = [
    [eslabones,    'Eslabones de la cadena productiva', 5000],
    [interacciones,'Interacciones con otros actores', 3000],
  ]

  async function guardarGeneralidades() {
    if (!objeto.trim() || !productos.trim() || !situacion.trim() ||
        !papel.trim() || !retos.trim() || !experiencia.trim()) {
      showToast('error', 'Complete todos los campos obligatorios antes de guardar')
      return
    }
    for (const [val, label, max] of LIMITS_GEN) {
      if (val.length > max) {
        showToast('error', `El campo "${label}" excede ${max.toLocaleString()} caracteres`)
        return
      }
    }
    setGuardando(true)
    try {
      await api.put('/empresa/analisis', {
        objeto, productos, situacion, papel, retos, experiencia, eslabones, interacciones,
      })
      showToast('success', 'Generalidades guardadas correctamente')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar'
      showToast('error', msg)
    } finally {
      setGuardando(false)
    }
  }

  async function guardarCadena() {
    if (!eslabones.trim() || !interacciones.trim()) {
      showToast('error', 'Complete todos los campos obligatorios antes de guardar')
      return
    }
    for (const [val, label, max] of LIMITS_CAD) {
      if (val.length > max) {
        showToast('error', `El campo "${label}" excede ${max.toLocaleString()} caracteres`)
        return
      }
    }
    setGuardando(true)
    try {
      await api.put('/empresa/analisis', {
        objeto, productos, situacion, papel, retos, experiencia, eslabones, interacciones,
      })
      showToast('success', 'Cadena productiva guardada correctamente')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar'
      showToast('error', msg)
    } finally {
      setGuardando(false)
    }
  }

  const bloques = [
    { label: 'Sector al que Pertenece la Entidad Proponente', colLabel: 'Sector', options: sectores, selId: sectPertId, setSelId: setSectPertId, items: sectoresPertenece, setItems: setSectoresPertenece, endpoint: 'sectores-pertenece', bodyKey: 'sectorId' },
    { label: 'Subsector al que Pertenece la Entidad Proponente', colLabel: 'Subsector', options: subsectores, selId: subsectPertId, setSelId: setSubsectPertId, items: subsectoresPertenece, setItems: setSubsectoresPertenece, endpoint: 'subsectores-pertenece', bodyKey: 'subsectorId' },
    { label: 'Sector(es) al(los) que Representa la Entidad Proponente', colLabel: 'Sector', options: sectores, selId: sectRepId, setSelId: setSectRepId, items: sectoresRepresenta, setItems: setSectoresRepresenta, endpoint: 'sectores-representa', bodyKey: 'sectorId' },
    { label: 'Subsector(es) al(los) que Representa la Entidad Proponente', colLabel: 'Subsector', options: subsectores, selId: subsectRepId, setSelId: setSubsectRepId, items: subsectoresRepresenta, setItems: setSubsectoresRepresenta, endpoint: 'subsectores-representa', bodyKey: 'subsectorId' },
  ]

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 size={32} className="animate-spin text-[#00304D]" />
    </div>
  )

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa key={toastKey2} show onClose={() => setToast(null)}
          tipo={toast.tipo} titulo={toast.tipo === 'success' ? 'Listo' : 'Error'}
          mensaje={toast.msg} duration={4500} />
      )}

      {/* Header */}
      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex items-center gap-3">
        <BarChart2 size={22} className="text-white" />
        <h1 className="text-white font-bold text-base">Análisis del Proponente</h1>
      </div>

      {/* ── Generalidades ─────────────────────────────────────────── */}
      <SectionCard title="Generalidades del Proponente">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Field label="Objeto social del proponente" req hint="Máx. 5000 caracteres">
            <textarea maxLength={5000} value={objeto} onChange={e => setObjeto(e.target.value)} className={textareaCls} rows={5} placeholder="Describa el objeto social..." />
            <span className="text-xs text-neutral-400 text-right">{objeto.length}/5000</span>
          </Field>
          <Field label="Productos y/o servicios ofrecidos y mercado al que van dirigidos" req hint="Máx. 3000 caracteres">
            <textarea maxLength={3000} value={productos} onChange={e => setProductos(e.target.value)} className={textareaCls} rows={5} placeholder="Describa los productos y/o servicios..." />
            <span className="text-xs text-neutral-400 text-right">{productos.length}/3000</span>
          </Field>
          <Field label="Situación actual y proyección del proponente" req hint="Máx. 3000 caracteres">
            <textarea maxLength={3000} value={situacion} onChange={e => setSituacion(e.target.value)} className={textareaCls} rows={5} placeholder="Describa la situación actual y proyección..." />
            <span className="text-xs text-neutral-400 text-right">{situacion.length}/3000</span>
          </Field>
          <Field label="Papel del proponente en el sector y/o región que pertenece o representa" req hint="Máx. 3000 caracteres">
            <textarea maxLength={3000} value={papel} onChange={e => setPapel(e.target.value)} className={textareaCls} rows={5} placeholder="Describa el papel en el sector..." />
            <span className="text-xs text-neutral-400 text-right">{papel.length}/3000</span>
          </Field>
          <Field label="Retos estratégicos del proponente, vinculados a la formación" req hint="Máx. 3000 caracteres">
            <textarea maxLength={3000} value={retos} onChange={e => setRetos(e.target.value)} className={textareaCls} rows={5} placeholder="Describa los retos estratégicos..." />
            <span className="text-xs text-neutral-400 text-right">{retos.length}/3000</span>
          </Field>
          <Field label="Experiencia del proponente en actividades formativas" req hint="Máx. 3000 caracteres">
            <textarea maxLength={3000} value={experiencia} onChange={e => setExperiencia(e.target.value)} className={textareaCls} rows={5} placeholder="Describa la experiencia en actividades formativas..." />
            <span className="text-xs text-neutral-400 text-right">{experiencia.length}/3000</span>
          </Field>
        </div>
        <div className="flex justify-end mt-5">
          <button onClick={guardarGeneralidades} disabled={guardando}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#00304D] hover:bg-[#004a76] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar generalidades
          </button>
        </div>
      </SectionCard>

      {/* ── Sectores y Subsectores ────────────────────────────────── */}
      <SectionCard title="Sectores y Subsectores de la Entidad Proponente" color="#00304D">
        <div className="flex flex-col gap-6">
          {bloques.map(bloque => (
            <div key={bloque.endpoint} className="flex flex-col gap-3 border-b border-neutral-100 pb-5 last:border-0 last:pb-0">
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-neutral-600 mb-1 block">{bloque.label}</label>
                  <div className="relative">
                    <select value={bloque.selId} onChange={e => bloque.setSelId(Number(e.target.value))} className={selectCls}>
                      <option value={0}>Seleccionar…</option>
                      {bloque.options.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                  </div>
                </div>
                <button type="button" disabled={!bloque.selId}
                  onClick={async () => {
                    try {
                      await api.post(`/empresa/${bloque.endpoint}`, { [bloque.bodyKey]: bloque.selId })
                      const res = await api.get<Item[]>(`/empresa/${bloque.endpoint}`)
                      bloque.setItems(res.data); bloque.setSelId(0)
                      showToast('success', `${bloque.colLabel} registrado`)
                    } catch (e: unknown) {
                      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al registrar'
                      showToast('error', msg)
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#39A900] hover:bg-[#2d8700] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
                >Agregar</button>
              </div>
              {bloque.items.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-neutral-200">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-[#00304D] text-white">
                      <th className="text-left px-4 py-2 font-semibold">{bloque.colLabel}</th>
                      <th className="text-center px-4 py-2 font-semibold w-24">Eliminar</th>
                    </tr></thead>
                    <tbody>{bloque.items.map((item, i) => (
                      <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                        <td className="px-4 py-2 text-neutral-700">{item.nombre}</td>
                        <td className="px-4 py-2 text-center">
                          <button type="button" onClick={async () => {
                            try {
                              await api.delete(`/empresa/${bloque.endpoint}/${item.id}`)
                              bloque.setItems(bloque.items.filter(x => x.id !== item.id))
                              showToast('success', `${bloque.colLabel} eliminado`)
                            } catch { showToast('error', 'Error al eliminar') }
                          }} className="text-red-500 hover:text-red-700 transition-colors p-1"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Cadena productiva ─────────────────────────────────────── */}
      <SectionCard title="Cadena Productiva e Interacciones">
        <div className="flex flex-col gap-5">
          <Field label="Identificación de los eslabones de la cadena productiva del proponente" req hint="Máx. 5000 caracteres">
            <p className="text-xs text-neutral-500 -mt-0.5 mb-1">
              Indique expresamente si contempla la participación de actores de la economía campesina y/o popular, precisando su rol.
            </p>
            <textarea maxLength={5000} value={eslabones} onChange={e => setEslabones(e.target.value)} className={textareaCls} rows={6} placeholder="Describa los eslabones de la cadena productiva..." />
            <span className="text-xs text-neutral-400 text-right">{eslabones.length}/5000</span>
          </Field>
          <Field label="Descripción de las interacciones del proponente con otros actores" req hint="Máx. 3000 caracteres">
            <p className="text-xs text-neutral-500 -mt-0.5 mb-1">
              Empresas, asociaciones, instituciones de apoyo, universidades, centros de investigación, etc.
            </p>
            <textarea maxLength={3000} value={interacciones} onChange={e => setInteracciones(e.target.value)} className={textareaCls} rows={5} placeholder="Describa las interacciones con otros actores..." />
            <span className="text-xs text-neutral-400 text-right">{interacciones.length}/3000</span>
          </Field>
          <div className="flex justify-end">
            <button onClick={guardarCadena} disabled={guardando}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#00304D] hover:bg-[#004a76] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar análisis
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
