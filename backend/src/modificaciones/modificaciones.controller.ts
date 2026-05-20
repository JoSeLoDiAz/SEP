import {
  Body, Controller, Delete, Get, Header, Param, ParseIntPipe, Post, Put, Res, UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ModificacionesService } from './modificaciones.service'
import type { ModificacionDto } from './modificaciones.service'

interface JwtUser { usuarioId: number; email: string; perfilId: number }

@ApiTags('modificaciones')
@Controller('modificaciones')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ModificacionesController {
  constructor(private readonly svc: ModificacionesService) {}

  /** Catálogo de tipos de modificación (combobox). */
  @Get('tipos')
  listarTipos() {
    return this.svc.listarTipos()
  }

  /** Lista de modificaciones de un proyecto. */
  @Get('proyecto/:proyectoId')
  listar(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.listar(proyectoId)
  }

  /** Exporta a Excel todas las modificaciones del proyecto. */
  @Get('proyecto/:proyectoId/excel')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportarExcel(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.svc.exportarExcel(proyectoId)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', String(buffer.length))
    res.end(buffer)
  }

  /** Detalle de una modificación. */
  @Get('proyecto/:proyectoId/:id')
  getOne(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.getOne(proyectoId, id)
  }

  /** Crea una modificación nueva. */
  @Post('proyecto/:proyectoId')
  crear(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() dto: ModificacionDto,
  ) {
    return this.svc.crear(proyectoId, dto, user.usuarioId, user.perfilId)
  }

  /** Actualiza una modificación existente. */
  @Put('proyecto/:proyectoId/:id')
  actualizar(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModificacionDto,
  ) {
    return this.svc.actualizar(proyectoId, id, dto, user.usuarioId, user.perfilId)
  }

  /** Elimina una modificación (solo administrador). */
  @Delete('proyecto/:proyectoId/:id')
  eliminar(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.eliminar(proyectoId, id, user.perfilId)
  }
}
