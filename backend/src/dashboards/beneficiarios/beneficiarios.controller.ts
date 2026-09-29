import {
  Controller,
  Get,
  Query,
} from '@nestjs/common'

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { BeneficiariosService } from './beneficiarios.service'

@ApiTags('dashboards/beneficiarios')
@Controller('dashboards/beneficiarios')
@ApiBearerAuth()
export class BeneficiariosController {
  constructor(private readonly svc: BeneficiariosService) {}

  @Get()
  listarBeneficiarios(
    @Query('convocatoriaId') convocatoriaId?: number,
  ) {
    return this.svc.listarBeneficiarios(convocatoriaId)
  }
}