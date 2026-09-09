import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ContactosService } from './contactos.service'
import type { ContactoDto } from './contactos.service'

interface JwtUser { usuarioId: number; email: string; perfilId: number }

@ApiTags('contactos')
@Controller('contactos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContactosController {
  constructor(private readonly contactosService: ContactosService) {}

  @Get('proyectos')
  getProyectos(@CurrentUser() user: JwtUser) {
    return this.contactosService.getProyectos(user.email)
  }

  @Get('tipos-doc')
  getTiposDoc() {
    return this.contactosService.getTiposDoc()
  }

  @Get()
  listar(@CurrentUser() user: JwtUser) {
    return this.contactosService.listar(user.email)
  }

  @Post()
  registrar(@CurrentUser() user: JwtUser, @Body() dto: ContactoDto) {
    return this.contactosService.registrar(user.email, dto)
  }

  @Put(':id')
  actualizar(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ContactoDto,
  ) {
    return this.contactosService.actualizar(user.email, id, dto)
  }

  @Delete(':id')
  eliminar(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.contactosService.eliminar(user.email, id)
  }
}
