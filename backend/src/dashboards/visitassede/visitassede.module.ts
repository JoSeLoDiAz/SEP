import { Module } from '@nestjs/common'
import { VisitassedeController } from './visitassede.controller'
import { VisitassedeService } from './visitassede.service'

@Module({
  controllers: [VisitassedeController],
  providers: [VisitassedeService],
})
export class VisitassedeModule {}