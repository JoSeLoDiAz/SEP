import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import * as XLSX from 'xlsx'

// encabezados verbatim del template SENA, typos y columnas repetidas incluidos: lo espera el script Python

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
        // un proyecto que falla no aborta el zip: queda como .txt de error
        zip.file(`ERROR-${p.codigo || p.proyectoId}.txt`, `No se pudo generar el Excel: ${(e as Error).message}`)
      }
    }
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const filename = `reportes-${estados.join('-')}-${ts}.zip`
    return { filename, buffer: buffer as Buffer, total: exitos }
  }

  async generateProyectoExcelFinal(proyectoId: number) {
    // aqui solo metadata: el CLOB del snapshot va aparte en readSnapshotJson
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

  // fetchInfo STRING trae el CLOB entero: DBMS_LOB.SUBSTR revienta con ORA-06502 si hay multibyte UTF-8
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

  // catalogos id→nombre: el snapshot solo guarda los IDs
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

  // R09 y R015: el snapshot solo guarda los montos, el nombre y la descripcion salen del catalogo
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

    // consecutivo 1..N por necesidad: es el NUMERO DIAGNOSTICO que comparten las hojas
    const diagSeq = new Map<number, number>()
    ;((snap.diagnosticos as AnyRec[]) ?? []).forEach((d, i) => {
      const id = Number(d?.necesidadId)
      if (id) diagSeq.set(id, i + 1)
    })

    // una sola query por proyecto, no por AF
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

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true })
  }

  private async buildBasicosAsync(snap: AnyRec): Promise<Row[]> {
    const e = snap.empresa ?? {}
    // snapshots viejos no traen estos campos; son del perfil de empresa, no del proyecto
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

  private buildBasicos(snap: AnyRec, flags: { certif?: any; expert?: any } = {}): Row[] {
    const e = snap.empresa ?? {}
    const proy = snap.proyecto ?? {}
    const mesas = (snap.mesasSectoriales as string[]) ?? []
    // certifComp/expertTecn llegan como 1/0, '1'/'0' o 'S'/'N' segun la epoca del dato
    const yesNo = (v: any): string => {
      const sv = String(v ?? '').trim().toUpperCase()
      if (sv === '1' || sv === 'S' || sv === 'SI' || sv === 'SÍ' || sv === 'TRUE') return 'SI'
      if (sv === '0' || sv === 'N' || sv === 'NO' || sv === 'FALSE') return 'NO'
      return ''
    }
    // el reporte SENA exige los catalogos en mayusculas
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
      yesNo(flags.certif ?? e.certifComp),
      yesNo(flags.expert ?? e.expertTecn),
      up(e.cobertura),
      e.indicativo != null ? s(e.indicativo) : '',
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

  private buildContacto(snap: AnyRec): Row[] {
    const e = snap.empresa ?? {}
    const contactos = (snap.contactos as AnyRec[]) ?? []
    const matches = (cargo: string, ...needles: string[]): boolean => {
      const c = up(cargo)
      return needles.some(n => c.includes(n.toUpperCase()))
    }
    // solo salen 3 contactos; "Coordinador"/"Responsable" son cargos del esquema viejo
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

  private buildDiagnostico(snap: AnyRec, diagSeq: Map<number, number>): Row[] {
    const rows: Row[] = [HEADERS_DIAGNOSTICO]
    const diagnosticos = (snap.diagnosticos as AnyRec[]) ?? []
    diagnosticos.forEach((d, idx) => {
      // el diagnostico viene FLAT: los campos estan en la raiz, no en .necesidad
      const numDiag = diagSeq.get(Number(d?.necesidadId)) ?? (idx + 1)
      const herrs: AnyRec[] = (d?.herramientas as AnyRec[]) ?? []
      const row: Row = [numDiag]
      for (let i = 0; i < 5; i++) {
        row.push(s(herrs[i]?.herramienta ?? ''))
        row.push(n(herrs[i]?.muestra) || '')
      }
      const yesNo = (v: any): string => {
        const sv = s(v).toUpperCase()
        if (sv === '1' || sv === 'SI' || sv === 'SÍ' || sv === 'TRUE') return 'SI'
        if (sv === '0' || sv === 'NO' || sv === 'FALSE') return 'NO'
        return sv
      }
      row.push(fmtDate(d?.fechaRegistro))
      row.push(yesNo(d?.herrCreacion))
      row.push(s(d?.herrOtra))
      row.push(yesNo(d?.planCapa))
      row.push(clobToString(d?.herrDescrip))
      row.push(clobToString(d?.herrResultados))
      rows.push(row)
    })
    return rows
  }

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
    // la columna POLIZA en realidad lleva el % de gastos de operacion sobre las AFs
    const polizaPct = Number(go.porcSobreAFs) || 0
    const row: Row = [
      Number(tot.totalAfs) || acciones.length,
      Number(tot.totalBeneficiarios) || 0,
      valorAFs,
      valorGO,
      valorTrans,
      Number(tr.totalBeneficiarios) || 0,
      Math.round(polizaPct * 100) / 100,
      valorTotal,
      Number(totProy.cofSena ?? tot.totalCofSena) || 0,
      Number(totProy.contraEspecie ?? tot.totalContraEspecie) || 0,
      Number(totProy.contraDinero ?? tot.totalContraDinero) || 0,
      Number(go.totalCofSena) || 0,
      Number(go.totalContraEspecie) || 0,
      Number(go.totalContraDinero) || 0,
    ]
    return [HEADERS_PRESUPUESTO, row]
  }

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

      // el legacy SENA exige los catalogos en mayusculas
      const areas: string[] = ((perfil.areas as AnyRec[]) ?? []).map((a: AnyRec) => up(a.nombre || a.otro))
      const niveles: string[] = ((perfil.niveles as AnyRec[]) ?? []).map((nv: AnyRec) => up(nv.nombre))
      const cuoc: string[] = ((perfil.cuoc as AnyRec[]) ?? []).map((o: AnyRec) => up(o.nombre))
      const sectAf: string[]  = ((sectores.sectoresAf as AnyRec[]) ?? []).map((x: AnyRec) => up(x.nombre))
      const subAf: string[]   = ((sectores.subsectoresAf as AnyRec[]) ?? []).map((x: AnyRec) => up(x.nombre))
      const sectBen: string[] = ((sectores.sectoresBenef as AnyRec[]) ?? []).map((x: AnyRec) => up(x.nombre))
      const subBen: string[]  = ((sectores.subsectoresBenef as AnyRec[]) ?? []).map((x: AnyRec) => up(x.nombre))

      // solo hay dos textos de impacto: van en el slot 1 de cada bloque de cinco
      const resDesem = clobToString(alineacion.resDesem ?? '')
      const resForm  = clobToString(alineacion.resForm ?? '')

      // aqui van los IDs crudos de la BD, no el consecutivo 1..N de las otras hojas
      const necNum = af.necesidadFormacionId ?? ''
      const diagNum = af.necesidadId ?? ''

      const valTotalAf = rubrosAf.reduce((acc, r) => acc + (Number(r.totalRubro) || 0), 0)

      // los nombres de catalogo no van en el snapshot, se resuelven por ID
      const ambienteNombre = up(cats.ambientes.get(Number(material.tipoAmbienteId)) ?? '')
      const gestionNombre  = up(cats.gestiones.get(Number(material.gestionConocimientoId)) ?? '')
      const materialNombre = up(cats.materiales.get(Number(material.materialFormacionId)) ?? '')

      // el snapshot solo guarda componenteId: el reto se deduce del componente
      const componenteId = Number(alineacion.componenteId) || 0
      const retoId = cats.componenteRetoId.get(componenteId) ?? (Number(alineacion.retoNacionalId) || 0)
      const retoNombre = up(cats.retosNac.get(retoId) ?? '')
      const componenteNombreUp = up(alineacion.componenteNombre ?? '')

      const row: Row = [
        Number(af.numero) || (idx + 1),
        up(af.nombre),
        clobToString(af.necesidadFormacionNombre),          // la columna DIAGNÓSTICO DE NECESIDADES lleva la necesidad detectada
        clobToString(af.causa),
        clobToString(af.objetivo),
        up(perfil.enfoque ?? ''),
        up(af.tipoEvento),
        up(af.modalidad),
        up(af.metodologia),
        Number(af.numHorasGrupo) || '',
        Number(af.numGrupos) || '',
        Number(af.benefGrupo) || '',
        Number(af.benefViGrupo) || '',
        s(areas[0] ?? ''), s(areas[1] ?? ''), s(areas[2] ?? ''), s(areas[3] ?? ''), s(areas[4] ?? ''),
        clobToString(perfil.justAreas ?? ''),
        s(niveles[0] ?? ''), s(niveles[1] ?? ''), s(niveles[2] ?? ''),
        clobToString(perfil.justNivelesOcu ?? ''),
        resDesem, '', '', '', '',
        resForm, '', '', '', '',
        Number(perfil.mipymes) || '',
        Number(perfil.trabMipymes) || '',
        clobToString(perfil.mipymesD ?? ''),
        Number(perfil.cadenaProd) || '',
        Number(perfil.trabCadProd) || '',
        clobToString(perfil.cadenaProdD ?? ''),
        Number(perfil.mujer) || '',
        Number(perfil.numCampesino) || '',
        Number(perfil.trabDiscapac) || '',
        Number(perfil.trabajadorBic) || '',
        // SECTOR/SUBSECTOR son los del beneficiario; CLASIFICACION son los de la AF
        s(sectBen[0] ?? ''), s(sectBen[1] ?? ''), s(sectBen[2] ?? ''), s(sectBen[3] ?? ''), s(sectBen[4] ?? ''),
        s(subBen[0] ?? ''), s(subBen[1] ?? ''), s(subBen[2] ?? ''), s(subBen[3] ?? ''), s(subBen[4] ?? ''),
        s(sectAf[0] ?? ''), s(sectAf[1] ?? ''), s(sectAf[2] ?? ''), s(sectAf[3] ?? ''), s(sectAf[4] ?? ''),
        s(subAf[0] ?? ''), s(subAf[1] ?? ''), s(subAf[2] ?? ''), s(subAf[3] ?? ''), s(subAf[4] ?? ''),
        // la columna COMPONENTE lleva el reto nacional y DESCRIPCIÓN el componente
        retoNombre,
        componenteNombreUp,
        clobToString(alineacion.compod ?? ''),
        clobToString(alineacion.justificacion ?? ''),
        ambienteNombre,
        materialNombre,
        clobToString(material.justMat ?? ''),
        gestionNombre,
        'SI',                                               // DESEA INCLUIR ESTA AF
        clobToString(material.insumo ?? ''),
        clobToString(material.justInsumo ?? ''),
        ((material.recursos as AnyRec[]) ?? []).map(r => up(r.nombre)).filter(Boolean).join(' | '),
        s(necNum),
        s(diagNum),
        ...Array.from({ length: 20 }, (_, i) => s(cuoc[i] ?? '')),
        valTotalAf > 0 ? 'SI' : '',                         // VALIDACION PRESUPUESTO AF
        clobToString(af.justnec),
        clobToString(sectores.justificacion ?? ''),
        clobToString(perfil.justCampesino ?? ''),
        Number(perfil.numPopular) || '',
        clobToString(perfil.justPopular ?? ''),
        '',                                                 // JUSTIFICACIÓN BENEFICIARIOS TALLER: no se captura
        clobToString(af.efectos),
      ]
      rows.push(row)
    })
    return rows
  }

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
        // las horas vienen disgregadas por modalidad; el reporte pide la suma
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
        // 0 o null va en blanco, no "NO": asi lo hace el reporte legacy
        const esTrans = Number(ut.esTransversal) === 1 ? 'SI' : ''
        // sin perfil las dos celdas van vacias, el legacy no rellena con 0
        const perfilN = (i: number) => up(perfilesUT[i]?.rubroNombre ?? '')
        const horasN  = (i: number): number | '' => perfilesUT[i]
          ? (Number(perfilesUT[i].horasCap) || 0)
          : ''
        const row: Row = [
          Number(af.numero) || 0,
          Number(ut.numero) || (idx + 1),
          up(ut.nombre),
          horasPracticas,
          horasTeoricas,
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
        // TARIFA MAXIMA = valor maximo dividido por la primera unidad no-cero
        const divisor = numHoras || cantidad || dias || benef || 1
        const tarifaMaxima = valorMaximo > 0 ? Math.round(valorMaximo / divisor) : 0
        // si el valor persistido viene vacio, se calcula
        let valorBenef = Number(r.valorBenef) || 0
        if (!valorBenef && benef > 0 && totalRubro > 0) {
          valorBenef = Math.round(totalRubro / benef)
        }
        // RUBRONOMBRE ya suele traer el codigo de prefijo, no lo duplicamos
        const nombreSrc = s(r.nombre || r.codigo)
        const codigoSrc = s(r.codigo)
        const nombreCompleto = codigoSrc && nombreSrc.toUpperCase().startsWith(codigoSrc.toUpperCase())
          ? nombreSrc
          : (codigoSrc ? `${codigoSrc} ${nombreSrc}` : nombreSrc)
        // la descripcion no se persiste en AFRUBRO, sale del catalogo
        const descripcion = clobToString(cats.rubrosDesc.get(Number(r.rubroId)) ?? '')
        // la BD guarda "1" y el legacy espera "Caso01"
        const casoNum = Number(r.caso)
        const casoStr = !isNaN(casoNum) && casoNum > 0
          ? `Caso${String(casoNum).padStart(2, '0')}`
          : s(r.caso)

        const row: Row = [
          Number(af.numero) || 0,
          Number(r.rubroId) || 0,
          nombreCompleto,
          descripcion,
          clobToString(r.justificacion),
          tarifaMaxima,
          numHoras,
          cantidad,
          benef,
          dias,
          totalRubro,
          valorMaximo,
          casoStr,
          s(r.paquete),
          valorBenef,
          Number(r.cofSena) || 0,
          Number(r.contraEspecie) || 0,
          Number(r.contraDinero) || 0,
        ]
        rows.push(row)
      })

      // R09 y R015 no viven en det.rubros pero el reporte los quiere como fila extra por AF
      const goTrans = goTransRubros.get(Number(af.afId))
      if (goTrans?.go) {
        const g = goTrans.go
        const total = Number(g.valor) || 0
        const nombreSrc = s(g.nombre)
        const codigoSrc = s(g.codigo)
        const nombreCompleto = nombreSrc.toUpperCase().startsWith(codigoSrc.toUpperCase())
          ? nombreSrc
          : (codigoSrc ? `${codigoSrc} ${nombreSrc}` : nombreSrc)
        // R09 siempre es un paquete por AF
        const cantGO = Number(g.cantidad) || 1
        const row: Row = [
          Number(af.numero) || 0,
          Number(g.rubroId) || 0,
          nombreCompleto,
          clobToString(g.descripcion),
          '',                                    // JUSTIFICACIÓN
          total,                                 // TARIFA MAXIMA
          0,                                     // # HORAS
          cantGO,                                // #PAGINAS /UNIDADES
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
          Number(t.rubroId) || 0,
          nombreCompleto,
          clobToString(t.descripcion),
          '',                                    // JUSTIFICACIÓN
          0, 0, 0,                               // TARIFA / # HORAS / # PAG
          Number(t.beneficiarios) || 0,          // # DE BENEFICIARIOS
          0,                                     // # DE DÍAS
          total,                                 // TOTALRUBRO
          0,                                     // VALOR MAXIMO
          '', '',                                // CASO / PAQUETE
          0,                                     // VALOR * BENEFICIARIOS
          0, 0,                                  // SENA / ESPECIE: la transferencia es 100% dinero
          total,                                 // CONTRAPARTIDA DINERO
        ]
        rows.push(row)
      }
    })
    return rows
  }

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
      // regla del VBA SENA: en Virtual/PAT las columnas PRE van vacias y todo cae en 1..25
      const modalidadAfUp = up(af.modalidad)
      const afEsPatOVirtual = modalidadAfUp.includes('VIRTUAL')
        || modalidadAfUp.includes('PAT')
      grupos.forEach((g, idx) => {
        const cobs: AnyRec[] = (g.coberturas as AnyRec[]) ?? []
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
          tienePre ? up(pre.deptoNombre ?? '') : '',
          tienePre ? up(pre.ciudadNombre ?? '') : '',
          tienePre ? (Number(pre.benef) || 0) : '',
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
