/**
 * A qué base habla la app: Oracle (hoy) o PostgreSQL (la migración).
 *
 * Se fija una vez al arrancar, desde DB_TIPO, y se lee donde el SQL no puede ser el mismo en las dos. Casi todo lo
 * resuelve el traductor de `postgres-sql.ts` sin que nadie tenga que preguntar; esto es para lo que no se puede
 * traducir a ciegas, como quién pone la llave primaria en un INSERT.
 *
 * Por defecto Oracle: mientras DB_TIPO no diga otra cosa, nada cambia.
 */
export type Motor = 'oracle' | 'postgres'

let motor: Motor = 'oracle'

/** Lo llama el arranque con lo que diga DB_TIPO. */
export function fijarMotor(valor: string | undefined): Motor {
  motor = String(valor ?? '').trim().toLowerCase() === 'postgres' ? 'postgres' : 'oracle'
  return motor
}

export function motorActual(): Motor {
  return motor
}

export function esPostgres(): boolean {
  return motor === 'postgres'
}
