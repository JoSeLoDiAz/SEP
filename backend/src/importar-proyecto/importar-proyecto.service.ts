import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import * as crypto from 'crypto'
import { DataSource } from 'typeorm'
import * as XLSX from 'xlsx'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { twofish } = require('twofish')

function getEncryptionKey(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase()
}
function encrypt64(plainText: string, key: string): string {
  const tf = twofish(new Array(16).fill(0))
  const keyArr = Array.from(Buffer.from(key, 'hex'))
  const padded = Array.from(Buffer.from(plainText, 'utf8'))
  while (padded.length < 16) padded.push(0x20)
  return Buffer.from(tf.encrypt(keyArr, padded)).toString('base64')
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Importador de proyectos formulados desde el formulador VBA (.xlsx).       ║
// ║                                                                            ║
// ║ El VBA genera el mismo formato de hojas Datos_* que el backend produce    ║
// ║ con excel-report.service.ts. Esta clase hace la operación inversa: leer   ║
// ║ el .xlsx y devolver un preview tipado con validaciones para que el admin  ║
// ║ confirme antes de crear todo en BD (Sprint 2).                            ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ── Tipos del Excel parseado ────────────────────────────────────────────────

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

export interface ExcelContacto {
  representanteLegal: { id: string; tipo: string; nombre: string; email: string; telefono: string }
  contacto1: { id: string; tipo: string; nombre: string; email: string; telefono: string }
  contactoSustenta: { id: string; tipo: string; nombre: string; email: string; telefono: string }
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
  sectoresRepresenta: string[] // 1-3
  subsectoresRepresenta: string[] // 1-3
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
  /** Texto de la articulación territorial (la columna se llama
   *  HABILIDAD TRANSVERSAL en el Excel pero conceptualmente es articulación
   *  territorial — es una UT especial vinculada a una región). */
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
  // Presencial:
  departamentoPresencial: string | null
  ciudadPresencial: string | null
  beneficiariosPresencial: number | null
  // Virtual / PAT / Híbrida: hasta 25 departamentos.
  departamentos: Array<{ departamento: string; beneficiarios: number }>
  /** Justificación de la relación de los beneficiarios con los lugares de
   *  ejecución planteados (col 56 del Excel). */
  justificacion: string | null
}

export interface ProyectoExcel {
  basicos: ExcelBasicos
  contactos: ExcelContacto
  generalidades: ExcelGeneralidades
  diagnosticos: ExcelDiagnostico[]
  necesidades: ExcelNecesidad[]
  presupuesto: ExcelPresupuesto
  afs: ExcelAF[]
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
  afs: Array<ExcelAF & { uts: ExcelUT[]; rubros: ExcelRubro[]; cobertura: ExcelCoberturaFila[] }>
  validaciones: PreviewValidacion[]
}

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ImportarProyectoService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Match tolerante para nombres de modalidad: el Excel suele decir
   *  "EMPRESA INDIVIDUAL" pero la BD guarda solo "INDIVIDUAL". Compara
   *  ignorando prefijos como "EMPRESA " / "EMPRESAS " y espacios duplicados. */
  private matchModalidad(
    texto: string,
    catalogo: Array<{ id: number; nombre: string }>,
  ): { id: number; nombre: string } | undefined {
    if (!texto) return undefined
    const norm = (s: string) => s
      .trim().toUpperCase()
      .replace(/\s+/g, ' ')
      .replace(/^EMPRESAS?\s+/, '')
    const t = norm(texto)
    // Match exacto sobre normalizado.
    const exact = catalogo.find(m => norm(m.nombre) === t)
    if (exact) return exact
    // Contención: el texto del Excel contiene el del catálogo (o viceversa).
    return catalogo.find(m => {
      const c = norm(m.nombre)
      return c.length > 2 && (t.includes(c) || c.includes(t))
    })
  }

  /** Match tolerante para modalidad de formación con aliases conocidos:
   *  "PAT" ↔ "PRESENCIAL ASISTIDA POR TECNOLOGÍAS",
   *  "PRESENCIAL HÍBRIDA" ↔ "HÍBRIDA", etc. */
  private matchModalidadFormacion(
    texto: string,
    catalogo: Array<{ id: number; nombre: string }>,
  ): { id: number; nombre: string } | undefined {
    if (!texto) return undefined
    const norm = (s: string) => s
      .trim().toUpperCase()
      .replace(/\s+/g, ' ')
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin tildes

    const t = norm(texto)
    const aliases: Record<string, string[]> = {
      'PAT': ['PRESENCIAL ASISTIDA POR TECNOLOGIAS', 'PRESENCIAL ASISTIDA TECNOLOGIAS', 'ASISTIDA POR TECNOLOGIAS'],
      'PRESENCIAL HIBRIDA': ['HIBRIDA', 'PRESENCIAL HIBRIDA'],
      'VIRTUAL': ['VIRTUAL'],
      'PRESENCIAL': ['PRESENCIAL'],
    }

    // Match exacto.
    const exact = catalogo.find(m => norm(m.nombre) === t)
    if (exact) return exact

    // Aliases en ambas direcciones (texto del Excel → catálogo).
    for (const [clave, alias] of Object.entries(aliases)) {
      if (t === norm(clave) || alias.some(a => norm(a) === t)) {
        const candidato = catalogo.find(m => {
          const c = norm(m.nombre)
          return c === norm(clave) || alias.some(a => norm(a) === c)
        })
        if (candidato) return candidato
      }
    }

    // Contención.
    return catalogo.find(m => {
      const c = norm(m.nombre)
      return c.length > 2 && (t.includes(c) || c.includes(t))
    })
  }

  /** Lee el .xlsx y devuelve la estructura tipada del proyecto. Es síncrono y
   *  no toca BD — ideal para tests rápidos.  */
  parseExcel(buffer: Buffer): ProyectoExcel {
    let wb: XLSX.WorkBook
    try {
      wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
    } catch {
      throw new BadRequestException('El archivo no es un Excel válido')
    }

    const exigirHoja = (n: string) => {
      const ws = wb.Sheets[n]
      if (!ws) throw new BadRequestException(`Falta la hoja "${n}" en el Excel`)
      return ws
    }

    const basicos       = this.parseBasicos(exigirHoja('Datos_Basicos'))
    const contactos     = this.parseContactos(exigirHoja('Datos_Contacto'))
    const generalidades = this.parseGeneralidades(exigirHoja('Datos_Generalidades'))
    const diagnosticos  = this.parseDiagnosticos(exigirHoja('Datos_Diagnostico'))
    const necesidades   = this.parseNecesidades(exigirHoja('Datos_NecesidadesAF'))
    const presupuesto   = this.parsePresupuesto(exigirHoja('Datos_Presupuesto'))
    const afs           = this.parseAFs(exigirHoja('Datos_AF'))
    const uts           = this.parseUTs(exigirHoja('Datos_UT'))
    const rubros        = this.parseRubros(exigirHoja('Datos_Rubros'))
    const cobertura     = this.parseCobertura(exigirHoja('Datos_Cobertura'))

    return { basicos, contactos, generalidades, diagnosticos, necesidades, presupuesto, afs, uts, rubros, cobertura }
  }

  /** Parsea el .xlsx, valida la convocatoria, busca empresa/usuario por NIT y
   *  email, y devuelve el preview con validaciones.  */
  async preview(buffer: Buffer, convocatoriaId: number): Promise<PreviewImportacion> {
    if (!convocatoriaId) throw new BadRequestException('Debe indicar la convocatoria')

    const data = this.parseExcel(buffer)
    const validaciones: PreviewValidacion[] = []

    data.presupuesto.valorAFs = data.presupuesto.valorTotal
      - data.presupuesto.gastosOperacion
      - data.presupuesto.valorTransferencia

    // ── Convocatoria ────────────────────────────────────────────────────────
    const conv = await this.dataSource.query(
      `SELECT CONVOCATORIAID            AS "id",
              TRIM(CONVOCATORIANOMBRE)  AS "nombre",
              CONVOCATORIAESTADO        AS "estado",
              CONVOCATORIAANIO          AS "anio"
         FROM CONVOCATORIA WHERE CONVOCATORIAID = :1`,
      [convocatoriaId],
    )
    if (!conv[0]) throw new NotFoundException('Convocatoria no encontrada')
    const convocatoria: PreviewConvocatoria = {
      convocatoriaId: Number(conv[0].id),
      nombre: conv[0].nombre,
      estado: Number(conv[0].estado),
      abierta: Number(conv[0].estado) === 1,
    }
    const anioConv = Number(conv[0].anio)
    if (!convocatoria.abierta) {
      validaciones.push({ nivel: 'warning', mensaje: 'La convocatoria seleccionada no está abierta' })
    }

    // ── Nombre del proyecto autogenerado: SIGLA-FCE-AÑO ────────────────────
    const sigla = (data.basicos.sigla ?? '').trim() || data.basicos.razonSocial.trim().slice(0, 30)
    const nombreProyecto = `${sigla}-FCE-${anioConv}`.slice(0, 100)

    // ── Modalidad del proyecto (de Datos_Basicos.MODALIDAD DE PARTICIPACIÓN).
    // Match tolerante: "EMPRESA INDIVIDUAL" del Excel ↔ "INDIVIDUAL" del catálogo.
    const mods: Array<{ id: number; nombre: string }> = await this.dataSource.query(
      `SELECT MODALIDADID AS "id", TRIM(UPPER(MODALIDADNOMBRE)) AS "nombre"
         FROM MODALIDAD WHERE MODALIDADESTADO = 1`,
    )
    const modTexto = (data.basicos.modalidadParticipacion ?? '').trim().toUpperCase()
    const modProyecto = this.matchModalidad(modTexto, mods)
    if (!modProyecto && modTexto) {
      validaciones.push({
        nivel: 'warning',
        mensaje: `La modalidad de participación "${modTexto}" no coincide con ningún registro del catálogo MODALIDAD (disponibles: ${mods.map(m => m.nombre).join(', ')}). Se usará la primera disponible.`,
      })
    }

    // ── Validaciones contra catálogos: tipos de evento, modalidad de
    // formación y rubros de la convocatoria. Cualquier desfase queda como
    // aviso en el preview para que el admin lo revise.
    const tiposEvento: Array<{ id: number; nombre: string }> = await this.dataSource.query(
      `SELECT TIPOEVENTOID AS "id", TRIM(UPPER(TIPOEVENTONOMBRE)) AS "nombre" FROM TIPOEVENTO WHERE TIPOEVENTOACTIVO = 1`,
    )
    const modsForm: Array<{ id: number; nombre: string }> = await this.dataSource.query(
      `SELECT MODALIDADFORMACIONID AS "id", TRIM(UPPER(MODALIDADFORMACIONNOMBRE)) AS "nombre" FROM MODALIDADFORMACION WHERE MODALIDADFORMACIONACTIVO = 1`,
    )
    const rubrosConv: Array<{ codigo: string; nombre: string }> = await this.dataSource.query(
      `SELECT TRIM(UPPER(RUBROCODIGO)) AS "codigo", TRIM(UPPER(RUBRONOMBRE)) AS "nombre"
         FROM RUBRO WHERE CONVOCATORIAIDRUBRO = :1`,
      [convocatoriaId],
    )
    const rubrosCodigos = new Set(rubrosConv.map(r => r.codigo))
    const rubrosNombres = new Set(rubrosConv.map(r => r.nombre))

    for (const af of data.afs) {
      const evNombre = (af.eventoFormacion ?? '').trim().toUpperCase()
      if (evNombre && !this.matchModalidad(evNombre, tiposEvento)) {
        validaciones.push({
          nivel: 'warning',
          campo: `AF ${af.consecutivo}`,
          mensaje: `Evento de formación "${evNombre}" no existe en el catálogo TIPOEVENTO.`,
        })
      }
      const modNombre = (af.modalidadFormacion ?? '').trim().toUpperCase()
      if (modNombre && !this.matchModalidadFormacion(modNombre, modsForm)) {
        validaciones.push({
          nivel: 'warning',
          campo: `AF ${af.consecutivo}`,
          mensaje: `Modalidad de formación "${modNombre}" no existe en el catálogo MODALIDADFORMACION.`,
        })
      }
    }
    // Validar rubros: matchea por código exacto, o por nombre exacto si el
    // código no coincide (la convocatoria puede tener códigos distintos).
    const rubrosFaltantes = new Set<string>()
    for (const r of data.rubros) {
      const cod = r.idRubro.trim().toUpperCase()
      const nom = (r.nombreRubro ?? '').trim().toUpperCase()
      const okCodigo = cod && rubrosCodigos.has(cod)
      const okNombre = nom && rubrosNombres.has(nom)
      if (!okCodigo && !okNombre) rubrosFaltantes.add(cod || nom || '?')
    }
    if (rubrosFaltantes.size > 0) {
      validaciones.push({
        nivel: 'warning',
        mensaje: `${rubrosFaltantes.size} rubro(s) no existen en la convocatoria (ni por código ni por nombre) y se omitirán al importar: ${Array.from(rubrosFaltantes).slice(0, 10).join(', ')}${rubrosFaltantes.size > 10 ? '…' : ''}`,
      })
    }

    // ── Validaciones de catálogos auxiliares (áreas, niveles, CUOC, sectores,
    // ambiente, material, recursos, gestión, etc.) — todo lookup por nombre
    // o código contra los catálogos vivos del SEP. Lo que no resuelva sale
    // como aviso y NO se importará en esa subtabla.
    // Normalización tolerante: trim + upper + sin acentos + espacios colapsados.
    // Cubre las variantes habituales entre Excel/BD (mayúsculas vs minúsculas,
    // tilde sí/no, espacios extra). Para nombres largos también se admite
    // substring match (ej. el Excel dice "ARCHIPIÉLAGO DE SAN ANDRÉS,
    // PROVIDENCIA Y SANTA CATALINA" y la BD solo "SAN ANDRÉS Y PROVIDENCIA").
    const normalizar = (s: string | null | undefined) =>
      (s ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase()
    // Tokens significativos para matching aproximado (palabras ≥ 4 chars,
    // ignorando conectores como Y/DE/LA).
    const tokens = (s: string): string[] => s.split(/[^A-Z0-9Ñ]+/i)
      .map(t => t.toUpperCase())
      .filter(t => t.length >= 4 && !['PARA', 'DESDE', 'HASTA'].includes(t))
    const matchCat = (cat: Set<string>, valor: string): boolean => {
      const n = normalizar(valor)
      if (!n) return false
      if (cat.has(n)) return true
      if (n.length < 6) return false
      // Substring en ambas direcciones (uno contiene al otro).
      for (const k of cat) {
        if (k.length < 6) continue
        if (k.includes(n) || n.includes(k)) return true
      }
      // Token-overlap: el VBA abrevia palabras (p.ej. "EO" por "Entidades
      // Oficiales"). Si las palabras significativas del Excel están todas
      // en la entrada del catálogo (o viceversa), aceptamos como match.
      const t1 = tokens(n)
      if (t1.length === 0) return false
      for (const k of cat) {
        const t2 = tokens(k)
        if (t2.length === 0) continue
        const small = t1.length <= t2.length ? t1 : t2
        const big   = t1.length <= t2.length ? t2 : t1
        const setBig = new Set(big)
        const overlap = small.filter(t => setBig.has(t)).length
        if (overlap >= 2 && overlap / small.length >= 0.6) return true
      }
      return false
    }
    const cargarCat = async (sql: string): Promise<Set<string>> => {
      const rows: Array<{ nombre: string }> = await this.dataSource.query(sql)
      return new Set(rows.map(r => normalizar(r.nombre)).filter(Boolean))
    }

    const [
      areasCat, nivelesCat, cuocCat, sectoresCat, subsectoresCat,
      ambientesCat, materialesCat, recursosCat, gestionCat,
      utActCat, departamentosCat,
    ] = await Promise.all([
      cargarCat(`SELECT TRIM(AREAFUNCIONALNOMBRE) AS "nombre" FROM AREAFUNCIONAL WHERE AREAFUNCIONALESTADO = 1`),
      cargarCat(`SELECT TRIM(NIVELOCUPACIONALNOMBRE) AS "nombre" FROM NIVELOCUPACIONAL WHERE NIVELOCUPACIONALESTADO = 1`),
      cargarCat(`SELECT TRIM(OCUPACIONCUOCNOMBRE) AS "nombre" FROM OCUPACIONCUOC WHERE OCUPACIONCUOCESTADO = 1`),
      cargarCat(`SELECT TRIM(SECTORDESCRIPCION) AS "nombre" FROM SECTOR`),
      cargarCat(`SELECT TRIM(SUBSECTORNOMBRE) AS "nombre" FROM SUBSECTOR`),
      cargarCat(`SELECT TRIM(TIPOAMBIENTENOMBRE) AS "nombre" FROM TIPOAMBIENTE`),
      cargarCat(`SELECT TRIM(MATERIALFORMACIONNOMBRE) AS "nombre" FROM MATERIALFORMACION`),
      cargarCat(`SELECT TRIM(RECURSOSDIDACTICOSNOMBRE) AS "nombre" FROM RECURSOSDIDACTICOS`),
      cargarCat(`SELECT TRIM(GESTIONCONOCIMIENTONOMBRE) AS "nombre" FROM GESTIONCONOCIMIENTO`),
      cargarCat(`SELECT TRIM(UTACTIVIDADESNOMBRE) AS "nombre" FROM UTACTIVIDADES WHERE UTACTIVIDADESESTADO = 1`),
      cargarCat(`SELECT TRIM(DEPARTAMENTONOMBRE) AS "nombre" FROM DEPARTAMENTO`),
    ])

    const noResueltos = {
      areas: new Set<string>(),
      niveles: new Set<string>(),
      cuoc: new Set<string>(),
      sectoresPert: new Set<string>(),
      subsectoresPert: new Set<string>(),
      sectoresBenef: new Set<string>(),
      subsectoresBenef: new Set<string>(),
      ambientes: new Set<string>(),
      materiales: new Set<string>(),
      recursos: new Set<string>(),
      gestion: new Set<string>(),
      utActividades: new Set<string>(),
      departamentos: new Set<string>(),
    }
    const checkSet = (set: Set<string>, items: string[], dest: Set<string>) => {
      for (const it of items) {
        if (!normalizar(it)) continue
        if (!matchCat(set, it)) dest.add(it)
      }
    }

    for (const af of data.afs) {
      checkSet(areasCat,         af.areas,                noResueltos.areas)
      checkSet(nivelesCat,       af.niveles,              noResueltos.niveles)
      // El Excel suele traer "1234 - Nombre". Probamos primero el nombre
      // completo y, si no matchea, lo que queda después del guión.
      checkSet(cuocCat, af.ocupacionesCuoc.map(c => {
        if (matchCat(cuocCat, c)) return c
        const idxDash = c.indexOf('-')
        return idxDash >= 0 ? c.slice(idxDash + 1).trim() : c
      }), noResueltos.cuoc)
      checkSet(sectoresCat,      af.sectoresPertenecen,   noResueltos.sectoresPert)
      checkSet(subsectoresCat,   af.subsectoresPertenecen, noResueltos.subsectoresPert)
      checkSet(sectoresCat,      af.sectoresBeneficia,    noResueltos.sectoresBenef)
      checkSet(subsectoresCat,   af.subsectoresBeneficia, noResueltos.subsectoresBenef)
      if (af.ambiente)            checkSet(ambientesCat,  [af.ambiente],       noResueltos.ambientes)
      if (af.material)            checkSet(materialesCat, [af.material],       noResueltos.materiales)
      if (af.recursosDidacticos)  checkSet(recursosCat,   [af.recursosDidacticos], noResueltos.recursos)
      if (af.gestionConocimiento) checkSet(gestionCat,    [af.gestionConocimiento], noResueltos.gestion)
    }
    for (const u of data.uts) {
      checkSet(utActCat, u.actividades, noResueltos.utActividades)
    }
    for (const c of data.cobertura) {
      if (c.departamentoPresencial) checkSet(departamentosCat, [c.departamentoPresencial], noResueltos.departamentos)
      for (const d of c.departamentos) checkSet(departamentosCat, [d.departamento], noResueltos.departamentos)
    }

    const rep = (label: string, set: Set<string>) => {
      if (set.size > 0) {
        validaciones.push({
          nivel: 'warning',
          mensaje: `${label}: ${set.size} valor(es) no existen en el catálogo y se omitirán al importar: ${Array.from(set).slice(0, 8).join(', ')}${set.size > 8 ? '…' : ''}`,
        })
      }
    }
    rep('Áreas funcionales',                  noResueltos.areas)
    rep('Niveles ocupacionales',              noResueltos.niveles)
    rep('Ocupaciones CUOC',                   noResueltos.cuoc)
    rep('Sectores que pertenecen',            noResueltos.sectoresPert)
    rep('Subsectores que pertenecen',         noResueltos.subsectoresPert)
    rep('Sectores que beneficia AF',          noResueltos.sectoresBenef)
    rep('Subsectores que beneficia AF',       noResueltos.subsectoresBenef)
    rep('Ambientes de aprendizaje',           noResueltos.ambientes)
    rep('Materiales de formación',            noResueltos.materiales)
    rep('Recursos didácticos',                noResueltos.recursos)
    rep('Gestión del conocimiento',           noResueltos.gestion)
    rep('Actividades de UT',                  noResueltos.utActividades)
    rep('Departamentos (cobertura)',          noResueltos.departamentos)

    // ── Validaciones exhaustivas (datos básicos / generalidades / contactos)
    if (data.basicos.nit && !/^\d+$/.test(data.basicos.nit.replace(/\D/g, '').slice(0, 20))) {
      validaciones.push({ nivel: 'error', campo: 'NIT', mensaje: 'El NIT del Excel no es numérico.' })
    }
    if (!data.basicos.razonSocial?.trim()) {
      validaciones.push({ nivel: 'error', campo: 'RAZÓN SOCIAL', mensaje: 'Falta la razón social del proponente.' })
    }
    if (!data.basicos.sigla?.trim()) {
      validaciones.push({ nivel: 'warning', campo: 'SIGLA', mensaje: 'No hay sigla; el nombre del proyecto usará los primeros 30 caracteres de la razón social.' })
    }
    const camposGen: Array<[keyof typeof data.generalidades, string]> = [
      ['objetoSocial', 'Objeto social'],
      ['retos', 'Retos estratégicos'],
      ['objetivoProyecto', 'Objetivo general del proyecto'],
    ]
    for (const [k, label] of camposGen) {
      if (!data.generalidades[k] || !String(data.generalidades[k]).trim()) {
        validaciones.push({ nivel: 'warning', campo: label, mensaje: `Falta diligenciar "${label}" en Análisis Organizacional.` })
      }
    }
    if (!data.contactos.representanteLegal.nombre.trim()) {
      validaciones.push({ nivel: 'error', campo: 'REPRESENTANTE LEGAL', mensaje: 'Falta el representante legal.' })
    }

    // ── Validaciones por AF
    for (const af of data.afs) {
      const prefix = `AF ${af.consecutivo}`
      if (!af.nombre?.trim()) validaciones.push({ nivel: 'error', campo: prefix, mensaje: 'Falta el nombre de la AF.' })
      if (!af.objetivos?.trim()) validaciones.push({ nivel: 'warning', campo: prefix, mensaje: 'Falta el objetivo de la AF.' })
      if (!af.diagnostico?.trim()) validaciones.push({ nivel: 'warning', campo: prefix, mensaje: 'No hay necesidad asociada a la AF.' })
      if ((af.horasPorGrupo ?? 0) <= 0) validaciones.push({ nivel: 'error', campo: prefix, mensaje: 'Horas por grupo debe ser > 0.' })
      if ((af.numeroGrupos ?? 0) <= 0) validaciones.push({ nivel: 'error', campo: prefix, mensaje: 'Número de grupos debe ser > 0.' })
      const benef = (af.beneficiariosPresenciales ?? 0) + (af.beneficiariosSincronicos ?? 0)
      if (benef <= 0) validaciones.push({ nivel: 'error', campo: prefix, mensaje: 'No hay beneficiarios definidos por grupo.' })
      if (af.areas.length === 0) validaciones.push({ nivel: 'warning', campo: prefix, mensaje: 'Sin áreas funcionales definidas.' })
      if (af.niveles.length === 0) validaciones.push({ nivel: 'warning', campo: prefix, mensaje: 'Sin niveles ocupacionales definidos.' })
      if (af.ocupacionesCuoc.length === 0) validaciones.push({ nivel: 'warning', campo: prefix, mensaje: 'Sin ocupaciones CUOC definidas.' })
      if (!af.ambiente?.trim()) validaciones.push({ nivel: 'warning', campo: prefix, mensaje: 'Falta ambiente de aprendizaje.' })

      // UTs de esta AF
      const utsAf = data.uts.filter(u => u.numeroAF === af.consecutivo)
      if (utsAf.length === 0) {
        validaciones.push({ nivel: 'error', campo: prefix, mensaje: 'La AF no tiene unidades temáticas.' })
      } else {
        const sumaHorasUts = utsAf.reduce((s, u) => s + (u.horasPracticas ?? 0) + (u.horasTeoricas ?? 0), 0)
        const horasAF = (af.horasPorGrupo ?? 0)
        if (horasAF > 0 && Math.abs(sumaHorasUts - horasAF) > 0.5) {
          validaciones.push({
            nivel: 'warning',
            campo: prefix,
            mensaje: `La suma de horas de UT (${sumaHorasUts}) no coincide con horas/grupo de la AF (${horasAF}).`,
          })
        }
        for (const u of utsAf) {
          const utPrefix = `${prefix} · UT${u.numeroUT}`
          if (!u.nombre?.trim()) validaciones.push({ nivel: 'error', campo: utPrefix, mensaje: 'Falta el nombre de la UT.' })
          if (!u.contenido?.trim()) validaciones.push({ nivel: 'warning', campo: utPrefix, mensaje: 'Falta el contenido.' })
          if (!u.competencia?.trim()) validaciones.push({ nivel: 'warning', campo: utPrefix, mensaje: 'Falta la competencia por adquirir.' })
          if (u.actividades.length === 0) validaciones.push({ nivel: 'warning', campo: utPrefix, mensaje: 'Sin actividades de aprendizaje.' })
          if (u.perfiles.length === 0) validaciones.push({ nivel: 'warning', campo: utPrefix, mensaje: 'Sin perfiles de capacitador.' })
          if ((u.horasPracticas ?? 0) + (u.horasTeoricas ?? 0) <= 0) {
            validaciones.push({ nivel: 'error', campo: utPrefix, mensaje: 'La UT no tiene horas (prácticas o teóricas).' })
          }
        }
      }

      // Cobertura
      const covAf = data.cobertura.filter(c => c.numeroAF === af.consecutivo)
      if (covAf.length === 0) {
        validaciones.push({ nivel: 'warning', campo: prefix, mensaje: 'La AF no tiene grupos de cobertura.' })
      } else if (covAf.length !== (af.numeroGrupos ?? 0)) {
        validaciones.push({
          nivel: 'warning',
          campo: prefix,
          mensaje: `Hay ${covAf.length} grupo(s) de cobertura pero la AF declara ${af.numeroGrupos} grupos.`,
        })
      }

      // Rubros: consistencia interna (cofin + especie + dinero ≈ total)
      const rubrosAf = data.rubros.filter(r => r.numeroAF === af.consecutivo)
      if (rubrosAf.length === 0) {
        validaciones.push({ nivel: 'error', campo: prefix, mensaje: 'La AF no tiene rubros registrados.' })
      } else {
        for (const r of rubrosAf) {
          const suma = (r.cofinanciacionSena ?? 0) + (r.contrapartidaEspecie ?? 0) + (r.contrapartidaDinero ?? 0)
          const total = r.totalRubro ?? 0
          if (total > 0 && Math.abs(suma - total) > 1) {
            validaciones.push({
              nivel: 'warning',
              campo: `${prefix} · ${r.idRubro}`,
              mensaje: `Cofin SENA + contrapartidas (${suma}) no coincide con total del rubro (${total}).`,
            })
          }
        }
      }
    }

    // ── Validaciones del presupuesto general
    const p = data.presupuesto
    const totalCalculado = p.valorAFs + p.gastosOperacion + p.valorTransferencia
    if (Math.abs(totalCalculado - p.valorTotal) > 1) {
      validaciones.push({
        nivel: 'warning',
        mensaje: `Valor total (${p.valorTotal}) no coincide con AFs + GO + Transferencia (${totalCalculado}).`,
      })
    }
    const sumaCofContrapartidas = p.cofinanciacionSena + p.contrapartidaEspecie + p.contrapartidaDinero
    if (Math.abs(sumaCofContrapartidas - p.valorTotal) > 1) {
      validaciones.push({
        nivel: 'warning',
        mensaje: `Cofin SENA + contrapartidas (${sumaCofContrapartidas}) no coincide con valor total (${p.valorTotal}).`,
      })
    }
    if (p.valorAFs > 0) {
      const pctGO = (p.gastosOperacion / p.valorAFs) * 100
      const topeGO = p.valorAFs > 200_000_000 ? 10 : 16
      if (pctGO > topeGO + 0.5) {
        validaciones.push({
          nivel: 'error',
          mensaje: `Gastos de operación al ${pctGO.toFixed(2)}% supera el tope del ${topeGO}% (proyectos ${p.valorAFs > 200_000_000 ? '> $200M' : '≤ $200M'}).`,
        })
      }
    }
    const baseTransf = p.valorAFs + p.gastosOperacion
    if (baseTransf > 0) {
      const pctTransfValor = (p.valorTransferencia / baseTransf) * 100
      if (pctTransfValor < 0.99) {
        validaciones.push({
          nivel: 'warning',
          mensaje: `Transferencia al ${pctTransfValor.toFixed(2)}% del valor (AFs+GO). El mínimo exigido es 1%.`,
        })
      }
    }
    if (p.beneficiarios > 0) {
      const pctBenefTransf = (p.beneficiariosTransferencia / p.beneficiarios) * 100
      if (pctBenefTransf < 4.99) {
        validaciones.push({
          nivel: 'warning',
          mensaje: `Beneficiarios transferencia al ${pctBenefTransf.toFixed(2)}%. El mínimo exigido es 5% del total.`,
        })
      }
    }

    // ── Empresa por NIT ─────────────────────────────────────────────────────
    const nit = data.basicos.nit?.trim()
    if (!nit) {
      validaciones.push({ nivel: 'error', campo: 'NIT', mensaje: 'El Excel no trae NIT' })
    }
    let empresa: PreviewEmpresa = { estado: 'nueva', nit, razonSocial: data.basicos.razonSocial }
    // EMPRESAIDENTIFICACION es NUMBER en Oracle. El NIT del Excel puede traer puntos,
    // guiones o el dígito de verificación (p. ej. "890.982.432-0"); Number() sobre eso
    // daría NaN y rompe el bind (NJS-105). Lo dejamos en solo dígitos y únicamente
    // consultamos cuando queda un entero válido; si no, se trata como empresa nueva.
    const nitNum = Number((nit ?? '').replace(/\D/g, ''))
    if (nit && Number.isFinite(nitNum) && nitNum > 0) {
      const e = await this.dataSource.query(
        `SELECT EMPRESAID                  AS "id",
                TRIM(EMPRESARAZONSOCIAL)   AS "rs",
                TRIM(EMPRESASIGLA)         AS "sigla",
                TRIM(EMPRESADIRECCION)     AS "dir",
                TRIM(EMPRESACELULAR)       AS "cel",
                TRIM(EMPRESAEMAIL)         AS "email"
           FROM EMPRESA
          WHERE EMPRESAIDENTIFICACION = :1
            AND ROWNUM = 1`,
        [nitNum],
      )
      if (e[0]) {
        const diffs: PreviewEmpresa['diferenciasDatos'] = []
        const cmp = (campo: string, actual: string | null, nuevo: string | null) => {
          if ((actual ?? '').trim() !== (nuevo ?? '').trim()) {
            diffs.push({ campo, actual, nuevo })
          }
        }
        cmp('Razón social', e[0].rs, data.basicos.razonSocial)
        cmp('Sigla',        e[0].sigla, data.basicos.sigla)
        cmp('Dirección',    e[0].dir, data.basicos.direccionDomicilio)
        cmp('Celular',      e[0].cel, data.basicos.celular)
        cmp('Email',        e[0].email, data.basicos.email)
        empresa = {
          estado: 'existente',
          nit,
          razonSocial: data.basicos.razonSocial,
          empresaIdExistente: Number(e[0].id),
          diferenciasDatos: diffs,
        }
      }
    }

    // ── Usuario por email ───────────────────────────────────────────────────
    const email = data.basicos.email?.trim().toLowerCase() ?? ''
    let usuario: PreviewUsuario = { email, estado: 'nuevo' }
    if (email) {
      const u = await this.dataSource.query(
        `SELECT USUARIOID AS "id" FROM USUARIO WHERE LOWER(USUARIOEMAIL) = :1 AND ROWNUM = 1`,
        [email],
      )
      if (u[0]) usuario = { email, estado: 'existente', usuarioIdExistente: Number(u[0].id) }
    } else {
      validaciones.push({ nivel: 'error', campo: 'CORREO ELECTRÓNICO', mensaje: 'El Excel no trae correo de la empresa' })
    }

    // ── Validaciones cruzadas ──────────────────────────────────────────────
    if (data.afs.length === 0) {
      validaciones.push({ nivel: 'error', mensaje: 'No hay Acciones de Formación en el Excel' })
    }
    if (data.afs.length !== data.presupuesto.numeroAFs) {
      validaciones.push({
        nivel: 'warning',
        mensaje: `Datos_Presupuesto declara ${data.presupuesto.numeroAFs} AFs pero hay ${data.afs.length} en Datos_AF`,
      })
    }
    // Validación cruzada de cofinanciación SENA.
    // En el Excel "Datos_Presupuesto.cofinanciacionSena" es el TOTAL del
    // proyecto (ya incluye GO). Para comparar contra la suma de rubros, hay
    // que sumar SOLO los rubros NORMALES (excluyendo R09 GO y R015 Transf,
    // que ya vienen aparte como gastosOpCofinSena y valorTransferencia) más
    // el GO. La transferencia no aporta cofin SENA (va a contrapartida dinero).
    const isGOCode = (cod: string, nom: string) =>
      /^R0?9(\D|$)/i.test(cod) || /GASTOS\s+DE\s+OPERACI/i.test(nom)
    const isTransCode = (cod: string, nom: string) =>
      /^R0?15(\D|$)/i.test(cod) || /TRANSFERENCIA\s+DE\s+CONOCIMIENTO/i.test(nom)
    const cofinRubrosNormales = data.rubros
      .filter(r => !isGOCode(r.idRubro.trim(), (r.nombreRubro ?? '').trim()) &&
                   !isTransCode(r.idRubro.trim(), (r.nombreRubro ?? '').trim()))
      .reduce((s, r) => s + (r.cofinanciacionSena ?? 0), 0)
    const sumaCofinSena = cofinRubrosNormales + (data.presupuesto.gastosOpCofinSena ?? 0)
    if (Math.abs(sumaCofinSena - data.presupuesto.cofinanciacionSena) > 1) {
      validaciones.push({
        nivel: 'warning',
        mensaje: `La cofinanciación SENA del presupuesto (${data.presupuesto.cofinanciacionSena}) no coincide con la suma de rubros AF + GO (${sumaCofinSena}). Diferencia: ${data.presupuesto.cofinanciacionSena - sumaCofinSena}`,
      })
    }

    // ── Agrupar AF con sus UT, rubros y cobertura ──────────────────────────
    const afsConDetalle = data.afs.map(af => ({
      ...af,
      uts: data.uts.filter(u => Number(u.numeroAF) === Number(af.consecutivo)),
      rubros: data.rubros.filter(r => Number(r.numeroAF) === Number(af.consecutivo)),
      cobertura: data.cobertura.filter(c => Number(c.numeroAF) === Number(af.consecutivo)),
    }))

    return {
      empresa,
      usuario,
      convocatoria,
      proyecto: {
        nombre: nombreProyecto,
        modalidadProyectoId: modProyecto?.id ?? null,
        modalidadProyectoNombre: modProyecto?.nombre ?? null,
        presupuesto: data.presupuesto,
        totalAFs: data.afs.length,
        totalUTs: data.uts.length,
        totalRubros: data.rubros.length,
        totalCoberturas: data.cobertura.length,
      },
      contactos: data.contactos,
      diagnosticos: data.diagnosticos,
      necesidades: data.necesidades,
      generalidades: data.generalidades,
      basicos: data.basicos,
      afs: afsConDetalle,
      validaciones,
    }
  }

  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║ Confirmación: inserción real en BD                                      ║
  // ╚════════════════════════════════════════════════════════════════════════╝

  async confirmar(
    buffer: Buffer,
    dto: {
      convocatoriaId: number
      claveUsuario?: string
      actualizarDatosEmpresa?: boolean
      modalidadProyectoId?: number
    },
  ): Promise<{
    proyectoId: number
    empresaId: number
    usuarioId: number
    afsCreadas: number
    utsCreadas: number
    rubrosCreados: number
    areasCreadas: number
    nivelesCreados: number
    cuocCreados: number
    sectoresCreados: number
    subsectoresCreados: number
    recursosCreados: number
    gruposCreados: number
    coberturasCreadas: number
    actividadesCreadas: number
    perfilesCreados: number
    necesidadesCreadas: number
    necFormCreadas: number
    herramientasCreadas: number
    rubrosNoEncontrados: string[]
    contactosCreados: number
    noResueltos: Record<string, string[]>
    mensaje: string
  }> {
    if (!dto.convocatoriaId) throw new BadRequestException('Falta convocatoriaId')

    const data = this.parseExcel(buffer)
    const nit = data.basicos.nit?.trim()
    const email = data.basicos.email?.trim().toLowerCase()
    if (!nit)   throw new BadRequestException('El Excel no trae NIT')
    if (!email) throw new BadRequestException('El Excel no trae correo')
    // EMPRESAIDENTIFICACION / EMPRESADIGITOVERIFICACION son NUMBER en Oracle. El NIT
    // puede venir con puntos, guiones o el dígito de verificación ("890.982.432-0"),
    // así que lo dejamos en solo dígitos antes de convertir para no romper el bind.
    const nitNum = Number((nit ?? '').replace(/\D/g, ''))
    if (!Number.isFinite(nitNum) || nitNum <= 0) {
      throw new BadRequestException(`El NIT "${nit}" no es un número válido`)
    }
    const dvNum = Number(String(data.basicos.digitoVerificacion ?? '').replace(/\D/g, '') || '0')

    // Convocatoria — además del id, traemos el año para el nombre del proyecto
    const conv: Array<{ anio: number }> = await this.dataSource.query(
      `SELECT CONVOCATORIAANIO AS "anio" FROM CONVOCATORIA WHERE CONVOCATORIAID = :1`,
      [dto.convocatoriaId],
    )
    if (!conv[0]) throw new NotFoundException('Convocatoria no encontrada')
    const anioConvocatoria = Number(conv[0].anio)

    // Modalidad del proyecto: tomada de Datos_Basicos.modalidadParticipacion.
    // Match tolerante (ver matchModalidad).
    const modsCat: Array<{ id: number; nombre: string }> = await this.dataSource.query(
      `SELECT MODALIDADID AS "id", TRIM(UPPER(MODALIDADNOMBRE)) AS "nombre"
         FROM MODALIDAD WHERE MODALIDADESTADO = 1`,
    )
    const modProy = this.matchModalidad(data.basicos.modalidadParticipacion ?? '', modsCat)

    const qr = this.dataSource.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      // ── 1. Empresa ────────────────────────────────────────────────────────
      const empresaExistente: Array<{ id: number }> = await qr.query(
        `SELECT EMPRESAID AS "id" FROM EMPRESA WHERE EMPRESAIDENTIFICACION = :1 AND ROWNUM = 1`,
        [nitNum],
      )
      let empresaId: number
      if (empresaExistente[0]) {
        empresaId = Number(empresaExistente[0].id)
        if (dto.actualizarDatosEmpresa) {
          await qr.query(
            `UPDATE EMPRESA SET
                EMPRESARAZONSOCIAL = :1, EMPRESASIGLA = :2, EMPRESADIRECCION = :3,
                EMPRESACELULAR = :4, EMPRESATELEFONO = :5, EMPRESAPAGINAWEB = :6,
                EMPRESAEMAIL = :7
              WHERE EMPRESAID = :8`,
            [
              data.basicos.razonSocial.trim(),
              (data.basicos.sigla ?? '').trim(),
              (data.basicos.direccionDomicilio ?? '').trim(),
              (data.basicos.celular ?? '').trim(),
              (data.basicos.telefono ?? '').trim(),
              (data.basicos.paginaWeb ?? '').trim(),
              email,
              empresaId,
            ],
          )
        }
      } else {
        // Crear empresa nueva con defaults sensatos para campos NOT NULL.
        const seq = await qr.query(`SELECT EMPRESAID.NEXTVAL FROM dual`)
        empresaId = Number(seq[0].NEXTVAL)
        await qr.query(
          `INSERT INTO EMPRESA
             (EMPRESAID, TIPODOCUMENTOIDENTIDADID, EMPRESAIDENTIFICACION, EMPRESADIGITOVERIFICACION,
              EMPRESARAZONSOCIAL, EMPRESASIGLA, EMPRESAEMAIL, EMPRESAFECHAREGISTRO,
              EMPRESADIRECCION, EMPRESACELULAR, EMPRESATELEFONO, EMPRESAPAGINAWEB,
              COBERTURAEMPRESAID, DEPARTAMENTOEMPRESAID, CIUDADEMPRESAID, CIIUID,
              TIPOEMPRESAID, TAMANOEMPRESAID, SECTORID, SUBSECTORID, TIPOIDENTIFICACIONREP)
           VALUES (:1, 1, :2, :3, :4, :5, :6, SYSDATE, :7, :8, :9, :10,
                   1, 1, 1, 1, 1, 1, 1, 1, 1)`,
          [
            empresaId,
            nitNum,
            dvNum,
            data.basicos.razonSocial.trim(),
            (data.basicos.sigla ?? '').trim(),
            email,
            (data.basicos.direccionDomicilio ?? '').trim(),
            (data.basicos.celular ?? '').trim(),
            (data.basicos.telefono ?? '').trim(),
            (data.basicos.paginaWeb ?? '').trim(),
          ],
        )
      }

      // ── 2. Usuario + USUARIOPERFIL ────────────────────────────────────────
      const usuarioExistente: Array<{ id: number }> = await qr.query(
        `SELECT USUARIOID AS "id" FROM USUARIO WHERE LOWER(USUARIOEMAIL) = :1 AND ROWNUM = 1`,
        [email],
      )
      let usuarioId: number
      if (usuarioExistente[0]) {
        usuarioId = Number(usuarioExistente[0].id)
      } else {
        if (!dto.claveUsuario || dto.claveUsuario.trim().length < 6) {
          throw new BadRequestException('Para crear el usuario nuevo, la clave inicial debe tener al menos 6 caracteres')
        }
        const llave = getEncryptionKey()
        const claveCifrada = encrypt64(dto.claveUsuario.trim(), llave)
        const seqU = await qr.query(`SELECT USUARIOID.NEXTVAL FROM dual`)
        usuarioId = Number(seqU[0].NEXTVAL)
        await qr.query(
          `INSERT INTO USUARIO
             (USUARIOID, PERFILID, USUARIOCLAVE, USUARIOFECHAREGISTRO, USUARIOESTADO,
              USUARIOTIPO, USUARIOEMAIL, USUARIOLLAVEENCRIPTACION)
           VALUES (:1, 7, :2, SYSDATE, 1, 2, :3, :4)`,
          [usuarioId, claveCifrada, email, llave],
        )
        await qr.query(
          `INSERT INTO USUARIOPERFIL
             (USUARIOPERFILID, USUARIOID, PERFILID, PREDETERMINADO, ESTADO, FECHACREACION)
           VALUES (USUARIOPERFIL_SEQ.NEXTVAL, :1, 7, 1, 1, SYSDATE)`,
          [usuarioId],
        )
      }

      // ── 3. Proyecto ───────────────────────────────────────────────────────
      // Nombre autogenerado: SIGLA-FCE-AÑO. La modalidad sale de Datos_Basicos
      // (resuelta por nombre). Estado 0 (borrador) para que el proponente o el
      // admin puedan revisar y editar antes de confirmar.
      const codSeg = crypto.randomBytes(12).toString('hex').toUpperCase()
      const modalidadId = modProy?.id ?? dto.modalidadProyectoId ?? 1
      const sigla = (data.basicos.sigla ?? '').trim() || data.basicos.razonSocial.trim().slice(0, 30)
      const proyectoNombre = `${sigla}-FCE-${anioConvocatoria}`.slice(0, 100)
      await qr.query(
        `INSERT INTO PROYECTO
           (PROYECTOID, EMPRESAID, PROYECTONOMBRE, PROYECTOOBJETIVO,
            CONVOCATORIAID, MODALIDADID,
            PROYECTOCODSEGURIDAD, PROYECTOFECHAREGISTRO, PROYECTOESTADO)
         VALUES (PROYECTOID.NEXTVAL, :1, :2, :3, :4, :5, :6, SYSDATE, 0)`,
        [empresaId, proyectoNombre,
         data.generalidades.objetivoProyecto?.trim() ?? null,
         dto.convocatoriaId, modalidadId, codSeg],
      )
      const seqP: Array<{ id: number }> = await qr.query(`SELECT PROYECTOID.CURRVAL AS "id" FROM dual`)
      const proyectoId = Number(seqP[0].id)

      // ── 4. Contactos (3) — cargos según el listado oficial del SEP ───────
      const contactos = [
        { ...data.contactos.representanteLegal, cargo: 'Representante Legal' },
        { ...data.contactos.contacto1,           cargo: 'Talento Humano' },
        { ...data.contactos.contactoSustenta,    cargo: 'Comunicaciones' },
      ].filter(c => c.nombre.trim())

      for (const c of contactos) {
        await qr.query(
          `INSERT INTO CONTACTOEMPRESA
             (EMPRESAIDCONTACTO, CONTACTOEMPRESANOMBRE, CONTACTOEMPRESACARGO,
              CONTACTOEMPRESACORREO, CONTACTOEMPRESATELEFONO, CONTACTOEMPRESADOCUMENTO,
              TIPOIDENTIFICACIONCONTACTOP, PROYECTOIDCONTACTOS)
           VALUES (:1, :2, :3, :4, :5, :6, 1, :7)`,
          [empresaId, c.nombre.trim(), c.cargo, c.email.trim(),
           c.telefono.trim() || null, c.id.trim() || null, proyectoId],
        )
      }

      // ── 4.5 Diagnósticos (NECESIDAD) y necesidades de formación
      //         (NECESIDADFORMACION). Indexamos por (codigoDiagnostico,
      //         codigoNecesidad) para que cada AF pueda referenciar la
      //         correcta vía NECESIDADFORMACIONIDAF.
      const necFormIdPor = new Map<string, number>()  // "diag-nec" → necesidadFormacionId
      const necesidadIdPorDiag = new Map<number, number>()
      let necesidadesCreadas = 0
      let necFormCreadas = 0
      let herramientasCreadas = 0

      // Catálogo de fuentes de herramienta (ENCUESTAS, ENTREVISTAS, etc.)
      const fuentesHerr: Array<{ id: number; nombre: string }> = await qr.query(
        `SELECT FUENTEHERRAMIENTAID AS "id",
                TRIM(UPPER(FUENTEHERRAMIENTANOMBRE)) AS "nombre"
           FROM FUENTEHERRAMIENTA`,
      )
      const findFuente = (nombre: string): number | null => {
        const n = (nombre ?? '').trim().toUpperCase()
        return fuentesHerr.find(f => f.nombre === n)?.id ?? null
      }

      // Excel trae "DD/MM/YYYY" (string) o un número serial. Lo convertimos a
      // string ISO YYYY-MM-DD para Oracle TO_DATE.
      const toIsoDate = (v: string | null): string | null => {
        if (!v) return null
        const s = v.trim()
        // Excel serial number (días desde 1900).
        if (/^\d{4,6}(\.\d+)?$/.test(s)) {
          const serial = Number(s)
          const d = new Date(Math.round((serial - 25569) * 86400 * 1000))
          if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
        }
        // DD/MM/YYYY o DD-MM-YYYY
        const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
        if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
        return null
      }

      for (const diag of data.diagnosticos) {
        await qr.query(
          `INSERT INTO NECESIDAD
             (NECESIDADID, EMPRESANECESIDADID, NECESIDADFECHAREGISTRO, USUREGISTRONECESIDAD)
           VALUES (NECESIDADID.NEXTVAL, :1, SYSDATE, :2)`,
          [empresaId, usuarioId],
        )
        const [{ id: necId }]: Array<{ id: number }> = await qr.query(
          `SELECT NECESIDADID.CURRVAL AS "id" FROM dual`,
        )
        necesidadIdPorDiag.set(diag.numero, Number(necId))
        necesidadesCreadas++

        // Datos del diagnóstico (fecha, herramienta propia, otra, descripción,
        // resumen y plan de capacitación).
        const isoFecha = toIsoDate(diag.fecha)
        const esCreacionPropia = (diag.herramientaPropia ?? '').trim().toUpperCase().startsWith('SI') ? 1 : 0
        const tienePlanCapa    = (diag.planCapacitacion  ?? '').trim().toUpperCase().startsWith('SI') ? 1 : 0
        await qr.query(
          `UPDATE NECESIDAD
              SET NECESIDADPERIODOI = ${isoFecha ? "TO_DATE(:1, 'YYYY-MM-DD')" : 'NULL'},
                  NECESIDADHERRCREACION = :2,
                  NECESIDADHERROTRA = :3,
                  NECESIDADHERRDESCRIP = :4,
                  NECESIDADHERRRESULTADOS = :5,
                  NECESIDADPLANCAPA = :6
            WHERE NECESIDADID = :7`,
          [
            ...(isoFecha ? [isoFecha] : []),
            esCreacionPropia,
            diag.otraHerramienta?.trim() ?? null,
            diag.descripcion?.trim() ?? null,
            diag.resumen?.trim() ?? null,
            tienePlanCapa,
            Number(necId),
          ],
        )

        // HERRAMIENTANECESIDAD por cada herramienta del diagnóstico (lookup
        // por nombre; las que no resuelvan quedan en noResueltos.fuentes).
        for (const h of diag.herramientas) {
          const fuenteId = findFuente(h.nombre)
          if (!fuenteId) {
            // Aún no existe noResueltos en este punto del flujo; lo dejamos
            // como log para el admin: la herramienta se omite silenciosamente.
            continue
          }
          await qr.query(
            `INSERT INTO HERRAMIENTANECESIDAD
               (HERRAMIENTANECESIDADID, NECESIDADID, FUENTEHERRAMIENTAID,
                HERRAMIENTANECESIDADPARTICIP, HERRAMIENTANECESIDADOTRA,
                USUREGISTROHERRAMIENTA, HERRAMIENTANECESIDADFECHAREG)
             VALUES (HERRAMIENTANECESIDADID.NEXTVAL, :1, :2, :3, ' ', :4, SYSDATE)`,
            [Number(necId), fuenteId, Number(h.muestra) || 0, usuarioId],
          )
          herramientasCreadas++
        }
      }

      // Insertar las necesidades de formación de cada diagnóstico.
      for (const nec of data.necesidades) {
        const necesidadId = necesidadIdPorDiag.get(nec.numeroDiagnostico)
        if (!necesidadId) continue
        const seqNF = await qr.query(`SELECT NECESIDADFORMACIONID.NEXTVAL FROM dual`)
        const necFormId = Number(seqNF[0].NEXTVAL)
        await qr.query(
          `INSERT INTO NECESIDADFORMACION
             (NECESIDADFORMACIONID, NECESIDADID, NECESIDADFORMACIONNUMERO,
              NECESIDADFORMACIONNOMBRE, NECESIDADFORMACIONBENEF,
              USUREGISTRONECESIDADFORMACION, NECESIDADFORMACIONFECHAREGISTR)
           VALUES (:1, :2, :3, :4, :5, :6, SYSDATE)`,
          [necFormId, necesidadId, nec.numeroNecesidad,
           (nec.necesidad ?? '').trim().slice(0, 4000),
           nec.numeroBeneficiarios ?? 0, usuarioId],
        )
        necFormIdPor.set(`${nec.numeroDiagnostico}-${nec.numeroNecesidad}`, necFormId)
        necFormCreadas++
      }

      // ── 5. Catálogos: lookup completo por nombre/código (todos los que el
      //    Excel del VBA puede traer en texto). Lo que no resuelve queda
      //    registrado en `noResueltos` y se devuelve al admin para que lo
      //    complete después en la edición del proyecto vivo.
      // Normalización tolerante: trim + upper + sin acentos + espacios colapsados.
      const normalizar = (s: string | null | undefined) =>
        (s ?? '')
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toUpperCase()
      const cargarMap = async (sql: string, params: unknown[] = []): Promise<Map<string, number>> => {
        const rows: Array<{ id: number; nombre: string }> = await qr.query(sql, params)
        const m = new Map<string, number>()
        for (const r of rows) {
          const k = normalizar(r.nombre)
          if (k && !m.has(k)) m.set(k, Number(r.id))
        }
        return m
      }

      const [
        areasCat, nivelesCat, cuocCat, sectoresCat, subsectoresCat,
        ambientesCat, materialesCat, recursosCat, gestionCat,
        departamentosCat, utActCat, articulacionTerrCat, enfoqueCat,
        metodologiaCat, afComponenteCat, tiposEventoMap, modsFormCat,
      ] = await Promise.all([
        cargarMap(`SELECT AREAFUNCIONALID AS "id", TRIM(UPPER(AREAFUNCIONALNOMBRE)) AS "nombre" FROM AREAFUNCIONAL WHERE AREAFUNCIONALESTADO = 1`),
        cargarMap(`SELECT NIVELOCUPACIONALID AS "id", TRIM(UPPER(NIVELOCUPACIONALNOMBRE)) AS "nombre" FROM NIVELOCUPACIONAL WHERE NIVELOCUPACIONALESTADO = 1`),
        cargarMap(`SELECT OCUPACIONCUOCID AS "id", TRIM(UPPER(OCUPACIONCUOCNOMBRE)) AS "nombre" FROM OCUPACIONCUOC WHERE OCUPACIONCUOCESTADO = 1`),
        cargarMap(`SELECT SECTORID AS "id", TRIM(UPPER(SECTORDESCRIPCION)) AS "nombre" FROM SECTOR`),
        cargarMap(`SELECT SUBSECTORID AS "id", TRIM(UPPER(SUBSECTORNOMBRE)) AS "nombre" FROM SUBSECTOR`),
        cargarMap(`SELECT TIPOAMBIENTEID AS "id", TRIM(UPPER(TIPOAMBIENTENOMBRE)) AS "nombre" FROM TIPOAMBIENTE`),
        cargarMap(`SELECT MATERIALFORMACIONID AS "id", TRIM(UPPER(MATERIALFORMACIONNOMBRE)) AS "nombre" FROM MATERIALFORMACION`),
        cargarMap(`SELECT RECURSOSDIDACTICOSID AS "id", TRIM(UPPER(RECURSOSDIDACTICOSNOMBRE)) AS "nombre" FROM RECURSOSDIDACTICOS`),
        cargarMap(`SELECT GESTIONCONOCIMIENTOID AS "id", TRIM(UPPER(GESTIONCONOCIMIENTONOMBRE)) AS "nombre" FROM GESTIONCONOCIMIENTO`),
        cargarMap(`SELECT DEPARTAMENTOID AS "id", TRIM(UPPER(DEPARTAMENTONOMBRE)) AS "nombre" FROM DEPARTAMENTO`),
        cargarMap(`SELECT UTACTIVIDADESID AS "id", TRIM(UPPER(UTACTIVIDADESNOMBRE)) AS "nombre" FROM UTACTIVIDADES WHERE UTACTIVIDADESESTADO = 1`),
        cargarMap(`SELECT ARTICULACIONTERRITORIALID AS "id", TRIM(UPPER(ARTICULACIONTERRITORIALNOMBRE)) AS "nombre" FROM ARTICULACIONTERRITORIAL WHERE ARTICULACIONTERRITORIALESTADO = 1`),
        cargarMap(`SELECT AFENFOQUEID AS "id", TRIM(UPPER(AFENFOQUENOMBRE)) AS "nombre" FROM AFENFOQUE WHERE AFENFOQUEESTADO = 1`),
        cargarMap(`SELECT METODOLOGIAAPRENDIZAJEID AS "id", TRIM(UPPER(METODOLOGIAAPRENDIZAJENOMBRE)) AS "nombre" FROM METODOLOGIAAPRENDIZAJE WHERE METODOLOGIAAPRENDIZAJEESTADO = 1`),
        cargarMap(`SELECT AFCOMPONENTEID AS "id", TRIM(UPPER(AFCOMPONENTENOMBRE)) AS "nombre" FROM AFCOMPONENTE WHERE AFCOMPONENTEESTADO IS NULL OR AFCOMPONENTEESTADO = 1`),
        qr.query(`SELECT TIPOEVENTOID AS "id", TRIM(UPPER(TIPOEVENTONOMBRE)) AS "nombre" FROM TIPOEVENTO WHERE TIPOEVENTOACTIVO = 1`),
        qr.query(`SELECT MODALIDADFORMACIONID AS "id", TRIM(UPPER(MODALIDADFORMACIONNOMBRE)) AS "nombre" FROM MODALIDADFORMACION WHERE MODALIDADFORMACIONACTIVO = 1`),
      ])
      const tiposEvento = tiposEventoMap as Array<{ id: number; nombre: string }>
      const modsForm    = modsFormCat    as Array<{ id: number; nombre: string }>

      // Rubros de la convocatoria (lookup por código y por nombre).
      const rubrosConv: Array<{ id: number; codigo: string; nombre: string }> = await qr.query(
        `SELECT RUBROID AS "id",
                TRIM(UPPER(RUBROCODIGO)) AS "codigo",
                TRIM(UPPER(RUBRONOMBRE)) AS "nombre"
           FROM RUBRO WHERE CONVOCATORIAIDRUBRO = :1`,
        [dto.convocatoriaId],
      )

      const norm = (s: string | null | undefined) => (s ?? '').trim().toUpperCase()
      const tokensConf = (s: string): string[] => s.split(/[^A-Z0-9Ñ]+/i)
        .map(t => t.toUpperCase())
        .filter(t => t.length >= 4 && !['PARA', 'DESDE', 'HASTA'].includes(t))
      const findInMap = (cat: Map<string, number>, nombre: string | null | undefined): number | null => {
        const k = normalizar(nombre)
        if (!k) return null
        const exact = cat.get(k)
        if (exact !== undefined) return exact
        if (k.length < 6) return null
        // Substring match (uno contiene al otro) para nombres largos.
        for (const [catKey, id] of cat) {
          if (catKey.length < 6) continue
          if (catKey.includes(k) || k.includes(catKey)) return id
        }
        // Token-overlap (≥60% palabras ≥4 chars compartidas).
        const t1 = tokensConf(k)
        if (t1.length === 0) return null
        for (const [catKey, id] of cat) {
          const t2 = tokensConf(catKey)
          if (t2.length === 0) continue
          const small = t1.length <= t2.length ? t1 : t2
          const big   = t1.length <= t2.length ? t2 : t1
          const setBig = new Set(big)
          const overlap = small.filter(t => setBig.has(t)).length
          if (overlap >= 2 && overlap / small.length >= 0.6) return id
        }
        return null
      }
      const findTipoEvento = (nombre: string | null) =>
        nombre ? this.matchModalidad(nombre, tiposEvento)?.id ?? null : null
      const findModalidad = (nombre: string | null) =>
        nombre ? this.matchModalidadFormacion(nombre, modsForm)?.id ?? null : null

      // Para AREAFUNCIONAL y UTACTIVIDADES, cuando el valor del Excel no
      // existe en el catalogo principal, el formulador lo registra como
      // "Otra"/"Otro" y deja el nombre real en una columna OTRO. Localizamos
      // el id del registro "Otra"/"Otro" para usarlo como fallback.
      const findOtroId = (cat: Map<string, number>, candidatos: string[]): number | null => {
        for (const c of candidatos) {
          const id = cat.get(c)
          if (id !== undefined) return id
        }
        return null
      }
      const areaOtraId = findOtroId(areasCat, ['OTRA', 'OTRO', 'OTRAS', 'OTROS'])
      const utActOtraId = findOtroId(utActCat, ['OTRA', 'OTRO', 'OTRAS', 'OTROS'])
      const findRubro = (codigo: string, nombre?: string | null): number | null => {
        const c = norm(codigo)
        const byCode = rubrosConv.find(r => r.codigo === c)
        if (byCode) return Number(byCode.id)
        const n = norm(nombre)
        if (n) {
          const byName = rubrosConv.find(r => r.nombre === n)
          if (byName) return Number(byName.id)
        }
        return null
      }

      // Acumuladores de no resueltos por categoría — se devuelven al admin.
      const noResueltos: Record<string, Set<string>> = {
        areas: new Set(), niveles: new Set(), cuoc: new Set(),
        sectoresPert: new Set(), subsectoresPert: new Set(),
        sectoresBenef: new Set(), subsectoresBenef: new Set(),
        ambientes: new Set(), materiales: new Set(), recursos: new Set(),
        gestion: new Set(), utActividades: new Set(), departamentos: new Set(),
        articulacionTerritorial: new Set(), enfoque: new Set(),
        metodologia: new Set(), tipoEvento: new Set(), modalidadFormacion: new Set(),
        componente: new Set(),
      }

      // ── 6. AFs + sub-tablas ─────────────────────────────────────────────
      const afIdsPorConsecutivo = new Map<number, number>()
      let afsCreadas = 0
      let utsCreadas = 0
      let rubrosCreados = 0
      let areasCreadas = 0
      let nivelesCreados = 0
      let cuocCreados = 0
      let sectoresCreados = 0
      let subsectoresCreados = 0
      let recursosCreados = 0
      let gruposCreados = 0
      let coberturasCreadas = 0
      let actividadesCreadas = 0
      let perfilesCreados = 0
      const rubrosNoEncontrados = new Set<string>()

      for (const af of data.afs) {
        const tipoEventoId = findTipoEvento(af.eventoFormacion)
        if (af.eventoFormacion && !tipoEventoId) noResueltos.tipoEvento.add(af.eventoFormacion)
        const modFormId = findModalidad(af.modalidadFormacion)
        if (af.modalidadFormacion && !modFormId) noResueltos.modalidadFormacion.add(af.modalidadFormacion)
        const enfoqueId = findInMap(enfoqueCat, af.enfoque)
        if (af.enfoque && !enfoqueId) noResueltos.enfoque.add(af.enfoque)
        const metodologiaId = findInMap(metodologiaCat, af.metodologia)
        if (af.metodologia && !metodologiaId) noResueltos.metodologia.add(af.metodologia)
        const ambienteId = findInMap(ambientesCat, af.ambiente)
        if (af.ambiente && !ambienteId) noResueltos.ambientes.add(af.ambiente)

        const benefPres = af.beneficiariosPresenciales ?? 0
        const benefSinc = af.beneficiariosSincronicos ?? 0
        const numGrupos = af.numeroGrupos ?? 0
        const horasGrupo = af.horasPorGrupo ?? 0
        // Totales del proyecto: por-grupo × n° grupos.
        const benefTot  = (benefPres + benefSinc) * (numGrupos || 1)
        const totHoras  = horasGrupo * (numGrupos || 1)

        const seqA: Array<{ NEXTVAL: number }> = await qr.query(`SELECT ACCIONFORMACIONID.NEXTVAL FROM dual`)
        const afId = Number(seqA[0].NEXTVAL)

        // Resultados de impacto (CLOBs en BD): el Excel trae 5 entradas para
        // cada uno (impacto en desempeño / impacto en productividad). Se
        // concatenan con saltos de línea para que el editor del proyecto vivo
        // pueda separarlos posteriormente.
        const resDesem = af.impactosTrabajador.filter(Boolean).join('\n').trim() || null
        const resForm  = af.impactosProductividad.filter(Boolean).join('\n').trim() || null

        // Componente Estratégico: el Excel trae el nombre del AFCOMPONENTE
        // en col "ALINEACIÓN DE LA ACCIÓN DE FORMACIÓN" (descripcionAlineacion).
        const componenteId = findInMap(afComponenteCat, af.descripcionAlineacion)
        if (af.descripcionAlineacion && !componenteId) {
          // Sin lookup: dejamos el texto en COMPOD para que el admin lo elija
          // luego desde el editor.
        }

        // NECESIDADFORMACIONIDAF: por (codigoDiagnostico, codigoNecesidad).
        const necFormKey = `${af.codigoDiagnostico ?? ''}-${af.codigoNecesidad ?? ''}`
        const necFormIdAf = necFormIdPor.get(necFormKey) ?? null

        await qr.query(
          `INSERT INTO ACCIONFORMACION
             (ACCIONFORMACIONID, PROYECTOID, ACCIONFORMACIONNUMERO, ACCIONFORMACIONNOMBRE,
              NECESIDADFORMACIONIDAF,
              ACCIONFORMACIONJUSTNEC, ACCIONFORMACIONCAUSA, ACCIONFORMACIONRESULTADOS,
              ACCIONFORMACIONOBJETIVO,
              TIPOEVENTOID, MODALIDADFORMACIONID, METODOLOGIAAPRENDIZAJEID,
              ACCIONFORMACIONNUMHORAGRUPO, ACCIONFORMACIONNUMGRUPOS, ACCIONFORMACIONNUMTOTHORASGRUP,
              ACCIONFORMACIONBENEFGRUPO, ACCIONFORMACIONBENEFVIGRUPO, ACCIONFORMACIONNUMBENEF,
              AFENFOQUEID, ACCIONFORMACIONAREAFUN, ACCIONFORMACIONNIVELOCUPD,
              ACCIONFORMACIONMUJER, ACCIONFORMACIONNUMCAMPESINO, ACCIONFORMACIONJUSTCAMPESINO,
              ACCIONFORMACIONNUMPOPULAR, ACCIONFORMACIONJUSTPOPULAR,
              ACCIONFORMACIONTRABDISCAPAC, ACCIONFORMACIONTRABAJADORBIC,
              ACCIONFORMACIONMIPYMES, ACCIONFORMACIONTRABMIPYMES, ACCIONFORMACIONMIPYMESD,
              ACCIONFORMACIONCADENAPROD, ACCIONFORMACIONTRABCADPROD, ACCIONFORMACIONCADENAPRODD,
              ACCIONFORMACIONSECSUBD,
              ACCIONFORMACIONCOMPONENTEID, ACCIONFORMACIONCOMPOD, ACCIONFORMACIONJUSTIFICACION,
              ACCIONFORMACIONRESDESEM, ACCIONFORMACIONRESFORM,
              TIPOAMBIENTEID, ACCIONFORMACIONJUSTMAT,
              ACCIONFORMACIONINSUMO, ACCIONFORMACIONJUSTINSUMO,
              ACCIONFORMACIONFECHAREGISTRO)
           VALUES (:1,:2,:3,:4,
                   :5,
                   :6,:7,:8,
                   :9,
                   :10,:11,:12,
                   :13,:14,:15,
                   :16,:17,:18,
                   :19,:20,:21,
                   :22,:23,:24,
                   :25,:26,
                   :27,:28,
                   :29,:30,:31,
                   :32,:33,:34,
                   :35,
                   :36,:37,:38,
                   :39,:40,
                   :41,:42,
                   :43,:44,
                   SYSDATE)`,
          [
            afId, proyectoId, af.consecutivo, (af.nombre ?? '').trim().slice(0, 500),
            necFormIdAf,
            af.diagnostico?.trim() ?? null, af.causasEfectos?.trim() ?? null, af.efectos?.trim() ?? null,
            af.objetivos?.trim() ?? null,
            tipoEventoId, modFormId, metodologiaId,
            horasGrupo || null, numGrupos || null, totHoras || null,
            benefPres || null, benefSinc || null, benefTot || null,
            enfoqueId, af.justificacionAreas?.trim() ?? null, af.justificacionNiveles?.trim() ?? null,
            af.trabajadoresMujeres ?? null, af.trabajadoresCampesinos ?? null,
            af.trabajadoresCampesinosTexto?.trim() ?? null,
            af.trabajadoresPopular ?? null, af.trabajadoresPopularTexto?.trim() ?? null,
            af.trabajadoresDiscapacidad ?? null, af.empresasBic ?? null,
            af.mipymesEmpresas ?? null, af.mipymesTrabajadores ?? null,
            af.justificacionMipymes?.trim() ?? null,
            af.cadenaEmpresas ?? null, af.cadenaTrabajadores ?? null,
            af.justificacionCadena?.trim() ?? null,
            af.justificacionSectores?.trim() ?? null,
            // COMPOD = Justificación de la Alineación (BN, r[65]) — el editor del
            // proyecto vivo lee esta columna para esa textarea. JUSTIFICACION =
            // Justificación AF Especializada (BO, r[66]). El nombre del
            // AFCOMPONENTE (descripcionAlineacion) se referencia vía COMPONENTEID.
            componenteId, af.justificacionAlineacion?.trim() ?? null, af.justificacionEspecializada?.trim() ?? null,
            resDesem, resForm,
            ambienteId, af.justificacionSiAplica?.trim() ?? null,
            af.insumos?.trim() ?? null, af.justificacionInsumo?.trim() ?? null,
          ],
        )
        if (af.descripcionAlineacion && !componenteId) {
          noResueltos.componente = noResueltos.componente ?? new Set()
          noResueltos.componente.add(af.descripcionAlineacion)
        }
        afIdsPorConsecutivo.set(af.consecutivo, afId)
        afsCreadas++

        // ── Áreas funcionales ──
        // Cuando el Excel trae un area que no existe en el catalogo,
        // se inserta como "Otra" con el nombre original en AFAREAFUNCIONALOTRO,
        // tal como lo hace el formulador GeneXus.
        for (const a of af.areas) {
          let aid = findInMap(areasCat, a)
          let textoOtro: string | null = null
          if (!aid) {
            if (areaOtraId) {
              aid = areaOtraId
              textoOtro = a.trim().slice(0, 200)
            } else {
              noResueltos.areas.add(a)
              continue
            }
          }
          const [{ nid }] = await qr.query(
            `SELECT NVL(MAX(AFAREAFUNCIONALID), 0) + 1 AS "nid" FROM AFAREAFUNCIONAL`,
          )
          await qr.query(
            `INSERT INTO AFAREAFUNCIONAL (AFAREAFUNCIONALID, ACCIONFORMACIONIDAF, AREAFUNCIONALIDAF, AFAREAFUNCIONALOTRO)
             VALUES (:1, :2, :3, :4)`,
            [Number(nid), afId, aid, textoOtro],
          )
          areasCreadas++
        }

        // ── Niveles ocupacionales ──
        for (const n of af.niveles) {
          const nid2 = findInMap(nivelesCat, n)
          if (!nid2) { noResueltos.niveles.add(n); continue }
          const [{ nid }] = await qr.query(
            `SELECT NVL(MAX(AFNIVELOCUPACIONALID), 0) + 1 AS "nid" FROM AFNIVELOCUPACIONAL`,
          )
          await qr.query(
            `INSERT INTO AFNIVELOCUPACIONAL (AFNIVELOCUPACIONALID, ACCIONFORMACIONID, NIVELOCUPACIONALIDAF)
             VALUES (:1, :2, :3)`,
            [Number(nid), afId, nid2],
          )
          nivelesCreados++
        }

        // ── Ocupaciones CUOC: el Excel viene "1234 - Nombre"; matcheamos
        // el nombre completo y si no, lo que queda tras el guión.
        for (const c of af.ocupacionesCuoc) {
          let cid = findInMap(cuocCat, c)
          if (!cid) {
            const idxDash = c.indexOf('-')
            if (idxDash >= 0) cid = findInMap(cuocCat, c.slice(idxDash + 1))
          }
          if (!cid) { noResueltos.cuoc.add(c); continue }
          const [{ nid }] = await qr.query(
            `SELECT NVL(MAX(OCUPACIONCOUCAFID), 0) + 1 AS "nid" FROM OCUPACIONCOUCAF`,
          )
          await qr.query(
            `INSERT INTO OCUPACIONCOUCAF (OCUPACIONCOUCAFID, ACCIONFORMACIONID, OCUPACIONCUOCID)
             VALUES (:1, :2, :3)`,
            [Number(nid), afId, cid],
          )
          cuocCreados++
        }

        // ── Sectores que PERTENECEN los beneficiarios (AFPSECTOR/AFPSUBSECTOR) ──
        for (const s of af.sectoresPertenecen) {
          const sid = findInMap(sectoresCat, s)
          if (!sid) { noResueltos.sectoresPert.add(s); continue }
          const [{ nid }] = await qr.query(
            `SELECT NVL(MAX(AFPSECTORID), 0) + 1 AS "nid" FROM AFPSECTOR`,
          )
          await qr.query(
            `INSERT INTO AFPSECTOR (AFPSECTORID, ACCIONFORMACIONID, SECTORAFID, AFPSECTORESTADO)
             VALUES (:1, :2, :3, 1)`,
            [Number(nid), afId, sid],
          )
          sectoresCreados++
        }
        for (const s of af.subsectoresPertenecen) {
          const sid = findInMap(subsectoresCat, s)
          if (!sid) { noResueltos.subsectoresPert.add(s); continue }
          const [{ nid }] = await qr.query(
            `SELECT NVL(MAX(AFPSUBSECTORID), 0) + 1 AS "nid" FROM AFPSUBSECTOR`,
          )
          await qr.query(
            `INSERT INTO AFPSUBSECTOR (AFPSUBSECTORID, ACCIONFORMACIONID, SUBSECTORAFID, AFPSUBSECTORESTADO)
             VALUES (:1, :2, :3, 1)`,
            [Number(nid), afId, sid],
          )
          subsectoresCreados++
        }

        // ── Sectores que la AF BENEFICIA (AFSECTOR/AFSUBSECTOR) ──
        for (const s of af.sectoresBeneficia) {
          const sid = findInMap(sectoresCat, s)
          if (!sid) { noResueltos.sectoresBenef.add(s); continue }
          const [{ nid }] = await qr.query(
            `SELECT NVL(MAX(AFSECTORID), 0) + 1 AS "nid" FROM AFSECTOR`,
          )
          await qr.query(
            `INSERT INTO AFSECTOR (AFSECTORID, ACCIONFORMACIONID, SECTORAFID)
             VALUES (:1, :2, :3)`,
            [Number(nid), afId, sid],
          )
          sectoresCreados++
        }
        for (const s of af.subsectoresBeneficia) {
          const sid = findInMap(subsectoresCat, s)
          if (!sid) { noResueltos.subsectoresBenef.add(s); continue }
          const [{ nid }] = await qr.query(
            `SELECT NVL(MAX(AFSUBSECTORID), 0) + 1 AS "nid" FROM AFSUBSECTOR`,
          )
          await qr.query(
            `INSERT INTO AFSUBSECTOR (AFSUBSECTORID, ACCIONFORMACIONID, SUBSECTORAFID)
             VALUES (:1, :2, :3)`,
            [Number(nid), afId, sid],
          )
          subsectoresCreados++
        }

        // ── Gestión del conocimiento (1:N pero el Excel trae solo un valor) ──
        if (af.gestionConocimiento) {
          const gid = findInMap(gestionCat, af.gestionConocimiento)
          if (gid) {
            const [{ nid }] = await qr.query(
              `SELECT NVL(MAX(AFGESTIONCONOCIMIENTOID), 0) + 1 AS "nid" FROM AFGESTIONCONOCIMIENTO`,
            )
            await qr.query(
              `INSERT INTO AFGESTIONCONOCIMIENTO (AFGESTIONCONOCIMIENTOID, ACCIONFORMACIONID, GESTIONCONOCIMIENTOID)
               VALUES (:1, :2, :3)`,
              [Number(nid), afId, gid],
            )
          } else {
            noResueltos.gestion.add(af.gestionConocimiento)
          }
        }

        // ── Material de formación ──
        if (af.material) {
          const mid = findInMap(materialesCat, af.material)
          if (mid) {
            const [{ nid }] = await qr.query(
              `SELECT NVL(MAX(MATERIALFORMACIONAFID), 0) + 1 AS "nid" FROM MATERIALFORMACIONAF`,
            )
            await qr.query(
              `INSERT INTO MATERIALFORMACIONAF (MATERIALFORMACIONAFID, ACCIONFORMACIONID, MATERIALFORMACIONID)
               VALUES (:1, :2, :3)`,
              [Number(nid), afId, mid],
            )
          } else {
            noResueltos.materiales.add(af.material)
          }
        }

        // ── Recursos didácticos (el Excel trae uno solo en col 75) ──
        if (af.recursosDidacticos) {
          const rid = findInMap(recursosCat, af.recursosDidacticos)
          if (rid) {
            const [{ nid }] = await qr.query(
              `SELECT NVL(MAX(RECURSOSDIDACTICOSAFID), 0) + 1 AS "nid" FROM RECURSOSDIDACTICOSAF`,
            )
            await qr.query(
              `INSERT INTO RECURSOSDIDACTICOSAF (RECURSOSDIDACTICOSAFID, ACCIONFORMACIONID, RECURSOSDIDACTICOSID)
               VALUES (:1, :2, :3)`,
              [Number(nid), afId, rid],
            )
            recursosCreados++
          } else {
            noResueltos.recursos.add(af.recursosDidacticos)
          }
        }

        // ── Grupos de cobertura + AFGRUPOCOBERTURA (deptos por nombre) ──
        const covAf = data.cobertura.filter(c => Number(c.numeroAF) === Number(af.consecutivo))
        for (let i = 0; i < covAf.length; i++) {
          const cov = covAf[i]
          const grupoNumero = (cov.numeroGrupo && cov.numeroGrupo > 0) ? cov.numeroGrupo : (i + 1)
          const [{ nid: grupoId }] = await qr.query(
            `SELECT NVL(MAX(AFGRUPOID), 0) + 1 AS "nid" FROM AFGRUPO`,
          )
          await qr.query(
            `INSERT INTO AFGRUPO (AFGRUPOID, ACCIONFORMACIONID, AFGRUPONUMERO, AFGRUPOJUSTIFICACION)
             VALUES (:1, :2, :3, :4)`,
            [Number(grupoId), afId, grupoNumero, cov.justificacion?.trim() ?? null],
          )
          gruposCreados++

          // Cobertura presencial (un solo registro)
          if (cov.departamentoPresencial) {
            const did = findInMap(departamentosCat, cov.departamentoPresencial)
            if (!did) {
              noResueltos.departamentos.add(cov.departamentoPresencial)
            } else {
              // Ciudad por nombre dentro del departamento (opcional)
              let ciudadId: number | null = null
              if (cov.ciudadPresencial) {
                const ciu: Array<{ id: number }> = await qr.query(
                  `SELECT CIUDADID AS "id" FROM CIUDAD
                    WHERE DEPARTAMENTOID = :1 AND TRIM(UPPER(CIUDADNOMBRE)) = :2 AND ROWNUM = 1`,
                  [did, norm(cov.ciudadPresencial)],
                )
                if (ciu[0]) ciudadId = Number(ciu[0].id)
              }
              const [{ nid: cobId }] = await qr.query(
                `SELECT NVL(MAX(AFGRUPOCOBERTURAID), 0) + 1 AS "nid" FROM AFGRUPOCOBERTURA`,
              )
              await qr.query(
                `INSERT INTO AFGRUPOCOBERTURA
                   (AFGRUPOCOBERTURAID, AFGRUPOID, DEPARTAMENTOGRUPOID, CIUDADGRUPOID,
                    AFGRUPOCOBERTURABENEF, AFGRUPOFILTRO, AFGRUPOCOBERTURAMOD, AFGRUPOCOBERTURARURAL)
                 VALUES (:1, :2, :3, :4, :5, :6, 'P', 0)`,
                [Number(cobId), Number(grupoId), did, ciudadId,
                 cov.beneficiariosPresencial ?? 0, afId],
              )
              coberturasCreadas++
            }
          }

          // Cobertura "secundaria" (lista de departamentos sin ciudad).
          // Codigo de modalidad por AFGRUPOCOBERTURAMOD:
          //   - Virtual (modal 4)         -> 'V'
          //   - PAT (2) y Hibrida (3)     -> 'S' (Sincronicos: dep sin ciudad)
          //   - Presencial (1)            -> no deberia llegar aqui, pero
          //                                  caemos a 'S' como fallback seguro.
          // modFormId es el id resuelto del MODALIDADFORMACION de esta AF.
          const modSecundario = modFormId === 4 ? 'V' : 'S'
          for (const d of cov.departamentos) {
            const did = findInMap(departamentosCat, d.departamento)
            if (!did) { noResueltos.departamentos.add(d.departamento); continue }
            const [{ nid: cobId }] = await qr.query(
              `SELECT NVL(MAX(AFGRUPOCOBERTURAID), 0) + 1 AS "nid" FROM AFGRUPOCOBERTURA`,
            )
            await qr.query(
              `INSERT INTO AFGRUPOCOBERTURA
                 (AFGRUPOCOBERTURAID, AFGRUPOID, DEPARTAMENTOGRUPOID, CIUDADGRUPOID,
                  AFGRUPOCOBERTURABENEF, AFGRUPOFILTRO, AFGRUPOCOBERTURAMOD, AFGRUPOCOBERTURARURAL)
               VALUES (:1, :2, :3, NULL, :4, :5, :6, 0)`,
              [Number(cobId), Number(grupoId), did, d.beneficiarios, afId, modSecundario],
            )
            coberturasCreadas++
          }
        }

        // ── UTs + actividades + perfiles ──
        const utsAf = data.uts.filter(u => Number(u.numeroAF) === Number(af.consecutivo))
        for (const ut of utsAf) {
          const [{ id: utId }] = await qr.query(
            `SELECT NVL(MAX(UNIDADTEMATICAID), 0) + 1 AS "id" FROM UNIDADTEMATICA`,
          )
          // Mapeo de horas según modalidad de la AF (mismo criterio del proyecto vivo).
          const modUp = norm(af.modalidadFormacion)
          const esPat = modUp === 'PAT' || modUp.includes('ASISTIDA POR TECNOLOG')
          const esVir = modUp === 'VIRTUAL'
          const esHib = modUp.includes('HÍBRID') || modUp.includes('HIBRID')
          const esPre = !esPat && !esVir && !esHib
          const hp = ut.horasPracticas ?? 0
          const ht = ut.horasTeoricas ?? 0
          const horas = {
            pp: esPre ? hp : 0, pv: esVir ? hp : 0, ppat: esPat ? hp : 0, phib: esHib ? hp : 0,
            tp: esPre ? ht : 0, tv: esVir ? ht : 0, tpat: esPat ? ht : 0, thib: esHib ? ht : 0,
          }
          // Articulación territorial — el Excel solo trae el texto, así que
          // resolvemos por nombre exacto contra el catálogo si la UT está
          // marcada como articulación territorial.
          let articulacionId: number | null = null
          if (ut.esArticulacionTerritorial && ut.articulacionTerritorial) {
            articulacionId = findInMap(articulacionTerrCat, ut.articulacionTerritorial)
            if (!articulacionId) noResueltos.articulacionTerritorial.add(ut.articulacionTerritorial)
          }

          await qr.query(
            `INSERT INTO UNIDADTEMATICA (
               UNIDADTEMATICAID, PROYECTOIDUT, ACCIONFORMACIONID, UNIDADTEMATICANUMERO,
               UNIDADTEMATICANOMBRE, UNIDADTEMATICACOMPETENCIAS, UNIDADTEMATICACONTENIDO,
               UNIDADTEMATICAJUSTACTIVIDAD,
               UNIDADTEMATICAHORASPP, UNIDADTEMATICAHORASPV, UNIDADTEMATICAHORASPPAT, UNIDADTEMATICAHORASPHIB,
               UNIDADTEMATICAHORASTP, UNIDADTEMATICAHORASTV, UNIDADTEMATICAHORASTPAT, UNIDADTEMATICAHORASTHIB,
               UNIDADTEMATICAESTRANSVERSAL, ARTICULACIONTERRITORIALID, UNIDADTEMATICAFECHAREGISTRO
             ) VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15,:16,:17,:18,SYSDATE)`,
            [Number(utId), proyectoId, afId, ut.numeroUT,
             (ut.nombre ?? '').trim().slice(0, 500),
             ut.competencia?.trim() ?? null,
             ut.contenido?.trim() ?? null,
             ut.descripcionActividad?.trim() ?? null,
             horas.pp, horas.pv, horas.ppat, horas.phib,
             horas.tp, horas.tv, horas.tpat, horas.thib,
             ut.esArticulacionTerritorial ? 1 : 0, articulacionId],
          )
          utsCreadas++

          // Actividades de la UT (lookup por nombre en UTACTIVIDADES). Si la
          // actividad no existe en el catalogo, se inserta como "Otra" con el
          // nombre original en ACTIVIDADUTOTRO (mismo patron que en GeneXus).
          for (const a of ut.actividades) {
            let aid = findInMap(utActCat, a)
            let textoOtro: string | null = null
            if (!aid) {
              if (utActOtraId) {
                aid = utActOtraId
                textoOtro = a.trim().slice(0, 200)
              } else {
                noResueltos.utActividades.add(a)
                continue
              }
            }
            const [{ nid }] = await qr.query(
              `SELECT NVL(MAX(ACTIVIDADUTID), 0) + 1 AS "nid" FROM ACTIVIDADUT`,
            )
            await qr.query(
              `INSERT INTO ACTIVIDADUT (ACTIVIDADUTID, UNIDADTEMATICAID, UTACTIVIDADESID, ACTIVIDADUTOTRO)
               VALUES (:1, :2, :3, :4)`,
              [Number(nid), Number(utId), aid, textoOtro],
            )
            actividadesCreadas++
          }

          // Perfiles del capacitador (el rubro se resuelve por nombre del perfil).
          for (const p of ut.perfiles) {
            if (!p.perfil) continue
            const rubroId = findRubro(p.perfil, p.perfil)
            if (!rubroId) {
              rubrosNoEncontrados.add(`${p.perfil} (UT${ut.numeroUT}, AF ${af.consecutivo})`)
              continue
            }
            const [{ nid }] = await qr.query(
              `SELECT NVL(MAX(PERFILUTID), 0) + 1 AS "nid" FROM PERFILUT`,
            )
            await qr.query(
              `INSERT INTO PERFILUT (PERFILUTID, UNIDADTEMATICAID, RUBROIDUT, PERFILUTHORASCAP, PERFILUTFECHAREGISTRO)
               VALUES (:1, :2, :3, :4, SYSDATE)`,
              [Number(nid), Number(utId), rubroId, p.horas ?? 0],
            )
            perfilesCreados++
          }
        }

        // ── Rubros de la AF ──
        const rubrosAf = data.rubros.filter(r => Number(r.numeroAF) === Number(af.consecutivo))
        for (const r of rubrosAf) {
          const rubroId = findRubro(r.idRubro, r.nombreRubro)
          if (!rubroId) {
            rubrosNoEncontrados.add(`${r.idRubro || r.nombreRubro} (AF ${af.consecutivo})`)
            continue
          }
          const [{ id: afrId }] = await qr.query(
            `SELECT NVL(MAX(AFRUBROID), 0) + 1 AS "id" FROM AFRUBRO`,
          )
          const total = r.totalRubro ?? 0
          const cof   = r.cofinanciacionSena ?? 0
          const esp   = r.contrapartidaEspecie ?? 0
          const din   = r.contrapartidaDinero ?? 0
          const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0
          await qr.query(
            `INSERT INTO AFRUBRO
               (AFRUBROID, PROYECTOIDRUBROAF, ACCIONFORMACIONID, RUBROID,
                AFRUBROJUSTIFICACION, AFRUBRONUMHORAS, AFRUBROCANTIDAD,
                AFRUBROBENEFICIARIOS, AFRUBRODIAS,
                AFRUBROVALOR, AFRUBROCOFINANCIACION, AFRUBROESPECIE, AFRUBRODINERO,
                AFRUBROVALORMAXIMO, AFRUBROVALORPORBENEFICIARIO, AFRUBROPAQUETE,
                AFRUBROPORCENTAJECOFINANCIACION, AFRUBROPORCENTAJEESPECIE, AFRUBROPORCENTAJEDINERO,
                AFRUBROFECHAREGISTRO)
             VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14, :15, :16, :17, :18, :19, SYSDATE)`,
            [Number(afrId), proyectoId, afId, rubroId,
             (r.justificacion ?? '').trim().slice(0, 2000),
             r.numHoras ?? 0, r.numPaginasUnidades ?? 1,
             r.numBeneficiarios ?? 0, r.numDias ?? 0,
             total, cof, esp, din,
             r.valorMaximo ?? 0, r.valorPorBeneficiarios ?? 0, r.paquete ?? null,
             pct(cof), pct(esp), pct(din)],
          )
          rubrosCreados++
        }
      }

      await qr.commitTransaction()
      const noResueltosOut: Record<string, string[]> = {}
      for (const [k, set] of Object.entries(noResueltos)) {
        if (set.size > 0) noResueltosOut[k] = Array.from(set)
      }
      return {
        proyectoId,
        empresaId,
        usuarioId,
        afsCreadas,
        utsCreadas,
        rubrosCreados,
        areasCreadas,
        nivelesCreados,
        cuocCreados,
        sectoresCreados,
        subsectoresCreados,
        recursosCreados,
        gruposCreados,
        coberturasCreadas,
        actividadesCreadas,
        perfilesCreados,
        necesidadesCreadas,
        necFormCreadas,
        herramientasCreadas,
        rubrosNoEncontrados: Array.from(rubrosNoEncontrados),
        contactosCreados: contactos.length,
        noResueltos: noResueltosOut,
        mensaje: 'Proyecto importado correctamente en estado borrador',
      }
    } catch (err) {
      await qr.rollbackTransaction()
      throw err
    } finally {
      await qr.release()
    }
  }

  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║ Parsers por hoja                                                        ║
  // ╚════════════════════════════════════════════════════════════════════════╝

  private toRows(ws: XLSX.WorkSheet): unknown[][] {
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false })
  }

  private str(v: unknown): string | null {
    if (v === null || v === undefined) return null
    const s = String(v).trim()
    return s === '' ? null : s
  }

  private num(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  private parseBasicos(ws: XLSX.WorkSheet): ExcelBasicos {
    const rows = this.toRows(ws)
    const r = rows[1] ?? []
    return {
      nit:                    this.str(r[0]) ?? '',
      digitoVerificacion:     this.str(r[1]) ?? '',
      razonSocial:            this.str(r[2]) ?? '',
      sigla:                  this.str(r[3]),
      email:                  this.str(r[4]) ?? '',
      departamentoDomicilio:  this.str(r[5]),
      ciudadDomicilio:        this.str(r[6]),
      direccionDomicilio:     this.str(r[7]),
      telefono:               this.str(r[8]),
      paginaWeb:              this.str(r[9]),
      ciiu:                   this.str(r[10]),
      tipoOrganizacion:       this.str(r[11]),
      certificacionCompetencias: this.str(r[12]),
      vinculoExpertosTecnicos:   this.str(r[13]),
      cobertura:              this.str(r[14]),
      codigoIndicativo:       this.str(r[15]),
      tamanoEmpresa:          this.str(r[16]),
      celular:                this.str(r[17]),
      mesa1:                  this.str(r[18]),
      mesa2:                  this.str(r[19]),
      mesa3:                  this.str(r[20]),
      modalidadParticipacion: this.str(r[21]),
      tipoIdentificacion:     this.str(r[22]),
    }
  }

  private parseContactos(ws: XLSX.WorkSheet): ExcelContacto {
    const rows = this.toRows(ws)
    const r = rows[1] ?? []
    return {
      representanteLegal: { id: this.str(r[0]) ?? '', tipo: this.str(r[1]) ?? '', nombre: this.str(r[2]) ?? '', email: this.str(r[3]) ?? '', telefono: this.str(r[4]) ?? '' },
      contacto1:          { id: this.str(r[5]) ?? '', tipo: this.str(r[6]) ?? '', nombre: this.str(r[7]) ?? '', email: this.str(r[8]) ?? '', telefono: this.str(r[9]) ?? '' },
      contactoSustenta:   { id: this.str(r[11]) ?? '', tipo: this.str(r[10]) ?? '', nombre: this.str(r[12]) ?? '', email: this.str(r[13]) ?? '', telefono: this.str(r[14]) ?? '' },
    }
  }

  private parseGeneralidades(ws: XLSX.WorkSheet): ExcelGeneralidades {
    const rows = this.toRows(ws)
    const r = rows[1] ?? []
    return {
      objetoSocial:         this.str(r[0]),
      productosServicios:   this.str(r[1]),
      situacionActual:      this.str(r[2]),
      papelSector:          this.str(r[3]),
      retos:                this.str(r[4]),
      experienciaFormativa: this.str(r[5]),
      objetivoProyecto:     this.str(r[6]),
      sectorPertenece:      this.str(r[7]),
      subsectorPertenece:   this.str(r[8]),
      sectoresRepresenta:   [r[9], r[10], r[11]].map(x => this.str(x)).filter((x): x is string => x !== null),
      subsectoresRepresenta: [r[12], r[13], r[14]].map(x => this.str(x)).filter((x): x is string => x !== null),
      cadenaProductiva:     this.str(r[15]),
      interacciones:        this.str(r[16]),
    }
  }

  private parseDiagnosticos(ws: XLSX.WorkSheet): ExcelDiagnostico[] {
    const rows = this.toRows(ws)
    return rows.slice(1).map(r => {
      const herramientas: Array<{ nombre: string; muestra: string }> = []
      for (let i = 0; i < 5; i++) {
        const h = this.str(r[1 + i * 2])
        const m = this.str(r[2 + i * 2])
        if (h) herramientas.push({ nombre: h, muestra: m ?? '' })
      }
      return {
        numero:              Number(this.num(r[0]) ?? 0),
        herramientas,
        fecha:               this.str(r[11]),
        herramientaPropia:   this.str(r[12]),
        otraHerramienta:     this.str(r[13]),
        planCapacitacion:    this.str(r[14]),
        descripcion:         this.str(r[15]),
        resumen:             this.str(r[16]),
      }
    }).filter(d => d.numero > 0)
  }

  private parseNecesidades(ws: XLSX.WorkSheet): ExcelNecesidad[] {
    const rows = this.toRows(ws)
    return rows.slice(1).map(r => ({
      numeroDiagnostico:    Number(this.num(r[0]) ?? 0),
      numeroNecesidad:      Number(this.num(r[1]) ?? 0),
      necesidad:            this.str(r[2]) ?? '',
      numeroBeneficiarios:  Number(this.num(r[3]) ?? 0),
    })).filter(n => n.numeroNecesidad > 0)
  }

  private parsePresupuesto(ws: XLSX.WorkSheet): ExcelPresupuesto {
    const rows = this.toRows(ws)
    const r = rows[1] ?? []
    return {
      numeroAFs:                Number(this.num(r[0]) ?? 0),
      beneficiarios:            Number(this.num(r[1]) ?? 0),
      valorAFs:                 Number(this.num(r[2]) ?? 0),
      gastosOperacion:          Number(this.num(r[3]) ?? 0),
      valorTransferencia:       Number(this.num(r[4]) ?? 0),
      beneficiariosTransferencia: Number(this.num(r[5]) ?? 0),
      poliza:                   Number(this.num(r[6]) ?? 0),
      valorTotal:               Number(this.num(r[7]) ?? 0),
      cofinanciacionSena:       Number(this.num(r[8]) ?? 0),
      contrapartidaEspecie:     Number(this.num(r[9]) ?? 0),
      contrapartidaDinero:      Number(this.num(r[10]) ?? 0),
      gastosOpCofinSena:        Number(this.num(r[11]) ?? 0),
      gastosOpContraEspecie:    Number(this.num(r[12]) ?? 0),
      gastosOpContraDinero:     Number(this.num(r[13]) ?? 0),
    }
  }

  private parseAFs(ws: XLSX.WorkSheet): ExcelAF[] {
    const rows = this.toRows(ws)
    return rows.slice(1).map(r => ({
      consecutivo:          Number(this.num(r[0]) ?? 0),
      nombre:               this.str(r[1]) ?? '',
      diagnostico:          this.str(r[2]),
      causasEfectos:        this.str(r[3]),
      objetivos:            this.str(r[4]),
      enfoque:              this.str(r[5]),
      eventoFormacion:      this.str(r[6]),
      modalidadFormacion:   this.str(r[7]),
      metodologia:          this.str(r[8]),
      horasPorGrupo:        this.num(r[9]),
      numeroGrupos:         this.num(r[10]),
      beneficiariosPresenciales: this.num(r[11]),
      beneficiariosSincronicos:  this.num(r[12]),
      areas:                [r[13], r[14], r[15], r[16], r[17]].map(x => this.str(x)).filter((x): x is string => x !== null),
      justificacionAreas:   this.str(r[18]),
      niveles:              [r[19], r[20], r[21]].map(x => this.str(x)).filter((x): x is string => x !== null),
      justificacionNiveles: this.str(r[22]),
      impactosTrabajador:   [r[23], r[24], r[25], r[26], r[27]].map(x => this.str(x)).filter((x): x is string => x !== null),
      impactosProductividad:[r[28], r[29], r[30], r[31], r[32]].map(x => this.str(x)).filter((x): x is string => x !== null),
      mipymesEmpresas:      this.num(r[33]),
      mipymesTrabajadores:  this.num(r[34]),
      // Col 36 (índice 35) — justificación MIPYMES.
      justificacionMipymes: this.str(r[35]),
      cadenaEmpresas:       this.num(r[36]),
      cadenaTrabajadores:   this.num(r[37]),
      // Col 39 (índice 38) — justificación cadena productiva.
      justificacionCadena:  this.str(r[38]),
      trabajadoresMujeres:  this.num(r[39]),
      trabajadoresCampesinos: this.num(r[40]),
      trabajadoresDiscapacidad: this.num(r[41]),
      empresasBic:          this.num(r[42]),
      // Cols 44-48 (índices 43-47) = SECTOR1..SECTOR5: sectores a los que
      // PERTENECEN los beneficiarios (hasta 5).
      sectoresPertenecen:   [r[43], r[44], r[45], r[46], r[47]].map(x => this.str(x)).filter((x): x is string => x !== null),
      // Cols 49-53 (índices 48-52) = SUBSECTOR1..SUBSECTOR5.
      subsectoresPertenecen:[r[48], r[49], r[50], r[51], r[52]].map(x => this.str(x)).filter((x): x is string => x !== null),
      // Cols 54-58 (índices 53-57) = CLASIFICACION POR SECTOR: el sector que
      // la AF beneficia (normalmente 1).
      sectoresBeneficia:    [r[53], r[54], r[55], r[56], r[57]].map(x => this.str(x)).filter((x): x is string => x !== null),
      subsectoresBeneficia: [r[58], r[59], r[60], r[61], r[62]].map(x => this.str(x)).filter((x): x is string => x !== null),
      // Col 100 (índice 99) = JUSTIFICACIÓN SECTORES Y SUB-SECTORES.
      justificacionSectores: this.str(r[99]),
      componenteAlineacion: this.str(r[63]),
      descripcionAlineacion:this.str(r[64]),
      justificacionAlineacion: this.str(r[65]),
      justificacionEspecializada: this.str(r[66]),
      ambiente:             this.str(r[67]),
      material:             this.str(r[68]),
      justificacionSiAplica:this.str(r[69]),
      gestionConocimiento:  this.str(r[70]),
      incluirEnFormulacion: this.str(r[71]),
      insumos:              this.str(r[72]),
      justificacionInsumo:  this.str(r[73]),
      recursosDidacticos:   this.str(r[74]),
      codigoNecesidad:      this.num(r[75]),
      codigoDiagnostico:    this.num(r[76]),
      ocupacionesCuoc:      Array.from({ length: 20 }, (_, i) => this.str(r[77 + i])).filter((x): x is string => x !== null),
      validacionPresupuesto:this.str(r[97]),
      justificacion:        this.str(r[98]),
      trabajadoresCampesinosTexto: this.str(r[100]),
      trabajadoresPopular:  this.num(r[101]),
      trabajadoresPopularTexto:    this.str(r[102]),
      justificacionTallerPuesto:   this.str(r[103]),
      efectos:              this.str(r[104]),
    })).filter(a =>
      a.consecutivo > 0
      // Solo importamos las AFs que el proponente marcó "SI" en
      // "DESEA INCLUIR ESTA ACCIÓN DE FORMACIÓN EN LA FORMULACIÓN DEL PROYECTO".
      && (a.incluirEnFormulacion ?? '').trim().toUpperCase() === 'SI'
    )
  }

  private parseUTs(ws: XLSX.WorkSheet): ExcelUT[] {
    const rows = this.toRows(ws)
    return rows.slice(1).map(r => ({
      numeroAF:        Number(this.num(r[0]) ?? 0),
      numeroUT:        Number(this.num(r[1]) ?? 0),
      nombre:          this.str(r[2]) ?? '',
      horasPracticas:  this.num(r[3]),
      horasTeoricas:   this.num(r[4]),
      contenido:       this.str(r[5]),
      competencia:     this.str(r[6]),
      actividades:     [r[7], r[8], r[9], r[10], r[11]].map(x => this.str(x)).filter((x): x is string => x !== null),
      descripcionActividad: this.str(r[12]),
      perfiles: [
        { perfil: this.str(r[13]) ?? '', horas: this.num(r[14]) },
        { perfil: this.str(r[15]) ?? '', horas: this.num(r[16]) },
        { perfil: this.str(r[17]) ?? '', horas: this.num(r[18]) },
        { perfil: this.str(r[19]) ?? '', horas: this.num(r[20]) },
        { perfil: this.str(r[21]) ?? '', horas: this.num(r[22]) },
      ].filter(p => p.perfil !== ''),
      // El Excel etiqueta esta columna como HABILIDAD TRANSVERSAL pero
      // representa la articulación territorial (UT especial).
      articulacionTerritorial:    this.str(r[23]),
      esArticulacionTerritorial:  (this.str(r[24]) ?? '').trim().toUpperCase() === 'SI',
    })).filter(u => u.numeroAF > 0 && u.numeroUT > 0)
  }

  private parseRubros(ws: XLSX.WorkSheet): ExcelRubro[] {
    const rows = this.toRows(ws)
    return rows.slice(1).map(r => ({
      numeroAF:             Number(this.num(r[0]) ?? 0),
      idRubro:              this.str(r[1]) ?? '',
      nombreRubro:          this.str(r[2]),
      descripcion:          this.str(r[3]),
      justificacion:        this.str(r[4]),
      tarifaMaxima:         this.num(r[5]),
      numHoras:             this.num(r[6]),
      numPaginasUnidades:   this.num(r[7]),
      numBeneficiarios:     this.num(r[8]),
      numDias:              this.num(r[9]),
      totalRubro:           this.num(r[10]),
      valorMaximo:          this.num(r[11]),
      caso:                 this.str(r[12]),
      paquete:              this.str(r[13]),
      valorPorBeneficiarios:this.num(r[14]),
      cofinanciacionSena:   this.num(r[15]),
      contrapartidaEspecie: this.num(r[16]),
      contrapartidaDinero:  this.num(r[17]),
    })).filter(r => r.numeroAF > 0 && r.idRubro !== '')
  }

  private parseCobertura(ws: XLSX.WorkSheet): ExcelCoberturaFila[] {
    const rows = this.toRows(ws)
    return rows.slice(1).map(r => {
      const departamentos: Array<{ departamento: string; beneficiarios: number }> = []
      // Hasta 25 pares de departamento/beneficiarios (col 6 a 55).
      for (let i = 0; i < 25; i++) {
        const d = this.str(r[5 + i * 2])
        const b = this.num(r[6 + i * 2])
        if (d && b !== null) departamentos.push({ departamento: d, beneficiarios: b })
      }
      return {
        numeroAF:                  Number(this.num(r[0]) ?? 0),
        numeroGrupo:               Number(this.num(r[1]) ?? 0),
        departamentoPresencial:    this.str(r[2]),
        ciudadPresencial:          this.str(r[3]),
        beneficiariosPresencial:   this.num(r[4]),
        departamentos,
        // Col 56 (índice 55) — justificación de la relación de los
        // beneficiarios con los lugares de ejecución planteados.
        justificacion:             this.str(r[55]),
      }
    }).filter(c => c.numeroAF > 0)
  }
}
