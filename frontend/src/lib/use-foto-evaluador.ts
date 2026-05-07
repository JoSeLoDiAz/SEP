import api from '@/lib/api'
import { useEffect, useState } from 'react'

/** Carga la foto del evaluador como blob URL usando axios (con el JWT del
 *  interceptor). Devuelve null mientras carga o si no hay foto. Revoca el
 *  blob al desmontar para no filtrar memoria. */
export function useFotoEvaluador(evaluadorId: number, tieneFoto: boolean): string | null {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!tieneFoto || !evaluadorId) { setSrc(null); return }

    let cancelado = false
    let url: string | null = null
    api.get(`/evaluadores/${evaluadorId}/foto`, { responseType: 'blob' })
      .then(r => {
        if (cancelado) return
        url = URL.createObjectURL(r.data as Blob)
        setSrc(url)
      })
      .catch(() => { if (!cancelado) setSrc(null) })

    return () => {
      cancelado = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [evaluadorId, tieneFoto])

  return src
}
