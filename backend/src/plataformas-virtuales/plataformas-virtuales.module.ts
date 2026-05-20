import { Module } from '@nestjs/common'
import { PlataformasVirtualesController } from './plataformas-virtuales.controller'
import { PlataformasVirtualesService } from './plataformas-virtuales.service'

@Module({
  controllers: [PlataformasVirtualesController],
  providers: [PlataformasVirtualesService],
})
export class PlataformasVirtualesModule {}
