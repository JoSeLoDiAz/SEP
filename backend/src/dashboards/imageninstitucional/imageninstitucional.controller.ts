import {
  Controller,
  Get,
  Query,
} from '@nestjs/common'

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ImagenInstitucionalService } from './imageninstitucional.service'

@ApiTags('dashboards/imageninstitucional')
@Controller('dashboards/imageninstitucional')
@ApiBearerAuth()
export class ImagenInstitucionalController {
  constructor(private readonly svc: ImagenInstitucionalService) {}

  @Get()
  listarImagenInstitucional(
    @Query('convocatoriaId') convocatoriaId?: number,
  ) {
    return this.svc.listarImagenInstitucional(convocatoriaId)
  }
}