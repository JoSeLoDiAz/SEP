'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Loader2, MapPin, X } from 'lucide-react'
import api from '@/lib/api'
import type { MiFicha, MunicipioOpcion } from '@/lib/types/mi-expediente'
import {
  INSTITUTIONAL, PRIMARY, Section, input, inputBloqueado, label, mensajeError, type SetToast,
} from '@/components/mi-expediente/comunes'

const MAX_FOTO_MB = 8

function limpio(v: string | null | undefined): string | null {
  return (v ?? '').trim() || null
}

function etiquetaMunicipio(ficha: MiFicha): string {
  return [ficha.municipioNombre, ficha.municipioDeptoNombre].filter(Boolean).join(', ')
}

function iniciales(ficha: MiFicha): string {
  const n = (ficha.nombres ?? '').trim().charAt(0)
  const a = (ficha.primerApellido ?? '').trim().charAt(0)
  return (n + a).toUpperCase() || '—'
}

function Dato({ titulo, valor, mono }: { titulo: string; valor: string | null; mono?: boolean }) {
  return (
    <div>
      <p className={label}>{titulo}</p>
      <p className={`text-sm text-neutral-800 ${mono ? 'font-mono' : ''}`}>{valor || '—'}</p>
    </div>
  )
}

export default function TabPerfil({ ficha, setToast, onRecargar, inactivo = false }: {
  ficha: MiFicha
  setToast: SetToast
  onRecargar: () => void
  /** Ficha inactiva: el guard del backend rechaza toda escritura. */
  inactivo?: boolean
}) {
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [cargandoFoto, setCargandoFoto] = useState(true)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [recargaFoto, setRecargaFoto] = useState(0)
  const fotoRef = useRef<HTMLInputElement>(null)

  const [celular, setCelular] = useState(ficha.celular ?? '')
  const [profesion, setProfesion] = useState(ficha.profesion ?? '')
  const [posgrado, setPosgrado] = useState(ficha.posgrado ?? '')
  const [municipioId, setMunicipioId] = useState<number | null>(ficha.municipioId)
  const [guardando, setGuardando] = useState(false)

  // la url del blob se revoca en la limpieza: si no, cada recarga deja una fuga
  useEffect(() => {
    let vivo = true
    let url: string | null = null
    setCargandoFoto(true)
    setFotoUrl(null)
    ;(async () => {
      try {
        const r = await api.get<Blob>('/mi-expediente/foto', { responseType: 'blob' })
        if (!vivo) return
        url = URL.createObjectURL(r.data)
        setFotoUrl(url)
      } catch {
        if (vivo) setFotoUrl(null)
      } finally {
        if (vivo) setCargandoFoto(false)
      }
    })()
    return () => {
      vivo = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [recargaFoto])

  async function subirFoto(archivo: File) {
    if (!archivo.type.startsWith('image/')) {
      setToast({ tipo: 'error', msg: 'La foto debe ser una imagen (JPG o PNG)' })
      if (fotoRef.current) fotoRef.current.value = ''
      return
    }
    const mb = archivo.size / (1024 * 1024)
    if (mb > MAX_FOTO_MB) {
      setToast({ tipo: 'error', msg: `La imagen pesa ${mb.toFixed(1)} MB y el máximo son ${MAX_FOTO_MB} MB` })
      if (fotoRef.current) fotoRef.current.value = ''
      return
    }

    setSubiendoFoto(true)
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      const r = await api.post<{ message?: string }>('/mi-expediente/foto', fd)
      setToast({ tipo: 'success', msg: r.data?.message ?? 'Foto actualizada' })
      setRecargaFoto(n => n + 1)
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudo subir la foto') })
    } finally {
      setSubiendoFoto(false)
      if (fotoRef.current) fotoRef.current.value = ''
    }
  }

  async function guardar() {
    const cuerpo: {
      celular?: string | null
      profesion?: string | null
      posgrado?: string | null
      municipioId?: number | null
    } = {}
    if (limpio(celular) !== limpio(ficha.celular)) cuerpo.celular = limpio(celular)
    if (limpio(profesion) !== limpio(ficha.profesion)) cuerpo.profesion = limpio(profesion)
    if (limpio(posgrado) !== limpio(ficha.posgrado)) cuerpo.posgrado = limpio(posgrado)
    if (municipioId !== ficha.municipioId) cuerpo.municipioId = municipioId

    if (Object.keys(cuerpo).length === 0) {
      return setToast({ tipo: 'error', msg: 'No hay cambios que guardar' })
    }

    setGuardando(true)
    try {
      const r = await api.put<{ message?: string }>('/mi-expediente/perfil', cuerpo)
      setToast({ tipo: 'success', msg: r.data?.message ?? 'Datos actualizados' })
      onRecargar()
    } catch (err) {
      setToast({ tipo: 'error', msg: mensajeError(err, 'No se pudieron guardar los cambios') })
    } finally {
      setGuardando(false)
    }
  }

  const nombreCompleto = [ficha.nombres, ficha.primerApellido, ficha.segundoApellido]
    .filter(Boolean).join(' ')
  const hayJefe = !!(ficha.jefeNombre || ficha.jefeCargo || ficha.jefeEmail)

  return (
    <div className="flex flex-col gap-5">
      <Section titulo="Mis datos" ayuda="Lo que el banco tiene registrado de ti">
        <div className="flex flex-col gap-5 px-5 py-4">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
              {cargandoFoto ? (
                <span className="flex h-full w-full items-center justify-center text-neutral-400">
                  <Loader2 size={14} className="animate-spin" />
                </span>
              ) : fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoUrl} alt="Mi foto" className="h-full w-full object-cover" />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center text-xl font-bold"
                  style={{ color: PRIMARY }}
                >
                  {iniciales(ficha)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-neutral-900">{nombreCompleto || '—'}</p>
              <p className="text-[12px] text-neutral-500">{ficha.cargo || 'Sin cargo registrado'}</p>
              {!inactivo && (
                <button
                  onClick={() => fotoRef.current?.click()}
                  disabled={subiendoFoto}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
                >
                  {subiendoFoto ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  Cambiar foto
                </button>
              )}
              <input
                ref={fotoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f) }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Dato titulo="Nombre completo" valor={nombreCompleto} />
            <Dato titulo="Identificación" valor={ficha.identificacion} mono />
            <Dato titulo="Correo" valor={ficha.email} />
            <Dato titulo="Correo institucional" valor={ficha.emailInstitucional} />
            <Dato titulo="Cargo" valor={ficha.cargo} />
            <Dato titulo="Regional" valor={ficha.regionalNombre} />
            <Dato titulo="Centro de formación" valor={ficha.centroNombre} />
            {hayJefe && (
              <div className="sm:col-span-2">
                <p className={label}>Jefe inmediato</p>
                <p className="text-sm text-neutral-800">{ficha.jefeNombre || '—'}</p>
                {(ficha.jefeCargo || ficha.jefeEmail) && (
                  <p className="text-[12px] text-neutral-500">
                    {[ficha.jefeCargo, ficha.jefeEmail].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            Estos datos los administra el equipo del banco. Si algo está mal, escríbeles.
          </p>
        </div>
      </Section>

      <Section
        titulo={inactivo ? 'Tus datos de contacto' : 'Lo que puedes actualizar'}
        ayuda={inactivo
          // el mismo texto del guard, para que la pantalla y el backend digan lo mismo
          ? 'Tu ficha de evaluador está inactiva: puedes consultarla, pero no modificarla. '
            + 'Escríbele a la gestora del banco si necesitas actualizarla.'
          : 'Se guarda en tu expediente al instante'}
      >
        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Celular</label>
              <input
                value={celular}
                onChange={e => setCelular(e.target.value)}
                readOnly={inactivo}
                maxLength={30}
                placeholder="300 000 0000"
                className={inactivo ? inputBloqueado : input}
              />
            </div>
            <div>
              <label className={label}>Profesión</label>
              <input
                value={profesion}
                onChange={e => setProfesion(e.target.value)}
                maxLength={200}
                className={inactivo ? inputBloqueado : input}
              />
            </div>
            <div>
              <label className={label}>Posgrado</label>
              <input
                value={posgrado}
                onChange={e => setPosgrado(e.target.value)}
                maxLength={200}
                className={inactivo ? inputBloqueado : input}
              />
            </div>
            <div>
              <label className={label}>Municipio donde vives</label>
              <BuscadorMunicipio
                etiquetaInicial={etiquetaMunicipio(ficha)}
                municipioId={municipioId}
                onCambio={setMunicipioId}
              />
            </div>
          </div>

          {!inactivo && (
            <div className="flex justify-end">
              <button
                onClick={guardar}
                disabled={guardando}
                className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90"
                style={{ backgroundColor: INSTITUTIONAL }}
              >
                {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Guardar cambios
              </button>
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}

function BuscadorMunicipio({ etiquetaInicial, municipioId, onCambio }: {
  etiquetaInicial: string
  municipioId: number | null
  onCambio: (id: number | null) => void
}) {
  const [texto, setTexto] = useState(etiquetaInicial)
  const [elegido, setElegido] = useState(municipioId != null ? etiquetaInicial : '')
  const [resultados, setResultados] = useState<MunicipioOpcion[]>([])
  const [buscando, setBuscando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const cajaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (cajaRef.current && !cajaRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  useEffect(() => {
    const q = texto.trim()
    if (q.length < 2 || q === elegido) {
      setResultados([])
      setBuscando(false)
      return
    }
    let vivo = true
    const ctrl = new AbortController()
    setBuscando(true)
    const temporizador = setTimeout(() => {
      api.get<MunicipioOpcion[]>('/mi-expediente/catalogos/ciudades/buscar', {
        params: { q, limite: 20 },
        signal: ctrl.signal,
      })
        .then(r => { if (vivo) setResultados(r.data ?? []) })
        .catch(err => {
          if (vivo && (err as { name?: string })?.name !== 'CanceledError') setResultados([])
        })
        .finally(() => { if (vivo) setBuscando(false) })
    }, 280)
    return () => { vivo = false; clearTimeout(temporizador); ctrl.abort() }
  }, [texto, elegido])

  function elegir(m: MunicipioOpcion) {
    const etiqueta = [m.ciudad, m.depto].filter(Boolean).join(', ')
    onCambio(m.id)
    setElegido(etiqueta)
    setTexto(etiqueta)
    setResultados([])
    setAbierto(false)
  }

  function limpiar() {
    onCambio(null)
    setElegido('')
    setTexto('')
    setResultados([])
    setAbierto(false)
  }

  return (
    <div ref={cajaRef} className="relative">
      <MapPin size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
      <input
        value={texto}
        onChange={e => {
          setTexto(e.target.value)
          setAbierto(true)
          // al escribir de nuevo el id deja de valer hasta que elija otro
          if (municipioId != null) { onCambio(null); setElegido('') }
        }}
        onFocus={() => setAbierto(true)}
        placeholder="Escribe 2 letras o más"
        autoComplete="off"
        className={`${input} pl-8 pr-8`}
      />
      {(texto || municipioId != null) && (
        <button
          onClick={limpiar}
          title="Quitar el municipio"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X size={14} />
        </button>
      )}
      {abierto && texto.trim().length >= 2 && texto.trim() !== elegido && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
          {buscando ? (
            <p className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-500">
              <Loader2 size={14} className="animate-spin" /> Buscando…
            </p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-2 text-xs text-neutral-500">Sin resultados</p>
          ) : (
            resultados.map(m => (
              <button
                key={m.id}
                onClick={() => elegir(m)}
                className="w-full border-b border-neutral-50 px-3 py-2 text-left text-sm transition last:border-b-0 hover:bg-neutral-50"
              >
                <span className="font-medium text-neutral-800">{m.ciudad}</span>
                {m.depto && <span className="text-neutral-500"> — {m.depto}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
