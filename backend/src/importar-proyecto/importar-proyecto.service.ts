import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import * as crypto from 'crypto'
import { DataSource } from 'typeorm'
import * as XLSX from 'xlsx'
import { AHORA_UTC } from '../common/db/fecha-utc'
import { insertarConId, sqlCrudo } from '../common/db/ids'
import { mensajeHerrOtraLarga } from '../necesidades/herr-otra'
import { matchModalidad } from './match-modalidad'
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

// tipos del excel parseado

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

// columnas de texto de EMPRESA que escriben el INSERT y el UPDATE de la importación, con su tope en caracteres: son
// NCHAR/NVARCHAR2 con CHAR en AL16UTF16, iguales en el XE y el Exadata, así que el tope es de String.length
const TOPES_EMPRESA: Array<{ campo: string; tope: number; valor: (b: ExcelBasicos) => string | null }> = [
  { campo: 'RAZÓN SOCIAL',       tope: 200, valor: b => b.razonSocial },
  { campo: 'SIGLA',              tope: 40,  valor: b => b.sigla },
  { campo: 'CORREO ELECTRÓNICO', tope: 100, valor: b => b.email?.trim().toLowerCase() ?? null },
  { campo: 'DIRECCIÓN',          tope: 100, valor: b => b.direccionDomicilio },
  { campo: 'CELULAR',            tope: 20,  valor: b => b.celular },
  { campo: 'TELÉFONO',           tope: 20,  valor: b => b.telefono },
  { campo: 'PÁGINA WEB',         tope: 100, valor: b => b.paginaWeb },
]

/**
 * Los datos de la empresa que no caben en su columna. Se revisan antes de escribir para responder con el campo y
 * cuánto sobra en vez del ORA-12899 a mitad de la importación. No se recorta en silencio.
 */
function datosEmpresaQueNoCaben(b: ExcelBasicos): Array<{ campo: string; tope: number; largo: number }> {
  return TOPES_EMPRESA
    .map(({ campo, tope, valor }) => ({ campo, tope, largo: (valor(b) ?? '').trim().length }))
    .filter(d => d.largo > d.tope)
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
  sectoresPertenecen: string[]
  subsectoresPertenecen: string[]
  sectoresBeneficia: string[]
  subsectoresBeneficia: string[]
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
  // en el Excel la columna se llama HABILIDAD TRANSVERSAL
  articulacionTerritorial: string | null
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
  // virtual / PAT / hibrida: hasta 25 departamentos
  departamentos: Array<{ departamento: string; beneficiarios: number }>
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

// preview enriquecido con BD

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

@Injectable()
export class ImportarProyectoService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

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

    const exact = catalogo.find(m => norm(m.nombre) === t)
    if (exact) return exact

    for (const [clave, alias] of Object.entries(aliases)) {
      if (t === norm(clave) || alias.some(a => norm(a) === t)) {
        const candidato = catalogo.find(m => {
          const c = norm(m.nombre)
          return c === norm(clave) || alias.some(a => norm(a) === c)
        })
        if (candidato) return candidato
      }
    }

    return catalogo.find(m => {
      const c = norm(m.nombre)
      return c.length > 2 && (t.includes(c) || c.includes(t))
    })
  }

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

  async preview(buffer: Buffer, convocatoriaId: number): Promise<PreviewImportacion> {
    if (!convocatoriaId) throw new BadRequestException('Debe indicar la convocatoria')

    const data = this.parseExcel(buffer)
    const validaciones: PreviewValidacion[] = []

    data.presupuesto.valorAFs = data.presupuesto.valorTotal
      - data.presupuesto.gastosOperacion
      - data.presupuesto.valorTransferencia

    // convocatoria
    const conv = await this.dataSource.query(
      `SELECT CONVOCATORIAID            AS "id",
              btrim((CONVOCATORIANOMBRE)::text)  AS "nombre",
              CONVOCATORIAESTADO        AS "estado",
              CONVOCATORIAANIO          AS "anio"
         FROM CONVOCATORIA WHERE CONVOCATORIAID = $1`,
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

    const sigla = (data.basicos.sigla ?? '').trim() || data.basicos.razonSocial.trim().slice(0, 30)
    const nombreProyecto = `${sigla}-FCE-${anioConv}`.slice(0, 100)

    const mods: Array<{ id: number; nombre: string }> = await this.dataSource.query(
      `SELECT MODALIDADID AS "id", btrim((UPPER(MODALIDADNOMBRE))::text) AS "nombre"
         FROM MODALIDAD WHERE MODALIDADESTADO = 1`,
    )
    const modTexto = (data.basicos.modalidadParticipacion ?? '').trim().toUpperCase()
    const modProyecto = matchModalidad(modTexto, mods)
    if (!modProyecto && modTexto) {
      validaciones.push({
        nivel: 'warning',
        mensaje: `La modalidad de participación "${modTexto}" no coincide con ningún registro del catálogo MODALIDAD (disponibles: ${mods.map(m => m.nombre).join(', ')}). Se usará la primera disponible.`,
      })
    }

    // validaciones contra catalogos: tipo de evento, modalidad de formacion y rubros
    const tiposEvento: Array<{ id: number; nombre: string }> = await this.dataSource.query(
      `SELECT TIPOEVENTOID AS "id", btrim((UPPER(TIPOEVENTONOMBRE))::text) AS "nombre" FROM TIPOEVENTO WHERE TIPOEVENTOACTIVO = 1`,
    )
    const modsForm: Array<{ id: number; nombre: string }> = await this.dataSource.query(
      `SELECT MODALIDADFORMACIONID AS "id", btrim((UPPER(MODALIDADFORMACIONNOMBRE))::text) AS "nombre" FROM MODALIDADFORMACION WHERE MODALIDADFORMACIONACTIVO = 1`,
    )
    const rubrosConv: Array<{ codigo: string; nombre: string }> = await this.dataSource.query(
      `SELECT btrim((UPPER(RUBROCODIGO))::text) AS "codigo", btrim((UPPER(RUBRONOMBRE))::text) AS "nombre"
         FROM RUBRO WHERE CONVOCATORIAIDRUBRO = $1`,
      [convocatoriaId],
    )
    const rubrosCodigos = new Set(rubrosConv.map(r => r.codigo))
    const rubrosNombres = new Set(rubrosConv.map(r => r.nombre))

    for (const af of data.afs) {
      const evNombre = (af.eventoFormacion ?? '').trim().toUpperCase()
      if (evNombre && !matchModalidad(evNombre, tiposEvento)) {
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
    // el rubro matchea por codigo y, si no coincide, por nombre
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

    // catalogos auxiliares: lo que no resuelva sale como aviso y no se importa
    const normalizar = (s: string | null | undefined) =>
      (s ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase()
    const tokens = (s: string): string[] => s.split(/[^A-Z0-9Ñ]+/i)
      .map(t => t.toUpperCase())
      .filter(t => t.length >= 4 && !['PARA', 'DESDE', 'HASTA'].includes(t))
    const matchCat = (cat: Set<string>, valor: string): boolean => {
      const n = normalizar(valor)
      if (!n) return false
      if (cat.has(n)) return true
      if (n.length < 6) return false
      for (const k of cat) {
        if (k.length < 6) continue
        if (k.includes(n) || n.includes(k)) return true
      }
      // token-overlap: el VBA abrevia palabras ("EO" por "Entidades Oficiales")
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
      cargarCat(`SELECT btrim((AREAFUNCIONALNOMBRE)::text) AS "nombre" FROM AREAFUNCIONAL WHERE AREAFUNCIONALESTADO = 1`),
      cargarCat(`SELECT btrim((NIVELOCUPACIONALNOMBRE)::text) AS "nombre" FROM NIVELOCUPACIONAL WHERE NIVELOCUPACIONALESTADO = 1`),
      cargarCat(`SELECT btrim((OCUPACIONCUOCNOMBRE)::text) AS "nombre" FROM OCUPACIONCUOC WHERE OCUPACIONCUOCESTADO = 1`),
      cargarCat(`SELECT btrim((SECTORDESCRIPCION)::text) AS "nombre" FROM SECTOR`),
      cargarCat(`SELECT btrim((SUBSECTORNOMBRE)::text) AS "nombre" FROM SUBSECTOR`),
      cargarCat(`SELECT btrim((TIPOAMBIENTENOMBRE)::text) AS "nombre" FROM TIPOAMBIENTE`),
      cargarCat(`SELECT btrim((MATERIALFORMACIONNOMBRE)::text) AS "nombre" FROM MATERIALFORMACION`),
      cargarCat(`SELECT btrim((RECURSOSDIDACTICOSNOMBRE)::text) AS "nombre" FROM RECURSOSDIDACTICOS`),
      cargarCat(`SELECT btrim((GESTIONCONOCIMIENTONOMBRE)::text) AS "nombre" FROM GESTIONCONOCIMIENTO`),
      cargarCat(`SELECT btrim((UTACTIVIDADESNOMBRE)::text) AS "nombre" FROM UTACTIVIDADES WHERE UTACTIVIDADESESTADO = 1`),
      cargarCat(`SELECT btrim((DEPARTAMENTONOMBRE)::text) AS "nombre" FROM DEPARTAMENTO`),
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
      // el Excel trae "1234 - Nombre"
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

    // validaciones de basicos, generalidades y contactos
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
    for (const d of data.diagnosticos) {
      const largo = mensajeHerrOtraLarga(d.otraHerramienta?.trim())
      if (largo) validaciones.push({ nivel: 'error', campo: `Diagnóstico ${d.numero}`, mensaje: largo })
    }

    // validaciones por AF
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

    // validaciones del presupuesto
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

    // empresa por NIT
    const nit = data.basicos.nit?.trim()
    if (!nit) {
      validaciones.push({ nivel: 'error', campo: 'NIT', mensaje: 'El Excel no trae NIT' })
    }
    let empresa: PreviewEmpresa = { estado: 'nueva', nit, razonSocial: data.basicos.razonSocial }
    // EMPRESAIDENTIFICACION es NUMBER: un NIT con puntos rompe el bind (NJS-105)
    const nitNum = Number((nit ?? '').replace(/\D/g, ''))
    if (nit && Number.isFinite(nitNum) && nitNum > 0) {
      const e = await this.dataSource.query(
        `SELECT EMPRESAID                  AS "id",
                btrim((EMPRESARAZONSOCIAL)::text)   AS "rs",
                btrim((EMPRESASIGLA)::text)         AS "sigla",
                btrim((EMPRESADIRECCION)::text)     AS "dir",
                btrim((EMPRESACELULAR)::text)       AS "cel",
                btrim((EMPRESAEMAIL)::text)         AS "email"
           FROM EMPRESA
          WHERE EMPRESAIDENTIFICACION = $1
 LIMIT 1`,
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
    // los textos de la empresa van a EMPRESA si es nueva, o si es existente y al confirmar se piden actualizar sus datos
    for (const d of datosEmpresaQueNoCaben(data.basicos)) {
      validaciones.push(empresa.estado === 'nueva'
        ? { nivel: 'error', campo: d.campo, mensaje: `Admite hasta ${d.tope} caracteres y trae ${d.largo}. Acórtelo en el Excel.` }
        : {
            nivel: 'warning',
            campo: d.campo,
            mensaje: `Admite hasta ${d.tope} caracteres y trae ${d.largo}: si al confirmar se actualizan los datos de la empresa, la importación se rechazará.`,
          })
    }

    // usuario por email
    const email = data.basicos.email?.trim().toLowerCase() ?? ''
    let usuario: PreviewUsuario = { email, estado: 'nuevo' }
    if (email) {
      const u = await this.dataSource.query(
        `SELECT USUARIOID AS "id" FROM USUARIO WHERE LOWER(USUARIOEMAIL) = $1 LIMIT 1`,
        [email],
      )
      if (u[0]) usuario = { email, estado: 'existente', usuarioIdExistente: Number(u[0].id) }
    } else {
      validaciones.push({ nivel: 'error', campo: 'CORREO ELECTRÓNICO', mensaje: 'El Excel no trae correo de la empresa' })
    }

    // validaciones cruzadas
    if (data.afs.length === 0) {
      validaciones.push({ nivel: 'error', mensaje: 'No hay Acciones de Formación en el Excel' })
    }
    if (data.afs.length !== data.presupuesto.numeroAFs) {
      validaciones.push({
        nivel: 'warning',
        mensaje: `Datos_Presupuesto declara ${data.presupuesto.numeroAFs} AFs pero hay ${data.afs.length} en Datos_AF`,
      })
    }
    // el cofin SENA del Excel ya incluye GO: se excluyen R09 y R015 de la suma
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
    // EMPRESAIDENTIFICACION y EMPRESADIGITOVERIFICACION son NUMBER: solo digitos
    const nitNum = Number((nit ?? '').replace(/\D/g, ''))
    if (!Number.isFinite(nitNum) || nitNum <= 0) {
      throw new BadRequestException(`El NIT "${nit}" no es un número válido`)
    }
    const dvNum = Number(String(data.basicos.digitoVerificacion ?? '').replace(/\D/g, '') || '0')

    // NECESIDADHERROTRA mide 40 bytes en el Exadata: mejor un 400 ahora que un ORA-12899 a mitad de la importación
    for (const d of data.diagnosticos) {
      const largo = mensajeHerrOtraLarga(d.otraHerramienta?.trim())
      if (largo) throw new BadRequestException(`Diagnóstico ${d.numero} del Excel: ${largo}`)
    }
    // los textos de EMPRESA solo se escriben si la empresa es nueva o si se piden actualizar sus datos: se revisan en el
    // paso 1, antes de escribir nada, para responder un 400 en vez de un ORA-12899 a mitad de la importación
    const noCaben = datosEmpresaQueNoCaben(data.basicos)
    const exigirQueQuepanDatosEmpresa = () => {
      if (noCaben.length === 0) return
      const detalle = noCaben.map(d => `${d.campo} admite hasta ${d.tope} caracteres y trae ${d.largo}`).join('; ')
      throw new BadRequestException(`Datos básicos del Excel que no caben: ${detalle}.`)
    }

    // el año se usa en el nombre del proyecto
    const conv: Array<{ anio: number }> = await this.dataSource.query(
      `SELECT CONVOCATORIAANIO AS "anio" FROM CONVOCATORIA WHERE CONVOCATORIAID = $1`,
      [dto.convocatoriaId],
    )
    if (!conv[0]) throw new NotFoundException('Convocatoria no encontrada')
    const anioConvocatoria = Number(conv[0].anio)

    const modsCat: Array<{ id: number; nombre: string }> = await this.dataSource.query(
      `SELECT MODALIDADID AS "id", btrim((UPPER(MODALIDADNOMBRE))::text) AS "nombre"
         FROM MODALIDAD WHERE MODALIDADESTADO = 1`,
    )
    const modProy = matchModalidad(data.basicos.modalidadParticipacion ?? '', modsCat)

    const qr = this.dataSource.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      // 1. empresa
      const empresaExistente: Array<{ id: number }> = await qr.query(
        `SELECT EMPRESAID AS "id" FROM EMPRESA WHERE EMPRESAIDENTIFICACION = $1 LIMIT 1`,
        [nitNum],
      )
      let empresaId: number
      if (empresaExistente[0]) {
        empresaId = Number(empresaExistente[0].id)
        if (dto.actualizarDatosEmpresa) {
          exigirQueQuepanDatosEmpresa()
          await qr.query(
            `UPDATE EMPRESA SET
                EMPRESARAZONSOCIAL = $1, EMPRESASIGLA = $2, EMPRESADIRECCION = $3,
                EMPRESACELULAR = $4, EMPRESATELEFONO = $5, EMPRESAWEBSITE = $6,
                EMPRESAEMAIL = $7
              WHERE EMPRESAID = $8`,
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
        exigirQueQuepanDatosEmpresa()
        // los ids salen de insertarConId: en el Exadata los pone el trigger de id (pisa el que se mande) y las filas
        // hijas usan el que quedó en la fila. Los 1 fijos son defaults para columnas NOT NULL
        empresaId = await insertarConId(qr, 'EMPRESA', 'EMPRESAID', { secuencia: 'EMPRESAID' }, {
          TIPODOCUMENTOIDENTIDADID: 1,
          EMPRESAIDENTIFICACION: nitNum,
          EMPRESADIGITOVERIFICACION: dvNum,
          EMPRESARAZONSOCIAL: data.basicos.razonSocial.trim(),
          EMPRESASIGLA: (data.basicos.sigla ?? '').trim(),
          EMPRESAEMAIL: email,
          EMPRESAFECHAREGISTRO: sqlCrudo(AHORA_UTC),
          EMPRESADIRECCION: (data.basicos.direccionDomicilio ?? '').trim(),
          EMPRESACELULAR: (data.basicos.celular ?? '').trim(),
          EMPRESATELEFONO: (data.basicos.telefono ?? '').trim(),
          EMPRESAWEBSITE: (data.basicos.paginaWeb ?? '').trim(),
          COBERTURAEMPRESAID: 1, DEPARTAMENTOEMPRESAID: 1, CIUDADEMPRESAID: 1, CIIUID: 1,
          TIPOEMPRESAID: 1, TAMANOEMPRESAID: 1, SECTORID: 1, SUBSECTORID: 1, TIPOIDENTIFICACIONREP: 1,
        })
      }

      // 2. usuario + USUARIOPERFIL
      const usuarioExistente: Array<{ id: number }> = await qr.query(
        `SELECT USUARIOID AS "id" FROM USUARIO WHERE LOWER(USUARIOEMAIL) = $1 LIMIT 1`,
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
        usuarioId = await insertarConId(qr, 'USUARIO', 'USUARIOID', { secuencia: 'USUARIOID' }, {
          PERFILID: 7,
          USUARIOCLAVE: claveCifrada,
          USUARIOFECHAREGISTRO: sqlCrudo(AHORA_UTC),
          USUARIOESTADO: 1,
          USUARIOTIPO: 2,
          USUARIOEMAIL: email,
          USUARIOLLAVEENCRIPTACION: llave,
        })
        await qr.query(
          `INSERT INTO USUARIOPERFIL
             (USUARIOPERFILID, USUARIOID, PERFILID, PREDETERMINADO, ESTADO, FECHACREACION)
           VALUES (USUARIOPERFIL_SEQ.NEXTVAL, $1, 7, 1, 1, ${AHORA_UTC})`,
          [usuarioId],
        )
      }

      // 3. proyecto — entra en estado 0 (borrador)
      const codSeg = crypto.randomBytes(12).toString('hex').toUpperCase()
      const modalidadId = modProy?.id ?? dto.modalidadProyectoId ?? 1
      const sigla = (data.basicos.sigla ?? '').trim() || data.basicos.razonSocial.trim().slice(0, 30)
      const proyectoNombre = `${sigla}-FCE-${anioConvocatoria}`.slice(0, 100)
      const proyectoId = await insertarConId(qr, 'PROYECTO', 'PROYECTOID', { secuencia: 'PROYECTOID' }, {
        EMPRESAID: empresaId,
        PROYECTONOMBRE: proyectoNombre,
        PROYECTOOBJETIVO: data.generalidades.objetivoProyecto?.trim() ?? null,
        CONVOCATORIAID: dto.convocatoriaId,
        MODALIDADID: modalidadId,
        PROYECTOCODSEGURIDAD: codSeg,
        PROYECTOFECHAREGISTRO: sqlCrudo(AHORA_UTC),
        PROYECTOESTADO: 0,
      })

      // 4. contactos: los cargos salen del listado oficial del SEP
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
           VALUES ($1, $2, $3, $4, $5, $6, 1, $7)`,
          [empresaId, c.nombre.trim(), c.cargo, c.email.trim(),
           c.telefono.trim() || null, c.id.trim() || null, proyectoId],
        )
      }

      // 4.5 diagnosticos (NECESIDAD) y necesidades de formacion (NECESIDADFORMACION)
      const necFormIdPor = new Map<string, number>()  // "diag-nec" → necesidadFormacionId
      const necesidadIdPorDiag = new Map<number, number>()
      let necesidadesCreadas = 0
      let necFormCreadas = 0
      let herramientasCreadas = 0

      const fuentesHerr: Array<{ id: number; nombre: string }> = await qr.query(
        `SELECT FUENTEHERRAMIENTAID AS "id",
                btrim((UPPER(FUENTEHERRAMIENTANOMBRE))::text) AS "nombre"
           FROM FUENTEHERRAMIENTA`,
      )
      const findFuente = (nombre: string): number | null => {
        const n = (nombre ?? '').trim().toUpperCase()
        return fuentesHerr.find(f => f.nombre === n)?.id ?? null
      }

      // el Excel trae "DD/MM/YYYY" o un serial; Oracle TO_DATE necesita ISO
      const toIsoDate = (v: string | null): string | null => {
        if (!v) return null
        const s = v.trim()
        // serial de Excel: dias desde 1900
        if (/^\d{4,6}(\.\d+)?$/.test(s)) {
          const serial = Number(s)
          const d = new Date(Math.round((serial - 25569) * 86400 * 1000))
          if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
        }
        const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
        if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
        return null
      }

      for (const diag of data.diagnosticos) {
        const necId = await insertarConId(qr, 'NECESIDAD', 'NECESIDADID', { secuencia: 'NECESIDADID' }, {
          EMPRESANECESIDADID: empresaId,
          NECESIDADFECHAREGISTRO: sqlCrudo(AHORA_UTC),
          USUREGISTRONECESIDAD: usuarioId,
        })
        necesidadIdPorDiag.set(diag.numero, necId)
        necesidadesCreadas++

        const isoFecha = toIsoDate(diag.fecha)
        const esCreacionPropia = (diag.herramientaPropia ?? '').trim().toUpperCase().startsWith('SI') ? 1 : 0
        const tienePlanCapa    = (diag.planCapacitacion  ?? '').trim().toUpperCase().startsWith('SI') ? 1 : 0
        await qr.query(
          `UPDATE NECESIDAD
              SET NECESIDADPERIODOI = ${isoFecha ? "TO_DATE(:1, 'YYYY-MM-DD')" : 'NULL'},
                  NECESIDADHERRCREACION = $2,
                  NECESIDADHERROTRA = $3,
                  NECESIDADHERRDESCRIP = $4,
                  NECESIDADHERRRESULTADOS = $5,
                  NECESIDADPLANCAPA = $6
            WHERE NECESIDADID = $7`,
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

        for (const h of diag.herramientas) {
          const fuenteId = findFuente(h.nombre)
          if (!fuenteId) {
            // noResueltos todavia no existe en este punto: la herramienta se omite
            continue
          }
          await insertarConId(
            qr, 'HERRAMIENTANECESIDAD', 'HERRAMIENTANECESIDADID', { secuencia: 'HERRAMIENTANECESIDADID' },
            {
              NECESIDADID: necId,
              FUENTEHERRAMIENTAID: fuenteId,
              HERRAMIENTANECESIDADPARTICIP: Number(h.muestra) || 0,
              HERRAMIENTANECESIDADOTRA: ' ',
              USUREGISTROHERRAMIENTA: usuarioId,
              HERRAMIENTANECESIDADFECHAREG: sqlCrudo(AHORA_UTC),
            },
          )
          herramientasCreadas++
        }
      }

      for (const nec of data.necesidades) {
        const necesidadId = necesidadIdPorDiag.get(nec.numeroDiagnostico)
        if (!necesidadId) continue
        const necFormId = await insertarConId(
          qr, 'NECESIDADFORMACION', 'NECESIDADFORMACIONID', { secuencia: 'NECESIDADFORMACIONID' },
          {
            NECESIDADID: necesidadId,
            NECESIDADFORMACIONNUMERO: nec.numeroNecesidad,
            NECESIDADFORMACIONNOMBRE: (nec.necesidad ?? '').trim().slice(0, 4000),
            NECESIDADFORMACIONBENEF: nec.numeroBeneficiarios ?? 0,
            USUREGISTRONECESIDADFORMACION: usuarioId,
            NECESIDADFORMACIONFECHAREGISTR: sqlCrudo(AHORA_UTC),
          },
        )
        necFormIdPor.set(`${nec.numeroDiagnostico}-${nec.numeroNecesidad}`, necFormId)
        necFormCreadas++
      }

      // 5. catalogos: lo que no resuelve queda en noResueltos y lo completa el admin
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
        cargarMap(`SELECT AREAFUNCIONALID AS "id", btrim((UPPER(AREAFUNCIONALNOMBRE))::text) AS "nombre" FROM AREAFUNCIONAL WHERE AREAFUNCIONALESTADO = 1`),
        cargarMap(`SELECT NIVELOCUPACIONALID AS "id", btrim((UPPER(NIVELOCUPACIONALNOMBRE))::text) AS "nombre" FROM NIVELOCUPACIONAL WHERE NIVELOCUPACIONALESTADO = 1`),
        cargarMap(`SELECT OCUPACIONCUOCID AS "id", btrim((UPPER(OCUPACIONCUOCNOMBRE))::text) AS "nombre" FROM OCUPACIONCUOC WHERE OCUPACIONCUOCESTADO = 1`),
        cargarMap(`SELECT SECTORID AS "id", btrim((UPPER(SECTORDESCRIPCION))::text) AS "nombre" FROM SECTOR`),
        cargarMap(`SELECT SUBSECTORID AS "id", btrim((UPPER(SUBSECTORNOMBRE))::text) AS "nombre" FROM SUBSECTOR`),
        cargarMap(`SELECT TIPOAMBIENTEID AS "id", btrim((UPPER(TIPOAMBIENTENOMBRE))::text) AS "nombre" FROM TIPOAMBIENTE`),
        cargarMap(`SELECT MATERIALFORMACIONID AS "id", btrim((UPPER(MATERIALFORMACIONNOMBRE))::text) AS "nombre" FROM MATERIALFORMACION`),
        cargarMap(`SELECT RECURSOSDIDACTICOSID AS "id", btrim((UPPER(RECURSOSDIDACTICOSNOMBRE))::text) AS "nombre" FROM RECURSOSDIDACTICOS`),
        cargarMap(`SELECT GESTIONCONOCIMIENTOID AS "id", btrim((UPPER(GESTIONCONOCIMIENTONOMBRE))::text) AS "nombre" FROM GESTIONCONOCIMIENTO`),
        cargarMap(`SELECT DEPARTAMENTOID AS "id", btrim((UPPER(DEPARTAMENTONOMBRE))::text) AS "nombre" FROM DEPARTAMENTO`),
        cargarMap(`SELECT UTACTIVIDADESID AS "id", btrim((UPPER(UTACTIVIDADESNOMBRE))::text) AS "nombre" FROM UTACTIVIDADES WHERE UTACTIVIDADESESTADO = 1`),
        cargarMap(`SELECT ARTICULACIONTERRITORIALID AS "id", btrim((UPPER(ARTICULACIONTERRITORIALNOMBRE))::text) AS "nombre" FROM ARTICULACIONTERRITORIAL WHERE ARTICULACIONTERRITORIALESTADO = 1`),
        cargarMap(`SELECT AFENFOQUEID AS "id", btrim((UPPER(AFENFOQUENOMBRE))::text) AS "nombre" FROM AFENFOQUE WHERE AFENFOQUEESTADO = 1`),
        cargarMap(`SELECT METODOLOGIAAPRENDIZAJEID AS "id", btrim((UPPER(METODOLOGIAAPRENDIZAJENOMBRE))::text) AS "nombre" FROM METODOLOGIAAPRENDIZAJE WHERE METODOLOGIAAPRENDIZAJEESTADO = 1`),
        cargarMap(`SELECT AFCOMPONENTEID AS "id", btrim((UPPER(AFCOMPONENTENOMBRE))::text) AS "nombre" FROM AFCOMPONENTE WHERE AFCOMPONENTEESTADO IS NULL OR AFCOMPONENTEESTADO = 1`),
        qr.query(`SELECT TIPOEVENTOID AS "id", btrim((UPPER(TIPOEVENTONOMBRE))::text) AS "nombre" FROM TIPOEVENTO WHERE TIPOEVENTOACTIVO = 1`),
        qr.query(`SELECT MODALIDADFORMACIONID AS "id", btrim((UPPER(MODALIDADFORMACIONNOMBRE))::text) AS "nombre" FROM MODALIDADFORMACION WHERE MODALIDADFORMACIONACTIVO = 1`),
      ])
      const tiposEvento = tiposEventoMap as Array<{ id: number; nombre: string }>
      const modsForm    = modsFormCat    as Array<{ id: number; nombre: string }>

      const rubrosConv: Array<{ id: number; codigo: string; nombre: string }> = await qr.query(
        `SELECT RUBROID AS "id",
                btrim((UPPER(RUBROCODIGO))::text) AS "codigo",
                btrim((UPPER(RUBRONOMBRE))::text) AS "nombre"
           FROM RUBRO WHERE CONVOCATORIAIDRUBRO = $1`,
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
        for (const [catKey, id] of cat) {
          if (catKey.length < 6) continue
          if (catKey.includes(k) || k.includes(catKey)) return id
        }
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
        nombre ? matchModalidad(nombre, tiposEvento)?.id ?? null : null
      const findModalidad = (nombre: string | null) =>
        nombre ? this.matchModalidadFormacion(nombre, modsForm)?.id ?? null : null

      // id del registro "Otra"/"Otro", el fallback cuando el valor no esta en el catalogo
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

      // 6. AFs + sub-tablas
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
        const benefTot  = (benefPres + benefSinc) * (numGrupos || 1)
        const totHoras  = horasGrupo * (numGrupos || 1)

        // se concatenan con salto de linea para que el editor del proyecto vivo los separe
        const resDesem = af.impactosTrabajador.filter(Boolean).join('\n').trim() || null
        const resForm  = af.impactosProductividad.filter(Boolean).join('\n').trim() || null

        // el nombre del AFCOMPONENTE viene en la col "ALINEACIÓN DE LA ACCIÓN DE FORMACIÓN"
        const componenteId = findInMap(afComponenteCat, af.descripcionAlineacion)
        if (af.descripcionAlineacion && !componenteId) {
          // sin lookup: el texto queda en COMPOD y el admin lo elige despues
        }

        const necFormKey = `${af.codigoDiagnostico ?? ''}-${af.codigoNecesidad ?? ''}`
        const necFormIdAf = necFormIdPor.get(necFormKey) ?? null

        const afId = await insertarConId(qr, 'ACCIONFORMACION', 'ACCIONFORMACIONID', { secuencia: 'ACCIONFORMACIONID' }, {
          PROYECTOID: proyectoId,
          ACCIONFORMACIONNUMERO: af.consecutivo,
          ACCIONFORMACIONNOMBRE: (af.nombre ?? '').trim().slice(0, 500),
          NECESIDADFORMACIONIDAF: necFormIdAf,
          ACCIONFORMACIONJUSTNEC: af.diagnostico?.trim() ?? null,
          ACCIONFORMACIONCAUSA: af.causasEfectos?.trim() ?? null,
          ACCIONFORMACIONRESULTADOS: af.efectos?.trim() ?? null,
          ACCIONFORMACIONOBJETIVO: af.objetivos?.trim() ?? null,
          TIPOEVENTOID: tipoEventoId,
          MODALIDADFORMACIONID: modFormId,
          METODOLOGIAAPRENDIZAJEID: metodologiaId,
          ACCIONFORMACIONNUMHORAGRUPO: horasGrupo || null,
          ACCIONFORMACIONNUMGRUPOS: numGrupos || null,
          ACCIONFORMACIONNUMTOTHORASGRUP: totHoras || null,
          ACCIONFORMACIONBENEFGRUPO: benefPres || null,
          ACCIONFORMACIONBENEFVIGRUPO: benefSinc || null,
          ACCIONFORMACIONNUMBENEF: benefTot || null,
          AFENFOQUEID: enfoqueId,
          ACCIONFORMACIONAREAFUN: af.justificacionAreas?.trim() ?? null,
          ACCIONFORMACIONNIVELOCUPD: af.justificacionNiveles?.trim() ?? null,
          ACCIONFORMACIONMUJER: af.trabajadoresMujeres ?? null,
          ACCIONFORMACIONNUMCAMPESINO: af.trabajadoresCampesinos ?? null,
          ACCIONFORMACIONJUSTCAMPESINO: af.trabajadoresCampesinosTexto?.trim() ?? null,
          ACCIONFORMACIONNUMPOPULAR: af.trabajadoresPopular ?? null,
          ACCIONFORMACIONJUSTPOPULAR: af.trabajadoresPopularTexto?.trim() ?? null,
          ACCIONFORMACIONTRABDISCAPAC: af.trabajadoresDiscapacidad ?? null,
          ACCIONFORMACIONTRABAJADORBIC: af.empresasBic ?? null,
          ACCIONFORMACIONMIPYMES: af.mipymesEmpresas ?? null,
          ACCIONFORMACIONTRABMIPYMES: af.mipymesTrabajadores ?? null,
          ACCIONFORMACIONMIPYMESD: af.justificacionMipymes?.trim() ?? null,
          ACCIONFORMACIONCADENAPROD: af.cadenaEmpresas ?? null,
          ACCIONFORMACIONTRABCADPROD: af.cadenaTrabajadores ?? null,
          ACCIONFORMACIONCADENAPRODD: af.justificacionCadena?.trim() ?? null,
          ACCIONFORMACIONSECSUBD: af.justificacionSectores?.trim() ?? null,
          // COMPOD = justificacion de la alineacion; JUSTIFICACION = AF especializada
          ACCIONFORMACIONCOMPONENTEID: componenteId,
          ACCIONFORMACIONCOMPOD: af.justificacionAlineacion?.trim() ?? null,
          ACCIONFORMACIONJUSTIFICACION: af.justificacionEspecializada?.trim() ?? null,
          ACCIONFORMACIONRESDESEM: resDesem,
          ACCIONFORMACIONRESFORM: resForm,
          TIPOAMBIENTEID: ambienteId,
          ACCIONFORMACIONJUSTMAT: af.justificacionSiAplica?.trim() ?? null,
          ACCIONFORMACIONINSUMO: af.insumos?.trim() ?? null,
          ACCIONFORMACIONJUSTINSUMO: af.justificacionInsumo?.trim() ?? null,
          ACCIONFORMACIONFECHAREGISTRO: sqlCrudo(AHORA_UTC),
        })
        if (af.descripcionAlineacion && !componenteId) {
          noResueltos.componente = noResueltos.componente ?? new Set()
          noResueltos.componente.add(af.descripcionAlineacion)
        }
        afIdsPorConsecutivo.set(af.consecutivo, afId)
        afsCreadas++

        // areas funcionales: si no esta en el catalogo va como "Otra" + AFAREAFUNCIONALOTRO
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
          await insertarConId(qr, 'AFAREAFUNCIONAL', 'AFAREAFUNCIONALID', { maxMasUno: true }, {
            ACCIONFORMACIONIDAF: afId, AREAFUNCIONALIDAF: aid, AFAREAFUNCIONALOTRO: textoOtro,
          })
          areasCreadas++
        }

        // niveles ocupacionales
        for (const n of af.niveles) {
          const nid2 = findInMap(nivelesCat, n)
          if (!nid2) { noResueltos.niveles.add(n); continue }
          await insertarConId(qr, 'AFNIVELOCUPACIONAL', 'AFNIVELOCUPACIONALID', { maxMasUno: true }, {
            ACCIONFORMACIONID: afId, NIVELOCUPACIONALIDAF: nid2,
          })
          nivelesCreados++
        }

        // CUOC: el Excel viene "1234 - Nombre"
        for (const c of af.ocupacionesCuoc) {
          let cid = findInMap(cuocCat, c)
          if (!cid) {
            const idxDash = c.indexOf('-')
            if (idxDash >= 0) cid = findInMap(cuocCat, c.slice(idxDash + 1))
          }
          if (!cid) { noResueltos.cuoc.add(c); continue }
          await insertarConId(qr, 'OCUPACIONCOUCAF', 'OCUPACIONCOUCAFID', { maxMasUno: true }, {
            ACCIONFORMACIONID: afId, OCUPACIONCUOCID: cid,
          })
          cuocCreados++
        }

        // sectores a los que pertenecen los beneficiarios (AFPSECTOR/AFPSUBSECTOR)
        for (const s of af.sectoresPertenecen) {
          const sid = findInMap(sectoresCat, s)
          if (!sid) { noResueltos.sectoresPert.add(s); continue }
          await insertarConId(qr, 'AFPSECTOR', 'AFPSECTORID', { maxMasUno: true }, {
            ACCIONFORMACIONID: afId, SECTORAFID: sid, AFPSECTORESTADO: 1,
          })
          sectoresCreados++
        }
        for (const s of af.subsectoresPertenecen) {
          const sid = findInMap(subsectoresCat, s)
          if (!sid) { noResueltos.subsectoresPert.add(s); continue }
          await insertarConId(qr, 'AFPSUBSECTOR', 'AFPSUBSECTORID', { maxMasUno: true }, {
            ACCIONFORMACIONID: afId, SUBSECTORAFID: sid, AFPSUBSECTORESTADO: 1,
          })
          subsectoresCreados++
        }

        // sectores que la AF beneficia (AFSECTOR/AFSUBSECTOR)
        for (const s of af.sectoresBeneficia) {
          const sid = findInMap(sectoresCat, s)
          if (!sid) { noResueltos.sectoresBenef.add(s); continue }
          await insertarConId(qr, 'AFSECTOR', 'AFSECTORID', { maxMasUno: true }, {
            ACCIONFORMACIONID: afId, SECTORAFID: sid,
          })
          sectoresCreados++
        }
        for (const s of af.subsectoresBeneficia) {
          const sid = findInMap(subsectoresCat, s)
          if (!sid) { noResueltos.subsectoresBenef.add(s); continue }
          await insertarConId(qr, 'AFSUBSECTOR', 'AFSUBSECTORID', { maxMasUno: true }, {
            ACCIONFORMACIONID: afId, SUBSECTORAFID: sid,
          })
          subsectoresCreados++
        }

        // gestion del conocimiento: el Excel trae un solo valor
        if (af.gestionConocimiento) {
          const gid = findInMap(gestionCat, af.gestionConocimiento)
          if (gid) {
            await insertarConId(qr, 'AFGESTIONCONOCIMIENTO', 'AFGESTIONCONOCIMIENTOID', { maxMasUno: true }, {
              ACCIONFORMACIONID: afId, GESTIONCONOCIMIENTOID: gid,
            })
          } else {
            noResueltos.gestion.add(af.gestionConocimiento)
          }
        }

        // material de formacion
        if (af.material) {
          const mid = findInMap(materialesCat, af.material)
          if (mid) {
            await insertarConId(qr, 'MATERIALFORMACIONAF', 'MATERIALFORMACIONAFID', { maxMasUno: true }, {
              ACCIONFORMACIONID: afId, MATERIALFORMACIONID: mid,
            })
          } else {
            noResueltos.materiales.add(af.material)
          }
        }

        // recursos didacticos: el Excel trae uno solo
        if (af.recursosDidacticos) {
          const rid = findInMap(recursosCat, af.recursosDidacticos)
          if (rid) {
            await insertarConId(qr, 'RECURSOSDIDACTICOSAF', 'RECURSOSDIDACTICOSAFID', { maxMasUno: true }, {
              ACCIONFORMACIONID: afId, RECURSOSDIDACTICOSID: rid,
            })
            recursosCreados++
          } else {
            noResueltos.recursos.add(af.recursosDidacticos)
          }
        }

        // grupos de cobertura + AFGRUPOCOBERTURA
        const covAf = data.cobertura.filter(c => Number(c.numeroAF) === Number(af.consecutivo))
        for (let i = 0; i < covAf.length; i++) {
          const cov = covAf[i]
          const grupoNumero = (cov.numeroGrupo && cov.numeroGrupo > 0) ? cov.numeroGrupo : (i + 1)
          const grupoId = await insertarConId(qr, 'AFGRUPO', 'AFGRUPOID', { maxMasUno: true }, {
            ACCIONFORMACIONID: afId, AFGRUPONUMERO: grupoNumero, AFGRUPOJUSTIFICACION: cov.justificacion?.trim() ?? null,
          })
          gruposCreados++

          if (cov.departamentoPresencial) {
            const did = findInMap(departamentosCat, cov.departamentoPresencial)
            if (!did) {
              noResueltos.departamentos.add(cov.departamentoPresencial)
            } else {
              let ciudadId: number | null = null
              if (cov.ciudadPresencial) {
                const ciu: Array<{ id: number }> = await qr.query(
                  `SELECT CIUDADID AS "id" FROM CIUDAD
                    WHERE DEPARTAMENTOID = $1 AND btrim((UPPER(CIUDADNOMBRE))::text) = $2 LIMIT 1`,
                  [did, norm(cov.ciudadPresencial)],
                )
                if (ciu[0]) ciudadId = Number(ciu[0].id)
              }
              await insertarConId(qr, 'AFGRUPOCOBERTURA', 'AFGRUPOCOBERTURAID', { maxMasUno: true }, {
                AFGRUPOID: grupoId, DEPARTAMENTOGRUPOID: did, CIUDADGRUPOID: ciudadId,
                AFGRUPOCOBERTURABENEF: cov.beneficiariosPresencial ?? 0, AFGRUPOFILTRO: afId,
                AFGRUPOCOBERTURAMOD: 'P', AFGRUPOCOBERTURARURAL: 0,
              })
              coberturasCreadas++
            }
          }

          // AFGRUPOCOBERTURAMOD: 'V' si la modalidad es virtual (4), 'S' en el resto
          const modSecundario = modFormId === 4 ? 'V' : 'S'
          for (const d of cov.departamentos) {
            const did = findInMap(departamentosCat, d.departamento)
            if (!did) { noResueltos.departamentos.add(d.departamento); continue }
            await insertarConId(qr, 'AFGRUPOCOBERTURA', 'AFGRUPOCOBERTURAID', { maxMasUno: true }, {
              AFGRUPOID: grupoId, DEPARTAMENTOGRUPOID: did, CIUDADGRUPOID: null,
              AFGRUPOCOBERTURABENEF: d.beneficiarios, AFGRUPOFILTRO: afId,
              AFGRUPOCOBERTURAMOD: modSecundario, AFGRUPOCOBERTURARURAL: 0,
            })
            coberturasCreadas++
          }
        }

        // UTs + actividades + perfiles
        const utsAf = data.uts.filter(u => Number(u.numeroAF) === Number(af.consecutivo))
        for (const ut of utsAf) {
          // las horas van a la columna de la modalidad de la AF
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
          // el Excel solo trae el texto de la articulacion territorial
          let articulacionId: number | null = null
          if (ut.esArticulacionTerritorial && ut.articulacionTerritorial) {
            articulacionId = findInMap(articulacionTerrCat, ut.articulacionTerritorial)
            if (!articulacionId) noResueltos.articulacionTerritorial.add(ut.articulacionTerritorial)
          }

          const utId = await insertarConId(qr, 'UNIDADTEMATICA', 'UNIDADTEMATICAID', { maxMasUno: true }, {
            PROYECTOIDUT: proyectoId,
            ACCIONFORMACIONID: afId,
            UNIDADTEMATICANUMERO: ut.numeroUT,
            UNIDADTEMATICANOMBRE: (ut.nombre ?? '').trim().slice(0, 500),
            UNIDADTEMATICACOMPETENCIAS: ut.competencia?.trim() ?? null,
            UNIDADTEMATICACONTENIDO: ut.contenido?.trim() ?? null,
            UNIDADTEMATICAJUSTACTIVIDAD: ut.descripcionActividad?.trim() ?? null,
            UNIDADTEMATICAHORASPP: horas.pp, UNIDADTEMATICAHORASPV: horas.pv,
            UNIDADTEMATICAHORASPPAT: horas.ppat, UNIDADTEMATICAHORASPHIB: horas.phib,
            UNIDADTEMATICAHORASTP: horas.tp, UNIDADTEMATICAHORASTV: horas.tv,
            UNIDADTEMATICAHORASTPAT: horas.tpat, UNIDADTEMATICAHORASTHIB: horas.thib,
            UNIDADTEMATICAESTRANSVERSAL: ut.esArticulacionTerritorial ? 1 : 0,
            ARTICULACIONTERRITORIALID: articulacionId,
            UNIDADTEMATICAFECHAREGISTRO: sqlCrudo(AHORA_UTC),
          })
          utsCreadas++

          // si la actividad no esta en el catalogo va como "Otra" + ACTIVIDADUTOTRO
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
            await insertarConId(qr, 'ACTIVIDADUT', 'ACTIVIDADUTID', { maxMasUno: true }, {
              UNIDADTEMATICAID: utId, UTACTIVIDADESID: aid, ACTIVIDADUTOTRO: textoOtro,
            })
            actividadesCreadas++
          }

          // el perfil del capacitador se resuelve como rubro, por nombre
          for (const p of ut.perfiles) {
            if (!p.perfil) continue
            const rubroId = findRubro(p.perfil, p.perfil)
            if (!rubroId) {
              rubrosNoEncontrados.add(`${p.perfil} (UT${ut.numeroUT}, AF ${af.consecutivo})`)
              continue
            }
            await insertarConId(qr, 'PERFILUT', 'PERFILUTID', { maxMasUno: true }, {
              UNIDADTEMATICAID: utId, RUBROIDUT: rubroId, PERFILUTHORASCAP: p.horas ?? 0,
              PERFILUTFECHAREGISTRO: sqlCrudo(AHORA_UTC),
            })
            perfilesCreados++
          }
        }

        // rubros de la AF
        const rubrosAf = data.rubros.filter(r => Number(r.numeroAF) === Number(af.consecutivo))
        for (const r of rubrosAf) {
          const rubroId = findRubro(r.idRubro, r.nombreRubro)
          if (!rubroId) {
            rubrosNoEncontrados.add(`${r.idRubro || r.nombreRubro} (AF ${af.consecutivo})`)
            continue
          }
          const total = r.totalRubro ?? 0
          const cof   = r.cofinanciacionSena ?? 0
          const esp   = r.contrapartidaEspecie ?? 0
          const din   = r.contrapartidaDinero ?? 0
          const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0
          await insertarConId(qr, 'AFRUBRO', 'AFRUBROID', { maxMasUno: true }, {
            PROYECTOIDRUBROAF: proyectoId,
            ACCIONFORMACIONID: afId,
            RUBROID: rubroId,
            AFRUBROJUSTIFICACION: (r.justificacion ?? '').trim().slice(0, 2000),
            AFRUBRONUMHORAS: r.numHoras ?? 0,
            AFRUBROCANTIDAD: r.numPaginasUnidades ?? 1,
            AFRUBROBENEFICIARIOS: r.numBeneficiarios ?? 0,
            AFRUBRODIAS: r.numDias ?? 0,
            AFRUBROVALOR: total,
            AFRUBROCOFINANCIACION: cof,
            AFRUBROESPECIE: esp,
            AFRUBRODINERO: din,
            AFRUBROVALORMAXIMO: r.valorMaximo ?? 0,
            AFRUBROVALORPORBENEFICIARIO: r.valorPorBeneficiarios ?? 0,
            AFRUBROPAQUETE: r.paquete ?? null,
            AFRUBROPORCENTAJECOFINANCIACION: pct(cof),
            AFRUBROPORCENTAJEESPECIE: pct(esp),
            AFRUBROPORCENTAJEDINERO: pct(din),
            AFRUBROFECHAREGISTRO: sqlCrudo(AHORA_UTC),
          })
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

  // parsers por hoja

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
      justificacionMipymes: this.str(r[35]),
      cadenaEmpresas:       this.num(r[36]),
      cadenaTrabajadores:   this.num(r[37]),
      justificacionCadena:  this.str(r[38]),
      trabajadoresMujeres:  this.num(r[39]),
      trabajadoresCampesinos: this.num(r[40]),
      trabajadoresDiscapacidad: this.num(r[41]),
      empresasBic:          this.num(r[42]),
      sectoresPertenecen:   [r[43], r[44], r[45], r[46], r[47]].map(x => this.str(x)).filter((x): x is string => x !== null),
      subsectoresPertenecen:[r[48], r[49], r[50], r[51], r[52]].map(x => this.str(x)).filter((x): x is string => x !== null),
      // en el Excel esta columna se llama CLASIFICACION POR SECTOR
      sectoresBeneficia:    [r[53], r[54], r[55], r[56], r[57]].map(x => this.str(x)).filter((x): x is string => x !== null),
      subsectoresBeneficia: [r[58], r[59], r[60], r[61], r[62]].map(x => this.str(x)).filter((x): x is string => x !== null),
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
      // solo entran las AFs marcadas "SI" para incluir en la formulacion
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
      // en el Excel esta columna se llama HABILIDAD TRANSVERSAL
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
        justificacion:             this.str(r[55]),
      }
    }).filter(c => c.numeroAF > 0)
  }
}
