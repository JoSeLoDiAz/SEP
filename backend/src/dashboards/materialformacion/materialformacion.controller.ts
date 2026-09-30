import {
  Controller,
  Get,
  Query,
} from '@nestjs/common'

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { MaterialFormacionService } from './materialformacion.service'

@ApiTags('dashboards/materialformacion')
@Controller('dashboards/materialformacion')
@ApiBearerAuth()
export class MaterialFormacionController {
  constructor(private readonly svc: MaterialFormacionService) {}

  @Get()
  listarMaterialFormacion(
    @Query('convocatoriaId') convocatoriaId?: number,
  ) {
    return this.svc.listarMaterialFormacion(convocatoriaId)
  }
}