'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import { ProyectoTabs } from '@/components/proyecto-tabs'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import { fmtDateTimeFull } from '@/lib/format-date'
import {
  Award, Ban, ChevronRight, Eye, FileText, History, Loader2, MessageSquare,
  RotateCcw, ShieldCheck, Sparkles, User as UserIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const TITLE_COLOR = '#00304D'

interface Version {
  versionId: number
  numero: number
  codigo: string
  fecha: string | null
  usuario: string | null
  comentario: string | null
  estadoAl: number
  hash: string | null
  esFinal: number
  anulada: number
  finalFecha: string | null
  finalUsuario: string | null
  anuladaFecha: string | null
  anuladaUsuario: string | null
}

interface ProyectoMeta {
  proyectoId: number
  nombre: string
  estado: number | null
}

type Action =
  | { type: 'final'; version: Version }
  | { type: 'unfinal'; version: Version }
  | { type: 'anular'; version: Version }
  | { type: 'restaurar'; version: Version }

export default function VersionesProyectoPage() {
  const { id } = useParams<{ id: string }>()
  const proyectoId = Number(id)

  const [versiones, setVersiones] = useState<Version[] | null>(null)
  const [proyecto, setProyecto] = useState<ProyectoMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Toast
  const toastKey = useRef(0)
  const [toastK, setToastK] = useState(0)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error' | 'warning'; titulo: string; msg: string } | null>(null)
  function showToast(tipo: 'success' | 'error' | 'warning', titulo: string, msg: string) {
    toastKey.current++
    setToast({ tipo, titulo, msg })
    setToastK(toastKey.current)
  }

  // Modal de confirmación de acciones (FINAL/anular/restaurar)
  const [pendingAction, setPendingAction] = useState<Action | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  async function cargar() {
    setLoading(true)
    try {
      const [vs, p] = await Promise.all([
        api.get<Version[]>(`/proyectos/${proyectoId}/versiones`).then(r => r.data),
        api.get<ProyectoMeta>(`/proyectos/${proyectoId}`).then(r => r.data).catch(() => null),
      ])
      setVersiones(vs)
      setProyecto(p)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.title = 'Historial de Versiones | SEP'
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId])

  async function ejecutarAccion() {
    if (!pendingAction) return
    setActionLoading(true)
    try {
      const { type, version } = pendingAction
      if (type === 'final') {
        await api.post(`/proyectos/${proyectoId}/versiones/${version.versionId}/final`)
        showToast('success', '¡Proyecto confirmado!', `${version.codigo} quedó marcada como FINAL. Lista para descargar y enviar a SECOP.`)
      } else if (type === 'unfinal') {
        await api.delete(`/proyectos/${proyectoId}/versiones/${version.versionId}/final`)
        showToast('success', 'Proyecto reversado', `Marca FINAL retirada. El proyecto vuelve a estado Reversado y puedes editar / crear nuevas versiones.`)
      } else if (type === 'anular') {
        await api.post(`/proyectos/${proyectoId}/versiones/${version.versionId}/anular`)
        showToast('success', 'Versión anulada', `${version.codigo} fue marcada como anulada y no aparecerá como versión vigente.`)
      } else if (type === 'restaurar') {
        await api.delete(`/proyectos/${proyectoId}/versiones/${version.versionId}/anular`)
        showToast('success', 'Versión restaurada', `${version.codigo} ya está vigente otra vez.`)
      }
      setPendingAction(null)
      await cargar()
    } catch (e: any) {
      showToast('error', 'No se pudo completar la acción', e?.response?.data?.message ?? 'Error inesperado.')
    } finally { setActionLoading(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin" size={32} style={{ color: TITLE_COLOR }} />
    </div>
  )
  if (error) return (
    <div className="p-10 text-center text-sm text-red-500">Error al cargar el historial de versiones.</div>
  )

  const proyectoCongelado = proyecto?.estado === 3 || proyecto?.estado === 4
  const tieneFinal = (versiones ?? []).some(v => v.esFinal === 1 && v.anulada !== 1)
  const versionFinal = (versiones ?? []).find(v => v.esFinal === 1 && v.anulada !== 1)

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa key={toastK} show onClose={() => setToast(null)}
          tipo={toast.tipo} titulo={toast.titulo} mensaje={toast.msg} duration={4500} />
      )}

      {/* Encabezado */}
      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex flex-wrap items-center gap-3">
        <History size={22} className="text-white shrink-0" />
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 text-white/60 text-xs flex-wrap">
            <Link href="/panel/proyectos" className="hover:text-white transition">Proyectos</Link>
            <ChevronRight size={12} />
            <Link href={`/panel/proyectos/${proyectoId}`} className="hover:text-white transition truncate max-w-[200px]">
              {proyecto?.nombre ?? `#${proyectoId}`}
            </Link>
            <ChevronRight size={12} />
            <span>Versiones</span>
          </div>
          <h1 className="text-white font-bold text-sm">Historial de Versiones del Proyecto</h1>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white text-[11px] font-semibold rounded-xl">
          {versiones?.length ?? 0} versión{(versiones?.length ?? 0) === 1 ? '' : 'es'}
        </span>
      </div>

      {/* Tabs */}
      <ProyectoTabs proyectoId={proyectoId} active="confirmar" extraTabs={
        <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00304D] text-white text-xs font-semibold rounded-xl">
          <History size={13} /> Versiones
        </span>
      } />

      {/* Banner versión FINAL si existe */}
      {versionFinal && (
        <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100 p-4 flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
            <Award size={22} strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Versión FINAL · Lista para descarga y envío a SECOP</p>
            <p className="text-base font-bold text-amber-900">V{versionFinal.numero} — <span className="font-mono break-all">{versionFinal.codigo}</span></p>
            <p className="text-xs text-amber-700 mt-1">
              Mientras esta versión esté marcada como FINAL, el proyecto no se puede desconfirmar ni editar.
            </p>
          </div>
        </div>
      )}

      {/* Listado */}
      {!versiones || versiones.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-neutral-200 p-12 text-center">
          <FileText size={42} className="text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-neutral-600 mb-1">Aún no hay versiones</p>
          <p className="text-xs text-neutral-400">
            Cuando confirmes el proyecto se creará la primera versión con su código único e inmutable.
          </p>
          <Link href={`/panel/proyectos/${proyectoId}/reporte`}
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[#00304D] hover:bg-[#004a76] text-white text-xs font-semibold rounded-xl transition">
            Ir al reporte para confirmar →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {versiones.map((v) => {
            const esFinal = v.esFinal === 1
            const anulada = v.anulada === 1
            const puedeEditar = !proyectoCongelado && !anulada

            return (
              <div key={v.versionId}
                className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden ${
                  esFinal ? 'border-amber-400' :
                  anulada ? 'border-neutral-200 opacity-70' :
                  'border-neutral-200'
                }`}>
                <div className={`px-5 py-3 flex items-center justify-between gap-3 flex-wrap ${
                  esFinal ? 'bg-amber-50' :
                  anulada ? 'bg-neutral-50' :
                  'bg-neutral-50'
                }`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      esFinal ? 'bg-amber-500 text-white' :
                      anulada ? 'bg-neutral-300 text-neutral-500' :
                      'bg-[#00304D] text-white'
                    }`}>
                      <span className="text-base font-bold">V{v.numero}</span>
                    </div>
                    <div className="min-w-0 flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {esFinal && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wide">
                            <Award size={10} /> FINAL · Lista para SECOP
                          </span>
                        )}
                        {anulada && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-400 text-white text-[10px] font-bold uppercase tracking-wide">
                            <Ban size={10} /> Anulada
                          </span>
                        )}
                        {!esFinal && !anulada && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                            Versión {v.numero}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm font-mono font-bold break-all ${
                        esFinal ? 'text-amber-800' :
                        anulada ? 'text-neutral-400 line-through' :
                        ''
                      }`} style={!esFinal && !anulada ? { color: TITLE_COLOR } : undefined}>
                        {v.codigo}
                      </p>
                    </div>
                  </div>
                  <Link href={`/panel/proyectos/${proyectoId}/reporte?versionId=${v.versionId}`}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition ${
                      esFinal
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : anulada
                          ? 'bg-neutral-200 hover:bg-neutral-300 text-neutral-600'
                          : 'bg-[#00304D] hover:bg-[#004a76] text-white'
                    }`}>
                    <Eye size={13} /> Ver reporte
                  </Link>
                </div>

                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-neutral-400 shrink-0" />
                    <span className="text-neutral-500 font-semibold">Confirmada el:</span>
                    <span className="text-neutral-700">{fmtDateTimeFull(v.fecha)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserIcon size={13} className="text-neutral-400 shrink-0" />
                    <span className="text-neutral-500 font-semibold">Por:</span>
                    <span className="text-neutral-700 truncate">{v.usuario ?? '—'}</span>
                  </div>
                  {esFinal && v.finalFecha && (
                    <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                      <Award size={13} className="text-amber-500 shrink-0" />
                      <span className="text-amber-700 font-semibold">Marcada como FINAL el:</span>
                      <span className="text-amber-700">{fmtDateTimeFull(v.finalFecha)}</span>
                      {v.finalUsuario && <span className="text-amber-600/70 truncate">· {v.finalUsuario}</span>}
                    </div>
                  )}
                  {anulada && v.anuladaFecha && (
                    <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                      <Ban size={13} className="text-neutral-400 shrink-0" />
                      <span className="text-neutral-500 font-semibold">Anulada el:</span>
                      <span className="text-neutral-600">{fmtDateTimeFull(v.anuladaFecha)}</span>
                      {v.anuladaUsuario && <span className="text-neutral-400 truncate">· {v.anuladaUsuario}</span>}
                    </div>
                  )}
                  {v.hash && (
                    <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                      <ShieldCheck size={13} className="text-neutral-400 shrink-0" />
                      <span className="text-neutral-500 font-semibold">SHA-256:</span>
                      <span className="text-neutral-500 font-mono text-[10px] break-all">{v.hash}</span>
                    </div>
                  )}
                  {v.comentario && (
                    <div className="col-span-1 sm:col-span-2 mt-1">
                      <div className="flex items-start gap-2 bg-neutral-50 border border-neutral-100 rounded-xl p-3">
                        <MessageSquare size={13} className="text-neutral-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-neutral-700 italic whitespace-pre-wrap">{v.comentario}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                {!proyectoCongelado && (
                  <div className="px-5 py-3 border-t border-neutral-100 flex flex-wrap items-center gap-2 bg-neutral-50/50">
                    {!anulada && !esFinal && (
                      <button onClick={() => setPendingAction({ type: 'final', version: v })}
                        disabled={tieneFinal}
                        title={tieneFinal ? 'Ya hay otra versión marcada como FINAL. Quita esa marca primero.' : ''}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition disabled:opacity-40 disabled:cursor-not-allowed">
                        <Sparkles size={12} /> Marcar como FINAL
                      </button>
                    )}
                    {esFinal && (
                      <button onClick={() => setPendingAction({ type: 'unfinal', version: v })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-amber-300 text-amber-700 hover:bg-amber-50 transition">
                        <Sparkles size={12} /> Quitar marca FINAL
                      </button>
                    )}
                    {!esFinal && !anulada && puedeEditar && (
                      <button onClick={() => setPendingAction({ type: 'anular', version: v })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition">
                        <Ban size={12} /> Anular versión
                      </button>
                    )}
                    {anulada && (
                      <button onClick={() => setPendingAction({ type: 'restaurar', version: v })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition">
                        <RotateCcw size={12} /> Restaurar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Nota informativa */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900">
        <p className="font-bold mb-1">¿Cómo funciona el historial de versiones?</p>
        <ul className="leading-relaxed list-disc list-inside flex flex-col gap-1 mt-1">
          <li>Cada vez que confirmas el proyecto se crea un <strong>snapshot inmutable</strong> con código único.</li>
          <li>Al desconfirmar, editar y volver a confirmar se crea una nueva versión. Las anteriores se conservan.</li>
          <li>Una sola versión puede estar marcada como <strong>FINAL</strong> — esa es la que enviarás a SECOP. Mientras esté marcada, el proyecto no se puede desconfirmar.</li>
          <li>Las versiones <strong>anuladas</strong> son borradores intermedios que decidiste descartar; quedan en el histórico pero no se consideran "vigentes".</li>
          <li>El código de cada versión sirve para validar contra SECOP qué fue lo enviado.</li>
        </ul>
      </div>

      {/* Modal de confirmación de acción */}
      <Modal open={!!pendingAction} onClose={() => !actionLoading && setPendingAction(null)} maxWidth="max-w-md">
        {pendingAction && (
          <div className="p-6 flex flex-col gap-4">
            <h3 className="text-base font-bold text-neutral-800">
              {pendingAction.type === 'final' && 'Marcar como FINAL y confirmar proyecto'}
              {pendingAction.type === 'unfinal' && 'Quitar marca FINAL y reversar proyecto'}
              {pendingAction.type === 'anular' && 'Anular versión'}
              {pendingAction.type === 'restaurar' && 'Restaurar versión'}
            </h3>
            <div className="text-sm text-neutral-600 flex flex-col gap-2">
              <p>
                Vas a {pendingAction.type === 'final' && 'marcar como FINAL'}
                {pendingAction.type === 'unfinal' && 'retirar la marca FINAL de'}
                {pendingAction.type === 'anular' && 'anular'}
                {pendingAction.type === 'restaurar' && 'restaurar'}
                {' '}la versión <strong>V{pendingAction.version.numero}</strong>:
              </p>
              <code className="block bg-neutral-100 rounded-xl px-3 py-2 text-xs font-mono break-all">
                {pendingAction.version.codigo}
              </code>
              {pendingAction.type === 'final' && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  ⚠️ Esta acción <strong>confirma el proyecto</strong>. El estado pasará a "Confirmado" y se
                  registrará la fecha de radicación. Mientras esté marcada como FINAL, el proyecto no podrá
                  editarse ni se podrán crear nuevas versiones.
                </p>
              )}
              {pendingAction.type === 'unfinal' && (
                <p className="text-xs text-neutral-700 bg-neutral-100 border border-neutral-200 rounded-xl px-3 py-2">
                  ℹ️ Al retirar la marca FINAL, el proyecto vuelve a estado <strong>"Reversado"</strong> y se
                  podrá editar y crear nuevas versiones. La versión V{pendingAction.version.numero} se
                  conserva en el histórico.
                </p>
              )}
              {pendingAction.type === 'anular' && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  La versión queda en el histórico pero deja de considerarse "vigente". Puedes restaurarla después si la necesitas.
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setPendingAction(null)} disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={ejecutarAccion} disabled={actionLoading}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-xl transition disabled:opacity-50 ${
                  pendingAction.type === 'final' ? 'bg-amber-500 hover:bg-amber-600' :
                  pendingAction.type === 'unfinal' ? 'bg-neutral-700 hover:bg-neutral-800' :
                  pendingAction.type === 'anular' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-emerald-600 hover:bg-emerald-700'
                }`}>
                {actionLoading
                  ? <Loader2 size={14} className="animate-spin inline-block" />
                  : 'Sí, confirmar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
