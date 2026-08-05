/**
 * Arregla el nombre de un archivo subido.
 *
 * Busboy —lo que hay debajo de Multer— decodifica el nombre del adjunto como
 * latin1, siempre. Los navegadores lo mandan en UTF-8, así que "Certificación"
 * llega y se guarda como "CertificaciÃ³n", y después se descarga con ese
 * nombre. En este módulo casi todos los archivos vienen con tilde en el
 * nombre ("Invitación", "Autorización", "Certificación"), así que no es un
 * caso raro: es el caso normal.
 *
 * La conversión se hace solo si el resultado es válido. Si el nombre ya venía
 * bien —un cliente que sí respeta RFC 2231, o un nombre sin tildes— se
 * devuelve intacto: reinterpretar a ciegas rompería lo que estaba bien.
 */
export function nombreArchivoUtf8(original: string | null | undefined): string {
  const n = (original ?? '').trim()
  if (!n) return ''

  // Sin nada por encima de ASCII no hay qué reinterpretar. Se compara por
  // código y no con una expresión regular: escribir el rango alto en un
  // literal deja caracteres de control invisibles en el fuente.
  let tieneAltos = false
  for (let i = 0; i < n.length; i++) {
    if (n.charCodeAt(i) > 127) { tieneAltos = true; break }
  }
  if (!tieneAltos) return n

  const reinterpretado = Buffer.from(n, 'latin1').toString('utf8')

  // U+FFFD significa que la secuencia no era UTF-8 válido: el nombre ya
  // estaba bien y lo que parecían bytes sueltos eran caracteres de verdad.
  if (reinterpretado.includes('�')) return n

  return reinterpretado
}

/**
 * Arma la cabecera `Content-Disposition` de una descarga.
 *
 * Existe porque escribir el nombre a mano dentro de `filename="..."` es una
 * bomba de relojería. Node serializa las cabeceras en latin1 y rechaza —con
 * una excepción— cualquier carácter por encima de U+00FF. Las tildes pasan,
 * pero el guion largo (–), las comillas tipográficas (’) y los emojis no; y
 * son justo los que aparecen cuando alguien nombra un archivo copiando de
 * Word o de Outlook. Un solo documento así quedaba imposible de descargar
 * para siempre, sin más arreglo que renombrarlo en la base de datos.
 *
 * Se mandan las dos formas que define el RFC 6266:
 *   · `filename=`  respaldo en ASCII puro — lo único que Node deja pasar sin
 *                  riesgo, y lo que usan los clientes antiguos.
 *   · `filename*=` el nombre de verdad en UTF-8, que es el que toman los
 *                  navegadores actuales.
 *
 * Antes la vista en línea percent-codificaba dentro de `filename=`, y como
 * los navegadores no decodifican ahí, el archivo se guardaba llamándose
 * "Castrill%C3%B3n.pdf". Con `filename*` aparte, el nombre llega bien.
 */
export function contentDisposition(nombre: string | null | undefined, enLinea: boolean): string {
  const base = (nombre ?? '').trim() || 'archivo'

  // NFKD separa la tilde de la letra, y la tilde suelta se DESCARTA en vez de
  // convertirse en "_": así "Castrillón" queda "Castrillon" y no
  // "Castrillo_n". El respaldo solo lo usan los clientes viejos, pero si va a
  // verse tiene que poder leerse.
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

  // encodeURIComponent lanza con pares subrogados sueltos —un nombre con un
  // emoji cortado a la mitad por un slice—: ahí se cae al respaldo ASCII.
  let utf8: string
  try { utf8 = encodeURIComponent(base) } catch { utf8 = encodeURIComponent(ascii) }

  return `${enLinea ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${utf8}`
}
