import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger,
} from '@nestjs/common'
import type { Response } from 'express'
import { traducirErrorOracle } from '../db/errores'

/**
 * Convierte los errores de Oracle en mensajes que el usuario pueda resolver.
 *
 * Sin esto, cualquier dato que no cumpla una restricción de la base sale a la
 * pantalla como "Internal server error": ni qué campo, ni qué pasa, ni qué
 * hacer. Las gestoras del banco se toparon con eso varias veces —un equipo
 * evaluador de 124 caracteres, un puntaje de 26450— y cada vez tocó revisar
 * el log del servidor para saber qué era.
 *
 * Va como filtro GLOBAL y no dentro de cada servicio a propósito: el problema
 * no era de un formulario sino de todos, y traducir caso por caso deja fuera
 * al siguiente que se escriba.
 *
 * Lo que no reconoce se re-emite como 500 y se registra completo en el log:
 * un error de verdad del servidor no debe disfrazarse de "dato inválido".
 */
@Catch()
export class OracleErrorFilter implements ExceptionFilter {
  private readonly log = new Logger('Oracle')

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()

    // Las HttpException ya llevan su mensaje pensado: no se tocan.
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const cuerpo = exception.getResponse()
      return typeof cuerpo === 'string'
        ? res.status(status).json({ statusCode: status, message: cuerpo })
        : res.status(status).json(cuerpo)
    }

    const traducido = traducirErrorOracle(exception)
    if (traducido) {
      // Se deja también el original en el log: el mensaje que ve el usuario
      // es deliberadamente corto y quien revise después necesita el detalle.
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
