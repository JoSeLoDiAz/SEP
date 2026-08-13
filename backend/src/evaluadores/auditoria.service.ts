import { Injectable, Logger } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

// auditoría del banco de evaluadores: SEP_APP solo tiene SELECT e INSERT sobre EVALUADORLOG, sin UPDATE ni DELETE

export type OperacionLog =
  | 'INSERT' | 'UPDATE' | 'DELETE'
  | 'ESTADO'
  | 'GENERAR'
  | 'ANULAR'
  | 'EMITIR'

export interface RegistroLog {
  tabla: string
  operacion: OperacionLog
  registroId?: number | null
  evaluadorId?: number | null
  participacionId?: number | null
  usuarioEmail: string
  usuarioPerfilId?: number | null
  comentario?: string | null
  valorAntes?: unknown
  valorDespues?: unknown
}

export interface FiltroLog {
  evaluadorId?: number
  participacionId?: number
  tabla?: string
  operacion?: string
  usuarioEmail?: string
  desde?: string
  hasta?: string
  page?: number
  limit?: number
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name)

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // nunca lanza: un fallo de auditoría no debe tumbar la operación de negocio
  async registrar(r: RegistroLog): Promise<void> {
    try {
      const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
        `SELECT EVALUADORLOG_SEQ.NEXTVAL FROM dual`,
      )
      await this.dataSource.query(
        `INSERT INTO EVALUADORLOG
           (EVALUADORLOGID, EVALUADORID, PARTICIPACIONID, TABLA, OPERACION,
            REGISTROID, USUARIOEMAIL, USUARIOPERFILID, COMENTARIO,
            VALORANTES, VALORDESPUES)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11)`,
        [
          Number(seq[0].NEXTVAL),
          r.evaluadorId ?? null,
          r.participacionId ?? null,
          r.tabla,
          r.operacion,
          r.registroId ?? null,
          r.usuarioEmail,
          r.usuarioPerfilId ?? null,
          r.comentario?.slice(0, 1000) ?? null,
          this.serializar(r.valorAntes),
          this.serializar(r.valorDespues),
        ],
      )
    } catch (err) {
      this.logger.error(
        `No se pudo registrar en EVALUADORLOG (${r.tabla}/${r.operacion}): ${(err as Error).message}`,
      )
    }
  }

  async registrarCambio(
    tabla: string,
    registroId: number,
    antes: unknown,
    despues: unknown,
    ctx: { usuarioEmail: string; usuarioPerfilId?: number; evaluadorId?: number; participacionId?: number },
    comentario?: string,
  ): Promise<void> {
    await this.registrar({
      tabla,
      operacion: 'UPDATE',
      registroId,
      valorAntes: antes,
      valorDespues: despues,
      comentario,
      ...ctx,
    })
  }

  async listar(f: FiltroLog = {}) {
    const page = Math.max(1, f.page ?? 1)
    const limit = Math.min(200, Math.max(1, f.limit ?? 50))
    const offset = (page - 1) * limit

    const params: unknown[] = []
    const where: string[] = []

    const add = (cond: (i: number) => string, valor: unknown) => {
      params.push(valor)
      where.push(cond(params.length))
    }

    if (f.evaluadorId) add(i => `l.EVALUADORID = :${i}`, f.evaluadorId)
    if (f.participacionId) add(i => `l.PARTICIPACIONID = :${i}`, f.participacionId)
    if (f.tabla) add(i => `UPPER(l.TABLA) = :${i}`, f.tabla.toUpperCase())
    if (f.operacion) add(i => `UPPER(l.OPERACION) = :${i}`, f.operacion.toUpperCase())
    if (f.usuarioEmail) add(i => `UPPER(l.USUARIOEMAIL) LIKE :${i}`, `%${f.usuarioEmail.toUpperCase()}%`)
    if (f.desde) add(i => `l.FECHA >= TO_TIMESTAMP(:${i}, 'YYYY-MM-DD HH24:MI:SS')`, `${f.desde} 00:00:00`)
    if (f.hasta) add(i => `l.FECHA <= TO_TIMESTAMP(:${i}, 'YYYY-MM-DD HH24:MI:SS')`, `${f.hasta} 23:59:59`)

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const totalRows: Array<{ T: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS "T" FROM EVALUADORLOG l ${whereSql}`,
      params,
    )

    // sin los CLOB de snapshot: pesan y solo se necesitan en el detalle
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT l.EVALUADORLOGID     AS "logId",
              l.EVALUADORID        AS "evaluadorId",
              l.PARTICIPACIONID    AS "participacionId",
              TRIM(l.TABLA)        AS "tabla",
              TRIM(l.OPERACION)    AS "operacion",
              l.REGISTROID         AS "registroId",
              TRIM(l.USUARIOEMAIL) AS "usuarioEmail",
              l.USUARIOPERFILID    AS "usuarioPerfilId",
              l.FECHA              AS "fecha",
              TRIM(l.COMENTARIO)   AS "comentario",
              CASE WHEN l.VALORANTES   IS NULL THEN 0 ELSE 1 END AS "tieneAntes",
              CASE WHEN l.VALORDESPUES IS NULL THEN 0 ELSE 1 END AS "tieneDespues",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) AS "evaluadorNombre"
         FROM EVALUADORLOG l
         LEFT JOIN EVALUADOR e ON e.EVALUADORID = l.EVALUADORID
         LEFT JOIN PERSONA   p ON p.PERSONAID   = e.PERSONAID
         ${whereSql}
        ORDER BY l.FECHA DESC, l.EVALUADORLOGID DESC
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
      params,
    )

    return {
      items: rows.map(r => ({
        ...r,
        logId: Number(r.logId),
        evaluadorId: r.evaluadorId != null ? Number(r.evaluadorId) : null,
        participacionId: r.participacionId != null ? Number(r.participacionId) : null,
        tieneAntes: Number(r.tieneAntes) === 1,
        tieneDespues: Number(r.tieneDespues) === 1,
        evaluadorNombre: (r.evaluadorNombre as string | null)?.trim() || null,
      })),
      total: Number(totalRows[0]?.T ?? 0),
      page,
      limit,
    }
  }

  async getDetalle(logId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT l.EVALUADORLOGID AS "logId",
              l.VALORANTES     AS "valorAntes",
              l.VALORDESPUES   AS "valorDespues"
         FROM EVALUADORLOG l
        WHERE l.EVALUADORLOGID = :1`,
      [logId],
    )
    if (!rows[0]) return null
    return {
      logId: Number(rows[0].logId),
      valorAntes: await this.parsearLob(rows[0].valorAntes),
      valorDespues: await this.parsearLob(rows[0].valorDespues),
    }
  }

  private serializar(v: unknown): string | null {
    if (v == null) return null
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }

  private async parsearLob(lob: unknown): Promise<unknown> {
    if (lob == null) return null
    const texto = typeof lob === 'string' ? lob : await this.lobATexto(lob)
    if (!texto) return null
    try {
      return JSON.parse(texto)
    } catch {
      return texto
    }
  }

  private lobATexto(lob: unknown): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = lob as NodeJS.ReadableStream
      if (typeof stream?.on !== 'function') return resolve(String(lob))
      let acc = ''
      stream.setEncoding?.('utf8')
      stream.on('data', (c: string) => { acc += c })
      stream.on('end', () => resolve(acc))
      stream.on('error', reject)
    })
  }
}
