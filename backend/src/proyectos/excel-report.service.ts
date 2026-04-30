import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import * as XLSX from 'xlsx'

// ──────────────────────────────────────────────────────────────────────────────
// Generador del reporte Excel oficial del proyecto a partir del snapshot de la
// versión marcada como FINAL.
//
// Estructura: 10 hojas en el orden EXACTO del template SENA. Los encabezados
// (incluyendo typos del template original como "ENEFICIARIOS",
// "BENEFICIOARIOS", "TRASFERENCIA", etc.) se conservan tal cual para que el
// archivo resultante sea procesable por los scripts Python downstream.
//
// Para columnas repetidas (AREA 1..5, OCUPACION CUOC 1..20, etc.) siempre se
// emiten todas las posiciones aunque solo se llene la primera, también para
// preservar el contrato con Python.
// ──────────────────────────────────────────────────────────────────────────────

// ── Encabezados (verbatim del template) ──────────────────────────────────────

const HEADERS_BASICOS = [
  'NÚMERO DE IDENTIFICACION', 'DÍGITO VERIFICACION', 'NOMBRE DE LA ENTIDAD PROPONENTE', 'SIGLA',
  'CORREO ELECTRÓNICO', 'DEPARTAMENTO DE DOMICILIO', 'CIUDAD/MUNICIPIO DE DOMICILIO',
  'DIRECCIÓN DE DOMICILIO', 'TELÉFONO', 'PÁGINA WEB', 'ACTIVIDAD ECONÓMICA DE ACUERDO CON EL RUT',
  'TIPO DE ORGANIZACIÓN', 'CERTIFICACIÓN DE COMPETENCIAS LABORALES', 'VINCULO EXPERTOS TECNICOS',
  'COBERTURA', 'CÓDIGO INDICATIVO', 'TAMANO EMPRESA', 'CELULAR',
  'MESA SECTORIAL 1', 'MESA SECTORIAL 2', 'MESA SECTORIAL 3',
  'MODALIDAD DE PARTICIPACIÓN', 'TIPO DE IDENTIFICACIÓN',
]

const HEADERS_CONTACTO = [
  'NÚMERO DE IDENTIFICACIÓN DEL REPRESENTANTE LEGAL', 'TIPO REPRESENTANTE LEGAL',
  'NOMBRE REPRESENTANTE LEGAL', 'EMAIL REPRESENTANTE LEGAL', 'TELÉFONO/CELULAR REPRESENTANTE LEGAL',
  'NÚMERO DE IDENTIFICACIÓN PRIMER CONTACTO', 'TIPO IDENTIFICACION PRIMER CONTACTO',
  'NOMBRE COMPLETO PRIMER CONTACTO', 'EMAIL PRIMER CONTACTO', 'TELÉFONO/CELULAR PRIMER CONTACTO',
  'TIPO IDENTIFICACION PERSONA QUE SUSTENTA PROYECTO', 'NUMERO IDENTIFICACION CONTACTO 2',
  'NOMBRE COMPLETO PERSONA QUE SUSTENTA PROYECTO', 'EMAIL PERSONA QUE SUSTENTA PROYECTO',
  'TELÉFONO/CELULAR PERSONA QUE SUSTENTA PROYECTO',
]

const HEADERS_GENERALIDADES = [
  'OBJETO SOCIAL DE LA EMPRESA / GREMIO',
  'PRODUCTOS Y / O SERVICIOS OFRECIDOS Y MERCADO AL QUE VAN DIRIGIDOS',
  'SITUACIÓN ACTUAL Y PROYECCIÓN DE LA EMPRESA / GREMIO',
  'PAPEL DE LA EMPRESA / GREMIO EN EL SECTOR(ES) Y/O REGIÓN QUE PERTENECE O REPRESENTA',
  'RETOS ESTRATÉGICOS DE LA EMPRESA / GREMIO, VINCULADOS A LA FORMACIÓN',
  'EXPERIENCIA DE LA EMPRESA/GREMIO EN ACTIVIDADES FORMATIVAS Y RETOS ESTRATÉGICOS DE LA EMPRESA/GREMIO, VINCULADOS A LA FORMACIÓN',
  'OBJETIVO GENERAL DEL PROYECTO',
  'SECTOR AL QUE PERTENECE', 'SUBSECTOR AL QUE PERTENECE',
  'SECTOR 1 AL QUE REPRESENTA', 'SECTOR 2 AL QUE REPRESENTA', 'SECTOR 3 AL QUE REPRESENTA',
  'SUB-SECTOR 1 AL QUE REPRESENTA', 'SUB-SECTOR 2 AL QUE REPRESENTA', 'SUB-SECTOR 3 AL QUE REPRESENTA',
  'IDENTIFICACIÓN DE LOS ESLABONES DE LA CADENA PRODUCTIVA EN LOS QUE PARTICIPA (ACTORES DE LA ECONOMÍA CAMPESINA Y/O POPULAR,  PRODUCTORES, PROVEEDORES, TRANSFORMADORES, LOGÍSTICA, DISTRIBUIDORES, COMERCIALIZADORES, SERVICIOS, CONSUMIDORES, ETC.) Y DEFINICI',
  'DESCRIPCIÓN DE LAS INTERACCIONES QUE MANTIENE CON OTROS ACTORES (EMPRESAS, ASOCIACIONES, INSTITUCIONES DE APOYO, UNIVERSIDADES, CENTROS DE INVESTIGACIÓN, ETC.).',
]

const HEADERS_NECESIDADESAF = [
  'NUMERO DE DIAGNOSTICO', 'NUMERO DE NECESIDAD', 'NECESIDAD', 'NUMERO DE BENEFICIARIOS',
]

const HEADERS_DIAGNOSTICO = [
  'NUMERO DIAGNOSTICO',
  'HERRAMIENTA 1', 'MUESTRA 1', 'HERRAMIENTA 2', 'MUESTRA 2',
  'HERRAMIENTA 3', 'MUESTRA 3', 'HERRAMIENTA 4', 'MUESTRA 4',
  'HERRAMIENTA 5', 'MUESTRA 5',
  'FECHA DE DIAGNOSTICO',
  'LA HERRAMIENTA ES DE CREACION PROPIA?',
  'OTRO TIPO DE HERRAMIENTA, CUAL?',
  'LA EMPRESA CUENTA CON UN PLAN DE CAPACITACION?',
  'Descripción de la(s) herramienta(s) utilizada(s) y muestra poblacional',
  'Resumen de resultados principales cualitativos y cuantitativos del diagnóstico de necesidades de formación',
]

const HEADERS_PRESUPUESTO = [
  '# AF DEL PROYECTO', '# DE ENEFICIARIOS', 'VALOR DE LAS AF',
  'GASTOS DE OPERACIÓN', 'VALOR TRANSFERENCIA', '# DE BENEFICIOARIOS TRASFERENCIA',
  'POLIZA', 'VALOR TOTAL DEL PROYECTO',
  'COFINANCION SENA', 'CONTRAPARTIDA EN ESPECIE', 'CONTRAPARTIDA EN DINERO',
  'GASTOS OPERACIÓN COFINANCIACION SENA', 'GASTOS OPERACIÓN CONTRAPARTIDA ESPECIE',
  'GASTOS OPERACIÓN CONTRAPARTIDA DINERO',
]

const HEADERS_AF = [
  'CONSECUTIVO DE LA ACCIÓN DE FORMACIÓN', 'NOMBRE DE LA ACCIÓN DE FORMACIÓN',
  'DIAGNÓSTICO DE NECESIDADES', 'ANÁLISIS DE CAUSAS Y EFECTOS',
  'OBJETIVO(S) DE LA ACCIÓN DE FORMACIÓN', 'ENFOQUE DE LA ACCIÓN DE FORMACIÓN',
  'EVENTO DE FORMACIÓN', 'MODALIDAD DE FORMACIÓN', 'METODOLOGÍA DE FORMACIÓN',
  'NÚMERO DE HORAS POR GRUPO', 'NÚMERO DE  GRUPOS',
  'BENEFICIARIOS PRESENCIALES  POR GRUPO', 'BENEFICIARIOS SINCRÓNICOS POR GRUPO',
  'AREA 1', 'AREA 2', 'AREA 3', 'AREA 4', 'AREA 5',
  'JUSTIFICACIÓN AREAS FUNCIONALES DE LOS BENEFICIARIOS',
  'NIVEL 1', 'NIVEL 2', 'NIVEL 3',
  'JUSTIFICACION BENEFICIARIOS DE LOS NIVELES',
  'IMPACTO DE LA FORMACIÓN EN EL DESEMPEÑO DEL TRABAJADOR 1',
  'IMPACTO DE LA FORMACIÓN EN EL DESEMPEÑO DEL TRABAJADOR 2',
  'IMPACTO DE LA FORMACIÓN EN EL DESEMPEÑO DEL TRABAJADOR 3',
  'IMPACTO DE LA FORMACIÓN EN EL DESEMPEÑO DEL TRABAJADOR 4',
  'IMPACTO DE LA FORMACIÓN EN EL DESEMPEÑO DEL TRABAJADOR 5',
  'IMPACTO DE LA FORMACIÓN EN LA PRODUCTIVIDAD Y COMPETITIVIDAD  ORGANIZACIONAL 1',
  'IMPACTO DE LA FORMACIÓN EN LA PRODUCTIVIDAD Y COMPETITIVIDAD ORGANIZACIONAL 2',
  'IMPACTO DE LA FORMACIÓN EN LA PRODUCTIVIDAD Y COMPETITIVIDAD ORGANIZACIONAL 3',
  'IMPACTO DE LA FORMACIÓN EN LA PRODUCTIVIDAD Y COMPETITIVIDAD ORGANIZACIONAL 4',
  'IMPACTO DE LA FORMACIÓN EN LA PRODUCTIVIDAD Y COMPETITIVIDAD ORGANIZACIONAL 5',
  'NÚMERO DE EMPRESAS MIPYMES A BENEFICIAR (SI APLICA)',
  'NÚMERO DE TRABAJADORES A BENEFICIAR DE EMPRESAS MIPYMES (SI APLICA)',
  'JUSTIFICACIÓN EMPRESAS Y TRABAJADORES DE MIPYMES A BENEFICIAR (SI APLICA)',
  'NÚMERO DE EMPRESAS DE SU CADENA PRODUCTIVA A BENEFICIAR (SI APLICA)',
  'NÚMERO DE TRABAJADORES A BENEFICIAR DE EMPRESAS DE SU CADENA PRODUCTIVA (SI APLICA)',
  'JUSTIFICACIÓN EMPRESAS  Y BENEFICIARIOS DE LA CADENA PRODUCTIVA A BENEFICIAR (SI APLICA)',
  'NÚMERO DE TRABAJADORES MUJERES QUE SE BENEFICIAN DE LA FORMACIÓN',
  'NÚMERO DE TRABAJADORES CAMPESINOS QUE SE BENEFICIAN DE LA FORMACIÓN',
  'NÚMERO DE TRABAJADORES EN CONDICIÓN DE DISCAPACIDAD QUE SE BENEFICIAN DE LA FORMACIÓN',
  'NÚMERO DE EMPRESAS BIC A BENEFICIAR',
  'SECTOR1', 'SECTOR 2', 'SECTOR 3', 'SECTOR 4', 'SECTOR 5',
  'SUBSECTOR 1', 'SUBSECTOR 2', 'SUBSECTOR 3', 'SUBSECTOR 4', 'SUBSECTOR 5',
  'CLASIFICACION DE LA ACCION POR SECTOR 1', 'CLASIFICACION DE LA ACCION POR SECTOR 2',
  'CLASIFICACION DE LA ACCION POR SECTOR 3', 'CLASIFICACION DE LA ACCION POR SECTOR 4',
  'CLASIFICACION DE LA ACCION POR SECTOR 5',
  'CLASIFICACION DE LA ACCION POR SUBSECTOR 1', 'CLASIFICACION DE LA ACCION POR SUBSECTOR 2',
  'CLASIFICACION DE LA ACCION POR SUBSECTOR 3', 'CLASIFICACION DE LA ACCION POR SUBSECTOR 4',
  'CLASIFICACION DE LA ACCION POR SUBSECTOR 5',
  'COMPONENTE ALINEACION DE LA ACCIÓN DE FORMACIÓN',
  'DESCRIPCIÓN DE LA ALINEACIÓN DE LA ACCIÓN DE FORMACIÓN',
  'JUSTIFICACIÓN ALINEACIÓN DE FORMACIÓN', 'JUSTIFICACIÓN ACCIÓN DE FORMACIÓN ESPECIALIZADA',
  'AMBIENTE DE APRENDIZAJE', 'MATERIAL DE FORMACIÓN', 'JUSTIFICACIÓN SI APLICA',
  'GESTIÓN DEL CONOCIMIENTO',
  'DESEA INCLUIR ESTA ACCIÓN DE FORMACIÓN EN LA FORMULACIÓN DEL PROYECTO',
  'INSUMOS', 'JUSTIFICACIÓN DEL INSUMO', 'RECURSOS DIDACTICOS',
  'CODIGO DE LA NECESIDAD', 'CODIGO DEL DIAGNOSTICO DE LA NECESIDAD',
  'OCUPACION CUOC 1', 'OCUPACION CUOC 2', 'OCUPACION CUOC 3', 'OCUPACION CUOC 4',
  'OCUPACION CUOC 5', 'OCUPACION CUOC 6', 'OCUPACION CUOC 7', 'OCUPACION CUOC 8',
  'OCUPACION CUOC 9', 'OCUPACION CUOC 10', 'OCUPACION CUOC 11', 'OCUPACION CUOC 12',
  'OCUPACION CUOC 13', 'OCUPACION CUOC 14', 'OCUPACION CUOC 15', 'OCUPACION CUOC 16',
  'OCUPACION CUOC 17', 'OCUPACION CUOC 18', 'OCUPACION CUOC 19', 'OCUPACION CUOC 20',
  'VALIDACION PRESUPUESTO AF', 'JUSTIFICACION AF',
  'JUSTIFICACIÓN SECTORES Y SUB-SECTORES',
  'JUSTIFICACIÓN DE TRABAJADORES DE LA ECONOMÍA CAMPESINA',
  'NÚMERO DE TRABAJADORES DE LA ECONOMÍA POPULAR',
  'JUSTIFICACIÓN DE TRABAJADORES DE LA ECONOMÍA POPULAR',
  'JUSTIFICACIÓN BENEFICIARIOS TALLER-PUESTO DE TRABAJO REAL',
  'EFECTOS DEL PROBLEMA O NECESIDAD',
]

const HEADERS_UT = [
  'NUMERO AF', 'NUMERO UT', 'NOMBRE UT', 'HORAS PRACTICAS', 'HORAS TEORICAS',
  'CONTENIDO UT', 'COMPETENCIA UT',
  'ACTIVIDAD UT 1', 'ACTIVIDAD UT 2', 'ACTIVIDAD UT 3', 'ACTIVIDAD UT 4', 'ACTIVIDAD UT 5',
  'DESCRIPCIÓN DE LA ACTIVIDAD',
  'PERFIL 1', 'HORAS EJECUTADAS 1',
  'PERFIL 2', 'HORAS EJECUTADAS 2',
  'PERFIL 3', 'HORAS EJECUTADAS 3',
  'PERFIL 4', 'HORAS EJECUTADAS 4',
  'PERFIL 5', 'HORAS EJECUTADAS 5',
  'HABILIDAD TRANSVERSAL', 'ES TRANSVERSAL',
]

const HEADERS_RUBROS = [
  'N° AF', 'IDRUBRO', 'NOMBRERUBRO', 'DESCRIPCION', 'JUSTIFICACIÓN',
  'TARIFA MAXIMA', '# HORAS', '#PAGINAS /UNIDADES', '# DE BENEFICIARIOS', '# DE DIAS',
  'TOTALRUBRO', 'VALOR MAXIMO', 'CASO', 'PAQUETE',
  'VALOR * BENEFICIARIOS',
  'COFINANCIACION  SENA', 'CONTRAPARTIDA ESPECIE', 'CONTRAPARTIDA DINERO',
]

const HEADERS_COBERTURA = (() => {
  const base = ['AF', 'GRUPO', 'DEPARTAMENTO PRE', 'CIUDAD PRE', 'BENEFICIARIOS']
  for (let i = 1; i <= 25; i++) {
    base.push(`DEPARTAMENTO ${i}`, `BENEFICIARIOS ${i}`)
  }
  base.push('JUSTIFICACIÓN DE LA RELACIÓN DE LOS TRABAJADORES BENEFICIARIOS DE LA EMPRESA PROPONENTE, AGREMIADAS AL PROPONENETE O DE SU CADENA PRODUCTIVA CON LOS LUGARES DE EJECUCIÓN PLANTEADOS')
  return base
})()

// ── Helpers ──────────────────────────────────────────────────────────────────

type AnyRec = Record<string, any>
type Row = Array<string | number | null>

function s(v: any): string { return v == null ? '' : String(v).trim() }
function n(v: any): number | '' { const x = Number(v); return isNaN(x) ? '' : x }
function up(v: any): string { return s(v).toUpperCase() }
function clobToString(v: any): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (Buffer.isBuffer(v)) return v.toString('utf8')
  return String(v)
}
/** Formatea una fecha (string ISO o Date) como DD/MM/YYYY (formato del
 *  reporte oficial). Si el valor no es una fecha válida, retorna ''. */
function fmtDate(v: any): string {
  if (!v) return ''
  const d = v instanceof Date ? v : new Date(String(v))
  if (isNaN(d.getTime())) return s(v)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = d.getFullYear()
  return `${dd}/${mm}/${yy}`
}

@Injectable()
export class ExcelReportService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // ── Entry points ───────────────────────────────────────────────────────────

  /** Genera un archivo ZIP con el Excel de cada proyecto que tenga versión
   *  FINAL marcada y cuyo estado actual esté en la lista `estados`. Útil
   *  para descargas masivas (ej. todos los Confirmados o Aprobados). */
  async generateBulkExcelZip(estados: number[]): Promise<{ filename: string; buffer: Buffer; total: number }> {
    if (!estados.length) throw new NotFoundException('Debe especificar al menos un estado.')
    const placeholders = estados.map((_, i) => `:${i + 1}`).join(',')
    const proyectos = await this.dataSource.query(
      `SELECT p.PROYECTOID    AS "proyectoId",
              v.VERSIONCODIGO AS "codigo",
              p.PROYECTOESTADO AS "estado"
         FROM PROYECTO p
         JOIN PROYECTOVERSION v ON v.PROYECTOID = p.PROYECTOID
                              AND v.VERSIONESFINAL = 1
                              AND v.VERSIONANULADA = 0
        WHERE p.PROYECTOESTADO IN (${placeholders})
        ORDER BY p.PROYECTOID`,
      estados,
    )
    if (!proyectos.length) {
      throw new NotFoundException('No hay proyectos con versión FINAL en los estados solicitados.')
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const JSZip = require('jszip') as typeof import('jszip')
    const zip = new JSZip()
    let exitos = 0
    for (const p of proyectos as Array<{ proyectoId: number; codigo: string }>) {
      try {
        const { filename, buffer } = await this.generateProyectoExcelFinal(Number(p.proyectoId))
        zip.file(filename, buffer)
        exitos++
      } catch (e) {
        // Si un proyecto falla, lo registramos como un .txt de error en el zip
        // y continuamos con el resto, para que la descarga no se aborte por uno.
        zip.file(`ERROR-${p.codigo || p.proyectoId}.txt`, `No se pudo generar el Excel: ${(e as Error).message}`)
      }
    }
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const filename = `reportes-${estados.join('-')}-${ts}.zip`
    return { filename, buffer: buffer as Buffer, total: exitos }
  }

  /** Genera el Excel del proyecto desde su versión FINAL.
   *  Si no hay versión FINAL, lanza NotFoundException. */
  async generateProyectoExcelFinal(proyectoId: number) {
    // Solo metadata; el snapshot se lee por chunks en readSnapshotJson
    // para evitar ORA-06502 cuando el CLOB tiene multibyte UTF-8.
    const [version] = await this.dataSource.query(
      `SELECT PROYECTOVERSIONID  AS "versionId",
              VERSIONNUMERO      AS "numero",
              VERSIONCODIGO      AS "codigo"
         FROM PROYECTOVERSION
        WHERE PROYECTOID = :1
          AND VERSIONESFINAL = 1
          AND VERSIONANULADA = 0`,
      [proyectoId],
    )
    if (!version) {
      throw new NotFoundException(
        'El proyecto no tiene una versión FINAL. Marca una versión como FINAL antes de exportar.',
      )
    }
    const snapshot = await this.readSnapshotJson(Number(version.versionId))
    const filename = `${version.codigo}.xlsx`
    const buffer = await this.buildWorkbook(snapshot)
    return { filename, buffer }
  }

  /** Lee el CLOB completo del snapshot y lo parsea. Usa el driver oracledb
   *  directamente con fetchInfo: STRING para que devuelva el CLOB como una
   *  cadena (sin tener que pasar por DBMS_LOB.SUBSTR, que tiene problemas
   *  con buffers VARCHAR2 cuando hay multibyte UTF-8). */
  private async readSnapshotJson(versionId: number): Promise<AnyRec> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const oracledb = require('oracledb') as {
      STRING: number
      OUT_FORMAT_OBJECT: number
    }
    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    try {
      const conn = (queryRunner as any).databaseConnection
      const result = await conn.execute(
        `SELECT VERSIONSNAPSHOT FROM PROYECTOVERSION WHERE PROYECTOVERSIONID = :1`,
        [versionId],
        {
          fetchInfo: { VERSIONSNAPSHOT: { type: oracledb.STRING } },
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        },
      )
      const json: string | undefined = result?.rows?.[0]?.VERSIONSNAPSHOT
      if (!json) {
        throw new Error(`Snapshot vacío para la versión ${versionId}`)
      }
      try {
        return JSON.parse(json) as AnyRec
      } catch (e) {
        throw new Error(
          `No se pudo parsear el snapshot de la versión ${versionId}: ${(e as Error).message}`,
        )
      }
    } finally {
      await queryRunner.release()
    }
  }

  // ── Workbook builder ───────────────────────────────────────────────────────

  /** Catálogos id→nombre cargados una sola vez para resolver IDs en el snapshot
   *  (TIPOAMBIENTE, GESTIONCONOCIMIENTO, MATERIALFORMACION) y la descripción
   *  legible de los rubros (que no se persiste en AFRUBRO). */
  private async loadCatalogs() {
    const [ambientes, gestiones, materiales, rubros, retosNac, componentes] = await Promise.all([
      this.dataSource.query(`SELECT TIPOAMBIENTEID AS "id", TRIM(TIPOAMBIENTENOMBRE) AS "nombre" FROM TIPOAMBIENTE`).catch(() => []),
      this.dataSource.query(`SELECT GESTIONCONOCIMIENTOID AS "id", TRIM(GESTIONCONOCIMIENTONOMBRE) AS "nombre" FROM GESTIONCONOCIMIENTO`).catch(() => []),
      this.dataSource.query(`SELECT MATERIALFORMACIONID AS "id", TRIM(MATERIALFORMACIONNOMBRE) AS "nombre" FROM MATERIALFORMACION`).catch(() => []),
      this.dataSource.query(`SELECT RUBROID AS "id", DBMS_LOB.SUBSTR(RUBRODESCRIPCION,2000,1) AS "descripcion" FROM RUBRO`).catch(() => []),
      this.dataSource.query(`SELECT RETONACIONALID AS "id", TRIM(RETONACIONALNOMBRE) AS "nombre" FROM RETONACIONAL`).catch(() => []),
      this.dataSource.query(`SELECT AFCOMPONENTEID AS "id", TRIM(AFCOMPONENTENOMBRE) AS "nombre", RETONACIONALID AS "retoId" FROM AFCOMPONENTE`).catch(() => []),
    ])
    const toMap = (rows: any[], key = 'nombre') => {
      const m = new Map<number, string>()
      for (const r of rows) m.set(Number(r.id), String(r[key] ?? ''))
      return m
    }
    // Componente → Reto: para resolver el reto a partir del componenteId del AF.
    const componenteRetoId = new Map<number, number>()
    for (const c of componentes as any[]) {
      componenteRetoId.set(Number(c.id), Number(c.retoId))
    }
    return {
      ambientes: toMap(ambientes),
      gestiones: toMap(gestiones),
      materiales: toMap(materiales),
      rubrosDesc: toMap(rubros, 'descripcion'),
      retosNac: toMap(retosNac),
      componenteRetoId,
    }
  }

  /** Carga los rubros R09 (GO) y R015 (Transferencia) por AF del proyecto, con
   *  su codigo/nombre/descripcion del catálogo y los montos persistidos en
   *  AFRUBRO. El snapshot solo guarda los valores monetarios — el catálogo no
   *  se snapshotea, pero los nombres de R09/R015 son estables. */
  private async loadGoTransRubros(proyectoId: number) {
    if (!proyectoId) return new Map<number, { go?: any; trans?: any }>()
    const rows = await this.dataSource.query(
      `SELECT af.ACCIONFORMACIONID                       AS "afId",
              ar.RUBROID                                 AS "rubroId",
              TRIM(r.RUBROCODIGO)                        AS "codigo",
              TRIM(r.RUBRONOMBRE)                        AS "nombre",
              DBMS_LOB.SUBSTR(r.RUBRODESCRIPCION,2000,1) AS "descripcion",
              ar.AFRUBROCOFINANCIACION                   AS "cofSena",
              ar.AFRUBROESPECIE                          AS "especie",
              ar.AFRUBRODINERO                           AS "dinero",
              ar.AFRUBROVALOR                            AS "valor",
              ar.AFRUBROBENEFICIARIOS                    AS "beneficiarios",
              ar.AFRUBROCANTIDAD                         AS "cantidad"
         FROM AFRUBRO ar
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = ar.ACCIONFORMACIONID
         JOIN RUBRO r            ON r.RUBROID            = ar.RUBROID
        WHERE af.PROYECTOID = :1
          AND TRIM(r.RUBROCODIGO) IN ('R09', 'R015')`,
      [proyectoId],
    ).catch(() => [])
    const map = new Map<number, { go?: any; trans?: any }>()
    for (const r of rows as any[]) {
      const afId = Number(r.afId)
      const entry = map.get(afId) ?? {}
      if (r.codigo === 'R09') entry.go = r
      else if (r.codigo === 'R015') entry.trans = r
      map.set(afId, entry)
    }
    return map
  }

  private async buildWorkbook(snap: AnyRec): Promise<Buffer> {
    const cats = await this.loadCatalogs()
    const wb = XLSX.utils.book_new()

    // Mapa necesidadId → número secuencial (1,2,3...) por proyecto, para que
    // "NUMERO DIAGNOSTICO" en Datos_Diagnostico/NecesidadesAF y "CODIGO DEL
    // DIAGNOSTICO DE LA NECESIDAD" en Datos_AF coincidan.
    const diagSeq = new Map<number, number>()
    ;((snap.diagnosticos as AnyRec[]) ?? []).forEach((d, i) => {
      const id = Number(d?.necesidadId)
      if (id) diagSeq.set(id, i + 1)
    })

    // Para cada AF, traemos los rubros especiales R09 (Gastos de Operación) y
    // R015 (Transferencia) con su nombre/descripción del catálogo, ya que el
    // snapshot solo guarda los valores monetarios sueltos. Una sola query por
    // proyecto, no por AF.
    const proyectoId = Number(snap?.proyecto?.id) || 0
    const goTransRubros = await this.loadGoTransRubros(proyectoId)

    this.appendSheet(wb, 'Datos_Cobertura',     this.buildCobertura(snap))
    this.appendSheet(wb, 'Datos_Rubros',         this.buildRubros(snap, cats, goTransRubros))
    this.appendSheet(wb, 'Datos_UT',             this.buildUT(snap))
    this.appendSheet(wb, 'Datos_AF',             this.buildAF(snap, cats))
    this.appendSheet(wb, 'Datos_Presupuesto',    this.buildPresupuesto(snap))
    this.appendSheet(wb, 'Datos_Diagnostico',    this.buildDiagnostico(snap, diagSeq))
    this.appendSheet(wb, 'Datos_NecesidadesAF',  this.buildNecesidadesAF(snap, diagSeq))
    this.appendSheet(wb, 'Datos_Generalidades',  this.buildGeneralidades(snap))
    this.appendSheet(wb, 'Datos_Contacto',       this.buildContacto(snap))
    this.appendSheet(wb, 'Datos_Basicos',        await this.buildBasicosAsync(snap))

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  }

  /** Wrapper que enriquece la hoja Datos_Basicos con campos no presentes en
   *  snapshots antiguos (certifComp/expertTecn) consultando EMPRESA por NIT. */
  private async buildBasicosAsync(snap: AnyRec): Promise<Row[]> {
    const e = snap.empresa ?? {}
    // Para snapshots viejos que no incluían certifComp/expertTecn/indicativo,
    // hacemos fallback a la EMPRESA viva por NIT. (Estos campos son de perfil
    // empresa, no del proyecto, así que no rompemos inmutabilidad).
    if ((e.certifComp == null || e.expertTecn == null || e.indicativo == null) && e.nit) {
      try {
        const [row] = await this.dataSource.query(
          `SELECT EMPRESACERTIFCOMP AS "certifComp",
                  EMPRESAEXPERTTECN AS "expertTecn",
                  EMPRESAINDICATIVO AS "indicativo"
             FROM EMPRESA
            WHERE EMPRESAIDENTIFICACION = :1`,
          [Number(e.nit)],
        )
        if (row) {
          if (e.certifComp == null) e.certifComp = row.certifComp
          if (e.expertTecn == null) e.expertTecn = row.expertTecn
          if (e.indicativo == null) e.indicativo = row.indicativo
        }
      } catch { /* ignoramos: fallback es cadena vacía */ }
    }
    return this.buildBasicos(snap, { certif: e.certifComp, expert: e.expertTecn })
  }

  private appendSheet(wb: XLSX.WorkBook, name: string, rows: Row[]) {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, name)
  }

  // ── Hoja: Datos_Basicos ────────────────────────────────────────────────────

  private buildBasicos(snap: AnyRec, flags: { certif?: any; expert?: any } = {}): Row[] {
    const e = snap.empresa ?? {}
    const proy = snap.proyecto ?? {}
    const mesas = (snap.mesasSectoriales as string[]) ?? []
    // Empresa.certifComp / expertTecn pueden venir como 1/0 numérico, '1'/'0'
    // string, o 'S'/'N'. Lo normalizamos a "SI" / "NO".
    const yesNo = (v: any): string => {
      const sv = String(v ?? '').trim().toUpperCase()
      if (sv === '1' || sv === 'S' || sv === 'SI' || sv === 'SÍ' || sv === 'TRUE') return 'SI'
      if (sv === '0' || sv === 'N' || sv === 'NO' || sv === 'FALSE') return 'NO'
      return ''
    }
    // El reporte oficial SENA usa MAYÚSCULAS para los catálogos.
    const ciiu = e.ciiuCodigo && e.ciiuDescripcion
      ? `${s(e.ciiuCodigo)} - ${up(e.ciiuDescripcion)}`
      : up(e.ciiuDescripcion ?? e.ciiuCodigo)
    const row: Row = [
      s(e.nit),
      s(e.digitoV),
      up(e.razonSocial),
      up(e.sigla),
      s(e.email),
      up(e.departamento),
      up(e.ciudad),
      up(e.direccion),
      s(e.telefono),
      s(e.website),
      ciiu,
      up(e.tipoEmpresa),
      yesNo(flags.certif ?? e.certifComp),  // CERTIFICACIÓN DE COMPETENCIAS LABORALES
      yesNo(flags.expert ?? e.expertTecn),  // VINCULO EXPERTOS TECNICOS
      up(e.cobertura),
      e.indicativo != null ? s(e.indicativo) : '',  // CÓDIGO INDICATIVO (EMPRESAINDICATIVO)
      up(e.tamanoEmpresa),
      s(e.celular),
      up(mesas[0] ?? ''),
      up(mesas[1] ?? ''),
      up(mesas[2] ?? ''),
      up(proy.modalidad),
      'NIT (NÚMERO DE IDENTIFICACIÓN TRIBUTARIA)',
    ]
    return [HEADERS_BASICOS, row]
  }

  // ── Hoja: Datos_Contacto ───────────────────────────────────────────────────

  private buildContacto(snap: AnyRec): Row[] {
    const e = snap.empresa ?? {}
    const contactos = (snap.contactos as AnyRec[]) ?? []
    const matches = (cargo: string, ...needles: string[]): boolean => {
      const c = up(cargo)
      return needles.some(n => c.includes(n.toUpperCase()))
    }
    // El form actual define solo 3 cargos en el dropdown:
    //   1. Representante Legal           (datos en empresa.rep*)
    //   2. Persona encargada del área de Talento Humano  → "Primer contacto"
    //   3. Persona encargada del área de Comunicaciones → "Persona que sustenta"
    // Si hay más contactos, ignoramos los extras (solo emitimos los 3 oficiales).
    // Mantenemos compatibilidad con cargos del esquema anterior:
    // "Coordinador"/"Primer Contacto" → primero;
    // "Responsable"/"Sustenta" → sustenta.
    const primero = contactos.find(c => matches(c.cargo, 'TALENTO HUMANO', 'COORDINADOR', 'PRIMER CONTACTO'))
      ?? contactos.find(c => !matches(c.cargo, 'REPRESENTANTE', 'COMUNICACIONES', 'RESPONSABLE', 'SUSTENTA'))
    const sustenta = contactos.find(c => matches(c.cargo, 'COMUNICACIONES', 'RESPONSABLE', 'SUSTENTA'))
    const row: Row = [
      s(e.repDocumento),  up(e.repTipoDoc),  up(e.repNombre),  s(e.repCorreo),  s(e.repTel),
      s(primero?.documento ?? ''), up(primero?.tipoDoc ?? ''), up(primero?.nombre ?? ''), s(primero?.correo ?? ''), s(primero?.telefono ?? ''),
      up(sustenta?.tipoDoc ?? ''), s(sustenta?.documento ?? ''), up(sustenta?.nombre ?? ''), s(sustenta?.correo ?? ''), s(sustenta?.telefono ?? ''),
    ]
    return [HEADERS_CONTACTO, row]
  }

  // ── Hoja: Datos_Generalidades ──────────────────────────────────────────────

  private buildGeneralidades(snap: AnyRec): Row[] {
    const e = snap.empresa ?? {}
    const proy = snap.proyecto ?? {}
    const sectPert    = (snap.sectoresPertenece as string[]) ?? []
    const subPert     = (snap.subsectoresPertenece as string[]) ?? []
    const sectRepr    = (snap.sectoresRepresenta as string[]) ?? []
    const subRepr     = (snap.subsectoresRepresenta as string[]) ?? []
    const row: Row = [
      clobToString(e.objeto), clobToString(e.productos), clobToString(e.situacion),
      clobToString(e.papel), clobToString(e.retos), clobToString(e.experiencia),
      clobToString(proy.objetivo),
      up(sectPert[0] ?? ''),
      up(subPert[0] ?? ''),
      up(sectRepr[0] ?? ''), up(sectRepr[1] ?? ''), up(sectRepr[2] ?? ''),
      up(subRepr[0] ?? ''),  up(subRepr[1] ?? ''),  up(subRepr[2] ?? ''),
      clobToString(e.eslabones),
      clobToString(e.interacciones),
    ]
    return [HEADERS_GENERALIDADES, row]
  }

  // ── Hoja: Datos_NecesidadesAF ──────────────────────────────────────────────

  private buildNecesidadesAF(snap: AnyRec, diagSeq: Map<number, number>): Row[] {
    const rows: Row[] = [HEADERS_NECESIDADESAF]
    const diagnosticos = (snap.diagnosticos as AnyRec[]) ?? []
    diagnosticos.forEach((d, idx) => {
      const numDiag = diagSeq.get(Number(d?.necesidadId)) ?? (idx + 1)
      const nfList: AnyRec[] = (d?.necesidades as AnyRec[]) ?? []
      nfList.forEach(nf => {
        rows.push([
          numDiag,
          n(nf.numero) || '',
          s(nf.nombre),
          n(nf.beneficiarios) || '',
        ])
      })
    })
    return rows
  }

  // ── Hoja: Datos_Diagnostico ────────────────────────────────────────────────

  private buildDiagnostico(snap: AnyRec, diagSeq: Map<number, number>): Row[] {
    const rows: Row[] = [HEADERS_DIAGNOSTICO]
    const diagnosticos = (snap.diagnosticos as AnyRec[]) ?? []
    diagnosticos.forEach((d, idx) => {
      // El diagnostico viene FLAT (campos en el objeto raíz, no en .necesidad)
      const numDiag = diagSeq.get(Number(d?.necesidadId)) ?? (idx + 1)
      const herrs: AnyRec[] = (d?.herramientas as AnyRec[]) ?? []
      const row: Row = [numDiag]
      for (let i = 0; i < 5; i++) {
        row.push(s(herrs[i]?.herramienta ?? ''))
        row.push(n(herrs[i]?.muestra) || '')
      }
      // Mapeo SI/NO desde códigos numéricos para herrCreacion / planCapa
      const yesNo = (v: any): string => {
        const sv = s(v).toUpperCase()
        if (sv === '1' || sv === 'SI' || sv === 'SÍ' || sv === 'TRUE') return 'SI'
        if (sv === '0' || sv === 'NO' || sv === 'FALSE') return 'NO'
        return sv
      }
      row.push(fmtDate(d?.fechaRegistro))            // FECHA DE DIAGNOSTICO (DD/MM/YYYY)
      row.push(yesNo(d?.herrCreacion))               // ¿CREACION PROPIA?
      row.push(s(d?.herrOtra))                        // OTRO TIPO DE HERRAMIENTA
      row.push(yesNo(d?.planCapa))                   // ¿PLAN DE CAPACITACION?
      row.push(clobToString(d?.herrDescrip))         // Descripción
      row.push(clobToString(d?.herrResultados))      // Resumen de resultados
      rows.push(row)
    })
    return rows
  }

  // ── Hoja: Datos_Presupuesto ────────────────────────────────────────────────

  private buildPresupuesto(snap: AnyRec): Row[] {
    const p = snap.presupuesto ?? {}
    const tot = p.totalesAfs ?? {}
    const go  = p.go ?? {}
    const tr  = p.transferencia ?? {}
    const totProy = p.totalProyecto ?? {}
    const acciones = (snap.acciones as AnyRec[]) ?? []
    const valorAFs   = Number(tot.valorTotalAFs) || 0
    const valorGO    = Number(go.total) || 0
    const valorTrans = Number(tr.totalValor) || 0
    const valorTotal = Number(totProy.valorTotal) || (valorAFs + valorGO + valorTrans)
    // POLIZA = porcentaje de Gastos de Operación sobre el valor de las AFs
    // (con 2 decimales).
    const polizaPct = Number(go.porcSobreAFs) || 0
    const row: Row = [
      Number(tot.totalAfs) || acciones.length,        // # AF DEL PROYECTO
      Number(tot.totalBeneficiarios) || 0,            // # DE ENEFICIARIOS
      valorAFs,                                       // VALOR DE LAS AF
      valorGO,                                        // GASTOS DE OPERACIÓN
      valorTrans,                                     // VALOR TRANSFERENCIA
      Number(tr.totalBeneficiarios) || 0,             // # DE BENEFICIOARIOS TRASFERENCIA
      Math.round(polizaPct * 100) / 100,              // POLIZA = % GO
      valorTotal,                                     // VALOR TOTAL DEL PROYECTO
      Number(totProy.cofSena ?? tot.totalCofSena) || 0,
      Number(totProy.contraEspecie ?? tot.totalContraEspecie) || 0,
      Number(totProy.contraDinero ?? tot.totalContraDinero) || 0,
      Number(go.totalCofSena) || 0,                   // GO COFINANCIACION SENA
      Number(go.totalContraEspecie) || 0,             // GO CONTRAPARTIDA ESPECIE
      Number(go.totalContraDinero) || 0,              // GO CONTRAPARTIDA DINERO
    ]
    return [HEADERS_PRESUPUESTO, row]
  }

  // ── Hoja: Datos_AF ─────────────────────────────────────────────────────────

  private buildAF(
    snap: AnyRec,
    cats: {
      ambientes: Map<number, string>
      gestiones: Map<number, string>
      materiales: Map<number, string>
      retosNac: Map<number, string>
      componenteRetoId: Map<number, number>
    },
  ): Row[] {
    const rows: Row[] = [HEADERS_AF]
    const acciones = (snap.acciones as AnyRec[]) ?? []
    const detalleByAfId: Record<number, AnyRec> = {}
    for (const d of (snap.accionesDetalle as AnyRec[]) ?? []) {
      detalleByAfId[Number(d.afId)] = d
    }

    acciones.forEach((af, idx) => {
      const det = detalleByAfId[Number(af.afId)] ?? {}
      const perfil    = det.perfil ?? {}
      const sectores  = det.sectores ?? {}
      const alineacion = det.alineacion ?? {}
      const material  = det.material ?? {}
      const rubrosAf  = (det.rubros as AnyRec[]) ?? []

      // Catálogos en MAYÚSCULAS para coincidir con el reporte legacy SENA.
      const areas: string[] = ((perfil.areas as AnyRec[]) ?? []).map((a: AnyRec) => up(a.nombre || a.otro))
      const niveles: string[] = ((perfil.niveles as AnyRec[]) ?? []).map((nv: AnyRec) => up(nv.nombre))
      const cuoc: string[] = ((perfil.cuoc as AnyRec[]) ?? []).map((o: AnyRec) => up(o.nombre))
      const sectAf: string[]  = ((sectores.sectoresAf as AnyRec[]) ?? []).map((x: AnyRec) => up(x.nombre))
      const subAf: string[]   = ((sectores.subsectoresAf as AnyRec[]) ?? []).map((x: AnyRec) => up(x.nombre))
      const sectBen: string[] = ((sectores.sectoresBenef as AnyRec[]) ?? []).map((x: AnyRec) => up(x.nombre))
      const subBen: string[]  = ((sectores.subsectoresBenef as AnyRec[]) ?? []).map((x: AnyRec) => up(x.nombre))

      // Impactos: el dominio guarda dos textos largos (resDesem y resForm). Los
      // metemos en los slots 1 de cada bloque y dejamos los demás vacíos.
      const resDesem = clobToString(alineacion.resDesem ?? '')
      const resForm  = clobToString(alineacion.resForm ?? '')

      // CODIGO DE LA NECESIDAD = necesidadFormacionId (DB ID).
      // CODIGO DEL DIAGNOSTICO = necesidadId (DB ID del diagnóstico padre).
      // El reporte legacy usa los IDs raw de DB en estos campos (no el
      // consecutivo 1..N que sí se usa en Datos_Diagnostico/NecesidadesAF).
      const necNum = af.necesidadFormacionId ?? ''
      const diagNum = af.necesidadId ?? ''

      const valTotalAf = rubrosAf.reduce((acc, r) => acc + (Number(r.totalRubro) || 0), 0)

      // Catálogos: los nombres no están en el snapshot, los resolvemos por ID.
      // Todos en MAYÚSCULAS para mantener el formato del reporte SENA.
      const ambienteNombre = up(cats.ambientes.get(Number(material.tipoAmbienteId)) ?? '')
      const gestionNombre  = up(cats.gestiones.get(Number(material.gestionConocimientoId)) ?? '')
      const materialNombre = up(cats.materiales.get(Number(material.materialFormacionId)) ?? '')

      // Reto Nacional: el snapshot guarda alineacion.componenteId. Buscamos el
      // retoId del componente y luego el nombre del reto en el catálogo.
      const componenteId = Number(alineacion.componenteId) || 0
      const retoId = cats.componenteRetoId.get(componenteId) ?? (Number(alineacion.retoNacionalId) || 0)
      const retoNombre = up(cats.retosNac.get(retoId) ?? '')
      const componenteNombreUp = up(alineacion.componenteNombre ?? '')

      const row: Row = [
        Number(af.numero) || (idx + 1),                     // CONSECUTIVO
        up(af.nombre),                                      // NOMBRE
        clobToString(af.necesidadFormacionNombre),          // DIAGNÓSTICO DE NECESIDADES = problema/necesidad detectada
        clobToString(af.causa),                             // ANÁLISIS DE CAUSAS
        clobToString(af.objetivo),                          // OBJETIVO(S)
        up(perfil.enfoque ?? ''),                           // ENFOQUE
        up(af.tipoEvento),                                  // EVENTO
        up(af.modalidad),                                   // MODALIDAD
        up(af.metodologia),                                 // METODOLOGÍA
        Number(af.numHorasGrupo) || '',
        Number(af.numGrupos) || '',
        Number(af.benefGrupo) || '',                        // PRESENCIALES POR GRUPO
        Number(af.benefViGrupo) || '',                      // SINCRÓNICOS POR GRUPO
        s(areas[0] ?? ''), s(areas[1] ?? ''), s(areas[2] ?? ''), s(areas[3] ?? ''), s(areas[4] ?? ''),
        clobToString(perfil.justAreas ?? ''),               // JUSTIFICACIÓN AREAS
        s(niveles[0] ?? ''), s(niveles[1] ?? ''), s(niveles[2] ?? ''),
        clobToString(perfil.justNivelesOcu ?? ''),          // JUSTIFICACION NIVELES
        // IMPACTO DESEMPEÑO 1..5 (solo el 1 con data)
        resDesem, '', '', '', '',
        // IMPACTO PRODUCTIVIDAD 1..5 (solo el 1)
        resForm, '', '', '', '',
        Number(perfil.mipymes) || '',                       // MIPYMES (empresas)
        Number(perfil.trabMipymes) || '',                   // TRABAJADORES MIPYMES
        clobToString(perfil.mipymesD ?? ''),                // JUSTIF MIPYMES
        Number(perfil.cadenaProd) || '',                    // EMPRESAS CADENA
        Number(perfil.trabCadProd) || '',                   // TRAB CADENA
        clobToString(perfil.cadenaProdD ?? ''),             // JUSTIF CADENA
        Number(perfil.mujer) || '',                         // MUJERES
        Number(perfil.numCampesino) || '',                  // CAMPESINOS
        Number(perfil.trabDiscapac) || '',                  // DISCAPACIDAD
        Number(perfil.trabajadorBic) || '',                 // BIC
        // SECTORES 1..5 — sectores beneficiarios (al que pertenece la AF)
        s(sectBen[0] ?? ''), s(sectBen[1] ?? ''), s(sectBen[2] ?? ''), s(sectBen[3] ?? ''), s(sectBen[4] ?? ''),
        // SUBSECTORES 1..5 beneficiarios
        s(subBen[0] ?? ''), s(subBen[1] ?? ''), s(subBen[2] ?? ''), s(subBen[3] ?? ''), s(subBen[4] ?? ''),
        // CLASIFICACIÓN POR SECTOR 1..5 — sectores AF (clasificación)
        s(sectAf[0] ?? ''), s(sectAf[1] ?? ''), s(sectAf[2] ?? ''), s(sectAf[3] ?? ''), s(sectAf[4] ?? ''),
        // CLASIFICACIÓN POR SUBSECTOR 1..5
        s(subAf[0] ?? ''), s(subAf[1] ?? ''), s(subAf[2] ?? ''), s(subAf[3] ?? ''), s(subAf[4] ?? ''),
        retoNombre,                                         // 63 COMPONENTE = nombre del Reto Nacional
        componenteNombreUp,                                 // 64 DESCRIPCIÓN = nombre del componente AF
        clobToString(alineacion.compod ?? ''),              // 65 JUSTIFICACIÓN ALINEACIÓN = compod (texto descripción)
        clobToString(alineacion.justificacion ?? ''),       // 66 JUSTIFICACIÓN AF ESPECIALIZADA = justificacion
        ambienteNombre,                                     // AMBIENTE DE APRENDIZAJE
        materialNombre,                                     // MATERIAL DE FORMACIÓN
        clobToString(material.justMat ?? ''),               // JUSTIFICACIÓN SI APLICA (justMat)
        gestionNombre,                                      // GESTIÓN DEL CONOCIMIENTO
        'SI',                                               // DESEA INCLUIR ESTA AF
        clobToString(material.insumo ?? ''),                // INSUMOS
        clobToString(material.justInsumo ?? ''),            // JUSTIFICACIÓN DEL INSUMO
        ((material.recursos as AnyRec[]) ?? []).map(r => up(r.nombre)).filter(Boolean).join(' | '),
        s(necNum),                                          // CODIGO NECESIDAD
        s(diagNum),                                         // CODIGO DIAGNOSTICO
        // OCUPACION CUOC 1..20
        ...Array.from({ length: 20 }, (_, i) => s(cuoc[i] ?? '')),
        valTotalAf > 0 ? 'SI' : '',                         // VALIDACION PRESUPUESTO AF
        clobToString(af.justnec),                           // JUSTIFICACION AF
        clobToString(sectores.justificacion ?? ''),         // JUSTIFICACIÓN SECTORES Y SUB-SECTORES
        clobToString(perfil.justCampesino ?? ''),           // JUSTIF TRABAJADORES CAMPESINOS
        Number(perfil.numPopular) || '',                    // # ECONOMÍA POPULAR
        clobToString(perfil.justPopular ?? ''),             // JUSTIF ECONOMÍA POPULAR
        '',                                                 // JUSTIFICACIÓN BENEFICIARIOS TALLER (no se captura)
        clobToString(af.efectos),                           // EFECTOS DEL PROBLEMA
      ]
      rows.push(row)
    })
    return rows
  }

  // ── Hoja: Datos_UT ─────────────────────────────────────────────────────────

  private buildUT(snap: AnyRec): Row[] {
    const rows: Row[] = [HEADERS_UT]
    const detalleByAfId: Record<number, AnyRec> = {}
    for (const d of (snap.accionesDetalle as AnyRec[]) ?? []) {
      detalleByAfId[Number(d.afId)] = d
    }
    const acciones = (snap.acciones as AnyRec[]) ?? []
    acciones.forEach(af => {
      const det = detalleByAfId[Number(af.afId)] ?? {}
      const uts = (det.unidadesTematicas as AnyRec[]) ?? []
      uts.forEach((ut, idx) => {
        // Las horas se guardan disgregadas por modalidad (PP/PV/PPAT/PHib y
        // TP/TV/TPAT/THib). Para el reporte sumamos las prácticas y teóricas.
        const horasPracticas =
          (Number(ut.horasPP) || 0) + (Number(ut.horasPV) || 0)
          + (Number(ut.horasPPAT) || 0) + (Number(ut.horasPHib) || 0)
        const horasTeoricas =
          (Number(ut.horasTP) || 0) + (Number(ut.horasTV) || 0)
          + (Number(ut.horasTPAT) || 0) + (Number(ut.horasTHib) || 0)

        const actividades: string[] = ((ut.actividades as AnyRec[]) ?? [])
          .map((a: AnyRec) => up(a.nombre || a.otro))
        const perfilesUT: AnyRec[] = (ut.perfiles as AnyRec[]) ?? []
        const habilidad = up(ut.articulacionTerritorialNombre ?? '')
        // ES TRANSVERSAL solo se muestra si el flag está explícitamente
        // marcado (1=SI). Si es 0 o null (UT regular sin transversalidad),
        // dejamos en blanco para coincidir con el reporte legacy.
        const esTrans = Number(ut.esTransversal) === 1 ? 'SI' : ''
        // Helpers para par PERFIL/HORAS: si no hay perfil, ambas celdas
        // quedan vacías (el reporte legacy no rellena 0 en esos casos).
        const perfilN = (i: number) => up(perfilesUT[i]?.rubroNombre ?? '')
        const horasN  = (i: number): number | '' => perfilesUT[i]
          ? (Number(perfilesUT[i].horasCap) || 0)
          : ''
        const row: Row = [
          Number(af.numero) || 0,
          Number(ut.numero) || (idx + 1),
          up(ut.nombre),                                        // NOMBRE UT en mayúsculas
          horasPracticas,                                       // HORAS PRACTICAS (default 0)
          horasTeoricas,                                        // HORAS TEORICAS (default 0)
          clobToString(ut.contenido),
          clobToString(ut.competencias),
          actividades[0] ?? '', actividades[1] ?? '', actividades[2] ?? '',
          actividades[3] ?? '', actividades[4] ?? '',
          clobToString(ut.justActividad ?? ''),
          perfilN(0), horasN(0),
          perfilN(1), horasN(1),
          perfilN(2), horasN(2),
          perfilN(3), horasN(3),
          perfilN(4), horasN(4),
          habilidad,
          esTrans,
        ]
        rows.push(row)
      })
    })
    return rows
  }

  // ── Hoja: Datos_Rubros ─────────────────────────────────────────────────────

  private buildRubros(
    snap: AnyRec,
    cats: { rubrosDesc: Map<number, string> },
    goTransRubros: Map<number, { go?: any; trans?: any }>,
  ): Row[] {
    const rows: Row[] = [HEADERS_RUBROS]
    const detalleByAfId: Record<number, AnyRec> = {}
    for (const d of (snap.accionesDetalle as AnyRec[]) ?? []) {
      detalleByAfId[Number(d.afId)] = d
    }
    const acciones = (snap.acciones as AnyRec[]) ?? []
    acciones.forEach(af => {
      const det = detalleByAfId[Number(af.afId)] ?? {}
      const rubros = (det.rubros as AnyRec[]) ?? []
      rubros.forEach(r => {
        const totalRubro = Number(r.totalRubro) || 0
        const valorMaximo = Number(r.valorMaximo) || 0
        const cantidad = Number(r.cantidad) || 0
        const numHoras = Number(r.numHoras) || 0
        const benef = Number(r.beneficiarios) || 0
        const dias = Number(r.dias) || 0
        // TARIFA MAXIMA = valor unitario del rubro = VALOR MAXIMO / # UNIDADES.
        // Se elige la primera unidad no-cero (horas, paginas/unidades, días,
        // beneficiarios). Si todo es 0, la tarifa = valor máximo.
        const divisor = numHoras || cantidad || dias || benef || 1
        const tarifaMaxima = valorMaximo > 0 ? Math.round(valorMaximo / divisor) : 0
        // VALOR * BENEFICIARIOS = total del rubro / beneficiarios (calculado
        // si el campo persistido viene vacío).
        let valorBenef = Number(r.valorBenef) || 0
        if (!valorBenef && benef > 0 && totalRubro > 0) {
          valorBenef = Math.round(totalRubro / benef)
        }
        // Nombre del rubro: el template trae "CODIGO + descripción". En la BD
        // RUBRONOMBRE ya incluye el código como prefijo (ej: "R01.1.1 HONORARIOS - ...")
        // así que NO lo duplicamos. Si no, lo prefijamos.
        const nombreSrc = s(r.nombre || r.codigo)
        const codigoSrc = s(r.codigo)
        const nombreCompleto = codigoSrc && nombreSrc.toUpperCase().startsWith(codigoSrc.toUpperCase())
          ? nombreSrc
          : (codigoSrc ? `${codigoSrc} ${nombreSrc}` : nombreSrc)
        // Descripción del rubro: no se persiste en AFRUBRO, la traemos del
        // catálogo RUBRO por rubroId.
        const descripcion = clobToString(cats.rubrosDesc.get(Number(r.rubroId)) ?? '')
        // CASO: la BD guarda "1", "2", etc. El reporte legacy usa "Caso01",
        // "Caso02", ... con padding a 2 dígitos.
        const casoNum = Number(r.caso)
        const casoStr = !isNaN(casoNum) && casoNum > 0
          ? `Caso${String(casoNum).padStart(2, '0')}`
          : s(r.caso)

        const row: Row = [
          Number(af.numero) || 0,
          Number(r.rubroId) || 0,                       // IDRUBRO = rubroId de la BD
          nombreCompleto,
          descripcion,
          clobToString(r.justificacion),
          tarifaMaxima,                                // TARIFA MAXIMA
          numHoras,                                    // # HORAS
          cantidad,                                    // #PAGINAS /UNIDADES
          benef,                                       // # DE BENEFICIARIOS
          dias,                                        // # DE DIAS
          totalRubro,                                  // TOTALRUBRO
          valorMaximo,                                 // VALOR MAXIMO
          casoStr,                                     // CASO (Caso01, Caso02…)
          s(r.paquete),
          valorBenef,                                  // VALOR * BENEFICIARIOS
          Number(r.cofSena) || 0,
          Number(r.contraEspecie) || 0,
          Number(r.contraDinero) || 0,
        ]
        rows.push(row)
      })

      // Después de los rubros normales de la AF, agregamos R09 (Gastos de
      // Operación) y R015 (Transferencia) si existen. Esos rubros se manejan
      // por separado en el modelo (no están en det.rubros) pero deben aparecer
      // en el reporte como una fila más por AF.
      const goTrans = goTransRubros.get(Number(af.afId))
      if (goTrans?.go) {
        const g = goTrans.go
        const total = Number(g.valor) || 0
        const nombreSrc = s(g.nombre)
        const codigoSrc = s(g.codigo)
        const nombreCompleto = nombreSrc.toUpperCase().startsWith(codigoSrc.toUpperCase())
          ? nombreSrc
          : (codigoSrc ? `${codigoSrc} ${nombreSrc}` : nombreSrc)
        // Para Gastos de Operación (R09) la unidad siempre es 1 (1 paquete por
        // AF). Si el AFRUBRO no la tiene persistida, la inferimos como 1.
        const cantGO = Number(g.cantidad) || 1
        const row: Row = [
          Number(af.numero) || 0,
          Number(g.rubroId) || 0,                // IDRUBRO de la BD
          nombreCompleto,                        // R09 GASTOS DE OPERACIÓN DEL PROYECTO
          clobToString(g.descripcion),
          '',                                    // JUSTIFICACIÓN (no aplica para R09)
          total,                                 // TARIFA MAXIMA = total / 1 unidad
          0,                                     // # HORAS
          cantGO,                                // #PAGINAS /UNIDADES = 1
          0, 0,                                  // # BENEF / # DÍAS
          total,                                 // TOTALRUBRO
          total,                                 // VALOR MAXIMO
          '', '',                                // CASO / PAQUETE
          0,                                     // VALOR * BENEFICIARIOS
          Number(g.cofSena) || 0,
          Number(g.especie) || 0,
          Number(g.dinero) || 0,
        ]
        rows.push(row)
      }
      if (goTrans?.trans) {
        const t = goTrans.trans
        const total = Number(t.valor) || 0
        const nombreSrc = s(t.nombre)
        const codigoSrc = s(t.codigo)
        const nombreCompleto = nombreSrc.toUpperCase().startsWith(codigoSrc.toUpperCase())
          ? nombreSrc
          : (codigoSrc ? `${codigoSrc} ${nombreSrc}` : nombreSrc)
        const row: Row = [
          Number(af.numero) || 0,
          Number(t.rubroId) || 0,                // IDRUBRO de la BD
          nombreCompleto,                        // R015 TRANSFERENCIA DE CONOCIMIENTO Y TECNOLOGÍA
          clobToString(t.descripcion),
          '',                                    // JUSTIFICACIÓN
          0, 0, 0,                               // TARIFA / # HORAS / # PAG
          Number(t.beneficiarios) || 0,          // # DE BENEFICIARIOS (sí aplica)
          0,                                     // # DE DÍAS
          total,                                 // TOTALRUBRO
          0,                                     // VALOR MAXIMO
          '', '',                                // CASO / PAQUETE
          0,                                     // VALOR * BENEFICIARIOS
          0, 0,                                  // SENA / ESPECIE (transferencia es 100% dinero)
          total,                                 // CONTRAPARTIDA DINERO
        ]
        rows.push(row)
      }
    })
    return rows
  }

  // ── Hoja: Datos_Cobertura ──────────────────────────────────────────────────

  private buildCobertura(snap: AnyRec): Row[] {
    const rows: Row[] = [HEADERS_COBERTURA]
    const detalleByAfId: Record<number, AnyRec> = {}
    for (const d of (snap.accionesDetalle as AnyRec[]) ?? []) {
      detalleByAfId[Number(d.afId)] = d
    }
    const acciones = (snap.acciones as AnyRec[]) ?? []
    acciones.forEach(af => {
      const det = detalleByAfId[Number(af.afId)] ?? {}
      const grupos = (det.grupos as AnyRec[]) ?? []
      // Reglas del template VBA SENA:
      //  - AF "Virtual" o "PAT" (Presencial Asistida por Tecnologías): las
      //    columnas DEPARTAMENTO PRE / CIUDAD PRE / BENEFICIARIOS quedan vacías
      //    y todas las coberturas se vuelcan en DEPARTAMENTO 1..25 / BENEFICIARIOS 1..25.
      //  - AF "Presencial" o "Presencial Híbrida": la primera cobertura va en
      //    PRE; el resto en 1..25.
      const modalidadAfUp = up(af.modalidad)
      const afEsPatOVirtual = modalidadAfUp.includes('VIRTUAL')
        || modalidadAfUp.includes('PAT')
      grupos.forEach((g, idx) => {
        const cobs: AnyRec[] = (g.coberturas as AnyRec[]) ?? []
        // Solo intentamos llenar PRE si la modalidad de la AF lo permite.
        const idxPre = afEsPatOVirtual
          ? -1
          : cobs.findIndex(c => s(c.modal).toUpperCase() === 'P')
        const tienePre = idxPre >= 0
        const pre = tienePre ? cobs[idxPre] : {}
        const otras = tienePre
          ? cobs.filter((_, i) => i !== idxPre)
          : cobs
        const row: Row = [
          Number(af.numero) || 0,
          `GRUPO ${Number(g.grupoNumero) || (idx + 1)}`,
          tienePre ? up(pre.deptoNombre ?? '') : '',  // DEPARTAMENTO PRE
          tienePre ? up(pre.ciudadNombre ?? '') : '', // CIUDAD PRE
          tienePre ? (Number(pre.benef) || 0) : '',   // BENEFICIARIOS PRE
        ]
        for (let i = 0; i < 25; i++) {
          row.push(up(otras[i]?.deptoNombre ?? ''))
          row.push(Number(otras[i]?.benef) || (otras[i] ? 0 : ''))
        }
        row.push(clobToString(g.justificacion ?? ''))
        rows.push(row)
      })
    })
    return rows
  }
}
