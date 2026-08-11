import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Res,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
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

const MAX_ARCHIVO_BYTES = 8 * 1024 * 1024 // 8 MB, el mismo tope de todo el SEP

/**
 * El expediente del evaluador, para el evaluador.
 *
 * Prefijo propio y no rutas nuevas dentro de `/evaluadores` por dos razones.
 * La de fondo: allí TODO exige perfil de gestión, y abrir agujeros en un
 * controlador de cuarenta y tantos métodos que comprueban permisos a mano es
 * pedir que un día se olvide uno. La práctica: ese controlador tiene un
 * `@Get(':id')` que en Express 5 se traga cualquier segmento suelto que se
 * añada debajo, y el propio módulo ya tuvo que ordenar los controladores para
 * esquivarlo.
 *
 * Aquí no se recibe NUNCA el identificador del evaluador: lo pone el guard a
 * partir de la sesión. Lo que sí llega del cliente son identificadores de
 * archivos concretos, y cada uno se comprueba contra el dueño antes de
 * entregar nada.
 *
 * Qué NO hay aquí, y es deliberado: nada que cambie la situación del
 * evaluador dentro de un ciclo. Ni estado, ni aprobación, ni participaciones,
 * ni puntajes de prueba, ni emisión de certificados. Eso lo decide el equipo
 * del banco; si el evaluador pudiera tocarlo, dejaría de ser una decisión.
 */
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
  ) {}

  // ── Mi ficha ───────────────────────────────────────────────────────────

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

  /**
   * Solo los datos que son de la persona, y se copian campo por campo.
   *
   * La lista blanca es explícita a propósito: si se pasara el cuerpo entero al
   * servicio, cualquier campo que se añada mañana al DTO quedaría editable
   * desde aquí sin que nadie lo decida.
   *
   * Fuera quedan dos grupos, por motivos distintos.
   *
   * Regional, centro, cargo y jefe directo los pone la entidad: son los que
   * deciden a qué convocatorias entra y quién aprueba su participación.
   * Editarlos aquí convertiría un dato institucional en una casilla de texto.
   *
   * Y los CORREOS no se tocan, aunque parezcan datos personales. Son la llave
   * con la que se decide de quién es este expediente: el portal cruza el
   * correo de la cuenta con el de la ficha. Alguien que pudiera cambiarlo a
   * mano podría hacer que la ficha de otra persona respondiera también a su
   * correo y dejarla sin acceso al suyo. Un cambio de correo lo hace el
   * equipo del banco.
   */
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
      otrosEstudios: dto.otrosEstudios,
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

  // ── Hoja de vida: estudios, experiencia y TIC ──────────────────────────

  @Get('estudios')
  estudios(@MiEvaluadorActual() yo: MiEvaluador) {
    return this.service.listarEstudios(yo.evaluadorId)
  }

  @Post('estudios')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_ARCHIVO_BYTES }, fileFilter: filtroSoloNombre,
  }))
  crearEstudio(
    @MiEvaluadorActual() yo: MiEvaluador,
    @Body() dto: EstudioDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.service.crearEstudio(yo.evaluadorId, dto, file)
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
    @MiEvaluadorActual() yo: MiEvaluador,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.mio.esMiEstudio(id, yo.evaluadorId)
    return this.service.eliminarEstudio(id)
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
    @MiEvaluadorActual() yo: MiEvaluador,
    @Body() dto: ExperienciaDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.service.crearExperiencia(yo.evaluadorId, dto, file)
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
    @MiEvaluadorActual() yo: MiEvaluador,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.mio.esMiExperiencia(id, yo.evaluadorId)
    return this.service.eliminarExperiencia(id)
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
    @MiEvaluadorActual() yo: MiEvaluador,
    @Body() dto: TicDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.service.crearTic(yo.evaluadorId, dto, file)
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
    @MiEvaluadorActual() yo: MiEvaluador,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.mio.esMiTic(id, yo.evaluadorId)
    return this.service.eliminarTic(id)
  }

  // ── Mis documentos ────────────────────────────────────────────────────

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

  // ── Mi trayectoria ────────────────────────────────────────────────────

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

  /** Para que el frontend sepa si esta cuenta tiene portal, sin adivinar. */
  @Get('existo')
  existo(@MiEvaluadorActual() yo: MiEvaluador, @CurrentUser() _user: unknown) {
    return { evaluadorId: yo.evaluadorId, activo: yo.activo }
  }
}
