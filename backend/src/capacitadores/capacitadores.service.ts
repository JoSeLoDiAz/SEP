import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { AHORA_UTC } from '../common/db/fecha-utc'
import { insertarConId, sqlCrudo } from '../common/db/ids'
import { leerDocumento } from '../common/documentos/documentos-disco'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const oracledb = require('oracledb') as { DB_TYPE_BLOB: number }

interface MulterFile {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

@Injectable()
export class CapacitadoresService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private async assertConvenioEnEjecucion(proyectoId: number): Promise<void> {
    const [row] = await this.ds.query(
      `SELECT COALESCE(CONVENIOSESTADO, 0) AS "estado"
         FROM CONVENIOS WHERE PROYECTOID = $1
        ORDER BY CONVENIOSID DESC FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )
    if (!row) throw new BadRequestException('Este proyecto no tiene convenio.')
    if (Number(row.estado) !== 1) {
      throw new ForbiddenException(
        'Esta acción no está disponible: el convenio no está en ejecución. El módulo de capacitadores solo permite consulta.',
      )
    }
  }

  private async assertConvenioActivoPorCapacitador(capacitadorId: number): Promise<void> {
    const [row] = await this.ds.query(
      `SELECT PROYECTOID AS "proyectoId" FROM CAPACITADORES
        WHERE CAPACITADORID = $1 FETCH FIRST 1 ROW ONLY`,
      [capacitadorId],
    )
    if (!row) throw new BadRequestException('Capacitador no encontrado.')
    await this.assertConvenioEnEjecucion(Number(row.proyectoId))
  }

  // las dos listas van por fecha de registro y el id solo desempata: en el Exadata (RAC, secuencia
  // NOORDER con caché) un id mayor no es un registro más reciente
  async listarPersonas(proyectoId: number) {
    return this.ds.query(
      `SELECT c.CAPACITADORID              AS "capacitadorId",
              c.CAPACITADORPERSONAID        AS "personaId",
              btrim((c.CAPAESTADO)::text)            AS "estado",
              btrim((c.CAPAINTERESTADO)::text)       AS "estadoInterventoria",
              c.CAPAOBSERVACION             AS "observacion",
              c.CAPAFECHAREGISTRO           AS "fechaRegistro",
              btrim((p.PERSONANOMBRES)::text) || ' ' || btrim((p.PERSONAPRIMERAPELLIDO)::text) || ' ' ||
                COALESCE(btrim((p.PERSONASEGUNDOAPELLIDO)::text), '') AS "nombreCompleto",
              btrim((p.PERSONAIDENTIFICACION)::text) AS "identificacion",
              btrim((t.TIPODOCUMENTOIDENTIDADNOMBRE)::text) AS "tipoDocumento"
         FROM CAPACITADORES c
         JOIN PERSONA p ON p.PERSONAID = c.CAPACITADORPERSONAID
         JOIN TIPODOCUMENTOIDENTIDAD t ON t.TIPODOCUMENTOIDENTIDADID = p.TIPODOCUMENTOIDENTIDADID
        WHERE c.PROYECTOID = $1
          AND btrim((c.CAPATIPO)::text) = 'PE'
          AND COALESCE(c.CAPACITADORPERSONAIDTRANFERENC, 0) = 0
        ORDER BY c.CAPAFECHAREGISTRO ASC, c.CAPACITADORID ASC`,
      [proyectoId],
    )
  }

  async registrarPersona(proyectoId: number, personaId: number) {
    await this.assertConvenioEnEjecucion(proyectoId)
    const dup: any[] = await this.ds.query(
      `SELECT CAPACITADORID FROM CAPACITADORES
        WHERE PROYECTOID = $1 AND CAPACITADORPERSONAID = $2 AND btrim((CAPATIPO)::text) = 'PE'
          AND COALESCE(CAPACITADORPERSONAIDTRANFERENC, 0) = 0`,
      [proyectoId, personaId],
    )
    if (dup.length) throw new BadRequestException('Esta persona ya está registrada como capacitadora en este proyecto.')

    const id = await insertarConId(this.ds, 'CAPACITADORES', 'CAPACITADORID', { maxMasUno: true }, {
      PROYECTOID: proyectoId,
      CAPACITADORPERSONAID: personaId,
      CAPATIPO: 'PE',
      CAPAESTADO: 'ACTIVO',
      CAPAINTERESTADO: 'PENDIENTE DE APROBACION',
      CAPAFECHAREGISTRO: sqlCrudo(AHORA_UTC),
      CAPAFECHAACTUALIZAR: sqlCrudo(AHORA_UTC),
    })
    return { capacitadorId: id }
  }

  async listarEmpresas(proyectoId: number) {
    return this.ds.query(
      `SELECT c.CAPACITADORID              AS "capacitadorId",
              c.CAPACITADOREMPRESAID        AS "empresaId",
              btrim((c.CAPAESTADO)::text)            AS "estado",
              btrim((c.CAPAINTERESTADO)::text)       AS "estadoInterventoria",
              c.CAPAOBSERVACION             AS "observacion",
              c.CAPAFECHAREGISTRO           AS "fechaRegistro",
              btrim((e.EMPRESARAZONSOCIAL)::text)    AS "razonSocial",
              btrim((e.EMPRESASIGLA)::text)          AS "sigla",
              e.EMPRESAIDENTIFICACION       AS "identificacion",
              btrim((t.TIPODOCUMENTOIDENTIDADNOMBRE)::text) AS "tipoDocumento"
         FROM CAPACITADORES c
         JOIN EMPRESA e ON e.EMPRESAID = c.CAPACITADOREMPRESAID
         JOIN TIPODOCUMENTOIDENTIDAD t ON t.TIPODOCUMENTOIDENTIDADID = e.TIPODOCUMENTOIDENTIDADID
        WHERE c.PROYECTOID = $1
          AND btrim((c.CAPATIPO)::text) = 'EM'
          AND COALESCE(c.CAPACITADORPERSONAIDTRANFERENC, 0) = 0
        ORDER BY c.CAPAFECHAREGISTRO ASC, c.CAPACITADORID ASC`,
      [proyectoId],
    )
  }

  async registrarEmpresa(proyectoId: number, empresaId: number) {
    await this.assertConvenioEnEjecucion(proyectoId)
    const dup: any[] = await this.ds.query(
      `SELECT CAPACITADORID FROM CAPACITADORES
        WHERE PROYECTOID = $1 AND CAPACITADOREMPRESAID = $2 AND btrim((CAPATIPO)::text) = 'EM'
          AND COALESCE(CAPACITADORPERSONAIDTRANFERENC, 0) = 0`,
      [proyectoId, empresaId],
    )
    if (dup.length) throw new BadRequestException('Esta empresa ya está registrada como capacitadora en este proyecto.')

    const id = await insertarConId(this.ds, 'CAPACITADORES', 'CAPACITADORID', { maxMasUno: true }, {
      PROYECTOID: proyectoId,
      CAPACITADOREMPRESAID: empresaId,
      CAPATIPO: 'EM',
      CAPAESTADO: 'ACTIVO',
      CAPAINTERESTADO: 'PENDIENTE DE APROBACION',
      CAPAFECHAREGISTRO: sqlCrudo(AHORA_UTC),
      CAPAFECHAACTUALIZAR: sqlCrudo(AHORA_UTC),
    })
    return { capacitadorId: id }
  }

  async toggleEstado(capacitadorId: number, nuevoEstado: 'ACTIVO' | 'INACTIVO') {
    await this.assertConvenioActivoPorCapacitador(capacitadorId)
    const [cap]: any[] = await this.ds.query(
      `SELECT btrim((CAPAINTERESTADO)::text) AS "inter",
              btrim((CAPACITADORESTADOTRANSFERENCIA)::text) AS "trans"
         FROM CAPACITADORES WHERE CAPACITADORID = $1`,
      [capacitadorId],
    )
    if (cap?.inter === 'APROBADO' || cap?.trans === 'APROBADOT') {
      throw new BadRequestException('No se puede cambiar el estado de un capacitador ya aprobado.')
    }
    await this.ds.query(
      `UPDATE CAPACITADORES SET CAPAESTADO = $1, CAPAFECHAACTUALIZAR = ${AHORA_UTC}
        WHERE CAPACITADORID = $2`,
      [nuevoEstado, capacitadorId],
    )
    return { ok: true }
  }

  async tiposDocEmpresa() {
    return this.ds.query(
      `SELECT TIPODOCUMENTOIDENTIDADID AS "id",
              btrim((TIPODOCUMENTOIDENTIDADNOMBRE)::text) AS "nombre"
         FROM TIPODOCUMENTOIDENTIDAD
        WHERE COALESCE(TIPODOCUMENTOIDENTIDADPERSONA, 0) = 0
        ORDER BY btrim((TIPODOCUMENTOIDENTIDADNOMBRE)::text) ASC`,
    )
  }

  async buscarEmpresa(tipoDocId: number, identificacion: string) {
    const rows: any[] = await this.ds.query(
      `SELECT e.EMPRESAID                   AS "empresaId",
              e.TIPODOCUMENTOIDENTIDADID     AS "tipoDocumentoId",
              btrim((t.TIPODOCUMENTOIDENTIDADNOMBRE)::text) AS "tipoDocumento",
              e.EMPRESAIDENTIFICACION        AS "identificacion",
              e.EMPRESADIGITOVERIFICACION    AS "digitoVerificacion",
              btrim((e.EMPRESARAZONSOCIAL)::text)     AS "razonSocial",
              btrim((e.EMPRESASIGLA)::text)           AS "sigla",
              btrim((e.EMPRESAEMAIL)::text)           AS "email",
              btrim((e.EMPRESATELEFONO)::text)        AS "telefono",
              btrim((e.EMPRESADIRECCION)::text)       AS "direccion"
         FROM EMPRESA e
         JOIN TIPODOCUMENTOIDENTIDAD t ON t.TIPODOCUMENTOIDENTIDADID = e.TIPODOCUMENTOIDENTIDADID
        WHERE e.TIPODOCUMENTOIDENTIDADID = $1
          AND e.EMPRESAIDENTIFICACION = $2`,
      [tipoDocId, identificacion],
    )
    return rows[0] ?? null
  }

  async getEmpresa(empresaId: number) {
    const rows: any[] = await this.ds.query(
      `SELECT e.EMPRESAID                   AS "empresaId",
              e.TIPODOCUMENTOIDENTIDADID     AS "tipoDocumentoId",
              btrim((t.TIPODOCUMENTOIDENTIDADNOMBRE)::text) AS "tipoDocumento",
              e.EMPRESAIDENTIFICACION        AS "identificacion",
              e.EMPRESADIGITOVERIFICACION    AS "digitoVerificacion",
              btrim((e.EMPRESARAZONSOCIAL)::text)     AS "razonSocial",
              btrim((e.EMPRESASIGLA)::text)           AS "sigla",
              btrim((e.EMPRESAEMAIL)::text)           AS "email",
              btrim((e.EMPRESATELEFONO)::text)        AS "telefono",
              btrim((e.EMPRESADIRECCION)::text)       AS "direccion"
         FROM EMPRESA e
         JOIN TIPODOCUMENTOIDENTIDAD t ON t.TIPODOCUMENTOIDENTIDADID = e.TIPODOCUMENTOIDENTIDADID
        WHERE e.EMPRESAID = $1`,
      [empresaId],
    )
    return rows[0] ?? null
  }

  async crearEmpresa(dto: {
    tipoDocumentoId: number
    identificacion: string
    digitoVerificacion?: number
    razonSocial: string
    sigla: string
    email: string
    telefono: string
    direccion: string
  }) {
    // sin trigger (hoy, el XE) sale de la secuencia EMPRESAID, la misma que usa el registro de empresas
    const id = await insertarConId(this.ds, 'EMPRESA', 'EMPRESAID', { secuencia: 'EMPRESAID' }, {
      TIPODOCUMENTOIDENTIDADID: dto.tipoDocumentoId,
      EMPRESAIDENTIFICACION: dto.identificacion,
      EMPRESADIGITOVERIFICACION: dto.digitoVerificacion ?? 0,
      EMPRESARAZONSOCIAL: dto.razonSocial,
      EMPRESASIGLA: dto.sigla,
      EMPRESAEMAIL: dto.email,
      EMPRESATELEFONO: dto.telefono,
      EMPRESADIRECCION: dto.direccion,
      EMPRESAFECHAREGISTRO: sqlCrudo(AHORA_UTC),
    })
    return { empresaId: id }
  }

  async actualizarEmpresa(empresaId: number, dto: Partial<{
    razonSocial: string; sigla: string; email: string
    telefono: string; direccion: string; digitoVerificacion: number
  }>) {
    const map: Record<string, string> = {
      razonSocial: 'EMPRESARAZONSOCIAL', sigla: 'EMPRESASIGLA', email: 'EMPRESAEMAIL',
      telefono: 'EMPRESATELEFONO', direccion: 'EMPRESADIRECCION',
      digitoVerificacion: 'EMPRESADIGITOVERIFICACION',
    }
    const sets: string[] = []
    const params: any[] = []
    for (const [k, col] of Object.entries(map)) {
      if (dto[k as keyof typeof dto] !== undefined) {
        sets.push(`${col} = :${params.length + 1}`)
        params.push(dto[k as keyof typeof dto])
      }
    }
    if (!sets.length) return { ok: true }
    params.push(empresaId)
    await this.ds.query(`UPDATE EMPRESA SET ${sets.join(', ')} WHERE EMPRESAID = $${params.length}`, params)
    return { ok: true }
  }

  async getHVEmpresa(empresaId: number) {
    const rows: any[] = await this.ds.query(
      `SELECT HVEMPRESAID                   AS "hvEmpresaId",
              EMPRESAID                     AS "empresaId",
              btrim((HVEMPRESANOMBREARCHIVO)::text)  AS "estado",
              HVEMPRESAPROYECTO             AS "proyectoOrigen",
              btrim((HVEMPRESAHABEASDATA)::text)     AS "habeasData",
              btrim((HVEMPRESAHABEASDATAE)::text)    AS "habeasDataE",
              HVEMPRESAFECHAREGISTRO        AS "fechaRegistro",
              HVEMPRESAFECHAACTUALIZACION   AS "fechaActualizacion",
              HVEMPRESAOBSERVACION          AS "observacion"
         FROM HVEMPRESA WHERE EMPRESAID = $1`,
      [empresaId],
    )
    return rows[0] ?? null
  }

  async iniciarHVEmpresa(empresaId: number, proyectoId: number) {
    if (proyectoId) await this.assertConvenioEnEjecucion(proyectoId)
    const existing = await this.getHVEmpresa(empresaId)
    if (existing) return existing
    const id = await insertarConId(this.ds, 'HVEMPRESA', 'HVEMPRESAID', { maxMasUno: true }, {
      EMPRESAID: empresaId,
      HVEMPRESAPROYECTO: proyectoId,
      HVEMPRESANOMBREARCHIVO: 'PENDIENTE',
      HVEMPRESAHABEASDATA: 'SI',
      HVEMPRESAHABEASDATAE: 'SI',
      HVEMPRESAFECHAREGISTRO: sqlCrudo(AHORA_UTC),
    })
    return { hvEmpresaId: id }
  }

  async listarDocumentosEmpresa(empresaId: number, tipo?: string, num?: number) {
    let sql = `SELECT DOCUMENTOSCAPJURIDICOID          AS "docId",
                      btrim((DOCUMENTOSCAPJURIDICOTIPO)::text)  AS "tipo",
                      DOCUMENTOSCAPJURIDICONUM          AS "num",
                      btrim((DOCUMENTOSCAPJURIDICONOMBREARC)::text) AS "nombreArchivo",
                      length(DOCUMENTOSCAPJURIDICODOC) AS "tamanoBytes",
                      DOCUMENTOSCAPJURIDICOFECHAREG     AS "fechaRegistro"
                 FROM DOCUMENTOSCAPJURIDICO WHERE EMPRESAID = $1`
    const params: any[] = [empresaId]
    if (tipo) { sql += ` AND TRIM(DOCUMENTOSCAPJURIDICOTIPO) = :${params.length + 1}`; params.push(tipo) }
    if (num !== undefined) { sql += ` AND DOCUMENTOSCAPJURIDICONUM = :${params.length + 1}`; params.push(num) }
    return this.ds.query(sql + ` ORDER BY DOCUMENTOSCAPJURIDICOID DESC`, params)
  }

  async subirDocumentoEmpresa(empresaId: number, tipo: string, num: number, file: MulterFile) {
    await this.ds.query(
      `DELETE FROM DOCUMENTOSCAPJURIDICO
        WHERE EMPRESAID = $1 AND btrim((DOCUMENTOSCAPJURIDICOTIPO)::text) = $2 AND DOCUMENTOSCAPJURIDICONUM = $3`,
      [empresaId, tipo, num],
    )
    const id = await insertarConId(this.ds, 'DOCUMENTOSCAPJURIDICO', 'DOCUMENTOSCAPJURIDICOID', { maxMasUno: true }, {
      EMPRESAID: empresaId,
      DOCUMENTOSCAPJURIDICONUM: num,
      DOCUMENTOSCAPJURIDICOTIPO: tipo,
      DOCUMENTOSCAPJURIDICONOMBREARC: file.originalname,
      // como BLOB, igual que en DOCUMENTOSPERSONAS: el driver lo sube como LOB temporal; un Buffer
      // suelto de más de 4000 bytes viaja como LONG RAW, y eso junto al RETURNING puede dar ORA-22816
      DOCUMENTOSCAPJURIDICODOC: { type: oracledb.DB_TYPE_BLOB, val: file.buffer },
      DOCUMENTOSCAPJURIDICOFECHAREG: sqlCrudo(AHORA_UTC),
    })
    return { docId: id }
  }

  async getDocumentoEmpresaArchivo(docId: number) {
    const rows: any[] = await this.ds.query(
      `SELECT btrim((DOCUMENTOSCAPJURIDICONOMBREARC)::text) AS "nombreArchivo",
              DOCUMENTOSCAPJURIDICODOC AS "buffer"
         FROM DOCUMENTOSCAPJURIDICO WHERE DOCUMENTOSCAPJURIDICOID = $1`,
      [docId],
    )
    if (!rows[0]) throw new BadRequestException('Documento no encontrado.')
    const fila = rows[0] as { nombreArchivo: string; buffer: Buffer }
    const enDisco = leerDocumento('documentoscapjuridico', 'documentoscapjuridicodoc', docId)
    return enDisco ? { ...fila, buffer: enDisco } : fila
  }

  async eliminarDocumentoEmpresa(docId: number) {
    await this.ds.query(
      `DELETE FROM DOCUMENTOSCAPJURIDICO WHERE DOCUMENTOSCAPJURIDICOID = $1`, [docId],
    )
    return { ok: true }
  }

  async listarDocsAdicionalesEmpresa(empresaId: number) {
    const rows: any[] = await this.ds.query(
      `SELECT da.HVEMPRESADOCID                  AS "hvEmpresaDocId",
              da.PERSONADOCREQID                 AS "tipoDocId",
              btrim((dr.PERSONADOCREQNOMBRE)::text)       AS "nombre",
              btrim((dr.PERSONADOCREQSIGLA)::text)        AS "sigla",
              btrim((da.HVEMPRESADOCNOMBREARCHIVO)::text) AS "estado",
              da.HVEMPRESADOCUMETOSPROYECTO      AS "proyectoOrigen",
              da.HVEMPRESADOCFECHAREGISTRO       AS "fechaRegistro",
              dc.DOCUMENTOSCAPJURIDICOID         AS "documentoId",
              btrim((dc.DOCUMENTOSCAPJURIDICONOMBREARC)::text) AS "nombreArchivo",
              length(dc.DOCUMENTOSCAPJURIDICODOC) AS "tamanoBytes"
         FROM HVEMPRESADOCUMETOS da
         JOIN PERSONADOCREQUERIDOS dr ON dr.PERSONADOCREQID = da.PERSONADOCREQID
         LEFT JOIN DOCUMENTOSCAPJURIDICO dc
           ON dc.EMPRESAID = da.EMPRESAID
          AND btrim((dc.DOCUMENTOSCAPJURIDICOTIPO)::text) = 'DA'
          AND dc.DOCUMENTOSCAPJURIDICONUM = da.HVEMPRESADOCID
        WHERE da.EMPRESAID = $1
        ORDER BY da.HVEMPRESADOCID ASC`,
      [empresaId],
    )
    return rows.map(r => ({
      hvEmpresaDocId: r.hvEmpresaDocId,
      tipoDocId: r.tipoDocId,
      nombre: r.nombre,
      sigla: r.sigla,
      estado: r.estado,
      proyectoOrigen: r.proyectoOrigen,
      fechaRegistro: r.fechaRegistro,
      documento: r.documentoId ? {
        docId: r.documentoId,
        nombreArchivo: r.nombreArchivo,
        tamanoBytes: r.tamanoBytes,
      } : null,
    }))
  }

  async crearDocAdicionalEmpresa(empresaId: number, dto: { tipoDocId: number; proyectoId?: number }) {
    const id = await insertarConId(this.ds, 'HVEMPRESADOCUMETOS', 'HVEMPRESADOCID', { maxMasUno: true }, {
      EMPRESAID: empresaId,
      PERSONADOCREQID: dto.tipoDocId,
      HVEMPRESADOCNOMBREARCHIVO: 'PENDIENTE',
      HVEMPRESADOCUMETOSPROYECTO: dto.proyectoId ?? 0,
      HVEMPRESADOCFECHAREGISTRO: sqlCrudo(AHORA_UTC),
    })
    return { hvEmpresaDocId: id }
  }

  async eliminarDocAdicionalEmpresa(hvEmpresaDocId: number, empresaId: number) {
    const [doc]: any[] = await this.ds.query(
      `SELECT btrim((HVEMPRESADOCNOMBREARCHIVO)::text) AS "estado"
         FROM HVEMPRESADOCUMETOS WHERE HVEMPRESADOCID = $1`,
      [hvEmpresaDocId],
    )
    if (doc?.estado === 'APROBADO') {
      throw new BadRequestException('No se puede eliminar un documento aprobado.')
    }
    await this.ds.query(
      `DELETE FROM DOCUMENTOSCAPJURIDICO
        WHERE EMPRESAID = $1 AND btrim((DOCUMENTOSCAPJURIDICOTIPO)::text) = 'DA'
          AND DOCUMENTOSCAPJURIDICONUM = $2`,
      [empresaId, hvEmpresaDocId],
    )
    await this.ds.query(
      `DELETE FROM HVEMPRESADOCUMETOS WHERE HVEMPRESADOCID = $1`, [hvEmpresaDocId],
    )
    return { ok: true }
  }
}
