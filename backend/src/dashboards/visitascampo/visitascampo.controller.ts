import {
  Controller,
  Get,
  Query,
} from '@nestjs/common'

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { VisitascampoService } from './visitascampo.service'

@ApiTags('dashboards/visitascampo')
@Controller('dashboards/visitascampo')
@ApiBearerAuth()
export class VisitascampoController {
  constructor(private readonly svc: VisitascampoService) {}

  @Get()
  listarVisitascampo(
    @Query('convocatoriaId') convocatoriaId?: number,
  ) {
    return this.svc.listarVisitascampo(convocatoriaId)
  }
}