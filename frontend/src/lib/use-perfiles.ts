'use client'

import api from '@/lib/api'
import { useEffect, useState } from 'react'

/** Ids de los perfiles con reglas propias en el frontend, tal como los da GET /perfiles/claves.
 *  El del gestor de evaluadores es el 15 en el XE y el 103 en el Exadata: por eso no se escribe en el código. */
export interface ClavesPerfil {
  admin: number
  coordinador: number
  evaluador: number
  gestorEvaluadores: number
}

// una sola llamada por carga de la página, compartida por todos los que las piden. Dependen de la base y no del
// usuario, así que no hace falta borrarlas al cerrar sesión: el 401 y la pausa por migración recargan la página
let claves: ClavesPerfil | null = null
let enCurso: Promise<ClavesPerfil> | null = null

function esId(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0
}

export function cargarClavesPerfil(): Promise<ClavesPerfil> {
  if (claves) return Promise.resolve(claves)
  if (!enCurso) {
    enCurso = api.get<Partial<ClavesPerfil> | null>('/perfiles/claves')
      .then(r => {
        const d: Partial<ClavesPerfil> = r.data ?? {}
        // una respuesta rara (el html de un proxy, un id nulo) cuenta como fallo: quien las pide puede reintentar
        if (!esId(d.admin) || !esId(d.coordinador) || !esId(d.evaluador) || !esId(d.gestorEvaluadores)) {
          throw new Error('GET /perfiles/claves no devolvió los ids de perfil')
        }
        claves = { admin: d.admin, coordinador: d.coordinador, evaluador: d.evaluador, gestorEvaluadores: d.gestorEvaluadores }
        return claves
      })
      .finally(() => { enCurso = null })
  }
  return enCurso
}

/** Las claves de perfil, o null mientras llegan (o si no se pudieron traer). */
export function usePerfiles(): ClavesPerfil | null {
  const [valor, setValor] = useState<ClavesPerfil | null>(null)

  useEffect(() => {
    let cancelado = false
    cargarClavesPerfil()
      .then(c => { if (!cancelado) setValor(c) })
      .catch(() => { /* silencio: sin las claves, lo que depende de ellas no se muestra */ })
    return () => { cancelado = true }
  }, [])

  return valor
}

/** Admin, coordinador y gestor de evaluadores: los que administran el banco y la retroalimentación. */
export function perfilesGestion(c: ClavesPerfil): number[] {
  return [c.admin, c.coordinador, c.gestorEvaluadores]
}
