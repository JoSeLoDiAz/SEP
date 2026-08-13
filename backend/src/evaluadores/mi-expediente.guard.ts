import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, createParamDecorator,
} from '@nestjs/common'
import type { Request } from 'express'
import { MiExpedienteService, type MiEvaluador } from './mi-expediente.service'

interface PeticionConEvaluador extends Request {
  user?: { usuarioId: number }
  miEvaluador?: MiEvaluador
}

const SOLO_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS'])

// autoriza por tener ficha en el banco, no por perfil 9: hay evaluadores que entran como perfil 8
@Injectable()
export class MiExpedienteGuard implements CanActivate {
  constructor(private readonly servicio: MiExpedienteService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<PeticionConEvaluador>()
    // JwtAuthGuard ya corrió y dejó req.user
    const yo = await this.servicio.resolver(Number(req.user?.usuarioId))
    req.miEvaluador = yo

    // el inactivo consulta, pero no modifica
    if (!SOLO_LECTURA.has(req.method) && !yo.activo) {
      throw new ForbiddenException(
        'Tu ficha de evaluador está inactiva: puedes consultarla, pero no modificarla. ' +
        'Escríbele a la gestora del banco si necesitas actualizarla.',
      )
    }
    return true
  }
}

// el evaluador de la sesión, nunca viene del cliente
export const MiEvaluadorActual = createParamDecorator(
  (_dato: unknown, context: ExecutionContext): MiEvaluador => {
    const req = context.switchToHttp().getRequest<PeticionConEvaluador>()
    return req.miEvaluador!
  },
)
