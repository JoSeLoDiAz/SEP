import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

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
  jefeDirecto?: string
  quienAprueba?: string
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
              p.CIUDADID                      AS "ciudadId"
         FROM EVALUADOR e
         JOIN PERSONA   p ON p.PERSONAID = e.PERSONAID
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
        await qr.query(
          `INSERT INTO PERSONA
             (PERSONAID, TIPODOCUMENTOIDENTIDADID, PERSONANOMBRES, PERSONAPRIMERAPELLIDO,
              PERSONASEGUNDOAPELLIDO, PERSONAIDENTIFICACION, PERSONAEMAIL, PERSONAEMAILINSTITUCIONAL,
              PERSONACELULAR, PERSONAFECHAREGISTRO, GENEROID, CIUDADID, PERSONAHABEASDATA, PERSONAHABEASDATAE)
           VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, SYSDATE, 3, :10, 'SI', 'NA')`,
          [
            personaId,
            dto.tipoDocumentoIdentidadId,
            dto.nombres.trim(),
            dto.primerApellido.trim(),
            (dto.segundoApellido ?? '').trim(),
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
      await qr.query(
        `INSERT INTO EVALUADOR
           (EVALUADORID, PERSONAID, CENTROID, REGIONALID, EVALUADORCARGO, EVALUADORPROFESION,
            EVALUADORPOSGRADO, EVALUADOROTROSEST, EVALUADORJEFEDIR, EVALUADORQUIENAPRUEBA,
            EVALUADORACTIVO, FECHACREACION)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, 1, SYSDATE)`,
        [
          evaluadorId, personaId,
          dto.centroId ?? null, dto.regionalId ?? null,
          (dto.cargo ?? '').trim() || null,
          (dto.profesion ?? '').trim() || null,
          (dto.posgrado ?? '').trim() || null,
          (dto.otrosEstudios ?? '').trim() || null,
          (dto.jefeDirecto ?? '').trim() || null,
          (dto.quienAprueba ?? '').trim() || null,
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
      ]
      for (const [k, col] of mapEval) {
        if (dto[k] !== undefined) {
          const val = dto[k]
          paramsEval.push(typeof val === 'string' ? (val.trim() || null) : val)
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
          paramsPer.push(typeof val === 'string' ? (val.trim() || null) : val)
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

    await this.dataSource.query(
      `UPDATE EVALUADOR SET EVALUADORFOTO = :1, EVALUADORFOTOMIME = :2 WHERE EVALUADORID = :3`,
      [file.buffer, file.mimetype, evaluadorId],
    )
    return { message: 'Foto actualizada', size: file.size, mime: file.mimetype }
  }

  async getFoto(evaluadorId: number): Promise<{ buffer: Buffer; mime: string }> {
    const rows: Array<{ foto: NodeJS.ReadableStream | Buffer | null; mime: string | null }> =
      await this.dataSource.query(
        `SELECT EVALUADORFOTO AS "foto", TRIM(EVALUADORFOTOMIME) AS "mime"
           FROM EVALUADOR WHERE EVALUADORID = :1`,
        [evaluadorId],
      )
    const r = rows[0]
    if (!r || !r.foto) throw new NotFoundException('Foto no encontrada')
    const buffer = await this.lobToBuffer(r.foto)
    return { buffer, mime: r.mime || 'image/jpeg' }
  }

  async borrarFoto(evaluadorId: number) {
    await this.dataSource.query(
      `UPDATE EVALUADOR SET EVALUADORFOTO = NULL, EVALUADORFOTOMIME = NULL WHERE EVALUADORID = :1`,
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
}
