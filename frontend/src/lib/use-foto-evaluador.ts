import api from '@/lib/api'
import { encolarFoto } from '@/lib/cola-fotos'
import { useEffect, useState } from 'react'

// foto del evaluador como blob URL, descargada en fila (ver cola-fotos)
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
          // 404 = no tiene foto, no se reintenta
          const estado = (err as { response?: { status?: number } })?.response?.status
          if (reintentos > 0 && estado !== 404) {
            return new Promise<void>(r => setTimeout(r, 800)).then(() => pedir(reintentos - 1))
          }
          setSrc(null)
        })

    // el segundo callback deja saltar el turno si la tarjeta ya se desmontó
    encolarFoto(() => pedir(1), () => cancelado)

    return () => {
      cancelado = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [evaluadorId, tieneFoto])

  return src
}
