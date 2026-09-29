import { Module } from '@nestjs/common'
import { DesembolsosController } from './desembolsos.controller'
import { DesembolsosService } from './desembolsos.service'

@Module({
  controllers: [DesembolsosController],
  providers: [DesembolsosService],
})
export class DesembolsosModule {}