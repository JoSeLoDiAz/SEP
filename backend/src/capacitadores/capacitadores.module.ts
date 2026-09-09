import { Module } from '@nestjs/common'
import { CapacitadoresController } from './capacitadores.controller'
import { CapacitadoresService } from './capacitadores.service'

@Module({
  controllers: [CapacitadoresController],
  providers: [CapacitadoresService],
})
export class CapacitadoresModule {}
