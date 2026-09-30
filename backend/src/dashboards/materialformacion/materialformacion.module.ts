import { Module } from '@nestjs/common'
import { MaterialFormacionController } from './materialformacion.controller'
import { MaterialFormacionService } from './materialformacion.service'

@Module({
  controllers: [MaterialFormacionController],
  providers: [MaterialFormacionService],
})
export class MaterialFormacionModule {}