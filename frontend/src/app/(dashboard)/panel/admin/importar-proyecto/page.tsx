'use client'

import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import { ToastBetowa } from '@/components/ui/toast-betowa'
import {
  AlertTriangle, ArrowLeft, Building2, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck,
  FileSpreadsheet, FileText, Info, Loader2, RefreshCcw, ShieldAlert, Upload, UserCircle2, X,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ReportePreview } from '@/components/importar/reporte-preview'
import type { ContactoSimple, ExcelAFConDetalle, PreviewImportacion } from '@/lib/types/importar-proyecto'

const PRIMARY = '#00304D'

interface Convocatoria { id: number; nombre: string; estado: number }

function fmtCop(v: number): string {
  return v.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function generarClave(): string {
  const letras  = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
  const numeros = '23456789'
  const simbolo = '!@#$&*'
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  return [
    pick(letras), pick(letras), pick(letras), pick(letras),
    pick(numeros), pick(numeros), pick(numeros),
    pick(letras), pick(letras), pick(simbolo),
  ].sort(() => Math.random() - 0.5).join('')
}

export default function ImportarProyectoPage() {
  const router = useRouter()
  const [convs, setConvs] = useState<Convocatoria[]>([])
  const [convocatoriaId, setConvId] = useState<number | ''>('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cargando, setCargando] = useState(false)
  const [preview, setPreview] = useState<PreviewImportacion | null>(null)
  const [errMsg, setErrMsg] = useState('')
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string; duration?: number } | null>(null)

  // Modal confirmación
  const [confirmAbierto, setConfirmAbierto] = useState(false)
  const [clave, setClave] = useState(generarClave())
  const [actualizarEmpresa, setActualizarEmpresa] = useState(false)
  const [importando, setImportando] = useState(false)

  // Reporte de vista previa (pantalla completa, sin importar).
  const [reporteAbierto, setReporteAbierto] = useState(false)

  useEffect(() => {
    api.get<Convocatoria[]>('/proyectos/admin/convocatorias')
      .then(r => setConvs(r.data ?? []))
      .catch(() => setConvs([]))
  }, [])

  function abrirConfirmacion() {
    if (!preview) return
    setClave(generarClave())
    setActualizarEmpresa(false)
    setConfirmAbierto(true)
  }

  async function handleImportar() {
    if (!preview || !archivo || !convocatoriaId) return
    const empresaNueva = preview.empresa.estado === 'nueva'
    if (empresaNueva && clave.trim().length < 6) {
      setToast({ tipo: 'error', msg: 'La clave inicial debe tener al menos 6 caracteres' })
      return
    }
    setImportando(true)
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      fd.append('convocatoriaId', String(convocatoriaId))
      if (empresaNueva) fd.append('claveUsuario', clave.trim())
      if (!empresaNueva && actualizarEmpresa) fd.append('actualizarDatosEmpresa', 'true')
      const res = await api.post<{
        proyectoId: number
        afsCreadas: number; utsCreadas: number; rubrosCreados: number
        areasCreadas: number; nivelesCreados: number; cuocCreados: number
        sectoresCreados: number; subsectoresCreados: number; recursosCreados: number
        gruposCreados: number; coberturasCreadas: number
        actividadesCreadas: number; perfilesCreados: number
        necesidadesCreadas: number; necFormCreadas: number; herramientasCreadas: number
        rubrosNoEncontrados: string[]
        noResueltos: Record<string, string[]>
        mensaje: string
      }>(
        '/admin/importar-proyecto/confirmar', fd,
        // 90 s — proyectos grandes pueden tardar varios segundos en BD.
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90_000 },
      )
      const noEnc = res.data.rubrosNoEncontrados
      const totalNoResueltos = Object.values(res.data.noResueltos ?? {}).reduce((s, arr) => s + arr.length, 0)
      const partes = [
        `${res.data.afsCreadas} AFs`,
        `${res.data.utsCreadas} UTs`,
        `${res.data.rubrosCreados} rubros`,
        `${res.data.gruposCreados} grupos`,
        `${res.data.coberturasCreadas} coberturas`,
      ]
      const advertencias: string[] = []
      if (noEnc.length > 0) advertencias.push(`${noEnc.length} rubros no resueltos`)
      if (totalNoResueltos > 0) advertencias.push(`${totalNoResueltos} valores de catálogo sin mapear`)
      const advertencia = advertencias.length > 0 ? ` — ${advertencias.join(', ')}` : ''
      setToast({ tipo: 'success', msg: `Proyecto importado: ${partes.join(', ')}${advertencia}`, duration: 9000 })
      setConfirmAbierto(false)
      // Damos margen para que el admin alcance a leer el resumen antes del redirect.
      setTimeout(() => router.push(`/panel/admin/aprobacion/proyectos`), 6000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setToast({ tipo: 'error', msg: msg ?? 'No se pudo importar el proyecto' })
    } finally {
      setImportando(false)
    }
  }

  async function handlePreview() {
    if (!convocatoriaId)        return setToast({ tipo: 'error', msg: 'Selecciona la convocatoria' })
    if (!archivo)               return setToast({ tipo: 'error', msg: 'Selecciona el archivo .xlsx' })

    setCargando(true)
    setErrMsg('')
    setPreview(null)
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      fd.append('convocatoriaId', String(convocatoriaId))
      const res = await api.post<PreviewImportacion>('/admin/importar-proyecto/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60_000,
      })
      setPreview(res.data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErrMsg(msg ?? 'No se pudo procesar el archivo')
    } finally {
      setCargando(false)
    }
  }

  // Reporte a pantalla completa: reemplaza el preview mientras esté abierto.
  if (reporteAbierto && preview) {
    return <ReportePreview preview={preview} onVolver={() => setReporteAbierto(false)} />
  }

  return (
    <div className="p-5 sm:p-7 xl:p-10 flex flex-col gap-6">
      {toast && (
        <ToastBetowa show onClose={() => setToast(null)} tipo={toast.tipo} titulo={toast.tipo === 'success' ? 'Listo' : 'Error'} mensaje={toast.msg} duration={toast.duration ?? 3500} />
      )}

      <div className="bg-[#00304D] rounded-2xl px-6 py-4 flex items-center gap-3">
        <FileSpreadsheet size={22} className="text-white" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Administración</p>
          <h1 className="text-white font-bold text-base sm:text-lg">Importar proyecto desde Excel del formulador</h1>
        </div>
      </div>

      <Link href="/panel" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#00304D] w-fit">
        <ArrowLeft size={13} />
        Volver al panel de administración
      </Link>

      {/* Paso 1 — Subir */}
      <section className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-[#00304D] mb-3">1. Cargar archivo</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Convocatoria *</label>
            <select
              value={convocatoriaId}
              onChange={(e) => setConvId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40"
            >
              <option value="">— Seleccionar —</option>
              {convs.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.estado === 1 ? '(abierta)' : '(cerrada)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Archivo .xlsx *</label>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <button
            onClick={handlePreview}
            disabled={cargando || !convocatoriaId || !archivo}
            className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90"
            style={{ backgroundColor: PRIMARY }}
          >
            {cargando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Cargar y revisar
          </button>
        </div>
        {errMsg && (
          <div className="mt-3 border border-red-200 bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 flex items-center gap-2">
            <ShieldAlert size={14} />
            {errMsg}
          </div>
        )}
      </section>

      {/* Paso 2 — Preview */}
      {preview && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 -mb-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[#00304D]">2. Revisar antes de importar</p>
            <button
              type="button"
              onClick={() => setReporteAbierto(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00304D] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#013a5c]"
            >
              <FileText size={16} /> Ver reporte completo
            </button>
          </div>

          {preview.validaciones.length > 0 && (
            <section className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
              <header className="px-5 py-3 border-b border-neutral-100 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <p className="text-sm font-bold text-neutral-900">Validaciones ({preview.validaciones.length})</p>
              </header>
              <ul>
                {preview.validaciones.map((v, i) => {
                  const cfg = v.nivel === 'error'
                    ? { bg: 'bg-red-50', text: 'text-red-700', label: 'ERROR' }
                    : v.nivel === 'warning'
                      ? { bg: 'bg-amber-50', text: 'text-amber-700', label: 'AVISO' }
                      : { bg: 'bg-blue-50', text: 'text-blue-700', label: 'INFO' }
                  return (
                    <li key={i} className={`${cfg.bg} px-5 py-2 border-b border-white last:border-b-0 flex items-start gap-2`}>
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.text} shrink-0 mt-0.5`}>{cfg.label}</span>
                      <span className="text-xs text-neutral-700">{v.mensaje}</span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* 1. Datos básicos de la empresa */}
          <Card titulo="1. Datos básicos de la empresa" icono={Building2}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Dato label="NIT" valor={preview.empresa.nit} mono />
              <Dato label="Razón social" valor={preview.empresa.razonSocial} />
              <Dato label="Sigla" valor={preview.basicos.sigla} />
              <Dato label="Tipo" valor={preview.basicos.tipoOrganizacion} />
              <Dato label="Tamaño" valor={preview.basicos.tamanoEmpresa} />
              <Dato label="Modalidad de participación" valor={preview.basicos.modalidadParticipacion} />
              <Dato label="Correo" valor={preview.basicos.email} />
              <Dato label="Celular" valor={preview.basicos.celular} />
              <Dato label="Dirección" valor={`${preview.basicos.direccionDomicilio ?? '—'}, ${preview.basicos.ciudadDomicilio ?? '—'} (${preview.basicos.departamentoDomicilio ?? '—'})`} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {preview.empresa.estado === 'nueva' ? (
                <span className="inline-block px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-100 text-emerald-700">EMPRESA NUEVA — se creará</span>
              ) : (
                <span className="inline-block px-2 py-0.5 text-[11px] font-bold rounded bg-blue-100 text-blue-700">EMPRESA EXISTENTE (id {preview.empresa.empresaIdExistente})</span>
              )}
              {preview.usuario.estado === 'nuevo' ? (
                <span className="inline-block px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-100 text-emerald-700">USUARIO NUEVO — admin asigna clave</span>
              ) : (
                <span className="inline-block px-2 py-0.5 text-[11px] font-bold rounded bg-blue-100 text-blue-700">USUARIO EXISTENTE (id {preview.usuario.usuarioIdExistente})</span>
              )}
            </div>
            {preview.empresa.diferenciasDatos && preview.empresa.diferenciasDatos.length > 0 && (
              <div className="mt-3 border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs">
                <p className="font-bold text-amber-800 mb-1.5">Diferencias detectadas (datos en BD vs Excel):</p>
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-amber-700">
                      <th className="py-1 pr-2">Campo</th>
                      <th className="py-1 pr-2">En BD</th>
                      <th className="py-1">En Excel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.empresa.diferenciasDatos.map((d, i) => (
                      <tr key={i} className="border-t border-amber-200">
                        <td className="py-1 pr-2 font-semibold">{d.campo}</td>
                        <td className="py-1 pr-2 text-neutral-700">{d.actual ?? '—'}</td>
                        <td className="py-1 text-emerald-700 font-medium">{d.nuevo ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-amber-700 mt-2">El admin decidirá si actualizar los datos básicos al confirmar.</p>
              </div>
            )}
          </Card>

          {/* 2. Contactos */}
          <Card titulo="2. Contactos" icono={UserCircle2}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <ContactoCard titulo="Representante legal" c={preview.contactos.representanteLegal} />
              <ContactoCard titulo="Talento Humano"      c={preview.contactos.contacto1} />
              <ContactoCard titulo="Comunicaciones"      c={preview.contactos.contactoSustenta} />
            </div>
          </Card>

          {/* 3. Análisis Organizacional */}
          <Card titulo="3. Análisis Organizacional">
            <div className="grid grid-cols-1 gap-3 text-sm">
              <Dato label="Objeto social de la empresa / gremio" valor={preview.generalidades.objetoSocial} multiline />
              <Dato label="Productos y/o servicios ofrecidos" valor={preview.generalidades.productosServicios} multiline />
              <Dato label="Situación actual y proyección" valor={preview.generalidades.situacionActual} multiline />
              <Dato label="Papel en el sector / región" valor={preview.generalidades.papelSector} multiline />
              <Dato label="Retos estratégicos vinculados a la formación" valor={preview.generalidades.retos} multiline />
              <Dato label="Experiencia formativa" valor={preview.generalidades.experienciaFormativa} multiline />
              <Dato label="Objetivo general del proyecto" valor={preview.generalidades.objetivoProyecto} multiline />
            </div>

            <div className="mt-4 border-t border-neutral-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-2">Sectores y subsectores</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Dato label="Sector al que pertenece" valor={preview.generalidades.sectorPertenece} />
                <Dato label="Subsector al que pertenece" valor={preview.generalidades.subsectorPertenece} />
                <Dato label="Sectores que representa" valor={preview.generalidades.sectoresRepresenta.join(' · ') || '—'} />
                <Dato label="Subsectores que representa" valor={preview.generalidades.subsectoresRepresenta.join(' · ') || '—'} />
              </div>
            </div>

            <div className="mt-4 border-t border-neutral-100 pt-3 grid grid-cols-1 gap-3 text-sm">
              <Dato label="Identificación de eslabones de la cadena productiva" valor={preview.generalidades.cadenaProductiva} multiline />
              <Dato label="Interacciones con otros actores" valor={preview.generalidades.interacciones} multiline />
            </div>
          </Card>

          {/* 4. Diagnóstico */}
          {preview.diagnosticos.length > 0 && (
            <Card titulo={`4. Diagnóstico (${preview.diagnosticos.length})`}>
              <ul className="space-y-3">
                {preview.diagnosticos.map((d, i) => (
                  <li key={i} className="border border-neutral-200 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#00304D]/10 text-[#00304D] font-bold text-xs">
                        #{d.numero}
                      </span>
                      {d.fecha && <span className="text-[11px] text-neutral-500">Fecha: {d.fecha}</span>}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 mb-2 text-xs">
                      <Dato label="¿Herramienta de creación propia?" valor={d.herramientaPropia} />
                      <Dato label="Otro tipo de herramienta" valor={d.otraHerramienta} />
                      <Dato label="¿Cuenta con plan de capacitación?" valor={d.planCapacitacion} />
                    </div>

                    {d.herramientas.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-bold uppercase text-neutral-500 mb-0.5">Herramientas aplicadas</p>
                        <ul className="text-xs text-neutral-700 space-y-0.5">
                          {d.herramientas.map((h, j) => (
                            <li key={j}>• {h.nombre}{h.muestra ? ` — muestra: ${h.muestra}` : ''}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {d.descripcion && (
                      <div className="mb-2">
                        <p className="text-[10px] font-bold uppercase text-neutral-500 mb-0.5">Descripción de las herramientas y muestra</p>
                        <p className="text-xs text-neutral-700 whitespace-pre-line">{d.descripcion}</p>
                      </div>
                    )}
                    {d.resumen && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-neutral-500 mb-0.5">Resumen de resultados</p>
                        <p className="text-xs text-neutral-700 whitespace-pre-line">{d.resumen}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* 5. Necesidades de formación */}
          {preview.necesidades.length > 0 && (
            <Card titulo={`5. Necesidades de formación (${preview.necesidades.length})`}>
              <ul className="text-sm space-y-1.5">
                {preview.necesidades.map((n, i) => (
                  <li key={i} className="flex gap-2 border-b border-neutral-100 last:border-b-0 pb-1.5">
                    <span className="text-[#00304D] font-bold shrink-0">#{n.numeroNecesidad}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-neutral-800">{n.necesidad}</p>
                      <p className="text-[11px] text-neutral-500">Diagnóstico {n.numeroDiagnostico} · {n.numeroBeneficiarios} beneficiarios</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* 6. Proyecto a crear (datos del proyecto antes de las AFs) */}
          <Card titulo="6. Proyecto a crear">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Dato label="Nombre (autogenerado)" valor={preview.proyecto.nombre} />
              <Dato label="Convocatoria" valor={preview.convocatoria.nombre} />
              <Dato label="Modalidad del proyecto" valor={preview.proyecto.modalidadProyectoNombre ?? 'Sin resolver'} />
              <Dato label="Estado inicial" valor="Borrador" />
            </div>
          </Card>

          {/* 7. Acciones de Formación */}
          <Card titulo={`7. Acciones de Formación (${preview.afs.length})`}>
            <div className="flex flex-col gap-3">
              {preview.afs.map(af => <AFCard key={af.consecutivo} af={af} />)}
            </div>
          </Card>

          {/* 8. Presupuesto del proyecto */}
          <Card titulo="8. Presupuesto del proyecto">
            <div className="flex flex-col gap-4">
              {/* Total Acciones de Formación — SOLO AFs (sin GO ni Transferencia) */}
              {(() => {
                const p = preview.proyecto.presupuesto
                // Las cifras de Datos_Presupuesto son del proyecto entero (ya
                // incluyen GO). Para mostrar solo AFs hay que restar el GO.
                const cofinAFs   = (p.cofinanciacionSena   ?? 0) - (p.gastosOpCofinSena    ?? 0)
                const especieAFs = (p.contrapartidaEspecie ?? 0) - (p.gastosOpContraEspecie ?? 0)
                const dineroAFs  = (p.contrapartidaDinero  ?? 0) - (p.gastosOpContraDinero  ?? 0) - (p.valorTransferencia ?? 0)
                return (
                  <div className="border border-neutral-200 rounded-xl p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-3">Total Acciones de Formación</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Stat label="N° de AFs" valor={preview.proyecto.totalAFs.toString()} />
                      <Stat label="Beneficiarios" valor={p.beneficiarios.toLocaleString('es-CO')} />
                      <Stat label="Cofin. SENA" valor={fmtCop(cofinAFs)} />
                      <Stat label="Total AFs" valor={fmtCop(p.valorAFs)} destacado />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mt-2">
                      <Stat label="Contrapartida especie" valor={fmtCop(especieAFs)} />
                      <Stat label="Contrapartida dinero" valor={fmtCop(dineroAFs)} />
                    </div>
                  </div>
                )
              })()}

              {/* Gastos de operación */}
              {(() => {
                const valorAFs = preview.proyecto.presupuesto.valorAFs || 0
                const goTotal  = preview.proyecto.presupuesto.gastosOperacion || 0
                const pctGO    = valorAFs > 0 ? (goTotal / valorAFs * 100) : 0
                const topeGO   = valorAFs > 200_000_000 ? 10 : 16
                const goExcede = pctGO > topeGO
                return (
                  <div className="border border-neutral-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D]">Gastos de operación</p>
                      <span className={`text-[11px] font-bold ${goExcede ? 'text-red-600' : 'text-emerald-700'}`}>
                        {pctGO.toFixed(2)}% sobre AFs · tope {topeGO}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Stat label="Cofin. SENA" valor={fmtCop(preview.proyecto.presupuesto.gastosOpCofinSena)} />
                      <Stat label="C. Especie" valor={fmtCop(preview.proyecto.presupuesto.gastosOpContraEspecie)} />
                      <Stat label="C. Dinero" valor={fmtCop(preview.proyecto.presupuesto.gastosOpContraDinero)} />
                      <Stat label="Total GO" valor={fmtCop(goTotal)} destacado />
                    </div>
                  </div>
                )
              })()}

              {/* Transferencia de conocimiento */}
              {(() => {
                const valorAFs    = preview.proyecto.presupuesto.valorAFs || 0
                const goTotal     = preview.proyecto.presupuesto.gastosOperacion || 0
                const baseTrans   = valorAFs + goTotal
                const valorTrans  = preview.proyecto.presupuesto.valorTransferencia || 0
                const benefTrans  = preview.proyecto.presupuesto.beneficiariosTransferencia || 0
                const benefTotal  = preview.proyecto.presupuesto.beneficiarios || 0
                const pctValor    = baseTrans > 0 ? (valorTrans / baseTrans * 100) : 0
                const pctBenef    = benefTotal > 0 ? (benefTrans / benefTotal * 100) : 0
                return (
                  <div className="border border-neutral-200 rounded-xl p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-3">Transferencia de conocimiento</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Stat label="N° beneficiarios" valor={benefTrans.toLocaleString('es-CO')} />
                      <Stat label="% Beneficiarios (mín 5%)" valor={pctBenef.toFixed(2) + '%'} />
                      <Stat label="% Valor / (AFs+GO) (mín 1%)" valor={pctValor.toFixed(2) + '%'} />
                      <Stat label="Total Transferencia" valor={fmtCop(valorTrans)} destacado />
                    </div>
                  </div>
                )
              })()}

              {/* Total del proyecto */}
              <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 mb-3">Total del proyecto</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Cofin. SENA" valor={fmtCop(preview.proyecto.presupuesto.cofinanciacionSena)} />
                  <Stat label="Contrapartida especie" valor={fmtCop(preview.proyecto.presupuesto.contrapartidaEspecie)} />
                  <Stat label="Contrapartida dinero" valor={fmtCop(preview.proyecto.presupuesto.contrapartidaDinero)} />
                  <Stat label="VALOR TOTAL" valor={fmtCop(preview.proyecto.presupuesto.valorTotal)} destacado />
                </div>
              </div>
            </div>
          </Card>

          {/* CTA confirmación */}
          {(() => {
            const hayErrores = preview.validaciones.some(v => v.nivel === 'error')
            return (
              <section className={`border-2 rounded-2xl p-5 flex items-center gap-3 ${
                hayErrores ? 'bg-red-50 border-red-300' : 'bg-[#39a900]/5 border-[#39a900]/40'
              }`}>
                <Info size={20} className={`shrink-0 ${hayErrores ? 'text-red-600' : 'text-[#39a900]'}`} />
                <div className="flex-1 text-sm">
                  <p className={`font-bold ${hayErrores ? 'text-red-700' : 'text-[#00304D]'}`}>
                    {hayErrores ? 'Hay errores que impiden la importación' : 'Listo para importar'}
                  </p>
                  <p className={`text-xs mt-1 ${hayErrores ? 'text-red-700' : 'text-neutral-700'}`}>
                    {hayErrores
                      ? 'Resuelve los errores marcados arriba antes de continuar.'
                      : 'Se creará el proyecto en estado borrador y podrás revisarlo desde el panel del proponente.'}
                  </p>
                </div>
                <button
                  onClick={abrirConfirmacion}
                  disabled={hayErrores}
                  className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition hover:opacity-90"
                  style={{ backgroundColor: hayErrores ? '#9ca3af' : '#39a900' }}
                >
                  <ClipboardCheck size={14} />
                  Confirmar e importar
                </button>
              </section>
            )
          })()}
        </>
      )}

      {/* Modal de confirmación */}
      {preview && (
        <Modal open={confirmAbierto} onClose={() => !importando && setConfirmAbierto(false)} maxWidth="max-w-lg">
          <div className="bg-[#00304D] px-5 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <ClipboardCheck size={18} className="text-white shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Confirmación</p>
                <h2 className="text-white font-bold text-sm truncate">Importar proyecto</h2>
              </div>
            </div>
            <button onClick={() => !importando && setConfirmAbierto(false)} className="text-white/70 hover:text-white p-1">
              <X size={18} />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-4">
            {/* Resumen */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs">
              <p className="font-bold text-neutral-700 mb-1">Resumen</p>
              <ul className="text-neutral-700 space-y-0.5">
                <li>• Empresa: <strong>{preview.basicos.razonSocial}</strong> ({preview.empresa.estado})</li>
                <li>• Proyecto: <strong>{preview.proyecto.nombre}</strong></li>
                <li>• Modalidad: <strong>{preview.proyecto.modalidadProyectoNombre ?? '—'}</strong></li>
                <li>• Convocatoria: <strong>{preview.convocatoria.nombre}</strong></li>
                <li>• {preview.proyecto.totalAFs} AFs · {preview.proyecto.totalUTs} UTs · {preview.proyecto.totalRubros} rubros</li>
                <li>• Valor total: <strong>{fmtCop(preview.proyecto.presupuesto.valorTotal)}</strong></li>
              </ul>
            </div>

            {/* Decisión: empresa nueva → clave */}
            {preview.empresa.estado === 'nueva' && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Contraseña inicial del usuario *
                </label>
                <p className="text-[11px] text-neutral-500 mb-1.5">
                  Se creará el usuario <strong>{preview.usuario.email}</strong>. Comparte esta clave con el proponente por un canal seguro.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00304D]/40 font-mono"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setClave(generarClave())}
                    className="inline-flex items-center gap-1 px-3 py-2 border border-neutral-300 rounded-lg text-xs hover:bg-neutral-50 transition"
                    title="Generar nueva"
                  >
                    <RefreshCcw size={13} />
                    Generar
                  </button>
                </div>
              </div>
            )}

            {/* Decisión: empresa existente → actualizar datos */}
            {preview.empresa.estado === 'existente' && preview.empresa.diferenciasDatos && preview.empresa.diferenciasDatos.length > 0 && (
              <label className="flex items-start gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={actualizarEmpresa}
                  onChange={(e) => setActualizarEmpresa(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-neutral-700">
                  <strong>Actualizar datos básicos de la empresa</strong> con los del Excel
                  ({preview.empresa.diferenciasDatos.length} diferencia{preview.empresa.diferenciasDatos.length !== 1 ? 's' : ''} detectadas).
                  Si no marcas, se conservan los datos actuales en BD.
                </span>
              </label>
            )}

            {preview.empresa.estado === 'existente' && preview.usuario.estado === 'existente' && (
              <p className="text-[11px] text-neutral-500 flex items-start gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                Empresa y usuario ya existen. Solo se creará el proyecto + contactos + AFs.
              </p>
            )}

            {/* Botones */}
            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                onClick={() => setConfirmAbierto(false)}
                disabled={importando}
                className="px-4 py-2 border border-neutral-300 text-neutral-700 text-sm font-semibold rounded-lg hover:bg-neutral-50 disabled:opacity-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportar}
                disabled={importando}
                className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90"
                style={{ backgroundColor: '#39a900' }}
              >
                {importando ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}
                Confirmar e importar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Subcomponentes ─────────────────────────────────────────────────────────────

function Card({ titulo, icono: Icono, children }: { titulo: string; icono?: React.ComponentType<{ size?: number; className?: string }>; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-neutral-100 flex items-center gap-2">
        {Icono && <Icono size={16} className="text-[#00304D]" />}
        <p className="text-sm font-bold text-neutral-900">{titulo}</p>
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Dato({ label, valor, mono, multiline }: { label: string; valor: string | number | null | undefined; mono?: boolean; multiline?: boolean }) {
  const v = valor === null || valor === undefined || valor === '' ? '—' : String(valor)
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : ''} text-neutral-800 ${multiline ? 'whitespace-pre-line' : 'truncate'}`}>{v}</p>
    </div>
  )
}

function Stat({ label, valor, destacado }: { label: string; valor: string; destacado?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${destacado ? 'bg-[#00304D] text-white' : 'bg-neutral-50 border border-neutral-200'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wide ${destacado ? 'text-white/70' : 'text-neutral-500'}`}>{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${destacado ? 'text-white' : 'text-neutral-900'}`}>{valor}</p>
    </div>
  )
}

function ContactoCard({ titulo, c }: { titulo: string; c: ContactoSimple }) {
  return (
    <div className="border border-neutral-200 rounded-lg p-3 text-xs">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#00304D] mb-1.5">{titulo}</p>
      <p className="font-semibold text-neutral-800 truncate">{c.nombre || '—'}</p>
      <p className="text-neutral-500 font-mono">{c.id || '—'}</p>
      <p className="text-neutral-700 truncate mt-1">{c.email || '—'}</p>
      <p className="text-neutral-500">{c.telefono || '—'}</p>
    </div>
  )
}

function AFCard({ af }: { af: ExcelAFConDetalle }) {
  const [abierto, setAbierto] = useState(false)
  const totalBenef = (af.beneficiariosPresenciales ?? 0) + (af.beneficiariosSincronicos ?? 0)
  const horasGrupo = af.horasPorGrupo ?? 0
  const numGrupos  = af.numeroGrupos ?? 0
  const totalHoras = horasGrupo * numGrupos
  // Detector robusto de R09 (Gastos de Operación) y R015 (Transferencia).
  // Capta R09, R09.1, R09.2, R9, R015, R015.1, R0.15, etc. y como respaldo
  // mira el nombre del rubro por si el código viene con formato distinto.
  const isGO = (r: ExcelAFConDetalle['rubros'][number]) =>
    /^R0?9(\D|$)/i.test(r.idRubro.trim()) ||
    /GASTOS\s+DE\s+OPERACI/i.test(r.nombreRubro ?? '')
  const isTrans = (r: ExcelAFConDetalle['rubros'][number]) =>
    /^R0?15(\D|$)/i.test(r.idRubro.trim()) ||
    /TRANSFERENCIA\s+DE\s+CONOCIMIENTO/i.test(r.nombreRubro ?? '')
  const rubroGO    = af.rubros.find(isGO)
  const rubroTrans = af.rubros.find(isTrans)
  const rubrosNormales = af.rubros.filter(r => !isGO(r) && !isTrans(r))
  // El total de la AF NO incluye GO ni Transferencia (esos van aparte).
  const totalRubro = rubrosNormales.reduce((s, r) => s + (r.totalRubro ?? 0), 0)
  const totalCofin = rubrosNormales.reduce((s, r) => s + (r.cofinanciacionSena ?? 0), 0)
  const totalEspecie = rubrosNormales.reduce((s, r) => s + (r.contrapartidaEspecie ?? 0), 0)
  const totalDinero = rubrosNormales.reduce((s, r) => s + (r.contrapartidaDinero ?? 0), 0)

  // Concatenar impactos en un solo string como pidió el usuario.
  const impactosConcat = [
    ...af.impactosTrabajador.map((i, idx) => `Trabajador ${idx + 1}: ${i}`),
    ...af.impactosProductividad.map((i, idx) => `Productividad ${idx + 1}: ${i}`),
  ].join('\n')

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-neutral-50 transition text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-[#00304D]/10 text-[#00304D] flex items-center justify-center font-bold shrink-0">
          AF{af.consecutivo}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-neutral-800 truncate">{af.nombre || '— Sin nombre —'}</p>
          <p className="text-[11px] text-neutral-500">
            {[af.eventoFormacion, af.modalidadFormacion, numGrupos ? `${numGrupos} grupos` : null, horasGrupo ? `${horasGrupo}h/grupo` : null, totalBenef ? `${totalBenef} benef.` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="text-right text-[11px] text-neutral-500 shrink-0">
          <p>{af.uts.length} UT · {af.rubros.length} rubros · {af.cobertura.length} grupos cob.</p>
          <p className="font-bold text-[#00304D]">{fmtCop(totalRubro)}</p>
        </div>
        {abierto ? <ChevronDown size={14} className="text-neutral-400" /> : <ChevronRight size={14} className="text-neutral-400" />}
      </button>
      {abierto && (
        <div className="border-t border-neutral-100 px-4 py-4 bg-neutral-50/50 flex flex-col gap-5 text-sm">

          {/* Identificación */}
          <Bloque titulo="Identificación de la AF">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
              <Dato label="Evento" valor={af.eventoFormacion} />
              <Dato label="Modalidad" valor={af.modalidadFormacion} />
              <Dato label="Metodología" valor={af.metodologia} />
              <Dato label="Enfoque" valor={af.enfoque} />
              <Dato label="Horas por grupo" valor={horasGrupo} />
              <Dato label="N° grupos" valor={numGrupos} />
              <Dato label="Total horas AF" valor={totalHoras} />
              <Dato label="Total beneficiarios" valor={totalBenef} />
              <Dato label="Beneficiarios presenciales" valor={af.beneficiariosPresenciales} />
              <Dato label="Beneficiarios sincrónicos" valor={af.beneficiariosSincronicos} />
            </div>
          </Bloque>

          {/* Necesidad y problema */}
          <Bloque titulo="Necesidad y problema">
            <div className="grid grid-cols-1 gap-2 text-xs">
              <Dato label={`Necesidad asociada (#${af.codigoNecesidad ?? '—'} · diagnóstico ${af.codigoDiagnostico ?? '—'})`} valor={af.diagnostico} multiline />
              <Dato label="Justificación de la necesidad" valor={af.justificacion} multiline />
              <Dato label="Causas" valor={af.causasEfectos} multiline />
              <Dato label="Efectos" valor={af.efectos} multiline />
              <Dato label="Objetivo de la AF" valor={af.objetivos} multiline />
            </div>
          </Bloque>

          {/* Perfil beneficiarios — orden: Áreas+just → Niveles+just → CUOC →
              Discapacidad → Mujeres → BIC → MIPYMES+just → Cadena+just →
              Campesinos+just → Populares+just */}
          <Bloque titulo="Perfil de los beneficiarios">
            {/* Áreas funcionales + justificación */}
            <div className="grid grid-cols-1 gap-2 text-xs">
              <Dato label="Áreas funcionales" valor={af.areas.join(' · ') || '—'} />
              <Dato label="Justificación de áreas" valor={af.justificacionAreas} multiline />
            </div>

            {/* Niveles + justificación */}
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
              <Dato label="Niveles ocupacionales" valor={af.niveles.join(' · ') || '—'} />
              <Dato label="Justificación de niveles" valor={af.justificacionNiveles} multiline />
            </div>

            {/* CUOC */}
            <div className="mt-3 text-xs">
              <Dato label={`Ocupaciones CUOC (${af.ocupacionesCuoc.length})`} valor={af.ocupacionesCuoc.join(' · ') || '—'} multiline />
            </div>

            {/* Discapacidad / Mujeres / BIC */}
            <div className="mt-3 grid grid-cols-3 gap-x-4 text-xs">
              <Dato label="Trabajadores en discapacidad" valor={af.trabajadoresDiscapacidad} />
              <Dato label="Trabajadores mujeres" valor={af.trabajadoresMujeres} />
              <Dato label="Empresas BIC" valor={af.empresasBic} />
            </div>

            {/* MIPYMES + justificación */}
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-1.5">MIPYMES</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <Dato label="N° empresas" valor={af.mipymesEmpresas} />
                <Dato label="N° trabajadores" valor={af.mipymesTrabajadores} />
              </div>
              <div className="mt-1.5 text-xs">
                <Dato label="Justificación MIPYMES" valor={af.justificacionMipymes} multiline />
              </div>
            </div>

            {/* Cadena productiva + justificación */}
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-1.5">Cadena productiva</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <Dato label="N° empresas" valor={af.cadenaEmpresas} />
                <Dato label="N° trabajadores" valor={af.cadenaTrabajadores} />
              </div>
              <div className="mt-1.5 text-xs">
                <Dato label="Justificación cadena productiva" valor={af.justificacionCadena} multiline />
              </div>
            </div>

            {/* Trabajadores economía campesina + justificación */}
            <div className="mt-3 border-t border-neutral-100 pt-3 grid grid-cols-1 gap-2 text-xs">
              <Dato label="N° trabajadores economía campesina" valor={af.trabajadoresCampesinos} />
              <Dato label="Justificación economía campesina" valor={af.trabajadoresCampesinosTexto} multiline />
            </div>

            {/* Trabajadores economía popular + justificación */}
            <div className="mt-3 border-t border-neutral-100 pt-3 grid grid-cols-1 gap-2 text-xs">
              <Dato label="N° trabajadores economía popular" valor={af.trabajadoresPopular} />
              <Dato label="Justificación economía popular" valor={af.trabajadoresPopularTexto} multiline />
            </div>
          </Bloque>

          {/* Enfoque de la AF */}
          <Bloque titulo="Enfoque de la AF">
            <Dato label="Enfoque" valor={af.enfoque} />
          </Bloque>

          {/* Sectores y subsectores que pertenecen los beneficiarios */}
          {(af.sectoresPertenecen.length > 0 || af.subsectoresPertenecen.length > 0) && (
            <Bloque titulo="Sectores y subsectores a los que PERTENECEN los beneficiarios">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <Dato label="Sectores" valor={af.sectoresPertenecen.join(' · ') || '—'} />
                <Dato label="Subsectores" valor={af.subsectoresPertenecen.join(' · ') || '—'} />
              </div>
            </Bloque>
          )}

          {/* Sectores y subsectores que beneficia la AF (clasificación) */}
          {(af.sectoresBeneficia.length > 0 || af.subsectoresBeneficia.length > 0 || af.justificacionSectores) && (
            <Bloque titulo="Sectores y subsectores que BENEFICIA la AF">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <Dato label="Sector" valor={af.sectoresBeneficia.join(' · ') || '—'} />
                <Dato label="Subsector" valor={af.subsectoresBeneficia.join(' · ') || '—'} />
              </div>
              {af.justificacionSectores && (
                <div className="mt-2">
                  <Dato label="Justificación de sectores y subsectores" valor={af.justificacionSectores} multiline />
                </div>
              )}
            </Bloque>
          )}

          {/* Alineación e impactos */}
          <Bloque titulo="Alineación e impactos esperados">
            <div className="grid grid-cols-1 gap-2 text-xs">
              <Dato label="Componente de alineación (reto nacional)" valor={af.componenteAlineacion} />
              <Dato label="Descripción de la alineación" valor={af.descripcionAlineacion} multiline />
              <Dato label="Justificación de la alineación" valor={af.justificacionAlineacion} multiline />
              <Dato label="Justificación AF especializada" valor={af.justificacionEspecializada} multiline />
              <Dato label="Resultados de impacto esperados" valor={impactosConcat || '—'} multiline />
            </div>
          </Bloque>

          {/* Unidades temáticas */}
          {af.uts.length > 0 && (
            <Bloque titulo={`Unidades temáticas (${af.uts.length})`}>
              <div className="flex flex-col gap-2">
                {af.uts.map(u => {
                  const totalHorasUt = (u.horasPracticas ?? 0) + (u.horasTeoricas ?? 0)
                  // Las UT de articulación territorial son especiales: card en morado.
                  const esArt = u.esArticulacionTerritorial
                  return (
                    <div
                      key={u.numeroUT}
                      className={`border rounded-lg p-3 text-xs ${
                        esArt
                          ? 'bg-violet-50 border-violet-300'
                          : 'bg-white border-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md font-bold text-[11px] shrink-0 ${
                          esArt ? 'bg-violet-200 text-violet-800' : 'bg-[#00304D]/10 text-[#00304D]'
                        }`}>
                          UT{u.numeroUT}
                        </span>
                        <p className={`font-bold flex-1 min-w-0 ${esArt ? 'text-violet-900' : 'text-neutral-800'}`}>
                          {u.nombre}
                        </p>
                        {esArt && (
                          <span className="inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded bg-violet-600 text-white shrink-0">
                            Articulación territorial
                          </span>
                        )}
                        <span className="text-neutral-500 shrink-0">{totalHorasUt}h ({u.horasPracticas ?? 0}p · {u.horasTeoricas ?? 0}t)</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {/* Orden: contenido → competencia → actividades → descripción → perfil capacitador */}
                        <Dato label="Contenido" valor={u.contenido} multiline />
                        <Dato label="Competencia por adquirir" valor={u.competencia} multiline />
                        {u.actividades.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Actividades de aprendizaje</p>
                            <ul className="text-[11px] text-neutral-700 list-disc list-inside">
                              {u.actividades.map((a, i) => <li key={i}>{a}</li>)}
                            </ul>
                          </div>
                        )}
                        <Dato label="Descripción de las actividades de aprendizaje" valor={u.descripcionActividad} multiline />
                        {u.perfiles.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Perfil de los capacitadores</p>
                            <ul className="text-[11px] text-neutral-700 space-y-0.5">
                              {u.perfiles.map((p, i) => (
                                <li key={i}>
                                  <strong>Perfil {i + 1}:</strong> {p.perfil}
                                  {p.horas != null && <span className="text-neutral-500"> · {p.horas}h</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {esArt && u.articulacionTerritorial && (
                          <Dato label="Articulación territorial" valor={u.articulacionTerritorial} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Bloque>
          )}

          {/* Cobertura */}
          {af.cobertura.length > 0 && (
            <Bloque titulo={`Cobertura (${af.cobertura.length} grupo${af.cobertura.length !== 1 ? 's' : ''})`}>
              <div className="flex flex-col gap-2">
                {af.cobertura.map((c, i) => (
                  <div key={i} className="border border-neutral-200 rounded-lg p-3 text-xs bg-white">
                    <p className="font-bold text-[#00304D] mb-1">Grupo {i + 1}</p>
                    {c.departamentoPresencial ? (
                      <p className="text-neutral-700">
                        {c.ciudadPresencial ?? '—'}, {c.departamentoPresencial}
                        <span className="text-neutral-500"> · {c.beneficiariosPresencial ?? 0} beneficiarios</span>
                      </p>
                    ) : c.departamentos.length > 0 ? (
                      <ul className="text-neutral-700">
                        {c.departamentos.map((d, j) => (
                          <li key={j}>• {d.departamento} <span className="text-neutral-500">— {d.beneficiarios} ben.</span></li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-neutral-400 italic">Sin datos de cobertura</p>
                    )}
                    {c.justificacion && (
                      <div className="mt-2 pt-2 border-t border-neutral-100">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Justificación</p>
                        <p className="text-[11px] text-neutral-700 whitespace-pre-line">{c.justificacion}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Bloque>
          )}

          {/* Ambiente y recursos */}
          <Bloque titulo="Ambiente, material y recursos">
            <div className="grid grid-cols-1 gap-2 text-xs">
              <Dato label="Ambiente de aprendizaje" valor={af.ambiente} />
              <Dato label="Material de formación" valor={af.material} multiline />
              <Dato label="Justificación del material (si aplica)" valor={af.justificacionSiAplica} multiline />
              <Dato label="Recursos didácticos" valor={af.recursosDidacticos} multiline />
              <Dato label="Insumos" valor={af.insumos} multiline />
              <Dato label="Justificación del insumo" valor={af.justificacionInsumo} multiline />
              <Dato label="Gestión del conocimiento" valor={af.gestionConocimiento} multiline />
            </div>
          </Bloque>

          {/* Rubros de la AF (excluyendo R09 y R015) */}
          {rubrosNormales.length > 0 && (
            <Bloque titulo={`Rubros de la AF (${rubrosNormales.length})`}>
              <div className="flex flex-col gap-2">
                {rubrosNormales.map((r, i) => (
                  <div key={i} className="border border-neutral-200 rounded-lg p-3 text-xs bg-white">
                    <div className="flex items-start gap-2 mb-1.5 flex-wrap">
                      <span className="font-mono text-[10px] font-bold uppercase bg-[#00304D]/10 text-[#00304D] px-1.5 py-0.5 rounded shrink-0">{r.idRubro}</span>
                      <p className="font-bold text-neutral-800 flex-1 min-w-0">{r.nombreRubro ?? '—'}</p>
                      <span className="font-bold text-[#00304D] shrink-0">{fmtCop(r.totalRubro ?? 0)}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px]">
                      <Dato label="Horas" valor={r.numHoras} />
                      <Dato label="Páginas / unidades" valor={r.numPaginasUnidades} />
                      <Dato label="Beneficiarios" valor={r.numBeneficiarios} />
                      <Dato label="Días" valor={r.numDias} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                      <Stat label="Cofin. SENA" valor={fmtCop(r.cofinanciacionSena ?? 0)} />
                      <Stat label="Cont. especie" valor={fmtCop(r.contrapartidaEspecie ?? 0)} />
                      <Stat label="Cont. dinero" valor={fmtCop(r.contrapartidaDinero ?? 0)} />
                    </div>
                    {r.justificacion && (
                      <div className="mt-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Justificación</p>
                        <p className="text-[11px] text-neutral-700 whitespace-pre-line">{r.justificacion}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Bloque>
          )}

          {/* Gastos de operación */}
          {rubroGO && (
            <Bloque titulo="Gastos de operación de la AF (R09)">
              <div className="border border-neutral-200 rounded-lg p-3 text-xs bg-white">
                <div className="flex justify-between mb-2">
                  <p className="font-bold text-neutral-800">{rubroGO.nombreRubro ?? 'Gastos de Operación'}</p>
                  <span className="font-bold text-[#00304D]">{fmtCop(rubroGO.totalRubro ?? 0)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <Stat label="Cofin. SENA" valor={fmtCop(rubroGO.cofinanciacionSena ?? 0)} />
                  <Stat label="Cont. especie" valor={fmtCop(rubroGO.contrapartidaEspecie ?? 0)} />
                  <Stat label="Cont. dinero" valor={fmtCop(rubroGO.contrapartidaDinero ?? 0)} />
                </div>
                {rubroGO.justificacion && <p className="text-[11px] text-neutral-700 mt-2 whitespace-pre-line">{rubroGO.justificacion}</p>}
              </div>
            </Bloque>
          )}

          {/* Transferencia de conocimiento */}
          {rubroTrans && (
            <Bloque titulo="Transferencia de conocimiento (R015)">
              <div className="border border-neutral-200 rounded-lg p-3 text-xs bg-white">
                <div className="flex justify-between mb-2">
                  <p className="font-bold text-neutral-800">{rubroTrans.nombreRubro ?? 'Transferencia de Conocimiento'}</p>
                  <span className="font-bold text-[#00304D]">{fmtCop(rubroTrans.totalRubro ?? 0)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <Stat label="Beneficiarios" valor={(rubroTrans.numBeneficiarios ?? 0).toString()} />
                  <Stat label="Valor total" valor={fmtCop(rubroTrans.totalRubro ?? 0)} />
                </div>
                {rubroTrans.justificacion && <p className="text-[11px] text-neutral-700 mt-2 whitespace-pre-line">{rubroTrans.justificacion}</p>}
              </div>
            </Bloque>
          )}

          {/* Resumen presupuestal de la AF — solo rubros normales (no incluye GO ni Transferencia) */}
          <div className="border-t border-neutral-200 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-2">Resumen rubros AF (no incluye GO ni Transferencia)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Cofin. SENA" valor={fmtCop(totalCofin)} />
              <Stat label="Contra. especie" valor={fmtCop(totalEspecie)} />
              <Stat label="Contra. dinero" valor={fmtCop(totalDinero)} />
              <Stat label="Total AF" valor={fmtCop(totalRubro)} destacado />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#00304D] mb-2 border-b border-neutral-200 pb-1">{titulo}</p>
      {children}
    </div>
  )
}
