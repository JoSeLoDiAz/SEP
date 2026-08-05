import api from '@/lib/api'
import { useEffect, useState } from 'react'

/**
 * Carga la foto del evaluador como blob URL, con el JWT del interceptor.
 * Devuelve null mientras carga o si no hay foto, y revoca el blob al
 * desmontar para no filtrar memoria.
 *
 * Reintenta una vez cuando la petición falla por algo que no sea un 404.
 * Sin eso, un tropiezo momentáneo de red dejaba la foto vacía hasta que
 * alguien recargara la página — y como la pantalla entonces muestra "Sube una
 * foto de tipo carné", parecía que el evaluador no tenía foto cuando sí la
 * tenía, con el riesgo de que alguien la volviera a cargar encima.
 */
export function useFotoEvaluador(evaluadorId: number, tieneFoto: boolean): string | null {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!tieneFoto || !evaluadorId) { setSrc(null); return }

    let cancelado = false
    let url: string | null = null

    const pedir = (reintentos: number): Promise<void> =>
      api.get(`/evaluadores/${evaluadorId}/foto`, { responseType: 'blob' })
        .then(r => {
          if (cancelado) return
          url = URL.createObjectURL(r.data as Blob)
          setSrc(url)
        })
        .catch((err: unknown) => {
          if (cancelado) return
          // Un 404 es "no tiene foto": no hay nada que reintentar.
          const estado = (err as { response?: { status?: number } })?.response?.status
          if (reintentos > 0 && estado !== 404) {
            return new Promise<void>(r => setTimeout(r, 800)).then(() => pedir(reintentos - 1))
          }
          setSrc(null)
        })

    void pedir(1)

    return () => {
      cancelado = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [evaluadorId, tieneFoto])

  return src
}
