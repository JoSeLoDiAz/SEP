import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException,
} from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { aTitleCase } from '../common/text/title-case'
import { bindRepetido, enBloques } from '../common/db/binds'
import {
  cifrarClave, generarClaveInicial, generarLlaveEncriptacion,
} from '../common/crypto/usuario-clave'
import { AuditoriaService } from './auditoria.service'
import { extensionDe, extensionesDeTipoDocEval } from './formatos-correo'
import { empiezaComoImagen, mimeRealDeImagen } from './firma-imagen'
import { miniaturaDeFoto } from './miniatura-foto'
import { traducirValorLargo } from '../common/db/errores'

/** Nombre de pantalla de cada columna, para el error de "valor demasiado grande". */
const CAMPOS_PARTICIPACION: Record<string, string> = {
  MESA: 'Mesa',
  EQUIPOEVALUADOR: 'Equipo evaluador',
  DINAMIZADOR: 'Dinamizó',
  MOTIVONOPARTICIPA: 'Motivo',
  PERIODO: 'Periodo',
}

/** PERFIL.PERFILID 9 = EVALUADORGFCE. Es el perfil con el que entra al SEP. */
const PERFIL_EVALUADOR = 9

export interface EvaluadorCrearDto {
  // PERSONA
  tipoDocumentoIdentidadId: number
  identificacion: string
  nombres: string
  primerApellido: string
  segundoApellido?: string
  email: string
  emailInstitucional: string
  celular?: string
  ciudadId?: number
  // EVALUADOR
  centroId?: number
  regionalId?: number
  cargo?: string
  profesion?: string
  posgrado?: string
  otrosEstudios?: string
  jefeDirecto?: string    // legacy — texto libre; se conserva por compatibilidad
  quienAprueba?: string   // reservado para Fase 4 (flujo de aprobación)
  // Jefe directo estructurado (Fase 3) y municipio de residencia
  jefeNombre?: string
  jefeEmail?: string
  jefeCargo?: string
  municipioId?: number
  /** Si no viene, se genera y se devuelve una sola vez en la respuesta. */
  claveInicial?: string
}

export interface EvaluadorActualizarDto {
  // EVALUADOR
  centroId?: number | null
  regionalId?: number | null
  cargo?: string | null
  profesion?: string | null
  posgrado?: string | null
  otrosEstudios?: string | null
  jefeDirecto?: string | null
  quienAprueba?: string | null
  // Jefe directo estructurado y municipio de residencia
  jefeNombre?: string | null
  jefeEmail?: string | null
  jefeCargo?: string | null
  municipioId?: number | null
  // PERSONA (opcional)
  nombres?: string
  primerApellido?: string
  segundoApellido?: string | null
  email?: string
  emailInstitucional?: string
  celular?: string | null
}

export interface ParticipacionDto {
  anio: number
  periodo?: string | null
  rolEvaluadorId?: number | null
  /** Ciclo del banco. Sin esto la participación no hereda documentos ni entra a la matriz. */
  convocatoriaId?: number | null
  /** Área del equipo evaluador ESE año (FK AREAEVALUACION). */
  areaId?: number | null
  /** 1 = evalúa por alcance explícito multi-área en vez de por su grupo. */
  esTransversal?: boolean
  /** Código del catálogo MODALIDADPART: PRESENCIAL | PAT | VIRTUAL. */
  modalidadPart?: string | null
  procesoId?: number | null
  /** Legacy: hoy se traduce al estado REVOCADO. La columna se dropeó en v36. */
  procesoRevocado?: boolean
  mesa?: string | null
  equipoEvaluador?: string | null
  /** Quién dinamizó la mesa, en texto libre. No siempre está registrado. */
  dinamizador?: string | null
  /** @deprecated Sustituido por `dinamizador`. Se conserva por las filas viejas. */
  dinamizadorPersonaId?: number | null
  retroalimentacion?: string | null
  observaciones?: string | null
  /** Lo inyecta el controller desde el JWT; no viene del body. */
  usuarioEmail?: string
}

export interface EstudioDto {
  tipoEstudioId: number
  titulo?: string
  institucion?: string
  fechaGrado?: string // ISO
}

export interface ExperienciaDto {
  cargo: string
  entidad: string
  fechaInicio?: string
  fechaFin?: string | null
}

export interface TicDto {
  tipoEventoId?: number | null
  nombre: string
  horas?: number
  fechaFin?: string | null
}

export interface PruebaDto {
  anio: number
  periodo?: string | null
  /** Ciclo al que pertenece. Si se omite se resuelve por año, cuando no hay ambigüedad. */
  participacionId?: number | null
  /** Nota de corte. Si se omite se toma de la convocatoria del ciclo y se congela. */
  puntajeMinimo?: number | null
  fechaPresentacion?: string | null
  horario?: string | null
  intentos?: number | null
  puntajeMayor?: number | null
  pruebaNumero?: number | null
  efectividad?: number | null
  correctas?: number | null
  incorrectas?: number | null
  totalTiempo?: string | null
  observacion?: string | null
}

/** Filtros del listado del banco. Todos opcionales y combinables. */
export interface EvaluadorFiltros {
  anio?: number
  procesoId?: number
  rolEvaluadorId?: number
  areaId?: number
  regionalId?: number
  centroId?: number
  /** Código de ESTADOPARTICIPACION: basta con que UN ciclo lo tenga. */
  estadoCodigo?: string
  sinCedula?: boolean
  sinFoto?: boolean
  /** true = solo con prueba vigente; false = solo sin ella; omitir = ambos. */
  pruebaVigente?: boolean
  incluirInactivos?: boolean
}

/** Chip de año que se pinta en la tarjeta del listado. */
export interface CicloResumido {
  /** Lo único único: un evaluador puede tener dos ciclos en el mismo año. */
  participacionId: number
  anio: number
  estadoCodigo: string | null
  estadoColor: string | null
}

/** Una tarjeta del listado del banco. */
export interface EvaluadorListaItem {
  evaluadorId: number
  personaId: number
  identificacion: string | null
  nombres: string | null
  primerApellido: string | null
  segundoApellido: string | null
  email: string | null
  cargo: string | null
  profesion: string | null
  regionalNombre: string | null
  activo: boolean
  tieneFoto: boolean
  tieneCedula: boolean
  pruebaVigente: boolean
  totalCiclos: number
  totalProyectos: number
  ultimoAnio: number | null
  promedioRetro: number | null
  ciclos: CicloResumido[]
}

/** Mira la ÚLTIMA prueba. Correlaciona por `e.EVALUADORID`: exige el alias `e`. */
const PRUEBA_VIGENTE = `EXISTS (
  SELECT 1 FROM (
    SELECT pr.APROBADA, pr.EFECTIVIDAD, pr.PUNTAJEMINIMO, pr.ANIO,
           ROW_NUMBER() OVER (ORDER BY pr.ANIO DESC, pr.PRUEBAID DESC) AS rn
      FROM EVALUADORPRUEBA pr
     WHERE pr.EVALUADORID = e.EVALUADORID
  ) u
   WHERE u.rn = 1
     AND u.ANIO >= EXTRACT(YEAR FROM SYSDATE) - 1
     AND (u.APROBADA = 1
          OR (u.PUNTAJEMINIMO IS NOT NULL AND u.EFECTIVIDAD >= u.PUNTAJEMINIMO)))`

export interface MulterFile {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

@Injectable()
export class EvaluadoresService {
  private readonly log = new Logger(EvaluadoresService.name)

  /** Se apaga si Oracle dice que EVALUADORFOTOMINI no existe (v50 sin correr). */
  private hayColumnaMiniatura = true

  /** null = todavia no se ha mirado. Ver `columnaDinamizador()`. */
  private columnaDinamizadorPresente: boolean | null = null

  /** ORA-00904 aquí = falta EVALUADORPARTICIPACION.DINAMIZADOR (v51 sin correr). */
  private faltaLaColumnaDinamizador(e: unknown): boolean {
    if (!/ORA-00904/.test((e as Error)?.message ?? '')) return false
    this.columnaDinamizadorPresente = false
    this.log.warn(
      'Falta la columna DINAMIZADOR: las participaciones se guardan sin ese ' +
      'dato. Correr docs/migraciones/v51_dinamizador_texto.sql.',
    )
    return true
  }

  /** Se pregunta al diccionario, no a un error: la migración puede correrse con el proceso arriba. */
  private async columnaDinamizador(): Promise<boolean> {
    if (this.columnaDinamizadorPresente === true) return true
    const filas: Array<{ n: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS "n" FROM ALL_TAB_COLUMNS
        WHERE TABLE_NAME = 'EVALUADORPARTICIPACION' AND COLUMN_NAME = 'DINAMIZADOR'`,
    )
    this.columnaDinamizadorPresente = Number(filas[0]?.n ?? 0) > 0
    return this.columnaDinamizadorPresente
  }

  private faltaLaColumnaMiniatura(e: unknown): boolean {
    if (!/ORA-00904/.test((e as Error)?.message ?? '')) return false
    if (this.hayColumnaMiniatura) {
      this.hayColumnaMiniatura = false
      this.log.warn(
        'Falta la columna EVALUADORFOTOMINI: las fotos van sin achicar. ' +
        'Correr docs/migraciones/v50_miniatura_foto_evaluador.sql.',
      )
    }
    return true
  }

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  // Búsqueda previa (al crear)

  async buscarPorDocumento(tipoDocumentoIdentidadId: number, identificacion: string) {
    const id = (identificacion ?? '').trim()
    if (!id || !tipoDocumentoIdentidadId) {
      throw new BadRequestException('Tipo de documento e identificación son requeridos')
    }
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT p.PERSONAID                    AS "personaId",
              p.TIPODOCUMENTOIDENTIDADID     AS "tipoDocumentoIdentidadId",
              TRIM(p.PERSONANOMBRES)         AS "nombres",
              TRIM(p.PERSONAPRIMERAPELLIDO)  AS "primerApellido",
              TRIM(p.PERSONASEGUNDOAPELLIDO) AS "segundoApellido",
              TRIM(p.PERSONAIDENTIFICACION)  AS "identificacion",
              TRIM(p.PERSONAEMAIL)           AS "email",
              TRIM(p.PERSONAEMAILINSTITUCIONAL) AS "emailInstitucional",
              TRIM(p.PERSONACELULAR)         AS "celular",
              p.CIUDADID                     AS "ciudadId",
              e.EVALUADORID                  AS "evaluadorId"
         FROM PERSONA p
         LEFT JOIN EVALUADOR e ON e.PERSONAID = p.PERSONAID
        WHERE TRIM(p.PERSONAIDENTIFICACION) = :1
          AND p.TIPODOCUMENTOIDENTIDADID = :2
          AND ROWNUM = 1`,
      [id, tipoDocumentoIdentidadId],
    )
    if (!rows[0]) return { encontrado: false }
    const r = rows[0]
    return {
      encontrado: true,
      esEvaluador: r.evaluadorId != null,
      evaluadorId: r.evaluadorId ? Number(r.evaluadorId) : null,
      persona: {
        personaId: Number(r.personaId),
        tipoDocumentoIdentidadId: Number(r.tipoDocumentoIdentidadId),
        identificacion: r.identificacion,
        nombres: r.nombres,
        primerApellido: r.primerApellido,
        segundoApellido: r.segundoApellido,
        email: r.email,
        emailInstitucional: r.emailInstitucional,
        celular: r.celular,
        ciudadId: r.ciudadId,
      },
    }
  }

  // Listado / Ficha

  /** Listado del banco: cada tarjeta trae sus últimos años y sus alertas. */
  async listar(
    busqueda: string, page = 1, limit = 20, filtros: EvaluadorFiltros = {},
    topePagina = 100,
  ) {
    const q = (busqueda ?? '').trim()
    // page y limit se interpolan: Oracle no admite bind en OFFSET/FETCH.
    const entero = (v: unknown, porDefecto: number) => {
      const n = Math.trunc(Number(v))
      return Number.isFinite(n) ? n : porDefecto
    }
    const pagina = Math.max(1, entero(page, 1))
    // El tope solo se sube desde el servidor (`topePagina`), nunca por query string.
    const tamPag = Math.min(entero(topePagina, 100), Math.max(1, entero(limit, 20)))
    // Un número ≥ 1e21 se interpolaría como "2e+21" y no es SQL válido.
    const offset = Math.min((pagina - 1) * tamPag, 1_000_000)

    const params: unknown[] = []
    const cond: string[] = []
    const bind = (valor: unknown) => { params.push(valor); return `:${params.length}` }

    cond.push(filtros.incluirInactivos ? '1 = 1' : 'e.EVALUADORACTIVO = 1')

    if (q) {
      // Se escapan los comodines: un "%" tecleado no debe traer todo.
      const like = `%${q.toUpperCase().replace(/([%_\\])/g, '\\$1')}%`
      // Los nombres son NCHAR: vienen rellenos de espacios, sin TRIM la concatenación no matchea.
      const nombreCompleto = `TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO)`
        + ` || ' ' || TRIM(NVL(p.PERSONASEGUNDOAPELLIDO, ' '))`
      cond.push(`(UPPER(${nombreCompleto}) LIKE ${bind(like)} ESCAPE '\\'
              OR UPPER(TRIM(p.PERSONAEMAIL)) LIKE ${bind(like)} ESCAPE '\\'
              OR TRIM(p.PERSONAIDENTIFICACION) LIKE ${bind(like)} ESCAPE '\\')`)
    }
    if (filtros.regionalId) cond.push(`e.REGIONALID = ${bind(filtros.regionalId)}`)
    if (filtros.centroId) cond.push(`e.CENTROID = ${bind(filtros.centroId)}`)

    // EXISTS y no join: basta con que ALGUNA participación cumpla, sin multiplicar filas.
    const condCiclo: string[] = []
    if (filtros.anio) condCiclo.push(`pa.ANIO = ${bind(filtros.anio)}`)
    if (filtros.procesoId) condCiclo.push(`pa.PROCESOID = ${bind(filtros.procesoId)}`)
    if (filtros.rolEvaluadorId) condCiclo.push(`pa.ROLEVALUADORID = ${bind(filtros.rolEvaluadorId)}`)
    if (filtros.areaId) condCiclo.push(`pa.AREAID = ${bind(filtros.areaId)}`)
    if (filtros.estadoCodigo) {
      condCiclo.push(`es.CODIGO = ${bind(filtros.estadoCodigo.trim().toUpperCase())}`)
    }
    if (condCiclo.length) {
      cond.push(`EXISTS (SELECT 1 FROM EVALUADORPARTICIPACION pa
                          LEFT JOIN ESTADOPARTICIPACION es ON es.ESTADOPARTID = pa.ESTADOPARTID
                         WHERE pa.EVALUADORID = e.EVALUADORID AND ${condCiclo.join(' AND ')})`)
    }

    // Contra null, no por truthiness: `false` significa "solo los que SÍ la tienen".
    if (filtros.sinCedula != null) {
      const tieneCedula = `EXISTS (SELECT 1 FROM EVALUADORDOCUMENTO d
                                    JOIN TIPODOCUMENTOEVAL t ON t.TIPODOCUMENTOEVALID = d.TIPODOCUMENTOEVALID
                                   WHERE d.EVALUADORID = e.EVALUADORID AND UPPER(t.CODIGO) = 'CEDULA')`
      cond.push(filtros.sinCedula ? `NOT ${tieneCedula}` : tieneCedula)
    }
    if (filtros.sinFoto != null) {
      // Mismo criterio que "tieneFoto": una foto vacía cuenta como que no hay foto.
      const conFoto = 'NVL(DBMS_LOB.GETLENGTH(e.EVALUADORFOTO), 0) > 0'
      cond.push(filtros.sinFoto ? `NOT (${conFoto})` : conFoto)
    }

    if (filtros.pruebaVigente != null) {
      cond.push(filtros.pruebaVigente ? PRUEBA_VIGENTE : `NOT ${PRUEBA_VIGENTE}`)
    }

    const where = `WHERE ${cond.join(' AND ')}`

    const totalRows: Array<{ T: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS "T"
         FROM EVALUADOR e
         JOIN PERSONA p ON p.PERSONAID = e.PERSONAID
        ${where}`,
      params,
    )
    const total = Number(totalRows[0]?.T ?? 0)

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT e.EVALUADORID                  AS "evaluadorId",
              e.PERSONAID                    AS "personaId",
              TRIM(p.PERSONAIDENTIFICACION)  AS "identificacion",
              TRIM(p.PERSONANOMBRES)         AS "nombres",
              TRIM(p.PERSONAPRIMERAPELLIDO)  AS "primerApellido",
              TRIM(p.PERSONASEGUNDOAPELLIDO) AS "segundoApellido",
              TRIM(p.PERSONAEMAIL)           AS "email",
              TRIM(e.EVALUADORCARGO)         AS "cargo",
              TRIM(e.EVALUADORPROFESION)     AS "profesion",
              e.EVALUADORACTIVO              AS "activo",
              TRIM(r.REGIONALNOMBRE)         AS "regionalNombre",
              -- Se exigen BYTES: una foto a medias deja un BLOB vacío, no nulo.
              CASE WHEN NVL(DBMS_LOB.GETLENGTH(e.EVALUADORFOTO), 0) > 0
                   THEN 1 ELSE 0 END          AS "tieneFoto",
              (SELECT COUNT(*) FROM EVALUADORPARTICIPACION pa
                WHERE pa.EVALUADORID = e.EVALUADORID)            AS "totalCiclos",
              (SELECT MAX(pa.ANIO) FROM EVALUADORPARTICIPACION pa
                WHERE pa.EVALUADORID = e.EVALUADORID)            AS "ultimoAnio",
              (SELECT COUNT(*) FROM EVALUADORPARTPROYECTO pp
                 JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = pp.PARTICIPACIONID
                WHERE pa.EVALUADORID = e.EVALUADORID)            AS "totalProyectos",
              (SELECT ROUND(AVG(rr.PROMEDIO), 2) FROM RETRORESPUESTA rr
                 JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = rr.PARTEVALUADOID
                 LEFT JOIN ESTADOPARTICIPACION es ON es.ESTADOPARTID = pa.ESTADOPARTID
                WHERE pa.EVALUADORID = e.EVALUADORID
                  AND NVL(es.ESNEGATIVO, 0) = 0)                 AS "promedioRetro",
              CASE WHEN EXISTS (SELECT 1 FROM EVALUADORDOCUMENTO d
                                  JOIN TIPODOCUMENTOEVAL t ON t.TIPODOCUMENTOEVALID = d.TIPODOCUMENTOEVALID
                                 WHERE d.EVALUADORID = e.EVALUADORID AND UPPER(t.CODIGO) = 'CEDULA')
                   THEN 1 ELSE 0 END                             AS "tieneCedula",
              CASE WHEN ${PRUEBA_VIGENTE}
                   THEN 1 ELSE 0 END                             AS "pruebaVigente"
         FROM EVALUADOR e
         JOIN PERSONA   p ON p.PERSONAID  = e.PERSONAID
         LEFT JOIN REGIONAL r ON r.REGIONALID = e.REGIONALID
         ${where}
         ORDER BY p.PERSONAPRIMERAPELLIDO, p.PERSONANOMBRES, e.EVALUADORID
         OFFSET ${offset} ROWS FETCH NEXT ${tamPag} ROWS ONLY`,
      params,
    )

    // Campo por campo y no spread: el tipo de retorno es el contrato de la tarjeta.
    const texto = (v: unknown) => (v == null ? null : String(v))
    const items: EvaluadorListaItem[] = rows.map(r => ({
      evaluadorId: Number(r.evaluadorId),
      personaId: Number(r.personaId),
      identificacion: texto(r.identificacion),
      nombres: texto(r.nombres),
      primerApellido: texto(r.primerApellido),
      segundoApellido: texto(r.segundoApellido),
      email: texto(r.email),
      cargo: texto(r.cargo),
      profesion: texto(r.profesion),
      regionalNombre: texto(r.regionalNombre),
      activo: Number(r.activo) === 1,
      tieneFoto: Number(r.tieneFoto) === 1,
      tieneCedula: Number(r.tieneCedula) === 1,
      pruebaVigente: Number(r.pruebaVigente) === 1,
      totalCiclos: Number(r.totalCiclos ?? 0),
      totalProyectos: Number(r.totalProyectos ?? 0),
      ultimoAnio: r.ultimoAnio != null ? Number(r.ultimoAnio) : null,
      promedioRetro: r.promedioRetro != null ? Number(r.promedioRetro) : null,
      ciclos: [],
    }))

    // Los chips de años: una consulta para toda la página, no una por tarjeta.
    if (items.length) {
      const porEvaluador = new Map<number, CicloResumido[]>()
      for (const bloque of enBloques(items.map(i => i.evaluadorId))) {
        const marcadores = bloque.map((_, i) => `:${i + 1}`).join(',')
        // Puede haber dos ciclos del mismo año: sin el desempate el chip cambia entre recargas.
        const ciclos: Array<Record<string, unknown>> = await this.dataSource.query(
          `SELECT * FROM (
             SELECT pa.EVALUADORID AS "evaluadorId", pa.ANIO AS "anio",
                    pa.PARTICIPACIONID AS "participacionId",
                    TRIM(es.CODIGO) AS "estadoCodigo", TRIM(es.COLOR) AS "estadoColor",
                    ROW_NUMBER() OVER (PARTITION BY pa.EVALUADORID
                                       ORDER BY pa.ANIO DESC, pa.PARTICIPACIONID DESC) AS rn
               FROM EVALUADORPARTICIPACION pa
               LEFT JOIN ESTADOPARTICIPACION es ON es.ESTADOPARTID = pa.ESTADOPARTID
              WHERE pa.EVALUADORID IN (${marcadores})
           ) WHERE rn <= 3
           ORDER BY "evaluadorId", rn`,
          bloque,
        )
        for (const c of ciclos) {
          const id = Number(c.evaluadorId)
          if (!porEvaluador.has(id)) porEvaluador.set(id, [])
          porEvaluador.get(id)!.push({
            participacionId: Number(c.participacionId),
            anio: Number(c.anio),
            estadoCodigo: (c.estadoCodigo as string | null) ?? null,
            estadoColor: (c.estadoColor as string | null) ?? null,
          })
        }
      }
      for (const it of items) it.ciclos = porEvaluador.get(it.evaluadorId) ?? []
    }

    return { items, total, page: pagina, limit: tamPag }
  }

  async getFicha(evaluadorId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT e.EVALUADORID                   AS "evaluadorId",
              e.PERSONAID                     AS "personaId",
              e.CENTROID                      AS "centroId",
              e.REGIONALID                    AS "regionalId",
              TRIM(e.EVALUADORCARGO)          AS "cargo",
              TRIM(e.EVALUADORPROFESION)      AS "profesion",
              TRIM(e.EVALUADORPOSGRADO)       AS "posgrado",
              TRIM(e.EVALUADORJEFENOMBRE)     AS "jefeNombre",
              TRIM(e.EVALUADORJEFEEMAIL)      AS "jefeEmail",
              TRIM(e.EVALUADORJEFECARGO)      AS "jefeCargo",
              e.EVALUADORMUNICIPIOID          AS "municipioId",
              e.EVALUADORACTIVO               AS "activo",
              -- Sin bytes no hay foto que mostrar.
              CASE WHEN NVL(DBMS_LOB.GETLENGTH(e.EVALUADORFOTO), 0) > 0
                   THEN 1 ELSE 0 END           AS "tieneFoto",
              TRIM(p.PERSONAIDENTIFICACION)   AS "identificacion",
              p.TIPODOCUMENTOIDENTIDADID      AS "tipoDocumentoIdentidadId",
              TRIM(p.PERSONANOMBRES)          AS "nombres",
              TRIM(p.PERSONAPRIMERAPELLIDO)   AS "primerApellido",
              TRIM(p.PERSONASEGUNDOAPELLIDO)  AS "segundoApellido",
              TRIM(p.PERSONAEMAIL)            AS "email",
              TRIM(p.PERSONAEMAILINSTITUCIONAL) AS "emailInstitucional",
              TRIM(p.PERSONACELULAR)          AS "celular",
              p.CIUDADID                      AS "ciudadId",
              TRIM(r.REGIONALNOMBRE)          AS "regionalNombre",
              TRIM(cf.CENTRONOMBRE)           AS "centroNombre",
              TRIM(mu.CIUDADNOMBRE)           AS "municipioNombre",
              TRIM(dmu.DEPARTAMENTONOMBRE)    AS "municipioDeptoNombre"
         FROM EVALUADOR e
         JOIN      PERSONA         p   ON p.PERSONAID   = e.PERSONAID
         LEFT JOIN REGIONAL        r   ON r.REGIONALID  = e.REGIONALID
         LEFT JOIN CENTROFORMACION cf  ON cf.CENTROID   = e.CENTROID
         LEFT JOIN CIUDAD          mu  ON mu.CIUDADID   = e.EVALUADORMUNICIPIOID
         LEFT JOIN DEPARTAMENTO    dmu ON dmu.DEPARTAMENTOID = mu.DEPARTAMENTOID
        WHERE e.EVALUADORID = :1`,
      [evaluadorId],
    )
    if (!rows[0]) throw new NotFoundException('Evaluador no encontrado')
    const r = rows[0]
    // Leer CLOB explícitamente
    let otrosEstudios: string | null = null
    if (r.otrosEstudios && typeof (r.otrosEstudios as { read?: () => unknown }).read === 'function') {
      otrosEstudios = await new Promise<string>((resolve, reject) => {
        const lob = r.otrosEstudios as NodeJS.ReadableStream
        let s = ''
        lob.setEncoding?.('utf8')
        lob.on('data', (c) => { s += c })
        lob.on('end', () => resolve(s))
        lob.on('error', reject)
      })
    } else if (typeof r.otrosEstudios === 'string') {
      otrosEstudios = r.otrosEstudios
    }
    return {
      ...r,
      otrosEstudios,
      tieneFoto: Number(r.tieneFoto) === 1,
      activo: Number(r.activo),
    }
  }

  // Crear / Actualizar / Desactivar

  async crear(dto: EvaluadorCrearDto) {
    if (!dto.identificacion?.trim()) throw new BadRequestException('Identificación requerida')
    if (!dto.nombres?.trim() || !dto.primerApellido?.trim()) {
      throw new BadRequestException('Nombres y primer apellido son obligatorios')
    }
    if (!dto.email?.trim()) throw new BadRequestException('Correo requerido')
    if (!dto.emailInstitucional?.trim()) throw new BadRequestException('Correo institucional requerido')
    if (!dto.tipoDocumentoIdentidadId) throw new BadRequestException('Tipo de documento requerido')

    const ident = dto.identificacion.trim()

    const qr = this.dataSource.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      // TRIM porque PERSONAIDENTIFICACION es NCHAR(20) y rellena con espacios.
      let personaId: number
      const existente: Array<{ id: number }> = await qr.query(
        `SELECT PERSONAID AS "id" FROM PERSONA WHERE TRIM(PERSONAIDENTIFICACION) = :1`,
        [ident],
      )
      if (existente[0]) {
        personaId = Number(existente[0].id)
        const yaEval: Array<{ id: number }> = await qr.query(
          `SELECT EVALUADORID AS "id" FROM EVALUADOR WHERE PERSONAID = :1`,
          [personaId],
        )
        if (yaEval[0]) {
          throw new ConflictException('Esta persona ya está registrada como evaluador')
        }
      } else {
        const seq: Array<{ NEXTVAL: number }> = await qr.query(`SELECT PERSONAID.NEXTVAL FROM dual`)
        personaId = Number(seq[0].NEXTVAL)
        // Title Case solo en nombres y apellidos.
        const nombres = aTitleCase(dto.nombres) ?? ''
        const primerApellido = aTitleCase(dto.primerApellido) ?? ''
        const segundoApellido = aTitleCase(dto.segundoApellido) ?? ''
        await qr.query(
          `INSERT INTO PERSONA
             (PERSONAID, TIPODOCUMENTOIDENTIDADID, PERSONANOMBRES, PERSONAPRIMERAPELLIDO,
              PERSONASEGUNDOAPELLIDO, PERSONAIDENTIFICACION, PERSONAEMAIL, PERSONAEMAILINSTITUCIONAL,
              PERSONACELULAR, PERSONAFECHAREGISTRO, GENEROID, CIUDADID, PERSONAHABEASDATA, PERSONAHABEASDATAE)
           VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, SYSDATE, 3, :10, 'SI', 'NA')`,
          [
            personaId,
            dto.tipoDocumentoIdentidadId,
            nombres,
            primerApellido,
            segundoApellido,
            ident,
            dto.email.trim().toLowerCase(),
            (dto.emailInstitucional ?? '').trim() || null,
            (dto.celular ?? '').trim() || null,
            dto.ciudadId ?? 1,
          ],
        )
      }

      const seqE: Array<{ NEXTVAL: number }> = await qr.query(`SELECT EVALUADOR_SEQ.NEXTVAL FROM dual`)
      const evaluadorId = Number(seqE[0].NEXTVAL)
      // EVALUADORJEFEDIR, EVALUADORQUIENAPRUEBA y EVALUADOROTROSEST se dropearon en la v36.
      await qr.query(
        `INSERT INTO EVALUADOR
           (EVALUADORID, PERSONAID, CENTROID, REGIONALID, EVALUADORCARGO, EVALUADORPROFESION,
            EVALUADORPOSGRADO,
            EVALUADORJEFENOMBRE, EVALUADORJEFEEMAIL, EVALUADORJEFECARGO, EVALUADORMUNICIPIOID,
            EVALUADORACTIVO, FECHACREACION)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, 1, SYSDATE)`,
        [
          evaluadorId, personaId,
          dto.centroId ?? null, dto.regionalId ?? null,
          (dto.cargo ?? '').trim() || null,
          (dto.profesion ?? '').trim() || null,
          (dto.posgrado ?? '').trim() || null,
          aTitleCase(dto.jefeNombre) || null,
          (dto.jefeEmail ?? '').trim().toLowerCase() || null,
          (dto.jefeCargo ?? '').trim() || null,
          dto.municipioId ?? null,
        ],
      )

      // Misma transacción que el evaluador, y con el correo institucional si lo hay.
      const acceso = await this.provisionarCuenta(qr, {
        email: ((dto.emailInstitucional ?? '').trim() || (dto.email ?? '').trim()).toLowerCase(),
        emailAlterno: (dto.email ?? '').trim().toLowerCase(),
        claveInicial: dto.claveInicial,
      })

      await qr.commitTransaction()
      return {
        evaluadorId, personaId,
        acceso,
        message: acceso.claveInicial
          ? 'Evaluador creado con cuenta de acceso'
          : 'Evaluador creado',
      }
    } catch (err) {
      await qr.rollbackTransaction()
      throw err
    } finally {
      await qr.release()
    }
  }

  /** Si la persona ya entra al SEP no se toca su clave: solo se le suma el perfil 9. */
  private async provisionarCuenta(
    qr: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    datos: { email: string; emailAlterno?: string; claveInicial?: string },
  ): Promise<{
    creada: boolean
    perfilAgregado: boolean
    usuarioId: number | null
    claveInicial: string | null
    /** Con el que quedó la cuenta: el login compara exacto contra USUARIOEMAIL. */
    email: string | null
    detalle: string
  }> {
    const email = datos.email
    if (!email) {
      return {
        creada: false, perfilAgregado: false, usuarioId: null, claveInicial: null,
        email: null,
        detalle: 'Sin correo: no se creó cuenta de acceso.',
      }
    }

    // Por los DOS correos: quien ya entra con el personal no debe quedar con dos cuentas.
    const correos = [email, (datos.emailAlterno ?? '').trim().toLowerCase()]
      .filter(Boolean)
      .filter((c, i, a) => a.indexOf(c) === i)
    const marcadores = correos.map((_, i) => `:${i + 1}`).join(',')
    // Se trae el correo porque la cuenta vieja puede estar bajo el personal.
    const existentes = (await qr.query(
      `SELECT USUARIOID AS "id", TRIM(USUARIOEMAIL) AS "email" FROM USUARIO
        WHERE LOWER(TRIM(USUARIOEMAIL)) IN (${marcadores})
        ORDER BY USUARIOID`,
      correos,
    )) as Array<{ id: number; email: string }>

    if (existentes[0]) {
      const usuarioId = Number(existentes[0].id)
      const correoCuenta = (existentes[0].email ?? '').trim()
      const yaTiene = (await qr.query(
        `SELECT USUARIOPERFILID AS "id", ESTADO AS "estado"
           FROM USUARIOPERFIL WHERE USUARIOID = :1 AND PERFILID = :2`,
        [usuarioId, PERFIL_EVALUADOR],
      )) as Array<{ id: number; estado: number }>

      if (yaTiene[0] && Number(yaTiene[0].estado) === 1) {
        return {
          creada: false, perfilAgregado: false, usuarioId, claveInicial: null,
          email: correoCuenta,
          detalle: `La persona ya tenía cuenta con el perfil de evaluador. Entra con ${correoCuenta} y su clave de siempre.`,
        }
      }
      if (yaTiene[0]) {
        await qr.query(
          `UPDATE USUARIOPERFIL SET ESTADO = 1 WHERE USUARIOPERFILID = :1`,
          [Number(yaTiene[0].id)],
        )
        return {
          creada: false, perfilAgregado: true, usuarioId, claveInicial: null,
          email: correoCuenta,
          detalle: `Se reactivó el perfil de evaluador en su cuenta existente (${correoCuenta}). Conserva su clave.`,
        }
      }

      // Perfil adicional, no predeterminado: ya usa el sistema para otra cosa.
      await qr.query(
        `INSERT INTO USUARIOPERFIL
           (USUARIOPERFILID, USUARIOID, PERFILID, PREDETERMINADO, ESTADO, FECHACREACION)
         VALUES (USUARIOPERFIL_SEQ.NEXTVAL, :1, :2, 0, 1, SYSDATE)`,
        [usuarioId, PERFIL_EVALUADOR],
      )
      return {
        creada: false, perfilAgregado: true, usuarioId, claveInicial: null,
        email: correoCuenta,
        detalle: `La persona ya tenía cuenta (${correoCuenta}); se le agregó el perfil de evaluador. Conserva su clave.`,
      }
    }

    const clave = (datos.claveInicial ?? '').trim() || generarClaveInicial()
    if (clave.length < 6) throw new BadRequestException('La clave inicial debe tener al menos 6 caracteres')

    const llave = generarLlaveEncriptacion()
    const seq = (await qr.query(`SELECT USUARIOID.NEXTVAL FROM dual`)) as Array<{ NEXTVAL: number }>
    const usuarioId = Number(seq[0].NEXTVAL)

    await qr.query(
      `INSERT INTO USUARIO
         (USUARIOID, PERFILID, USUARIOCLAVE, USUARIOFECHAREGISTRO, USUARIOESTADO,
          USUARIOTIPO, USUARIOEMAIL, USUARIOLLAVEENCRIPTACION)
       VALUES (:1, :2, :3, SYSDATE, 1, 1, :4, :5)`,
      [usuarioId, PERFIL_EVALUADOR, cifrarClave(clave, llave), email, llave],
    )
    await qr.query(
      `INSERT INTO USUARIOPERFIL
         (USUARIOPERFILID, USUARIOID, PERFILID, PREDETERMINADO, ESTADO, FECHACREACION)
       VALUES (USUARIOPERFIL_SEQ.NEXTVAL, :1, :2, 1, 1, SYSDATE)`,
      [usuarioId, PERFIL_EVALUADOR],
    )

    return {
      creada: true, perfilAgregado: true, usuarioId, claveInicial: clave,
      email,
      detalle: 'Cuenta creada. La clave se muestra una sola vez: entrégasela al evaluador.',
    }
  }

  async actualizar(evaluadorId: number, dto: EvaluadorActualizarDto) {
    const filas: Array<{ personaId: number }> = await this.dataSource.query(
      `SELECT PERSONAID AS "personaId" FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId],
    )
    if (!filas[0]) throw new NotFoundException('Evaluador no encontrado')
    const personaId = Number(filas[0].personaId)

    const qr = this.dataSource.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      // EVALUADOR. Los campos legacy no se mapean: sus columnas se dropearon en la v36.
      const setsEval: string[] = []
      const paramsEval: unknown[] = []
      const mapEval: Array<[keyof EvaluadorActualizarDto, string]> = [
        ['centroId',      'CENTROID'],
        ['regionalId',    'REGIONALID'],
        ['cargo',         'EVALUADORCARGO'],
        ['profesion',     'EVALUADORPROFESION'],
        ['posgrado',      'EVALUADORPOSGRADO'],
        ['jefeNombre',    'EVALUADORJEFENOMBRE'],
        ['jefeEmail',     'EVALUADORJEFEEMAIL'],
        ['jefeCargo',     'EVALUADORJEFECARGO'],
        ['municipioId',   'EVALUADORMUNICIPIOID'],
      ]
      const CAMPOS_ID_NUMERICOS = new Set<keyof EvaluadorActualizarDto>([
        'centroId', 'regionalId', 'municipioId',
      ])
      for (const [k, col] of mapEval) {
        if (dto[k] !== undefined) {
          const val = dto[k]
          let bind: unknown
          if (k === 'jefeNombre') {
            bind = aTitleCase(val as string | null | undefined)
          } else if (k === 'jefeEmail') {
            bind = typeof val === 'string' ? (val.trim().toLowerCase() || null) : val
          } else if (CAMPOS_ID_NUMERICOS.has(k)) {
            // Coerción explícita: acepta number, "123" numérico o null.
            bind = val == null || val === '' ? null : Number(val)
            if (bind !== null && !Number.isFinite(bind as number)) {
              throw new BadRequestException(`${k} debe ser numérico`)
            }
          } else {
            bind = typeof val === 'string' ? (val.trim() || null) : val
          }
          paramsEval.push(bind)
          setsEval.push(`${col} = :${paramsEval.length}`)
        }
      }
      if (setsEval.length > 0) {
        paramsEval.push(evaluadorId)
        await qr.query(
          `UPDATE EVALUADOR SET ${setsEval.join(', ')} WHERE EVALUADORID = :${paramsEval.length}`,
          paramsEval,
        )
      }

      // PERSONA
      const CAMPOS_NOMBRE: ReadonlySet<keyof EvaluadorActualizarDto> = new Set([
        'nombres', 'primerApellido', 'segundoApellido',
      ])
      const setsPer: string[] = []
      const paramsPer: unknown[] = []
      const mapPer: Array<[keyof EvaluadorActualizarDto, string]> = [
        ['nombres',            'PERSONANOMBRES'],
        ['primerApellido',     'PERSONAPRIMERAPELLIDO'],
        ['segundoApellido',    'PERSONASEGUNDOAPELLIDO'],
        ['email',              'PERSONAEMAIL'],
        ['emailInstitucional', 'PERSONAEMAILINSTITUCIONAL'],
        ['celular',            'PERSONACELULAR'],
      ]
      for (const [k, col] of mapPer) {
        if (dto[k] !== undefined) {
          const val = dto[k]
          let bind: unknown
          if (CAMPOS_NOMBRE.has(k)) {
            bind = aTitleCase(val as string | null | undefined)
          } else {
            bind = typeof val === 'string' ? (val.trim() || null) : val
          }
          paramsPer.push(bind)
          setsPer.push(`${col} = :${paramsPer.length}`)
        }
      }
      if (setsPer.length > 0) {
        paramsPer.push(personaId)
        await qr.query(
          `UPDATE PERSONA SET ${setsPer.join(', ')} WHERE PERSONAID = :${paramsPer.length}`,
          paramsPer,
        )
      }

      if (setsEval.length === 0 && setsPer.length === 0) {
        await qr.rollbackTransaction()
        return { message: 'Sin cambios' }
      }

      await qr.commitTransaction()
      return { message: 'Evaluador actualizado' }
    } catch (err) {
      await qr.rollbackTransaction()
      throw err
    } finally {
      await qr.release()
    }
  }

  async cambiarEstado(evaluadorId: number, activo: boolean) {
    const ok = await this.dataSource.query(`SELECT 1 FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId])
    if (!ok[0]) throw new NotFoundException('Evaluador no encontrado')
    await this.dataSource.query(
      `UPDATE EVALUADOR SET EVALUADORACTIVO = :1 WHERE EVALUADORID = :2`,
      [activo ? 1 : 0, evaluadorId],
    )
    return { message: activo ? 'Evaluador activado' : 'Evaluador desactivado' }
  }

  // Foto

  async subirFoto(evaluadorId: number, file: MulterFile) {
    if (!file?.buffer) throw new BadRequestException('Adjunta una imagen en el campo "archivo"')
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Solo se permiten imágenes (JPG, PNG)')
    }
    const ok = await this.dataSource.query(`SELECT 1 FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId])
    if (!ok[0]) throw new NotFoundException('Evaluador no encontrado')

    // Se revisa el contenido, no la extensión ni el mime que anuncia el navegador.
    if (file.buffer.length === 0) {
      throw new BadRequestException(
        'El archivo llegó vacío. Revisa que la imagen abra en tu equipo y vuelve a cargarla.',
      )
    }
    const mimeReal = mimeRealDeImagen(file.buffer)
    if (!mimeReal) {
      throw new BadRequestException(
        'El archivo no es una imagen (JPG, PNG, GIF, BMP o WebP). ' +
        'Si le cambiaste la extensión a mano, vuelve a exportarla como JPG o PNG.',
      )
    }

    const nombre = (file.originalname ?? '').toString().trim().slice(0, 255) || null

    // Miniatura y original en el mismo UPDATE, para que nunca queden desparejas.
    if (this.hayColumnaMiniatura) {
      const mini = await miniaturaDeFoto(file.buffer)
      try {
        await this.dataSource.query(
          `UPDATE EVALUADOR
              SET EVALUADORFOTO = :1, EVALUADORFOTOMIME = :2,
                  EVALUADORFOTONOMBRE = :3, EVALUADORFOTOMINI = :4
            WHERE EVALUADORID = :5`,
          [file.buffer, mimeReal, nombre, mini, evaluadorId],
        )
        return { message: 'Foto actualizada', size: file.size, mime: mimeReal, nombre }
      } catch (e) {
        if (!this.faltaLaColumnaMiniatura(e)) throw e
      }
    }

    await this.dataSource.query(
      `UPDATE EVALUADOR
          SET EVALUADORFOTO = :1, EVALUADORFOTOMIME = :2, EVALUADORFOTONOMBRE = :3
        WHERE EVALUADORID = :4`,
      [file.buffer, mimeReal, nombre, evaluadorId],
    )
    return { message: 'Foto actualizada', size: file.size, mime: mimeReal, nombre }
  }

  async getFoto(evaluadorId: number): Promise<{ buffer: Buffer; mime: string; nombre: string | null }> {
    const rows: Array<{
      foto: NodeJS.ReadableStream | Buffer | null;
      mime: string | null;
      nombre: string | null;
    }> = await this.dataSource.query(
      `SELECT EVALUADORFOTO           AS "foto",
              TRIM(EVALUADORFOTOMIME) AS "mime",
              EVALUADORFOTONOMBRE     AS "nombre"
         FROM EVALUADOR WHERE EVALUADORID = :1`,
      [evaluadorId],
    )
    const r = rows[0]
    if (!r || !r.foto) throw new NotFoundException('Foto no encontrada')
    const buffer = await this.lobToBuffer(r.foto)

    // Un 200 con cero bytes no se ve ni da error; un 404 con motivo sí.
    if (buffer.length === 0) {
      this.log.warn(`Evaluador ${evaluadorId}: la foto está en la BD pero vacía (0 bytes)`)
      throw new NotFoundException(
        'La foto quedó guardada vacía. Vuelve a cargarla desde el perfil del evaluador.',
      )
    }

    // Se sirve igual por si es un formato que no conocemos, pero queda en el log.
    if (!empiezaComoImagen(buffer)) {
      this.log.warn(
        `Evaluador ${evaluadorId}: la foto no parece una imagen ` +
        `(mime=${r.mime ?? 'sin mime'}, ${buffer.length} bytes, ` +
        `empieza por ${buffer.subarray(0, 4).toString('hex').toUpperCase()})`,
      )
    }

    return { buffer, mime: r.mime || 'image/jpeg', nombre: r.nombre ?? null }
  }

  /** Foto en tamaño de pantalla. Si la fila no la tiene, se genera aquí y se guarda. */
  async getFotoMiniatura(evaluadorId: number): Promise<{ buffer: Buffer; mime: string; nombre: string | null }> {
    // Sin la columna de la v50 no hay más que servir la original.
    if (!this.hayColumnaMiniatura) return this.getFoto(evaluadorId)

    let rows: Array<{ mini: Buffer | null; nombre: string | null }>
    try {
      rows = await this.dataSource.query(
        `SELECT EVALUADORFOTOMINI AS "mini", EVALUADORFOTONOMBRE AS "nombre"
           FROM EVALUADOR WHERE EVALUADORID = :1`,
        [evaluadorId],
      )
    } catch (e) {
      if (!this.faltaLaColumnaMiniatura(e)) throw e
      return this.getFoto(evaluadorId)
    }

    const mini = rows[0]?.mini
    if (mini && mini.length > 0) {
      return { buffer: mini, mime: 'image/jpeg', nombre: rows[0].nombre ?? null }
    }

    // Sin miniatura: se parte de la original, que ya viene validada.
    const original = await this.getFoto(evaluadorId)
    const generada = await miniaturaDeFoto(original.buffer)
    if (!generada) return original  // no se pudo achicar: sirve la de siempre

    try {
      await this.dataSource.query(
        `UPDATE EVALUADOR SET EVALUADORFOTOMINI = :1 WHERE EVALUADORID = :2`,
        [generada, evaluadorId],
      )
    } catch (e) {
      // Guardarla es optimización: si falla, se vuelve a generar la próxima vez.
      this.log.warn(`No se pudo guardar la miniatura del evaluador ${evaluadorId}: ${(e as Error).message}`)
    }

    return { buffer: generada, mime: 'image/jpeg', nombre: original.nombre }
  }

  async borrarFoto(evaluadorId: number) {
    if (this.hayColumnaMiniatura) {
      try {
        await this.dataSource.query(
          `UPDATE EVALUADOR
              SET EVALUADORFOTO = NULL, EVALUADORFOTOMIME = NULL,
                  EVALUADORFOTONOMBRE = NULL, EVALUADORFOTOMINI = NULL
            WHERE EVALUADORID = :1`,
          [evaluadorId],
        )
        return { message: 'Foto eliminada' }
      } catch (e) {
        if (!this.faltaLaColumnaMiniatura(e)) throw e
      }
    }

    await this.dataSource.query(
      `UPDATE EVALUADOR
          SET EVALUADORFOTO = NULL, EVALUADORFOTOMIME = NULL, EVALUADORFOTONOMBRE = NULL
        WHERE EVALUADORID = :1`,
      [evaluadorId],
    )
    return { message: 'Foto eliminada' }
  }

  private async lobToBuffer(lob: NodeJS.ReadableStream | Buffer): Promise<Buffer> {
    if (Buffer.isBuffer(lob)) return lob
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      lob.on('data', (c: Buffer) => chunks.push(c))
      lob.on('end', () => resolve(Buffer.concat(chunks)))
      lob.on('error', reject)
    })
  }

  // Participaciones

  async listarParticipaciones(evaluadorId: number): Promise<Array<Record<string, unknown>>> {
    let rows: Array<Record<string, unknown>>
    try {
      rows = await this.consultarParticipaciones(evaluadorId, await this.columnaDinamizador())
    } catch (e) {
      // La consulta también nombra DINAMIZADOR, así que el reintento hace falta aquí.
      if (!this.faltaLaColumnaDinamizador(e)) throw e
      rows = await this.consultarParticipaciones(evaluadorId, false)
    }
    return this.mapearParticipaciones(rows)
  }

  private async consultarParticipaciones(
    evaluadorId: number, conDinamizador: boolean,
  ): Promise<Array<Record<string, unknown>>> {
    return this.dataSource.query(
      `SELECT pa.PARTICIPACIONID         AS "participacionId",
              pa.ANIO                    AS "anio",
              TRIM(pa.PERIODO)           AS "periodo",
              pa.ROLEVALUADORID          AS "rolEvaluadorId",
              TRIM(r.ROLEVALUADORNOMBRE) AS "rolNombre",
              pa.MODALIDADPARTID         AS "modalidadPartId",
              TRIM(mo.CODIGO)            AS "modalidadPart",
              TRIM(mo.NOMBRE)            AS "modalidadNombre",
              pa.PROCESOID               AS "procesoId",
              TRIM(pe.PROCESONOMBRE)     AS "procesoNombre",
              pa.ESTADOPARTID            AS "estadoPartId",
              TRIM(es.CODIGO)            AS "estadoCodigo",
              TRIM(es.NOMBRE)            AS "estadoNombre",
              NVL(es.ESNEGATIVO, 0)      AS "estadoNegativo",
              TRIM(pa.MOTIVONOPARTICIPA) AS "motivoNoParticipa",
              -- Los ids hacen falta para preseleccionar al editar.
              pa.CONVOCATORIAID          AS "convocatoriaId",
              pa.AREAID                  AS "areaId",
              TRIM(pa.MESA)              AS "mesa",
              TRIM(pa.EQUIPOEVALUADOR)   AS "equipoEvaluador",
              pa.DINAMIZADORPERSONAID    AS "dinamizadorPersonaId",
              -- TRIM externo: sin dinamizador la concatenación deja " " (NULLIF con '' daría ORA-12704)
              -- TO_NCHAR: DINAMIZADOR es VARCHAR2 y los nombres NVARCHAR2
              ${conDinamizador
                ? `TRIM(COALESCE(TO_NCHAR(pa.DINAMIZADOR),
                     TRIM(d.PERSONANOMBRES) || ' ' || TRIM(d.PERSONAPRIMERAPELLIDO)))`
                : `TRIM(TRIM(d.PERSONANOMBRES) || ' ' || TRIM(d.PERSONAPRIMERAPELLIDO))`}
                                         AS "dinamizadorNombre"
         FROM EVALUADORPARTICIPACION pa
         LEFT JOIN ROLEVALUADOR        r  ON r.ROLEVALUADORID  = pa.ROLEVALUADORID
         LEFT JOIN PROCESOEVAL         pe ON pe.PROCESOID      = pa.PROCESOID
         LEFT JOIN MODALIDADPART       mo ON mo.MODALIDADPARTID = pa.MODALIDADPARTID
         LEFT JOIN ESTADOPARTICIPACION es ON es.ESTADOPARTID   = pa.ESTADOPARTID
         LEFT JOIN PERSONA             d  ON d.PERSONAID       = pa.DINAMIZADORPERSONAID
        WHERE pa.EVALUADORID = :1
        ORDER BY pa.ANIO DESC, pa.PARTICIPACIONID DESC`,
      [evaluadorId],
    )
  }

  private mapearParticipaciones(rows: Array<Record<string, unknown>>) {
    return rows.map(r => ({
      ...r,
      participacionId: Number(r.participacionId),
      anio: Number(r.anio),
      // La columna PROCESOREVOCADO se dropeó en la v36: se deriva del estado.
      procesoRevocado: r.estadoCodigo === 'REVOCADO',
      estadoNegativo: Number(r.estadoNegativo) === 1,
    }))
  }

  /** Código de modalidad → id del catálogo; los ids cambian por entorno. */
  private async idModalidad(codigo?: string | null): Promise<number | null> {
    const c = (codigo ?? '').trim().toUpperCase()
    if (!c) return null
    const rows: Array<{ id: number }> = await this.dataSource.query(
      `SELECT MODALIDADPARTID AS "id" FROM MODALIDADPART WHERE UPPER(CODIGO) = :1`, [c],
    )
    if (!rows[0]) throw new BadRequestException(`Modalidad '${codigo}' no existe en el catálogo`)
    return Number(rows[0].id)
  }

  /** Id de un estado por código, para las escrituras que lo necesitan. */
  private async idEstado(codigo: string): Promise<number | null> {
    const rows: Array<{ id: number }> = await this.dataSource.query(
      `SELECT ESTADOPARTID AS "id" FROM ESTADOPARTICIPACION WHERE CODIGO = :1`, [codigo],
    )
    return rows[0] ? Number(rows[0].id) : null
  }

  async crearParticipacion(
    evaluadorId: number, dto: ParticipacionDto,
  ): Promise<{ participacionId: number; message: string }> {
    if (!dto.anio) throw new BadRequestException('Año requerido')
    const ok = await this.dataSource.query(`SELECT 1 FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId])
    if (!ok[0]) throw new NotFoundException('Evaluador no encontrado')

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT EVALUADORPARTICIPACION_SEQ.NEXTVAL FROM dual`,
    )
    const id = Number(seq[0].NEXTVAL)

    // Nace POSTULADO salvo que se pida revocarlo de entrada.
    const estadoId = await this.idEstado(dto.procesoRevocado ? 'REVOCADO' : 'POSTULADO')

    // DINAMIZADOR es de la v51: si no está, se inserta sin ella.
    const conDinamizador = await this.columnaDinamizador()
    try {
      await this.dataSource.query(
        `INSERT INTO EVALUADORPARTICIPACION
         (PARTICIPACIONID, EVALUADORID, ANIO, PERIODO, ROLEVALUADORID, MODALIDADPARTID,
          PROCESOID, ESTADOPARTID, CONVOCATORIAID, AREAID, ESTRANSVERSAL,
          MESA, EQUIPOEVALUADOR,${conDinamizador ? ' DINAMIZADOR,' : ''}
          DINAMIZADORPERSONAID, RETROALIMENTACION, OBSERVACIONES, USUARIOCREACION)
       VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13,${conDinamizador ? ' :14, :15, :16, :17, :18' : ' :14, :15, :16, :17'})`,
      [
        id, evaluadorId, dto.anio,
        dto.periodo?.trim() || null,
        dto.rolEvaluadorId ?? null,
        await this.idModalidad(dto.modalidadPart),
        dto.procesoId ?? null,
        estadoId,
        dto.convocatoriaId ?? null,
        dto.areaId ?? null,
        dto.esTransversal ? 1 : 0,
        dto.mesa?.trim() || null,
        dto.equipoEvaluador?.trim() || null,
        ...(conDinamizador ? [dto.dinamizador?.trim() || null] : []),
        dto.dinamizadorPersonaId ?? null,
        dto.retroalimentacion?.trim() || null,
        dto.observaciones?.trim() || null,
        dto.usuarioEmail ?? null,
        ],
      )
    } catch (e) {
      // Falta la v51: se reintenta sin el campo nuevo, una sola vez.
      if (conDinamizador && this.faltaLaColumnaDinamizador(e)) {
        return this.crearParticipacion(evaluadorId, dto)
      }
      // Sin esto, un campo largo sale como "Internal server error" sin decir cuál.
      traducirValorLargo(e, CAMPOS_PARTICIPACION)
      throw e
    }
    return { participacionId: id, message: 'Participación creada' }
  }

  async actualizarParticipacion(participacionId: number, dto: Partial<ParticipacionDto>) {
    const ok = await this.dataSource.query(
      `SELECT 1 FROM EVALUADORPARTICIPACION WHERE PARTICIPACIONID = :1`, [participacionId],
    )
    if (!ok[0]) throw new NotFoundException('Participación no encontrada')

    const sets: string[] = []
    const params: unknown[] = []
    const map: Array<[keyof ParticipacionDto, string, (v: unknown) => unknown]> = [
      ['anio',                 'ANIO',                  v => v],
      ['periodo',              'PERIODO',               v => (v as string)?.trim() || null],
      ['rolEvaluadorId',       'ROLEVALUADORID',        v => v ?? null],
      ['procesoId',            'PROCESOID',             v => v ?? null],
      ['convocatoriaId',       'CONVOCATORIAID',        v => v ?? null],
      ['areaId',               'AREAID',                v => v ?? null],
      ['esTransversal',        'ESTRANSVERSAL',         v => (v ? 1 : 0)],
      ['mesa',                 'MESA',                  v => (v as string)?.trim() || null],
      ['equipoEvaluador',      'EQUIPOEVALUADOR',       v => (v as string)?.trim() || null],
      ['dinamizador',          'DINAMIZADOR',           v => (v as string)?.trim() || null],
      ['dinamizadorPersonaId', 'DINAMIZADORPERSONAID',  v => v ?? null],
      ['retroalimentacion',    'RETROALIMENTACION',     v => (v as string)?.trim() || null],
      ['observaciones',        'OBSERVACIONES',         v => (v as string)?.trim() || null],
    ]
    for (const [k, col, transform] of map) {
      if (dto[k] !== undefined) {
        params.push(transform(dto[k]))
        sets.push(`${col} = :${params.length}`)
      }
    }

    // Fuera del mapa: la modalidad llega como código y hay que ir al catálogo.
    if (dto.modalidadPart !== undefined) {
      params.push(await this.idModalidad(dto.modalidadPart))
      sets.push(`MODALIDADPARTID = :${params.length}`)
    }

    // Compatibilidad: mueve el estado. Lo demás va por cambiarEstadoParticipacion().
    if (dto.procesoRevocado !== undefined) {
      const estadoId = await this.idEstado(dto.procesoRevocado ? 'REVOCADO' : 'POSTULADO')
      params.push(estadoId)
      sets.push(`ESTADOPARTID = :${params.length}`)
    }

    if (sets.length === 0) return { message: 'Sin cambios' }
    params.push(participacionId)
    try {
      await this.dataSource.query(
        `UPDATE EVALUADORPARTICIPACION SET ${sets.join(', ')} WHERE PARTICIPACIONID = :${params.length}`,
        params,
      )
    } catch (e) {
      // Igual que al crear: si no, no se sabe qué campo se pasó de largo.
      traducirValorLargo(e, CAMPOS_PARTICIPACION)
      throw e
    }
    return { message: 'Participación actualizada' }
  }

  /** Si el ciclo tiene historia colgando responde 409; solo el admin puede forzar. */
  async eliminarParticipacion(
    participacionId: number,
    opciones: { forzar?: boolean; usuarioEmail?: string; usuarioPerfilId?: number } = {},
  ) {
    const cabecera = await this.dataSource.query(
      `SELECT EVALUADORID AS "evaluadorId", ANIO AS "anio"
         FROM EVALUADORPARTICIPACION WHERE PARTICIPACIONID = :1`,
      [participacionId],
    )
    if (!cabecera[0]) throw new NotFoundException('Participación no encontrada')

    const dependencias = await this.contarDependenciasParticipacion(participacionId)
    const conDatos = Object.entries(dependencias).filter(([, v]) => v > 0)

    // No se puede forzar: SEP_APP no tiene DELETE sobre EVALUADORCERTIFICADO (v37).
    if ((dependencias['certificados'] ?? 0) > 0) {
      throw new ConflictException(
        `No se puede eliminar: el ciclo ${cabecera[0].anio} tiene certificados emitidos, ` +
        'y esos no se borran ni forzando. Anule el certificado y cambie el estado del ciclo.',
      )
    }

    if (conDatos.length > 0 && !opciones.forzar) {
      const detalle = conDatos.map(([k, v]) => `${v} ${k}`).join(', ')
      throw new ConflictException(
        `No se puede eliminar: el ciclo ${cabecera[0].anio} ya tiene ${detalle}. ` +
        `Cambie el estado a REVOCADO o DECLINO en vez de borrarlo, para no perder la historia.`,
      )
    }

    // Con forzar = true (admin) se limpian los hijos en orden de dependencia.
    if (conDatos.length > 0) {
      // oracledb cuenta cada aparición de un placeholder como un bind distinto.
      const par = [participacionId, participacionId]
      await this.dataSource.transaction(async manager => {
        await manager.query(
          `DELETE FROM RETRORESPUESTAITEM WHERE RETRORESPUESTAID IN
             (SELECT RETRORESPUESTAID FROM RETRORESPUESTA
               WHERE PARTEVALUADORID = :1 OR PARTEVALUADOID = :2)`, par)
        await manager.query(
          `UPDATE RETROASIGNACION SET RETRORESPUESTAID = NULL
            WHERE PARTEVALUADORID = :1 OR PARTEVALUADOID = :2`, par)
        await manager.query(
          `DELETE FROM RETRORESPUESTA WHERE PARTEVALUADORID = :1 OR PARTEVALUADOID = :2`, par)
        await manager.query(
          `DELETE FROM RETROASIGNACION WHERE PARTEVALUADORID = :1 OR PARTEVALUADOID = :2`, par)
        await manager.query(
          `DELETE FROM RETROSUGERENCIA WHERE PARTICIPACIONID = :1`, [participacionId])
        await manager.query(
          `DELETE FROM RETROSESION WHERE PARTICIPACIONID = :1`, [participacionId])
        await manager.query(
          `DELETE FROM EVALUADORPARTPROYECTO WHERE PARTICIPACIONID = :1`, [participacionId])
        await manager.query(
          `DELETE FROM EVALUADORCAPACITACION WHERE PARTICIPACIONID = :1`, [participacionId])
        await manager.query(
          `DELETE FROM EVALUADORAPROBACION WHERE PARTICIPACIONID = :1`, [participacionId])
        await manager.query(
          `DELETE FROM EVALUADORPARTGRUPO WHERE PARTICIPACIONID = :1`, [participacionId])
        await manager.query(
          `DELETE FROM EVALUADORPARTALCANCE WHERE PARTICIPACIONID = :1`, [participacionId])
        // Pruebas y documentos son del evaluador, no del ciclo: se desatan.
        await manager.query(
          `UPDATE EVALUADORPRUEBA SET PARTICIPACIONID = NULL WHERE PARTICIPACIONID = :1`, [participacionId])
        await manager.query(
          `UPDATE EVALUADORDOCUMENTO SET PARTICIPACIONID = NULL WHERE PARTICIPACIONID = :1`, [participacionId])
        await manager.query(
          `DELETE FROM EVALUADORPARTICIPACION WHERE PARTICIPACIONID = :1`, [participacionId])
      })
    } else {
      await this.dataSource.query(
        `DELETE FROM EVALUADORPARTICIPACION WHERE PARTICIPACIONID = :1`, [participacionId],
      )
    }

    await this.auditoria.registrar({
      tabla: 'EVALUADORPARTICIPACION',
      operacion: 'DELETE',
      registroId: participacionId,
      evaluadorId: Number(cabecera[0].evaluadorId),
      usuarioEmail: opciones.usuarioEmail ?? 'desconocido',
      usuarioPerfilId: opciones.usuarioPerfilId,
      valorAntes: { ...cabecera[0], dependencias },
      comentario: conDatos.length > 0 ? 'Borrado forzado por administrador' : 'Ciclo vacío',
    })

    return { message: 'Participación eliminada' }
  }

  /** Qué cuelga de un ciclo. Se usa para decidir si se puede borrar. */
  private async contarDependenciasParticipacion(participacionId: number) {
    const q = bindRepetido(
      `SELECT
         (SELECT COUNT(*) FROM EVALUADORAPROBACION    WHERE PARTICIPACIONID = :pid) AS "aprobaciones",
         (SELECT COUNT(*) FROM EVALUADORCAPACITACION  WHERE PARTICIPACIONID = :pid) AS "capacitaciones",
         (SELECT COUNT(*) FROM EVALUADORPARTPROYECTO  WHERE PARTICIPACIONID = :pid) AS "proyectos evaluados",
         (SELECT COUNT(*) FROM EVALUADORPRUEBA        WHERE PARTICIPACIONID = :pid) AS "pruebas",
         (SELECT COUNT(*) FROM EVALUADORDOCUMENTO     WHERE PARTICIPACIONID = :pid) AS "documentos",
         (SELECT COUNT(*) FROM EVALUADORCERTIFICADO   WHERE PARTICIPACIONID = :pid) AS "certificados",
         (SELECT COUNT(*) FROM RETROASIGNACION
           WHERE PARTEVALUADORID = :pid OR PARTEVALUADOID = :pid)                   AS "retroalimentaciones"
       FROM DUAL`,
      'pid', participacionId,
    )
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(q.sql, q.params)
    const r = rows[0] ?? {}
    return Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, Number(v ?? 0)]),
    ) as Record<string, number>
  }

  /** Alternativa al borrado. Los estados ESNEGATIVO exigen motivo. */
  async cambiarEstadoParticipacion(
    participacionId: number,
    dto: { estadoCodigo: string; motivo?: string },
    ctx: { usuarioEmail: string; usuarioPerfilId?: number },
  ) {
    const codigo = (dto.estadoCodigo ?? '').trim().toUpperCase()
    if (!codigo) throw new BadRequestException('Código de estado requerido')

    const estados: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT ESTADOPARTID AS "id", TRIM(NOMBRE) AS "nombre", NVL(ESNEGATIVO, 0) AS "negativo"
         FROM ESTADOPARTICIPACION WHERE CODIGO = :1 AND ACTIVO = 1`,
      [codigo],
    )
    if (!estados[0]) throw new BadRequestException(`Estado '${codigo}' no existe o está inactivo`)

    const esNegativo = Number(estados[0].negativo) === 1
    const motivo = dto.motivo?.trim() || null
    if (esNegativo && !motivo) {
      throw new BadRequestException(
        `El estado '${estados[0].nombre}' cierra el ciclo sin evaluación: hay que indicar el motivo.`,
      )
    }

    const antes: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pa.EVALUADORID AS "evaluadorId", pa.ANIO AS "anio",
              TRIM(es.CODIGO) AS "estadoCodigo", TRIM(pa.MOTIVONOPARTICIPA) AS "motivo"
         FROM EVALUADORPARTICIPACION pa
         LEFT JOIN ESTADOPARTICIPACION es ON es.ESTADOPARTID = pa.ESTADOPARTID
        WHERE pa.PARTICIPACIONID = :1`,
      [participacionId],
    )
    if (!antes[0]) throw new NotFoundException('Participación no encontrada')

    await this.dataSource.query(
      `UPDATE EVALUADORPARTICIPACION
          SET ESTADOPARTID = :1,
              MOTIVONOPARTICIPA = :2,
              USUARIOMODIFICACION = :3,
              FECHAMODIFICACION = SYSDATE
        WHERE PARTICIPACIONID = :4`,
      [Number(estados[0].id), motivo, ctx.usuarioEmail, participacionId],
    )

    await this.auditoria.registrar({
      tabla: 'EVALUADORPARTICIPACION',
      operacion: 'ESTADO',
      registroId: participacionId,
      evaluadorId: Number(antes[0].evaluadorId),
      participacionId,
      usuarioEmail: ctx.usuarioEmail,
      usuarioPerfilId: ctx.usuarioPerfilId,
      valorAntes: { estadoCodigo: antes[0].estadoCodigo, motivo: antes[0].motivo },
      valorDespues: { estadoCodigo: codigo, motivo },
    })

    return { message: `Estado cambiado a ${estados[0].nombre}` }
  }

  // Hoja de vida (1:1 con el evaluador, separada de Estudios)

  private async getTipoEstudioHV(): Promise<number> {
    const rows: Array<{ id: number }> = await this.dataSource.query(
      `SELECT TIPOESTUDIOID AS "id" FROM TIPOESTUDIO
        WHERE UPPER(TRIM(TIPOESTUDIONOMBRE)) = 'HV' AND ROWNUM = 1`,
    )
    if (!rows[0]) throw new BadRequestException('El tipo "HV" no existe en el catálogo de tipos de estudio')
    return Number(rows[0].id)
  }

  async getHojaVida(evaluadorId: number) {
    const tipoHV = await this.getTipoEstudioHV()
    const rows: Array<{ estudioId: number; archivoNombre: string | null; tieneArchivo: number; fechaCargue: Date }> =
      await this.dataSource.query(
        `SELECT ESTUDIOID                AS "estudioId",
                TRIM(ARCHIVONOMBRE)      AS "archivoNombre",
                CASE WHEN ARCHIVOPDF IS NULL THEN 0 ELSE 1 END AS "tieneArchivo",
                FECHACARGUE              AS "fechaCargue"
           FROM EVALUADORESTUDIO
          WHERE EVALUADORID = :1 AND TIPOESTUDIOID = :2 AND ROWNUM = 1`,
        [evaluadorId, tipoHV],
      )
    if (!rows[0]) return null
    return {
      ...rows[0],
      estudioId: Number(rows[0].estudioId),
      tieneArchivo: Number(rows[0].tieneArchivo) === 1,
    }
  }

  async guardarHojaVida(evaluadorId: number, file: MulterFile) {
    if (!file?.buffer) throw new BadRequestException('Adjunta el PDF en el campo "archivo"')
    const ok = await this.dataSource.query(`SELECT 1 FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId])
    if (!ok[0]) throw new NotFoundException('Evaluador no encontrado')

    const tipoHV = await this.getTipoEstudioHV()
    const existente: Array<{ id: number }> = await this.dataSource.query(
      `SELECT ESTUDIOID AS "id" FROM EVALUADORESTUDIO
        WHERE EVALUADORID = :1 AND TIPOESTUDIOID = :2 AND ROWNUM = 1`,
      [evaluadorId, tipoHV],
    )

    if (existente[0]) {
      await this.dataSource.query(
        `UPDATE EVALUADORESTUDIO
            SET ARCHIVOPDF = :1, ARCHIVOMIME = :2, ARCHIVONOMBRE = :3, FECHACARGUE = SYSDATE
          WHERE ESTUDIOID = :4`,
        [file.buffer, file.mimetype, file.originalname, Number(existente[0].id)],
      )
      return { message: 'Hoja de vida actualizada', estudioId: Number(existente[0].id) }
    }

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT EVALUADORESTUDIO_SEQ.NEXTVAL FROM dual`,
    )
    const id = Number(seq[0].NEXTVAL)
    await this.dataSource.query(
      `INSERT INTO EVALUADORESTUDIO
         (ESTUDIOID, EVALUADORID, TIPOESTUDIOID, ARCHIVOPDF, ARCHIVOMIME, ARCHIVONOMBRE, FECHACARGUE)
       VALUES (:1, :2, :3, :4, :5, :6, SYSDATE)`,
      [id, evaluadorId, tipoHV, file.buffer, file.mimetype, file.originalname],
    )
    return { message: 'Hoja de vida cargada', estudioId: id }
  }

  async eliminarHojaVida(evaluadorId: number) {
    const tipoHV = await this.getTipoEstudioHV()
    await this.dataSource.query(
      `DELETE FROM EVALUADORESTUDIO WHERE EVALUADORID = :1 AND TIPOESTUDIOID = :2`,
      [evaluadorId, tipoHV],
    )
    return { message: 'Hoja de vida eliminada' }
  }

  // Estudios (diplomas, certificados — excluye HV)

  async listarEstudios(evaluadorId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT s.ESTUDIOID                AS "estudioId",
              s.TIPOESTUDIOID            AS "tipoEstudioId",
              TRIM(t.TIPOESTUDIONOMBRE)  AS "tipoEstudio",
              TRIM(s.ESTUDIOTITULO)      AS "titulo",
              TRIM(s.INSTITUCION)        AS "institucion",
              s.FECHAGRADO               AS "fechaGrado",
              TRIM(s.ARCHIVONOMBRE)      AS "archivoNombre",
              CASE WHEN s.ARCHIVOPDF IS NULL THEN 0 ELSE 1 END AS "tieneArchivo",
              s.FECHACARGUE              AS "fechaCargue"
         FROM EVALUADORESTUDIO s
         LEFT JOIN TIPOESTUDIO t ON t.TIPOESTUDIOID = s.TIPOESTUDIOID
        WHERE s.EVALUADORID = :1
          AND UPPER(TRIM(NVL(t.TIPOESTUDIONOMBRE,''))) <> 'HV'
        ORDER BY s.FECHACARGUE DESC`,
      [evaluadorId],
    )
    return rows.map(r => ({
      ...r,
      estudioId: Number(r.estudioId),
      tipoEstudioId: Number(r.tipoEstudioId),
      tieneArchivo: Number(r.tieneArchivo) === 1,
    }))
  }

  async crearEstudio(evaluadorId: number, dto: EstudioDto, file?: MulterFile) {
    if (!dto.tipoEstudioId) throw new BadRequestException('Tipo de estudio requerido')
    const ok = await this.dataSource.query(`SELECT 1 FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId])
    if (!ok[0]) throw new NotFoundException('Evaluador no encontrado')

    // Bloquear que se cargue HV desde la sección de estudios — usa el endpoint dedicado.
    const tipoHV = await this.getTipoEstudioHV().catch(() => 0)
    if (tipoHV && Number(dto.tipoEstudioId) === tipoHV) {
      throw new BadRequestException('La hoja de vida se carga desde la sección "Hoja de vida"')
    }

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT EVALUADORESTUDIO_SEQ.NEXTVAL FROM dual`,
    )
    const id = Number(seq[0].NEXTVAL)
    await this.dataSource.query(
      `INSERT INTO EVALUADORESTUDIO
         (ESTUDIOID, EVALUADORID, TIPOESTUDIOID, ESTUDIOTITULO, INSTITUCION, FECHAGRADO,
          ARCHIVOPDF, ARCHIVOMIME, ARCHIVONOMBRE, FECHACARGUE)
       VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, SYSDATE)`,
      [
        id, evaluadorId, dto.tipoEstudioId,
        dto.titulo?.trim() || null,
        dto.institucion?.trim() || null,
        dto.fechaGrado ? new Date(dto.fechaGrado) : null,
        file?.buffer ?? null,
        file?.mimetype ?? null,
        file?.originalname ?? null,
      ],
    )
    return { estudioId: id, message: 'Estudio agregado' }
  }

  async getEstudioArchivo(estudioId: number) {
    const rows: Array<{ pdf: NodeJS.ReadableStream | Buffer | null; mime: string | null; nombre: string | null }> =
      await this.dataSource.query(
        `SELECT ARCHIVOPDF AS "pdf", TRIM(ARCHIVOMIME) AS "mime", TRIM(ARCHIVONOMBRE) AS "nombre"
           FROM EVALUADORESTUDIO WHERE ESTUDIOID = :1`,
        [estudioId],
      )
    const r = rows[0]
    if (!r?.pdf) throw new NotFoundException('Archivo no encontrado')
    return { buffer: await this.lobToBuffer(r.pdf), mime: r.mime || 'application/pdf', nombre: r.nombre || `estudio-${estudioId}.pdf` }
  }

  async eliminarEstudio(estudioId: number) {
    await this.dataSource.query(`DELETE FROM EVALUADORESTUDIO WHERE ESTUDIOID = :1`, [estudioId])
    return { message: 'Estudio eliminado' }
  }

  // Experiencia laboral

  async listarExperiencias(evaluadorId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT EXPERIENCIAID         AS "experienciaId",
              TRIM(CARGOEXP)        AS "cargo",
              TRIM(ENTIDADEXP)      AS "entidad",
              FECHAINICIO           AS "fechaInicio",
              FECHAFIN              AS "fechaFin",
              TRIM(ARCHIVONOMBRE)   AS "archivoNombre",
              CASE WHEN ARCHIVOPDF IS NULL THEN 0 ELSE 1 END AS "tieneArchivo"
         FROM EVALUADOREXPERIENCIA
        WHERE EVALUADORID = :1
        ORDER BY FECHAINICIO DESC NULLS LAST`,
      [evaluadorId],
    )
    return rows.map(r => ({
      ...r,
      experienciaId: Number(r.experienciaId),
      tieneArchivo: Number(r.tieneArchivo) === 1,
    }))
  }

  async crearExperiencia(evaluadorId: number, dto: ExperienciaDto, file?: MulterFile) {
    if (!dto.cargo?.trim() || !dto.entidad?.trim()) {
      throw new BadRequestException('Cargo y entidad son obligatorios')
    }
    const ok = await this.dataSource.query(`SELECT 1 FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId])
    if (!ok[0]) throw new NotFoundException('Evaluador no encontrado')

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT EVALUADOREXPERIENCIA_SEQ.NEXTVAL FROM dual`,
    )
    const id = Number(seq[0].NEXTVAL)
    await this.dataSource.query(
      `INSERT INTO EVALUADOREXPERIENCIA
         (EXPERIENCIAID, EVALUADORID, CARGOEXP, ENTIDADEXP, FECHAINICIO, FECHAFIN,
          ARCHIVOPDF, ARCHIVOMIME, ARCHIVONOMBRE)
       VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9)`,
      [
        id, evaluadorId,
        dto.cargo.trim(), dto.entidad.trim(),
        dto.fechaInicio ? new Date(dto.fechaInicio) : null,
        dto.fechaFin ? new Date(dto.fechaFin) : null,
        file?.buffer ?? null,
        file?.mimetype ?? null,
        file?.originalname ?? null,
      ],
    )
    return { experienciaId: id, message: 'Experiencia agregada' }
  }

  async getExperienciaArchivo(experienciaId: number) {
    const rows: Array<{ pdf: NodeJS.ReadableStream | Buffer | null; mime: string | null; nombre: string | null }> =
      await this.dataSource.query(
        `SELECT ARCHIVOPDF AS "pdf", TRIM(ARCHIVOMIME) AS "mime", TRIM(ARCHIVONOMBRE) AS "nombre"
           FROM EVALUADOREXPERIENCIA WHERE EXPERIENCIAID = :1`,
        [experienciaId],
      )
    const r = rows[0]
    if (!r?.pdf) throw new NotFoundException('Archivo no encontrado')
    return { buffer: await this.lobToBuffer(r.pdf), mime: r.mime || 'application/pdf', nombre: r.nombre || `experiencia-${experienciaId}.pdf` }
  }

  async eliminarExperiencia(experienciaId: number) {
    await this.dataSource.query(`DELETE FROM EVALUADOREXPERIENCIA WHERE EXPERIENCIAID = :1`, [experienciaId])
    return { message: 'Experiencia eliminada' }
  }

  // TIC

  async listarTics(evaluadorId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT t.TICID                    AS "ticId",
              t.TIPOEVENTOID             AS "tipoEventoId",
              TRIM(te.TIPOEVENTONOMBRE)  AS "tipoEvento",
              TRIM(t.TICNOMBRE)          AS "nombre",
              t.TICHORAS                 AS "horas",
              t.FECHAFIN                 AS "fechaFin",
              TRIM(t.ARCHIVONOMBRE)      AS "archivoNombre",
              CASE WHEN t.ARCHIVOPDF IS NULL THEN 0 ELSE 1 END AS "tieneArchivo"
         FROM EVALUADORTIC t
         LEFT JOIN TIPOEVENTO te ON te.TIPOEVENTOID = t.TIPOEVENTOID
        WHERE t.EVALUADORID = :1
        ORDER BY t.FECHAFIN DESC NULLS LAST`,
      [evaluadorId],
    )
    return rows.map(r => ({
      ...r,
      ticId: Number(r.ticId),
      tipoEventoId: r.tipoEventoId ? Number(r.tipoEventoId) : null,
      horas: r.horas ? Number(r.horas) : null,
      tieneArchivo: Number(r.tieneArchivo) === 1,
    }))
  }

  async crearTic(evaluadorId: number, dto: TicDto, file?: MulterFile) {
    if (!dto.nombre?.trim()) throw new BadRequestException('Nombre requerido')
    const ok = await this.dataSource.query(`SELECT 1 FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId])
    if (!ok[0]) throw new NotFoundException('Evaluador no encontrado')

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT EVALUADORTIC_SEQ.NEXTVAL FROM dual`,
    )
    const id = Number(seq[0].NEXTVAL)
    await this.dataSource.query(
      `INSERT INTO EVALUADORTIC
         (TICID, EVALUADORID, TIPOEVENTOID, TICNOMBRE, TICHORAS, FECHAFIN,
          ARCHIVOPDF, ARCHIVOMIME, ARCHIVONOMBRE)
       VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9)`,
      [
        id, evaluadorId,
        dto.tipoEventoId ?? null,
        dto.nombre.trim(),
        dto.horas ?? null,
        dto.fechaFin ? new Date(dto.fechaFin) : null,
        file?.buffer ?? null,
        file?.mimetype ?? null,
        file?.originalname ?? null,
      ],
    )
    return { ticId: id, message: 'TIC agregado' }
  }

  async getTicArchivo(ticId: number) {
    const rows: Array<{ pdf: NodeJS.ReadableStream | Buffer | null; mime: string | null; nombre: string | null }> =
      await this.dataSource.query(
        `SELECT ARCHIVOPDF AS "pdf", TRIM(ARCHIVOMIME) AS "mime", TRIM(ARCHIVONOMBRE) AS "nombre"
           FROM EVALUADORTIC WHERE TICID = :1`,
        [ticId],
      )
    const r = rows[0]
    if (!r?.pdf) throw new NotFoundException('Archivo no encontrado')
    return { buffer: await this.lobToBuffer(r.pdf), mime: r.mime || 'application/pdf', nombre: r.nombre || `tic-${ticId}.pdf` }
  }

  async eliminarTic(ticId: number) {
    await this.dataSource.query(`DELETE FROM EVALUADORTIC WHERE TICID = :1`, [ticId])
    return { message: 'TIC eliminado' }
  }

  // Pruebas de conocimiento

  async listarPruebas(evaluadorId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT PRUEBAID            AS "pruebaId",
              -- Hace falta para corregir una prueba sin desatarla del ciclo.
              PARTICIPACIONID     AS "participacionId",
              ANIO                AS "anio",
              TRIM(PERIODO)       AS "periodo",
              FECHAPRESENTACION   AS "fechaPresentacion",
              TRIM(HORARIO)       AS "horario",
              INTENTOS            AS "intentos",
              PUNTAJEMAYOR        AS "puntajeMayor",
              PRUEBANUMERO        AS "pruebaNumero",
              EFECTIVIDAD         AS "efectividad",
              CORRECTAS           AS "correctas",
              INCORRECTAS         AS "incorrectas",
              TRIM(TOTALTIEMPO)   AS "totalTiempo",
              TRIM(OBSERVACION)   AS "observacion"
         FROM EVALUADORPRUEBA
        WHERE EVALUADORID = :1
        ORDER BY ANIO DESC, PRUEBAID DESC`,
      [evaluadorId],
    )
    return rows.map(r => ({
      ...r,
      pruebaId: Number(r.pruebaId),
      anio: Number(r.anio),
      intentos: r.intentos != null ? Number(r.intentos) : null,
      puntajeMayor: r.puntajeMayor != null ? Number(r.puntajeMayor) : null,
      pruebaNumero: r.pruebaNumero != null ? Number(r.pruebaNumero) : null,
      efectividad: r.efectividad != null ? Number(r.efectividad) : null,
      correctas: r.correctas != null ? Number(r.correctas) : null,
      incorrectas: r.incorrectas != null ? Number(r.incorrectas) : null,
    }))
  }

  /** 0 a 100: la columna es NUMBER(5,2) y el error de Oracle no dice qué campo se pasó. */
  private validarPuntajes(dto: Partial<PruebaDto>) {
    const revisar = (valor: unknown, campo: string) => {
      if (valor == null || valor === '') return
      const n = Number(valor)
      if (!Number.isFinite(n)) throw new BadRequestException(`"${campo}" tiene que ser un número`)
      if (n < 0 || n > 100) {
        throw new BadRequestException(
          `"${campo}" va de 0 a 100 y se envió ${n}. Revise si sobra algún dígito.`,
        )
      }
    }
    revisar(dto.puntajeMayor, 'Puntaje')
    revisar(dto.puntajeMinimo, 'Puntaje mínimo')
    revisar(dto.efectividad, 'Porcentaje')

    if (dto.intentos != null && (Number(dto.intentos) < 0 || Number(dto.intentos) > 99)) {
      throw new BadRequestException('"Intentos" va de 0 a 99')
    }
  }

  /** Por el PORCENTAJE, no por el puntaje bruto: el puntaje depende del total de preguntas. */
  private derivarAprobada(
    efectividad: number | null | undefined, minimo: number | null | undefined,
  ): boolean | null {
    if (efectividad == null || minimo == null) return null
    return Number(efectividad) >= Number(minimo)
  }

  async crearPrueba(evaluadorId: number, dto: PruebaDto) {
    if (!dto.anio) throw new BadRequestException('Año requerido')
    this.validarPuntajes(dto)
    const ok = await this.dataSource.query(`SELECT 1 FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId])
    if (!ok[0]) throw new NotFoundException('Evaluador no encontrado')

    const ciclo = await this.resolverCicloDePrueba(evaluadorId, dto)
    const minimo = dto.puntajeMinimo ?? ciclo.puntajeMinimo
    const aprobada = this.derivarAprobada(dto.efectividad, minimo)

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT EVALUADORPRUEBA_SEQ.NEXTVAL FROM dual`,
    )
    const id = Number(seq[0].NEXTVAL)
    await this.dataSource.query(
      `INSERT INTO EVALUADORPRUEBA
         (PRUEBAID, EVALUADORID, ANIO, PERIODO, FECHAPRESENTACION, HORARIO, INTENTOS,
          PUNTAJEMAYOR, PRUEBANUMERO, EFECTIVIDAD, CORRECTAS, INCORRECTAS, TOTALTIEMPO,
          OBSERVACION, PARTICIPACIONID, PUNTAJEMINIMO, APROBADA)
       VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14, :15, :16, :17)`,
      [
        id, evaluadorId, dto.anio,
        dto.periodo?.trim() || null,
        dto.fechaPresentacion ? new Date(dto.fechaPresentacion) : null,
        dto.horario?.trim() || null,
        dto.intentos ?? null,
        dto.puntajeMayor ?? null,
        dto.pruebaNumero ?? null,
        dto.efectividad ?? null,
        dto.correctas ?? null,
        dto.incorrectas ?? null,
        dto.totalTiempo?.trim() || null,
        dto.observacion?.trim() || null,
        ciclo.participacionId,
        minimo ?? null,
        aprobada == null ? null : (aprobada ? 1 : 0),
      ],
    )
    return {
      pruebaId: id,
      participacionId: ciclo.participacionId,
      puntajeMinimo: minimo ?? null,
      aprobada,
      // Se dice CUÁL de los dos falta.
      message: aprobada == null
        ? (dto.efectividad == null
            ? 'Prueba registrada — falta el porcentaje, así que queda sin evaluar'
            : 'Prueba registrada — el ciclo no tiene porcentaje mínimo, así que queda sin evaluar')
        : `Prueba registrada — ${aprobada ? 'aprobada' : 'no aprobada'}`,
    }
  }

  /** Ciclo y corte de una prueba. Con dos ciclos el mismo año hay que decir cuál. */
  private async resolverCicloDePrueba(
    evaluadorId: number, dto: PruebaDto,
  ): Promise<{ participacionId: number | null; puntajeMinimo: number | null }> {
    if (dto.participacionId) {
      const filas: Array<{ minimo: number | null }> = await this.dataSource.query(
        `SELECT cv.PUNTAJEMINIMOPRUEBA AS "minimo"
           FROM EVALUADORPARTICIPACION pa
           LEFT JOIN EVALUADORCONVOCATORIA cv ON cv.CONVOCATORIAID = pa.CONVOCATORIAID
          WHERE pa.PARTICIPACIONID = :1 AND pa.EVALUADORID = :2`,
        [dto.participacionId, evaluadorId],
      )
      if (!filas[0]) throw new BadRequestException('Esa participación no es de este evaluador')
      return {
        participacionId: dto.participacionId,
        puntajeMinimo: filas[0].minimo != null ? Number(filas[0].minimo) : null,
      }
    }

    const candidatos: Array<{ id: number; minimo: number | null }> = await this.dataSource.query(
      `SELECT pa.PARTICIPACIONID AS "id", cv.PUNTAJEMINIMOPRUEBA AS "minimo"
         FROM EVALUADORPARTICIPACION pa
         LEFT JOIN EVALUADORCONVOCATORIA cv ON cv.CONVOCATORIAID = pa.CONVOCATORIAID
        WHERE pa.EVALUADORID = :1 AND pa.ANIO = :2`,
      [evaluadorId, dto.anio],
    )
    if (candidatos.length === 1) {
      return {
        participacionId: Number(candidatos[0].id),
        puntajeMinimo: candidatos[0].minimo != null ? Number(candidatos[0].minimo) : null,
      }
    }
    if (candidatos.length > 1) {
      throw new BadRequestException(
        `El evaluador tiene ${candidatos.length} ciclos en ${dto.anio}. ` +
        'Indique `participacionId` para saber a cuál pertenece la prueba.',
      )
    }
    // Sin ciclo ese año, la prueba entra como histórico suelto.
    return { participacionId: null, puntajeMinimo: null }
  }

  async actualizarPrueba(pruebaId: number, dto: Partial<PruebaDto>) {
    this.validarPuntajes(dto)
    const ok = await this.dataSource.query(`SELECT 1 FROM EVALUADORPRUEBA WHERE PRUEBAID = :1`, [pruebaId])
    if (!ok[0]) throw new NotFoundException('Prueba no encontrada')

    const sets: string[] = []
    const params: unknown[] = []
    const map: Array<[keyof PruebaDto, string, (v: unknown) => unknown]> = [
      ['anio',              'ANIO',               v => v],
      ['periodo',           'PERIODO',            v => (v as string)?.trim() || null],
      ['fechaPresentacion', 'FECHAPRESENTACION',  v => v ? new Date(v as string) : null],
      ['horario',           'HORARIO',            v => (v as string)?.trim() || null],
      ['intentos',          'INTENTOS',           v => v ?? null],
      ['puntajeMayor',      'PUNTAJEMAYOR',       v => v ?? null],
      ['pruebaNumero',      'PRUEBANUMERO',       v => v ?? null],
      ['efectividad',       'EFECTIVIDAD',        v => v ?? null],
      ['correctas',         'CORRECTAS',          v => v ?? null],
      ['incorrectas',       'INCORRECTAS',        v => v ?? null],
      ['totalTiempo',       'TOTALTIEMPO',        v => (v as string)?.trim() || null],
      ['observacion',       'OBSERVACION',        v => (v as string)?.trim() || null],
    ]
    for (const [k, col, transform] of map) {
      if (dto[k] !== undefined) {
        params.push(transform(dto[k]))
        sets.push(`${col} = :${params.length}`)
      }
    }
    if (sets.length === 0) return { message: 'Sin cambios' }

    // APROBADA se recalcula siempre: es derivado y el porcentaje pudo cambiar.
    const actual: Array<{ efectividad: number | null; minimo: number | null }> =
      await this.dataSource.query(
        `SELECT EFECTIVIDAD AS "efectividad", PUNTAJEMINIMO AS "minimo"
           FROM EVALUADORPRUEBA WHERE PRUEBAID = :1`, [pruebaId])
    const efectividad = dto.efectividad !== undefined ? dto.efectividad : actual[0]?.efectividad
    const minimo = dto.puntajeMinimo !== undefined ? dto.puntajeMinimo : actual[0]?.minimo
    const aprobada = this.derivarAprobada(efectividad, minimo)
    params.push(aprobada == null ? null : (aprobada ? 1 : 0))
    sets.push(`APROBADA = :${params.length}`)

    params.push(pruebaId)
    await this.dataSource.query(
      `UPDATE EVALUADORPRUEBA SET ${sets.join(', ')} WHERE PRUEBAID = :${params.length}`,
      params,
    )
    return {
      message: aprobada == null
        ? 'Prueba actualizada — sin porcentaje o sin corte, queda sin evaluar'
        : `Prueba actualizada — ${aprobada ? 'aprobada' : 'no aprobada'}`,
      aprobada,
    }
  }

  async eliminarPrueba(pruebaId: number) {
    await this.dataSource.query(`DELETE FROM EVALUADORPRUEBA WHERE PRUEBAID = :1`, [pruebaId])
    return { message: 'Prueba eliminada' }
  }

  // Documentos genéricos (cédula, autorización, confidencialidad, …)

  private tipoCedulaCache: number | null = null

  /** Cachea el id del tipo CEDULA para no golpear TIPODOCUMENTOEVAL en cada request. */
  private async idTipoCedula(): Promise<number> {
    if (this.tipoCedulaCache != null) return this.tipoCedulaCache
    const rows: Array<{ id: number }> = await this.dataSource.query(
      `SELECT TIPODOCUMENTOEVALID AS "id"
         FROM TIPODOCUMENTOEVAL
        WHERE UPPER(TRIM(CODIGO)) = 'CEDULA' AND ROWNUM = 1`,
    )
    if (!rows[0]) {
      throw new BadRequestException('El tipo "CEDULA" no existe en TIPODOCUMENTOEVAL (ejecutar migración v22)')
    }
    this.tipoCedulaCache = Number(rows[0].id)
    return this.tipoCedulaCache
  }

  /** Sin `tipoCodigo` se excluye CEDULA, que el front muestra en su propio card. */
  async listarDocumentos(
    evaluadorId: number,
    opciones: { tipoCodigo?: string; incluirCedula?: boolean } = {},
  ) {
    const { tipoCodigo, incluirCedula = false } = opciones
    const conds: string[] = [`d.EVALUADORID = :1`]
    const params: unknown[] = [evaluadorId]
    const filtroTipo = tipoCodigo?.trim()
    if (filtroTipo) {
      params.push(filtroTipo.toUpperCase())
      conds.push(`UPPER(TRIM(t.CODIGO)) = :${params.length}`)
    } else if (!incluirCedula) {
      conds.push(`UPPER(TRIM(t.CODIGO)) <> 'CEDULA'`)
    }
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT d.DOCUMENTOID           AS "documentoId",
              d.EVALUADORID           AS "evaluadorId",
              d.TIPODOCUMENTOEVALID   AS "tipoDocumentoEvalId",
              TRIM(t.CODIGO)          AS "tipoCodigo",
              TRIM(t.NOMBRE)          AS "tipoNombre",
              TRIM(d.DOCUMENTODESCRIPCION) AS "descripcion",
              d.ANIOREFERENCIA        AS "anioReferencia",
              TRIM(d.ARCHIVONOMBRE)   AS "archivoNombre",
              TRIM(d.ARCHIVOMIME)     AS "mime",
              d.FECHACARGUE           AS "fechaCargue"
         FROM EVALUADORDOCUMENTO d
         JOIN TIPODOCUMENTOEVAL  t ON t.TIPODOCUMENTOEVALID = d.TIPODOCUMENTOEVALID
        WHERE ${conds.join(' AND ')}
        ORDER BY t.ORDEN ASC, d.FECHACARGUE DESC, d.DOCUMENTOID DESC`,
      params,
    )
    return rows.map(r => ({
      ...r,
      documentoId: Number(r.documentoId),
      evaluadorId: Number(r.evaluadorId),
      tipoDocumentoEvalId: Number(r.tipoDocumentoEvalId),
      anioReferencia: r.anioReferencia != null ? Number(r.anioReferencia) : null,
    }))
  }

  async subirDocumento(
    evaluadorId: number,
    tipoId: number,
    file: MulterFile,
    opts: { descripcion?: string; anioReferencia?: number; participacionId?: number } = {},
  ): Promise<{ mensaje: string; documentoId: number }> {
    if (!file?.buffer) throw new BadRequestException('Adjunta el archivo en el campo "archivo"')
    if (!tipoId) throw new BadRequestException('tipoDocumentoEvalId es obligatorio')

    const ok = await this.dataSource.query(`SELECT 1 FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId])
    if (!ok[0]) throw new NotFoundException('Evaluador no encontrado')

    const tipo: Array<{ admiteMultiple: number; nombre: string; codigo: string }> =
      await this.dataSource.query(
        `SELECT ADMITEMULTIPLE AS "admiteMultiple",
                TRIM(NOMBRE)   AS "nombre",
                TRIM(CODIGO)   AS "codigo"
           FROM TIPODOCUMENTOEVAL
          WHERE TIPODOCUMENTOEVALID = :1 AND ACTIVO = 1`,
        [tipoId],
      )
    if (!tipo[0]) throw new BadRequestException('Tipo de documento no existe o está inactivo')
    const admiteMultiple = Number(tipo[0].admiteMultiple) === 1

    // Los formatos dependen del tipo: el correo de autorización recibe .msg, .eml o .html.
    const permitidas = extensionesDeTipoDocEval(tipo[0].codigo)
    const ext = extensionDe(file.originalname)
    if (!permitidas.includes(ext)) {
      throw new BadRequestException(
        `"${tipo[0].nombre}" admite ${permitidas.map(x => '.' + x).join(', ')}` +
        (ext ? `; el archivo enviado es .${ext}` : '; el archivo no trae extensión'),
      )
    }

    const qr = this.dataSource.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      // Si el tipo es de instancia única, borrar previos antes de insertar.
      if (!admiteMultiple) {
        await qr.query(
          `DELETE FROM EVALUADORDOCUMENTO
            WHERE EVALUADORID = :1 AND TIPODOCUMENTOEVALID = :2`,
          [evaluadorId, tipoId],
        )
      }

      // ID por MAX+1: no hay secuencia dedicada para esta tabla.
      const seq: Array<{ NUEVO: number }> = await qr.query(
        `SELECT NVL(MAX(DOCUMENTOID), 0) + 1 AS "NUEVO" FROM EVALUADORDOCUMENTO`,
      )
      const documentoId = Number(seq[0].NUEVO)

      const nombre = (file.originalname ?? '').toString().trim().slice(0, 255) || null
      await qr.query(
        // PARTICIPACIONID con valor = documento del ciclo; sin él, personal del evaluador.
        `INSERT INTO EVALUADORDOCUMENTO
           (DOCUMENTOID, EVALUADORID, TIPODOCUMENTOEVALID, DOCUMENTODESCRIPCION,
            ANIOREFERENCIA, PARTICIPACIONID, ARCHIVOPDF, ARCHIVOMIME, ARCHIVONOMBRE, FECHACARGUE)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, SYSDATE)`,
        [
          documentoId,
          evaluadorId,
          tipoId,
          opts.descripcion?.trim() || null,
          opts.anioReferencia ?? null,
          opts.participacionId ?? null,
          file.buffer,
          file.mimetype,
          nombre,
        ],
      )

      await qr.commitTransaction()
      return { mensaje: admiteMultiple ? 'Documento agregado' : 'Documento actualizado', documentoId }
    } catch (err) {
      await qr.rollbackTransaction()
      throw err
    } finally {
      await qr.release()
    }
  }

  async getDocumentoMeta(docId: number): Promise<{
    evaluadorId: number;
    tipoCodigo: string;
    archivoNombre: string | null;
    mime: string;
  }> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT d.EVALUADORID          AS "evaluadorId",
              TRIM(t.CODIGO)         AS "tipoCodigo",
              TRIM(d.ARCHIVONOMBRE)  AS "archivoNombre",
              TRIM(d.ARCHIVOMIME)    AS "mime"
         FROM EVALUADORDOCUMENTO d
         JOIN TIPODOCUMENTOEVAL  t ON t.TIPODOCUMENTOEVALID = d.TIPODOCUMENTOEVALID
        WHERE d.DOCUMENTOID = :1`,
      [docId],
    )
    if (!rows[0]) throw new NotFoundException('Documento no encontrado')
    const r = rows[0]
    return {
      evaluadorId: Number(r.evaluadorId),
      tipoCodigo: String(r.tipoCodigo ?? ''),
      archivoNombre: (r.archivoNombre as string | null) ?? null,
      mime: (r.mime as string | null) || 'application/pdf',
    }
  }

  async getDocumentoArchivo(docId: number): Promise<{ buffer: Buffer; mime: string; nombre: string }> {
    const rows: Array<{
      pdf: NodeJS.ReadableStream | Buffer | null;
      mime: string | null;
      nombre: string | null;
    }> = await this.dataSource.query(
      `SELECT ARCHIVOPDF          AS "pdf",
              TRIM(ARCHIVOMIME)   AS "mime",
              TRIM(ARCHIVONOMBRE) AS "nombre"
         FROM EVALUADORDOCUMENTO WHERE DOCUMENTOID = :1`,
      [docId],
    )
    const r = rows[0]
    if (!r?.pdf) throw new NotFoundException('Archivo no encontrado')
    return {
      buffer: await this.lobToBuffer(r.pdf),
      mime: r.mime || 'application/pdf',
      nombre: r.nombre || `documento-${docId}.pdf`,
    }
  }

  async eliminarDocumento(docId: number): Promise<{ mensaje: string }> {
    const ok = await this.dataSource.query(
      `SELECT 1 FROM EVALUADORDOCUMENTO WHERE DOCUMENTOID = :1`, [docId],
    )
    if (!ok[0]) throw new NotFoundException('Documento no encontrado')
    await this.dataSource.query(`DELETE FROM EVALUADORDOCUMENTO WHERE DOCUMENTOID = :1`, [docId])
    return { mensaje: 'Documento eliminado' }
  }

  async getCedula(evaluadorId: number): Promise<{
    documentoId: number;
    archivoNombre: string | null;
    fechaCargue: Date;
  } | null> {
    const tipoId = await this.idTipoCedula()
    // ROWNUM se aplica antes del ORDER BY: hay que anidar la subquery.
    const rows: Array<{ id: number; nombre: string | null; fecha: Date }> = await this.dataSource.query(
      `SELECT * FROM (
         SELECT DOCUMENTOID          AS "id",
                TRIM(ARCHIVONOMBRE)  AS "nombre",
                FECHACARGUE          AS "fecha"
           FROM EVALUADORDOCUMENTO
          WHERE EVALUADORID = :1 AND TIPODOCUMENTOEVALID = :2
          ORDER BY DOCUMENTOID DESC
       ) WHERE ROWNUM = 1`,
      [evaluadorId, tipoId],
    )
    if (!rows[0]) return null
    return {
      documentoId: Number(rows[0].id),
      archivoNombre: rows[0].nombre ?? null,
      fechaCargue: rows[0].fecha,
    }
  }
}
