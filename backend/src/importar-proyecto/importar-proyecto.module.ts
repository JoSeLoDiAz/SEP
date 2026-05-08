import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ImportarProyectoController } from './importar-proyecto.controller'
import { ImportarProyectoService } from './importar-proyecto.service'

@Module({
  imports: [AuthModule],
  controllers: [ImportarProyectoController],
  providers: [ImportarProyectoService],
})
export class ImportarProyectoModule {}
