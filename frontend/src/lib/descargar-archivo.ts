import api from '@/lib/api'

/** Descarga un archivo del backend (con el JWT del interceptor) y lo abre en
 *  una pestaña nueva para previsualización (PDF). El blob se revoca tras un
 *  pequeño delay para no romper el visor del navegador. */
export async function abrirArchivo(url: string): Promise<void> {
  const res = await api.get(url, { responseType: 'blob' })
  const blob = new Blob([res.data as Blob], { type: (res.data as Blob).type || 'application/pdf' })
  const objectUrl = URL.createObjectURL(blob)
  window.open(objectUrl, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
}

/** Descarga un archivo del backend (con JWT) y lo guarda con el nombre dado. */
export async function descargarArchivo(url: string, nombreSugerido: string): Promise<void> {
  const res = await api.get(url, { responseType: 'blob' })
  const blob = new Blob([res.data as Blob], { type: (res.data as Blob).type || 'application/octet-stream' })
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = nombreSugerido
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000)
}
