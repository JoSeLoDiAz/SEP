/**
 * Formatos en los que llega un correo guardado, y cómo tratarlos.
 *
 * En el banco hay cuatro sitios donde lo que se adjunta es literalmente un
 * correo: la invitación y la ratificación de la convocatoria, el "Correo de
 * autorización" del evaluador y la evidencia de la aprobación del jefe. Cada
 * uno tenía su propia lista y ninguna coincidía con la siguiente, así que un
 * mismo archivo pasaba en un sitio y lo rechazaban en otro. Aquí está la
 * lista, una sola vez.
 *
 * Cada gestor guarda el correo con lo que tiene a mano:
 *   .msg          Outlook de escritorio
 *   .eml          Outlook web, Gmail, Thunderbird
 *   .html / .htm  "Guardar como" del navegador
 *   .mht / .mhtml "Guardar como página web (archivo único)" de Outlook
 *   .pdf          impreso a PDF, que sigue siendo evidencia válida
 */

/** Se valida por extensión: los navegadores mienten con el MIME de estos. */
export const EXTENSIONES_CORREO = ['msg', 'eml', 'html', 'htm', 'mht', 'mhtml'] as const

/** Un correo impreso a PDF sigue siendo evidencia válida del correo. */
export const EXTENSIONES_ADJUNTO_CORREO = ['pdf', ...EXTENSIONES_CORREO]

/**
 * Qué formatos acepta cada tipo de documento del evaluador.
 *
 * Va en código y no en una columna del catálogo —a diferencia de
 * TIPODOCUMENTOCONV, que sí la tiene— por una razón práctica: agregar la
 * columna es DDL, y el día del despliegue el contenedor puede subir antes de
 * que alguien corra el SQL. Con la columna, ese hueco tumba la pestaña de
 * Documentos entera; con el mapa, no hay hueco. Son seis tipos fijos que
 * describen el trámite, no datos operativos que cambien.
 */
const EXTENSIONES_POR_TIPO_DOC_EVAL: Record<string, string[]> = {
  AUTORIZACION: EXTENSIONES_ADJUNTO_CORREO,
}

/** Formatos del tipo. Lo no listado es un soporte escaneado: PDF. */
export function extensionesDeTipoDocEval(codigo: string | null | undefined): string[] {
  return EXTENSIONES_POR_TIPO_DOC_EVAL[(codigo ?? '').trim().toUpperCase()] ?? ['pdf']
}

/**
 * Puerta laxa por MIME, antes de la validación real por extensión.
 *
 * No es descuido: Outlook manda los .msg como `application/vnd.ms-outlook` o
 * como `application/octet-stream` según el navegador, y los .mht llegan de
 * cuatro formas distintas. Cerrar por MIME rechazaría archivos legítimos sin
 * que el gestor entienda por qué.
 */
export const MIMES_CORREO = [
  'application/vnd.ms-outlook',
  'application/octet-stream',
  'application/x-msg',
  'message/rfc822',
  'text/html',
  'multipart/related',
  'application/x-mimearchive',
  'application/mbox',
  '',
]

/** Extensión en minúsculas y sin punto. Cadena vacía si el nombre no la trae. */
export function extensionDe(nombreArchivo: string | null | undefined): string {
  const n = (nombreArchivo ?? '').toLowerCase().trim()
  const i = n.lastIndexOf('.')
  return i > 0 && i < n.length - 1 ? n.slice(i + 1) : ''
}

/**
 * ¿El navegador ejecutaría este archivo si se lo sirviéramos en línea?
 *
 * Un correo guardado como .html o .mht es HTML con todo lo que eso implica.
 * Servirlo con `Content-Disposition: inline` desde el dominio del SEP lo
 * ejecutaría EN NUESTRO ORIGEN, y como el token de sesión vive en
 * localStorage, bastaría un correo preparado para robarlo. Estos archivos se
 * fuerzan siempre a descarga.
 */
export function seEjecutaEnElNavegador(
  nombreArchivo: string | null | undefined,
  mime: string | null | undefined,
): boolean {
  const ext = extensionDe(nombreArchivo)
  if (['html', 'htm', 'mht', 'mhtml', 'svg', 'xhtml', 'xml'].includes(ext)) return true
  const m = (mime ?? '').toLowerCase()
  return m.includes('html') || m.includes('xml') || m === 'image/svg+xml'
}
