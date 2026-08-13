import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { EvaluadoresModule } from '../evaluadores/evaluadores.module'
import { RetroalimentacionController } from './retroalimentacion.controller'
import { RetroalimentacionService } from './retroalimentacion.service'
import { RetroMatrizService } from './retro-matriz.service'
import { RetroReporteService } from './retro-reporte.service'

// importa EvaluadoresModule por ControlCambiosService: matriz, anulaciones y destapes van al log del banco, no a uno aparte
@Module({
  imports: [AuthModule, EvaluadoresModule],
  controllers: [RetroalimentacionController],
  providers: [RetroalimentacionService, RetroMatrizService, RetroReporteService],
  exports: [RetroalimentacionService],
})
export class RetroalimentacionModule {}
