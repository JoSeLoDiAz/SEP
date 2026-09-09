import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Response } from 'express'

// traduce a español los mensajes crudos de multer
@Catch(HttpException)
export class UploadErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>()

    // escribir sobre una respuesta ya enviada lanza ERR_HTTP_HEADERS_SENT
    if (response.headersSent) return

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

    // passthrough: replica el shape default de nest
    if (typeof orig === 'string') {
      return response.status(status).json({ statusCode: status, message: orig })
    }
    return response.status(status).json(orig)
  }
}
