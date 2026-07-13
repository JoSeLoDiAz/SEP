import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Response } from 'express'

/**
 * Traduce a español los mensajes crudos que emite Multer cuando un upload no
 * cumple algún límite (`limits.fileSize`, etc.). El resto de HttpException se
 * re-emite tal cual para preservar el comportamiento estándar de Nest.
 *
 * Mensajes traducidos:
 *   - "File too large"  → "El archivo es demasiado grande. El máximo permitido es 8 MB."
 */
@Catch(HttpException)
export class UploadErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>()
    const status = exception.getStatus()
    const orig = exception.getResponse()

    const msg = typeof orig === 'string'
      ? orig
      : (orig as { message?: string })?.message ?? String(orig)

    if (msg === 'File too large') {
      return response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        message: 'El archivo es demasiado grande. El máximo permitido es 8 MB.',
      })
    }

    // Passthrough — replica el shape default de Nest.
    if (typeof orig === 'string') {
      return response.status(status).json({ statusCode: status, message: orig })
    }
    return response.status(status).json(orig)
  }
}
