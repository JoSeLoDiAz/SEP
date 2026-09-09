import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { NecesidadesService } from './necesidades.service'

interface JwtUser { usuarioId: number; email: string; perfilId: number }

@ApiTags('necesidades')
@Controller('necesidades')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NecesidadesController {
  constructor(private readonly necesidadesService: NecesidadesService) {}

  @Get()
  listar(@CurrentUser() user: JwtUser) {
    return this.necesidadesService.listar(user.email)
  }

  @Post()
  crear(@CurrentUser() user: JwtUser) {
    return this.necesidadesService.crear(user.email, user.usuarioId)
  }

  @Delete(':id')
  eliminar(@Param('id') id: string) {
    return this.necesidadesService.eliminar(Number(id))
  }

  @Get('fuentes-herramienta')
  getFuentes() {
    return this.necesidadesService.getFuentesHerramienta()
  }

  @Get(':id/reporte')
  getReporte(@Param('id') id: string) {
    return this.necesidadesService.getReporte(Number(id))
  }

  @Get(':id')
  getDiagnostico(@Param('id') id: string) {
    return this.necesidadesService.getDiagnostico(Number(id))
  }

  @Put(':id/diagnostico')
  guardarDiagnostico(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.necesidadesService.guardarDiagnostico(
      Number(id),
      dto as Parameters<NecesidadesService['guardarDiagnostico']>[1],
    )
  }

  @Post(':id/herramientas')
  registrarHerramienta(
    @Param('id') id: string,
    @Body() dto: { fuenteId: number; muestra: number },
    @CurrentUser() user: JwtUser,
  ) {
    return this.necesidadesService.registrarHerramienta(
      Number(id), dto.fuenteId, dto.muestra, user.usuarioId,
    )
  }

  @Delete('herramientas/:hid')
  eliminarHerramienta(@Param('hid') hid: string) {
    return this.necesidadesService.eliminarHerramienta(Number(hid))
  }

  @Post(':id/necesidades-formacion')
  registrarNecesidadFormacion(
    @Param('id') id: string,
    @Body() dto: { nombre: string; benef: number },
    @CurrentUser() user: JwtUser,
  ) {
    return this.necesidadesService.registrarNecesidadFormacion(
      Number(id), dto.nombre, dto.benef, user.usuarioId,
    )
  }

  @Put('necesidades-formacion/:nfid')
  editarNecesidadFormacion(
    @Param('nfid') nfid: string,
    @Body() dto: { nombre: string; benef: number },
  ) {
    return this.necesidadesService.editarNecesidadFormacion(Number(nfid), dto.nombre, dto.benef)
  }

  @Delete('necesidades-formacion/:nfid')
  eliminarNecesidadFormacion(@Param('nfid') nfid: string) {
    return this.necesidadesService.eliminarNecesidadFormacion(Number(nfid))
  }
}
