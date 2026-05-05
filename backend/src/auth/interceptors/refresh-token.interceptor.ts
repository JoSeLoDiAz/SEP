import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request, Response } from 'express'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import type { JwtPayload } from '../strategies/jwt.strategy'

interface AuthedUser {
  usuarioId: number
  email: string
  perfilId: number
  rol: string
  usuarioPerfilId?: number
}

/**
 * Sliding session: cada request autenticada exitosa devuelve un nuevo JWT
 * en el header `X-New-Token`. El frontend lo captura y reemplaza el token
 * en localStorage. Mientras el usuario interactúa con el aplicativo, su
 * sesión se renueva infinitamente. Si para de interactuar, el JWT caduca
 * según JWT_EXPIRES_IN (30m).
 */
@Injectable()
export class RefreshTokenInterceptor implements NestInterceptor {
  constructor(private readonly jwtService: JwtService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap(() => {
        const req = context.switchToHttp().getRequest<Request & { user?: AuthedUser }>()
        const res = context.switchToHttp().getResponse<Response>()
        if (!req.user) return
        const payload: JwtPayload = {
          sub: req.user.usuarioId,
          email: req.user.email,
          perfilId: req.user.perfilId,
          rol: req.user.rol,
          usuarioPerfilId: req.user.usuarioPerfilId,
          scope: 'auth',
        }
        const newToken = this.jwtService.sign(payload)
        res.setHeader('X-New-Token', newToken)
      }),
    )
  }
}
