import { Module } from '@nestjs/common'
import { DirectoresController } from './directores.controller'
import { DirectoresService } from './directores.service'

@Module({
  controllers: [DirectoresController],
  providers: [DirectoresService],
})
export class DirectoresModule {}