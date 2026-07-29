import { Controller, Get, Param, Query, ParseIntPipe, Res, BadRequestException } from '@nestjs/common'
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { CertificadosService } from './certificados.service'
import { CertificadoService } from '../evaluadores/certificado.service'

@ApiTags('certificados')
@Controller('certificados')
export class CertificadosController {
  constructor(
    private readonly svc: CertificadosService,
    private readonly evaluadores: CertificadoService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Buscar certificados por persona o código' })
  @ApiQuery({ name: 'tipoDocumento', required: false })
  @ApiQuery({ name: 'numero',        required: false })
  @ApiQuery({ name: 'codigo',        required: false })
  buscar(
    @Query('tipoDocumento') tipoDocumento?: string,
    @Query('numero')        numero?: string,
    @Query('codigo')        codigo?: string,
  ) {
    if (codigo) return this.svc.buscarPorCodigo(codigo)
    if (tipoDocumento && numero) return this.svc.buscarPorPersona(tipoDocumento, numero)
    throw new BadRequestException('Proporcione tipoDocumento+numero o codigo')
  }

  // Va ANTES de `:id/pdf` por claridad, aunque no colisiona: son tres
  // segmentos contra dos y el primero es literal.
  @Get('evaluador/:certificadoId/pdf')
  @ApiOperation({ summary: 'Descargar el certificado de evaluador como PDF (público)' })
  async pdfEvaluador(
    @Param('certificadoId', ParseIntPipe) certificadoId: number,
    @Query('personaId', ParseIntPipe) personaId: number,
    @Res() res: Response,
  ) {
    // El servicio público valida la pertenencia y que siga vigente; el del
    // módulo de evaluadores solo sabe construir el documento.
    await this.svc.pdfEvaluador(certificadoId, personaId)
    const { buffer, nombre } = await this.evaluadores.getPdf(certificadoId)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${encodeURIComponent(nombre)}"`,
      'Content-Length': buffer.length,
    })
    res.end(buffer)
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Descargar certificado como PDF' })
  async pdf(
    @Param('id', ParseIntPipe) afGrupoBeneficiarioId: number,
    @Query('personaId', ParseIntPipe) personaId: number,
    @Res() res: Response,
  ) {
    const buf = await this.svc.generarPdf(afGrupoBeneficiarioId, personaId)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="certificado_${afGrupoBeneficiarioId}.pdf"`,
      'Content-Length': buf.length,
    })
    res.end(buf)
  }
}