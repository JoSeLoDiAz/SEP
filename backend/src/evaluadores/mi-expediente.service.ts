import {
  ConflictException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

export interface MiEvaluador {
  evaluadorId: number
  personaId: number
  activo: boolean
}

// el evaluadorId sale de la sesión, nunca de la petición: los ids del banco son correlativos
@Injectable()
export class MiExpedienteService {
  private readonly log = new Logger(MiExpedienteService.name)

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // PERSONA tiene correos repetidos entre personas distintas: ante dos fichas, corta
  async resolver(usuarioId: number): Promise<MiEvaluador> {
    const filas: Array<{ evaluadorId: number; personaId: number; activo: number }> =
      await this.dataSource.query(
        `SELECT DISTINCT e.EVALUADORID AS "evaluadorId",
                e.PERSONAID           AS "personaId",
                e.EVALUADORACTIVO     AS "activo"
           FROM USUARIO u
           JOIN PERSONA p
             ON LOWER(TRIM(p.PERSONAEMAIL))              = LOWER(TRIM(u.USUARIOEMAIL))
             OR LOWER(TRIM(p.PERSONAEMAILINSTITUCIONAL)) = LOWER(TRIM(u.USUARIOEMAIL))
           JOIN EVALUADOR e ON e.PERSONAID = p.PERSONAID
          WHERE u.USUARIOID = :1
            AND u.USUARIOESTADO = 1`,
        [usuarioId],
      )

    if (filas.length === 0) {
      throw new ForbiddenException(
        'Tu cuenta no está vinculada a una ficha del banco de evaluadores. ' +
        'Escríbele al equipo del banco para que la asocien.',
      )
    }

    if (filas.length > 1) {
      this.log.error(
        `El usuario ${usuarioId} resuelve a ${filas.length} evaluadores ` +
        `(${filas.map(f => f.evaluadorId).join(', ')}). Hay correos repetidos en PERSONA.`,
      )
      throw new ConflictException(
        'Tu correo está asociado a más de una ficha de evaluador. ' +
        'El equipo del banco tiene que corregirlo antes de que puedas entrar.',
      )
    }

    const f = filas[0]
    return { evaluadorId: Number(f.evaluadorId), personaId: Number(f.personaId), activo: Number(f.activo) === 1 }
  }

  // 404 y no 403: un 403 confirmaría que el documento existe y es de alguien

  private async exigirPropio(sql: string, id: number, evaluadorId: number, que: string) {
    const filas = await this.dataSource.query(sql, [id, evaluadorId])
    if (!filas[0]) throw new NotFoundException(`No se encontró ${que}`)
  }

  esMiDocumento(docId: number, evaluadorId: number) {
    return this.exigirPropio(
      `SELECT 1 FROM EVALUADORDOCUMENTO WHERE DOCUMENTOID = :1 AND EVALUADORID = :2`,
      docId, evaluadorId, 'el documento')
  }

  esMiEstudio(estudioId: number, evaluadorId: number) {
    return this.exigirPropio(
      `SELECT 1 FROM EVALUADORESTUDIO WHERE ESTUDIOID = :1 AND EVALUADORID = :2`,
      estudioId, evaluadorId, 'el estudio')
  }

  esMiExperiencia(experienciaId: number, evaluadorId: number) {
    return this.exigirPropio(
      `SELECT 1 FROM EVALUADOREXPERIENCIA WHERE EXPERIENCIAID = :1 AND EVALUADORID = :2`,
      experienciaId, evaluadorId, 'la experiencia')
  }

  esMiTic(ticId: number, evaluadorId: number) {
    return this.exigirPropio(
      `SELECT 1 FROM EVALUADORTIC WHERE TICID = :1 AND EVALUADORID = :2`,
      ticId, evaluadorId, 'la certificación')
  }

  esMiAprobacion(aprobacionId: number, evaluadorId: number) {
    return this.exigirPropio(
      `SELECT 1 FROM EVALUADORAPROBACION a
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = a.PARTICIPACIONID
        WHERE a.APROBACIONID = :1 AND pa.EVALUADORID = :2`,
      aprobacionId, evaluadorId, 'la evidencia')
  }

  // EVALUADORCERTIFICADO no tiene EVALUADORID: el dueño sale por la participación
  esMiCertificado(certificadoId: number, evaluadorId: number) {
    return this.exigirPropio(
      `SELECT 1 FROM EVALUADORCERTIFICADO ce
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = ce.PARTICIPACIONID
        WHERE ce.CERTIFICADOID = :1 AND pa.EVALUADORID = :2`,
      certificadoId, evaluadorId, 'el certificado')
  }

  // consultas del portal

  // esNueva: ciclo del año en curso sobre el que aún no ha decidido si participa
  async misConvocatorias(evaluadorId: number) {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pa.PARTICIPACIONID       AS "participacionId",
              pa.ANIO                  AS "anio",
              TRIM(pa.PERIODO)         AS "periodo",
              pa.CONVOCATORIAID        AS "convocatoriaId",
              TRIM(cv.NOMBRE)          AS "convocatoria",
              TRIM(r.ROLEVALUADORNOMBRE) AS "rol",
              TRIM(ar.NOMBRE)          AS "area",
              TRIM(pe.PROCESONOMBRE)   AS "proceso",
              TRIM(es.CODIGO)          AS "estadoCodigo",
              TRIM(es.NOMBRE)          AS "estado",
              NVL(es.ESNEGATIVO, 0)    AS "estadoNegativo",
              TRIM(pa.MOTIVONOPARTICIPA) AS "motivo",
              cv.FECHAINICIO           AS "fechaInicio",
              cv.FECHAFIN              AS "fechaFin"
         FROM EVALUADORPARTICIPACION pa
         LEFT JOIN EVALUADORCONVOCATORIA cv ON cv.CONVOCATORIAID = pa.CONVOCATORIAID
         LEFT JOIN ROLEVALUADOR    r  ON r.ROLEVALUADORID = pa.ROLEVALUADORID
         LEFT JOIN AREAEVALUACION  ar ON ar.AREAID = pa.AREAID
         LEFT JOIN PROCESOEVAL      pe ON pe.PROCESOID = pa.PROCESOID
         LEFT JOIN ESTADOPARTICIPACION es ON es.ESTADOPARTID = pa.ESTADOPARTID
        WHERE pa.EVALUADORID = :1
        ORDER BY pa.ANIO DESC, pa.PARTICIPACIONID DESC`,
      [evaluadorId],
    )

    const anioActual = new Date().getFullYear()
    return filas.map(f => ({
      ...f,
      estadoNegativo: Number(f.estadoNegativo) === 1,
      esNueva: Number(f.anio) >= anioActual && !f.estadoCodigo,
    }))
  }

  /** Los correos y evidencias que el gestor cargó en sus ciclos. */
  async misEvidencias(evaluadorId: number) {
    return this.dataSource.query(
      `SELECT a.APROBACIONID           AS "aprobacionId",
              a.PARTICIPACIONID        AS "participacionId",
              pa.ANIO                  AS "anio",
              TRIM(cv.NOMBRE)          AS "convocatoria",
              TRIM(a.CORREOEVIDENCIANOMBRE) AS "nombre",
              TRIM(a.CORREOEVIDENCIAMIME)   AS "mime",
              DBMS_LOB.GETLENGTH(a.CORREOEVIDENCIA) AS "bytes",
              a.FECHAAPROBACION        AS "fecha"
         FROM EVALUADORAPROBACION a
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = a.PARTICIPACIONID
         LEFT JOIN EVALUADORCONVOCATORIA cv ON cv.CONVOCATORIAID = pa.CONVOCATORIAID
        WHERE pa.EVALUADORID = :1
          AND a.CORREOEVIDENCIA IS NOT NULL
        ORDER BY pa.ANIO DESC, a.APROBACIONID DESC`,
      [evaluadorId],
    )
  }

  async getEvidencia(aprobacionId: number, evaluadorId: number) {
    await this.esMiAprobacion(aprobacionId, evaluadorId)
    const filas: Array<{ blob: Buffer | null; mime: string | null; nombre: string | null }> =
      await this.dataSource.query(
        `SELECT CORREOEVIDENCIA           AS "blob",
                TRIM(CORREOEVIDENCIAMIME) AS "mime",
                TRIM(CORREOEVIDENCIANOMBRE) AS "nombre"
           FROM EVALUADORAPROBACION WHERE APROBACIONID = :1`,
        [aprobacionId],
      )
    const f = filas[0]
    if (!f?.blob || f.blob.length === 0) throw new NotFoundException('La evidencia no tiene archivo')
    return {
      buffer: f.blob,
      mime: f.mime || 'application/octet-stream',
      nombre: f.nombre || `evidencia-${aprobacionId}`,
    }
  }
}
