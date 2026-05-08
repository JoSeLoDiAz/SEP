import {
  BadRequestException, Body, Controller, ForbiddenException, Post,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ImportarProyectoService } from './importar-proyecto.service'

interface JwtUser { usuarioId: number; email: string; perfilId: number }

interface MulterFile { originalname: string; mimetype: string; size: number; buffer: Buffer }

const PERFIL_ADMIN = 1
const MAX_BYTES = 16 * 1024 * 1024 // 16 MB — los Excels del VBA pueden ser grandes

@ApiTags('admin/importar-proyecto')
@Controller('admin/importar-proyecto')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ImportarProyectoController {
  constructor(private readonly service: ImportarProyectoService) {}

  private exigirAdmin(user: JwtUser) {
    if (user.perfilId !== PERFIL_ADMIN) {
      throw new ForbiddenException('Solo un administrador puede importar proyectos')
    }
  }

  @Post('confirmar')
  @ApiOperation({ summary: 'Crea EMPRESA, USUARIO, PROYECTO, AFs, UTs, RUBROS y CONTACTOS en transacción' })
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_BYTES },
    fileFilter: (_r, f, cb) => {
      const ok = f.originalname.toLowerCase().endsWith('.xlsx')
                || f.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      if (!ok) return cb(new BadRequestException('Solo se acepta .xlsx'), false)
      cb(null, true)
    },
  }))
  confirmar(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: MulterFile,
    @Body() body: {
      convocatoriaId?: string
      claveUsuario?: string
      actualizarDatosEmpresa?: string
      modalidadProyectoId?: string
    },
  ) {
    this.exigirAdmin(user)
    if (!file?.buffer) throw new BadRequestException('Adjunta el archivo en el campo "archivo"')
    if (!body?.convocatoriaId) throw new BadRequestException('Falta convocatoriaId')
    return this.service.confirmar(file.buffer, {
      convocatoriaId: Number(body.convocatoriaId),
      claveUsuario: body.claveUsuario,
      actualizarDatosEmpresa: body.actualizarDatosEmpresa === 'true' || body.actualizarDatosEmpresa === '1',
      modalidadProyectoId: body.modalidadProyectoId ? Number(body.modalidadProyectoId) : undefined,
    })
  }

  @Post('preview')
  @ApiOperation({ summary: 'Lee el Excel del VBA y devuelve preview con validaciones (no escribe en BD)' })
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_BYTES },
    fileFilter: (_r, f, cb) => {
      const ok = f.originalname.toLowerCase().endsWith('.xlsx')
                || f.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      if (!ok) return cb(new BadRequestException('Solo se acepta .xlsx'), false)
      cb(null, true)
    },
  }))
  preview(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: MulterFile,
    @Body() body: { convocatoriaId?: string },
  ) {
    this.exigirAdmin(user)
    if (!file?.buffer) throw new BadRequestException('Adjunta el archivo en el campo "archivo"')
    if (!body?.convocatoriaId) throw new BadRequestException('Falta convocatoriaId')
    return this.service.preview(file.buffer, Number(body.convocatoriaId))
  }
}
