import { JwtService } from '@nestjs/jwt'
import type { DataSource, ObjectLiteral, Repository } from 'typeorm'
import { AuthService } from './auth.service'
import { Usuario } from './entities/usuario.entity'
import type { Empresa } from './entities/empresa.entity'
import type { Persona } from './entities/persona.entity'
import type { TipoDocumentoIdentidad } from './entities/tipo-documento.entity'
import type { UsuarioPerfil } from './entities/usuario-perfil.entity'
import type { MailService } from './mail.service'
import { reiniciarTriggersDeId } from '../common/db/ids'

// SYSDATE/SYSTIMESTAMP sueltos dan hora de Colombia en el Exadata; solo vale SYSTIMESTAMP dentro de SYS_EXTRACT_UTC
const horaLocal = /SYSDATE|(?<!SYS_EXTRACT_UTC\()SYSTIMESTAMP/

const repo = <T extends ObjectLiteral>(encontrado: unknown = null) =>
  ({ findOne: () => Promise.resolve(encontrado) }) as unknown as Repository<T>

// DataSource y QueryRunner falsos: guardan cada SQL y el RETURNING responde los ids dados, en orden
function armar(o: { ids?: number[]; usuario?: Usuario; fila?: Partial<UsuarioPerfil> } = {}) {
  const llamadas: { sql: string; params?: unknown[] }[] = []
  const estado = { commit: 0, rollback: 0 }
  const ids = o.ids ?? []
  let i = 0
  const query = (sql: string, params?: unknown[]) => {
    llamadas.push({ sql, params })
    if (sql.includes('RETURNING')) return Promise.resolve([[ids[i++]]])
    return Promise.resolve([])
  }
  const qr = {
    query,
    connect: () => Promise.resolve(),
    startTransaction: () => Promise.resolve(),
    commitTransaction: () => {
      estado.commit++
      return Promise.resolve()
    },
    rollbackTransaction: () => {
      estado.rollback++
      return Promise.resolve()
    },
    release: () => Promise.resolve(),
  }
  const ds = { query, createQueryRunner: () => qr } as unknown as DataSource
  const jwt = new JwtService({ secret: 'prueba' })
  const servicio = new AuthService(
    repo<Usuario>(o.usuario ?? null),
    repo<Empresa>(),
    repo<Persona>(),
    repo<TipoDocumentoIdentidad>(),
    repo<UsuarioPerfil>(o.fila ?? null),
    jwt,
    ds,
    {} as MailService,
  )
  return { servicio, jwt, llamadas, estado }
}

const empresa = {
  tipoDocumentoIdentidadId: 6,
  empresaIdentificacion: 900123456,
  empresaDigitoVerificacion: 7,
  empresaRazonSocial: ' EMPRESA EJEMPLO S.A.S. ',
  empresaSigla: 'EE',
  usuarioEmail: 'empresa@ejemplo.com',
  usuarioClave: 'Clave2024*',
  habeasData: true,
}

const persona = {
  tipoDocumentoIdentidadId: 1,
  personaIdentificacion: 1234567890,
  personaNombres: 'Juan',
  personaPrimerApellido: 'Gómez',
  usuarioEmail: 'juan@ejemplo.com',
  usuarioClave: 'Clave2024*',
  habeasData: true,
}

const usuarioActivo = () =>
  Object.assign(new Usuario(), { usuarioId: 86602, usuarioEmail: 'a@b.co', usuarioEstado: 1, perfilId: 8 })

describe('AuthService: registro', () => {
  afterEach(() => reiniciarTriggersDeId())

  it('empresa en el Exadata: los ids los ponen los triggers y el perfil queda con el USUARIOID que volvió', async () => {
    reiniciarTriggersDeId(new Map([['USUARIO', 'USUARIOID'], ['EMPRESA', 'EMPRESAID']]))
    const { servicio, llamadas, estado } = armar({ ids: [86602, 1537] })

    const r = await servicio.registrarEmpresa(empresa)

    expect(r.usuarioId).toBe(86602)
    expect(llamadas).toHaveLength(3)
    expect(llamadas[0].sql).toBe(
      'INSERT INTO USUARIO (USUARIOID, PERFILID, USUARIOCLAVE, USUARIOFECHAREGISTRO, USUARIOESTADO, USUARIOTIPO, ' +
        'USUARIOEMAIL, USUARIOLLAVEENCRIPTACION) VALUES (NULL, $1, $2, date_trunc(\'day\', CAST((now() AT TIME ZONE \'UTC\') AS timestamp)), ' +
        '$3, $4, $5, $6) RETURNING USUARIOID INTO $7',
    )
    const p = llamadas[0].params ?? []
    expect([p[0], p[2], p[3], p[4]]).toEqual([7, 1, 2, 'empresa@ejemplo.com'])
    expect(llamadas[1].sql).toContain('INSERT INTO USUARIOPERFIL')
    expect(llamadas[1].params).toEqual([86602])
    expect(llamadas[2].sql).toBe(
      'INSERT INTO EMPRESA (EMPRESAID, TIPODOCUMENTOIDENTIDADID, EMPRESAIDENTIFICACION, EMPRESADIGITOVERIFICACION, ' +
        'EMPRESARAZONSOCIAL, EMPRESASIGLA, EMPRESAEMAIL, EMPRESAFECHAREGISTRO, COBERTURAEMPRESAID, ' +
        'DEPARTAMENTOEMPRESAID, CIUDADEMPRESAID, CIIUID, TIPOEMPRESAID, TAMANOEMPRESAID, SECTORID, SUBSECTORID, ' +
        'TIPOIDENTIFICACIONREP) VALUES (NULL, $1, $2, $3, $4, $5, $6, date_trunc(\'day\', CAST((now() AT TIME ZONE \'UTC\') AS timestamp)), ' +
        '$7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING EMPRESAID INTO $16',
    )
    expect(llamadas[2].params?.slice(0, 6)).toEqual([6, 900123456, 7, 'EMPRESA EJEMPLO S.A.S.', 'EE', 'empresa@ejemplo.com'])
    expect(llamadas.some((l) => /FROM dual/i.test(l.sql))).toBe(false)
    expect(llamadas.some((l) => horaLocal.test(l.sql))).toBe(false)
    expect(estado).toEqual({ commit: 1, rollback: 0 })
  })

  it('empresa en el XE (sin trigger): los ids salen de las secuencias, como antes', async () => {
    reiniciarTriggersDeId(new Map())
    const { servicio, llamadas } = armar({ ids: [91, 92] })

    const r = await servicio.registrarEmpresa(empresa)

    expect(r.usuarioId).toBe(91)
    expect(llamadas[0].sql).toContain('VALUES (USUARIOID.NEXTVAL, $1,')
    expect(llamadas[1].params).toEqual([91])
    expect(llamadas[2].sql).toContain('VALUES (EMPRESAID.NEXTVAL, $1,')
  })

  it('persona en el Exadata: igual, con perfil 8 y USUARIOTIPO 1', async () => {
    reiniciarTriggersDeId(new Map([['USUARIO', 'USUARIOID'], ['PERSONA', 'PERSONAID']]))
    const { servicio, llamadas, estado } = armar({ ids: [86603, 313096] })

    const r = await servicio.registrarPersona(persona)

    expect(r.usuarioId).toBe(86603)
    expect(llamadas).toHaveLength(3)
    const p = llamadas[0].params ?? []
    expect([p[0], p[2], p[3]]).toEqual([8, 1, 1])
    expect(llamadas[1].sql).toContain(', 8, 1, 1, CAST((now() AT TIME ZONE \'UTC\') AS timestamp))')
    expect(llamadas[1].params).toEqual([86603])
    expect(llamadas[2].sql).toBe(
      'INSERT INTO PERSONA (PERSONAID, TIPODOCUMENTOIDENTIDADID, PERSONAIDENTIFICACION, PERSONANOMBRES, ' +
        'PERSONAPRIMERAPELLIDO, PERSONASEGUNDOAPELLIDO, PERSONAEMAIL, PERSONAFECHAREGISTRO, GENEROID, CIUDADID, ' +
        'PERSONAHABEASDATA, PERSONAHABEASDATAE) VALUES (NULL, $1, $2, $3, $4, $5, $6, ' +
        'date_trunc(\'day\', CAST((now() AT TIME ZONE \'UTC\') AS timestamp)), $7, $8, $9, $10) RETURNING PERSONAID INTO $11',
    )
    expect(llamadas[2].params?.slice(0, 10)).toEqual([1, 1234567890, 'Juan', 'Gómez', '', 'juan@ejemplo.com', 3, 1, 'SI', 'NA'])
    expect(llamadas.some((l) => horaLocal.test(l.sql))).toBe(false)
    expect(estado).toEqual({ commit: 1, rollback: 0 })
  })
})

describe('AuthService: último acceso', () => {
  it('al emitir el token se marca en UTC', async () => {
    const { servicio, jwt, llamadas } = armar({ usuario: usuarioActivo(), fila: { usuarioPerfilId: 11 } })

    const r = await servicio.cambiarPerfil(86602, 9)

    expect(jwt.verify<{ sub: number }>(r.accessToken)).toMatchObject({ sub: 86602, perfilId: 9, scope: 'auth' })
    expect(llamadas[0]).toEqual({
      sql: 'UPDATE USUARIOPERFIL SET FECHAULTIMOACCESO = (now() AT TIME ZONE \'UTC\') WHERE USUARIOPERFILID = $1',
      params: [11],
    })
  })
})
