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

  /** Combobox de AFs del proyecto. */
  @Get('proyecto/:proyectoId/acciones')
  listarAcciones(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.listarAcciones(proyectoId)
  }

  /** Cards de grupos de una AF. */
  @Get('proyecto/:proyectoId/af/:afId/grupos')
  listarGruposDeAF(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afId', ParseIntPipe) afId: number,
  ) {
    return this.svc.listarGruposDeAF(proyectoId, afId)
  }

  /** Tabla del modal "Ver beneficiarios del grupo". */
  @Get('proyecto/:proyectoId/grupo/:afGrupoId/beneficiarios')
  listarBeneficiariosGrupo(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afGrupoId', ParseIntPipe) afGrupoId: number,
  ) {
    return this.svc.listarBeneficiariosGrupo(proyectoId, afGrupoId)
  }

  /** Modal Cobertura: depto/ciudad/cupos + justificación. */
  @Get('proyecto/:proyectoId/grupo/:afGrupoId/cobertura')
  getCoberturaGrupo(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afGrupoId', ParseIntPipe) afGrupoId: number,
  ) {
    return this.svc.getCoberturaGrupo(proyectoId, afGrupoId)
  }

  /** Limpia filas duplicadas (PERSONAID, AFGRUPOID). Útil para sanear datos
   *  legacy de cuando el flujo creaba un registro nuevo en cada asociar. */
  @Post('proyecto/:proyectoId/limpiar-duplicados')
  limpiarDuplicados(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.limpiarDuplicados(proyectoId)
  }

  /** Cambia el estado (ACTIVO/RETIRADO) de un beneficiario en un grupo. */
  @Post('proyecto/:proyectoId/beneficiario/:afGrupoBeneficiarioId/estado')
  cambiarEstadoBeneficiario(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afGrupoBeneficiarioId', ParseIntPipe) afGrupoBeneficiarioId: number,
    @Body() body: { estado: 'ACTIVO' | 'RETIRADO' },
  ) {
    return this.svc.cambiarEstadoBeneficiario(proyectoId, afGrupoBeneficiarioId, body?.estado)
  }

  /** Descarga del reporte en Excel con dos hojas: Grupos · Beneficiarios. */
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
