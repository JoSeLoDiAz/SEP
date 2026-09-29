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

// sliding session: cada request autenticada devuelve un JWT nuevo en X-New-Token
@Injectable()
export class RefreshTokenInterceptor implements NestInterceptor {
  constructor(private readonly jwtService: JwtService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthedUser }>()
    const res = context.switchToHttp().getResponse<Response>()

    // la cabecera va antes de next.handle(): las rutas que sirven archivos cierran la respuesta ellas mismas
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
