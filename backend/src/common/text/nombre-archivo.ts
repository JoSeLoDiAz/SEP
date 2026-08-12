// Busboy (bajo Multer) decodifica el nombre como latin1 aunque venga en UTF-8
export function nombreArchivoUtf8(original: string | null | undefined): string {
  const n = (original ?? '').trim()
  if (!n) return ''

  // por código y no por regex: el rango alto en un literal deja caracteres invisibles
  let tieneAltos = false
  for (let i = 0; i < n.length; i++) {
    if (n.charCodeAt(i) > 127) { tieneAltos = true; break }
  }
  if (!tieneAltos) return n

  const reinterpretado = Buffer.from(n, 'latin1').toString('utf8')

  // U+FFFD: no era UTF-8, el nombre ya venía bien
  if (reinterpretado.includes('�')) return n

  return reinterpretado
}

// Node serializa cabeceras en latin1 y lanza sobre U+00FF: ASCII en filename= y el real en filename*= (RFC 6266)
export function contentDisposition(nombre: string | null | undefined, enLinea: boolean): string {
  const base = (nombre ?? '').trim() || 'archivo'

  // NFKD y se descarta la tilde suelta: "Castrillón" -> "Castrillon", no "Castrillo_n"
  const ascii = base
    .normalize('NFKD')
    .split('')
    .filter(c => {
      const p = c.charCodeAt(0)
      return p < 0x300 || p > 0x36f   // marcas diacríticas combinantes
    })
    .map(c => {
      const p = c.charCodeAt(0)
      return p >= 0x20 && p <= 0x7e ? c : '_'
    })
    .join('')
    .replace(/"/g, '')
    .replace(/_+/g, '_') || 'archivo'

  // encodeURIComponent lanza con subrogados sueltos (emoji cortado por un slice)
  let utf8: string
  try { utf8 = encodeURIComponent(base) } catch { utf8 = encodeURIComponent(ascii) }

  return `${enLinea ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${utf8}`
}
