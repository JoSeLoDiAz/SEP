import {
  Ejecutor,
  columnaAsignada,
  insertarConId,
  leerId,
  reiniciarTriggersDeId,
  sqlCrudo,
  triggersDeId,
} from './ids'
import { AHORA_UTC } from './fecha-utc'

// Ejecutor falso: guarda cada SQL con sus parámetros y responde según el texto
function falso(respuestas: { max?: number; id?: unknown; triggers?: { tabla: string; cuerpo: string }[] } = {}) {
  const llamadas: { sql: string; params?: unknown[] }[] = []
  const ej: Ejecutor = {
    query: (sql: string, params?: unknown[]) => {
      llamadas.push({ sql, params })
      if (sql.includes('ALL_TRIGGERS')) return Promise.resolve(respuestas.triggers ?? [])
      if (sql.startsWith('SELECT NVL(MAX(')) return Promise.resolve([{ id: respuestas.max ?? 41 }])
      return Promise.resolve([[respuestas.id ?? 777]])
    },
  }
  return { ej, llamadas }
}

describe('columnaAsignada', () => {
  it('saca la columna del cuerpo de un trigger de GeneXus', () => {
    expect(columnaAsignada('BEGIN SELECT RadicadoId.NEXTVAL INTO :new.RadicadoId FROM DUAL; END; \n\n')).toBe('RADICADOID')
    expect(columnaAsignada('begin select X.nextval into :NEW."PersonaId" from dual; end;')).toBe('PERSONAID')
    expect(columnaAsignada('BEGIN NULL; END;')).toBeNull()
    expect(columnaAsignada(null)).toBeNull()
  })
})

describe('insertarConId', () => {
  afterEach(() => reiniciarTriggersDeId())

  it('con trigger de id manda NULL y lee el id del RETURNING, sin pedir NEXTVAL antes', async () => {
    reiniciarTriggersDeId(new Map([['USUARIO', 'USUARIOID']]))
    const { ej, llamadas } = falso({ id: 86602 })
    const id = await insertarConId(ej, 'USUARIO', 'USUARIOID', { secuencia: 'USUARIOID' }, {
      USUARIOEMAIL: 'x@y.co',
      USUARIOFECHAREGISTRO: sqlCrudo(AHORA_UTC),
    })
    expect(id).toBe(86602)
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0].sql).toBe(
      'INSERT INTO USUARIO (USUARIOID, USUARIOEMAIL, USUARIOFECHAREGISTRO) VALUES (NULL, :1, ' +
        'CAST(SYS_EXTRACT_UTC(SYSTIMESTAMP) AS DATE)) RETURNING USUARIOID INTO :2',
    )
    expect(llamadas[0].params?.[0]).toBe('x@y.co')
    expect(llamadas[0].params?.[1]).toMatchObject({ dir: expect.any(Number) })
  })

  it('sin trigger usa la secuencia en el VALUES (lo que hacía el código en el XE)', async () => {
    reiniciarTriggersDeId(new Map())
    const { ej, llamadas } = falso({ id: 313096 })
    const id = await insertarConId(ej, 'persona', 'personaid', { secuencia: 'PERSONAID' }, { PERSONAESTADO: 1 })
    expect(id).toBe(313096)
    expect(llamadas[0].sql).toBe('INSERT INTO PERSONA (PERSONAID, PERSONAESTADO) VALUES (PERSONAID.NEXTVAL, :1) RETURNING PERSONAID INTO :2')
  })

  it('sin trigger y sin secuencia hace MAX+1 como antes', async () => {
    reiniciarTriggersDeId(new Map([['OTRA', 'OTRAID']]))
    const { ej, llamadas } = falso({ max: 42, id: 42 })
    const id = await insertarConId(ej, 'CONVOCATORIA', 'CONVOCATORIAID', { maxMasUno: true }, { CONVOCATORIAESTADO: 1 })
    expect(id).toBe(42)
    expect(llamadas[0].sql).toBe('SELECT NVL(MAX(CONVOCATORIAID), 0) + 1 AS "id" FROM CONVOCATORIA')
    expect(llamadas[1].sql).toBe('INSERT INTO CONVOCATORIA (CONVOCATORIAID, CONVOCATORIAESTADO) VALUES (:1, :2) RETURNING CONVOCATORIAID INTO :3')
    expect(llamadas[1].params?.slice(0, 2)).toEqual([42, 1])
  })

  it('un trigger que asigna otra columna no cuenta como trigger de la llave', async () => {
    reiniciarTriggersDeId(new Map([['USUARIO', 'OTRACOL']]))
    const { ej, llamadas } = falso()
    await insertarConId(ej, 'USUARIO', 'USUARIOID', { secuencia: 'USUARIOID' }, { A: 1 })
    expect(llamadas[0].sql).toContain('VALUES (USUARIOID.NEXTVAL, :1)')
  })

  it('rechaza la llave entre los valores y los identificadores raros', async () => {
    reiniciarTriggersDeId(new Map())
    const { ej } = falso()
    await expect(insertarConId(ej, 'USUARIO', 'USUARIOID', { secuencia: 'USUARIOID' }, { USUARIOID: 5 })).rejects.toThrow(/lo pone la base/)
    await expect(insertarConId(ej, 'USUARIO; DROP', 'USUARIOID', { secuencia: 'USUARIOID' }, {})).rejects.toThrow(/tabla inválido/)
    await expect(insertarConId(ej, 'USUARIO', 'USUARIOID', { secuencia: 'X.Y' }, {})).rejects.toThrow(/secuencia inválido/)
  })
})

describe('triggersDeId', () => {
  afterEach(() => reiniciarTriggersDeId())

  it('carga una sola vez y arma el mapa tabla -> columna', async () => {
    const { ej, llamadas } = falso({
      triggers: [
        { tabla: 'CRONOGRAMARADICADO', cuerpo: 'BEGIN SELECT RadicadoId.NEXTVAL INTO :new.RadicadoId FROM DUAL; END;' },
        { tabla: 'RARA', cuerpo: 'BEGIN NULL; END;' },
      ],
    })
    const m1 = await triggersDeId(ej)
    const m2 = await triggersDeId(ej)
    expect(m1).toBe(m2)
    expect([...m1]).toEqual([['CRONOGRAMARADICADO', 'RADICADOID']])
    expect(llamadas.filter((l) => l.sql.includes('ALL_TRIGGERS'))).toHaveLength(1)
  })

  it('si la carga falla, la próxima vez vuelve a intentar', async () => {
    let n = 0
    const ej: Ejecutor = {
      query: () => (++n === 1 ? Promise.reject(new Error('red')) : Promise.resolve([])),
    }
    await expect(triggersDeId(ej)).rejects.toThrow('red')
    await expect(triggersDeId(ej)).resolves.toEqual(new Map())
  })
})

describe('leerId', () => {
  it('lee el id de los outBinds posicionales y rechaza lo que no es un id', () => {
    expect(leerId([[123]])).toBe(123)
    expect(leerId([['456']])).toBe(456)
    expect(() => leerId([[]])).toThrow()
    expect(() => leerId([[null]])).toThrow()
    expect(() => leerId(undefined)).toThrow()
  })
})
