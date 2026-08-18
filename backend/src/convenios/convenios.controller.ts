import { Body, Controller, Delete, ForbiddenException, Get, Header, Param, ParseIntPipe, Post, Query, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ConveniosService } from './convenios.service'
import type { DirectorBasicoDto, EmpresaBeneficiariaDto, PersonaBeneficiarioDto, PostulacionDto } from './convenios.service'

interface JwtUser { usuarioId: number; email: string; perfilId: number }

const PERFIL_EMPRESA = 7
const PERFIL_ADMIN = 1
const PERFIL_SENA = 2
const PERFIL_INTERVENTOR = 11
const PERFIL_COORD_INTERV = 10

@ApiTags('convenios')
@Controller('convenios')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConveniosController {
  constructor(private readonly conveniosService: ConveniosService) {}

  @Get('mios')
  listarMios(@CurrentUser() user: JwtUser) {
    return this.conveniosService.listarMisConvenios(user.email)
  }

  // el front lo usa para titular al proponente: "Conviniente" o "Gremio / Empresa / Asociación"
  @Get('mios/tiene')
  tieneConvenios(@CurrentUser() user: JwtUser) {
    return this.conveniosService.empresaTieneConvenios(user.email)
  }

  // :proyectoId es el id del PROYECTO, no del convenio (relación 1-a-1)
  @Get(':proyectoId')
  detalle(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
  ) {
    return this.conveniosService.getDetalleConvenio(user.email, proyectoId, user.perfilId)
  }

  @Get('beneficiarios/empresas')
  listarEmpresasBeneficiarias() {
    return this.conveniosService.listarEmpresasBeneficiarias()
  }

  @Get('beneficiarios/empresas/buscar')
  buscarEmpresaBeneficiaria(
    @Query('tipoDocumentoId') tipoDocumentoId?: string,
    @Query('numero') numero?: string,
  ) {
    return this.conveniosService.buscarEmpresaBeneficiaria(Number(tipoDocumentoId) || 0, numero ?? '')
  }

  @Post('beneficiarios/empresas')
  guardarEmpresaBeneficiaria(
    @CurrentUser() user: JwtUser,
    @Body() dto: EmpresaBeneficiariaDto,
  ) {
    if (![PERFIL_ADMIN, PERFIL_SENA, PERFIL_EMPRESA].includes(user.perfilId)) {
      throw new ForbiddenException('No tienes permiso para registrar empresas beneficiarias.')
    }
    return this.conveniosService.guardarEmpresaBeneficiaria(dto)
  }

  @Get('beneficiarios/catalogos')
  getCatalogosBeneficiario() {
    return this.conveniosService.getCatalogosBeneficiario()
  }

  @Get('beneficiarios/ciudades')
  getCiudadesPorDepartamento(@Query('departamentoId') deptId?: string) {
    return this.conveniosService.getCiudadesPorDepartamento(Number(deptId) || 0)
  }

  @Get(':proyectoId/beneficiarios/persona/buscar')
  buscarPersonaConPostulacion(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Query('tipoDocumentoId') tipoDocumentoId?: string,
    @Query('identificacion') identificacion?: string,
  ) {
    return this.conveniosService.buscarPersonaConPostulacion(
      Number(tipoDocumentoId) || 0,
      identificacion ?? '',
      proyectoId,
    )
  }

  @Post(':proyectoId/beneficiarios/persona')
  guardarPersonaBeneficiaria(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() dto: PersonaBeneficiarioDto,
  ) {
    if (![PERFIL_ADMIN, PERFIL_SENA, PERFIL_EMPRESA].includes(user.perfilId)) {
      throw new ForbiddenException('No tienes permiso para registrar beneficiarios.')
    }
    return this.conveniosService.guardarPersonaBeneficiaria(user.email, proyectoId, dto)
  }

  @Post(':proyectoId/beneficiarios/postulacion')
  guardarPostulacion(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() dto: PostulacionDto,
  ) {
    if (![PERFIL_ADMIN, PERFIL_SENA, PERFIL_EMPRESA].includes(user.perfilId)) {
      throw new ForbiddenException('No tienes permiso para registrar postulaciones.')
    }
    return this.conveniosService.guardarPostulacion(user.email, proyectoId, dto)
  }

  @Get(':proyectoId/beneficiarios')
  getBeneficiarios(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
  ) {
    return this.conveniosService.getBeneficiariosProyecto(user.email, proyectoId, user.perfilId)
  }

  // xlsx con dos hojas: activos e inactivos
  @Get(':proyectoId/beneficiarios/reporte')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async descargarReporteBeneficiarios(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Res() res: Response,
  ) {
    const buf = await this.conveniosService.getReporteBeneficiariosBuffer(user.email, proyectoId, user.perfilId)
    res.setHeader('Content-Disposition', `attachment; filename="Beneficiarios_proyecto_${proyectoId}.xlsx"`)
    res.setHeader('Content-Length', String(buf.length))
    res.end(buf)
  }

  @Get(':proyectoId/beneficiarios/persona/:personaId/grupos')
  getAccionesYGrupos(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('personaId', ParseIntPipe) personaId: number,
  ) {
    return this.conveniosService.getAccionesYGrupos(user.email, proyectoId, personaId)
  }

  @Post(':proyectoId/beneficiarios/asociar')
  asociarBeneficiarioAGrupo(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() body: { personaId: number; afGrupoId: number },
  ) {
    if (![PERFIL_ADMIN, PERFIL_SENA, PERFIL_EMPRESA].includes(user.perfilId)) {
      throw new ForbiddenException('No tienes permiso para asociar beneficiarios a grupos.')
    }
    return this.conveniosService.asociarBeneficiarioAGrupo(
      user.email, proyectoId, Number(body?.personaId) || 0, Number(body?.afGrupoId) || 0,
    )
  }

  @Delete(':proyectoId/beneficiarios/asociar/:afGrupoBeneficiarioId')
  removerBeneficiarioDeGrupo(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('afGrupoBeneficiarioId', ParseIntPipe) afGrupoBeneficiarioId: number,
  ) {
    if (![PERFIL_ADMIN, PERFIL_SENA, PERFIL_EMPRESA].includes(user.perfilId)) {
      throw new ForbiddenException('No tienes permiso para remover beneficiarios de grupos.')
    }
    return this.conveniosService.removerBeneficiarioDeGrupo(user.email, proyectoId, afGrupoBeneficiarioId)
  }

  // devuelve { activo, historial }: historial son los directores reemplazados
  @Get(':proyectoId/director')
  getDirectores(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
  ) {
    return this.conveniosService.getDirectores(user.email, proyectoId, user.perfilId)
  }

  @Post(':proyectoId/director')
  crearDirector(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() dto: DirectorBasicoDto,
  ) {
    if (user.perfilId !== PERFIL_EMPRESA && user.perfilId !== PERFIL_ADMIN) {
      throw new ForbiddenException('Solo la empresa conviniente puede registrar al director.')
    }
    return this.conveniosService.crearDirector(user.email, proyectoId, dto)
  }

  // para persona que ya tiene HV registrada; crearDirector es para la que no
  @Post(':proyectoId/director/asociar')
  asociarDirector(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() body: { personaId: number },
  ) {
    if (user.perfilId !== PERFIL_EMPRESA && user.perfilId !== PERFIL_ADMIN) {
      throw new ForbiddenException('Solo la empresa conviniente puede asociar al director.')
    }
    if (!body?.personaId || Number(body.personaId) <= 0) {
      throw new ForbiddenException('Falta personaId.')
    }
    return this.conveniosService.asociarDirector(user.email, proyectoId, Number(body.personaId))
  }

  @Post(':proyectoId/director/validar')
  validarDirector(
    @CurrentUser() user: JwtUser,
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() body: { aprobar: boolean; observacion?: string; interventorPersonaId?: number },
  ) {
    if (user.perfilId !== PERFIL_INTERVENTOR
      && user.perfilId !== PERFIL_COORD_INTERV
      && user.perfilId !== PERFIL_ADMIN) {
      throw new ForbiddenException('Solo la interventoría puede aprobar o rechazar al director.')
    }
    return this.conveniosService.aprobarRechazarDirector(
      proyectoId, user.perfilId, !!body.aprobar,
      body.observacion ?? null,
      body.interventorPersonaId ?? null,
    )
  }
}
