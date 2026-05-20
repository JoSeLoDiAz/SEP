'use client'

import api from '@/lib/api'
import { ConvenioNav } from '@/components/layout/convenio-nav'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  AlertCircle, ArrowLeft, Building2, CheckCircle2, Loader2, Save,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const TITLE = '#00304D'

interface TipoDoc { id: number; nombre: string }
interface Tamano { id: number; nombre: string }
interface EmpresaBenef {
  id: number
  tipoDocumentoId: number
  tipoDocumento: string | null
  numero: string | null
  digitoVerificacion: string | null
  nombre: string | null
  tamanoEmpresaId: number | null
  tamanoEmpresa: string | null
}

type EstadoBusqueda = 'inicial' | 'buscando' | 'encontrada' | 'no-encontrada'

export default function EmpresasBeneficiariasPage() {
  const params = useParams()
  const proyectoId = Number(params?.id)

  const [tiposDoc, setTiposDoc] = useState<TipoDoc[]>([])
  const [tamanos, setTamanos] = useState<Tamano[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null)

  // Form
  const [fTipoDocId, setFTipoDocId] = useState(0)
  const [fNumero, setFNumero] = useState('')
  const [fNombre, setFNombre] = useState('')
  const [fDigito, setFDigito] = useState('')
  const [fTamanoId, setFTamanoId] = useState(0)
  const [estadoBusqueda, setEstadoBusqueda] = useState<EstadoBusqueda>('inicial')
  const [encontrada, setEncontrada] = useState<EmpresaBenef | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setCargando(true); setError(null)
    Promise.all([
      api.get<TipoDoc[]>('/auth/tipos-documento?para=empresa').catch(() => ({ data: [] })),
      api.get<Tamano[]>('/empresa/tamanos').catch(() => ({ data: [] })),
    ]).then(([rT, rTam]) => {
      setTiposDoc(rT.data ?? [])
      setTamanos(rTam.data ?? [])
      const nit = (rT.data ?? []).find(t => /nit/i.test(t.nombre))
      if (nit) setFTipoDocId(nit.id)
    }).catch(() => setError('No se pudieron cargar los catálogos.'))
      .finally(() => setCargando(false))
  }, [])

  // Resetear estado de búsqueda cuando cambian tipoDoc o número.
  function onCambioIdentificacion(setter: () => void) {
    setter()
    setEstadoBusqueda('inicial')
    setEncontrada(null)
  }

  async function buscarPorNit() {
    if (!fTipoDocId || !fNumero.trim()) { setEstadoBusqueda('inicial'); setEncontrada(null); return }
    setEstadoBusqueda('buscando')
    try {
      const r = await api.get<EmpresaBenef | null>('/convenios/beneficiarios/empresas/buscar', {
        params: { tipoDocumentoId: fTipoDocId, numero: fNumero.trim() },
      })
      if (r.data) {
        setEncontrada(r.data)
        setFNombre(r.data.nombre ?? '')
        setFDigito(r.data.digitoVerificacion ?? '')
        setFTamanoId(r.data.tamanoEmpresaId ?? 0)
        setEstadoBusqueda('encontrada')
      } else {
        setEncontrada(null)
        setEstadoBusqueda('no-encontrada')
      }
    } catch {
      setEstadoBusqueda('inicial')
      setEncontrada(null)
    }
  }

  async function registrar() {
    if (!fTipoDocId) return setToast({ tipo: 'error', msg: 'Seleccione el tipo de identificación.' })
    if (!fNumero.trim()) return setToast({ tipo: 'error', msg: 'Ingrese el número de identificación.' })
    if (!fNombre.trim()) return setToast({ tipo: 'error', msg: 'Ingrese el nombre de la empresa.' })
    if (!fTamanoId) return setToast({ tipo: 'error', msg: 'Seleccione el tamaño de la empresa.' })
    setGuardando(true)
    try {
      const r = await api.post<{ mensaje: string; accion: string; empresaId: number }>('/convenios/beneficiarios/empresas', {
        tipoDocumentoId: fTipoDocId,
        numero: fNumero.trim(),
        digitoVerificacion: fDigito.trim() || null,
        nombre: fNombre.trim(),
        tamanoEmpresaId: fTamanoId,
      })
      setToast({ tipo: 'success', msg: r.data.mensaje })
      // Tras guardar, queda "encontrada" (ya existe en BD).
      setEncontrada({
        id: r.data.empresaId,
        tipoDocumentoId: fTipoDocId,
        tipoDocumento: tiposDoc.find(t => t.id === fTipoDocId)?.nombre ?? null,
        numero: fNumero.trim(),
        digitoVerificacion: fDigito.trim() || null,
        nombre: fNombre.trim(),
        tamanoEmpresaId: fTamanoId,
        tamanoEmpresa: tamanos.find(t => t.id === fTamanoId)?.nombre ?? null,
      })
      setEstadoBusqueda('encontrada')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo registrar la empresa.' })
    } finally { setGuardando(false) }
  }

  function limpiar() {
    setFNumero(''); setFNombre(''); setFDigito(''); setFTamanoId(0)
    setEncontrada(null); setEstadoBusqueda('inicial')
    const nit = tiposDoc.find(t => /nit/i.test(t.nombre))
    setFTipoDocId(nit?.id ?? 0)
  }

  return (
    <div className="min-h-screen bg-[#F0F4F8] p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <ConvenioNav proyectoId={proyectoId} />

        {toast && (
          <ToastBetowa show onClose={() => setToast(null)} tipo={toast.tipo} titulo={toast.tipo === 'success' ? 'Listo' : 'Error'} mensaje={toast.msg} duration={4000} />
        )}

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl shadow-sm" style={{ backgroundColor: TITLE }}>
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: TITLE }}>Empresas beneficiarias</h1>
            <p className="text-xs text-neutral-500">Escribe el NIT para verificar si la empresa ya está registrada. Si existe se actualizan sus datos; si no, se crea. El NIT no se puede duplicar.</p>
          </div>
          <Link href={`/panel/convenios/${proyectoId}/beneficiarios`} className="ml-auto inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D]">
            <ArrowLeft size={13} /> Volver a beneficiarios
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {cargando ? (
          <div className="flex items-center gap-2 py-12 justify-center text-neutral-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        ) : (
          <section className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#00304D]">Registrar / actualizar empresa beneficiaria</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Tipo de documento *</label>
                <select value={fTipoDocId} onChange={e => onCambioIdentificacion(() => setFTipoDocId(Number(e.target.value)))}
                  className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]">
                  <option value={0}>— Seleccione —</option>
                  {tiposDoc.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Número de registro tributario *</label>
                <input type="text" value={fNumero}
                  onChange={e => onCambioIdentificacion(() => setFNumero(e.target.value.replace(/\D/g, '')))}
                  onBlur={buscarPorNit} placeholder="899999034" maxLength={20}
                  className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Nombre de la empresa *</label>
                <textarea value={fNombre} onChange={e => setFNombre(e.target.value)} rows={2} maxLength={200}
                  placeholder="SERVICIO NACIONAL DE APRENDIZAJE - SENA"
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Dígito de verificación</label>
                  <input type="text" value={fDigito} onChange={e => setFDigito(e.target.value.replace(/\D/g, '').slice(0, 1))} maxLength={1}
                    placeholder="1" className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Tamaño de la empresa *</label>
                  <select value={fTamanoId} onChange={e => setFTamanoId(Number(e.target.value))}
                    className="h-10 rounded-xl border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]">
                    <option value={0}>— Seleccione —</option>
                    {tamanos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Resultado de la búsqueda por NIT */}
            {estadoBusqueda === 'buscando' && (
              <p className="text-xs text-neutral-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Verificando el NIT…</p>
            )}
            {estadoBusqueda === 'encontrada' && encontrada && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle size={14} /> Esta empresa <strong>ya está registrada</strong>. Si guardas, se actualizan sus datos (no se crea un registro nuevo).
              </div>
            )}
            {estadoBusqueda === 'no-encontrada' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 size={14} /> Este NIT <strong>no está registrado</strong>. Completa los datos y se creará la empresa beneficiaria.
              </div>
            )}

            <div className="flex items-center gap-3 justify-end pt-1">
              <button onClick={limpiar} className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-600 hover:bg-neutral-100 transition">Limpiar</button>
              <button onClick={registrar} disabled={guardando}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-40"
                style={{ backgroundColor: '#39A900' }}>
                {guardando ? <><Loader2 size={13} className="animate-spin" /> Guardando…</> : <><Save size={13} /> {estadoBusqueda === 'encontrada' ? 'Actualizar' : 'Registrar'}</>}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
