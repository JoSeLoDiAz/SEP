import {
  Controller,
  Get,
  Query,
} from '@nestjs/common'

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { VisitassedeService } from './visitassede.service'

@ApiTags('dashboards/visitassede')
@Controller('dashboards/visitassede')
@ApiBearerAuth()
export class VisitassedeController {
  constructor(private readonly svc: VisitassedeService) {}

  @Get()
  listarVisitassede(
    @Query('convocatoriaId') convocatoriaId?: number,
  ) {
    return this.svc.listarVisitassede(convocatoriaId)
  }
}