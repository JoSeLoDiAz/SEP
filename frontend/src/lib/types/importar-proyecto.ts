// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Tipos compartidos del preview de importación de proyecto (formulador VBA). ║
// ║ Espejo EXACTO de las interfaces del backend en                            ║
// ║ backend/src/importar-proyecto/importar-proyecto.service.ts — el endpoint  ║
// ║ POST /admin/importar-proyecto/preview devuelve el Excel parseado COMPLETO ║
// ║ (todos los campos como texto, sin resolver contra catálogos). Estos tipos ║
// ║ los consume tanto la pantalla de importación como el reporte de vista     ║
// ║ previa (components/importar/reporte-preview.tsx).                         ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export interface ExcelBasicos {
  nit: string
  digitoVerificacion: string
  razonSocial: string
  sigla: string | null
  email: string
  departamentoDomicilio: string | null
  ciudadDomicilio: string | null
  direccionDomicilio: string | null
  telefono: string | null
  paginaWeb: string | null
  ciiu: string | null
  tipoOrganizacion: string | null
  certificacionCompetencias: string | null
  vinculoExpertosTecnicos: string | null
  cobertura: string | null
  codigoIndicativo: string | null
  tamanoEmpresa: string | null
  celular: string | null
  mesa1: string | null
  mesa2: string | null
  mesa3: string | null
  modalidadParticipacion: string | null
  tipoIdentificacion: string | null
}

export interface ContactoSimple {
  id: string
  tipo: string
  nombre: string
  email: string
  telefono: string
}
export interface ExcelContacto {
  representanteLegal: ContactoSimple
  contacto1: ContactoSimple
  contactoSustenta: ContactoSimple
}

export interface ExcelGeneralidades {
  objetoSocial: string | null
  productosServicios: string | null
  situacionActual: string | null
  papelSector: string | null
  retos: string | null
  experienciaFormativa: string | null
  objetivoProyecto: string | null
  sectorPertenece: string | null
  subsectorPertenece: string | null
  sectoresRepresenta: string[]
  subsectoresRepresenta: string[]
  cadenaProductiva: string | null
  interacciones: string | null
}

export interface ExcelDiagnostico {
  numero: number
  herramientas: Array<{ nombre: string; muestra: string }>
  fecha: string | null
  herramientaPropia: string | null
  otraHerramienta: string | null
  planCapacitacion: string | null
  descripcion: string | null
  resumen: string | null
}

export interface ExcelNecesidad {
  numeroDiagnostico: number
  numeroNecesidad: number
  necesidad: string
  numeroBeneficiarios: number
}

export interface ExcelPresupuesto {
  numeroAFs: number
  beneficiarios: number
  valorAFs: number
  gastosOperacion: number
  valorTransferencia: number
  beneficiariosTransferencia: number
  poliza: number
  valorTotal: number
  cofinanciacionSena: number
  contrapartidaEspecie: number
  contrapartidaDinero: number
  gastosOpCofinSena: number
  gastosOpContraEspecie: number
  gastosOpContraDinero: number
}

export interface ExcelAF {
  consecutivo: number
  nombre: string
  diagnostico: string | null
  causasEfectos: string | null
  objetivos: string | null
  enfoque: string | null
  eventoFormacion: string | null
  modalidadFormacion: string | null
  metodologia: string | null
  horasPorGrupo: number | null
  numeroGrupos: number | null
  beneficiariosPresenciales: number | null
  beneficiariosSincronicos: number | null
  areas: string[]
  justificacionAreas: string | null
  niveles: string[]
  justificacionNiveles: string | null
  impactosTrabajador: string[]
  impactosProductividad: string[]
  mipymesEmpresas: number | null
  mipymesTrabajadores: number | null
  justificacionMipymes: string | null
  cadenaEmpresas: number | null
  cadenaTrabajadores: number | null
  justificacionCadena: string | null
  trabajadoresMujeres: number | null
  trabajadoresCampesinos: number | null
  trabajadoresDiscapacidad: number | null
  empresasBic: number | null
  /** Sectores a los que PERTENECEN las empresas/beneficiarios (hasta 5). */
  sectoresPertenecen: string[]
  /** Subsectores a los que PERTENECEN las empresas/beneficiarios (hasta 5). */
  subsectoresPertenecen: string[]
  /** Sector que la AF BENEFICIA (clasificación, normalmente 1). */
  sectoresBeneficia: string[]
  /** Subsector que la AF BENEFICIA (clasificación, normalmente 1). */
  subsectoresBeneficia: string[]
  /** Justificación de la elección de sectores y subsectores. */
  justificacionSectores: string | null
  componenteAlineacion: string | null
  descripcionAlineacion: string | null
  justificacionAlineacion: string | null
  justificacionEspecializada: string | null
  ambiente: string | null
  material: string | null
  justificacionSiAplica: string | null
  gestionConocimiento: string | null
  incluirEnFormulacion: string | null
  insumos: string | null
  justificacionInsumo: string | null
  recursosDidacticos: string | null
  codigoNecesidad: number | null
  codigoDiagnostico: number | null
  ocupacionesCuoc: string[]
  validacionPresupuesto: string | null
  justificacion: string | null
  trabajadoresCampesinosTexto: string | null
  trabajadoresPopular: number | null
  trabajadoresPopularTexto: string | null
  justificacionTallerPuesto: string | null
  efectos: string | null
}

export interface ExcelUT {
  numeroAF: number
  numeroUT: number
  nombre: string
  horasPracticas: number | null
  horasTeoricas: number | null
  contenido: string | null
  competencia: string | null
  actividades: string[]
  descripcionActividad: string | null
  perfiles: Array<{ perfil: string; horas: number | null }>
  /** Texto de la articulación territorial (columna HABILIDAD TRANSVERSAL). */
  articulacionTerritorial: string | null
  /** True cuando la UT es de articulación territorial (col ES TRANSVERSAL = SI). */
  esArticulacionTerritorial: boolean
}

export interface ExcelRubro {
  numeroAF: number
  idRubro: string
  nombreRubro: string | null
  descripcion: string | null
  justificacion: string | null
  tarifaMaxima: number | null
  numHoras: number | null
  numPaginasUnidades: number | null
  numBeneficiarios: number | null
  numDias: number | null
  totalRubro: number | null
  valorMaximo: number | null
  caso: string | null
  paquete: string | null
  valorPorBeneficiarios: number | null
  cofinanciacionSena: number | null
  contrapartidaEspecie: number | null
  contrapartidaDinero: number | null
}

export interface ExcelCoberturaFila {
  numeroAF: number
  numeroGrupo: number
  departamentoPresencial: string | null
  ciudadPresencial: string | null
  beneficiariosPresencial: number | null
  departamentos: Array<{ departamento: string; beneficiarios: number }>
  /** Justificación de la relación de los beneficiarios con los lugares de ejecución. */
  justificacion: string | null
}

/** Una AF con sus hijos ya agrupados (lo que devuelve el preview). */
export type ExcelAFConDetalle = ExcelAF & {
  uts: ExcelUT[]
  rubros: ExcelRubro[]
  cobertura: ExcelCoberturaFila[]
}

// ── Preview enriquecido con BD ──────────────────────────────────────────────

export interface PreviewEmpresa {
  estado: 'nueva' | 'existente'
  nit: string
  razonSocial: string
  empresaIdExistente?: number
  diferenciasDatos?: Array<{ campo: string; actual: string | null; nuevo: string | null }>
}

export interface PreviewUsuario {
  email: string
  estado: 'nuevo' | 'existente'
  usuarioIdExistente?: number
}

export interface PreviewConvocatoria {
  convocatoriaId: number
  nombre: string
  estado: number
  abierta: boolean
}

export interface PreviewValidacion {
  nivel: 'error' | 'warning' | 'info'
  campo?: string
  mensaje: string
}

export interface PreviewImportacion {
  empresa: PreviewEmpresa
  usuario: PreviewUsuario
  convocatoria: PreviewConvocatoria
  proyecto: {
    nombre: string
    modalidadProyectoId: number | null
    modalidadProyectoNombre: string | null
    presupuesto: ExcelPresupuesto
    totalAFs: number
    totalUTs: number
    totalRubros: number
    totalCoberturas: number
  }
  contactos: ExcelContacto
  diagnosticos: ExcelDiagnostico[]
  necesidades: ExcelNecesidad[]
  generalidades: ExcelGeneralidades
  basicos: ExcelBasicos
  afs: ExcelAFConDetalle[]
  validaciones: PreviewValidacion[]
}
