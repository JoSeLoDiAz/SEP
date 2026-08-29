import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Res,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { CatalogosEvaluadorService } from './catalogos.service'
import { EvaluadoresService } from './evaluadores.service'
import type {
  EstudioDto, EvaluadorActualizarDto, ExperienciaDto, MulterFile, TicDto,
} from './evaluadores.service'
import { TrayectoriaService } from './trayectoria.service'
import { FichaPdfService } from './ficha-pdf.service'
import { MiExpedienteService, type MiEvaluador } from './mi-expediente.service'
import { MiExpedienteGuard, MiEvaluadorActual } from './mi-expediente.guard'
import { filtroArchivo, filtroSoloNombre } from './subida-archivo'
import { responderArchivo } from './responder-archivo'

const MAX_ARCHIVO_BYTES = 8 * 1024 * 1024 // mismo tope que el resto del SEP

// lo que deja JwtAuthGuard en la peticion, igual que en evaluadores.controller
interface JwtUser { usuarioId: number; email: string; perfilId: number }

// prefijo aparte: el evaluadorId lo pone el guard desde la sesión, nunca llega del cliente
@ApiTags('mi-expediente')
@Controller('mi-expediente')
@UseGuards(JwtAuthGuard, MiExpedienteGuard)
@ApiBearerAuth()
export class MiExpedienteController {
  constructor(
    private readonly service: EvaluadoresService,
    private readonly mio: MiExpedienteService,
    private readonly trayectoria: TrayectoriaService,
    private readonly fichaPdf: FichaPdfService,
    private readonly catalogos: CatalogosEvaluadorService,
  ) {}

  // Quién hizo el cambio. Aquí el valor está en distinguir lo que sube el propio
  // evaluador de lo que sube el banco: los dos escriben en las mismas tablas.
  private ctx(user: JwtUser) {
    return { usuarioEmail: user.email, usuarioPerfilId: user.perfilId }
  }

  // los catálogos de /evaluadores exigen perfil de gestión; el evaluador necesita estos dos
  @Get('catalogos/ciudades/buscar')
  buscarCiudades(@Query('q') q?: string, @Query('limite') limite?: string) {
    const lim = limite ? Number(limite) : 20
    return this.catalogos.buscarCiudades(q ?? '', Number.isFinite(lim) ? lim : 20)
  }

  @Get('catalogos/tipos-estudio')
  tiposEstudio() {
    return this.catalogos.listarTiposEstudio(true, true)
  }

  @Get()
  @ApiOperation({ summary: 'Mis datos de evaluador' })
  ficha(@MiEvaluadorActual() yo: MiEvaluador) {
    return this.service.getFicha(yo.evaluadorId)
  }

  @Get('foto')
  async foto(@MiEvaluadorActual() yo: MiEvaluador, @Res() res: Response) {
    const { buffer, mime, nombre } = await this.service.getFotoMiniatura(yo.evaluadorId)
    res.setHeader('Cache-Control', 'private, max-age=300')
    responderArchivo(res, buffer, mime, nombre ?? 'foto', false)
  }

  @Get('ficha.pdf')
  @ApiOperation({ summary: 'Mi ficha completa en PDF' })
  async fichaPdfPropia(@MiEvaluadorActual() yo: MiEvaluador, @Res() res: Response) {
    const { buffer, nombre } = await this.fichaPdf.generar(yo.evaluadorId)
    responderArchivo(res, buffer, 'application/pdf', nombre, false)
  }

  // lista blanca a mano: el correo identifica el expediente y lo institucional lo pone la entidad
  @Put('perfil')
  @ApiOperation({ summary: 'Actualizar mis datos de contacto y formación' })
  actualizarPerfil(
    @MiEvaluadorActual() yo: MiEvaluador,
    @Body() dto: EvaluadorActualizarDto,
  ) {
    const permitido: EvaluadorActualizarDto = {
      celular: dto.celular,
      profesion: dto.profesion,
      posgrado: dto.posgrado,
      municipioId: dto.municipioId,
    }
    return this.service.actualizar(yo.evaluadorId, permitido)
  }

  @Post('foto')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_ARCHIVO_BYTES },
    fileFilter: filtroArchivo(f => f.mimetype.startsWith('image/'), 'Solo imágenes (JPG, PNG)'),
  }))
  subirFoto(@MiEvaluadorActual() yo: MiEvaluador, @UploadedFile() file: MulterFile) {
    return this.service.subirFoto(yo.evaluadorId, file)
  }

  @Get('estudios')
  estudios(@MiEvaluadorActual() yo: MiEvaluador) {
    return this.service.listarEstudios(yo.evaluadorId)
  }

  @Post('estudios')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_ARCHIVO_BYTES }, fileFilter: filtroSoloNombre,
  }))
  crearEstudio(
    @CurrentUser() user: JwtUser,
    @MiEvaluadorActual() yo: MiEvaluador,
    @Body() dto: EstudioDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.service.crearEstudio(yo.evaluadorId, dto, file, this.ctx(user))
  }

  @Put('estudios/:id')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_ARCHIVO_BYTES }, fileFilter: filtroSoloNombre,
  }))
  @ApiOperation({ summary: 'Corregir un estudio propio. Sin archivo nuevo, el soporte se queda' })
  async actualizarEstudio(
    @CurrentUser() user: JwtUser,
    @MiEvaluadorActual() yo: MiEvaluador,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EstudioDto,
    @UploadedFile() file?: MulterFile,
  ) {
    await this.mio.esMiEstudio(id, yo.evaluadorId)
    return this.service.actualizarEstudio(id, dto, file, this.ctx(user))
  }

  @Get('estudios/:id/archivo')
  async estudioArchivo(
    @MiEvaluadorActual() yo: MiEvaluador,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    await this.mio.esMiEstudio(id, yo.evaluadorId)
    const { buffer, mime, nombre } = await this.service.getEstudioArchivo(id)
    responderArchivo(res, buffer, mime, nombre, false)
  }

  @Delete('estudios/:id')
  async borrarEstudio(
    @CurrentUser() user: JwtUser,
    @MiEvaluadorActual() yo: MiEvaluador,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.mio.esMiEstudio(id, yo.evaluadorId)
    return this.service.eliminarEstudio(id, this.ctx(user))
  }

  @Get('experiencia')
  experiencia(@MiEvaluadorActual() yo: MiEvaluador) {
    return this.service.listarExperiencias(yo.evaluadorId)
  }

  @Post('experiencia')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_ARCHIVO_BYTES }, fileFilter: filtroSoloNombre,
  }))
  crearExperiencia(
    @CurrentUser() user: JwtUser,
    @MiEvaluadorActual() yo: MiEvaluador,
    @Body() dto: ExperienciaDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.service.crearExperiencia(yo.evaluadorId, dto, file, this.ctx(user))
  }

  @Put('experiencia/:id')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_ARCHIVO_BYTES }, fileFilter: filtroSoloNombre,
  }))
  @ApiOperation({ summary: 'Corregir una experiencia propia. Sin archivo nuevo, el soporte se queda' })
  async actualizarExperiencia(
    @CurrentUser() user: JwtUser,
    @MiEvaluadorActual() yo: MiEvaluador,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExperienciaDto,
    @UploadedFile() file?: MulterFile,
  ) {
    await this.mio.esMiExperiencia(id, yo.evaluadorId)
    return this.service.actualizarExperiencia(id, dto, file, this.ctx(user))
  }

  @Get('experiencia/:id/archivo')
  async experienciaArchivo(
    @MiEvaluadorActual() yo: MiEvaluador,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    await this.mio.esMiExperiencia(id, yo.evaluadorId)
    const { buffer, mime, nombre } = await this.service.getExperienciaArchivo(id)
    responderArchivo(res, buffer, mime, nombre, false)
  }

  @Delete('experiencia/:id')
  async borrarExperiencia(
    @CurrentUser() user: JwtUser,
    @MiEvaluadorActual() yo: MiEvaluador,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.mio.esMiExperiencia(id, yo.evaluadorId)
    return this.service.eliminarExperiencia(id, this.ctx(user))
  }

  @Get('tic')
  tic(@MiEvaluadorActual() yo: MiEvaluador) {
    return this.service.listarTics(yo.evaluadorId)
  }

  @Post('tic')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_ARCHIVO_BYTES }, fileFilter: filtroSoloNombre,
  }))
  crearTic(
    @CurrentUser() user: JwtUser,
    @MiEvaluadorActual() yo: MiEvaluador,
    @Body() dto: TicDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.service.crearTic(yo.evaluadorId, dto, file, this.ctx(user))
  }

  @Put('tic/:id')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_ARCHIVO_BYTES }, fileFilter: filtroSoloNombre,
  }))
  @ApiOperation({ summary: 'Corregir una certificación TIC propia. Sin archivo nuevo, el soporte se queda' })
  async actualizarTic(
    @CurrentUser() user: JwtUser,
    @MiEvaluadorActual() yo: MiEvaluador,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TicDto,
    @UploadedFile() file?: MulterFile,
  ) {
    await this.mio.esMiTic(id, yo.evaluadorId)
    return this.service.actualizarTic(id, dto, file, this.ctx(user))
  }

  @Get('tic/:id/archivo')
  async ticArchivo(
    @MiEvaluadorActual() yo: MiEvaluador,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    await this.mio.esMiTic(id, yo.evaluadorId)
    const { buffer, mime, nombre } = await this.service.getTicArchivo(id)
    responderArchivo(res, buffer, mime, nombre, false)
  }

  @Delete('tic/:id')
  async borrarTic(
    @CurrentUser() user: JwtUser,
    @MiEvaluadorActual() yo: MiEvaluador,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.mio.esMiTic(id, yo.evaluadorId)
    return this.service.eliminarTic(id, this.ctx(user))
  }

  @Get('documentos')
  @ApiOperation({ summary: 'Todos mis documentos: los permanentes y los de cada año' })
  documentos(@MiEvaluadorActual() yo: MiEvaluador) {
    return this.service.listarDocumentos(yo.evaluadorId)
  }

  @Get('documentos/:id/archivo')
  async documentoArchivo(
    @MiEvaluadorActual() yo: MiEvaluador,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    await this.mio.esMiDocumento(id, yo.evaluadorId)
    const { buffer, mime, nombre } = await this.service.getDocumentoArchivo(id)
    responderArchivo(res, buffer, mime, nombre, false)
  }

  @Get('documentos/:id/descargar')
  async documentoDescargar(
    @MiEvaluadorActual() yo: MiEvaluador,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    await this.mio.esMiDocumento(id, yo.evaluadorId)
    const { buffer, mime, nombre } = await this.service.getDocumentoArchivo(id)
    responderArchivo(res, buffer, mime, nombre, true)
  }

  @Get('trayectoria')
  @ApiOperation({ summary: 'Mi recorrido por los ciclos, año por año' })
  miTrayectoria(@MiEvaluadorActual() yo: MiEvaluador) {
    return this.trayectoria.getTrayectoria(yo.evaluadorId)
  }

  @Get('resumen')
  resumen(@MiEvaluadorActual() yo: MiEvaluador) {
    return this.trayectoria.getResumen(yo.evaluadorId)
  }

  @Get('convocatorias')
  @ApiOperation({ summary: '¿Me convocaron a una evaluación nueva?' })
  convocatorias(@MiEvaluadorActual() yo: MiEvaluador) {
    return this.mio.misConvocatorias(yo.evaluadorId)
  }

  @Get('evidencias')
  @ApiOperation({ summary: 'Los correos y evidencias de mis ciclos' })
  evidencias(@MiEvaluadorActual() yo: MiEvaluador) {
    return this.mio.misEvidencias(yo.evaluadorId)
  }

  @Get('evidencias/:id/archivo')
  async evidenciaArchivo(
    @MiEvaluadorActual() yo: MiEvaluador,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { buffer, mime, nombre } = await this.mio.getEvidencia(id, yo.evaluadorId)
    responderArchivo(res, buffer, mime, nombre, false)
  }

  // el frontend pregunta aquí si la cuenta tiene portal
  @Get('existo')
  existo(@MiEvaluadorActual() yo: MiEvaluador, @CurrentUser() _user: unknown) {
    return { evaluadorId: yo.evaluadorId, activo: yo.activo }
  }
}
