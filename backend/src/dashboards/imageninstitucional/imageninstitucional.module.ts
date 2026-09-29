import { Module } from '@nestjs/common'
import { ImagenInstitucionalController } from './imageninstitucional.controller'
import { ImagenInstitucionalService } from './imageninstitucional.service'

@Module({
  controllers: [ImagenInstitucionalController],
  providers: [ImagenInstitucionalService],
})
export class ImagenInstitucionalModule {}