import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { Empresa } from '../auth/entities/empresa.entity'
import { randomBytes } from 'crypto'

const PROYECTO_SIN_ASIGNAR = 1

export interface AfDto {
  nombre: string
  tipoEventoId: number
  modalidadFormacionId: number
  numBenef: number
}

export interface ActualizarAfDto {
  necesidadFormacionId?: number | null
  nombre: string
  justnec?: string | null
  causa?: string | null
  efectos?: string | null
  objetivo?: string | null
  tipoEventoId: number
  modalidadFormacionId: number
  metodologiaAprendizajeId?: number | null
  modeloAprendizajeId?: number | null
  numHorasGrupo?: number | null
  numGrupos?: number | null
  benefGrupo?: number | null
  benefViGrupo?: number | null
  numTotHorasGrup?: number | null
  numBenef?: number | null
}

export interface ContactoProyectoDto {
  nombre: string
  cargo: string
  correo: string
  telefono?: string
  documento?: string
  tipoIdentificacionId?: number | null
}

@Injectable()
export class ProyectosService {
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

  // ── Listar proyectos de la empresa ────────────────────────────────────────

  async listar(email: string) {
    const empresaId = await this.getEmpresaId(email)
    return this.dataSource.query(
      `SELECT p.PROYECTOID               AS "proyectoId",
              TRIM(p.PROYECTONOMBRE)     AS "nombre",
              p.PROYECTOESTADO          AS "estado",
              p.PROYECTOFECHAREGISTRO   AS "fechaRegistro",
              p.PROYECTOFECHARADICACION AS "fechaRadicacion",
              TRIM(cv.CONVOCATORIANOMBRE) AS "convocatoria",
              TRIM(m.MODALIDADNOMBRE)    AS "modalidad"
         FROM PROYECTO p
         LEFT JOIN CONVOCATORIA cv ON cv.CONVOCATORIAID = p.CONVOCATORIAID
         LEFT JOIN MODALIDAD m      ON m.MODALIDADID    = p.MODALIDADID
        WHERE p.EMPRESAID = :1
        ORDER BY p.PROYECTOID ASC`,
      [empresaId],
    )
  }

  // ── Detalle de un proyecto ────────────────────────────────────────────────

  async getDetalle(proyectoId: number) {
    const rows = await this.dataSource.query(
      `SELECT p.PROYECTOID               AS "proyectoId",
              TRIM(p.PROYECTONOMBRE)     AS "nombre",
              p.CONVOCATORIAID           AS "convocatoriaId",
              p.MODALIDADID             AS "modalidadId",
              TRIM(cv.CONVOCATORIANOMBRE) AS "convocatoria",
              TRIM(m.MODALIDADNOMBRE)    AS "modalidad",
              p.PROYECTOOBJETIVO        AS "objetivo",
              p.PROYECTOESTADO          AS "estado",
              p.PROYECTOFECHAREGISTRO   AS "fechaRegistro",
              p.PROYECTOFECHARADICACION AS "fechaRadicacion",
              p.EMPRESAID               AS "empresaId",
              cv.CONVOCATORIAESTADO     AS "convocatoriaEstado"
         FROM PROYECTO p
         LEFT JOIN CONVOCATORIA cv ON cv.CONVOCATORIAID = p.CONVOCATORIAID
         LEFT JOIN MODALIDAD m      ON m.MODALIDADID    = p.MODALIDADID
        WHERE p.PROYECTOID = :1`,
      [proyectoId],
    )
    if (!rows.length) throw new NotFoundException('Proyecto no encontrado')
    return rows[0]
  }

  // ── Actualizar generalidades + objetivo ───────────────────────────────────

  async actualizarProyecto(
    email: string,
    proyectoId: number,
    dto: { nombre: string; convocatoriaId: number; modalidadId: number; objetivo?: string },
  ) {
    const empresaId = await this.getEmpresaId(email)
    await this.dataSource.query(
      `UPDATE PROYECTO
          SET PROYECTONOMBRE   = :1,
              CONVOCATORIAID   = :2,
              MODALIDADID      = :3,
              PROYECTOOBJETIVO = :4
        WHERE PROYECTOID = :5
          AND EMPRESAID  = :6`,
      [dto.nombre.trim(), dto.convocatoriaId, dto.modalidadId, dto.objetivo ?? null, proyectoId, empresaId],
    )
    return { message: 'Proyecto actualizado correctamente' }
  }

  // ── Radicar / Desradicar ──────────────────────────────────────────────────

  async radicar(email: string, proyectoId: number) {
    const empresaId = await this.getEmpresaId(email)

    const rows = await this.dataSource.query(
      `SELECT PROYECTOESTADO AS "estado", CONVOCATORIAID AS "convocatoriaId"
         FROM PROYECTO WHERE PROYECTOID = :1 AND EMPRESAID = :2`,
      [proyectoId, empresaId],
    )
    if (!rows.length) throw new NotFoundException('Proyecto no encontrado')
    const { estado, convocatoriaId } = rows[0]

    // Toggle: 0/null → 1 (radicar), 1 → 2 (desradicar/reversar), 2 → 1 (re-radicar)
    const nuevoEstado = Number(estado) === 1 ? 2 : 1

    if (nuevoEstado === 1) {
      const [{ total }] = await this.dataSource.query(
        `SELECT COUNT(PROYECTOID) AS "total"
           FROM PROYECTO
          WHERE EMPRESAID = :1 AND CONVOCATORIAID = :2 AND PROYECTOESTADO = 1 AND PROYECTOID != :3`,
        [empresaId, convocatoriaId, proyectoId],
      )
      if (Number(total) > 0)
        throw new BadRequestException('Ya existe un proyecto radicado en esta convocatoria.')
    }

    await this.dataSource.query(
      `UPDATE PROYECTO
          SET PROYECTOESTADO = :1, PROYECTOFECHARADICACION = SYSDATE
        WHERE PROYECTOID = :2`,
      [nuevoEstado, proyectoId],
    )

    return { message: nuevoEstado === 1 ? 'Proyecto radicado correctamente' : 'Proyecto reversado correctamente', estado: nuevoEstado }
  }

  // ── Catálogos ─────────────────────────────────────────────────────────────

  async getConvocatorias() {
    return this.dataSource.query(
      `SELECT CONVOCATORIAID   AS "id",
              TRIM(CONVOCATORIANOMBRE) AS "nombre"
         FROM CONVOCATORIA
        WHERE CONVOCATORIAESTADO  = 1
          AND CONVOCATORIAOCULTAR = 0
        ORDER BY CONVOCATORIANOMBRE ASC`,
    )
  }

  async getModalidades() {
    return this.dataSource.query(
      `SELECT MODALIDADID              AS "id",
              TRIM(MODALIDADNOMBRE)   AS "nombre"
         FROM MODALIDAD
        WHERE MODALIDADESTADO = 1
        ORDER BY MODALIDADNOMBRE ASC`,
    )
  }

  // ── Crear proyecto ────────────────────────────────────────────────────────

  async crear(email: string, dto: { convocatoriaId: number; modalidadId: number; nombre: string }) {
    const empresaId = await this.getEmpresaId(email)

    const [{ total }] = await this.dataSource.query(
      `SELECT COUNT(PROYECTOID) AS "total" FROM PROYECTO
        WHERE EMPRESAID = :1 AND CONVOCATORIAID = :2`,
      [empresaId, dto.convocatoriaId],
    )
    if (Number(total) > 0)
      throw new BadRequestException('No se puede crear más de 1 proyecto en la misma convocatoria.')

    const codSeguridad = randomBytes(12).toString('hex').toUpperCase()

    await this.dataSource.query(
      `INSERT INTO PROYECTO
         (PROYECTOID, EMPRESAID, PROYECTONOMBRE, CONVOCATORIAID, MODALIDADID,
          PROYECTOCODSEGURIDAD, PROYECTOFECHAREGISTRO, PROYECTOESTADO)
       VALUES (PROYECTOID.NEXTVAL, :1, :2, :3, :4, :5, SYSDATE, 0)`,
      [empresaId, dto.nombre.trim(), dto.convocatoriaId, dto.modalidadId, codSeguridad],
    )

    const [{ id }] = await this.dataSource.query(
      `SELECT PROYECTOID.CURRVAL AS "id" FROM DUAL`,
    )
    return { message: 'Proyecto creado correctamente', proyectoId: Number(id) }
  }

  // ── Contactos del proyecto ────────────────────────────────────────────────

  async getContactosDelProyecto(proyectoId: number) {
    return this.dataSource.query(
      `SELECT CONTACTOEMPRESAID           AS "contactoId",
              CONTACTOEMPRESANOMBRE       AS "nombre",
              CONTACTOEMPRESACARGO        AS "cargo",
              CONTACTOEMPRESACORREO       AS "correo",
              CONTACTOEMPRESATELEFONO     AS "telefono",
              CONTACTOEMPRESADOCUMENTO    AS "documento",
              TIPOIDENTIFICACIONCONTACTOP AS "tipoIdentificacionId"
         FROM CONTACTOEMPRESA
        WHERE PROYECTOIDCONTACTOS = :1
        ORDER BY CONTACTOEMPRESAID ASC`,
      [proyectoId],
    )
  }

  async getContactosDisponibles(email: string, proyectoId: number) {
    const empresaId = await this.getEmpresaId(email)
    return this.dataSource.query(
      `SELECT c.CONTACTOEMPRESAID     AS "contactoId",
              c.CONTACTOEMPRESANOMBRE AS "nombre",
              c.CONTACTOEMPRESACARGO  AS "cargo",
              c.CONTACTOEMPRESACORREO AS "correo",
              CASE WHEN c.PROYECTOIDCONTACTOS = ${PROYECTO_SIN_ASIGNAR} OR c.PROYECTOIDCONTACTOS IS NULL
                   THEN NULL
                   ELSE TRIM(p.PROYECTONOMBRE)
              END AS "proyectoActual"
         FROM CONTACTOEMPRESA c
         LEFT JOIN PROYECTO p ON p.PROYECTOID = c.PROYECTOIDCONTACTOS
        WHERE c.EMPRESAIDCONTACTO = :1
          AND (c.PROYECTOIDCONTACTOS != :2 OR c.PROYECTOIDCONTACTOS IS NULL)
        ORDER BY c.CONTACTOEMPRESAID ASC`,
      [empresaId, proyectoId],
    )
  }

  async asignarContacto(proyectoId: number, contactoId: number) {
    await this.dataSource.query(
      `UPDATE CONTACTOEMPRESA SET PROYECTOIDCONTACTOS = :1 WHERE CONTACTOEMPRESAID = :2`,
      [proyectoId, contactoId],
    )
    return { message: 'Contacto asignado al proyecto' }
  }

  async desasignarContacto(contactoId: number) {
    await this.dataSource.query(
      `UPDATE CONTACTOEMPRESA SET PROYECTOIDCONTACTOS = ${PROYECTO_SIN_ASIGNAR} WHERE CONTACTOEMPRESAID = :1`,
      [contactoId],
    )
    return { message: 'Contacto removido del proyecto' }
  }

  async crearContactoEnProyecto(email: string, proyectoId: number, dto: ContactoProyectoDto) {
    const empresaId = await this.getEmpresaId(email)
    await this.dataSource.query(
      `INSERT INTO CONTACTOEMPRESA
         (EMPRESAIDCONTACTO, CONTACTOEMPRESANOMBRE, CONTACTOEMPRESACARGO,
          CONTACTOEMPRESACORREO, CONTACTOEMPRESATELEFONO, CONTACTOEMPRESADOCUMENTO,
          TIPOIDENTIFICACIONCONTACTOP, PROYECTOIDCONTACTOS)
       VALUES (:1, :2, :3, :4, :5, :6, :7, :8)`,
      [empresaId, dto.nombre, dto.cargo, dto.correo,
       dto.telefono ?? null, dto.documento ?? null,
       dto.tipoIdentificacionId ?? null, proyectoId],
    )
    return { message: 'Contacto creado y asociado al proyecto' }
  }

  // ── Acciones de Formación ─────────────────────────────────────────────────

  async listarAFs(proyectoId: number) {
    return this.dataSource.query(
      `SELECT af.ACCIONFORMACIONID           AS "afId",
              af.ACCIONFORMACIONNUMERO       AS "numero",
              TRIM(af.ACCIONFORMACIONNOMBRE) AS "nombre",
              af.ACCIONFORMACIONNUMBENEF     AS "numBenef",
              TRIM(te.TIPOEVENTONOMBRE)      AS "tipoEvento",
              TRIM(mf.MODALIDADFORMACIONNOMBRE) AS "modalidad"
         FROM ACCIONFORMACION af
         LEFT JOIN TIPOEVENTO te         ON te.TIPOEVENTOID         = af.TIPOEVENTOID
         LEFT JOIN MODALIDADFORMACION mf ON mf.MODALIDADFORMACIONID = af.MODALIDADFORMACIONID
        WHERE af.PROYECTOID = :1
        ORDER BY af.ACCIONFORMACIONNUMERO ASC`,
      [proyectoId],
    )
  }

  async getTiposEvento() {
    return this.dataSource.query(
      `SELECT TIPOEVENTOID           AS "id",
              TRIM(TIPOEVENTONOMBRE) AS "nombre"
         FROM TIPOEVENTO
        WHERE TIPOEVENTOACTIVO = 1
        ORDER BY TIPOEVENTONOMBRE ASC`,
    )
  }

  async getModalidadesFormacion() {
    return this.dataSource.query(
      `SELECT MODALIDADFORMACIONID              AS "id",
              TRIM(MODALIDADFORMACIONNOMBRE)   AS "nombre"
         FROM MODALIDADFORMACION
        WHERE MODALIDADFORMACIONACTIVO = 1
        ORDER BY MODALIDADFORMACIONNOMBRE ASC`,
    )
  }

  async crearAF(proyectoId: number, dto: AfDto) {
    await this.dataSource.query(
      `INSERT INTO ACCIONFORMACION
         (ACCIONFORMACIONID, PROYECTOID, ACCIONFORMACIONNUMERO, ACCIONFORMACIONNOMBRE,
          TIPOEVENTOID, MODALIDADFORMACIONID, ACCIONFORMACIONNUMBENEF, ACCIONFORMACIONFECHAREGISTRO)
       VALUES (ACCIONFORMACIONID.NEXTVAL, :1,
               (SELECT NVL(MAX(ACCIONFORMACIONNUMERO), 0) + 1 FROM ACCIONFORMACION WHERE PROYECTOID = :2),
               :3, :4, :5, :6, SYSDATE)`,
      [proyectoId, proyectoId, dto.nombre.trim(), dto.tipoEventoId, dto.modalidadFormacionId, dto.numBenef],
    )
    return { message: 'Acción de formación creada correctamente' }
  }

  async getAFDetalle(afId: number) {
    const rows = await this.dataSource.query(
      `SELECT af.ACCIONFORMACIONID            AS "afId",
              af.ACCIONFORMACIONNUMERO        AS "numero",
              TRIM(af.ACCIONFORMACIONNOMBRE)  AS "nombre",
              af.NECESIDADFORMACIONIDAF       AS "necesidadFormacionId",
              nf.NECESIDADFORMACIONNOMBRE     AS "problemaDetectado",
              af.ACCIONFORMACIONJUSTNEC       AS "justnec",
              af.ACCIONFORMACIONCAUSA         AS "causa",
              af.ACCIONFORMACIONRESULTADOS    AS "efectos",
              af.ACCIONFORMACIONOBJETIVO      AS "objetivo",
              af.TIPOEVENTOID                 AS "tipoEventoId",
              TRIM(te.TIPOEVENTONOMBRE)       AS "tipoEvento",
              af.MODALIDADFORMACIONID         AS "modalidadFormacionId",
              TRIM(mf.MODALIDADFORMACIONNOMBRE) AS "modalidadFormacion",
              af.METODOLOGIAAPRENDIZAJEID     AS "metodologiaAprendizajeId",
              TRIM(ma.METODOLOGIAAPRENDIZAJENOMBRE) AS "metodologiaAprendizaje",
              af.MODELOAPRENDIZAJEID          AS "modeloAprendizajeId",
              TRIM(mo.MODELOAPRENDIZAJENOMBRE) AS "modeloAprendizaje",
              af.ACCIONFORMACIONNUMHORAGRUPO  AS "numHorasGrupo",
              af.ACCIONFORMACIONNUMGRUPOS     AS "numGrupos",
              af.ACCIONFORMACIONBENEFGRUPO    AS "benefGrupo",
              af.ACCIONFORMACIONBENEFVIGRUPO  AS "benefViGrupo",
              af.ACCIONFORMACIONNUMTOTHORASGRUP AS "numTotHorasGrup",
              af.ACCIONFORMACIONNUMBENEF      AS "numBenef",
              p.MODALIDADID                   AS "proyectoModalidadId",
              p.PROYECTOID                    AS "proyectoId"
         FROM ACCIONFORMACION af
         LEFT JOIN TIPOEVENTO te           ON te.TIPOEVENTOID           = af.TIPOEVENTOID
         LEFT JOIN MODALIDADFORMACION mf   ON mf.MODALIDADFORMACIONID   = af.MODALIDADFORMACIONID
         LEFT JOIN METODOLOGIAAPRENDIZAJE ma ON ma.METODOLOGIAAPRENDIZAJEID = af.METODOLOGIAAPRENDIZAJEID
         LEFT JOIN MODELOAPRENDIZAJE mo    ON mo.MODELOAPRENDIZAJEID    = af.MODELOAPRENDIZAJEID
         LEFT JOIN NECESIDADFORMACION nf   ON nf.NECESIDADFORMACIONID   = af.NECESIDADFORMACIONIDAF
         LEFT JOIN PROYECTO p              ON p.PROYECTOID              = af.PROYECTOID
        WHERE af.ACCIONFORMACIONID = :1`,
      [afId],
    )
    if (!rows.length) throw new NotFoundException('Acción de formación no encontrada')
    return rows[0]
  }

  async actualizarAF(afId: number, dto: ActualizarAfDto) {
    // Obtener estado actual para detectar cambios
    const [actual] = await this.dataSource.query(
      `SELECT TIPOEVENTOID AS "tipoEventoId", MODALIDADFORMACIONID AS "modalidadFormacionId",
              ACCIONFORMACIONNUMGRUPOS AS "numGrupos", PROYECTOID AS "proyectoId"
         FROM ACCIONFORMACION WHERE ACCIONFORMACIONID = :1`,
      [afId],
    )
    if (!actual) throw new NotFoundException('Acción de formación no encontrada')

    const eventoChanged = Number(actual.tipoEventoId) !== dto.tipoEventoId
    const modalidadChanged = Number(actual.modalidadFormacionId) !== dto.modalidadFormacionId
    const gruposChanged = Number(actual.numGrupos) !== (dto.numGrupos ?? 0)

    if (eventoChanged || modalidadChanged || gruposChanged) {
      const [{ totalRubros }] = await this.dataSource.query(
        `SELECT COUNT(1) AS "totalRubros" FROM AFRUBRO WHERE ACCIONFORMACIONID = :1`,
        [afId],
      )
      if (Number(totalRubros) > 0)
        throw new BadRequestException(
          'No se puede cambiar el evento, modalidad o número de grupos porque la AF ya tiene rubros registrados. Elimine los rubros primero.',
        )
    }

    // Validar máximo de CONFERENCIA / FORO por proyecto
    if (eventoChanged && (dto.tipoEventoId === 1 || dto.tipoEventoId === 2)) {
      const maxPermitido = 2
      const [{ cnt }] = await this.dataSource.query(
        `SELECT COUNT(1) AS "cnt" FROM ACCIONFORMACION
          WHERE PROYECTOID = :1 AND TIPOEVENTOID = :2 AND ACCIONFORMACIONID != :3`,
        [actual.proyectoId, dto.tipoEventoId, afId],
      )
      if (Number(cnt) >= maxPermitido) {
        const nombre = dto.tipoEventoId === 1 ? 'CONFERENCIA' : 'FORO'
        throw new BadRequestException(
          `Ya existen ${maxPermitido} eventos tipo ${nombre} en este proyecto. No puede registrar otro.`,
        )
      }
    }

    // Validar unicidad de PUESTO DE TRABAJO REAL / BOOTCAMP
    if (eventoChanged && (dto.tipoEventoId === 8 || dto.tipoEventoId === 9)) {
      const [{ cnt }] = await this.dataSource.query(
        `SELECT COUNT(1) AS "cnt" FROM ACCIONFORMACION
          WHERE PROYECTOID = :1 AND TIPOEVENTOID = :2 AND ACCIONFORMACIONID != :3`,
        [actual.proyectoId, dto.tipoEventoId, afId],
      )
      if (Number(cnt) >= 1) {
        const nombre = dto.tipoEventoId === 8 ? 'TALLER-PUESTO DE TRABAJO REAL' : 'TALLER-BOOTCAMP'
        throw new BadRequestException(
          `Ya existe una acción de formación con evento tipo ${nombre} en este proyecto.`,
        )
      }
    }

    await this.dataSource.query(
      `UPDATE ACCIONFORMACION
          SET NECESIDADFORMACIONIDAF       = :1,
              ACCIONFORMACIONNOMBRE        = :2,
              ACCIONFORMACIONJUSTNEC       = :3,
              ACCIONFORMACIONCAUSA         = :4,
              ACCIONFORMACIONRESULTADOS    = :5,
              ACCIONFORMACIONOBJETIVO      = :6,
              TIPOEVENTOID                 = :7,
              MODALIDADFORMACIONID         = :8,
              METODOLOGIAAPRENDIZAJEID     = :9,
              MODELOAPRENDIZAJEID          = :10,
              ACCIONFORMACIONNUMHORAGRUPO  = :11,
              ACCIONFORMACIONNUMGRUPOS     = :12,
              ACCIONFORMACIONBENEFGRUPO    = :13,
              ACCIONFORMACIONBENEFVIGRUPO  = :14,
              ACCIONFORMACIONNUMTOTHORASGRUP = :15,
              ACCIONFORMACIONNUMBENEF      = :16
        WHERE ACCIONFORMACIONID = :17`,
      [
        dto.necesidadFormacionId ?? null,
        dto.nombre.trim(),
        dto.justnec ?? null,
        dto.causa ?? null,
        dto.efectos ?? null,
        dto.objetivo ?? null,
        dto.tipoEventoId,
        dto.modalidadFormacionId,
        dto.metodologiaAprendizajeId ?? null,
        dto.modeloAprendizajeId ?? null,
        dto.numHorasGrupo ?? null,
        dto.numGrupos ?? null,
        dto.benefGrupo ?? null,
        dto.benefViGrupo ?? null,
        dto.numTotHorasGrup ?? null,
        dto.numBenef ?? null,
        afId,
      ],
    )
    return { message: 'Acción de formación actualizada correctamente' }
  }

  async getMetodologias() {
    return this.dataSource.query(
      `SELECT METODOLOGIAAPRENDIZAJEID        AS "id",
              TRIM(METODOLOGIAAPRENDIZAJENOMBRE) AS "nombre"
         FROM METODOLOGIAAPRENDIZAJE
        WHERE METODOLOGIAAPRENDIZAJEESTADO = 1
        ORDER BY METODOLOGIAAPRENDIZAJENOMBRE ASC`,
    )
  }

  async getModelosAprendizaje() {
    return this.dataSource.query(
      `SELECT MODELOAPRENDIZAJEID              AS "id",
              TRIM(MODELOAPRENDIZAJENOMBRE)   AS "nombre"
         FROM MODELOAPRENDIZAJE
        ORDER BY MODELOAPRENDIZAJENOMBRE ASC`,
    )
  }

  async getNecesidadesFormacion(email: string) {
    const empresaId = await this.getEmpresaId(email)
    return this.dataSource.query(
      `SELECT nf.NECESIDADFORMACIONID       AS "id",
              nf.NECESIDADFORMACIONNOMBRE   AS "nombre",
              nf.NECESIDADFORMACIONNUMERO   AS "numero"
         FROM NECESIDADFORMACION nf
         JOIN NECESIDAD n ON n.NECESIDADID = nf.NECESIDADID
        WHERE n.EMPRESANECESIDADID = :1
        ORDER BY nf.NECESIDADFORMACIONNUMERO ASC`,
      [empresaId],
    )
  }

  // ── Catálogos Perfil Beneficiarios ───────────────────────────────────────

  async getAreasFuncionales() {
    return this.dataSource.query(
      `SELECT AREAFUNCIONALID               AS "id",
              TRIM(AREAFUNCIONALNOMBRE)     AS "nombre"
         FROM AREAFUNCIONAL
        WHERE AREAFUNCIONALESTADO = 1
        ORDER BY AREAFUNCIONALID ASC`,
    )
  }

  async getNivelesOcupacionales() {
    return this.dataSource.query(
      `SELECT NIVELOCUPACIONALID               AS "id",
              TRIM(NIVELOCUPACIONALNOMBRE)     AS "nombre"
         FROM NIVELOCUPACIONAL
        WHERE NIVELOCUPACIONALESTADO = 1
        ORDER BY NIVELOCUPACIONALID ASC`,
    )
  }

  async getOcupacionesCuoc() {
    return this.dataSource.query(
      `SELECT OCUPACIONCUOCID               AS "id",
              TRIM(OCUPACIONCUOCNOMBRE)     AS "nombre"
         FROM OCUPACIONCUOC
        WHERE OCUPACIONCUOCESTADO = 1
        ORDER BY OCUPACIONCUOCNOMBRE ASC`,
    )
  }

  async getEnfoques() {
    return this.dataSource.query(
      `SELECT AFENFOQUEID                  AS "id",
              TRIM(AFENFOQUENOMBRE)        AS "nombre"
         FROM AFENFOQUE
        WHERE AFENFOQUEESTADO = 1
        ORDER BY AFENFOQUEID ASC`,
    )
  }

  // ── Perfil Beneficiarios ──────────────────────────────────────────────────

  async getPerfilBeneficiarios(afId: number) {
    const rows = await this.dataSource.query(
      `SELECT af.ACCIONFORMACIONID             AS "afId",
              af.AFENFOQUEID                   AS "afEnfoqueId",
              TRIM(e.AFENFOQUENOMBRE)          AS "enfoque",
              af.ACCIONFORMACIONAREAFUN        AS "justAreas",
              af.ACCIONFORMACIONNIVELOCUPD     AS "justNivelesOcu",
              af.ACCIONFORMACIONMUJER          AS "mujer",
              af.ACCIONFORMACIONNUMCAMPESINO   AS "numCampesino",
              af.ACCIONFORMACIONJUSTCAMPESINO  AS "justCampesino",
              af.ACCIONFORMACIONNUMPOPULAR     AS "numPopular",
              af.ACCIONFORMACIONJUSTPOPULAR    AS "justPopular",
              af.ACCIONFORMACIONTRABDISCAPAC   AS "trabDiscapac",
              af.ACCIONFORMACIONTRABAJADORBIC  AS "trabajadorBic",
              af.ACCIONFORMACIONMIPYMES        AS "mipymes",
              af.ACCIONFORMACIONTRABMIPYMES    AS "trabMipymes",
              af.ACCIONFORMACIONMIPYMESD       AS "mipymesD",
              af.ACCIONFORMACIONCADENAPROD     AS "cadenaProd",
              af.ACCIONFORMACIONTRABCADPROD    AS "trabCadProd",
              af.ACCIONFORMACIONCADENAPRODD    AS "cadenaProdD"
         FROM ACCIONFORMACION af
         LEFT JOIN AFENFOQUE e ON e.AFENFOQUEID = af.AFENFOQUEID
        WHERE af.ACCIONFORMACIONID = :1`,
      [afId],
    )
    if (!rows.length) throw new NotFoundException('Acción de formación no encontrada')

    const areas = await this.dataSource.query(
      `SELECT aa.AFAREAFUNCIONALID         AS "aafId",
              aa.AREAFUNCIONALIDAF         AS "areaId",
              TRIM(a.AREAFUNCIONALNOMBRE)  AS "nombre",
              aa.AFAREAFUNCIONALOTRO       AS "otro"
         FROM AFAREAFUNCIONAL aa
         JOIN AREAFUNCIONAL a ON a.AREAFUNCIONALID = aa.AREAFUNCIONALIDAF
        WHERE aa.ACCIONFORMACIONIDAF = :1
        ORDER BY aa.AFAREAFUNCIONALID ASC`,
      [afId],
    )

    const niveles = await this.dataSource.query(
      `SELECT an.AFNIVELOCUPACIONALID         AS "anId",
              an.NIVELOCUPACIONALIDAF         AS "nivelId",
              TRIM(n.NIVELOCUPACIONALNOMBRE)  AS "nombre"
         FROM AFNIVELOCUPACIONAL an
         JOIN NIVELOCUPACIONAL n ON n.NIVELOCUPACIONALID = an.NIVELOCUPACIONALIDAF
        WHERE an.ACCIONFORMACIONID = :1
        ORDER BY an.AFNIVELOCUPACIONALID ASC`,
      [afId],
    )

    const cuoc = await this.dataSource.query(
      `SELECT oa.OCUPACIONCOUCAFID             AS "ocAfId",
              oa.OCUPACIONCUOCID               AS "cuocId",
              TRIM(c.OCUPACIONCUOCNOMBRE)      AS "nombre"
         FROM OCUPACIONCOUCAF oa
         JOIN OCUPACIONCUOC c ON c.OCUPACIONCUOCID = oa.OCUPACIONCUOCID
        WHERE oa.ACCIONFORMACIONID = :1
        ORDER BY oa.OCUPACIONCOUCAFID ASC`,
      [afId],
    )

    return { ...rows[0], areas, niveles, cuoc }
  }

  async actualizarPerfilBeneficiarios(
    afId: number,
    dto: {
      afEnfoqueId?: number | null
      justAreas?: string | null
      justNivelesOcu?: string | null
      mujer?: number | null
      numCampesino?: number | null
      justCampesino?: string | null
      numPopular?: number | null
      justPopular?: string | null
      trabDiscapac?: number | null
      trabajadorBic?: number | null
      mipymes?: number | null
      trabMipymes?: number | null
      mipymesD?: string | null
      cadenaProd?: number | null
      trabCadProd?: number | null
      cadenaProdD?: string | null
    },
  ) {
    await this.dataSource.query(
      `UPDATE ACCIONFORMACION
          SET AFENFOQUEID                  = :1,
              ACCIONFORMACIONAREAFUN       = :2,
              ACCIONFORMACIONNIVELOCUPD    = :3,
              ACCIONFORMACIONMUJER         = :4,
              ACCIONFORMACIONNUMCAMPESINO  = :5,
              ACCIONFORMACIONJUSTCAMPESINO = :6,
              ACCIONFORMACIONNUMPOPULAR    = :7,
              ACCIONFORMACIONJUSTPOPULAR   = :8,
              ACCIONFORMACIONTRABDISCAPAC  = :9,
              ACCIONFORMACIONTRABAJADORBIC = :10,
              ACCIONFORMACIONMIPYMES       = :11,
              ACCIONFORMACIONTRABMIPYMES   = :12,
              ACCIONFORMACIONMIPYMESD      = :13,
              ACCIONFORMACIONCADENAPROD    = :14,
              ACCIONFORMACIONTRABCADPROD   = :15,
              ACCIONFORMACIONCADENAPRODD   = :16
        WHERE ACCIONFORMACIONID = :17`,
      [
        dto.afEnfoqueId ?? null,
        dto.justAreas ?? null,
        dto.justNivelesOcu ?? null,
        dto.mujer ?? null,
        dto.numCampesino ?? null,
        dto.justCampesino ?? null,
        dto.numPopular ?? null,
        dto.justPopular ?? null,
        dto.trabDiscapac ?? null,
        dto.trabajadorBic ?? null,
        dto.mipymes ?? null,
        dto.trabMipymes ?? null,
        dto.mipymesD ?? null,
        dto.cadenaProd ?? null,
        dto.trabCadProd ?? null,
        dto.cadenaProdD ?? null,
        afId,
      ],
    )
    return { message: 'Perfil de beneficiarios actualizado correctamente' }
  }

  async agregarArea(afId: number, dto: { areaId: number; otro?: string | null }) {
    const [{ cnt }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "cnt" FROM AFAREAFUNCIONAL WHERE ACCIONFORMACIONIDAF = :1`,
      [afId],
    )
    if (Number(cnt) >= 5)
      throw new BadRequestException('Máximo 5 áreas funcionales por acción de formación')

    const [{ dup }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "dup" FROM AFAREAFUNCIONAL
        WHERE ACCIONFORMACIONIDAF = :1 AND AREAFUNCIONALIDAF = :2`,
      [afId, dto.areaId],
    )
    if (Number(dup) > 0)
      throw new BadRequestException('El área funcional ya está registrada en esta acción de formación')

    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(AFAREAFUNCIONALID), 0) + 1 AS "nid" FROM AFAREAFUNCIONAL`,
    )
    await this.dataSource.query(
      `INSERT INTO AFAREAFUNCIONAL (AFAREAFUNCIONALID, ACCIONFORMACIONIDAF, AREAFUNCIONALIDAF, AFAREAFUNCIONALOTRO)
       VALUES (:1, :2, :3, :4)`,
      [nid, afId, dto.areaId, dto.otro ?? null],
    )
    return { message: 'Área funcional agregada', aafId: nid }
  }

  async eliminarArea(aafId: number) {
    await this.dataSource.query(
      `DELETE FROM AFAREAFUNCIONAL WHERE AFAREAFUNCIONALID = :1`,
      [aafId],
    )
    return { message: 'Área funcional eliminada' }
  }

  async agregarNivel(afId: number, nivelId: number) {
    const [{ cnt }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "cnt" FROM AFNIVELOCUPACIONAL WHERE ACCIONFORMACIONID = :1`,
      [afId],
    )
    if (Number(cnt) >= 3)
      throw new BadRequestException('Máximo 3 niveles ocupacionales por acción de formación')

    const [{ dup }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "dup" FROM AFNIVELOCUPACIONAL
        WHERE ACCIONFORMACIONID = :1 AND NIVELOCUPACIONALIDAF = :2`,
      [afId, nivelId],
    )
    if (Number(dup) > 0)
      throw new BadRequestException('El nivel ocupacional ya está registrado en esta acción de formación')

    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(AFNIVELOCUPACIONALID), 0) + 1 AS "nid" FROM AFNIVELOCUPACIONAL`,
    )
    await this.dataSource.query(
      `INSERT INTO AFNIVELOCUPACIONAL (AFNIVELOCUPACIONALID, ACCIONFORMACIONID, NIVELOCUPACIONALIDAF)
       VALUES (:1, :2, :3)`,
      [nid, afId, nivelId],
    )
    return { message: 'Nivel ocupacional agregado', anId: nid }
  }

  async eliminarNivel(anId: number) {
    await this.dataSource.query(
      `DELETE FROM AFNIVELOCUPACIONAL WHERE AFNIVELOCUPACIONALID = :1`,
      [anId],
    )
    return { message: 'Nivel ocupacional eliminado' }
  }

  async agregarCuoc(afId: number, cuocId: number) {
    const [{ cnt }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "cnt" FROM OCUPACIONCOUCAF WHERE ACCIONFORMACIONID = :1`,
      [afId],
    )
    if (Number(cnt) >= 20)
      throw new BadRequestException('Máximo 20 ocupaciones CUOC por acción de formación')

    const [{ dup }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "dup" FROM OCUPACIONCOUCAF
        WHERE ACCIONFORMACIONID = :1 AND OCUPACIONCUOCID = :2`,
      [afId, cuocId],
    )
    if (Number(dup) > 0)
      throw new BadRequestException('La ocupación CUOC ya está registrada en esta acción de formación')

    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(OCUPACIONCOUCAFID), 0) + 1 AS "nid" FROM OCUPACIONCOUCAF`,
    )
    await this.dataSource.query(
      `INSERT INTO OCUPACIONCOUCAF (OCUPACIONCOUCAFID, ACCIONFORMACIONID, OCUPACIONCUOCID)
       VALUES (:1, :2, :3)`,
      [nid, afId, cuocId],
    )
    return { message: 'Ocupación CUOC agregada', ocAfId: nid }
  }

  async eliminarCuoc(ocAfId: number) {
    await this.dataSource.query(
      `DELETE FROM OCUPACIONCOUCAF WHERE OCUPACIONCOUCAFID = :1`,
      [ocAfId],
    )
    return { message: 'Ocupación CUOC eliminada' }
  }

  // ── Catálogos Sectores / Sub-sectores ─────────────────────────────────────

  async getSectoresAfCat() {
    return this.dataSource.query(
      `SELECT SECTORAFID AS "id", TRIM(SECTORAFNOMBRE) AS "nombre"
         FROM SECTORAF WHERE SECTORAFESTADO = 1 ORDER BY SECTORAFID ASC`,
    )
  }

  async getSubSectoresAfCat() {
    return this.dataSource.query(
      `SELECT SUBSECTORAFID AS "id", TRIM(SUBSECTORAFNOMBRE) AS "nombre"
         FROM SUBSECTORAF WHERE SUBSECTORAFESTADO = 1 ORDER BY SUBSECTORAFID ASC`,
    )
  }

  // ── Sectores y Sub-sectores de la AF ─────────────────────────────────────

  async getSectoresYSubsectores(afId: number) {
    const rows = await this.dataSource.query(
      `SELECT ACCIONFORMACIONSECSUBD AS "justificacion" FROM ACCIONFORMACION WHERE ACCIONFORMACIONID = :1`,
      [afId],
    )
    if (!rows.length) throw new NotFoundException('Acción de formación no encontrada')

    const [sectoresBenef, subsectoresBenef, sectoresAf, subsectoresAf] = await Promise.all([
      this.dataSource.query(
        `SELECT ps.AFPSECTORID AS "psId", ps.SECTORAFID AS "sectorId", TRIM(s.SECTORAFNOMBRE) AS "nombre"
           FROM AFPSECTOR ps JOIN SECTORAF s ON s.SECTORAFID = ps.SECTORAFID
          WHERE ps.ACCIONFORMACIONID = :1 ORDER BY ps.AFPSECTORID ASC`,
        [afId],
      ),
      this.dataSource.query(
        `SELECT ps.AFPSUBSECTORID AS "pssId", ps.SUBSECTORAFID AS "subsectorId", TRIM(s.SUBSECTORAFNOMBRE) AS "nombre"
           FROM AFPSUBSECTOR ps JOIN SUBSECTORAF s ON s.SUBSECTORAFID = ps.SUBSECTORAFID
          WHERE ps.ACCIONFORMACIONID = :1 ORDER BY ps.AFPSUBSECTORID ASC`,
        [afId],
      ),
      this.dataSource.query(
        `SELECT a.AFSECTORID AS "saId", a.SECTORAFID AS "sectorId", TRIM(s.SECTORAFNOMBRE) AS "nombre"
           FROM AFSECTOR a JOIN SECTORAF s ON s.SECTORAFID = a.SECTORAFID
          WHERE a.ACCIONFORMACIONID = :1 ORDER BY a.AFSECTORID ASC`,
        [afId],
      ),
      this.dataSource.query(
        `SELECT a.AFSUBSECTORID AS "ssaId", a.SUBSECTORAFID AS "subsectorId", TRIM(s.SUBSECTORAFNOMBRE) AS "nombre"
           FROM AFSUBSECTOR a JOIN SUBSECTORAF s ON s.SUBSECTORAFID = a.SUBSECTORAFID
          WHERE a.ACCIONFORMACIONID = :1 ORDER BY a.AFSUBSECTORID ASC`,
        [afId],
      ),
    ])

    return { justificacion: rows[0].justificacion as string | null, sectoresBenef, subsectoresBenef, sectoresAf, subsectoresAf }
  }

  async actualizarJustificacionSec(afId: number, justificacion: string | null) {
    await this.dataSource.query(
      `UPDATE ACCIONFORMACION SET ACCIONFORMACIONSECSUBD = :1 WHERE ACCIONFORMACIONID = :2`,
      [justificacion ?? null, afId],
    )
    return { message: 'Justificación de sectores actualizada' }
  }

  async agregarSectorBenef(afId: number, sectorId: number) {
    const [{ dup }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "dup" FROM AFPSECTOR WHERE ACCIONFORMACIONID = :1 AND SECTORAFID = :2`, [afId, sectorId],
    )
    if (Number(dup) > 0) throw new BadRequestException('El sector ya está registrado en esta acción de formación')

    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(AFPSECTORID), 0) + 1 AS "nid" FROM AFPSECTOR`,
    )
    await this.dataSource.query(
      `INSERT INTO AFPSECTOR (AFPSECTORID, ACCIONFORMACIONID, SECTORAFID, AFPSECTORESTADO) VALUES (:1, :2, :3, 1)`,
      [nid, afId, sectorId],
    )
    return { message: 'Sector beneficiario agregado', psId: nid }
  }

  async eliminarSectorBenef(psId: number) {
    await this.dataSource.query(`DELETE FROM AFPSECTOR WHERE AFPSECTORID = :1`, [psId])
    return { message: 'Sector beneficiario eliminado' }
  }

  async agregarSubSectorBenef(afId: number, subsectorId: number) {
    const [{ dup }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "dup" FROM AFPSUBSECTOR WHERE ACCIONFORMACIONID = :1 AND SUBSECTORAFID = :2`, [afId, subsectorId],
    )
    if (Number(dup) > 0) throw new BadRequestException('El sub-sector ya está registrado en esta acción de formación')

    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(AFPSUBSECTORID), 0) + 1 AS "nid" FROM AFPSUBSECTOR`,
    )
    await this.dataSource.query(
      `INSERT INTO AFPSUBSECTOR (AFPSUBSECTORID, ACCIONFORMACIONID, SUBSECTORAFID, AFPSUBSECTORESTADO) VALUES (:1, :2, :3, 1)`,
      [nid, afId, subsectorId],
    )
    return { message: 'Sub-sector beneficiario agregado', pssId: nid }
  }

  async eliminarSubSectorBenef(pssId: number) {
    await this.dataSource.query(`DELETE FROM AFPSUBSECTOR WHERE AFPSUBSECTORID = :1`, [pssId])
    return { message: 'Sub-sector beneficiario eliminado' }
  }

  async agregarSectorAf(afId: number, sectorId: number) {
    const [{ cnt }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "cnt" FROM AFSECTOR WHERE ACCIONFORMACIONID = :1`, [afId],
    )
    if (Number(cnt) >= 1) throw new BadRequestException('Solo se permite 1 sector de clasificación AF')

    const [{ dup }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "dup" FROM AFSECTOR WHERE ACCIONFORMACIONID = :1 AND SECTORAFID = :2`, [afId, sectorId],
    )
    if (Number(dup) > 0) throw new BadRequestException('El sector AF ya está registrado')

    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(AFSECTORID), 0) + 1 AS "nid" FROM AFSECTOR`,
    )
    await this.dataSource.query(
      `INSERT INTO AFSECTOR (AFSECTORID, ACCIONFORMACIONID, SECTORAFID) VALUES (:1, :2, :3)`,
      [nid, afId, sectorId],
    )
    return { message: 'Sector AF agregado', saId: nid }
  }

  async eliminarSectorAf(saId: number) {
    await this.dataSource.query(`DELETE FROM AFSECTOR WHERE AFSECTORID = :1`, [saId])
    return { message: 'Sector AF eliminado' }
  }

  async agregarSubSectorAf(afId: number, subsectorId: number) {
    const [{ cnt }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "cnt" FROM AFSUBSECTOR WHERE ACCIONFORMACIONID = :1`, [afId],
    )
    if (Number(cnt) >= 1) throw new BadRequestException('Solo se permite 1 sub-sector de clasificación AF')

    const [{ dup }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "dup" FROM AFSUBSECTOR WHERE ACCIONFORMACIONID = :1 AND SUBSECTORAFID = :2`, [afId, subsectorId],
    )
    if (Number(dup) > 0) throw new BadRequestException('El sub-sector AF ya está registrado')

    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(AFSUBSECTORID), 0) + 1 AS "nid" FROM AFSUBSECTOR`,
    )
    await this.dataSource.query(
      `INSERT INTO AFSUBSECTOR (AFSUBSECTORID, ACCIONFORMACIONID, SUBSECTORAFID) VALUES (:1, :2, :3)`,
      [nid, afId, subsectorId],
    )
    return { message: 'Sub-sector AF agregado', ssaId: nid }
  }

  async eliminarSubSectorAf(ssaId: number) {
    await this.dataSource.query(`DELETE FROM AFSUBSECTOR WHERE AFSUBSECTORID = :1`, [ssaId])
    return { message: 'Sub-sector AF eliminado' }
  }

  async eliminarAF(afId: number) {
    // Solo bloquear si tiene rubros registrados
    const [{ totalRubros }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "totalRubros" FROM AFRUBRO WHERE ACCIONFORMACIONID = :1`,
      [afId],
    )
    if (Number(totalRubros) > 0)
      throw new BadRequestException(
        'No se puede eliminar la AF porque tiene rubros registrados. Elimine los rubros primero.',
      )

    // Cascada: hijos de UNIDADTEMATICA
    await this.dataSource.query(
      `DELETE FROM ACTIVIDADUT WHERE UNIDADTEMATICAID IN (SELECT UNIDADTEMATICAID FROM UNIDADTEMATICA WHERE ACCIONFORMACIONID = :1)`,
      [afId],
    )
    await this.dataSource.query(
      `DELETE FROM PERFILUT WHERE UNIDADTEMATICAID IN (SELECT UNIDADTEMATICAID FROM UNIDADTEMATICA WHERE ACCIONFORMACIONID = :1)`,
      [afId],
    )
    await this.dataSource.query(`DELETE FROM UNIDADTEMATICA WHERE ACCIONFORMACIONID = :1`, [afId])

    // Cascada: hijos de AFGRUPO
    await this.dataSource.query(
      `DELETE FROM AFGRUPOCOBERTURA WHERE AFGRUPOID IN (SELECT AFGRUPOID FROM AFGRUPO WHERE ACCIONFORMACIONID = :1)`,
      [afId],
    )
    await this.dataSource.query(`DELETE FROM AFGRUPO WHERE ACCIONFORMACIONID = :1`, [afId])

    // Resto de tablas relacionadas
    await this.dataSource.query(`DELETE FROM AFNIVELOCUPACIONAL   WHERE ACCIONFORMACIONID    = :1`, [afId])
    await this.dataSource.query(`DELETE FROM AFAREAFUNCIONAL      WHERE ACCIONFORMACIONIDAF  = :1`, [afId])
    await this.dataSource.query(`DELETE FROM OCUPACIONCOUCAF      WHERE ACCIONFORMACIONID    = :1`, [afId])
    await this.dataSource.query(`DELETE FROM AFPSECTOR            WHERE ACCIONFORMACIONID    = :1`, [afId])
    await this.dataSource.query(`DELETE FROM AFPSUBSECTOR         WHERE ACCIONFORMACIONID    = :1`, [afId])
    await this.dataSource.query(`DELETE FROM AFSECTOR             WHERE ACCIONFORMACIONID    = :1`, [afId])
    await this.dataSource.query(`DELETE FROM AFSUBSECTOR          WHERE ACCIONFORMACIONID    = :1`, [afId])
    await this.dataSource.query(`DELETE FROM AFGESTIONCONOCIMIENTO WHERE ACCIONFORMACIONID   = :1`, [afId])
    await this.dataSource.query(`DELETE FROM MATERIALFORMACIONAF  WHERE ACCIONFORMACIONID    = :1`, [afId])
    await this.dataSource.query(`DELETE FROM RECURSOSDIDACTICOSAF WHERE ACCIONFORMACIONID    = :1`, [afId])
    await this.dataSource.query(`DELETE FROM AFHABILIDAD          WHERE ACCIONFORMACIONID    = :1`, [afId])

    await this.dataSource.query(`DELETE FROM ACCIONFORMACION WHERE ACCIONFORMACIONID = :1`, [afId])
    return { message: 'Acción de formación eliminada correctamente' }
  }

  // ── Catálogos Unidades Temáticas ──────────────────────────────────────────

  async getActividadesUT() {
    return this.dataSource.query(
      `SELECT UTACTIVIDADESID AS "id", TRIM(UTACTIVIDADESNOMBRE) AS "nombre"
         FROM UTACTIVIDADES
        WHERE UTACTIVIDADESESTADO = 1 AND UTACTIVIDADESID NOT IN (1, 81)
        ORDER BY UTACTIVIDADESNOMBRE ASC`,
    )
  }

  async getRubrosPerfilUT(proyectoId: number) {
    return this.dataSource.query(
      `SELECT r.RUBROID AS "id", TRIM(r.RUBRONOMBRE) AS "nombre"
         FROM RUBRO r
         JOIN PROYECTO p ON p.CONVOCATORIAID = r.CONVOCATORIAIDRUBRO
        WHERE r.RUBROPERFILUT = 1 AND r.RUBROACTIVO = 1
          AND p.PROYECTOID = :1
        ORDER BY r.RUBROID ASC`,
      [proyectoId]
    )
  }

  async getHabilidadesUT(afId: number) {
    const rows = await this.dataSource.query(
      `SELECT AFHABILIDADID AS "id", TRIM(AFHABILIDADNOMBRE) AS "nombre"
         FROM AFHABILIDAD
        WHERE ACCIONFORMACIONID = :1 AND TRIM(AFHABILIDADNOMBRE) IS NOT NULL AND LENGTH(TRIM(AFHABILIDADNOMBRE)) > 2
        ORDER BY AFHABILIDADNOMBRE ASC`,
      [afId],
    )
    return rows
  }

  async getArticulacionesTerr() {
    return this.dataSource.query(
      `SELECT ARTICULACIONTERRITORIALID AS "id", ARTICULACIONTERRITORIALNOMBRE AS "nombre"
         FROM ARTICULACIONTERRITORIAL
        WHERE ARTICULACIONTERRITORIALESTADO = 1
        ORDER BY ARTICULACIONTERRITORIALID ASC`,
    )
  }

  // ── Unidades Temáticas CRUD ───────────────────────────────────────────────

  private async getModalidadAF(afId: number): Promise<number> {
    const [row] = await this.dataSource.query(
      `SELECT MODALIDADFORMACIONID AS "m" FROM ACCIONFORMACION WHERE ACCIONFORMACIONID = :1`,
      [afId],
    )
    return Number(row?.m ?? 1)
  }

  private horasParaColumnas(prac: number | null, teor: number | null, modalidad: number) {
    const p = prac ?? 0, t = teor ?? 0
    const z = () => null as null
    // Presencial (1) → PP/TP | PAT (2) → PPAT/TPAT | Híbrida (3,5,6) → PHib/THib | Virtual (4) → PV/TV
    if (modalidad === 2)  return { pp: z(), ppat: p || null, phib: z(), pv: z(), tp: z(), tpat: t || null, thib: z(), tv: z() }
    if (modalidad === 4)  return { pp: z(), ppat: z(), phib: z(), pv: p || null, tp: z(), tpat: z(), thib: z(), tv: t || null }
    if ([3,5,6].includes(modalidad)) return { pp: z(), ppat: z(), phib: p || null, pv: z(), tp: z(), tpat: z(), thib: t || null, tv: z() }
    return { pp: p || null, ppat: z(), phib: z(), pv: z(), tp: t || null, tpat: z(), thib: z(), tv: z() }
  }

  async listarUTs(afId: number) {
    return this.dataSource.query(
      `SELECT ut.UNIDADTEMATICAID  AS "utId",
              ut.UNIDADTEMATICANUMERO AS "numero",
              ut.UNIDADTEMATICANOMBRE AS "nombre",
              NVL(ut.UNIDADTEMATICAHORASPP,0)+NVL(ut.UNIDADTEMATICAHORASPV,0)+
              NVL(ut.UNIDADTEMATICAHORASPPAT,0)+NVL(ut.UNIDADTEMATICAHORASPHIB,0) AS "totalPrac",
              NVL(ut.UNIDADTEMATICAHORASTP,0)+NVL(ut.UNIDADTEMATICAHORASTV,0)+
              NVL(ut.UNIDADTEMATICAHORASTPAT,0)+NVL(ut.UNIDADTEMATICAHORASTHIB,0) AS "totalTeor",
              ut.UNIDADTEMATICAESTRANSVERSAL AS "esTransversal",
              ut.UNIDADTEMATICAFECHAREGISTRO AS "fechaRegistro"
         FROM UNIDADTEMATICA ut
        WHERE ut.ACCIONFORMACIONID = :1
        ORDER BY ut.UNIDADTEMATICANUMERO ASC`,
      [afId],
    )
  }

  async getUTDetalle(utId: number) {
    const rows = await this.dataSource.query(
      `SELECT ut.UNIDADTEMATICAID        AS "utId",
              ut.ACCIONFORMACIONID       AS "afId",
              ut.UNIDADTEMATICANUMERO    AS "numero",
              ut.UNIDADTEMATICANOMBRE    AS "nombre",
              ut.UNIDADTEMATICACOMPETENCIAS  AS "competencias",
              ut.UNIDADTEMATICACONTENIDO     AS "contenido",
              ut.UNIDADTEMATICAJUSTACTIVIDAD AS "justActividad",
              ut.UNIDADTEMATICAHORASPP   AS "horasPP",
              ut.UNIDADTEMATICAHORASPV   AS "horasPV",
              ut.UNIDADTEMATICAHORASPPAT AS "horasPPAT",
              ut.UNIDADTEMATICAHORASPHIB AS "horasPHib",
              ut.UNIDADTEMATICAHORASTP   AS "horasTP",
              ut.UNIDADTEMATICAHORASTV   AS "horasTV",
              ut.UNIDADTEMATICAHORASTPAT AS "horasTPAT",
              ut.UNIDADTEMATICAHORASTHIB AS "horasTHib",
              ut.UNIDADTEMATICAESTRANSVERSAL       AS "esTransversal",
              ut.UNIDADTEMATICATRANSVERSALID       AS "transversalId",
              ut.UNIDADTEMATICAHORASTRANSVERSAL    AS "horasTransversal",
              ut.ARTICULACIONTERRITORIALID         AS "articulacionTerritorialId",
              art.ARTICULACIONTERRITORIALNOMBRE    AS "articulacionTerritorialNombre"
         FROM UNIDADTEMATICA ut
         LEFT JOIN ARTICULACIONTERRITORIAL art ON art.ARTICULACIONTERRITORIALID = ut.ARTICULACIONTERRITORIALID
        WHERE ut.UNIDADTEMATICAID = :1`,
      [utId],
    )
    if (!rows.length) throw new NotFoundException('Unidad temática no encontrada')

    const [actividades, perfiles] = await Promise.all([
      this.dataSource.query(
        `SELECT a.ACTIVIDADUTID     AS "actId",
                a.UTACTIVIDADESID   AS "actividadId",
                TRIM(c.UTACTIVIDADESNOMBRE) AS "nombre",
                a.ACTIVIDADUTOTRO   AS "otro"
           FROM ACTIVIDADUT a
           JOIN UTACTIVIDADES c ON c.UTACTIVIDADESID = a.UTACTIVIDADESID
          WHERE a.UNIDADTEMATICAID = :1
          ORDER BY a.ACTIVIDADUTID ASC`,
        [utId],
      ),
      this.dataSource.query(
        `SELECT p.PERFILUTID     AS "perfilId",
                p.RUBROIDUT      AS "rubroId",
                TRIM(r.RUBRONOMBRE) AS "rubroNombre",
                p.PERFILUTHORASCAP AS "horasCap",
                p.PERFILUTDIAS    AS "dias"
           FROM PERFILUT p
           JOIN RUBRO r ON r.RUBROID = p.RUBROIDUT
          WHERE p.UNIDADTEMATICAID = :1
          ORDER BY p.PERFILUTID ASC`,
        [utId],
      ),
    ])

    return { ...rows[0], actividades, perfiles }
  }

  async crearUT(afId: number, proyectoId: number, dto: {
    nombre: string
    competencias?: string | null
    contenido?: string | null
    justActividad?: string | null
    horasPrac?: number | null
    horasTeor?: number | null
    articulacionTerritorialId?: number | null
    horasTransversal?: number | null
  }) {
    const modalidad = await this.getModalidadAF(afId)
    const h = this.horasParaColumnas(dto.horasPrac ?? null, dto.horasTeor ?? null, modalidad)

    const [{ nextNum }] = await this.dataSource.query(
      `SELECT NVL(MAX(UNIDADTEMATICANUMERO), 0) + 1 AS "nextNum" FROM UNIDADTEMATICA WHERE ACCIONFORMACIONID = :1`,
      [afId],
    )
    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(UNIDADTEMATICAID), 0) + 1 AS "nid" FROM UNIDADTEMATICA`,
    )

    const esArticulacion = dto.articulacionTerritorialId ? 1 : 0

    await this.dataSource.query(
      `INSERT INTO UNIDADTEMATICA (
         UNIDADTEMATICAID, PROYECTOIDUT, ACCIONFORMACIONID, UNIDADTEMATICANUMERO,
         UNIDADTEMATICANOMBRE, UNIDADTEMATICACOMPETENCIAS, UNIDADTEMATICACONTENIDO,
         UNIDADTEMATICAJUSTACTIVIDAD,
         UNIDADTEMATICAHORASPP, UNIDADTEMATICAHORASPV, UNIDADTEMATICAHORASPPAT, UNIDADTEMATICAHORASPHIB,
         UNIDADTEMATICAHORASTP, UNIDADTEMATICAHORASTV, UNIDADTEMATICAHORASTPAT, UNIDADTEMATICAHORASTHIB,
         UNIDADTEMATICAESTRANSVERSAL, UNIDADTEMATICAHORASTRANSVERSAL,
         ARTICULACIONTERRITORIALID, UNIDADTEMATICAFECHAREGISTRO
       ) VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15,:16,:17,:18,:19,SYSDATE)`,
      [nid, proyectoId, afId, nextNum,
       dto.nombre.trim(), dto.competencias?.trim() ?? null, dto.contenido?.trim() ?? null,
       dto.justActividad?.trim() ?? null,
       h.pp, h.pv, h.ppat, h.phib, h.tp, h.tv, h.tpat, h.thib,
       esArticulacion, dto.horasTransversal ?? null,
       dto.articulacionTerritorialId ?? null],
    )
    return { message: 'Unidad temática creada correctamente', utId: nid }
  }

  async actualizarUT(utId: number, dto: {
    nombre: string
    competencias?: string | null
    contenido?: string | null
    justActividad?: string | null
    horasPrac?: number | null
    horasTeor?: number | null
    articulacionTerritorialId?: number | null
    horasTransversal?: number | null
  }) {
    const [utRow] = await this.dataSource.query(
      `SELECT ACCIONFORMACIONID AS "afId" FROM UNIDADTEMATICA WHERE UNIDADTEMATICAID = :1`, [utId],
    )
    if (!utRow) throw new NotFoundException('Unidad temática no encontrada')
    const afId = Number(utRow.afId)

    const modalidad = await this.getModalidadAF(afId)
    const h = this.horasParaColumnas(dto.horasPrac ?? null, dto.horasTeor ?? null, modalidad)
    const esArticulacion = dto.articulacionTerritorialId ? 1 : 0

    await this.dataSource.query(
      `UPDATE UNIDADTEMATICA
          SET UNIDADTEMATICANOMBRE            = :1,
              UNIDADTEMATICACOMPETENCIAS      = :2,
              UNIDADTEMATICACONTENIDO         = :3,
              UNIDADTEMATICAJUSTACTIVIDAD     = :4,
              UNIDADTEMATICAHORASPP           = :5,
              UNIDADTEMATICAHORASPV           = :6,
              UNIDADTEMATICAHORASPPAT         = :7,
              UNIDADTEMATICAHORASPHIB         = :8,
              UNIDADTEMATICAHORASTP           = :9,
              UNIDADTEMATICAHORASTV           = :10,
              UNIDADTEMATICAHORASTPAT         = :11,
              UNIDADTEMATICAHORASTHIB         = :12,
              UNIDADTEMATICAESTRANSVERSAL     = :13,
              UNIDADTEMATICAHORASTRANSVERSAL  = :14,
              ARTICULACIONTERRITORIALID       = :15
        WHERE UNIDADTEMATICAID = :16`,
      [dto.nombre.trim(), dto.competencias?.trim() ?? null, dto.contenido?.trim() ?? null,
       dto.justActividad?.trim() ?? null,
       h.pp, h.pv, h.ppat, h.phib, h.tp, h.tv, h.tpat, h.thib,
       esArticulacion, dto.articulacionTerritorialId ? (dto.horasTransversal ?? null) : null,
       dto.articulacionTerritorialId ?? null,
       utId],
    )
    return { message: 'Unidad temática actualizada correctamente' }
  }

  async eliminarUT(utId: number) {
    await this.dataSource.query(`DELETE FROM ACTIVIDADUT WHERE UNIDADTEMATICAID = :1`, [utId])
    await this.dataSource.query(`DELETE FROM PERFILUT WHERE UNIDADTEMATICAID = :1`, [utId])
    await this.dataSource.query(`DELETE FROM UNIDADTEMATICA WHERE UNIDADTEMATICAID = :1`, [utId])
    return { message: 'Unidad temática eliminada' }
  }

  async agregarActividadUT(utId: number, dto: { actividadId: number; otro?: string | null }) {
    const [{ dup }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "dup" FROM ACTIVIDADUT WHERE UNIDADTEMATICAID = :1 AND UTACTIVIDADESID = :2`,
      [utId, dto.actividadId],
    )
    if (Number(dup) > 0) throw new BadRequestException('La actividad ya está registrada en esta UT')

    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(ACTIVIDADUTID), 0) + 1 AS "nid" FROM ACTIVIDADUT`,
    )
    await this.dataSource.query(
      `INSERT INTO ACTIVIDADUT (ACTIVIDADUTID, UNIDADTEMATICAID, UTACTIVIDADESID, ACTIVIDADUTOTRO)
       VALUES (:1, :2, :3, :4)`,
      [nid, utId, dto.actividadId, dto.otro ?? null],
    )
    return { message: 'Actividad agregada', actId: nid }
  }

  async eliminarActividadUT(actId: number) {
    await this.dataSource.query(`DELETE FROM ACTIVIDADUT WHERE ACTIVIDADUTID = :1`, [actId])
    return { message: 'Actividad eliminada' }
  }

  async agregarPerfilUT(utId: number, dto: { rubroId: number; horasCap: number; dias?: number | null }) {
    const [{ cnt }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "cnt" FROM PERFILUT WHERE UNIDADTEMATICAID = :1`, [utId],
    )
    if (Number(cnt) >= 5) throw new BadRequestException('Máximo 5 perfiles de capacitador por UT')

    const [{ dup }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "dup" FROM PERFILUT WHERE UNIDADTEMATICAID = :1 AND RUBROIDUT = :2`,
      [utId, dto.rubroId],
    )
    if (Number(dup) > 0) throw new BadRequestException('Este perfil ya está registrado en la UT')

    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(PERFILUTID), 0) + 1 AS "nid" FROM PERFILUT`,
    )
    await this.dataSource.query(
      `INSERT INTO PERFILUT (PERFILUTID, UNIDADTEMATICAID, RUBROIDUT, PERFILUTHORASCAP, PERFILUTDIAS, PERFILUTFECHAREGISTRO)
       VALUES (:1, :2, :3, :4, :5, SYSDATE)`,
      [nid, utId, dto.rubroId, dto.horasCap, dto.dias ?? null],
    )
    return { message: 'Perfil de capacitador agregado', perfilId: nid }
  }

  async eliminarPerfilUT(perfilId: number) {
    await this.dataSource.query(`DELETE FROM PERFILUT WHERE PERFILUTID = :1`, [perfilId])
    return { message: 'Perfil eliminado' }
  }

  // ── Alineación de la AF ────────────────────────────────────────────────────

  async getRetoNacionales() {
    return this.dataSource.query(
      `SELECT RETONACIONALID AS "id", RETONACIONALNOMBRE AS "nombre"
         FROM RETONACIONAL
        WHERE RETONACIONALESTADO = 1
        ORDER BY RETONACIONALID`,
    )
  }

  async getComponentesByReto(retoId: number) {
    return this.dataSource.query(
      `SELECT AFCOMPONENTEID AS "id", AFCOMPONENTENOMBRE AS "nombre"
         FROM AFCOMPONENTE
        WHERE RETONACIONALID = :1
          AND (AFCOMPONENTEESTADO IS NULL OR AFCOMPONENTEESTADO = 1)
        ORDER BY AFCOMPONENTEID`,
      [retoId],
    )
  }

  async getAfComponentesTipos() {
    const rows = await this.dataSource.query(
      `SELECT DISTINCT AFCOMPONENTETIPO AS "tipo"
         FROM AFCOMPONENTE
        WHERE AFCOMPONENTETIPO IS NOT NULL
        ORDER BY AFCOMPONENTETIPO`,
    )
    const labels: Record<number, string> = { 1: 'PND', 2: 'CONPES', 3: 'ADC' }
    return rows.map((r: { tipo: number }) => ({ tipo: r.tipo, nombre: labels[r.tipo] ?? `Tipo ${r.tipo}` }))
  }

  async getAfComponentesByTipo(tipo: number) {
    return this.dataSource.query(
      `SELECT AFCOMPONENTEID AS "id", AFCOMPONENTENOMBRE AS "nombre"
         FROM AFCOMPONENTE
        WHERE AFCOMPONENTETIPO = :1
          AND (AFCOMPONENTEESTADO IS NULL OR AFCOMPONENTEESTADO = 1)
        ORDER BY AFCOMPONENTEID`,
      [tipo],
    )
  }

  async getAlineacionAF(afId: number) {
    const [row] = await this.dataSource.query(
      `SELECT a.ACCIONFORMACIONCOMPOD AS "compod",
              a.ACCIONFORMACIONJUSTIFICACION AS "justificacion",
              a.ACCIONFORMACIONRESDESEM AS "resDesem",
              a.ACCIONFORMACIONRESFORM AS "resForm",
              a.ACCIONFORMACIONCOMPONENTEID AS "componenteId",
              c.AFCOMPONENTENOMBRE AS "componenteNombre",
              c.RETONACIONALID AS "retoNacionalId"
         FROM ACCIONFORMACION a
         LEFT JOIN AFCOMPONENTE c ON c.AFCOMPONENTEID = a.ACCIONFORMACIONCOMPONENTEID
        WHERE a.ACCIONFORMACIONID = :1`,
      [afId],
    )
    return {
      compod: row?.compod ?? null,
      justificacion: row?.justificacion ?? null,
      resDesem: row?.resDesem ?? null,
      resForm: row?.resForm ?? null,
      componenteId: row?.componenteId ?? null,
      componenteNombre: row?.componenteNombre ?? null,
      retoNacionalId: row?.retoNacionalId ?? null,
    }
  }

  async actualizarTextosAlineacion(afId: number, dto: {
    componenteId?: number | null
    compod?: string | null
    justificacion?: string | null
    resDesem?: string | null
    resForm?: string | null
  }) {
    await this.dataSource.query(
      `UPDATE ACCIONFORMACION
          SET ACCIONFORMACIONCOMPONENTEID = :1,
              ACCIONFORMACIONCOMPOD = :2,
              ACCIONFORMACIONJUSTIFICACION = :3,
              ACCIONFORMACIONRESDESEM = :4,
              ACCIONFORMACIONRESFORM = :5
        WHERE ACCIONFORMACIONID = :6`,
      [dto.componenteId ?? null, dto.compod ?? null, dto.justificacion ?? null, dto.resDesem ?? null, dto.resForm ?? null, afId],
    )
    return { message: 'Alineación guardada' }
  }

  // ── Geografía ───────────────────────────────────────────────────────────────

  async getDepartamentos() {
    return this.dataSource.query(
      `SELECT DEPARTAMENTOID AS "id", TRIM(DEPARTAMENTONOMBRE) AS "nombre"
         FROM DEPARTAMENTO ORDER BY DEPARTAMENTONOMBRE`,
    )
  }

  async getCiudadesByDepto(deptoId: number) {
    return this.dataSource.query(
      `SELECT CIUDADID AS "id", TRIM(CIUDADNOMBRE) AS "nombre"
         FROM CIUDAD WHERE DEPARTAMENTOID = :1 ORDER BY CIUDADNOMBRE`,
      [deptoId],
    )
  }

  // ── Grupos de cobertura ──────────────────────────────────────────────────────

  async getGruposCobertura(afId: number) {
    const grupos = await this.dataSource.query(
      `SELECT g.AFGRUPOID AS "grupoId",
              g.AFGRUPONUMERO AS "grupoNumero",
              DBMS_LOB.SUBSTR(g.AFGRUPOJUSTIFICACION, 4000, 1) AS "justificacion",
              NVL(SUM(c.AFGRUPOCOBERTURABENEF), 0) AS "totalBenef",
              COUNT(c.AFGRUPOCOBERTURAID) AS "numCoberturas"
         FROM AFGRUPO g
         LEFT JOIN AFGRUPOCOBERTURA c ON c.AFGRUPOID = g.AFGRUPOID
        WHERE g.ACCIONFORMACIONID = :1
        GROUP BY g.AFGRUPOID, g.AFGRUPONUMERO, DBMS_LOB.SUBSTR(g.AFGRUPOJUSTIFICACION, 4000, 1)
        ORDER BY g.AFGRUPONUMERO`,
      [afId],
    )
    return grupos.map((g: Record<string, unknown>) => ({
      ...g,
      totalBenef: Number(g['totalBenef']),
      numCoberturas: Number(g['numCoberturas']),
    }))
  }

  async crearGrupo(afId: number) {
    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(AFGRUPOID), 0) + 1 AS "nid" FROM AFGRUPO`,
    )
    const [{ nextNum }] = await this.dataSource.query(
      `SELECT NVL(MAX(AFGRUPONUMERO), 0) + 1 AS "nextNum" FROM AFGRUPO WHERE ACCIONFORMACIONID = :1`,
      [afId],
    )
    await this.dataSource.query(
      `INSERT INTO AFGRUPO (AFGRUPOID, ACCIONFORMACIONID, AFGRUPONUMERO) VALUES (:1, :2, :3)`,
      [nid, afId, nextNum],
    )
    return { grupoId: nid, grupoNumero: nextNum }
  }

  async eliminarGrupo(grupoId: number) {
    await this.dataSource.query(`DELETE FROM AFGRUPOCOBERTURA WHERE AFGRUPOID = :1`, [grupoId])
    await this.dataSource.query(`DELETE FROM AFGRUPO WHERE AFGRUPOID = :1`, [grupoId])
    return { message: 'Grupo eliminado' }
  }

  async guardarJustificacionGrupo(grupoId: number, justificacion: string | null) {
    await this.dataSource.query(
      `UPDATE AFGRUPO SET AFGRUPOJUSTIFICACION = :1 WHERE AFGRUPOID = :2`,
      [justificacion ?? null, grupoId],
    )
    return { message: 'Justificación guardada' }
  }

  async getCoberturaGrupo(grupoId: number) {
    return this.dataSource.query(
      `SELECT c.AFGRUPOCOBERTURAID AS "cobId",
              c.DEPARTAMENTOGRUPOID AS "deptoId",
              TRIM(d.DEPARTAMENTONOMBRE) AS "deptoNombre",
              c.CIUDADGRUPOID AS "ciudadId",
              TRIM(ci.CIUDADNOMBRE) AS "ciudadNombre",
              c.AFGRUPOCOBERTURABENEF AS "benef",
              NVL(c.AFGRUPOCOBERTURAMOD, 'P') AS "modal",
              NVL(c.AFGRUPOCOBERTURARURAL, 0) AS "rural"
         FROM AFGRUPOCOBERTURA c
         LEFT JOIN DEPARTAMENTO d ON d.DEPARTAMENTOID = c.DEPARTAMENTOGRUPOID
         LEFT JOIN CIUDAD ci ON ci.CIUDADID = c.CIUDADGRUPOID
        WHERE c.AFGRUPOID = :1
        ORDER BY c.AFGRUPOCOBERTURAID`,
      [grupoId],
    )
  }

  async guardarCoberturaGrupo(grupoId: number, afId: number, coberturas: {
    deptoId: number; ciudadId?: number | null; benef: number; modal: string; rural?: number
  }[]) {
    await this.dataSource.query(`DELETE FROM AFGRUPOCOBERTURA WHERE AFGRUPOID = :1`, [grupoId])
    for (const cob of coberturas) {
      const [{ nid }] = await this.dataSource.query(
        `SELECT NVL(MAX(AFGRUPOCOBERTURAID), 0) + 1 AS "nid" FROM AFGRUPOCOBERTURA`,
      )
      await this.dataSource.query(
        `INSERT INTO AFGRUPOCOBERTURA
           (AFGRUPOCOBERTURAID, AFGRUPOID, DEPARTAMENTOGRUPOID, CIUDADGRUPOID,
            AFGRUPOCOBERTURABENEF, AFGRUPOFILTRO, AFGRUPOCOBERTURAMOD, AFGRUPOCOBERTURARURAL)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8)`,
        [nid, grupoId, cob.deptoId, cob.ciudadId ?? null, cob.benef, afId, cob.modal, cob.rural ?? 0],
      )
    }
    return { message: 'Cobertura guardada' }
  }

  // ── Material de Formación ─────────────────────────────────────────────────

  async getTiposAmbiente() {
    return this.dataSource.query(
      `SELECT TIPOAMBIENTEID AS "id", TRIM(TIPOAMBIENTENOMBRE) AS "nombre" FROM TIPOAMBIENTE ORDER BY TIPOAMBIENTEID`,
    )
  }

  async getGestionConocimientos() {
    return this.dataSource.query(
      `SELECT GESTIONCONOCIMIENTOID AS "id", TRIM(GESTIONCONOCIMIENTONOMBRE) AS "nombre" FROM GESTIONCONOCIMIENTO ORDER BY GESTIONCONOCIMIENTOID`,
    )
  }

  async getMaterialFormacionCat() {
    return this.dataSource.query(
      `SELECT MATERIALFORMACIONID AS "id", TRIM(MATERIALFORMACIONNOMBRE) AS "nombre" FROM MATERIALFORMACION ORDER BY MATERIALFORMACIONID`,
    )
  }

  async getRecursosDidacticosCat() {
    return this.dataSource.query(
      `SELECT RECURSOSDIDACTICOSID AS "id", TRIM(RECURSOSDIDACTICOSNOMBRE) AS "nombre" FROM RECURSOSDIDACTICOS ORDER BY RECURSOSDIDACTICOSID`,
    )
  }

  async getMaterialAF(afId: number) {
    const [af] = await this.dataSource.query(
      `SELECT TIPOAMBIENTEID AS "tipoAmbienteId",
              DBMS_LOB.SUBSTR(ACCIONFORMACIONJUSTMAT, 4000, 1) AS "justMat",
              DBMS_LOB.SUBSTR(ACCIONFORMACIONINSUMO, 4000, 1) AS "insumo",
              DBMS_LOB.SUBSTR(ACCIONFORMACIONJUSTINSUMO, 4000, 1) AS "justInsumo"
         FROM ACCIONFORMACION WHERE ACCIONFORMACIONID = :1`,
      [afId],
    )
    const [gestion] = await this.dataSource.query(
      `SELECT GESTIONCONOCIMIENTOID AS "gestionConocimientoId" FROM AFGESTIONCONOCIMIENTO WHERE ACCIONFORMACIONID = :1`,
      [afId],
    ).then((r: unknown[]) => r.length ? r : [{}])
    const [material] = await this.dataSource.query(
      `SELECT MATERIALFORMACIONID AS "materialFormacionId" FROM MATERIALFORMACIONAF WHERE ACCIONFORMACIONID = :1`,
      [afId],
    ).then((r: unknown[]) => r.length ? r : [{}])
    const recursos = await this.dataSource.query(
      `SELECT r.RECURSOSDIDACTICOSAFID AS "rdafId",
              r.RECURSOSDIDACTICOSID AS "recursoId",
              TRIM(c.RECURSOSDIDACTICOSNOMBRE) AS "nombre"
         FROM RECURSOSDIDACTICOSAF r
         JOIN RECURSOSDIDACTICOS c ON c.RECURSOSDIDACTICOSID = r.RECURSOSDIDACTICOSID
        WHERE r.ACCIONFORMACIONID = :1
        ORDER BY r.RECURSOSDIDACTICOSAFID`,
      [afId],
    )
    return {
      tipoAmbienteId: (af as Record<string, unknown>)['tipoAmbienteId'] ?? null,
      gestionConocimientoId: (gestion as Record<string, unknown>)['gestionConocimientoId'] ?? null,
      materialFormacionId: (material as Record<string, unknown>)['materialFormacionId'] ?? null,
      justMat: (af as Record<string, unknown>)['justMat'] ?? null,
      insumo: (af as Record<string, unknown>)['insumo'] ?? null,
      justInsumo: (af as Record<string, unknown>)['justInsumo'] ?? null,
      recursos: recursos as { rdafId: number; recursoId: number; nombre: string }[],
    }
  }

  async actualizarMaterialAF(afId: number, dto: {
    tipoAmbienteId?: number | null
    gestionConocimientoId?: number | null
    materialFormacionId?: number | null
    justMat?: string | null
    insumo?: string | null
    justInsumo?: string | null
  }) {
    await this.dataSource.query(
      `UPDATE ACCIONFORMACION SET
         TIPOAMBIENTEID = :1,
         ACCIONFORMACIONJUSTMAT = :2,
         ACCIONFORMACIONINSUMO = :3,
         ACCIONFORMACIONJUSTINSUMO = :4
       WHERE ACCIONFORMACIONID = :5`,
      [dto.tipoAmbienteId ?? null, dto.justMat ?? null, dto.insumo ?? null, dto.justInsumo ?? null, afId],
    )
    await this.dataSource.query(`DELETE FROM AFGESTIONCONOCIMIENTO WHERE ACCIONFORMACIONID = :1`, [afId])
    if (dto.gestionConocimientoId) {
      const [{ nid }] = await this.dataSource.query(`SELECT NVL(MAX(AFGESTIONCONOCIMIENTOID), 0) + 1 AS "nid" FROM AFGESTIONCONOCIMIENTO`)
      await this.dataSource.query(
        `INSERT INTO AFGESTIONCONOCIMIENTO (AFGESTIONCONOCIMIENTOID, ACCIONFORMACIONID, GESTIONCONOCIMIENTOID) VALUES (:1, :2, :3)`,
        [nid, afId, dto.gestionConocimientoId],
      )
    }
    await this.dataSource.query(`DELETE FROM MATERIALFORMACIONAF WHERE ACCIONFORMACIONID = :1`, [afId])
    if (dto.materialFormacionId) {
      const [{ nid }] = await this.dataSource.query(`SELECT NVL(MAX(MATERIALFORMACIONAFID), 0) + 1 AS "nid" FROM MATERIALFORMACIONAF`)
      await this.dataSource.query(
        `INSERT INTO MATERIALFORMACIONAF (MATERIALFORMACIONAFID, ACCIONFORMACIONID, MATERIALFORMACIONID) VALUES (:1, :2, :3)`,
        [nid, afId, dto.materialFormacionId],
      )
    }
    return { message: 'Material guardado' }
  }

  async agregarRecursoAF(afId: number, recursoId: number) {
    const [{ dup }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "dup" FROM RECURSOSDIDACTICOSAF WHERE ACCIONFORMACIONID = :1 AND RECURSOSDIDACTICOSID = :2`,
      [afId, recursoId],
    )
    if (Number(dup) > 0) throw new BadRequestException('El recurso ya está registrado')
    const [{ nid }] = await this.dataSource.query(`SELECT NVL(MAX(RECURSOSDIDACTICOSAFID), 0) + 1 AS "nid" FROM RECURSOSDIDACTICOSAF`)
    await this.dataSource.query(
      `INSERT INTO RECURSOSDIDACTICOSAF (RECURSOSDIDACTICOSAFID, ACCIONFORMACIONID, RECURSOSDIDACTICOSID) VALUES (:1, :2, :3)`,
      [nid, afId, recursoId],
    )
    return { message: 'Recurso agregado', rdafId: nid }
  }

  async eliminarRecursoAF(rdafId: number) {
    await this.dataSource.query(`DELETE FROM RECURSOSDIDACTICOSAF WHERE RECURSOSDIDACTICOSAFID = :1`, [rdafId])
    return { message: 'Recurso eliminado' }
  }

  // ── Rubros ────────────────────────────────────────────────────────────────

  async getRubrosCatalogo(afId: number) {
    // Get convocatoria + modalidad of the AF
    const [af] = await this.dataSource.query(
      `SELECT af.MODALIDADFORMACIONID AS "modalidadId",
              mf.MODALIDADFORMACIONNOMBRE AS "modalidad",
              p.CONVOCATORIAID AS "convocatoriaId"
         FROM ACCIONFORMACION af
         JOIN MODALIDADFORMACION mf ON mf.MODALIDADFORMACIONID = af.MODALIDADFORMACIONID
         JOIN PROYECTO p ON p.PROYECTOID = af.PROYECTOID
        WHERE af.ACCIONFORMACIONID = :1`, [afId]
    )
    if (!af) throw new BadRequestException('AF no encontrada')

    const modalidad = (af.modalidad as string).toUpperCase().trim()
    const convId: number = af.convocatoriaId

    const rubros = await this.dataSource.query(
      `SELECT r.RUBROID       AS "rubroId",
              r.RUBROCODIGO   AS "codigo",
              r.RUBRONOMBRE   AS "nombre",
              DBMS_LOB.SUBSTR(r.RUBRODESCRIPCION, 2000, 1) AS "descripcion",
              r.RUBROTOPE     AS "tope",
              r.RUBROPAQUETE  AS "paquete",
              r.RUBROCASO     AS "caso",
              r.RUBROAF       AS "rubroAf",
              r.RUBROPROYECTO AS "rubroProyecto",
              r.RUBROPERFILUT AS "perfilUt",
              r.RUBROMODALIDAD AS "modalidades"
         FROM RUBRO r
        WHERE r.CONVOCATORIAIDRUBRO = :1
          AND r.RUBROACTIVO = 1
          AND r.RUBROAF = 1
          AND (r.RUBROMODALIDAD IS NULL OR r.RUBROMODALIDAD = ''
               OR INSTR(UPPER(r.RUBROMODALIDAD), :2) > 0)
          AND (
            r.RUBROPERFILUT = 0
            OR r.RUBROID IN (
              SELECT DISTINCT p.RUBROIDUT
                FROM PERFILUT p
                JOIN UNIDADTEMATICA ut ON ut.UNIDADTEMATICAID = p.UNIDADTEMATICAID
               WHERE ut.ACCIONFORMACIONID = :3
            )
          )
        ORDER BY r.RUBROID`, [convId, modalidad, afId]
    )
    return rubros
  }

  async getRubrosAF(afId: number) {
    const rows = await this.dataSource.query(
      `SELECT ar.AFRUBROID            AS "afrubroid",
              ar.RUBROID              AS "rubroId",
              r.RUBROCODIGO           AS "codigo",
              r.RUBRONOMBRE           AS "nombre",
              r.RUBROPAQUETE          AS "paquete",
              r.RUBROCASO             AS "caso",
              ar.AFRUBROJUSTIFICACION AS "justificacion",
              ar.AFRUBRONUMHORAS      AS "numHoras",
              ar.AFRUBROCANTIDAD      AS "cantidad",
              ar.AFRUBROBENEFICIARIOS AS "beneficiarios",
              ar.AFRUBRODIAS          AS "dias",
              ar.AFRUBRONUMEROGRUPOS  AS "numGrupos",
              ar.AFRUBROVALOR         AS "totalRubro",
              ar.AFRUBROCOFINANCIACION AS "cofSena",
              ar.AFRUBROESPECIE       AS "contraEspecie",
              ar.AFRUBRODINERO        AS "contraDinero",
              ar.AFRUBROVALORMAXIMO   AS "valorMaximo",
              ar.AFRUBROVALORPORBENEFICIARIO AS "valorBenef",
              ar.AFRUBROPORCENTAJECOFINANCIACION AS "porcSena",
              ar.AFRUBROPORCENTAJEESPECIE        AS "porcEspecie",
              ar.AFRUBROPORCENTAJEDINERO         AS "porcDinero"
         FROM AFRUBRO ar
         JOIN RUBRO r ON r.RUBROID = ar.RUBROID
        WHERE ar.ACCIONFORMACIONID = :1
          AND TRIM(r.RUBROCODIGO) NOT IN ('R09', 'R015')
        ORDER BY ar.AFRUBROID`, [afId]
    )
    return rows
  }

  async getPrerequisitosRubros(afId: number): Promise<{ ok: boolean; issues: string[] }> {
    const issues: string[] = []
    const [af] = await this.dataSource.query(
      `SELECT af.ACCIONFORMACIONNUMGRUPOS       AS "numGrupos",
              af.ACCIONFORMACIONNUMTOTHORASGRUP AS "numTotHoras",
              af.TIPOEVENTOID                  AS "tipoEventoId",
              af.MODALIDADFORMACIONID          AS "modalidadId"
         FROM ACCIONFORMACION af WHERE af.ACCIONFORMACIONID = :1`,
      [afId],
    )
    if (!af) return { ok: false, issues: ['AF no encontrada'] }

    const numGruposAF = Number(af.numGrupos) || 0
    const numTotHoras = Number(af.numTotHoras) || 0

    if (!af.tipoEventoId || !af.modalidadId)
      issues.push('Falta guardar el tipo de evento y/o modalidad de formación.')
    if (numTotHoras <= 0)
      issues.push('Falta definir el número de horas y grupos (guardar la sección "Grupos y Beneficiarios").')

    const [{ gruposCreados }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "gruposCreados" FROM AFGRUPO WHERE ACCIONFORMACIONID = :1`, [afId])
    if (Number(gruposCreados) < numGruposAF)
      issues.push(`Faltan grupos de cobertura: la AF tiene ${numGruposAF} grupos definidos pero solo ${Number(gruposCreados)} están creados.`)

    const [{ gruposSinCob }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "gruposSinCob" FROM AFGRUPO g
        WHERE g.ACCIONFORMACIONID = :1
          AND NOT EXISTS (SELECT 1 FROM AFGRUPOCOBERTURA c WHERE c.AFGRUPOID = g.AFGRUPOID)`,
      [afId])
    if (Number(gruposSinCob) > 0)
      issues.push(`${Number(gruposSinCob)} grupo(s) no tienen cobertura registrada. Complete la cobertura de cada grupo.`)

    const [{ totalUTs }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "totalUTs" FROM UNIDADTEMATICA WHERE ACCIONFORMACIONID = :1`, [afId])
    if (Number(totalUTs) === 0)
      issues.push('Debe registrar al menos una Unidad Temática.')

    if (numTotHoras > 0) {
      const [{ horasUTs }] = await this.dataSource.query(
        `SELECT NVL(SUM(
           NVL(UNIDADTEMATICAHORASPP,0)+NVL(UNIDADTEMATICAHORASPV,0)+
           NVL(UNIDADTEMATICAHORASPPAT,0)+NVL(UNIDADTEMATICAHORASPHIB,0)+
           NVL(UNIDADTEMATICAHORASTP,0)+NVL(UNIDADTEMATICAHORASTV,0)+
           NVL(UNIDADTEMATICAHORASTPAT,0)+NVL(UNIDADTEMATICAHORASTHIB,0)
         ),0) AS "horasUTs" FROM UNIDADTEMATICA WHERE ACCIONFORMACIONID = :1`,
        [afId])
      if (Number(horasUTs) < numTotHoras)
        issues.push(`Las horas de las UTs (${Number(horasUTs)}h) no cubren el total de la AF (${numTotHoras}h). Agregue más horas en las UTs.`)
    }

    return { ok: issues.length === 0, issues }
  }

  private async validarPrerequisitosRubros(afId: number) {
    const [af] = await this.dataSource.query(
      `SELECT af.ACCIONFORMACIONNUMGRUPOS       AS "numGrupos",
              af.ACCIONFORMACIONNUMTOTHORASGRUP AS "numTotHoras",
              af.TIPOEVENTOID                  AS "tipoEventoId",
              af.MODALIDADFORMACIONID          AS "modalidadId"
         FROM ACCIONFORMACION af WHERE af.ACCIONFORMACIONID = :1`,
      [afId],
    )
    if (!af) throw new BadRequestException('AF no encontrada')

    const numGruposAF = Number(af.numGrupos) || 0
    const numTotHoras = Number(af.numTotHoras) || 0

    // 1. Debe tener tipo de evento, modalidad y horas definidas
    if (!af.tipoEventoId || !af.modalidadId)
      throw new BadRequestException('Debe guardar primero el tipo de evento y modalidad de formación antes de registrar rubros.')
    if (numTotHoras <= 0)
      throw new BadRequestException('Debe definir el número de horas y grupos antes de registrar rubros.')

    // 2. Cada grupo debe tener al menos una cobertura registrada
    const [{ gruposSinCob }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "gruposSinCob"
         FROM AFGRUPO g
        WHERE g.ACCIONFORMACIONID = :1
          AND NOT EXISTS (
            SELECT 1 FROM AFGRUPOCOBERTURA c WHERE c.AFGRUPOID = g.AFGRUPOID
          )`,
      [afId],
    )
    if (Number(gruposSinCob) > 0)
      throw new BadRequestException(`${Number(gruposSinCob)} grupo(s) no tienen cobertura registrada. Complete la cobertura de todos los grupos antes de registrar rubros.`)

    // 3. El número de grupos con cobertura debe coincidir con numGrupos de la AF
    const [{ gruposConCob }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "gruposConCob" FROM AFGRUPO WHERE ACCIONFORMACIONID = :1`,
      [afId],
    )
    if (Number(gruposConCob) < numGruposAF)
      throw new BadRequestException(`La AF tiene ${numGruposAF} grupos definidos pero solo ${Number(gruposConCob)} están creados en cobertura. Registre todos los grupos.`)

    // 4. Debe haber al menos una unidad temática
    const [{ totalUTs }] = await this.dataSource.query(
      `SELECT COUNT(1) AS "totalUTs" FROM UNIDADTEMATICA WHERE ACCIONFORMACIONID = :1`,
      [afId],
    )
    if (Number(totalUTs) === 0)
      throw new BadRequestException('Debe registrar al menos una Unidad Temática antes de registrar rubros.')

    // 5. Las horas de las UTs deben sumar el total de horas de la AF
    const [{ horasUTs }] = await this.dataSource.query(
      `SELECT NVL(SUM(
         NVL(ut.UNIDADTEMATICAHORASPP,0) + NVL(ut.UNIDADTEMATICAHORASPV,0) +
         NVL(ut.UNIDADTEMATICAHORASPPAT,0) + NVL(ut.UNIDADTEMATICAHORASPHIB,0) +
         NVL(ut.UNIDADTEMATICAHORASTP,0) + NVL(ut.UNIDADTEMATICAHORASTV,0) +
         NVL(ut.UNIDADTEMATICAHORASTPAT,0) + NVL(ut.UNIDADTEMATICAHORASTHIB,0)
       ), 0) AS "horasUTs"
         FROM UNIDADTEMATICA ut WHERE ut.ACCIONFORMACIONID = :1`,
      [afId],
    )
    if (Number(horasUTs) < numTotHoras)
      throw new BadRequestException(`Las horas de las Unidades Temáticas (${Number(horasUTs)}h) no completan las horas totales de la AF (${numTotHoras}h). Complete las UTs antes de registrar rubros.`)
  }

  async guardarRubroAF(proyectoId: number, afId: number, dto: {
    rubroId: number; justificacion: string
    numHoras: number; cantidad: number; beneficiarios: number; dias: number; numGrupos: number
    totalRubro: number; cofSena: number; contraEspecie: number; contraDinero: number
    valorMaximo: number; valorBenef: number; paquete: string
  }) {
    await this.validarPrerequisitosRubros(afId)

    const { rubroId, justificacion, numHoras, beneficiarios, dias,
            numGrupos, totalRubro, cofSena, contraEspecie, contraDinero,
            valorMaximo, valorBenef, paquete } = dto

    // Cantidad mínima 1: aunque el rubro sea intangible (ej. rubroid 365),
    // siempre debe representar "al menos una unidad" en la BD.
    const cantidad = Math.max(1, Number(dto.cantidad) || 1)

    const porcSena    = totalRubro > 0 ? (cofSena    / totalRubro) * 100 : 0
    const porcEspecie = totalRubro > 0 ? (contraEspecie / totalRubro) * 100 : 0
    const porcDinero  = totalRubro > 0 ? (contraDinero  / totalRubro) * 100 : 0

    const [existing] = await this.dataSource.query(
      `SELECT AFRUBROID AS "id" FROM AFRUBRO WHERE ACCIONFORMACIONID = :1 AND RUBROID = :2`,
      [afId, rubroId]
    )

    if (existing) {
      await this.dataSource.query(
        `UPDATE AFRUBRO SET
           AFRUBROJUSTIFICACION          = :1,
           AFRUBRONUMHORAS               = :2,
           AFRUBROCANTIDAD               = :3,
           AFRUBROBENEFICIARIOS          = :4,
           AFRUBRODIAS                   = :5,
           AFRUBRONUMEROGRUPOS           = :6,
           AFRUBROVALOR                  = :7,
           AFRUBROCOFINANCIACION         = :8,
           AFRUBROESPECIE                = :9,
           AFRUBRODINERO                 = :10,
           AFRUBROVALORMAXIMO            = :11,
           AFRUBROVALORPORBENEFICIARIO   = :12,
           AFRUBROPAQUETE                = :13,
           AFRUBROPORCENTAJECOFINANCIACION = :14,
           AFRUBROPORCENTAJEESPECIE      = :15,
           AFRUBROPORCENTAJEDINERO       = :16,
           AFRUBROFECHAREGISTRO          = SYSDATE
         WHERE AFRUBROID = :17`,
        [justificacion, numHoras, cantidad, beneficiarios, dias, numGrupos,
         totalRubro, cofSena, contraEspecie, contraDinero, valorMaximo, valorBenef,
         paquete, porcSena, porcEspecie, porcDinero, existing.id]
      )
      return { message: 'Rubro actualizado', afrubroid: existing.id }
    }

    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(AFRUBROID), 0) + 1 AS "nid" FROM AFRUBRO`
    )
    await this.dataSource.query(
      `INSERT INTO AFRUBRO (
         AFRUBROID, PROYECTOIDRUBROAF, ACCIONFORMACIONID, RUBROID,
         AFRUBROJUSTIFICACION, AFRUBRONUMHORAS, AFRUBROCANTIDAD,
         AFRUBROBENEFICIARIOS, AFRUBRODIAS, AFRUBRONUMEROGRUPOS,
         AFRUBROVALOR, AFRUBROCOFINANCIACION, AFRUBROESPECIE, AFRUBRODINERO,
         AFRUBROVALORMAXIMO, AFRUBROVALORPORBENEFICIARIO, AFRUBROPAQUETE,
         AFRUBROPORCENTAJECOFINANCIACION, AFRUBROPORCENTAJEESPECIE, AFRUBROPORCENTAJEDINERO,
         AFRUBROFECHAREGISTRO
       ) VALUES (
         :1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15,:16,:17,:18,:19,:20,SYSDATE
       )`,
      [nid, proyectoId, afId, rubroId,
       justificacion, numHoras, cantidad, beneficiarios, dias, numGrupos,
       totalRubro, cofSena, contraEspecie, contraDinero, valorMaximo, valorBenef,
       paquete, porcSena, porcEspecie, porcDinero]
    )
    return { message: 'Rubro guardado', afrubroid: nid }
  }

  async eliminarRubroAF(afId: number, afrubroid: number) {
    await this.dataSource.query(`DELETE FROM AFRUBRO WHERE AFRUBROID = :1`, [afrubroid])
    // Limpiar GO y Transferencia al modificar rubros
    await this.dataSource.query(
      `DELETE FROM AFRUBRO ar WHERE ar.ACCIONFORMACIONID = :1
         AND EXISTS (SELECT 1 FROM RUBRO r WHERE r.RUBROID = ar.RUBROID AND TRIM(r.RUBROCODIGO) IN ('R09','R015'))`,
      [afId]
    )
    return { message: 'Rubro eliminado' }
  }

  // ── Gastos de Operación ────────────────────────────────────────────────────

  private async getRubroConvByCode(afId: number, codigo: string) {
    const [row] = await this.dataSource.query(
      `SELECT r.RUBROID AS "rubroId", r.RUBROPAQUETE AS "paquete"
         FROM RUBRO r
         JOIN PROYECTO p ON p.CONVOCATORIAID = r.CONVOCATORIAIDRUBRO
         JOIN ACCIONFORMACION af ON af.PROYECTOID = p.PROYECTOID
        WHERE af.ACCIONFORMACIONID = :1 AND TRIM(r.RUBROCODIGO) = :2`, [afId, codigo]
    )
    return row
  }

  async getGastosOperacion(afId: number) {
    const [row] = await this.dataSource.query(
      `SELECT ar.AFRUBROID AS "afrubroid", ar.AFRUBROCOFINANCIACION AS "cofSena",
              ar.AFRUBROESPECIE AS "especie", ar.AFRUBRODINERO AS "dinero",
              ar.AFRUBROVALOR AS "total"
         FROM AFRUBRO ar
         JOIN RUBRO r ON r.RUBROID = ar.RUBROID
        WHERE ar.ACCIONFORMACIONID = :1 AND TRIM(r.RUBROCODIGO) = 'R09'`, [afId]
    )
    return row ?? null
  }

  async guardarGastosOperacion(proyectoId: number, afId: number, dto: { cofSena: number; especie: number; dinero: number }) {
    await this.validarPrerequisitosRubros(afId)
    const rubro = await this.getRubroConvByCode(afId, 'R09')
    if (!rubro) throw new BadRequestException('Rubro GO no encontrado para esta convocatoria')
    const total = (dto.cofSena ?? 0) + (dto.especie ?? 0) + (dto.dinero ?? 0)
    const porcSena    = total > 0 ? (dto.cofSena  / total) * 100 : 0
    const porcEspecie = total > 0 ? (dto.especie  / total) * 100 : 0
    const porcDinero  = total > 0 ? (dto.dinero   / total) * 100 : 0
    const [existing] = await this.dataSource.query(
      `SELECT AFRUBROID AS "id" FROM AFRUBRO WHERE ACCIONFORMACIONID = :1 AND RUBROID = :2`,
      [afId, rubro.rubroId]
    )
    if (existing) {
      await this.dataSource.query(
        `UPDATE AFRUBRO SET AFRUBROVALOR=:1, AFRUBROCOFINANCIACION=:2, AFRUBROESPECIE=:3, AFRUBRODINERO=:4,
           AFRUBROPORCENTAJECOFINANCIACION=:5, AFRUBROPORCENTAJEESPECIE=:6, AFRUBROPORCENTAJEDINERO=:7,
           AFRUBROFECHAREGISTRO=SYSDATE WHERE AFRUBROID=:8`,
        [total, dto.cofSena, dto.especie, dto.dinero, porcSena, porcEspecie, porcDinero, existing.id]
      )
      return { afrubroid: existing.id }
    }
    const [{ nid }] = await this.dataSource.query(`SELECT NVL(MAX(AFRUBROID), 0) + 1 AS "nid" FROM AFRUBRO`)
    await this.dataSource.query(
      `INSERT INTO AFRUBRO (AFRUBROID, PROYECTOIDRUBROAF, ACCIONFORMACIONID, RUBROID,
         AFRUBROJUSTIFICACION, AFRUBROCANTIDAD, AFRUBROVALOR, AFRUBROCOFINANCIACION, AFRUBROESPECIE, AFRUBRODINERO,
         AFRUBROPAQUETE, AFRUBROPORCENTAJECOFINANCIACION, AFRUBROPORCENTAJEESPECIE, AFRUBROPORCENTAJEDINERO, AFRUBROFECHAREGISTRO)
       VALUES (:1,:2,:3,:4,'GASTOS DE OPERACIÓN',1,:5,:6,:7,:8,:9,:10,:11,:12,SYSDATE)`,
      [nid, proyectoId, afId, rubro.rubroId, total, dto.cofSena, dto.especie, dto.dinero,
       rubro.paquete, porcSena, porcEspecie, porcDinero]
    )
    return { afrubroid: nid }
  }

  // ── Transferencia ──────────────────────────────────────────────────────────

  async getTransferencia(afId: number) {
    const [row] = await this.dataSource.query(
      `SELECT ar.AFRUBROID AS "afrubroid", ar.AFRUBROBENEFICIARIOS AS "beneficiarios",
              ar.AFRUBROVALOR AS "valor"
         FROM AFRUBRO ar
         JOIN RUBRO r ON r.RUBROID = ar.RUBROID
        WHERE ar.ACCIONFORMACIONID = :1 AND TRIM(r.RUBROCODIGO) = 'R015'`, [afId]
    )
    return row ?? null
  }

  async guardarTransferencia(proyectoId: number, afId: number, dto: { beneficiarios: number; valor: number }) {
    await this.validarPrerequisitosRubros(afId)
    const rubro = await this.getRubroConvByCode(afId, 'R015')
    if (!rubro) throw new BadRequestException('Rubro Transferencia no encontrado para esta convocatoria')
    const [existing] = await this.dataSource.query(
      `SELECT AFRUBROID AS "id" FROM AFRUBRO WHERE ACCIONFORMACIONID = :1 AND RUBROID = :2`,
      [afId, rubro.rubroId]
    )
    if (existing) {
      await this.dataSource.query(
        `UPDATE AFRUBRO SET AFRUBROBENEFICIARIOS=:1, AFRUBROVALOR=:2, AFRUBRODINERO=:3,
           AFRUBROPORCENTAJEDINERO=100, AFRUBROFECHAREGISTRO=SYSDATE WHERE AFRUBROID=:4`,
        [dto.beneficiarios, dto.valor, dto.valor, existing.id]
      )
      return { afrubroid: existing.id }
    }
    const [{ nid }] = await this.dataSource.query(`SELECT NVL(MAX(AFRUBROID), 0) + 1 AS "nid" FROM AFRUBRO`)
    await this.dataSource.query(
      `INSERT INTO AFRUBRO (AFRUBROID, PROYECTOIDRUBROAF, ACCIONFORMACIONID, RUBROID,
         AFRUBROJUSTIFICACION, AFRUBROCANTIDAD, AFRUBROBENEFICIARIOS, AFRUBROVALOR, AFRUBRODINERO,
         AFRUBROPAQUETE, AFRUBROPORCENTAJEDINERO, AFRUBROFECHAREGISTRO)
       VALUES (:1,:2,:3,:4,'TRANSFERENCIA CONOCIMIENTO',1,:5,:6,:7,:8,100,SYSDATE)`,
      [nid, proyectoId, afId, rubro.rubroId, dto.beneficiarios, dto.valor, dto.valor, rubro.paquete]
    )
    return { afrubroid: nid }
  }
}
