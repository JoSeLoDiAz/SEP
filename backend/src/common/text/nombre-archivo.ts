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
