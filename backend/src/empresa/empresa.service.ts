import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { Empresa } from '../auth/entities/empresa.entity'
import { Usuario } from '../auth/entities/usuario.entity'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { twofish } = require('twofish')

// ── Twofish (mismo algoritmo que GeneXus) ────────────────────────────────────

function encrypt64(plainText: string, key: string): string {
  const tf = twofish(new Array(16).fill(0))
  const keyArr = Array.from(Buffer.from(key, 'hex')) as number[]
  const padded = Array.from(Buffer.from(plainText, 'utf8')) as number[]
  while (padded.length < 16) padded.push(0x20)
  return Buffer.from(tf.encrypt(keyArr, padded)).toString('base64')
}

// ── Raw-query helper: TRIM nchar ─────────────────────────────────────────────

@Injectable()
export class EmpresaService {
  constructor(
    @InjectRepository(Empresa)
    private readonly empresaRepo: Repository<Empresa>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Datos básicos completos ───────────────────────────────────────────────

  async getDatos(email: string) {
    // Empresa
    const [emp] = await this.dataSource.query(
      `SELECT
         e.EMPRESAID                AS "empresaId",
         e.TIPODOCUMENTOIDENTIDADID AS "tipoDocumentoIdentidadId",
         TRIM(tdi.TIPODOCUMENTOIDENTIDADNOMBRE) AS "tipoDocNombre",
         e.EMPRESAIDENTIFICACION    AS "empresaIdentificacion",
         e.EMPRESADIGITOVERIFICACION AS "empresaDigitoVerificacion",
         TRIM(e.EMPRESARAZONSOCIAL) AS "empresaRazonSocial",
         TRIM(e.EMPRESASIGLA)       AS "empresaSigla",
         e.EMPRESAEMAIL             AS "empresaEmail",
         e.EMPRESAFECHAREGISTRO     AS "empresaFechaRegistro",
         e.COBERTURAEMPRESAID       AS "coberturaEmpresaId",
         e.DEPARTAMENTOEMPRESAID    AS "departamentoEmpresaId",
         e.CIUDADEMPRESAID          AS "ciudadEmpresaId",
         TRIM(e.EMPRESADIRECCION)   AS "empresaDireccion",
         TRIM(e.EMPRESATELEFONO)    AS "empresaTelefono",
         TRIM(e.EMPRESACELULAR)     AS "empresaCelular",
         e.EMPRESAINDICATIVO        AS "empresaIndicativo",
         TRIM(e.EMPRESAWEBSITE)     AS "empresaWebsite",
         e.CIIUID                   AS "ciiuId",
         e.TIPOEMPRESAID            AS "tipoEmpresaId",
         e.TAMANOEMPRESAID          AS "tamanoEmpresaId",
         CASE WHEN e.EMPRESACERTIFCOMP = 1 THEN 'S' ELSE 'N' END AS "empresaCertifComp",
         CASE WHEN e.EMPRESAEXPERTTECN = 1 THEN 'S' ELSE 'N' END AS "empresaExpertTecn",
         e.TIPOIDENTIFICACIONREP    AS "tipoIdentificacionRep",
         TRIM(e.EMPRESAREPDOCUMENTO) AS "empresaRepDocumento",
         TRIM(e.EMPRESAREP)         AS "empresaRep",
         TRIM(e.EMPRESAREPCARGO)    AS "empresaRepCargo",
         TRIM(e.EMPRESAREPCORREO)   AS "empresaRepCorreo",
         TRIM(e.EMPRESAREPTEL)      AS "empresaRepTel"
       FROM EMPRESA e
       LEFT JOIN TIPODOCUMENTOIDENTIDAD tdi
              ON tdi.TIPODOCUMENTOIDENTIDADID = e.TIPODOCUMENTOIDENTIDADID
       WHERE e.EMPRESAEMAIL = :1
         AND ROWNUM = 1`,
      [email],
    )
    if (!emp) throw new NotFoundException('Empresa no encontrada')

    // Usuario (fecha registro + perfil)
    const [usr] = await this.dataSource.query(
      `SELECT u.USUARIOFECHAREGISTRO AS "fechaRegistro",
              TRIM(p.PERFILNOMBRE)   AS "perfilNombre"
         FROM USUARIO u
         JOIN PERFIL  p ON p.PERFILID = u.PERFILID
        WHERE u.USUARIOEMAIL = :1
          AND ROWNUM = 1`,
      [email],
    )

    // CIIU desc
    let ciiuDesc = ''
    if (emp.ciiuId) {
      try {
        const [c] = await this.dataSource.query(
          `SELECT TRIM(CIIUCODIGO) || ' - ' || TRIM(CIIUDESCRIPCION) AS "desc"
             FROM CIIU WHERE CIIUID = :1 AND ROWNUM = 1`,
          [emp.ciiuId],
        )
        ciiuDesc = c?.desc ?? ''
      } catch { /* tabla no encontrada */ }
    }

    return { ...emp, ...usr, ciiuDesc }
  }

  // ── Lookups ───────────────────────────────────────────────────────────────

  async getDepartamentos() {
    return this.dataSource.query(
      `SELECT DEPARTAMENTOID AS "id", TRIM(DEPARTAMENTONOMBRE) AS "nombre"
         FROM DEPARTAMENTO
        ORDER BY TRIM(DEPARTAMENTONOMBRE) ASC`,
    )
  }

  async getCiudades(departamentoId: number) {
    return this.dataSource.query(
      `SELECT CIUDADID AS "id", TRIM(CIUDADNOMBRE) AS "nombre"
         FROM CIUDAD
        WHERE DEPARTAMENTOID = :1
        ORDER BY TRIM(CIUDADNOMBRE) ASC`,
      [departamentoId],
    )
  }

  async getCoberturas() {
    try {
      return await this.dataSource.query(
        `SELECT COBERTURAID AS "id", TRIM(COBERTURADESCRIPCION) AS "nombre"
           FROM COBERTURA
          WHERE COBERTURAESTADO = 1
          ORDER BY COBERTURAID ASC`,
      )
    } catch { return [] }
  }

  async getCiiu(q: string) {
    try {
      return await this.dataSource.query(
        `SELECT CIIUID AS "id",
                TRIM(CIIUCODIGO) || ' - ' || TRIM(CIIUDESCRIPCION) AS "nombre"
           FROM CIIU
          WHERE UPPER(TRIM(CIIUCODIGO)) LIKE UPPER(:1)
             OR UPPER(TRIM(CIIUDESCRIPCION)) LIKE UPPER(:2)
          ORDER BY TRIM(CIIUCODIGO) ASC
          FETCH FIRST 30 ROWS ONLY`,
        [`%${q}%`, `%${q}%`],
      )
    } catch { return [] }
  }

  async getTiposOrganizacion() {
    try {
      return await this.dataSource.query(
        `SELECT TIPOEMPRESAID AS "id", TRIM(TIPOEMPRESANOMBRE) AS "nombre"
           FROM TIPOEMPRESA
          ORDER BY TIPOEMPRESAID ASC`,
      )
    } catch { return [] }
  }

  async getTamanosEmpresa() {
    try {
      return await this.dataSource.query(
        `SELECT TAMANOEMPRESAID AS "id", TRIM(TAMANOEMPRESANOMBRE) AS "nombre"
           FROM TAMANOEMPRESA
          ORDER BY TAMANOEMPRESAID ASC`,
      )
    } catch { return [] }
  }

  async getTiposDocumentoRep() {
    try {
      return await this.dataSource.query(
        `SELECT TIPODOCUMENTOIDENTIDADID AS "id",
                TRIM(TIPODOCUMENTOIDENTIDADNOMBRE) AS "nombre"
           FROM TIPODOCUMENTOIDENTIDAD
          WHERE TIPODOCUMENTOIDENTIDADPERSONA = 1
          ORDER BY TRIM(TIPODOCUMENTOIDENTIDADNOMBRE) ASC`,
      )
    } catch { return [] }
  }

  // ── Updates ───────────────────────────────────────────────────────────────

  async updateIdentificacion(email: string, dto: { empresaRazonSocial: string; empresaSigla: string }) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    await this.empresaRepo.update(empresa.empresaId, {
      empresaRazonSocial: dto.empresaRazonSocial.trim(),
      empresaSigla: (dto.empresaSigla ?? '').trim(),
    })
    return { message: 'Datos de identificación actualizados' }
  }

  async updateUbicacion(email: string, dto: {
    departamentoEmpresaId: number; ciudadEmpresaId: number; coberturaEmpresaId: number
    empresaDireccion: string; empresaTelefono?: string; empresaCelular: string
    empresaIndicativo?: number; empresaWebsite?: string
  }) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    await this.dataSource.query(
      `UPDATE EMPRESA SET
         DEPARTAMENTOEMPRESAID = :1,
         CIUDADEMPRESAID       = :2,
         COBERTURAEMPRESAID    = :3,
         EMPRESADIRECCION      = :4,
         EMPRESATELEFONO       = :5,
         EMPRESACELULAR        = :6,
         EMPRESAINDICATIVO     = :7,
         EMPRESAWEBSITE        = :8
       WHERE EMPRESAID = :9`,
      [
        dto.departamentoEmpresaId,
        dto.ciudadEmpresaId,
        dto.coberturaEmpresaId,
        (dto.empresaDireccion ?? '').trim(),
        (dto.empresaTelefono ?? '').trim(),
        (dto.empresaCelular ?? '').trim(),
        dto.empresaIndicativo ?? null,
        (dto.empresaWebsite ?? '').trim(),
        empresa.empresaId,
      ],
    )
    return { message: 'Datos de ubicación actualizados' }
  }

  async updateEconomicos(email: string, dto: {
    ciiuId: number; tipoEmpresaId: number; tamanoEmpresaId: number
    empresaCertifComp: string; empresaExpertTecn: string
  }) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    const ciiuId    = Number(dto.ciiuId)          || null
    const tipoId    = Number(dto.tipoEmpresaId)   || null
    const tamanoId  = Number(dto.tamanoEmpresaId) || null
    const certif    = String(dto.empresaCertifComp || 'N').trim() === 'S' ? 1 : 0
    const expert    = String(dto.empresaExpertTecn || 'N').trim() === 'S' ? 1 : 0
    try {
      await this.dataSource.query(
        `UPDATE EMPRESA SET
           CIIUID            = :1,
           TIPOEMPRESAID     = :2,
           TAMANOEMPRESAID   = :3,
           EMPRESACERTIFCOMP = :4,
           EMPRESAEXPERTTECN = :5
         WHERE EMPRESAID = :6`,
        [ciiuId, tipoId, tamanoId, certif, expert, empresa.empresaId],
      )
    } catch (e) {
      throw new BadRequestException(`Error Oracle: ${(e as Error).message}`)
    }
    return { message: 'Datos generales actualizados' }
  }

  async updateRepresentante(email: string, dto: {
    tipoIdentificacionRep: number; empresaRepDocumento: string; empresaRep: string
    empresaRepCargo: string; empresaRepCorreo: string; empresaRepTel: string
  }) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    await this.dataSource.query(
      `UPDATE EMPRESA SET
         TIPOIDENTIFICACIONREP = :1,
         EMPRESAREPDOCUMENTO   = :2,
         EMPRESAREP            = :3,
         EMPRESAREPCARGO       = :4,
         EMPRESAREPCORREO      = :5,
         EMPRESAREPTEL         = :6
       WHERE EMPRESAID = :7`,
      [
        dto.tipoIdentificacionRep,
        dto.empresaRepDocumento.trim(),
        dto.empresaRep.trim(),
        dto.empresaRepCargo.trim(),
        dto.empresaRepCorreo.trim(),
        dto.empresaRepTel.trim(),
        empresa.empresaId,
      ],
    )
    return { message: 'Datos del representante legal actualizados' }
  }

  async getAnalisis(email: string) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    try {
      const [row] = await this.dataSource.query(
        `SELECT EMPRESAOBJETO       AS "objeto",
                EMPRESAPRODUCTOS    AS "productos",
                EMPRESASITUACION    AS "situacion",
                EMPRESAPAPEL        AS "papel",
                EMPRESARETOS        AS "retos",
                EMPRESAEXPERIENCIA  AS "experiencia",
                EMPRESAESLABONES    AS "eslabones",
                EMPRESAINTERACCIONES AS "interacciones"
           FROM EMPRESA WHERE EMPRESAID = :1`,
        [empresa.empresaId],
      )
      return row ?? {}
    } catch (e) {
      throw new BadRequestException(`Error Oracle: ${(e as Error).message}`)
    }
  }

  async updateAnalisis(email: string, dto: {
    objeto?: string; productos?: string; situacion?: string
    papel?: string; retos?: string; experiencia?: string
    eslabones?: string; interacciones?: string
  }) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    try {
      await this.dataSource.query(
        `UPDATE EMPRESA SET
           EMPRESAOBJETO        = :1,
           EMPRESAPRODUCTOS     = :2,
           EMPRESASITUACION     = :3,
           EMPRESAPAPEL         = :4,
           EMPRESARETOS         = :5,
           EMPRESAEXPERIENCIA   = :6,
           EMPRESAESLABONES     = :7,
           EMPRESAINTERACCIONES = :8
         WHERE EMPRESAID = :9`,
        [
          dto.objeto        ?? null,
          dto.productos     ?? null,
          dto.situacion     ?? null,
          dto.papel         ?? null,
          dto.retos         ?? null,
          dto.experiencia   ?? null,
          dto.eslabones     ?? null,
          dto.interacciones ?? null,
          empresa.empresaId,
        ],
      )
      return { message: 'Análisis empresarial actualizado' }
    } catch (e) {
      throw new BadRequestException(`Error Oracle: ${(e as Error).message}`)
    }
  }

  async getMenu(perfilId: number) {
    const rows: Array<{ desc: string; url: string; icono: string }> = await this.dataSource.query(
      `SELECT TRIM(MENUXDESC)  AS "desc",
              TRIM(MENXURL)    AS "url",
              TRIM(MENUXICONO) AS "icono"
         FROM MENU
        WHERE MENXEST   = 'A'
          AND MENXPADRE = 0
          AND PERFILID  = :1
        ORDER BY MENUXPOSI ASC`,
      [perfilId],
    )
    return rows
  }

  async cambiarClave(email: string, nuevaClave: string) {
    if (!nuevaClave || nuevaClave.trim().length < 6) {
      throw new BadRequestException('La clave debe tener al menos 6 caracteres')
    }
    const usuario = await this.usuarioRepo.findOne({ where: { usuarioEmail: email } })
    if (!usuario) throw new NotFoundException('Usuario no encontrado')
    const claveEncriptada = encrypt64(nuevaClave, usuario.usuarioLlaveEncriptacion)
    await this.usuarioRepo.update(usuario.usuarioId, { usuarioClave: claveEncriptada })
    return { message: 'Contraseña actualizada correctamente' }
  }

  // ── Mesas Sectoriales ─────────────────────────────────────────────────────

  async getMesasSectoriales() {
    try {
      return await this.dataSource.query(
        `SELECT MESASECTORIALID AS "id",
                TRIM(MESASECTORIALNOMBRE) AS "nombre"
           FROM MESASECTORIAL
          ORDER BY TRIM(MESASECTORIALNOMBRE) ASC`,
      )
    } catch { return [] }
  }

  async getMesasEmpresa(email: string) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    try {
      return await this.dataSource.query(
        `SELECT ems.EMPRESAMESASECTORIALID AS "id",
                TRIM(ms.MESASECTORIALNOMBRE) AS "nombre"
           FROM EMPRESAMESASECTORIAL ems
           JOIN MESASECTORIAL ms ON ms.MESASECTORIALID = ems.MESASECTORIALIDEMPRESA
          WHERE ems.EMPRESAIDMESASECTORIAL = :1
          ORDER BY TRIM(ms.MESASECTORIALNOMBRE) ASC`,
        [empresa.empresaId],
      )
    } catch { return [] }
  }

  async registrarMesaEmpresa(email: string, mesaSectorialId: number) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    try {
      const existing = await this.dataSource.query(
        `SELECT EMPRESAMESASECTORIALID FROM EMPRESAMESASECTORIAL
          WHERE EMPRESAIDMESASECTORIAL = :1 AND MESASECTORIALIDEMPRESA = :2 AND ROWNUM = 1`,
        [empresa.empresaId, mesaSectorialId],
      )
      if (existing.length > 0) throw new ConflictException('La mesa ya está registrada para esta empresa')
      await this.dataSource.query(
        `INSERT INTO EMPRESAMESASECTORIAL (EMPRESAIDMESASECTORIAL, MESASECTORIALIDEMPRESA)
         VALUES (:1, :2)`,
        [empresa.empresaId, mesaSectorialId],
      )
      return { message: 'Mesa sectorial registrada' }
    } catch (e) {
      if (e instanceof ConflictException) throw e
      throw new BadRequestException(`Error Oracle: ${(e as Error).message}`)
    }
  }

  async eliminarMesaEmpresa(empresaMesaSectorialId: number) {
    try {
      await this.dataSource.query(
        `DELETE FROM EMPRESAMESASECTORIAL WHERE EMPRESAMESASECTORIALID = :1`,
        [empresaMesaSectorialId],
      )
      return { message: 'Mesa sectorial eliminada' }
    } catch (e) { throw new BadRequestException(`Error Oracle: ${(e as Error).message}`) }
  }

  // ── Sectores / Subsectores ────────────────────────────────────────────────

  async getSectores() {
    try {
      return await this.dataSource.query(
        `SELECT SECTORID AS "id", TRIM(SECTORDESCRIPCION) AS "nombre"
           FROM SECTOR ORDER BY TRIM(SECTORDESCRIPCION) ASC`,
      )
    } catch { return [] }
  }

  async getSubsectores() {
    try {
      return await this.dataSource.query(
        `SELECT SUBSECTORID AS "id", TRIM(SUBSECTORNOMBRE) AS "nombre"
           FROM SUBSECTOR ORDER BY TRIM(SUBSECTORNOMBRE) ASC`,
      )
    } catch { return [] }
  }

  // ── Sectores que PERTENECE ────────────────────────────────────────────────

  async getSectoresPertenece(email: string) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    try {
      return await this.dataSource.query(
        `SELECT sp.SECTORPEMPRESAID AS "id", TRIM(s.SECTORDESCRIPCION) AS "nombre"
           FROM SECTORPEMPRESA sp
           JOIN SECTOR s ON s.SECTORID = sp.SECTORIDPEMPRESA
          WHERE sp.EMPRESAIDPSECTOR = :1 ORDER BY TRIM(s.SECTORDESCRIPCION) ASC`,
        [empresa.empresaId],
      )
    } catch { return [] }
  }

  async registrarSectorPertenece(email: string, sectorId: number) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    try {
      const ex = await this.dataSource.query(
        `SELECT SECTORPEMPRESAID FROM SECTORPEMPRESA WHERE EMPRESAIDPSECTOR=:1 AND SECTORIDPEMPRESA=:2 AND ROWNUM=1`,
        [empresa.empresaId, sectorId],
      )
      if (ex.length > 0) throw new ConflictException('Sector ya registrado')
      await this.dataSource.query(
        `INSERT INTO SECTORPEMPRESA (EMPRESAIDPSECTOR, SECTORIDPEMPRESA) VALUES (:1,:2)`,
        [empresa.empresaId, sectorId],
      )
      return { message: 'Sector registrado' }
    } catch (e) {
      if (e instanceof ConflictException) throw e
      throw new BadRequestException(`Error Oracle: ${(e as Error).message}`)
    }
  }

  async eliminarSectorPertenece(id: number) {
    try {
      await this.dataSource.query(`DELETE FROM SECTORPEMPRESA WHERE SECTORPEMPRESAID=:1`, [id])
      return { message: 'Sector eliminado' }
    } catch (e) { throw new BadRequestException(`Error Oracle: ${(e as Error).message}`) }
  }

  // ── Subsectores que PERTENECE ─────────────────────────────────────────────

  async getSubsectoresPertenece(email: string) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    try {
      return await this.dataSource.query(
        `SELECT sp.SUBSECTORPEMPRESAID AS "id", TRIM(s.SUBSECTORNOMBRE) AS "nombre"
           FROM SUBSECTORPEMPRESA sp
           JOIN SUBSECTOR s ON s.SUBSECTORID = sp.SUBSECTORIDPEMPRESA
          WHERE sp.EMPRESAIDPSUBSECTOR = :1 ORDER BY TRIM(s.SUBSECTORNOMBRE) ASC`,
        [empresa.empresaId],
      )
    } catch { return [] }
  }

  async registrarSubsectorPertenece(email: string, subsectorId: number) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    try {
      const ex = await this.dataSource.query(
        `SELECT SUBSECTORPEMPRESAID FROM SUBSECTORPEMPRESA WHERE EMPRESAIDPSUBSECTOR=:1 AND SUBSECTORIDPEMPRESA=:2 AND ROWNUM=1`,
        [empresa.empresaId, subsectorId],
      )
      if (ex.length > 0) throw new ConflictException('Subsector ya registrado')
      await this.dataSource.query(
        `INSERT INTO SUBSECTORPEMPRESA (EMPRESAIDPSUBSECTOR, SUBSECTORIDPEMPRESA) VALUES (:1,:2)`,
        [empresa.empresaId, subsectorId],
      )
      return { message: 'Subsector registrado' }
    } catch (e) {
      if (e instanceof ConflictException) throw e
      throw new BadRequestException(`Error Oracle: ${(e as Error).message}`)
    }
  }

  async eliminarSubsectorPertenece(id: number) {
    try {
      await this.dataSource.query(`DELETE FROM SUBSECTORPEMPRESA WHERE SUBSECTORPEMPRESAID=:1`, [id])
      return { message: 'Subsector eliminado' }
    } catch (e) { throw new BadRequestException(`Error Oracle: ${(e as Error).message}`) }
  }

  // ── Sectores que REPRESENTA ───────────────────────────────────────────────

  async getSectoresRepresenta(email: string) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    try {
      return await this.dataSource.query(
        `SELECT se.SECTOREMPRESAID AS "id", TRIM(s.SECTORDESCRIPCION) AS "nombre"
           FROM SECTOREMPRESA se
           JOIN SECTOR s ON s.SECTORID = se.SECTORIDEMPRESA
          WHERE se.EMPRESAID = :1 ORDER BY TRIM(s.SECTORDESCRIPCION) ASC`,
        [empresa.empresaId],
      )
    } catch { return [] }
  }

  async registrarSectorRepresenta(email: string, sectorId: number) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    try {
      const ex = await this.dataSource.query(
        `SELECT SECTOREMPRESAID FROM SECTOREMPRESA WHERE EMPRESAID=:1 AND SECTORIDEMPRESA=:2 AND ROWNUM=1`,
        [empresa.empresaId, sectorId],
      )
      if (ex.length > 0) throw new ConflictException('Sector ya registrado')
      await this.dataSource.query(
        `INSERT INTO SECTOREMPRESA (EMPRESAID, SECTORIDEMPRESA) VALUES (:1,:2)`,
        [empresa.empresaId, sectorId],
      )
      return { message: 'Sector registrado' }
    } catch (e) {
      if (e instanceof ConflictException) throw e
      throw new BadRequestException(`Error Oracle: ${(e as Error).message}`)
    }
  }

  async eliminarSectorRepresenta(id: number) {
    try {
      await this.dataSource.query(`DELETE FROM SECTOREMPRESA WHERE SECTOREMPRESAID=:1`, [id])
      return { message: 'Sector eliminado' }
    } catch (e) { throw new BadRequestException(`Error Oracle: ${(e as Error).message}`) }
  }

  // ── Subsectores que REPRESENTA ────────────────────────────────────────────

  async getSubsectoresRepresenta(email: string) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    try {
      return await this.dataSource.query(
        `SELECT se.SUBSECTOREMPRESAID AS "id", TRIM(s.SUBSECTORNOMBRE) AS "nombre"
           FROM SUBSECTOREMPRESA se
           JOIN SUBSECTOR s ON s.SUBSECTORID = se.SUBSECTORIDEMPRESA
          WHERE se.EMPRESAID = :1 ORDER BY TRIM(s.SUBSECTORNOMBRE) ASC`,
        [empresa.empresaId],
      )
    } catch { return [] }
  }

  async registrarSubsectorRepresenta(email: string, subsectorId: number) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    try {
      const ex = await this.dataSource.query(
        `SELECT SUBSECTOREMPRESAID FROM SUBSECTOREMPRESA WHERE EMPRESAID=:1 AND SUBSECTORIDEMPRESA=:2 AND ROWNUM=1`,
        [empresa.empresaId, subsectorId],
      )
      if (ex.length > 0) throw new ConflictException('Subsector ya registrado')
      await this.dataSource.query(
        `INSERT INTO SUBSECTOREMPRESA (EMPRESAID, SUBSECTORIDEMPRESA) VALUES (:1,:2)`,
        [empresa.empresaId, subsectorId],
      )
      return { message: 'Subsector registrado' }
    } catch (e) {
      if (e instanceof ConflictException) throw e
      throw new BadRequestException(`Error Oracle: ${(e as Error).message}`)
    }
  }

  async eliminarSubsectorRepresenta(id: number) {
    try {
      await this.dataSource.query(`DELETE FROM SUBSECTOREMPRESA WHERE SUBSECTOREMPRESAID=:1`, [id])
      return { message: 'Subsector eliminado' }
    } catch (e) { throw new BadRequestException(`Error Oracle: ${(e as Error).message}`) }
  }

  /** Resumen para los badges del home del proponente: cuenta registros y
   *  estado de cada módulo (datos básicos, contactos, análisis, necesidades,
   *  proyectos por estado, convenios activos). */
  async getResumenPanel(email: string) {
    const empresa = await this.empresaRepo.findOne({ where: { empresaEmail: email } })
    if (!empresa) throw new NotFoundException('Empresa no encontrada')
    const empresaId = empresa.empresaId

    const [datos] = await this.dataSource.query(
      `SELECT TRIM(EMPRESARAZONSOCIAL) AS "rs",
              TRIM(EMPRESADIRECCION)   AS "dir",
              TRIM(EMPRESACELULAR)     AS "cel",
              DEPARTAMENTOEMPRESAID    AS "depto",
              CIUDADEMPRESAID          AS "ciu",
              COBERTURAEMPRESAID       AS "cob",
              CIIUID                   AS "ciiu",
              TIPOEMPRESAID            AS "tipoEmp",
              TAMANOEMPRESAID          AS "tamEmp",
              DBMS_LOB.GETLENGTH(EMPRESAOBJETO)    AS "lObj",
              DBMS_LOB.GETLENGTH(EMPRESAPRODUCTOS) AS "lProd",
              DBMS_LOB.GETLENGTH(EMPRESASITUACION) AS "lSit",
              DBMS_LOB.GETLENGTH(EMPRESARETOS)     AS "lRet"
         FROM EMPRESA WHERE EMPRESAID = :1`,
      [empresaId],
    )
    const datosCompleto = !!(datos?.rs && datos?.dir && datos?.cel
                          && datos?.depto && datos?.ciu && datos?.cob
                          && datos?.ciiu && datos?.tipoEmp && datos?.tamEmp)
    const analisisCompleto = !!(Number(datos?.lObj) > 0 && Number(datos?.lProd) > 0
                             && Number(datos?.lSit) > 0 && Number(datos?.lRet) > 0)

    const [contactos] = await this.dataSource.query(
      `SELECT COUNT(*) AS "C" FROM CONTACTOEMPRESA WHERE EMPRESAIDCONTACTO = :1`,
      [empresaId],
    )

    const [necesidades] = await this.dataSource.query(
      `SELECT COUNT(*) AS "C" FROM NECESIDAD WHERE EMPRESANECESIDADID = :1`,
      [empresaId],
    )

    const proyEstados: any[] = await this.dataSource.query(
      `SELECT NVL(PROYECTOESTADO, 0) AS "estado", COUNT(*) AS "C"
         FROM PROYECTO WHERE EMPRESAID = :1
        GROUP BY PROYECTOESTADO`,
      [empresaId],
    )
    const proyectos = { borrador: 0, confirmado: 0, aprobado: 0, rechazado: 0, total: 0 }
    for (const r of proyEstados) {
      const c = Number(r.C)
      proyectos.total += c
      if (Number(r.estado) === 0 || Number(r.estado) === 2) proyectos.borrador += c
      else if (Number(r.estado) === 1) proyectos.confirmado += c
      else if (Number(r.estado) === 3) proyectos.aprobado += c
      else if (Number(r.estado) === 4) proyectos.rechazado += c
    }

    const [convenios] = await this.dataSource.query(
      `SELECT COUNT(*) AS "C"
         FROM CONVENIOS c JOIN PROYECTO p ON p.PROYECTOID = c.PROYECTOID
        WHERE p.EMPRESAID = :1 AND c.CONVENIOSESTADO = 1`,
      [empresaId],
    )

    return {
      datos: { completo: datosCompleto },
      contactos: { total: Number(contactos?.C ?? 0) },
      analisis: { completo: analisisCompleto },
      necesidades: { total: Number(necesidades?.C ?? 0) },
      proyectos,
      convenios: { activos: Number(convenios?.C ?? 0) },
    }
  }
}
