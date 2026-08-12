import {
  CanActivate, ExecutionContext, Injectable, createParamDecorator,
} from '@nestjs/common'
import type { Request } from 'express'
import { MiExpedienteService, type MiEvaluador } from './mi-expediente.service'

interface PeticionConEvaluador extends Request {
  user?: { usuarioId: number }
  miEvaluador?: MiEvaluador
}

// autoriza por tener ficha en el banco, no por perfil 9: hay evaluadores que entran como perfil 8
@Injectable()
export class MiExpedienteGuard implements CanActivate {
  constructor(private readonly servicio: MiExpedienteService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<PeticionConEvaluador>()
    // JwtAuthGuard ya corrió y dejó req.user
    req.miEvaluador = await this.servicio.resolver(Number(req.user?.usuarioId))
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
