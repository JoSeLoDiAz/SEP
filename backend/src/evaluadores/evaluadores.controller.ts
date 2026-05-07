import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe,
  Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { EvaluadoresService } from './evaluadores.service'
import type {
  EstudioDto, EvaluadorActualizarDto, EvaluadorCrearDto, ExperienciaDto,
  MulterFile, ParticipacionDto, PruebaDto, TicDto,
} from './evaluadores.service'
import { CatalogosEvaluadorService } from './catalogos.service'

interface JwtUser { usuarioId: number; email: string; perfilId: number }

const PERFIL_ADMIN = 1
const PERFIL_COORDINADOR = 2
const PERFIL_GESTOR_EVALUADORES = 15
const PERFILES_GESTION = [PERFIL_ADMIN, PERFIL_COORDINADOR, PERFIL_GESTOR_EVALUADORES]

const MAX_PDF_BYTES = 8 * 1024 * 1024 // 8 MB
const MAX_FOTO_BYTES = 4 * 1024 * 1024 // 4 MB

@ApiTags('evaluadores')
@Controller('evaluadores')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EvaluadoresController {
  constructor(
    private readonly service: EvaluadoresService,
    private readonly catalogos: CatalogosEvaluadorService,
  ) {}

  private exigirGestion(user: JwtUser) {
    if (!PERFILES_GESTION.includes(user.perfilId)) {
      throw new ForbiddenException('No tiene permisos para gestionar el banco de evaluadores')
    }
  }

  private exigirAdmin(user: JwtUser) {
    if (user.perfilId !== PERFIL_ADMIN) {
      throw new ForbiddenException('Solo un administrador puede modificar los catálogos')
    }
  }

  // ── Catálogos ──────────────────────────────────────────────────────────

  @Get('catalogos/roles')
  rolesCat(@CurrentUser() user: JwtUser, @Query('todos') todos?: string) {
    this.exigirGestion(user)
    return this.catalogos.listarRoles(todos !== '1')
  }

  @Post('catalogos/roles')
  crearRol(@CurrentUser() user: JwtUser, @Body() dto: { nombre: string; descripcion?: string }) {
    this.exigirAdmin(user)
    return this.catalogos.crearRol(dto.nombre, dto.descripcion)
  }

  @Put('catalogos/roles/:id')
  actualizarRol(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { nombre?: string; descripcion?: string; activo?: boolean },
  ) {
    this.exigirAdmin(user)
    return this.catalogos.actualizarRol(id, dto)
  }

  @Get('catalogos/procesos')
  procesosCat(@CurrentUser() user: JwtUser, @Query('todos') todos?: string) {
    this.exigirGestion(user)
    return this.catalogos.listarProcesos(todos !== '1')
  }

  @Post('catalogos/procesos')
  crearProceso(@CurrentUser() user: JwtUser, @Body() dto: { nombre: string; descripcion?: string }) {
    this.exigirAdmin(user)
    return this.catalogos.crearProceso(dto.nombre, dto.descripcion)
  }

  @Put('catalogos/procesos/:id')
  actualizarProceso(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { nombre?: string; descripcion?: string; activo?: boolean },
  ) {
    this.exigirAdmin(user)
    return this.catalogos.actualizarProceso(id, dto)
  }

  @Get('catalogos/tipos-estudio')
  tiposEstudioCat(
    @CurrentUser() user: JwtUser,
    @Query('todos') todos?: string,
    @Query('excluirHv') excluirHv?: string,
  ) {
    this.exigirGestion(user)
    return this.catalogos.listarTiposEstudio(todos !== '1', excluirHv === '1')
  }

  @Post('catalogos/tipos-estudio')
  crearTipoEstudio(@CurrentUser() user: JwtUser, @Body() dto: { nombre: string }) {
    this.exigirAdmin(user)
    return this.catalogos.crearTipoEstudio(dto.nombre)
  }

  @Put('catalogos/tipos-estudio/:id')
  actualizarTipoEstudio(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { nombre?: string; activo?: boolean },
  ) {
    this.exigirAdmin(user)
    return this.catalogos.actualizarTipoEstudio(id, dto)
  }

  // ── Búsqueda previa (al crear) ─────────────────────────────────────────

  @Get('buscar-persona')
  @ApiOperation({ summary: 'Buscar persona por documento — devuelve si ya es evaluador o si se puede precargar' })
  buscarPersona(
    @CurrentUser() user: JwtUser,
    @Query('tipoDoc', ParseIntPipe) tipoDocumentoIdentidadId: number,
    @Query('doc') doc: string,
  ) {
    this.exigirGestion(user)
    return this.service.buscarPorDocumento(tipoDocumentoIdentidadId, doc)
  }

  // ── Listado y ficha ────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listado paginado de evaluadores activos' })
  listar(
    @CurrentUser() user: JwtUser,
    @Query('busqueda') busqueda = '',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    this.exigirGestion(user)
    return this.service.listar(busqueda, Number(page), Number(limit))
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha completa del evaluador' })
  ficha(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.getFicha(id)
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo evaluador' })
  crear(@CurrentUser() user: JwtUser, @Body() dto: EvaluadorCrearDto) {
    this.exigirGestion(user)
    return this.service.crear(dto)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar datos del evaluador' })
  actualizar(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EvaluadorActualizarDto,
  ) {
    this.exigirGestion(user)
    return this.service.actualizar(id, dto)
  }

  @Put(':id/estado')
  @ApiOperation({ summary: 'Activar / desactivar evaluador' })
  cambiarEstado(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { activo: boolean },
  ) {
    this.exigirGestion(user)
    return this.service.cambiarEstado(id, Boolean(dto.activo))
  }

  // ── Foto ───────────────────────────────────────────────────────────────

  @Post(':id/foto')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_FOTO_BYTES },
    fileFilter: (_r, f, cb) => {
      if (!f.mimetype.startsWith('image/')) return cb(new BadRequestException('Solo imágenes (JPG, PNG)'), false)
      cb(null, true)
    },
  }))
  subirFoto(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: MulterFile,
  ) {
    this.exigirGestion(user)
    return this.service.subirFoto(id, file)
  }

  @Get(':id/foto')
  async getFoto(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, mime } = await this.service.getFoto(id)
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Length', String(buffer.length))
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.end(buffer)
  }

  @Delete(':id/foto')
  borrarFoto(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.borrarFoto(id)
  }

  // ── Participaciones ────────────────────────────────────────────────────

  @Get(':id/participaciones')
  listarParticipaciones(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.listarParticipaciones(id)
  }

  @Post(':id/participaciones')
  crearParticipacion(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ParticipacionDto,
  ) {
    this.exigirGestion(user)
    return this.service.crearParticipacion(id, dto)
  }

  @Put('participaciones/:pid')
  actualizarParticipacion(
    @CurrentUser() user: JwtUser,
    @Param('pid', ParseIntPipe) pid: number,
    @Body() dto: Partial<ParticipacionDto>,
  ) {
    this.exigirGestion(user)
    return this.service.actualizarParticipacion(pid, dto)
  }

  @Delete('participaciones/:pid')
  eliminarParticipacion(@CurrentUser() user: JwtUser, @Param('pid', ParseIntPipe) pid: number) {
    this.exigirGestion(user)
    return this.service.eliminarParticipacion(pid)
  }

  // ── Hoja de vida (separada de Estudios) ────────────────────────────────

  @Get(':id/hoja-vida')
  @ApiOperation({ summary: 'Obtener metadatos de la hoja de vida del evaluador' })
  getHV(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.getHojaVida(id)
  }

  @Post(':id/hoja-vida')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_PDF_BYTES },
    fileFilter: (_r, f, cb) => {
      if (f.mimetype !== 'application/pdf') return cb(new BadRequestException('Solo PDF'), false)
      cb(null, true)
    },
  }))
  subirHV(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: MulterFile,
  ) {
    this.exigirGestion(user)
    return this.service.guardarHojaVida(id, file)
  }

  @Delete(':id/hoja-vida')
  borrarHV(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.eliminarHojaVida(id)
  }

  // ── Estudios (diplomas, certificados — excluye HV) ─────────────────────

  @Get(':id/estudios')
  listarEstudios(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.listarEstudios(id)
  }

  @Post(':id/estudios')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_PDF_BYTES },
    fileFilter: (_r, f, cb) => {
      if (f.mimetype !== 'application/pdf') return cb(new BadRequestException('Solo PDF'), false)
      cb(null, true)
    },
  }))
  crearEstudio(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: MulterFile | undefined,
    @Body() body: { tipoEstudioId?: string; titulo?: string; institucion?: string; fechaGrado?: string },
  ) {
    this.exigirGestion(user)
    const dto: EstudioDto = {
      tipoEstudioId: Number(body.tipoEstudioId),
      titulo: body.titulo,
      institucion: body.institucion,
      fechaGrado: body.fechaGrado,
    }
    return this.service.crearEstudio(id, dto, file)
  }

  @Get('estudios/:sid/archivo')
  async getEstudioArchivo(
    @CurrentUser() user: JwtUser,
    @Param('sid', ParseIntPipe) sid: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, mime, nombre } = await this.service.getEstudioArchivo(sid)
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre)}"`)
    res.setHeader('Content-Length', String(buffer.length))
    res.end(buffer)
  }

  @Delete('estudios/:sid')
  eliminarEstudio(@CurrentUser() user: JwtUser, @Param('sid', ParseIntPipe) sid: number) {
    this.exigirGestion(user)
    return this.service.eliminarEstudio(sid)
  }

  // ── Experiencia laboral ────────────────────────────────────────────────

  @Get(':id/experiencia')
  listarExperiencias(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.listarExperiencias(id)
  }

  @Post(':id/experiencia')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_PDF_BYTES },
    fileFilter: (_r, f, cb) => {
      if (f.mimetype !== 'application/pdf') return cb(new BadRequestException('Solo PDF'), false)
      cb(null, true)
    },
  }))
  crearExperiencia(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: MulterFile | undefined,
    @Body() body: { cargo?: string; entidad?: string; fechaInicio?: string; fechaFin?: string },
  ) {
    this.exigirGestion(user)
    const dto: ExperienciaDto = {
      cargo: body.cargo ?? '',
      entidad: body.entidad ?? '',
      fechaInicio: body.fechaInicio,
      fechaFin: body.fechaFin || null,
    }
    return this.service.crearExperiencia(id, dto, file)
  }

  @Get('experiencia/:eid/archivo')
  async getExperienciaArchivo(
    @CurrentUser() user: JwtUser,
    @Param('eid', ParseIntPipe) eid: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, mime, nombre } = await this.service.getExperienciaArchivo(eid)
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre)}"`)
    res.setHeader('Content-Length', String(buffer.length))
    res.end(buffer)
  }

  @Delete('experiencia/:eid')
  eliminarExperiencia(@CurrentUser() user: JwtUser, @Param('eid', ParseIntPipe) eid: number) {
    this.exigirGestion(user)
    return this.service.eliminarExperiencia(eid)
  }

  // ── TIC ────────────────────────────────────────────────────────────────

  @Get(':id/tic')
  listarTics(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.listarTics(id)
  }

  @Post(':id/tic')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_PDF_BYTES },
    fileFilter: (_r, f, cb) => {
      if (f.mimetype !== 'application/pdf') return cb(new BadRequestException('Solo PDF'), false)
      cb(null, true)
    },
  }))
  crearTic(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: MulterFile | undefined,
    @Body() body: { tipoEventoId?: string; nombre?: string; horas?: string; fechaFin?: string },
  ) {
    this.exigirGestion(user)
    const dto: TicDto = {
      tipoEventoId: body.tipoEventoId ? Number(body.tipoEventoId) : null,
      nombre: body.nombre ?? '',
      horas: body.horas ? Number(body.horas) : undefined,
      fechaFin: body.fechaFin || null,
    }
    return this.service.crearTic(id, dto, file)
  }

  @Get('tic/:tid/archivo')
  async getTicArchivo(
    @CurrentUser() user: JwtUser,
    @Param('tid', ParseIntPipe) tid: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, mime, nombre } = await this.service.getTicArchivo(tid)
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre)}"`)
    res.setHeader('Content-Length', String(buffer.length))
    res.end(buffer)
  }

  @Delete('tic/:tid')
  eliminarTic(@CurrentUser() user: JwtUser, @Param('tid', ParseIntPipe) tid: number) {
    this.exigirGestion(user)
    return this.service.eliminarTic(tid)
  }

  // ── Pruebas de conocimiento ────────────────────────────────────────────

  @Get(':id/pruebas')
  listarPruebas(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.listarPruebas(id)
  }

  @Post(':id/pruebas')
  crearPrueba(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PruebaDto,
  ) {
    this.exigirGestion(user)
    return this.service.crearPrueba(id, dto)
  }

  @Put('pruebas/:pid')
  actualizarPrueba(
    @CurrentUser() user: JwtUser,
    @Param('pid', ParseIntPipe) pid: number,
    @Body() dto: Partial<PruebaDto>,
  ) {
    this.exigirGestion(user)
    return this.service.actualizarPrueba(pid, dto)
  }

  @Delete('pruebas/:pid')
  eliminarPrueba(@CurrentUser() user: JwtUser, @Param('pid', ParseIntPipe) pid: number) {
    this.exigirGestion(user)
    return this.service.eliminarPrueba(pid)
  }
}
