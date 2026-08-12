import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import * as XLSX from 'xlsx'
import { AgregarSesionPresencialDto } from './dto/agregar-sesion-presencial.dto'
import { AgregarSesionVirtualDto } from './dto/agregar-sesion-virtual.dto'
import { PatchSesionPresencialDto } from './dto/patch-sesion-presencial.dto'
import { PatchSesionVirtualDto } from './dto/patch-sesion-virtual.dto'
import { UpsertCronogramaDto } from './dto/upsert-cronograma.dto'

// editable solo si esta sin radicar (PENDIENTE) o devuelta para corregir (MODIFICAR)
function estadoBloqueaEdicion(estadoRadicado: string | null | undefined): boolean {
  const e = (estadoRadicado ?? '').trim().toUpperCase()
  return e !== '' && e !== 'PENDIENTE' && e !== 'MODIFICAR'
}

@Injectable()
export class CronogramaService {
  constructor(private readonly ds: DataSource) {}

  // CONVENIOSESTADO = 1 es "en ejecucion"
  private async assertConvenioEnEjecucion(proyectoId: number): Promise<void> {
    const [row] = await this.ds.query(
      `SELECT NVL(CONVENIOSESTADO, 0) AS "estado"
         FROM CONVENIOS WHERE PROYECTOID = :1
        ORDER BY CONVENIOSID DESC FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )
    if (!row) throw new BadRequestException('Este proyecto no tiene convenio.')
    if (Number(row.estado) !== 1) {
      throw new ForbiddenException(
        'Esta acción no está disponible: el convenio no está en ejecución. El cronograma solo permite consulta.',
      )
    }
  }

  private async assertConvenioActivoPorCronograma(cronogramaId: number): Promise<void> {
    const [row] = await this.ds.query(
      `SELECT PROYECTOID AS "proyectoId" FROM CRONOGRAMA
        WHERE CRONOGRAMAID = :1 FETCH FIRST 1 ROW ONLY`,
      [cronogramaId],
    )
    if (!row) throw new BadRequestException('Cronograma no encontrado.')
    await this.assertConvenioEnEjecucion(Number(row.proyectoId))
  }

  private async assertConvenioActivoPorSesionPresencial(sesionId: number): Promise<void> {
    const [row] = await this.ds.query(
      `SELECT cr.PROYECTOID AS "proyectoId"
         FROM CRONOGRAMAPRESENCIAL cp
         JOIN CRONOGRAMA cr ON cr.CRONOGRAMAID = cp.CRONOGRAMAID
        WHERE cp.CRONOGRAMAPRESENCIALID = :1 FETCH FIRST 1 ROW ONLY`,
      [sesionId],
    )
    if (!row) throw new BadRequestException('Sesión no encontrada.')
    await this.assertConvenioEnEjecucion(Number(row.proyectoId))
  }

  private async assertConvenioActivoPorSesionVirtual(actividadId: number): Promise<void> {
    const [row] = await this.ds.query(
      `SELECT cr.PROYECTOID AS "proyectoId"
         FROM CRONOGRAMAVIRTUAL cv
         JOIN CRONOGRAMA cr ON cr.CRONOGRAMAID = cv.CRONOGRAMAID
        WHERE cv.CRONOGRAMAVIRTUALID = :1 FETCH FIRST 1 ROW ONLY`,
      [actividadId],
    )
    if (!row) throw new BadRequestException('Actividad virtual no encontrada.')
    await this.assertConvenioEnEjecucion(Number(row.proyectoId))
  }

  private async assertConvenioActivoPorRadicado(radicadoId: number): Promise<void> {
    const [row] = await this.ds.query(
      `SELECT cr.PROYECTOID AS "proyectoId"
         FROM CRONOGRAMARADICADO crr
         JOIN CRONOGRAMA cr ON cr.CRONOGRAMAID = crr.CRONOGRAMAID
        WHERE crr.CRONOGRAMARADICADOID = :1 FETCH FIRST 1 ROW ONLY`,
      [radicadoId],
    )
    // si no se resuelve el radicado no bloqueamos, para no romper flujos legacy
    if (row) await this.assertConvenioEnEjecucion(Number(row.proyectoId))
  }

  // ALL_TAB_COLUMNS incluye los sinonimos del schema
  async describeTables() {
    const tables = ['CRONOGRAMA', 'CRONOGRAMAPRESENCIAL', 'CRONOGRAMAVIRTUAL']
    const result: Record<string, { column: string; type: string; nullable: string }[]> = {}
    for (const t of tables) {
      result[t] = await this.ds.query(
        `SELECT COLUMN_NAME AS "column", DATA_TYPE AS "type", NULLABLE AS "nullable"
           FROM ALL_TAB_COLUMNS
          WHERE TABLE_NAME = :1
          ORDER BY COLUMN_ID`,
        [t],
      )
    }
    return result
  }

  async listarAcciones(proyectoId: number) {
    return this.ds.query(
      `SELECT af.ACCIONFORMACIONID                     AS "afId",
              af.ACCIONFORMACIONNUMERO                 AS "numero",
              TRIM(af.ACCIONFORMACIONNOMBRE)           AS "nombre",
              af.MODALIDADFORMACIONID                  AS "modalidadId",
              TRIM(mf.MODALIDADFORMACIONNOMBRE)        AS "modalidad",
              af.TIPOEVENTOID                          AS "tipoEventoId",
              TRIM(te.TIPOEVENTONOMBRE)                AS "tipoEvento",
              af.ACCIONFORMACIONNUMBENEF               AS "numBenef",
              af.ACCIONFORMACIONNUMGRUPOS              AS "numGrupos",
              NVL(af.ACCIONFORMACIONBENEFGRUPO, 0)     AS "benefGrupo",
              NVL(af.ACCIONFORMACIONBENEFVIGRUPO, 0)   AS "benefViGrupo"
         FROM ACCIONFORMACION af
         LEFT JOIN MODALIDADFORMACION mf ON mf.MODALIDADFORMACIONID = af.MODALIDADFORMACIONID
         LEFT JOIN TIPOEVENTO te         ON te.TIPOEVENTOID         = af.TIPOEVENTOID
        WHERE af.PROYECTOID = :1
          AND NVL(af.ACCIONFORMACIONTRANSFERENCIA, 0) = 0
        ORDER BY af.ACCIONFORMACIONNUMERO ASC`,
      [proyectoId],
    )
  }

  async listarGrupos(afId: number) {
    const rows = await this.ds.query(
      `SELECT g.AFGRUPOID       AS "grupoId",
              g.AFGRUPONUMERO   AS "grupoNumero",
              NVL(SUM(c.AFGRUPOCOBERTURABENEF), 0) AS "totalBenef"
         FROM AFGRUPO g
         LEFT JOIN AFGRUPOCOBERTURA c ON c.AFGRUPOID = g.AFGRUPOID
        WHERE g.ACCIONFORMACIONID = :1
        GROUP BY g.AFGRUPOID, g.AFGRUPONUMERO
        ORDER BY g.AFGRUPONUMERO`,
      [afId],
    )
    return rows.map((r: any) => ({ ...r, totalBenef: Number(r.totalBenef) }))
  }

  async listarUnidades(afId: number) {
    return this.ds.query(
      `SELECT ut.UNIDADTEMATICAID                AS "utId",
              ut.UNIDADTEMATICANUMERO            AS "numero",
              TRIM(ut.UNIDADTEMATICANOMBRE)      AS "nombre",
              NVL(ut.UNIDADTEMATICAHORASPP, 0)   AS "horasPP",
              NVL(ut.UNIDADTEMATICAHORASTP, 0)   AS "horasTP",
              NVL(ut.UNIDADTEMATICAHORASPV, 0)   AS "horasPV",
              NVL(ut.UNIDADTEMATICAHORASTV, 0)   AS "horasTV",
              NVL(ut.UNIDADTEMATICAHORASPPAT, 0) AS "horasPPAT",
              NVL(ut.UNIDADTEMATICAHORASTPAT, 0) AS "horasTPAT",
              NVL(ut.UNIDADTEMATICAHORASPHIB, 0) AS "horasPHib",
              NVL(ut.UNIDADTEMATICAHORASTHIB, 0) AS "horasTHib",
              NVL(ut.UNIDADTEMATICANACTIVIDAD,0) AS "nActividad"
         FROM UNIDADTEMATICA ut
        WHERE ut.ACCIONFORMACIONID = :1
        ORDER BY ut.UNIDADTEMATICANUMERO ASC`,
      [afId],
    )
  }

  async buscarCronograma(grupoId: number, utId: number) {
    return this.ds.query(
      `SELECT c.CRONOGRAMAID          AS "cronogramaId",
              c.AFGRUPOID             AS "grupoId",
              c.UNIDADTEMATICAID      AS "utId",
              c.CRONOGRAMAFECHAINICIO AS "fechaInicio",
              c.CRONOGRAMAFECHAFIN    AS "fechaFin",
              c.CRONONUMSESIONES      AS "numSesiones",
              c.CRONONUMTOTALACT      AS "numActividades",
              c.CRONOESTADO           AS "estado",
              c.CRONOPROYECTO         AS "proyectoId"
         FROM CRONOGRAMA c
        WHERE c.AFGRUPOID = :1
          AND c.UNIDADTEMATICAID = :2
        ORDER BY c.CRONOGRAMAID ASC`,
      [grupoId, utId],
    )
  }

  // modalidad 'P' trae ciudad; 'S'/'V' solo departamento, y el front filtra por eso
  async coberturasDeGrupo(cronogramaId: number) {
    return this.ds.query(
      `SELECT cob.AFGRUPOCOBERTURAID         AS "coberturaId",
              cob.DEPARTAMENTOGRUPOID        AS "departamentoId",
              TRIM(dep.DEPARTAMENTONOMBRE)   AS "departamentoNombre",
              cob.CIUDADGRUPOID              AS "ciudadId",
              TRIM(ciu.CIUDADNOMBRE)         AS "ciudadNombre",
              cob.AFGRUPOCOBERTURABENEF      AS "beneficiarios",
              NVL(cob.AFGRUPOCOBERTURAMOD, 'P') AS "modalidad"
         FROM CRONOGRAMA c
         JOIN AFGRUPOCOBERTURA cob ON cob.AFGRUPOID = c.AFGRUPOID
         LEFT JOIN DEPARTAMENTO dep ON dep.DEPARTAMENTOID = cob.DEPARTAMENTOGRUPOID
         LEFT JOIN CIUDAD ciu       ON ciu.CIUDADID      = cob.CIUDADGRUPOID
        WHERE c.CRONOGRAMAID = :1
        ORDER BY cob.AFGRUPOCOBERTURAID`,
      [cronogramaId],
    )
  }

  // la columna quedo como CRONOGRAMAPRESENCIALFECHAINICI: Oracle 11g corta a 30 chars
  async sesionesPresenciales(cronogramaId: number) {
    const rows: any[] = await this.ds.query(
      `SELECT cp.CRONOGRAMAPRESENCIALID           AS "sesionId",
              cp.CRONOGRAMAPRESENCIALNUMSESION    AS "numSesion",
              TRIM(cp.CRONOGRAMAPRESENCIALNOMBRESESI) AS "nombreSesion",
              cp.CRONOGRAMAPRESENCIALFECHAINICI   AS "fechaInicio",
              cp.CRONOGRAMAPRESENCIALNUMHORAS     AS "horas",
              TO_CHAR(cp.CRONOGRAMAPRESENCIALHORAINICIO - INTERVAL '5' HOUR, 'HH24:MI') AS "horaInicio",
              TO_CHAR(cp.CRONOGRAMAPRESENCIALHORAFIN - INTERVAL '5' HOUR, 'HH24:MI')    AS "horaFin",
              TRIM(cp.CRONOGRAMAPRESENCIALNOMBRESEDE) AS "nombreSede",
              TRIM(cp.CRONOGRAMAPRESENCIALAULA)       AS "aula",
              TRIM(cp.CRONOGRAMAPRESENCIALDIRECCION)  AS "direccion",
              TRIM(cp.CRONOGRAMAPRESENCIALSIGLA)      AS "sigla",
              TRIM(cp.CRONOGRAMAHERRAMIENTA)          AS "herramienta",
              TRIM(cp.CRONOGRAMAURL)                  AS "url",
              TRIM(cp.CRONOGRAMAESTADO)               AS "estado",
              TRIM(cp.CRONOGRAMAESTADORADICADO)       AS "estadoRadicado",
              cp.CRONOGRAMAPRESENCIALCAPAID           AS "capacitadorId",
              cp.CRONOGRAMAPREPERFILUTID              AS "perfilUTId",
              cp.CRONOGRAMAPRESENCIALCAPASUPUNO       AS "capSup1Id",
              cp.CRONOGRAMAPRESENCIALCAPASUPDOS       AS "capSup2Id",
              cp.CRONOGRAMAPRESENCIALCAPASUPTRE       AS "capSup3Id",
              cp.CRONOGRAMAPRESENCIALCAPASUPCUA       AS "capSup4Id",
              cp.CRONOGRAMAPRESENCIALPERFILUTUN       AS "perfilSup1Id",
              cp.CRONOGRAMAPRESENCIALPERFILUTDO       AS "perfilSup2Id",
              cp.CRONOGRAMAPRESENCIALPERFILUTTR       AS "perfilSup3Id",
              cp.CRONOGRAMAPRESENCIALPERFILUTCU       AS "perfilSup4Id",
              TRIM(cap.CAPATIPO)                      AS "capacitadorTipo",
              TRIM(pcap.PERSONANOMBRES)               AS "capPersonaNom",
              TRIM(pcap.PERSONAPRIMERAPELLIDO)        AS "capPersonaApe1",
              TRIM(pcap.PERSONASEGUNDOAPELLIDO)       AS "capPersonaApe2",
              TRIM(ecap.EMPRESARAZONSOCIAL)           AS "capEmpresaNom",
              cp.AFGRUPOCOBERTURAID                   AS "coberturaId",
              TRIM(dep.DEPARTAMENTONOMBRE)            AS "departamentoNombre",
              TRIM(ciu.CIUDADNOMBRE)                  AS "ciudadNombre"
         FROM CRONOGRAMAPRESENCIAL cp
         LEFT JOIN CAPACITADORES cap ON cap.CAPACITADORID = cp.CRONOGRAMAPRESENCIALCAPAID
         LEFT JOIN PERSONA pcap ON pcap.PERSONAID = cap.CAPACITADORPERSONAID
         LEFT JOIN EMPRESA ecap ON ecap.EMPRESAID = cap.CAPACITADOREMPRESAID
         LEFT JOIN AFGRUPOCOBERTURA cob ON cob.AFGRUPOCOBERTURAID = cp.AFGRUPOCOBERTURAID
         LEFT JOIN DEPARTAMENTO dep ON dep.DEPARTAMENTOID = cob.DEPARTAMENTOGRUPOID
         LEFT JOIN CIUDAD ciu ON ciu.CIUDADID = cob.CIUDADGRUPOID
        WHERE cp.CRONOGRAMAID = :1
        ORDER BY cp.CRONOGRAMAPRESENCIALID ASC`,
      [cronogramaId],
    )
    return rows.map(r => ({ ...r, capacitadorNombre: armarNombreCap(r) }))
  }

  async sesionesVirtuales(cronogramaId: number) {
    const rows: any[] = await this.ds.query(
      `SELECT cv.CRONOGRAMAVIRTUALID                AS "actividadId",
              cv.CRONOGRAMAVIRTUALNUMSESION         AS "numSesion",
              TRIM(cv.CRONOGRAMAVIRTUALNOMBRE)      AS "nombreActividad",
              cv.CRONOGRAMAVIRTUALFECHAINICIO       AS "fechaInicio",
              cv.CRONOGRAMAVIRTUALFECHAFINAL        AS "fechaFin",
              cv.CRONOGRAMAVIRTUALNUMHORAS          AS "horas",
              TRIM(cv.CRONOGRAMAVIRTUALPROVEEDOR)   AS "plataforma",
              TRIM(cv.CRONOGRAMAVIRTUALURL)         AS "url",
              TRIM(cv.CRONOGRAMAVIRTUALUSUARIOSENA) AS "usuarioSena",
              TRIM(cv.CRONOGRAMAVIRTUALCLAVESENA)   AS "claveSena",
              TRIM(cv.CRONOGRAMAVIRTUALSIGLA)       AS "sigla",
              TRIM(cv.CRONOGRAMAVIRESTADO)          AS "estado",
              TRIM(cv.CRONOGRAMAVIRESTADORADICADO)  AS "estadoRadicado",
              cv.CRONOGRAMAVIRCAPACITADORVIRTUA     AS "capacitadorId",
              cv.CRONOGRAMAVIRPERFILUTID            AS "perfilUTId",
              cv.CRONOGRAMAVIRCAPACITADORLSUPUN     AS "capSup1Id",
              cv.CRONOGRAMAVIRCAPACITADORSUPDOS     AS "capSup2Id",
              cv.CRONOGRAMAVIRCAPACITADORSUPTRE     AS "capSup3Id",
              cv.CRONOGRAMAVIRCAPACITADORSUPCUA     AS "capSup4Id",
              cv.CRONOGRAMAVIRTUALPERFILUTSUPUN     AS "perfilSup1Id",
              cv.CRONOGRAMAVIRTUALPERFILUTSUPDO     AS "perfilSup2Id",
              cv.CRONOGRAMAVIRTUALPERFILUTSUPTR     AS "perfilSup3Id",
              cv.CRONOGRAMAVIRTUALPERFILUTSUPCU     AS "perfilSup4Id",
              TRIM(cap.CAPATIPO)                    AS "capacitadorTipo",
              TRIM(pcap.PERSONANOMBRES)             AS "capPersonaNom",
              TRIM(pcap.PERSONAPRIMERAPELLIDO)      AS "capPersonaApe1",
              TRIM(pcap.PERSONASEGUNDOAPELLIDO)     AS "capPersonaApe2",
              TRIM(ecap.EMPRESARAZONSOCIAL)         AS "capEmpresaNom"
         FROM CRONOGRAMAVIRTUAL cv
         LEFT JOIN CAPACITADORES cap ON cap.CAPACITADORID = cv.CRONOGRAMAVIRCAPACITADORVIRTUA
         LEFT JOIN PERSONA pcap ON pcap.PERSONAID = cap.CAPACITADORPERSONAID
         LEFT JOIN EMPRESA ecap ON ecap.EMPRESAID = cap.CAPACITADOREMPRESAID
        WHERE cv.CRONOGRAMAID = :1
        ORDER BY cv.CRONOGRAMAVIRTUALID ASC`,
      [cronogramaId],
    )
    return rows.map(r => ({ ...r, capacitadorNombre: armarNombreCap(r) }))
  }

  // el ID sale de MAX+1 dentro de la transaccion: la tabla no tiene secuencia
  async upsertCronograma(proyectoId: number, dto: UpsertCronogramaDto) {
    await this.assertConvenioEnEjecucion(proyectoId)
    const fi = new Date(dto.fechaInicio)
    const ff = new Date(dto.fechaFin)
    if (Number.isNaN(fi.getTime()) || Number.isNaN(ff.getTime())) {
      throw new BadRequestException('Fechas inválidas.')
    }
    if (ff < fi) {
      throw new BadRequestException('La fecha de fin no puede ser menor a la fecha de inicio.')
    }

    const qr = this.ds.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      const exist: { id: number }[] = await qr.query(
        `SELECT CRONOGRAMAID AS "id"
           FROM CRONOGRAMA
          WHERE AFGRUPOID = :1 AND UNIDADTEMATICAID = :2`,
        [dto.grupoId, dto.utId],
      )

      let cronogramaId: number
      let action: 'created' | 'updated'

      if (exist.length > 0) {
        cronogramaId = Number(exist[0].id)
        action = 'updated'
        await qr.query(
          `UPDATE CRONOGRAMA
              SET CRONOGRAMAFECHAINICIO = :1,
                  CRONOGRAMAFECHAFIN    = :2
            WHERE CRONOGRAMAID = :3`,
          [fi, ff, cronogramaId],
        )
      } else {
        const next: { id: number }[] = await qr.query(
          `SELECT NVL(MAX(CRONOGRAMAID), 0) + 1 AS "id" FROM CRONOGRAMA`,
        )
        cronogramaId = Number(next[0].id)
        action = 'created'
        await qr.query(
          `INSERT INTO CRONOGRAMA
             (CRONOGRAMAID, AFGRUPOID, UNIDADTEMATICAID,
              CRONOGRAMAFECHAINICIO, CRONOGRAMAFECHAFIN,
              CRONONUMSESIONES, CRONONUMTOTALACT,
              CRONOPROYECTO, CRONOESTADO, CRONOFECHAREGISTRO)
           VALUES (:1, :2, :3, :4, :5, 0, 0, :6, 'ACTIVO', SYSDATE)`,
          [cronogramaId, dto.grupoId, dto.utId, fi, ff, proyectoId],
        )
      }

      await qr.commitTransaction()
      return { cronogramaId, action }
    } catch (e) {
      await qr.rollbackTransaction()
      throw e
    } finally {
      await qr.release()
    }
  }

  async listarCapacitadoresAprobados(proyectoId: number) {
    return this.ds.query(
      `SELECT c.CAPACITADORID                AS "capacitadorId",
              TRIM(c.CAPATIPO)               AS "tipo",
              c.CAPACITADORPERSONAID         AS "personaId",
              c.CAPACITADOREMPRESAID         AS "empresaId",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) || ' ' ||
                NVL(TRIM(p.PERSONASEGUNDOAPELLIDO), '')  AS "nombrePersona",
              TRIM(p.PERSONAIDENTIFICACION)  AS "identificacionPersona",
              TRIM(e.EMPRESARAZONSOCIAL)     AS "razonSocial",
              TRIM(e.EMPRESAIDENTIFICACION)  AS "identificacionEmpresa"
         FROM CAPACITADORES c
         LEFT JOIN PERSONA p ON p.PERSONAID = c.CAPACITADORPERSONAID
         LEFT JOIN EMPRESA e ON e.EMPRESAID = c.CAPACITADOREMPRESAID
        WHERE c.PROYECTOID = :1
          AND TRIM(c.CAPAESTADO) = 'ACTIVO'
          AND (TRIM(c.CAPAINTERESTADO) = 'APROBADO'
               OR TRIM(c.CAPACITADORESTADOTRANSFERENCIA) = 'APROBADOT')
        ORDER BY c.CAPACITADORID ASC`,
      [proyectoId],
    )
  }

  async listarPerfilesUT(utId: number) {
    return this.ds.query(
      `SELECT pu.PERFILUTID            AS "perfilUTId",
              pu.RUBROIDUT             AS "rubroId",
              TRIM(r.RUBRONOMBRE)      AS "nombre",
              NVL(pu.PERFILUTHORASCAP, 0) AS "horasCap"
         FROM PERFILUT pu
         JOIN RUBRO r ON r.RUBROID = pu.RUBROIDUT
        WHERE pu.UNIDADTEMATICAID = :1
        ORDER BY pu.PERFILUTID ASC`,
      [utId],
    )
  }

  async agregarSesionPresencial(cronogramaId: number, dto: AgregarSesionPresencialDto) {
    await this.assertConvenioActivoPorCronograma(cronogramaId)
    const [hi, mi] = dto.horaInicio.split(':').map(Number)
    const [hf, mf] = dto.horaFin.split(':').map(Number)
    const minIni = hi * 60 + mi
    const minFin = hf * 60 + mf
    if (minFin <= minIni) {
      throw new BadRequestException('La hora fin debe ser posterior a la hora inicio.')
    }
    const numHoras = (minFin - minIni) / 60
    if (numHoras > 8) {
      throw new BadRequestException('Una sesión no puede superar 8 horas en un día.')
    }

    const qr = this.ds.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      const cronoRows: any[] = await qr.query(
        `SELECT c.CRONOGRAMAID                  AS "cronogramaId",
                c.AFGRUPOID                     AS "grupoId",
                c.UNIDADTEMATICAID              AS "utId",
                c.CRONOGRAMAFECHAINICIO         AS "fechaInicio",
                c.CRONOGRAMAFECHAFIN            AS "fechaFin",
                c.CRONOPROYECTO                 AS "proyectoId",
                NVL(ut.UNIDADTEMATICAHORASPP, 0)   AS "horasPP",
                NVL(ut.UNIDADTEMATICAHORASTP, 0)   AS "horasTP",
                NVL(ut.UNIDADTEMATICAHORASPPAT, 0) AS "horasPPAT",
                NVL(ut.UNIDADTEMATICAHORASTPAT, 0) AS "horasTPAT",
                NVL(ut.UNIDADTEMATICAHORASPHIB, 0) AS "horasPHib",
                NVL(ut.UNIDADTEMATICAHORASTHIB, 0) AS "horasTHib"
           FROM CRONOGRAMA c
           JOIN UNIDADTEMATICA ut ON ut.UNIDADTEMATICAID = c.UNIDADTEMATICAID
          WHERE c.CRONOGRAMAID = :1`,
        [cronogramaId],
      )
      if (!cronoRows.length) throw new NotFoundException('Cronograma no encontrado.')
      const crono = cronoRows[0]

      // modalidades: 1 presencial, 2 PAT, 3 hibrida, 4 virtual
      let totalUT = 0
      if (dto.modalidadId === 1) totalUT = Number(crono.horasPP) + Number(crono.horasTP)
      else if (dto.modalidadId === 2) totalUT = Number(crono.horasPPAT) + Number(crono.horasTPAT)
      else if (dto.modalidadId === 3) totalUT = Number(crono.horasPHib) + Number(crono.horasTHib)

      const fSesionStr = dto.fechaInicio.slice(0, 10)
      const fIniStr = new Date(crono.fechaInicio).toISOString().slice(0, 10)
      const fFinStr = new Date(crono.fechaFin).toISOString().slice(0, 10)
      if (fSesionStr < fIniStr) {
        throw new BadRequestException(`La fecha es anterior al cronograma (${fIniStr}).`)
      }
      if (fSesionStr > fFinStr) {
        throw new BadRequestException(`La fecha es posterior al cronograma (${fFinStr}).`)
      }

      const capCheck: any[] = await qr.query(
        `SELECT 1 AS "ok" FROM CAPACITADORES
          WHERE CAPACITADORID = :1 AND PROYECTOID = :2
            AND TRIM(CAPAESTADO) = 'ACTIVO'
            AND (TRIM(CAPAINTERESTADO) = 'APROBADO'
                 OR TRIM(CAPACITADORESTADOTRANSFERENCIA) = 'APROBADOT')`,
        [dto.capacitadorId, crono.proyectoId],
      )
      if (!capCheck.length) {
        throw new BadRequestException('El capacitador no pertenece al proyecto o no está aprobado.')
      }

      const perfilCheck: any[] = await qr.query(
        `SELECT 1 AS "ok" FROM PERFILUT WHERE PERFILUTID = :1 AND UNIDADTEMATICAID = :2`,
        [dto.perfilUTId, crono.utId],
      )
      if (!perfilCheck.length) {
        throw new BadRequestException('El perfil de capacitador no es válido para esta unidad temática.')
      }

      const acumRows: any[] = await qr.query(
        `SELECT NVL(SUM(CRONOGRAMAPRESENCIALNUMHORAS), 0) AS "horas"
           FROM CRONOGRAMAPRESENCIAL WHERE CRONOGRAMAID = :1`,
        [cronogramaId],
      )
      const horasReg = Number(acumRows[0].horas)
      if (totalUT > 0 && horasReg + numHoras > totalUT) {
        throw new BadRequestException(
          `El total de horas (${horasReg + numHoras}) supera lo registrado en la UT (${totalUT}).`,
        )
      }

      const convRows: any[] = await qr.query(
        `SELECT CONVENIOSID AS "convId", NVL(CONVENIOSCRONOCONSECUTIVO, 0) AS "consec"
           FROM CONVENIOS
          WHERE PROYECTOID = :1 AND CONVENIOSESTADO = 1
            AND ROWNUM = 1`,
        [crono.proyectoId],
      )
      if (!convRows.length) {
        throw new BadRequestException('Este proyecto no tiene un convenio activo.')
      }
      const convId = Number(convRows[0].convId)
      const consecutivo = Number(convRows[0].consec) + 1
      const sigla = `CP${String(consecutivo).padStart(6, '0')}`

      const nsRows: any[] = await qr.query(
        `SELECT NVL(MAX(CRONOGRAMAPRESENCIALNUMSESION), 0) + 1 AS "next"
           FROM CRONOGRAMAPRESENCIAL WHERE CRONOGRAMAID = :1`,
        [cronogramaId],
      )
      const numSesion = Number(nsRows[0].next)

      const idRows: any[] = await qr.query(
        `SELECT NVL(MAX(CRONOGRAMAPRESENCIALID), 0) + 1 AS "id" FROM CRONOGRAMAPRESENCIAL`,
      )
      const newId = Number(idRows[0].id)

      const covRows: any[] = await qr.query(
        `SELECT AFGRUPOCOBERTURAID AS "id" FROM AFGRUPOCOBERTURA WHERE AFGRUPOID = :1 ORDER BY AFGRUPOCOBERTURAID`,
        [crono.grupoId],
      )
      const covIds: number[] = covRows.map((r: any) => Number(r.id))
      const coberturaId = (dto.coberturaId && covIds.includes(dto.coberturaId))
        ? dto.coberturaId
        : (covIds[0] ?? 0)

      // Oracle guarda la hora sobre la fecha base 1899-12-31
      const fechaSesion = new Date(`${fSesionStr}T05:00:00.000Z`) // Colombia UTC-5
      const horaInicioDate = new Date(`1899-12-31T${dto.horaInicio}:00.000-05:00`)
      const horaFinDate = new Date(`1899-12-31T${dto.horaFin}:00.000-05:00`)

      // en PAT (modalidad 2) el capacitador no aplica
      const tipoCapacitador = dto.modalidadId === 2 ? 'NO APLICA' : 'CAPACITADOR NACIONAL'

      await qr.query(
        `INSERT INTO CRONOGRAMAPRESENCIAL
           (CRONOGRAMAPRESENCIALID, CRONOGRAMAID, AFGRUPOCOBERTURAID,
            CRONOGRAMAPRESENCIALNOMBRESESI, CRONOGRAMAPRESENCIALNUMSESION,
            CRONOGRAMAPRESENCIALFECHAINICI, CRONOGRAMAPRESENCIALHORAINICIO,
            CRONOGRAMAPRESENCIALHORAFIN,    CRONOGRAMAPRESENCIALNUMHORAS,
            CRONOGRAMAPRESENCIALNOMBRESEDE, CRONOGRAMAPRESENCIALDIRECCION,
            CRONOGRAMAPRESENCIALAULA,       CRONOGRAMAPRESENCIALSIGLA,
            CRONOGRAMAHERRAMIENTA, CRONOGRAMAURL,
            CRONOGRAMAESTADO, CRONOGRAMAESTADORADICADO, TIPOCAPACIADORPRE,
            CRONOGRAMAPRESENCIALCAPAID, CRONOGRAMAPREPERFILUTID,
            CRONOGRAMAPRESENCIALCAPASUPDOS, CRONOGRAMAPRESENCIALCAPASUPUNO,
            CRONOGRAMAPRESENCIALCAPASUPTRE, CRONOGRAMAPRESENCIALCAPASUPCUA,
            CRONOGRAMAPRESENCIALPERFILUTUN, CRONOGRAMAPRESENCIALPERFILUTDO,
            CRONOGRAMAPRESENCIALPERFILUTTR, CRONOGRAMAPRESENCIALPERFILUTCU,
            CRONOGRAMAPRESENCIALRADICADOID, CRONOGRAMAPRESENCIALRADICADOTR)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14, :15,
                 'ACTIVO', 'PENDIENTE', :16, :17, :18,
                 :19, :20, :21, :22, :23, :24, :25, :26, 0, 0)`,
        [
          newId, cronogramaId, coberturaId,
          dto.nombreSesion, numSesion,
          fechaSesion, horaInicioDate, horaFinDate, numHoras,
          dto.nombreSede ?? null, dto.direccion ?? null, dto.aula ?? null, sigla,
          dto.herramienta ?? null, dto.url ?? null,
          tipoCapacitador, dto.capacitadorId, dto.perfilUTId,
          dto.capSup2Id ?? 0, dto.capSup1Id ?? 0,
          dto.capSup3Id ?? 0, dto.capSup4Id ?? 0,
          dto.perfilSup1Id ?? 0, dto.perfilSup2Id ?? 0,
          dto.perfilSup3Id ?? 0, dto.perfilSup4Id ?? 0,
        ],
      )

      await qr.query(
        `UPDATE CRONOGRAMA SET CRONONUMSESIONES = NVL(CRONONUMSESIONES, 0) + 1
          WHERE CRONOGRAMAID = :1`,
        [cronogramaId],
      )
      await qr.query(
        `UPDATE CONVENIOS SET CONVENIOSCRONOCONSECUTIVO = :1 WHERE CONVENIOSID = :2`,
        [consecutivo, convId],
      )

      await qr.commitTransaction()
      return { sesionId: newId, sigla, numSesion, numHoras }
    } catch (e) {
      await qr.rollbackTransaction()
      throw e
    } finally {
      await qr.release()
    }
  }

  async eliminarSesionPresencial(sesionId: number) {
    await this.assertConvenioActivoPorSesionPresencial(sesionId)
    const qr = this.ds.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      const rows: any[] = await qr.query(
        `SELECT CRONOGRAMAID AS "cronogramaId",
                TRIM(CRONOGRAMAESTADORADICADO) AS "estadoRadicado"
           FROM CRONOGRAMAPRESENCIAL
          WHERE CRONOGRAMAPRESENCIALID = :1`,
        [sesionId],
      )
      if (!rows.length) throw new NotFoundException('Sesión no encontrada.')
      if (estadoBloqueaEdicion(rows[0].estadoRadicado)) {
        throw new BadRequestException('Esta sesión ya fue radicada; no se puede eliminar (espera a que interventoría la devuelva para corrección).')
      }
      const cronogramaId = Number(rows[0].cronogramaId)

      await qr.query(
        `DELETE FROM CRONOGRAMAPRESENCIAL WHERE CRONOGRAMAPRESENCIALID = :1`, [sesionId],
      )
      await qr.query(
        `UPDATE CRONOGRAMA
            SET CRONONUMSESIONES = GREATEST(NVL(CRONONUMSESIONES, 0) - 1, 0)
          WHERE CRONOGRAMAID = :1`,
        [cronogramaId],
      )

      await qr.commitTransaction()
      return { ok: true }
    } catch (e) {
      await qr.rollbackTransaction()
      throw e
    } finally {
      await qr.release()
    }
  }

  async actualizarSesionPresencial(sesionId: number, dto: AgregarSesionPresencialDto) {
    await this.assertConvenioActivoPorSesionPresencial(sesionId)
    const [hi, mi] = dto.horaInicio.split(':').map(Number)
    const [hf, mf] = dto.horaFin.split(':').map(Number)
    const minIni = hi * 60 + mi
    const minFin = hf * 60 + mf
    if (minFin <= minIni) throw new BadRequestException('La hora fin debe ser posterior a la hora inicio.')
    const numHoras = (minFin - minIni) / 60
    if (numHoras > 8) throw new BadRequestException('Una sesión no puede superar 8 horas en un día.')

    const qr = this.ds.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      const sesRows: any[] = await qr.query(
        `SELECT cp.CRONOGRAMAID                  AS "cronogramaId",
                cp.CRONOGRAMAPRESENCIALNUMHORAS  AS "horasActuales",
                TRIM(cp.CRONOGRAMAESTADORADICADO) AS "estadoRadicado",
                c.AFGRUPOID                      AS "grupoId",
                c.UNIDADTEMATICAID               AS "utId",
                c.CRONOGRAMAFECHAINICIO          AS "fechaInicio",
                c.CRONOGRAMAFECHAFIN             AS "fechaFin",
                c.CRONOPROYECTO                  AS "proyectoId",
                NVL(ut.UNIDADTEMATICAHORASPP, 0)   AS "horasPP",
                NVL(ut.UNIDADTEMATICAHORASTP, 0)   AS "horasTP",
                NVL(ut.UNIDADTEMATICAHORASPPAT, 0) AS "horasPPAT",
                NVL(ut.UNIDADTEMATICAHORASTPAT, 0) AS "horasTPAT",
                NVL(ut.UNIDADTEMATICAHORASPHIB, 0) AS "horasPHib",
                NVL(ut.UNIDADTEMATICAHORASTHIB, 0) AS "horasTHib"
           FROM CRONOGRAMAPRESENCIAL cp
           JOIN CRONOGRAMA c ON c.CRONOGRAMAID = cp.CRONOGRAMAID
           JOIN UNIDADTEMATICA ut ON ut.UNIDADTEMATICAID = c.UNIDADTEMATICAID
          WHERE cp.CRONOGRAMAPRESENCIALID = :1`,
        [sesionId],
      )
      if (!sesRows.length) throw new NotFoundException('Sesión no encontrada.')
      const ses = sesRows[0]

      if (estadoBloqueaEdicion(ses.estadoRadicado)) {
        throw new BadRequestException('Esta sesión ya fue radicada; no se puede editar (espera a que interventoría la devuelva para corrección).')
      }

      let totalUT = 0
      if (dto.modalidadId === 1) totalUT = Number(ses.horasPP) + Number(ses.horasTP)
      else if (dto.modalidadId === 2) totalUT = Number(ses.horasPPAT) + Number(ses.horasTPAT)
      else if (dto.modalidadId === 3) totalUT = Number(ses.horasPHib) + Number(ses.horasTHib)

      const fSesionStr = dto.fechaInicio.slice(0, 10)
      const fIniStr = new Date(ses.fechaInicio).toISOString().slice(0, 10)
      const fFinStr = new Date(ses.fechaFin).toISOString().slice(0, 10)
      if (fSesionStr < fIniStr) throw new BadRequestException(`La fecha es anterior al cronograma (${fIniStr}).`)
      if (fSesionStr > fFinStr) throw new BadRequestException(`La fecha es posterior al cronograma (${fFinStr}).`)

      const capCheck: any[] = await qr.query(
        `SELECT 1 AS "ok" FROM CAPACITADORES
          WHERE CAPACITADORID = :1 AND PROYECTOID = :2
            AND TRIM(CAPAESTADO) = 'ACTIVO'
            AND (TRIM(CAPAINTERESTADO) = 'APROBADO'
                 OR TRIM(CAPACITADORESTADOTRANSFERENCIA) = 'APROBADOT')`,
        [dto.capacitadorId, ses.proyectoId],
      )
      if (!capCheck.length) throw new BadRequestException('El capacitador no pertenece al proyecto o no está aprobado.')

      const perfilCheck: any[] = await qr.query(
        `SELECT 1 AS "ok" FROM PERFILUT WHERE PERFILUTID = :1 AND UNIDADTEMATICAID = :2`,
        [dto.perfilUTId, ses.utId],
      )
      if (!perfilCheck.length) throw new BadRequestException('El perfil no es válido para esta unidad temática.')

      const acumRows: any[] = await qr.query(
        `SELECT NVL(SUM(CRONOGRAMAPRESENCIALNUMHORAS), 0) AS "horas"
           FROM CRONOGRAMAPRESENCIAL WHERE CRONOGRAMAID = :1`,
        [ses.cronogramaId],
      )
      const horasReg = Number(acumRows[0].horas) - Number(ses.horasActuales)
      if (totalUT > 0 && horasReg + numHoras > totalUT) {
        throw new BadRequestException(
          `El total de horas (${horasReg + numHoras}) supera lo registrado en la UT (${totalUT}).`,
        )
      }

      const fechaSesion = new Date(`${fSesionStr}T05:00:00.000Z`)
      const horaInicioDate = new Date(`1899-12-31T${dto.horaInicio}:00.000-05:00`)
      const horaFinDate = new Date(`1899-12-31T${dto.horaFin}:00.000-05:00`)
      const tipoCapacitador = dto.modalidadId === 2 ? 'NO APLICA' : 'CAPACITADOR NACIONAL'

      await qr.query(
        `UPDATE CRONOGRAMAPRESENCIAL
            SET CRONOGRAMAPRESENCIALNOMBRESESI = :1,
                CRONOGRAMAPRESENCIALFECHAINICI = :2,
                CRONOGRAMAPRESENCIALHORAINICIO = :3,
                CRONOGRAMAPRESENCIALHORAFIN    = :4,
                CRONOGRAMAPRESENCIALNUMHORAS   = :5,
                CRONOGRAMAPRESENCIALNOMBRESEDE = :6,
                CRONOGRAMAPRESENCIALDIRECCION  = :7,
                CRONOGRAMAPRESENCIALAULA       = :8,
                CRONOGRAMAHERRAMIENTA          = :9,
                CRONOGRAMAURL                  = :10,
                TIPOCAPACIADORPRE              = :11,
                CRONOGRAMAPRESENCIALCAPAID     = :12,
                CRONOGRAMAPREPERFILUTID        = :13,
                CRONOGRAMAPRESENCIALCAPASUPUNO = :14,
                CRONOGRAMAPRESENCIALCAPASUPDOS = :15,
                CRONOGRAMAPRESENCIALCAPASUPTRE = :16,
                CRONOGRAMAPRESENCIALCAPASUPCUA = :17,
                CRONOGRAMAPRESENCIALPERFILUTUN = :18,
                CRONOGRAMAPRESENCIALPERFILUTDO = :19,
                CRONOGRAMAPRESENCIALPERFILUTTR = :20,
                CRONOGRAMAPRESENCIALPERFILUTCU = :21,
                AFGRUPOCOBERTURAID             = NVL(:22, AFGRUPOCOBERTURAID)
          WHERE CRONOGRAMAPRESENCIALID = :23`,
        [
          dto.nombreSesion, fechaSesion, horaInicioDate, horaFinDate, numHoras,
          dto.nombreSede ?? null, dto.direccion ?? null, dto.aula ?? null,
          dto.herramienta ?? null, dto.url ?? null,
          tipoCapacitador, dto.capacitadorId, dto.perfilUTId,
          dto.capSup1Id ?? 0, dto.capSup2Id ?? 0, dto.capSup3Id ?? 0, dto.capSup4Id ?? 0,
          dto.perfilSup1Id ?? 0, dto.perfilSup2Id ?? 0, dto.perfilSup3Id ?? 0, dto.perfilSup4Id ?? 0,
          dto.coberturaId ?? null,
          sesionId,
        ],
      )

      await qr.commitTransaction()
      return { sesionId, numHoras, action: 'updated' as const }
    } catch (e) {
      await qr.rollbackTransaction()
      throw e
    } finally {
      await qr.release()
    }
  }

  async exportarCronogramaProyecto(proyectoId: number): Promise<{ buffer: Buffer; filename: string }> {
    const headers: any[] = await this.ds.query(
      `SELECT c.CRONOGRAMAID                   AS "cronogramaId",
              TRIM(conv.CONVENIOSNUMERO)       AS "convenio",
              TRIM(emp.EMPRESARAZONSOCIAL)     AS "empresaNombre",
              af.ACCIONFORMACIONNUMERO         AS "afNum",
              TRIM(af.ACCIONFORMACIONNOMBRE)   AS "af",
              TRIM(mf.MODALIDADFORMACIONNOMBRE) AS "modalidad",
              TRIM(te.TIPOEVENTONOMBRE)        AS "evento",
              g.AFGRUPONUMERO                  AS "grupoNum",
              NVL(af.ACCIONFORMACIONBENEFGRUPO, 0)   AS "benefGrupo",
              ut.UNIDADTEMATICANUMERO          AS "utNum",
              TRIM(ut.UNIDADTEMATICANOMBRE)    AS "utNombre",
              c.CRONOGRAMAFECHAINICIO          AS "cronoIni",
              c.CRONOGRAMAFECHAFIN             AS "cronoFin",
              NVL(c.CRONONUMSESIONES, 0)       AS "numSesiones",
              NVL(c.CRONONUMTOTALACT, 0)       AS "numActividades"
         FROM CRONOGRAMA c
         JOIN AFGRUPO g          ON g.AFGRUPOID = c.AFGRUPOID
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
         JOIN UNIDADTEMATICA ut  ON ut.UNIDADTEMATICAID = c.UNIDADTEMATICAID
         LEFT JOIN MODALIDADFORMACION mf ON mf.MODALIDADFORMACIONID = af.MODALIDADFORMACIONID
         LEFT JOIN TIPOEVENTO te         ON te.TIPOEVENTOID         = af.TIPOEVENTOID
         LEFT JOIN CONVENIOS conv ON conv.PROYECTOID = c.CRONOPROYECTO AND conv.CONVENIOSESTADO = 1
         LEFT JOIN PROYECTO pr  ON pr.PROYECTOID = c.CRONOPROYECTO
         LEFT JOIN EMPRESA emp  ON emp.EMPRESAID = pr.EMPRESAID
        WHERE c.CRONOPROYECTO = :1
          AND NVL(af.ACCIONFORMACIONTRANSFERENCIA, 0) = 0
        ORDER BY af.ACCIONFORMACIONNUMERO, g.AFGRUPONUMERO, ut.UNIDADTEMATICANUMERO`,
      [proyectoId],
    )

    if (!headers.length) {
      throw new NotFoundException('Este proyecto no tiene cronograma para exportar.')
    }

    const empresaNombre = headers[0].empresaNombre || `proyecto-${proyectoId}`
    const headerMap = new Map<number, any>()
    headers.forEach(h => headerMap.set(Number(h.cronogramaId), h))

    const presenciales: any[] = await this.ds.query(
      `SELECT cp.CRONOGRAMAID                       AS "cronogramaId",
              cp.CRONOGRAMAPRESENCIALID             AS "id",
              'P'                                   AS "tipo",
              TRIM(cp.CRONOGRAMAPRESENCIALSIGLA)    AS "codigo",
              TRIM(cp.CRONOGRAMAPRESENCIALNOMBRESESI) AS "nombre",
              cp.CRONOGRAMAPRESENCIALNUMSESION      AS "numSesion",
              cp.CRONOGRAMAPRESENCIALFECHAINICI     AS "fechaIni",
              TO_CHAR(cp.CRONOGRAMAPRESENCIALHORAINICIO - INTERVAL '5' HOUR, 'HH24:MI') AS "horaIni",
              TO_CHAR(cp.CRONOGRAMAPRESENCIALHORAFIN - INTERVAL '5' HOUR, 'HH24:MI')    AS "horaFin",
              cp.CRONOGRAMAPRESENCIALNUMHORAS       AS "horas",
              TRIM(cp.CRONOGRAMAPRESENCIALNOMBRESEDE) AS "sede",
              TRIM(cp.CRONOGRAMAPRESENCIALDIRECCION)  AS "direccion",
              TRIM(cp.CRONOGRAMAPRESENCIALAULA)       AS "aula",
              TRIM(cp.CRONOGRAMAHERRAMIENTA)          AS "herramienta",
              TRIM(cp.CRONOGRAMAURL)                  AS "url",
              TRIM(cp.CRONOGRAMAESTADORADICADO)       AS "estadoRadicacion",
              cp.CRONOGRAMAPRESENCIALCAPAID         AS "capPrincipalId",
              cp.CRONOGRAMAPRESENCIALCAPASUPUNO     AS "capSup1Id",
              cp.CRONOGRAMAPRESENCIALCAPASUPDOS     AS "capSup2Id",
              cp.CRONOGRAMAPRESENCIALCAPASUPTRE     AS "capSup3Id",
              cp.CRONOGRAMAPRESENCIALCAPASUPCUA     AS "capSup4Id",
              cp.CRONOGRAMAPREPERFILUTID            AS "perfilPrincipalId",
              cp.CRONOGRAMAPRESENCIALPERFILUTUN     AS "perfilSup1Id",
              cp.CRONOGRAMAPRESENCIALPERFILUTDO     AS "perfilSup2Id",
              cp.CRONOGRAMAPRESENCIALPERFILUTTR     AS "perfilSup3Id",
              cp.CRONOGRAMAPRESENCIALPERFILUTCU     AS "perfilSup4Id"
         FROM CRONOGRAMAPRESENCIAL cp
         JOIN CRONOGRAMA c       ON c.CRONOGRAMAID = cp.CRONOGRAMAID
         JOIN AFGRUPO g          ON g.AFGRUPOID    = c.AFGRUPOID
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
        WHERE c.CRONOPROYECTO = :1
          AND NVL(af.ACCIONFORMACIONTRANSFERENCIA, 0) = 0
        ORDER BY cp.CRONOGRAMAPRESENCIALID`,
      [proyectoId],
    )

    const virtuales: any[] = await this.ds.query(
      `SELECT cv.CRONOGRAMAID                       AS "cronogramaId",
              cv.CRONOGRAMAVIRTUALID                AS "id",
              'V'                                   AS "tipo",
              TRIM(cv.CRONOGRAMAVIRTUALSIGLA)       AS "codigo",
              TRIM(cv.CRONOGRAMAVIRTUALNOMBRE)      AS "nombre",
              cv.CRONOGRAMAVIRTUALNUMSESION         AS "numSesion",
              cv.CRONOGRAMAVIRTUALFECHAINICIO       AS "fechaIni",
              cv.CRONOGRAMAVIRTUALFECHAFINAL        AS "fechaFin",
              cv.CRONOGRAMAVIRTUALNUMHORAS          AS "horas",
              TRIM(cv.CRONOGRAMAVIRTUALURL)         AS "url",
              TRIM(cv.CRONOGRAMAVIRTUALPROVEEDOR)   AS "proveedor",
              TRIM(cv.CRONOGRAMAVIRTUALUSUARIOSENA) AS "usuarioSena",
              TRIM(cv.CRONOGRAMAVIRTUALCLAVESENA)   AS "claveSena",
              TRIM(cv.CRONOGRAMAVIRESTADORADICADO)  AS "estadoRadicacion",
              cv.CRONOGRAMAVIRCAPACITADORVIRTUA     AS "capPrincipalId",
              cv.CRONOGRAMAVIRCAPACITADORLSUPUN     AS "capSup1Id",
              cv.CRONOGRAMAVIRCAPACITADORSUPDOS     AS "capSup2Id",
              cv.CRONOGRAMAVIRCAPACITADORSUPTRE     AS "capSup3Id",
              cv.CRONOGRAMAVIRCAPACITADORSUPCUA     AS "capSup4Id",
              cv.CRONOGRAMAVIRPERFILUTID            AS "perfilPrincipalId",
              cv.CRONOGRAMAVIRTUALPERFILUTSUPUN     AS "perfilSup1Id",
              cv.CRONOGRAMAVIRTUALPERFILUTSUPDO     AS "perfilSup2Id",
              cv.CRONOGRAMAVIRTUALPERFILUTSUPTR     AS "perfilSup3Id",
              cv.CRONOGRAMAVIRTUALPERFILUTSUPCU     AS "perfilSup4Id"
         FROM CRONOGRAMAVIRTUAL cv
         JOIN CRONOGRAMA c       ON c.CRONOGRAMAID = cv.CRONOGRAMAID
         JOIN AFGRUPO g          ON g.AFGRUPOID    = c.AFGRUPOID
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
        WHERE c.CRONOPROYECTO = :1
          AND NVL(af.ACCIONFORMACIONTRANSFERENCIA, 0) = 0
        ORDER BY cv.CRONOGRAMAVIRTUALID`,
      [proyectoId],
    )

    // ORA-12704: PERSONAIDENTIFICACION es N-charset y EMPRESAIDENTIFICACION NUMBER, se unen en JS
    const caps: any[] = await this.ds.query(
      `SELECT c.CAPACITADORID                  AS "id",
              TRIM(c.CAPATIPO)                  AS "tipo",
              TRIM(td.TIPODOCUMENTOIDENTIDADNOMBRE) AS "tipoDoc",
              TRIM(p.PERSONAIDENTIFICACION)     AS "docPersona",
              e.EMPRESAIDENTIFICACION           AS "docEmpresa",
              TRIM(p.PERSONANOMBRES)            AS "personaNombres",
              TRIM(p.PERSONAPRIMERAPELLIDO)     AS "personaApe1",
              TRIM(p.PERSONASEGUNDOAPELLIDO)    AS "personaApe2",
              TRIM(e.EMPRESARAZONSOCIAL)        AS "empresaNombre"
         FROM CAPACITADORES c
         LEFT JOIN PERSONA p ON p.PERSONAID = c.CAPACITADORPERSONAID
         LEFT JOIN EMPRESA e ON e.EMPRESAID = c.CAPACITADOREMPRESAID
         LEFT JOIN TIPODOCUMENTOIDENTIDAD td
           ON td.TIPODOCUMENTOIDENTIDADID = COALESCE(p.TIPODOCUMENTOIDENTIDADID, e.TIPODOCUMENTOIDENTIDADID)
        WHERE c.PROYECTOID = :1`,
      [proyectoId],
    )
    const capMap = new Map<number, { tipoDoc: string; doc: string; nombre: string }>()
    caps.forEach(c => {
      const esPersona = (c.tipo || '').trim() === 'PE'
      const doc = esPersona
        ? (c.docPersona || '')
        : (c.docEmpresa != null ? String(c.docEmpresa) : '')
      const nombre = esPersona
        ? [c.personaNombres, c.personaApe1, c.personaApe2].filter(Boolean).join(' ')
        : (c.empresaNombre || '')
      capMap.set(Number(c.id), {
        tipoDoc: c.tipoDoc || '',
        doc,
        nombre,
      })
    })

    const perfiles: any[] = await this.ds.query(
      `SELECT pu.PERFILUTID AS "id", TRIM(r.RUBRONOMBRE) AS "nombre"
         FROM PERFILUT pu
         JOIN RUBRO r ON r.RUBROID = pu.RUBROIDUT
         JOIN UNIDADTEMATICA ut ON ut.UNIDADTEMATICAID = pu.UNIDADTEMATICAID
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = ut.ACCIONFORMACIONID
        WHERE af.PROYECTOID = :1`,
      [proyectoId],
    )
    const perfilMap = new Map<number, string>()
    perfiles.forEach(p => perfilMap.set(Number(p.id), p.nombre || ''))

    const fmtFecha = (d: any): string => {
      if (!d) return ''
      try {
        const dt = new Date(d)
        if (Number.isNaN(dt.getTime())) return ''
        // 1899/1901 es el placeholder de fecha vacia en Oracle
        if (dt.getUTCFullYear() < 1950) return ''
        return dt.toISOString().slice(0, 10)
      } catch { return '' }
    }
    const fmtHoraStr = (d: any): string => {
      if (!d) return ''
      try {
        const dt = new Date(d)
        if (Number.isNaN(dt.getTime())) return ''
        return `${dt.getUTCHours().toString().padStart(2, '0')}:${dt.getUTCMinutes().toString().padStart(2, '0')}`
      } catch { return '' }
    }
    const lookupCap = (id: any) => {
      const n = Number(id)
      if (!n || n === 0) return { tipoDoc: '', doc: '', nombre: '' }
      return capMap.get(n) ?? { tipoDoc: '', doc: '', nombre: '' }
    }
    const lookupPerfil = (id: any) => {
      const n = Number(id)
      if (!n || n === 0) return ''
      return perfilMap.get(n) ?? ''
    }

    const rows: any[] = []
    const all = [...presenciales, ...virtuales]

    const buildRow = (h: any, ses: any | null) => {
      const cP = lookupCap(ses?.capPrincipalId)
      const c1 = lookupCap(ses?.capSup1Id)
      const c2 = lookupCap(ses?.capSup2Id)
      const c3 = lookupCap(ses?.capSup3Id)
      const c4 = lookupCap(ses?.capSup4Id)
      return {
        Convenio: h.convenio || '',
        AccionFormacion: `AF ${h.afNum} — ${h.af || ''}`,
        Modalidad: h.modalidad || '',
        Evento: h.evento || '',
        Grupo: h.grupoNum ?? '',
        BeneficiariosGrupo: Number(h.benefGrupo) || 0,
        NumeroUnidadTematica: h.utNum ?? '',
        NombreUnidadTematica: h.utNombre || '',
        FechaInicioCronograma: fmtFecha(h.cronoIni),
        FechaFinCronograma: fmtFecha(h.cronoFin),
        NumeroSesiones: Number(h.numSesiones) || 0,
        NumeroActividades: Number(h.numActividades) || 0,
        CodigoSesionActividad: ses?.codigo || '',
        NombreSesionActividad: ses?.nombre || '',
        NumeroSesion: ses?.numSesion ?? '',
        FechaInicio: fmtFecha(ses?.fechaIni),
        FechaFin: fmtFecha(ses?.fechaFin),
        HoraInicio: fmtHoraStr(ses?.horaIni),
        HoraFin: fmtHoraStr(ses?.horaFin),
        NumeroHorasTotales: ses?.horas ?? '',
        Ciudad: '',
        Url: ses?.url || '',
        Proveedor: ses?.proveedor || '',
        UsuarioSena: ses?.usuarioSena || '',
        ClaveSena: ses?.claveSena || '',
        Sede: ses?.sede || '',
        Direccion: ses?.direccion || '',
        Aula: ses?.aula || '',
        Herramienta: ses?.herramienta || '',
        TipoDocumento: cP.tipoDoc,
        NumeroDocumento: cP.doc,
        CapacitadorPrincipal: cP.nombre,
        PerfilCapacitador: lookupPerfil(ses?.perfilPrincipalId),
        TipoDocumento1: c1.tipoDoc, NumeroDocumento1: c1.doc, Capacitador1: c1.nombre,
        PerfilCapacitador1: lookupPerfil(ses?.perfilSup1Id),
        TipoDocumento2: c2.tipoDoc, NumeroDocumento2: c2.doc, Capacitador2: c2.nombre,
        PerfilCapacitador2: lookupPerfil(ses?.perfilSup2Id),
        TipoDocumento3: c3.tipoDoc, NumeroDocumento3: c3.doc, Capacitador3: c3.nombre,
        PerfilCapacitador3: lookupPerfil(ses?.perfilSup3Id),
        TipoDocumento4: c4.tipoDoc, NumeroDocumento4: c4.doc, Capacitador4: c4.nombre,
        PerfilCapacitador4: lookupPerfil(ses?.perfilSup4Id),
        EstadoRadicacion: ses?.estadoRadicacion || '',
      }
    }

    for (const ses of all) {
      const h = headerMap.get(Number(ses.cronogramaId))
      if (h) rows.push(buildRow(h, ses))
    }
    for (const h of headers) {
      const tieneAlgo = all.some(s => Number(s.cronogramaId) === Number(h.cronogramaId))
      if (!tieneAlgo) rows.push(buildRow(h, null))
    }

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cronograma')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer

    const safeName = empresaNombre.replace(/[^\w\d -]/g, '').trim().replace(/\s+/g, '_').slice(0, 50) || `proyecto-${proyectoId}`
    return { buffer, filename: `Cronograma_${safeName}.xlsx` }
  }

  async agregarSesionVirtual(cronogramaId: number, dto: AgregarSesionVirtualDto) {
    await this.assertConvenioActivoPorCronograma(cronogramaId)
    if (dto.fechaFin < dto.fechaInicio) {
      throw new BadRequestException('La fecha fin no puede ser menor a la fecha de inicio.')
    }
    if (Number(dto.horas) <= 0) {
      throw new BadRequestException('Las horas deben ser mayores a 0.')
    }

    const qr = this.ds.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      const cronoRows: any[] = await qr.query(
        `SELECT c.CRONOGRAMAID                  AS "cronogramaId",
                c.AFGRUPOID                     AS "grupoId",
                c.UNIDADTEMATICAID              AS "utId",
                c.CRONOGRAMAFECHAINICIO         AS "fechaInicio",
                c.CRONOGRAMAFECHAFIN            AS "fechaFin",
                c.CRONOPROYECTO                 AS "proyectoId",
                NVL(ut.UNIDADTEMATICAHORASPV, 0)   AS "horasPV",
                NVL(ut.UNIDADTEMATICAHORASTV, 0)   AS "horasTV",
                NVL(ut.UNIDADTEMATICAHORASPHIB, 0) AS "horasPHib",
                NVL(ut.UNIDADTEMATICAHORASTHIB, 0) AS "horasTHib"
           FROM CRONOGRAMA c
           JOIN UNIDADTEMATICA ut ON ut.UNIDADTEMATICAID = c.UNIDADTEMATICAID
          WHERE c.CRONOGRAMAID = :1`,
        [cronogramaId],
      )
      if (!cronoRows.length) throw new NotFoundException('Cronograma no encontrado.')
      const crono = cronoRows[0]

      let totalUT = 0
      if (dto.modalidadId === 3) totalUT = Number(crono.horasPHib) + Number(crono.horasTHib)
      else if (dto.modalidadId === 4) totalUT = Number(crono.horasPV) + Number(crono.horasTV)

      const fIniStr = new Date(crono.fechaInicio).toISOString().slice(0, 10)
      const fFinStr = new Date(crono.fechaFin).toISOString().slice(0, 10)
      if (dto.fechaInicio < fIniStr) throw new BadRequestException(`La fecha es anterior al cronograma (${fIniStr}).`)
      if (dto.fechaFin > fFinStr) throw new BadRequestException(`La fecha fin es posterior al cronograma (${fFinStr}).`)

      const capCheck: any[] = await qr.query(
        `SELECT 1 AS "ok" FROM CAPACITADORES
          WHERE CAPACITADORID = :1 AND PROYECTOID = :2
            AND TRIM(CAPAESTADO) = 'ACTIVO'
            AND (TRIM(CAPAINTERESTADO) = 'APROBADO'
                 OR TRIM(CAPACITADORESTADOTRANSFERENCIA) = 'APROBADOT')`,
        [dto.capacitadorId, crono.proyectoId],
      )
      if (!capCheck.length) {
        throw new BadRequestException('El capacitador no pertenece al proyecto o no está aprobado.')
      }

      const perfilCheck: any[] = await qr.query(
        `SELECT 1 AS "ok" FROM PERFILUT WHERE PERFILUTID = :1 AND UNIDADTEMATICAID = :2`,
        [dto.perfilUTId, crono.utId],
      )
      if (!perfilCheck.length) {
        throw new BadRequestException('El perfil no es válido para esta unidad temática.')
      }

      // en hibrida (3) las horas presenciales tambien cuentan contra la UT
      const acumP: any[] = dto.modalidadId === 3
        ? await qr.query(
            `SELECT NVL(SUM(CRONOGRAMAPRESENCIALNUMHORAS), 0) AS "horas"
               FROM CRONOGRAMAPRESENCIAL WHERE CRONOGRAMAID = :1`,
            [cronogramaId],
          )
        : [{ horas: 0 }]
      const acumV: any[] = await qr.query(
        `SELECT NVL(SUM(CRONOGRAMAVIRTUALNUMHORAS), 0) AS "horas"
           FROM CRONOGRAMAVIRTUAL WHERE CRONOGRAMAID = :1`,
        [cronogramaId],
      )
      const horasReg = Number(acumP[0].horas) + Number(acumV[0].horas)
      if (totalUT > 0 && horasReg + Number(dto.horas) > totalUT) {
        throw new BadRequestException(
          `El total de horas (${horasReg + Number(dto.horas)}) supera lo registrado en la UT (${totalUT}).`,
        )
      }

      const convRows: any[] = await qr.query(
        `SELECT CONVENIOSID AS "convId", NVL(CONVENIOSCRONOCONSECUTIVOV, 0) AS "consec"
           FROM CONVENIOS
          WHERE PROYECTOID = :1 AND CONVENIOSESTADO = 1
            AND ROWNUM = 1`,
        [crono.proyectoId],
      )
      if (!convRows.length) {
        throw new BadRequestException('Este proyecto no tiene un convenio activo.')
      }
      const convId = Number(convRows[0].convId)
      const consecutivo = Number(convRows[0].consec) + 1
      const sigla = `CV${String(consecutivo).padStart(6, '0')}`

      const nsRows: any[] = await qr.query(
        `SELECT NVL(MAX(CRONOGRAMAVIRTUALNUMSESION), 0) + 1 AS "next"
           FROM CRONOGRAMAVIRTUAL WHERE CRONOGRAMAID = :1`,
        [cronogramaId],
      )
      const numSesion = Number(nsRows[0].next)

      const idRows: any[] = await qr.query(
        `SELECT NVL(MAX(CRONOGRAMAVIRTUALID), 0) + 1 AS "id" FROM CRONOGRAMAVIRTUAL`,
      )
      const newId = Number(idRows[0].id)

      const fechaIni = new Date(`${dto.fechaInicio}T05:00:00.000Z`)
      const fechaFin = new Date(`${dto.fechaFin}T05:00:00.000Z`)

      await qr.query(
        `INSERT INTO CRONOGRAMAVIRTUAL
           (CRONOGRAMAVIRTUALID, CRONOGRAMAID,
            CRONOGRAMAVIRTUALNOMBRE, CRONOGRAMAVIRTUALNUMSESION,
            CRONOGRAMAVIRTUALFECHAINICIO, CRONOGRAMAVIRTUALFECHAFINAL,
            CRONOGRAMAVIRTUALNUMHORAS,
            CRONOGRAMAVIRTUALPROVEEDOR, CRONOGRAMAVIRTUALURL,
            CRONOGRAMAVIRTUALUSUARIOSENA, CRONOGRAMAVIRTUALCLAVESENA,
            CRONOGRAMAVIRTUALSIGLA,
            CRONOGRAMAVIRESTADO, CRONOGRAMAVIRESTADORADICADO,
            CRONOGRAMAVIRCAPACITADORVIRTUA, CRONOGRAMAVIRPERFILUTID,
            CRONOGRAMAVIRCAPACITADORLSUPUN, CRONOGRAMAVIRCAPACITADORSUPDOS,
            CRONOGRAMAVIRCAPACITADORSUPTRE, CRONOGRAMAVIRCAPACITADORSUPCUA,
            CRONOGRAMAVIRTUALPERFILUTSUPUN, CRONOGRAMAVIRTUALPERFILUTSUPDO,
            CRONOGRAMAVIRTUALPERFILUTSUPTR, CRONOGRAMAVIRTUALPERFILUTSUPCU,
            CRONOGRAMAVIRTUALRADICADOID, CRONOGRAMAVIRTUALRADICADOTRANS)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12,
                 'ACTIVO', 'PENDIENTE', :13, :14,
                 :15, :16, :17, :18, :19, :20, :21, :22, 0, 0)`,
        [
          newId, cronogramaId,
          dto.nombreActividad, numSesion,
          fechaIni, fechaFin, Number(dto.horas),
          dto.plataforma, dto.url,
          dto.usuarioSena ?? null, dto.claveSena ?? null,
          sigla,
          dto.capacitadorId, dto.perfilUTId,
          dto.capSup1Id ?? 0, dto.capSup2Id ?? 0, dto.capSup3Id ?? 0, dto.capSup4Id ?? 0,
          dto.perfilSup1Id ?? 0, dto.perfilSup2Id ?? 0, dto.perfilSup3Id ?? 0, dto.perfilSup4Id ?? 0,
        ],
      )

      await qr.query(
        `UPDATE CRONOGRAMA SET CRONONUMTOTALACT = NVL(CRONONUMTOTALACT, 0) + 1
          WHERE CRONOGRAMAID = :1`,
        [cronogramaId],
      )
      await qr.query(
        `UPDATE CONVENIOS SET CONVENIOSCRONOCONSECUTIVOV = :1 WHERE CONVENIOSID = :2`,
        [consecutivo, convId],
      )

      await qr.commitTransaction()
      return { actividadId: newId, sigla, numSesion, horas: Number(dto.horas) }
    } catch (e) {
      await qr.rollbackTransaction()
      throw e
    } finally {
      await qr.release()
    }
  }

  async actualizarSesionVirtual(actividadId: number, dto: AgregarSesionVirtualDto) {
    await this.assertConvenioActivoPorSesionVirtual(actividadId)
    if (dto.fechaFin < dto.fechaInicio) {
      throw new BadRequestException('La fecha fin no puede ser menor a la fecha de inicio.')
    }
    if (Number(dto.horas) <= 0) {
      throw new BadRequestException('Las horas deben ser mayores a 0.')
    }

    const qr = this.ds.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      const sesRows: any[] = await qr.query(
        `SELECT cv.CRONOGRAMAID                AS "cronogramaId",
                cv.CRONOGRAMAVIRTUALNUMHORAS   AS "horasActuales",
                TRIM(cv.CRONOGRAMAVIRESTADORADICADO) AS "estadoRadicado",
                c.UNIDADTEMATICAID             AS "utId",
                c.CRONOGRAMAFECHAINICIO        AS "fechaInicio",
                c.CRONOGRAMAFECHAFIN           AS "fechaFin",
                c.CRONOPROYECTO                AS "proyectoId",
                NVL(ut.UNIDADTEMATICAHORASPV, 0)   AS "horasPV",
                NVL(ut.UNIDADTEMATICAHORASTV, 0)   AS "horasTV",
                NVL(ut.UNIDADTEMATICAHORASPHIB, 0) AS "horasPHib",
                NVL(ut.UNIDADTEMATICAHORASTHIB, 0) AS "horasTHib"
           FROM CRONOGRAMAVIRTUAL cv
           JOIN CRONOGRAMA c ON c.CRONOGRAMAID = cv.CRONOGRAMAID
           JOIN UNIDADTEMATICA ut ON ut.UNIDADTEMATICAID = c.UNIDADTEMATICAID
          WHERE cv.CRONOGRAMAVIRTUALID = :1`,
        [actividadId],
      )
      if (!sesRows.length) throw new NotFoundException('Actividad virtual no encontrada.')
      const ses = sesRows[0]

      if (estadoBloqueaEdicion(ses.estadoRadicado)) {
        throw new BadRequestException('Esta actividad ya fue radicada; no se puede editar (espera a que interventoría la devuelva para corrección).')
      }

      let totalUT = 0
      if (dto.modalidadId === 3) totalUT = Number(ses.horasPHib) + Number(ses.horasTHib)
      else if (dto.modalidadId === 4) totalUT = Number(ses.horasPV) + Number(ses.horasTV)

      const fIniStr = new Date(ses.fechaInicio).toISOString().slice(0, 10)
      const fFinStr = new Date(ses.fechaFin).toISOString().slice(0, 10)
      if (dto.fechaInicio < fIniStr) throw new BadRequestException(`La fecha es anterior al cronograma (${fIniStr}).`)
      if (dto.fechaFin > fFinStr) throw new BadRequestException(`La fecha fin es posterior al cronograma (${fFinStr}).`)

      const capCheck: any[] = await qr.query(
        `SELECT 1 AS "ok" FROM CAPACITADORES
          WHERE CAPACITADORID = :1 AND PROYECTOID = :2
            AND TRIM(CAPAESTADO) = 'ACTIVO'
            AND (TRIM(CAPAINTERESTADO) = 'APROBADO'
                 OR TRIM(CAPACITADORESTADOTRANSFERENCIA) = 'APROBADOT')`,
        [dto.capacitadorId, ses.proyectoId],
      )
      if (!capCheck.length) throw new BadRequestException('El capacitador no pertenece al proyecto o no está aprobado.')

      const perfilCheck: any[] = await qr.query(
        `SELECT 1 AS "ok" FROM PERFILUT WHERE PERFILUTID = :1 AND UNIDADTEMATICAID = :2`,
        [dto.perfilUTId, ses.utId],
      )
      if (!perfilCheck.length) throw new BadRequestException('El perfil no es válido para esta unidad temática.')

      const acumP: any[] = dto.modalidadId === 3
        ? await qr.query(
            `SELECT NVL(SUM(CRONOGRAMAPRESENCIALNUMHORAS), 0) AS "horas"
               FROM CRONOGRAMAPRESENCIAL WHERE CRONOGRAMAID = :1`,
            [ses.cronogramaId],
          )
        : [{ horas: 0 }]
      const acumV: any[] = await qr.query(
        `SELECT NVL(SUM(CRONOGRAMAVIRTUALNUMHORAS), 0) AS "horas"
           FROM CRONOGRAMAVIRTUAL WHERE CRONOGRAMAID = :1`,
        [ses.cronogramaId],
      )
      const horasReg = Number(acumP[0].horas) + Number(acumV[0].horas) - Number(ses.horasActuales)
      if (totalUT > 0 && horasReg + Number(dto.horas) > totalUT) {
        throw new BadRequestException(
          `El total de horas (${horasReg + Number(dto.horas)}) supera lo registrado en la UT (${totalUT}).`,
        )
      }

      const fechaIni = new Date(`${dto.fechaInicio}T05:00:00.000Z`)
      const fechaFin = new Date(`${dto.fechaFin}T05:00:00.000Z`)

      await qr.query(
        `UPDATE CRONOGRAMAVIRTUAL
            SET CRONOGRAMAVIRTUALNOMBRE         = :1,
                CRONOGRAMAVIRTUALFECHAINICIO    = :2,
                CRONOGRAMAVIRTUALFECHAFINAL     = :3,
                CRONOGRAMAVIRTUALNUMHORAS       = :4,
                CRONOGRAMAVIRTUALPROVEEDOR      = :5,
                CRONOGRAMAVIRTUALURL            = :6,
                CRONOGRAMAVIRTUALUSUARIOSENA    = :7,
                CRONOGRAMAVIRTUALCLAVESENA      = :8,
                CRONOGRAMAVIRCAPACITADORVIRTUA  = :9,
                CRONOGRAMAVIRPERFILUTID         = :10,
                CRONOGRAMAVIRCAPACITADORLSUPUN  = :11,
                CRONOGRAMAVIRCAPACITADORSUPDOS  = :12,
                CRONOGRAMAVIRCAPACITADORSUPTRE  = :13,
                CRONOGRAMAVIRCAPACITADORSUPCUA  = :14,
                CRONOGRAMAVIRTUALPERFILUTSUPUN  = :15,
                CRONOGRAMAVIRTUALPERFILUTSUPDO  = :16,
                CRONOGRAMAVIRTUALPERFILUTSUPTR  = :17,
                CRONOGRAMAVIRTUALPERFILUTSUPCU  = :18
          WHERE CRONOGRAMAVIRTUALID = :19`,
        [
          dto.nombreActividad, fechaIni, fechaFin, Number(dto.horas),
          dto.plataforma, dto.url,
          dto.usuarioSena ?? null, dto.claveSena ?? null,
          dto.capacitadorId, dto.perfilUTId,
          dto.capSup1Id ?? 0, dto.capSup2Id ?? 0, dto.capSup3Id ?? 0, dto.capSup4Id ?? 0,
          dto.perfilSup1Id ?? 0, dto.perfilSup2Id ?? 0, dto.perfilSup3Id ?? 0, dto.perfilSup4Id ?? 0,
          actividadId,
        ],
      )

      await qr.commitTransaction()
      return { actividadId, horas: Number(dto.horas), action: 'updated' as const }
    } catch (e) {
      await qr.rollbackTransaction()
      throw e
    } finally {
      await qr.release()
    }
  }

  async listarRadicados(proyectoId: number) {
    return this.ds.query(
      `SELECT r.RADICADOID                AS "radicadoId",
              r.NUMERORADICADO            AS "numero",
              r.RADICADOFECHA             AS "fecha",
              TRIM(r.RADICADOESTADOGENERAL) AS "estado",
              r.CRONOGRAMARADICADOTRANSFERENCI AS "transferencia"
         FROM CRONOGRAMARADICADO r
        WHERE r.PROYECTOID = :1
        ORDER BY r.NUMERORADICADO DESC`,
      [proyectoId],
    )
  }

  async pendientesRadicar(proyectoId: number) {
    const presenciales: any[] = await this.ds.query(
      `SELECT cp.CRONOGRAMAPRESENCIALID         AS "id",
              TRIM(cp.CRONOGRAMAPRESENCIALSIGLA) AS "sigla",
              TRIM(cp.CRONOGRAMAPRESENCIALNOMBRESESI) AS "nombre",
              af.ACCIONFORMACIONNUMERO         AS "afNum",
              TRIM(af.ACCIONFORMACIONNOMBRE)   AS "af",
              g.AFGRUPONUMERO                  AS "grupoNum",
              ut.UNIDADTEMATICANUMERO          AS "utNum",
              TRIM(ut.UNIDADTEMATICANOMBRE)    AS "utNombre"
         FROM CRONOGRAMAPRESENCIAL cp
         JOIN CRONOGRAMA c       ON c.CRONOGRAMAID = cp.CRONOGRAMAID
         JOIN AFGRUPO g          ON g.AFGRUPOID    = c.AFGRUPOID
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
         JOIN UNIDADTEMATICA ut  ON ut.UNIDADTEMATICAID = c.UNIDADTEMATICAID
        WHERE c.CRONOPROYECTO = :1
          AND NVL(af.ACCIONFORMACIONTRANSFERENCIA, 0) = 0
          AND TRIM(cp.CRONOGRAMAESTADORADICADO) = 'PENDIENTE'
          AND NVL(cp.CRONOGRAMAPRESENCIALRADICADOID, 0) = 0
        ORDER BY cp.CRONOGRAMAPRESENCIALID`,
      [proyectoId],
    )

    const virtuales: any[] = await this.ds.query(
      `SELECT cv.CRONOGRAMAVIRTUALID           AS "id",
              TRIM(cv.CRONOGRAMAVIRTUALSIGLA)   AS "sigla",
              TRIM(cv.CRONOGRAMAVIRTUALNOMBRE)  AS "nombre",
              af.ACCIONFORMACIONNUMERO         AS "afNum",
              TRIM(af.ACCIONFORMACIONNOMBRE)   AS "af",
              g.AFGRUPONUMERO                  AS "grupoNum",
              ut.UNIDADTEMATICANUMERO          AS "utNum",
              TRIM(ut.UNIDADTEMATICANOMBRE)    AS "utNombre"
         FROM CRONOGRAMAVIRTUAL cv
         JOIN CRONOGRAMA c       ON c.CRONOGRAMAID = cv.CRONOGRAMAID
         JOIN AFGRUPO g          ON g.AFGRUPOID    = c.AFGRUPOID
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
         JOIN UNIDADTEMATICA ut  ON ut.UNIDADTEMATICAID = c.UNIDADTEMATICAID
        WHERE c.CRONOPROYECTO = :1
          AND NVL(af.ACCIONFORMACIONTRANSFERENCIA, 0) = 0
          AND TRIM(cv.CRONOGRAMAVIRESTADORADICADO) = 'PENDIENTE'
          AND NVL(cv.CRONOGRAMAVIRTUALRADICADOID, 0) = 0
        ORDER BY cv.CRONOGRAMAVIRTUALID`,
      [proyectoId],
    )

    return { presenciales, virtuales }
  }

  async radicarCronograma(proyectoId: number) {
    await this.assertConvenioEnEjecucion(proyectoId)
    const qr = this.ds.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      const { presenciales, virtuales } = await this.pendientesRadicar(proyectoId)
      if (!presenciales.length && !virtuales.length) {
        throw new BadRequestException('No hay sesiones ni actividades pendientes por radicar.')
      }

      const idRows: any[] = await qr.query(
        `SELECT NVL(MAX(RADICADOID), 0) + 1 AS "id" FROM CRONOGRAMARADICADO`,
      )
      const radicadoId = Number(idRows[0].id)

      const numRows: any[] = await qr.query(
        `SELECT NVL(MAX(NUMERORADICADO), 0) + 1 AS "n"
           FROM CRONOGRAMARADICADO WHERE PROYECTOID = :1`,
        [proyectoId],
      )
      const numero = Number(numRows[0].n)

      const histP = presenciales.map(s => `${s.sigla}-RADICADO`).join(';')
      const histV = virtuales.map(s => `${s.sigla}-RADICADO`).join(';')

      await qr.query(
        `INSERT INTO CRONOGRAMARADICADO
           (RADICADOID, PROYECTOID, NUMERORADICADO, RADICADOFECHA,
            RADICADOESTADOGENERAL, RADICONVENIOHISTORICO, RADICONVENIOHISTORICOV,
            CRONOGRAMARADICADOTRANSFERENCI)
         VALUES (:1, :2, :3, SYSDATE, 'RADICADO', :4, :5, 0)`,
        [radicadoId, proyectoId, numero, histP, histV],
      )

      if (presenciales.length) {
        const ids = presenciales.map(s => Number(s.id))
        const placeholders = ids.map((_, i) => `:${i + 2}`).join(',')
        await qr.query(
          `UPDATE CRONOGRAMAPRESENCIAL
              SET CRONOGRAMAESTADORADICADO = 'RADICADO',
                  CRONOGRAMAPRESENCIALRADICADOID = :1
            WHERE CRONOGRAMAPRESENCIALID IN (${placeholders})`,
          [radicadoId, ...ids],
        )
      }
      if (virtuales.length) {
        const ids = virtuales.map(s => Number(s.id))
        const placeholders = ids.map((_, i) => `:${i + 2}`).join(',')
        await qr.query(
          `UPDATE CRONOGRAMAVIRTUAL
              SET CRONOGRAMAVIRESTADORADICADO = 'RADICADO',
                  CRONOGRAMAVIRTUALRADICADOID = :1
            WHERE CRONOGRAMAVIRTUALID IN (${placeholders})`,
          [radicadoId, ...ids],
        )
      }

      await qr.commitTransaction()
      return {
        radicadoId, numero,
        sesionesRadicadas: presenciales.length,
        actividadesRadicadas: virtuales.length,
      }
    } catch (e) {
      await qr.rollbackTransaction()
      throw e
    } finally {
      await qr.release()
    }
  }

  async getRadicadoDetalle(radicadoId: number) {
    const cab: any[] = await this.ds.query(
      `SELECT r.RADICADOID                AS "radicadoId",
              r.PROYECTOID                AS "proyectoId",
              r.NUMERORADICADO            AS "numero",
              r.RADICADOFECHA             AS "fecha",
              r.RADICADOFECHAESTADO       AS "fechaEstado",
              TRIM(r.RADICADOESTADOGENERAL) AS "estado",
              TO_CHAR(r.RADICADOOBSERVACION) AS "observacion",
              TO_CHAR(r.RADICONVENIOHISTORICO) AS "histPresencial",
              TO_CHAR(r.RADICONVENIOHISTORICOV) AS "histVirtual",
              TO_CHAR(r.RADIINTERVENTORIAHISTORICA) AS "histInterventoriaP",
              TO_CHAR(r.RADIINTERVENTORIAHISTORICAV) AS "histInterventoriaV",
              r.CRONOGRAMARADICADOTRANSFERENCI AS "transferencia",
              r.CRONOGRAMARADICADOSENA    AS "radicadoSena",
              r.CRONOGRAMARADICADOSENAFECHA AS "radicadoSenaFecha",
              r.CRONOGRAMARADICADOINTER   AS "radicadoInter",
              r.CRONOGRAMARADICADOINTERFECHA AS "radicadoInterFecha",
              r.CRONOGRAMARADICADONISSENA AS "nisSena",
              r.CRONOGRAMARADICADOFECHAREMI AS "fechaRemi",
              r.CRONOGRAMARADICADOOBSER   AS "obsSena",
              r.RADICADOPERSONAINTERVENTORIA AS "interventorId",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) AS "interventorNombre",
              TRIM(p.PERSONAEMAIL)        AS "interventorEmail"
         FROM CRONOGRAMARADICADO r
         LEFT JOIN PERSONA p ON p.PERSONAID = r.RADICADOPERSONAINTERVENTORIA
        WHERE r.RADICADOID = :1`,
      [radicadoId],
    )
    if (!cab.length) throw new NotFoundException('Radicado no encontrado.')

    const presenciales: any[] = await this.ds.query(
      `SELECT cp.CRONOGRAMAPRESENCIALID         AS "id",
              TRIM(cp.CRONOGRAMAPRESENCIALSIGLA) AS "sigla",
              TRIM(cp.CRONOGRAMAPRESENCIALNOMBRESESI) AS "nombre",
              TRIM(cp.CRONOGRAMAESTADORADICADO) AS "estadoRadicado",
              af.ACCIONFORMACIONNUMERO         AS "afNum",
              TRIM(af.ACCIONFORMACIONNOMBRE)   AS "af",
              g.AFGRUPONUMERO                  AS "grupoNum",
              ut.UNIDADTEMATICANUMERO          AS "utNum",
              TRIM(ut.UNIDADTEMATICANOMBRE)    AS "utNombre"
         FROM CRONOGRAMAPRESENCIAL cp
         JOIN CRONOGRAMA c       ON c.CRONOGRAMAID = cp.CRONOGRAMAID
         JOIN AFGRUPO g          ON g.AFGRUPOID    = c.AFGRUPOID
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
         JOIN UNIDADTEMATICA ut  ON ut.UNIDADTEMATICAID = c.UNIDADTEMATICAID
        WHERE cp.CRONOGRAMAPRESENCIALRADICADOID = :1
        ORDER BY cp.CRONOGRAMAPRESENCIALID`,
      [radicadoId],
    )

    const virtuales: any[] = await this.ds.query(
      `SELECT cv.CRONOGRAMAVIRTUALID           AS "id",
              TRIM(cv.CRONOGRAMAVIRTUALSIGLA)   AS "sigla",
              TRIM(cv.CRONOGRAMAVIRTUALNOMBRE)  AS "nombre",
              TRIM(cv.CRONOGRAMAVIRESTADORADICADO) AS "estadoRadicado",
              af.ACCIONFORMACIONNUMERO         AS "afNum",
              TRIM(af.ACCIONFORMACIONNOMBRE)   AS "af",
              g.AFGRUPONUMERO                  AS "grupoNum",
              ut.UNIDADTEMATICANUMERO          AS "utNum",
              TRIM(ut.UNIDADTEMATICANOMBRE)    AS "utNombre"
         FROM CRONOGRAMAVIRTUAL cv
         JOIN CRONOGRAMA c       ON c.CRONOGRAMAID = cv.CRONOGRAMAID
         JOIN AFGRUPO g          ON g.AFGRUPOID    = c.AFGRUPOID
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
         JOIN UNIDADTEMATICA ut  ON ut.UNIDADTEMATICAID = c.UNIDADTEMATICAID
        WHERE cv.CRONOGRAMAVIRTUALRADICADOID = :1
        ORDER BY cv.CRONOGRAMAVIRTUALID`,
      [radicadoId],
    )

    return { ...cab[0], presenciales, virtuales }
  }

  async marcarSesionActualizada(sesionId: number) {
    await this.assertConvenioActivoPorSesionPresencial(sesionId)
    const r = await this.ds.query(
      `UPDATE CRONOGRAMAPRESENCIAL
          SET CRONOGRAMAESTADORADICADO = 'ACTUALIZADA'
        WHERE CRONOGRAMAPRESENCIALID = :1
          AND TRIM(CRONOGRAMAESTADORADICADO) = 'MODIFICAR'`,
      [sesionId],
    )
    return { ok: true, affected: r?.affectedRows ?? 0 }
  }

  async marcarVirtualActualizada(actividadId: number) {
    await this.assertConvenioActivoPorSesionVirtual(actividadId)
    const r = await this.ds.query(
      `UPDATE CRONOGRAMAVIRTUAL
          SET CRONOGRAMAVIRESTADORADICADO = 'ACTUALIZADA'
        WHERE CRONOGRAMAVIRTUALID = :1
          AND TRIM(CRONOGRAMAVIRESTADORADICADO) = 'MODIFICAR'`,
      [actividadId],
    )
    return { ok: true, affected: r?.affectedRows ?? 0 }
  }

  async marcarTodasActualizadas(radicadoId: number) {
    await this.assertConvenioActivoPorRadicado(radicadoId)
    const qr = this.ds.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      await qr.query(
        `UPDATE CRONOGRAMAPRESENCIAL
            SET CRONOGRAMAESTADORADICADO = 'ACTUALIZADA'
          WHERE CRONOGRAMAPRESENCIALRADICADOID = :1
            AND TRIM(CRONOGRAMAESTADORADICADO) = 'MODIFICAR'`,
        [radicadoId],
      )
      await qr.query(
        `UPDATE CRONOGRAMAVIRTUAL
            SET CRONOGRAMAVIRESTADORADICADO = 'ACTUALIZADA'
          WHERE CRONOGRAMAVIRTUALRADICADOID = :1
            AND TRIM(CRONOGRAMAVIRESTADORADICADO) = 'MODIFICAR'`,
        [radicadoId],
      )
      await qr.commitTransaction()
      return { ok: true }
    } catch (e) {
      await qr.rollbackTransaction()
      throw e
    } finally {
      await qr.release()
    }
  }

  async enviarCorrecciones(radicadoId: number) {
    await this.assertConvenioActivoPorRadicado(radicadoId)
    const pendientes: any[] = await this.ds.query(
      `SELECT (
          (SELECT COUNT(*) FROM CRONOGRAMAPRESENCIAL
            WHERE CRONOGRAMAPRESENCIALRADICADOID = :1
              AND TRIM(CRONOGRAMAESTADORADICADO) = 'MODIFICAR')
        + (SELECT COUNT(*) FROM CRONOGRAMAVIRTUAL
            WHERE CRONOGRAMAVIRTUALRADICADOID = :2
              AND TRIM(CRONOGRAMAVIRESTADORADICADO) = 'MODIFICAR')
        ) AS "C" FROM DUAL`,
      [radicadoId, radicadoId],
    )
    if (Number(pendientes[0].C) > 0) {
      throw new BadRequestException('Faltan sesiones o actividades por marcar como actualizadas.')
    }

    await this.ds.query(
      `UPDATE CRONOGRAMARADICADO
          SET RADICADOESTADOGENERAL = 'RADICADO',
              RADICADOFECHAESTADO   = SYSDATE
        WHERE RADICADOID = :1`,
      [radicadoId],
    )
    return { ok: true }
  }

  async getSesionPresencialPorId(sesionId: number) {
    const rows: any[] = await this.ds.query(
      `SELECT cp.CRONOGRAMAPRESENCIALID         AS "id",
              cp.CRONOGRAMAID                   AS "cronogramaId",
              c.UNIDADTEMATICAID                AS "utId",
              c.CRONOPROYECTO                   AS "proyectoId",
              TRIM(cp.CRONOGRAMAPRESENCIALNOMBRESESI) AS "nombreSesion",
              cp.CRONOGRAMAPRESENCIALNUMSESION  AS "numSesion",
              cp.CRONOGRAMAPRESENCIALFECHAINICI AS "fechaInicio",
              TO_CHAR(cp.CRONOGRAMAPRESENCIALHORAINICIO - INTERVAL '5' HOUR, 'HH24:MI') AS "horaInicio",
              TO_CHAR(cp.CRONOGRAMAPRESENCIALHORAFIN - INTERVAL '5' HOUR, 'HH24:MI')    AS "horaFin",
              cp.CRONOGRAMAPRESENCIALNUMHORAS   AS "horas",
              TRIM(cp.CRONOGRAMAPRESENCIALNOMBRESEDE) AS "nombreSede",
              TRIM(cp.CRONOGRAMAPRESENCIALDIRECCION)  AS "direccion",
              TRIM(cp.CRONOGRAMAPRESENCIALAULA)       AS "aula",
              TRIM(cp.CRONOGRAMAHERRAMIENTA)          AS "herramienta",
              TRIM(cp.CRONOGRAMAURL)                  AS "url",
              TRIM(cp.CRONOGRAMAESTADORADICADO)       AS "estadoRadicado",
              cp.CRONOGRAMAPRESENCIALCAPAID         AS "capacitadorId",
              cp.CRONOGRAMAPRESENCIALCAPASUPUNO     AS "capSup1Id",
              cp.CRONOGRAMAPRESENCIALCAPASUPDOS     AS "capSup2Id",
              cp.CRONOGRAMAPRESENCIALCAPASUPTRE     AS "capSup3Id",
              cp.CRONOGRAMAPRESENCIALCAPASUPCUA     AS "capSup4Id",
              cp.CRONOGRAMAPREPERFILUTID            AS "perfilUTId",
              cp.CRONOGRAMAPRESENCIALPERFILUTUN     AS "perfilSup1Id",
              cp.CRONOGRAMAPRESENCIALPERFILUTDO     AS "perfilSup2Id",
              cp.CRONOGRAMAPRESENCIALPERFILUTTR     AS "perfilSup3Id",
              cp.CRONOGRAMAPRESENCIALPERFILUTCU     AS "perfilSup4Id"
         FROM CRONOGRAMAPRESENCIAL cp
         JOIN CRONOGRAMA c ON c.CRONOGRAMAID = cp.CRONOGRAMAID
        WHERE cp.CRONOGRAMAPRESENCIALID = :1`,
      [sesionId],
    )
    if (!rows.length) throw new NotFoundException('Sesión no encontrada.')
    return rows[0]
  }

  async getSesionVirtualPorId(actividadId: number) {
    const rows: any[] = await this.ds.query(
      `SELECT cv.CRONOGRAMAVIRTUALID            AS "id",
              cv.CRONOGRAMAID                   AS "cronogramaId",
              c.UNIDADTEMATICAID                AS "utId",
              c.CRONOPROYECTO                   AS "proyectoId",
              TRIM(cv.CRONOGRAMAVIRTUALNOMBRE)  AS "nombreActividad",
              cv.CRONOGRAMAVIRTUALNUMSESION    AS "numSesion",
              cv.CRONOGRAMAVIRTUALFECHAINICIO  AS "fechaInicio",
              cv.CRONOGRAMAVIRTUALFECHAFINAL   AS "fechaFin",
              cv.CRONOGRAMAVIRTUALNUMHORAS     AS "horas",
              TRIM(cv.CRONOGRAMAVIRTUALPROVEEDOR)   AS "plataforma",
              TRIM(cv.CRONOGRAMAVIRTUALURL)         AS "url",
              TRIM(cv.CRONOGRAMAVIRTUALUSUARIOSENA) AS "usuarioSena",
              TRIM(cv.CRONOGRAMAVIRTUALCLAVESENA)   AS "claveSena",
              TRIM(cv.CRONOGRAMAVIRESTADORADICADO)  AS "estadoRadicado",
              cv.CRONOGRAMAVIRCAPACITADORVIRTUA     AS "capacitadorId",
              cv.CRONOGRAMAVIRCAPACITADORLSUPUN     AS "capSup1Id",
              cv.CRONOGRAMAVIRCAPACITADORSUPDOS     AS "capSup2Id",
              cv.CRONOGRAMAVIRCAPACITADORSUPTRE     AS "capSup3Id",
              cv.CRONOGRAMAVIRCAPACITADORSUPCUA     AS "capSup4Id",
              cv.CRONOGRAMAVIRPERFILUTID            AS "perfilUTId",
              cv.CRONOGRAMAVIRTUALPERFILUTSUPUN     AS "perfilSup1Id",
              cv.CRONOGRAMAVIRTUALPERFILUTSUPDO     AS "perfilSup2Id",
              cv.CRONOGRAMAVIRTUALPERFILUTSUPTR     AS "perfilSup3Id",
              cv.CRONOGRAMAVIRTUALPERFILUTSUPCU     AS "perfilSup4Id"
         FROM CRONOGRAMAVIRTUAL cv
         JOIN CRONOGRAMA c ON c.CRONOGRAMAID = cv.CRONOGRAMAID
        WHERE cv.CRONOGRAMAVIRTUALID = :1`,
      [actividadId],
    )
    if (!rows.length) throw new NotFoundException('Actividad virtual no encontrada.')
    return rows[0]
  }

  async patchSesionPresencial(sesionId: number, dto: PatchSesionPresencialDto) {
    await this.assertConvenioActivoPorSesionPresencial(sesionId)
    const sesRows: any[] = await this.ds.query(
      `SELECT cp.CRONOGRAMAID AS "cronogramaId",
              TRIM(cp.CRONOGRAMAESTADORADICADO) AS "estadoRadicado",
              c.CRONOGRAMAFECHAINICIO AS "fechaInicio",
              c.CRONOGRAMAFECHAFIN    AS "fechaFin"
         FROM CRONOGRAMAPRESENCIAL cp
         JOIN CRONOGRAMA c ON c.CRONOGRAMAID = cp.CRONOGRAMAID
        WHERE cp.CRONOGRAMAPRESENCIALID = :1`,
      [sesionId],
    )
    if (!sesRows.length) throw new NotFoundException('Sesión no encontrada.')
    const ses = sesRows[0]
    if (estadoBloqueaEdicion(ses.estadoRadicado)) {
      throw new BadRequestException('Esta sesión ya fue radicada; no se puede editar (espera a que interventoría la devuelva para corrección).')
    }

    if (dto.fechaInicio) {
      const fIniStr = new Date(ses.fechaInicio).toISOString().slice(0, 10)
      const fFinStr = new Date(ses.fechaFin).toISOString().slice(0, 10)
      if (dto.fechaInicio < fIniStr) throw new BadRequestException(`La fecha es anterior al cronograma (${fIniStr}).`)
      if (dto.fechaInicio > fFinStr) throw new BadRequestException(`La fecha es posterior al cronograma (${fFinStr}).`)
    }

    let numHoras: number | undefined
    if (dto.horaInicio || dto.horaFin) {
      if (!dto.horaInicio || !dto.horaFin) {
        throw new BadRequestException('Si modifica una hora, debe enviar ambas (inicio y fin).')
      }
      const [hi, mi] = dto.horaInicio.split(':').map(Number)
      const [hf, mf] = dto.horaFin.split(':').map(Number)
      const minIni = hi * 60 + mi
      const minFin = hf * 60 + mf
      if (minFin <= minIni) throw new BadRequestException('La hora fin debe ser posterior a la hora inicio.')
      numHoras = (minFin - minIni) / 60
      if (numHoras > 8) throw new BadRequestException('Una sesión no puede superar 8 horas.')
    }

    const sets: string[] = []
    const params: any[] = []
    const push = (col: string, val: any) => { sets.push(`${col} = :${params.length + 1}`); params.push(val) }

    if (dto.nombreSesion !== undefined) push('CRONOGRAMAPRESENCIALNOMBRESESI', dto.nombreSesion)
    if (dto.fechaInicio) push('CRONOGRAMAPRESENCIALFECHAINICI', new Date(`${dto.fechaInicio}T05:00:00.000Z`))
    if (dto.horaInicio) push('CRONOGRAMAPRESENCIALHORAINICIO', new Date(`1899-12-31T${dto.horaInicio}:00.000-05:00`))
    if (dto.horaFin) push('CRONOGRAMAPRESENCIALHORAFIN', new Date(`1899-12-31T${dto.horaFin}:00.000-05:00`))
    if (numHoras !== undefined) push('CRONOGRAMAPRESENCIALNUMHORAS', numHoras)
    if (dto.nombreSede !== undefined) push('CRONOGRAMAPRESENCIALNOMBRESEDE', dto.nombreSede || null)
    if (dto.direccion !== undefined) push('CRONOGRAMAPRESENCIALDIRECCION', dto.direccion || null)
    if (dto.aula !== undefined) push('CRONOGRAMAPRESENCIALAULA', dto.aula || null)
    if (dto.herramienta !== undefined) push('CRONOGRAMAHERRAMIENTA', dto.herramienta || null)
    if (dto.url !== undefined) push('CRONOGRAMAURL', dto.url || null)
    if (dto.coberturaId !== undefined) push('AFGRUPOCOBERTURAID', dto.coberturaId)
    if (dto.capacitadorId !== undefined) push('CRONOGRAMAPRESENCIALCAPAID', dto.capacitadorId)
    if (dto.capSup1Id !== undefined) push('CRONOGRAMAPRESENCIALCAPASUPUNO', dto.capSup1Id)
    if (dto.capSup2Id !== undefined) push('CRONOGRAMAPRESENCIALCAPASUPDOS', dto.capSup2Id)
    if (dto.capSup3Id !== undefined) push('CRONOGRAMAPRESENCIALCAPASUPTRE', dto.capSup3Id)
    if (dto.capSup4Id !== undefined) push('CRONOGRAMAPRESENCIALCAPASUPCUA', dto.capSup4Id)
    if (dto.perfilUTId !== undefined) push('CRONOGRAMAPREPERFILUTID', dto.perfilUTId)
    if (dto.perfilSup1Id !== undefined) push('CRONOGRAMAPRESENCIALPERFILUTUN', dto.perfilSup1Id)
    if (dto.perfilSup2Id !== undefined) push('CRONOGRAMAPRESENCIALPERFILUTDO', dto.perfilSup2Id)
    if (dto.perfilSup3Id !== undefined) push('CRONOGRAMAPRESENCIALPERFILUTTR', dto.perfilSup3Id)
    if (dto.perfilSup4Id !== undefined) push('CRONOGRAMAPRESENCIALPERFILUTCU', dto.perfilSup4Id)

    if (!sets.length) return { ok: true, changed: 0 }

    params.push(sesionId)
    await this.ds.query(
      `UPDATE CRONOGRAMAPRESENCIAL SET ${sets.join(', ')} WHERE CRONOGRAMAPRESENCIALID = :${params.length}`,
      params,
    )
    return { ok: true, changed: sets.length }
  }

  async patchSesionVirtual(actividadId: number, dto: PatchSesionVirtualDto) {
    await this.assertConvenioActivoPorSesionVirtual(actividadId)
    const sesRows: any[] = await this.ds.query(
      `SELECT cv.CRONOGRAMAID AS "cronogramaId",
              TRIM(cv.CRONOGRAMAVIRESTADORADICADO) AS "estadoRadicado",
              c.CRONOGRAMAFECHAINICIO AS "fechaInicio",
              c.CRONOGRAMAFECHAFIN    AS "fechaFin"
         FROM CRONOGRAMAVIRTUAL cv
         JOIN CRONOGRAMA c ON c.CRONOGRAMAID = cv.CRONOGRAMAID
        WHERE cv.CRONOGRAMAVIRTUALID = :1`,
      [actividadId],
    )
    if (!sesRows.length) throw new NotFoundException('Actividad no encontrada.')
    const ses = sesRows[0]
    if (estadoBloqueaEdicion(ses.estadoRadicado)) {
      throw new BadRequestException('Esta actividad ya fue radicada; no se puede editar (espera a que interventoría la devuelva para corrección).')
    }

    const fIniStr = new Date(ses.fechaInicio).toISOString().slice(0, 10)
    const fFinStr = new Date(ses.fechaFin).toISOString().slice(0, 10)
    if (dto.fechaInicio && dto.fechaInicio < fIniStr) throw new BadRequestException(`La fecha es anterior al cronograma (${fIniStr}).`)
    if (dto.fechaFin && dto.fechaFin > fFinStr) throw new BadRequestException(`La fecha fin es posterior al cronograma (${fFinStr}).`)
    if (dto.fechaInicio && dto.fechaFin && dto.fechaFin < dto.fechaInicio) {
      throw new BadRequestException('La fecha fin no puede ser menor a la fecha de inicio.')
    }
    if (dto.horas !== undefined && Number(dto.horas) <= 0) {
      throw new BadRequestException('Las horas deben ser mayores a 0.')
    }

    const sets: string[] = []
    const params: any[] = []
    const push = (col: string, val: any) => { sets.push(`${col} = :${params.length + 1}`); params.push(val) }

    if (dto.nombreActividad !== undefined) push('CRONOGRAMAVIRTUALNOMBRE', dto.nombreActividad)
    if (dto.fechaInicio) push('CRONOGRAMAVIRTUALFECHAINICIO', new Date(`${dto.fechaInicio}T05:00:00.000Z`))
    if (dto.fechaFin) push('CRONOGRAMAVIRTUALFECHAFINAL', new Date(`${dto.fechaFin}T05:00:00.000Z`))
    if (dto.horas !== undefined) push('CRONOGRAMAVIRTUALNUMHORAS', Number(dto.horas))
    if (dto.plataforma !== undefined) push('CRONOGRAMAVIRTUALPROVEEDOR', dto.plataforma || null)
    if (dto.url !== undefined) push('CRONOGRAMAVIRTUALURL', dto.url || null)
    if (dto.usuarioSena !== undefined) push('CRONOGRAMAVIRTUALUSUARIOSENA', dto.usuarioSena || null)
    if (dto.claveSena !== undefined) push('CRONOGRAMAVIRTUALCLAVESENA', dto.claveSena || null)
    if (dto.capacitadorId !== undefined) push('CRONOGRAMAVIRCAPACITADORVIRTUA', dto.capacitadorId)
    if (dto.capSup1Id !== undefined) push('CRONOGRAMAVIRCAPACITADORLSUPUN', dto.capSup1Id)
    if (dto.capSup2Id !== undefined) push('CRONOGRAMAVIRCAPACITADORSUPDOS', dto.capSup2Id)
    if (dto.capSup3Id !== undefined) push('CRONOGRAMAVIRCAPACITADORSUPTRE', dto.capSup3Id)
    if (dto.capSup4Id !== undefined) push('CRONOGRAMAVIRCAPACITADORSUPCUA', dto.capSup4Id)
    if (dto.perfilUTId !== undefined) push('CRONOGRAMAVIRPERFILUTID', dto.perfilUTId)
    if (dto.perfilSup1Id !== undefined) push('CRONOGRAMAVIRTUALPERFILUTSUPUN', dto.perfilSup1Id)
    if (dto.perfilSup2Id !== undefined) push('CRONOGRAMAVIRTUALPERFILUTSUPDO', dto.perfilSup2Id)
    if (dto.perfilSup3Id !== undefined) push('CRONOGRAMAVIRTUALPERFILUTSUPTR', dto.perfilSup3Id)
    if (dto.perfilSup4Id !== undefined) push('CRONOGRAMAVIRTUALPERFILUTSUPCU', dto.perfilSup4Id)

    if (!sets.length) return { ok: true, changed: 0 }

    params.push(actividadId)
    await this.ds.query(
      `UPDATE CRONOGRAMAVIRTUAL SET ${sets.join(', ')} WHERE CRONOGRAMAVIRTUALID = :${params.length}`,
      params,
    )
    return { ok: true, changed: sets.length }
  }

  async eliminarSesionVirtual(actividadId: number) {
    await this.assertConvenioActivoPorSesionVirtual(actividadId)
    const qr = this.ds.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      const rows: any[] = await qr.query(
        `SELECT CRONOGRAMAID AS "cronogramaId",
                TRIM(CRONOGRAMAVIRESTADORADICADO) AS "estadoRadicado"
           FROM CRONOGRAMAVIRTUAL
          WHERE CRONOGRAMAVIRTUALID = :1`,
        [actividadId],
      )
      if (!rows.length) throw new NotFoundException('Actividad virtual no encontrada.')
      if (estadoBloqueaEdicion(rows[0].estadoRadicado)) {
        throw new BadRequestException('Esta actividad ya fue radicada; no se puede eliminar (espera a que interventoría la devuelva para corrección).')
      }
      const cronogramaId = Number(rows[0].cronogramaId)

      await qr.query(
        `DELETE FROM CRONOGRAMAVIRTUAL WHERE CRONOGRAMAVIRTUALID = :1`, [actividadId],
      )
      await qr.query(
        `UPDATE CRONOGRAMA
            SET CRONONUMTOTALACT = GREATEST(NVL(CRONONUMTOTALACT, 0) - 1, 0)
          WHERE CRONOGRAMAID = :1`,
        [cronogramaId],
      )

      await qr.commitTransaction()
      return { ok: true }
    } catch (e) {
      await qr.rollbackTransaction()
      throw e
    } finally {
      await qr.release()
    }
  }
}

function armarNombreCap(r: {
  capacitadorTipo?: string | null
  capPersonaNom?: string | null
  capPersonaApe1?: string | null
  capPersonaApe2?: string | null
  capEmpresaNom?: string | null
}): string | null {
  if (!r.capacitadorTipo) return null
  if (r.capacitadorTipo === 'PE') {
    const partes = [r.capPersonaNom, r.capPersonaApe1, r.capPersonaApe2].filter(Boolean)
    return partes.length ? partes.join(' ') : null
  }
  return r.capEmpresaNom || null
}
