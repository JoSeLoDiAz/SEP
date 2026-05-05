import {
  Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { UsuariosAdminService } from './usuarios-admin.service'
import type { CrearUsuarioDto } from './usuarios-admin.service'

interface JwtUser { usuarioId: number; email: string; perfilId: number }

const PERFIL_ADMIN = 1

@ApiTags('admin/usuarios')
@Controller('admin/usuarios')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsuariosAdminController {
  constructor(private readonly service: UsuariosAdminService) {}

  private exigirAdmin(user: JwtUser) {
    if (user.perfilId !== PERFIL_ADMIN) {
      throw new ForbiddenException('Solo un administrador puede gestionar perfiles de usuario')
    }
  }

  @Get()
  @ApiOperation({ summary: 'Listar usuarios con sus perfiles asignados (paginado)' })
  listar(
    @CurrentUser() user: JwtUser,
    @Query('busqueda') busqueda = '',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    this.exigirAdmin(user)
    return this.service.listarUsuarios(busqueda, Number(page), Number(limit))
  }

  @Get('perfiles-catalogo')
  @ApiOperation({ summary: 'Catálogo de perfiles asignables (excluye Administrador)' })
  catalogo(@CurrentUser() user: JwtUser) {
    this.exigirAdmin(user)
    return this.service.catalogoPerfiles()
  }

  @Post()
  @ApiOperation({ summary: 'Crear un usuario interno con perfil inicial' })
  crear(@CurrentUser() user: JwtUser, @Body() dto: CrearUsuarioDto) {
    this.exigirAdmin(user)
    return this.service.crearUsuario(dto)
  }

  @Get(':usuarioId/perfiles')
  @ApiOperation({ summary: 'Detalle de perfiles asignados a un usuario' })
  detalle(@CurrentUser() user: JwtUser, @Param('usuarioId') usuarioId: string) {
    this.exigirAdmin(user)
    return this.service.listarPerfilesUsuario(Number(usuarioId))
  }

  @Post(':usuarioId/perfiles')
  @ApiOperation({ summary: 'Asignar un perfil a un usuario' })
  asignar(
    @CurrentUser() user: JwtUser,
    @Param('usuarioId') usuarioId: string,
    @Body() dto: { perfilId: number },
  ) {
    this.exigirAdmin(user)
    return this.service.asignarPerfil(Number(usuarioId), Number(dto.perfilId))
  }

  @Put(':usuarioId/estado')
  @ApiOperation({ summary: 'Activar o desactivar un usuario' })
  cambiarEstado(
    @CurrentUser() user: JwtUser,
    @Param('usuarioId') usuarioId: string,
    @Body() dto: { estado: boolean },
  ) {
    this.exigirAdmin(user)
    return this.service.cambiarEstadoUsuario(Number(usuarioId), Boolean(dto.estado))
  }

  @Put(':usuarioId/clave')
  @ApiOperation({ summary: 'Resetear la contraseña de un usuario' })
  cambiarClave(
    @CurrentUser() user: JwtUser,
    @Param('usuarioId') usuarioId: string,
    @Body() dto: { nuevaClave: string },
  ) {
    this.exigirAdmin(user)
    return this.service.cambiarClave(Number(usuarioId), dto.nuevaClave)
  }

  @Put(':usuarioId/perfiles/:usuarioPerfilId')
  @ApiOperation({ summary: 'Actualizar predeterminado o estado de una asignación' })
  actualizar(
    @CurrentUser() user: JwtUser,
    @Param('usuarioId') usuarioId: string,
    @Param('usuarioPerfilId') usuarioPerfilId: string,
    @Body() dto: { predeterminado?: boolean; estado?: boolean },
  ) {
    this.exigirAdmin(user)
    return this.service.actualizarPerfil(Number(usuarioId), Number(usuarioPerfilId), dto)
  }
}
