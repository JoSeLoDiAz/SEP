import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import * as crypto from 'crypto'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { twofish } = require('twofish')

function getEncryptionKey(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase()
}
function encrypt64(plainText: string, key: string): string {
  const tf = twofish(new Array(16).fill(0))
  const keyArr = Array.from(Buffer.from(key, 'hex')) as number[]
  const padded = Array.from(Buffer.from(plainText, 'utf8')) as number[]
  while (padded.length < 16) padded.push(0x20)
  return Buffer.from(tf.encrypt(keyArr, padded)).toString('base64')
}

export interface CrearUsuarioDto {
  email: string
  clave: string
  perfilId: number
  nombres?: string
  primerApellido?: string
  segundoApellido?: string
  identificacion?: string
  tipoDocumentoIdentidadId?: number
}

const PERFIL_ADMIN = 1

export interface UsuarioResumen {
  usuarioId: number
  email: string
  nombre: string
  estado: number
  perfiles: string[]
}

@Injectable()
export class UsuariosAdminService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listarUsuarios(busqueda: string, page = 1, limit = 20) {
    const q = (busqueda ?? '').trim()
    const pagina = Math.max(1, page)
    const tamPag = Math.min(100, Math.max(1, limit))
    const offset = (pagina - 1) * tamPag

    let total = 0
    let baseRows: Array<{ usuarioId: number; email: string; estado: number }> = []

    try {
      if (q) {
        // Búsqueda con texto: 3 queries pequeñas independientes para que cada
        // una use su propio plan eficiente; luego unión en memoria, dedupe y
        // paginación. Esto es mucho más estable que un OR/EXISTS gigante
        // sobre USUARIO ⨝ PERSONA ⨝ EMPRESA en una BD con 78k usuarios.
        const like = `%${q.toUpperCase()}%`

        const idsPorEmail: Array<{ id: number }> = await this.dataSource.query(
          `SELECT USUARIOID AS "id"
             FROM USUARIO
            WHERE UPPER(USUARIOEMAIL) LIKE :1`,
          [like],
        )
        const idsPorPersona: Array<{ id: number }> = await this.dataSource.query(
          `SELECT u.USUARIOID AS "id"
             FROM USUARIO u
             JOIN PERSONA p ON p.PERSONAEMAIL = u.USUARIOEMAIL
            WHERE UPPER(NVL(p.PERSONANOMBRES,'') || ' ' || NVL(p.PERSONAPRIMERAPELLIDO,'')) LIKE :1`,
          [like],
        )
        const idsPorEmpresa: Array<{ id: number }> = await this.dataSource.query(
          `SELECT u.USUARIOID AS "id"
             FROM USUARIO u
             JOIN EMPRESA e ON e.EMPRESAEMAIL = u.USUARIOEMAIL
            WHERE UPPER(NVL(e.EMPRESARAZONSOCIAL,'')) LIKE :1`,
          [like],
        )

        const setIds = new Set<number>()
        for (const r of idsPorEmail)   setIds.add(Number(r.id))
        for (const r of idsPorPersona) setIds.add(Number(r.id))
        for (const r of idsPorEmpresa) setIds.add(Number(r.id))

        const todosIds = Array.from(setIds).sort((a, b) => b - a)
        total = todosIds.length

        const idsPagina = todosIds.slice(offset, offset + tamPag)
        if (idsPagina.length > 0) {
          const placeholders = idsPagina.map((_, i) => `:${i + 1}`).join(',')
          baseRows = await this.dataSource.query(
            `SELECT USUARIOID          AS "usuarioId",
                    TRIM(USUARIOEMAIL) AS "email",
                    USUARIOESTADO      AS "estado"
               FROM USUARIO
              WHERE USUARIOID IN (${placeholders})
              ORDER BY USUARIOID DESC`,
            idsPagina,
          )
        }
      } else {
        // Sin búsqueda: paginación nativa rápida.
        const totalRows: Array<{ T: number }> = await this.dataSource.query(
          `SELECT COUNT(*) AS "T" FROM USUARIO`,
        )
        total = Number(totalRows[0]?.T ?? 0)

        baseRows = await this.dataSource.query(
          `SELECT u.USUARIOID          AS "usuarioId",
                  TRIM(u.USUARIOEMAIL) AS "email",
                  u.USUARIOESTADO      AS "estado"
             FROM USUARIO u
             ORDER BY u.USUARIOID DESC
             OFFSET ${offset} ROWS FETCH NEXT ${tamPag} ROWS ONLY`,
        )
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[UsuariosAdminService.listarUsuarios] query error:', err)
      throw err
    }

    if (baseRows.length === 0) {
      return { items: [], total, page: pagina, limit: tamPag }
    }

    // Paso 2: enriquecer con nombre y perfiles, una sola query por dato.
    const ids = baseRows.map(r => Number(r.usuarioId))
    const emails = baseRows.map(r => r.email)
    const placeholdersIds    = ids.map((_, i) => `:${i + 1}`).join(',')
    const placeholdersEmails = emails.map((_, i) => `:${i + 1}`).join(',')

    const personas: Array<{ email: string; nombre: string }> = await this.dataSource.query(
      `SELECT TRIM(PERSONAEMAIL) AS "email",
              TRIM(PERSONANOMBRES) || ' ' || TRIM(PERSONAPRIMERAPELLIDO) AS "nombre"
         FROM PERSONA
        WHERE PERSONAEMAIL IN (${placeholdersEmails})`,
      emails,
    )
    const empresas: Array<{ email: string; nombre: string }> = await this.dataSource.query(
      `SELECT TRIM(EMPRESAEMAIL) AS "email",
              TRIM(EMPRESARAZONSOCIAL) AS "nombre"
         FROM EMPRESA
        WHERE EMPRESAEMAIL IN (${placeholdersEmails})`,
      emails,
    )
    const perfilesRows: Array<{ usuarioId: number; perfilNombre: string }> = await this.dataSource.query(
      `SELECT up.USUARIOID            AS "usuarioId",
              TRIM(p.PERFILNOMBRE)    AS "perfilNombre"
         FROM USUARIOPERFIL up
         JOIN PERFIL p ON p.PERFILID = up.PERFILID
        WHERE up.ESTADO = 1
          AND up.USUARIOID IN (${placeholdersIds})
        ORDER BY p.PERFILNOMBRE`,
      ids,
    )

    const personaPorEmail = new Map(personas.map(x => [x.email.trim(), x.nombre.trim()]))
    const empresaPorEmail = new Map(empresas.map(x => [x.email.trim(), x.nombre.trim()]))
    const perfilesPorUsr  = new Map<number, string[]>()
    for (const r of perfilesRows) {
      const key = Number(r.usuarioId)
      const list = perfilesPorUsr.get(key) ?? []
      list.push(r.perfilNombre)
      perfilesPorUsr.set(key, list)
    }

    const items: UsuarioResumen[] = baseRows.map(r => {
      const nombreEmpresa = empresaPorEmail.get(r.email.trim()) ?? ''
      const nombrePersona = personaPorEmail.get(r.email.trim()) ?? ''
      return {
        usuarioId: Number(r.usuarioId),
        email: r.email,
        nombre: nombreEmpresa || nombrePersona || r.email,
        estado: Number(r.estado),
        perfiles: perfilesPorUsr.get(Number(r.usuarioId)) ?? [],
      }
    })

    return { items, total, page: pagina, limit: tamPag }
  }

  async listarPerfilesUsuario(usuarioId: number) {
    const usuario: Array<{ usuarioId: number; email: string; estado: number }> =
      await this.dataSource.query(
        `SELECT USUARIOID AS "usuarioId", TRIM(USUARIOEMAIL) AS "email", USUARIOESTADO AS "estado"
           FROM USUARIO WHERE USUARIOID = :1`,
        [usuarioId],
      )
    if (!usuario[0]) throw new NotFoundException('Usuario no encontrado')

    const asignados: Array<{
      usuarioPerfilId: number
      perfilId: number
      perfilNombre: string
      predeterminado: number
      estado: number
      fechaUltimoAcceso: Date | null
      fechaCreacion: Date
    }> = await this.dataSource.query(
      `SELECT up.USUARIOPERFILID    AS "usuarioPerfilId",
              up.PERFILID            AS "perfilId",
              TRIM(p.PERFILNOMBRE)   AS "perfilNombre",
              up.PREDETERMINADO      AS "predeterminado",
              up.ESTADO              AS "estado",
              up.FECHAULTIMOACCESO   AS "fechaUltimoAcceso",
              up.FECHACREACION       AS "fechaCreacion"
         FROM USUARIOPERFIL up
         JOIN PERFIL p ON p.PERFILID = up.PERFILID
        WHERE up.USUARIOID = :1
          AND up.PERFILID <> ${PERFIL_ADMIN}
        ORDER BY up.ESTADO DESC, up.PREDETERMINADO DESC, p.PERFILNOMBRE ASC`,
      [usuarioId],
    )

    const disponibles: Array<{ perfilId: number; perfilNombre: string }> = await this.dataSource.query(
      `SELECT PERFILID AS "perfilId", TRIM(PERFILNOMBRE) AS "perfilNombre"
         FROM PERFIL
        WHERE PERFILID <> ${PERFIL_ADMIN}
          AND PERFILID NOT IN (
            SELECT PERFILID FROM USUARIOPERFIL WHERE USUARIOID = :1 AND ESTADO = 1
          )
        ORDER BY PERFILNOMBRE`,
      [usuarioId],
    )

    return {
      usuario: {
        usuarioId: Number(usuario[0].usuarioId),
        email: usuario[0].email,
        estado: Number(usuario[0].estado),
      },
      asignados: asignados.map(a => ({
        ...a,
        usuarioPerfilId: Number(a.usuarioPerfilId),
        perfilId: Number(a.perfilId),
        predeterminado: Number(a.predeterminado),
        estado: Number(a.estado),
      })),
      disponibles: disponibles.map(d => ({
        perfilId: Number(d.perfilId),
        perfilNombre: d.perfilNombre,
      })),
    }
  }

  async asignarPerfil(usuarioId: number, perfilId: number) {
    if (!perfilId) throw new BadRequestException('Debe indicar el perfil a asignar')
    if (perfilId === PERFIL_ADMIN) {
      throw new ForbiddenException('El perfil de administrador no se asigna desde este panel')
    }

    const usuario = await this.dataSource.query(`SELECT 1 FROM USUARIO WHERE USUARIOID = :1`, [usuarioId])
    if (!usuario[0]) throw new NotFoundException('Usuario no encontrado')

    const perfil = await this.dataSource.query(`SELECT 1 FROM PERFIL WHERE PERFILID = :1`, [perfilId])
    if (!perfil[0]) throw new NotFoundException('Perfil no encontrado')

    const existente: Array<{ usuarioPerfilId: number; estado: number }> = await this.dataSource.query(
      `SELECT USUARIOPERFILID AS "usuarioPerfilId", ESTADO AS "estado"
         FROM USUARIOPERFIL WHERE USUARIOID = :1 AND PERFILID = :2`,
      [usuarioId, perfilId],
    )

    if (existente[0]) {
      if (Number(existente[0].estado) === 1) {
        throw new BadRequestException('El usuario ya tiene este perfil activo')
      }
      await this.dataSource.query(
        `UPDATE USUARIOPERFIL SET ESTADO = 1 WHERE USUARIOPERFILID = :1`,
        [Number(existente[0].usuarioPerfilId)],
      )
      return { message: 'Perfil reactivado', usuarioPerfilId: Number(existente[0].usuarioPerfilId) }
    }

    const seq: Array<{ NEXTVAL: number }> = await this.dataSource.query(
      `SELECT USUARIOPERFIL_SEQ.NEXTVAL FROM dual`,
    )
    const nuevoId = Number(seq[0].NEXTVAL)

    await this.dataSource.query(
      `INSERT INTO USUARIOPERFIL
         (USUARIOPERFILID, USUARIOID, PERFILID, PREDETERMINADO, ESTADO, FECHACREACION)
       VALUES (:1, :2, :3, 0, 1, SYSDATE)`,
      [nuevoId, usuarioId, perfilId],
    )

    return { message: 'Perfil asignado', usuarioPerfilId: nuevoId }
  }

  async actualizarPerfil(
    usuarioId: number,
    usuarioPerfilId: number,
    cambios: { predeterminado?: boolean; estado?: boolean },
  ) {
    const fila: Array<{ usuarioPerfilId: number; usuarioId: number; perfilId: number }> =
      await this.dataSource.query(
        `SELECT USUARIOPERFILID AS "usuarioPerfilId",
                USUARIOID       AS "usuarioId",
                PERFILID        AS "perfilId"
           FROM USUARIOPERFIL WHERE USUARIOPERFILID = :1`,
        [usuarioPerfilId],
      )
    if (!fila[0]) throw new NotFoundException('Asignación no encontrada')
    if (Number(fila[0].usuarioId) !== Number(usuarioId)) {
      throw new BadRequestException('La asignación no pertenece a este usuario')
    }
    if (Number(fila[0].perfilId) === PERFIL_ADMIN) {
      throw new ForbiddenException('El perfil de administrador no se modifica desde este panel')
    }

    if (cambios.predeterminado === true) {
      // Solo uno puede ser predeterminado: desmarcamos los demás.
      await this.dataSource.query(
        `UPDATE USUARIOPERFIL SET PREDETERMINADO = 0 WHERE USUARIOID = :1`,
        [usuarioId],
      )
      await this.dataSource.query(
        `UPDATE USUARIOPERFIL SET PREDETERMINADO = 1, ESTADO = 1 WHERE USUARIOPERFILID = :1`,
        [usuarioPerfilId],
      )
    } else if (cambios.predeterminado === false) {
      await this.dataSource.query(
        `UPDATE USUARIOPERFIL SET PREDETERMINADO = 0 WHERE USUARIOPERFILID = :1`,
        [usuarioPerfilId],
      )
    }

    if (cambios.estado === true || cambios.estado === false) {
      const nuevoEstado = cambios.estado ? 1 : 0
      await this.dataSource.query(
        `UPDATE USUARIOPERFIL SET ESTADO = :1
          ${nuevoEstado === 0 ? `, PREDETERMINADO = 0` : ``}
          WHERE USUARIOPERFILID = :2`,
        [nuevoEstado, usuarioPerfilId],
      )
    }

    return { message: 'Asignación actualizada' }
  }

  async crearUsuario(dto: CrearUsuarioDto) {
    const email = (dto.email ?? '').trim().toLowerCase()
    const clave = (dto.clave ?? '').trim()
    const perfilId = Number(dto.perfilId)

    if (!email)        throw new BadRequestException('El correo es obligatorio')
    if (!clave || clave.length < 6) throw new BadRequestException('La contraseña debe tener al menos 6 caracteres')
    if (!perfilId)     throw new BadRequestException('Debe indicar un perfil')
    if (perfilId === PERFIL_ADMIN) {
      throw new ForbiddenException('El perfil de administrador no se asigna desde este panel')
    }

    const yaExiste: Array<{ id: number }> = await this.dataSource.query(
      `SELECT USUARIOID AS "id" FROM USUARIO WHERE LOWER(USUARIOEMAIL) = :1`,
      [email],
    )
    if (yaExiste[0]) throw new ConflictException('El correo ya está registrado')

    const perfilOk = await this.dataSource.query(`SELECT 1 FROM PERFIL WHERE PERFILID = :1`, [perfilId])
    if (!perfilOk[0]) throw new NotFoundException('Perfil no encontrado')

    const llave = getEncryptionKey()
    const claveCifrada = encrypt64(clave, llave)

    const qr = this.dataSource.createQueryRunner()
    await qr.connect()
    await qr.startTransaction()
    try {
      const seqU: Array<{ NEXTVAL: number }> = await qr.query(`SELECT USUARIOID.NEXTVAL FROM dual`)
      const usuarioId = Number(seqU[0].NEXTVAL)

      await qr.query(
        `INSERT INTO USUARIO
           (USUARIOID, PERFILID, USUARIOCLAVE, USUARIOFECHAREGISTRO, USUARIOESTADO,
            USUARIOTIPO, USUARIOEMAIL, USUARIOLLAVEENCRIPTACION)
         VALUES (:1, :2, :3, SYSDATE, 1, 1, :4, :5)`,
        [usuarioId, perfilId, claveCifrada, email, llave],
      )

      await qr.query(
        `INSERT INTO USUARIOPERFIL
           (USUARIOPERFILID, USUARIOID, PERFILID, PREDETERMINADO, ESTADO, FECHACREACION)
         VALUES (USUARIOPERFIL_SEQ.NEXTVAL, :1, :2, 1, 1, SYSDATE)`,
        [usuarioId, perfilId],
      )

      // Datos PERSONA opcionales — si vienen los básicos se crea la fila.
      if (dto.nombres?.trim() && dto.primerApellido?.trim() && dto.identificacion?.trim()) {
        const seqP: Array<{ NEXTVAL: number }> = await qr.query(`SELECT PERSONAID.NEXTVAL FROM dual`)
        const personaId = Number(seqP[0].NEXTVAL)
        await qr.query(
          `INSERT INTO PERSONA
             (PERSONAID, TIPODOCUMENTOIDENTIDADID, PERSONANOMBRES, PERSONAPRIMERAPELLIDO,
              PERSONASEGUNDOAPELLIDO, PERSONAIDENTIFICACION, PERSONAEMAIL, PERSONAFECHAREGISTRO,
              GENEROID, CIUDADID, PERSONAHABEASDATA, PERSONAHABEASDATAE)
           VALUES (:1, :2, :3, :4, :5, :6, :7, SYSDATE, 3, 1, 'SI', 'NA')`,
          [
            personaId,
            dto.tipoDocumentoIdentidadId ?? 1,
            dto.nombres.trim(),
            dto.primerApellido.trim(),
            (dto.segundoApellido ?? '').trim(),
            dto.identificacion.trim(),
            email,
          ],
        )
      }

      await qr.commitTransaction()
      return { usuarioId, email, perfilId, message: 'Usuario creado' }
    } catch (err) {
      await qr.rollbackTransaction()
      throw err
    } finally {
      await qr.release()
    }
  }

  async cambiarEstadoUsuario(usuarioId: number, estado: boolean) {
    const filas: Array<{ perfilId: number }> = await this.dataSource.query(
      `SELECT PERFILID AS "perfilId" FROM USUARIO WHERE USUARIOID = :1`,
      [usuarioId],
    )
    if (!filas[0]) throw new NotFoundException('Usuario no encontrado')
    if (Number(filas[0].perfilId) === PERFIL_ADMIN) {
      throw new ForbiddenException('No se permite cambiar el estado de un administrador desde este panel')
    }
    const nuevo = estado ? 1 : 0
    await this.dataSource.query(
      `UPDATE USUARIO SET USUARIOESTADO = :1 WHERE USUARIOID = :2`,
      [nuevo, usuarioId],
    )
    return { message: estado ? 'Usuario activado' : 'Usuario desactivado', estado: nuevo }
  }

  async cambiarClave(usuarioId: number, nuevaClave: string) {
    const clave = (nuevaClave ?? '').trim()
    if (clave.length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres')
    }

    const filas: Array<{ usuarioId: number; llave: string; perfilId: number }> = await this.dataSource.query(
      `SELECT USUARIOID AS "usuarioId",
              USUARIOLLAVEENCRIPTACION AS "llave",
              PERFILID AS "perfilId"
         FROM USUARIO WHERE USUARIOID = :1`,
      [usuarioId],
    )
    const u = filas[0]
    if (!u) throw new NotFoundException('Usuario no encontrado')
    if (Number(u.perfilId) === PERFIL_ADMIN) {
      throw new ForbiddenException('No se permite resetear la contraseña de un administrador desde este panel')
    }

    const cifrada = encrypt64(clave, u.llave)
    await this.dataSource.query(
      `UPDATE USUARIO SET USUARIOCLAVE = :1 WHERE USUARIOID = :2`,
      [cifrada, usuarioId],
    )
    return { message: 'Contraseña actualizada' }
  }

  async catalogoPerfiles() {
    const rows: Array<{ perfilId: number; perfilNombre: string }> = await this.dataSource.query(
      `SELECT PERFILID AS "perfilId", TRIM(PERFILNOMBRE) AS "perfilNombre"
         FROM PERFIL
        WHERE PERFILID <> ${PERFIL_ADMIN}
        ORDER BY PERFILNOMBRE`,
    )
    return rows.map(r => ({ perfilId: Number(r.perfilId), perfilNombre: r.perfilNombre }))
  }
}
