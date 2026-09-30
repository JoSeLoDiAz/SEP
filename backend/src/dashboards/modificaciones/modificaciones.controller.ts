import {
  Controller,
  Get,
  Query,
} from '@nestjs/common'

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ModificacionesService } from './modificaciones.service'

@ApiTags('dashboards/modificaciones')
@Controller('dashboards/modificaciones')
@ApiBearerAuth()
export class ModificacionesController {
  constructor(private readonly svc: ModificacionesService) {}

  @Get()
  listarModificaciones(
    @Query('convocatoriaId') convocatoriaId?: number,
  ) {
    return this.svc.listarModificaciones(convocatoriaId)
  }
}