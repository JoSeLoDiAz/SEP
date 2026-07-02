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

/** Extrae el nombre del archivo de un header `Content-Disposition`.
 *  Soporta `filename*=UTF-8''...` (RFC 5987) y `filename="..."`. */
function nombreDesdeContentDisposition(header: string | undefined | null): string | null {
  if (!header) return null
  const utf8Match = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
  if (utf8Match) {
    try { return decodeURIComponent(utf8Match[1].trim()) } catch { /* fallthrough */ }
  }
  const asciiMatch = header.match(/filename\s*=\s*"?([^";]+)"?/i)
  if (asciiMatch) return asciiMatch[1].trim()
  return null
}

/** Descarga usando el nombre del `Content-Disposition` que envíe el server.
 *  Si el server no envía nombre, cae en el `fallback`. */
export async function descargarArchivoConNombreDelServidor(
  url: string,
  fallback: string,
): Promise<void> {
  const res = await api.get(url, { responseType: 'blob' })
  const blob = new Blob([res.data as Blob], { type: (res.data as Blob).type || 'application/octet-stream' })
  const cd = res.headers?.['content-disposition'] as string | undefined
  const nombre = nombreDesdeContentDisposition(cd) || fallback
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000)
}
