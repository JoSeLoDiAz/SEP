import {
  Body, Controller, Delete, Get, Header, Param, ParseIntPipe, Post, Put, Res, UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { PlataformasVirtualesService } from './plataformas-virtuales.service'
import type { PlataformaVirtualDto } from './plataformas-virtuales.service'

interface JwtUser { usuarioId: number; email: string; perfilId: number }

@ApiTags('plataformas-virtuales')
@Controller('plataformas-virtuales')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PlataformasVirtualesController {
  constructor(private readonly svc: PlataformasVirtualesService) {}

  /** Lista de plataformas virtuales del proyecto. */
  @Get('proyecto/:proyectoId')
  listar(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.svc.listar(proyectoId)
  }

  /** Exporta a Excel todas las plataformas virtuales del proyecto. */
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

  /** Detalle de una plataforma virtual. */
  @Get('proyecto/:proyectoId/:id')
  getOne(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.getOne(proyectoId, id)
  }

  /** Crea una nueva plataforma virtual. */
  @Post('proyecto/:proyectoId')
  crear(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() dto: PlataformaVirtualDto,
  ) {
    return this.svc.crear(proyectoId, dto)
  }

  /** Actualiza una plataforma virtual existente. */
  @Put('proyecto/:proyectoId/:id')
  actualizar(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PlataformaVirtualDto,
  ) {
    return this.svc.actualizar(proyectoId, id, dto)
  }

  /** Elimina una plataforma virtual (solo administrador). */
  @Delete('proyecto/:proyectoId/:id')
  eliminar(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.eliminar(proyectoId, id, user.perfilId)
  }
}
