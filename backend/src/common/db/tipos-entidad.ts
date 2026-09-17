/**
 * Los tipos y los nombres de las seis entidades de TypeORM, en la forma que entiende cada motor.
 *
 * Las 1.027 consultas del SEP son SQL crudo y las arregla el traductor, pero estas entidades no pasan por ahí: TypeORM
 * construye su SQL a partir de los decoradores, y ahí hay dos cosas que Oracle acepta y PostgreSQL no.
 *
 *  - **Los tipos.** `number`, `nchar` y `date` son de Oracle. PostgreSQL rechaza el módulo entero al arrancar, con
 *    «Data type "number" ... is not supported by "postgres" database», antes de ejecutar una sola consulta.
 *  - **Los nombres.** TypeORM siempre entrecomilla en PostgreSQL, así que `@Entity('USUARIO')` sale como `"USUARIO"` y
 *    no encuentra la tabla: las 220 tablas se cargaron en minúscula, justamente para que el SQL crudo en MAYÚSCULA
 *    siguiera valiendo sin comillas.
 *
 * Se decide con `process.env` y no con `ConfigService` porque los decoradores se evalúan al importar el fichero, mucho
 * antes de que Nest construya nada. Es la misma variable `DB_TIPO` que elige el conector en `app.module.ts`.
 */
const ES_POSTGRES =
  (process.env.DB_TIPO ?? 'oracle').trim().toLowerCase() === 'postgres'

/** `NUMBER` de Oracle. En PostgreSQL las llaves quedaron en `bigint` al unificar los tipos de las 248 foráneas. */
export const NUMERO = ES_POSTGRES ? 'bigint' : 'number'

/** `NCHAR` de Oracle, que rellena con espacios. En PostgreSQL la columna equivalente es `varchar`, sin relleno. */
export const TEXTO_FIJO = ES_POSTGRES ? 'varchar' : 'nchar'

/** `DATE` de Oracle lleva hora; el `date` de PostgreSQL no, así que el equivalente es `timestamp`. */
export const FECHA = ES_POSTGRES ? 'timestamp' : 'date'

/** El nombre de una tabla o de una columna tal como hay que escribirlo en cada motor. */
export function nombreEnBase(n: string): string {
  return ES_POSTGRES ? n.toLowerCase() : n
}
