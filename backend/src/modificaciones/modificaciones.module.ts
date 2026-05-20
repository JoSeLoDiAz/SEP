import { Module } from '@nestjs/common'
import { ModificacionesController } from './modificaciones.controller'
import { ModificacionesService } from './modificaciones.service'

@Module({
  controllers: [ModificacionesController],
  providers: [ModificacionesService],
})
export class ModificacionesModule {}
