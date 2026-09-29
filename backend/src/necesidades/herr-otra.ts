/**
 * "Otro tipo de herramienta, ¿cuál?" del diagnóstico (NECESIDAD.NECESIDADHERROTRA).
 *
 * Es VARCHAR2(40 BYTE) en el Exadata y VARCHAR2(100 BYTE) en el XE, las dos en AL32UTF8: una tilde o una ñ ocupan
 * 2 bytes. Se aplica el tope de producción en las dos bases y se revisa antes de escribir, para responder un 400 que
 * diga cuánto sobra en vez del ORA-12899 (que además habla de caracteres y no de bytes). No se recorta en silencio.
 */
export const HERR_OTRA_MAX_BYTES = 40

/** null si cabe; si no, el mensaje para el usuario. */
export function mensajeHerrOtraLarga(texto: string | null | undefined): string | null {
  if (texto == null) return null
  const bytes = Buffer.byteLength(String(texto), 'utf8')
  if (bytes <= HERR_OTRA_MAX_BYTES) return null
  return (
    `"Otro tipo de herramienta, ¿cuál?" admite hasta ${HERR_OTRA_MAX_BYTES} bytes y trae ${bytes} ` +
    '(cada tilde o ñ ocupa 2). Acórtelo.'
  )
}
