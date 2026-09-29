import type { DataSource } from 'typeorm'
import { reiniciarTriggersDeId } from '../common/db/ids'
import { ModificacionesService } from './modificaciones.service'

// DataSource falso: guarda cada SQL; el RETURNING responde el id dado y el MAX+1 el número dado
function falso(respuestas: { id?: number; max?: number } = {}) {
  const llamadas: { sql: string; params?: unknown[] }[] = []
  const ds = {
    query: (sql: string, params?: unknown[]) => {
      llamadas.push({ sql, params })
      if (sql.includes('RETURNING')) return Promise.resolve([[respuestas.id ?? 901]])
      if (sql.includes('COALESCE(MAX(')) return Promise.resolve([{ nid: respuestas.max ?? 40 }])
      return Promise.resolve([])
    },
  } as unknown as DataSource
  return { servicio: new ModificacionesService(ds), llamadas }
}

// separa por las comas de primer nivel: las de TO_DATE(...) y CAST(...) no cuentan
function partes(lista: string): string[] {
  const salida: string[] = []
  let nivel = 0
  let actual = ''
  for (const ch of lista) {
    if (ch === '(') nivel++
    if (ch === ')') nivel--
    if (ch === ',' && nivel === 0) {
      salida.push(actual.trim())
      actual = ''
    } else actual += ch
  }
  salida.push(actual.trim())
  return salida
}

/** columna -> expresión del VALUES */
function columnas(sql: string): Map<string, string> {
  const m = /INSERT INTO \w+\s*\(([^)]*)\)\s*VALUES\s*\(([\s\S]*)\)\s*RETURNING/.exec(sql)
  if (!m) throw new Error(`no es un INSERT ... RETURNING: ${sql}`)
  const cols = partes(m[1])
  const vals = partes(m[2])
  expect(vals).toHaveLength(cols.length)
  return new Map(cols.map((c, i) => [c, vals[i]]))
}

const horaLocal = /SYSDATE|(?<!SYS_EXTRACT_UTC\()SYSTIMESTAMP/
const dto = { tipoModificacionId: 3, fechaEnvio: '2026-09-01', observaciones: ' Cambio de sede ' }

describe('ModificacionesService.crear', () => {
  afterEach(() => reiniciarTriggersDeId())

  it('con el trigger de id (las dos bases) manda NULL y responde el id del RETURNING', async () => {
    reiniciarTriggersDeId(new Map([['MODIFICACIONES', 'MODIFICACIONESID']]))
    const { servicio, llamadas } = falso({ id: 88 })

    const r = await servicio.crear(7, dto, 1, 1)

    expect(r).toEqual({ mensaje: 'Modificación registrada correctamente.', id: 88 })
    expect(llamadas).toHaveLength(1)
    const { sql, params } = llamadas[0]
    const c = columnas(sql)
    expect(c.get('MODIFICACIONESID')).toBe(':1')
    expect(c.get('MODIFICACIONESFECHAENVIO')).toBe("TO_DATE(:4, 'YYYY-MM-DD')")
    expect(c.get('MODIFICACIONESFECHAREGIS')).toBe('CAST((now() AT TIME ZONE \'UTC\') AS timestamp)')
    expect(c.get('MODIFICACIONESFECHAREMI')).toBe('CAST((now() AT TIME ZONE \'UTC\') AS timestamp)')
    expect(sql).toContain('RETURNING MODIFICACIONESID INTO $6')
    expect(params?.slice(0, 5)).toEqual([null, 7, 3, '2026-09-01', 'Cambio de sede'])
    expect(params?.[5]).toMatchObject({ dir: expect.any(Number) })
    expect(horaLocal.test(sql)).toBe(false)
  })

  it('sin trigger vuelve al MAX+1 de antes, pero responde el id que quedó en la fila', async () => {
    reiniciarTriggersDeId(new Map())
    const { servicio, llamadas } = falso({ id: 41, max: 41 })

    const r = await servicio.crear(7, dto, 1, 1)

    expect(r.id).toBe(41)
    expect(llamadas[0].sql).toContain('SELECT COALESCE(MAX(MODIFICACIONESID), 0) + 1')
    expect(llamadas[1].params?.[0]).toBe(41)
  })
})
