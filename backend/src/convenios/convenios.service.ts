import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import * as XLSX from 'xlsx'
import { Empresa } from '../auth/entities/empresa.entity'

// ── Estados del convenio (CONVENIOSESTADO) ─────────────────────────────────
// Hasta donde sabemos del legacy:
//   1 → EN EJECUCIÓN (firmado y activo)
//   0/null → otros estados intermedios
// El admin maneja los estados al crear/cerrar el convenio. Esta capa no
// les pone semántica de negocio: solo retorna lo que está en BD.

export interface BeneficiarioDedup {
  nro: number
  afGrupoBeneficiarioId: number
  personaId: number
  tipoDocumentoId: number | null
  tipoDocumento: string | null
  identificacion: string | null
  nombreCompleto: string
  estado: string | null
  afsGrupos: string[]   // "AF 1 · G2", "AF 3 · G1", …
}

export interface PersonaBeneficiarioDto {
  personaId?: number | null     // si viene, actualiza; si no, crea
  tipoDocumentoId: number
  identificacion: string
  nombres: string
  primerApellido: string
  segundoApellido?: string | null
  generoId?: number | null
  estratoId?: number | null     // 1-6, no es catálogo
  fechaNacimiento?: string | null  // YYYY-MM-DD
  celular?: string | null
  departamentoId?: number | null
  ciudadId?: number | null
  email: string
  barrio?: string | null
  direccion?: string | null
  habeasData?: boolean
}

export interface PostulacionDto {
  personaId: number
  antiguedad: 'S' | 'N' | string
  beneficiarioEmpresaId: number
  nivelOcupacionalId: number
  caracterizacionId: number
  perfilTrasferenciaId: number
  postulacionTrasferencia: 'SI' | 'NO' | string
  fechaNacimiento?: string | null   // YYYY-MM-DD, para recalcular rangoEdadId
  rangoEdadId?: number              // opcional; si falta se calcula de fechaNacimiento
}

export interface EmpresaBeneficiariaDto {
  tipoDocumentoId: number
  numero: string
  digitoVerificacion?: string | null
  nombre: string
  tamanoEmpresaId: number
}

export interface DirectorBasicoDto {
  // Datos básicos para crear/asociar persona como director.
  // Si `personaId` viene seteado, se reusa la persona existente; si no, se
  // crea una nueva PERSONA con los demás datos.
  personaId?: number | null
  tipoDocumentoId: number
  identificacion: string
  nombres: string
  primerApellido: string
  segundoApellido?: string | null
  email: string
  telefono?: string | null
  celular?: string | null
  ciudadId?: number | null
}

@Injectable()
export class ConveniosService {
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

  /** Verifica que el convenio del proyecto esté EN EJECUCIÓN (estado=1). Si
   *  no lo está, lanza 403: ningún módulo (beneficiarios, cronograma,
   *  capacitadores, directores) permite cambios cuando el convenio terminó
   *  o no entró en ejecución. Es público para que otros services lo usen. */
  async assertConvenioEnEjecucion(proyectoId: number): Promise<void> {
    const [row] = await this.dataSource.query(
      `SELECT NVL(CONVENIOSESTADO, 0) AS "estado"
         FROM CONVENIOS WHERE PROYECTOID = :1
        ORDER BY CONVENIOSID DESC FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )
    if (!row) throw new BadRequestException('Este proyecto no tiene convenio.')
    if (Number(row.estado) !== 1) {
      throw new ForbiddenException(
        'Esta acción no está disponible: el convenio no está en ejecución. El módulo solo permite consulta.',
      )
    }
  }

  // ── Listado para "Convenios" del proponente ───────────────────────────

  /** Lista todos los convenios de la empresa logueada. Cada convenio se une
   *  con su proyecto, convocatoria y modalidad para devolver un objeto plano
   *  listo para pintar las tarjetas del listado. */
  async listarMisConvenios(email: string) {
    const empresaId = await this.getEmpresaId(email)
    return this.dataSource.query(
      `SELECT cv.CONVENIOSID                                AS "convenioId",
              TRIM(cv.CONVENIOSNUMERO)                      AS "numeroSecop",
              cv.CONVENIOSESTADO                            AS "estadoNum",
              CASE
                WHEN cv.CONVENIOSESTADO = 1 THEN 'EN EJECUCIÓN'
                WHEN cv.CONVENIOSESTADO = 0 THEN 'INACTIVO'
                ELSE 'PENDIENTE'
              END                                            AS "estadoEtiqueta",
              cv.CONVENIOSFECHASUSC                          AS "fechaSuscripcion",
              cv.CONVENIOSFECHAINICIO                        AS "fechaInicio",
              cv.CONVENIOSFECHAREGISTRO                      AS "fechaRegistro",
              p.PROYECTOID                                   AS "proyectoId",
              TRIM(p.PROYECTONOMBRE)                         AS "proyectoNombre",
              TRIM(co.CONVOCATORIANOMBRE)                    AS "convocatoria",
              TRIM(m.MODALIDADNOMBRE)                        AS "modalidad",
              co.CONVOCATORIAID                              AS "convocatoriaId"
         FROM CONVENIOS cv
         JOIN PROYECTO p          ON p.PROYECTOID    = cv.PROYECTOID
         LEFT JOIN CONVOCATORIA co ON co.CONVOCATORIAID = p.CONVOCATORIAID
         LEFT JOIN MODALIDAD m     ON m.MODALIDADID    = p.MODALIDADID
        WHERE p.EMPRESAID = :1
        ORDER BY cv.CONVENIOSFECHAREGISTRO DESC NULLS LAST,
                 cv.CONVENIOSID DESC`,
      [empresaId],
    )
  }

  /** Indicador rápido: ¿la empresa tiene al menos un convenio? Lo usamos
   *  para decidir si el header del proponente muestra "Conviniente" en lugar
   *  de "Gremio / Empresa / Asociación". */
  async empresaTieneConvenios(email: string): Promise<{ tieneConvenios: boolean; total: number }> {
    const empresaId = await this.getEmpresaId(email)
    const [{ total }] = await this.dataSource.query(
      `SELECT COUNT(cv.CONVENIOSID) AS "total"
         FROM CONVENIOS cv
         JOIN PROYECTO p ON p.PROYECTOID = cv.PROYECTOID
        WHERE p.EMPRESAID = :1`,
      [empresaId],
    )
    return { tieneConvenios: Number(total) > 0, total: Number(total) }
  }

  /** Detalle del convenio para la pantalla "Ejecución del Convenio". Trae los
   *  datos generales del convenio + del proyecto + de la empresa para pintar
   *  el header de la captura: Código de Proyecto, Nombre, Convocatoria,
   *  Modalidad, Número de Convenio (SECOP II), Empresa.
   *
   *  La búsqueda es por `proyectoId` (no por convenioId): un proyecto tiene
   *  máximo un convenio, así que la URL del frontend usa el código del
   *  proyecto que el conviniente ya conoce. */
  async getDetalleConvenio(email: string, proyectoId: number, perfilId?: number) {
    const empresaId = await this.getEmpresaId(email)
    const [row] = await this.dataSource.query(
      `SELECT cv.CONVENIOSID                                AS "convenioId",
              TRIM(cv.CONVENIOSNUMERO)                      AS "numeroSecop",
              cv.CONVENIOSESTADO                            AS "estadoNum",
              cv.CONVENIOSFECHASUSC                          AS "fechaSuscripcion",
              cv.CONVENIOSFECHAINICIO                        AS "fechaInicio",
              cv.CONVENIOSFECHAREGISTRO                      AS "fechaRegistro",
              cv.CONVENIOSFECHARP                            AS "fechaRp",
              cv.CONVENIOSRP                                 AS "rp",
              TRIM(cv.CONVENIOSBANCO)                        AS "banco",
              TRIM(cv.CONVENIOSCUENTA)                       AS "cuenta",
              cv.CONVENIOSTIPOCUENTA                         AS "tipoCuenta",
              TRIM(cv.CONVENIOSPOLIZA)                       AS "poliza",
              cv.CONVENIOSPOLIZAANEXO                        AS "polizaAnexo",
              cv.CONVENIOSFECEXPPOLIZA                       AS "fechaExpPoliza",
              cv.CONVENIOSFECAPROPOLIZA                      AS "fechaAproPoliza",
              TRIM(cv.CONVENIOSASEGURADORA)                  AS "aseguradora",
              cv.CONVENIOSREVISION                           AS "revision",
              cv.CONVENIOSOTROSI                             AS "otrosi",
              cv.CONVENIOSFECHAOTROSI                        AS "fechaOtrosi",
              cv.CONVENIOSLINKSECOP                          AS "linkSecop",
              TRIM(cv.CONVENIOSRADIPRESUPUESTO)              AS "radicadoPresupuesto",
              p.PROYECTOID                                   AS "proyectoId",
              TRIM(p.PROYECTONOMBRE)                         AS "proyectoNombre",
              TRIM(co.CONVOCATORIANOMBRE)                    AS "convocatoria",
              co.CONVOCATORIAID                              AS "convocatoriaId",
              TRIM(m.MODALIDADNOMBRE)                        AS "modalidad",
              p.EMPRESAID                                    AS "empresaId",
              TRIM(e.EMPRESARAZONSOCIAL)                     AS "empresa"
         FROM CONVENIOS cv
         JOIN PROYECTO p          ON p.PROYECTOID    = cv.PROYECTOID
         JOIN EMPRESA e            ON e.EMPRESAID     = p.EMPRESAID
         LEFT JOIN CONVOCATORIA co ON co.CONVOCATORIAID = p.CONVOCATORIAID
         LEFT JOIN MODALIDAD m     ON m.MODALIDADID    = p.MODALIDADID
        WHERE p.PROYECTOID = :1
        ORDER BY cv.CONVENIOSID DESC FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )
    if (!row) throw new NotFoundException('Convenio no encontrado para este proyecto')
    // Proponente: sólo puede ver convenios de SU empresa.
    // Admin / Interventor / SENA pueden ver cualquiera.
    const ADMIN = 1, INTERVENTOR = 11, COORD_INTERV = 10
    const internos = perfilId === ADMIN || perfilId === INTERVENTOR || perfilId === COORD_INTERV
    if (!internos && Number(row.empresaId) !== empresaId) {
      throw new ForbiddenException('No tienes acceso a este convenio.')
    }
    return row
  }

  // ── Beneficiarios del proyecto (ejecución) ────────────────────────────────

  /** Lista los beneficiarios del proyecto deduplicados por persona: un mismo
   *  beneficiario puede estar en varias AFs/grupos pero aquí aparece una sola
   *  vez (con la lista de AF·Grupo donde participa). Replica la lógica del
   *  DataProvider `DPBeneficiariosProyecto` del legacy GeneXus. */
  async getBeneficiariosProyecto(email: string, proyectoId: number, perfilId?: number) {
    // Validar acceso (reusa la validación del detalle del convenio).
    await this.getDetalleConvenio(email, proyectoId, perfilId)

    // Estado de la convocatoria: el botón "Actualizar datos" solo se habilita
    // para admin (1) siempre, y para la empresa proponente (7) si la
    // convocatoria está abierta (estado = 1).
    const [conv] = await this.dataSource.query(
      `SELECT NVL(co.CONVOCATORIAESTADO, 0) AS "estado"
         FROM PROYECTO p
         LEFT JOIN CONVOCATORIA co ON co.CONVOCATORIAID = p.CONVOCATORIAID
        WHERE p.PROYECTOID = :1`,
      [proyectoId],
    )
    const ADMIN = 1, EMPRESA = 7
    const convocatoriaAbierta = Number(conv?.estado) === 1
    const puedeActualizar = perfilId === ADMIN || (perfilId === EMPRESA && convocatoriaAbierta)
    // Estado del convenio: si != 1 (EN EJECUCIÓN), los módulos del frontend
    // deben mostrar solo lectura. El backend ya bloquea writes en los services.
    const [cvEstado] = await this.dataSource.query(
      `SELECT NVL(CONVENIOSESTADO, 0) AS "estado" FROM CONVENIOS
        WHERE PROYECTOID = :1 ORDER BY CONVENIOSID DESC FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )
    const convenioEnEjecucion = Number(cvEstado?.estado) === 1

    const rows: Array<{
      afGrupoBeneficiarioId: number
      personaId: number
      tipoDocumentoId: number | null
      tipoDocumento: string | null
      identificacion: string | null
      nombres: string | null
      primerApellido: string | null
      segundoApellido: string | null
      estado: string | null
      afNumero: number | null
      afNombre: string | null
      grupoNumero: number | null
    }> = await this.dataSource.query(
      `SELECT agb.AFGRUPOBENEFICIARIOID            AS "afGrupoBeneficiarioId",
              p.PERSONAID                          AS "personaId",
              p.TIPODOCUMENTOIDENTIDADID           AS "tipoDocumentoId",
              TRIM(td.TIPODOCUMENTOIDENTIDADNOMBRE) AS "tipoDocumento",
              TRIM(p.PERSONAIDENTIFICACION)        AS "identificacion",
              TRIM(p.PERSONANOMBRES)               AS "nombres",
              TRIM(p.PERSONAPRIMERAPELLIDO)        AS "primerApellido",
              TRIM(p.PERSONASEGUNDOAPELLIDO)       AS "segundoApellido",
              TRIM(agb.AFGRUPOBENEESTADO)          AS "estado",
              af.ACCIONFORMACIONNUMERO             AS "afNumero",
              TRIM(af.ACCIONFORMACIONNOMBRE)       AS "afNombre",
              g.AFGRUPONUMERO                      AS "grupoNumero"
         FROM AFGRUPOBENEFICIARIO agb
         JOIN AFGRUPO g          ON g.AFGRUPOID = agb.AFGRUPOID
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
         JOIN PERSONA p          ON p.PERSONAID = agb.PERSONAID
         LEFT JOIN TIPODOCUMENTOIDENTIDAD td ON td.TIPODOCUMENTOIDENTIDADID = p.TIPODOCUMENTOIDENTIDADID
        WHERE af.PROYECTOID = :1
        ORDER BY p.PERSONAID, af.ACCIONFORMACIONNUMERO, g.AFGRUPONUMERO`,
      [proyectoId],
    )

    // Por persona, acumulamos los grupos activos e inactivos por separado.
    type Acum = {
      personaId: number
      tipoDocumentoId: number | null
      tipoDocumento: string | null
      identificacion: string | null
      nombreCompleto: string
      activos: Array<{ afGrupoBeneficiarioId: number; etiqueta: string }>
      inactivos: Array<{ afGrupoBeneficiarioId: number; etiqueta: string; estado: string | null }>
    }
    const porPersona = new Map<number, Acum>()
    for (const r of rows) {
      const etiqueta = `AF ${r.afNumero ?? '?'} · G${r.grupoNumero ?? '?'}`
      const estado = (r.estado ?? '').trim().toUpperCase()
      const esActivo = estado === 'ACTIVO'
      let ex = porPersona.get(r.personaId)
      if (!ex) {
        const nombre = [r.nombres, r.primerApellido, r.segundoApellido]
          .map(x => (x ?? '').trim()).filter(Boolean).join(' ')
        ex = {
          personaId: r.personaId,
          tipoDocumentoId: r.tipoDocumentoId,
          tipoDocumento: r.tipoDocumento,
          identificacion: r.identificacion,
          nombreCompleto: nombre,
          activos: [],
          inactivos: [],
        }
        porPersona.set(r.personaId, ex)
      }
      if (esActivo) {
        if (!ex.activos.some(x => x.etiqueta === etiqueta)) {
          ex.activos.push({ afGrupoBeneficiarioId: r.afGrupoBeneficiarioId, etiqueta })
        }
      } else {
        ex.inactivos.push({ afGrupoBeneficiarioId: r.afGrupoBeneficiarioId, etiqueta, estado: r.estado })
      }
    }

    // Listas separadas:
    //   - beneficiarios: personas con al menos un grupo ACTIVO → solo grupos activos.
    //   - inactivos: TODA persona con al menos un grupo INACTIVO, mostrando
    //     solo sus grupos inactivos. Una persona puede aparecer en ambas listas
    //     si tiene grupos en distintos estados.
    const beneficiarios: BeneficiarioDedup[] = []
    const inactivos: BeneficiarioDedup[] = []
    let nro = 0, nroInact = 0
    for (const p of porPersona.values()) {
      if (p.activos.length > 0) {
        nro++
        beneficiarios.push({
          nro,
          afGrupoBeneficiarioId: p.activos[0].afGrupoBeneficiarioId,
          personaId: p.personaId,
          tipoDocumentoId: p.tipoDocumentoId,
          tipoDocumento: p.tipoDocumento,
          identificacion: p.identificacion,
          nombreCompleto: p.nombreCompleto,
          estado: 'ACTIVO',
          afsGrupos: p.activos.map(a => a.etiqueta),
        })
      }
      if (p.inactivos.length > 0) {
        nroInact++
        inactivos.push({
          nro: nroInact,
          afGrupoBeneficiarioId: p.inactivos[0].afGrupoBeneficiarioId,
          personaId: p.personaId,
          tipoDocumentoId: p.tipoDocumentoId,
          tipoDocumento: p.tipoDocumento,
          identificacion: p.identificacion,
          nombreCompleto: p.nombreCompleto,
          estado: (p.inactivos[0].estado ?? 'INACTIVO').trim().toUpperCase(),
          afsGrupos: p.inactivos.map(i => `${i.etiqueta} (${(i.estado ?? '').trim() || '—'})`),
        })
      }
    }

    return {
      total: beneficiarios.length,
      totalRegistros: rows.length, // cuántas filas AF·grupo en total (sin dedup)
      puedeActualizar,
      convenioEnEjecucion,
      beneficiarios,
      inactivos,
    }
  }

  /** Genera un workbook Excel (.xlsx) con dos hojas: "Activos" e "Inactivos",
   *  basado en la partición de `getBeneficiariosProyecto`. Devuelve un Buffer
   *  que el controller pasa al cliente como descarga. */
  async getReporteBeneficiariosBuffer(email: string, proyectoId: number, perfilId?: number): Promise<Buffer> {
    const data = await this.getBeneficiariosProyecto(email, proyectoId, perfilId)
    const headers = ['N°', 'Tipo de Documento', 'Identificación', 'Nombre del Beneficiario', 'Estado', 'AFs / Grupos']
    const filasActivos: Array<Array<string | number>> = [headers]
    for (const b of data.beneficiarios ?? []) {
      filasActivos.push([
        b.nro,
        b.tipoDocumento ?? '',
        b.identificacion ?? '',
        b.nombreCompleto ?? '',
        b.estado ?? '',
        b.afsGrupos.join(' | '),
      ])
    }
    const filasInactivos: Array<Array<string | number>> = [headers]
    for (const b of data.inactivos ?? []) {
      filasInactivos.push([
        b.nro,
        b.tipoDocumento ?? '',
        b.identificacion ?? '',
        b.nombreCompleto ?? '',
        b.estado ?? '',
        b.afsGrupos.join(' | '),
      ])
    }
    const wb = XLSX.utils.book_new()
    const wsA = XLSX.utils.aoa_to_sheet(filasActivos)
    const wsI = XLSX.utils.aoa_to_sheet(filasInactivos)
    // Anchos razonables
    const cols = [{ wch: 5 }, { wch: 22 }, { wch: 16 }, { wch: 36 }, { wch: 12 }, { wch: 50 }]
    ;(wsA as { [k: string]: unknown })['!cols'] = cols
    ;(wsI as { [k: string]: unknown })['!cols'] = cols
    XLSX.utils.book_append_sheet(wb, wsA, 'Activos')
    XLSX.utils.book_append_sheet(wb, wsI, 'Inactivos')
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer
  }

  // ── Empresas beneficiarias (catálogo) ─────────────────────────────────────
  //
  // BENEFICIARIOEMPRESA es un catálogo global (no por proyecto). Una empresa
  // se identifica por (tipoDocumento, número). Aquí garantizamos que NO se
  // dupliquen: al "registrar" se actualiza si ya existe, o se crea si no.

  /** Lista todas las empresas beneficiarias, deduplicadas por (tipoDoc, número)
   *  quedándose con el registro de menor id (el "original"). */
  async listarEmpresasBeneficiarias() {
    const rows: Array<{
      id: number; tipoDocumentoId: number; tipoDocumento: string | null
      numero: string | null; digitoVerificacion: string | null
      nombre: string | null; tamanoEmpresaId: number | null; tamanoEmpresa: string | null
      fecha: string | null
    }> = await this.dataSource.query(
      `SELECT be.BENEFICIARIOEMPRESAID            AS "id",
              be.TIPODOCUMENTOIDENTIDADID         AS "tipoDocumentoId",
              TRIM(td.TIPODOCUMENTOIDENTIDADNOMBRE) AS "tipoDocumento",
              TRIM(be.BENEFICIARIOEMPRESANUMERO)  AS "numero",
              TRIM(be.BENEFICIARIOEMPRESADIGITOVERI) AS "digitoVerificacion",
              TRIM(be.BENEFICIARIOEMPRESANOMBRE)  AS "nombre",
              be.TAMANOEMPRESAID                  AS "tamanoEmpresaId",
              TRIM(te.TAMANOEMPRESANOMBRE)        AS "tamanoEmpresa",
              be.BENEFICIARIOEMPRESAFECHA         AS "fecha"
         FROM BENEFICIARIOEMPRESA be
         LEFT JOIN TIPODOCUMENTOIDENTIDAD td ON td.TIPODOCUMENTOIDENTIDADID = be.TIPODOCUMENTOIDENTIDADID
         LEFT JOIN TAMANOEMPRESA te ON te.TAMANOEMPRESAID = be.TAMANOEMPRESAID
        ORDER BY be.BENEFICIARIOEMPRESAID ASC`,
    )
    // Dedup por (tipoDocId|numero) — primer registro (menor id) gana.
    const vistos = new Set<string>()
    const out: typeof rows = []
    for (const r of rows) {
      const k = `${r.tipoDocumentoId}|${(r.numero ?? '').trim()}`
      if (vistos.has(k)) continue
      vistos.add(k)
      out.push(r)
    }
    return out
  }

  /** Busca una empresa beneficiaria por (tipoDoc, número). Devuelve el
   *  registro de menor id o null si no existe. */
  async buscarEmpresaBeneficiaria(tipoDocumentoId: number, numero: string) {
    const num = (numero ?? '').trim()
    if (!tipoDocumentoId || !num) return null
    const [row] = await this.dataSource.query(
      `SELECT be.BENEFICIARIOEMPRESAID            AS "id",
              be.TIPODOCUMENTOIDENTIDADID         AS "tipoDocumentoId",
              TRIM(td.TIPODOCUMENTOIDENTIDADNOMBRE) AS "tipoDocumento",
              TRIM(be.BENEFICIARIOEMPRESANUMERO)  AS "numero",
              TRIM(be.BENEFICIARIOEMPRESADIGITOVERI) AS "digitoVerificacion",
              TRIM(be.BENEFICIARIOEMPRESANOMBRE)  AS "nombre",
              be.TAMANOEMPRESAID                  AS "tamanoEmpresaId",
              TRIM(te.TAMANOEMPRESANOMBRE)        AS "tamanoEmpresa"
         FROM BENEFICIARIOEMPRESA be
         LEFT JOIN TIPODOCUMENTOIDENTIDAD td ON td.TIPODOCUMENTOIDENTIDADID = be.TIPODOCUMENTOIDENTIDADID
         LEFT JOIN TAMANOEMPRESA te ON te.TAMANOEMPRESAID = be.TAMANOEMPRESAID
        WHERE be.TIPODOCUMENTOIDENTIDADID = :1
          AND TRIM(be.BENEFICIARIOEMPRESANUMERO) = :2
        ORDER BY be.BENEFICIARIOEMPRESAID ASC
        FETCH FIRST 1 ROW ONLY`,
      [tipoDocumentoId, num],
    )
    return row ?? null
  }

  /** Crea o actualiza una empresa beneficiaria. Si ya existe una con la misma
   *  (tipoDoc, número), actualiza el registro de menor id (no crea otro). */
  async guardarEmpresaBeneficiaria(dto: EmpresaBeneficiariaDto): Promise<{ mensaje: string; accion: 'creada' | 'actualizada'; empresaId: number }> {
    if (!dto.tipoDocumentoId) throw new BadRequestException('Seleccione el tipo de identificación.')
    const num = (dto.numero ?? '').trim()
    if (!num) throw new BadRequestException('Ingrese el número de identificación.')
    if (!(dto.nombre ?? '').trim()) throw new BadRequestException('Ingrese el nombre de la empresa.')
    if (!dto.tamanoEmpresaId) throw new BadRequestException('Seleccione el tamaño de la empresa.')

    const existente = await this.buscarEmpresaBeneficiaria(dto.tipoDocumentoId, num)
    if (existente) {
      await this.dataSource.query(
        `UPDATE BENEFICIARIOEMPRESA
            SET BENEFICIARIOEMPRESANOMBRE     = :1,
                BENEFICIARIOEMPRESADIGITOVERI = :2,
                TAMANOEMPRESAID               = :3
          WHERE BENEFICIARIOEMPRESAID = :4`,
        [dto.nombre.trim().slice(0, 200), (dto.digitoVerificacion ?? '').toString().trim() || null, dto.tamanoEmpresaId, existente.id],
      )
      return { mensaje: 'Empresa beneficiaria actualizada', accion: 'actualizada', empresaId: Number(existente.id) }
    }
    // Nuevo registro. ID con NVL(MAX)+1 (la tabla no parece tener secuencia).
    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(BENEFICIARIOEMPRESAID), 0) + 1 AS "nid" FROM BENEFICIARIOEMPRESA`,
    )
    await this.dataSource.query(
      `INSERT INTO BENEFICIARIOEMPRESA
         (BENEFICIARIOEMPRESAID, TIPODOCUMENTOIDENTIDADID, BENEFICIARIOEMPRESANUMERO,
          BENEFICIARIOEMPRESADIGITOVERI, BENEFICIARIOEMPRESANOMBRE, TAMANOEMPRESAID,
          BENEFICIARIOEMPRESAFECHA)
       VALUES (:1, :2, :3, :4, :5, :6, SYSDATE)`,
      [Number(nid), dto.tipoDocumentoId, num,
       (dto.digitoVerificacion ?? '').toString().trim() || null,
       dto.nombre.trim().slice(0, 200), dto.tamanoEmpresaId],
    )
    return { mensaje: 'Empresa beneficiaria registrada exitosamente', accion: 'creada', empresaId: Number(nid) }
  }

  // ── Catálogos para el módulo de beneficiarios ─────────────────────────────

  /** Catálogos requeridos por la página de Registrar Beneficiario:
   *  géneros, caracterizaciones, niveles ocupacionales, perfiles de
   *  transferencia y rangos de edad. Todo en un solo call para minimizar
   *  round-trips del front. */
  async getCatalogosBeneficiario() {
    const [generos, caracterizaciones, niveles, perfilesTransf, rangosEdad, departamentos] = await Promise.all([
      this.dataSource.query(
        `SELECT GENEROID AS "id", TRIM(GENERONOMBRE) AS "nombre"
           FROM GENERO ORDER BY GENEROID`,
      ),
      this.dataSource.query(
        `SELECT CARACTERIZACIONID AS "id", TRIM(CARACTERIZACIONNOMBRE) AS "nombre"
           FROM CARACTERIZACION WHERE CARACTERIZACIONESTADO = 1 OR CARACTERIZACIONESTADO IS NULL
           ORDER BY CARACTERIZACIONID`,
      ).catch(() => this.dataSource.query(
        `SELECT CARACTERIZACIONID AS "id", TRIM(CARACTERIZACIONNOMBRE) AS "nombre"
           FROM CARACTERIZACION ORDER BY CARACTERIZACIONID`,
      )),
      this.dataSource.query(
        `SELECT NIVELOCUPACIONALID AS "id", TRIM(NIVELOCUPACIONALNOMBRE) AS "nombre"
           FROM NIVELOCUPACIONAL WHERE NIVELOCUPACIONALESTADO = 1
           ORDER BY NIVELOCUPACIONALID`,
      ),
      this.dataSource.query(
        `SELECT PERFILTRASFERENCIAID AS "id", TRIM(PERFILTRASFERENCIANOMBRE) AS "nombre"
           FROM PERFILTRASFERENCIA ORDER BY PERFILTRASFERENCIAID`,
      ).catch(() => []),
      this.dataSource.query(
        `SELECT RANGOEDADID AS "id", TRIM(RANGOEDADNOMBRE) AS "nombre"
           FROM RANGOEDAD ORDER BY RANGOEDADID`,
      ),
      this.dataSource.query(
        `SELECT DEPARTAMENTOID AS "id", TRIM(DEPARTAMENTONOMBRE) AS "nombre"
           FROM DEPARTAMENTO ORDER BY TRIM(DEPARTAMENTONOMBRE) ASC`,
      ),
    ])
    return { generos, caracterizaciones, niveles, perfilesTransf, rangosEdad, departamentos }
  }

  // ── Asociar beneficiario a grupos (AFGRUPOBENEFICIARIO) ──────────────────

  /** Lista las acciones de formación del proyecto con sus grupos y marca cuáles
   *  ya tienen asociada a la persona (estado ACTIVO). El frontend pinta una
   *  matriz tipo "AF × Grupo" para que el usuario marque/desmarque. */
  async getAccionesYGrupos(email: string, proyectoId: number, personaId: number) {
    await this.getDetalleConvenio(email, proyectoId)

    // 1) AFs del proyecto. Incluimos el flag de transferencia para que el
    //    front pueda mostrarlo (no filtramos: un beneficiario marcado como
    //    "agente de transferencia" sí puede ir a AFs de transferencia).
    const acciones: Array<{
      afId: number; numero: number | null; nombre: string | null
      transferencia: number | null
    }> = await this.dataSource.query(
      `SELECT ACCIONFORMACIONID                       AS "afId",
              ACCIONFORMACIONNUMERO                   AS "numero",
              TRIM(ACCIONFORMACIONNOMBRE)             AS "nombre",
              NVL(ACCIONFORMACIONTRANSFERENCIA, 0)    AS "transferencia"
         FROM ACCIONFORMACION
        WHERE PROYECTOID = :1
        ORDER BY ACCIONFORMACIONNUMERO`,
      [proyectoId],
    )

    // 2) Grupos de cada AF.
    const afIds = acciones.map(a => a.afId)
    let grupos: Array<{ afId: number; afGrupoId: number; numero: number | null }> = []
    if (afIds.length) {
      grupos = await this.dataSource.query(
        `SELECT g.ACCIONFORMACIONID AS "afId",
                g.AFGRUPOID         AS "afGrupoId",
                g.AFGRUPONUMERO     AS "numero"
           FROM AFGRUPO g
          WHERE g.ACCIONFORMACIONID IN (${afIds.map((_, i) => `:${i + 1}`).join(',')})
          ORDER BY g.AFGRUPONUMERO`,
        afIds,
      )
    }

    // 3) Asociaciones actuales de esta persona en cualquier grupo del proyecto.
    const asociaciones: Array<{
      afGrupoBeneficiarioId: number; afGrupoId: number; afId: number
      estado: string | null; ano: number | null
    }> = await this.dataSource.query(
      `SELECT agb.AFGRUPOBENEFICIARIOID  AS "afGrupoBeneficiarioId",
              agb.AFGRUPOID              AS "afGrupoId",
              g.ACCIONFORMACIONID        AS "afId",
              TRIM(agb.AFGRUPOBENEESTADO) AS "estado",
              agb.POSTULACIONANO         AS "ano"
         FROM AFGRUPOBENEFICIARIO agb
         JOIN AFGRUPO g          ON g.AFGRUPOID = agb.AFGRUPOID
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
        WHERE af.PROYECTOID = :1 AND agb.PERSONAID = :2`,
      [proyectoId, Number(personaId)],
    )

    // 4) Armar respuesta: por AF, lista de grupos con flag "asociado".
    const asocByGrupo = new Map<number, typeof asociaciones[number]>()
    for (const a of asociaciones) asocByGrupo.set(Number(a.afGrupoId), a)

    return {
      acciones: acciones.map(af => ({
        ...af,
        grupos: grupos
          .filter(g => g.afId === af.afId)
          .map(g => {
            const asoc = asocByGrupo.get(Number(g.afGrupoId))
            return {
              afGrupoId: g.afGrupoId,
              numero: g.numero,
              afGrupoBeneficiarioId: asoc?.afGrupoBeneficiarioId ?? null,
              estado: asoc?.estado ?? null,
              ano: asoc?.ano ?? null,
            }
          }),
      })),
    }
  }

  /** Asocia la persona a un grupo de AF. Valida:
   *   1. El grupo pertenece al proyecto.
   *   2. La persona tiene postulación vigente.
   *   3. La persona NO está ya activa en otro grupo de la misma AF
   *      (regla del legacy: una persona solo va en un grupo por AF).
   *   4. Los beneficiarios "repetidos" (los que participan en más de una AF
   *      del proyecto) no superan el 5% del total de beneficiarios. */
  async asociarBeneficiarioAGrupo(email: string, proyectoId: number, personaId: number, afGrupoId: number) {
    await this.getDetalleConvenio(email, proyectoId)
    await this.assertConvenioEnEjecucion(proyectoId)
    if (!personaId) throw new BadRequestException('Falta personaId.')
    if (!afGrupoId) throw new BadRequestException('Selecciona el grupo.')

    // 1) Validar que el grupo pertenezca al proyecto y resolver su AF.
    const [g] = await this.dataSource.query(
      `SELECT g.AFGRUPOID         AS "id",
              g.ACCIONFORMACIONID AS "afId",
              af.ACCIONFORMACIONNUMERO AS "afNumero"
         FROM AFGRUPO g
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
        WHERE g.AFGRUPOID = :1 AND af.PROYECTOID = :2 FETCH FIRST 1 ROW ONLY`,
      [Number(afGrupoId), proyectoId],
    )
    if (!g) throw new BadRequestException('El grupo no pertenece al proyecto.')

    // 2) Validar que la persona tenga postulación al año vigente.
    const ano = new Date().getFullYear()
    const [postu] = await this.dataSource.query(
      `SELECT 1 AS "x" FROM POSTULACION WHERE PERSONAID = :1 AND POSTULACIONANO = :2 FETCH FIRST 1 ROW ONLY`,
      [Number(personaId), ano],
    )
    if (!postu) throw new BadRequestException('La persona no tiene postulación vigente. Diligénciala antes de asociarla.')

    // 3) Regla: una persona solo puede estar en UN grupo por AF. Si ya está
    //    en otro grupo de la misma AF (activo), bloqueamos.
    const [yaEnAF] = await this.dataSource.query(
      `SELECT agb.AFGRUPOBENEFICIARIOID AS "id",
              g2.AFGRUPONUMERO          AS "grupoNumero"
         FROM AFGRUPOBENEFICIARIO agb
         JOIN AFGRUPO g2 ON g2.AFGRUPOID = agb.AFGRUPOID
        WHERE g2.ACCIONFORMACIONID = :1
          AND agb.PERSONAID = :2
          AND TRIM(agb.AFGRUPOBENEESTADO) = 'ACTIVO'
        FETCH FIRST 1 ROW ONLY`,
      [Number(g.afId), Number(personaId)],
    )
    if (yaEnAF) {
      // Si es exactamente el mismo grupo, lo informamos como "ya estaba".
      if (Number(yaEnAF.id) && Number(g.id) === Number(afGrupoId)) {
        const [mismo] = await this.dataSource.query(
          `SELECT AFGRUPOBENEFICIARIOID AS "id" FROM AFGRUPOBENEFICIARIO
            WHERE AFGRUPOID = :1 AND PERSONAID = :2 AND TRIM(AFGRUPOBENEESTADO) = 'ACTIVO'
            FETCH FIRST 1 ROW ONLY`,
          [Number(afGrupoId), Number(personaId)],
        )
        if (mismo) return { mensaje: 'La persona ya estaba asociada a este grupo.', afGrupoBeneficiarioId: Number(mismo.id), sinCambios: true }
      }
      throw new BadRequestException(
        `Esta persona ya está activa en el Grupo ${yaEnAF.grupoNumero ?? '?'} de la AF ${g.afNumero ?? '?'}. `
        + `Una persona solo puede estar en un grupo por acción de formación.`,
      )
    }

    // 4) Regla del 5% — aplica cuando esta asociación deja a la persona
    //    en >=2 AFs (es decir, ya estaba en alguna AF antes). Si era nueva
    //    al proyecto (0 → 1) no afecta el conteo de repetidos.
    const conteos: Array<{ personaId: number; afsDistintas: number }> = await this.dataSource.query(
      `SELECT agb.PERSONAID                       AS "personaId",
              COUNT(DISTINCT af.ACCIONFORMACIONID) AS "afsDistintas"
         FROM AFGRUPOBENEFICIARIO agb
         JOIN AFGRUPO g  ON g.AFGRUPOID = agb.AFGRUPOID
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
        WHERE af.PROYECTOID = :1
          AND TRIM(agb.AFGRUPOBENEESTADO) = 'ACTIVO'
        GROUP BY agb.PERSONAID`,
      [proyectoId],
    )
    const yaEra = Number(conteos.find(c => Number(c.personaId) === Number(personaId))?.afsDistintas) || 0
    if (yaEra >= 1) {
      // La persona ya estaba en al menos una AF → con este insert pasaría a
      //  estar en >=2 AFs (repetida). Verificar la cuota del proyecto.
      const total = conteos.length // total de personas activas en el proyecto (no cambia)
      const repetidosActuales = conteos.filter(c => Number(c.afsDistintas) >= 2).length
      // Si la persona aún no era repetida (estaba en 1), suma 1; si ya lo era, el conteo no cambia.
      const repetidosDespues = yaEra === 1 ? repetidosActuales + 1 : repetidosActuales
      if (total > 0 && repetidosDespues / total > 0.05) {
        const maxPerm = Math.floor(total * 0.05)
        throw new BadRequestException(
          `No se puede asociar a otra acción de formación: el proyecto superaría el 5% de beneficiarios repetidos `
          + `(quedarían ${repetidosDespues} de ${total} = ${Math.round((repetidosDespues / total) * 1000) / 10}%). `
          + `Máximo permitido: ${maxPerm} beneficiario${maxPerm === 1 ? '' : 's'} repetido${maxPerm === 1 ? '' : 's'}.`,
        )
      }
    }

    // 5) Upsert: si ya existe una fila para (persona, grupo) — sin importar
    //    si está RETIRADO/PENDIENTE/etc. — la re-activamos. Esto evita crear
    //    filas duplicadas cuando alguien vuelve a un grupo del que se retiró.
    const [existente] = await this.dataSource.query(
      `SELECT AFGRUPOBENEFICIARIOID AS "id",
              TRIM(AFGRUPOBENEESTADO) AS "estado"
         FROM AFGRUPOBENEFICIARIO
        WHERE PERSONAID = :1 AND AFGRUPOID = :2
        ORDER BY AFGRUPOBENEFICIARIOID DESC FETCH FIRST 1 ROW ONLY`,
      [Number(personaId), Number(afGrupoId)],
    )
    if (existente) {
      await this.dataSource.query(
        `UPDATE AFGRUPOBENEFICIARIO
            SET AFGRUPOBENEESTADO = 'ACTIVO',
                POSTULACIONANO    = :1,
                VALIDACIONINTERVENTOR = NVL(VALIDACIONINTERVENTOR, 'PENDIENTE')
          WHERE AFGRUPOBENEFICIARIOID = :2`,
        [ano, Number(existente.id)],
      )
      return {
        mensaje: (existente.estado ?? '').toUpperCase() === 'ACTIVO'
          ? 'La persona ya estaba activa en este grupo.'
          : 'Beneficiario re-activado en el grupo.',
        afGrupoBeneficiarioId: Number(existente.id),
        sinCambios: (existente.estado ?? '').toUpperCase() === 'ACTIVO',
      }
    }

    // 6) Si no existe, insertar fila nueva con defaults para NOT NULL.
    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(AFGRUPOBENEFICIARIOID), 0) + 1 AS "nid" FROM AFGRUPOBENEFICIARIO`,
    )
    await this.dataSource.query(
      `INSERT INTO AFGRUPOBENEFICIARIO
         (AFGRUPOBENEFICIARIOID, AFGRUPOID, PERSONAID, AFGRUPOBENEESTADO,
          AFGRUPOBENEFICIARIOFECHAREGIST, POSTULACIONANO, VALIDACIONINTERVENTOR,
          PORCENTAJECUMPLIMIENTO, NUMEROACTIVIDADES, CERTIFICA,
          HORASHIBRIDAS, HORASVIRTUALES, HORASPAT, HORASPRESENCIALES)
       VALUES (:1, :2, :3, 'ACTIVO', SYSDATE, :4, 'PENDIENTE',
               0, 0, 'NO', 0, 0, 0, 0)`,
      [Number(nid), Number(afGrupoId), Number(personaId), ano],
    )
    return { mensaje: 'Beneficiario asociado al grupo.', afGrupoBeneficiarioId: Number(nid), sinCambios: false }
  }

  /** Marca la asociación como RETIRADO (no se borra para mantener trazabilidad). */
  async removerBeneficiarioDeGrupo(email: string, proyectoId: number, afGrupoBeneficiarioId: number) {
    await this.getDetalleConvenio(email, proyectoId)
    await this.assertConvenioEnEjecucion(proyectoId)
    if (!afGrupoBeneficiarioId) throw new BadRequestException('Falta el id de la asociación.')

    // Validar que pertenezca al proyecto.
    const [a] = await this.dataSource.query(
      `SELECT agb.AFGRUPOBENEFICIARIOID AS "id"
         FROM AFGRUPOBENEFICIARIO agb
         JOIN AFGRUPO g          ON g.AFGRUPOID = agb.AFGRUPOID
         JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
        WHERE agb.AFGRUPOBENEFICIARIOID = :1 AND af.PROYECTOID = :2
        FETCH FIRST 1 ROW ONLY`,
      [Number(afGrupoBeneficiarioId), proyectoId],
    )
    if (!a) throw new NotFoundException('Asociación no encontrada en este proyecto.')

    await this.dataSource.query(
      `UPDATE AFGRUPOBENEFICIARIO SET AFGRUPOBENEESTADO = 'RETIRADO'
        WHERE AFGRUPOBENEFICIARIOID = :1`,
      [Number(afGrupoBeneficiarioId)],
    )
    return { mensaje: 'Asociación retirada.' }
  }

  /** Ciudades de un departamento — para el cascading del registrar beneficiario. */
  async getCiudadesPorDepartamento(departamentoId: number) {
    if (!departamentoId) return []
    return this.dataSource.query(
      `SELECT CIUDADID AS "id", TRIM(CIUDADNOMBRE) AS "nombre"
         FROM CIUDAD WHERE DEPARTAMENTOID = :1
        ORDER BY TRIM(CIUDADNOMBRE) ASC`,
      [Number(departamentoId)],
    )
  }

  // ── Beneficiario: persona + postulación ───────────────────────────────────

  /** Calcula RANGOEDADID a partir de la edad, replicando los rangos del
   *  legacy GeneXus. Esto se hace tanto en el front (para preview) como en
   *  el backend (al guardar, defensivo) para que siempre quede consistente. */
  private rangoEdadIdParaEdad(edad: number): number {
    if (edad <= 17) return 1
    if (edad <= 24) return 2
    if (edad <= 30) return 3
    if (edad <= 40) return 4
    if (edad <= 55) return 5
    return 6
  }

  private edadDesdeFecha(fechaIso: string | null | undefined): number {
    if (!fechaIso) return 0
    const f = new Date(fechaIso)
    if (isNaN(f.getTime())) return 0
    const hoy = new Date()
    let edad = hoy.getFullYear() - f.getFullYear()
    const m = hoy.getMonth() - f.getMonth()
    if (m < 0 || (m === 0 && hoy.getDate() < f.getDate())) edad--
    return Math.max(0, edad)
  }

  /** Busca la persona por (tipoDoc, identificación) y devuelve sus datos
   *  básicos + la postulación más reciente + el estado contra el año vigente.
   *  Año vigente = año actual del servidor (Bogotá ~UTC, fixed UTC en main).
   *
   *  Estados posibles:
   *    - 'sin-persona'   : no existe persona con ese documento.
   *    - 'sin-postulacion': existe persona pero nunca ha postulado.
   *    - 'desactualizada': existe postulación pero de un año anterior.
   *    - 'vigente'       : tiene postulación del año actual → puede asociarse.
   */
  async buscarPersonaConPostulacion(tipoDocumentoId: number, identificacion: string, proyectoId?: number) {
    if (!tipoDocumentoId || !(identificacion ?? '').trim()) {
      throw new BadRequestException('Faltan tipo de identificación y número.')
    }
    const ident = identificacion.trim()

    const [persona] = await this.dataSource.query(
      `SELECT p.PERSONAID                              AS "personaId",
              p.TIPODOCUMENTOIDENTIDADID               AS "tipoDocumentoId",
              TRIM(td.TIPODOCUMENTOIDENTIDADNOMBRE)    AS "tipoDocumento",
              TRIM(p.PERSONAIDENTIFICACION)            AS "identificacion",
              TRIM(p.PERSONANOMBRES)                   AS "nombres",
              TRIM(p.PERSONAPRIMERAPELLIDO)            AS "primerApellido",
              TRIM(p.PERSONASEGUNDOAPELLIDO)           AS "segundoApellido",
              p.GENEROID                               AS "generoId",
              p.PERSONAESTRATO                         AS "estratoId",
              p.PERSONAFECHANACIMIENTO                 AS "fechaNacimiento",
              TRIM(p.PERSONACELULAR)                   AS "celular",
              c.DEPARTAMENTOID                         AS "departamentoId",
              p.CIUDADID                               AS "ciudadId",
              TRIM(p.PERSONAEMAIL)                     AS "email",
              TRIM(p.PERSONABARRIO)                    AS "barrio",
              TRIM(p.PERSONADIRECCION)                 AS "direccion",
              TRIM(p.PERSONAHABEASDATA)                AS "habeasData"
         FROM PERSONA p
         LEFT JOIN TIPODOCUMENTOIDENTIDAD td ON td.TIPODOCUMENTOIDENTIDADID = p.TIPODOCUMENTOIDENTIDADID
         LEFT JOIN CIUDAD c ON c.CIUDADID = p.CIUDADID
        WHERE p.TIPODOCUMENTOIDENTIDADID = :1
          AND TRIM(p.PERSONAIDENTIFICACION) = :2
        FETCH FIRST 1 ROW ONLY`,
      [tipoDocumentoId, ident],
    )

    const anoVigente = new Date().getFullYear()

    if (!persona) {
      return { estado: 'sin-persona' as const, anoVigente, persona: null, postulacion: null }
    }

    // Postulación más reciente de esta persona + datos de la empresa
    // beneficiaria (para precargar la sección "Empresa donde labora").
    const [postu] = await this.dataSource.query(
      `SELECT po.PERSONAID                       AS "personaId",
              po.POSTULACIONANO                   AS "ano",
              TRIM(po.POSTULACIONANTIGUEDAD)      AS "antiguedad",
              po.BENEFICIARIOEMPRESAID            AS "beneficiarioEmpresaId",
              po.NIVELOCUPACIONALID               AS "nivelOcupacionalId",
              po.CARACTERIZACIONID                AS "caracterizacionId",
              po.PERFILTRASFERENCIAID             AS "perfilTrasferenciaId",
              TRIM(po.POSTULACIONTRASFERENCIA)    AS "postulacionTrasferencia",
              po.RANGOEDADID                      AS "rangoEdadId",
              po.IDEMPRESAP                       AS "empresaProponenteId",
              be.TIPODOCUMENTOIDENTIDADID         AS "empresaTipoDocumentoId",
              TRIM(tde.TIPODOCUMENTOIDENTIDADNOMBRE) AS "empresaTipoDocumento",
              TRIM(be.BENEFICIARIOEMPRESANUMERO)  AS "empresaNumero",
              TRIM(be.BENEFICIARIOEMPRESANOMBRE)  AS "empresaNombre",
              be.TAMANOEMPRESAID                  AS "tamanoEmpresaId",
              TRIM(te.TAMANOEMPRESANOMBRE)        AS "tamanoEmpresaNombre"
         FROM POSTULACION po
         LEFT JOIN BENEFICIARIOEMPRESA be ON be.BENEFICIARIOEMPRESAID = po.BENEFICIARIOEMPRESAID
         LEFT JOIN TIPODOCUMENTOIDENTIDAD tde ON tde.TIPODOCUMENTOIDENTIDADID = be.TIPODOCUMENTOIDENTIDADID
         LEFT JOIN TAMANOEMPRESA te ON te.TAMANOEMPRESAID = be.TAMANOEMPRESAID
        WHERE po.PERSONAID = :1
        ORDER BY po.POSTULACIONANO DESC
        FETCH FIRST 1 ROW ONLY`,
      [Number(persona.personaId)],
    )

    let estado: 'sin-postulacion' | 'desactualizada' | 'vigente'
    if (!postu) estado = 'sin-postulacion'
    else if (Number(postu.ano) === anoVigente) estado = 'vigente'
    else estado = 'desactualizada'

    // Conteo de asociaciones activas en este proyecto (para marcar el paso 3
    // como completo en el stepper del frontend).
    let asociacionesActivas = 0
    if (proyectoId && persona?.personaId) {
      const [c] = await this.dataSource.query(
        `SELECT COUNT(agb.AFGRUPOBENEFICIARIOID) AS "n"
           FROM AFGRUPOBENEFICIARIO agb
           JOIN AFGRUPO g          ON g.AFGRUPOID = agb.AFGRUPOID
           JOIN ACCIONFORMACION af ON af.ACCIONFORMACIONID = g.ACCIONFORMACIONID
          WHERE af.PROYECTOID = :1
            AND agb.PERSONAID = :2
            AND TRIM(agb.AFGRUPOBENEESTADO) = 'ACTIVO'`,
        [proyectoId, Number(persona.personaId)],
      )
      asociacionesActivas = Number(c?.n) || 0
    }

    return { estado, anoVigente, persona, postulacion: postu ?? null, asociacionesActivas }
  }

  /** Crea o actualiza una PERSONA con los datos extra que pide la postulación
   *  de beneficiario: género, estrato, fecha de nacimiento, departamento/ciudad,
   *  barrio, dirección, habeas data. Si `dto.personaId` viene, hace UPDATE;
   *  si no, busca por (tipoDoc, identificación) y si existe actualiza ese
   *  registro, en caso contrario crea una persona nueva.
   *
   *  Devuelve `{ personaId, accion }`. */
  async guardarPersonaBeneficiaria(email: string, _proyectoId: number, dto: PersonaBeneficiarioDto) {
    if (_proyectoId) await this.assertConvenioEnEjecucion(_proyectoId)
    // Validaciones mínimas.
    if (!dto.tipoDocumentoId)               throw new BadRequestException('Seleccione el tipo de identificación.')
    if (!(dto.identificacion ?? '').trim()) throw new BadRequestException('Ingrese el número de identificación.')
    if (!(dto.nombres ?? '').trim())        throw new BadRequestException('Ingrese los nombres.')
    if (!(dto.primerApellido ?? '').trim()) throw new BadRequestException('Ingrese el primer apellido.')
    if (!(dto.email ?? '').trim())          throw new BadRequestException('Ingrese el correo electrónico.')
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email.trim())
    if (!emailOk) throw new BadRequestException('El correo electrónico no es válido.')
    if (dto.estratoId != null && (Number(dto.estratoId) < 1 || Number(dto.estratoId) > 6)) {
      throw new BadRequestException('El estrato debe estar entre 1 y 6.')
    }
    // Garantizar que la sesión tiene empresa válida (proponente). El campo
    // no se guarda en PERSONA, pero validamos por consistencia con el flujo.
    await this.getEmpresaId(email)

    const ident = String(dto.identificacion).trim()
    const nombres = String(dto.nombres).trim()
    const primer  = String(dto.primerApellido).trim()
    const segundo = (dto.segundoApellido ?? '').trim() || null
    const correo  = String(dto.email).trim()
    const celular = (dto.celular ?? '').trim() || null
    const barrio  = (dto.barrio ?? '').trim() || null
    const direccion = (dto.direccion ?? '').trim() || null
    const habeas  = dto.habeasData ? 'SI' : 'NO'
    const fechaNac = (dto.fechaNacimiento ?? '').trim() || null  // YYYY-MM-DD

    // Resolver personaId destino: si vino, UPDATE; si no, busca por documento.
    let personaId: number | null = dto.personaId ? Number(dto.personaId) : null
    if (!personaId) {
      const [existente] = await this.dataSource.query(
        `SELECT PERSONAID AS "id" FROM PERSONA
          WHERE TIPODOCUMENTOIDENTIDADID = :1 AND TRIM(PERSONAIDENTIFICACION) = :2
          FETCH FIRST 1 ROW ONLY`,
        [Number(dto.tipoDocumentoId), ident],
      )
      if (existente) personaId = Number(existente.id)
    }

    if (personaId) {
      await this.dataSource.query(
        `UPDATE PERSONA
            SET TIPODOCUMENTOIDENTIDADID = :1,
                PERSONAIDENTIFICACION    = :2,
                PERSONANOMBRES           = :3,
                PERSONAPRIMERAPELLIDO    = :4,
                PERSONASEGUNDOAPELLIDO   = :5,
                GENEROID                 = :6,
                PERSONAESTRATO           = :7,
                PERSONAFECHANACIMIENTO   = CASE WHEN :8 IS NULL THEN NULL
                                                ELSE TO_DATE(:9, 'YYYY-MM-DD') END,
                PERSONACELULAR           = :10,
                CIUDADID                 = :11,
                PERSONAEMAIL             = :12,
                PERSONABARRIO            = :13,
                PERSONADIRECCION         = :14,
                PERSONAHABEASDATA        = :15
          WHERE PERSONAID = :16`,
        [
          Number(dto.tipoDocumentoId), ident, nombres, primer, segundo,
          dto.generoId  ? Number(dto.generoId)  : null,
          dto.estratoId ? Number(dto.estratoId) : null,
          fechaNac, fechaNac,
          celular,
          dto.ciudadId ? Number(dto.ciudadId) : null,
          correo, barrio, direccion, habeas,
          personaId,
        ],
      )
      return { mensaje: 'Persona actualizada', accion: 'actualizada' as const, personaId }
    }

    // Crear nueva persona.
    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(PERSONAID), 0) + 1 AS "nid" FROM PERSONA`,
    )
    personaId = Number(nid)
    await this.dataSource.query(
      `INSERT INTO PERSONA
         (PERSONAID, TIPODOCUMENTOIDENTIDADID, PERSONAIDENTIFICACION,
          PERSONANOMBRES, PERSONAPRIMERAPELLIDO, PERSONASEGUNDOAPELLIDO,
          GENEROID, PERSONAESTRATO, PERSONAFECHANACIMIENTO,
          PERSONACELULAR, CIUDADID,
          PERSONAEMAIL, PERSONABARRIO, PERSONADIRECCION,
          PERSONAHABEASDATA, PERSONAFECHAREGISTRO)
       VALUES (:1, :2, :3, :4, :5, :6, :7, :8,
               CASE WHEN :9 IS NULL THEN NULL ELSE TO_DATE(:10, 'YYYY-MM-DD') END,
               :11, :12, :13, :14, :15, :16, SYSDATE)`,
      [
        personaId, Number(dto.tipoDocumentoId), ident,
        nombres, primer, segundo,
        dto.generoId  ? Number(dto.generoId)  : null,
        dto.estratoId ? Number(dto.estratoId) : null,
        fechaNac, fechaNac,
        celular,
        dto.ciudadId ? Number(dto.ciudadId) : null,
        correo, barrio, direccion, habeas,
      ],
    )
    return { mensaje: 'Persona registrada exitosamente', accion: 'creada' as const, personaId }
  }

  /** Crea o actualiza la postulación del beneficiario. La PK lógica es
   *  (PERSONAID, POSTULACIONANO) — la guardamos al año vigente. Los datos
   *  de contacto se hardcodean al SENA / PFCE (igual que el legacy). */
  async guardarPostulacion(email: string, proyectoId: number, dto: PostulacionDto) {
    await this.assertConvenioEnEjecucion(proyectoId)
    // Empresa proponente del proyecto (para IDEMPRESAP).
    const empresaId = await this.getEmpresaId(email).catch(() => null)
    const [proy] = await this.dataSource.query(
      `SELECT EMPRESAID AS "empresaId" FROM PROYECTO WHERE PROYECTOID = :1`,
      [proyectoId],
    )
    if (!proy) throw new NotFoundException('Proyecto no encontrado')
    const empresaProponenteId = empresaId ?? Number(proy.empresaId)

    if (!dto.personaId) throw new BadRequestException('Falta personaId.')
    if (!dto.antiguedad || !['S', 'N', 'SI', 'NO'].includes(String(dto.antiguedad).trim().toUpperCase())) {
      throw new BadRequestException('Indica si la persona ya fue beneficiaria.')
    }
    if (!dto.beneficiarioEmpresaId) throw new BadRequestException('Falta empresa beneficiaria.')
    if (!dto.nivelOcupacionalId)    throw new BadRequestException('Falta nivel ocupacional.')
    if (!dto.caracterizacionId)     throw new BadRequestException('Falta caracterización.')
    if (!dto.perfilTrasferenciaId)  throw new BadRequestException('Falta perfil de transferencia.')
    if (!dto.postulacionTrasferencia) throw new BadRequestException('Indica si participará en transferencia.')

    // Normalizar antiguedad: el legacy guarda 'S'/'N' en NCHAR.
    const antig = String(dto.antiguedad).trim().toUpperCase().startsWith('S') ? 'S' : 'N'
    // Normalizar transferencia: el legacy guarda 'SI'/'NO' en NVARCHAR2.
    const transf = String(dto.postulacionTrasferencia).trim().toUpperCase().startsWith('S') ? 'SI' : 'NO'

    // Rango de edad: si el front lo manda, lo usamos; si no, lo calculamos
    // a partir de la fecha de nacimiento. Si nada, queda 0 (se rechaza abajo).
    let rangoEdadId = Number(dto.rangoEdadId) || 0
    if (!rangoEdadId && dto.fechaNacimiento) {
      const edad = this.edadDesdeFecha(dto.fechaNacimiento)
      if (edad > 0) rangoEdadId = this.rangoEdadIdParaEdad(edad)
    }
    if (!rangoEdadId) {
      // Si todavía no hay rango (persona sin fecha nacimiento valida), no
      // bloqueamos: lo dejamos en el último rango como fallback inocuo. El
      // editor de la persona debería forzar la fecha de nacimiento antes.
      rangoEdadId = 6
    }

    const ano = new Date().getFullYear()

    // Upsert por (personaId, ano).
    const [exist] = await this.dataSource.query(
      `SELECT 1 AS "x" FROM POSTULACION WHERE PERSONAID = :1 AND POSTULACIONANO = :2`,
      [Number(dto.personaId), ano],
    )

    const contacto = {
      nombre: 'SENA',
      dependencia: 'PFCE',
      telefono: '6015461500',
      email: 'pfce@sena.edu.co',
    }

    if (exist) {
      await this.dataSource.query(
        `UPDATE POSTULACION
            SET POSTULACIONANTIGUEDAD     = :1,
                BENEFICIARIOEMPRESAID     = :2,
                NIVELOCUPACIONALID        = :3,
                CARACTERIZACIONID         = :4,
                PERFILTRASFERENCIAID      = :5,
                POSTULACIONTRASFERENCIA   = :6,
                RANGOEDADID               = :7,
                IDEMPRESAP                = :8,
                POSTULACIONNOMBRECONTACTO = :9,
                POSTULACIONDEPENDENCIA    = :10,
                POSTULACIONTELEFONO       = :11,
                POSTULACIONEMAIL          = :12
          WHERE PERSONAID = :13 AND POSTULACIONANO = :14`,
        [antig, dto.beneficiarioEmpresaId, dto.nivelOcupacionalId, dto.caracterizacionId,
         dto.perfilTrasferenciaId, transf, rangoEdadId, empresaProponenteId,
         contacto.nombre, contacto.dependencia, contacto.telefono, contacto.email,
         Number(dto.personaId), ano],
      )
      return { mensaje: 'Postulación actualizada', accion: 'actualizada' as const, ano }
    }

    await this.dataSource.query(
      `INSERT INTO POSTULACION
         (PERSONAID, POSTULACIONANO, POSTULACIONANTIGUEDAD, BENEFICIARIOEMPRESAID,
          POSTULACIONNOMBRECONTACTO, POSTULACIONDEPENDENCIA, POSTULACIONTELEFONO, POSTULACIONEMAIL,
          NIVELOCUPACIONALID, CARACTERIZACIONID, PERFILTRASFERENCIAID, RANGOEDADID,
          POSTULACIONTRASFERENCIA, POSTULACIONHABEASDATA, POSTULACIONESTADO, POSTULACIONHABEASDATAE,
          IDEMPRESAP)
       VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, 'NO', 'ACTIVO', 'NO', :14)`,
      [Number(dto.personaId), ano, antig, dto.beneficiarioEmpresaId,
       contacto.nombre, contacto.dependencia, contacto.telefono, contacto.email,
       dto.nivelOcupacionalId, dto.caracterizacionId, dto.perfilTrasferenciaId, rangoEdadId,
       transf, empresaProponenteId],
    )
    return { mensaje: 'Postulación registrada exitosamente', accion: 'creada' as const, ano }
  }

  // ── Director del convenio (Fase 1) ────────────────────────────────────────

  /** Trae todos los directores asociados al proyecto: el ACTIVO y los
   *  inactivos (historial de cambios de director). El frontend pinta el
   *  activo arriba y el historial colapsable abajo.
   *
   *  Devuelve `{ activo, historial }`. Si nunca se ha registrado un director,
   *  ambos vienen vacíos. */
  async getDirectores(email: string, proyectoId: number, perfilId?: number) {
    // Validar acceso al convenio del proyecto.
    await this.getDetalleConvenio(email, proyectoId, perfilId)
    const all = await this.dataSource.query(
      `SELECT d.DIRECTORID                                  AS "directorId",
              d.PERSONAID                                   AS "personaId",
              d.PROYECTOID                                  AS "proyectoId",
              d.DIREFECHAREGISTRO                           AS "fechaRegistro",
              d.DIREFECHAACTUALIZACION                      AS "fechaActualizacion",
              TRIM(d.DIREESTADO)                            AS "estado",
              d.DIREOBSERVACION                             AS "observacion",
              TRIM(d.DIREINTERESTADO)                       AS "estadoInterventoria",
              d.DIREINTERFECHAACTUALIZACION                 AS "fechaInterventoria",
              d.DIRINTERPERSONAID                           AS "interventorPersonaId",
              TRIM(d.DIRECTORESRADISENA)                    AS "radicadoSena",
              d.DIRECTORESRADISENAFECHA                     AS "fechaRadicadoSena",
              TRIM(d.DIRECTORESRADIINTER)                   AS "radicadoInterventoria",
              d.DIRECTORESRADIINTERFECHA                    AS "fechaRadicadoInterventoria",
              TRIM(p.PERSONANOMBRES)                        AS "nombres",
              TRIM(p.PERSONAPRIMERAPELLIDO)                 AS "primerApellido",
              TRIM(p.PERSONASEGUNDOAPELLIDO)                AS "segundoApellido",
              TRIM(p.PERSONAIDENTIFICACION)                 AS "identificacion",
              p.TIPODOCUMENTOIDENTIDADID                    AS "tipoDocumentoId",
              TRIM(td.TIPODOCUMENTOIDENTIDADNOMBRE)         AS "tipoDocumento",
              TRIM(p.PERSONAEMAIL)                          AS "email",
              TRIM(p.PERSONACELULAR)                        AS "celular",
              TRIM(p.PERSONATELEFONO)                       AS "telefono",
              p.CIUDADID                                    AS "ciudadId",
              TRIM(c.CIUDADNOMBRE)                          AS "ciudad"
         FROM DIRECTORES d
         JOIN PERSONA p                       ON p.PERSONAID = d.PERSONAID
         LEFT JOIN TIPODOCUMENTOIDENTIDAD td  ON td.TIPODOCUMENTOIDENTIDADID = p.TIPODOCUMENTOIDENTIDADID
         LEFT JOIN CIUDAD c                   ON c.CIUDADID = p.CIUDADID
        WHERE d.PROYECTOID = :1
        ORDER BY
          CASE WHEN TRIM(d.DIREESTADO) = 'ACTIVO' THEN 0 ELSE 1 END,
          d.DIRECTORID DESC`,
      [proyectoId],
    )
    const activo = all.find((d: any) => (d.estado ?? '').trim() === 'ACTIVO') ?? null
    const historial = all.filter((d: any) => (d.estado ?? '').trim() !== 'ACTIVO')
    const [cvEstado] = await this.dataSource.query(
      `SELECT NVL(CONVENIOSESTADO, 0) AS "estado" FROM CONVENIOS
        WHERE PROYECTOID = :1 ORDER BY CONVENIOSID DESC FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )
    const convenioEnEjecucion = Number(cvEstado?.estado) === 1
    return { activo, historial, convenioEnEjecucion }
  }

  /** Crea un director básico para el convenio (perfil empresa). Si no existe
   *  una PERSONA con esa identificación, la crea; si ya existe, la reutiliza.
   *  Marca cualquier director previo como INACTIVO antes de insertar. */
  async crearDirector(email: string, proyectoId: number, dto: DirectorBasicoDto) {
    // Validar que existe convenio y que el usuario tiene acceso.
    await this.getDetalleConvenio(email, proyectoId)
    await this.assertConvenioEnEjecucion(proyectoId)

    // 1) Resolver PERSONA: si dto.personaId viene → usar; si no, buscar por identificación.
    let personaId: number | null = dto.personaId ? Number(dto.personaId) : null
    if (!personaId) {
      const [existente] = await this.dataSource.query(
        `SELECT PERSONAID AS "id" FROM PERSONA WHERE TRIM(PERSONAIDENTIFICACION) = :1
            AND TIPODOCUMENTOIDENTIDADID = :2 FETCH FIRST 1 ROW ONLY`,
        [String(dto.identificacion).trim(), Number(dto.tipoDocumentoId)],
      )
      if (existente) {
        personaId = Number(existente.id)
      } else {
        const [{ nid }] = await this.dataSource.query(
          `SELECT NVL(MAX(PERSONAID), 0) + 1 AS "nid" FROM PERSONA`,
        )
        personaId = Number(nid)
        await this.dataSource.query(
          `INSERT INTO PERSONA
             (PERSONAID, TIPODOCUMENTOIDENTIDADID, PERSONANOMBRES,
              PERSONAPRIMERAPELLIDO, PERSONASEGUNDOAPELLIDO, PERSONAIDENTIFICACION,
              PERSONAEMAIL, PERSONACELULAR, PERSONATELEFONO, CIUDADID,
              PERSONAFECHAREGISTRO)
           VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, SYSDATE)`,
          [
            personaId, Number(dto.tipoDocumentoId),
            (dto.nombres ?? '').trim(),
            (dto.primerApellido ?? '').trim(),
            (dto.segundoApellido ?? '').trim() || null,
            String(dto.identificacion).trim(),
            (dto.email ?? '').trim(),
            (dto.celular ?? '').trim() || null,
            (dto.telefono ?? '').trim() || null,
            dto.ciudadId ? Number(dto.ciudadId) : null,
          ],
        )
      }
    }

    // 2) Inactivar director ACTIVO previo si lo hay (un solo director activo).
    await this.dataSource.query(
      `UPDATE DIRECTORES SET DIREESTADO = 'INACTIVO',
                              DIREFECHAACTUALIZACION = SYSDATE
        WHERE PROYECTOID = :1 AND TRIM(DIREESTADO) = 'ACTIVO'`,
      [proyectoId],
    )

    // 3) Insertar nuevo director con estado interventoría PENDIENTE.
    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(DIRECTORID), 0) + 1 AS "nid" FROM DIRECTORES`,
    )
    await this.dataSource.query(
      `INSERT INTO DIRECTORES
         (DIRECTORID, PERSONAID, PROYECTOID,
          DIREFECHAREGISTRO, DIREFECHAACTUALIZACION,
          DIREESTADO, DIREINTERESTADO, DIREINTERFECHAACTUALIZACION)
       VALUES (:1, :2, :3, SYSDATE, SYSDATE, 'ACTIVO', 'PENDIENTE', SYSDATE)`,
      [Number(nid), Number(personaId), proyectoId],
    )

    return {
      message: 'Director registrado. Queda pendiente de aprobación por la interventoría.',
      directorId: Number(nid),
      personaId: Number(personaId),
    }
  }

  /** Asocia una PERSONA existente como director del convenio. Esta es la
   *  forma "moderna" de registrar director: primero se gestiona la persona
   *  en el módulo de Hojas de Vida (con todos sus datos y archivos) y luego
   *  se la asocia aquí. Inactiva el director ACTIVO previo si lo hay. */
  async asociarDirector(email: string, proyectoId: number, personaId: number) {
    await this.getDetalleConvenio(email, proyectoId)
    await this.assertConvenioEnEjecucion(proyectoId)
    const [pp] = await this.dataSource.query(
      `SELECT PERSONAID AS "id" FROM PERSONA WHERE PERSONAID = :1`,
      [Number(personaId)],
    )
    if (!pp) throw new NotFoundException('La persona no existe.')

    // No permitir asociar a la misma persona si ya está activa.
    const [ya] = await this.dataSource.query(
      `SELECT DIRECTORID AS "id" FROM DIRECTORES
        WHERE PROYECTOID = :1 AND PERSONAID = :2 AND TRIM(DIREESTADO) = 'ACTIVO'
        FETCH FIRST 1 ROW ONLY`,
      [proyectoId, Number(personaId)],
    )
    if (ya) {
      return {
        message: 'Esta persona ya está asociada como director ACTIVO del convenio.',
        directorId: Number(ya.id),
        personaId: Number(personaId),
        sinCambios: true,
      }
    }

    // Validar: la persona NO puede ser director APROBADO en otro proyecto
    // de la MISMA convocatoria (regla del legacy del SENA).
    const [conflicto] = await this.dataSource.query(
      `SELECT d.PROYECTOID                AS "proyectoId",
              TRIM(p.PROYECTONOMBRE)      AS "proyectoNombre"
         FROM DIRECTORES d
         JOIN PROYECTO p ON p.PROYECTOID = d.PROYECTOID
        WHERE d.PERSONAID = :1
          AND TRIM(d.DIREESTADO) = 'ACTIVO'
          AND TRIM(d.DIREINTERESTADO) = 'APROBADO'
          AND d.PROYECTOID <> :2
          AND p.CONVOCATORIAID = (
            SELECT CONVOCATORIAID FROM PROYECTO WHERE PROYECTOID = :3
          )
        FETCH FIRST 1 ROW ONLY`,
      [Number(personaId), proyectoId, proyectoId],
    )
    if (conflicto) {
      throw new BadRequestException(
        `Esta persona ya está aprobada como Director en otro proyecto de la misma convocatoria ` +
        `("${conflicto.proyectoNombre ?? '—'}", ID ${conflicto.proyectoId}). No se puede asociar a este proyecto.`,
      )
    }

    await this.dataSource.query(
      `UPDATE DIRECTORES SET DIREESTADO = 'INACTIVO',
                              DIREFECHAACTUALIZACION = SYSDATE
        WHERE PROYECTOID = :1 AND TRIM(DIREESTADO) = 'ACTIVO'`,
      [proyectoId],
    )
    const [{ nid }] = await this.dataSource.query(
      `SELECT NVL(MAX(DIRECTORID), 0) + 1 AS "nid" FROM DIRECTORES`,
    )
    await this.dataSource.query(
      `INSERT INTO DIRECTORES
         (DIRECTORID, PERSONAID, PROYECTOID,
          DIREFECHAREGISTRO, DIREFECHAACTUALIZACION,
          DIREESTADO, DIREINTERESTADO, DIREINTERFECHAACTUALIZACION)
       VALUES (:1, :2, :3, SYSDATE, SYSDATE, 'ACTIVO', 'PENDIENTE', SYSDATE)`,
      [Number(nid), Number(personaId), proyectoId],
    )
    return {
      message: 'Director asociado al convenio. Queda pendiente de aprobación por la interventoría.',
      directorId: Number(nid),
      personaId: Number(personaId),
    }
  }

  /** Aprueba o rechaza al director (solo interventor / coordinador interventoría). */
  async aprobarRechazarDirector(
    proyectoId: number,
    perfilId: number,
    aprobar: boolean,
    observacion: string | null,
    interventorPersonaId: number | null,
  ) {
    const INTERVENTOR = 11, COORD_INTERV = 10, ADMIN = 1
    if (perfilId !== INTERVENTOR && perfilId !== COORD_INTERV && perfilId !== ADMIN) {
      throw new ForbiddenException('Solo la interventoría puede aprobar o rechazar al director.')
    }
    // Verificar que el proyecto tenga convenio asociado (de lo contrario no
    // tiene sentido el flujo de director ↔ interventoría).
    const [conv] = await this.dataSource.query(
      `SELECT CONVENIOSID AS "id" FROM CONVENIOS WHERE PROYECTOID = :1
         FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )
    if (!conv) throw new NotFoundException('Este proyecto no tiene convenio.')
    const [dir] = await this.dataSource.query(
      `SELECT DIRECTORID AS "id" FROM DIRECTORES
        WHERE PROYECTOID = :1 AND TRIM(DIREESTADO) = 'ACTIVO'
        ORDER BY DIRECTORID DESC FETCH FIRST 1 ROW ONLY`,
      [proyectoId],
    )
    if (!dir) throw new BadRequestException('No hay director registrado para aprobar/rechazar.')
    const obsTrim = (observacion ?? '').trim()
    if (!aprobar && !obsTrim) {
      throw new BadRequestException('La observación es obligatoria al rechazar al director.')
    }
    await this.dataSource.query(
      `UPDATE DIRECTORES
          SET DIREINTERESTADO = :1,
              DIREOBSERVACION = :2,
              DIREINTERFECHAACTUALIZACION = SYSDATE,
              DIRINTERPERSONAID = :3
        WHERE DIRECTORID = :4`,
      [
        aprobar ? 'APROBADO' : 'RECHAZADO',
        obsTrim || null,
        interventorPersonaId ?? null,
        Number(dir.id),
      ],
    )
    return {
      message: aprobar
        ? 'Director aprobado por la interventoría.'
        : 'Director rechazado. El conviniente debe corregir y volver a registrar.',
      estadoInterventoria: aprobar ? 'APROBADO' : 'RECHAZADO',
    }
  }
}
