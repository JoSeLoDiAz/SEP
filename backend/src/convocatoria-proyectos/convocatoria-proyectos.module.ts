import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ImportarProyectoModule } from '../importar-proyecto/importar-proyecto.module'
import { ConvocatoriaProyectosController } from './convocatoria-proyectos.controller'
import { ConvocatoriaProyectosService } from './convocatoria-proyectos.service'

@Module({
  imports: [AuthModule, ImportarProyectoModule],
  controllers: [ConvocatoriaProyectosController],
  providers: [ConvocatoriaProyectosService],
})
export class ConvocatoriaProyectosModule {}
