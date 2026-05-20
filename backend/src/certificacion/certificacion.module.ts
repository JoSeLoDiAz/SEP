import { Module } from '@nestjs/common'
import { CertificacionController } from './certificacion.controller'
import { CertificacionService } from './certificacion.service'

@Module({
  controllers: [CertificacionController],
  providers: [CertificacionService],
})
export class CertificacionModule {}
