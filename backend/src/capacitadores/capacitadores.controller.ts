import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe,
  Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CapacitadoresService } from './capacitadores.service'
import { contentDisposition } from '../common/text/nombre-archivo'

interface MulterFile {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

const MAX_PDF_BYTES = 8 * 1024 * 1024

@ApiTags('capacitadores')
@Controller('capacitadores')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CapacitadoresController {
  constructor(private readonly svc: CapacitadoresService) {}

  // ── Personas naturales ────────────────────────────────────────────────────

  @Get('proyecto/:proyectoId/personas')
  listarPersonas(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.listarPersonas(proyectoId)
  }

  @Post('proyecto/:proyectoId/persona/:personaId')
  registrarPersona(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('personaId', ParseIntPipe) personaId: number,
  ) {
    return this.svc.registrarPersona(proyectoId, personaId)
  }

  // ── Empresas jurídicas ────────────────────────────────────────────────────

  @Get('proyecto/:proyectoId/empresas')
  listarEmpresas(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.listarEmpresas(proyectoId)
  }

  @Post('proyecto/:proyectoId/empresa/:empresaId')
  registrarEmpresa(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('empresaId', ParseIntPipe) empresaId: number,
  ) {
    return this.svc.registrarEmpresa(proyectoId, empresaId)
  }

  // ── Toggle estado ─────────────────────────────────────────────────────────

  @Put(':capacitadorId/estado')
  toggleEstado(
    @Param('capacitadorId', ParseIntPipe) capacitadorId: number,
    @Body() body: { estado: 'ACTIVO' | 'INACTIVO' },
  ) {
    return this.svc.toggleEstado(capacitadorId, body.estado)
  }

  // ── Empresa — rutas literales (DEBEN ir antes de :empresaId) ─────────────

  @Get('empresa/tipos-doc')
  tiposDocEmpresa() {
    return this.svc.tiposDocEmpresa()
  }

  @Get('empresa/buscar')
  buscarEmpresa(
    @Query('tipoDocId', ParseIntPipe) tipoDocId: number,
    @Query('identificacion') identificacion: string,
  ) {
    if (!identificacion) throw new BadRequestException('Falta la identificación.')
    return this.svc.buscarEmpresa(tipoDocId, identificacion)
  }

  @Post('empresa')
  crearEmpresa(@Body() dto: {
    tipoDocumentoId: number; identificacion: string; digitoVerificacion?: number
    razonSocial: string; sigla: string; email: string; telefono: string; direccion: string
  }) {
    return this.svc.crearEmpresa(dto)
  }

  @Get('empresa/documentos/:docId/archivo')
  async descargarDocumentoEmpresa(
    @Param('docId', ParseIntPipe) docId: number,
    @Res() res: Response,
  ) {
    const { nombreArchivo, buffer } = await this.svc.getDocumentoEmpresaArchivo(docId)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', contentDisposition(nombreArchivo, true))
    res.setHeader('Content-Length', String(buffer.length))
    res.end(buffer)
  }

  @Delete('empresa/documentos/:docId')
  eliminarDocumentoEmpresa(@Param('docId', ParseIntPipe) docId: number) {
    return this.svc.eliminarDocumentoEmpresa(docId)
  }

  @Delete('empresa/docs-adicionales/:hvEmpresaDocId')
  eliminarDocAdicionalEmpresa(
    @Param('hvEmpresaDocId', ParseIntPipe) hvEmpresaDocId: number,
    @Query('empresaId', ParseIntPipe) empresaId: number,
  ) {
    return this.svc.eliminarDocAdicionalEmpresa(hvEmpresaDocId, empresaId)
  }

  // ── Empresa — rutas con :empresaId ───────────────────────────────────────

  @Get('empresa/:empresaId')
  getEmpresa(@Param('empresaId', ParseIntPipe) empresaId: number) {
    return this.svc.getEmpresa(empresaId)
  }

  @Put('empresa/:empresaId')
  actualizarEmpresa(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Body() dto: Partial<{
      razonSocial: string; sigla: string; email: string
      telefono: string; direccion: string; digitoVerificacion: number
    }>,
  ) {
    return this.svc.actualizarEmpresa(empresaId, dto)
  }

  @Get('empresa/:empresaId/hv')
  getHVEmpresa(@Param('empresaId', ParseIntPipe) empresaId: number) {
    return this.svc.getHVEmpresa(empresaId)
  }

  @Post('empresa/:empresaId/hv')
  iniciarHVEmpresa(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Body() body: { proyectoId: number },
  ) {
    return this.svc.iniciarHVEmpresa(empresaId, body.proyectoId)
  }

  @Get('empresa/:empresaId/documentos')
  listarDocumentosEmpresa(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Query('tipo') tipo?: string,
    @Query('num') num?: string,
  ) {
    return this.svc.listarDocumentosEmpresa(empresaId, tipo, num ? Number(num) : undefined)
  }

  @Post('empresa/:empresaId/documentos')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_PDF_BYTES },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype !== 'application/pdf') {
        cb(new BadRequestException('Solo se permiten archivos PDF.'), false)
        return
      }
      cb(null, true)
    },
  }))
  subirDocumentoEmpresa(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @UploadedFile() file: MulterFile,
    @Body() body: { tipo?: string; num?: string },
  ) {
    if (!file) throw new BadRequestException('Adjunta un archivo PDF en el campo "archivo".')
    const tipo = String(body?.tipo ?? '').toUpperCase()
    const num = body?.num ? Number(body.num) : 0
    return this.svc.subirDocumentoEmpresa(empresaId, tipo, num, file)
  }

  @Get('empresa/:empresaId/docs-adicionales')
  listarDocsAdicionalesEmpresa(@Param('empresaId', ParseIntPipe) empresaId: number) {
    return this.svc.listarDocsAdicionalesEmpresa(empresaId)
  }

  @Post('empresa/:empresaId/docs-adicionales')
  crearDocAdicionalEmpresa(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Body() dto: { tipoDocId: number; proyectoId?: number },
  ) {
    return this.svc.crearDocAdicionalEmpresa(empresaId, dto)
  }
}
