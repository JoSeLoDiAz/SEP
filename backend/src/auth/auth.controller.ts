import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RegistrarEmpresaDto } from './dto/registrar-empresa.dto'
import { RegistrarPersonaDto } from './dto/registrar-persona.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { CurrentUser } from './decorators/current-user.decorator'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('tipos-documento')
  @ApiOperation({ summary: 'Lista de tipos de documento filtrada por persona o empresa' })
  @ApiQuery({ name: 'para', enum: ['persona', 'empresa'], required: true })
  tiposDocumento(@Query('para') para: 'persona' | 'empresa') {
    return this.authService.tiposDocumento(para)
  }

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión en el SEP' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @Post('registrar-empresa')
  @ApiOperation({ summary: 'Registro público de empresa/gremio/asociación (Proponente)' })
  registrarEmpresa(@Body() dto: RegistrarEmpresaDto) {
    return this.authService.registrarEmpresa(dto)
  }

  @Post('registrar-persona')
  @ApiOperation({ summary: 'Registro público de persona/usuario natural' })
  registrarPersona(@Body() dto: RegistrarPersonaDto) {
    return this.authService.registrarPersona(dto)
  }

  @Get('perfil')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  perfil(@CurrentUser() user: { usuarioId: number }) {
    return this.authService.perfil(user.usuarioId)
  }

  @Post('recuperar-contrasena')
  @ApiOperation({ summary: 'Solicitar enlace de restablecimiento de contraseña por correo' })
  recuperarContrasena(@Body() dto: { email: string }) {
    return this.authService.solicitarRestablecimiento(dto.email)
  }

  @Post('restablecer-contrasena')
  @ApiOperation({ summary: 'Restablecer contraseña con el token recibido por correo' })
  restablecerContrasena(@Body() dto: { token: string; nuevaClave: string }) {
    return this.authService.restablecerContrasena(dto.token, dto.nuevaClave)
  }
}
