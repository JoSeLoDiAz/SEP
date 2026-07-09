import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

export interface CatalogoItem { id: number; nombre: string; activo: number }

@Injectable()
export class CatalogosEvaluadorService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // ── ROLEVALUADOR ────────────────────────────────────────────────────────

  async listarRoles(soloActivos = false) {
    const where = soloActivos ? `WHERE ROLEVALUADORACTIVO = 1` : ''
    const rows: Array<{ id: number; nombre: string; descripcion: string | null; activo: number }> =
      await this.dataSource.query(
        `SELECT ROLEVALUADORID         AS "id",
                TRIM(ROLEVALUADORNOMBRE) AS "nombre",
                TRIM(ROLEVALUADORDESC)   AS "descripcion",
                ROLEVALUADORACTIVO      AS "activo"
           FROM ROLEVALUADOR ${where}
          ORDER BY ROLEVALUADORNOMBRE`,
      )
    return rows.map(r => ({ ...r, id: Number(r.id), activo: Number(r.activo) }))
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
}
