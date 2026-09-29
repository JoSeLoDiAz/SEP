import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger,
} from '@nestjs/common'
import type { Response } from 'express'
import { traducirErrorOracle } from '../db/errores'

// filtro global: traduce errores de Oracle a mensajes que el usuario entienda
@Catch()
export class OracleErrorFilter implements ExceptionFilter {
  private readonly log = new Logger('Oracle')

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()

    // responder aquí lanza ERR_HTTP_HEADERS_SENT y corta la descarga en curso
    if (res.headersSent) {
      this.log.error(
        'Error después de haber respondido; la respuesta sigue su curso: ' +
        ((exception as Error)?.stack ?? String(exception)),
      )
      return
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const cuerpo = exception.getResponse()
      return typeof cuerpo === 'string'
        ? res.status(status).json({ statusCode: status, message: cuerpo })
        : res.status(status).json(cuerpo)
    }

    const traducido = traducirErrorOracle(exception)
    if (traducido) {
      this.log.warn(`${(exception as Error)?.message ?? exception}`)
      const status = traducido.getStatus()
      const cuerpo = traducido.getResponse()
      return typeof cuerpo === 'string'
        ? res.status(status).json({ statusCode: status, message: cuerpo })
        : res.status(status).json(cuerpo)
    }

    this.log.error((exception as Error)?.stack ?? String(exception))
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Ocurrió un error inesperado. Si se repite, avise al equipo TIC.',
    })
  }
}
