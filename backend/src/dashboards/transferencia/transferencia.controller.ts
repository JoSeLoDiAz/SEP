import {
  Controller,
  Get,
  Query,
} from '@nestjs/common'

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { TransferenciaService } from './transferencia.service'

@ApiTags('dashboards/transferencia')
@Controller('dashboards/transferencia')
@ApiBearerAuth()
export class TransferenciaController {
  constructor(private readonly svc: TransferenciaService) {}

  @Get()
  listarTransferencia(
    @Query('convocatoriaId') convocatoriaId?: number,
  ) {
    return this.svc.listarTransferencia(convocatoriaId)
  }
}
