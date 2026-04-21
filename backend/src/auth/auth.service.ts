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
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

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

    const usuario = await this.usuarioRepo.findOne({
      where: { usuarioEmail: dto.email },
    })

    if (!usuario) {
      throw new UnauthorizedException('Usuario incorrecto')
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
      throw new UnauthorizedException('Error al verificar credenciales')
    }

    if (claveDesencriptada !== dto.clave) {
      throw new UnauthorizedException('Contraseña incorrecta')
    }

    const rol = PERFIL_ROLES[usuario.perfilId] ?? 'usuario'

    const payload = {
      sub: usuario.usuarioId,
      email: usuario.usuarioEmail,
      perfilId: usuario.perfilId,
      rol,
    }

    const token = this.jwtService.sign(payload)

    // Buscar nombre según perfil: perfilId=7 → EMPRESA, cualquier otro → PERSONA
    let nombre = usuario.usuarioEmail
    try {
      if (usuario.perfilId === 7) {
        const rows: Array<{ razon: string }> = await this.dataSource.query(
          `SELECT TRIM(EMPRESARAZONSOCIAL) AS "razon"
             FROM EMPRESA
            WHERE EMPRESAEMAIL = :1
              AND ROWNUM = 1`,
          [usuario.usuarioEmail],
        )
        if (rows[0]?.razon) nombre = rows[0].razon
      } else {
        const rows: Array<{ nombres: string; apellido: string }> = await this.dataSource.query(
          `SELECT TRIM(PERSONANOMBRES) AS "nombres",
                  TRIM(PERSONAPRIMERAPELLIDO) AS "apellido"
             FROM PERSONA
            WHERE PERSONAEMAIL = :1
              AND ROWNUM = 1`,
          [usuario.usuarioEmail],
        )
        if (rows[0]?.nombres) {
          nombre = `${rows[0].nombres} ${rows[0].apellido}`.trim()
        }
      }
    } catch {
      // Si falla la búsqueda del nombre, usamos el email como fallback
    }

    return {
      accessToken: token,
      usuario: {
        usuarioId: usuario.usuarioId,
        email: usuario.usuarioEmail,
        nombre,
        perfilId: usuario.perfilId,
        rol,
      },
    }
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
    } catch (err) {
      await queryRunner.rollbackTransaction()
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
    } catch (err) {
      await queryRunner.rollbackTransaction()
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
