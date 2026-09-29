import { Module } from '@nestjs/common'
import { SeguimientoAFController } from './seguimientoaf.controller'
import { SeguimientoAFService } from './seguimientoaf.service'

@Module({
  controllers: [SeguimientoAFController],
  providers: [SeguimientoAFService],
})
export class SeguimientoAFModule {}