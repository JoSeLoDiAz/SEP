import {
  Ejecutor,
  insertarConId,
  leerId,
  reiniciarTriggersDeId,
  sqlCrudo,
  triggersDeId,
} from './ids'
import { AHORA_UTC } from './fecha-utc'

/**
 * Antes había dos archivos, uno por motor: este probaba el camino de Oracle —los triggers de GeneXus, el bind de
 * salida— y `ids-postgres.spec.ts` el otro. Con Oracle fuera queda un solo camino y un solo archivo.
 */

/** Ejecutor falso: guarda cada SQL con sus parámetros y responde según el texto. */
function falso(respuestas: { max?: number; id?: unknown; defectos?: { tabla: string; columna: string }[] } = {}) {
  const llamadas: { sql: string; params?: unknown[] }[] = []
  const ej: Ejecutor = {
    query: (sql: string, params?: unknown[]) => {
      llamadas.push({ sql, params })
      if (sql.includes('information_schema.columns')) return Promise.resolve(respuestas.defectos ?? [])
      if (sql.startsWith('SELECT COALESCE(MAX(')) return Promise.resolve([{ id: respuestas.max ?? 41 }])
      return Promise.resolve([{ ID: respuestas.id ?? 777 }])
    },
  }
  return { ej, llamadas }
}

describe('insertarConId', () => {
  afterEach(() => reiniciarTriggersDeId())

  it('cuando la llave la pone la base, NO la manda: un NULL guardaría un nulo de verdad', async () => {
    reiniciarTriggersDeId(new Map([['USUARIO', 'USUARIOID']]))
    const { ej, llamadas } = falso({ id: 86602 })

    const id = await insertarConId(ej, 'USUARIO', 'USUARIOID', { secuencia: 'USUARIOID' }, {
      USUARIOEMAIL: 'a@sena.edu.co',
      USUARIOFECHAREGISTRO: sqlCrudo(AHORA_UTC),
    })

    expect(id).toBe(86602)
    // la llave no aparece ni entre las columnas ni entre los valores
    expect(llamadas[0].sql).toBe(
      'INSERT INTO USUARIO (USUARIOEMAIL, USUARIOFECHAREGISTRO) ' +
      `VALUES ($1, ${AHORA_UTC}) RETURNING USUARIOID`,
    )
    expect(llamadas[0].params).toEqual(['a@sena.edu.co'])
    // y no se pide ningún id por adelantado
    expect(llamadas.some((l) => l.sql.includes('MAX(') || l.sql.includes('nextval'))).toBe(false)
  })

  it('sin llave automática usa nextval de su secuencia', async () => {
    reiniciarTriggersDeId(new Map())
    const { ej, llamadas } = falso({ id: 91 })

    await insertarConId(ej, 'RADICADO', 'RADICADOID', { secuencia: 'RADICADOID' }, { RADICADOTEXTO: 'x' })

    expect(llamadas[0].sql).toContain("VALUES (nextval('radicadoid'), $1)")
    expect(llamadas[0].sql).not.toContain('.NEXTVAL')
  })

  it('con MAX+1 pregunta con COALESCE, que es lo que entiende PostgreSQL', async () => {
    reiniciarTriggersDeId(new Map())
    const { ej, llamadas } = falso({ max: 41, id: 41 })

    await insertarConId(ej, 'NOTA', 'NOTAID', { maxMasUno: true }, { NOTATEXTO: 'x' })

    expect(llamadas[0].sql).toBe('SELECT COALESCE(MAX(NOTAID), 0) + 1 AS "id" FROM NOTA')
    expect(llamadas[0].sql).not.toContain('NVL(')
    // el id calculado entra como primer parámetro y el resto se corre
    expect(llamadas[1].sql).toContain('VALUES ($1, $2)')
    expect(llamadas[1].params).toEqual([41, 'x'])
  })

  it('un SqlCrudo va tal cual, sin convertirse en parámetro', async () => {
    reiniciarTriggersDeId(new Map())
    const { ej, llamadas } = falso({ id: 5 })

    await insertarConId(ej, 'TRAZA', 'TRAZAID', { secuencia: 'TRAZAID' }, {
      TRAZAFECHA: sqlCrudo(AHORA_UTC),
      TRAZATEXTO: 'hola',
    })

    expect(llamadas[0].sql).toContain(`VALUES (nextval('trazaid'), ${AHORA_UTC}, $1)`)
    expect(llamadas[0].params).toEqual(['hola'])
  })

  it('una llave automática de OTRA columna no cuenta como la de esta', async () => {
    reiniciarTriggersDeId(new Map([['USUARIO', 'OTRACOL']]))
    const { ej, llamadas } = falso()

    await insertarConId(ej, 'USUARIO', 'USUARIOID', { secuencia: 'USUARIOID' }, { A: 1 })

    expect(llamadas[0].sql).toContain("VALUES (nextval('usuarioid'), $1)")
  })

  it('rechaza la llave entre los valores y los identificadores raros', async () => {
    reiniciarTriggersDeId(new Map())
    const { ej } = falso()
    await expect(insertarConId(ej, 'USUARIO', 'USUARIOID', { secuencia: 'USUARIOID' }, { USUARIOID: 5 }))
      .rejects.toThrow(/lo pone la base/)
    await expect(insertarConId(ej, 'USUARIO; DROP', 'USUARIOID', { secuencia: 'USUARIOID' }, {}))
      .rejects.toThrow(/tabla inválido/)
    await expect(insertarConId(ej, 'USUARIO', 'USUARIOID', { secuencia: 'X.Y' }, {}))
      .rejects.toThrow(/secuencia inválido/)
  })

  it('avisa si el RETURNING no trae un id utilizable', async () => {
    reiniciarTriggersDeId(new Map([['NOTA', 'NOTAID']]))
    const ej: Ejecutor = { query: () => Promise.resolve([]) }
    await expect(insertarConId(ej, 'NOTA', 'NOTAID', { maxMasUno: true }, { A: 1 }))
      .rejects.toThrow(/no devolvió un id válido/)
  })
})

describe('triggersDeId', () => {
  afterEach(() => reiniciarTriggersDeId())

  it('carga una sola vez y arma el mapa tabla -> columna', async () => {
    const { ej, llamadas } = falso({
      defectos: [
        { tabla: 'cronogramaradicado', columna: 'radicadoid' },
        { tabla: 'nota', columna: 'notaid' },
      ],
    })

    const m1 = await triggersDeId(ej)
    const m2 = await triggersDeId(ej)

    expect(m1).toBe(m2)
    // el diccionario responde en minúscula y aquí se compara en mayúscula
    expect([...m1]).toEqual([['CRONOGRAMARADICADO', 'RADICADOID'], ['NOTA', 'NOTAID']])
    expect(llamadas.filter((l) => l.sql.includes('information_schema.columns'))).toHaveLength(1)
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
  it('lee el id de la fila que devuelve el RETURNING', () => {
    expect(leerId([{ usuarioid: 123 }])).toBe(123)
    expect(leerId([{ ID: '456' }])).toBe(456)
  })

  it('rechaza lo que no es un id', () => {
    expect(() => leerId([])).toThrow()
    expect(() => leerId([{ id: null }])).toThrow()
    expect(() => leerId([{ id: 0 }])).toThrow()
    expect(() => leerId(undefined)).toThrow()
  })
})
