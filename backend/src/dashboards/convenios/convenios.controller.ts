import {
  Controller,
  Get,
  Query,
} from '@nestjs/common'

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ConveniosService } from './convenios.service'

@ApiTags('dashboards/convenios')
@Controller('dashboards/convenios')
@ApiBearerAuth()
export class ConveniosController {
  constructor(private readonly svc: ConveniosService) {}

  @Get()
  listarCapacitadores(
    @Query('convocatoriaId') convocatoriaId?: number,
  ) {
    return this.svc.listarConvenios(convocatoriaId)
  }
}