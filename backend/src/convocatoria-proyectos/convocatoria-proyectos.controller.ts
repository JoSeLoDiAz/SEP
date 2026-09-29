import {
  BadRequestException, Controller, Delete, ForbiddenException, Get, Header, Param,
  Post, Query, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common'
import type { Response } from 'express'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ConvocatoriaProyectosService } from './convocatoria-proyectos.service'

interface JwtUser { usuarioId: number; email: string; perfilId: number }
interface MulterFile { originalname: string; mimetype: string; size: number; buffer: Buffer }

const PERFIL_ADMIN = 1
const MAX_BYTES = 16 * 1024 * 1024

@ApiTags('admin/convocatoria-proyectos')
@Controller('admin/convocatoria-proyectos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConvocatoriaProyectosController {
  constructor(private readonly service: ConvocatoriaProyectosService) {}

  private exigirAdmin(user: JwtUser) {
    if (user.perfilId !== PERFIL_ADMIN) {
      throw new ForbiddenException('Solo un administrador puede gestionar los proyectos guardados')
    }
  }

  // ── Guardar (re-sube el .xlsx; el backend lo parsea y persiste el JSON) ─────
  @Post('guardar')
  @ApiOperation({ summary: 'Guarda el proyecto del Excel en la convocatoria (sin importarlo)' })
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_BYTES },
    fileFilter: (_r, f, cb) => {
      const ok = f.originalname.toLowerCase().endsWith('.xlsx')
                || f.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      if (!ok) return cb(new BadRequestException('Solo se acepta .xlsx'), false)
      cb(null, true)
    },
  }))
  guardar(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: MulterFile,
    @Query('convocatoriaId') convocatoriaId?: string,
  ) {
    this.exigirAdmin(user)
    if (!file?.buffer) throw new BadRequestException('Adjunta el archivo en el campo "archivo"')
    if (!convocatoriaId) throw new BadRequestException('Falta convocatoriaId')
    return this.service.guardar(file.buffer, Number(convocatoriaId), user.usuarioId)
  }

  @Get('convocatorias')
  @ApiOperation({ summary: 'Convocatorias con conteo de proyectos guardados' })
  convocatorias(@CurrentUser() user: JwtUser) {
    this.exigirAdmin(user)
    return this.service.convocatorias()
  }

  @Get('resumen')
  @ApiOperation({ summary: 'Resumen agregado de una convocatoria' })
  resumen(@CurrentUser() user: JwtUser, @Query('convocatoriaId') convocatoriaId?: string) {
    this.exigirAdmin(user)
    return this.service.resumen(convocatoriaId ? Number(convocatoriaId) : undefined)
  }

  @Get('analitica')
  @ApiOperation({ summary: 'Analítica filtrable: cofinanciación por evento/modalidad/proponente' })
  analitica(
    @CurrentUser() user: JwtUser,
    @Query('convocatoriaId') convocatoriaId?: string,
    @Query('proponente') proponente?: string,
    @Query('evento') evento?: string,
    @Query('modalidad') modalidad?: string,
    @Query('sector') sector?: string,
  ) {
    this.exigirAdmin(user)
    return this.service.analitica({
      convocatoriaId: convocatoriaId ? Number(convocatoriaId) : undefined,
      proponente, evento, modalidad, sector,
    })
  }

  @Get('acciones')
  @ApiOperation({ summary: 'Listado plano de todas las acciones de formación (con su proyecto), filtrable' })
  acciones(
    @CurrentUser() user: JwtUser,
    @Query('convocatoriaId') convocatoriaId?: string,
    @Query('proponente') proponente?: string,
    @Query('evento') evento?: string,
    @Query('modalidad') modalidad?: string,
    @Query('sector') sector?: string,
  ) {
    this.exigirAdmin(user)
    return this.service.acciones({
      convocatoriaId: convocatoriaId ? Number(convocatoriaId) : undefined,
      proponente, evento, modalidad, sector,
    })
  }

  @Get('export')
  @ApiOperation({ summary: 'Sábana Excel (resumen + desgloses + AF/UT/actividades/rubros), respeta filtros' })
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="sabana-convocatoria.xlsx"')
  async export(
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: true }) _res: Response,
    @Query('convocatoriaId') convocatoriaId?: string,
    @Query('proponente') proponente?: string,
    @Query('evento') evento?: string,
    @Query('modalidad') modalidad?: string,
    @Query('sector') sector?: string,
  ): Promise<StreamableFile> {
    this.exigirAdmin(user)
    const buf = await this.service.exportarExcel({
      convocatoriaId: convocatoriaId ? Number(convocatoriaId) : undefined,
      proponente, evento, modalidad, sector,
    })
    return new StreamableFile(buf)
  }

  @Get()
  @ApiOperation({ summary: 'Listado filtrable de proyectos guardados' })
  listar(
    @CurrentUser() user: JwtUser,
    @Query('convocatoriaId') convocatoriaId?: string,
    @Query('q') q?: string,
  ) {
    this.exigirAdmin(user)
    return this.service.listar(convocatoriaId ? Number(convocatoriaId) : undefined, q)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle completo (PreviewImportacion) de un proyecto guardado' })
  detalle(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    this.exigirAdmin(user)
    return this.service.detalle(Number(id))
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina un proyecto guardado' })
  eliminar(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    this.exigirAdmin(user)
    return this.service.eliminar(Number(id))
  }
}
