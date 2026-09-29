import {
  Controller,
  Get,
  Query,
} from '@nestjs/common'

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SeguimientoAFService } from './seguimientoaf.service'

@ApiTags('dashboards/seguimientoaf')
@Controller('dashboards/seguimientoaf')
@ApiBearerAuth()
export class SeguimientoAFController {
  constructor(private readonly svc: SeguimientoAFService) {}

  @Get()
  listarSeguimientoAF(
    @Query('convocatoriaId') convocatoriaId?: number,
  ) {
    return this.svc.listarSeguimientoAF(convocatoriaId)
  }
}