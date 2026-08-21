import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { EvaluadoresModule } from '../evaluadores/evaluadores.module'
import { RetroalimentacionController } from './retroalimentacion.controller'
import { RetroalimentacionService } from './retroalimentacion.service'
import { RetroMatrizService } from './retro-matriz.service'
import { RetroReporteService } from './retro-reporte.service'
import { RetroHistoricoService } from './retro-historico.service'

// importa EvaluadoresModule por ControlCambiosService
@Module({
  imports: [AuthModule, EvaluadoresModule],
  controllers: [RetroalimentacionController],
  providers: [RetroalimentacionService, RetroMatrizService, RetroReporteService, RetroHistoricoService],
  exports: [RetroalimentacionService],
})
export class RetroalimentacionModule {}
