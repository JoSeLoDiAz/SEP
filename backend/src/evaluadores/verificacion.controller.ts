import { Controller, Get, Param } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { CertificadoService } from './certificado.service'

/**
 * Validación pública de certificados. **Sin autenticación a propósito.**
 *
 * Un certificado que solo puede verificar quien tiene cuenta en el SEP no
 * sirve para nada: quien necesita comprobarlo es justamente alguien de afuera
 * — otra entidad, un empleador, un auditor.
 *
 * Por eso la respuesta es deliberadamente pobre: nombre, cédula parcial, rol,
 * año y estado. Nada de correos, identificadores internos ni el PDF. Alcanza
 * para cotejar el documento que tienen en la mano y no alcanza para extraer
 * datos del banco probando códigos.
 */
/*
 * Ruta: /publico/certificados/:codigo
 *
 * NO usar `/publico/verificar/:codigo`: esa ya la ocupa `PublicoController`
 * de proyectos, para validar versiones de proyecto. Como ese módulo se
 * registra antes, se quedaba con la petición y esta verificación respondía
 * siempre "no válido" — un fallo silencioso, porque la forma de la respuesta
 * es lo bastante parecida como para no notarlo a simple vista.
 */
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
