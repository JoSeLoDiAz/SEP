// contratos de /mi-expediente — el evaluadorId lo pone el backend desde la sesión

export interface MiFicha {
  evaluadorId: number
  activo: number // 1 | 0, no booleano
  tieneFoto: boolean
  identificacion: string | null
  nombres: string | null
  primerApellido: string | null
  segundoApellido: string | null
  email: string | null
  emailInstitucional: string | null
  celular: string | null
  cargo: string | null
  profesion: string | null
  posgrado: string | null
  municipioId: number | null
  municipioNombre: string | null
  municipioDeptoNombre: string | null
  regionalNombre: string | null
  centroNombre: string | null
  jefeNombre: string | null
  jefeEmail: string | null
  jefeCargo: string | null
}

export interface MiEstudio {
  estudioId: number
  tipoEstudio: string | null
  titulo: string | null
  institucion: string | null
  fechaGrado: string | null
  archivoNombre: string | null
  tieneArchivo: boolean
}

export interface MiExperiencia {
  experienciaId: number
  cargo: string | null
  entidad: string | null
  fechaInicio: string | null
  fechaFin: string | null // null = sigue ahí
  archivoNombre: string | null
  tieneArchivo: boolean
  /** 'MANUAL' la teclea el evaluador; 'CICLO' sale de un ciclo certificado. */
  origen?: 'MANUAL' | 'CICLO'
  clave?: string
  participacionId?: number
  anio?: number
  periodo?: string | null
  archivoUrl?: string | null
}

export interface MiTic {
  ticId: number
  nombre: string | null
  horas: number | null
  fechaFin: string | null
  archivoNombre: string | null
  tieneArchivo: boolean
}

export interface MiDocumento {
  documentoId: number
  tipoCodigo: string | null
  tipoNombre: string | null
  descripcion: string | null
  anioReferencia: number | null // null = permanente
  archivoNombre: string | null
  fechaCargue: string | null
}

export interface RecorridoAnio {
  anio: number
  porcentaje: number | null
  puntaje: number | null
  intentos: number | null
  curso: number | null
  cursoAprobado: boolean | null
  pruebaAprobada: boolean | null // null = sin evaluar
  retro: number | null
  recomendado: number | null
}

export interface MiResumen {
  recorrido: RecorridoAnio[]
  aniosParticipados: number
  totalParticipaciones: number
  primerAnio: number | null
  ultimoAnio: number | null
  totalProyectos: number
  totalCertificados: number
  promedioRetro: number | null
  totalRetroRecibidas: number
  pruebaVigente: {
    anio: number
    puntaje: number | null
    aprobada: boolean
    vigente: boolean
  } | null
}

export interface MiConvocatoria {
  participacionId: number
  anio: number
  periodo: string | null
  convocatoria: string | null
  rol: string | null
  area: string | null
  proceso: string | null
  estado: string | null
  estadoCodigo: string | null
  estadoNegativo: boolean
  motivo: string | null
  esNueva: boolean
}

export interface MiEvidencia {
  aprobacionId: number
  anio: number
  convocatoria: string | null
  nombre: string | null
  bytes: number
  fecha: string | null
}

export interface TipoEstudioOpcion {
  id: number
  nombre: string
}

export interface MunicipioOpcion {
  id: number
  ciudad: string
  depto: string
}
