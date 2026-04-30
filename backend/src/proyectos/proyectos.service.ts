import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { Empresa } from '../auth/entities/empresa.entity'
import { NecesidadesService } from '../necesidades/necesidades.service'
import { createHash, randomBytes } from 'crypto'

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
    private readonly necesidadesService: NecesidadesService,
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
              cv.CONVOCATORIAESTADO     AS "convocatoriaEstado",
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

  // ── Validación de completitud (antes de confirmar) ────────────────────────

  /** Recorre todas las dimensiones del proyecto y devuelve la lista de
   *  problemas que impiden confirmarlo. Si la lista viene vacía, el proyecto
   *  está completo. */
  async validarCompletitudParaConfirmar(proyectoId: number): Promise<string[]> {
    const issues: string[] = []

    // 1. Empresa + representante + generalidades
    // Para los CLOBs solo nos interesa saber si están vacíos: usamos
    // DBMS_LOB.GETLENGTH (NUMBER) en vez de SUBSTR para evitar
    // ORA-06502 cuando el contenido tiene caracteres multibyte y
    // 4000 chars exceden los 4000 bytes de un VARCHAR2 estándar.
    const [emp] = await this.dataSource.query(
      `SELECT e.EMPRESARAZONSOCIAL        AS "razonSocial",
              e.EMPRESAIDENTIFICACION     AS "nit",
              e.EMPRESAEMAIL              AS "email",
              e.EMPRESADIRECCION          AS "direccion",
              e.EMPRESACELULAR            AS "celular",
              e.EMPRESATELEFONO           AS "telefono",
              e.DEPARTAMENTOEMPRESAID     AS "deptoId",
              e.CIUDADEMPRESAID           AS "ciudadId",
              e.COBERTURAEMPRESAID        AS "coberturaId",
              e.CIIUID                    AS "ciiuId",
              e.TIPOEMPRESAID             AS "tipoEmpresaId",
              e.TAMANOEMPRESAID           AS "tamanoEmpresaId",
              e.EMPRESAREP                AS "rep",
              e.EMPRESAREPDOCUMENTO       AS "repDoc",
              e.EMPRESAREPCARGO           AS "repCargo",
              e.EMPRESAREPCORREO          AS "repCorreo",
              e.EMPRESAREPTEL             AS "repTel",
              DBMS_LOB.GETLENGTH(e.EMPRESAOBJETO)       AS "objetoLen",
              DBMS_LOB.GETLENGTH(e.EMPRESAPRODUCTOS)    AS "productosLen",
              DBMS_LOB.GETLENGTH(e.EMPRESASITUACION)    AS "situacionLen",
              DBMS_LOB.GETLENGTH(e.EMPRESAPAPEL)        AS "papelLen",
              DBMS_LOB.GETLENGTH(e.EMPRESARETOS)        AS "retosLen",
              DBMS_LOB.GETLENGTH(e.EMPRESAEXPERIENCIA)  AS "experienciaLen"
         FROM PROYECTO p
         JOIN EMPRESA e ON e.EMPRESAID = p.EMPRESAID
        WHERE p.PROYECTOID = :1`,
      [proyectoId],
    )
    if (!emp) throw new NotFoundException('Proyecto no encontrado')

    if (!emp.razonSocial)     issues.push('Empresa: falta razón social.')
    if (!emp.nit)             issues.push('Empresa: falta NIT.')
    if (!emp.email)           issues.push('Empresa: falta correo electrónico.')
    if (!emp.direccion)       issues.push('Empresa: falta dirección.')
    if (!emp.celular && !emp.telefono) issues.push('Empresa: falta teléfono o celular.')
    if (!emp.deptoId)         issues.push('Empresa: falta departamento.')
    if (!emp.ciudadId)        issues.push('Empresa: falta ciudad/municipio.')
    if (!emp.coberturaId)     issues.push('Empresa: falta cobertura.')
    if (!emp.ciiuId)          issues.push('Empresa: falta código CIIU.')
    if (!emp.tipoEmpresaId)   issues.push('Empresa: falta tipo de empresa.')
    if (!emp.tamanoEmpresaId) issues.push('Empresa: falta tamaño de empresa.')
    if (!emp.rep)             issues.push('Representante Legal: falta nombre.')
    if (!emp.repDoc)          issues.push('Representante Legal: falta documento.')
    if (!emp.repCargo)        issues.push('Representante Legal: falta cargo.')
    if (!emp.repCorreo)       issues.push('Representante Legal: falta correo.')
    if (!emp.repTel)          issues.push('Representante Legal: falta teléfono.')
    if (!Number(emp.objetoLen))      issues.push('Generalidades: falta objeto social.')
    if (!Number(emp.productosLen))   issues.push('Generalidades: faltan productos/servicios.')
    if (!Number(emp.situacionLen))   issues.push('Generalidades: falta situación actual.')
    if (!Number(emp.papelLen))       issues.push('Generalidades: falta papel del proponente.')
    if (!Number(emp.retosLen))       issues.push('Generalidades: faltan retos estratégicos.')
    if (!Number(emp.experienciaLen)) issues.push('Generalidades: falta experiencia en formación.')

    // 2. Datos del proyecto
    const [proy] = await this.dataSource.query(
      `SELECT PROYECTONOMBRE                       AS "nombre",
              DBMS_LOB.GETLENGTH(PROYECTOOBJETIVO) AS "objetivoLen"
         FROM PROYECTO WHERE PROYECTOID = :1`,
      [proyectoId],
    )
    if (!proy.nombre)              issues.push('Proyecto: falta nombre.')
    if (!Number(proy.objetivoLen)) issues.push('Proyecto: falta objetivo general.')

    // 3. AFs (mínimo 1) + completitud por AF
    // Usamos GETLENGTH para los CLOBs (solo nos importa si están vacíos),
    // así evitamos el ORA-06502 con contenido multibyte UTF-8.
    const afs = await this.dataSource.query(
      `SELECT ACCIONFORMACIONID            AS "afId",
              ACCIONFORMACIONNUMERO        AS "numero",
              ACCIONFORMACIONNOMBRE        AS "nombre",
              TIPOEVENTOID                 AS "tipoEventoId",
              MODALIDADFORMACIONID         AS "modalidadId",
              METODOLOGIAAPRENDIZAJEID     AS "metodologiaId",
              ACCIONFORMACIONNUMHORAGRUPO  AS "numHorasGrupo",
              ACCIONFORMACIONNUMGRUPOS     AS "numGrupos",
              ACCIONFORMACIONNUMBENEF      AS "numBenef",
              DBMS_LOB.GETLENGTH(ACCIONFORMACIONJUSTNEC)       AS "justnecLen",
              DBMS_LOB.GETLENGTH(ACCIONFORMACIONCAUSA)         AS "causaLen",
              DBMS_LOB.GETLENGTH(ACCIONFORMACIONRESULTADOS)    AS "efectosLen",
              DBMS_LOB.GETLENGTH(ACCIONFORMACIONOBJETIVO)      AS "objetivoLen",
              NECESIDADFORMACIONIDAF       AS "necesidadFormacionId",
              AFENFOQUEID                  AS "enfoqueId",
              TIPOAMBIENTEID               AS "tipoAmbienteId",
              ACCIONFORMACIONCOMPONENTEID  AS "componenteId",
              DBMS_LOB.GETLENGTH(ACCIONFORMACIONCOMPOD)        AS "compodLen",
              DBMS_LOB.GETLENGTH(ACCIONFORMACIONJUSTIFICACION) AS "justAlinLen",
              DBMS_LOB.GETLENGTH(ACCIONFORMACIONRESDESEM)      AS "resDesemLen",
              DBMS_LOB.GETLENGTH(ACCIONFORMACIONRESFORM)       AS "resFormLen"
         FROM ACCIONFORMACION
        WHERE PROYECTOID = :1
        ORDER BY ACCIONFORMACIONNUMERO`,
      [proyectoId],
    )

    if (afs.length === 0) {
      issues.push('Debe registrar al menos una Acción de Formación.')
    } else {
      for (const af of afs) {
        const tag = `AF ${af.numero}`
        if (!af.nombre)               issues.push(`${tag}: falta nombre.`)
        if (!af.tipoEventoId)         issues.push(`${tag}: falta tipo de evento.`)
        if (!af.modalidadId)          issues.push(`${tag}: falta modalidad.`)
        if (!af.metodologiaId)        issues.push(`${tag}: falta metodología.`)
        if (!Number(af.numHorasGrupo))issues.push(`${tag}: faltan horas por grupo.`)
        if (!Number(af.numGrupos))    issues.push(`${tag}: falta número de grupos.`)
        if (!Number(af.numBenef))     issues.push(`${tag}: faltan beneficiarios.`)
        if (!Number(af.justnecLen))   issues.push(`${tag}: falta justificación de la necesidad.`)
        if (!Number(af.causaLen))     issues.push(`${tag}: falta causa.`)
        if (!Number(af.efectosLen))   issues.push(`${tag}: faltan efectos.`)
        if (!Number(af.objetivoLen))  issues.push(`${tag}: falta objetivo.`)
        if (!af.necesidadFormacionId) issues.push(`${tag}: no está vinculada a una necesidad de formación.`)
        if (!af.enfoqueId)            issues.push(`${tag}: falta enfoque.`)
        if (!af.tipoAmbienteId)       issues.push(`${tag}: falta el ambiente de aprendizaje.`)

        // Alineación
        if (!af.componenteId)            issues.push(`${tag}: falta componente estratégico (Reto Nacional).`)
        if (!Number(af.compodLen))       issues.push(`${tag}: falta justificación de la alineación.`)
        if (!Number(af.justAlinLen))     issues.push(`${tag}: falta justificación de AF Especializada.`)
        if (!Number(af.resDesemLen))     issues.push(`${tag}: faltan resultados de impacto en el desempeño.`)
        if (!Number(af.resFormLen))      issues.push(`${tag}: faltan resultados de impacto en productividad.`)

        // Áreas / Niveles / CUOC (perfil)
        const [{ totAreas }] = await this.dataSource.query(
          `SELECT COUNT(1) AS "totAreas" FROM AFAREAFUNCIONAL WHERE ACCIONFORMACIONIDAF = :1`,
          [af.afId],
        )
        if (Number(totAreas) === 0) issues.push(`${tag}: no tiene áreas funcionales.`)
        const [{ totNiv }] = await this.dataSource.query(
          `SELECT COUNT(1) AS "totNiv" FROM AFNIVELOCUPACIONAL WHERE ACCIONFORMACIONID = :1`,
          [af.afId],
        )
        if (Number(totNiv) === 0) issues.push(`${tag}: no tiene niveles ocupacionales.`)
        const [{ totCuoc }] = await this.dataSource.query(
          `SELECT COUNT(1) AS "totCuoc" FROM OCUPACIONCOUCAF WHERE ACCIONFORMACIONID = :1`,
          [af.afId],
        )
        if (Number(totCuoc) === 0) issues.push(`${tag}: no tiene ocupaciones CUOC.`)

        // Sectores beneficiarios
        const [{ totSecBen }] = await this.dataSource.query(
          `SELECT COUNT(1) AS "totSecBen" FROM AFPSECTOR WHERE ACCIONFORMACIONID = :1`,
          [af.afId],
        )
        if (Number(totSecBen) === 0) issues.push(`${tag}: no tiene sectores beneficiarios.`)

        // Grupos vs cobertura
        const [{ gruposCreados }] = await this.dataSource.query(
          `SELECT COUNT(1) AS "gruposCreados" FROM AFGRUPO WHERE ACCIONFORMACIONID = :1`,
          [af.afId],
        )
        const numGruposAF = Number(af.numGrupos) || 0
        if (Number(gruposCreados) < numGruposAF) {
          issues.push(`${tag}: faltan grupos de cobertura (${gruposCreados}/${numGruposAF}).`)
        }
        const [{ gruposSinCob }] = await this.dataSource.query(
          `SELECT COUNT(1) AS "gruposSinCob" FROM AFGRUPO g
            WHERE g.ACCIONFORMACIONID = :1
              AND NOT EXISTS (SELECT 1 FROM AFGRUPOCOBERTURA c WHERE c.AFGRUPOID = g.AFGRUPOID)`,
          [af.afId],
        )
        if (Number(gruposSinCob) > 0) {
          issues.push(`${tag}: hay ${gruposSinCob} grupo(s) sin cobertura registrada.`)
        }

        // Unidades temáticas
        const [{ totUTs }] = await this.dataSource.query(
          `SELECT COUNT(1) AS "totUTs" FROM UNIDADTEMATICA WHERE ACCIONFORMACIONID = :1`,
          [af.afId],
        )
        if (Number(totUTs) === 0) {
          issues.push(`${tag}: no tiene unidades temáticas.`)
        } else {
          const numHorasGrupo = Number(af.numHorasGrupo) || 0
          if (numHorasGrupo > 0) {
            const [{ horasUTs }] = await this.dataSource.query(
              `SELECT NVL(SUM(
                 NVL(UNIDADTEMATICAHORASPP,0)+NVL(UNIDADTEMATICAHORASPV,0)+
                 NVL(UNIDADTEMATICAHORASPPAT,0)+NVL(UNIDADTEMATICAHORASPHIB,0)+
                 NVL(UNIDADTEMATICAHORASTP,0)+NVL(UNIDADTEMATICAHORASTV,0)+
                 NVL(UNIDADTEMATICAHORASTPAT,0)+NVL(UNIDADTEMATICAHORASTHIB,0)
               ),0) AS "horasUTs" FROM UNIDADTEMATICA WHERE ACCIONFORMACIONID = :1`,
              [af.afId],
            )
            if (Number(horasUTs) < numHorasGrupo) {
              issues.push(`${tag}: las horas de las UTs (${horasUTs}h) no cubren las horas por grupo (${numHorasGrupo}h).`)
            }
          }
        }

        // Rubros del presupuesto (excluye R09 y R015 que son GO y transferencia)
        const [{ totRubros }] = await this.dataSource.query(
          `SELECT COUNT(1) AS "totRubros" FROM AFRUBRO ar
             JOIN RUBRO r ON r.RUBROID = ar.RUBROID
            WHERE ar.ACCIONFORMACIONID = :1
              AND TRIM(r.RUBROCODIGO) NOT IN ('R09','R015')`,
          [af.afId],
        )
        if (Number(totRubros) === 0) issues.push(`${tag}: no tiene rubros registrados en el presupuesto.`)
      }
    }

    // 4. Presupuesto general (topes)
    try {
      const r = await this.getPresupuestoProyecto(proyectoId)
      if (r.totalesAfs.valorTotalAFs <= 0) {
        issues.push('Presupuesto: las acciones de formación no tienen presupuesto registrado.')
      } else {
        if (r.go.porcSobreAFs > r.go.topePermitido) {
          issues.push(`Presupuesto: Gastos de Operación (${r.go.porcSobreAFs.toFixed(2)}%) supera el tope ${r.go.codigo} (${r.go.topePermitido}%).`)
        }
        if (r.transferencia.porcBeneficiarios < 5) {
          issues.push(`Presupuesto: beneficiarios de Transferencia (${r.transferencia.porcBeneficiarios.toFixed(2)}%) deben ser mínimo 5%.`)
        }
        if (r.transferencia.porcValor < 1) {
          issues.push(`Presupuesto: valor de Transferencia (${r.transferencia.porcValor.toFixed(2)}%) debe ser mínimo 1% del total (AFs + Gastos de Operación).`)
        }
      }
    } catch { /* si falla la consulta de presupuesto, lo dejamos pasar y otras validaciones lo cubren */ }

    return issues
  }

  // ── Versionado del proyecto ──────────────────────────────────────────────

  /** Construye un snapshot completo del proyecto para guardar como versión:
   *  reporte base + detalle por AF (perfil, sectores, grupos+coberturas,
   *  unidades temáticas, material, alineación, rubros, GO, transferencia). */
  async getProyectoSnapshot(proyectoId: number): Promise<Record<string, unknown>> {
    const reporte = await this.getReporteProyecto(proyectoId) as Record<string, any>

    const acciones = (reporte.acciones as Array<{ afId: number }>) ?? []
    const accionesDetalle = await Promise.all(
      acciones.map(async (a) => {
        const afId = Number(a.afId)
        const [perfil, sectores, gruposBasicos, utsResumen, material, alineacion, rubros, gastoOperacion, transferencia] =
          await Promise.all([
            this.getPerfilBeneficiarios(afId).catch(() => null),
            this.getSectoresYSubsectores(afId).catch(() => null),
            this.getGruposCobertura(afId).catch(() => [] as any[]),
            this.listarUTs(afId).catch(() => [] as any[]),
            this.getMaterialAF(afId).catch(() => null),
            this.getAlineacionAF(afId).catch(() => null),
            this.getRubrosAF(afId).catch(() => [] as any[]),
            this.getGastosOperacion(afId).catch(() => null),
            this.getTransferencia(afId).catch(() => null),
          ])

        const grupos = await Promise.all(
          (gruposBasicos as any[]).map(async (g: any) => ({
            ...g,
            coberturas: await this.getCoberturaGrupo(Number(g.grupoId)).catch(() => []),
          })),
        )

        const unidadesTematicas = await Promise.all(
          (utsResumen as any[]).map(async (ut: any) =>
            this.getUTDetalle(Number(ut.utId)).catch(() => null),
          ),
        ).then(arr => arr.filter(Boolean))

        return {
          afId,
          perfil, sectores, grupos, unidadesTematicas,
          material, alineacion, rubros, gastoOperacion, transferencia,
        }
      }),
    )

    return { ...reporte, accionesDetalle, snapshotFecha: new Date().toISOString() }
  }

  /** Crea una nueva versión del proyecto con su snapshot inmutable y código
   *  único. Devuelve el número y código de la versión recién creada. */
  async crearVersionProyecto(
    proyectoId: number, email: string, comentario?: string | null,
  ): Promise<{ versionNumero: number; versionCodigo: string }> {
    const snapshot = await this.getProyectoSnapshot(proyectoId)
    const snapshotJson = JSON.stringify(snapshot)

    // Próximo número de versión para este proyecto
    const [{ next }] = await this.dataSource.query(
      `SELECT NVL(MAX(VERSIONNUMERO), 0) + 1 AS "next"
         FROM PROYECTOVERSION WHERE PROYECTOID = :1`,
      [proyectoId],
    )
    const versionNumero = Number(next)

    // Hash completo del snapshot (integridad) y código corto (legible)
    const fullHash = createHash('sha256').update(snapshotJson).digest('hex')
    const seedStr = `${proyectoId}-V${versionNumero}-${Date.now()}-${snapshotJson.length}`
    const codigoHash = createHash('sha256')
      .update(snapshotJson + seedStr)
      .digest('hex')
      .slice(0, 8)
      .toUpperCase()
    const versionCodigo = `PRY-${proyectoId}-V${versionNumero}-${codigoHash}`

    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(PROYECTOVERSIONID), 0) + 1 AS "nid" FROM PROYECTOVERSION`,
    )

    await this.dataSource.query(
      `INSERT INTO PROYECTOVERSION
         (PROYECTOVERSIONID, PROYECTOID, VERSIONNUMERO, VERSIONCODIGO,
          VERSIONFECHA, VERSIONUSUARIO, VERSIONSNAPSHOT, VERSIONHASH,
          VERSIONESTADOAL, VERSIONCOMENTARIO)
       VALUES (:1, :2, :3, :4, SYSDATE, :5, :6, :7, 1, :8)`,
      [nid, proyectoId, versionNumero, versionCodigo, email,
       snapshotJson, fullHash, comentario?.trim() || null],
    )

    return { versionNumero, versionCodigo }
  }

  /** Devuelve la versión "actual" del proyecto:
   *  - Si hay versión marcada como FINAL, esa es la actual.
   *  - Si no, la más reciente NO anulada.
   *  - Si no hay ninguna, null. */
  async getUltimaVersion(proyectoId: number) {
    // Primero intentar la marcada como FINAL
    const finals = await this.dataSource.query(
      `SELECT PROYECTOVERSIONID AS "versionId",
              VERSIONNUMERO     AS "numero",
              VERSIONCODIGO     AS "codigo",
              VERSIONFECHA      AS "fecha",
              VERSIONUSUARIO    AS "usuario",
              DBMS_LOB.SUBSTR(VERSIONCOMENTARIO,2000,1) AS "comentario",
              VERSIONHASH       AS "hash",
              VERSIONESFINAL    AS "esFinal",
              VERSIONANULADA    AS "anulada"
         FROM PROYECTOVERSION
        WHERE PROYECTOID = :1 AND VERSIONESFINAL = 1 AND VERSIONANULADA = 0`,
      [proyectoId],
    )
    if (finals.length) return finals[0]

    // Si no hay FINAL, devolvemos la más reciente NO anulada
    const rows = await this.dataSource.query(
      `SELECT * FROM (
          SELECT PROYECTOVERSIONID AS "versionId",
                 VERSIONNUMERO     AS "numero",
                 VERSIONCODIGO     AS "codigo",
                 VERSIONFECHA      AS "fecha",
                 VERSIONUSUARIO    AS "usuario",
                 DBMS_LOB.SUBSTR(VERSIONCOMENTARIO,2000,1) AS "comentario",
                 VERSIONHASH       AS "hash",
                 VERSIONESFINAL    AS "esFinal",
                 VERSIONANULADA    AS "anulada"
            FROM PROYECTOVERSION
           WHERE PROYECTOID = :1 AND VERSIONANULADA = 0
           ORDER BY VERSIONNUMERO DESC
        ) WHERE ROWNUM = 1`,
      [proyectoId],
    )
    return rows[0] ?? null
  }

  /** Lista (para el admin SENA) proyectos que tengan al menos una versión
   *  FINAL no anulada — son los que pueden generar el Excel oficial. */
  async listarProyectosConVersionFinal() {
    return this.dataSource.query(
      `SELECT p.PROYECTOID                  AS "proyectoId",
              p.PROYECTONOMBRE              AS "nombre",
              p.PROYECTOESTADO              AS "estado",
              p.PROYECTOFECHARADICACION     AS "fechaConfirmacion",
              c.CONVOCATORIANOMBRE          AS "convocatoria",
              c.CONVOCATORIAID              AS "convocatoriaId",
              m.MODALIDADNOMBRE             AS "modalidad",
              e.EMPRESARAZONSOCIAL          AS "empresa",
              e.EMPRESAIDENTIFICACION       AS "nit",
              e.EMPRESADIGITOVERIFICACION   AS "digitoV",
              v.PROYECTOVERSIONID           AS "versionId",
              v.VERSIONNUMERO               AS "versionNumero",
              v.VERSIONCODIGO               AS "versionCodigo",
              v.VERSIONFINALFECHA           AS "versionFinalFecha"
         FROM PROYECTO p
         JOIN PROYECTOVERSION v ON v.PROYECTOID = p.PROYECTOID
                              AND v.VERSIONESFINAL = 1
                              AND v.VERSIONANULADA = 0
         LEFT JOIN CONVOCATORIA c ON c.CONVOCATORIAID = p.CONVOCATORIAID
         LEFT JOIN MODALIDAD m    ON m.MODALIDADID    = p.MODALIDADID
         LEFT JOIN EMPRESA e      ON e.EMPRESAID      = p.EMPRESAID
        ORDER BY v.VERSIONFINALFECHA DESC NULLS LAST, p.PROYECTOID DESC`,
    )
  }

  /** Lista todas las versiones del proyecto (sin el snapshot pesado, solo
   *  metadatos para mostrar en el historial). Más reciente primero. */
  async listarVersiones(proyectoId: number) {
    return this.dataSource.query(
      `SELECT PROYECTOVERSIONID  AS "versionId",
              VERSIONNUMERO      AS "numero",
              VERSIONCODIGO      AS "codigo",
              VERSIONFECHA       AS "fecha",
              VERSIONUSUARIO     AS "usuario",
              DBMS_LOB.SUBSTR(VERSIONCOMENTARIO, 2000, 1) AS "comentario",
              VERSIONESTADOAL    AS "estadoAl",
              VERSIONHASH        AS "hash",
              VERSIONESFINAL     AS "esFinal",
              VERSIONANULADA     AS "anulada",
              VERSIONFINALFECHA  AS "finalFecha",
              VERSIONFINALUSUARIO AS "finalUsuario",
              VERSIONANULADAFECHA AS "anuladaFecha",
              VERSIONANULADAUSUARIO AS "anuladaUsuario"
         FROM PROYECTOVERSION
        WHERE PROYECTOID = :1
        ORDER BY VERSIONNUMERO ASC`,
      [proyectoId],
    )
  }

  /** Marca una versión como FINAL (la "oficial" enviada a SECOP). Solo puede
   *  haber una FINAL por proyecto. Marcar como FINAL **confirma** el proyecto:
   *  cambia PROYECTOESTADO a 1 y registra la fecha de radicación. */
  async marcarVersionFinal(proyectoId: number, versionId: number, email: string) {
    // Verificar versión
    const [row] = await this.dataSource.query(
      `SELECT VERSIONESFINAL AS "esFinal", VERSIONANULADA AS "anulada", PROYECTOID AS "proyectoId"
         FROM PROYECTOVERSION WHERE PROYECTOVERSIONID = :1`,
      [versionId],
    )
    if (!row) throw new NotFoundException('Versión no encontrada')
    if (Number(row.proyectoId) !== Number(proyectoId)) {
      throw new BadRequestException('La versión no pertenece a este proyecto.')
    }
    if (Number(row.anulada) === 1) {
      throw new BadRequestException('No se puede marcar como FINAL una versión anulada. Restaúrala primero.')
    }
    if (Number(row.esFinal) === 1) {
      return { message: 'La versión ya está marcada como FINAL.', alreadyFinal: true }
    }

    // Verificar estado del proyecto: solo se puede marcar FINAL si está
    // en borrador (0) o reversado (2).
    const [proy] = await this.dataSource.query(
      `SELECT PROYECTOESTADO AS "estado", CONVOCATORIAID AS "convocatoriaId", EMPRESAID AS "empresaId"
         FROM PROYECTO WHERE PROYECTOID = :1`,
      [proyectoId],
    )
    if (!proy) throw new NotFoundException('Proyecto no encontrado')
    if (Number(proy.estado) === 3) {
      throw new BadRequestException('El proyecto está aprobado y no admite cambios.')
    }
    if (Number(proy.estado) === 4) {
      throw new BadRequestException('El proyecto está rechazado y no admite cambios.')
    }

    // Unicidad: la empresa no puede tener otro proyecto confirmado/aprobado
    // en la misma convocatoria al pasar este a estado 1.
    const [{ duplicados }] = await this.dataSource.query(
      `SELECT COUNT(PROYECTOID) AS "duplicados"
         FROM PROYECTO
        WHERE EMPRESAID = :1 AND CONVOCATORIAID = :2
          AND PROYECTOESTADO IN (1, 3) AND PROYECTOID != :3`,
      [proy.empresaId, proy.convocatoriaId, proyectoId],
    )
    if (Number(duplicados) > 0)
      throw new BadRequestException('Ya existe otro proyecto confirmado o aprobado en esta convocatoria.')

    // Desmarcar cualquier otra FINAL del mismo proyecto (defensa)
    await this.dataSource.query(
      `UPDATE PROYECTOVERSION
          SET VERSIONESFINAL = 0,
              VERSIONFINALFECHA = NULL,
              VERSIONFINALUSUARIO = NULL
        WHERE PROYECTOID = :1 AND VERSIONESFINAL = 1`,
      [proyectoId],
    )
    // Marcar esta como FINAL
    await this.dataSource.query(
      `UPDATE PROYECTOVERSION
          SET VERSIONESFINAL = 1,
              VERSIONFINALFECHA = SYSDATE,
              VERSIONFINALUSUARIO = :1
        WHERE PROYECTOVERSIONID = :2`,
      [email, versionId],
    )
    // Confirmar el proyecto: estado 1 + fecha de radicación
    await this.dataSource.query(
      `UPDATE PROYECTO
          SET PROYECTOESTADO = 1, PROYECTOFECHARADICACION = SYSDATE
        WHERE PROYECTOID = :1`,
      [proyectoId],
    )
    return {
      message: 'Versión marcada como FINAL. El proyecto quedó confirmado y listo para envío a SECOP.',
      estado: 1,
    }
  }

  /** Quita la marca FINAL de una versión. **Reversa** el proyecto: cambia
   *  PROYECTOESTADO a 2 y limpia la fecha de radicación. */
  /** Acción del administrador SENA: revertir un proyecto Confirmado a estado
   *  Subsanación (2). Desmarca la versión FINAL actual y limpia la fecha de
   *  radicación. El proponente puede entonces editar y volver a marcar FINAL.
   *  Cuando la convocatoria está cerrada, este estado se llama "Subsanación"
   *  en la UI. */
  async reversarProyectoComoAdmin(proyectoId: number, _adminEmail: string, _comentario?: string | null) {
    const [proy] = await this.dataSource.query(
      `SELECT PROYECTOESTADO AS "estado" FROM PROYECTO WHERE PROYECTOID = :1`,
      [proyectoId],
    )
    if (!proy) throw new NotFoundException('Proyecto no encontrado')
    if (Number(proy.estado) === 3) {
      throw new BadRequestException('El proyecto ya fue aprobado. Para reversar un aprobado contacta soporte.')
    }
    if (Number(proy.estado) === 4) {
      throw new BadRequestException('El proyecto está rechazado y no admite cambios.')
    }
    if (Number(proy.estado) === 2) {
      return { message: 'El proyecto ya está en Subsanación.', estado: 2 }
    }
    if (Number(proy.estado) !== 1) {
      throw new BadRequestException('Solo se pueden reversar proyectos confirmados (estado 1).')
    }
    // Buscar la versión FINAL vigente del proyecto
    const [ver] = await this.dataSource.query(
      `SELECT PROYECTOVERSIONID AS "versionId"
         FROM PROYECTOVERSION
        WHERE PROYECTOID = :1 AND VERSIONESFINAL = 1 AND VERSIONANULADA = 0`,
      [proyectoId],
    )
    if (!ver) {
      throw new BadRequestException('El proyecto está confirmado pero no hay versión FINAL marcada.')
    }
    // Desmarca FINAL y deja al proyecto en estado 2 (Reversado/Subsanación)
    await this.dataSource.query(
      `UPDATE PROYECTOVERSION
          SET VERSIONESFINAL = 0,
              VERSIONFINALFECHA = NULL,
              VERSIONFINALUSUARIO = NULL
        WHERE PROYECTOVERSIONID = :1`,
      [ver.versionId],
    )
    await this.dataSource.query(
      `UPDATE PROYECTO
          SET PROYECTOESTADO = 2, PROYECTOFECHARADICACION = NULL
        WHERE PROYECTOID = :1`,
      [proyectoId],
    )
    return {
      message: 'Proyecto enviado a Subsanación. El proponente puede editar y volver a marcar FINAL.',
      estado: 2,
    }
  }

  async desmarcarVersionFinal(proyectoId: number, versionId: number) {
    const [row] = await this.dataSource.query(
      `SELECT VERSIONESFINAL AS "esFinal", PROYECTOID AS "proyectoId"
         FROM PROYECTOVERSION WHERE PROYECTOVERSIONID = :1`,
      [versionId],
    )
    if (!row) throw new NotFoundException('Versión no encontrada')
    if (Number(row.proyectoId) !== Number(proyectoId)) {
      throw new BadRequestException('La versión no pertenece a este proyecto.')
    }
    if (Number(row.esFinal) !== 1) {
      return { message: 'La versión no estaba marcada como FINAL.', wasNotFinal: true }
    }

    // No se puede desmarcar si el proyecto ya fue aprobado/rechazado por SENA
    const [proy] = await this.dataSource.query(
      `SELECT PROYECTOESTADO AS "estado" FROM PROYECTO WHERE PROYECTOID = :1`,
      [proyectoId],
    )
    if (proy && Number(proy.estado) === 3) {
      throw new BadRequestException('El proyecto está aprobado y no admite cambios.')
    }
    if (proy && Number(proy.estado) === 4) {
      throw new BadRequestException('El proyecto está rechazado y no admite cambios.')
    }

    await this.dataSource.query(
      `UPDATE PROYECTOVERSION
          SET VERSIONESFINAL = 0,
              VERSIONFINALFECHA = NULL,
              VERSIONFINALUSUARIO = NULL
        WHERE PROYECTOVERSIONID = :1`,
      [versionId],
    )
    // Reversar el proyecto: estado 2 (Reversado), limpia fecha de radicación
    await this.dataSource.query(
      `UPDATE PROYECTO
          SET PROYECTOESTADO = 2, PROYECTOFECHARADICACION = NULL
        WHERE PROYECTOID = :1`,
      [proyectoId],
    )
    return {
      message: 'Marca FINAL retirada. El proyecto vuelve a borrador y puedes editar / crear nuevas versiones.',
      estado: 2,
    }
  }

  /** Anula una versión (soft-delete). No se puede anular la versión FINAL. */
  async anularVersion(proyectoId: number, versionId: number, email: string) {
    const [row] = await this.dataSource.query(
      `SELECT VERSIONESFINAL AS "esFinal", VERSIONANULADA AS "anulada", PROYECTOID AS "proyectoId"
         FROM PROYECTOVERSION WHERE PROYECTOVERSIONID = :1`,
      [versionId],
    )
    if (!row) throw new NotFoundException('Versión no encontrada')
    if (Number(row.proyectoId) !== Number(proyectoId)) {
      throw new BadRequestException('La versión no pertenece a este proyecto.')
    }
    if (Number(row.esFinal) === 1) {
      throw new BadRequestException('No se puede anular la versión marcada como FINAL. Quita la marca primero.')
    }
    if (Number(row.anulada) === 1) {
      return { message: 'La versión ya estaba anulada.', alreadyAnulada: true }
    }
    await this.dataSource.query(
      `UPDATE PROYECTOVERSION
          SET VERSIONANULADA = 1,
              VERSIONANULADAFECHA = SYSDATE,
              VERSIONANULADAUSUARIO = :1
        WHERE PROYECTOVERSIONID = :2`,
      [email, versionId],
    )
    return { message: 'Versión anulada correctamente.' }
  }

  /** Restaura una versión previamente anulada. */
  async restaurarVersion(proyectoId: number, versionId: number) {
    const [row] = await this.dataSource.query(
      `SELECT VERSIONANULADA AS "anulada", PROYECTOID AS "proyectoId"
         FROM PROYECTOVERSION WHERE PROYECTOVERSIONID = :1`,
      [versionId],
    )
    if (!row) throw new NotFoundException('Versión no encontrada')
    if (Number(row.proyectoId) !== Number(proyectoId)) {
      throw new BadRequestException('La versión no pertenece a este proyecto.')
    }
    if (Number(row.anulada) !== 1) {
      return { message: 'La versión no estaba anulada.', wasNotAnulada: true }
    }
    await this.dataSource.query(
      `UPDATE PROYECTOVERSION
          SET VERSIONANULADA = 0,
              VERSIONANULADAFECHA = NULL,
              VERSIONANULADAUSUARIO = NULL
        WHERE PROYECTOVERSIONID = :1`,
      [versionId],
    )
    return { message: 'Versión restaurada correctamente.' }
  }

  /** Verificación pública por código de versión. Devuelve metadatos
   *  básicos sin requerir autenticación. */
  async verificarCodigoPublico(codigo: string) {
    const [row] = await this.dataSource.query(
      `SELECT pv.PROYECTOVERSIONID  AS "versionId",
              pv.PROYECTOID          AS "proyectoId",
              pv.VERSIONNUMERO       AS "numero",
              pv.VERSIONCODIGO       AS "codigo",
              pv.VERSIONFECHA        AS "fecha",
              pv.VERSIONHASH         AS "hash",
              pv.VERSIONESFINAL      AS "esFinal",
              pv.VERSIONANULADA      AS "anulada",
              pv.VERSIONFINALFECHA   AS "finalFecha",
              p.PROYECTONOMBRE       AS "proyectoNombre",
              p.PROYECTOESTADO       AS "proyectoEstado",
              c.CONVOCATORIANOMBRE   AS "convocatoria",
              e.EMPRESARAZONSOCIAL   AS "empresa",
              e.EMPRESAIDENTIFICACION AS "nit",
              e.EMPRESADIGITOVERIFICACION AS "digitoV"
         FROM PROYECTOVERSION pv
         JOIN PROYECTO p   ON p.PROYECTOID    = pv.PROYECTOID
         LEFT JOIN CONVOCATORIA c ON c.CONVOCATORIAID = p.CONVOCATORIAID
         JOIN EMPRESA e    ON e.EMPRESAID     = p.EMPRESAID
        WHERE TRIM(pv.VERSIONCODIGO) = :1`,
      [codigo.trim()],
    )
    if (!row) {
      return { valido: false, codigo: codigo.trim() }
    }
    return {
      valido: true,
      codigo: row.codigo,
      version: {
        numero: Number(row.numero),
        fecha: row.fecha,
        hash: row.hash,
        esFinal: Number(row.esFinal) === 1,
        anulada: Number(row.anulada) === 1,
        finalFecha: row.finalFecha,
      },
      proyecto: {
        id: Number(row.proyectoId),
        nombre: row.proyectoNombre,
        estado: Number(row.proyectoEstado) || 0,
        convocatoria: row.convocatoria,
      },
      empresa: {
        razonSocial: row.empresa,
        nit: `${row.nit}-${row.digitoV}`,
      },
    }
  }

  /** Devuelve una versión específica con su snapshot completo deserializado.
   *  El snapshot ya tiene la misma forma que getReporteProyecto + accionesDetalle. */
  async getVersionSnapshot(versionId: number) {
    const [row] = await this.dataSource.query(
      `SELECT PROYECTOVERSIONID AS "versionId",
              PROYECTOID         AS "proyectoId",
              VERSIONNUMERO      AS "numero",
              VERSIONCODIGO      AS "codigo",
              VERSIONFECHA       AS "fecha",
              VERSIONUSUARIO     AS "usuario",
              DBMS_LOB.SUBSTR(VERSIONCOMENTARIO, 2000, 1) AS "comentario",
              VERSIONESTADOAL    AS "estadoAl",
              VERSIONHASH        AS "hash",
              VERSIONSNAPSHOT    AS "snapshotRaw"
         FROM PROYECTOVERSION
        WHERE PROYECTOVERSIONID = :1`,
      [versionId],
    )
    if (!row) throw new NotFoundException('Versión no encontrada')

    // En Oracle el CLOB puede llegar como Lob o ya como string según el driver.
    let snapshotJson: string
    if (typeof row.snapshotRaw === 'string') {
      snapshotJson = row.snapshotRaw
    } else if (row.snapshotRaw && typeof (row.snapshotRaw as any).getData === 'function') {
      // node-oracledb Lob → string
      snapshotJson = await new Promise<string>((resolve, reject) => {
        (row.snapshotRaw as any).getData((err: Error | null, data: string) => {
          if (err) reject(err); else resolve(data)
        })
      })
    } else {
      snapshotJson = String(row.snapshotRaw ?? '')
    }

    let snapshot: unknown = null
    try { snapshot = JSON.parse(snapshotJson) }
    catch { throw new BadRequestException('El snapshot de la versión está corrupto.') }

    return {
      versionId:  Number(row.versionId),
      proyectoId: Number(row.proyectoId),
      numero:     Number(row.numero),
      codigo:     row.codigo,
      fecha:      row.fecha,
      usuario:    row.usuario,
      comentario: row.comentario,
      estadoAl:   Number(row.estadoAl) || 0,
      hash:       row.hash,
      snapshot,
    }
  }

  // ── Aprobación de proyecto + restauración desde snapshot ────────────────

  /** Restaura todas las tablas vivas del proyecto desde el snapshot JSON de
   *  una versión. DELETE de las tablas dependientes + INSERT manteniendo los
   *  IDs originales del snapshot. Toda la operación es atómica. */
  async restaurarLiveDesdeSnapshot(proyectoId: number, versionId: number): Promise<void> {
    const versionData = await this.getVersionSnapshot(versionId)
    if (Number(versionData.proyectoId) !== Number(proyectoId)) {
      throw new BadRequestException('La versión no pertenece a este proyecto.')
    }
    const snap = versionData.snapshot as Record<string, any>
    if (!snap || typeof snap !== 'object') {
      throw new BadRequestException('Snapshot inválido: no se puede restaurar.')
    }
    const acciones: any[] = Array.isArray(snap.acciones) ? snap.acciones : []
    const detalles: any[] = Array.isArray(snap.accionesDetalle) ? snap.accionesDetalle : []
    const contactos: any[] = Array.isArray(snap.contactos) ? snap.contactos : []
    const proyectoSnap = snap.proyecto as Record<string, any> | undefined

    // Mapa rápido: afId → metadata básica (incluye IDs)
    const accionesById = new Map<number, any>()
    for (const a of acciones) accionesById.set(Number(a.afId), a)

    await this.dataSource.transaction(async (m) => {
      const q = (sql: string, params: any[] = []) => m.query(sql, params)

      // ── DELETE en orden de FKs ──────────────────────────────────────────
      const afIds: number[] = (await q(
        `SELECT ACCIONFORMACIONID AS "id" FROM ACCIONFORMACION WHERE PROYECTOID = :1`,
        [proyectoId],
      )).map((r: any) => Number(r.id))

      if (afIds.length > 0) {
        await q(`DELETE FROM AFRUBRO WHERE PROYECTOIDRUBROAF = :1`, [proyectoId])
        await q(`DELETE FROM AFGRUPOCOBERTURA WHERE AFGRUPOID IN
                   (SELECT AFGRUPOID FROM AFGRUPO WHERE ACCIONFORMACIONID IN
                     (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1))`, [proyectoId])
        await q(`DELETE FROM AFGRUPO WHERE ACCIONFORMACIONID IN
                   (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`, [proyectoId])
        await q(`DELETE FROM ACTIVIDADUT WHERE UNIDADTEMATICAID IN
                   (SELECT UNIDADTEMATICAID FROM UNIDADTEMATICA WHERE PROYECTOIDUT = :1)`, [proyectoId])
        await q(`DELETE FROM PERFILUT WHERE UNIDADTEMATICAID IN
                   (SELECT UNIDADTEMATICAID FROM UNIDADTEMATICA WHERE PROYECTOIDUT = :1)`, [proyectoId])
        await q(`DELETE FROM UNIDADTEMATICA WHERE PROYECTOIDUT = :1`, [proyectoId])
        await q(`DELETE FROM AFAREAFUNCIONAL WHERE ACCIONFORMACIONIDAF IN
                   (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`, [proyectoId])
        await q(`DELETE FROM AFNIVELOCUPACIONAL WHERE ACCIONFORMACIONID IN
                   (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`, [proyectoId])
        await q(`DELETE FROM OCUPACIONCOUCAF WHERE ACCIONFORMACIONID IN
                   (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`, [proyectoId])
        await q(`DELETE FROM AFPSECTOR WHERE ACCIONFORMACIONID IN
                   (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`, [proyectoId])
        await q(`DELETE FROM AFPSUBSECTOR WHERE ACCIONFORMACIONID IN
                   (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`, [proyectoId])
        await q(`DELETE FROM AFSECTOR WHERE ACCIONFORMACIONID IN
                   (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`, [proyectoId])
        await q(`DELETE FROM AFSUBSECTOR WHERE ACCIONFORMACIONID IN
                   (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`, [proyectoId])
        await q(`DELETE FROM AFGESTIONCONOCIMIENTO WHERE ACCIONFORMACIONID IN
                   (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`, [proyectoId])
        await q(`DELETE FROM MATERIALFORMACIONAF WHERE ACCIONFORMACIONID IN
                   (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`, [proyectoId])
        await q(`DELETE FROM RECURSOSDIDACTICOSAF WHERE ACCIONFORMACIONID IN
                   (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`, [proyectoId])
        await q(`DELETE FROM ACCIONFORMACION WHERE PROYECTOID = :1`, [proyectoId])
      }
      // Contactos del proyecto (no contactos generales de la empresa)
      await q(`DELETE FROM CONTACTOEMPRESA WHERE PROYECTOIDCONTACTOS = :1`, [proyectoId])

      // ── UPDATE PROYECTO con datos del snapshot ──────────────────────────
      if (proyectoSnap) {
        await q(
          `UPDATE PROYECTO
              SET PROYECTONOMBRE  = :1,
                  PROYECTOOBJETIVO = :2
            WHERE PROYECTOID = :3`,
          [proyectoSnap.nombre ?? null, proyectoSnap.objetivo ?? null, proyectoId],
        )
      }

      // ── INSERT CONTACTOEMPRESA ──────────────────────────────────────────
      // El snapshot guarda contactos sin tipoIdentificacionId (solo nombre).
      // Reusamos la EMPRESAID del proyecto.
      const [proy] = await q(
        `SELECT EMPRESAID AS "empresaId" FROM PROYECTO WHERE PROYECTOID = :1`, [proyectoId],
      )
      const empresaIdProy = Number(proy.empresaId)
      for (const c of contactos) {
        // Buscar el TIPODOCUMENTOIDENTIDADID por nombre (snapshot guarda nombre)
        let tipoIdentId: number | null = null
        if (c.tipoDoc) {
          const tipoRows = await q(
            `SELECT TIPODOCUMENTOIDENTIDADID AS "id"
               FROM TIPODOCUMENTOIDENTIDAD
              WHERE UPPER(TRIM(TIPODOCUMENTOIDENTIDADNOMBRE)) = UPPER(TRIM(:1))`,
            [c.tipoDoc],
          )
          tipoIdentId = tipoRows[0]?.id ?? null
        }
        const [{ nid }] = await q(
          `SELECT NVL(MAX(CONTACTOEMPRESAID), 0) + 1 AS "nid" FROM CONTACTOEMPRESA`,
        )
        await q(
          `INSERT INTO CONTACTOEMPRESA
             (CONTACTOEMPRESAID, EMPRESAIDCONTACTO, CONTACTOEMPRESANOMBRE, CONTACTOEMPRESACARGO,
              CONTACTOEMPRESACORREO, CONTACTOEMPRESATELEFONO, CONTACTOEMPRESADOCUMENTO,
              TIPOIDENTIFICACIONCONTACTOP, PROYECTOIDCONTACTOS)
           VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9)`,
          [nid, empresaIdProy, c.nombre, c.cargo, c.correo,
           c.telefono ?? null, c.documento ?? null, tipoIdentId, proyectoId],
        )
      }

      // Fallback para snapshots viejos: buscar IDs por nombre si no vienen.
      const lookupId = async (
        table: string, nameCol: string, idCol: string, name: string | null | undefined,
      ): Promise<number | null> => {
        if (!name) return null
        const rows = await q(
          `SELECT ${idCol} AS "id" FROM ${table} WHERE UPPER(TRIM(${nameCol})) = UPPER(TRIM(:1))`,
          [String(name).trim()],
        )
        return rows[0]?.id ? Number(rows[0].id) : null
      }

      // ── INSERT por cada AF ──────────────────────────────────────────────
      for (const det of detalles) {
        const afId = Number(det.afId)
        const meta = accionesById.get(afId) ?? {}
        const perfil = det.perfil ?? null
        const sectores = det.sectores ?? null
        const grupos: any[] = Array.isArray(det.grupos) ? det.grupos : []
        const uts: any[] = Array.isArray(det.unidadesTematicas) ? det.unidadesTematicas : []
        const material = det.material ?? null
        const alineacion = det.alineacion ?? null
        const rubros: any[] = Array.isArray(det.rubros) ? det.rubros : []
        const goAf = det.gastoOperacion ?? null
        const transAf = det.transferencia ?? null

        // Resolver IDs faltantes en snapshots viejos buscando por nombre
        const tipoEventoId = meta.tipoEventoId
          ?? await lookupId('TIPOEVENTO', 'TIPOEVENTONOMBRE', 'TIPOEVENTOID', meta.tipoEvento)
        const modalidadFormacionId = meta.modalidadFormacionId
          ?? await lookupId('MODALIDADFORMACION', 'MODALIDADFORMACIONNOMBRE', 'MODALIDADFORMACIONID', meta.modalidad)
        const metodologiaAprendizajeId = meta.metodologiaAprendizajeId
          ?? await lookupId('METODOLOGIAAPRENDIZAJE', 'METODOLOGIAAPRENDIZAJENOMBRE', 'METODOLOGIAAPRENDIZAJEID', meta.metodologia)
        const modeloAprendizajeId = meta.modeloAprendizajeId ?? null

        if (modalidadFormacionId == null) {
          throw new BadRequestException(
            `No se pudo resolver MODALIDADFORMACIONID para la AF ${meta.numero ?? afId} (modalidad="${meta.modalidad ?? ''}"). ` +
            'El snapshot está incompleto. Crea una nueva versión con el código actualizado y márcala como FINAL antes de aprobar.',
          )
        }
        if (tipoEventoId == null) {
          throw new BadRequestException(
            `No se pudo resolver TIPOEVENTOID para la AF ${meta.numero ?? afId} (evento="${meta.tipoEvento ?? ''}"). ` +
            'El snapshot está incompleto. Crea una nueva versión con el código actualizado y márcala como FINAL antes de aprobar.',
          )
        }

        // ACCIONFORMACION (con todos los campos del snapshot)
        await q(
          `INSERT INTO ACCIONFORMACION
             (ACCIONFORMACIONID, PROYECTOID, ACCIONFORMACIONNUMERO, ACCIONFORMACIONNOMBRE,
              NECESIDADFORMACIONIDAF, ACCIONFORMACIONJUSTNEC, ACCIONFORMACIONCAUSA,
              ACCIONFORMACIONRESULTADOS, ACCIONFORMACIONOBJETIVO,
              TIPOEVENTOID, MODALIDADFORMACIONID, METODOLOGIAAPRENDIZAJEID, MODELOAPRENDIZAJEID,
              ACCIONFORMACIONNUMHORAGRUPO, ACCIONFORMACIONNUMGRUPOS, ACCIONFORMACIONNUMTOTHORASGRUP,
              ACCIONFORMACIONBENEFGRUPO, ACCIONFORMACIONBENEFVIGRUPO, ACCIONFORMACIONNUMBENEF,
              AFENFOQUEID, ACCIONFORMACIONAREAFUN, ACCIONFORMACIONNIVELOCUPD,
              ACCIONFORMACIONMUJER, ACCIONFORMACIONNUMCAMPESINO, ACCIONFORMACIONJUSTCAMPESINO,
              ACCIONFORMACIONNUMPOPULAR, ACCIONFORMACIONJUSTPOPULAR,
              ACCIONFORMACIONTRABDISCAPAC, ACCIONFORMACIONTRABAJADORBIC,
              ACCIONFORMACIONMIPYMES, ACCIONFORMACIONTRABMIPYMES, ACCIONFORMACIONMIPYMESD,
              ACCIONFORMACIONCADENAPROD, ACCIONFORMACIONTRABCADPROD, ACCIONFORMACIONCADENAPRODD,
              ACCIONFORMACIONSECSUBD, ACCIONFORMACIONCOMPONENTEID,
              ACCIONFORMACIONCOMPOD, ACCIONFORMACIONJUSTIFICACION,
              ACCIONFORMACIONRESDESEM, ACCIONFORMACIONRESFORM,
              TIPOAMBIENTEID, ACCIONFORMACIONJUSTMAT,
              ACCIONFORMACIONINSUMO, ACCIONFORMACIONJUSTINSUMO,
              ACCIONFORMACIONFECHAREGISTRO)
           VALUES (:1,:2,:3,:4,
                   :5,:6,:7,:8,:9,
                   :10,:11,:12,:13,
                   :14,:15,:16,:17,:18,:19,
                   :20,:21,:22,
                   :23,:24,:25,:26,:27,
                   :28,:29,
                   :30,:31,:32,
                   :33,:34,:35,
                   :36,:37,
                   :38,:39,:40,:41,
                   :42,:43,
                   :44,:45,
                   SYSDATE)`,
          [
            afId, proyectoId, meta.numero ?? null, meta.nombre ?? null,
            meta.necesidadFormacionId ?? null, meta.justnec ?? null, meta.causa ?? null,
            meta.efectos ?? null, meta.objetivo ?? null,
            tipoEventoId, modalidadFormacionId,
            metodologiaAprendizajeId, modeloAprendizajeId,
            meta.numHorasGrupo ?? null, meta.numGrupos ?? null, meta.numTotHoras ?? null,
            meta.benefGrupo ?? null, meta.benefViGrupo ?? null, meta.numBenef ?? null,
            perfil?.afEnfoqueId ?? null, perfil?.justAreas ?? null, perfil?.justNivelesOcu ?? null,
            perfil?.mujer ?? null, perfil?.numCampesino ?? null, perfil?.justCampesino ?? null,
            perfil?.numPopular ?? null, perfil?.justPopular ?? null,
            perfil?.trabDiscapac ?? null, perfil?.trabajadorBic ?? null,
            perfil?.mipymes ?? null, perfil?.trabMipymes ?? null, perfil?.mipymesD ?? null,
            perfil?.cadenaProd ?? null, perfil?.trabCadProd ?? null, perfil?.cadenaProdD ?? null,
            sectores?.justificacion ?? null, alineacion?.componenteId ?? null,
            alineacion?.compod ?? null, alineacion?.justificacion ?? null,
            alineacion?.resDesem ?? null, alineacion?.resForm ?? null,
            material?.tipoAmbienteId ?? null, material?.justMat ?? null,
            material?.insumo ?? null, material?.justInsumo ?? null,
          ],
        )

        // Áreas funcionales / Niveles / CUOC
        for (const a of (perfil?.areas ?? [])) {
          await q(
            `INSERT INTO AFAREAFUNCIONAL (AFAREAFUNCIONALID, ACCIONFORMACIONIDAF, AREAFUNCIONALIDAF, AFAREAFUNCIONALOTRO)
             VALUES (:1, :2, :3, :4)`,
            [Number(a.aafId), afId, Number(a.areaId), a.otro ?? null],
          )
        }
        for (const n of (perfil?.niveles ?? [])) {
          await q(
            `INSERT INTO AFNIVELOCUPACIONAL (AFNIVELOCUPACIONALID, ACCIONFORMACIONID, NIVELOCUPACIONALIDAF)
             VALUES (:1, :2, :3)`,
            [Number(n.anId), afId, Number(n.nivelId)],
          )
        }
        for (const c of (perfil?.cuoc ?? [])) {
          await q(
            `INSERT INTO OCUPACIONCOUCAF (OCUPACIONCOUCAFID, ACCIONFORMACIONID, OCUPACIONCUOCID)
             VALUES (:1, :2, :3)`,
            [Number(c.ocAfId), afId, Number(c.cuocId)],
          )
        }

        // Sectores / Subsectores benef + AF
        for (const s of (sectores?.sectoresBenef ?? [])) {
          await q(
            `INSERT INTO AFPSECTOR (AFPSECTORID, ACCIONFORMACIONID, SECTORAFID, AFPSECTORESTADO) VALUES (:1, :2, :3, 1)`,
            [Number(s.psId), afId, Number(s.sectorId)],
          )
        }
        for (const s of (sectores?.subsectoresBenef ?? [])) {
          await q(
            `INSERT INTO AFPSUBSECTOR (AFPSUBSECTORID, ACCIONFORMACIONID, SUBSECTORAFID, AFPSUBSECTORESTADO) VALUES (:1, :2, :3, 1)`,
            [Number(s.pssId), afId, Number(s.subsectorId)],
          )
        }
        for (const s of (sectores?.sectoresAf ?? [])) {
          await q(
            `INSERT INTO AFSECTOR (AFSECTORID, ACCIONFORMACIONID, SECTORAFID) VALUES (:1, :2, :3)`,
            [Number(s.saId), afId, Number(s.sectorId)],
          )
        }
        for (const s of (sectores?.subsectoresAf ?? [])) {
          await q(
            `INSERT INTO AFSUBSECTOR (AFSUBSECTORID, ACCIONFORMACIONID, SUBSECTORAFID) VALUES (:1, :2, :3)`,
            [Number(s.ssaId), afId, Number(s.subsectorId)],
          )
        }

        // Material — gestión / material / recursos
        if (material?.gestionConocimientoId) {
          const [{ nid }] = await q(`SELECT NVL(MAX(AFGESTIONCONOCIMIENTOID), 0) + 1 AS "nid" FROM AFGESTIONCONOCIMIENTO`)
          await q(
            `INSERT INTO AFGESTIONCONOCIMIENTO (AFGESTIONCONOCIMIENTOID, ACCIONFORMACIONID, GESTIONCONOCIMIENTOID) VALUES (:1, :2, :3)`,
            [nid, afId, Number(material.gestionConocimientoId)],
          )
        }
        if (material?.materialFormacionId) {
          const [{ nid }] = await q(`SELECT NVL(MAX(MATERIALFORMACIONAFID), 0) + 1 AS "nid" FROM MATERIALFORMACIONAF`)
          await q(
            `INSERT INTO MATERIALFORMACIONAF (MATERIALFORMACIONAFID, ACCIONFORMACIONID, MATERIALFORMACIONID) VALUES (:1, :2, :3)`,
            [nid, afId, Number(material.materialFormacionId)],
          )
        }
        for (const r of (material?.recursos ?? [])) {
          await q(
            `INSERT INTO RECURSOSDIDACTICOSAF (RECURSOSDIDACTICOSAFID, ACCIONFORMACIONID, RECURSOSDIDACTICOSID)
             VALUES (:1, :2, :3)`,
            [Number(r.rdafId), afId, Number(r.recursoId)],
          )
        }

        // Grupos + coberturas
        for (const g of grupos) {
          await q(
            `INSERT INTO AFGRUPO (AFGRUPOID, ACCIONFORMACIONID, AFGRUPONUMERO, AFGRUPOJUSTIFICACION) VALUES (:1, :2, :3, :4)`,
            [Number(g.grupoId), afId, Number(g.grupoNumero), g.justificacion ?? null],
          )
          for (const cob of (g.coberturas ?? [])) {
            await q(
              `INSERT INTO AFGRUPOCOBERTURA
                 (AFGRUPOCOBERTURAID, AFGRUPOID, DEPARTAMENTOGRUPOID, CIUDADGRUPOID,
                  AFGRUPOCOBERTURABENEF, AFGRUPOFILTRO, AFGRUPOCOBERTURAMOD, AFGRUPOCOBERTURARURAL)
               VALUES (:1, :2, :3, :4, :5, :6, :7, :8)`,
              [Number(cob.cobId), Number(g.grupoId), cob.deptoId ?? null, cob.ciudadId ?? null,
               cob.benef ?? 0, afId, cob.modal ?? 'P', cob.rural ?? 0],
            )
          }
        }

        // Unidades temáticas + actividades + perfiles
        for (const ut of uts) {
          await q(
            `INSERT INTO UNIDADTEMATICA (
               UNIDADTEMATICAID, PROYECTOIDUT, ACCIONFORMACIONID, UNIDADTEMATICANUMERO,
               UNIDADTEMATICANOMBRE, UNIDADTEMATICACOMPETENCIAS, UNIDADTEMATICACONTENIDO,
               UNIDADTEMATICAJUSTACTIVIDAD,
               UNIDADTEMATICAHORASPP, UNIDADTEMATICAHORASPV, UNIDADTEMATICAHORASPPAT, UNIDADTEMATICAHORASPHIB,
               UNIDADTEMATICAHORASTP, UNIDADTEMATICAHORASTV, UNIDADTEMATICAHORASTPAT, UNIDADTEMATICAHORASTHIB,
               UNIDADTEMATICAESTRANSVERSAL, UNIDADTEMATICAHORASTRANSVERSAL,
               ARTICULACIONTERRITORIALID, UNIDADTEMATICAFECHAREGISTRO
             ) VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15,:16,:17,:18,:19,SYSDATE)`,
            [Number(ut.utId), proyectoId, afId, Number(ut.numero),
             ut.nombre, ut.competencias ?? null, ut.contenido ?? null, ut.justActividad ?? null,
             ut.horasPP ?? 0, ut.horasPV ?? 0, ut.horasPPAT ?? 0, ut.horasPHib ?? 0,
             ut.horasTP ?? 0, ut.horasTV ?? 0, ut.horasTPAT ?? 0, ut.horasTHib ?? 0,
             Number(ut.esTransversal) || 0, ut.horasTransversal ?? null,
             ut.articulacionTerritorialId ?? null],
          )
          for (const act of (ut.actividades ?? [])) {
            await q(
              `INSERT INTO ACTIVIDADUT (ACTIVIDADUTID, UNIDADTEMATICAID, UTACTIVIDADESID, ACTIVIDADUTOTRO)
               VALUES (:1, :2, :3, :4)`,
              [Number(act.actId), Number(ut.utId), Number(act.actividadId), act.otro ?? null],
            )
          }
          for (const p of (ut.perfiles ?? [])) {
            await q(
              `INSERT INTO PERFILUT (PERFILUTID, UNIDADTEMATICAID, RUBROIDUT, PERFILUTHORASCAP, PERFILUTDIAS, PERFILUTFECHAREGISTRO)
               VALUES (:1, :2, :3, :4, :5, SYSDATE)`,
              [Number(p.perfilId), Number(ut.utId), Number(p.rubroId),
               p.horasCap ?? 0, p.dias ?? null],
            )
          }
        }

        // Rubros (excluye R09 / R015 que se insertan aparte abajo)
        for (const r of rubros) {
          await q(
            `INSERT INTO AFRUBRO (
               AFRUBROID, PROYECTOIDRUBROAF, ACCIONFORMACIONID, RUBROID,
               AFRUBROJUSTIFICACION, AFRUBRONUMHORAS, AFRUBROCANTIDAD,
               AFRUBROBENEFICIARIOS, AFRUBRODIAS, AFRUBRONUMEROGRUPOS,
               AFRUBROVALOR, AFRUBROCOFINANCIACION, AFRUBROESPECIE, AFRUBRODINERO,
               AFRUBROVALORMAXIMO, AFRUBROVALORPORBENEFICIARIO, AFRUBROPAQUETE,
               AFRUBROPORCENTAJECOFINANCIACION, AFRUBROPORCENTAJEESPECIE, AFRUBROPORCENTAJEDINERO,
               AFRUBROFECHAREGISTRO)
             VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15,:16,:17,:18,:19,:20,SYSDATE)`,
            [Number(r.afrubroid), proyectoId, afId, Number(r.rubroId),
             r.justificacion ?? null, r.numHoras ?? 0, r.cantidad ?? 0,
             r.beneficiarios ?? 0, r.dias ?? 0, r.numGrupos ?? 0,
             Number(r.totalRubro) || 0, Number(r.cofSena) || 0,
             Number(r.contraEspecie) || 0, Number(r.contraDinero) || 0,
             Number(r.valorMaximo) || 0, Number(r.valorBenef) || 0, r.paquete ?? null,
             Number(r.porcSena) || 0, Number(r.porcEspecie) || 0, Number(r.porcDinero) || 0],
          )
        }

        // Gasto de operación (R09)
        if (goAf && Number(goAf.total) > 0) {
          // Buscar el RUBROID correcto para R09 según convocatoria
          const [r09] = await q(
            `SELECT r.RUBROID AS "rubroId", r.RUBROPAQUETE AS "paquete"
               FROM RUBRO r
              WHERE TRIM(r.RUBROCODIGO) = 'R09'
                AND ROWNUM = 1`,
          )
          if (r09) {
            await q(
              `INSERT INTO AFRUBRO (
                 AFRUBROID, PROYECTOIDRUBROAF, ACCIONFORMACIONID, RUBROID,
                 AFRUBROJUSTIFICACION, AFRUBROCANTIDAD,
                 AFRUBROVALOR, AFRUBROCOFINANCIACION, AFRUBROESPECIE, AFRUBRODINERO,
                 AFRUBROPAQUETE, AFRUBROPORCENTAJECOFINANCIACION, AFRUBROPORCENTAJEESPECIE, AFRUBROPORCENTAJEDINERO,
                 AFRUBROFECHAREGISTRO)
               VALUES (:1,:2,:3,:4,'GASTOS DE OPERACIÓN',1,:5,:6,:7,:8,:9,:10,:11,:12,SYSDATE)`,
              [Number(goAf.afrubroid), proyectoId, afId, Number(r09.rubroId),
               Number(goAf.total) || 0, Number(goAf.cofSena) || 0,
               Number(goAf.especie) || 0, Number(goAf.dinero) || 0,
               r09.paquete ?? null,
               Number(goAf.total) > 0 ? (Number(goAf.cofSena) / Number(goAf.total)) * 100 : 0,
               Number(goAf.total) > 0 ? (Number(goAf.especie) / Number(goAf.total)) * 100 : 0,
               Number(goAf.total) > 0 ? (Number(goAf.dinero) / Number(goAf.total)) * 100 : 0],
            )
          }
        }

        // Transferencia (R015)
        if (transAf && Number(transAf.valor) > 0) {
          const [r015] = await q(
            `SELECT r.RUBROID AS "rubroId", r.RUBROPAQUETE AS "paquete"
               FROM RUBRO r
              WHERE TRIM(r.RUBROCODIGO) = 'R015'
                AND ROWNUM = 1`,
          )
          if (r015) {
            await q(
              `INSERT INTO AFRUBRO (
                 AFRUBROID, PROYECTOIDRUBROAF, ACCIONFORMACIONID, RUBROID,
                 AFRUBROJUSTIFICACION, AFRUBROCANTIDAD, AFRUBROBENEFICIARIOS,
                 AFRUBROVALOR, AFRUBRODINERO,
                 AFRUBROPAQUETE, AFRUBROPORCENTAJEDINERO, AFRUBROFECHAREGISTRO)
               VALUES (:1,:2,:3,:4,'TRANSFERENCIA CONOCIMIENTO',1,:5,:6,:7,:8,100,SYSDATE)`,
              [Number(transAf.afrubroid), proyectoId, afId, Number(r015.rubroId),
               Number(transAf.beneficiarios) || 0,
               Number(transAf.valor) || 0, Number(transAf.valor) || 0,
               r015.paquete ?? null],
            )
          }
        }
      }
    })
  }

  /** Aprueba el proyecto (rol admin SENA): restaura las tablas vivas desde
   *  la versión FINAL, registra el hash en PROYECTOAPROBADO y pasa el
   *  estado a 3 (Aprobado). */
  async aprobarProyecto(proyectoId: number, email: string, comentario?: string | null) {
    // 1) Verificar que el proyecto está confirmado y tiene FINAL
    const [proy] = await this.dataSource.query(
      `SELECT PROYECTOESTADO AS "estado" FROM PROYECTO WHERE PROYECTOID = :1`,
      [proyectoId],
    )
    if (!proy) throw new NotFoundException('Proyecto no encontrado')
    if (Number(proy.estado) !== 1) {
      throw new BadRequestException('Solo se pueden aprobar proyectos en estado Confirmado.')
    }

    const [versionFinal] = await this.dataSource.query(
      `SELECT PROYECTOVERSIONID AS "versionId",
              VERSIONCODIGO     AS "codigo",
              VERSIONHASH       AS "hash"
         FROM PROYECTOVERSION
        WHERE PROYECTOID = :1 AND VERSIONESFINAL = 1 AND VERSIONANULADA = 0`,
      [proyectoId],
    )
    if (!versionFinal) {
      throw new BadRequestException('No hay versión marcada como FINAL en este proyecto.')
    }

    // 2) Restaurar tablas vivas desde el snapshot FINAL
    await this.restaurarLiveDesdeSnapshot(proyectoId, Number(versionFinal.versionId))

    // 3) Insertar en PROYECTOAPROBADO (con upsert manual: si ya existía borrar)
    await this.dataSource.query(
      `DELETE FROM PROYECTOAPROBADO WHERE PROYECTOID = :1`, [proyectoId],
    )
    await this.dataSource.query(
      `INSERT INTO PROYECTOAPROBADO
         (PROYECTOID, PROYECTOVERSIONID, VERSIONCODIGO, VERSIONHASH,
          FECHAAPROBACION, USUARIOAPROBO, COMENTARIOAPROBACION)
       VALUES (:1, :2, :3, :4, SYSDATE, :5, :6)`,
      [proyectoId, Number(versionFinal.versionId), versionFinal.codigo,
       versionFinal.hash, email, comentario?.trim() || null],
    )

    // 4) Cambiar estado a 3 (Aprobado)
    await this.dataSource.query(
      `UPDATE PROYECTO SET PROYECTOESTADO = 3 WHERE PROYECTOID = :1`,
      [proyectoId],
    )

    return {
      message: 'Proyecto aprobado correctamente. Las tablas vivas fueron restauradas desde la versión FINAL.',
      versionAprobada: {
        versionId: Number(versionFinal.versionId),
        codigo: versionFinal.codigo,
        hash: versionFinal.hash,
      },
    }
  }

  // ── Crear nueva versión del proyecto ─────────────────────────────────────

  /** Crea una nueva versión (snapshot) del proyecto. NO cambia el estado del
   *  proyecto. La transición a estado 1 (Confirmado) ocurre solo cuando el
   *  proponente marca explícitamente una versión como FINAL. */
  async crearVersion(email: string, proyectoId: number, comentario?: string | null) {
    const empresaId = await this.getEmpresaId(email)

    const rows = await this.dataSource.query(
      `SELECT PROYECTOESTADO AS "estado", CONVOCATORIAID AS "convocatoriaId"
         FROM PROYECTO WHERE PROYECTOID = :1 AND EMPRESAID = :2`,
      [proyectoId, empresaId],
    )
    if (!rows.length) throw new NotFoundException('Proyecto no encontrado')
    const { estado, convocatoriaId } = rows[0]

    // Estados que bloquean crear una nueva versión:
    if (Number(estado) === 1) {
      throw new BadRequestException('El proyecto tiene una versión FINAL marcada. Quita la marca FINAL para poder crear una nueva versión.')
    }
    if (Number(estado) === 3) {
      throw new BadRequestException('El proyecto está aprobado y no admite nuevas versiones.')
    }
    if (Number(estado) === 4) {
      throw new BadRequestException('El proyecto está rechazado y no admite nuevas versiones.')
    }

    // Unicidad: la empresa no puede tener otro proyecto confirmado o
    // aprobado en la misma convocatoria. Aplica también para versiones
    // (porque el snapshot debe ser válido para enviar a SECOP).
    const [{ total }] = await this.dataSource.query(
      `SELECT COUNT(PROYECTOID) AS "total"
         FROM PROYECTO
        WHERE EMPRESAID = :1 AND CONVOCATORIAID = :2
          AND PROYECTOESTADO IN (1, 3) AND PROYECTOID != :3`,
      [empresaId, convocatoriaId, proyectoId],
    )
    if (Number(total) > 0)
      throw new BadRequestException('Ya existe otro proyecto confirmado o aprobado en esta convocatoria.')

    // Validación de completitud antes de generar el snapshot
    const issues = await this.validarCompletitudParaConfirmar(proyectoId)
    if (issues.length > 0) {
      throw new BadRequestException({
        message: 'No se puede crear una nueva versión: faltan datos por completar.',
        issues,
      })
    }

    // Crear snapshot inmutable
    const nuevaVersion = await this.crearVersionProyecto(proyectoId, email, comentario)

    return {
      message: `Versión V${nuevaVersion.versionNumero} creada correctamente. El proyecto sigue editable hasta que marques una versión como FINAL.`,
      version: nuevaVersion,
    }
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

  /** Mapea cada MODALIDADFORMACIONID al / los keyword(s) cortos que aparecen en
   *  la columna RUBROMODALIDAD del catálogo de rubros. La columna guarda listas
   *  como "PRESENCIAL,PRESENCIAL HÍBRIDA,PAT,VIRTUAL" — por eso buscamos por
   *  keyword y no por el nombre completo de la modalidad. */
  private modalidadKeywords(modalidadId: number): string[] {
    switch (modalidadId) {
      case 1: return ['PRESENCIAL']                  // Presencial
      case 2: return ['PAT']                         // Presencial asistida por tecnologías-PAT
      case 3: return ['HIBRIDA']                     // Presencial Híbrida (TRANSLATE quita tilde)
      case 4: return ['VIRTUAL']                     // Virtual
      case 5: return ['PRESENCIAL', 'VIRTUAL']       // Combinada Presencial-Virtual
      case 6: return ['PAT', 'VIRTUAL']              // Combinada PAT-Virtual
      default: return []
    }
  }

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

    const convId: number = af.convocatoriaId
    const keywords = this.modalidadKeywords(Number(af.modalidadId))

    // Construir filtro de modalidad: pasa si RUBROMODALIDAD es NULL/vacío
    // o contiene CUALQUIERA de las keywords (OR). Para combinadas (ids 5,6)
    // hay 2 keywords; para el resto, 1.
    let filtroModalidad = `(r.RUBROMODALIDAD IS NULL OR r.RUBROMODALIDAD = '')`
    const params: unknown[] = [convId]
    if (keywords.length > 0) {
      const orClauses = keywords.map((_, i) =>
        `INSTR(TRANSLATE(UPPER(r.RUBROMODALIDAD), 'ÁÉÍÓÚÑáéíóúñ', 'AEIOUNAEIOUN'), :${params.length + i + 1}) > 0`,
      ).join(' OR ')
      filtroModalidad = `(r.RUBROMODALIDAD IS NULL OR r.RUBROMODALIDAD = '' OR ${orClauses})`
      params.push(...keywords)
    }
    params.push(afId)
    const afIdParamIdx = params.length

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
          AND ${filtroModalidad}
          AND (
            r.RUBROPERFILUT = 0
            OR r.RUBROID IN (
              SELECT DISTINCT p.RUBROIDUT
                FROM PERFILUT p
                JOIN UNIDADTEMATICA ut ON ut.UNIDADTEMATICAID = p.UNIDADTEMATICAID
               WHERE ut.ACCIONFORMACIONID = :${afIdParamIdx}
            )
          )
        ORDER BY r.RUBROID`, params,
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
              af.ACCIONFORMACIONNUMHORAGRUPO    AS "numHorasGrupo",
              af.TIPOEVENTOID                  AS "tipoEventoId",
              af.MODALIDADFORMACIONID          AS "modalidadId"
         FROM ACCIONFORMACION af WHERE af.ACCIONFORMACIONID = :1`,
      [afId],
    )
    if (!af) return { ok: false, issues: ['AF no encontrada'] }

    const numGruposAF    = Number(af.numGrupos) || 0
    const numHorasGrupo  = Number(af.numHorasGrupo) || 0

    if (!af.tipoEventoId || !af.modalidadId)
      issues.push('Falta guardar el tipo de evento y/o modalidad de formación.')
    if (numHorasGrupo <= 0)
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

    if (numHorasGrupo > 0) {
      const [{ horasUTs }] = await this.dataSource.query(
        `SELECT NVL(SUM(
           NVL(UNIDADTEMATICAHORASPP,0)+NVL(UNIDADTEMATICAHORASPV,0)+
           NVL(UNIDADTEMATICAHORASPPAT,0)+NVL(UNIDADTEMATICAHORASPHIB,0)+
           NVL(UNIDADTEMATICAHORASTP,0)+NVL(UNIDADTEMATICAHORASTV,0)+
           NVL(UNIDADTEMATICAHORASTPAT,0)+NVL(UNIDADTEMATICAHORASTHIB,0)
         ),0) AS "horasUTs" FROM UNIDADTEMATICA WHERE ACCIONFORMACIONID = :1`,
        [afId])
      if (Number(horasUTs) < numHorasGrupo)
        issues.push(`Las horas de las UTs (${Number(horasUTs)}h) no cubren las horas por grupo de la AF (${numHorasGrupo}h). Las UTs se formulan por grupo y se replican en cada uno. Agregue más horas en las UTs.`)
    }

    return { ok: issues.length === 0, issues }
  }

  private async validarPrerequisitosRubros(afId: number) {
    const [af] = await this.dataSource.query(
      `SELECT af.ACCIONFORMACIONNUMGRUPOS       AS "numGrupos",
              af.ACCIONFORMACIONNUMHORAGRUPO    AS "numHorasGrupo",
              af.TIPOEVENTOID                  AS "tipoEventoId",
              af.MODALIDADFORMACIONID          AS "modalidadId"
         FROM ACCIONFORMACION af WHERE af.ACCIONFORMACIONID = :1`,
      [afId],
    )
    if (!af) throw new BadRequestException('AF no encontrada')

    const numGruposAF   = Number(af.numGrupos) || 0
    const numHorasGrupo = Number(af.numHorasGrupo) || 0

    // 1. Debe tener tipo de evento, modalidad y horas definidas
    if (!af.tipoEventoId || !af.modalidadId)
      throw new BadRequestException('Debe guardar primero el tipo de evento y modalidad de formación antes de registrar rubros.')
    if (numHorasGrupo <= 0)
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
    if (Number(horasUTs) < numHorasGrupo)
      throw new BadRequestException(`Las horas de las Unidades Temáticas (${Number(horasUTs)}h) no completan las horas por grupo de la AF (${numHorasGrupo}h). Recuerde que las UTs se formulan por grupo y se replican en cada uno. Complete las UTs antes de registrar rubros.`)
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
           AFRUBROCANTIDAD=1, AFRUBROFECHAREGISTRO=SYSDATE WHERE AFRUBROID=:8`,
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

  // ── Presupuesto General del Proyecto ──────────────────────────────────────

  /** Devuelve el resumen presupuestal completo del proyecto: lista de AFs con
   *  totales por rubro, GO por AF, Transferencia por AF, totales generales y
   *  estado de guardado. */
  async getPresupuestoProyecto(proyectoId: number) {
    // 1. AFs con sus totales de rubros (excluyendo R09 y R015)
    const afs = await this.dataSource.query(
      `SELECT af.ACCIONFORMACIONID                                            AS "afId",
              af.ACCIONFORMACIONNUMERO                                        AS "numero",
              af.ACCIONFORMACIONNOMBRE                                        AS "nombre",
              NVL(af.ACCIONFORMACIONNUMBENEF, 0)                              AS "beneficiarios",
              NVL(t.cofSena, 0)                                               AS "cofSena",
              NVL(t.contraEspecie, 0)                                         AS "contraEspecie",
              NVL(t.contraDinero, 0)                                          AS "contraDinero",
              NVL(t.total, 0)                                                 AS "total"
         FROM ACCIONFORMACION af
         LEFT JOIN (
              SELECT ar.ACCIONFORMACIONID,
                     SUM(ar.AFRUBROCOFINANCIACION) AS cofSena,
                     SUM(ar.AFRUBROESPECIE)        AS contraEspecie,
                     SUM(ar.AFRUBRODINERO)         AS contraDinero,
                     SUM(ar.AFRUBROVALOR)          AS total
                FROM AFRUBRO ar
                JOIN RUBRO r ON r.RUBROID = ar.RUBROID
               WHERE TRIM(r.RUBROCODIGO) NOT IN ('R09','R015')
               GROUP BY ar.ACCIONFORMACIONID
         ) t ON t.ACCIONFORMACIONID = af.ACCIONFORMACIONID
        WHERE af.PROYECTOID = :1
        ORDER BY af.ACCIONFORMACIONNUMERO`,
      [proyectoId],
    )

    // 2. Gastos de Operación por AF
    const goPorAf = await this.dataSource.query(
      `SELECT af.ACCIONFORMACIONID         AS "afId",
              af.ACCIONFORMACIONNUMERO     AS "numero",
              af.ACCIONFORMACIONNOMBRE     AS "nombre",
              NVL(ar.AFRUBROCOFINANCIACION, 0) AS "cofSena",
              NVL(ar.AFRUBROESPECIE, 0)        AS "contraEspecie",
              NVL(ar.AFRUBRODINERO, 0)         AS "contraDinero",
              NVL(ar.AFRUBROVALOR, 0)          AS "total"
         FROM ACCIONFORMACION af
         LEFT JOIN AFRUBRO ar
              ON ar.ACCIONFORMACIONID = af.ACCIONFORMACIONID
             AND ar.RUBROID IN (SELECT RUBROID FROM RUBRO WHERE TRIM(RUBROCODIGO) = 'R09')
        WHERE af.PROYECTOID = :1
        ORDER BY af.ACCIONFORMACIONNUMERO`,
      [proyectoId],
    )

    // 3. Transferencia por AF
    const transPorAf = await this.dataSource.query(
      `SELECT af.ACCIONFORMACIONID         AS "afId",
              af.ACCIONFORMACIONNUMERO     AS "numero",
              af.ACCIONFORMACIONNOMBRE     AS "nombre",
              NVL(ar.AFRUBROBENEFICIARIOS, 0) AS "beneficiarios",
              NVL(ar.AFRUBROVALOR, 0)         AS "valor"
         FROM ACCIONFORMACION af
         LEFT JOIN AFRUBRO ar
              ON ar.ACCIONFORMACIONID = af.ACCIONFORMACIONID
             AND ar.RUBROID IN (SELECT RUBROID FROM RUBRO WHERE TRIM(RUBROCODIGO) = 'R015')
        WHERE af.PROYECTOID = :1
        ORDER BY af.ACCIONFORMACIONNUMERO`,
      [proyectoId],
    )

    // 4. Modalidad del proyecto
    const [proy] = await this.dataSource.query(
      `SELECT p.MODALIDADID         AS "modalidadId",
              m.MODALIDADNOMBRE     AS "modalidad",
              p.PROYECTONOMBRE      AS "nombre"
         FROM PROYECTO p
         LEFT JOIN MODALIDAD m ON m.MODALIDADID = p.MODALIDADID
        WHERE p.PROYECTOID = :1`,
      [proyectoId],
    )
    if (!proy) throw new BadRequestException('Proyecto no encontrado')

    // 5. Presupuesto guardado (si existe)
    const [presupuestoExistente] = await this.dataSource.query(
      `SELECT PRESUPUESTOID AS "id", PRESUPUESTOFECHAREGISTRO AS "fechaRegistro"
         FROM PRESUPUESTO WHERE PROYECTOID = :1`,
      [proyectoId],
    )

    // ── Cálculos de totales ───────────────────────────────────────────────
    const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0)

    // AFs: enriquecemos con %
    const afsRich = afs.map((a: any) => {
      const total = Number(a.total) || 0
      return {
        afId: Number(a.afId),
        numero: Number(a.numero),
        nombre: a.nombre,
        beneficiarios: Number(a.beneficiarios),
        cofSena: Number(a.cofSena),
        porcSena: pct(Number(a.cofSena), total),
        contraEspecie: Number(a.contraEspecie),
        porcEspecie: pct(Number(a.contraEspecie), total),
        contraDinero: Number(a.contraDinero),
        porcDinero: pct(Number(a.contraDinero), total),
        total,
      }
    })
    const totalAfs           = afsRich.length
    const totalBeneficiarios = afsRich.reduce((s: number, a: any) => s + a.beneficiarios, 0)
    const totalCofSena       = afsRich.reduce((s: number, a: any) => s + a.cofSena, 0)
    const totalContraEspecie = afsRich.reduce((s: number, a: any) => s + a.contraEspecie, 0)
    const totalContraDinero  = afsRich.reduce((s: number, a: any) => s + a.contraDinero, 0)
    const valorTotalAFs      = afsRich.reduce((s: number, a: any) => s + a.total, 0)

    // GO
    const goRich = goPorAf.map((g: any) => {
      const total = Number(g.total) || 0
      return {
        afId: Number(g.afId),
        numero: Number(g.numero),
        nombre: g.nombre,
        cofSena: Number(g.cofSena),
        porcSena: pct(Number(g.cofSena), total),
        contraEspecie: Number(g.contraEspecie),
        porcEspecie: pct(Number(g.contraEspecie), total),
        contraDinero: Number(g.contraDinero),
        porcDinero: pct(Number(g.contraDinero), total),
        total,
      }
    })
    const goTotalCofSena       = goRich.reduce((s: number, g: any) => s + g.cofSena, 0)
    const goTotalContraEspecie = goRich.reduce((s: number, g: any) => s + g.contraEspecie, 0)
    const goTotalContraDinero  = goRich.reduce((s: number, g: any) => s + g.contraDinero, 0)
    const goTotal              = goTotalCofSena + goTotalContraEspecie + goTotalContraDinero

    // Mensaje R09.1 vs R09.2 según valor total de AFs
    const r09Tope = valorTotalAFs > 200_000_000 ? 10 : 16
    const r09Codigo = valorTotalAFs > 200_000_000 ? 'R09.1' : 'R09.2'
    const r09Mensaje = valorTotalAFs > 200_000_000
      ? 'R09.1: cuando se trate de proyectos por valor superior a $200.000.000, el porcentaje máximo para este rubro será hasta el 10% del valor total de las acciones de formación del proyecto.'
      : 'R09.2: cuando se trate de proyectos por valor menor o igual a $200.000.000, el porcentaje máximo para este rubro será hasta el 16% del valor total de las acciones de formación del proyecto.'

    // Transferencia
    // El % del valor de transferencia se calcula sobre (AFs + GO), no solo
    // sobre AFs (especificación de SENA: el mínimo del 1% aplica sobre el
    // total de AFs + Gastos de Operación del proyecto).
    const baseTransPct = valorTotalAFs + goTotal
    const transRich = transPorAf.map((t: any) => {
      const beneficiarios = Number(t.beneficiarios) || 0
      const valor         = Number(t.valor) || 0
      return {
        afId: Number(t.afId),
        numero: Number(t.numero),
        nombre: t.nombre,
        beneficiarios,
        porcBeneficiarios: pct(beneficiarios, totalBeneficiarios),
        valor,
        porcValor: pct(valor, baseTransPct),
      }
    })
    const transTotalBenef = transRich.reduce((s: number, t: any) => s + t.beneficiarios, 0)
    const transTotalValor = transRich.reduce((s: number, t: any) => s + t.valor, 0)

    // Totales del proyecto: la Transferencia (R015) se paga con contrapartida
    // en dinero del proponente → se suma al total de Contra. Dinero.
    const totalProyectoCofSena       = totalCofSena       + goTotalCofSena
    const totalProyectoContraEspecie = totalContraEspecie + goTotalContraEspecie
    const totalProyectoContraDinero  = totalContraDinero  + goTotalContraDinero + transTotalValor
    const valorTotalProyecto         = valorTotalAFs + goTotal + transTotalValor

    return {
      proyecto: {
        id: proyectoId,
        nombre: proy.nombre,
        modalidadId: Number(proy.modalidadId) || 0,
        modalidad: proy.modalidad ?? '',
      },
      afs: afsRich,
      totalesAfs: {
        totalAfs, totalBeneficiarios,
        totalCofSena,       porcCofSena:       pct(totalCofSena,       valorTotalAFs),
        totalContraEspecie, porcContraEspecie: pct(totalContraEspecie, valorTotalAFs),
        totalContraDinero,  porcContraDinero:  pct(totalContraDinero,  valorTotalAFs),
        valorTotalAFs,
      },
      go: {
        porAf: goRich,
        totalCofSena:       goTotalCofSena,       porcCofSena:       pct(goTotalCofSena,       goTotal),
        totalContraEspecie: goTotalContraEspecie, porcContraEspecie: pct(goTotalContraEspecie, goTotal),
        totalContraDinero:  goTotalContraDinero,  porcContraDinero:  pct(goTotalContraDinero,  goTotal),
        total: goTotal,
        porcSobreAFs: pct(goTotal, valorTotalAFs),
        topePermitido: r09Tope,
        codigo: r09Codigo,
        mensaje: r09Mensaje,
      },
      transferencia: {
        porAf: transRich,
        totalBeneficiarios: transTotalBenef,
        porcBeneficiarios:  pct(transTotalBenef, totalBeneficiarios),
        totalValor:         transTotalValor,
        // % sobre (AFs + GO) — base correcta de la spec SENA, no solo AFs.
        porcValor:          pct(transTotalValor, baseTransPct),
      },
      totalProyecto: {
        cofSena:       totalProyectoCofSena,       porcCofSena:       pct(totalProyectoCofSena,       valorTotalProyecto),
        contraEspecie: totalProyectoContraEspecie, porcContraEspecie: pct(totalProyectoContraEspecie, valorTotalProyecto),
        contraDinero:  totalProyectoContraDinero,  porcContraDinero:  pct(totalProyectoContraDinero,  valorTotalProyecto),
        valorTotal:    valorTotalProyecto,
      },
      guardado: !!presupuestoExistente,
      fechaRegistro: presupuestoExistente?.fechaRegistro ?? null,
    }
  }

  /** Valida y persiste el presupuesto del proyecto. Si alguna validación falla,
   *  lanza BadRequestException con la lista de errores y NO guarda nada. */
  async guardarPresupuestoProyecto(proyectoId: number) {
    const r = await this.getPresupuestoProyecto(proyectoId)
    const errores: string[] = []

    // 1. Sumas no negativas
    if (r.totalesAfs.valorTotalAFs <= 0)
      errores.push('Las acciones de formación no tienen presupuesto registrado.')

    // 2. Tope GO según R09.1 / R09.2
    if (r.go.porcSobreAFs > r.go.topePermitido)
      errores.push(`El porcentaje de Gastos de Operación (${r.go.porcSobreAFs.toFixed(2)}%) supera el tope ${r.go.codigo} de ${r.go.topePermitido}% del total de AFs.`)

    // 3. Transferencia: # beneficiarios ≥ 5% del total benef del proyecto
    if (r.transferencia.porcBeneficiarios < 5)
      errores.push(`Los beneficiarios de Transferencia (${r.transferencia.porcBeneficiarios.toFixed(2)}%) deben ser mínimo el 5% del total de beneficiarios del proyecto.`)

    // 4. Transferencia: valor ≥ 1% del (AFs + Gastos de Operación)
    if (r.transferencia.porcValor < 1)
      errores.push(`El valor de Transferencia (${r.transferencia.porcValor.toFixed(2)}%) debe ser mínimo el 1% del valor total (AFs + Gastos de Operación).`)

    // 5. Beneficiarios y valor de transferencia no pueden exceder 100%
    if (r.transferencia.porcBeneficiarios > 100)
      errores.push('Los beneficiarios de Transferencia no pueden exceder el 100% del total de beneficiarios.')
    if (r.transferencia.porcValor > 100)
      errores.push('El valor de Transferencia no puede exceder el 100% del valor total de las AFs.')

    // 6. Contrapartida en dinero ≥ valor de transferencia
    if (r.totalesAfs.totalContraDinero < r.transferencia.totalValor)
      errores.push('La contrapartida en dinero debe ser al menos igual al valor de la transferencia.')

    // 7. % contrapartida según modalidad
    const modalidad = (r.proyecto.modalidad ?? '').toUpperCase()
    const porcContrapartida = r.totalesAfs.porcContraEspecie + r.totalesAfs.porcContraDinero
    if (modalidad.includes('INDIVIDUAL')) {
      if (porcContrapartida < 40 || porcContrapartida > 60)
        errores.push(`Para modalidad Individual la contrapartida total debe estar entre 40% y 60% (actual: ${porcContrapartida.toFixed(2)}%).`)
    } else if (modalidad.includes('GREMIO')) {
      if (porcContrapartida < 20 || porcContrapartida > 80)
        errores.push(`Para modalidad Gremio la contrapartida total debe estar entre 20% y 80% (actual: ${porcContrapartida.toFixed(2)}%).`)
    }

    // 8. Contrapartida en dinero ≥ 50% de la contrapartida total
    const dineroMin = porcContrapartida * 0.5
    if (r.totalesAfs.porcContraDinero < dineroMin)
      errores.push(`La contrapartida en dinero (${r.totalesAfs.porcContraDinero.toFixed(2)}%) debe ser al menos el 50% de la contrapartida total (${porcContrapartida.toFixed(2)}%, mínimo ${dineroMin.toFixed(2)}%).`)

    if (errores.length > 0) {
      throw new BadRequestException({ message: 'No se puede guardar el presupuesto', errores })
    }

    // ── Persistir ─────────────────────────────────────────────────────────
    const [existing] = await this.dataSource.query(
      `SELECT PRESUPUESTOID AS "id" FROM PRESUPUESTO WHERE PROYECTOID = :1`,
      [proyectoId],
    )

    const params = [
      r.totalesAfs.totalAfs,
      r.totalesAfs.totalBeneficiarios,
      r.go.total,
      r.go.totalCofSena,
      r.go.totalContraEspecie,
      r.go.totalContraDinero,
      r.transferencia.totalValor,
      r.transferencia.totalBeneficiarios,
      r.go.porcSobreAFs,
      r.totalesAfs.valorTotalAFs,
      r.totalProyecto.valorTotal,
      r.totalesAfs.totalCofSena,
      r.totalesAfs.totalContraEspecie,
      r.totalesAfs.totalContraDinero,
    ]

    if (existing) {
      await this.dataSource.query(
        `UPDATE PRESUPUESTO SET
            PRESUPUESTOTOTALAF              = :1,
            PRESUPUESTONUMEROBENEFICIARIOS  = :2,
            PRESUPUESTOGASTOSOPERACION      = :3,
            PRESUPUESTOGOCOFINANCIACION     = :4,
            PRESUPUESTOGOESPECIE            = :5,
            PRESUPUESTOGODINERO             = :6,
            PRESUPUESTOVALORTRANSFERENCIA   = :7,
            PRESUPUESTOBENEFICIARIOSTRANSF  = :8,
            PRESUPUESTOPORCENTAJEGO         = :9,
            PRESUPUESTOVALORAF              = :10,
            PRESUPUESTOVALORTOTALPROYECTO   = :11,
            PRESUPUESTOCOFINANCIACION       = :12,
            PRESUPUESTOESPECIE              = :13,
            PRESUPUESTODINERO               = :14,
            PRESUPUESTOFECHAREGISTRO        = SYSDATE
          WHERE PRESUPUESTOID = :15`,
        [...params, existing.id],
      )
      return { id: existing.id, message: 'Presupuesto del proyecto actualizado correctamente' }
    }

    const [{ nid }] = await this.dataSource.query(`SELECT NVL(MAX(PRESUPUESTOID), 0) + 1 AS "nid" FROM PRESUPUESTO`)
    await this.dataSource.query(
      `INSERT INTO PRESUPUESTO (PRESUPUESTOID, PROYECTOID,
          PRESUPUESTOTOTALAF, PRESUPUESTONUMEROBENEFICIARIOS,
          PRESUPUESTOGASTOSOPERACION, PRESUPUESTOGOCOFINANCIACION,
          PRESUPUESTOGOESPECIE, PRESUPUESTOGODINERO,
          PRESUPUESTOVALORTRANSFERENCIA, PRESUPUESTOBENEFICIARIOSTRANSF,
          PRESUPUESTOPORCENTAJEGO, PRESUPUESTOVALORAF,
          PRESUPUESTOVALORTOTALPROYECTO, PRESUPUESTOCOFINANCIACION,
          PRESUPUESTOESPECIE, PRESUPUESTODINERO,
          PRESUPUESTOFECHAREGISTRO)
        VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14, :15, :16, SYSDATE)`,
      [nid, proyectoId, ...params],
    )
    return { id: nid, message: 'Presupuesto del proyecto guardado correctamente' }
  }

  // ── Reporte completo del Proyecto ─────────────────────────────────────────

  /** Devuelve el snapshot completo del proyecto para el reporte / impresión:
   *  proyecto, empresa, contactos, análisis, sectores, AFs con detalle,
   *  diagnósticos asociados (uno por cada necesidad distinta vinculada a las
   *  AFs) y presupuesto general. */
  async getReporteProyecto(proyectoId: number) {
    // 1. Datos del proyecto + convocatoria + modalidad + empresaId
    const [proy] = await this.dataSource.query(
      `SELECT p.PROYECTOID                AS "proyectoId",
              p.PROYECTONOMBRE            AS "nombre",
              p.PROYECTOOBJETIVO          AS "objetivo",
              p.PROYECTOFECHAREGISTRO     AS "fechaRegistro",
              p.PROYECTOFECHARADICACION   AS "fechaRadicacion",
              p.PROYECTOESTADO            AS "estado",
              p.EMPRESAID                 AS "empresaId",
              c.CONVOCATORIANOMBRE        AS "convocatoria",
              m.MODALIDADNOMBRE           AS "modalidad",
              m.MODALIDADID               AS "modalidadId"
         FROM PROYECTO p
         LEFT JOIN CONVOCATORIA c ON c.CONVOCATORIAID = p.CONVOCATORIAID
         LEFT JOIN MODALIDAD m    ON m.MODALIDADID    = p.MODALIDADID
        WHERE p.PROYECTOID = :1`,
      [proyectoId],
    )
    if (!proy) throw new NotFoundException('Proyecto no encontrado')
    const empresaId: number = proy.empresaId

    // 2. Empresa: datos básicos + análisis + cadena productiva
    const [empresa] = await this.dataSource.query(
      `SELECT e.EMPRESARAZONSOCIAL              AS "razonSocial",
              e.EMPRESASIGLA                    AS "sigla",
              e.EMPRESAIDENTIFICACION           AS "nit",
              e.EMPRESADIGITOVERIFICACION       AS "digitoV",
              e.EMPRESAEMAIL                    AS "email",
              e.EMPRESADIRECCION                AS "direccion",
              e.EMPRESATELEFONO                 AS "telefono",
              e.EMPRESACELULAR                  AS "celular",
              e.EMPRESAWEBSITE                  AS "website",
              e.EMPRESAINDICATIVO               AS "indicativo",
              e.EMPRESACERTIFCOMP               AS "certifComp",
              e.EMPRESAEXPERTTECN               AS "expertTecn",
              dep.DEPARTAMENTONOMBRE            AS "departamento",
              ciu.CIUDADNOMBRE                  AS "ciudad",
              cob.COBERTURADESCRIPCION          AS "cobertura",
              ciiu.CIIUCODIGO                   AS "ciiuCodigo",
              ciiu.CIIUDESCRIPCION              AS "ciiuDescripcion",
              te.TIPOEMPRESANOMBRE              AS "tipoEmpresa",
              tam.TAMANOEMPRESANOMBRE           AS "tamanoEmpresa",
              e.EMPRESAREP                      AS "repNombre",
              e.EMPRESAREPCARGO                 AS "repCargo",
              e.EMPRESAREPCORREO                AS "repCorreo",
              e.EMPRESAREPTEL                   AS "repTel",
              e.EMPRESAREPDOCUMENTO             AS "repDocumento",
              tdoc.TIPODOCUMENTOIDENTIDADNOMBRE AS "repTipoDoc",
              e.EMPRESAOBJETO                   AS "objeto",
              e.EMPRESAPRODUCTOS                AS "productos",
              e.EMPRESASITUACION                AS "situacion",
              e.EMPRESAPAPEL                    AS "papel",
              e.EMPRESARETOS                    AS "retos",
              e.EMPRESAEXPERIENCIA              AS "experiencia",
              e.EMPRESAESLABONES                AS "eslabones",
              e.EMPRESAINTERACCIONES            AS "interacciones"
         FROM EMPRESA e
         LEFT JOIN DEPARTAMENTO dep         ON dep.DEPARTAMENTOID  = e.DEPARTAMENTOEMPRESAID
         LEFT JOIN CIUDAD ciu               ON ciu.CIUDADID        = e.CIUDADEMPRESAID
         LEFT JOIN COBERTURA cob            ON cob.COBERTURAID     = e.COBERTURAEMPRESAID
         LEFT JOIN CIIU ciiu                ON ciiu.CIIUID         = e.CIIUID
         LEFT JOIN TIPOEMPRESA te           ON te.TIPOEMPRESAID    = e.TIPOEMPRESAID
         LEFT JOIN TAMANOEMPRESA tam        ON tam.TAMANOEMPRESAID = e.TAMANOEMPRESAID
         LEFT JOIN TIPODOCUMENTOIDENTIDAD tdoc ON tdoc.TIPODOCUMENTOIDENTIDADID = e.TIPOIDENTIFICACIONREP
        WHERE e.EMPRESAID = :1`,
      [empresaId],
    )

    // 3. Mesas sectoriales de la empresa
    const mesasSectoriales = await this.dataSource.query(
      `SELECT ms.MESASECTORIALNOMBRE AS "nombre"
         FROM EMPRESAMESASECTORIAL me
         JOIN MESASECTORIAL ms ON ms.MESASECTORIALID = me.MESASECTORIALIDEMPRESA
        WHERE me.EMPRESAIDMESASECTORIAL = :1
        ORDER BY ms.MESASECTORIALNOMBRE`,
      [empresaId],
    )

    // 4. Sectores / Subsectores
    //    PERTENECE → tablas SECTORPEMPRESA / SUBSECTORPEMPRESA (FK *EMPRESAIDP*)
    //    REPRESENTA → tablas SECTOREMPRESA / SUBSECTOREMPRESA (FK EMPRESAID)
    const sectoresPertenece = await this.dataSource.query(
      `SELECT s.SECTORDESCRIPCION AS "nombre"
         FROM SECTORPEMPRESA sp JOIN SECTOR s ON s.SECTORID = sp.SECTORIDPEMPRESA
        WHERE sp.EMPRESAIDPSECTOR = :1 ORDER BY s.SECTORDESCRIPCION`,
      [empresaId],
    ).catch(() => [])
    const subsectoresPertenece = await this.dataSource.query(
      `SELECT sub.SUBSECTORNOMBRE AS "nombre"
         FROM SUBSECTORPEMPRESA sp JOIN SUBSECTOR sub ON sub.SUBSECTORID = sp.SUBSECTORIDPEMPRESA
        WHERE sp.EMPRESAIDPSUBSECTOR = :1 ORDER BY sub.SUBSECTORNOMBRE`,
      [empresaId],
    ).catch(() => [])
    const sectoresRepresenta = await this.dataSource.query(
      `SELECT s.SECTORDESCRIPCION AS "nombre"
         FROM SECTOREMPRESA se JOIN SECTOR s ON s.SECTORID = se.SECTORIDEMPRESA
        WHERE se.EMPRESAID = :1 ORDER BY s.SECTORDESCRIPCION`,
      [empresaId],
    ).catch(() => [])
    const subsectoresRepresenta = await this.dataSource.query(
      `SELECT sub.SUBSECTORNOMBRE AS "nombre"
         FROM SUBSECTOREMPRESA se JOIN SUBSECTOR sub ON sub.SUBSECTORID = se.SUBSECTORIDEMPRESA
        WHERE se.EMPRESAID = :1 ORDER BY sub.SUBSECTORNOMBRE`,
      [empresaId],
    ).catch(() => [])

    // 5. Contactos asociados al proyecto (tabla CONTACTOEMPRESA)
    const contactos = await this.dataSource.query(
      `SELECT c.CONTACTOEMPRESANOMBRE          AS "nombre",
              c.CONTACTOEMPRESACARGO           AS "cargo",
              c.CONTACTOEMPRESACORREO          AS "correo",
              c.CONTACTOEMPRESATELEFONO        AS "telefono",
              c.CONTACTOEMPRESADOCUMENTO       AS "documento",
              tdoc.TIPODOCUMENTOIDENTIDADNOMBRE AS "tipoDoc"
         FROM CONTACTOEMPRESA c
         LEFT JOIN TIPODOCUMENTOIDENTIDAD tdoc ON tdoc.TIPODOCUMENTOIDENTIDADID = c.TIPOIDENTIFICACIONCONTACTOP
        WHERE c.PROYECTOIDCONTACTOS = :1
        ORDER BY c.CONTACTOEMPRESAID`,
      [proyectoId],
    ).catch(() => [])

    // 6. Acciones de Formación + sus datos clave
    const acciones = await this.dataSource.query(
      `SELECT af.ACCIONFORMACIONID                  AS "afId",
              af.ACCIONFORMACIONNUMERO              AS "numero",
              af.ACCIONFORMACIONNOMBRE              AS "nombre",
              af.ACCIONFORMACIONJUSTNEC             AS "justnec",
              af.ACCIONFORMACIONCAUSA               AS "causa",
              af.ACCIONFORMACIONRESULTADOS          AS "efectos",
              af.ACCIONFORMACIONOBJETIVO            AS "objetivo",
              af.ACCIONFORMACIONNUMHORAGRUPO        AS "numHorasGrupo",
              af.ACCIONFORMACIONNUMGRUPOS           AS "numGrupos",
              af.ACCIONFORMACIONNUMTOTHORASGRUP     AS "numTotHoras",
              af.ACCIONFORMACIONBENEFGRUPO          AS "benefGrupo",
              af.ACCIONFORMACIONBENEFVIGRUPO        AS "benefViGrupo",
              af.ACCIONFORMACIONNUMBENEF            AS "numBenef",
              af.NECESIDADFORMACIONIDAF             AS "necesidadFormacionId",
              af.TIPOEVENTOID                       AS "tipoEventoId",
              af.MODALIDADFORMACIONID               AS "modalidadFormacionId",
              af.METODOLOGIAAPRENDIZAJEID           AS "metodologiaAprendizajeId",
              af.MODELOAPRENDIZAJEID                AS "modeloAprendizajeId",
              te.TIPOEVENTONOMBRE                   AS "tipoEvento",
              mf.MODALIDADFORMACIONNOMBRE           AS "modalidad",
              ma.METODOLOGIAAPRENDIZAJENOMBRE       AS "metodologia",
              nf.NECESIDADFORMACIONNOMBRE           AS "necesidadFormacionNombre",
              nf.NECESIDADFORMACIONNUMERO           AS "necesidadFormacionNumero",
              nf.NECESIDADID                        AS "necesidadId"
         FROM ACCIONFORMACION af
         LEFT JOIN TIPOEVENTO te                ON te.TIPOEVENTOID                = af.TIPOEVENTOID
         LEFT JOIN MODALIDADFORMACION mf        ON mf.MODALIDADFORMACIONID        = af.MODALIDADFORMACIONID
         LEFT JOIN METODOLOGIAAPRENDIZAJE ma    ON ma.METODOLOGIAAPRENDIZAJEID    = af.METODOLOGIAAPRENDIZAJEID
         LEFT JOIN NECESIDADFORMACION nf        ON nf.NECESIDADFORMACIONID        = af.NECESIDADFORMACIONIDAF
        WHERE af.PROYECTOID = :1
        ORDER BY af.ACCIONFORMACIONNUMERO`,
      [proyectoId],
    )

    // 7. Diagnósticos asociados — uno por cada `necesidadId` distinto
    const necesidadesIdsUsados = Array.from(
      new Set(acciones.map((a: any) => Number(a.necesidadId)).filter((n: number) => n && !isNaN(n))),
    ) as number[]
    const diagnosticos = await Promise.all(
      necesidadesIdsUsados.map(async (id) => {
        try { return await this.necesidadesService.getReporte(id) }
        catch { return null }
      }),
    )

    // 8. Presupuesto general (reusa el método existente)
    let presupuesto: unknown = null
    try { presupuesto = await this.getPresupuestoProyecto(proyectoId) }
    catch { /* si falla, deja null y el frontend lo maneja */ }

    // 9. Versión actual (si existe)
    const versionActual = await this.getUltimaVersion(proyectoId).catch(() => null)

    return {
      proyecto: {
        id: Number(proy.proyectoId),
        codigo: String(proy.proyectoId), // el código del proyecto es el ID
        nombre: proy.nombre,
        objetivo: proy.objetivo,
        convocatoria: proy.convocatoria,
        modalidad: proy.modalidad,
        modalidadId: Number(proy.modalidadId) || 0,
        estado: Number(proy.estado) || 0,
        fechaRegistro: proy.fechaRegistro,
        fechaRadicacion: proy.fechaRadicacion,
      },
      empresa,
      mesasSectoriales: mesasSectoriales.map((m: any) => m.nombre),
      sectoresPertenece: sectoresPertenece.map((s: any) => s.nombre),
      subsectoresPertenece: subsectoresPertenece.map((s: any) => s.nombre),
      sectoresRepresenta: sectoresRepresenta.map((s: any) => s.nombre),
      subsectoresRepresenta: subsectoresRepresenta.map((s: any) => s.nombre),
      contactos,
      acciones,
      diagnosticos: diagnosticos.filter(d => d !== null),
      presupuesto,
      versionActual,
    }
  }
}
