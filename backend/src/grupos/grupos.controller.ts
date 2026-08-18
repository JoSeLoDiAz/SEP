import { Body, Controller, Get, Header, Param, ParseIntPipe, Post, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { GruposService } from './grupos.service'

@ApiTags('grupos')
@Controller('grupos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GruposController {
  constructor(private readonly svc: GruposService) {}

  @Get('proyecto/:proyectoId/acciones')
  listarAcciones(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.listarAcciones(proyectoId)
  }

  @Get('proyecto/:proyectoId/af/:afId/grupos')
  listarGruposDeAF(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afId', ParseIntPipe) afId: number,
  ) {
    return this.svc.listarGruposDeAF(proyectoId, afId)
  }

  @Get('proyecto/:proyectoId/grupo/:afGrupoId/beneficiarios')
  listarBeneficiariosGrupo(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afGrupoId', ParseIntPipe) afGrupoId: number,
  ) {
    return this.svc.listarBeneficiariosGrupo(proyectoId, afGrupoId)
  }

  @Get('proyecto/:proyectoId/grupo/:afGrupoId/cobertura')
  getCoberturaGrupo(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afGrupoId', ParseIntPipe) afGrupoId: number,
  ) {
    return this.svc.getCoberturaGrupo(proyectoId, afGrupoId)
  }

  // duplicado = misma pareja (PERSONAID, AFGRUPOID)
  @Post('proyecto/:proyectoId/limpiar-duplicados')
  limpiarDuplicados(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.limpiarDuplicados(proyectoId)
  }

  @Post('proyecto/:proyectoId/beneficiario/:afGrupoBeneficiarioId/estado')
  cambiarEstadoBeneficiario(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afGrupoBeneficiarioId', ParseIntPipe) afGrupoBeneficiarioId: number,
    @Body() body: { estado: 'ACTIVO' | 'RETIRADO' },
  ) {
    return this.svc.cambiarEstadoBeneficiario(proyectoId, afGrupoBeneficiarioId, body?.estado)
  }

  @Get('proyecto/:proyectoId/exportar')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportar(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Res() res: Response,
  ) {
    const buf = await this.svc.exportarGruposExcel(proyectoId)
    res.setHeader('Content-Disposition', `attachment; filename="Grupos_proyecto_${proyectoId}.xlsx"`)
    res.setHeader('Content-Length', String(buf.length))
    res.end(buf)
  }
}
