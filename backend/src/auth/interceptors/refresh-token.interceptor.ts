import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request, Response } from 'express'
import { Observable } from 'rxjs'
import type { JwtPayload } from '../strategies/jwt.strategy'

interface AuthedUser {
  usuarioId: number
  email: string
  perfilId: number
  rol: string
  usuarioPerfilId?: number
}

/**
 * Sliding session: cada request autenticada devuelve un nuevo JWT en el header
 * `X-New-Token`. El frontend lo captura y reemplaza el token en localStorage.
 * Mientras el usuario interactúa con el aplicativo, su sesión se renueva
 * infinitamente. Si para de interactuar, el JWT caduca según JWT_EXPIRES_IN.
 *
 * La cabecera se pone ANTES de ejecutar el controlador, no después.
 *
 * Antes iba en un `tap`, que corre cuando el controlador ya terminó. Para la
 * mayoría de rutas da igual —Nest serializa el JSON después—, pero las que
 * entregan un archivo escriben la respuesta ellas mismas con `res.end(buffer)`.
 * Para cuando el `tap` se ejecutaba, esa respuesta ya había salido, y ponerle
 * una cabecera lanzaba ERR_HTTP_HEADERS_SENT. El filtro de errores intentaba
 * entonces contestar un JSON sobre la misma respuesta, volvía a lanzar, y la
 * conexión moría a medio envío: el navegador recibía un 200 con el archivo
 * incompleto y nginx anotaba "upstream prematurely closed connection".
 *
 * Con archivos pequeños no se notaba —el cuerpo ya había salido entero cuando
 * reventaba— y por eso el fallo parecía cosa de la red o del tamaño.
 */
@Injectable()
export class RefreshTokenInterceptor implements NestInterceptor {
  constructor(private readonly jwtService: JwtService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Los guards ya corrieron, así que `req.user` está disponible aquí.
    const req = context.switchToHttp().getRequest<Request & { user?: AuthedUser }>()
    const res = context.switchToHttp().getResponse<Response>()

    // `headersSent` por si algo respondió antes: una cabecera no vale tumbar
    // una respuesta que ya iba en camino.
    if (req.user && !res.headersSent) {
      const payload: JwtPayload = {
        sub: req.user.usuarioId,
        email: req.user.email,
        perfilId: req.user.perfilId,
        rol: req.user.rol,
        usuarioPerfilId: req.user.usuarioPerfilId,
        scope: 'auth',
      }
      res.setHeader('X-New-Token', this.jwtService.sign(payload))
    }

    return next.handle()
  }
}
