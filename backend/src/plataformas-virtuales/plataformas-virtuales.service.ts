import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import ExcelJS from 'exceljs'

/** DTO del módulo conveniente para crear o actualizar una plataforma virtual.
 *  Solo expone los 4 campos del legacy "Agregar Plataforma Virtual":
 *  Fecha de remisión, Link, Usuario y Clave. Las respuestas de interventoría
 *  y SENA se diligencian en otros módulos. */
export interface PlataformaVirtualDto {
  fechaRemi: string  // YYYY-MM-DD
  link: string
  usuario: string
  clave: string
}

const ESTADO_LBL: Record<number, string> = {
  1: 'APROBADO',
  2: 'NO APROBADO',
  3: 'SIN RESPUESTA',
}
const VAL_SENA_LBL: Record<number, string> = { 1: 'CUMPLE', 2: 'NO CUMPLE' }

@Injectable()
export class PlataformasVirtualesService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Lista de plataformas virtuales del proyecto para la tabla. */
  async listar(proyectoId: number) {
    const rows: Array<{
      id: number; proyectoId: number;
      link: string; usuario: string; clave: string;
      estado: number; fechaRemi: Date | null;
      empresaRazonSocial: string | null; empresaSigla: string | null;
      convenioNumero: string | null;
      valSena: number | null;
    }> = await this.ds.query(
      `SELECT pv.PLATAFORMASVIRTUALESID         AS "id",
              pv.PROYECTOID                     AS "proyectoId",
              TRIM(pv.PLATAFORMASVIRTUALESLINK) AS "link",
              TRIM(pv.PLATAFORMASVIRTUALESUSUARIO) AS "usuario",
              TRIM(pv.PLATAFORMASVIRTUALESCLAVE)   AS "clave",
              pv.PLATAFORMASVIRTUALESESTADO     AS "estado",
              pv.PLATAFORMASVIRTUALESFECHAREMI  AS "fechaRemi",
              pv.PLATAFORMASVIRTUALESVALSENA    AS "valSena",
              TRIM(e.EMPRESARAZONSOCIAL)        AS "empresaRazonSocial",
              TRIM(e.EMPRESASIGLA)              AS "empresaSigla",
              TRIM(cv.CONVENIOSNUMERO)          AS "convenioNumero"
         FROM PLATAFORMASVIRTUALES pv
         JOIN PROYECTO p          ON p.PROYECTOID = pv.PROYECTOID
         LEFT JOIN CONVENIOS cv   ON cv.PROYECTOID = p.PROYECTOID
         LEFT JOIN EMPRESA e      ON e.EMPRESAID = p.EMPRESAID
        WHERE pv.PROYECTOID = :1
        ORDER BY pv.PLATAFORMASVIRTUALESID`,
      [proyectoId],
    )
    const [conv] = await this.ds.query(
      `SELECT NVL(CONVENIOSESTADO, 0) AS "estado" FROM CONVENIOS
        WHERE PROYECTOID = :1 ORDER BY CONVENIOSID DESC FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )
    return {
      plataformas: rows.map(r => ({
        ...r,
        estadoLabel: ESTADO_LBL[Number(r.estado)] ?? 'SIN EVALUAR',
        valSenaLabel: r.valSena != null ? (VAL_SENA_LBL[Number(r.valSena)] ?? 'SIN VALIDAR') : 'SIN VALIDAR',
      })),
      convenioEnEjecucion: Number(conv?.estado) === 1,
    }
  }

  /** Detalle de una plataforma virtual para el modal de edición. */
  async getOne(proyectoId: number, id: number) {
    const [row] = await this.ds.query(
      `SELECT pv.*
         FROM PLATAFORMASVIRTUALES pv
        WHERE pv.PLATAFORMASVIRTUALESID = :1 AND pv.PROYECTOID = :2
        FETCH FIRST 1 ROW ONLY`,
      [id, proyectoId],
    )
    if (!row) throw new NotFoundException('Plataforma virtual no encontrada.')
    return {
      id: Number(row.PLATAFORMASVIRTUALESID),
      proyectoId: Number(row.PROYECTOID),
      fechaRemi: row.PLATAFORMASVIRTUALESFECHAREMI,
      link: (row.PLATAFORMASVIRTUALESLINK ?? '').toString().trim(),
      usuario: (row.PLATAFORMASVIRTUALESUSUARIO ?? '').toString().trim(),
      clave: (row.PLATAFORMASVIRTUALESCLAVE ?? '').toString().trim(),
      estado: Number(row.PLATAFORMASVIRTUALESESTADO ?? 0),
      // Interventoría
      radInter: (row.PLATAFORMASVIRTUALESRADINTER ?? '').toString().trim(),
      radResInter: (row.PLATAFORMASVIRTUALESRADRESINTE ?? '').toString().trim(),
      fecRadRes: row.PLATAFORMASVIRTUALESFECRADRES,
      observacion: (row.PLATAFORMASVIRTUALESOBSERVACIO ?? '').toString().trim(),
      usuRegistro: Number(row.PLATAFORMASVIRTUALESUSUREGISTR ?? 0),
      // SENA
      nisSena: (row.PLATAFORMASVIRTUALESNISSENA ?? '').toString().trim(),
      radSena: (row.PLATAFORMASVIRTUALESRADSENA ?? '').toString().trim(),
      fecRadSena: row.PLATAFORMASVIRTUALESFECRADSENA,
      obsSena: (row.PLATAFORMASVIRTUALESOBSSENA ?? '').toString().trim(),
      valSena: row.PLATAFORMASVIRTUALESVALSENA != null ? Number(row.PLATAFORMASVIRTUALESVALSENA) : 0,
      usuSena: Number(row.PLATAFORMASVIRTUALESUSUSENA ?? 0),
    }
  }

  private validar(dto: PlataformaVirtualDto) {
    if (!dto.fechaRemi) throw new BadRequestException('Ingresa la fecha de remisión.')
    if (!dto.link?.trim()) throw new BadRequestException('Ingresa el link de la plataforma virtual.')
    if (!dto.usuario?.trim()) throw new BadRequestException('Ingresa el usuario de acceso.')
    if (!dto.clave?.trim()) throw new BadRequestException('Ingresa la clave de acceso.')
  }

  /** El conveniente solo puede editar mientras la interventoría aún no apruebe
   *  o rechace (ESTADO ∉ {1,2}) y el SENA no haya validado (VALSENA ∉ {1,2}). */
  private exigirEditableConveniente(row: { estado: number; valSena: number }) {
    const estado = Number(row.estado ?? 0)
    if (estado === 1 || estado === 2) {
      throw new ForbiddenException(
        `La plataforma virtual ya fue ${estado === 1 ? 'aprobada' : 'rechazada'} por la interventoría y no puede ser editada por el conveniente.`,
      )
    }
    const valSena = Number(row.valSena ?? 0)
    if (valSena === 1 || valSena === 2) {
      throw new ForbiddenException(
        `El SENA ya validó la plataforma virtual (${VAL_SENA_LBL[valSena]}) y no puede ser editada.`,
      )
    }
  }

  /** Crea una nueva plataforma virtual (lado conveniente). */
  async crear(proyectoId: number, dto: PlataformaVirtualDto): Promise<{ mensaje: string; id: number }> {
    this.validar(dto)
    const [{ nid }] = await this.ds.query(
      `SELECT NVL(MAX(PLATAFORMASVIRTUALESID), 0) + 1 AS "nid" FROM PLATAFORMASVIRTUALES`,
    )
    const id = Number(nid)

    // Todas las columnas son NOT NULL; los campos que aún no aplican se llenan con
    // placeholders (N' ' para texto, SYSDATE para fechas, 0 para usuarios/estado).
    await this.ds.query(
      `INSERT INTO PLATAFORMASVIRTUALES
         (PLATAFORMASVIRTUALESID, PROYECTOID,
          PLATAFORMASVIRTUALESFECHAREMI, PLATAFORMASVIRTUALESRADINTER, PLATAFORMASVIRTUALESRADRESINTE,
          PLATAFORMASVIRTUALESFECRADRES, PLATAFORMASVIRTUALESRADSENA, PLATAFORMASVIRTUALESNISSENA,
          PLATAFORMASVIRTUALESFECRADSENA, PLATAFORMASVIRTUALESLINK, PLATAFORMASVIRTUALESUSUARIO,
          PLATAFORMASVIRTUALESCLAVE, PLATAFORMASVIRTUALESESTADO, PLATAFORMASVIRTUALESFECHAREG,
          PLATAFORMASVIRTUALESUSUREGISTR, PLATAFORMASVIRTUALESOBSERVACIO,
          PLATAFORMASVIRTUALESUSUSENA, PLATAFORMASVIRTUALESOBSSENA, PLATAFORMASVIRTUALESVALSENA)
       VALUES (:1, :2,
               TO_DATE(:3, 'YYYY-MM-DD'), N' ', N' ',
               SYSDATE, N' ', N' ',
               SYSDATE, :4, :5,
               :6, 0, SYSDATE,
               0, N' ',
               0, N' ', 0)`,
      [
        id, proyectoId,
        dto.fechaRemi,
        dto.link.trim(), dto.usuario.trim(), dto.clave.trim(),
      ],
    )
    return { mensaje: 'Plataforma virtual registrada correctamente.', id }
  }

  /** Actualiza una plataforma virtual (lado conveniente).
   *  Valida que la interventoría no haya emitido veredicto y que el SENA no
   *  haya validado. Solo modifica fechaRemi, link, usuario y clave. */
  async actualizar(proyectoId: number, id: number, dto: PlataformaVirtualDto): Promise<{ mensaje: string }> {
    this.validar(dto)
    const [existe] = await this.ds.query(
      `SELECT PLATAFORMASVIRTUALESESTADO AS "estado",
              PLATAFORMASVIRTUALESVALSENA AS "valSena"
         FROM PLATAFORMASVIRTUALES
        WHERE PLATAFORMASVIRTUALESID = :1 AND PROYECTOID = :2 FETCH FIRST 1 ROW ONLY`,
      [id, proyectoId],
    )
    if (!existe) throw new NotFoundException('Plataforma virtual no encontrada.')
    this.exigirEditableConveniente(existe)

    await this.ds.query(
      `UPDATE PLATAFORMASVIRTUALES SET
          PLATAFORMASVIRTUALESFECHAREMI = TO_DATE(:1, 'YYYY-MM-DD'),
          PLATAFORMASVIRTUALESLINK      = :2,
          PLATAFORMASVIRTUALESUSUARIO   = :3,
          PLATAFORMASVIRTUALESCLAVE     = :4
        WHERE PLATAFORMASVIRTUALESID = :5`,
      [
        dto.fechaRemi,
        dto.link.trim(), dto.usuario.trim(), dto.clave.trim(),
        id,
      ],
    )
    return { mensaje: 'Plataforma virtual actualizada.' }
  }

  /** Elimina una plataforma virtual (solo admin). */
  async eliminar(proyectoId: number, id: number, perfilId: number): Promise<{ mensaje: string }> {
    const PERFIL_ADMIN = 1
    if (perfilId !== PERFIL_ADMIN) {
      throw new ForbiddenException('Solo el administrador puede eliminar plataformas virtuales.')
    }
    const [existe] = await this.ds.query(
      `SELECT PLATAFORMASVIRTUALESID AS "id" FROM PLATAFORMASVIRTUALES
        WHERE PLATAFORMASVIRTUALESID = :1 AND PROYECTOID = :2 FETCH FIRST 1 ROW ONLY`,
      [id, proyectoId],
    )
    if (!existe) throw new NotFoundException('Plataforma virtual no encontrada.')
    await this.ds.query(`DELETE FROM PLATAFORMASVIRTUALES WHERE PLATAFORMASVIRTUALESID = :1`, [id])
    return { mensaje: 'Plataforma virtual eliminada.' }
  }

  /** Exporta a Excel todas las plataformas virtuales del proyecto.
   *  Mantiene las 24 columnas del legacy `PExportarHerramienta`. */
  async exportarExcel(proyectoId: number): Promise<{ buffer: Buffer; filename: string }> {
    type Row = {
      id: number; consec: number;
      convocatoria: string; conveniosNumero: string;
      empresaIdentificacion: number | null; empresaDigitoVerif: number | null;
      empresaRazonSocial: string; empresaSigla: string; proyectoIdVal: number;
      fechaRemi: Date | null; radInter: string;
      fecRadRes: Date | null; radResInter: string;
      nisSena: string; radSena: string; fecRadSena: Date | null;
      link: string; usuario: string; clave: string;
      estado: number; usuRegistroInter: string;
      observacion: string; valSena: number | null;
      obsSena: string; usuRegistroSena: string;
    }
    const rows: Row[] = await this.ds.query(
      `SELECT pv.PLATAFORMASVIRTUALESID                 AS "id",
              ROW_NUMBER() OVER (ORDER BY pv.PLATAFORMASVIRTUALESID) AS "consec",
              TRIM(co.CONVOCATORIANOMBRE)               AS "convocatoria",
              TRIM(cv.CONVENIOSNUMERO)                  AS "conveniosNumero",
              e.EMPRESAIDENTIFICACION                   AS "empresaIdentificacion",
              e.EMPRESADIGITOVERIFICACION               AS "empresaDigitoVerif",
              TRIM(e.EMPRESARAZONSOCIAL)                AS "empresaRazonSocial",
              TRIM(e.EMPRESASIGLA)                      AS "empresaSigla",
              p.PROYECTOID                              AS "proyectoIdVal",
              pv.PLATAFORMASVIRTUALESFECHAREMI          AS "fechaRemi",
              TRIM(pv.PLATAFORMASVIRTUALESRADINTER)     AS "radInter",
              pv.PLATAFORMASVIRTUALESFECRADRES          AS "fecRadRes",
              TRIM(pv.PLATAFORMASVIRTUALESRADRESINTE)   AS "radResInter",
              TRIM(pv.PLATAFORMASVIRTUALESNISSENA)      AS "nisSena",
              TRIM(pv.PLATAFORMASVIRTUALESRADSENA)      AS "radSena",
              pv.PLATAFORMASVIRTUALESFECRADSENA         AS "fecRadSena",
              TRIM(pv.PLATAFORMASVIRTUALESLINK)         AS "link",
              TRIM(pv.PLATAFORMASVIRTUALESUSUARIO)      AS "usuario",
              TRIM(pv.PLATAFORMASVIRTUALESCLAVE)        AS "clave",
              pv.PLATAFORMASVIRTUALESESTADO             AS "estado",
              (SELECT TRIM(pp.PERSONANOMBRES) || N' ' || TRIM(pp.PERSONAPRIMERAPELLIDO)
                 FROM USUARIO us LEFT JOIN PERSONA pp ON pp.PERSONAEMAIL = us.USUARIOEMAIL
                WHERE us.USUARIOID = pv.PLATAFORMASVIRTUALESUSUREGISTR
                FETCH FIRST 1 ROW ONLY)                AS "usuRegistroInter",
              TRIM(pv.PLATAFORMASVIRTUALESOBSERVACIO)   AS "observacion",
              pv.PLATAFORMASVIRTUALESVALSENA            AS "valSena",
              TRIM(pv.PLATAFORMASVIRTUALESOBSSENA)      AS "obsSena",
              (SELECT TRIM(pp.PERSONANOMBRES) || N' ' || TRIM(pp.PERSONAPRIMERAPELLIDO)
                 FROM USUARIO us LEFT JOIN PERSONA pp ON pp.PERSONAEMAIL = us.USUARIOEMAIL
                WHERE us.USUARIOID = pv.PLATAFORMASVIRTUALESUSUSENA
                FETCH FIRST 1 ROW ONLY)                AS "usuRegistroSena"
         FROM PLATAFORMASVIRTUALES pv
         JOIN PROYECTO p           ON p.PROYECTOID = pv.PROYECTOID
         LEFT JOIN CONVENIOS cv    ON cv.PROYECTOID = p.PROYECTOID
         LEFT JOIN EMPRESA e       ON e.EMPRESAID = p.EMPRESAID
         LEFT JOIN CONVOCATORIA co ON co.CONVOCATORIAID = p.CONVOCATORIAID
        WHERE pv.PROYECTOID = :1
        ORDER BY pv.PLATAFORMASVIRTUALESID`,
      [proyectoId],
    )

    const wb = new ExcelJS.Workbook()
    wb.creator = 'SEP'
    wb.created = new Date()
    const ws = wb.addWorksheet('Plataformas Virtuales')
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
      'NO.', 'CONVOCATORIA', 'NO. DE CONVENIO', 'IDENTIFICACIÓN',
      'CONVENIO', 'DIGITO VERIFICACIÓN', 'SIGLA', 'PROYECTO',
      'FECHA REMISIÓN', 'RADICADO REMISIÓN',
      'FECHA RESPUESTA INTERVENTORÍA', 'RESPUESTA INTERVENTORÍA',
      'NIS SENA', 'RADICADO SENA', 'FECHA RADICADO SENA',
      'LINK DE PLATAFORMA', 'USUARIO', 'CLAVE', 'ESTADO',
      'USUARIO INTERVENTORÍA', 'OBSERVACIÓN INTERVENTORÍA',
      'VALIDACIÓN SENA', 'OBSERVACIÓN SENA', 'PROFESIONAL SENA',
    ]
    const headerRow = ws.addRow(headers)
    headerRow.eachCell(c => headerStyle(c))
    ws.getRow(1).height = 36

    for (const r of rows) {
      ws.addRow([
        Number(r.consec),
        (r.convocatoria ?? '').toString().toUpperCase(),
        (r.conveniosNumero ?? '').toString().toUpperCase(),
        r.empresaIdentificacion ?? '',
        (r.empresaRazonSocial ?? '').toString().toUpperCase(),
        r.empresaDigitoVerif ?? '',
        (r.empresaSigla ?? '').toString().toUpperCase(),
        Number(r.proyectoIdVal),
        r.fechaRemi ?? '',
        (r.radInter ?? '').toString().toUpperCase(),
        r.fecRadRes ?? '',
        (r.radResInter ?? '').toString().toUpperCase(),
        (r.nisSena ?? '').toString().toUpperCase(),
        (r.radSena ?? '').toString().toUpperCase(),
        r.fecRadSena ?? '',
        r.link ?? '',
        r.usuario ?? '',
        r.clave ?? '',
        ESTADO_LBL[Number(r.estado)] ?? 'SIN EVALUAR',
        (r.usuRegistroInter ?? '').toString().toUpperCase().trim(),
        (r.observacion ?? '').toString().toUpperCase(),
        r.valSena != null && Number(r.valSena) !== 0
          ? (VAL_SENA_LBL[Number(r.valSena)] ?? 'SIN VALIDAR')
          : 'SIN VALIDAR',
        (r.obsSena ?? '').toString().toUpperCase(),
        (r.usuRegistroSena ?? '').toString().toUpperCase().trim(),
      ])
    }

    const widths = [5, 30, 22, 18, 30, 14, 18, 12, 18, 22, 22, 26, 18, 22, 22, 40, 24, 18, 16, 26, 30, 16, 30, 26]
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

    const arrayBuf = await wb.xlsx.writeBuffer()
    return { buffer: Buffer.from(arrayBuf), filename: `Plataformas_Virtuales_proyecto_${proyectoId}.xlsx` }
  }
}
