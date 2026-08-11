import {
  CanActivate, ExecutionContext, Injectable, createParamDecorator,
} from '@nestjs/common'
import type { Request } from 'express'
import { MiExpedienteService, type MiEvaluador } from './mi-expediente.service'

interface PeticionConEvaluador extends Request {
  user?: { usuarioId: number }
  miEvaluador?: MiEvaluador
}

/**
 * Deja resuelto, antes de entrar al controlador, de quién es el expediente.
 *
 * Va como guard y no como una comprobación dentro de cada método porque los
 * métodos se copian. En el controlador de gestión hay más de cuarenta que
 * empiezan llamando a `exigirGestion(user)` a mano: basta que a uno se le
 * olvide para que quede abierto, y eso no se ve leyendo el código nuevo sino
 * comparándolo con los otros cuarenta. Aquí no hay nada que recordar — sin
 * identidad, el método no llega a ejecutarse.
 *
 * A propósito NO exige el perfil 9. La autorización es "esta cuenta tiene
 * ficha en el banco", no "esta cuenta entró con el sombrero de evaluador":
 * cuatro de los once evaluadores son también perfil 8, y si entran con ese
 * perfil no pueden quedarse fuera de su propia hoja de vida. Es además lo que
 * ya hace el módulo de retroalimentación, que autoriza por tener ciclo.
 */
@Injectable()
export class MiExpedienteGuard implements CanActivate {
  constructor(private readonly servicio: MiExpedienteService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<PeticionConEvaluador>()
    // JwtAuthGuard ya corrió y dejó al usuario; si no, no habríamos llegado.
    req.miEvaluador = await this.servicio.resolver(Number(req.user?.usuarioId))
    return true
  }
}

/** El evaluador de la sesión, para el handler. Nunca viene del cliente. */
export const MiEvaluadorActual = createParamDecorator(
  (_dato: unknown, context: ExecutionContext): MiEvaluador => {
    const req = context.switchToHttp().getRequest<PeticionConEvaluador>()
    return req.miEvaluador!
  },
)
