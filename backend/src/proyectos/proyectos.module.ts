import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Empresa } from '../auth/entities/empresa.entity'
import { ProyectosController } from './proyectos.controller'
import { ProyectosService } from './proyectos.service'

@Module({
  imports: [TypeOrmModule.forFeature([Empresa])],
  controllers: [ProyectosController],
  providers: [ProyectosService],
})
export class ProyectosModule {}
