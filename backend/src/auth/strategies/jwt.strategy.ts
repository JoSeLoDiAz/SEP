import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

export interface JwtPayload {
  sub: number
  email: string
  perfilId: number
  rol: string
  usuarioPerfilId?: number
  scope?: 'auth' | 'preauth'
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'sep_jwt_secret_2024'),
    })
  }

  validate(payload: JwtPayload) {
    // Tokens preauth no son válidos para acceder a endpoints protegidos.
    // Solo sirven para POST /auth/seleccionar-perfil.
    if (payload.scope === 'preauth') {
      throw new UnauthorizedException('Token de pre-autenticación no válido para esta operación')
    }
    return {
      usuarioId: payload.sub,
      email: payload.email,
      perfilId: payload.perfilId,
      rol: payload.rol,
      usuarioPerfilId: payload.usuarioPerfilId,
    }
  }
}
