import {
  Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { EmpresaService } from './empresa.service'

interface JwtUser { usuarioId: number; email: string; perfilId: number }

@ApiTags('empresa')
@Controller('empresa')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  // ── Datos ─────────────────────────────────────────────────────────────────

  @Get('datos')
  @ApiOperation({ summary: 'Datos básicos de la empresa del usuario autenticado' })
  getDatos(@CurrentUser() user: JwtUser) {
    return this.empresaService.getDatos(user.email)
  }

  // ── Lookups ───────────────────────────────────────────────────────────────

  @Get('departamentos')
  getDepartamentos() {
    return this.empresaService.getDepartamentos()
  }

  @Get('ciudades')
  getCiudades(@Query('departamentoId') deptId: string) {
    return this.empresaService.getCiudades(Number(deptId))
  }

  @Get('coberturas')
  getCoberturas() {
    return this.empresaService.getCoberturas()
  }

  @Get('ciiu')
  getCiiu(@Query('q') q: string) {
    if (!q || q.trim().length < 2) return []
    return this.empresaService.getCiiu(q.trim())
  }

  @Get('tipos-organizacion')
  getTiposOrganizacion() {
    return this.empresaService.getTiposOrganizacion()
  }

  @Get('tamanos')
  getTamanos() {
    return this.empresaService.getTamanosEmpresa()
  }

  @Get('tipos-doc-rep')
  getTiposDocRep() {
    return this.empresaService.getTiposDocumentoRep()
  }

  @Get('menu')
  @ApiOperation({ summary: 'Menú dinámico según el perfil del usuario' })
  getMenu(@CurrentUser() user: JwtUser) {
    return this.empresaService.getMenu(user.perfilId)
  }

  // ── Updates ───────────────────────────────────────────────────────────────

  @Put('identificacion')
  @ApiOperation({ summary: 'Actualizar razón social y sigla' })
  updateIdentificacion(
    @CurrentUser() user: JwtUser,
    @Body() dto: { empresaRazonSocial: string; empresaSigla: string },
  ) {
    return this.empresaService.updateIdentificacion(user.email, dto)
  }

  @Put('ubicacion')
  @ApiOperation({ summary: 'Actualizar datos de ubicación' })
  updateUbicacion(@CurrentUser() user: JwtUser, @Body() dto: Record<string, unknown>) {
    return this.empresaService.updateUbicacion(user.email, dto as Parameters<EmpresaService['updateUbicacion']>[1])
  }

  @Put('economicos')
  @ApiOperation({ summary: 'Actualizar datos generales / económicos' })
  updateEconomicos(@CurrentUser() user: JwtUser, @Body() dto: Record<string, unknown>) {
    return this.empresaService.updateEconomicos(user.email, dto as Parameters<EmpresaService['updateEconomicos']>[1])
  }

  @Put('representante')
  @ApiOperation({ summary: 'Actualizar datos representante legal' })
  updateRepresentante(@CurrentUser() user: JwtUser, @Body() dto: Record<string, unknown>) {
    return this.empresaService.updateRepresentante(user.email, dto as Parameters<EmpresaService['updateRepresentante']>[1])
  }

  @Put('cambiar-clave')
  @ApiOperation({ summary: 'Cambiar contraseña del usuario' })
  cambiarClave(@CurrentUser() user: JwtUser, @Body() dto: { nuevaClave: string }) {
    return this.empresaService.cambiarClave(user.email, dto.nuevaClave)
  }

  // ── Mesas Sectoriales ─────────────────────────────────────────────────────

  @Get('mesas-sectoriales')
  getMesasSectoriales() {
    return this.empresaService.getMesasSectoriales()
  }

  @Get('mesas-sectoriales/empresa')
  getMesasEmpresa(@CurrentUser() user: JwtUser) {
    return this.empresaService.getMesasEmpresa(user.email)
  }

  @Post('mesas-sectoriales/empresa')
  registrarMesaEmpresa(@CurrentUser() user: JwtUser, @Body() dto: { mesaSectorialId: number }) {
    return this.empresaService.registrarMesaEmpresa(user.email, dto.mesaSectorialId)
  }

  @Delete('mesas-sectoriales/empresa/:id')
  eliminarMesaEmpresa(@Param('id') id: string) {
    return this.empresaService.eliminarMesaEmpresa(Number(id))
  }

  // ── Sectores / Subsectores lookups ────────────────────────────────────────

  @Get('sectores')
  getSectores() { return this.empresaService.getSectores() }

  @Get('subsectores')
  getSubsectores() { return this.empresaService.getSubsectores() }

  // ── Sectores/Subsectores PERTENECE ────────────────────────────────────────

  @Get('sectores-pertenece')
  getSectoresPertenece(@CurrentUser() user: JwtUser) {
    return this.empresaService.getSectoresPertenece(user.email)
  }

  @Post('sectores-pertenece')
  registrarSectorPertenece(@CurrentUser() user: JwtUser, @Body() dto: { sectorId: number }) {
    return this.empresaService.registrarSectorPertenece(user.email, dto.sectorId)
  }

  @Delete('sectores-pertenece/:id')
  eliminarSectorPertenece(@Param('id') id: string) {
    return this.empresaService.eliminarSectorPertenece(Number(id))
  }

  @Get('subsectores-pertenece')
  getSubsectoresPertenece(@CurrentUser() user: JwtUser) {
    return this.empresaService.getSubsectoresPertenece(user.email)
  }

  @Post('subsectores-pertenece')
  registrarSubsectorPertenece(@CurrentUser() user: JwtUser, @Body() dto: { subsectorId: number }) {
    return this.empresaService.registrarSubsectorPertenece(user.email, dto.subsectorId)
  }

  @Delete('subsectores-pertenece/:id')
  eliminarSubsectorPertenece(@Param('id') id: string) {
    return this.empresaService.eliminarSubsectorPertenece(Number(id))
  }

  // ── Sectores/Subsectores REPRESENTA ──────────────────────────────────────

  @Get('sectores-representa')
  getSectoresRepresenta(@CurrentUser() user: JwtUser) {
    return this.empresaService.getSectoresRepresenta(user.email)
  }

  @Post('sectores-representa')
  registrarSectorRepresenta(@CurrentUser() user: JwtUser, @Body() dto: { sectorId: number }) {
    return this.empresaService.registrarSectorRepresenta(user.email, dto.sectorId)
  }

  @Delete('sectores-representa/:id')
  eliminarSectorRepresenta(@Param('id') id: string) {
    return this.empresaService.eliminarSectorRepresenta(Number(id))
  }

  @Get('subsectores-representa')
  getSubsectoresRepresenta(@CurrentUser() user: JwtUser) {
    return this.empresaService.getSubsectoresRepresenta(user.email)
  }

  @Post('subsectores-representa')
  registrarSubsectorRepresenta(@CurrentUser() user: JwtUser, @Body() dto: { subsectorId: number }) {
    return this.empresaService.registrarSubsectorRepresenta(user.email, dto.subsectorId)
  }

  @Delete('subsectores-representa/:id')
  eliminarSubsectorRepresenta(@Param('id') id: string) {
    return this.empresaService.eliminarSubsectorRepresenta(Number(id))
  }

  // ── Análisis empresarial ──────────────────────────────────────────────────

  @Get('analisis')
  getAnalisis(@CurrentUser() user: JwtUser) {
    return this.empresaService.getAnalisis(user.email)
  }

  @Put('analisis')
  updateAnalisis(@CurrentUser() user: JwtUser, @Body() dto: Record<string, unknown>) {
    return this.empresaService.updateAnalisis(user.email, dto as Parameters<EmpresaService['updateAnalisis']>[1])
  }
}
