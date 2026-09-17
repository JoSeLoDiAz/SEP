/**
 * Hace que PostgreSQL devuelva los números como los devuelve Oracle.
 *
 * El conector `pg` entrega `bigint` y `numeric` como **cadena**, no como número, para no perder precisión con valores
 * de más de 2^53. `node-oracledb` entrega `NUMBER` como número de JavaScript, así que sin esto la misma consulta
 * devuelve `'108807'` en un motor y `108807` en el otro: las comparaciones con `===` fallan, y `a + b` concatena en
 * vez de sumar. Nada de eso da error, solo resultados equivocados.
 *
 * Pasar a `Number` no pierde nada aquí: el id más alto del SEP anda por los 430.000 y el límite exacto de JavaScript
 * está en 9.007.199.254.740.991. Y aunque lo pasara, el comportamiento sería el mismo que ya tiene la app contra
 * Oracle, que usa el mismo tipo de JavaScript.
 */
import { types } from 'pg'

const INT8 = 20
const NUMERIC = 1700

let hecho = false

export function ajustarTiposPostgres(): void {
  if (hecho) return // los parsers son globales de `pg`: registrarlos dos veces no aporta nada
  hecho = true
  const aNumero = (v: string | null) => (v === null ? null : Number(v))
  types.setTypeParser(INT8, aNumero)
  types.setTypeParser(NUMERIC, aNumero)
}
