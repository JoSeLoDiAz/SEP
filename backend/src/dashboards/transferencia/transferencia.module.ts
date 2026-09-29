import { Module } from '@nestjs/common'
import { TransferenciaController } from './transferencia.controller'
import { TransferenciaService } from './transferencia.service'

@Module({
  controllers: [TransferenciaController],
  providers: [TransferenciaService],
})
export class TransferenciaDBModule {}
