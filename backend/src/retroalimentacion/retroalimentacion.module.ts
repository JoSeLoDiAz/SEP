import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { EvaluadoresModule } from '../evaluadores/evaluadores.module'
import { RetroalimentacionController } from './retroalimentacion.controller'
import { RetroalimentacionService } from './retroalimentacion.service'
import { RetroMatrizService } from './retro-matriz.service'
import { RetroReporteService } from './retro-reporte.service'

/**
 * Retroalimentación 360° — port del sistema que vivía aparte en Mongo.
 *
 * Depende de EvaluadoresModule por `AuditoriaService`: la generación de la
 * matriz, las anulaciones y los destapes de anonimato van al mismo log que el
 * resto del banco, no a uno paralelo.
 */
@Module({
  imports: [AuthModule, EvaluadoresModule],
  controllers: [RetroalimentacionController],
  providers: [RetroalimentacionService, RetroMatrizService, RetroReporteService],
  exports: [RetroalimentacionService],
})
export class RetroalimentacionModule {}
