import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe,
  Post, Put, Req, Res, UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { RetroalimentacionService } from './retroalimentacion.service'
import type { RespuestaEnviada } from './retroalimentacion.service'
import { RetroReporteService } from './retro-reporte.service'
import { RetroHistoricoService } from './retro-historico.service'
import type { RetroHistoricaDto } from './retro-historico.service'

interface JwtUser { usuarioId: number; email: string; perfilId: number }

const PERFIL_ADMIN = 1
const PERFIL_COORDINADOR = 2
const PERFIL_GESTOR_EVALUADORES = 15
const PERFILES_GESTION = [PERFIL_ADMIN, PERFIL_COORDINADOR, PERFIL_GESTOR_EVALUADORES]

// el participacionId del evaluador nunca llega por parámetro: sale del JWT
@ApiTags('retroalimentacion')
@Controller('retroalimentacion')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RetroalimentacionController {
  constructor(
    private readonly service: RetroalimentacionService,
    private readonly reportes: RetroReporteService,
    private readonly historico: RetroHistoricoService,
  ) {}

  private exigirGestion(user: JwtUser) {
    if (!PERFILES_GESTION.includes(user.perfilId)) {
      throw new ForbiddenException('No tiene permisos para gestionar la retroalimentación')
    }
  }


  private ctx(user: JwtUser) {
    return { usuarioEmail: user.email, usuarioPerfilId: user.perfilId }
  }

  private async miParticipacion(user: JwtUser): Promise<number> {
    const ciclo = await this.service.miCiclo(user.email)
    if (!ciclo) {
      throw new ForbiddenException(
        'No tienes un ciclo de retroalimentación abierto. Si crees que es un error, ' +
        'consulta con el equipo del banco de evaluadores.',
      )
    }
    return ciclo.participacionId
  }

  // lado del evaluador

  @Get('mi-ciclo')
  @ApiOperation({ summary: 'Ciclo abierto del usuario logueado (rol, área, convocatoria)' })
  async miCiclo(@CurrentUser() user: JwtUser) {
    const ciclo = await this.service.miCiclo(user.email)
    return ciclo ?? { sinCiclo: true }
  }

  @Get('mis-asignaciones')
  @ApiOperation({ summary: 'Personas que le toca retroalimentar, agrupadas por rol' })
  async misAsignaciones(@CurrentUser() user: JwtUser) {
    return this.service.misAsignaciones(await this.miParticipacion(user))
  }

  @Get('formulario')
  @ApiOperation({ summary: 'Preguntas del instrumento de su ciclo' })
  async miFormulario(@CurrentUser() user: JwtUser) {
    const ciclo = await this.service.miCiclo(user.email)
    if (!ciclo) throw new ForbiddenException('No tienes un ciclo de retroalimentación abierto')
    return this.service.getFormulario(ciclo.convocatoriaId)
  }

  @Post('sesion')
  @ApiOperation({ summary: 'Inicia el cronómetro de diligenciamiento' })
  async iniciarSesion(@CurrentUser() user: JwtUser, @Req() req: Request) {
    return this.service.iniciarSesion(await this.miParticipacion(user), {
      ...this.ctx(user),
      ip: (req.headers['x-forwarded-for'] as string) ?? req.ip,
    })
  }

  @Get('sesion/:sid')
  @ApiOperation({ summary: 'Rehidrata el cronómetro al recargar la página' })
  async getSesion(@CurrentUser() user: JwtUser, @Param('sid', ParseIntPipe) sid: number) {
    return this.service.getSesion(sid, await this.miParticipacion(user))
  }

  @Post('sesion/:sid/enviar')
  @ApiOperation({ summary: 'Envía todas las retroalimentaciones de la sesión' })
  async enviar(
    @CurrentUser() user: JwtUser,
    @Param('sid', ParseIntPipe) sid: number,
    @Body() body: { respuestas: RespuestaEnviada[]; sugerenciaGeneral?: string },
  ) {
    return this.service.enviarSesion(sid, await this.miParticipacion(user), body)
  }

  // gestión del ciclo

  @Get('convocatorias/:cid/formulario')
  @ApiOperation({ summary: 'Instrumento de la convocatoria (lo clona de la plantilla la primera vez)' })
  formularioDe(@CurrentUser() user: JwtUser, @Param('cid', ParseIntPipe) cid: number) {
    this.exigirGestion(user)
    return this.service.getFormulario(cid)
  }

  @Put('convocatorias/:cid/apertura')
  @ApiOperation({ summary: 'Abre o cierra el diligenciamiento del ciclo' })
  apertura(
    @CurrentUser() user: JwtUser,
    @Param('cid', ParseIntPipe) cid: number,
    @Body() dto: { abierto: boolean },
  ) {
    this.exigirGestion(user)
    if (typeof dto?.abierto !== 'boolean') {
      throw new BadRequestException('Indique `abierto` como true o false')
    }
    return this.service.cambiarApertura(cid, dto.abierto, this.ctx(user))
  }

  @Get('convocatorias/:cid/matriz/preview')
  @ApiOperation({ summary: 'Simula la matriz sin escribir. Mismo cálculo que generar' })
  preview(@CurrentUser() user: JwtUser, @Param('cid', ParseIntPipe) cid: number) {
    this.exigirGestion(user)
    return this.service.previewMatriz(cid)
  }

  @Post('convocatorias/:cid/matriz/generar')
  @ApiOperation({ summary: 'Persiste los pares. Reejecutable: solo agrega los que faltan' })
  generar(@CurrentUser() user: JwtUser, @Param('cid', ParseIntPipe) cid: number) {
    this.exigirGestion(user)
    return this.service.generarMatriz(cid, this.ctx(user))
  }

  @Post('convocatorias/:cid/asignaciones')
  @ApiOperation({ summary: 'Agrega a mano un par que la regla no cubrió' })
  agregarAsignacion(
    @CurrentUser() user: JwtUser,
    @Param('cid', ParseIntPipe) cid: number,
    @Body() dto: { evaluadorParticipacionId: number; evaluadoParticipacionId: number },
  ) {
    this.exigirGestion(user)
    return this.service.agregarAsignacion(cid, dto, this.ctx(user))
  }

  @Put('asignaciones/:aid/anular')
  @ApiOperation({ summary: 'Retira una asignación pendiente sin borrar la traza' })
  anular(
    @CurrentUser() user: JwtUser,
    @Param('aid', ParseIntPipe) aid: number,
    @Body() dto: { motivo?: string },
  ) {
    this.exigirGestion(user)
    return this.service.anularAsignacion(aid, dto?.motivo ?? 'anulada', this.ctx(user))
  }

  @Get('convocatorias/:cid/avance')
  @ApiOperation({ summary: 'Quién diligenció y quién no, con tiempos' })
  avance(@CurrentUser() user: JwtUser, @Param('cid', ParseIntPipe) cid: number) {
    this.exigirGestion(user)
    return this.service.avance(cid)
  }

  @Get('convocatorias/:cid/sugerencias')
  @ApiOperation({ summary: 'Respuestas a la pregunta general del proceso (sin nombres)' })
  sugerencias(@CurrentUser() user: JwtUser, @Param('cid', ParseIntPipe) cid: number) {
    this.exigirGestion(user)
    return this.service.sugerencias(cid)
  }

  @Get('convocatorias/:cid/reporte.xlsx')
  @ApiOperation({ summary: 'Reporte de 7 hojas del ciclo. Incluye nombres: es para el control de cambios' })
  async reporte(
    @CurrentUser() user: JwtUser,
    @Param('cid', ParseIntPipe) cid: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, nombre } = await this.reportes.generar(cid)
    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Length', String(buffer.length))
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombre}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    )
    res.end(buffer)
  }

  @Get('participaciones/:pid/resultados')
  @ApiOperation({
    summary: 'Lo que recibió un evaluador en un ciclo. Los nombres solo salen para admin y coordinación',
  })
  resultados(@CurrentUser() user: JwtUser, @Param('pid', ParseIntPipe) pid: number) {
    this.exigirGestion(user)
    return this.service.resultados(pid, user.perfilId, user.email)
  }

  // cargue del histórico: años anteriores al 2026, que nunca se diligenciaron en el sistema

  @Get('historico/participaciones/:pid/instrumento')
  @ApiOperation({ summary: 'Preguntas y escala del año de esa participación, para la pantalla de cargue' })
  histInstrumento(@CurrentUser() user: JwtUser, @Param('pid', ParseIntPipe) pid: number) {
    this.exigirGestion(user)
    return this.historico.instrumento(pid)
  }

  @Get('historico/participaciones/:pid/companeros')
  @ApiOperation({ summary: 'Quiénes estuvieron ese mismo año, para escoger quién calificó' })
  histCompaneros(@CurrentUser() user: JwtUser, @Param('pid', ParseIntPipe) pid: number) {
    this.exigirGestion(user)
    return this.historico.companeros(pid)
  }

  @Get('historico/participaciones/:pid/recibidas')
  @ApiOperation({ summary: 'Las que esa persona recibió, con quién se la hizo y las respuestas' })
  histRecibidas(@CurrentUser() user: JwtUser, @Param('pid', ParseIntPipe) pid: number) {
    this.exigirGestion(user)
    return this.historico.recibidas(pid)
  }

  @Put('historico/:rid')
  @ApiOperation({ summary: 'Corrige una retroalimentación cargada a mano' })
  histEditar(
    @CurrentUser() user: JwtUser,
    @Param('rid', ParseIntPipe) rid: number,
    @Body() body: { escalas: Record<string, number>; textos?: Record<string, string> },
  ) {
    this.exigirGestion(user)
    return this.historico.editar(rid, body, this.ctx(user))
  }

  @Delete('historico/:rid')
  @ApiOperation({ summary: 'Quita una retroalimentación cargada por equivocación' })
  histEliminar(@CurrentUser() user: JwtUser, @Param('rid', ParseIntPipe) rid: number) {
    this.exigirGestion(user)
    return this.historico.eliminar(rid, this.ctx(user))
  }

  @Post('historico')
  @ApiOperation({ summary: 'Registra a mano una retroalimentación de un año anterior' })
  histRegistrar(@CurrentUser() user: JwtUser, @Body() body: RetroHistoricaDto) {
    this.exigirGestion(user)
    return this.historico.registrar(body, this.ctx(user))
  }

  @Get('historico/modelos')
  @ApiOperation({ summary: 'Convocatorias anteriores que ya tienen su hoja registrada' })
  histModelos(@CurrentUser() user: JwtUser) {
    this.exigirGestion(user)
    return this.historico.modelos()
  }

  @Put('historico/convocatorias/:cid/preguntas')
  @ApiOperation({ summary: 'Registra las preguntas de la hoja de esa convocatoria' })
  histPreguntas(
    @CurrentUser() user: JwtUser,
    @Param('cid', ParseIntPipe) cid: number,
    @Body() body: { preguntas: Array<{ texto: string; tipo: string }> },
  ) {
    this.exigirGestion(user)
    return this.historico.guardarPreguntas(cid, body, this.ctx(user))
  }

  @Delete('historico/convocatorias/:cid/preguntas')
  @ApiOperation({ summary: 'Quita las preguntas para volver a registrarlas' })
  histBorrarPreguntas(@CurrentUser() user: JwtUser, @Param('cid', ParseIntPipe) cid: number) {
    this.exigirGestion(user)
    return this.historico.borrarPreguntas(cid, this.ctx(user))
  }

  @Post('historico/convocatorias/:cid/preguntas/copiar')
  @ApiOperation({ summary: 'Copia la hoja de otra convocatoria como punto de partida' })
  histCopiar(
    @CurrentUser() user: JwtUser,
    @Param('cid', ParseIntPipe) cid: number,
    @Body() body: { origenConvocatoriaId: number },
  ) {
    this.exigirGestion(user)
    if (!body?.origenConvocatoriaId) {
      throw new BadRequestException('Indique de qué convocatoria quiere copiar las preguntas')
    }
    return this.historico.copiarPreguntas(cid, Number(body.origenConvocatoriaId), this.ctx(user))
  }
}
