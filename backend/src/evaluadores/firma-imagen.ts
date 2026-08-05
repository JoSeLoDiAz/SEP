/**
 * Reconoce una imagen por sus primeros bytes, no por el nombre ni por el
 * `Content-Type` que anuncie el navegador. Los dos se pueden equivocar: el
 * navegador manda lo que diga la extensión, y la extensión la pone quien
 * guarda el archivo.
 *
 * Hace falta porque una foto que se guarda mal no avisa. Queda en la base de
 * datos como una columna con algo dentro, la ficha dice que el evaluador sí
 * tiene foto, y en pantalla no se ve nada — sin error, sin mensaje, sin forma
 * de distinguirla de una foto que nunca se cargó.
 */

/** Firmas de los formatos que un navegador dibuja en un <img>. */
const FIRMAS: Array<{ bytes: number[]; mime: string }> = [
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },  // \x89PNG
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif' },  // GIF8
  { bytes: [0x42, 0x4d], mime: 'image/bmp' },              // BM
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' }, // RIFF....WEBP
]

/** El formato real del contenido, o null si no se reconoce ninguno. */
export function mimeRealDeImagen(buffer: Buffer): string | null {
  for (const { bytes, mime } of FIRMAS) {
    if (buffer.length < bytes.length) continue
    if (bytes.every((b, i) => buffer[i] === b)) {
      // RIFF también encabeza los .wav y los .avi: lo que lo hace WebP son
      // los cuatro bytes del byte 8, después del tamaño del contenedor.
      if (mime === 'image/webp' && buffer.subarray(8, 12).toString('latin1') !== 'WEBP') continue
      return mime
    }
  }
  return null
}

/** Si el contenido empieza como una imagen que el navegador sepa dibujar. */
export function empiezaComoImagen(buffer: Buffer): boolean {
  return mimeRealDeImagen(buffer) !== null
}
