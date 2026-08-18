export interface ApiResponse<T> {
  data: T
  message?: string
  statusCode: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface User {
  id: number
  nombre: string
  email: string
  rol: 'admin' | 'editor' | 'viewer'
  activo: boolean
}

export interface CertificadoRow {
  consecutivo: number
  empresaRazonSocial: string
  accionFormacionNombre: string
  fechaValidacionInterventor: string
  afGrupoBeneficiarioId: number
  personaId: number
  proyectoId: number
}

export interface Evento {
  eventoId: number
  eventoNombre: string
  eventoFechaInicio: string
  eventoFechaFin: string
  eventoVisible: boolean
  eventoActivo: boolean
}

export interface PersonaBusqueda {
  personaId: number
  personaNombres: string
  personaPrimerApellido: string
  personaSegundoApellido: string
  tipoDocumentoIdentidadId: string
  personaIdentificacion: string
  personaFechaNacimiento: string
  generoId: string
  personaEstrato: string
  personaEmail: string
  personaCelular: string
  personaDepartamentoId: string
  personaCiudad: string
  personaBarrio: string
  personaDireccion: string
  personaHabeasData: boolean
}

export interface PostulacionData {
  postulacionAno: number
  postulacionEdad: number
  rangoEdadId: number
  postulacionAntiguedad: string
  nivelOcupacionalId: string
  caracterizacionId: string
  tamanoEmpresaId: number
  beneficiarioEmpresaId: number
  postulacionTrasferencia: string
  perfilTrasferenciaId: number
}

export interface EmpresaBeneficiaria {
  beneficiarioEmpresaId: number
  beneficiarioEmpresaNombre: string
  beneficiarioEmpresaNumero: string
  tamanoEmpresaId: number
  tamanoEmpresaNombre: string
}

// estado global del wizard de inscripción
export interface RegistroState {
  tipoIdentificacion: string
  identificacion: string

  personaId: number | null
  maskedNombreCompleto: string
  personaNombres: string
  personaPrimerApellido: string
  personaSegundoApellido: string
  generoId: string
  personaEstrato: string
  personaFechaNacimiento: string
  personaCelular: string
  personaDepartamentoId: string
  personaCiudad: string
  personaBarrio: string
  personaDireccion: string
  personaEmail: string

  tipoDocEmpresa: string
  beneficiarioEmpresaNumero: string
  beneficiarioEmpresaId: number | null
  beneficiarioEmpresaNombre: string
  tamanoEmpresaId: number | null
  tamanoEmpresaNombre: string

  postulacionAno: number
  postulacionEdad: number
  rangoEdadId: number
  postulacionAntiguedad: string
  caracterizacionId: string
  nivelOcupacionalId: string

  conferenciaId: string
  validarConferencia: boolean

  // control interno del wizard
  validarPosAno: number   // 1=persona nueva, 2=existente sin postulación, 3=con postulación
  valiarRegistro: number
}
