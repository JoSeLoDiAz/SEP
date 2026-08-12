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
import { MIMES_CORREO, seEjecutaEnElNavegador } from './formatos-correo'
import { filtroArchivo } from './subida-archivo'
import { contentDisposition } from '../common/text/nombre-archivo'

interface JwtUser { usuarioId: number; email: string; perfilId: number }

// duplicados de evaluadores.controller: se mantienen sincronizados a mano
const PERFIL_ADMIN = 1
const PERFIL_COORDINADOR = 2
const PERFIL_GESTOR_EVALUADORES = 15
const PERFILES_GESTION = [PERFIL_ADMIN, PERFIL_COORDINADOR, PERFIL_GESTOR_EVALUADORES]

// puerta laxa: quien valida de verdad es el service, contra las extensiones de TIPODOCUMENTOCONV
const MIMES_CONVOCATORIA = new Set<string>([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  ...MIMES_CORREO,
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
    // el filtro compartido además arregla el nombre: multer entrega las tildes rotas
    fileFilter: filtroArchivo(
      f => MIMES_CONVOCATORIA.has(f.mimetype),
      'Tipo de archivo no soportado. Se aceptan PDF, XLSX, XLS y correos (.msg, .eml, .html, .mht)'),
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

    // html/mht en línea correría en el dominio del SEP y el token vive en localStorage: se fuerzan a descarga
    const ejecutable = seEjecutaEnElNavegador(nombreFinal, mime)
    res.setHeader('Content-Type', ejecutable ? 'application/octet-stream' : mime)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    // filename* (RFC 5987) preserva UTF-8 en el nombre
    res.setHeader(
      'Content-Disposition',
      contentDisposition(nombreFinal, !ejecutable),
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
    // filename* (RFC 5987) preserva UTF-8 en el nombre
    res.setHeader(
      'Content-Disposition',
      contentDisposition(nombreFinal, false),
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
