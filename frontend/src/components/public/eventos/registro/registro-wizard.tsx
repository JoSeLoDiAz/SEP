'use client'

import { useState, useCallback, useEffect } from 'react'
import type { RegistroState } from '@/types'
import { StepHabeasData } from './step-habeas-data'
import { StepBuscarPersona } from './step-buscar-persona'
import { StepDatosBasicos } from './step-datos-basicos'
import { StepDatosEmpresa } from './step-datos-empresa'
import { StepConfirmar } from './step-confirmar'
import api from '@/lib/api'

// steps: 0 habeas data, 1 buscar persona, 2 datos básicos, 3 empresa, 4 confirmar

interface Props {
  eventoId: number
  eventoNombre: string
}

type Alerta = { msg: string; tipo: 'error' | 'info' | 'success' } | null

const INITIAL_STATE: RegistroState = {
  tipoIdentificacion: '',
  identificacion: '',
  personaId: null,
  maskedNombreCompleto: '',
  personaNombres: '',
  personaPrimerApellido: '',
  personaSegundoApellido: '',
  generoId: '',
  personaEstrato: '',
  personaFechaNacimiento: '',
  personaCelular: '',
  personaDepartamentoId: '',
  personaCiudad: '',
  personaBarrio: '',
  personaDireccion: '',
  personaEmail: '',
  tipoDocEmpresa: '',
  beneficiarioEmpresaNumero: '',
  beneficiarioEmpresaId: null,
  beneficiarioEmpresaNombre: '',
  tamanoEmpresaId: null,
  tamanoEmpresaNombre: '',
  postulacionAno: new Date().getFullYear(),
  postulacionEdad: 0,
  rangoEdadId: 0,
  postulacionAntiguedad: '',
  caracterizacionId: '',
  nivelOcupacionalId: '',
  conferenciaId: '',
  validarConferencia: false,
  validarPosAno: 0,
  valiarRegistro: 0,
}

function calcularEdad(fechaNacimiento: string): number {
  if (!fechaNacimiento) return 0
  const hoy = new Date()
  const nac = new Date(fechaNacimiento)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

function calcularRangoEdad(edad: number): number {
  if (edad < 18) return 1
  if (edad <= 28) return 2
  if (edad <= 40) return 3
  if (edad <= 60) return 4
  return 5
}

function maskNombre(nombre: string): string {
  if (!nombre || nombre.length <= 3) return nombre
  return nombre.slice(0, 3) + '*'.repeat(nombre.length - 3)
}

export function RegistroWizard({ eventoId, eventoNombre }: Props) {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<RegistroState>(INITIAL_STATE)
  const [loading, setLoading] = useState(false)
  const [alerta, setAlerta] = useState<Alerta>(null)
  const [personaExistente, setPersonaExistente] = useState(false)

  const [departamentos, setDepartamentos] = useState<{ id: string; nombre: string }[]>([])
  const [ciudades, setCiudades] = useState<{ id: string; nombre: string }[]>([])
  const [caracterizaciones, setCaracterizaciones] = useState<{ id: string; nombre: string }[]>([])
  const [nivelesOcupacionales, setNivelesOcupacionales] = useState<{ id: string; nombre: string }[]>([])
  const [conferencias, setConferencias] = useState<{ id: string; nombre: string }[]>([])

  useEffect(() => {
    Promise.all([
      api.get<{ id: string; nombre: string }[]>('/catalogos/departamentos'),
      api.get<{ id: string; nombre: string }[]>('/catalogos/caracterizaciones'),
      api.get<{ id: string; nombre: string }[]>('/catalogos/niveles-ocupacionales'),
      api.get<{ id: string; nombre: string }[]>(`/eventos/${eventoId}/conferencias`),
    ]).then(([deptos, caract, niveles, confs]) => {
      setDepartamentos(deptos.data)
      setCaracterizaciones(caract.data)
      setNivelesOcupacionales(niveles.data)
      setConferencias(confs.data)
    }).catch(() => {
      // Catálogos opcionales: si falla no bloqueamos el flujo
    })
  }, [eventoId])

  const onChange = useCallback(
    (field: keyof RegistroState, value: string | number | boolean | null) => {
      setState((prev) => ({ ...prev, [field]: value }))
      setAlerta(null)
    },
    [],
  )

  const handleDepartamentoChange = useCallback(async (deptoId: string) => {
    setState((prev) => ({ ...prev, personaDepartamentoId: deptoId, personaCiudad: '' }))
    setCiudades([])
    if (!deptoId) return
    try {
      const res = await api.get<{ id: string; nombre: string }[]>(
        `/catalogos/departamentos/${deptoId}/ciudades`,
      )
      setCiudades(res.data)
    } catch {
      // ignore
    }
  }, [])

  const handleAceptar = () => {
    setStep(1)
    setAlerta(null)
  }

  const handleRechazar = () => {
    window.location.href = '/eventos'
  }

  const handleBuscarPersona = async () => {
    if (!state.tipoIdentificacion || !state.identificacion.trim()) {
      setAlerta({ msg: 'Debe seleccionar el tipo de documento e ingresar el número.', tipo: 'error' })
      return
    }
    setLoading(true)
    setAlerta(null)
    try {
      const res = await api.get('/personas/buscar', {
        params: {
          tipoDoc: state.tipoIdentificacion,
          numero: state.identificacion,
          eventoId,
        },
      })
      const data = res.data

      // data.validarPosAno: 1=nueva, 2=existente sin postulación, 3=ya inscrito
      if (data.validarPosAno === 3) {
        setAlerta({ msg: 'Esta persona ya se encuentra inscrita en el evento.', tipo: 'error' })
        setLoading(false)
        return
      }

      const nombre = `${data.personaNombres ?? ''} ${data.personaPrimerApellido ?? ''}`.trim()
      const masked = maskNombre(nombre)

      setState((prev) => ({
        ...prev,
        personaId: data.personaId ?? null,
        maskedNombreCompleto: masked,
        personaNombres: data.personaNombres ?? '',
        personaPrimerApellido: data.personaPrimerApellido ?? '',
        personaSegundoApellido: data.personaSegundoApellido ?? '',
        generoId: data.generoId ?? '',
        personaEstrato: data.personaEstrato ?? '',
        personaFechaNacimiento: data.personaFechaNacimiento ?? '',
        personaCelular: data.personaCelular ?? '',
        personaDepartamentoId: data.personaDepartamentoId ?? '',
        personaCiudad: data.personaCiudad ?? '',
        personaBarrio: data.personaBarrio ?? '',
        personaDireccion: data.personaDireccion ?? '',
        personaEmail: data.personaEmail ?? '',
        postulacionAno: new Date().getFullYear(),
        postulacionEdad: calcularEdad(data.personaFechaNacimiento ?? ''),
        rangoEdadId: calcularRangoEdad(calcularEdad(data.personaFechaNacimiento ?? '')),
        validarPosAno: data.validarPosAno ?? 1,
        valiarRegistro: data.valiarRegistro ?? 0,
        validarConferencia: data.validarConferencia ?? false,
      }))

      const esExistente = !!data.personaId
      setPersonaExistente(esExistente)

      if (data.personaDepartamentoId) {
        try {
          const ciudadesRes = await api.get<{ id: string; nombre: string }[]>(
            `/catalogos/departamentos/${data.personaDepartamentoId}/ciudades`,
          )
          setCiudades(ciudadesRes.data)
        } catch { /* ignore */ }
      }

      setStep(2)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al buscar la persona. Intente nuevamente.'
      setAlerta({ msg, tipo: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleGuardarDatosBasicos = async () => {
    const required = [
      state.personaNombres, state.personaPrimerApellido, state.generoId,
      state.personaEstrato, state.personaFechaNacimiento, state.personaCelular,
      state.personaDepartamentoId, state.personaCiudad, state.personaEmail,
      state.personaBarrio, state.personaDireccion,
    ]
    if (required.some((v) => !v || v === '')) {
      setAlerta({ msg: 'Complete todos los campos obligatorios.', tipo: 'error' })
      return
    }
    setLoading(true)
    setAlerta(null)
    try {
      const payload = {
        tipoDocumentoIdentidadId: state.tipoIdentificacion,
        personaIdentificacion: state.identificacion,
        personaNombres: state.personaNombres,
        personaPrimerApellido: state.personaPrimerApellido,
        personaSegundoApellido: state.personaSegundoApellido,
        generoId: state.generoId,
        personaEstrato: state.personaEstrato,
        personaFechaNacimiento: state.personaFechaNacimiento,
        personaCelular: state.personaCelular,
        personaDepartamentoId: state.personaDepartamentoId,
        personaCiudad: state.personaCiudad,
        personaBarrio: state.personaBarrio,
        personaDireccion: state.personaDireccion,
        personaEmail: state.personaEmail,
      }
      const res = await api.post('/personas', payload)
      const edad = calcularEdad(state.personaFechaNacimiento)
      setState((prev) => ({
        ...prev,
        personaId: res.data.personaId,
        postulacionEdad: edad,
        rangoEdadId: calcularRangoEdad(edad),
      }))
      setStep(3)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al guardar los datos básicos.'
      setAlerta({ msg, tipo: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // valiarRegistro=1: la persona ya existe pero no tiene postulación del año
  const handleAvanzarExistente = () => {
    setStep(3)
    setAlerta(null)
  }

  const handleBuscarEmpresa = async () => {
    if (!state.tipoDocEmpresa || !state.beneficiarioEmpresaNumero.trim()) {
      setAlerta({ msg: 'Ingrese el tipo de documento y número de la empresa.', tipo: 'error' })
      return
    }
    setLoading(true)
    setAlerta(null)
    try {
      const res = await api.get('/empresas/buscar', {
        params: { tipoDoc: state.tipoDocEmpresa, numero: state.beneficiarioEmpresaNumero },
      })
      const emp = res.data
      setState((prev) => ({
        ...prev,
        beneficiarioEmpresaId: emp.beneficiarioEmpresaId,
        beneficiarioEmpresaNombre: emp.beneficiarioEmpresaNombre,
        tamanoEmpresaId: emp.tamanoEmpresaId,
        tamanoEmpresaNombre: emp.tamanoEmpresaNombre,
      }))
      setAlerta({ msg: `Empresa encontrada: ${emp.beneficiarioEmpresaNombre}`, tipo: 'info' })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Empresa no encontrada.'
      setAlerta({ msg, tipo: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleCrearEmpresa = () => {
    window.open('/empresas/nueva', '_blank')
  }

  const handleGuardarPostulacion = async () => {
    if (!state.beneficiarioEmpresaId) {
      setAlerta({ msg: 'Debe buscar y seleccionar una empresa.', tipo: 'error' })
      return
    }
    if (!state.postulacionAntiguedad || !state.caracterizacionId || !state.nivelOcupacionalId) {
      setAlerta({ msg: 'Complete todos los campos de postulación.', tipo: 'error' })
      return
    }
    setLoading(true)
    setAlerta(null)
    try {
      await api.post('/postulaciones', {
        personaId: state.personaId,
        eventoId,
        beneficiarioEmpresaId: state.beneficiarioEmpresaId,
        postulacionAno: state.postulacionAno,
        postulacionEdad: state.postulacionEdad,
        rangoEdadId: state.rangoEdadId,
        postulacionAntiguedad: state.postulacionAntiguedad,
        caracterizacionId: state.caracterizacionId,
        nivelOcupacionalId: state.nivelOcupacionalId,
      })
      setStep(4)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al guardar los datos empresariales.'
      setAlerta({ msg, tipo: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmar = async () => {
    if (state.validarConferencia && !state.conferenciaId) {
      setAlerta({ msg: 'Debe seleccionar el tipo de evento al cual desea participar.', tipo: 'error' })
      return
    }
    setLoading(true)
    setAlerta(null)
    try {
      await api.post('/inscripciones', {
        personaId: state.personaId,
        eventoId,
        conferenciaId: state.conferenciaId || null,
        tipoIdentificacion: state.tipoIdentificacion,
        identificacion: state.identificacion,
      })
      setAlerta({ msg: '¡Inscripción realizada exitosamente! Recibirá confirmación en su correo electrónico.', tipo: 'success' })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al confirmar la inscripción.'
      setAlerta({ msg, tipo: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const STEP_LABELS = ['Habeas Data', 'Identificación', 'Datos Básicos', 'Empresa', 'Confirmar']

  return (
    <div className="flex flex-col gap-6">
      {step > 0 && (
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          {STEP_LABELS.slice(1).map((label, i) => {
            const idx = i + 1
            const done = step > idx
            const active = step === idx
            return (
              <div key={idx} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
                  ${done ? 'bg-green-100 text-green-700' : active ? 'bg-green-500 text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                  <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold
                    ${done ? 'bg-green-500 text-white' : active ? 'bg-white text-green-600' : 'bg-neutral-300 text-white'}`}>
                    {done ? '✓' : idx}
                  </span>
                  {label}
                </div>
                {i < STEP_LABELS.length - 2 && (
                  <div className={`w-6 h-px mx-0.5 ${done ? 'bg-green-400' : 'bg-neutral-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {step === 0 && (
        <StepHabeasData
          eventoNombre={eventoNombre}
          onAceptar={handleAceptar}
          onRechazar={handleRechazar}
        />
      )}

      {step === 1 && (
        <StepBuscarPersona
          state={state}
          loading={loading}
          alerta={alerta}
          onChange={onChange}
          onBuscar={handleBuscarPersona}
          onRegresar={() => { setStep(0); setAlerta(null) }}
        />
      )}

      {step === 2 && (
        <StepDatosBasicos
          state={state}
          loading={loading}
          alerta={alerta}
          personaExistente={personaExistente}
          departamentos={departamentos}
          ciudades={ciudades}
          onChange={onChange}
          onDepartamentoChange={handleDepartamentoChange}
          onGuardar={personaExistente ? handleAvanzarExistente : handleGuardarDatosBasicos}
        />
      )}

      {step === 3 && (
        <StepDatosEmpresa
          state={state}
          loading={loading}
          alerta={alerta}
          caracterizaciones={caracterizaciones}
          nivelesOcupacionales={nivelesOcupacionales}
          onChange={onChange}
          onBuscarEmpresa={handleBuscarEmpresa}
          onCrearEmpresa={handleCrearEmpresa}
          onGuardarPost={handleGuardarPostulacion}
        />
      )}

      {step === 4 && (
        <StepConfirmar
          state={state}
          loading={loading}
          alerta={alerta}
          conferencias={conferencias}
          onChange={onChange}
          onConfirmar={handleConfirmar}
        />
      )}
    </div>
  )
}
