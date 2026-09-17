import { fijarMotor } from './motor'
import { insertarConId, leerId, reiniciarTriggersDeId, sqlCrudo, type Ejecutor } from './ids'

// El camino de PostgreSQL de insertarConId. El de Oracle está en ids.spec.ts y no cambia.
// datos inventados: nunca cédulas ni nombres reales en un fixture

type Llamada = { sql: string; params?: unknown[] }

function ejecutor(responder: (sql: string) => unknown): { ej: Ejecutor; hechas: Llamada[] } {
  const hechas: Llamada[] = []
  const ej: Ejecutor = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      hechas.push({ sql, params })
      return responder(sql)
    }),
  }
  return { ej, hechas }
}

describe('insertarConId en PostgreSQL', () => {
  beforeEach(() => fijarMotor('postgres'))
  afterEach(() => {
    reiniciarTriggersDeId()
    fijarMotor('oracle')
  })

  it('cuando la llave la pone la base, NO la manda: en PostgreSQL un NULL guardaría un nulo de verdad', async () => {
    reiniciarTriggersDeId(new Map([['PERSONA', 'PERSONAID']]))
    const { ej, hechas } = ejecutor(() => [{ personaid: 77 }])

    const id = await insertarConId(ej, 'PERSONA', 'PERSONAID', { maxMasUno: true }, { PERSONANOMBRE: 'Marta Elena' })

    expect(id).toBe(77)
    const [ins] = hechas
    expect(ins.sql).toContain('INSERT INTO PERSONA (PERSONANOMBRE)')
    expect(ins.sql).not.toContain('PERSONAID,')
    expect(ins.sql).not.toContain('NULL')
    expect(ins.sql.trim().endsWith('RETURNING PERSONAID')).toBe(true)
    // sin bind de salida: en PostgreSQL el RETURNING devuelve filas
    expect(ins.params).toEqual(['Marta Elena'])
  })

  it('sin llave automática usa nextval de su secuencia, no NEXTVAL de Oracle', async () => {
    reiniciarTriggersDeId(new Map())
    const { ej, hechas } = ejecutor(() => [{ radicadoid: 5 }])

    await insertarConId(ej, 'RADICADO', 'RADICADOID', { secuencia: 'RADICADOID' }, { RADICADOTEXTO: 'x' })

    expect(hechas[0].sql).toContain("VALUES (nextval('radicadoid'), $1)")
    expect(hechas[0].sql).not.toContain('.NEXTVAL')
  })

  it('con MAX+1 pregunta con COALESCE, que es lo que entiende PostgreSQL', async () => {
    reiniciarTriggersDeId(new Map())
    const { ej, hechas } = ejecutor((sql) => (sql.startsWith('SELECT') ? [{ id: 9 }] : [{ notaid: 9 }]))

    const id = await insertarConId(ej, 'NOTA', 'NOTAID', { maxMasUno: true }, { NOTATEXTO: 'x' })

    expect(hechas[0].sql).toContain('COALESCE(MAX(NOTAID), 0) + 1')
    expect(hechas[0].sql).not.toContain('COALESCE(')
    expect(hechas[1].params?.[0]).toBe(9)
    expect(id).toBe(9)
  })

  it('un SqlCrudo sigue yendo tal cual, sin convertirse en parámetro', async () => {
    reiniciarTriggersDeId(new Map([['TRAZA', 'TRAZAID']]))
    const { ej, hechas } = ejecutor(() => [{ trazaid: 1 }])

    await insertarConId(ej, 'TRAZA', 'TRAZAID', { maxMasUno: true }, {
      TRAZAFECHA: sqlCrudo('CAST((now() AT TIME ZONE \'UTC\') AS timestamp)'),
      TRAZATEXTO: 'x',
    })

    expect(hechas[0].sql).toContain('VALUES (CAST((now() AT TIME ZONE \'UTC\') AS timestamp), $1)')
    expect(hechas[0].params).toEqual(['x'])
  })

  it('avisa si el RETURNING no trae un id utilizable', async () => {
    reiniciarTriggersDeId(new Map([['PERSONA', 'PERSONAID']]))
    const { ej } = ejecutor(() => [])

    await expect(insertarConId(ej, 'PERSONA', 'PERSONAID', { maxMasUno: true }, { PERSONANOMBRE: 'x' }))
      .rejects.toThrow('no devolvió un id válido')
  })
})

describe('leerId entiende las dos formas', () => {
  it('la fila de PostgreSQL', () => {
    expect(leerId([{ personaid: 42 }])).toBe(42)
  })

  it('el bind de salida de Oracle', () => {
    expect(leerId([[42]])).toBe(42)
  })

  it('rechaza el cero y el nulo en las dos', () => {
    expect(() => leerId([{ personaid: 0 }])).toThrow()
    expect(() => leerId([[null]])).toThrow()
  })
})

describe('el motor por defecto', () => {
  it('es Oracle mientras DB_TIPO no diga otra cosa', () => {
    expect(fijarMotor(undefined)).toBe('oracle')
    expect(fijarMotor('')).toBe('oracle')
    expect(fijarMotor('POSTGRES')).toBe('postgres')
    expect(fijarMotor(' postgres ')).toBe('postgres')
    fijarMotor('oracle')
  })
})
