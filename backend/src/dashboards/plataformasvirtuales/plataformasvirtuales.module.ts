import { Module } from '@nestjs/common'
import { PlataformasVirtualesController } from './plataformasvirtuales.controller'
import { PlataformasVirtualesService } from './plataformasvirtuales.service'

@Module({
  controllers: [PlataformasVirtualesController],
  providers: [PlataformasVirtualesService],
})
export class PlataformasVirtualesDBModule {}