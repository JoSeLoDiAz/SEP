import { EvaluadoresService } from './evaluadores.service'
import type { EvaluadorCrearDto } from './evaluadores.service'
import { reiniciarTriggersDeId } from '../common/db/ids'
import { AHORA_UTC } from '../common/db/fecha-utc'

// alta de un evaluador con persona y cuenta nuevas, sin Oracle. En el Exadata los ids de PERSONA y
// USUARIO los pone un trigger: EVALUADOR y USUARIOPERFIL tienen que colgar del id que devolvió el
// INSERT, no de un NEXTVAL pedido antes

// datos inventados: nunca cédulas ni nombres reales en un fixture
const DTO: EvaluadorCrearDto = {
  tipoDocumentoIdentidadId: 1,
  identificacion: '10000001',
  nombres: 'marta elena',
  primerApellido: 'ríos',
  email: 'mrios@ejemplo.local',
  emailInstitucional: 'mrios@sena.ejemplo.local',
  claveInicial: 'clave-de-prueba',
}

// lo que el trigger (o la secuencia, en el XE) le dio a cada fila
const ID_PERSONA = 313096
const ID_USUARIO = 86602

function dataSourceFalso() {
  const llamadas: { sql: string; params: unknown[] }[] = []
  const qr = {
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      llamadas.push({ sql, params })
      // outBinds de un DML con RETURNING: un arreglo por bind de salida
      if (sql.startsWith('INSERT INTO PERSONA ')) return [[ID_PERSONA]]
      if (sql.startsWith('INSERT INTO USUARIO ')) return [[ID_USUARIO]]
      if (sql.startsWith('INSERT INTO')) return undefined
      if (sql.includes('EVALUADOR_SEQ.NEXTVAL')) return [{ NEXTVAL: 1159 }]
      // cédula y correos que no están en el SEP
      if (sql.includes('FROM PERSONA WHERE') || sql.includes('FROM USUARIO')) return []
      throw new Error('Consulta no prevista en el fixture:\n' + sql.slice(0, 160))
    }),
  }
  return { ds: { createQueryRunner: () => qr }, qr, llamadas }
}

describe('EvaluadoresService.crear — ids de PERSONA y USUARIO', () => {
  afterEach(() => reiniciarTriggersDeId())

  it('con trigger de id (Exadata): EVALUADOR y USUARIOPERFIL usan el id que devolvió el INSERT', async () => {
    reiniciarTriggersDeId(new Map([['PERSONA', 'PERSONAID'], ['USUARIO', 'USUARIOID']]))
    const { ds, qr, llamadas } = dataSourceFalso()
    const r = await new EvaluadoresService(ds as never, {} as never).crear(DTO)

    expect(r.personaId).toBe(ID_PERSONA)
    expect(r.acceso.usuarioId).toBe(ID_USUARIO)

    const persona = llamadas.find(l => l.sql.startsWith('INSERT INTO PERSONA '))!
    expect(persona.sql).toMatch(/^INSERT INTO PERSONA \(PERSONAID, .*\) VALUES \(NULL, .* RETURNING PERSONAID INTO :\d+$/)
    const usuario = llamadas.find(l => l.sql.startsWith('INSERT INTO USUARIO '))!
    expect(usuario.sql).toMatch(/VALUES \(NULL, .* RETURNING USUARIOID INTO :\d+$/)

    const evaluador = llamadas.find(l => l.sql.startsWith('INSERT INTO EVALUADOR'))!
    expect(evaluador.params.slice(0, 2)).toEqual([1159, ID_PERSONA])
    const perfil = llamadas.find(l => l.sql.startsWith('INSERT INTO USUARIOPERFIL'))!
    expect(perfil.params).toEqual([ID_USUARIO, 9])

    // nada de sacar el id antes: el trigger lo pisaría
    expect(llamadas.some(l => /PERSONAID\.NEXTVAL|USUARIOID\.NEXTVAL/.test(l.sql))).toBe(false)
    expect(qr.commitTransaction).toHaveBeenCalled()
  })

  it('sin trigger (XE): la secuencia va en el VALUES, como antes', async () => {
    reiniciarTriggersDeId(new Map())
    const { ds, llamadas } = dataSourceFalso()
    const r = await new EvaluadoresService(ds as never, {} as never).crear(DTO)

    expect(llamadas.find(l => l.sql.startsWith('INSERT INTO PERSONA '))!.sql)
      .toContain('VALUES (PERSONAID.NEXTVAL, ')
    expect(llamadas.find(l => l.sql.startsWith('INSERT INTO USUARIO '))!.sql)
      .toContain('VALUES (USUARIOID.NEXTVAL, ')
    expect(r.personaId).toBe(ID_PERSONA)
    expect(r.acceso.usuarioId).toBe(ID_USUARIO)
  })

  it('las fechas del alta van en UTC: ninguna sentencia usa (now() AT TIME ZONE \'UTC\')', async () => {
    reiniciarTriggersDeId(new Map([['PERSONA', 'PERSONAID'], ['USUARIO', 'USUARIOID']]))
    const { ds, llamadas } = dataSourceFalso()
    await new EvaluadoresService(ds as never, {} as never).crear(DTO)

    expect(llamadas.filter(l => /SYSDATE/.test(l.sql))).toEqual([])
    for (const tabla of ['PERSONA ', 'EVALUADOR', 'USUARIO ', 'USUARIOPERFIL']) {
      const ins = llamadas.find(l => l.sql.startsWith(`INSERT INTO ${tabla}`))!
      expect(ins.sql).toContain(AHORA_UTC)
    }
    // GENEROID NULL y el habeas data siguen como literales en el SQL, igual que antes
    expect(llamadas.find(l => l.sql.startsWith('INSERT INTO PERSONA '))!.sql)
      .toContain(`${AHORA_UTC}, NULL, :9, 'SI', 'NA')`)
  })
})
