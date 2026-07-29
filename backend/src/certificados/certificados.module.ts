import { Module } from '@nestjs/common'
import { CertificadosController } from './certificados.controller'
import { CertificadosService } from './certificados.service'
import { EvaluadoresModule } from '../evaluadores/evaluadores.module'

@Module({
  // Se importa para reusar `CertificadoService.getPdf`, que sabe regenerar el
  // documento desde el snapshot. Duplicar ese generador aquí habría creado dos
  // versiones del mismo certificado oficial, que es exactamente lo que la v37
  // evita congelando el snapshot.
  imports: [EvaluadoresModule],
  controllers: [CertificadosController],
  providers: [CertificadosService],
})
export class CertificadosModule {}