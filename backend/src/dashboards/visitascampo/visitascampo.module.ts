import { Module } from '@nestjs/common'
import { VisitascampoController } from './visitascampo.controller'
import { VisitascampoService } from './visitascampo.service'

@Module({
  controllers: [VisitascampoController],
  providers: [VisitascampoService],
})
export class VisitascampoModule {}