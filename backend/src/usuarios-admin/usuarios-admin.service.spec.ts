import type { DataSource } from 'typeorm'
import { UsuariosAdminService } from './usuarios-admin.service'
import { reiniciarTriggersDeId } from '../common/db/ids'

// DataSource y QueryRunner falsos: guardan cada SQL y el RETURNING responde los ids dados, en orden
function falso(ids: number[]) {
  const llamadas: { sql: string; params?: unknown[] }[] = []
  const estado = { commit: 0, rollback: 0 }
  let i = 0
  const qr = {
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
    query: (sql: string, params?: unknown[]) => {
      llamadas.push({ sql, params })
      return Promise.resolve(sql.includes('RETURNING') ? [[ids[i++]]] : [])
    },
  }
  const ds = {
    createQueryRunner: () => qr,
    // el correo no existe y el perfil sí
    query: (sql: string) => Promise.resolve(sql.includes('FROM PERFIL') ? [{ ok: 1 }] : []),
  } as unknown as DataSource
  return { servicio: new UsuariosAdminService(ds), llamadas, estado }
}

const conPersona = {
  email: ' Nuevo@Sena.edu.co ',
  clave: 'Clave2024*',
  perfilId: 9,
  nombres: 'Ana',
  primerApellido: 'Ruiz',
  identificacion: '1000',
}

// SYSDATE/SYSTIMESTAMP sueltos dan hora de Colombia en el Exadata; solo vale SYSTIMESTAMP dentro de SYS_EXTRACT_UTC
const horaLocal = /SYSDATE|(?<!SYS_EXTRACT_UTC\()SYSTIMESTAMP/

describe('UsuariosAdminService.crearUsuario', () => {
  afterEach(() => reiniciarTriggersDeId())

  it('en el Exadata el id lo pone el trigger y la asignación de perfil usa ese id', async () => {
    reiniciarTriggersDeId(new Map([['USUARIO', 'USUARIOID'], ['PERSONA', 'PERSONAID']]))
    const { servicio, llamadas, estado } = falso([86602, 313096])

    const r = await servicio.crearUsuario(conPersona)

    expect(r).toMatchObject({ usuarioId: 86602, email: 'nuevo@sena.edu.co', perfilId: 9 })
    expect(llamadas).toHaveLength(3)
    expect(llamadas[0].sql).toBe(
      'INSERT INTO USUARIO (USUARIOID, PERFILID, USUARIOCLAVE, USUARIOFECHAREGISTRO, USUARIOESTADO, USUARIOTIPO, ' +
        'USUARIOEMAIL, USUARIOLLAVEENCRIPTACION) VALUES (NULL, $1, $2, CAST((now() AT TIME ZONE \'UTC\') AS timestamp), ' +
        '$3, $4, $5, $6) RETURNING USUARIOID INTO $7',
    )
    expect(llamadas[0].params?.slice(0, 1)).toEqual([9])
    expect(llamadas[1].sql).toContain('INSERT INTO USUARIOPERFIL')
    expect(llamadas[1].sql).toContain('USUARIOPERFIL_SEQ.NEXTVAL')
    expect(llamadas[1].params).toEqual([86602, 9])
    expect(llamadas[2].sql).toMatch(/^INSERT INTO PERSONA \(PERSONAID, .*\) VALUES \(NULL, .*RETURNING PERSONAID INTO/)
    expect(llamadas.some((l) => /FROM dual/i.test(l.sql))).toBe(false)
    expect(llamadas.some((l) => horaLocal.test(l.sql))).toBe(false)
    expect(estado).toEqual({ commit: 1, rollback: 0 })
  })

  it('en el XE (sin trigger) saca el id de la secuencia, como antes', async () => {
    reiniciarTriggersDeId(new Map())
    const { servicio, llamadas } = falso([91, 92])

    const r = await servicio.crearUsuario(conPersona)

    expect(r.usuarioId).toBe(91)
    expect(llamadas[0].sql).toContain('VALUES (USUARIOID.NEXTVAL, $1,')
    expect(llamadas[1].params).toEqual([91, 9])
    expect(llamadas[2].sql).toContain('VALUES (PERSONAID.NEXTVAL, $1,')
  })

  it('sin datos de persona solo crea el usuario y su perfil', async () => {
    reiniciarTriggersDeId(new Map([['USUARIO', 'USUARIOID']]))
    const { servicio, llamadas } = falso([5])

    await servicio.crearUsuario({ email: 'x@y.co', clave: 'Clave2024*', perfilId: 2 })

    expect(llamadas).toHaveLength(2)
    expect(llamadas[1].params).toEqual([5, 2])
  })
})
