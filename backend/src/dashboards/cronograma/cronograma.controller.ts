import {
  Controller,
  Get,
  Query,
} from '@nestjs/common'

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CronogramaService } from './cronograma.service'

@ApiTags('dashboards/cronograma')
@Controller('dashboards/cronograma')
@ApiBearerAuth()
export class CronogramaController {
  constructor(private readonly svc: CronogramaService) {}

  @Get()
  listarCronograma(
    @Query('convocatoriaId') convocatoriaId?: number,
  ) {
    return this.svc.listarCronograma(convocatoriaId)
  }
}