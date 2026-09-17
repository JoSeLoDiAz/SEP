import {
  Injectable,
  Logger,
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
import { insertarConId, sqlCrudo } from '../common/db/ids'
import { AHORA_UTC, AHORA_UTC_TS, HOY_UTC } from '../common/db/fecha-utc'

interface ResetToken { email: string; expira: Date }

// El registro guardaba con manager.save, y TypeORM escribe las columnas 'date' de la entidad como
// TO_DATE('YYYY-MM-DD') del día (UTC, el backend corre con TZ=UTC): solo el día, sin hora. Se conserva.

// replica GetEncryptionKey() de GeneXus
function getEncryptionKey(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase()
}

// Encrypt64 de GeneXus: twofish-128 ECB, key hex de 32 chars, padding con espacios
function encrypt64(plainText: string, key: string): string {
  const tf = twofish(new Array(16).fill(0))
  const keyArr = Array.from(Buffer.from(key, 'hex')) as number[]
  const padded = Array.from(Buffer.from(plainText, 'utf8')) as number[]
  while (padded.length < 16) padded.push(0x20)
  return Buffer.from(tf.encrypt(keyArr, padded)).toString('base64')
}

// Decrypt64 de GeneXus: quita el padding de espacios del final
function decrypt64(encryptedBase64: string, key: string): string {
  const tf = twofish(new Array(16).fill(0))
  const keyArr = Array.from(Buffer.from(key, 'hex')) as number[]
  const encArr = Array.from(Buffer.from(encryptedBase64, 'base64')) as number[]
  const decArr = tf.decrypt(keyArr, encArr) as number[]
  return Buffer.from(decArr).toString('utf8').trimEnd()
}

// twofish trabaja sobre un bloque de 16 bytes: la clave no puede pasar de ahí
const MAX_CLAVE = 16

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
  private readonly log = new Logger(AuthService.name)

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
          `SELECT btrim((EMPRESARAZONSOCIAL)::text) AS "razon"
             FROM EMPRESA WHERE EMPRESAEMAIL = $1 LIMIT 1`,
          [email],
        )
        if (rows[0]?.razon) return rows[0].razon
      } else {
        const rows: Array<{ nombres: string; apellido: string }> = await this.dataSource.query(
          `SELECT btrim((PERSONANOMBRES)::text) AS "nombres",
                  btrim((PERSONAPRIMERAPELLIDO)::text) AS "apellido"
             FROM PERSONA WHERE PERSONAEMAIL = $1 LIMIT 1`,
          [email],
        )
        if (rows[0]?.nombres) return `${rows[0].nombres} ${rows[0].apellido}`.trim()
      }
    } catch { /* fallback al email */ }
    return email
  }

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
              btrim((p.PERFILNOMBRE)::text)       AS "perfilNombre",
              up.PREDETERMINADO          AS "predeterminado",
              up.FECHAULTIMOACCESO       AS "fechaUltimoAcceso"
         FROM USUARIOPERFIL up
         JOIN PERFIL p ON p.PERFILID = up.PERFILID
        WHERE up.USUARIOID = $1
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
      `UPDATE USUARIOPERFIL SET FECHAULTIMOACCESO = ${AHORA_UTC_TS} WHERE USUARIOPERFILID = $1`,
      [usuarioPerfilId],
    )
  }

  // si no se llega a Cloudflare se deja pasar (la clave igual se verifica); un rechazo explícito sí bloquea
  /** Para no repetir el aviso del captcha en cada intento de entrada. */
  private avisoCaptchaDado = false

  private async verifyCaptcha(token?: string): Promise<void> {
    // `.trim()` a propósito: el guion de GitLab sube un espacio cuando la variable está vacía, y un espacio en
    // JavaScript cuenta como valor. Sin esto, el SEP intentaría validar contra Cloudflare con un secreto en blanco
    // y cada entrada costaría los 16 s de los dos intentos antes de dejar pasar igual.
    const secret = process.env.TURNSTILE_SECRET?.trim()
    if (!secret) {
      // Sin clave no hay nada que comprobar, y así se puede entrar donde no hay salida a Cloudflare. Pero que quede
      // dicho una vez en el registro: si esto aparece en producción, el login está sin captcha y nadie se enteró.
      if (!this.avisoCaptchaDado) {
        this.avisoCaptchaDado = true
        this.log.warn(
          'TURNSTILE_SECRET no está definida: el captcha no se comprueba. La contraseña sí. ' +
          'Correcto en un entorno de pruebas; en producción hay que ponerla.',
        )
      }
      return
    }
    if (!token) {
      throw new UnauthorizedException('Falta validación de captcha')
    }

    let ultimoFallo: unknown = null

    // dos intentos con tope de tiempo: un tropiezo de red no debe costar el login
    for (let intento = 1; intento <= 2; intento++) {
      try {
        const body = new URLSearchParams({ secret, response: token })
        const res = await fetch(
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          { method: 'POST', body, signal: AbortSignal.timeout(8_000) },
        )
        const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] }
        if (!data.success) {
          this.log.warn(`Captcha rechazado: ${JSON.stringify(data['error-codes'] ?? [])}`)
          throw new UnauthorizedException('Captcha inválido o expirado')
        }
        return
      } catch (e) {
        if (e instanceof UnauthorizedException) throw e
        ultimoFallo = e
      }
    }

    const causa = (ultimoFallo as { cause?: { code?: string } })?.cause?.code
      ?? (ultimoFallo as Error)?.message ?? String(ultimoFallo)
    this.log.error(
      `No se pudo consultar a Cloudflare para validar el captcha (${causa}). ` +
      'Se permite el ingreso; la contraseña sí se verifica. Revisar la salida a ' +
      'challenges.cloudflare.com desde este servidor.',
    )
  }

  async tiposDocumento(para: 'persona' | 'empresa') {
    const col =
      para === 'persona'
        ? 'TIPODOCUMENTOIDENTIDADPERSONA'
        : 'TIPODOCUMENTOIDENTIDADEMPRESA'

    // TRIM(): la columna es NCHAR y viene rellena de espacios
    const rows: Array<{ id: number; nombre: string }> = await this.dataSource.query(
      `SELECT TIPODOCUMENTOIDENTIDADID AS "id",
              btrim((TIPODOCUMENTOIDENTIDADNOMBRE)::text) AS "nombre"
         FROM TIPODOCUMENTOIDENTIDAD
        WHERE ${col} = 1
        ORDER BY btrim((TIPODOCUMENTOIDENTIDADNOMBRE)::text) ASC`,
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

    // mensaje unificado: no revelar si el correo existe
    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas')
    }

    if (usuario.usuarioEstado === 0) {
      throw new UnauthorizedException('Usuario inactivo. Comuníquese con el administrador del sistema.')
    }

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

    // sin filas en USUARIOPERFIL (usuarios previos a la migración): fallback a USUARIO.PERFILID
    if (perfiles.length === 0) {
      return this.emitirTokenFinal(usuario, usuario.perfilId, undefined)
    }

    // 2+ perfiles: preauthToken y el frontend pide la selección
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

    const unico = perfiles[0]
    return this.emitirTokenFinal(usuario, unico.perfilId, unico.usuarioPerfilId)
  }

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

  // paso 2 del login multirol
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

  async perfilesDelUsuario(usuarioId: number) {
    return this.listarPerfilesActivos(usuarioId)
  }

  async registrarEmpresa(dto: RegistrarEmpresaDto) {
    if (!dto.habeasData) {
      throw new BadRequestException('Debe aceptar los Términos y Condiciones')
    }

    // PValidarCorreoRegistro
    const emailExiste = await this.usuarioRepo.findOne({
      where: { usuarioEmail: dto.usuarioEmail },
    })
    if (emailExiste) {
      throw new ConflictException(
        'El correo ya está registrado, por favor verificar o contactar al administrador',
      )
    }

    // PValidarNit
    const nitExiste = await this.empresaRepo.findOne({
      where: { empresaIdentificacion: dto.empresaIdentificacion },
    })
    if (nitExiste) {
      throw new ConflictException(
        'El NIT ya está registrado, por favor verificar o contactar al administrador',
      )
    }

    const llaveEncriptacion = getEncryptionKey()
    const claveEncriptada = encrypt64(dto.usuarioClave, llaveEncriptacion)

    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      // perfil 7 = empresa. El id lo pone la base (en el Exadata, el trigger de GeneXus) y vuelve en el mismo INSERT
      const usuarioId = await insertarConId(queryRunner, 'USUARIO', 'USUARIOID', { secuencia: 'USUARIOID' }, {
        PERFILID: 7,
        USUARIOCLAVE: claveEncriptada,
        USUARIOFECHAREGISTRO: sqlCrudo(HOY_UTC),
        USUARIOESTADO: 1,
        USUARIOTIPO: 2,
        USUARIOEMAIL: dto.usuarioEmail,
        USUARIOLLAVEENCRIPTACION: llaveEncriptacion,
      })

      // USUARIO.PERFILID se conserva solo como fallback
      await queryRunner.query(
        `INSERT INTO USUARIOPERFIL
           (USUARIOPERFILID, USUARIOID, PERFILID, PREDETERMINADO, ESTADO, FECHACREACION)
         VALUES (USUARIOPERFIL_SEQ.NEXTVAL, $1, 7, 1, 1, ${AHORA_UTC})`,
        [usuarioId],
      )

      // los ids en 1 son los valores por defecto que ya usaba GeneXus
      await insertarConId(queryRunner, 'EMPRESA', 'EMPRESAID', { secuencia: 'EMPRESAID' }, {
        TIPODOCUMENTOIDENTIDADID: dto.tipoDocumentoIdentidadId,
        EMPRESAIDENTIFICACION: dto.empresaIdentificacion,
        EMPRESADIGITOVERIFICACION: dto.empresaDigitoVerificacion,
        EMPRESARAZONSOCIAL: dto.empresaRazonSocial.trim(),
        EMPRESASIGLA: (dto.empresaSigla ?? '').trim(),
        EMPRESAEMAIL: dto.usuarioEmail,
        EMPRESAFECHAREGISTRO: sqlCrudo(HOY_UTC),
        COBERTURAEMPRESAID: 1,
        DEPARTAMENTOEMPRESAID: 1,
        CIUDADEMPRESAID: 1,
        CIIUID: 1,
        TIPOEMPRESAID: 1,
        TAMANOEMPRESAID: 1,
        SECTORID: 1,
        SUBSECTORID: 1,
        TIPOIDENTIFICACIONREP: 1,
      })

      await queryRunner.commitTransaction()

      return {
        message: 'Usuario registrado exitosamente',
        usuarioId,
      }
    } catch (err: any) {
      await queryRunner.rollbackTransaction()
      // traducir errores de Oracle a mensajes legibles
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

    // PValidarEmailPersona
    const emailExiste = await this.usuarioRepo.findOne({
      where: { usuarioEmail: dto.usuarioEmail },
    })
    if (emailExiste) {
      throw new ConflictException(
        'El correo ya está registrado, por favor verificar o contactar al administrador',
      )
    }

    // PValidarIdentificacionPersona
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
      // perfil 8 = persona. El id lo pone la base (en el Exadata, el trigger de GeneXus) y vuelve en el mismo INSERT
      const usuarioId = await insertarConId(queryRunner, 'USUARIO', 'USUARIOID', { secuencia: 'USUARIOID' }, {
        PERFILID: 8,
        USUARIOCLAVE: claveEncriptada,
        USUARIOFECHAREGISTRO: sqlCrudo(HOY_UTC),
        USUARIOESTADO: 1,
        USUARIOTIPO: 1,
        USUARIOEMAIL: dto.usuarioEmail,
        USUARIOLLAVEENCRIPTACION: llaveEncriptacion,
      })

      // USUARIO.PERFILID se conserva solo como fallback
      await queryRunner.query(
        `INSERT INTO USUARIOPERFIL
           (USUARIOPERFILID, USUARIOID, PERFILID, PREDETERMINADO, ESTADO, FECHACREACION)
         VALUES (USUARIOPERFIL_SEQ.NEXTVAL, $1, 8, 1, 1, ${AHORA_UTC})`,
        [usuarioId],
      )

      await insertarConId(queryRunner, 'PERSONA', 'PERSONAID', { secuencia: 'PERSONAID' }, {
        TIPODOCUMENTOIDENTIDADID: dto.tipoDocumentoIdentidadId,
        PERSONAIDENTIFICACION: dto.personaIdentificacion,
        PERSONANOMBRES: dto.personaNombres.trim(),
        PERSONAPRIMERAPELLIDO: dto.personaPrimerApellido.trim(),
        PERSONASEGUNDOAPELLIDO: (dto.personaSegundoApellido ?? '').trim(),
        PERSONAEMAIL: dto.usuarioEmail,
        PERSONAFECHAREGISTRO: sqlCrudo(HOY_UTC),
        GENEROID: 3,
        CIUDADID: 1,
        PERSONAHABEASDATA: 'SI',
        PERSONAHABEASDATAE: 'NA',
      })
      await queryRunner.commitTransaction()

      return {
        message: 'Usuario registrado exitosamente',
        usuarioId,
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

  // restablecimiento de contraseña

  async solicitarRestablecimiento(email: string) {
    if (!email?.trim()) throw new BadRequestException('El correo es requerido')

    const usuario = await this.usuarioRepo.findOne({ where: { usuarioEmail: email.trim() } })
    // respuesta genérica: no revelar si el email existe
    if (!usuario) return { message: 'Si el correo está registrado, recibirás un enlace en breve.' }

    const token = crypto.randomBytes(32).toString('hex')
    const expira = new Date(Date.now() + 30 * 60 * 1000)

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

  // el usuario cambia su propia clave, verificando la actual
  async cambiarMiClave(email: string, claveActual: string, nuevaClave: string) {
    const actual = claveActual ?? ''
    const nueva = nuevaClave ?? ''

    if (!actual) throw new BadRequestException('Escribe tu contraseña actual')
    if (nueva.length < 6) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 6 caracteres')
    }
    // twofish cifra un bloque de 16 bytes: más largo no se podría volver a validar
    if (Buffer.byteLength(nueva, 'utf8') > MAX_CLAVE) {
      throw new BadRequestException(`La contraseña no puede pasar de ${MAX_CLAVE} caracteres`)
    }
    if (nueva !== nueva.trim()) {
      throw new BadRequestException('La contraseña no puede empezar ni terminar en espacio')
    }
    if (nueva === actual) {
      throw new BadRequestException('La nueva contraseña tiene que ser distinta de la actual')
    }

    const usuario = await this.usuarioRepo.findOne({ where: { usuarioEmail: email } })
    if (!usuario) throw new NotFoundException('Usuario no encontrado')

    let guardada: string
    try {
      guardada = decrypt64(usuario.usuarioClave, usuario.usuarioLlaveEncriptacion)
    } catch {
      throw new BadRequestException(
        'No se pudo leer tu contraseña actual. Usa "Olvidé mi contraseña" desde el inicio de sesión.',
      )
    }
    if (guardada !== actual) {
      throw new UnauthorizedException('La contraseña actual no es correcta')
    }

    await this.usuarioRepo.update(usuario.usuarioId, {
      usuarioClave: encrypt64(nueva, usuario.usuarioLlaveEncriptacion),
    })

    this.log.log(`Cambió su contraseña: ${email}`)
    return { message: 'Tu contraseña quedó actualizada' }
  }
}
