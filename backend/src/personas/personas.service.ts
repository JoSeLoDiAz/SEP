import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DataSource } from 'typeorm'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const oracledb = require('oracledb') as { DB_TYPE_BLOB: number }

// tipos en DOCUMENTOSPERSONAS: HV hoja de vida, EX experiencia, TI título, DA doc adicional
export type TipoDocPersona = 'HV' | 'EX' | 'TI' | 'DA'

const ADMIN = 1
const INTERVENTOR = 11
const COORD_INTERV = 10

const MAX_PDF_BYTES = 8 * 1024 * 1024

export interface PersonaDto {
  tipoDocumentoId: number
  identificacion: string
  nombres: string
  primerApellido: string
  segundoApellido?: string | null
  email: string
  emailInstitucional?: string | null
  celular?: string | null
  telefono?: string | null
  habeasData?: boolean
}

@Injectable()
export class PersonasService {
  constructor(private readonly dataSource: DataSource) {}

  async buscarPorDocumento(tipoDocumentoId: number, identificacion: string) {
    const [p] = await this.dataSource.query(
      `SELECT PERSONAID                                    AS "personaId",
              TIPODOCUMENTOIDENTIDADID                     AS "tipoDocumentoId",
              TRIM(PERSONAIDENTIFICACION)                  AS "identificacion",
              TRIM(PERSONANOMBRES)                         AS "nombres",
              TRIM(PERSONAPRIMERAPELLIDO)                  AS "primerApellido",
              TRIM(PERSONASEGUNDOAPELLIDO)                 AS "segundoApellido",
              TRIM(PERSONAEMAIL)                           AS "email",
              TRIM(PERSONAEMAILINSTITUCIONAL)              AS "emailInstitucional",
              TRIM(PERSONACELULAR)                         AS "celular",
              TRIM(PERSONATELEFONO)                        AS "telefono",
              TRIM(PERSONAHABEASDATA)                      AS "habeasData",
              TRIM(PERSONAHABEASDATAE)                     AS "habeasDataE",
              IDEMPRESA                                    AS "idEmpresa"
         FROM PERSONA
        WHERE TIPODOCUMENTOIDENTIDADID = :1
          AND TRIM(PERSONAIDENTIFICACION) = :2
        FETCH FIRST 1 ROW ONLY`,
      [Number(tipoDocumentoId), String(identificacion).trim()],
    )
    return p ?? null
  }

  async getPersona(personaId: number) {
    const [p] = await this.dataSource.query(
      `SELECT pe.PERSONAID                                 AS "personaId",
              pe.TIPODOCUMENTOIDENTIDADID                  AS "tipoDocumentoId",
              TRIM(td.TIPODOCUMENTOIDENTIDADNOMBRE)        AS "tipoDocumento",
              TRIM(pe.PERSONAIDENTIFICACION)               AS "identificacion",
              TRIM(pe.PERSONANOMBRES)                      AS "nombres",
              TRIM(pe.PERSONAPRIMERAPELLIDO)               AS "primerApellido",
              TRIM(pe.PERSONASEGUNDOAPELLIDO)              AS "segundoApellido",
              TRIM(pe.PERSONAEMAIL)                        AS "email",
              TRIM(pe.PERSONAEMAILINSTITUCIONAL)           AS "emailInstitucional",
              TRIM(pe.PERSONACELULAR)                      AS "celular",
              TRIM(pe.PERSONATELEFONO)                     AS "telefono",
              TRIM(pe.PERSONAHABEASDATA)                   AS "habeasData",
              TRIM(pe.PERSONAHABEASDATAE)                  AS "habeasDataE",
              pe.IDEMPRESA                                 AS "idEmpresa"
         FROM PERSONA pe
         LEFT JOIN TIPODOCUMENTOIDENTIDAD td ON td.TIPODOCUMENTOIDENTIDADID = pe.TIPODOCUMENTOIDENTIDADID
        WHERE pe.PERSONAID = :1`,
      [personaId],
    )
    if (!p) throw new NotFoundException('Persona no encontrada')
    return p
  }

  // si ya existe (mismo tipo + identificación) devuelve la existente sin tocarla
  async crearPersonaSiNoExiste(dto: PersonaDto, empresaId: number | null) {
    const existente = await this.buscarPorDocumento(dto.tipoDocumentoId, dto.identificacion)
    if (existente) return { personaId: existente.personaId, creada: false }
    this.validar(dto, /* esCrear */ true)
    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(PERSONAID), 0) + 1 AS "nid" FROM PERSONA`,
    )
    await this.dataSource.query(
      `INSERT INTO PERSONA
         (PERSONAID, TIPODOCUMENTOIDENTIDADID, PERSONANOMBRES, PERSONAPRIMERAPELLIDO,
          PERSONASEGUNDOAPELLIDO, PERSONAIDENTIFICACION,
          PERSONAEMAIL, PERSONAEMAILINSTITUCIONAL, PERSONACELULAR, PERSONATELEFONO,
          PERSONAHABEASDATA, PERSONAHABEASDATAE, IDEMPRESA, PERSONAFECHAREGISTRO)
       VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, SYSDATE)`,
      [
        Number(nid), Number(dto.tipoDocumentoId),
        dto.nombres.trim().toUpperCase(),
        dto.primerApellido.trim().toUpperCase(),
        (dto.segundoApellido ?? '').trim().toUpperCase() || null,
        String(dto.identificacion).trim(),
        dto.email.trim(),
        (dto.emailInstitucional ?? '').trim() || null,
        (dto.celular ?? '').trim() || null,
        (dto.telefono ?? '').trim() || null,
        dto.habeasData ? 'SI' : 'NO',
        dto.habeasData ? 'SI' : 'NO',
        empresaId ?? null,
      ],
    )
    return { personaId: Number(nid), creada: true }
  }

  async actualizarPersona(personaId: number, dto: Partial<PersonaDto>) {
    const [existe] = await this.dataSource.query(
      `SELECT PERSONAID AS "id" FROM PERSONA WHERE PERSONAID = :1`,
      [personaId],
    )
    if (!existe) throw new NotFoundException('Persona no encontrada')
    this.validar(dto, /* esCrear */ false)
    const sets: string[] = []
    const params: any[] = []
    let i = 1
    if (dto.nombres !== undefined)            { sets.push(`PERSONANOMBRES = :${i++}`);             params.push(dto.nombres.trim().toUpperCase()) }
    if (dto.primerApellido !== undefined)     { sets.push(`PERSONAPRIMERAPELLIDO = :${i++}`);      params.push(dto.primerApellido.trim().toUpperCase()) }
    if (dto.segundoApellido !== undefined)    { sets.push(`PERSONASEGUNDOAPELLIDO = :${i++}`);     params.push((dto.segundoApellido ?? '').trim().toUpperCase() || null) }
    if (dto.email !== undefined)              { sets.push(`PERSONAEMAIL = :${i++}`);               params.push(dto.email.trim()) }
    if (dto.emailInstitucional !== undefined) { sets.push(`PERSONAEMAILINSTITUCIONAL = :${i++}`);  params.push((dto.emailInstitucional ?? '').trim() || null) }
    if (dto.celular !== undefined)            { sets.push(`PERSONACELULAR = :${i++}`);             params.push((dto.celular ?? '').trim() || null) }
    if (dto.telefono !== undefined)           { sets.push(`PERSONATELEFONO = :${i++}`);            params.push((dto.telefono ?? '').trim() || null) }
    if (dto.habeasData !== undefined) {
      sets.push(`PERSONAHABEASDATAE = :${i++}`); params.push(dto.habeasData ? 'SI' : 'NO')
      sets.push(`PERSONAHABEASDATA  = :${i++}`); params.push(dto.habeasData ? 'SI' : 'NO')
    }
    if (sets.length === 0) return { message: 'Sin cambios.' }
    params.push(personaId)
    await this.dataSource.query(
      `UPDATE PERSONA SET ${sets.join(', ')} WHERE PERSONAID = :${i}`,
      params,
    )
    return { message: 'Datos personales actualizados.' }
  }

  private validar(dto: Partial<PersonaDto>, esCrear: boolean) {
    if (esCrear) {
      if (!dto.tipoDocumentoId)                  throw new BadRequestException('Tipo de documento obligatorio.')
      if (!String(dto.identificacion ?? '').trim()) throw new BadRequestException('Número de documento obligatorio.')
    }
    if (dto.email !== undefined) {
      const e = (dto.email ?? '').trim()
      if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
        throw new BadRequestException('Correo electrónico inválido.')
    }
    if (dto.emailInstitucional !== undefined && dto.emailInstitucional && dto.email
        && dto.emailInstitucional.trim().toLowerCase() === dto.email.trim().toLowerCase()) {
      throw new BadRequestException('El correo institucional no puede ser igual al personal.')
    }
    if (dto.nombres !== undefined && !dto.nombres.trim())            throw new BadRequestException('Nombres obligatorios.')
    if (dto.primerApellido !== undefined && !dto.primerApellido.trim()) throw new BadRequestException('Primer apellido obligatorio.')
    if (dto.celular !== undefined && dto.celular !== null && dto.celular !== '' && !/^[+\d\s-]{6,}$/.test(dto.celular)) {
      throw new BadRequestException('Celular inválido.')
    }
  }

  async listarDocumentos(personaId: number, tipo?: TipoDocPersona, num?: number) {
    const where = [`PERSONAID = :1`]
    const params: any[] = [personaId]
    if (tipo) { where.push(`TRIM(DOCUMENTOSPERSONASTIPO) = :${params.length + 1}`); params.push(tipo) }
    if (num != null && Number(num) > 0) { where.push(`DOCUMENTOSPERSONASNUM = :${params.length + 1}`); params.push(Number(num)) }
    return this.dataSource.query(
      `SELECT DOCUMENTOSPERSONASID                          AS "documentoId",
              PERSONAID                                     AS "personaId",
              DOCUMENTOSPERSONASNUM                         AS "num",
              TRIM(DOCUMENTOSPERSONASTIPO)                  AS "tipo",
              TRIM(DOCUMENTOSPERSONASNOMBREARCH)            AS "nombreArchivo",
              DOCUMENTOSPERSONASFECHAREGISTR                AS "fechaRegistro",
              DBMS_LOB.GETLENGTH(DOCUMENTOSPERSONASDOC)     AS "tamanoBytes"
         FROM DOCUMENTOSPERSONAS
        WHERE ${where.join(' AND ')}
        ORDER BY DOCUMENTOSPERSONASFECHAREGISTR DESC NULLS LAST`,
      params,
    )
  }

  async subirDocumento(
    personaId: number, tipo: TipoDocPersona, num: number,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    if (!['HV', 'EX', 'TI', 'DA'].includes(tipo)) {
      throw new BadRequestException(`Tipo de documento inválido: ${tipo}`)
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Solo se permiten archivos PDF.')
    }
    if (file.size > MAX_PDF_BYTES) {
      throw new BadRequestException(`El archivo supera el tamaño máximo permitido (${(MAX_PDF_BYTES / 1024 / 1024).toFixed(0)} MB).`)
    }
    if (!file.buffer || !file.buffer.length) {
      throw new BadRequestException('Archivo vacío o ilegible.')
    }
    const numFinal = Number(num) > 0 ? Number(num) : 0
    const [{ existentes }] = await this.dataSource.query(
      `SELECT COUNT(*) AS "existentes" FROM DOCUMENTOSPERSONAS
        WHERE PERSONAID = :1 AND TRIM(DOCUMENTOSPERSONASTIPO) = :2
          AND DOCUMENTOSPERSONASNUM = :3`,
      [personaId, tipo, numFinal],
    )
    if (Number(existentes) > 0) {
      throw new BadRequestException('Ya existe un documento asociado al registro. Elimina el actual antes de subir uno nuevo.')
    }
    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(DOCUMENTOSPERSONASID), 0) + 1 AS "nid" FROM DOCUMENTOSPERSONAS`,
    )
    await this.dataSource.query(
      `INSERT INTO DOCUMENTOSPERSONAS
         (DOCUMENTOSPERSONASID, PERSONAID, DOCUMENTOSPERSONASNUM, DOCUMENTOSPERSONASTIPO,
          DOCUMENTOSPERSONASNOMBREARCH, DOCUMENTOSPERSONASDOC, DOCUMENTOSPERSONASFECHAREGISTR)
       VALUES (:1, :2, :3, :4, :5, :6, SYSDATE)`,
      [
        Number(nid), personaId, numFinal, tipo,
        (file.originalname ?? 'archivo.pdf').slice(0, 200),
        { type: oracledb.DB_TYPE_BLOB, val: file.buffer } as any,
      ],
    )
    return {
      message: 'Archivo cargado correctamente.',
      documentoId: Number(nid),
      tamanoBytes: file.size,
    }
  }

  async getDocumentoArchivo(documentoId: number) {
    const rows = await this.dataSource.query(
      `SELECT DOCUMENTOSPERSONASID              AS "id",
              PERSONAID                          AS "personaId",
              TRIM(DOCUMENTOSPERSONASTIPO)       AS "tipo",
              DOCUMENTOSPERSONASNUM              AS "num",
              TRIM(DOCUMENTOSPERSONASNOMBREARCH) AS "nombreArchivo",
              DOCUMENTOSPERSONASDOC              AS "doc"
         FROM DOCUMENTOSPERSONAS
        WHERE DOCUMENTOSPERSONASID = :1`,
      [documentoId],
    )
    if (!rows.length) throw new NotFoundException('Documento no encontrado')
    const row = rows[0]
    let buffer: Buffer | null = null
    const docVal: any = row.doc
    if (Buffer.isBuffer(docVal)) {
      buffer = docVal
    } else if (docVal && typeof docVal.getData === 'function') {
      // Lob de oracledb
      buffer = await docVal.getData()
      try { await docVal.close() } catch { /* ignore */ }
    }
    if (!buffer) throw new NotFoundException('Documento sin contenido binario')
    return { nombreArchivo: row.nombreArchivo || 'archivo.pdf', buffer }
  }

  async listarTiposExperiencia() {
    return this.dataSource.query(
      `SELECT TIPOEXPERIENCIAID                  AS "id",
              TRIM(TIPOEXPERIENCIANOMBRE)        AS "nombre"
         FROM TIPOEXPERIENCIA
        WHERE TRIM(TIPOEXPERIENCIAESTADO) = '1'
        ORDER BY TIPOEXPERIENCIANOMBRE ASC`,
    )
  }

  // mismaConvocatoria = lo usa otro proyecto de la misma convocatoria: el front no deja editar
  async listarExperiencia(personaId: number, proyectoActualId?: number) {
    // como scalar subquery con binds posicionales oracledb devuelve 0 filas, por eso va aparte
    let convocatoriaActual: number | null = null
    if (proyectoActualId) {
      const [row] = await this.dataSource.query(
        `SELECT CONVOCATORIAID AS "id" FROM PROYECTO WHERE PROYECTOID = :1`,
        [Number(proyectoActualId)],
      )
      convocatoriaActual = row ? Number(row.id) : null
    }
    const rows: any[] = await this.dataSource.query(
      `SELECT pe.PERSONAEXPERIENCIAID                       AS "experienciaId",
              pe.PERSONAID                                  AS "personaId",
              pe.TIPOEXPERIENCIAID                          AS "tipoExperienciaId",
              TRIM(te.TIPOEXPERIENCIANOMBRE)                AS "tipoExperiencia",
              pe.PERSONAEXPERIENCIADESCRIPCION              AS "descripcion",
              pe.PERSONAEXPERIENCIAFECHAINICIO              AS "fechaInicio",
              pe.PERSONAEXPERIENCIAFECHAFIN                 AS "fechaFin",
              pe.PERSONAEXPERIENCIAFECHAREGISTR             AS "fechaRegistro",
              pe.PERSONAEXPERIENCIAFECHAACTUALI             AS "fechaActualizacion",
              TRIM(pe.PERSONAEXPERIENCIANOMBREARCHIV)       AS "estadoArchivo",
              pe.PERSONAEXPERIENCIAPROYECTO                 AS "proyectoOrigen",
              po.CONVOCATORIAID                             AS "convocatoriaOrigen"
         FROM PERSONAEXPERIENCIA pe
         LEFT JOIN TIPOEXPERIENCIA te ON te.TIPOEXPERIENCIAID = pe.TIPOEXPERIENCIAID
         LEFT JOIN PROYECTO po         ON po.PROYECTOID       = pe.PERSONAEXPERIENCIAPROYECTO
        WHERE pe.PERSONAID = :1
        ORDER BY pe.PERSONAEXPERIENCIAFECHAINICIO DESC NULLS LAST,
                 pe.PERSONAEXPERIENCIAID DESC`,
      [personaId],
    )
    return rows.map(r => {
      const co = r.convocatoriaOrigen != null ? Number(r.convocatoriaOrigen) : null
      const po = r.proyectoOrigen != null ? Number(r.proyectoOrigen) : null
      const mismaConv = !!proyectoActualId && po != null && po !== Number(proyectoActualId)
        && co != null && convocatoriaActual != null && co === convocatoriaActual
      return {
        ...r,
        convocatoriaOrigen: co,
        convocatoriaActual,
        mismaConvocatoria: mismaConv,
      }
    })
  }

  async crearExperiencia(personaId: number, dto: {
    tipoExperienciaId: number
    descripcion: string
    fechaInicio: string
    fechaFin: string
    proyectoId?: number
  }) {
    this.validarExperiencia(dto)
    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(PERSONAEXPERIENCIAID), 0) + 1 AS "nid" FROM PERSONAEXPERIENCIA`,
    )
    await this.dataSource.query(
      `INSERT INTO PERSONAEXPERIENCIA
         (PERSONAEXPERIENCIAID, PERSONAID, TIPOEXPERIENCIAID,
          PERSONAEXPERIENCIADESCRIPCION,
          PERSONAEXPERIENCIAFECHAINICIO, PERSONAEXPERIENCIAFECHAFIN,
          PERSONAEXPERIENCIAFECHAREGISTR, PERSONAEXPERIENCIAFECHAACTUALI,
          PERSONAEXPERIENCIAPROYECTO)
       VALUES (:1, :2, :3, :4, :5, :6, SYSDATE, SYSDATE, :7)`,
      [
        Number(nid), personaId, Number(dto.tipoExperienciaId),
        dto.descripcion.trim(),
        new Date(dto.fechaInicio),
        new Date(dto.fechaFin),
        dto.proyectoId ? Number(dto.proyectoId) : null,
      ],
    )
    return { message: 'Experiencia registrada.', experienciaId: Number(nid) }
  }

  async actualizarExperiencia(experienciaId: number, dto: {
    tipoExperienciaId?: number
    descripcion?: string
    fechaInicio?: string
    fechaFin?: string
    proyectoId?: number  // proyecto desde el cual se está editando
  }) {
    const [exp] = await this.dataSource.query(
      `SELECT pe.PERSONAEXPERIENCIAID                AS "id",
              TRIM(pe.PERSONAEXPERIENCIANOMBREARCHIV) AS "estadoArchivo",
              pe.PERSONAEXPERIENCIAPROYECTO          AS "proyectoOrigen",
              po.CONVOCATORIAID                       AS "convocatoriaOrigen"
         FROM PERSONAEXPERIENCIA pe
         LEFT JOIN PROYECTO po ON po.PROYECTOID = pe.PERSONAEXPERIENCIAPROYECTO
        WHERE pe.PERSONAEXPERIENCIAID = :1`,
      [experienciaId],
    )
    if (!exp) throw new NotFoundException('Experiencia no encontrada')
    if ((exp.estadoArchivo ?? '').toUpperCase() === 'APROBADO') {
      throw new BadRequestException('No se puede editar una experiencia ya aprobada por la interventoría.')
    }
    const heredada = !!dto.proyectoId && exp.proyectoOrigen != null
      && Number(exp.proyectoOrigen) !== Number(dto.proyectoId)
    if (heredada) {
      const [{ convActual }] = await this.dataSource.query(
        `SELECT CONVOCATORIAID AS "convActual" FROM PROYECTO WHERE PROYECTOID = :1`,
        [Number(dto.proyectoId)],
      )
      if (Number(exp.convocatoriaOrigen) === Number(convActual)) {
        throw new BadRequestException(
          'Esta experiencia fue registrada por otro proyecto de la misma convocatoria y no puede ser editada desde aquí.',
        )
      }
    }
    this.validarExperiencia(dto, /* esActualizar */ true)
    const sets: string[] = []
    const params: any[] = []
    let i = 1
    if (dto.tipoExperienciaId !== undefined) {
      sets.push(`TIPOEXPERIENCIAID = :${i++}`); params.push(Number(dto.tipoExperienciaId))
    }
    if (dto.descripcion !== undefined) {
      sets.push(`PERSONAEXPERIENCIADESCRIPCION = :${i++}`); params.push(dto.descripcion.trim())
    }
    if (dto.fechaInicio !== undefined) {
      sets.push(`PERSONAEXPERIENCIAFECHAINICIO = :${i++}`); params.push(new Date(dto.fechaInicio))
    }
    if (dto.fechaFin !== undefined) {
      sets.push(`PERSONAEXPERIENCIAFECHAFIN = :${i++}`); params.push(new Date(dto.fechaFin))
    }
    // al editar un ítem heredado, este proyecto lo toma y vuelve a pendiente de revisión
    if (heredada && dto.proyectoId) {
      sets.push(`PERSONAEXPERIENCIAPROYECTO = :${i++}`); params.push(Number(dto.proyectoId))
      sets.push(`PERSONAEXPERIENCIANOMBREARCHIV = NULL`)
    }
    if (sets.length === 0) return { message: 'Sin cambios.' }
    sets.push(`PERSONAEXPERIENCIAFECHAACTUALI = SYSDATE`)
    params.push(experienciaId)
    await this.dataSource.query(
      `UPDATE PERSONAEXPERIENCIA SET ${sets.join(', ')} WHERE PERSONAEXPERIENCIAID = :${i}`,
      params,
    )
    return {
      message: heredada
        ? 'Experiencia actualizada y asignada a este proyecto. Volvió a estado pendiente de revisión.'
        : 'Experiencia actualizada.',
    }
  }

  async eliminarExperiencia(experienciaId: number, proyectoActualId?: number) {
    const [exp] = await this.dataSource.query(
      `SELECT pe.PERSONAEXPERIENCIAID                AS "id",
              pe.PERSONAID                            AS "personaId",
              TRIM(pe.PERSONAEXPERIENCIANOMBREARCHIV) AS "estadoArchivo",
              pe.PERSONAEXPERIENCIAPROYECTO          AS "proyectoOrigen",
              po.CONVOCATORIAID                       AS "convocatoriaOrigen"
         FROM PERSONAEXPERIENCIA pe
         LEFT JOIN PROYECTO po ON po.PROYECTOID = pe.PERSONAEXPERIENCIAPROYECTO
        WHERE pe.PERSONAEXPERIENCIAID = :1`,
      [experienciaId],
    )
    if (!exp) throw new NotFoundException('Experiencia no encontrada')
    if ((exp.estadoArchivo ?? '').toUpperCase() === 'APROBADO') {
      throw new BadRequestException('No se puede eliminar una experiencia ya aprobada por la interventoría.')
    }
    if (proyectoActualId && exp.proyectoOrigen != null
        && Number(exp.proyectoOrigen) !== Number(proyectoActualId)) {
      const [{ convActual }] = await this.dataSource.query(
        `SELECT CONVOCATORIAID AS "convActual" FROM PROYECTO WHERE PROYECTOID = :1`,
        [Number(proyectoActualId)],
      )
      if (Number(exp.convocatoriaOrigen) === Number(convActual)) {
        throw new BadRequestException(
          'Esta experiencia fue registrada por otro proyecto de la misma convocatoria y no puede ser eliminada desde aquí.',
        )
      }
    }
    await this.dataSource.query(
      `DELETE FROM DOCUMENTOSPERSONAS
        WHERE PERSONAID = :1 AND TRIM(DOCUMENTOSPERSONASTIPO) = 'EX'
          AND DOCUMENTOSPERSONASNUM = :2`,
      [Number(exp.personaId), experienciaId],
    )
    await this.dataSource.query(
      `DELETE FROM PERSONAEXPERIENCIA WHERE PERSONAEXPERIENCIAID = :1`,
      [experienciaId],
    )
    return { message: 'Experiencia eliminada.' }
  }

  private validarExperiencia(
    dto: { tipoExperienciaId?: number; descripcion?: string; fechaInicio?: string; fechaFin?: string },
    esActualizar: boolean = false,
  ) {
    if (!esActualizar) {
      if (!dto.tipoExperienciaId)            throw new BadRequestException('Debe seleccionar un tipo de experiencia.')
      if (!String(dto.descripcion ?? '').trim()) throw new BadRequestException('La descripción no puede estar vacía.')
      if (!dto.fechaInicio)                  throw new BadRequestException('Debe seleccionar la fecha de inicio.')
      if (!dto.fechaFin)                     throw new BadRequestException('Debe seleccionar la fecha de finalización.')
    }
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    if (dto.fechaInicio !== undefined && dto.fechaInicio !== null) {
      const fi = new Date(dto.fechaInicio)
      if (Number.isNaN(fi.getTime())) throw new BadRequestException('Fecha de inicio inválida.')
      if (fi >= hoy) throw new BadRequestException('La fecha de inicio no puede ser hoy ni en el futuro.')
    }
    if (dto.fechaFin !== undefined && dto.fechaFin !== null) {
      const ff = new Date(dto.fechaFin)
      if (Number.isNaN(ff.getTime())) throw new BadRequestException('Fecha de finalización inválida.')
      if (ff > hoy) throw new BadRequestException('La fecha de finalización no puede ser superior a hoy.')
    }
    if (dto.fechaInicio !== undefined && dto.fechaFin !== undefined && dto.fechaInicio && dto.fechaFin) {
      if (new Date(dto.fechaFin) < new Date(dto.fechaInicio)) {
        throw new BadRequestException('La fecha de finalización no puede ser menor a la inicial.')
      }
    }
  }

  async listarTiposTitulo() {
    return this.dataSource.query(
      `SELECT TIPOTITULOID                  AS "id",
              TRIM(TIPOTITULONOMBRE)        AS "nombre",
              TIPOTITULORANGO               AS "rango"
         FROM TIPOTITULO
        WHERE TRIM(TIPOTITULOESTADO) = '1'
        ORDER BY NVL(TIPOTITULORANGO, 0) ASC, TIPOTITULONOMBRE ASC`,
    )
  }

  async listarTitulos(personaId: number, proyectoActualId?: number) {
    let convocatoriaActual: number | null = null
    if (proyectoActualId) {
      const [row] = await this.dataSource.query(
        `SELECT CONVOCATORIAID AS "id" FROM PROYECTO WHERE PROYECTOID = :1`,
        [Number(proyectoActualId)],
      )
      convocatoriaActual = row ? Number(row.id) : null
    }
    const rows: any[] = await this.dataSource.query(
      `SELECT pt.PERSONATITULOSID                           AS "tituloId",
              pt.PERSONAID                                  AS "personaId",
              pt.TIPOTITULOID                               AS "tipoTituloId",
              TRIM(tt.TIPOTITULONOMBRE)                     AS "tipoTitulo",
              pt.PERSONATITULOSDESCRIPCION                  AS "descripcion",
              pt.PERSONATITULOFECHAGRADUACION               AS "fechaGraduacion",
              pt.PERSONATITULOFECHAREGISTRO                 AS "fechaRegistro",
              pt.PERSONATITULOFECHAACTUALIZACIO             AS "fechaActualizacion",
              TRIM(pt.PERSONATITULONOMBREARCHIVO)           AS "estadoArchivo",
              pt.PERSONATITULOSPROYECTO                     AS "proyectoOrigen",
              po.CONVOCATORIAID                             AS "convocatoriaOrigen"
         FROM PERSONATITULOS pt
         LEFT JOIN TIPOTITULO tt ON tt.TIPOTITULOID = pt.TIPOTITULOID
         LEFT JOIN PROYECTO po   ON po.PROYECTOID  = pt.PERSONATITULOSPROYECTO
        WHERE pt.PERSONAID = :1
        ORDER BY pt.PERSONATITULOFECHAGRADUACION DESC NULLS LAST,
                 pt.PERSONATITULOSID DESC`,
      [personaId],
    )
    return rows.map(r => {
      const co = r.convocatoriaOrigen != null ? Number(r.convocatoriaOrigen) : null
      const po = r.proyectoOrigen != null ? Number(r.proyectoOrigen) : null
      const mismaConv = !!proyectoActualId && po != null && po !== Number(proyectoActualId)
        && co != null && convocatoriaActual != null && co === convocatoriaActual
      return { ...r, convocatoriaOrigen: co, convocatoriaActual, mismaConvocatoria: mismaConv }
    })
  }

  async crearTitulo(personaId: number, dto: {
    tipoTituloId: number
    descripcion: string
    fechaGraduacion: string
    proyectoId?: number
  }) {
    this.validarTitulo(dto)
    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(PERSONATITULOSID), 0) + 1 AS "nid" FROM PERSONATITULOS`,
    )
    await this.dataSource.query(
      `INSERT INTO PERSONATITULOS
         (PERSONATITULOSID, PERSONAID, TIPOTITULOID,
          PERSONATITULOSDESCRIPCION, PERSONATITULOFECHAGRADUACION,
          PERSONATITULOFECHAREGISTRO, PERSONATITULOFECHAACTUALIZACIO,
          PERSONATITULOSPROYECTO)
       VALUES (:1, :2, :3, :4, :5, SYSDATE, SYSDATE, :6)`,
      [
        Number(nid), personaId, Number(dto.tipoTituloId),
        dto.descripcion.trim(),
        new Date(dto.fechaGraduacion),
        dto.proyectoId ? Number(dto.proyectoId) : null,
      ],
    )
    return { message: 'Título registrado.', tituloId: Number(nid) }
  }

  async actualizarTitulo(tituloId: number, dto: {
    tipoTituloId?: number
    descripcion?: string
    fechaGraduacion?: string
    proyectoId?: number
  }) {
    const [t] = await this.dataSource.query(
      `SELECT pt.PERSONATITULOSID                AS "id",
              TRIM(pt.PERSONATITULONOMBREARCHIVO) AS "estadoArchivo",
              pt.PERSONATITULOSPROYECTO          AS "proyectoOrigen",
              po.CONVOCATORIAID                   AS "convocatoriaOrigen"
         FROM PERSONATITULOS pt
         LEFT JOIN PROYECTO po ON po.PROYECTOID = pt.PERSONATITULOSPROYECTO
        WHERE pt.PERSONATITULOSID = :1`,
      [tituloId],
    )
    if (!t) throw new NotFoundException('Título no encontrado')
    if ((t.estadoArchivo ?? '').toUpperCase() === 'APROBADO') {
      throw new BadRequestException('No se puede editar un título ya aprobado por la interventoría.')
    }
    const heredado = !!dto.proyectoId && t.proyectoOrigen != null
      && Number(t.proyectoOrigen) !== Number(dto.proyectoId)
    if (heredado) {
      const [{ convActual }] = await this.dataSource.query(
        `SELECT CONVOCATORIAID AS "convActual" FROM PROYECTO WHERE PROYECTOID = :1`,
        [Number(dto.proyectoId)],
      )
      if (Number(t.convocatoriaOrigen) === Number(convActual)) {
        throw new BadRequestException(
          'Este título fue registrado por otro proyecto de la misma convocatoria y no puede ser editado desde aquí.',
        )
      }
    }
    this.validarTitulo(dto, /* esActualizar */ true)
    const sets: string[] = []
    const params: any[] = []
    let i = 1
    if (dto.tipoTituloId !== undefined) {
      sets.push(`TIPOTITULOID = :${i++}`); params.push(Number(dto.tipoTituloId))
    }
    if (dto.descripcion !== undefined) {
      sets.push(`PERSONATITULOSDESCRIPCION = :${i++}`); params.push(dto.descripcion.trim())
    }
    if (dto.fechaGraduacion !== undefined) {
      sets.push(`PERSONATITULOFECHAGRADUACION = :${i++}`); params.push(new Date(dto.fechaGraduacion))
    }
    if (heredado && dto.proyectoId) {
      sets.push(`PERSONATITULOSPROYECTO = :${i++}`); params.push(Number(dto.proyectoId))
      sets.push(`PERSONATITULONOMBREARCHIVO = NULL`)
    }
    if (sets.length === 0) return { message: 'Sin cambios.' }
    sets.push(`PERSONATITULOFECHAACTUALIZACIO = SYSDATE`)
    params.push(tituloId)
    await this.dataSource.query(
      `UPDATE PERSONATITULOS SET ${sets.join(', ')} WHERE PERSONATITULOSID = :${i}`,
      params,
    )
    return {
      message: heredado
        ? 'Título actualizado y asignado a este proyecto. Volvió a estado pendiente de revisión.'
        : 'Título actualizado.',
    }
  }

  async eliminarTitulo(tituloId: number, proyectoActualId?: number) {
    const [t] = await this.dataSource.query(
      `SELECT pt.PERSONATITULOSID                AS "id",
              pt.PERSONAID                       AS "personaId",
              TRIM(pt.PERSONATITULONOMBREARCHIVO) AS "estadoArchivo",
              pt.PERSONATITULOSPROYECTO          AS "proyectoOrigen",
              po.CONVOCATORIAID                   AS "convocatoriaOrigen"
         FROM PERSONATITULOS pt
         LEFT JOIN PROYECTO po ON po.PROYECTOID = pt.PERSONATITULOSPROYECTO
        WHERE pt.PERSONATITULOSID = :1`,
      [tituloId],
    )
    if (!t) throw new NotFoundException('Título no encontrado')
    if ((t.estadoArchivo ?? '').toUpperCase() === 'APROBADO') {
      throw new BadRequestException('No se puede eliminar un título ya aprobado por la interventoría.')
    }
    if (proyectoActualId && t.proyectoOrigen != null
        && Number(t.proyectoOrigen) !== Number(proyectoActualId)) {
      const [{ convActual }] = await this.dataSource.query(
        `SELECT CONVOCATORIAID AS "convActual" FROM PROYECTO WHERE PROYECTOID = :1`,
        [Number(proyectoActualId)],
      )
      if (Number(t.convocatoriaOrigen) === Number(convActual)) {
        throw new BadRequestException(
          'Este título fue registrado por otro proyecto de la misma convocatoria y no puede ser eliminado desde aquí.',
        )
      }
    }
    await this.dataSource.query(
      `DELETE FROM DOCUMENTOSPERSONAS
        WHERE PERSONAID = :1 AND TRIM(DOCUMENTOSPERSONASTIPO) = 'TI'
          AND DOCUMENTOSPERSONASNUM = :2`,
      [Number(t.personaId), tituloId],
    )
    await this.dataSource.query(
      `DELETE FROM PERSONATITULOS WHERE PERSONATITULOSID = :1`,
      [tituloId],
    )
    return { message: 'Título eliminado.' }
  }

  private validarTitulo(
    dto: { tipoTituloId?: number; descripcion?: string; fechaGraduacion?: string },
    esActualizar: boolean = false,
  ) {
    if (!esActualizar) {
      if (!dto.tipoTituloId)                        throw new BadRequestException('Debe seleccionar un tipo de título.')
      if (!String(dto.descripcion ?? '').trim())    throw new BadRequestException('La descripción no puede estar vacía.')
      if (!dto.fechaGraduacion)                     throw new BadRequestException('Debe seleccionar la fecha de graduación.')
    }
    if (dto.fechaGraduacion !== undefined && dto.fechaGraduacion !== null) {
      const fg = new Date(dto.fechaGraduacion)
      if (Number.isNaN(fg.getTime())) throw new BadRequestException('Fecha de graduación inválida.')
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
      if (fg > hoy) throw new BadRequestException('La fecha de graduación no puede ser superior a hoy.')
    }
  }

  async listarTiposDocAdicional() {
    return this.dataSource.query(
      `SELECT PERSONADOCREQID            AS "id",
              TRIM(PERSONADOCREQNOMBRE)  AS "nombre",
              TRIM(PERSONADOCREQSIGLA)   AS "sigla"
         FROM PERSONADOCREQUERIDOS
        WHERE TRIM(PERSONADOCREQESTADO) = '1'
        ORDER BY PERSONADOCREQID ASC`,
    )
  }

  async listarDocsAdicionales(personaId: number) {
    const rows: any[] = await this.dataSource.query(
      `SELECT da.HVPERSONADOCADICID                            AS "docAdicId",
              da.PERSONAID                                     AS "personaId",
              da.PERSONADOCREQID                               AS "tipoDocId",
              TRIM(dr.PERSONADOCREQNOMBRE)                     AS "nombre",
              TRIM(dr.PERSONADOCREQSIGLA)                      AS "sigla",
              da.HVPERSONADOCADICIONALPROYECTO                 AS "proyectoOrigen",
              TRIM(da.HVPERSONADOCADICNOMBREARCHIVO)           AS "estado",
              da.HVPERSONADOCADICFECHAREGISTRO                 AS "fechaRegistro",
              dp.DOCUMENTOSPERSONASID                          AS "documentoId",
              TRIM(dp.DOCUMENTOSPERSONASNOMBREARCH)            AS "nombreArchivo",
              DBMS_LOB.GETLENGTH(dp.DOCUMENTOSPERSONASDOC)     AS "tamanoBytes",
              dp.DOCUMENTOSPERSONASFECHAREGISTR                AS "docFechaRegistro"
         FROM HVPERSONADOCADICIONAL da
         JOIN PERSONADOCREQUERIDOS dr ON dr.PERSONADOCREQID = da.PERSONADOCREQID
         LEFT JOIN DOCUMENTOSPERSONAS dp
           ON dp.PERSONAID = da.PERSONAID
          AND TRIM(dp.DOCUMENTOSPERSONASTIPO) = 'DA'
          AND dp.DOCUMENTOSPERSONASNUM = da.HVPERSONADOCADICID
        WHERE da.PERSONAID = :1
        ORDER BY da.HVPERSONADOCADICID ASC`,
      [personaId],
    )
    return rows.map(r => ({
      docAdicId: Number(r.docAdicId),
      personaId: Number(r.personaId),
      tipoDocId: Number(r.tipoDocId),
      nombre: r.nombre,
      sigla: r.sigla,
      proyectoOrigen: r.proyectoOrigen != null ? Number(r.proyectoOrigen) : null,
      estado: r.estado ?? null,
      fechaRegistro: r.fechaRegistro ?? null,
      documento: r.documentoId ? {
        documentoId: Number(r.documentoId),
        nombreArchivo: r.nombreArchivo ?? 'archivo.pdf',
        tamanoBytes: Number(r.tamanoBytes ?? 0),
        fechaRegistro: r.docFechaRegistro ?? null,
      } : null,
    }))
  }

  async crearDocAdicional(personaId: number, dto: { tipoDocId: number; proyectoId?: number }) {
    if (!dto.tipoDocId) throw new BadRequestException('Debe seleccionar un tipo de documento.')
    const [tipo] = await this.dataSource.query(
      `SELECT PERSONADOCREQID AS "id" FROM PERSONADOCREQUERIDOS WHERE PERSONADOCREQID = :1`,
      [dto.tipoDocId],
    )
    if (!tipo) throw new BadRequestException('Tipo de documento no encontrado.')
    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(HVPERSONADOCADICID), 0) + 1 AS "nid" FROM HVPERSONADOCADICIONAL`,
    )
    await this.dataSource.query(
      `INSERT INTO HVPERSONADOCADICIONAL
         (HVPERSONADOCADICID, PERSONAID, PERSONADOCREQID, HVPERSONADOCADICIONALPROYECTO,
          HVPERSONADOCADICNOMBREARCHIVO, HVPERSONADOCADICFECHAREGISTRO)
       VALUES (:1, :2, :3, :4, 'PENDIENTE', SYSDATE)`,
      [Number(nid), personaId, Number(dto.tipoDocId), dto.proyectoId ? Number(dto.proyectoId) : null],
    )
    return { message: 'Documento adicional registrado.', docAdicId: Number(nid) }
  }

  async eliminarDocAdicional(docAdicId: number, perfilId: number) {
    const [da] = await this.dataSource.query(
      `SELECT HVPERSONADOCADICID                        AS "id",
              PERSONAID                                 AS "personaId",
              TRIM(HVPERSONADOCADICNOMBREARCHIVO)       AS "estado"
         FROM HVPERSONADOCADICIONAL WHERE HVPERSONADOCADICID = :1`,
      [docAdicId],
    )
    if (!da) throw new NotFoundException('Documento adicional no encontrado.')
    if ((da.estado ?? '').toUpperCase() === 'APROBADO' && perfilId !== ADMIN) {
      throw new BadRequestException('No se puede eliminar un documento ya aprobado por la interventoría.')
    }
    await this.dataSource.query(
      `DELETE FROM DOCUMENTOSPERSONAS
        WHERE PERSONAID = :1 AND TRIM(DOCUMENTOSPERSONASTIPO) = 'DA'
          AND DOCUMENTOSPERSONASNUM = :2`,
      [Number(da.personaId), docAdicId],
    )
    await this.dataSource.query(
      `DELETE FROM HVPERSONADOCADICIONAL WHERE HVPERSONADOCADICID = :1`,
      [docAdicId],
    )
    return { message: 'Documento adicional eliminado.' }
  }

  async eliminarDocumento(documentoId: number, perfilId: number) {
    const [d] = await this.dataSource.query(
      `SELECT DOCUMENTOSPERSONASID AS "id", PERSONAID AS "personaId",
              TRIM(DOCUMENTOSPERSONASTIPO) AS "tipo"
         FROM DOCUMENTOSPERSONAS WHERE DOCUMENTOSPERSONASID = :1`,
      [documentoId],
    )
    if (!d) throw new NotFoundException('Documento no encontrado')
    // permiso provisional: falta atar el borrado al estado de aprobación del ítem
    if (perfilId !== ADMIN && perfilId !== 7 && perfilId !== INTERVENTOR && perfilId !== COORD_INTERV) {
      throw new ForbiddenException('No tienes permiso para eliminar este documento.')
    }
    await this.dataSource.query(
      `DELETE FROM DOCUMENTOSPERSONAS WHERE DOCUMENTOSPERSONASID = :1`,
      [documentoId],
    )
    return { message: 'Documento eliminado.' }
  }
}
