import api from '@/lib/api'

/** Lo que un navegador sabe dibujar. Lo demás lo baja. */
function sePuedeVerEnPestana(mime: string): boolean {
  return mime.startsWith('image/')
    || mime === 'application/pdf'
    || mime.startsWith('text/plain')
}

export async function abrirArchivo(url: string, nombreSugerido?: string): Promise<void> {
  // se abre antes del fetch: fuera del gesto del clic el bloqueador la tumba
  const pestana = window.open('about:blank', '_blank')

  try {
    const res = await api.get(url, { responseType: 'blob' })
    const blob = new Blob([res.data as Blob], { type: (res.data as Blob).type || 'application/pdf' })
    const objectUrl = URL.createObjectURL(blob)

    // una url de blob no tiene nombre: el navegador lo guardaría como uuid sin extensión
    if (!sePuedeVerEnPestana(blob.type)) {
      if (pestana && !pestana.closed) pestana.close()
      URL.revokeObjectURL(objectUrl)
      await descargarArchivoConNombreDelServidor(url, nombreSugerido || 'documento')
      return
    }

    if (pestana && !pestana.closed) {
      pestana.location.href = objectUrl
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
      return
    }

    const a = document.createElement('a')
    a.href = objectUrl
    a.download = nombreSugerido || 'documento'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000)
  } catch (err) {
    if (pestana && !pestana.closed) pestana.close()
    throw err
  }
}

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

/** Soporta `filename*=UTF-8''...` (RFC 5987) y `filename="..."`. */
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

/** `timeoutMs` sube el límite de axios (15 s) para reportes que el backend arma al vuelo. */
export async function descargarArchivoConNombreDelServidor(
  url: string,
  fallback: string,
  timeoutMs?: number,
): Promise<void> {
  let res
  try {
    res = await api.get(url, { responseType: 'blob', ...(timeoutMs ? { timeout: timeoutMs } : {}) })
  } catch (err) {
    // con responseType blob el cuerpo del error también es Blob: data.message llega undefined
    const cuerpo = (err as { response?: { data?: unknown } })?.response?.data
    if (cuerpo instanceof Blob) {
      try {
        const texto = await cuerpo.text()
        const json = JSON.parse(texto) as { message?: string }
        if (json?.message) {
          const e = err as { response?: { data?: unknown } }
          e.response!.data = json
        }
      } catch { /* no era JSON */ }
    }
    throw err
  }
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
