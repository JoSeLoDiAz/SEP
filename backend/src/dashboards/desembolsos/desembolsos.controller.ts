import {
  Controller,
  Get,
  Query,
} from '@nestjs/common'

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { DesembolsosService } from './desembolsos.service'

@ApiTags('dashboards/desembolsos')
@Controller('dashboards/desembolsos')
@ApiBearerAuth()
export class DesembolsosController {
  constructor(private readonly svc: DesembolsosService) {}

  @Get()
  listarDesembolsos(
    @Query('convocatoriaId') convocatoriaId?: number,
  ) {
    return this.svc.listarDesembolsos(convocatoriaId)
  }
}