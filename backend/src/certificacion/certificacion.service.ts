import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import ExcelJS from 'exceljs'

/** Modalidades de formación:
 *  1 = Presencial   → CRONOGRAMAPRESENCIAL · HORASPRESENCIALES · UT (PP+TP)
 *  2 = PAT          → CRONOGRAMAPRESENCIAL · HORASPAT          · UT (PPAT+TPAT)
 *  3 = Híbrida      → CRONOGRAMAPRESENCIAL · HORASHIBRIDAS     · UT (PHib+THib)
 *  4 = Virtual      → CRONOGRAMAVIRTUAL    · HORASVIRTUALES    · UT (PV+TV)
 *  Las modalidades 1/2/3 usan la MISMA tabla CRONOGRAMAPRESENCIAL.
 *  Solo 4 va a CRONOGRAMAVIRTUAL. */
type Modalidad = 1 | 2 | 3 | 4

const MAX_SESIONES = 20

@Injectable()
export class CertificacionService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Bloquea escrituras si el convenio no está en ejecución. */
  private async assertConvenioEnEjecucion(proyectoId: number): Promise<void> {
    const [row] = await this.ds.query(
      `SELECT NVL(CONVENIOSESTADO, 0) AS "estado" FROM CONVENIOS
        WHERE PROYECTOID = :1 ORDER BY CONVENIOSID DESC FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )
    if (!row) throw new BadRequestException('Este proyecto no tiene convenio.')
    if (Number(row.estado) !== 1) {
      throw new ForbiddenException(
        'No se puede certificar: el convenio no está en ejecución.',
      )
    }
  }

  /** Cabecera para la pantalla de Certificación: AF, grupo, modalidad,
   *  tipo de evento, horas totales por modalidad. */
  async getCabecera(proyectoId: number, afGrupoId: number) {
    const [row] = await this.ds.query(
      `SELECT g.AFGRUPOID                              AS "afGrupoId",
              g.AFGRUPONUMERO                          AS "grupoNumero",
              af.ACCIONFORMACIONID                     AS "afId",
              af.ACCIONFORMACIONNUMERO                 AS "afNumero",
              TRIM(af.ACCIONFORMACIONNOMBRE)           AS "afNombre",
              af.MODALIDADFORMACIONID                  AS "modalidadId",
              UPPER(TRIM(mf.MODALIDADFORMACIONNOMBRE)) AS "modalidad",
              UPPER(TRIM(te.TIPOEVENTONOMBRE))         AS "tipoEvento"
         FROM AFGRUPO g
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
         LEFT JOIN MODALIDADFORMACION mf ON mf.MODALIDADFORMACIONID = af.MODALIDADFORMACIONID
         LEFT JOIN TIPOEVENTO te ON te.TIPOEVENTOID = af.TIPOEVENTOID
        WHERE g.AFGRUPOID = :1 AND af.PROYECTOID = :2 FETCH FIRST 1 ROW ONLY`,
      [afGrupoId, proyectoId],
    )
    if (!row) throw new NotFoundException('Grupo no encontrado en este proyecto.')

    // Horas totales del AF según modalidad — suma sobre UNIDADTEMATICA.
    const modalidadId = Number(row.modalidadId) as Modalidad
    const colP = this.colHorasPracticas(modalidadId)
    const colT = this.colHorasTeoricas(modalidadId)
    let totalHoras = 0
    if (colP && colT) {
      const [tot] = await this.ds.query(
        `SELECT NVL(SUM(NVL(${colP}, 0) + NVL(${colT}, 0)), 0) AS "h"
           FROM UNIDADTEMATICA WHERE ACCIONFORMACIONID = :1`,
        [Number(row.afId)],
      )
      totalHoras = Number(tot?.h) || 0
    }

    // Estado del convenio (para que el front sepa si gatear el botón Guardar).
    const [conv] = await this.ds.query(
      `SELECT NVL(CONVENIOSESTADO, 0) AS "estado" FROM CONVENIOS
        WHERE PROYECTOID = :1 ORDER BY CONVENIOSID DESC FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )
    return {
      ...row,
      totalHoras,
      convenioEnEjecucion: Number(conv?.estado) === 1,
    }
  }

  /** Columnas de horas (prácticas/teóricas) de UNIDADTEMATICA por modalidad. */
  private colHorasPracticas(mod: Modalidad): string | null {
    switch (mod) {
      case 1: return 'UNIDADTEMATICAHORASPP'
      case 2: return 'UNIDADTEMATICAHORASPPAT'
      case 3: return 'UNIDADTEMATICAHORASPHIB'
      case 4: return 'UNIDADTEMATICAHORASPV'
      default: return null
    }
  }
  private colHorasTeoricas(mod: Modalidad): string | null {
    switch (mod) {
      case 1: return 'UNIDADTEMATICAHORASTP'
      case 2: return 'UNIDADTEMATICAHORASTPAT'
      case 3: return 'UNIDADTEMATICAHORASTHIB'
      case 4: return 'UNIDADTEMATICAHORASTV'
      default: return null
    }
  }

  /** Unidades Temáticas del AF (para el combobox). Devuelve también el total
   *  de horas de cada UT por modalidad y si ya tiene sesiones en el cronograma. */
  async listarUnidades(proyectoId: number, afGrupoId: number) {
    const cab = await this.getCabecera(proyectoId, afGrupoId)
    const modalidadId = Number(cab.modalidadId) as Modalidad
    const colP = this.colHorasPracticas(modalidadId)
    const colT = this.colHorasTeoricas(modalidadId)
    if (!colP || !colT) return []
    const rows: Array<{
      utId: number; numero: number; nombre: string; horas: number; tieneSesiones: number
    }> = await this.ds.query(
      `SELECT ut.UNIDADTEMATICAID                     AS "utId",
              ut.UNIDADTEMATICANUMERO                 AS "numero",
              TRIM(ut.UNIDADTEMATICANOMBRE)           AS "nombre",
              NVL(ut.${colP}, 0) + NVL(ut.${colT}, 0) AS "horas",
              (SELECT COUNT(*) FROM CRONOGRAMA cr
                WHERE cr.AFGRUPOID = :1
                  AND cr.UNIDADTEMATICAID = ut.UNIDADTEMATICAID
                  AND EXISTS (
                    ${modalidadId === 4
                      ? `SELECT 1 FROM CRONOGRAMAVIRTUAL cv WHERE cv.CRONOGRAMAID = cr.CRONOGRAMAID`
                      : `SELECT 1 FROM CRONOGRAMAPRESENCIAL cp WHERE cp.CRONOGRAMAID = cr.CRONOGRAMAID`}
                  )) AS "tieneSesiones"
         FROM UNIDADTEMATICA ut
        WHERE ut.ACCIONFORMACIONID = :2
        ORDER BY ut.UNIDADTEMATICANUMERO`,
      [Number(afGrupoId), Number(cab.afId)],
    )
    return rows.map(r => ({
      ...r,
      horas: Number(r.horas),
      tieneSesiones: Number(r.tieneSesiones) > 0,
    }))
  }

  /** Sesiones del cronograma para (grupo, UT) según modalidad. Cada sesión
   *  tiene su `maxHoras` (CRONOGRAMA*NUMHORAS) que es el tope de input para
   *  cada beneficiario en esa sesión. */
  async listarSesiones(proyectoId: number, afGrupoId: number, utId: number) {
    const cab = await this.getCabecera(proyectoId, afGrupoId)
    const modalidadId = Number(cab.modalidadId) as Modalidad
    // Cronograma de (afGrupoId, utId).
    const [cr] = await this.ds.query(
      `SELECT CRONOGRAMAID AS "cronogramaId"
         FROM CRONOGRAMA WHERE AFGRUPOID = :1 AND UNIDADTEMATICAID = :2
        FETCH FIRST 1 ROW ONLY`,
      [afGrupoId, utId],
    )
    if (!cr) return []
    const cronogramaId = Number(cr.cronogramaId)
    if (modalidadId === 4) {
      const rows: Array<{ sesionId: number; numero: number; maxHoras: number }> = await this.ds.query(
        `SELECT cv.CRONOGRAMAVIRTUALID         AS "sesionId",
                cv.CRONOGRAMAVIRTUALNUMSESION  AS "numero",
                cv.CRONOGRAMAVIRTUALNUMHORAS   AS "maxHoras"
           FROM CRONOGRAMAVIRTUAL cv WHERE cv.CRONOGRAMAID = :1
          ORDER BY cv.CRONOGRAMAVIRTUALNUMSESION`,
        [cronogramaId],
      )
      return rows.map(r => ({ ...r, maxHoras: Number(r.maxHoras) }))
    }
    const rows: Array<{ sesionId: number; numero: number; maxHoras: number }> = await this.ds.query(
      `SELECT cp.CRONOGRAMAPRESENCIALID         AS "sesionId",
              cp.CRONOGRAMAPRESENCIALNUMSESION  AS "numero",
              cp.CRONOGRAMAPRESENCIALNUMHORAS   AS "maxHoras"
         FROM CRONOGRAMAPRESENCIAL cp WHERE cp.CRONOGRAMAID = :1
        ORDER BY cp.CRONOGRAMAPRESENCIALNUMSESION`,
      [cronogramaId],
    )
    return rows.map(r => ({ ...r, maxHoras: Number(r.maxHoras) }))
  }

  /** Beneficiarios del grupo con sus UTHoras (para la UT seleccionada). */
  async listarBeneficiarios(proyectoId: number, afGrupoId: number, utId: number) {
    // Validar pertenencia.
    const [g] = await this.ds.query(
      `SELECT g.AFGRUPOID AS "id"
         FROM AFGRUPO g
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
        WHERE g.AFGRUPOID = :1 AND af.PROYECTOID = :2 FETCH FIRST 1 ROW ONLY`,
      [afGrupoId, proyectoId],
    )
    if (!g) throw new BadRequestException('El grupo no pertenece al proyecto.')

    const cols = Array.from({ length: MAX_SESIONES }, (_, i) => `NVL(u.UTHORAS${i + 1}, 0) AS "h${i + 1}"`).join(',\n              ')

    const rows: Array<Record<string, unknown>> = await this.ds.query(
      `SELECT agb.AFGRUPOBENEFICIARIOID            AS "afGrupoBeneficiarioId",
              p.PERSONAID                          AS "personaId",
              TRIM(td.TIPODOCUMENTOIDENTIDADNOMBRE) AS "tipoDocumento",
              TRIM(p.PERSONAIDENTIFICACION)        AS "identificacion",
              UPPER(TRIM(p.PERSONANOMBRES))        AS "nombres",
              UPPER(TRIM(p.PERSONAPRIMERAPELLIDO)) AS "primerApellido",
              UPPER(TRIM(p.PERSONASEGUNDOAPELLIDO)) AS "segundoApellido",
              TRIM(agb.AFGRUPOBENEESTADO)          AS "estado",
              TRIM(agb.CERTIFICA)                  AS "certifica",
              TRIM(agb.VALIDACIONINTERVENTOR)      AS "validacionInterventor",
              NVL(agb.PORCENTAJECUMPLIMIENTO, 0)   AS "porcentajeCumplimiento",
              u.UTHORASID                          AS "uthorasId",
              NVL(u.UTHORASTOTAL, 0)               AS "totalHoras",
              ${cols}
         FROM AFGRUPOBENEFICIARIO agb
         JOIN PERSONA p                       ON p.PERSONAID = agb.PERSONAID
         LEFT JOIN TIPODOCUMENTOIDENTIDAD td   ON td.TIPODOCUMENTOIDENTIDADID = p.TIPODOCUMENTOIDENTIDADID
         LEFT JOIN UTHORAS u                   ON u.AFGRUPOID = agb.AFGRUPOID
                                              AND u.PERSONAID = agb.PERSONAID
                                              AND u.UNIDADTEMATICAID = :1
        WHERE agb.AFGRUPOID = :2
          AND TRIM(agb.AFGRUPOBENEESTADO) = 'ACTIVO'
        ORDER BY p.PERSONAPRIMERAPELLIDO, p.PERSONANOMBRES`,
      [utId, afGrupoId],
    )
    return rows.map(r => {
      const horas: number[] = []
      for (let i = 1; i <= MAX_SESIONES; i++) horas.push(Number(r[`h${i}`]) || 0)
      const nombreCompleto = [r.nombres, r.primerApellido, r.segundoApellido]
        .map(x => (x as string ?? '').trim()).filter(Boolean).join(' ')
      return {
        afGrupoBeneficiarioId: Number(r.afGrupoBeneficiarioId),
        personaId: Number(r.personaId),
        tipoDocumento: r.tipoDocumento ?? null,
        identificacion: r.identificacion ?? null,
        nombreCompleto,
        estado: r.estado ?? null,
        certifica: r.certifica ?? null,
        validacionInterventor: r.validacionInterventor ?? null,
        porcentajeCumplimiento: Number(r.porcentajeCumplimiento) || 0,
        uthorasId: r.uthorasId ? Number(r.uthorasId) : null,
        totalHoras: Number(r.totalHoras) || 0,
        horas,
      }
    })
  }

  /** Guarda/actualiza las UTHORAS de un beneficiario en una UT.
   *  Valida que cada hora ingresada ≤ maxHoras de su sesión, y que el total
   *  no supere las horas totales de la UT (por modalidad). Luego recalcula
   *  el total y % de cumplimiento sobre AFGRUPOBENEFICIARIO. */
  async guardarHoras(
    proyectoId: number,
    afGrupoId: number,
    utId: number,
    personaId: number,
    horas: number[],
  ): Promise<{ mensaje: string; uthorasId: number; total: number; porcentajeCumplimiento: number }> {
    await this.assertConvenioEnEjecucion(proyectoId)

    const cab = await this.getCabecera(proyectoId, afGrupoId)
    const modalidadId = Number(cab.modalidadId) as Modalidad

    // Validar que la persona pertenece al grupo (y está ACTIVA).
    const [agb] = await this.ds.query(
      `SELECT AFGRUPOBENEFICIARIOID AS "id" FROM AFGRUPOBENEFICIARIO
        WHERE AFGRUPOID = :1 AND PERSONAID = :2
          AND TRIM(AFGRUPOBENEESTADO) = 'ACTIVO'
        FETCH FIRST 1 ROW ONLY`,
      [afGrupoId, personaId],
    )
    if (!agb) throw new BadRequestException('La persona no está activa en este grupo.')

    // Validar contra sesiones del cronograma.
    const sesiones = await this.listarSesiones(proyectoId, afGrupoId, utId)
    if (sesiones.length === 0) {
      throw new BadRequestException('El cronograma no tiene sesiones registradas para esta UT.')
    }
    const limpias: number[] = horas.slice(0, MAX_SESIONES).map(h => {
      const n = Number(h)
      return isNaN(n) || n < 0 ? 0 : n
    })
    while (limpias.length < MAX_SESIONES) limpias.push(0)

    for (let i = 0; i < sesiones.length; i++) {
      if (limpias[i] > sesiones[i].maxHoras) {
        throw new BadRequestException(
          `La sesión ${sesiones[i].numero} solo tiene ${sesiones[i].maxHoras} horas registradas. ` +
          `Estás intentando guardar ${limpias[i]}.`,
        )
      }
    }

    // Validar total de la UT contra horas totales del UT (modalidad-específico).
    const colP = this.colHorasPracticas(modalidadId)
    const colT = this.colHorasTeoricas(modalidadId)
    let maxUtHoras = 0
    if (colP && colT) {
      const [u] = await this.ds.query(
        `SELECT NVL(${colP}, 0) + NVL(${colT}, 0) AS "h" FROM UNIDADTEMATICA WHERE UNIDADTEMATICAID = :1`,
        [utId],
      )
      maxUtHoras = Number(u?.h) || 0
    }
    const total = limpias.reduce((a, b) => a + b, 0)
    if (maxUtHoras > 0 && total > maxUtHoras) {
      throw new BadRequestException(
        `El total (${total}h) supera las horas registradas en la UT (${maxUtHoras}h).`,
      )
    }

    // Upsert UTHORAS.
    const [exist] = await this.ds.query(
      `SELECT UTHORASID AS "id" FROM UTHORAS
        WHERE AFGRUPOID = :1 AND PERSONAID = :2 AND UNIDADTEMATICAID = :3
        FETCH FIRST 1 ROW ONLY`,
      [afGrupoId, personaId, utId],
    )
    let uthorasId: number
    if (exist) {
      uthorasId = Number(exist.id)
      const setCols = Array.from({ length: MAX_SESIONES }, (_, i) => `UTHORAS${i + 1} = :${i + 1}`).join(', ')
      await this.ds.query(
        `UPDATE UTHORAS SET ${setCols}, UTHORASTOTAL = :${MAX_SESIONES + 1}, UTHORASFECHAREGISTRO = SYSDATE
          WHERE UTHORASID = :${MAX_SESIONES + 2}`,
        [...limpias, total, uthorasId],
      )
    } else {
      const [{ nid }] = await this.ds.query(
        `SELECT NVL(MAX(UTHORASID), 0) + 1 AS "nid" FROM UTHORAS`,
      )
      uthorasId = Number(nid)
      const cols = Array.from({ length: MAX_SESIONES }, (_, i) => `UTHORAS${i + 1}`).join(', ')
      const binds = Array.from({ length: MAX_SESIONES }, (_, i) => `:${i + 5}`).join(', ')
      await this.ds.query(
        `INSERT INTO UTHORAS
           (UTHORASID, AFGRUPOID, PERSONAID, UNIDADTEMATICAID, ${cols},
            UTHORASTOTAL, UTHORASFECHAREGISTRO)
         VALUES (:1, :2, :3, :4, ${binds}, :${MAX_SESIONES + 5}, SYSDATE)`,
        [uthorasId, afGrupoId, personaId, utId, ...limpias, total],
      )
    }

    // Recalcular acumulados en AFGRUPOBENEFICIARIO.
    // Suma de UTHORASTOTAL de todas las UTs del AF (este beneficiario en este grupo).
    const [agg] = await this.ds.query(
      `SELECT NVL(SUM(u.UTHORASTOTAL), 0) AS "horas"
         FROM UTHORAS u
         JOIN UNIDADTEMATICA ut ON ut.UNIDADTEMATICAID = u.UNIDADTEMATICAID
        WHERE u.AFGRUPOID = :1
          AND u.PERSONAID = :2
          AND ut.ACCIONFORMACIONID = :3`,
      [afGrupoId, personaId, Number(cab.afId)],
    )
    const horasPersonaAF = Number(agg?.horas) || 0
    const totalHorasAF = Number(cab.totalHoras) || 0
    const pct = totalHorasAF > 0
      ? Math.min(100, Math.round((horasPersonaAF / totalHorasAF) * 100))
      : 0
    // CERTIFICA = SI si % >= 80, NO si menor. (Regla común; el SENA suele
    // exigir 80% de asistencia mínima para certificar.)
    const certifica = pct >= 80 ? 'SI' : 'NO'

    // Mapear a la columna correcta de HORAS* según modalidad.
    const horasCol = ({
      1: 'HORASPRESENCIALES',
      2: 'HORASPAT',
      3: 'HORASHIBRIDAS',
      4: 'HORASVIRTUALES',
    } as const)[modalidadId]

    if (horasCol) {
      await this.ds.query(
        `UPDATE AFGRUPOBENEFICIARIO
            SET ${horasCol}           = :1,
                PORCENTAJECUMPLIMIENTO = :2,
                CERTIFICA              = :3
          WHERE AFGRUPOID = :4 AND PERSONAID = :5`,
        [horasPersonaAF, pct, certifica, afGrupoId, personaId],
      )
    }

    return {
      mensaje: 'Horas guardadas correctamente.',
      uthorasId,
      total,
      porcentajeCumplimiento: pct,
    }
  }

  /** Certificación masiva: para cada beneficiario ACTIVO del grupo que aún no
   *  tenga horas registradas en esta UT (o las tenga en 0), le asigna las
   *  horas máximas de cada sesión del cronograma. NO sobrescribe filas con
   *  horas ya editadas manualmente (preserva totalHoras > 0).
   *
   *  Devuelve `{ actualizados, omitidos, sinSesiones, mensaje }`. */
  async certificarMasivo(proyectoId: number, afGrupoId: number, utId: number): Promise<{
    actualizados: number; omitidos: number; sinSesiones?: boolean; mensaje: string
  }> {
    await this.assertConvenioEnEjecucion(proyectoId)

    const cab = await this.getCabecera(proyectoId, afGrupoId)
    const modalidadId = Number(cab.modalidadId) as Modalidad

    // Sesiones del cronograma para esta (grupo, UT).
    const sesiones = await this.listarSesiones(proyectoId, afGrupoId, utId)
    if (sesiones.length === 0) {
      return {
        actualizados: 0, omitidos: 0, sinSesiones: true,
        mensaje: 'El cronograma no tiene sesiones registradas para esta UT.',
      }
    }
    // Horas máximas por sesión, en orden — alineado a MAX_SESIONES (relleno con 0).
    const maxHoras: number[] = Array(MAX_SESIONES).fill(0)
    for (let i = 0; i < Math.min(sesiones.length, MAX_SESIONES); i++) {
      maxHoras[i] = Number(sesiones[i].maxHoras) || 0
    }
    const totalSesion = maxHoras.reduce((a, b) => a + b, 0)

    // Horas totales de la UT (modalidad-específico) — para validar contra el max.
    const colP = this.colHorasPracticas(modalidadId)
    const colT = this.colHorasTeoricas(modalidadId)
    let maxUtHoras = 0
    if (colP && colT) {
      const [u] = await this.ds.query(
        `SELECT NVL(${colP}, 0) + NVL(${colT}, 0) AS "h" FROM UNIDADTEMATICA WHERE UNIDADTEMATICAID = :1`,
        [utId],
      )
      maxUtHoras = Number(u?.h) || 0
    }
    // Asignamos hasta lo que tope la UT (no más).
    const totalAplicar = maxUtHoras > 0 ? Math.min(totalSesion, maxUtHoras) : totalSesion

    // Beneficiarios activos del grupo.
    const benefs: Array<{ personaId: number }> = await this.ds.query(
      `SELECT PERSONAID AS "personaId" FROM AFGRUPOBENEFICIARIO
        WHERE AFGRUPOID = :1 AND TRIM(AFGRUPOBENEESTADO) = 'ACTIVO'
        ORDER BY PERSONAID`,
      [afGrupoId],
    )

    const horasCol = ({
      1: 'HORASPRESENCIALES',
      2: 'HORASPAT',
      3: 'HORASHIBRIDAS',
      4: 'HORASVIRTUALES',
    } as const)[modalidadId]

    let actualizados = 0
    let omitidos = 0
    const setCols = Array.from({ length: MAX_SESIONES }, (_, i) => `UTHORAS${i + 1} = :${i + 1}`).join(', ')
    const colsIns = Array.from({ length: MAX_SESIONES }, (_, i) => `UTHORAS${i + 1}`).join(', ')
    const bindsIns = Array.from({ length: MAX_SESIONES }, (_, i) => `:${i + 5}`).join(', ')

    for (const b of benefs) {
      // ¿Ya tiene UTHoras para esta UT?
      const [exist] = await this.ds.query(
        `SELECT UTHORASID AS "id", NVL(UTHORASTOTAL, 0) AS "total"
           FROM UTHORAS
          WHERE AFGRUPOID = :1 AND PERSONAID = :2 AND UNIDADTEMATICAID = :3
          FETCH FIRST 1 ROW ONLY`,
        [afGrupoId, b.personaId, utId],
      )
      if (exist && Number(exist.total) > 0) {
        // Ya tiene horas registradas: NO sobrescribir.
        omitidos++
        continue
      }

      if (exist) {
        await this.ds.query(
          `UPDATE UTHORAS SET ${setCols},
                              UTHORASTOTAL = :${MAX_SESIONES + 1},
                              UTHORASFECHAREGISTRO = SYSDATE
            WHERE UTHORASID = :${MAX_SESIONES + 2}`,
          [...maxHoras, totalAplicar, Number(exist.id)],
        )
      } else {
        const [{ nid }] = await this.ds.query(
          `SELECT NVL(MAX(UTHORASID), 0) + 1 AS "nid" FROM UTHORAS`,
        )
        await this.ds.query(
          `INSERT INTO UTHORAS
             (UTHORASID, AFGRUPOID, PERSONAID, UNIDADTEMATICAID, ${colsIns},
              UTHORASTOTAL, UTHORASFECHAREGISTRO)
           VALUES (:1, :2, :3, :4, ${bindsIns}, :${MAX_SESIONES + 5}, SYSDATE)`,
          [Number(nid), afGrupoId, b.personaId, utId, ...maxHoras, totalAplicar],
        )
      }

      // Recalcular totales del beneficiario en AFGRUPOBENEFICIARIO.
      const [agg] = await this.ds.query(
        `SELECT NVL(SUM(u.UTHORASTOTAL), 0) AS "horas"
           FROM UTHORAS u
           JOIN UNIDADTEMATICA ut ON ut.UNIDADTEMATICAID = u.UNIDADTEMATICAID
          WHERE u.AFGRUPOID = :1 AND u.PERSONAID = :2 AND ut.ACCIONFORMACIONID = :3`,
        [afGrupoId, b.personaId, Number(cab.afId)],
      )
      const horasPersonaAF = Number(agg?.horas) || 0
      const totalHorasAF = Number(cab.totalHoras) || 0
      const pct = totalHorasAF > 0 ? Math.min(100, Math.round((horasPersonaAF / totalHorasAF) * 100)) : 0
      const certifica = pct >= 80 ? 'SI' : 'NO'
      if (horasCol) {
        await this.ds.query(
          `UPDATE AFGRUPOBENEFICIARIO
              SET ${horasCol}           = :1,
                  PORCENTAJECUMPLIMIENTO = :2,
                  CERTIFICA              = :3
            WHERE AFGRUPOID = :4 AND PERSONAID = :5`,
          [horasPersonaAF, pct, certifica, afGrupoId, b.personaId],
        )
      }
      actualizados++
    }

    const partes: string[] = []
    if (actualizados > 0) partes.push(`${actualizados} certificado${actualizados === 1 ? '' : 's'} con ${totalAplicar}h`)
    if (omitidos > 0) partes.push(`${omitidos} omitido${omitidos === 1 ? '' : 's'} (ya tenían horas)`)
    const mensaje = partes.length > 0
      ? `Certificación masiva: ${partes.join(' · ')}.`
      : 'No hay beneficiarios activos para certificar.'

    return { actualizados, omitidos, mensaje }
  }

  // ── Reporte de Asistencia ─────────────────────────────────────────────────

  /** Estructura ricamente armada para la pantalla "Reporte de asistencia":
   *  cabecera con info del convenio/director/AF, lista de UTs con número de
   *  sesiones (para columnas dinámicas) y beneficiarios con sus horas por UT. */
  async getReporteAsistencia(proyectoId: number, afGrupoId: number) {
    const cab = await this.getCabecera(proyectoId, afGrupoId)
    const modalidadId = Number(cab.modalidadId) as Modalidad

    // ── Datos extra del header (programa, convocatoria, convenio, director).
    const [extra] = await this.ds.query(
      `SELECT TRIM(e.EMPRESARAZONSOCIAL)                 AS "empresaRazonSocial",
              TRIM(cv.CONVENIOSNUMERO)                   AS "convenioNumero",
              TRIM(co.CONVOCATORIANOMBRE)                AS "convocatoria",
              TRIM(pg.PROGRAMANOMBRE)                    AS "programa",
              TRIM(pg.PROGRAMACOLOR)                     AS "programaColor"
         FROM PROYECTO pr
         LEFT JOIN CONVENIOS cv     ON cv.PROYECTOID = pr.PROYECTOID
         LEFT JOIN EMPRESA e        ON e.EMPRESAID = pr.EMPRESAID
         LEFT JOIN CONVOCATORIA co  ON co.CONVOCATORIAID = pr.CONVOCATORIAID
         LEFT JOIN PROGRAMA pg      ON pg.PROGRAMAID = co.PROGRAMAID
        WHERE pr.PROYECTOID = :1
        FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )

    // ── Director activo del proyecto.
    //  Trim por columna (NCHAR padea con espacios) y luego concatenar.
    //  Literales con N'' para que el charset nacional coincida y evitar ORA-12704.
    const [dir] = await this.ds.query(
      `SELECT UPPER(
                TRIM(p.PERSONANOMBRES) || N' ' ||
                TRIM(p.PERSONAPRIMERAPELLIDO) ||
                CASE WHEN TRIM(p.PERSONASEGUNDOAPELLIDO) IS NULL
                       OR TRIM(p.PERSONASEGUNDOAPELLIDO) = N''
                     THEN N''
                     ELSE N' ' || TRIM(p.PERSONASEGUNDOAPELLIDO) END
              ) AS "director"
         FROM DIRECTORES d
         JOIN PERSONA p ON p.PERSONAID = d.PERSONAID
        WHERE d.PROYECTOID = :1 AND TRIM(d.DIREESTADO) = 'ACTIVO'
        FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )

    // ── Plataforma/Link/Fecha inicio: del primer cronograma del grupo.
    let plataforma: string | null = null
    let linkAsistencia: string | null = null
    let fechaInicio: string | null = null
    if (modalidadId === 4) {
      const [c] = await this.ds.query(
        `SELECT TRIM(cv.CRONOGRAMAVIRTUALPROVEEDOR)      AS "plataforma",
                TRIM(cv.CRONOGRAMAVIRTUALURL)            AS "link",
                TO_CHAR(MIN(cv.CRONOGRAMAVIRTUALFECHAINICIO), 'DD/MM/YYYY') AS "fechaInicio"
           FROM CRONOGRAMA cr
           JOIN CRONOGRAMAVIRTUAL cv ON cv.CRONOGRAMAID = cr.CRONOGRAMAID
          WHERE cr.AFGRUPOID = :1
          GROUP BY TRIM(cv.CRONOGRAMAVIRTUALPROVEEDOR), TRIM(cv.CRONOGRAMAVIRTUALURL)
          FETCH FIRST 1 ROW ONLY`,
        [afGrupoId],
      )
      plataforma = c?.plataforma ?? null
      linkAsistencia = c?.link ?? null
      fechaInicio = c?.fechaInicio ?? null
    } else {
      const [c] = await this.ds.query(
        `SELECT TRIM(cp.CRONOGRAMAHERRAMIENTA)            AS "plataforma",
                TRIM(cp.CRONOGRAMAURL)                    AS "link",
                TO_CHAR(MIN(cp.CRONOGRAMAPRESENCIALFECHAINICI), 'DD/MM/YYYY') AS "fechaInicio"
           FROM CRONOGRAMA cr
           JOIN CRONOGRAMAPRESENCIAL cp ON cp.CRONOGRAMAID = cr.CRONOGRAMAID
          WHERE cr.AFGRUPOID = :1
          GROUP BY TRIM(cp.CRONOGRAMAHERRAMIENTA), TRIM(cp.CRONOGRAMAURL)
          FETCH FIRST 1 ROW ONLY`,
        [afGrupoId],
      )
      plataforma = c?.plataforma ?? null
      linkAsistencia = c?.link ?? null
      fechaInicio = c?.fechaInicio ?? null
    }

    // ── UTs del AF (ordenadas por número) con su número de sesiones del cronograma.
    const utsRaw: Array<{ utId: number; numero: number; nombre: string; numSesiones: number }> = await this.ds.query(
      `SELECT ut.UNIDADTEMATICAID AS "utId",
              ut.UNIDADTEMATICANUMERO AS "numero",
              UPPER(TRIM(ut.UNIDADTEMATICANOMBRE)) AS "nombre",
              NVL((SELECT COUNT(*) FROM CRONOGRAMA cr
                     ${modalidadId === 4
                       ? 'JOIN CRONOGRAMAVIRTUAL cv ON cv.CRONOGRAMAID = cr.CRONOGRAMAID'
                       : 'JOIN CRONOGRAMAPRESENCIAL cp ON cp.CRONOGRAMAID = cr.CRONOGRAMAID'}
                    WHERE cr.AFGRUPOID = :1
                      AND cr.UNIDADTEMATICAID = ut.UNIDADTEMATICAID), 0) AS "numSesiones"
         FROM UNIDADTEMATICA ut
        WHERE ut.ACCIONFORMACIONID = :2
        ORDER BY ut.UNIDADTEMATICANUMERO`,
      [afGrupoId, Number(cab.afId)],
    )
    const unidades = utsRaw.map(u => ({
      ...u,
      numSesiones: Number(u.numSesiones),
    }))
    const totalSesionesAF = unidades.reduce((a, u) => a + u.numSesiones, 0)
    const totalHorasAF = Number(cab.totalHoras) || 0

    // ── Beneficiarios activos con sus UTHoras por UT (todas las UTs).
    const cols = Array.from({ length: MAX_SESIONES }, (_, i) => `NVL(u.UTHORAS${i + 1}, 0) AS "h${i + 1}"`).join(',\n              ')
    type Row = Record<string, unknown>
    const rows: Row[] = await this.ds.query(
      `SELECT p.PERSONAID                          AS "personaId",
              UPPER(TRIM(p.PERSONANOMBRES))        AS "nombres",
              UPPER(TRIM(p.PERSONAPRIMERAPELLIDO)) AS "primerApellido",
              UPPER(TRIM(p.PERSONASEGUNDOAPELLIDO)) AS "segundoApellido",
              UPPER(TRIM(td.TIPODOCUMENTOIDENTIDADSIGLA)) AS "tipoDocSigla",
              TRIM(p.PERSONAIDENTIFICACION)        AS "identificacion",
              TRIM(p.PERSONAEMAIL)                 AS "email",
              TRIM(p.PERSONACELULAR)               AS "celular",
              UPPER(TRIM(d.DEPARTAMENTONOMBRE))    AS "departamento",
              UPPER(TRIM(ci.CIUDADNOMBRE))         AS "ciudad",
              UPPER(TRIM(po.POSTULACIONTRASFERENCIA)) AS "transferencia",
              UPPER(TRIM(pt.PERFILTRASFERENCIANOMBRE)) AS "perfilTransferencia",
              UPPER(TRIM(agb.CERTIFICA))           AS "certifica",
              u.UNIDADTEMATICAID                   AS "utId",
              NVL(u.UTHORASTOTAL, 0)               AS "utTotal",
              ${cols}
         FROM AFGRUPOBENEFICIARIO agb
         JOIN PERSONA p ON p.PERSONAID = agb.PERSONAID
         LEFT JOIN TIPODOCUMENTOIDENTIDAD td ON td.TIPODOCUMENTOIDENTIDADID = p.TIPODOCUMENTOIDENTIDADID
         LEFT JOIN CIUDAD ci                 ON ci.CIUDADID = p.CIUDADID
         LEFT JOIN DEPARTAMENTO d            ON d.DEPARTAMENTOID = ci.DEPARTAMENTOID
         LEFT JOIN POSTULACION po            ON po.PERSONAID = agb.PERSONAID
                                            AND po.POSTULACIONANO = agb.POSTULACIONANO
         LEFT JOIN PERFILTRASFERENCIA pt     ON pt.PERFILTRASFERENCIAID = po.PERFILTRASFERENCIAID
         LEFT JOIN UTHORAS u                 ON u.AFGRUPOID = agb.AFGRUPOID
                                            AND u.PERSONAID = agb.PERSONAID
        WHERE agb.AFGRUPOID = :1
          AND TRIM(agb.AFGRUPOBENEESTADO) = 'ACTIVO'
        ORDER BY p.PERSONAPRIMERAPELLIDO, p.PERSONANOMBRES, u.UNIDADTEMATICAID`,
      [afGrupoId],
    )

    /** Agrupa filas por persona: una persona puede tener varias filas (una por UT). */
    type Beneficiario = {
      personaId: number
      nombreCompleto: string
      tipoDocSigla: string | null
      identificacion: string | null
      email: string | null
      celular: string | null
      departamento: string | null
      ciudad: string | null
      transferencia: string | null
      perfilTransferencia: string | null
      certifica: string | null
      horasPorUT: Record<number, number[]>  // utId → [h1..h20]
      totalHoras: number
      porcentajeAvance: number
    }
    const porPersona = new Map<number, Beneficiario>()
    for (const r of rows) {
      const personaId = Number(r.personaId)
      let b = porPersona.get(personaId)
      if (!b) {
        const nombreCompleto = [r.nombres, r.primerApellido, r.segundoApellido]
          .map(x => (x as string ?? '').trim()).filter(Boolean).join(' ')
        b = {
          personaId,
          nombreCompleto,
          tipoDocSigla: (r.tipoDocSigla as string) ?? null,
          identificacion: (r.identificacion as string) ?? null,
          email: (r.email as string) ?? null,
          celular: (r.celular as string) ?? null,
          departamento: (r.departamento as string) ?? null,
          ciudad: (r.ciudad as string) ?? null,
          transferencia: (r.transferencia as string) ?? null,
          perfilTransferencia: (r.perfilTransferencia as string) ?? null,
          certifica: (r.certifica as string) ?? null,
          horasPorUT: {},
          totalHoras: 0,
          porcentajeAvance: 0,
        }
        porPersona.set(personaId, b)
      }
      if (r.utId != null) {
        const horas: number[] = []
        for (let i = 1; i <= MAX_SESIONES; i++) horas.push(Number(r[`h${i}`]) || 0)
        b.horasPorUT[Number(r.utId)] = horas
        b.totalHoras += Number(r.utTotal) || 0
      }
    }
    // Calcular % avance por persona y sortear por nombre.
    const beneficiarios = Array.from(porPersona.values())
      .map((b, i) => ({
        ...b,
        nro: i + 1,
        porcentajeAvance: totalHorasAF > 0
          ? Math.min(100, Math.round((b.totalHoras / totalHorasAF) * 100))
          : 0,
      }))
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto))
      .map((b, i) => ({ ...b, nro: i + 1 }))

    // Título del formato según modalidad.
    const formato = ({
      1: 'F2.2 LISTADO DE ASISTENCIA PARA LAS ACCIONES DE FORMACIÓN PRESENCIAL',
      2: 'F2.1 LISTADO DE ASISTENCIA PARA LAS ACCIONES DE FORMACIÓN PRESENCIAL ASISTIDA POR TECNOLOGÍAS - PAT',
      3: 'F2.2 LISTADO DE ASISTENCIA PARA LAS ACCIONES DE FORMACIÓN PRESENCIAL HÍBRIDA',
      4: 'F3.1 FORMATO VERIFICACIÓN DE CUMPLIMIENTO DE ACTIVIDADES - MODALIDAD VIRTUAL',
    } as const)[modalidadId] ?? 'LISTADO DE ASISTENCIA'

    return {
      cabecera: {
        ...cab,
        formato,
        empresaRazonSocial: extra?.empresaRazonSocial ?? null,
        convenioNumero: extra?.convenioNumero ?? null,
        convocatoria: extra?.convocatoria ?? null,
        programa: extra?.programa ?? null,
        programaColor: extra?.programaColor ?? null,
        director: dir?.director ?? null,
        plataforma,
        linkAsistencia,
        fechaInicio,
        fechaCorte: new Date().toLocaleDateString('es-CO'),
        totalSesionesAF,
      },
      unidades,
      beneficiarios,
    }
  }

  /** Genera el Excel del Reporte de Asistencia con el MISMO layout del SEP
   *  legacy (formato F2.x/F3.1): cabecera oficial (filas 1-4 merged A:V),
   *  bloque de campos (filas 5-8 con merges fijos y celdas con fill azul
   *  corporativo #00304D + texto blanco bold), separador (fila 9), encabezado
   *  de tabla (fila 10) y datos desde fila 11. Usa ExcelJS para soportar
   *  estilos (fill, font, border, alignment) que SheetJS community no expone. */
  async exportarAsistenciaExcel(proyectoId: number, afGrupoId: number): Promise<{ buffer: Buffer; filename: string }> {
    const rep = await this.getReporteAsistencia(proyectoId, afGrupoId)
    const cab = rep.cabecera

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Sistema Especializado de Proyectos - SEP'
    wb.created = new Date()
    const sheetName = `ASISTENCIA - ${(cab.afNombre ?? 'AF').replace(/[:*?[\]/\\]/g, '').slice(0, 25)}`
    const ws = wb.addWorksheet(sheetName)

    // ── Colores y estilo helpers ─────────────────────────────────────────────
    const COLOR_FILL = '00304D'         // azul corporativo SEP
    const COLOR_NOTE = '8AC8A3'         // verde nota interventoría
    const fillLabel = (): ExcelJS.FillPattern => ({
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOR_FILL },
    })
    const fillNote = (): ExcelJS.FillPattern => ({
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOR_NOTE },
    })
    const fontWhiteBold: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true }
    const center: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true }
    const left: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'left', wrapText: true }
    const thin: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFCCCCCC' } }
    const borderAll: Partial<ExcelJS.Borders> = { top: thin, bottom: thin, left: thin, right: thin }

    /** Aplica fill azul + texto blanco bold + centrado + bordes a un rango merged.
     *  El valor se setea solo en la primera celda del rango. */
    function setLabel(range: string, value: string | number) {
      ws.mergeCells(range)
      const cell = ws.getCell(range.split(':')[0])
      cell.value = value
      cell.fill = fillLabel()
      cell.font = fontWhiteBold
      cell.alignment = center
      cell.border = borderAll
    }
    /** Texto plano (valor) en un rango merged. */
    function setValue(range: string, value: string | number, opts?: { align?: 'left' | 'center'; bold?: boolean }) {
      ws.mergeCells(range)
      const cell = ws.getCell(range.split(':')[0])
      cell.value = value ?? ''
      cell.alignment = opts?.align === 'left' ? left : center
      if (opts?.bold) cell.font = { bold: true }
      cell.border = borderAll
    }
    function setNote(range: string, value: string) {
      ws.mergeCells(range)
      const cell = ws.getCell(range.split(':')[0])
      cell.value = value
      cell.fill = fillNote()
      cell.alignment = center
      cell.font = { size: 10 }
      cell.border = borderAll
    }

    // ── Calcular ancho de tabla (columnas dinámicas por UT × sesión) ─────────
    const headersFijos = [
      'N°',
      'NOMBRES Y APELLIDOS:',
      'TIPO DOCUMENTO:',
      'N° IDENTIFICACIÓN:',
      'CORREO ELECTRONICO:',
      'NÚMERO CONTACTO CÉLULAR:',
      'DEPARTAMENTO DE DOMICILIO PRINCIPAL:',
      'MUNICIPIO DOMICILIO:',
      '¿BENEFICIARIO DE TRANSFERENCIA DE CONOCIMIENTO Y TECNOLOGÍA?:',
      'PERFIL BENEFICIARIO SENA:',
    ]
    const headers: string[] = [...headersFijos]
    const ordenUTs: Array<{ utId: number; numSesiones: number; nombre: string }> = []
    for (const u of rep.unidades) {
      const nombre = (u.nombre ?? '').trim()
      for (let i = 1; i <= u.numSesiones; i++) {
        headers.push(`UT ${nombre} Sesion ${i}:`)
      }
      ordenUTs.push({ utId: u.utId, numSesiones: u.numSesiones, nombre })
    }
    headers.push('TOTAL HORAS DE FORMACIÓN:', '% AVANCE:', 'CERTIFICA:')
    const totalCols = headers.length

    // El layout legacy fija 22 columnas (A..V) para el bloque de cabecera.
    // Si la tabla tiene >22 columnas, expandimos el header al ancho real.
    const headerLastCol = Math.max(22, totalCols)
    const lastColLetter = ws.getColumn(headerLastCol).letter

    // ── Filas 1-4: TÍTULOS GENERALES (merged A:lastCol, fill blanco, bold, 18pt) ─
    const tituloLineas = [
      'SERVICIO NACIONAL DE APRENDIZAJE',
      'DIRECCIÓN DEL SISTEMA NACIONAL DE FORMACIÓN PARA EL TRABAJO',
      `SISTEMA ESPECIALIZADO DE PROYECTOS - SEP - PROGRAMA ${cab.programa ?? ''} - CONVOCATORIA ${cab.convocatoria ?? ''}`,
      cab.formato,
    ]
    for (let i = 0; i < 4; i++) {
      const r = i + 1
      ws.mergeCells(`A${r}:${lastColLetter}${r}`)
      const c = ws.getCell(`A${r}`)
      c.value = tituloLineas[i]
      c.alignment = center
      c.font = { size: i === 3 ? 14 : 16, bold: true }
    }

    // ── Filas 5-8: Bloque de campos (label/value) ────────────────────────────
    // Fila 5
    setLabel('A5:C5', 'NOMBRE DEL CONVENIO:')
    setValue('D5:F5', (cab.empresaRazonSocial ?? '').toUpperCase(), { align: 'left' })
    setLabel('G5:I5', 'NOMBRE DEL DIRECTOR DE PROYECTO:')
    setValue('J5:V5', (cab.director ?? '').toUpperCase(), { align: 'left' })

    // Fila 6
    setLabel('A6:C6', 'NÚMERO DE CONVENIO')
    setValue('D6:F6', (cab.convenioNumero ?? '').toUpperCase(), { align: 'left' })
    setLabel('G6:I6', 'NÚMERO DE HORAS TOTALES AF')
    setValue('J6:K6', Number(cab.totalHoras))
    setLabel('L6:M6', 'FECHA INICIO AF:')
    setValue('N6:O6', cab.fechaInicio ?? '')
    setLabel('P6:Q6', 'FECHA DE CORTE:')
    setValue('R6:S6', cab.fechaCorte)
    setNote('T6:V6', 'Tiempo de entrega a la interventoría: Dentro de los cinco (5) días hábiles')

    // Fila 7
    setLabel('A7:C7', 'NOMBRE DEL PROVEEDOR DE LA FORMACIÓN:')
    setValue('D7:F7', (cab.plataforma ?? '').toUpperCase(), { align: 'left' })
    setLabel('G7:I7', 'TIPO DE EVENTO:')
    setValue('J7:K7', (cab.tipoEvento ?? '').toUpperCase())
    setLabel('L7:M7', 'CANTIDAD DE SESIONES ACCIÓN DE FORMACIÓN')
    setValue('N7:O7', Number(cab.totalSesionesAF))
    setLabel('P7:Q7', 'GRUPO N°:')
    setValue('R7:S7', Number(cab.grupoNumero) || 0)
    setNote('T7:V7', 'siguientes a la finalización de cada grupo por acción de formación.')

    // Fila 8 — el legacy parte A8:C8 para "PROVEEDOR DE LA AF:" y D8 (single) para valor.
    setLabel('A8:C8', Number(cab.modalidadId) === 4 ? 'PROVEEDOR DE LA AF:' : 'PLATAFORMA USADA:')
    const cellD8 = ws.getCell('D8')
    cellD8.value = (cab.plataforma ?? '').toUpperCase()
    cellD8.alignment = left
    cellD8.border = borderAll
    setLabel('E8:F8', Number(cab.modalidadId) === 4 ? 'LINK DE ASISTENCIA:' : 'LINK DE GRABACIÓN:')
    setValue('G8:H8', cab.linkAsistencia ?? '', { align: 'left' })
    setLabel('I8:J8', 'NOMBRE ACCIÓN DE FORMACIÓN:')
    setValue('K8:V8', (cab.afNombre ?? '').toUpperCase(), { align: 'left' })

    // Fila 9 — separador vacío
    ws.mergeCells(`A9:${lastColLetter}9`)

    // ── Fila 10: cabecera de la tabla ────────────────────────────────────────
    headers.forEach((h, i) => {
      const cell = ws.getCell(10, i + 1)
      cell.value = h
      cell.fill = fillLabel()
      cell.font = fontWhiteBold
      cell.alignment = center
      cell.border = borderAll
    })
    ws.getRow(10).height = 38

    // ── Filas 11+: beneficiarios ─────────────────────────────────────────────
    rep.beneficiarios.forEach((b, idx) => {
      const r = 11 + idx
      const row = ws.getRow(r)
      const vals: Array<string | number> = [
        b.nro,
        b.nombreCompleto,
        b.tipoDocSigla ?? '',
        b.identificacion ?? '',
        b.email ?? '',
        b.celular ?? '',
        b.departamento ?? '',
        b.ciudad ?? '',
        b.transferencia ?? '',
        b.perfilTransferencia ?? '',
      ]
      for (const u of ordenUTs) {
        const horas = b.horasPorUT[u.utId] ?? Array(MAX_SESIONES).fill(0)
        for (let i = 0; i < u.numSesiones; i++) vals.push(Number(horas[i]) || 0)
      }
      vals.push(b.totalHoras, `${b.porcentajeAvance}%`, b.certifica ?? '')
      vals.forEach((v, i) => {
        const cell = row.getCell(i + 1)
        cell.value = v
        cell.border = borderAll
        cell.alignment = i === 1 || i === 4 || i === 6 || i === 7 || i === 9
          ? left
          : center
        if (i >= headers.length - 3) cell.font = { bold: true }
      })
    })

    // ── Anchos de columna ────────────────────────────────────────────────────
    ws.getColumn(1).width = 5      // N°
    ws.getColumn(2).width = 32     // Nombres
    ws.getColumn(3).width = 14     // Tipo doc
    ws.getColumn(4).width = 16     // Identificación
    ws.getColumn(5).width = 30     // Correo
    ws.getColumn(6).width = 16     // Celular
    ws.getColumn(7).width = 18     // Depto
    ws.getColumn(8).width = 16     // Municipio
    ws.getColumn(9).width = 16     // Transferencia
    ws.getColumn(10).width = 22    // Perfil
    // Columnas UT × sesión — ancho proporcional a la longitud del nombre
    // (mín 14, máx 32). El header se ajusta con wrapText.
    let col = 11
    for (const u of ordenUTs) {
      const w = Math.max(14, Math.min(32, Math.ceil(u.nombre.length / 2) + 8))
      for (let i = 0; i < u.numSesiones; i++) {
        ws.getColumn(col).width = w
        col++
      }
    }
    ws.getColumn(col).width = 12     // Total
    ws.getColumn(col + 1).width = 12 // % avance
    ws.getColumn(col + 2).width = 12 // Certifica

    // Freeze de las dos primeras columnas + filas de cabecera.
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 10 }]

    const arrayBuffer = await wb.xlsx.writeBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const filename = `ASISTENCIA - ${(cab.afNombre ?? 'AF').replace(/[:*?[\]/\\]/g, '').replace(/\s+/g, '_').slice(0, 35).toUpperCase()}.xlsx`
    return { buffer, filename }
  }
}
