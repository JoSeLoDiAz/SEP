import { Module } from '@nestjs/common'
import { BeneficiariosController } from './beneficiarios.controller'
import { BeneficiariosService } from './beneficiarios.service'

@Module({
  controllers: [BeneficiariosController],
  providers: [BeneficiariosService],
})
export class BeneficiariosModule {}