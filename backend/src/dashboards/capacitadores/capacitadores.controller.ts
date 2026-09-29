import {
  Controller,
  Get,
  Query,
} from '@nestjs/common'

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CapacitadoresService } from './capacitadores.service'

@ApiTags('dashboards/capacitadores')
@Controller('dashboards/capacitadores')
@ApiBearerAuth()
export class CapacitadoresController {
  constructor(private readonly svc: CapacitadoresService) {}

  @Get()
  listarCapacitadores(
    @Query('convocatoriaId') convocatoriaId?: number,
  ) {
    return this.svc.listarCapacitadores(convocatoriaId)
  }
}