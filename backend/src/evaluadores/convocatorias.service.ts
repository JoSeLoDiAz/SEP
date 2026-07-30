import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import type { MulterFile } from './evaluadores.service'

// Tope de tamaño por archivo adjunto a la convocatoria (20 MB). Se aplica
// tanto en el interceptor multer como en la validación defensiva del service.
export const MAX_CONV_DOC_BYTES = 20 * 1024 * 1024

// Extensiones que el catálogo puede declarar por defecto. Sólo se usan como
// fallback si el catálogo trae la cadena vacía — el flujo real lee la lista
// del registro en TIPODOCUMENTOCONV.
const EXTENSIONES_FALLBACK = ['pdf']

export interface ConvocatoriaCrearDto {
  anio: number
  periodo?: string | null
  nombre: string
  modalidadPart?: string | null
  fechaInicio?: string | null
  fechaFin?: string | null
  observaciones?: string | null
  /**
   * Convocatoria REAL del SEP sobre la que se monta este ciclo (v40).
   *
   * El ciclo de evaluadores no es una convocatoria aparte: es la capa de
   * reglas —cortes, certificación, matriz— que se le pone encima a una
   * convocatoria que ya existe, con su programa, presupuesto y fechas. Sin
   * atarlo, el gestor teclea un nombre libre que no coincide con el oficial y
   * los dos mundos dejan de cuadrar.
   */
  convocatoriaSepId?: number | null
}

export interface ConvocatoriaActualizarDto {
  anio?: number
  periodo?: string | null
  nombre?: string
  modalidadPart?: string | null
  fechaInicio?: string | null
  fechaFin?: string | null
  observaciones?: string | null
  activo?: boolean
  /** Nota de corte de la prueba de conocimiento de ESE año. */
  puntajeMinimoPrueba?: number | null
  /** Nota de corte del curso de formación de ESE año. */
  calificacionMinimaCurso?: number | null
  /** Cuerpo del certificado con placeholders {{nombre}}, {{rol}}, {{horas}}… */
  certificadoTexto?: string | null
  /** Firma que se estampa en el certificado (FK a FIRMACERTIFICADOS). */
  certificadoFirmaId?: number | null
  /** 1 = se pueden emitir certificados del ciclo. Se habilita al cerrar el proceso. */
  certificadoHabilitado?: boolean
  /** Convocatoria real del SEP a la que pertenece el ciclo (v40). */
  convocatoriaSepId?: number | null
}

export interface ListarConvocatoriasQuery {
  anio?: number
  activo?: boolean
  busqueda?: string
  page?: number
  limit?: number
}

@Injectable()
export class ConvocatoriasService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Listado / Ficha                                                       ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  async listar(query: ListarConvocatoriasQuery = {}) {
    const pagina = Math.max(1, Number(query.page) || 1)
    const tamPag = Math.min(100, Math.max(1, Number(query.limit) || 20))
    const offset = (pagina - 1) * tamPag

    const conds: string[] = []
    const params: unknown[] = []

    if (query.anio != null && Number.isFinite(Number(query.anio))) {
      params.push(Number(query.anio))
      conds.push(`c.ANIO = :${params.length}`)
    }
    if (query.activo !== undefined) {
      params.push(query.activo ? 1 : 0)
      conds.push(`c.ACTIVO = :${params.length}`)
    }
    const q = (query.busqueda ?? '').trim()
    if (q) {
      // Escapar comodines LIKE (% _ \) para que el usuario no dispare wildcards
      // por accidente al tipear caracteres especiales.
      const esc = q.toUpperCase().replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
      params.push(`%${esc}%`)
      conds.push(`UPPER(c.NOMBRE) LIKE :${params.length} ESCAPE '\\'`)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

    const totalRows: Array<{ T: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS "T" FROM EVALUADORCONVOCATORIA c ${where}`,
      params,
    )
    const total = Number(totalRows[0]?.T ?? 0)

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT c.CONVOCATORIAID       AS "id",
              c.ANIO                 AS "anio",
              TRIM(c.PERIODO)        AS "periodo",
              TRIM(c.NOMBRE)         AS "nombre",
              c.MODALIDADPARTID      AS "modalidadPartId",
              TRIM(mo.CODIGO)        AS "modalidadPart",
              TRIM(mo.NOMBRE)        AS "modalidadNombre",
              c.FECHAINICIO          AS "fechaInicio",
              c.FECHAFIN             AS "fechaFin",
              c.ACTIVO               AS "activo",
              (SELECT COUNT(*) FROM CONVOCATORIADOCUMENTO d
                 WHERE d.CONVOCATORIAID = c.CONVOCATORIAID) AS "numDocumentos"
         FROM EVALUADORCONVOCATORIA c
         LEFT JOIN MODALIDADPART mo ON mo.MODALIDADPARTID = c.MODALIDADPARTID
         ${where}
         ORDER BY c.ANIO DESC, c.CONVOCATORIAID DESC
         OFFSET ${offset} ROWS FETCH NEXT ${tamPag} ROWS ONLY`,
      params,
    )

    return {
      items: rows.map(r => ({
        id: Number(r.id),
        anio: Number(r.anio),
        periodo: r.periodo ?? null,
        nombre: r.nombre ?? '',
        modalidadPart: r.modalidadPart ?? null,
        fechaInicio: r.fechaInicio ?? null,
        fechaFin: r.fechaFin ?? null,
        activo: Number(r.activo) === 1,
        numDocumentos: Number(r.numDocumentos ?? 0),
      })),
      total,
      page: pagina,
      limit: tamPag,
    }
  }

  async getFicha(convocatoriaId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT c.CONVOCATORIAID       AS "id",
              c.ANIO                 AS "anio",
              TRIM(c.PERIODO)        AS "periodo",
              TRIM(c.NOMBRE)         AS "nombre",
              c.MODALIDADPARTID      AS "modalidadPartId",
              TRIM(mo.CODIGO)        AS "modalidadPart",
              TRIM(mo.NOMBRE)        AS "modalidadNombre",
              c.FECHAINICIO          AS "fechaInicio",
              c.FECHAFIN             AS "fechaFin",
              TRIM(c.OBSERVACIONES)  AS "observaciones",
              c.ACTIVO               AS "activo",
              c.PUNTAJEMINIMOPRUEBA  AS "puntajeMinimoPrueba",
              c.CALIFICACIONMINIMACURSO AS "calificacionMinimaCurso",
              c.CERTIFICADOTEXTO     AS "certificadoTexto",
              c.CERTIFICADOFIRMAID   AS "certificadoFirmaId",
              NVL(c.CERTIFICADOHABILITADO, 0) AS "certificadoHabilitado",
              c.CONVOCATORIASEPID    AS "convocatoriaSepId",
              TRIM(cs.CONVOCATORIANOMBRE) AS "convocatoriaSepNombre",
              cs.CONVOCATORIAANIO    AS "convocatoriaSepAnio",
              c.FECHACREACION        AS "fechaCreacion"
         FROM EVALUADORCONVOCATORIA c
         LEFT JOIN MODALIDADPART mo ON mo.MODALIDADPARTID = c.MODALIDADPARTID
         LEFT JOIN CONVOCATORIA  cs ON cs.CONVOCATORIAID  = c.CONVOCATORIASEPID
        WHERE c.CONVOCATORIAID = :1`,
      [convocatoriaId],
    )
    if (!rows[0]) throw new NotFoundException('Convocatoria no encontrada')

    // Conteo por tipo de documento — el frontend lo usa para poblar el bloque
    // "documentos disponibles" en la ficha.
    const porTipo: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT TRIM(t.CODIGO) AS "tipoCodigo",
              TRIM(t.NOMBRE) AS "tipoNombre",
              COUNT(d.DOCUMENTOID) AS "count"
         FROM TIPODOCUMENTOCONV t
         LEFT JOIN CONVOCATORIADOCUMENTO d
           ON d.TIPODOCUMENTOCONVID = t.TIPODOCUMENTOCONVID
          AND d.CONVOCATORIAID      = :1
        WHERE t.ACTIVO = 1
        GROUP BY t.CODIGO, t.NOMBRE, t.ORDEN
        ORDER BY t.ORDEN ASC, t.NOMBRE ASC`,
      [convocatoriaId],
    )

    const r = rows[0]
    return {
      id: Number(r.id),
      anio: Number(r.anio),
      periodo: r.periodo ?? null,
      nombre: r.nombre ?? '',
      modalidadPart: r.modalidadPart ?? null,
      fechaInicio: r.fechaInicio ?? null,
      fechaFin: r.fechaFin ?? null,
      observaciones: r.observaciones ?? null,
      activo: Number(r.activo) === 1,
      puntajeMinimoPrueba: r.puntajeMinimoPrueba != null ? Number(r.puntajeMinimoPrueba) : null,
      calificacionMinimaCurso: r.calificacionMinimaCurso != null ? Number(r.calificacionMinimaCurso) : null,
      certificadoTexto: (r.certificadoTexto as string | null) ?? null,
      certificadoFirmaId: r.certificadoFirmaId != null ? Number(r.certificadoFirmaId) : null,
      convocatoriaSepId: r.convocatoriaSepId != null ? Number(r.convocatoriaSepId) : null,
      convocatoriaSepNombre: (r.convocatoriaSepNombre as string | null) ?? null,
      convocatoriaSepAnio: r.convocatoriaSepAnio != null ? Number(r.convocatoriaSepAnio) : null,
      certificadoHabilitado: Number(r.certificadoHabilitado) === 1,
      fechaCreacion: r.fechaCreacion ?? null,
      documentosPorTipo: porTipo.map(t => ({
        tipoCodigo: String(t.tipoCodigo ?? ''),
        tipoNombre: String(t.tipoNombre ?? ''),
        count: Number(t.count ?? 0),
      })),
    }
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Crear / Actualizar / Desactivar                                       ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  async crear(dto: ConvocatoriaCrearDto) {
    this.validarAnio(dto.anio)
    if (!dto.nombre?.trim()) {
      throw new BadRequestException('El nombre de la convocatoria es obligatorio')
    }

    // ID por MAX+1 (mismo patrón que EVALUADORDOCUMENTO — tabla pequeña, sin
    // secuencia dedicada). Suficiente porque no hay concurrencia alta.
    const seq: Array<{ NUEVO: number }> = await this.dataSource.query(
      `SELECT NVL(MAX(CONVOCATORIAID), 0) + 1 AS "NUEVO" FROM EVALUADORCONVOCATORIA`,
    )
    const convocatoriaId = Number(seq[0].NUEVO)

    await this.validarConvocatoriaSep(dto.convocatoriaSepId, dto.anio)

    const modalidadId = await this.idModalidad(dto.modalidadPart)
    try {
      await this.dataSource.query(
        `INSERT INTO EVALUADORCONVOCATORIA
           (CONVOCATORIAID, ANIO, PERIODO, NOMBRE, MODALIDADPARTID, FECHAINICIO, FECHAFIN,
            OBSERVACIONES, CONVOCATORIASEPID, ACTIVO, FECHACREACION)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, 1, SYSDATE)`,
        [
          convocatoriaId,
          Number(dto.anio),
          (dto.periodo ?? '').toString().trim() || null,
          dto.nombre.trim(),
          modalidadId,
          dto.fechaInicio ? new Date(dto.fechaInicio) : null,
          dto.fechaFin ? new Date(dto.fechaFin) : null,
          (dto.observaciones ?? '').toString().trim() || null,
          dto.convocatoriaSepId ?? null,
        ],
      )
    } catch (e) {
      this.traducirDuplicado(e, dto.convocatoriaSepId)
    }
    return { id: convocatoriaId, message: 'Convocatoria creada' }
  }

  async actualizar(convocatoriaId: number, dto: ConvocatoriaActualizarDto) {
    const ok = await this.dataSource.query(
      `SELECT 1 FROM EVALUADORCONVOCATORIA WHERE CONVOCATORIAID = :1`, [convocatoriaId],
    )
    if (!ok[0]) throw new NotFoundException('Convocatoria no encontrada')
    if (dto.anio !== undefined) this.validarAnio(dto.anio)

    if (dto.convocatoriaSepId !== undefined) {
      // El año a comparar es el que va a quedar: si vienen los dos en el mismo
      // PUT, manda el nuevo; si solo cambia la convocatoria, el que ya tiene.
      const actual: Array<{ anio: number }> = await this.dataSource.query(
        `SELECT ANIO AS "anio" FROM EVALUADORCONVOCATORIA WHERE CONVOCATORIAID = :1`,
        [convocatoriaId],
      )
      await this.validarConvocatoriaSep(
        dto.convocatoriaSepId,
        dto.anio ?? Number(actual[0]?.anio),
      )
    }

    // UPDATE dinámico — mismo patrón que EvaluadoresService.actualizar.
    const sets: string[] = []
    const params: unknown[] = []
    const map: Array<[keyof ConvocatoriaActualizarDto, string, (v: unknown) => unknown]> = [
      ['anio',          'ANIO',          v => Number(v)],
      ['periodo',       'PERIODO',       v => (v as string | null)?.toString().trim() || null],
      ['nombre',        'NOMBRE',        v => (v as string | null)?.toString().trim() || null],
      ['fechaInicio',   'FECHAINICIO',   v => (v ? new Date(v as string) : null)],
      ['fechaFin',      'FECHAFIN',      v => (v ? new Date(v as string) : null)],
      ['observaciones', 'OBSERVACIONES', v => (v as string | null)?.toString().trim() || null],
      ['activo',        'ACTIVO',        v => (v ? 1 : 0)],
      ['convocatoriaSepId',       'CONVOCATORIASEPID',       v => v ?? null],
      ['puntajeMinimoPrueba',     'PUNTAJEMINIMOPRUEBA',     v => v ?? null],
      ['calificacionMinimaCurso', 'CALIFICACIONMINIMACURSO', v => v ?? null],
      ['certificadoTexto',        'CERTIFICADOTEXTO',        v => (v as string | null)?.toString().trim() || null],
      ['certificadoFirmaId',      'CERTIFICADOFIRMAID',      v => v ?? null],
      ['certificadoHabilitado',   'CERTIFICADOHABILITADO',   v => (v ? 1 : 0)],
    ]
    for (const [k, col, transform] of map) {
      if (dto[k] !== undefined) {
        params.push(transform(dto[k]))
        sets.push(`${col} = :${params.length}`)
      }
    }

    // La modalidad llega como código y hay que resolverla contra el catálogo
    // (la columna de texto se dropeó en la v36), así que va fuera del mapa.
    if (dto.modalidadPart !== undefined) {
      params.push(await this.idModalidad(dto.modalidadPart))
      sets.push(`MODALIDADPARTID = :${params.length}`)
    }

    if (sets.length === 0) return { message: 'Sin cambios' }
    params.push(convocatoriaId)
    try {
      await this.dataSource.query(
        `UPDATE EVALUADORCONVOCATORIA SET ${sets.join(', ')} WHERE CONVOCATORIAID = :${params.length}`,
        params,
      )
    } catch (e) {
      // Reasignar la convocatoria del SEP puede chocar con el mismo índice
      // único que al crear: si ya hay otro ciclo de ese periodo sobre ella.
      this.traducirDuplicado(e, dto.convocatoriaSepId)
    }
    return { message: 'Convocatoria actualizada' }
  }

  /** Soft-delete: por integridad de documentos nunca borramos la fila. */
  async cambiarEstado(convocatoriaId: number, activo: boolean) {
    const ok = await this.dataSource.query(
      `SELECT 1 FROM EVALUADORCONVOCATORIA WHERE CONVOCATORIAID = :1`, [convocatoriaId],
    )
    if (!ok[0]) throw new NotFoundException('Convocatoria no encontrada')
    await this.dataSource.query(
      `UPDATE EVALUADORCONVOCATORIA SET ACTIVO = :1 WHERE CONVOCATORIAID = :2`,
      [activo ? 1 : 0, convocatoriaId],
    )
    return { message: activo ? 'Convocatoria activada' : 'Convocatoria desactivada', activo }
  }

  /**
   * Traduce el código de modalidad al id del catálogo MODALIDADPART (v29).
   * La columna de texto que había aquí se dropeó en la v36; el front sigue
   * enviando 'PRESENCIAL' / 'PAT' / 'VIRTUAL' y no tiene por qué conocer ids.
   */
  private async idModalidad(codigo?: string | null): Promise<number | null> {
    const c = (codigo ?? '').toString().trim().toUpperCase()
    if (!c) return null
    const rows: Array<{ id: number }> = await this.dataSource.query(
      `SELECT MODALIDADPARTID AS "id" FROM MODALIDADPART WHERE UPPER(CODIGO) = :1`, [c],
    )
    if (!rows[0]) throw new BadRequestException(`Modalidad '${codigo}' no existe en el catálogo`)
    return Number(rows[0].id)
  }

  private validarAnio(anio: number | undefined) {
    const n = Number(anio)
    const anioMax = new Date().getFullYear() + 2
    if (!Number.isFinite(n) || n < 2000 || n > anioMax) {
      throw new BadRequestException(`El año debe estar entre 2000 y ${anioMax}`)
    }
  }

  /**
   * Comprueba que la convocatoria del SEP exista y que el año coincida.
   *
   * La FK de la v40 ya impide apuntar a una que no existe, pero devolvería un
   * ORA-02291 crudo. Y el año NO lo cubre ninguna restricción: montar el ciclo
   * 2026 sobre la convocatoria 2024 es un error silencioso que solo se nota
   * meses después, cuando los certificados salen con el año equivocado.
   */
  /**
   * Traduce el choque del índice único de la v40 a un mensaje que se entienda.
   *
   * Sin esto, intentar abrir un segundo ciclo sobre la misma convocatoria y el
   * mismo periodo devuelve un 500 "Internal server error": la gestora no sabe
   * qué hizo mal ni que el ciclo ya existe.
   */
  private traducirDuplicado(e: unknown, sepId: number | null | undefined): never {
    const msg = (e as { message?: string })?.message ?? ''
    if (/ORA-00001/.test(msg) && /UQ_EVALCONV_SEP_PERIODO/i.test(msg)) {
      throw new ConflictException(
        'Esa convocatoria del SEP ya tiene un ciclo del banco para ese periodo. ' +
        'Abra el que ya existe, o use otro periodo.',
      )
    }
    void sepId
    throw e as Error
  }

  private async validarConvocatoriaSep(sepId: number | null | undefined, anio: number) {
    if (sepId == null) return

    const filas: Array<{ anio: number; nombre: string }> = await this.dataSource.query(
      `SELECT CONVOCATORIAANIO AS "anio", TRIM(CONVOCATORIANOMBRE) AS "nombre"
         FROM CONVOCATORIA WHERE CONVOCATORIAID = :1`,
      [sepId],
    )
    if (!filas[0]) {
      throw new BadRequestException('La convocatoria del SEP indicada no existe')
    }
    const anioSep = Number(filas[0].anio)
    if (Number.isFinite(anioSep) && Number(anio) !== anioSep) {
      throw new BadRequestException(
        `El ciclo es del año ${anio} pero "${filas[0].nombre}" es del ${anioSep}. ` +
        'Escoja la convocatoria de ese año o corrija el año del ciclo.',
      )
    }
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Documentos                                                            ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  async listarDocumentos(convocatoriaId: number, tipoCodigo?: string) {
    const conds: string[] = [`d.CONVOCATORIAID = :1`]
    const params: unknown[] = [convocatoriaId]
    const filtroTipo = tipoCodigo?.trim()
    if (filtroTipo) {
      params.push(filtroTipo.toUpperCase())
      conds.push(`UPPER(TRIM(t.CODIGO)) = :${params.length}`)
    }
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT d.DOCUMENTOID          AS "documentoId",
              d.CONVOCATORIAID       AS "convocatoriaId",
              d.TIPODOCUMENTOCONVID  AS "tipoDocumentoConvId",
              TRIM(t.CODIGO)         AS "tipoCodigo",
              TRIM(t.NOMBRE)         AS "tipoNombre",
              TRIM(d.DOCUMENTODESCRIPCION) AS "descripcion",
              TRIM(d.ARCHIVONOMBRE)  AS "archivoNombre",
              TRIM(d.ARCHIVOMIME)    AS "mime",
              d.FECHACARGUE          AS "fechaCargue"
         FROM CONVOCATORIADOCUMENTO d
         JOIN TIPODOCUMENTOCONV     t ON t.TIPODOCUMENTOCONVID = d.TIPODOCUMENTOCONVID
        WHERE ${conds.join(' AND ')}
        ORDER BY t.ORDEN ASC, d.FECHACARGUE DESC, d.DOCUMENTOID DESC`,
      params,
    )
    return rows.map(r => ({
      ...r,
      documentoId: Number(r.documentoId),
      convocatoriaId: Number(r.convocatoriaId),
      tipoDocumentoConvId: Number(r.tipoDocumentoConvId),
    }))
  }

  async subirDocumento(
    convocatoriaId: number,
    tipoId: number,
    file: MulterFile,
    opts: { descripcion?: string } = {},
  ): Promise<{ mensaje: string; documentoId: number }> {
    if (!file?.buffer) throw new BadRequestException('Adjunta el archivo en el campo "archivo"')
    if (!tipoId) throw new BadRequestException('tipoDocumentoConvId es obligatorio')
    if (file.size > MAX_CONV_DOC_BYTES) {
      throw new BadRequestException(`El archivo excede el tamaño máximo (${MAX_CONV_DOC_BYTES / (1024 * 1024)} MB)`)
    }

    const ok = await this.dataSource.query(
      `SELECT 1 FROM EVALUADORCONVOCATORIA WHERE CONVOCATORIAID = :1`, [convocatoriaId],
    )
    if (!ok[0]) throw new NotFoundException('Convocatoria no encontrada')

    // Leer el catálogo para validar extensión permitida.
    const tipo: Array<{ extensiones: string; codigo: string }> = await this.dataSource.query(
      `SELECT TRIM(EXTENSIONESPERMITIDAS) AS "extensiones",
              TRIM(CODIGO)                AS "codigo"
         FROM TIPODOCUMENTOCONV
        WHERE TIPODOCUMENTOCONVID = :1 AND ACTIVO = 1`,
      [tipoId],
    )
    if (!tipo[0]) throw new BadRequestException('Tipo de documento no existe o está inactivo')

    const permitidas = (tipo[0].extensiones || '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    const listaFinal = permitidas.length > 0 ? permitidas : EXTENSIONES_FALLBACK
    const ext = this.extraerExtension(file.originalname)
    if (!ext || !listaFinal.includes(ext)) {
      throw new BadRequestException(
        `Extensión no permitida para este tipo. Permitidas: ${listaFinal.join(', ')}`,
      )
    }

    // ID por MAX+1 — mismo patrón que EVALUADORDOCUMENTO.
    const seq: Array<{ NUEVO: number }> = await this.dataSource.query(
      `SELECT NVL(MAX(DOCUMENTOID), 0) + 1 AS "NUEVO" FROM CONVOCATORIADOCUMENTO`,
    )
    const documentoId = Number(seq[0].NUEVO)

    const nombre = (file.originalname ?? '').toString().trim().slice(0, 255) || null
    await this.dataSource.query(
      `INSERT INTO CONVOCATORIADOCUMENTO
         (DOCUMENTOID, CONVOCATORIAID, TIPODOCUMENTOCONVID, DOCUMENTODESCRIPCION,
          ARCHIVOBLOB, ARCHIVOMIME, ARCHIVONOMBRE, FECHACARGUE)
       VALUES (:1, :2, :3, :4, :5, :6, :7, SYSDATE)`,
      [
        documentoId,
        convocatoriaId,
        tipoId,
        opts.descripcion?.trim() || null,
        file.buffer,
        file.mimetype,
        nombre,
      ],
    )
    return { mensaje: 'Documento cargado', documentoId }
  }

  async getDocumentoMeta(docId: number): Promise<{
    convocatoriaId: number;
    tipoCodigo: string;
    archivoNombre: string | null;
    mime: string;
  }> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT d.CONVOCATORIAID       AS "convocatoriaId",
              TRIM(t.CODIGO)         AS "tipoCodigo",
              TRIM(d.ARCHIVONOMBRE)  AS "archivoNombre",
              TRIM(d.ARCHIVOMIME)    AS "mime"
         FROM CONVOCATORIADOCUMENTO d
         JOIN TIPODOCUMENTOCONV     t ON t.TIPODOCUMENTOCONVID = d.TIPODOCUMENTOCONVID
        WHERE d.DOCUMENTOID = :1`,
      [docId],
    )
    if (!rows[0]) throw new NotFoundException('Documento no encontrado')
    const r = rows[0]
    return {
      convocatoriaId: Number(r.convocatoriaId),
      tipoCodigo: String(r.tipoCodigo ?? ''),
      archivoNombre: (r.archivoNombre as string | null) ?? null,
      mime: (r.mime as string | null) || 'application/octet-stream',
    }
  }

  async getDocumentoArchivo(docId: number): Promise<{ buffer: Buffer; mime: string; nombre: string }> {
    const rows: Array<{
      blob: NodeJS.ReadableStream | Buffer | null;
      mime: string | null;
      nombre: string | null;
    }> = await this.dataSource.query(
      `SELECT ARCHIVOBLOB         AS "blob",
              TRIM(ARCHIVOMIME)   AS "mime",
              TRIM(ARCHIVONOMBRE) AS "nombre"
         FROM CONVOCATORIADOCUMENTO WHERE DOCUMENTOID = :1`,
      [docId],
    )
    const r = rows[0]
    if (!r?.blob) throw new NotFoundException('Archivo no encontrado')
    return {
      buffer: await this.lobToBuffer(r.blob),
      mime: r.mime || 'application/octet-stream',
      nombre: r.nombre || `documento-${docId}`,
    }
  }

  async eliminarDocumento(docId: number): Promise<{ mensaje: string }> {
    const ok = await this.dataSource.query(
      `SELECT 1 FROM CONVOCATORIADOCUMENTO WHERE DOCUMENTOID = :1`, [docId],
    )
    if (!ok[0]) throw new NotFoundException('Documento no encontrado')
    await this.dataSource.query(
      `DELETE FROM CONVOCATORIADOCUMENTO WHERE DOCUMENTOID = :1`, [docId],
    )
    return { mensaje: 'Documento eliminado' }
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Helpers                                                               ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  /**
   * Extrae la extensión (sin punto, minúsculas) del nombre original.
   * Los archivos .msg del Outlook a veces llegan con doble extensión — la
   * última pieza es la que vale.
   */
  private extraerExtension(nombre: string | undefined): string | null {
    if (!nombre) return null
    const limpio = nombre.trim().toLowerCase()
    const idx = limpio.lastIndexOf('.')
    if (idx < 0 || idx === limpio.length - 1) return null
    return limpio.slice(idx + 1)
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
}
