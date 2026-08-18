import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Res, UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CronogramaService } from './cronograma.service'
import { AgregarSesionPresencialDto } from './dto/agregar-sesion-presencial.dto'
import { AgregarSesionVirtualDto } from './dto/agregar-sesion-virtual.dto'
import { PatchSesionPresencialDto } from './dto/patch-sesion-presencial.dto'
import { PatchSesionVirtualDto } from './dto/patch-sesion-virtual.dto'
import { UpsertCronogramaDto } from './dto/upsert-cronograma.dto'

@ApiTags('cronograma')
@Controller('cronograma')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CronogramaController {
  constructor(private readonly svc: CronogramaService) {}

  @Get('describe')
  describeTables() {
    return this.svc.describeTables()
  }

  @Get('proyecto/:proyectoId/acciones')
  listarAcciones(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.listarAcciones(proyectoId)
  }

  @Get('accion/:afId/grupos')
  listarGrupos(@Param('afId', ParseIntPipe) afId: number) {
    return this.svc.listarGrupos(afId)
  }

  @Get('accion/:afId/unidades')
  listarUnidades(@Param('afId', ParseIntPipe) afId: number) {
    return this.svc.listarUnidades(afId)
  }

  @Get('buscar')
  buscarCronograma(
    @Query('grupoId', ParseIntPipe) grupoId: number,
    @Query('utId', ParseIntPipe) utId: number,
  ) {
    return this.svc.buscarCronograma(grupoId, utId)
  }

  @Post('proyecto/:proyectoId')
  upsertCronograma(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() dto: UpsertCronogramaDto,
  ) {
    return this.svc.upsertCronograma(proyectoId, dto)
  }

  @Get('proyecto/:proyectoId/exportar')
  async exportarCronograma(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.svc.exportarCronogramaProyecto(proyectoId)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }

  @Get(':cronogramaId/sesiones-presenciales')
  sesionesPresenciales(@Param('cronogramaId', ParseIntPipe) id: number) {
    return this.svc.sesionesPresenciales(id)
  }

  @Get(':cronogramaId/sesiones-virtuales')
  sesionesVirtuales(@Param('cronogramaId', ParseIntPipe) id: number) {
    return this.svc.sesionesVirtuales(id)
  }

  @Get('proyecto/:proyectoId/capacitadores-aprobados')
  capacitadoresAprobados(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.listarCapacitadoresAprobados(proyectoId)
  }

  @Get('unidad/:utId/perfiles')
  perfilesUT(@Param('utId', ParseIntPipe) utId: number) {
    return this.svc.listarPerfilesUT(utId)
  }

  @Get(':cronogramaId/coberturas-grupo')
  coberturasGrupo(@Param('cronogramaId', ParseIntPipe) cronogramaId: number) {
    return this.svc.coberturasDeGrupo(cronogramaId)
  }

  @Post(':cronogramaId/sesion-presencial')
  agregarSesionPresencial(
    @Param('cronogramaId', ParseIntPipe) cronogramaId: number,
    @Body() dto: AgregarSesionPresencialDto,
  ) {
    return this.svc.agregarSesionPresencial(cronogramaId, dto)
  }

  @Put('sesion-presencial/:sesionId')
  actualizarSesionPresencial(
    @Param('sesionId', ParseIntPipe) sesionId: number,
    @Body() dto: AgregarSesionPresencialDto,
  ) {
    return this.svc.actualizarSesionPresencial(sesionId, dto)
  }

  @Delete('sesion-presencial/:sesionId')
  eliminarSesionPresencial(@Param('sesionId', ParseIntPipe) sesionId: number) {
    return this.svc.eliminarSesionPresencial(sesionId)
  }

  @Post(':cronogramaId/sesion-virtual')
  agregarSesionVirtual(
    @Param('cronogramaId', ParseIntPipe) cronogramaId: number,
    @Body() dto: AgregarSesionVirtualDto,
  ) {
    return this.svc.agregarSesionVirtual(cronogramaId, dto)
  }

  @Put('sesion-virtual/:actividadId')
  actualizarSesionVirtual(
    @Param('actividadId', ParseIntPipe) actividadId: number,
    @Body() dto: AgregarSesionVirtualDto,
  ) {
    return this.svc.actualizarSesionVirtual(actividadId, dto)
  }

  @Delete('sesion-virtual/:actividadId')
  eliminarSesionVirtual(@Param('actividadId', ParseIntPipe) actividadId: number) {
    return this.svc.eliminarSesionVirtual(actividadId)
  }

  @Get('proyecto/:proyectoId/radicados')
  radicados(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.listarRadicados(proyectoId)
  }

  @Get('proyecto/:proyectoId/pendientes-radicar')
  pendientesRadicar(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.pendientesRadicar(proyectoId)
  }

  @Post('proyecto/:proyectoId/radicar')
  radicar(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.radicarCronograma(proyectoId)
  }

  @Get('radicado/:radicadoId')
  getRadicado(@Param('radicadoId', ParseIntPipe) radicadoId: number) {
    return this.svc.getRadicadoDetalle(radicadoId)
  }

  @Post('sesion-presencial/:sesionId/marcar-actualizada')
  marcarSesionActualizada(@Param('sesionId', ParseIntPipe) sesionId: number) {
    return this.svc.marcarSesionActualizada(sesionId)
  }

  @Post('sesion-virtual/:actividadId/marcar-actualizada')
  marcarVirtualActualizada(@Param('actividadId', ParseIntPipe) actividadId: number) {
    return this.svc.marcarVirtualActualizada(actividadId)
  }

  @Post('radicado/:radicadoId/marcar-todas-actualizadas')
  marcarTodasActualizadas(@Param('radicadoId', ParseIntPipe) radicadoId: number) {
    return this.svc.marcarTodasActualizadas(radicadoId)
  }

  @Post('radicado/:radicadoId/enviar-correcciones')
  enviarCorrecciones(@Param('radicadoId', ParseIntPipe) radicadoId: number) {
    return this.svc.enviarCorrecciones(radicadoId)
  }

  @Get('sesion-presencial/:sesionId')
  getSesionPresencial(@Param('sesionId', ParseIntPipe) sesionId: number) {
    return this.svc.getSesionPresencialPorId(sesionId)
  }

  @Get('sesion-virtual/:actividadId')
  getSesionVirtual(@Param('actividadId', ParseIntPipe) actividadId: number) {
    return this.svc.getSesionVirtualPorId(actividadId)
  }

  @Patch('sesion-presencial/:sesionId')
  patchSesionPresencial(
    @Param('sesionId', ParseIntPipe) sesionId: number,
    @Body() dto: PatchSesionPresencialDto,
  ) {
    return this.svc.patchSesionPresencial(sesionId, dto)
  }

  @Patch('sesion-virtual/:actividadId')
  patchSesionVirtual(
    @Param('actividadId', ParseIntPipe) actividadId: number,
    @Body() dto: PatchSesionVirtualDto,
  ) {
    return this.svc.patchSesionVirtual(actividadId, dto)
  }
}
