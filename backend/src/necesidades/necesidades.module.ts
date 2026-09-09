import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { NecesidadesController } from './necesidades.controller'
import { NecesidadesService } from './necesidades.service'
import { Empresa } from '../auth/entities/empresa.entity'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [TypeOrmModule.forFeature([Empresa]), AuthModule],
  controllers: [NecesidadesController],
  providers: [NecesidadesService],
  exports: [NecesidadesService],
})
export class NecesidadesModule {}
