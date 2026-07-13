import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { aTitleCase } from '../common/text/title-case'

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
  // PERSONA (opcional — si vienen, se actualizan en la fila PERSONA asociada)
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
  modalidadPart?: string | null
  procesoId?: number | null
  procesoRevocado?: boolean
  proyectosEvaluados?: string | null
  mesa?: string | null
  equipoEvaluador?: string | null
  dinamizadorPersonaId?: number | null
  retroalimentacion?: string | null
  observaciones?: string | null
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

export interface MulterFile {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

@Injectable()
export class EvaluadoresService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Búsqueda previa (al crear)                                            ║
  // ╚══════════════════════════════════════════════════════════════════════╝

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

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Listado / Ficha                                                       ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  async listar(busqueda: string, page = 1, limit = 20) {
    const q = (busqueda ?? '').trim()
    const pagina = Math.max(1, page)
    const tamPag = Math.min(100, Math.max(1, limit))
    const offset = (pagina - 1) * tamPag

    const params: unknown[] = []
    let where = `WHERE e.EVALUADORACTIVO = 1`

    if (q) {
      const like = `%${q.toUpperCase()}%`
      params.push(like, like, like)
      where += ` AND (
        UPPER(p.PERSONANOMBRES) || ' ' || UPPER(p.PERSONAPRIMERAPELLIDO) LIKE :1
        OR UPPER(p.PERSONAEMAIL) LIKE :2
        OR p.PERSONAIDENTIFICACION LIKE :3
      )`
    }

    const totalRows: Array<{ T: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS "T"
         FROM EVALUADOR e
         JOIN PERSONA p ON p.PERSONAID = e.PERSONAID
        ${where}`,
      params,
    )
    const total = Number(totalRows[0]?.T ?? 0)

    const rows: Array<{
      evaluadorId: number
      personaId: number
      identificacion: string
      nombres: string
      primerApellido: string
      segundoApellido: string | null
      email: string
      cargo: string | null
      profesion: string | null
      tieneFoto: number
    }> = await this.dataSource.query(
      `SELECT e.EVALUADORID                  AS "evaluadorId",
              e.PERSONAID                    AS "personaId",
              TRIM(p.PERSONAIDENTIFICACION)  AS "identificacion",
              TRIM(p.PERSONANOMBRES)         AS "nombres",
              TRIM(p.PERSONAPRIMERAPELLIDO)  AS "primerApellido",
              TRIM(p.PERSONASEGUNDOAPELLIDO) AS "segundoApellido",
              TRIM(p.PERSONAEMAIL)           AS "email",
              TRIM(e.EVALUADORCARGO)         AS "cargo",
              TRIM(e.EVALUADORPROFESION)     AS "profesion",
              CASE WHEN e.EVALUADORFOTO IS NULL THEN 0 ELSE 1 END AS "tieneFoto"
         FROM EVALUADOR e
         JOIN PERSONA   p ON p.PERSONAID = e.PERSONAID
         ${where}
         ORDER BY e.EVALUADORID DESC
         OFFSET ${offset} ROWS FETCH NEXT ${tamPag} ROWS ONLY`,
      params,
    )

    return {
      items: rows.map(r => ({ ...r, evaluadorId: Number(r.evaluadorId), personaId: Number(r.personaId), tieneFoto: Number(r.tieneFoto) === 1 })),
      total, page: pagina, limit: tamPag,
    }
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
              e.EVALUADOROTROSEST             AS "otrosEstudios",
              TRIM(e.EVALUADORJEFEDIR)        AS "jefeDirecto",
              TRIM(e.EVALUADORQUIENAPRUEBA)   AS "quienAprueba",
              TRIM(e.EVALUADORJEFENOMBRE)     AS "jefeNombre",
              TRIM(e.EVALUADORJEFEEMAIL)      AS "jefeEmail",
              TRIM(e.EVALUADORJEFECARGO)      AS "jefeCargo",
              e.EVALUADORMUNICIPIOID          AS "municipioId",
              e.EVALUADORACTIVO               AS "activo",
              CASE WHEN e.EVALUADORFOTO IS NULL THEN 0 ELSE 1 END AS "tieneFoto",
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

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Crear / Actualizar / Desactivar                                       ║
  // ╚══════════════════════════════════════════════════════════════════════╝

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
      // Buscar PERSONA por identificación. Si existe, reusar; si no, crear.
      // TRIM porque PERSONAIDENTIFICACION es NCHAR(20) y rellena con espacios.
      let personaId: number
      const existente: Array<{ id: number }> = await qr.query(
        `SELECT PERSONAID AS "id" FROM PERSONA WHERE TRIM(PERSONAIDENTIFICACION) = :1`,
        [ident],
      )
      if (existente[0]) {
        personaId = Number(existente[0].id)
        // Verificar que no tenga ya un EVALUADOR activo
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
        // Normalizar a Title Case para uniformar el banco (afecta solo nombres y apellidos —
        // emails, identificación, celular y ciudad NO se tocan).
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
      // EVALUADORJEFEDIR queda como columna heredada — a partir de Fase 3 se
      // usan EVALUADORJEFENOMBRE / EVALUADORJEFEEMAIL / EVALUADORJEFECARGO y
      // el municipio del evaluador se guarda en EVALUADORMUNICIPIOID.
      // EVALUADORQUIENAPRUEBA se sigue escribiendo (queda para Fase 4).
      await qr.query(
        `INSERT INTO EVALUADOR
           (EVALUADORID, PERSONAID, CENTROID, REGIONALID, EVALUADORCARGO, EVALUADORPROFESION,
            EVALUADORPOSGRADO, EVALUADOROTROSEST, EVALUADORQUIENAPRUEBA,
            EVALUADORJEFENOMBRE, EVALUADORJEFEEMAIL, EVALUADORJEFECARGO, EVALUADORMUNICIPIOID,
            EVALUADORACTIVO, FECHACREACION)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, 1, SYSDATE)`,
        [
          evaluadorId, personaId,
          dto.centroId ?? null, dto.regionalId ?? null,
          (dto.cargo ?? '').trim() || null,
          (dto.profesion ?? '').trim() || null,
          (dto.posgrado ?? '').trim() || null,
          (dto.otrosEstudios ?? '').trim() || null,
          (dto.quienAprueba ?? '').trim() || null,
          aTitleCase(dto.jefeNombre) || null,
          (dto.jefeEmail ?? '').trim().toLowerCase() || null,
          (dto.jefeCargo ?? '').trim() || null,
          dto.municipioId ?? null,
        ],
      )

      await qr.commitTransaction()
      return { evaluadorId, personaId, message: 'Evaluador creado' }
    } catch (err) {
      await qr.rollbackTransaction()
      throw err
    } finally {
      await qr.release()
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
      // ── EVALUADOR ────────────────────────────────────────────────────────
      // jefeNombre pasa por Title Case y jefeEmail por lowercase+trim.
      // EVALUADORJEFEDIR queda como columna heredada — se actualiza sólo si el
      // caller sigue enviando el campo antiguo `jefeDirecto`.
      const setsEval: string[] = []
      const paramsEval: unknown[] = []
      const mapEval: Array<[keyof EvaluadorActualizarDto, string]> = [
        ['centroId',      'CENTROID'],
        ['regionalId',    'REGIONALID'],
        ['cargo',         'EVALUADORCARGO'],
        ['profesion',     'EVALUADORPROFESION'],
        ['posgrado',      'EVALUADORPOSGRADO'],
        ['otrosEstudios', 'EVALUADOROTROSEST'],
        ['jefeDirecto',   'EVALUADORJEFEDIR'],
        ['quienAprueba',  'EVALUADORQUIENAPRUEBA'],
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

      // ── PERSONA ──────────────────────────────────────────────────────────
      // Los campos de nombre pasan por Title Case; los demás quedan tal cual (trim).
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

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Foto                                                                  ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  async subirFoto(evaluadorId: number, file: MulterFile) {
    if (!file?.buffer) throw new BadRequestException('Adjunta una imagen en el campo "archivo"')
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Solo se permiten imágenes (JPG, PNG)')
    }
    const ok = await this.dataSource.query(`SELECT 1 FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId])
    if (!ok[0]) throw new NotFoundException('Evaluador no encontrado')

    // Nombre original del archivo (limitado a 255 chars por el schema).
    const nombre = (file.originalname ?? '').toString().trim().slice(0, 255) || null
    await this.dataSource.query(
      `UPDATE EVALUADOR
          SET EVALUADORFOTO = :1,
              EVALUADORFOTOMIME = :2,
              EVALUADORFOTONOMBRE = :3
        WHERE EVALUADORID = :4`,
      [file.buffer, file.mimetype, nombre, evaluadorId],
    )
    return { message: 'Foto actualizada', size: file.size, mime: file.mimetype, nombre }
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
    return { buffer, mime: r.mime || 'image/jpeg', nombre: r.nombre ?? null }
  }

  async borrarFoto(evaluadorId: number) {
    await this.dataSource.query(
      `UPDATE EVALUADOR
          SET EVALUADORFOTO = NULL,
              EVALUADORFOTOMIME = NULL,
              EVALUADORFOTONOMBRE = NULL
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

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Participaciones                                                       ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  async listarParticipaciones(evaluadorId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pa.PARTICIPACIONID         AS "participacionId",
              pa.ANIO                    AS "anio",
              TRIM(pa.PERIODO)           AS "periodo",
              pa.ROLEVALUADORID          AS "rolEvaluadorId",
              TRIM(r.ROLEVALUADORNOMBRE) AS "rolNombre",
              TRIM(pa.MODALIDADPART)     AS "modalidadPart",
              pa.PROCESOID               AS "procesoId",
              TRIM(pe.PROCESONOMBRE)     AS "procesoNombre",
              pa.PROCESOREVOCADO         AS "procesoRevocado",
              TRIM(pa.MESA)              AS "mesa",
              TRIM(pa.EQUIPOEVALUADOR)   AS "equipoEvaluador",
              pa.DINAMIZADORPERSONAID    AS "dinamizadorPersonaId",
              TRIM(d.PERSONANOMBRES) || ' ' || TRIM(d.PERSONAPRIMERAPELLIDO) AS "dinamizadorNombre"
         FROM EVALUADORPARTICIPACION pa
         LEFT JOIN ROLEVALUADOR r ON r.ROLEVALUADORID = pa.ROLEVALUADORID
         LEFT JOIN PROCESOEVAL pe ON pe.PROCESOID = pa.PROCESOID
         LEFT JOIN PERSONA     d  ON d.PERSONAID = pa.DINAMIZADORPERSONAID
        WHERE pa.EVALUADORID = :1
        ORDER BY pa.ANIO DESC, pa.PARTICIPACIONID DESC`,
      [evaluadorId],
    )
    return rows.map(r => ({
      ...r,
      participacionId: Number(r.participacionId),
      anio: Number(r.anio),
      procesoRevocado: Number(r.procesoRevocado) === 1,
    }))
  }

  async crearParticipacion(evaluadorId: number, dto: ParticipacionDto) {
    if (!dto.anio) throw new BadRequestException('Año requerido')
    const ok = await this.dataSource.query(`SELECT 1 FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId])
    if (!ok[0]) throw new NotFoundException('Evaluador no encontrado')

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT EVALUADORPARTICIPACION_SEQ.NEXTVAL FROM dual`,
    )
    const id = Number(seq[0].NEXTVAL)
    await this.dataSource.query(
      `INSERT INTO EVALUADORPARTICIPACION
         (PARTICIPACIONID, EVALUADORID, ANIO, PERIODO, ROLEVALUADORID, MODALIDADPART,
          PROCESOID, PROCESOREVOCADO, PROYECTOSEVALUADOS, MESA, EQUIPOEVALUADOR,
          DINAMIZADORPERSONAID, RETROALIMENTACION, OBSERVACIONES)
       VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14)`,
      [
        id, evaluadorId, dto.anio,
        dto.periodo?.trim() || null,
        dto.rolEvaluadorId ?? null,
        dto.modalidadPart?.trim() || null,
        dto.procesoId ?? null,
        dto.procesoRevocado ? 1 : 0,
        dto.proyectosEvaluados?.trim() || null,
        dto.mesa?.trim() || null,
        dto.equipoEvaluador?.trim() || null,
        dto.dinamizadorPersonaId ?? null,
        dto.retroalimentacion?.trim() || null,
        dto.observaciones?.trim() || null,
      ],
    )
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
      ['modalidadPart',        'MODALIDADPART',         v => (v as string)?.trim() || null],
      ['procesoId',            'PROCESOID',             v => v ?? null],
      ['procesoRevocado',      'PROCESOREVOCADO',       v => (v ? 1 : 0)],
      ['proyectosEvaluados',   'PROYECTOSEVALUADOS',    v => (v as string)?.trim() || null],
      ['mesa',                 'MESA',                  v => (v as string)?.trim() || null],
      ['equipoEvaluador',      'EQUIPOEVALUADOR',       v => (v as string)?.trim() || null],
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
    if (sets.length === 0) return { message: 'Sin cambios' }
    params.push(participacionId)
    await this.dataSource.query(
      `UPDATE EVALUADORPARTICIPACION SET ${sets.join(', ')} WHERE PARTICIPACIONID = :${params.length}`,
      params,
    )
    return { message: 'Participación actualizada' }
  }

  async eliminarParticipacion(participacionId: number) {
    await this.dataSource.query(
      `DELETE FROM EVALUADORPARTICIPACION WHERE PARTICIPACIONID = :1`, [participacionId],
    )
    return { message: 'Participación eliminada' }
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Hoja de vida (1:1 con el evaluador, separada de Estudios)             ║
  // ╚══════════════════════════════════════════════════════════════════════╝

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

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Estudios (diplomas, certificados — excluye HV)                        ║
  // ╚══════════════════════════════════════════════════════════════════════╝

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

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Experiencia laboral                                                   ║
  // ╚══════════════════════════════════════════════════════════════════════╝

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

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ TIC                                                                   ║
  // ╚══════════════════════════════════════════════════════════════════════╝

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

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Pruebas de conocimiento                                               ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  async listarPruebas(evaluadorId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT PRUEBAID            AS "pruebaId",
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

  async crearPrueba(evaluadorId: number, dto: PruebaDto) {
    if (!dto.anio) throw new BadRequestException('Año requerido')
    const ok = await this.dataSource.query(`SELECT 1 FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId])
    if (!ok[0]) throw new NotFoundException('Evaluador no encontrado')

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT EVALUADORPRUEBA_SEQ.NEXTVAL FROM dual`,
    )
    const id = Number(seq[0].NEXTVAL)
    await this.dataSource.query(
      `INSERT INTO EVALUADORPRUEBA
         (PRUEBAID, EVALUADORID, ANIO, PERIODO, FECHAPRESENTACION, HORARIO, INTENTOS,
          PUNTAJEMAYOR, PRUEBANUMERO, EFECTIVIDAD, CORRECTAS, INCORRECTAS, TOTALTIEMPO,
          OBSERVACION)
       VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14)`,
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
      ],
    )
    return { pruebaId: id, message: 'Prueba registrada' }
  }

  async actualizarPrueba(pruebaId: number, dto: Partial<PruebaDto>) {
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
    params.push(pruebaId)
    await this.dataSource.query(
      `UPDATE EVALUADORPRUEBA SET ${sets.join(', ')} WHERE PRUEBAID = :${params.length}`,
      params,
    )
    return { message: 'Prueba actualizada' }
  }

  async eliminarPrueba(pruebaId: number) {
    await this.dataSource.query(`DELETE FROM EVALUADORPRUEBA WHERE PRUEBAID = :1`, [pruebaId])
    return { message: 'Prueba eliminada' }
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Documentos genéricos (cédula, autorización, confidencialidad, …)      ║
  // ║ En Fase 1 solo se usa CEDULA — el modelo ya soporta el resto.         ║
  // ╚══════════════════════════════════════════════════════════════════════╝

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

  /**
   * Lista los documentos genéricos de un evaluador.
   *
   * @param opciones.tipoCodigo   Filtra por código de tipo (CEDULA, AUTORIZACION, …).
   *                              Si viene, incluye ese tipo aunque `incluirCedula` sea false.
   * @param opciones.incluirCedula Si es false (default), excluye el tipo CEDULA
   *                               del listado — el frontend lo muestra en su propio card.
   *                               Ignorado cuando `tipoCodigo` viene explícito.
   */
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
      // Sin filtro y sin flag explícito: escondemos la cédula, que vive en su propio card.
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
    opts: { descripcion?: string; anioReferencia?: number } = {},
  ): Promise<{ mensaje: string; documentoId: number }> {
    if (!file?.buffer) throw new BadRequestException('Adjunta el PDF en el campo "archivo"')
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Solo se permiten archivos PDF')
    }
    if (!tipoId) throw new BadRequestException('tipoDocumentoEvalId es obligatorio')

    const ok = await this.dataSource.query(`SELECT 1 FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId])
    if (!ok[0]) throw new NotFoundException('Evaluador no encontrado')

    const tipo: Array<{ admiteMultiple: number }> = await this.dataSource.query(
      `SELECT ADMITEMULTIPLE AS "admiteMultiple"
         FROM TIPODOCUMENTOEVAL
        WHERE TIPODOCUMENTOEVALID = :1 AND ACTIVO = 1`,
      [tipoId],
    )
    if (!tipo[0]) throw new BadRequestException('Tipo de documento no existe o está inactivo')
    const admiteMultiple = Number(tipo[0].admiteMultiple) === 1

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

      // ID por MAX+1 (no hay secuencia dedicada — la tabla es pequeña y los ids no
      // se reciclan entre bases, así que el patrón es aceptable).
      const seq: Array<{ NUEVO: number }> = await qr.query(
        `SELECT NVL(MAX(DOCUMENTOID), 0) + 1 AS "NUEVO" FROM EVALUADORDOCUMENTO`,
      )
      const documentoId = Number(seq[0].NUEVO)

      const nombre = (file.originalname ?? '').toString().trim().slice(0, 255) || null
      await qr.query(
        `INSERT INTO EVALUADORDOCUMENTO
           (DOCUMENTOID, EVALUADORID, TIPODOCUMENTOEVALID, DOCUMENTODESCRIPCION,
            ANIOREFERENCIA, ARCHIVOPDF, ARCHIVOMIME, ARCHIVONOMBRE, FECHACARGUE)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8, SYSDATE)`,
        [
          documentoId,
          evaluadorId,
          tipoId,
          opts.descripcion?.trim() || null,
          opts.anioReferencia ?? null,
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

  /**
   * Shortcut de conveniencia: devuelve el documento CEDULA del evaluador si existe,
   * o `null` si no. El front lo usa para decidir si mostrar "subir" o "ver".
   */
  async getCedula(evaluadorId: number): Promise<{
    documentoId: number;
    archivoNombre: string | null;
    fechaCargue: Date;
  } | null> {
    const tipoId = await this.idTipoCedula()
    // ROWNUM se aplica antes del ORDER BY en Oracle, por lo que hay que anidar
    // el ORDER BY dentro de una subquery para quedarse con la fila más reciente.
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
