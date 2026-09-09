'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import { AlertCircle, Building2, Loader2, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'

const TITLE = '#00304D'
const SENA = '#39A900'

interface TipoDoc { id: number; nombre: string }
interface Tamano { id: number; nombre: string }
export interface EmpresaBenefGuardada {
  id: number
  tipoDocumentoId: number
  tipoDocumento: string | null
  numero: string | null
  nombre: string | null
  tamanoEmpresaId: number | null
  tamanoEmpresa: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  /** Si vienen, se prerellenan los inputs del modal. */
  initialTipoDocId?: number
  initialNumero?: string
  onSaved: (empresa: EmpresaBenefGuardada) => void
}

export function RegistrarEmpresaModal({ open, onClose, initialTipoDocId, initialNumero, onSaved }: Props) {
  const [tiposDoc, setTiposDoc] = useState<TipoDoc[]>([])
  const [tamanos, setTamanos] = useState<Tamano[]>([])
  const [cargando, setCargando] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [tipoDocId, setTipoDocId] = useState(0)
  const [numero, setNumero] = useState('')
  const [digito, setDigito] = useState('')
  const [nombre, setNombre] = useState('')
  const [tamanoId, setTamanoId] = useState(0)
  const [guardando, setGuardando] = useState(false)

  /* Cargar catálogos y prerellenar al abrir */
  useEffect(() => {
    if (!open) return
    setCargando(true); setErr(null)
    Promise.all([
      api.get<TipoDoc[]>('/auth/tipos-documento?para=empresa').catch(() => ({ data: [] })),
      api.get<Tamano[]>('/empresa/tamanos').catch(() => ({ data: [] })),
    ]).then(([rT, rTam]) => {
      setTiposDoc(rT.data ?? [])
      setTamanos(rTam.data ?? [])
      // Prerellenar: si nos pasaron tipoDoc/numero, usarlos; si no, NIT por defecto.
      const nit = (rT.data ?? []).find(t => /nit/i.test(t.nombre))
      setTipoDocId(initialTipoDocId || nit?.id || 0)
      setNumero(initialNumero ?? '')
      setDigito(''); setNombre(''); setTamanoId(0)
    }).catch(() => setErr('No se pudieron cargar los catálogos.'))
      .finally(() => setCargando(false))
  }, [open, initialTipoDocId, initialNumero])

  async function guardar() {
    setErr(null)
    if (!tipoDocId) { setErr('Selecciona el tipo de identificación.'); return }
    if (!numero.trim()) { setErr('Ingresa el número de identificación.'); return }
    if (!nombre.trim()) { setErr('Ingresa el nombre de la empresa.'); return }
    if (!tamanoId) { setErr('Selecciona el tamaño de la empresa.'); return }
    setGuardando(true)
    try {
      const r = await api.post<{ mensaje: string; accion: string; empresaId: number }>(
        '/convenios/beneficiarios/empresas',
        {
          tipoDocumentoId: tipoDocId,
          numero: numero.trim(),
          digitoVerificacion: digito.trim() || null,
          nombre: nombre.trim(),
          tamanoEmpresaId: tamanoId,
        },
      )
      const empresa: EmpresaBenefGuardada = {
        id: r.data.empresaId,
        tipoDocumentoId: tipoDocId,
        tipoDocumento: tiposDoc.find(t => t.id === tipoDocId)?.nombre ?? null,
        numero: numero.trim(),
        nombre: nombre.trim(),
        tamanoEmpresaId: tamanoId,
        tamanoEmpresa: tamanos.find(t => t.id === tamanoId)?.nombre ?? null,
      }
      onSaved(empresa)
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErr(msg ?? 'No se pudo registrar la empresa.')
    } finally { setGuardando(false) }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0 border-b border-neutral-100"
          style={{ backgroundColor: TITLE }}>
          <div className="p-2 rounded-lg bg-white/10">
            <Building2 size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-base">Registrar empresa beneficiaria</h2>
            <p className="text-white/70 text-xs">Crea o actualiza la empresa donde labora el beneficiario.</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">
          {err && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={16} /> {err}
            </div>
          )}

          {cargando ? (
            <div className="flex items-center gap-2 py-8 justify-center text-neutral-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Cargando…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">Tipo de Documento *</label>
                <select value={tipoDocId} onChange={e => setTipoDocId(Number(e.target.value))}
                  className="h-10 rounded-lg border border-neutral-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]">
                  <option value={0}>— Seleccione —</option>
                  {tiposDoc.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="sm:col-span-5 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">Número *</label>
                <input type="text" value={numero} onChange={e => setNumero(e.target.value.replace(/\D/g, ''))}
                  placeholder="899999034" maxLength={20}
                  className="h-10 rounded-lg border border-neutral-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">DV</label>
                <input type="text" value={digito} onChange={e => setDigito(e.target.value.replace(/\D/g, '').slice(0, 1))}
                  maxLength={1} placeholder="1"
                  className="h-10 rounded-lg border border-neutral-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
              </div>

              <div className="sm:col-span-12 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">Nombre o razón social *</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={200}
                  placeholder="SERVICIO NACIONAL DE APRENDIZAJE - SENA"
                  className="h-10 rounded-lg border border-neutral-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]" />
              </div>

              <div className="sm:col-span-12 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">Tamaño de la empresa *</label>
                <select value={tamanoId} onChange={e => setTamanoId(Number(e.target.value))}
                  className="h-10 rounded-lg border border-neutral-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]">
                  <option value={0}>— Seleccione —</option>
                  {tamanos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>

              <p className="sm:col-span-12 text-[11px] text-neutral-500 italic">
                Si esta empresa ya está registrada con el mismo NIT, se actualizarán sus datos (no se duplica).
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-100 flex items-center justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-semibold text-neutral-600 hover:bg-neutral-100 transition">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando || cargando}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white shadow disabled:opacity-40 transition"
            style={{ backgroundColor: SENA }}>
            {guardando ? <><Loader2 size={13} className="animate-spin" /> Guardando…</> : <><Save size={13} /> Guardar empresa</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}
