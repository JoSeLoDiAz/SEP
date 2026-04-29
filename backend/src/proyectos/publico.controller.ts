import { Controller, Get, Param } from '@nestjs/common'
import { ProyectosService } from './proyectos.service'

/** Controlador público sin autenticación.
 *  Permite verificar un código de versión de proyecto contra el snapshot
 *  guardado, para que un operador externo (p. ej. revisor de SECOP) pueda
 *  validar un reporte impreso sin tener cuenta en el sistema. */
@Controller('publico')
export class PublicoController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Get('verificar/:codigo')
  verificarCodigo(@Param('codigo') codigo: string) {
    return this.proyectosService.verificarCodigoPublico(codigo)
  }
}
