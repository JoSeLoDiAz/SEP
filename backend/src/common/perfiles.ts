/**
 * Perfiles cuyo id cambia de una base a otra.
 *
 * El "Gestor de evaluadores" es el 15 en el XE y el 103 en el Exadata: allí lo cargó su trigger de id, que le dio
 * otro número. Se resuelve una vez al arrancar: con PERFIL_GESTOR_EVALUADORES del .env si está y, si no, por el
 * nombre en PERFIL (tiene que haber exactamente uno con GESTOR y EVALUA). Los perfiles 1, 2, 7 y 9 son iguales en
 * las dos bases.
 */
import type { Ejecutor } from './db/ids'

export const PERFIL_ADMIN = 1
export const PERFIL_COORDINADOR = 2
export const PERFIL_EVALUADOR = 9

let gestor: number | null = null

export async function resolverPerfiles(
  ej: Ejecutor,
  desdeEnv?: string,
): Promise<{ gestorEvaluadores: number; origen: string }> {
  const env = (desdeEnv ?? '').trim()
  if (env) {
    const n = Number(env)
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`PERFIL_GESTOR_EVALUADORES no es un id válido: ${env}`)
    gestor = n
    return { gestorEvaluadores: n, origen: 'PERFIL_GESTOR_EVALUADORES' }
  }
  const filas = (await ej.query(
    `SELECT PERFILID AS "id" FROM PERFIL WHERE UPPER(PERFILNOMBRE) LIKE '%GESTOR%' AND UPPER(PERFILNOMBRE) LIKE '%EVALUA%'`,
  )) as { id: unknown }[]
  if (filas.length !== 1) {
    throw new Error(
      `No se pudo resolver el perfil gestor de evaluadores por nombre (${filas.length} coincidencias): ` +
        'fija PERFIL_GESTOR_EVALUADORES en el .env',
    )
  }
  const n = Number(filas[0].id)
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`El perfil gestor de evaluadores tiene un id raro: ${String(filas[0].id)}`)
  gestor = n
  return { gestorEvaluadores: n, origen: 'PERFIL por nombre' }
}

export function perfilGestorEvaluadores(): number {
  if (gestor === null) throw new Error('perfilGestorEvaluadores: los perfiles no se resolvieron al arrancar')
  return gestor
}

/** Admin, coordinador y gestor de evaluadores: los que administran el banco y la retroalimentación. */
export function perfilesGestion(): number[] {
  return [PERFIL_ADMIN, PERFIL_COORDINADOR, perfilGestorEvaluadores()]
}

/** Solo para pruebas. */
export function fijarPerfilGestorEvaluadores(id: number | null): void {
  gestor = id
}
