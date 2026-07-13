import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CatalogosEvaluadorService } from './catalogos.service'
import { ConvocatoriasController } from './convocatorias.controller'
import { ConvocatoriasService } from './convocatorias.service'
import { EvaluadoresController } from './evaluadores.controller'
import { EvaluadoresService } from './evaluadores.service'

@Module({
  imports: [AuthModule],
  controllers: [EvaluadoresController, ConvocatoriasController],
  providers: [EvaluadoresService, CatalogosEvaluadorService, ConvocatoriasService],
})
export class EvaluadoresModule {}
