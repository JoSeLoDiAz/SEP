import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import ExcelJS from 'exceljs'

// lo que envía el conveniente; interventoría y SENA responden en otro módulo
export interface ModificacionDto {
  tipoModificacionId: number
  fechaEnvio: string             // YYYY-MM-DD
  observaciones?: string | null
}

const CONCEPTO_LBL: Record<number, string> = {
  1: 'VIABLE', 2: 'NO VIABLE', 3: 'VIABLE PARCIALMENTE', 4: 'PENDIENTE',
}
const CONCEPTO_SENA_LBL: Record<number, string> = {
  1: 'VIABLE', 2: 'NO VIABLE', 3: 'VIABLE PARCIALMENTE', 4: 'PENDIENTE', 5: 'NO APLICA',
}
const RESPUESTA_LBL: Record<number, string> = {
  1: 'SIN RESPONDER', 2: 'EN TRÁMITE', 3: 'RESPONDIDO',
}
const APROBACION_LBL: Record<number, string> = { 0: 'NA', 1: 'SI', 2: 'NO' }
const VAL_SENA_LBL: Record<number, string> = { 1: 'CUMPLE', 2: 'NO CUMPLE' }

@Injectable()
export class ModificacionesService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async listarTipos() {
    return this.ds.query(
      `SELECT TIPOMODIFICACIONID AS "id", TRIM(TIPOMODIFICACIONNOMBRE) AS "nombre"
         FROM TIPOMODIFICACION
        WHERE TIPOMODIFICACIONESTADO = 1
        ORDER BY TIPOMODIFICACIONID`,
    )
  }

  async listar(proyectoId: number) {
    const rows = await this.ds.query(
      `SELECT m.MODIFICACIONESID                        AS "id",
              m.PROYECTOID                              AS "proyectoId",
              m.TIPOMODIFICACIONID                      AS "tipoModificacionId",
              UPPER(TRIM(tm.TIPOMODIFICACIONNOMBRE))    AS "tipoModificacion",
              TRIM(cv.CONVENIOSNUMERO)                  AS "convenioNumero",
              UPPER(TRIM(e.EMPRESASIGLA))               AS "empresaSigla",
              UPPER(TRIM(e.EMPRESARAZONSOCIAL))         AS "empresaRazonSocial",
              m.MODIFICACIONESCONCEPTO                  AS "concepto",
              m.MODIFICACIONESCONCEPTOSENA              AS "conceptoSena",
              m.MODIFICACIONESESTADO                    AS "estado",
              m.MODIFICACIONESFECHAENVIO                AS "fechaEnvio",
              m.MODIFICACIONESFECHAREMI                 AS "fechaRecepcion",
              m.MODIFICACIONESFECHAREGIS                AS "fechaRegistro"
         FROM MODIFICACIONES m
         JOIN TIPOMODIFICACION tm ON tm.TIPOMODIFICACIONID = m.TIPOMODIFICACIONID
         JOIN PROYECTO p          ON p.PROYECTOID = m.PROYECTOID
         LEFT JOIN CONVENIOS cv   ON cv.PROYECTOID = p.PROYECTOID
         LEFT JOIN EMPRESA e      ON e.EMPRESAID = p.EMPRESAID
        WHERE m.PROYECTOID = :1
        ORDER BY m.MODIFICACIONESID`,
      [proyectoId],
    )
    // el front usa este estado para gatear la edición
    const [conv] = await this.ds.query(
      `SELECT NVL(CONVENIOSESTADO, 0) AS "estado" FROM CONVENIOS
        WHERE PROYECTOID = :1 ORDER BY CONVENIOSID DESC FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )
    return {
      modificaciones: rows.map((r: { concepto: number; conceptoSena: number; estado: number }) => ({
        ...r,
        conceptoLabel: CONCEPTO_LBL[Number(r.concepto)] ?? 'SIN CONCEPTO',
        conceptoSenaLabel: CONCEPTO_SENA_LBL[Number(r.conceptoSena)] ?? 'SIN CONCEPTO SENA',
        estadoLabel: Number(r.estado) === 1 ? 'ACTIVO' : 'INACTIVO',
      })),
      convenioEnEjecucion: Number(conv?.estado) === 1,
    }
  }

  async getOne(proyectoId: number, id: number) {
    const [row] = await this.ds.query(
      `SELECT m.*
         FROM MODIFICACIONES m
        WHERE m.MODIFICACIONESID = :1 AND m.PROYECTOID = :2
        FETCH FIRST 1 ROW ONLY`,
      [id, proyectoId],
    )
    if (!row) throw new NotFoundException('Modificación no encontrada.')
    // el SELECT m.* devuelve las columnas en mayúsculas: hay que mapearlas
    return {
      id: Number(row.MODIFICACIONESID),
      proyectoId: Number(row.PROYECTOID),
      tipoModificacionId: Number(row.TIPOMODIFICACIONID),
      fechaEnvio: row.MODIFICACIONESFECHAENVIO,
      fechaRecepcion: row.MODIFICACIONESFECHAREMI,
      concepto: Number(row.MODIFICACIONESCONCEPTO),
      observaciones: (row.MODIFICACIONESOBSERVACIONES ?? '').toString().trim() || null,
      observacionesInterventoria: (row.MODIFICACIONESOBSERINTER ?? '').toString().trim() || null,
      nisSena: (row.MODIFICACIONESNISSENA ?? '').toString().trim() || null,
      radiSena: (row.MODIFICACIONESRADISENA ?? '').toString().trim() || null,
      radiSenaFecha: row.MODIFICACIONESRADISENAFECHA,
      radiInter: (row.MODIFICACIONESRADIINTER ?? '').toString().trim() || null,
      radiInterFecha: row.MODIFICACIONESRADIINTERFECHA,
      aprobacionSena: row.MODIFICACIONESAPROBACIONSENA != null ? Number(row.MODIFICACIONESAPROBACIONSENA) : null,
      nisAproSena: (row.MODIFICACIONESNISAPROSENA ?? '').toString().trim() || null,
      radiSenaApro: (row.MODIFICACIONESRADISENAAPRO ?? '').toString().trim() || null,
      radiSenaAproFecha: row.MODIFICACIONESRADISENAAPROFECH,
      conceptoSena: Number(row.MODIFICACIONESCONCEPTOSENA),
      respuestaSena: Number(row.MODIFICACIONESRESPUESTASENA),
      radiInterApro: (row.MODIFICACIONESRADIINTERAPRO ?? '').toString().trim() || null,
      radiInterAproFecha: row.MODIFICACIONESRADIINTERAPROFEC,
      valSena: row.MODIFICACIONESVALSENA != null ? Number(row.MODIFICACIONESVALSENA) : null,
      observacionesSena: (row.MODIFICACIONESOBSERSENA ?? '').toString().trim() || null,
      estado: Number(row.MODIFICACIONESESTADO),
    }
  }

  private validar(dto: ModificacionDto) {
    if (!dto.tipoModificacionId) throw new BadRequestException('Selecciona el tipo de modificación.')
    if (!dto.fechaEnvio) throw new BadRequestException('Ingresa la fecha de envío.')
  }

  // concepto 4 = PENDIENTE y aprobación 0 = NA: único estado editable
  private exigirEditableConveniente(row: { concepto: number; aprobacionSena: number }) {
    if (Number(row.concepto) !== 4) {
      throw new ForbiddenException(
        'La modificación ya tiene concepto de la interventoría y no puede ser editada por el conveniente.',
      )
    }
    const aproSena = Number(row.aprobacionSena ?? 0)
    if (aproSena === 1 || aproSena === 2) {
      throw new ForbiddenException(
        'La modificación ya fue aprobada o rechazada por el SENA y no puede ser editada.',
      )
    }
  }

  async crear(proyectoId: number, dto: ModificacionDto, _usuarioId: number, _perfilId: number): Promise<{ mensaje: string; id: number }> {
    this.validar(dto)
    const [{ nid }] = await this.ds.query(
      `SELECT NVL(MAX(MODIFICACIONESID), 0) + 1 AS "nid" FROM MODIFICACIONES`,
    )
    const id = Number(nid)

    await this.ds.query(
      `INSERT INTO MODIFICACIONES
         (MODIFICACIONESID, PROYECTOID, TIPOMODIFICACIONID,
          MODIFICACIONESFECHAREGIS, MODIFICACIONESFECHAENVIO, MODIFICACIONESFECHAREMI,
          MODIFICACIONESCONCEPTO, MODIFICACIONESCONCEPTOSENA,
          MODIFICACIONESOBSERVACIONES, MODIFICACIONESOBSERINTER,
          MODIFICACIONESRADISENA, MODIFICACIONESRADISENAFECHA,
          MODIFICACIONESRADIINTER, MODIFICACIONESRADIINTERFECHA,
          MODIFICACIONESAPROBACIONSENA, MODIFICACIONESRADISENAAPRO, MODIFICACIONESRADISENAAPROFECH,
          MODIFICACIONESNISAPROSENA, MODIFICACIONESNISSENA, MODIFICACIONESRESPUESTASENA,
          MODIFICACIONESRADIINTERAPRO, MODIFICACIONESRADIINTERAPROFEC,
          MODIFICACIONESESTADO, MODIFICACIONESUSUARIOSENA, MODIFICACIONESUSUARIOINTER,
          MODIFICACIONESOBSERSENA, MODIFICACIONESVALSENA)
       VALUES (:1, :2, :3, SYSDATE,
               TO_DATE(:4, 'YYYY-MM-DD'),
               SYSDATE,
               4, 4, :5, N' ',
               N' ', NULL,
               N' ', NULL,
               0, N' ', NULL,
               N' ', N' ', 1,
               N' ', NULL,
               1, NULL, NULL, N' ', NULL)`,
      [
        id, proyectoId, Number(dto.tipoModificacionId),
        dto.fechaEnvio,
        (dto.observaciones ?? '').trim() || ' ',
      ],
    )
    return { mensaje: 'Modificación registrada correctamente.', id }
  }

  async actualizar(proyectoId: number, id: number, dto: ModificacionDto, _usuarioId: number, _perfilId: number): Promise<{ mensaje: string }> {
    this.validar(dto)
    const [existe] = await this.ds.query(
      `SELECT MODIFICACIONESCONCEPTO       AS "concepto",
              MODIFICACIONESAPROBACIONSENA AS "aprobacionSena"
         FROM MODIFICACIONES
        WHERE MODIFICACIONESID = :1 AND PROYECTOID = :2 FETCH FIRST 1 ROW ONLY`,
      [id, proyectoId],
    )
    if (!existe) throw new NotFoundException('Modificación no encontrada.')
    this.exigirEditableConveniente(existe)

    await this.ds.query(
      `UPDATE MODIFICACIONES SET
          TIPOMODIFICACIONID = :1,
          MODIFICACIONESFECHAENVIO = TO_DATE(:2, 'YYYY-MM-DD'),
          MODIFICACIONESOBSERVACIONES = :3
        WHERE MODIFICACIONESID = :4`,
      [
        Number(dto.tipoModificacionId),
        dto.fechaEnvio,
        (dto.observaciones ?? '').trim() || ' ',
        id,
      ],
    )
    return { mensaje: 'Modificación actualizada.' }
  }

  async eliminar(proyectoId: number, id: number, perfilId: number): Promise<{ mensaje: string }> {
    const PERFIL_ADMIN = 1
    if (perfilId !== PERFIL_ADMIN) {
      throw new ForbiddenException('Solo el administrador puede eliminar modificaciones.')
    }
    const [existe] = await this.ds.query(
      `SELECT MODIFICACIONESID AS "id" FROM MODIFICACIONES
        WHERE MODIFICACIONESID = :1 AND PROYECTOID = :2 FETCH FIRST 1 ROW ONLY`,
      [id, proyectoId],
    )
    if (!existe) throw new NotFoundException('Modificación no encontrada.')
    await this.ds.query(`DELETE FROM MODIFICACIONES WHERE MODIFICACIONESID = :1`, [id])
    return { mensaje: 'Modificación eliminada.' }
  }

  // excel de 28 columnas: headers, filas y anchos van en el mismo orden
  async exportarExcel(proyectoId: number): Promise<{ buffer: Buffer; filename: string }> {
    type Row = {
      id: number
      consec: number
      convocatoria: string
      conveniosNumero: string
      empresa: string
      tipoModificacion: string
      fechaEnvio: Date | null
      observaciones: string
      fechaRemi: Date | null
      concepto: number
      nisSena: string
      radiSena: string
      radiSenaFecha: Date | null
      radiInter: string
      radiInterFecha: Date | null
      observInter: string
      aprobacionSena: number | null
      nisAproSena: string
      radiSenaApro: string
      radiSenaAproFecha: Date | null
      conceptoSena: number
      respuestaSena: number
      radiInterApro: string
      radiInterAproFecha: Date | null
      valSena: number | null
      observSena: string
      usuarioSenaNombre: string
      usuarioInterNombre: string
      estado: number
    }
    const rows: Row[] = await this.ds.query(
      `SELECT m.MODIFICACIONESID AS "id",
              ROW_NUMBER() OVER (ORDER BY m.MODIFICACIONESID) AS "consec",
              TRIM(co.CONVOCATORIANOMBRE) AS "convocatoria",
              TRIM(cv.CONVENIOSNUMERO)    AS "conveniosNumero",
              TRIM(e.EMPRESARAZONSOCIAL)  AS "empresa",
              TRIM(tm.TIPOMODIFICACIONNOMBRE) AS "tipoModificacion",
              m.MODIFICACIONESFECHAENVIO  AS "fechaEnvio",
              TRIM(m.MODIFICACIONESOBSERVACIONES) AS "observaciones",
              m.MODIFICACIONESFECHAREMI   AS "fechaRemi",
              m.MODIFICACIONESCONCEPTO    AS "concepto",
              TRIM(m.MODIFICACIONESNISSENA) AS "nisSena",
              TRIM(m.MODIFICACIONESRADISENA) AS "radiSena",
              m.MODIFICACIONESRADISENAFECHA AS "radiSenaFecha",
              TRIM(m.MODIFICACIONESRADIINTER) AS "radiInter",
              m.MODIFICACIONESRADIINTERFECHA AS "radiInterFecha",
              TRIM(m.MODIFICACIONESOBSERINTER) AS "observInter",
              m.MODIFICACIONESAPROBACIONSENA AS "aprobacionSena",
              TRIM(m.MODIFICACIONESNISAPROSENA) AS "nisAproSena",
              TRIM(m.MODIFICACIONESRADISENAAPRO) AS "radiSenaApro",
              m.MODIFICACIONESRADISENAAPROFECH AS "radiSenaAproFecha",
              m.MODIFICACIONESCONCEPTOSENA AS "conceptoSena",
              m.MODIFICACIONESRESPUESTASENA AS "respuestaSena",
              TRIM(m.MODIFICACIONESRADIINTERAPRO) AS "radiInterApro",
              m.MODIFICACIONESRADIINTERAPROFEC AS "radiInterAproFecha",
              m.MODIFICACIONESVALSENA AS "valSena",
              TRIM(m.MODIFICACIONESOBSERSENA) AS "observSena",
              (SELECT TRIM(pp.PERSONANOMBRES) || N' ' || TRIM(pp.PERSONAPRIMERAPELLIDO)
                 FROM USUARIO us
                 LEFT JOIN PERSONA pp ON pp.PERSONAEMAIL = us.USUARIOEMAIL
                WHERE us.USUARIOID = m.MODIFICACIONESUSUARIOSENA
                FETCH FIRST 1 ROW ONLY) AS "usuarioSenaNombre",
              (SELECT TRIM(pp.PERSONANOMBRES) || N' ' || TRIM(pp.PERSONAPRIMERAPELLIDO)
                 FROM USUARIO us
                 LEFT JOIN PERSONA pp ON pp.PERSONAEMAIL = us.USUARIOEMAIL
                WHERE us.USUARIOID = m.MODIFICACIONESUSUARIOINTER
                FETCH FIRST 1 ROW ONLY) AS "usuarioInterNombre",
              m.MODIFICACIONESESTADO AS "estado"
         FROM MODIFICACIONES m
         JOIN TIPOMODIFICACION tm ON tm.TIPOMODIFICACIONID = m.TIPOMODIFICACIONID
         JOIN PROYECTO p         ON p.PROYECTOID = m.PROYECTOID
         LEFT JOIN CONVENIOS cv  ON cv.PROYECTOID = p.PROYECTOID
         LEFT JOIN EMPRESA e     ON e.EMPRESAID = p.EMPRESAID
         LEFT JOIN CONVOCATORIA co ON co.CONVOCATORIAID = p.CONVOCATORIAID
        WHERE m.PROYECTOID = :1
        ORDER BY m.MODIFICACIONESID`,
      [proyectoId],
    )

    const wb = new ExcelJS.Workbook()
    wb.creator = 'SEP'
    wb.created = new Date()
    const ws = wb.addWorksheet('Modificaciones')
    const FILL = '00304D'
    const headerStyle = (cell: ExcelJS.Cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + FILL } }
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      }
    }

    const headers = [
      'NO.', 'CONVOCATORIA', 'CÓDIGO SECOP', 'CONVENIO', 'TIPO DE MODIFICACIÓN',
      'FECHA DE ENVÍO DEL CONVENIO', 'OBSERVACIONES DEL CONVENIO',
      'FECHA DE RECEPCIÓN DE INTERVENTORÍA', 'CONCEPTO',
      'NIS RADICADO SENA', 'RADICADO SENA', 'FECHA RADICADO SENA',
      'RADICADO INTERVENTORÍA', 'FECHA RADICADO INTERVENTORÍA', 'OBSERVACIÓN INTERVENTORÍA',
      'APROBACIÓN SENA', 'NIS SENA DE APROBACIÓN', 'RADICADO SENA DE APROBACIÓN', 'FECHA RADICADO SENA DE APROBACIÓN',
      'CONCEPTO SENA DE APROBACIÓN', 'ESTADO DE RESPUESTA SENA DE APROBACIÓN',
      'RADICADO INTERVENTORÍA DE APROBACIÓN', 'FECHA RADICADO INTERVENTORÍA DE APROBACIÓN',
      'VERIFICACIÓN SENA', 'OBSERVACIÓN SENA', 'PROFESIONAL SENA', 'USUARIO INTERVENTORÍA', 'ESTADO',
    ]
    const headerRow = ws.addRow(headers)
    headerRow.eachCell(c => headerStyle(c))
    ws.getRow(1).height = 36

    for (const r of rows) {
      ws.addRow([
        Number(r.consec),
        (r.convocatoria ?? '').toString().toUpperCase(),
        (r.conveniosNumero ?? '').toString().toUpperCase(),
        (r.empresa ?? '').toString().toUpperCase(),
        (r.tipoModificacion ?? '').toString().toUpperCase(),
        r.fechaEnvio ?? '',
        (r.observaciones ?? '').toString().toUpperCase(),
        r.fechaRemi ?? '',
        CONCEPTO_LBL[Number(r.concepto)] ?? 'SIN CONCEPTO',
        (r.nisSena ?? '').toString().toUpperCase(),
        (r.radiSena ?? '').toString().toUpperCase(),
        r.radiSenaFecha ?? '',
        (r.radiInter ?? '').toString().toUpperCase(),
        r.radiInterFecha ?? '',
        (r.observInter ?? '').toString().toUpperCase(),
        APROBACION_LBL[Number(r.aprobacionSena ?? 0)] ?? 'NA',
        (r.nisAproSena ?? '').toString().toUpperCase(),
        (r.radiSenaApro ?? '').toString().toUpperCase(),
        r.radiSenaAproFecha ?? '',
        CONCEPTO_SENA_LBL[Number(r.conceptoSena)] ?? 'SIN CONCEPTO SENA',
        RESPUESTA_LBL[Number(r.respuestaSena)] ?? 'SIN RESPUESTA SENA',
        (r.radiInterApro ?? '').toString().toUpperCase(),
        r.radiInterAproFecha ?? '',
        r.valSena != null ? (VAL_SENA_LBL[Number(r.valSena)] ?? 'SIN VERIFICAR') : 'SIN VERIFICAR',
        (r.observSena ?? '').toString().toUpperCase(),
        (r.usuarioSenaNombre ?? '').toString().toUpperCase().trim(),
        (r.usuarioInterNombre ?? '').toString().toUpperCase().trim(),
        Number(r.estado) === 1 ? 'ACTIVO' : 'INACTIVO',
      ])
    }
    const widths = [5, 30, 20, 30, 26, 18, 35, 22, 18, 18, 20, 18, 22, 22, 30, 14, 22, 22, 22, 22, 22, 22, 22, 16, 30, 26, 26, 10]
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

    const arrayBuf = await wb.xlsx.writeBuffer()
    return { buffer: Buffer.from(arrayBuf), filename: `Modificaciones_proyecto_${proyectoId}.xlsx` }
  }
}
