'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Briefcase, GraduationCap, Loader2, MonitorSmartphone, Plus, Save, Trash2, X } from 'lucide-react'
import api from '@/lib/api'
import { fmtFecha } from '@/lib/format-date'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import {
  BotonesArchivo, Cargando, INSTITUTIONAL, Section, Vacio, input, label, mensajeError,
  type SetToast,
} from '@/components/mi-expediente/comunes'
import type { MiEstudio, MiExperiencia, MiTic, TipoEstudioOpcion } from '@/lib/types/mi-expediente'

const MAX_MB = 8

const BTN_PRIMARIO = 'inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90'
const BTN_CANCELAR = 'px-4 py-2 border border-neutral-300 text-sm font-semibold rounded-lg hover:bg-white transition'
const BTN_BORRAR = 'shrink-0 rounded-lg border border-neutral-200 p-1.5 text-neutral-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600'
const INPUT_ARCHIVO = 'block w-full text-xs text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-neutral-700 hover:file:bg-neutral-200'
const SIN_EDITAR = 'Para corregir un registro, bórralo y vuelve a agregarlo.'

interface Fila {
  /** Puede ser texto: las filas que salen solas no tienen id propio. */
  id: string | number
  principal: string
  meta: string
  archivoNombre: string | null
  tieneArchivo: boolean
  /** Ruta completa del archivo. Sin esto se arma con `ruta/id/archivo`. */
  urlArchivo?: string | null
  /** Sale sola de otro dato: ni se corrige ni se borra desde aquí. */
  automatica?: boolean
  /** Etiqueta corta al lado del título. */
  chip?: string
  /** Nota bajo la fila, para explicar de dónde sale. */
  pie?: string
}

function rangoFechas(inicio: string | null, fin: string | null): string {
  // fechas de calendario: fmtFecha las lee en UTC. Con fmtDateTime el evaluador
  // veía "12/09/1991, 7:00 p. m." donde su diploma dice 13/09/1991
  const desde = inicio ? fmtFecha(inicio) : null
  const hasta = fin ? fmtFecha(fin) : 'Actualidad'
  if (desde) return `${desde} — ${hasta}`
  return fin ? `hasta ${hasta}` : hasta
}

function BloqueLista<T>({
  titulo, ayuda, icono, ruta, filaDe, vacio, abierto, onAbierto, recarga, formulario, setToast,
}: {
  titulo: string
  ayuda: string
  icono: ReactNode
  ruta: string
  filaDe: (item: T) => Fila
  vacio: string
  abierto: boolean
  onAbierto: (v: boolean) => void
  recarga: number
  formulario: ReactNode
  setToast: SetToast
}) {
  const [items, setItems] = useState<T[]>([])
  const [cargando, setCargando] = useState(true)
  const [refresco, setRefresco] = useState(0)
  const [porBorrar, setPorBorrar] = useState<Fila | null>(null)
  const [borrando, setBorrando] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true)
      try {
        const r = await api.get<T[]>(ruta)
        if (vivo) setItems(r.data ?? [])
      } catch (err) {
        if (vivo) setToast({ tipo: 'error', msg: mensajeError(err, `No se pudo cargar ${titulo.toLowerCase()}`) })
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [ruta, titulo, recarga, refresco, setToast])

  async function borrar() {
    if (!porBorrar) return
    setBorrando(true)
    try {
      await api.delete(`${ruta}/${porBorrar.id}`)
      setToast({ tipo: 'success', msg: 'Registro eliminado' })
      setPorBorrar(null)
      setRefresco(n => n + 1)
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo eliminar') })
    } finally {
      setBorrando(false)
    }
  }

  const filas = items.map(filaDe)

  return (
    <>
      <Section
        titulo={`${titulo}${filas.length ? ` (${filas.length})` : ''}`}
        ayuda={ayuda}
        accion={
          <button
            onClick={() => onAbierto(!abierto)}
            className={BTN_PRIMARIO}
            style={{ backgroundColor: INSTITUTIONAL }}
          >
            {abierto ? <X size={14} /> : <Plus size={14} />}
            {abierto ? 'Cerrar' : 'Agregar'}
          </button>
        }
      >
        {abierto && (
          <div className="border-b border-neutral-100 bg-neutral-50/60 px-5 py-4">{formulario}</div>
        )}

        {cargando ? (
          <Cargando />
        ) : filas.length === 0 ? (
          <div className="px-5 py-5">
            <Vacio icono={icono} titulo={vacio} detalle="Usa «Agregar» para cargarlo." />
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5 px-5 py-4">
            {filas.map(f => (
              <li key={f.id} className="flex items-center gap-3 rounded-xl border border-neutral-100 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-800">
                    <span className="truncate">{f.principal}</span>
                    {f.chip && (
                      <span className="shrink-0 rounded-full bg-[#00304D]/10 px-2 py-0.5 text-[10px] font-semibold text-[#00304D]">
                        {f.chip}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[11px] text-neutral-500">{f.meta}</p>
                  {f.pie && <p className="truncate text-[10px] text-neutral-400">{f.pie}</p>}
                </div>
                {f.tieneArchivo && (
                  <BotonesArchivo
                    url={f.urlArchivo ?? `${ruta}/${f.id}/archivo`}
                    nombre={f.archivoNombre}
                    setToast={setToast}
                  />
                )}
                {!f.automatica && (
                  <button onClick={() => setPorBorrar(f)} title="Eliminar" className={BTN_BORRAR}>
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <ConfirmModal
        open={porBorrar != null}
        onClose={() => setPorBorrar(null)}
        onConfirm={borrar}
        tipo="delete"
        titulo="Eliminar el registro"
        mensaje={<>Se borra <strong>{porBorrar?.principal}</strong> junto con su soporte. {SIN_EDITAR}</>}
        textoConfirmar="Eliminar"
        cargando={borrando}
      />
    </>
  )
}

export default function TabHojaVida({ setToast }: { setToast: SetToast }) {
  const [tipos, setTipos] = useState<TipoEstudioOpcion[]>([])

  const [abiertoEst, setAbiertoEst] = useState(false)
  const [recargaEst, setRecargaEst] = useState(0)
  const [creandoEst, setCreandoEst] = useState(false)
  const [tipoId, setTipoId] = useState('')
  const [tituloEst, setTituloEst] = useState('')
  const [institucion, setInstitucion] = useState('')
  const [fechaGrado, setFechaGrado] = useState('')
  const [archEst, setArchEst] = useState<File | null>(null)
  const refEst = useRef<HTMLInputElement>(null)

  const [abiertoExp, setAbiertoExp] = useState(false)
  const [recargaExp, setRecargaExp] = useState(0)
  const [creandoExp, setCreandoExp] = useState(false)
  const [cargo, setCargo] = useState('')
  const [entidad, setEntidad] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFinExp, setFechaFinExp] = useState('')
  const [archExp, setArchExp] = useState<File | null>(null)
  const refExp = useRef<HTMLInputElement>(null)

  const [abiertoTic, setAbiertoTic] = useState(false)
  const [recargaTic, setRecargaTic] = useState(0)
  const [creandoTic, setCreandoTic] = useState(false)
  const [nombreTic, setNombreTic] = useState('')
  const [horas, setHoras] = useState('')
  const [fechaFinTic, setFechaFinTic] = useState('')
  const [archTic, setArchTic] = useState<File | null>(null)
  const refTic = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const r = await api.get<TipoEstudioOpcion[]>('/mi-expediente/catalogos/tipos-estudio')
        if (vivo) setTipos(r.data ?? [])
      } catch (err) {
        if (vivo) setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudieron cargar los tipos de estudio') })
      }
    })()
    return () => { vivo = false }
  }, [setToast])

  // se mide aquí: el servidor solo responde 400 después de subirlo entero
  function archivoCabe(f: File | null): boolean {
    if (f && f.size > MAX_MB * 1024 * 1024) {
      setToast({
        tipo: 'error',
        msg: `El soporte pesa ${(f.size / (1024 * 1024)).toFixed(1)} MB y el máximo son ${MAX_MB} MB`,
      })
      return false
    }
    return true
  }

  async function crearEstudio() {
    if (!tipoId) return setToast({ tipo: 'error', msg: 'Escoge el tipo de estudio' })
    if (!archivoCabe(archEst)) return
    setCreandoEst(true)
    try {
      const fd = new FormData()
      fd.append('tipoEstudioId', tipoId)
      if (tituloEst.trim()) fd.append('titulo', tituloEst.trim())
      if (institucion.trim()) fd.append('institucion', institucion.trim())
      if (fechaGrado) fd.append('fechaGrado', fechaGrado)
      if (archEst) fd.append('archivo', archEst)
      await api.post('/mi-expediente/estudios', fd)
      setToast({ tipo: 'success', msg: 'Estudio agregado' })
      setAbiertoEst(false)
      setTipoId(''); setTituloEst(''); setInstitucion(''); setFechaGrado(''); setArchEst(null)
      if (refEst.current) refEst.current.value = ''
      setRecargaEst(n => n + 1)
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo agregar el estudio') })
    } finally {
      setCreandoEst(false)
    }
  }

  async function crearExperiencia() {
    if (!cargo.trim()) return setToast({ tipo: 'error', msg: 'El cargo es obligatorio' })
    if (!entidad.trim()) return setToast({ tipo: 'error', msg: 'La entidad es obligatoria' })
    if (!archivoCabe(archExp)) return
    setCreandoExp(true)
    try {
      const fd = new FormData()
      fd.append('cargo', cargo.trim())
      fd.append('entidad', entidad.trim())
      if (fechaInicio) fd.append('fechaInicio', fechaInicio)
      if (fechaFinExp) fd.append('fechaFin', fechaFinExp)
      if (archExp) fd.append('archivo', archExp)
      await api.post('/mi-expediente/experiencia', fd)
      setToast({ tipo: 'success', msg: 'Experiencia agregada' })
      setAbiertoExp(false)
      setCargo(''); setEntidad(''); setFechaInicio(''); setFechaFinExp(''); setArchExp(null)
      if (refExp.current) refExp.current.value = ''
      setRecargaExp(n => n + 1)
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo agregar la experiencia') })
    } finally {
      setCreandoExp(false)
    }
  }

  async function crearTic() {
    if (!nombreTic.trim()) return setToast({ tipo: 'error', msg: 'El nombre de la certificación es obligatorio' })
    if (!archivoCabe(archTic)) return
    setCreandoTic(true)
    try {
      const fd = new FormData()
      fd.append('nombre', nombreTic.trim())
      if (horas.trim()) fd.append('horas', horas.trim())
      if (fechaFinTic) fd.append('fechaFin', fechaFinTic)
      if (archTic) fd.append('archivo', archTic)
      await api.post('/mi-expediente/tic', fd)
      setToast({ tipo: 'success', msg: 'Certificación agregada' })
      setAbiertoTic(false)
      setNombreTic(''); setHoras(''); setFechaFinTic(''); setArchTic(null)
      if (refTic.current) refTic.current.value = ''
      setRecargaTic(n => n + 1)
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo agregar la certificación') })
    } finally {
      setCreandoTic(false)
    }
  }

  const formEstudio = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={label}>Tipo de estudio *</label>
        <select value={tipoId} onChange={e => setTipoId(e.target.value)} className={input}>
          <option value="">— Escoge el tipo —</option>
          {tipos.map(t => <option key={t.id} value={String(t.id)}>{t.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className={label}>Título obtenido</label>
        <input value={tituloEst} onChange={e => setTituloEst(e.target.value)} maxLength={200} className={input} />
      </div>
      <div>
        <label className={label}>Institución</label>
        <input value={institucion} onChange={e => setInstitucion(e.target.value)} maxLength={200} className={input} />
      </div>
      <div>
        <label className={label}>Fecha de grado</label>
        <input type="date" value={fechaGrado} onChange={e => setFechaGrado(e.target.value)} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Soporte (PDF o imagen, máx. {MAX_MB} MB)</label>
        <input
          ref={refEst}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={e => setArchEst(e.target.files?.[0] ?? null)}
          className={INPUT_ARCHIVO}
        />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button onClick={() => setAbiertoEst(false)} disabled={creandoEst} className={BTN_CANCELAR}>Cancelar</button>
        <button onClick={crearEstudio} disabled={creandoEst} className={BTN_PRIMARIO} style={{ backgroundColor: INSTITUTIONAL }}>
          {creandoEst ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar estudio
        </button>
      </div>
    </div>
  )

  const formExperiencia = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={label}>Cargo *</label>
        <input value={cargo} onChange={e => setCargo(e.target.value)} maxLength={200} className={input} />
      </div>
      <div>
        <label className={label}>Entidad *</label>
        <input value={entidad} onChange={e => setEntidad(e.target.value)} maxLength={200} className={input} />
      </div>
      <div>
        <label className={label}>Fecha de inicio</label>
        <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className={input} />
      </div>
      <div>
        <label className={label}>Fecha de retiro</label>
        <input type="date" value={fechaFinExp} onChange={e => setFechaFinExp(e.target.value)} className={input} />
        <p className="mt-1 text-[11px] text-neutral-400">Déjala vacía si sigues ahí.</p>
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Soporte (PDF o imagen, máx. {MAX_MB} MB)</label>
        <input
          ref={refExp}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={e => setArchExp(e.target.files?.[0] ?? null)}
          className={INPUT_ARCHIVO}
        />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button onClick={() => setAbiertoExp(false)} disabled={creandoExp} className={BTN_CANCELAR}>Cancelar</button>
        <button onClick={crearExperiencia} disabled={creandoExp} className={BTN_PRIMARIO} style={{ backgroundColor: INSTITUTIONAL }}>
          {creandoExp ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar experiencia
        </button>
      </div>
    </div>
  )

  const formTic = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={label}>Nombre de la certificación *</label>
        <input value={nombreTic} onChange={e => setNombreTic(e.target.value)} maxLength={200} className={input} />
      </div>
      <div>
        <label className={label}>Horas</label>
        <input type="number" min={0} value={horas} onChange={e => setHoras(e.target.value)} className={input} />
      </div>
      <div>
        <label className={label}>Fecha de finalización</label>
        <input type="date" value={fechaFinTic} onChange={e => setFechaFinTic(e.target.value)} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Soporte (PDF o imagen, máx. {MAX_MB} MB)</label>
        <input
          ref={refTic}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={e => setArchTic(e.target.files?.[0] ?? null)}
          className={INPUT_ARCHIVO}
        />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button onClick={() => setAbiertoTic(false)} disabled={creandoTic} className={BTN_CANCELAR}>Cancelar</button>
        <button onClick={crearTic} disabled={creandoTic} className={BTN_PRIMARIO} style={{ backgroundColor: INSTITUTIONAL }}>
          {creandoTic ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar certificación
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <BloqueLista<MiEstudio>
        titulo="Estudios"
        ayuda={`Tu formación académica con el diploma que la respalda. ${SIN_EDITAR}`}
        icono={<GraduationCap size={28} className="mx-auto text-neutral-300" />}
        ruta="/mi-expediente/estudios"
        vacio="Sin estudios registrados"
        abierto={abiertoEst}
        onAbierto={setAbiertoEst}
        recarga={recargaEst}
        formulario={formEstudio}
        setToast={setToast}
        filaDe={(e: MiEstudio) => ({
          id: e.estudioId,
          principal: e.titulo || '(sin título)',
          meta: [e.tipoEstudio, e.institucion, e.fechaGrado ? fmtFecha(e.fechaGrado) : null]
            .filter(Boolean).join(' · ') || '—',
          archivoNombre: e.archivoNombre,
          tieneArchivo: e.tieneArchivo,
        })}
      />

      <BloqueLista<MiExperiencia>
        titulo="Experiencia"
        ayuda={`Dónde has trabajado y en qué cargo. ${SIN_EDITAR} Tus participaciones como evaluador salen solas y no se tocan desde aquí.`}
        icono={<Briefcase size={28} className="mx-auto text-neutral-300" />}
        ruta="/mi-expediente/experiencia"
        vacio="Sin experiencia registrada"
        abierto={abiertoExp}
        onAbierto={setAbiertoExp}
        recarga={recargaExp}
        formulario={formExperiencia}
        setToast={setToast}
        filaDe={(x: MiExperiencia) => {
          // los ciclos certificados salen solos: aquí no se corrigen ni se borran
          if (x.origen === 'CICLO') {
            const cuando = `${x.anio}${x.periodo ? `-${x.periodo}` : ''}`
            return {
              id: x.clave ?? `ciclo-${x.participacionId}`,
              principal: x.cargo || 'Participación en convocatoria',
              meta: [x.entidad, `Convocatoria de ${cuando}`].filter(Boolean).join(' · '),
              archivoNombre: x.archivoNombre,
              tieneArchivo: x.tieneArchivo,
              urlArchivo: x.archivoUrl ?? null,
              automatica: true,
              chip: `Del ciclo ${cuando}`,
              pie: 'Sale de tu certificado del banco. Si algo está mal, escríbele a la gestora.',
            }
          }
          return {
            id: x.clave ?? x.experienciaId,
            principal: x.cargo || '(sin cargo)',
            meta: [x.entidad, rangoFechas(x.fechaInicio, x.fechaFin)].filter(Boolean).join(' · '),
            archivoNombre: x.archivoNombre,
            tieneArchivo: x.tieneArchivo,
          }
        }}
      />

      <BloqueLista<MiTic>
        titulo="Certificaciones TIC"
        ayuda={`Cursos y certificaciones en herramientas digitales. ${SIN_EDITAR}`}
        icono={<MonitorSmartphone size={28} className="mx-auto text-neutral-300" />}
        ruta="/mi-expediente/tic"
        vacio="Sin certificaciones TIC"
        abierto={abiertoTic}
        onAbierto={setAbiertoTic}
        recarga={recargaTic}
        formulario={formTic}
        setToast={setToast}
        filaDe={(t: MiTic) => ({
          id: t.ticId,
          principal: t.nombre || '(sin nombre)',
          meta: [t.horas != null ? `${t.horas}h` : null, t.fechaFin ? fmtFecha(t.fechaFin) : null]
            .filter(Boolean).join(' · ') || '—',
          archivoNombre: t.archivoNombre,
          tieneArchivo: t.tieneArchivo,
        })}
      />
    </div>
  )
}
