import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CatalogosEvaluadorService } from './catalogos.service'
import { EvaluadoresController } from './evaluadores.controller'
import { EvaluadoresService } from './evaluadores.service'

@Module({
  imports: [AuthModule],
  controllers: [EvaluadoresController],
  providers: [EvaluadoresService, CatalogosEvaluadorService],
})
export class EvaluadoresModule {}
