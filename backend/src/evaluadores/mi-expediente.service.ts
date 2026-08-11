import {
  ConflictException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

/** Quién es el evaluador que está pidiendo, resuelto desde su sesión. */
export interface MiEvaluador {
  evaluadorId: number
  personaId: number
  activo: boolean
}

/**
 * Resuelve el expediente del evaluador que abrió sesión, y solo el suyo.
 *
 * Todo lo de aquí parte de una regla: el identificador del evaluador NO viaja
 * nunca en la dirección ni en el cuerpo de la petición. Se deduce de la
 * sesión. Los identificadores del banco son números correlativos —43, 44,
 * 45…— así que si la dirección dijera de quién es la hoja de vida, adivinar
 * la de otro sería cambiar un número. Los identificadores de los archivos sí
 * viajan, porque hacen falta para pedir uno concreto; por eso cada consulta
 * lleva el dueño en el WHERE en vez de comprobarlo aparte: una consulta que
 * no encuentra nada no puede devolver lo que no es.
 */
@Injectable()
export class MiExpedienteService {
  private readonly log = new Logger(MiExpedienteService.name)

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * De la cuenta al evaluador, por el correo de la persona.
   *
   * Se miran los dos correos porque las fichas traen unas veces el personal y
   * otras el institucional. Y NO se toma el primero que aparezca: en PERSONA
   * hay correos repetidos entre personas distintas —comprobado, hay varios—,
   * así que si un día dos de ellas fueran evaluadoras, quedarse con una sería
   * enseñarle a alguien el expediente de otro sin que nadie se entere. Ante
   * dos, se corta y se avisa.
   */
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
      // Sin adivinar. Que falle a la vista es preferible a acertar por azar.
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

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Comprobaciones de pertenencia                                         ║
  // ╚══════════════════════════════════════════════════════════════════════╝
  //
  // Devuelven 404 y no 403 a propósito: un 403 confirmaría que ese documento
  // existe y es de alguien. Para quien pregunta por algo que no es suyo, no
  // existe y punto.

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

  esMiCertificado(certificadoId: number, evaluadorId: number) {
    return this.exigirPropio(
      `SELECT 1 FROM EVALUADORCERTIFICADO WHERE CERTIFICADOID = :1 AND EVALUADORID = :2`,
      certificadoId, evaluadorId, 'el certificado')
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Consultas propias del portal                                          ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  /**
   * Los ciclos a los que se le ha convocado, del más reciente al más antiguo.
   *
   * Es lo que responde "¿me llamaron para una evaluación nueva?". Se marca
   * `esNueva` cuando el ciclo es del año en curso y todavía no se ha decidido
   * si participa: eso es exactamente lo que la persona está buscando al
   * entrar.
   */
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

  /** Un correo o evidencia suyo, ya comprobado que lo es. */
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
