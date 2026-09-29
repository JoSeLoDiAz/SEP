import {
  Controller,
  Get,
  Query,
} from '@nestjs/common'

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { DirectoresService } from './directores.service'

@ApiTags('dashboards/directores')
@Controller('dashboards/directores')
@ApiBearerAuth()
export class DirectoresController {
  constructor(private readonly svc: DirectoresService) {}

  @Get()
  listarDirectores(
    @Query('convocatoriaId') convocatoriaId?: number,
  ) {
    return this.svc.listarDirectores(convocatoriaId)
  }
}