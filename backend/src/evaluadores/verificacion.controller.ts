import { Controller, Get, Param } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { CertificadoService } from './certificado.service'

// verificación pública de certificados: sin auth a propósito, la usa gente de afuera
// no usar /publico/verificar/:codigo: PublicoController de proyectos se registra antes y la captura
@ApiTags('publico')
@Controller('publico/certificados')
export class VerificacionController {
  constructor(private readonly certificados: CertificadoService) {}

  @Get(':codigo')
  @ApiOperation({ summary: 'Valida un certificado de evaluador por su código. Público, sin sesión.' })
  verificar(@Param('codigo') codigo: string) {
    return this.certificados.verificar(codigo)
  }
}
