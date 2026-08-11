import type { Response } from 'express'
import { contentDisposition } from '../common/text/nombre-archivo'
import { seEjecutaEnElNavegador } from './formatos-correo'

/**
 * Sirve un archivo guardado en la base.
 *
 * Está aquí y no en un controlador porque ahora hay dos que entregan los
 * mismos archivos —el del gestor y el del propio evaluador— y la parte
 * delicada no es el envío sino la protección: un correo guardado como .html
 * o .mht es HTML, y mostrarlo en línea lo ejecutaría dentro del dominio del
 * SEP. Como la sesión vive en el navegador, bastaría un correo preparado para
 * robársela a quien lo abra. Esos archivos se fuerzan a descarga y se anuncian
 * como binarios.
 *
 * Duplicar esto en el portal del evaluador habría sido dejar la protección a
 * medias justo donde entran los correos.
 *
 * @param descargar  Fuerza el guardado en vez de mostrarlo en el navegador.
 */
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
