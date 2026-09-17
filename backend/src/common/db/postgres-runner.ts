/**
 * Conecta el traductor de SQL al ejecutor de consultas, en un solo punto.
 *
 * `DataSource.query` crea un ejecutor con `this.createQueryRunner()` y le pasa la consulta; `EntityManager.query`
 * llama a su vez a `DataSource.query`. Envolviendo `createQueryRunner` de la instancia quedan cubiertos los dos
 * caminos, y con ellos las 1.027 consultas crudas del backend, sin tocar un solo servicio y sin importar nada de
 * las tripas de TypeORM.
 *
 * Solo se envuelve cuando la app habla con PostgreSQL. Contra Oracle no se llama y el SQL viaja tal cual.
 *
 * Lo que genera TypeORM por su cuenta (repositorios, constructor de consultas) pasa por aquí también, pero sale
 * intacto: ya viene con parámetros `$n` y sin funciones de Oracle, así que no hay nada que traducir.
 */
import type { DataSource, QueryRunner } from 'typeorm'
import { aPostgres, identificadoresCitados } from './postgres-sql'

const YA = Symbol('sql-traducido')

type ConMarca = { [YA]?: boolean }

/** `query` de TypeORM está sobrecargado; para reenviar la llamada tal cual basta con esta forma. */
type Consulta = (sql: string, parametros?: unknown[], resultadoConEstructura?: boolean) => Promise<unknown>

/**
 * Devuelve las filas con los nombres de columna que la app espera de Oracle.
 *
 * PostgreSQL pliega a minúscula todo identificador que no vaya entre comillas, así que `SELECT P.PERSONAID` vuelve
 * como `personaid`. Oracle lo devuelve como `PERSONAID`, que es lo que leen los servicios. La diferencia no da error:
 * `fila['PERSONAID']` sale `undefined` y la consulta aparenta no haber encontrado nada, que es la peor forma de fallar.
 *
 * Solo se suben las claves que PostgreSQL plegó. Las que el SQL pidió entre comillas —`AS "aprobaciones"`,
 * `AS "totalCertificados"`— llegan con la forma exacta que pidieron y se quedan como están: subirlas también rompería
 * al revés el código que las lee en minúscula.
 */
function comoOracle(resultado: unknown, citados: Set<string>): unknown {
  if (!Array.isArray(resultado)) return resultado
  return resultado.map((fila) => {
    // `null`, los contadores de filas afectadas y cualquier cosa que no sea un objeto plano viajan sin tocar
    if (fila === null || typeof fila !== 'object' || Array.isArray(fila)) return fila
    const salida: Record<string, unknown> = {}
    for (const [clave, valor] of Object.entries(fila as Record<string, unknown>)) {
      salida[citados.has(clave) ? clave : clave.toUpperCase()] = valor
    }
    return salida
  })
}

/** Envuelve el ejecutor de consultas para que el SQL de Oracle salga traducido a PostgreSQL. */
export function envolverParaPostgres(ds: DataSource): void {
  const conMarca = ds as unknown as ConMarca
  if (conMarca[YA]) return // idempotente: llamarlo dos veces no encadena traducciones
  conMarca[YA] = true

  const crear = ds.createQueryRunner.bind(ds)
  ds.createQueryRunner = ((modo?: 'master' | 'slave') => {
    const qr = crear(modo) as QueryRunner & ConMarca
    if (qr[YA]) return qr
    qr[YA] = true
    const original = qr.query.bind(qr) as Consulta
    const traducida: Consulta = async (sql, parametros, resultadoConEstructura) => {
      const filas = await original(aPostgres(sql), parametros, resultadoConEstructura)
      return comoOracle(filas, identificadoresCitados(sql))
    }
    qr.query = traducida as unknown as QueryRunner['query']
    return qr
  }) as DataSource['createQueryRunner']
}
