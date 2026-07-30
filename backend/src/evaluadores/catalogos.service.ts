import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

export interface CatalogoItem { id: number; nombre: string; activo: number }

@Injectable()
export class CatalogosEvaluadorService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // ── Catálogos del ciclo (v29) — solo lectura ────────────────────────────
  //
  // No tienen alta/baja desde la aplicación: son el vocabulario del proceso,
  // no datos operativos. Se exponen porque los filtros del banco y los selects
  // del año los necesitan; cambiarlos es una migración.

  /** Estados del año. `codigo` es la llave que viaja en los filtros. */
  async listarEstadosParticipacion(soloActivos = true) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT ESTADOPARTID     AS "id",
              TRIM(CODIGO)     AS "codigo",
              TRIM(NOMBRE)     AS "nombre",
              TRIM(DESCRIPCION) AS "descripcion",
              TRIM(COLOR)      AS "color",
              ORDEN            AS "orden",
              ESFINAL          AS "esFinal",
              ESNEGATIVO       AS "esNegativo",
              ACTIVO           AS "activo"
         FROM ESTADOPARTICIPACION ${soloActivos ? 'WHERE ACTIVO = 1' : ''}
        ORDER BY ORDEN, NOMBRE`,
    )
    return rows.map(r => ({
      id: Number(r.id),
      codigo: r.codigo as string,
      nombre: r.nombre as string,
      descripcion: (r.descripcion as string | null) ?? null,
      color: (r.color as string | null) ?? 'neutral',
      orden: Number(r.orden),
      esFinal: Number(r.esFinal) === 1,
      esNegativo: Number(r.esNegativo) === 1,
      activo: Number(r.activo),
    }))
  }

  /** Áreas de evaluación (técnica, jurídica, transversal…). */
  async listarAreas(soloActivas = true) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT AREAID            AS "id",
              TRIM(CODIGO)      AS "codigo",
              TRIM(NOMBRE)      AS "nombre",
              TRIM(GRUPOSDEFECTO) AS "gruposDefecto",
              ORDEN             AS "orden",
              ACTIVO            AS "activo"
         FROM AREAEVALUACION ${soloActivas ? 'WHERE ACTIVO = 1' : ''}
        ORDER BY ORDEN, NOMBRE`,
    )
    return rows.map(r => ({
      id: Number(r.id),
      codigo: r.codigo as string,
      nombre: r.nombre as string,
      gruposDefecto: (r.gruposDefecto as string | null) ?? null,
      orden: Number(r.orden),
      activo: Number(r.activo),
    }))
  }

  /**
   * Años que REALMENTE existen en el banco, de más reciente a más antiguo.
   *
   * El filtro de año se poblaba con una ventana fija (año actual + 1, seis
   * hacia atrás). Eso deja fuera lo que hay: el histórico llega hasta 2020 y
   * ese año no se podía seleccionar, mientras se ofrecían años vacíos.
   */
  async listarAniosParticipacion(): Promise<number[]> {
    const rows: Array<{ anio: number }> = await this.dataSource.query(
      `SELECT DISTINCT ANIO AS "anio" FROM EVALUADORPARTICIPACION
        WHERE ANIO IS NOT NULL
        ORDER BY 1 DESC`,
    )
    const anios = rows.map(r => Number(r.anio))
    // El año en curso siempre está, aunque nadie haya participado todavía:
    // en enero el banco está vacío y el filtro no puede quedarse sin él.
    const actual = new Date().getFullYear()
    if (!anios.includes(actual)) anios.unshift(actual)
    return anios
  }

  /**
   * Firmas disponibles para los certificados.
   *
   * Es la misma tabla que usan los certificados de beneficiario, no una copia:
   * la firma de quien avala es institucional, no del módulo. Se excluye la
   * imagen del BLOB — aquí solo hace falta poder elegir.
   */
  async listarFirmasCertificado() {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT FIRMACERTIFICADOSID        AS "id",
              TRIM(FIRMACERTIFICADOSNOMBRE) AS "nombre",
              TRIM(FIRMACERTIFICADOSCARGO)  AS "cargo",
              CASE WHEN FIRMACERTIFICADOSFIRMA IS NULL THEN 0 ELSE 1 END AS "tieneImagen"
         FROM FIRMACERTIFICADOS
        ORDER BY FIRMACERTIFICADOSNOMBRE`,
    )
    return rows.map(r => ({
      id: Number(r.id),
      nombre: (r.nombre as string | null) ?? '(sin nombre)',
      cargo: (r.cargo as string | null) ?? null,
      tieneImagen: Number(r.tieneImagen) === 1,
    }))
  }

  /**
   * Convocatorias REALES del SEP, para atarles el ciclo de evaluadores (v40).
   *
   * Se marca cuáles ya tienen ciclo: dos ciclos sobre la misma convocatoria y
   * el mismo periodo son dos verdades para lo mismo, y el índice único de la
   * v40 lo rechaza. Avisarlo en la lista evita llegar al error.
   */
  async listarConvocatoriasSep(anio?: number) {
    const params: unknown[] = []
    let filtro = ''
    if (anio) { params.push(anio); filtro = ` WHERE c.CONVOCATORIAANIO = :${params.length}` }

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT c.CONVOCATORIAID              AS "id",
              TRIM(c.CONVOCATORIANOMBRE)    AS "nombre",
              c.CONVOCATORIAANIO            AS "anio",
              TRIM(c.CONVOCATORIAESTADOCONVOCATORIA) AS "estado",
              (SELECT COUNT(*) FROM EVALUADORCONVOCATORIA e
                WHERE e.CONVOCATORIASEPID = c.CONVOCATORIAID) AS "ciclos"
         FROM CONVOCATORIA c${filtro}
        ORDER BY c.CONVOCATORIAANIO DESC, c.CONVOCATORIAID DESC`,
      params,
    )
    return rows.map(r => ({
      id: Number(r.id),
      nombre: (r.nombre as string | null) ?? '(sin nombre)',
      anio: Number(r.anio),
      estado: (r.estado as string | null) ?? null,
      ciclos: Number(r.ciclos ?? 0),
    }))
  }

  /** Modalidades de participación (presencial, virtual…). */
  async listarModalidades(soloActivas = true) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT MODALIDADPARTID   AS "id",
              TRIM(CODIGO)      AS "codigo",
              TRIM(NOMBRE)      AS "nombre",
              TRIM(DESCRIPCION) AS "descripcion",
              ORDEN             AS "orden",
              ACTIVO            AS "activo"
         FROM MODALIDADPART ${soloActivas ? 'WHERE ACTIVO = 1' : ''}
        ORDER BY ORDEN, NOMBRE`,
    )
    return rows.map(r => ({
      id: Number(r.id),
      codigo: r.codigo as string,
      nombre: r.nombre as string,
      descripcion: (r.descripcion as string | null) ?? null,
      orden: Number(r.orden),
      activo: Number(r.activo),
    }))
  }

  // ── ROLEVALUADOR ────────────────────────────────────────────────────────

  /**
   * Roles del evaluador. Expone CODIGO porque es la llave estable — el motor
   * de la matriz razona sobre `EVALUADOR`, `APOYO_JURIDICO`, etc., no sobre el
   * nombre, que puede reescribirse sin avisar.
   *
   * Ordena por ORDEN (jerarquía real: líder, coordinador, analista, evaluador,
   * apoyos, transversal) y no alfabéticamente, que mezclaba niveles.
   */
  async listarRoles(soloActivos = false) {
    const where = soloActivos ? `WHERE ROLEVALUADORACTIVO = 1` : ''
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT ROLEVALUADORID           AS "id",
              TRIM(ROLEVALUADORNOMBRE) AS "nombre",
              TRIM(ROLEVALUADORCODIGO) AS "codigo",
              TRIM(ROLEVALUADORDESC)   AS "descripcion",
              NVL(ROLEVALUADORORDEN, 100) AS "orden",
              ROLEVALUADORACTIVO       AS "activo"
         FROM ROLEVALUADOR ${where}
        ORDER BY NVL(ROLEVALUADORORDEN, 100), ROLEVALUADORNOMBRE`,
    )
    return rows.map(r => ({
      id: Number(r.id),
      nombre: r.nombre as string,
      codigo: (r.codigo as string | null) ?? null,
      descripcion: (r.descripcion as string | null) ?? null,
      orden: Number(r.orden),
      activo: Number(r.activo),
    }))
  }

  async crearRol(nombre: string, descripcion?: string) {
    const n = (nombre ?? '').trim()
    if (!n) throw new BadRequestException('El nombre es obligatorio')
    const dup = await this.dataSource.query(
      `SELECT 1 FROM ROLEVALUADOR WHERE UPPER(ROLEVALUADORNOMBRE) = UPPER(:1)`, [n],
    )
    if (dup[0]) throw new ConflictException('Ya existe un rol con ese nombre')

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT ROLEVALUADOR_SEQ.NEXTVAL FROM dual`,
    )
    const id = Number(seq[0].NEXTVAL)
    await this.dataSource.query(
      `INSERT INTO ROLEVALUADOR (ROLEVALUADORID, ROLEVALUADORNOMBRE, ROLEVALUADORDESC, ROLEVALUADORACTIVO)
       VALUES (:1, :2, :3, 1)`,
      [id, n, (descripcion ?? '').trim() || null],
    )
    return { id, nombre: n }
  }

  async actualizarRol(id: number, cambios: { nombre?: string; descripcion?: string; activo?: boolean }) {
    const filas = await this.dataSource.query(`SELECT 1 FROM ROLEVALUADOR WHERE ROLEVALUADORID = :1`, [id])
    if (!filas[0]) throw new NotFoundException('Rol no encontrado')

    const sets: string[] = []
    const params: unknown[] = []
    if (cambios.nombre !== undefined) {
      params.push(cambios.nombre.trim())
      sets.push(`ROLEVALUADORNOMBRE = :${params.length}`)
    }
    if (cambios.descripcion !== undefined) {
      params.push(cambios.descripcion.trim() || null)
      sets.push(`ROLEVALUADORDESC = :${params.length}`)
    }
    if (cambios.activo !== undefined) {
      params.push(cambios.activo ? 1 : 0)
      sets.push(`ROLEVALUADORACTIVO = :${params.length}`)
    }
    if (sets.length === 0) return { message: 'Sin cambios' }
    params.push(id)
    await this.dataSource.query(
      `UPDATE ROLEVALUADOR SET ${sets.join(', ')} WHERE ROLEVALUADORID = :${params.length}`,
      params,
    )
    return { message: 'Rol actualizado' }
  }

  // ── PROCESOEVAL ──────────────────────────────────────────────────────────

  async listarProcesos(soloActivos = false) {
    const where = soloActivos ? `WHERE PROCESOACTIVO = 1` : ''
    const rows: Array<{ id: number; nombre: string; descripcion: string | null; activo: number }> =
      await this.dataSource.query(
        `SELECT PROCESOID            AS "id",
                TRIM(PROCESONOMBRE)  AS "nombre",
                TRIM(PROCESODESC)    AS "descripcion",
                PROCESOACTIVO        AS "activo"
           FROM PROCESOEVAL ${where}
          ORDER BY PROCESONOMBRE`,
      )
    return rows.map(r => ({ ...r, id: Number(r.id), activo: Number(r.activo) }))
  }

  async crearProceso(nombre: string, descripcion?: string) {
    const n = (nombre ?? '').trim()
    if (!n) throw new BadRequestException('El nombre es obligatorio')
    const dup = await this.dataSource.query(
      `SELECT 1 FROM PROCESOEVAL WHERE UPPER(PROCESONOMBRE) = UPPER(:1)`, [n],
    )
    if (dup[0]) throw new ConflictException('Ya existe un proceso con ese nombre')

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT PROCESOEVAL_SEQ.NEXTVAL FROM dual`,
    )
    const id = Number(seq[0].NEXTVAL)
    await this.dataSource.query(
      `INSERT INTO PROCESOEVAL (PROCESOID, PROCESONOMBRE, PROCESODESC, PROCESOACTIVO)
       VALUES (:1, :2, :3, 1)`,
      [id, n, (descripcion ?? '').trim() || null],
    )
    return { id, nombre: n }
  }

  async actualizarProceso(id: number, cambios: { nombre?: string; descripcion?: string; activo?: boolean }) {
    const filas = await this.dataSource.query(`SELECT 1 FROM PROCESOEVAL WHERE PROCESOID = :1`, [id])
    if (!filas[0]) throw new NotFoundException('Proceso no encontrado')

    const sets: string[] = []
    const params: unknown[] = []
    if (cambios.nombre !== undefined) {
      params.push(cambios.nombre.trim())
      sets.push(`PROCESONOMBRE = :${params.length}`)
    }
    if (cambios.descripcion !== undefined) {
      params.push(cambios.descripcion.trim() || null)
      sets.push(`PROCESODESC = :${params.length}`)
    }
    if (cambios.activo !== undefined) {
      params.push(cambios.activo ? 1 : 0)
      sets.push(`PROCESOACTIVO = :${params.length}`)
    }
    if (sets.length === 0) return { message: 'Sin cambios' }
    params.push(id)
    await this.dataSource.query(
      `UPDATE PROCESOEVAL SET ${sets.join(', ')} WHERE PROCESOID = :${params.length}`,
      params,
    )
    return { message: 'Proceso actualizado' }
  }

  // ── TIPOESTUDIO ──────────────────────────────────────────────────────────

  async listarTiposEstudio(soloActivos = false, excluirHV = false): Promise<CatalogoItem[]> {
    const conds: string[] = []
    if (soloActivos) conds.push(`TIPOESTUDIOACTIVO = 1`)
    if (excluirHV)   conds.push(`UPPER(TRIM(TIPOESTUDIONOMBRE)) <> 'HV'`)
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const rows: Array<{ id: number; nombre: string; activo: number }> = await this.dataSource.query(
      `SELECT TIPOESTUDIOID          AS "id",
              TRIM(TIPOESTUDIONOMBRE) AS "nombre",
              TIPOESTUDIOACTIVO       AS "activo"
         FROM TIPOESTUDIO ${where}
        ORDER BY TIPOESTUDIONOMBRE`,
    )
    return rows.map(r => ({ id: Number(r.id), nombre: r.nombre, activo: Number(r.activo) }))
  }

  async crearTipoEstudio(nombre: string) {
    const n = (nombre ?? '').trim()
    if (!n) throw new BadRequestException('El nombre es obligatorio')
    const dup = await this.dataSource.query(
      `SELECT 1 FROM TIPOESTUDIO WHERE UPPER(TIPOESTUDIONOMBRE) = UPPER(:1)`, [n],
    )
    if (dup[0]) throw new ConflictException('Ya existe un tipo con ese nombre')

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT TIPOESTUDIO_SEQ.NEXTVAL FROM dual`,
    )
    const id = Number(seq[0].NEXTVAL)
    await this.dataSource.query(
      `INSERT INTO TIPOESTUDIO (TIPOESTUDIOID, TIPOESTUDIONOMBRE, TIPOESTUDIOACTIVO)
       VALUES (:1, :2, 1)`,
      [id, n],
    )
    return { id, nombre: n }
  }

  async actualizarTipoEstudio(id: number, cambios: { nombre?: string; activo?: boolean }) {
    const filas = await this.dataSource.query(`SELECT 1 FROM TIPOESTUDIO WHERE TIPOESTUDIOID = :1`, [id])
    if (!filas[0]) throw new NotFoundException('Tipo no encontrado')

    const sets: string[] = []
    const params: unknown[] = []
    if (cambios.nombre !== undefined) {
      params.push(cambios.nombre.trim())
      sets.push(`TIPOESTUDIONOMBRE = :${params.length}`)
    }
    if (cambios.activo !== undefined) {
      params.push(cambios.activo ? 1 : 0)
      sets.push(`TIPOESTUDIOACTIVO = :${params.length}`)
    }
    if (sets.length === 0) return { message: 'Sin cambios' }
    params.push(id)
    await this.dataSource.query(
      `UPDATE TIPOESTUDIO SET ${sets.join(', ')} WHERE TIPOESTUDIOID = :${params.length}`,
      params,
    )
    return { message: 'Tipo actualizado' }
  }

  // ── TIPODOCUMENTOEVAL ────────────────────────────────────────────────────

  async listarTiposDocumentoEvaluador(soloActivos = true) {
    const where = soloActivos ? `WHERE ACTIVO = 1` : ''
    const rows: Array<{
      id: number; codigo: string; nombre: string; admiteMultiple: number; orden: number; activo: number
    }> = await this.dataSource.query(
      `SELECT TIPODOCUMENTOEVALID AS "id",
              TRIM(CODIGO)        AS "codigo",
              TRIM(NOMBRE)        AS "nombre",
              ADMITEMULTIPLE      AS "admiteMultiple",
              ORDEN               AS "orden",
              ACTIVO              AS "activo"
         FROM TIPODOCUMENTOEVAL ${where}
        ORDER BY ORDEN ASC, NOMBRE ASC`,
    )
    return rows.map(r => ({
      id: Number(r.id),
      codigo: r.codigo,
      nombre: r.nombre,
      admiteMultiple: Number(r.admiteMultiple) === 1,
      orden: Number(r.orden),
      activo: Number(r.activo) === 1,
    }))
  }

  async crearTipoDocumentoEvaluador(cambios: {
    codigo: string; nombre: string; admiteMultiple?: boolean; orden?: number;
  }) {
    const codigo = (cambios.codigo ?? '').trim().toUpperCase()
    const nombre = (cambios.nombre ?? '').trim()
    if (!codigo) throw new BadRequestException('El código es obligatorio')
    if (!nombre) throw new BadRequestException('El nombre es obligatorio')

    const dup = await this.dataSource.query(
      `SELECT 1 FROM TIPODOCUMENTOEVAL WHERE UPPER(CODIGO) = :1`, [codigo],
    )
    if (dup[0]) throw new ConflictException('Ya existe un tipo con ese código')

    // ID por MAX+1 (la tabla es pequeña y no hay secuencia asociada — sigue el
    // mismo patrón que EVALUADORDOCUMENTO).
    const seq: Array<{ NUEVO: number }> = await this.dataSource.query(
      `SELECT NVL(MAX(TIPODOCUMENTOEVALID), 0) + 1 AS "NUEVO" FROM TIPODOCUMENTOEVAL`,
    )
    const id = Number(seq[0].NUEVO)
    await this.dataSource.query(
      `INSERT INTO TIPODOCUMENTOEVAL
         (TIPODOCUMENTOEVALID, CODIGO, NOMBRE, ADMITEMULTIPLE, ORDEN, ACTIVO)
       VALUES (:1, :2, :3, :4, :5, 1)`,
      [id, codigo, nombre, cambios.admiteMultiple === false ? 0 : 1, cambios.orden ?? 100],
    )
    return { id, codigo, nombre }
  }

  async actualizarTipoDocumentoEvaluador(id: number, cambios: {
    nombre?: string; admiteMultiple?: boolean; orden?: number; activo?: boolean;
  }) {
    const filas = await this.dataSource.query(
      `SELECT 1 FROM TIPODOCUMENTOEVAL WHERE TIPODOCUMENTOEVALID = :1`, [id],
    )
    if (!filas[0]) throw new NotFoundException('Tipo de documento no encontrado')

    const sets: string[] = []
    const params: unknown[] = []
    if (cambios.nombre !== undefined) {
      params.push(cambios.nombre.trim())
      sets.push(`NOMBRE = :${params.length}`)
    }
    if (cambios.admiteMultiple !== undefined) {
      params.push(cambios.admiteMultiple ? 1 : 0)
      sets.push(`ADMITEMULTIPLE = :${params.length}`)
    }
    if (cambios.orden !== undefined) {
      params.push(Number(cambios.orden))
      sets.push(`ORDEN = :${params.length}`)
    }
    if (cambios.activo !== undefined) {
      params.push(cambios.activo ? 1 : 0)
      sets.push(`ACTIVO = :${params.length}`)
    }
    if (sets.length === 0) return { message: 'Sin cambios' }
    params.push(id)
    await this.dataSource.query(
      `UPDATE TIPODOCUMENTOEVAL SET ${sets.join(', ')} WHERE TIPODOCUMENTOEVALID = :${params.length}`,
      params,
    )
    return { message: 'Tipo de documento actualizado' }
  }

  // ── TIPODOCUMENTOCONV (catálogo de tipos de documento de convocatoria) ──

  async listarTiposDocumentoConvocatoria(soloActivos = true) {
    const where = soloActivos ? `WHERE ACTIVO = 1` : ''
    const rows: Array<{
      id: number; codigo: string; nombre: string;
      extensionesPermitidas: string; orden: number; activo: number
    }> = await this.dataSource.query(
      `SELECT TIPODOCUMENTOCONVID     AS "id",
              TRIM(CODIGO)            AS "codigo",
              TRIM(NOMBRE)            AS "nombre",
              TRIM(EXTENSIONESPERMITIDAS) AS "extensionesPermitidas",
              ORDEN                   AS "orden",
              ACTIVO                  AS "activo"
         FROM TIPODOCUMENTOCONV ${where}
        ORDER BY ORDEN ASC, NOMBRE ASC`,
    )
    return rows.map(r => ({
      id: Number(r.id),
      codigo: r.codigo,
      nombre: r.nombre,
      // Devolvemos como array para el frontend; el CSV crudo queda para admin.
      extensiones: this.parseExtensiones(r.extensionesPermitidas),
      extensionesPermitidas: r.extensionesPermitidas ?? '',
      orden: Number(r.orden),
      activo: Number(r.activo) === 1,
    }))
  }

  /** CSV → array normalizado (lower, sin puntos ni espacios, sin duplicados). */
  private parseExtensiones(csv: string | undefined | null): string[] {
    if (!csv) return []
    return Array.from(new Set(
      csv.split(',')
        .map(x => x.trim().toLowerCase().replace(/^\./, ''))
        .filter(Boolean),
    ))
  }

  async crearTipoDocumentoConvocatoria(cambios: {
    codigo: string; nombre: string; extensionesPermitidas?: string; orden?: number;
  }) {
    const codigo = (cambios.codigo ?? '').trim().toUpperCase()
    const nombre = (cambios.nombre ?? '').trim()
    if (!codigo) throw new BadRequestException('El código es obligatorio')
    if (!nombre) throw new BadRequestException('El nombre es obligatorio')

    const dup = await this.dataSource.query(
      `SELECT 1 FROM TIPODOCUMENTOCONV WHERE UPPER(CODIGO) = :1`, [codigo],
    )
    if (dup[0]) throw new ConflictException('Ya existe un tipo con ese código')

    // ID por MAX+1 — la tabla es un catálogo pequeño sin secuencia dedicada.
    const seq: Array<{ NUEVO: number }> = await this.dataSource.query(
      `SELECT NVL(MAX(TIPODOCUMENTOCONVID), 0) + 1 AS "NUEVO" FROM TIPODOCUMENTOCONV`,
    )
    const id = Number(seq[0].NUEVO)
    // Normaliza las extensiones a minúsculas, sin espacios y sin duplicados.
    const extensiones = this.normalizarExtensiones(cambios.extensionesPermitidas) || 'pdf'
    await this.dataSource.query(
      `INSERT INTO TIPODOCUMENTOCONV
         (TIPODOCUMENTOCONVID, CODIGO, NOMBRE, EXTENSIONESPERMITIDAS, ORDEN, ACTIVO)
       VALUES (:1, :2, :3, :4, :5, 1)`,
      [id, codigo, nombre, extensiones, cambios.orden ?? 100],
    )
    return { id, codigo, nombre, extensionesPermitidas: extensiones }
  }

  async actualizarTipoDocumentoConvocatoria(id: number, cambios: {
    nombre?: string; extensionesPermitidas?: string; orden?: number; activo?: boolean;
  }) {
    const filas = await this.dataSource.query(
      `SELECT 1 FROM TIPODOCUMENTOCONV WHERE TIPODOCUMENTOCONVID = :1`, [id],
    )
    if (!filas[0]) throw new NotFoundException('Tipo de documento no encontrado')

    const sets: string[] = []
    const params: unknown[] = []
    if (cambios.nombre !== undefined) {
      params.push(cambios.nombre.trim())
      sets.push(`NOMBRE = :${params.length}`)
    }
    if (cambios.extensionesPermitidas !== undefined) {
      const norm = this.normalizarExtensiones(cambios.extensionesPermitidas)
      params.push(norm || 'pdf')
      sets.push(`EXTENSIONESPERMITIDAS = :${params.length}`)
    }
    if (cambios.orden !== undefined) {
      params.push(Number(cambios.orden))
      sets.push(`ORDEN = :${params.length}`)
    }
    if (cambios.activo !== undefined) {
      params.push(cambios.activo ? 1 : 0)
      sets.push(`ACTIVO = :${params.length}`)
    }
    if (sets.length === 0) return { message: 'Sin cambios' }
    params.push(id)
    await this.dataSource.query(
      `UPDATE TIPODOCUMENTOCONV SET ${sets.join(', ')} WHERE TIPODOCUMENTOCONVID = :${params.length}`,
      params,
    )
    return { message: 'Tipo de documento actualizado' }
  }

  /**
   * Normaliza una lista csv de extensiones: minúsculas, trim, sin puntos,
   * sin vacíos, sin duplicados. Devuelve la cadena csv resultante o ''.
   */
  private normalizarExtensiones(csv: string | undefined): string {
    if (!csv) return ''
    const arr = csv.split(',')
      .map(s => s.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean)
    return Array.from(new Set(arr)).join(',')
  }

  // ── REGIONAL / CENTROFORMACION / CIUDAD (para dropdowns del banco) ───────

  /** Lista de regionales del SENA para el dropdown de asignación del evaluador. */
  async listarRegionales(soloActivas = true) {
    const where = soloActivas ? `WHERE REGIONALACTIVO = 1` : ''
    const rows: Array<{ id: number; nombre: string }> = await this.dataSource.query(
      `SELECT REGIONALID           AS "id",
              TRIM(REGIONALNOMBRE) AS "nombre"
         FROM REGIONAL ${where}
        ORDER BY REGIONALNOMBRE`,
    )
    return rows.map(r => ({ id: Number(r.id), nombre: r.nombre }))
  }

  /**
   * Centros de formación. Si viene `regionalId` filtra por esa regional; útil
   * para el cascading regional → centro en el formulario del evaluador.
   */
  async listarCentros(regionalId?: number, soloActivos = true) {
    const conds: string[] = []
    const params: unknown[] = []
    if (regionalId != null && Number.isFinite(Number(regionalId))) {
      params.push(Number(regionalId))
      conds.push(`REGIONALID = :${params.length}`)
    }
    if (soloActivos) conds.push(`CENTROACTIVO = 1`)
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const rows: Array<{ id: number; regionalId: number; nombre: string }> = await this.dataSource.query(
      `SELECT CENTROID          AS "id",
              REGIONALID        AS "regionalId",
              TRIM(CENTRONOMBRE) AS "nombre"
         FROM CENTROFORMACION ${where}
        ORDER BY CENTRONOMBRE`,
      params,
    )
    return rows.map(r => ({
      id: Number(r.id),
      regionalId: Number(r.regionalId),
      nombre: r.nombre,
    }))
  }

  /**
   * Búsqueda por nombre parcial de ciudad para el autocomplete del municipio.
   * Devuelve ciudad y departamento en campos separados; el frontend decide
   * cómo mostrarlos y qué guardar en el input.
   */
  async buscarCiudades(query: string, limite = 20) {
    const q = (query ?? '').trim()
    if (!q) return []
    const lim = Math.min(50, Math.max(1, Number(limite) || 20))
    // Escapar comodines LIKE (% y _) para evitar wildcards accidentales.
    const escapado = q.toUpperCase().replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
    const like = `%${escapado}%`
    const rows: Array<{ id: number; ciudad: string; depto: string }> = await this.dataSource.query(
      `SELECT * FROM (
         SELECT c.CIUDADID                AS "id",
                TRIM(c.CIUDADNOMBRE)      AS "ciudad",
                TRIM(d.DEPARTAMENTONOMBRE) AS "depto"
           FROM CIUDAD       c
           JOIN DEPARTAMENTO d ON d.DEPARTAMENTOID = c.DEPARTAMENTOID
          WHERE UPPER(TRIM(c.CIUDADNOMBRE)) LIKE :1 ESCAPE '\\'
          ORDER BY c.CIUDADNOMBRE ASC
       ) WHERE ROWNUM <= :2`,
      [like, lim],
    )
    return rows.map(r => ({
      id: Number(r.id),
      ciudad: r.ciudad,
      depto: r.depto ?? '',
    }))
  }
}
