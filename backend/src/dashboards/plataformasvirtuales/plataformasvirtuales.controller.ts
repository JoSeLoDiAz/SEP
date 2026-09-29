import {
  Controller,
  Get,
  Query,
} from '@nestjs/common'

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { PlataformasVirtualesService } from './plataformasvirtuales.service'

@ApiTags('dashboards/plataformasvirtuales')
@Controller('dashboards/plataformasvirtuales')
@ApiBearerAuth()
export class PlataformasVirtualesController {
  constructor(private readonly svc: PlataformasVirtualesService) {}

  @Get()
  listarVisitascampo(
    @Query('convocatoriaId') convocatoriaId?: number,
  ) {
    return this.svc.listarPlataformasVirtuales(convocatoriaId)
  }
}