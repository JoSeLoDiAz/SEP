import type { Response } from 'express'
import { contentDisposition } from '../common/text/nombre-archivo'
import { seEjecutaEnElNavegador } from './formatos-correo'

// Los .html/.mht se fuerzan a descarga: en línea se ejecutarían en el dominio del SEP.
export function responderArchivo(
  res: Response, buffer: Buffer, mime: string, nombre: string, descargar: boolean,
): void {
  const limpio = (nombre ?? '').trim() || 'archivo'
  const ejecutable = seEjecutaEnElNavegador(limpio, mime)
  const enLinea = descargar ? false : !ejecutable

  res.setHeader('Content-Type', ejecutable ? 'application/octet-stream' : mime)
  res.setHeader('Content-Length', String(buffer.length))
  // Sin esto, Chrome puede olfatear el contenido y renderizarlo igual.
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Disposition', contentDisposition(limpio, enLinea))
  res.end(buffer)
}
