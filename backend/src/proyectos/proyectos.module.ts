import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Empresa } from '../auth/entities/empresa.entity'
import { NecesidadesModule } from '../necesidades/necesidades.module'
import { ProyectosController } from './proyectos.controller'
import { ProyectosService } from './proyectos.service'
import { PublicoController } from './publico.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Empresa]), NecesidadesModule],
  controllers: [ProyectosController, PublicoController],
  providers: [ProyectosService],
})
export class ProyectosModule {}
