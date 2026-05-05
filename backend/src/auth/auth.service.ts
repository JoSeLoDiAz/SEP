import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { JwtService } from '@nestjs/jwt'
import { DataSource, Repository } from 'typeorm'
import * as crypto from 'crypto'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { twofish } = require('twofish')
import { Usuario } from './entities/usuario.entity'
import { Empresa } from './entities/empresa.entity'
import { Persona } from './entities/persona.entity'
import { TipoDocumentoIdentidad } from './entities/tipo-documento.entity'
import { UsuarioPerfil } from './entities/usuario-perfil.entity'
import { LoginDto } from './dto/login.dto'
import { RegistrarEmpresaDto } from './dto/registrar-empresa.dto'
import { RegistrarPersonaDto } from './dto/registrar-persona.dto'
import { MailService } from './mail.service'

// Token en memoria: { email, expira }
interface ResetToken { email: string; expira: Date }

/**
 * Replica exacta de GeneXus GetEncryptionKey():
 * Genera 16 bytes aleatorios y los convierte a hex mayúsculas (32 chars).
 */
function getEncryptionKey(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase()
}

/**
 * Replica exacta de GeneXus Encrypt64(plainText, key):
 *   - Twofish-128 ECB
 *   - Key: hex-decoded 16 bytes (la llave es un string hex de 32 chars)
 *   - Padding: espacios (0x20) hasta 16 bytes
 *   - Output: Base64 standard
 */
function encrypt64(plainText: string, key: string): string {
  const tf = twofish(new Array(16).fill(0))
  const keyArr = Array.from(Buffer.from(key, 'hex')) as number[]
  const padded = Array.from(Buffer.from(plainText, 'utf8')) as number[]
  while (padded.length < 16) padded.push(0x20)
  return Buffer.from(tf.encrypt(keyArr, padded)).toString('base64')
}

/**
 * Replica exacta de GeneXus Decrypt64(encryptedBase64, key):
 *   - Twofish-128 ECB
 *   - Key: hex-decoded 16 bytes
 *   - Quita espacios finales (padding de GeneXus)
 */
function decrypt64(encryptedBase64: string, key: string): string {
  const tf = twofish(new Array(16).fill(0))
  const keyArr = Array.from(Buffer.from(key, 'hex')) as number[]
  const encArr = Array.from(Buffer.from(encryptedBase64, 'base64')) as number[]
  const decArr = tf.decrypt(keyArr, encArr) as number[]
  return Buffer.from(decArr).toString('utf8').trimEnd()
}

// Perfiles GeneXus → roles legibles
const PERFIL_ROLES: Record<number, string> = {
  1: 'administrador',
  2: 'gestor',
  3: 'gestor',
  4: 'financiera',
  5: 'juridica',
  6: 'tecnica',
  7: 'empresa',
  8: 'usuario',
  9: 'evaluador',
  10: 'interventor',
  11: 'interventor',
  12: 'gestor',
  13: 'gestor',
  14: 'gestor',
}

@Injectable()
export class AuthService {
  // Tokens de restablecimiento en memoria (TTL 30 min)
  private readonly resetTokens = new Map<string, ResetToken>()

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Empresa)
    private readonly empresaRepo: Repository<Empresa>,
    @InjectRepository(Persona)
    private readonly personaRepo: Repository<Persona>,
    @InjectRepository(TipoDocumentoIdentidad)
    private readonly tipoDocRepo: Repository<TipoDocumentoIdentidad>,
    @InjectRepository(UsuarioPerfil)
    private readonly usuarioPerfilRepo: Repository<UsuarioPerfil>,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

  private async resolverNombreUsuario(email: string, perfilId: number): Promise<string> {
    try {
      if (perfilId === 7) {
        const rows: Array<{ razon: string }> = await this.dataSource.query(
          `SELECT TRIM(EMPRESARAZONSOCIAL) AS "razon"
             FROM EMPRESA WHERE EMPRESAEMAIL = :1 AND ROWNUM = 1`,
          [email],
        )
        if (rows[0]?.razon) return rows[0].razon
      } else {
        const rows: Array<{ nombres: string; apellido: string }> = await this.dataSource.query(
          `SELECT TRIM(PERSONANOMBRES) AS "nombres",
                  TRIM(PERSONAPRIMERAPELLIDO) AS "apellido"
             FROM PERSONA WHERE PERSONAEMAIL = :1 AND ROWNUM = 1`,
          [email],
        )
        if (rows[0]?.nombres) return `${rows[0].nombres} ${rows[0].apellido}`.trim()
      }
    } catch { /* fallback al email */ }
    return email
  }

  /** Lista los perfiles activos del usuario con nombre y último acceso. */
  private async listarPerfilesActivos(usuarioId: number) {
    const rows: Array<{
      usuarioPerfilId: number
      perfilId: number
      perfilNombre: string
      predeterminado: number
      fechaUltimoAcceso: Date | null
    }> = await this.dataSource.query(
      `SELECT up.USUARIOPERFILID         AS "usuarioPerfilId",
              up.PERFILID                AS "perfilId",
              TRIM(p.PERFILNOMBRE)       AS "perfilNombre",
              up.PREDETERMINADO          AS "predeterminado",
              up.FECHAULTIMOACCESO       AS "fechaUltimoAcceso"
         FROM USUARIOPERFIL up
         JOIN PERFIL p ON p.PERFILID = up.PERFILID
        WHERE up.USUARIOID = :1
          AND up.ESTADO = 1
        ORDER BY up.PREDETERMINADO DESC, up.FECHAULTIMOACCESO DESC NULLS LAST, p.PERFILNOMBRE ASC`,
      [usuarioId],
    )
    return rows.map(r => ({
      ...r,
      predeterminado: Number(r.predeterminado) === 1,
    }))
  }

  private async marcarUltimoAcceso(usuarioPerfilId: number) {
    await this.dataSource.query(
      `UPDATE USUARIOPERFIL SET FECHAULTIMOACCESO = SYSTIMESTAMP WHERE USUARIOPERFILID = :1`,
      [usuarioPerfilId],
    )
  }

  /**
   * Verifica un token de Cloudflare Turnstile contra la API de Cloudflare.
   * Si TURNSTILE_SECRET no está configurado en .env, se permite el login
   * (modo desarrollo / testing). En produccion siempre debe estar.
   */
  private async verifyCaptcha(token?: string): Promise<void> {
    const secret = process.env.TURNSTILE_SECRET
    if (!secret) {
      // Sin secret configurado → omitir verificación (dev mode)
      return
    }
    if (!token) {
      throw new UnauthorizedException('Falta validación de captcha')
    }
    try {
      const body = new URLSearchParams({ secret, response: token })
      const res = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        { method: 'POST', body },
      )
      const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] }
      if (!data.success) {
        throw new UnauthorizedException('Captcha inválido o expirado')
      }
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e
      throw new UnauthorizedException('Error al verificar el captcha')
    }
  }

  async tiposDocumento(para: 'persona' | 'empresa') {
    const col =
      para === 'persona'
        ? 'TIPODOCUMENTOIDENTIDADPERSONA'
        : 'TIPODOCUMENTOIDENTIDADEMPRESA'

    // Raw query: TRIM() para quitar espacios de NCHAR, ORDER BY nombre ya trimeado
    const rows: Array<{ id: number; nombre: string }> = await this.dataSource.query(
      `SELECT TIPODOCUMENTOIDENTIDADID AS "id",
              TRIM(TIPODOCUMENTOIDENTIDADNOMBRE) AS "nombre"
         FROM TIPODOCUMENTOIDENTIDAD
        WHERE ${col} = 1
        ORDER BY TRIM(TIPODOCUMENTOIDENTIDADNOMBRE) ASC`,
    )
    return rows
  }

  async login(dto: LoginDto) {
    if (!dto.email || !dto.clave) {
      throw new BadRequestException('Correo y contraseña son requeridos')
    }

    await this.verifyCaptcha(dto.captchaToken)

    const usuario = await this.usuarioRepo.findOne({
      where: { usuarioEmail: dto.email },
    })

    // Mensaje unificado: no revelamos si el correo existe o si la contraseña
    // falló — mejor por seguridad y evita confundir al usuario.
    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas')
    }

    if (usuario.usuarioEstado === 0) {
      throw new UnauthorizedException('Usuario inactivo. Comuníquese con el administrador del sistema.')
    }

    // Desencriptar clave almacenada con la llave del usuario (mismo algoritmo GeneXus)
    let claveDesencriptada: string
    try {
      claveDesencriptada = decrypt64(
        usuario.usuarioClave,
        usuario.usuarioLlaveEncriptacion,
      )
    } catch {
      throw new UnauthorizedException('Credenciales inválidas')
    }

    if (claveDesencriptada !== dto.clave) {
      throw new UnauthorizedException('Credenciales inválidas')
    }

    const perfiles = await this.listarPerfilesActivos(usuario.usuarioId)

    // Si el usuario aún no tiene filas en USUARIOPERFIL (caso borde anterior a
    // la migración), usamos USUARIO.PERFILID como fallback.
    if (perfiles.length === 0) {
      return this.emitirTokenFinal(usuario, usuario.perfilId, undefined)
    }

    // Multirol: 2+ perfiles activos → emitimos preauthToken y dejamos al
    // frontend pedir la selección.
    if (perfiles.length > 1) {
      const preauthToken = this.jwtService.sign(
        {
          sub: usuario.usuarioId,
          email: usuario.usuarioEmail,
          scope: 'preauth',
        },
        { expiresIn: '5m' },
      )
      const nombre = await this.resolverNombreUsuario(usuario.usuarioEmail, perfiles[0].perfilId)
      return {
        multirol: true,
        preauthToken,
        usuario: {
          usuarioId: usuario.usuarioId,
          email: usuario.usuarioEmail,
          nombre,
        },
        perfiles,
      }
    }

    // Un solo perfil → JWT directo (flujo idéntico al anterior).
    const unico = perfiles[0]
    return this.emitirTokenFinal(usuario, unico.perfilId, unico.usuarioPerfilId)
  }

  /** Genera el JWT final y arma la respuesta de login con el perfil ya elegido. */
  private async emitirTokenFinal(
    usuario: Usuario,
    perfilId: number,
    usuarioPerfilId: number | undefined,
  ) {
    const rol = PERFIL_ROLES[perfilId] ?? 'usuario'

    const payload = {
      sub: usuario.usuarioId,
      email: usuario.usuarioEmail,
      perfilId,
      rol,
      usuarioPerfilId,
      scope: 'auth' as const,
    }

    const token = this.jwtService.sign(payload)

    if (usuarioPerfilId) {
      await this.marcarUltimoAcceso(usuarioPerfilId).catch(() => {})
    }

    const nombre = await this.resolverNombreUsuario(usuario.usuarioEmail, perfilId)

    return {
      accessToken: token,
      usuario: {
        usuarioId: usuario.usuarioId,
        email: usuario.usuarioEmail,
        nombre,
        perfilId,
        rol,
        usuarioPerfilId,
      },
    }
  }

  /** Paso 2 del login multirol: el usuario elige con qué perfil entra. */
  async seleccionarPerfil(preauthToken: string, perfilId: number) {
    if (!preauthToken) throw new BadRequestException('Falta el token de pre-autenticación')
    if (!perfilId)     throw new BadRequestException('Debe seleccionar un perfil')

    let payload: { sub: number; email: string; scope?: string }
    try {
      payload = this.jwtService.verify(preauthToken)
    } catch {
      throw new UnauthorizedException('Token inválido o expirado. Inicia sesión nuevamente.')
    }
    if (payload.scope !== 'preauth') {
      throw new UnauthorizedException('Token inválido para esta operación')
    }

    const usuario = await this.usuarioRepo.findOne({ where: { usuarioId: payload.sub } })
    if (!usuario || usuario.usuarioEstado === 0) {
      throw new UnauthorizedException('Usuario no disponible')
    }

    const fila = await this.usuarioPerfilRepo.findOne({
      where: { usuarioId: usuario.usuarioId, perfilId, estado: 1 },
    })
    if (!fila) {
      throw new UnauthorizedException('El perfil seleccionado no está disponible para este usuario')
    }

    return this.emitirTokenFinal(usuario, perfilId, fila.usuarioPerfilId)
  }

  /** Cambio de perfil en caliente para usuarios ya autenticados. */
  async cambiarPerfil(usuarioId: number, perfilId: number) {
    if (!perfilId) throw new BadRequestException('Debe indicar el perfil destino')

    const usuario = await this.usuarioRepo.findOne({ where: { usuarioId } })
    if (!usuario || usuario.usuarioEstado === 0) {
      throw new UnauthorizedException('Usuario no disponible')
    }

    const fila = await this.usuarioPerfilRepo.findOne({
      where: { usuarioId, perfilId, estado: 1 },
    })
    if (!fila) {
      throw new UnauthorizedException('No tiene asignado ese perfil')
    }

    return this.emitirTokenFinal(usuario, perfilId, fila.usuarioPerfilId)
  }

  /** Lista los perfiles activos del usuario autenticado (para topbar). */
  async perfilesDelUsuario(usuarioId: number) {
    return this.listarPerfilesActivos(usuarioId)
  }

  async registrarEmpresa(dto: RegistrarEmpresaDto) {
    if (!dto.habeasData) {
      throw new BadRequestException('Debe aceptar los Términos y Condiciones')
    }

    // PValidarCorreoRegistro — verificar que el email no exista
    const emailExiste = await this.usuarioRepo.findOne({
      where: { usuarioEmail: dto.usuarioEmail },
    })
    if (emailExiste) {
      throw new ConflictException(
        'El correo ya está registrado, por favor verificar o contactar al administrador',
      )
    }

    // PValidarNit — verificar que el NIT no exista
    const nitExiste = await this.empresaRepo.findOne({
      where: { empresaIdentificacion: dto.empresaIdentificacion },
    })
    if (nitExiste) {
      throw new ConflictException(
        'El NIT ya está registrado, por favor verificar o contactar al administrador',
      )
    }

    // Equivalente a GetEncryptionKey() + Encrypt64()
    const llaveEncriptacion = getEncryptionKey()
    const claveEncriptada = encrypt64(dto.usuarioClave, llaveEncriptacion)

    // Transacción: Usuario + Empresa (equivalente al commit doble de GeneXus)
    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      // Obtener NEXTVAL del sequence de Oracle (igual que GeneXus internamente)
      const seqResult = await queryRunner.query('SELECT USUARIOID.NEXTVAL FROM dual')
      const nextUsuarioId: number = seqResult[0]['NEXTVAL']

      // Crear Usuario (PerfilId=7 → empresa)
      const usuario = new Usuario()
      usuario.usuarioId = nextUsuarioId
      usuario.perfilId = 7
      usuario.usuarioClave = claveEncriptada
      usuario.usuarioFechaRegistro = new Date()
      usuario.usuarioEstado = 1
      usuario.usuarioTipo = 2
      usuario.usuarioEmail = dto.usuarioEmail
      usuario.usuarioLlaveEncriptacion = llaveEncriptacion

      const usuarioGuardado = (await queryRunner.manager.save(usuario)) as Usuario

      // Multirol: registrar el perfil 7 (empresa) en USUARIOPERFIL como
      // predeterminado y activo. PERFILID en USUARIO se conserva como fallback.
      await queryRunner.query(
        `INSERT INTO USUARIOPERFIL
           (USUARIOPERFILID, USUARIOID, PERFILID, PREDETERMINADO, ESTADO, FECHACREACION)
         VALUES (USUARIOPERFIL_SEQ.NEXTVAL, :1, 7, 1, 1, SYSDATE)`,
        [usuarioGuardado.usuarioId],
      )

      const seqEmpresa = await queryRunner.query('SELECT EMPRESAID.NEXTVAL FROM dual')
      const nextEmpresaId: number = seqEmpresa[0]['NEXTVAL']

      // Crear Empresa con valores secundarios por defecto (igual a GeneXus)
      const empresa = new Empresa()
      empresa.empresaId = nextEmpresaId
      empresa.tipoDocumentoIdentidadId = dto.tipoDocumentoIdentidadId
      empresa.empresaIdentificacion = dto.empresaIdentificacion
      empresa.empresaDigitoVerificacion = dto.empresaDigitoVerificacion
      empresa.empresaRazonSocial = dto.empresaRazonSocial.trim()
      empresa.empresaSigla = (dto.empresaSigla ?? '').trim()
      empresa.empresaEmail = dto.usuarioEmail
      empresa.empresaFechaRegistro = new Date()
      empresa.coberturaEmpresaId = 1
      empresa.departamentoEmpresaId = 1
      empresa.ciudadEmpresaId = 1
      empresa.ciiuId = 1
      empresa.tipoEmpresaId = 1
      empresa.tamanoEmpresaId = 1
      empresa.sectorId = 1
      empresa.subSectorId = 1
      empresa.tipoIdentificacionRep = 1

      await queryRunner.manager.save(empresa)

      await queryRunner.commitTransaction()

      return {
        message: 'Usuario registrado exitosamente',
        usuarioId: usuarioGuardado.usuarioId,
      }
    } catch (err: any) {
      await queryRunner.rollbackTransaction()
      // Traducir errores de Oracle a mensajes legibles (en lugar de
      // "Internal server error" genérico).
      if (err?.code === 'ORA-01438' || err?.errorNum === 1438) {
        throw new BadRequestException(
          'Algún campo numérico excede el tamaño permitido. Revise el NIT (máx. 10 dígitos) y el dígito de verificación (0-9).',
        )
      }
      if (err?.code === 'ORA-12899' || err?.errorNum === 12899) {
        throw new BadRequestException(
          'Algún campo de texto excede el tamaño permitido. Acorte la razón social, sigla o correo.',
        )
      }
      throw err
    } finally {
      await queryRunner.release()
    }
  }

  async registrarPersona(dto: RegistrarPersonaDto) {
    if (!dto.habeasData) {
      throw new BadRequestException('Debe aceptar los Términos y Condiciones')
    }

    // PValidarEmailPersona — email no debe existir
    const emailExiste = await this.usuarioRepo.findOne({
      where: { usuarioEmail: dto.usuarioEmail },
    })
    if (emailExiste) {
      throw new ConflictException(
        'El correo ya está registrado, por favor verificar o contactar al administrador',
      )
    }

    // PValidarIdentificacionPersona — identificación no debe existir
    const idExiste = await this.personaRepo.findOne({
      where: { personaIdentificacion: dto.personaIdentificacion },
    })
    if (idExiste) {
      throw new ConflictException(
        'El número de identificación ya está registrado, por favor verificar o contactar con el administrador',
      )
    }

    const llaveEncriptacion = getEncryptionKey()
    const claveEncriptada = encrypt64(dto.usuarioClave, llaveEncriptacion)

    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const seqUsuario = await queryRunner.query('SELECT USUARIOID.NEXTVAL FROM dual')
      const nextUsuarioId: number = seqUsuario[0]['NEXTVAL']

      // Crear Usuario (PerfilId=8 → persona/usuario)
      const usuario = new Usuario()
      usuario.usuarioId = nextUsuarioId
      usuario.perfilId = 8
      usuario.usuarioClave = claveEncriptada
      usuario.usuarioFechaRegistro = new Date()
      usuario.usuarioEstado = 1
      usuario.usuarioTipo = 1
      usuario.usuarioEmail = dto.usuarioEmail
      usuario.usuarioLlaveEncriptacion = llaveEncriptacion

      const usuarioGuardado = (await queryRunner.manager.save(usuario)) as Usuario

      // Multirol: registrar el perfil 8 (persona/usuario) en USUARIOPERFIL como
      // predeterminado y activo. PERFILID en USUARIO se conserva como fallback.
      await queryRunner.query(
        `INSERT INTO USUARIOPERFIL
           (USUARIOPERFILID, USUARIOID, PERFILID, PREDETERMINADO, ESTADO, FECHACREACION)
         VALUES (USUARIOPERFIL_SEQ.NEXTVAL, :1, 8, 1, 1, SYSDATE)`,
        [usuarioGuardado.usuarioId],
      )

      const seqPersona = await queryRunner.query('SELECT PERSONAID.NEXTVAL FROM dual')
      const nextPersonaId: number = seqPersona[0]['NEXTVAL']

      // Crear Persona
      const persona = new Persona()
      persona.personaId = nextPersonaId
      persona.tipoDocumentoIdentidadId = dto.tipoDocumentoIdentidadId
      persona.personaIdentificacion = dto.personaIdentificacion
      persona.personaNombres = dto.personaNombres.trim()
      persona.personaPrimerApellido = dto.personaPrimerApellido.trim()
      persona.personaSegundoApellido = (dto.personaSegundoApellido ?? '').trim()
      persona.personaEmail = dto.usuarioEmail
      persona.personaFechaRegistro = new Date()
      persona.generoId = 3
      persona.ciudadId = 1
      persona.personaHabeasData = 'SI'
      persona.personaHabeasDataE = 'NA'

      await queryRunner.manager.save(persona)
      await queryRunner.commitTransaction()

      return {
        message: 'Usuario registrado exitosamente',
        usuarioId: usuarioGuardado.usuarioId,
      }
    } catch (err: any) {
      await queryRunner.rollbackTransaction()
      if (err?.code === 'ORA-01438' || err?.errorNum === 1438) {
        throw new BadRequestException(
          'Algún campo numérico excede el tamaño permitido. Revise el número de identificación (máx. 10 dígitos).',
        )
      }
      if (err?.code === 'ORA-12899' || err?.errorNum === 12899) {
        throw new BadRequestException(
          'Algún campo de texto excede el tamaño permitido. Acorte los nombres, apellidos o correo.',
        )
      }
      throw err
    } finally {
      await queryRunner.release()
    }
  }

  async perfil(usuarioId: number) {
    const usuario = await this.usuarioRepo.findOne({
      where: { usuarioId },
      select: ['usuarioId', 'usuarioEmail', 'perfilId', 'usuarioEstado'],
    })
    if (!usuario) throw new UnauthorizedException()
    return {
      ...usuario,
      rol: PERFIL_ROLES[usuario.perfilId] ?? 'usuario',
    }
  }

  // ── Restablecimiento de contraseña ────────────────────────────────────────

  async solicitarRestablecimiento(email: string) {
    if (!email?.trim()) throw new BadRequestException('El correo es requerido')

    const usuario = await this.usuarioRepo.findOne({ where: { usuarioEmail: email.trim() } })
    // Respuesta genérica para no revelar si el email existe o no
    if (!usuario) return { message: 'Si el correo está registrado, recibirás un enlace en breve.' }

    // Generar token único de 32 bytes → 64 chars hex
    const token = crypto.randomBytes(32).toString('hex')
    const expira = new Date(Date.now() + 30 * 60 * 1000) // 30 minutos

    // Limpiar tokens anteriores del mismo email
    for (const [k, v] of this.resetTokens.entries()) {
      if (v.email === email.trim()) this.resetTokens.delete(k)
    }

    this.resetTokens.set(token, { email: email.trim(), expira })

    await this.mailService.enviarRestablecimiento(email.trim(), token)

    return { message: 'Si el correo está registrado, recibirás un enlace en breve.' }
  }

  async restablecerContrasena(token: string, nuevaClave: string) {
    if (!token?.trim()) throw new BadRequestException('Token requerido')
    if (!nuevaClave || nuevaClave.trim().length < 6)
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres')

    const entry = this.resetTokens.get(token)
    if (!entry) throw new NotFoundException('El enlace no es válido o ya fue utilizado')
    if (entry.expira < new Date()) {
      this.resetTokens.delete(token)
      throw new BadRequestException('El enlace ha expirado. Solicita uno nuevo.')
    }

    const usuario = await this.usuarioRepo.findOne({ where: { usuarioEmail: entry.email } })
    if (!usuario) throw new NotFoundException('Usuario no encontrado')

    const claveEncriptada = encrypt64(nuevaClave.trim(), usuario.usuarioLlaveEncriptacion)
    await this.usuarioRepo.update(usuario.usuarioId, { usuarioClave: claveEncriptada })

    this.resetTokens.delete(token)

    return { message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' }
  }
}
