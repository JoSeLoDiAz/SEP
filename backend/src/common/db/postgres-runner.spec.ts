import type { DataSource } from 'typeorm'
import { envolverParaPostgres } from './postgres-runner'

// El envoltorio es el único punto donde se traduce el SQL, así que lo que importa es que de verdad lo atraviese
// todo lo que consulta: DataSource.query crea su ejecutor con createQueryRunner, y EntityManager pasa por ahí.

type Llamada = { sql: string; params?: unknown[] }

function dataSourceFalso() {
  const vistas: Llamada[] = []
  const ds = {
    // un ejecutor nuevo por llamada, como hace TypeORM; el que anota es siempre el mismo
    createQueryRunner: jest.fn(() => ({
      query: async (sql: string, params?: unknown[]) => {
        vistas.push({ sql, params })
        return []
      },
    })),
  } as unknown as DataSource
  return { ds, vistas }
}

describe('envolverParaPostgres', () => {
  it('el ejecutor recibe el SQL ya traducido', async () => {
    const { ds, vistas } = dataSourceFalso()
    envolverParaPostgres(ds)

    await ds.createQueryRunner().query('SELECT NVL(A, 0) FROM T WHERE B = :1', [1])

    expect(vistas[0].sql).toBe('SELECT COALESCE(A, 0) FROM T WHERE B = $1')
  })

  it('los parámetros llegan intactos', async () => {
    const { ds, vistas } = dataSourceFalso()
    envolverParaPostgres(ds)

    await ds.createQueryRunner().query('UPDATE T SET A = :1 WHERE ID = :2', ['x', 7])

    expect(vistas[0].params).toEqual(['x', 7])
  })

  it('envolver dos veces no encadena traducciones', async () => {
    const { ds, vistas } = dataSourceFalso()
    envolverParaPostgres(ds)
    envolverParaPostgres(ds)

    await ds.createQueryRunner().query('SELECT A FROM T WHERE B = :1')

    expect(vistas.map((v) => v.sql)).toEqual(['SELECT A FROM T WHERE B = $1'])
  })

  it('cada ejecutor nuevo también traduce', async () => {
    const { ds, vistas } = dataSourceFalso()
    envolverParaPostgres(ds)

    await ds.createQueryRunner().query('SELECT NVL(A, 0) FROM DUAL')
    await ds.createQueryRunner().query('SELECT B FROM T WHERE C = :1')

    expect(vistas[0].sql.trim()).toBe('SELECT COALESCE(A, 0)')
    expect(vistas[1].sql).toBe('SELECT B FROM T WHERE C = $1')
  })

  it('lo que ya viene en dialecto de PostgreSQL sale igual', async () => {
    const { ds, vistas } = dataSourceFalso()
    envolverParaPostgres(ds)

    await ds.createQueryRunner().query('SELECT "id" FROM "t" WHERE "id" = $1')

    expect(vistas[0].sql).toBe('SELECT "id" FROM "t" WHERE "id" = $1')
  })
})
