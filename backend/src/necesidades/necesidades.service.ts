import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { Empresa } from '../auth/entities/empresa.entity'

@Injectable()
export class NecesidadesService {
  constructor(
    @InjectRepository(Empresa)
    private readonly empresaRepo: Repository<Empresa>,
    private readonly dataSource: DataSource,
  ) {}

  private async getEmpresaId(email: string): Promise<number> {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    return empresa.empresaId
  }

  // ── Lista diagnósticos ────────────────────────────────────────────────────

  async listar(email: string) {
    const empresaId = await this.getEmpresaId(email)
    const rows: Array<{
      necesidadId: number
      fechaRegistro: Date | null
      totalNecesidades: number
    }> = await this.dataSource.query(
      `SELECT n.NECESIDADID                  AS "necesidadId",
              n.NECESIDADFECHAREGISTRO       AS "fechaRegistro",
              COUNT(nf.NECESIDADFORMACIONID) AS "totalNecesidades"
         FROM NECESIDAD n
         LEFT JOIN NECESIDADFORMACION nf ON nf.NECESIDADID = n.NECESIDADID
        WHERE n.EMPRESANECESIDADID = :1
        GROUP BY n.NECESIDADID, n.NECESIDADFECHAREGISTRO
        ORDER BY n.NECESIDADFECHAREGISTRO ASC NULLS LAST`,
      [empresaId],
    )
    return rows.map((r, i) => ({ ...r, numero: i + 1 }))
  }

  // ── Crear diagnóstico ─────────────────────────────────────────────────────

  async crear(email: string, usuarioId: number) {
    const empresaId = await this.getEmpresaId(email)
    await this.dataSource.query(
      `INSERT INTO NECESIDAD (NECESIDADID, EMPRESANECESIDADID, NECESIDADFECHAREGISTRO, USUREGISTRONECESIDAD)
       VALUES (NECESIDADID.NEXTVAL, :1, SYSDATE, :2)`,
      [empresaId, usuarioId],
    )
    const [{ id }] = await this.dataSource.query(
      `SELECT NECESIDADID.CURRVAL AS "id" FROM DUAL`,
    )
    return { message: 'Diagnóstico creado correctamente', necesidadId: Number(id) }
  }

  // ── Eliminar diagnóstico ──────────────────────────────────────────────────

  async eliminar(necesidadId: number) {
    const [{ total }] = await this.dataSource.query(
      `SELECT COUNT(AF.ACCIONFORMACIONID) AS "total"
         FROM ACCIONFORMACION AF
        WHERE AF.NECESIDADFORMACIONIDAF IN (
          SELECT NECESIDADFORMACIONID FROM NECESIDADFORMACION WHERE NECESIDADID = :1
        )`,
      [necesidadId],
    )
    if (Number(total) > 0)
      throw new BadRequestException(
        `No se puede eliminar este diagnóstico porque está asociado a ${Number(total) === 1 ? 'una accion de formación' : `${Number(total)} acciones de formación`}.`,
      )
    await this.dataSource.query(
      `DELETE FROM HERRAMIENTANECESIDAD WHERE NECESIDADID = :1`, [necesidadId])
    await this.dataSource.query(
      `DELETE FROM NECESIDADFORMACION WHERE NECESIDADID = :1`, [necesidadId])
    await this.dataSource.query(
      `DELETE FROM NECESIDAD WHERE NECESIDADID = :1`, [necesidadId])
    return { message: 'Diagnóstico eliminado' }
  }

  // ── Detalle de un diagnóstico ─────────────────────────────────────────────

  async getDiagnostico(necesidadId: number) {
    const [diag] = await this.dataSource.query(
      `SELECT n.NECESIDADID               AS "necesidadId",
              n.NECESIDADFECHAREGISTRO    AS "fechaRegistro",
              n.NECESIDADPERIODOI         AS "periodoI",
              n.NECESIDADHERROTRA         AS "herrOtra",
              n.NECESIDADHERRCREACION     AS "herrCreacion",
              n.NECESIDADPLANCAPA         AS "planCapa",
              n.NECESIDADHERRDESCRIP      AS "herrDescrip",
              n.NECESIDADHERRRESULTADOS   AS "herrResultados"
         FROM NECESIDAD n
        WHERE n.NECESIDADID = :1`,
      [necesidadId],
    )
    if (!diag) throw new NotFoundException('Diagnóstico no encontrado')

    const herramientas = await this.dataSource.query(
      `SELECT h.HERRAMIENTANECESIDADID      AS "id",
              f.FUENTEHERRAMIENTANOMBRE     AS "herramienta",
              h.HERRAMIENTANECESIDADPARTICIP AS "muestra"
         FROM HERRAMIENTANECESIDAD h
         JOIN FUENTEHERRAMIENTA f ON f.FUENTEHERRAMIENTAID = h.FUENTEHERRAMIENTAID
        WHERE h.NECESIDADID = :1
        ORDER BY h.HERRAMIENTANECESIDADID`,
      [necesidadId],
    )

    const necesidades = await this.dataSource.query(
      `SELECT NECESIDADFORMACIONID     AS "id",
              NECESIDADFORMACIONNUMERO AS "numero",
              NECESIDADFORMACIONNOMBRE AS "nombre",
              NECESIDADFORMACIONBENEF  AS "beneficiarios"
         FROM NECESIDADFORMACION
        WHERE NECESIDADID = :1
        ORDER BY NECESIDADFORMACIONNUMERO`,
      [necesidadId],
    )

    return { ...diag, herramientas, necesidades }
  }

  // ── Guardar sección diagnóstico ───────────────────────────────────────────

  async guardarDiagnostico(necesidadId: number, dto: {
    periodoI?: string | null
    herrOtra?: string | null
    herrCreacion?: number
    planCapa?: number
    herrDescrip?: string | null
    herrResultados?: string | null
  }) {
    await this.dataSource.query(
      `UPDATE NECESIDAD
          SET NECESIDADPERIODOI       = ${dto.periodoI ? "TO_DATE(:1, 'YYYY-MM-DD')" : 'NULL'},
              NECESIDADHERROTRA       = :2,
              NECESIDADHERRCREACION   = :3,
              NECESIDADPLANCAPA       = :4,
              NECESIDADHERRDESCRIP    = :5,
              NECESIDADHERRRESULTADOS = :6
        WHERE NECESIDADID = :7`,
      [
        ...(dto.periodoI ? [dto.periodoI] : []),
        dto.herrOtra ?? null,
        dto.herrCreacion ?? 0,
        dto.planCapa ?? 0,
        dto.herrDescrip ?? null,
        dto.herrResultados ?? null,
        necesidadId,
      ],
    )
    return { message: 'Diagnóstico guardado correctamente' }
  }

  // ── Herramientas ──────────────────────────────────────────────────────────

  async getFuentesHerramienta() {
    return this.dataSource.query(
      `SELECT FUENTEHERRAMIENTAID AS "id", FUENTEHERRAMIENTANOMBRE AS "nombre"
         FROM FUENTEHERRAMIENTA
        WHERE FUENTEHERRAMIENTAESTADO = 1
        ORDER BY FUENTEHERRAMIENTAID`,
    )
  }

  async registrarHerramienta(necesidadId: number, fuenteId: number, muestra: number, usuarioId: number) {
    await this.dataSource.query(
      `INSERT INTO HERRAMIENTANECESIDAD
             (HERRAMIENTANECESIDADID, NECESIDADID, FUENTEHERRAMIENTAID,
              HERRAMIENTANECESIDADPARTICIP, HERRAMIENTANECESIDADOTRA,
              USUREGISTROHERRAMIENTA, HERRAMIENTANECESIDADFECHAREG)
       VALUES (HERRAMIENTANECESIDADID.NEXTVAL, :1, :2, :3, ' ', :4, SYSDATE)`,
      [necesidadId, fuenteId, muestra, usuarioId],
    )
    return { message: 'Herramienta registrada' }
  }

  async eliminarHerramienta(id: number) {
    await this.dataSource.query(
      `DELETE FROM HERRAMIENTANECESIDAD WHERE HERRAMIENTANECESIDADID = :1`,
      [id],
    )
    return { message: 'Herramienta eliminada' }
  }

  // ── Necesidades de formación ──────────────────────────────────────────────

  async registrarNecesidadFormacion(necesidadId: number, nombre: string, benef: number, usuarioId: number) {
    const [{ total }] = await this.dataSource.query(
      `SELECT COUNT(NECESIDADFORMACIONID) AS "total" FROM NECESIDADFORMACION WHERE NECESIDADID = :1`,
      [necesidadId],
    )
    const numero = Number(total) + 1
    await this.dataSource.query(
      `INSERT INTO NECESIDADFORMACION
             (NECESIDADFORMACIONID, NECESIDADID, NECESIDADFORMACIONNUMERO,
              NECESIDADFORMACIONNOMBRE, NECESIDADFORMACIONBENEF,
              USUREGISTRONECESIDADFORMACION, NECESIDADFORMACIONFECHAREGISTR)
       VALUES (NECESIDADFORMACIONID.NEXTVAL, :1, :2, :3, :4, :5, SYSDATE)`,
      [necesidadId, numero, nombre, benef, usuarioId],
    )
    return { message: 'Necesidad registrada' }
  }

  async editarNecesidadFormacion(id: number, nombre: string, benef: number) {
    await this.dataSource.query(
      `UPDATE NECESIDADFORMACION
          SET NECESIDADFORMACIONNOMBRE = :1,
              NECESIDADFORMACIONBENEF  = :2
        WHERE NECESIDADFORMACIONID = :3`,
      [nombre, benef, id],
    )
    return { message: 'Necesidad actualizada' }
  }

  async eliminarNecesidadFormacion(id: number) {
    await this.dataSource.query(
      `DELETE FROM NECESIDADFORMACION WHERE NECESIDADFORMACIONID = :1`,
      [id],
    )
    return { message: 'Necesidad eliminada' }
  }

  // ── Datos para reporte ────────────────────────────────────────────────────

  async getReporte(necesidadId: number) {
    const [diag] = await this.dataSource.query(
      `SELECT n.NECESIDADID                        AS "necesidadId",
              n.NECESIDADFECHAREGISTRO             AS "fechaRegistro",
              n.NECESIDADPERIODOI                  AS "periodoI",
              n.NECESIDADHERROTRA                  AS "herrOtra",
              n.NECESIDADHERRCREACION              AS "herrCreacion",
              n.NECESIDADPLANCAPA                  AS "planCapa",
              n.NECESIDADHERRDESCRIP               AS "herrDescrip",
              n.NECESIDADHERRRESULTADOS            AS "herrResultados",
              e.EMPRESARAZONSOCIAL                 AS "empresaNombre",
              e.EMPRESASIGLA                       AS "empresaSigla",
              e.EMPRESAIDENTIFICACION              AS "nit",
              e.EMPRESADIGITOVERIFICACION          AS "digitoV",
              dep.DEPARTAMENTONOMBRE               AS "departamento",
              ciu.CIUDADNOMBRE                     AS "ciudad",
              e.EMPRESADIRECCION                   AS "direccion",
              e.EMPRESATELEFONO                    AS "telefono",
              e.EMPRESACELULAR                     AS "celular",
              e.EMPRESAWEBSITE                     AS "website",
              cob.COBERTURADESCRIPCION             AS "cobertura",
              ciiu.CIIUCODIGO                      AS "ciiuCodigo",
              ciiu.CIIUDESCRIPCION                 AS "ciiuDescripcion",
              te.TIPOEMPRESANOMBRE                 AS "tipoEmpresa",
              tam.TAMANOEMPRESANOMBRE              AS "tamanoEmpresa",
              e.EMPRESAREP                         AS "repNombre",
              e.EMPRESAREPCARGO                    AS "repCargo",
              e.EMPRESAREPCORREO                   AS "repCorreo",
              e.EMPRESAREPTEL                      AS "repTel",
              e.EMPRESAREPDOCUMENTO                AS "repDocumento",
              tdoc.TIPODOCUMENTOIDENTIDADNOMBRE    AS "repTipoDoc"
         FROM NECESIDAD n
         JOIN EMPRESA e              ON e.EMPRESAID          = n.EMPRESANECESIDADID
         LEFT JOIN DEPARTAMENTO dep  ON dep.DEPARTAMENTOID   = e.DEPARTAMENTOEMPRESAID
         LEFT JOIN CIUDAD ciu        ON ciu.CIUDADID         = e.CIUDADEMPRESAID
         LEFT JOIN COBERTURA cob     ON cob.COBERTURAID      = e.COBERTURAEMPRESAID
         LEFT JOIN CIIU ciiu         ON ciiu.CIIUID          = e.CIIUID
         LEFT JOIN TIPOEMPRESA te    ON te.TIPOEMPRESAID     = e.TIPOEMPRESAID
         LEFT JOIN TAMANOEMPRESA tam ON tam.TAMANOEMPRESAID  = e.TAMANOEMPRESAID
         LEFT JOIN TIPODOCUMENTOIDENTIDAD tdoc
                                     ON tdoc.TIPODOCUMENTOIDENTIDADID = e.TIPOIDENTIFICACIONREP
        WHERE n.NECESIDADID = :1`,
      [necesidadId],
    )
    if (!diag) throw new NotFoundException('Diagnóstico no encontrado')

    // Campos de análisis desde EMPRESA usando el FK EMPRESANECESIDADID
    const [analisis] = await this.dataSource.query(
      `SELECT EMPRESAOBJETO        AS "objeto",
              EMPRESAPRODUCTOS     AS "productos",
              EMPRESASITUACION     AS "situacion",
              EMPRESAPAPEL         AS "papel",
              EMPRESARETOS         AS "retos",
              EMPRESAEXPERIENCIA   AS "experiencia",
              EMPRESAESLABONES     AS "eslabones",
              EMPRESAINTERACCIONES AS "interacciones"
         FROM EMPRESA
        WHERE EMPRESAID = (SELECT EMPRESANECESIDADID FROM NECESIDAD WHERE NECESIDADID = :1)`,
      [necesidadId],
    )

    const herramientas = await this.dataSource.query(
      `SELECT f.FUENTEHERRAMIENTANOMBRE      AS "herramienta",
              h.HERRAMIENTANECESIDADPARTICIP AS "muestra"
         FROM HERRAMIENTANECESIDAD h
         JOIN FUENTEHERRAMIENTA f ON f.FUENTEHERRAMIENTAID = h.FUENTEHERRAMIENTAID
        WHERE h.NECESIDADID = :1
        ORDER BY h.HERRAMIENTANECESIDADID`,
      [necesidadId],
    )

    const necesidades = await this.dataSource.query(
      `SELECT NECESIDADFORMACIONNUMERO AS "numero",
              NECESIDADFORMACIONNOMBRE AS "nombre",
              NECESIDADFORMACIONBENEF  AS "beneficiarios"
         FROM NECESIDADFORMACION
        WHERE NECESIDADID = :1
        ORDER BY NECESIDADFORMACIONNUMERO`,
      [necesidadId],
    )

    const mesasSectoriales = await this.dataSource.query(
      `SELECT ms.MESASECTORIALNOMBRE AS "nombre"
         FROM EMPRESAMESASECTORIAL me
         JOIN MESASECTORIAL ms ON ms.MESASECTORIALID = me.MESASECTORIALIDEMPRESA
        WHERE me.EMPRESAIDMESASECTORIAL = (
          SELECT EMPRESANECESIDADID FROM NECESIDAD WHERE NECESIDADID = :1
        )
        ORDER BY ms.MESASECTORIALNOMBRE`,
      [necesidadId],
    )

    const empresaId = diag.empresaNombre ? (await this.dataSource.query(
      `SELECT EMPRESANECESIDADID AS "id" FROM NECESIDAD WHERE NECESIDADID = :1`,
      [necesidadId],
    ))[0]?.id : null

    const sectoresPertenece = empresaId ? await this.dataSource.query(
      `SELECT s.SECTORDESCRIPCION AS "nombre"
         FROM SECTOREMPRESA se JOIN SECTOR s ON s.SECTORID = se.SECTORIDEMPRESA
        WHERE se.EMPRESAID = :1 ORDER BY s.SECTORDESCRIPCION`,
      [empresaId],
    ) : []

    const subsectoresPertenece = empresaId ? await this.dataSource.query(
      `SELECT sub.SUBSECTORNOMBRE AS "nombre"
         FROM SUBSECTOREMPRESA se JOIN SUBSECTOR sub ON sub.SUBSECTORID = se.SUBSECTORIDEMPRESA
        WHERE se.EMPRESAID = :1 ORDER BY sub.SUBSECTORNOMBRE`,
      [empresaId],
    ) : []

    const sectoresRepresenta = empresaId ? await this.dataSource.query(
      `SELECT s.SECTORDESCRIPCION AS "nombre"
         FROM SECTORPEMPRESA se JOIN SECTOR s ON s.SECTORID = se.SECTORIDPEMPRESA
        WHERE se.EMPRESAIDPSECTOR = :1 ORDER BY s.SECTORDESCRIPCION`,
      [empresaId],
    ) : []

    const subsectoresRepresenta = empresaId ? await this.dataSource.query(
      `SELECT sub.SUBSECTORNOMBRE AS "nombre"
         FROM SUBSECTORPEMPRESA se JOIN SUBSECTOR sub ON sub.SUBSECTORID = se.SUBSECTORIDPEMPRESA
        WHERE se.EMPRESAIDPSUBSECTOR = :1 ORDER BY sub.SUBSECTORNOMBRE`,
      [empresaId],
    ) : []

    return {
      ...diag,
      ...(analisis ?? {}),
      herramientas,
      necesidades,
      mesasSectoriales,
      sectoresPertenece,
      subsectoresPertenece,
      sectoresRepresenta,
      subsectoresRepresenta,
    }
  }
}
