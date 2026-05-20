import { Body, Controller, Get, Header, Param, ParseIntPipe, Post, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CertificacionService } from './certificacion.service'

@ApiTags('certificacion')
@Controller('certificacion')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CertificacionController {
  constructor(private readonly svc: CertificacionService) {}

  /** Cabecera: AF, grupo, modalidad, evento, horas totales. */
  @Get('proyecto/:proyectoId/grupo/:afGrupoId')
  getCabecera(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afGrupoId', ParseIntPipe) afGrupoId: number,
  ) {
    return this.svc.getCabecera(proyectoId, afGrupoId)
  }

  /** Combobox de UTs del AF. */
  @Get('proyecto/:proyectoId/grupo/:afGrupoId/unidades')
  listarUnidades(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afGrupoId', ParseIntPipe) afGrupoId: number,
  ) {
    return this.svc.listarUnidades(proyectoId, afGrupoId)
  }

  /** Sesiones de la UT (presenciales o virtuales según modalidad). */
  @Get('proyecto/:proyectoId/grupo/:afGrupoId/unidad/:utId/sesiones')
  listarSesiones(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afGrupoId', ParseIntPipe) afGrupoId: number,
    @Param('utId', ParseIntPipe) utId: number,
  ) {
    return this.svc.listarSesiones(proyectoId, afGrupoId, utId)
  }

  /** Beneficiarios del grupo con sus UTHoras actuales para una UT. */
  @Get('proyecto/:proyectoId/grupo/:afGrupoId/unidad/:utId/beneficiarios')
  listarBeneficiarios(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afGrupoId', ParseIntPipe) afGrupoId: number,
    @Param('utId', ParseIntPipe) utId: number,
  ) {
    return this.svc.listarBeneficiarios(proyectoId, afGrupoId, utId)
  }

  /** Certifica masivamente a todos los beneficiarios activos del grupo con
   *  las horas máximas de cada sesión. No sobrescribe filas con horas > 0. */
  @Post('proyecto/:proyectoId/grupo/:afGrupoId/unidad/:utId/masivo')
  certificarMasivo(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afGrupoId', ParseIntPipe) afGrupoId: number,
    @Param('utId', ParseIntPipe) utId: number,
  ) {
    return this.svc.certificarMasivo(proyectoId, afGrupoId, utId)
  }

  /** Datos del Reporte de Asistencia: cabecera + UTs + beneficiarios + horas. */
  @Get('proyecto/:proyectoId/grupo/:afGrupoId/asistencia')
  getReporteAsistencia(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afGrupoId', ParseIntPipe) afGrupoId: number,
  ) {
    return this.svc.getReporteAsistencia(proyectoId, afGrupoId)
  }

  /** Descarga del Reporte de Asistencia en Excel (.xlsx) con cabecera F2.x/F3.1. */
  @Get('proyecto/:proyectoId/grupo/:afGrupoId/asistencia/excel')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportarAsistenciaExcel(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afGrupoId', ParseIntPipe) afGrupoId: number,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.svc.exportarAsistenciaExcel(proyectoId, afGrupoId)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', String(buffer.length))
    res.end(buffer)
  }

  /** Guarda las UTHoras de un beneficiario en una UT. */
  @Post('proyecto/:proyectoId/grupo/:afGrupoId/unidad/:utId/persona/:personaId')
  guardarHoras(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afGrupoId', ParseIntPipe) afGrupoId: number,
    @Param('utId', ParseIntPipe) utId: number,
    @Param('personaId', ParseIntPipe) personaId: number,
    @Body() body: { horas: number[] },
  ) {
    return this.svc.guardarHoras(proyectoId, afGrupoId, utId, personaId, body?.horas ?? [])
  }
}
