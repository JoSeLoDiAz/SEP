// formatos aceptados para un correo guardado, unificados para todo el banco

// se valida por extensión: los navegadores mienten con el MIME de estos
export const EXTENSIONES_CORREO = ['msg', 'eml', 'html', 'htm', 'mht', 'mhtml'] as const

// un correo impreso a PDF también vale como evidencia
export const EXTENSIONES_ADJUNTO_CORREO = ['pdf', ...EXTENSIONES_CORREO]

// la tarjeta profesional casi siempre llega fotografiada con el celular.
// SVG queda fuera a propósito: se ejecuta en el navegador y el token vive en localStorage
export const EXTENSIONES_IMAGEN = ['jpg', 'jpeg', 'png']

export const MIMES_IMAGEN = ['image/jpeg', 'image/png']

// en código y no en columna del catálogo: esa columna es DDL y el contenedor puede subir antes del SQL
const EXTENSIONES_POR_TIPO_DOC_EVAL: Record<string, string[]> = {
  AUTORIZACION: EXTENSIONES_ADJUNTO_CORREO,
  TARJETA_PROFESIONAL: ['pdf', ...EXTENSIONES_IMAGEN],
}

// lo no listado es un soporte escaneado: PDF
export function extensionesDeTipoDocEval(codigo: string | null | undefined): string[] {
  return EXTENSIONES_POR_TIPO_DOC_EVAL[(codigo ?? '').trim().toUpperCase()] ?? ['pdf']
}

// tipos que pertenecen a un año, no al evaluador: la pantalla general no debe ofrecerlos
export const TIPOS_DOC_DEL_ANIO = ['AUTORIZACION', 'CONFIDENCIALIDAD', 'CERTIFICADO_PARTICIPACION']

export function esTipoDocDelAnio(codigo: string | null | undefined): boolean {
  return TIPOS_DOC_DEL_ANIO.includes((codigo ?? '').trim().toUpperCase())
}

// Documentos de la persona, no de un ciclo ni de un estudio: van en su propia
// tarjeta arriba del perfil y hay uno solo de cada uno. No se listan con los demás
// ni se ofrecen al cargar desde un año (subirlos desde ahí borraba el del perfil).
export const TIPOS_DOC_DE_PERFIL = ['CEDULA', 'TARJETA_PROFESIONAL']

export function esTipoDocDePerfil(codigo: string | null | undefined): boolean {
  return TIPOS_DOC_DE_PERFIL.includes((codigo ?? '').trim().toUpperCase())
}

// puerta laxa a propósito: el mismo .msg llega con MIME distinto según el navegador; el filtro real es la extensión
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

export function extensionDe(nombreArchivo: string | null | undefined): string {
  const n = (nombreArchivo ?? '').toLowerCase().trim()
  const i = n.lastIndexOf('.')
  return i > 0 && i < n.length - 1 ? n.slice(i + 1) : ''
}

// si da true hay que forzar descarga: inline correría en nuestro origen y el token vive en localStorage
export function seEjecutaEnElNavegador(
  nombreArchivo: string | null | undefined,
  mime: string | null | undefined,
): boolean {
  const ext = extensionDe(nombreArchivo)
  if (['html', 'htm', 'mht', 'mhtml', 'svg', 'xhtml', 'xml'].includes(ext)) return true
  const m = (mime ?? '').toLowerCase()
  return m.includes('html') || m.includes('xml') || m === 'image/svg+xml'
}
