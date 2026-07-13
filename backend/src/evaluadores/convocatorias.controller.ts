import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe,
  Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  ConvocatoriasService,
  MAX_CONV_DOC_BYTES,
  type ConvocatoriaActualizarDto,
  type ConvocatoriaCrearDto,
} from './convocatorias.service'
import type { MulterFile } from './evaluadores.service'

interface JwtUser { usuarioId: number; email: string; perfilId: number }

// Duplicados de evaluadores.controller — se mantienen sincronizados para no
// forzar un import de otro archivo que aún puede evolucionar en paralelo.
const PERFIL_ADMIN = 1
const PERFIL_COORDINADOR = 2
const PERFIL_GESTOR_EVALUADORES = 15
const PERFILES_GESTION = [PERFIL_ADMIN, PERFIL_COORDINADOR, PERFIL_GESTOR_EVALUADORES]

// Mimes aceptados en la subida de documentos de convocatoria. Los .msg suelen
// llegar como application/vnd.ms-outlook, pero algunos navegadores los envían
// como application/octet-stream — se aceptan ambos y luego el service valida
// la extensión contra el catálogo TIPODOCUMENTOCONV.
const MIMES_CONVOCATORIA = new Set<string>([
  'application/pdf',
  'application/vnd.ms-outlook',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
])

@ApiTags('evaluadores')
@Controller('evaluadores/convocatorias')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConvocatoriasController {
  constructor(private readonly service: ConvocatoriasService) {}

  private exigirGestion(user: JwtUser) {
    if (!PERFILES_GESTION.includes(user.perfilId)) {
      throw new ForbiddenException('No tiene permisos para gestionar convocatorias del banco de evaluadores')
    }
  }

  // ── Listado / Ficha ────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listado paginado de convocatorias del banco de evaluadores' })
  listar(
    @CurrentUser() user: JwtUser,
    @Query('anio') anio?: string,
    @Query('activo') activo?: string,
    @Query('busqueda') busqueda?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.exigirGestion(user)
    return this.service.listar({
      anio: anio ? Number(anio) : undefined,
      activo: activo == null ? undefined : activo === '1' || activo === 'true',
      busqueda,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva convocatoria' })
  crear(@CurrentUser() user: JwtUser, @Body() dto: ConvocatoriaCrearDto) {
    this.exigirGestion(user)
    return this.service.crear(dto)
  }

  @Get(':cid')
  @ApiOperation({ summary: 'Ficha de la convocatoria (con conteo de documentos por tipo)' })
  ficha(@CurrentUser() user: JwtUser, @Param('cid', ParseIntPipe) cid: number) {
    this.exigirGestion(user)
    return this.service.getFicha(cid)
  }

  @Put(':cid')
  @ApiOperation({ summary: 'Actualizar datos de la convocatoria' })
  actualizar(
    @CurrentUser() user: JwtUser,
    @Param('cid', ParseIntPipe) cid: number,
    @Body() dto: ConvocatoriaActualizarDto,
  ) {
    this.exigirGestion(user)
    return this.service.actualizar(cid, dto)
  }

  @Delete(':cid')
  @ApiOperation({ summary: 'Desactivar convocatoria (soft delete)' })
  desactivar(@CurrentUser() user: JwtUser, @Param('cid', ParseIntPipe) cid: number) {
    this.exigirGestion(user)
    return this.service.cambiarEstado(cid, false)
  }

  @Put(':cid/estado')
  @ApiOperation({ summary: 'Activar / desactivar convocatoria' })
  cambiarEstado(
    @CurrentUser() user: JwtUser,
    @Param('cid', ParseIntPipe) cid: number,
    @Body() dto: { activo: boolean },
  ) {
    this.exigirGestion(user)
    return this.service.cambiarEstado(cid, Boolean(dto?.activo))
  }

  // ── Documentos ─────────────────────────────────────────────────────────

  @Get(':cid/documentos')
  @ApiOperation({ summary: 'Listado de documentos de la convocatoria (filtrable por código de tipo)' })
  listarDocumentos(
    @CurrentUser() user: JwtUser,
    @Param('cid', ParseIntPipe) cid: number,
    @Query('tipo') tipo?: string,
  ) {
    this.exigirGestion(user)
    return this.service.listarDocumentos(cid, tipo)
  }

  @Post(':cid/documentos')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_CONV_DOC_BYTES },
    fileFilter: (_r, f, cb) => {
      // Validación laxa por MIME — el service refina la validación contra las
      // extensiones declaradas en el catálogo del tipo de documento.
      if (!MIMES_CONVOCATORIA.has(f.mimetype)) {
        return cb(new BadRequestException(
          'Tipo de archivo no soportado. Se aceptan PDF, XLSX, XLS o MSG (Outlook)',
        ), false)
      }
      cb(null, true)
    },
  }))
  subirDocumento(
    @CurrentUser() user: JwtUser,
    @Param('cid', ParseIntPipe) cid: number,
    @UploadedFile() file: MulterFile,
    @Body() body: { tipoDocumentoConvId?: string; descripcion?: string },
  ) {
    this.exigirGestion(user)
    const tipoId = Number(body.tipoDocumentoConvId)
    if (!Number.isFinite(tipoId) || tipoId <= 0) {
      throw new BadRequestException('tipoDocumentoConvId es obligatorio')
    }
    return this.service.subirDocumento(cid, tipoId, file, { descripcion: body.descripcion })
  }

  @Get('documentos/:docId/archivo')
  async getDocumentoArchivo(
    @CurrentUser() user: JwtUser,
    @Param('docId', ParseIntPipe) docId: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, mime, nombre } = await this.service.getDocumentoArchivo(docId)
    const nombreFinal = (nombre ?? '').trim() || `documento_${docId}`
    res.setHeader('Content-Type', mime)
    // Content-Disposition inline con filename + filename* (RFC 5987) para
    // preservar UTF-8 en el nombre. Sanitizamos "double quotes" del ASCII.
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${nombreFinal.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(nombreFinal)}`,
    )
    res.setHeader('Content-Length', String(buffer.length))
    res.end(buffer)
  }

  @Get('documentos/:docId/descargar')
  async descargarDocumento(
    @CurrentUser() user: JwtUser,
    @Param('docId', ParseIntPipe) docId: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, mime, nombre } = await this.service.getDocumentoArchivo(docId)
    const nombreFinal = nombre?.trim() || `documento_${docId}`
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Length', String(buffer.length))
    // filename* (RFC 5987) preserva UTF-8 en navegadores modernos.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreFinal.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(nombreFinal)}`,
    )
    res.end(buffer)
  }

  @Delete('documentos/:docId')
  eliminarDocumento(
    @CurrentUser() user: JwtUser,
    @Param('docId', ParseIntPipe) docId: number,
  ) {
    this.exigirGestion(user)
    return this.service.eliminarDocumento(docId)
  }
}
