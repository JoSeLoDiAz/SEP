import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ProyectosService } from './proyectos.service'
import type { AfDto, ActualizarAfDto, ContactoProyectoDto } from './proyectos.service'

interface JwtUser { usuarioId: number; email: string; perfilId: number }

interface CrearProyectoDto {
  convocatoriaId: number
  modalidadId: number
  nombre: string
}

interface ActualizarProyectoDto {
  nombre: string
  convocatoriaId: number
  modalidadId: number
  objetivo?: string
}

@ApiTags('proyectos')
@Controller('proyectos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  // ── Catálogos (deben ir antes que :id) ────────────────────────────────────

  @Get('convocatorias')
  getConvocatorias() {
    return this.proyectosService.getConvocatorias()
  }

  @Get('modalidades')
  getModalidades() {
    return this.proyectosService.getModalidades()
  }

  @Get('tiposevento')
  getTiposEvento() {
    return this.proyectosService.getTiposEvento()
  }

  @Get('modalidadesformacion')
  getModalidadesFormacion() {
    return this.proyectosService.getModalidadesFormacion()
  }

  @Get('metodologias')
  getMetodologias() {
    return this.proyectosService.getMetodologias()
  }

  @Get('modelosaprendizaje')
  getModelosAprendizaje() {
    return this.proyectosService.getModelosAprendizaje()
  }

  @Get('necesidadesformacion')
  getNecesidadesFormacion(@CurrentUser() user: JwtUser) {
    return this.proyectosService.getNecesidadesFormacion(user.email)
  }

  @Get('areasfuncionales')
  getAreasFuncionales() {
    return this.proyectosService.getAreasFuncionales()
  }

  @Get('nivelesocu')
  getNivelesOcupacionales() {
    return this.proyectosService.getNivelesOcupacionales()
  }

  @Get('cuoc')
  getOcupacionesCuoc() {
    return this.proyectosService.getOcupacionesCuoc()
  }

  @Get('enfoques')
  getEnfoques() {
    return this.proyectosService.getEnfoques()
  }

  @Get('sectoresaf')
  getSectoresAfCat() {
    return this.proyectosService.getSectoresAfCat()
  }

  @Get('subsectoresaf')
  getSubSectoresAfCat() {
    return this.proyectosService.getSubSectoresAfCat()
  }

  @Get('actividadesut')
  getActividadesUT() {
    return this.proyectosService.getActividadesUT()
  }

  @Get(':id/rubrosperfilut')
  getRubrosPerfilUT(@Param('id', ParseIntPipe) proyectoId: number) {
    return this.proyectosService.getRubrosPerfilUT(proyectoId)
  }

  @Get('articulacionesterr')
  getArticulacionesTerr() {
    return this.proyectosService.getArticulacionesTerr()
  }

  @Get('retonacionales')
  getRetoNacionales() {
    return this.proyectosService.getRetoNacionales()
  }

  @Get('componentesreto/:retoId')
  getComponentesByReto(@Param('retoId', ParseIntPipe) retoId: number) {
    return this.proyectosService.getComponentesByReto(retoId)
  }

  @Get('afcomponentestipos')
  getAfComponentesTipos() {
    return this.proyectosService.getAfComponentesTipos()
  }

  @Get('afcomponentes/:tipo')
  getAfComponentesByTipo(@Param('tipo', ParseIntPipe) tipo: number) {
    return this.proyectosService.getAfComponentesByTipo(tipo)
  }

  @Get('departamentos')
  getDepartamentos() { return this.proyectosService.getDepartamentos() }

  @Get('ciudades/:deptoId')
  getCiudadesByDepto(@Param('deptoId', ParseIntPipe) deptoId: number) {
    return this.proyectosService.getCiudadesByDepto(deptoId)
  }

  @Get('tiposambiente')
  getTiposAmbiente() { return this.proyectosService.getTiposAmbiente() }

  @Get('gestionconocimientos')
  getGestionConocimientos() { return this.proyectosService.getGestionConocimientos() }

  @Get('materialformacion')
  getMaterialFormacionCat() { return this.proyectosService.getMaterialFormacionCat() }

  @Get('recursosdicacticos')
  getRecursosDidacticosCat() { return this.proyectosService.getRecursosDidacticosCat() }

  // ── Listado y creación ────────────────────────────────────────────────────

  @Get()
  listar(@CurrentUser() user: JwtUser) {
    return this.proyectosService.listar(user.email)
  }

  @Post()
  crear(@CurrentUser() user: JwtUser, @Body() dto: CrearProyectoDto) {
    return this.proyectosService.crear(user.email, dto)
  }

  // ── Detalle y edición ─────────────────────────────────────────────────────

  @Get(':id')
  getDetalle(@Param('id', ParseIntPipe) id: number) {
    return this.proyectosService.getDetalle(id)
  }

  @Put(':id')
  actualizarProyecto(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarProyectoDto,
  ) {
    return this.proyectosService.actualizarProyecto(user.email, id, dto)
  }

  @Post(':id/radicar')
  radicar(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.proyectosService.radicar(user.email, id)
  }

  // ── Contactos del proyecto ────────────────────────────────────────────────

  @Get(':id/contactos/disponibles')
  getContactosDisponibles(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.proyectosService.getContactosDisponibles(user.email, id)
  }

  @Get(':id/contactos')
  getContactosDelProyecto(@Param('id', ParseIntPipe) id: number) {
    return this.proyectosService.getContactosDelProyecto(id)
  }

  @Post(':id/contactos')
  crearContactoEnProyecto(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ContactoProyectoDto,
  ) {
    return this.proyectosService.crearContactoEnProyecto(user.email, id, dto)
  }

  @Put(':id/contactos/:contactoId/asignar')
  asignarContacto(
    @Param('id', ParseIntPipe) id: number,
    @Param('contactoId', ParseIntPipe) contactoId: number,
  ) {
    return this.proyectosService.asignarContacto(id, contactoId)
  }

  @Delete(':id/contactos/:contactoId')
  desasignarContacto(@Param('contactoId', ParseIntPipe) contactoId: number) {
    return this.proyectosService.desasignarContacto(contactoId)
  }

  // ── Acciones de Formación ─────────────────────────────────────────────────

  @Get(':id/acciones')
  listarAFs(@Param('id', ParseIntPipe) id: number) {
    return this.proyectosService.listarAFs(id)
  }

  @Post(':id/acciones')
  crearAF(@Param('id', ParseIntPipe) id: number, @Body() dto: AfDto) {
    return this.proyectosService.crearAF(id, dto)
  }

  @Get(':id/acciones/:afId')
  getAFDetalle(@Param('afId', ParseIntPipe) afId: number) {
    return this.proyectosService.getAFDetalle(afId)
  }

  @Put(':id/acciones/:afId')
  actualizarAF(
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: ActualizarAfDto,
  ) {
    return this.proyectosService.actualizarAF(afId, dto)
  }

  @Delete(':id/acciones/:afId')
  eliminarAF(@Param('afId', ParseIntPipe) afId: number) {
    return this.proyectosService.eliminarAF(afId)
  }

  // ── Perfil de Beneficiarios ───────────────────────────────────────────────

  @Get(':id/acciones/:afId/beneficiarios')
  getPerfilBeneficiarios(@Param('afId', ParseIntPipe) afId: number) {
    return this.proyectosService.getPerfilBeneficiarios(afId)
  }

  @Put(':id/acciones/:afId/beneficiarios')
  actualizarPerfilBeneficiarios(
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.proyectosService.actualizarPerfilBeneficiarios(afId, dto as never)
  }

  @Post(':id/acciones/:afId/areas')
  agregarArea(
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: { areaId: number; otro?: string | null },
  ) {
    return this.proyectosService.agregarArea(afId, dto)
  }

  @Delete(':id/acciones/:afId/areas/:aafId')
  eliminarArea(@Param('aafId', ParseIntPipe) aafId: number) {
    return this.proyectosService.eliminarArea(aafId)
  }

  @Post(':id/acciones/:afId/niveles')
  agregarNivel(
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: { nivelId: number },
  ) {
    return this.proyectosService.agregarNivel(afId, dto.nivelId)
  }

  @Delete(':id/acciones/:afId/niveles/:anId')
  eliminarNivel(@Param('anId', ParseIntPipe) anId: number) {
    return this.proyectosService.eliminarNivel(anId)
  }

  @Post(':id/acciones/:afId/cuoc')
  agregarCuoc(
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: { cuocId: number },
  ) {
    return this.proyectosService.agregarCuoc(afId, dto.cuocId)
  }

  @Delete(':id/acciones/:afId/cuoc/:ocAfId')
  eliminarCuoc(@Param('ocAfId', ParseIntPipe) ocAfId: number) {
    return this.proyectosService.eliminarCuoc(ocAfId)
  }

  // ── Sectores y Sub-sectores ───────────────────────────────────────────────

  @Get(':id/acciones/:afId/sectores')
  getSectoresYSubsectores(@Param('afId', ParseIntPipe) afId: number) {
    return this.proyectosService.getSectoresYSubsectores(afId)
  }

  @Put(':id/acciones/:afId/sectores')
  actualizarJustificacionSec(
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: { justificacion?: string | null },
  ) {
    return this.proyectosService.actualizarJustificacionSec(afId, dto.justificacion ?? null)
  }

  @Post(':id/acciones/:afId/sectores-benef')
  agregarSectorBenef(
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: { sectorId: number },
  ) {
    return this.proyectosService.agregarSectorBenef(afId, dto.sectorId)
  }

  @Delete(':id/acciones/:afId/sectores-benef/:psId')
  eliminarSectorBenef(@Param('psId', ParseIntPipe) psId: number) {
    return this.proyectosService.eliminarSectorBenef(psId)
  }

  @Post(':id/acciones/:afId/subsectores-benef')
  agregarSubSectorBenef(
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: { subsectorId: number },
  ) {
    return this.proyectosService.agregarSubSectorBenef(afId, dto.subsectorId)
  }

  @Delete(':id/acciones/:afId/subsectores-benef/:pssId')
  eliminarSubSectorBenef(@Param('pssId', ParseIntPipe) pssId: number) {
    return this.proyectosService.eliminarSubSectorBenef(pssId)
  }

  @Post(':id/acciones/:afId/sectores-af')
  agregarSectorAf(
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: { sectorId: number },
  ) {
    return this.proyectosService.agregarSectorAf(afId, dto.sectorId)
  }

  @Delete(':id/acciones/:afId/sectores-af/:saId')
  eliminarSectorAf(@Param('saId', ParseIntPipe) saId: number) {
    return this.proyectosService.eliminarSectorAf(saId)
  }

  @Post(':id/acciones/:afId/subsectores-af')
  agregarSubSectorAf(
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: { subsectorId: number },
  ) {
    return this.proyectosService.agregarSubSectorAf(afId, dto.subsectorId)
  }

  @Delete(':id/acciones/:afId/subsectores-af/:ssaId')
  eliminarSubSectorAf(@Param('ssaId', ParseIntPipe) ssaId: number) {
    return this.proyectosService.eliminarSubSectorAf(ssaId)
  }

  // ── Unidades Temáticas ────────────────────────────────────────────────────

  @Get(':id/acciones/:afId/habilidades')
  getHabilidadesUT(@Param('afId', ParseIntPipe) afId: number) {
    return this.proyectosService.getHabilidadesUT(afId)
  }

  @Get(':id/acciones/:afId/unidades')
  listarUTs(@Param('afId', ParseIntPipe) afId: number) {
    return this.proyectosService.listarUTs(afId)
  }

  @Post(':id/acciones/:afId/unidades')
  crearUT(
    @Param('id', ParseIntPipe) proyectoId: number,
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.proyectosService.crearUT(afId, proyectoId, dto as never)
  }

  @Get(':id/acciones/:afId/unidades/:utId')
  getUTDetalle(@Param('utId', ParseIntPipe) utId: number) {
    return this.proyectosService.getUTDetalle(utId)
  }

  @Put(':id/acciones/:afId/unidades/:utId')
  actualizarUT(
    @Param('utId', ParseIntPipe) utId: number,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.proyectosService.actualizarUT(utId, dto as never)
  }

  @Delete(':id/acciones/:afId/unidades/:utId')
  eliminarUT(@Param('utId', ParseIntPipe) utId: number) {
    return this.proyectosService.eliminarUT(utId)
  }

  @Post(':id/acciones/:afId/unidades/:utId/actividades')
  agregarActividadUT(
    @Param('utId', ParseIntPipe) utId: number,
    @Body() dto: { actividadId: number; otro?: string | null },
  ) {
    return this.proyectosService.agregarActividadUT(utId, dto)
  }

  @Delete(':id/acciones/:afId/unidades/:utId/actividades/:actId')
  eliminarActividadUT(@Param('actId', ParseIntPipe) actId: number) {
    return this.proyectosService.eliminarActividadUT(actId)
  }

  @Post(':id/acciones/:afId/unidades/:utId/perfiles')
  agregarPerfilUT(
    @Param('utId', ParseIntPipe) utId: number,
    @Body() dto: { rubroId: number; horasCap: number; dias?: number | null },
  ) {
    return this.proyectosService.agregarPerfilUT(utId, dto)
  }

  @Delete(':id/acciones/:afId/unidades/:utId/perfiles/:perfilId')
  eliminarPerfilUT(@Param('perfilId', ParseIntPipe) perfilId: number) {
    return this.proyectosService.eliminarPerfilUT(perfilId)
  }

  // ── Alineación de la AF ───────────────────────────────────────────────────

  @Get(':id/acciones/:afId/alineacion')
  getAlineacionAF(@Param('afId', ParseIntPipe) afId: number) {
    return this.proyectosService.getAlineacionAF(afId)
  }

  @Put(':id/acciones/:afId/alineacion')
  actualizarTextosAlineacion(
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: { componenteId?: number | null; compod?: string | null; justificacion?: string | null; resDesem?: string | null; resForm?: string | null },
  ) {
    return this.proyectosService.actualizarTextosAlineacion(afId, dto)
  }

  // ── Grupos de cobertura ───────────────────────────────────────────────────

  @Get(':id/acciones/:afId/grupos')
  getGruposCobertura(@Param('afId', ParseIntPipe) afId: number) {
    return this.proyectosService.getGruposCobertura(afId)
  }

  @Post(':id/acciones/:afId/grupos')
  crearGrupo(@Param('afId', ParseIntPipe) afId: number) {
    return this.proyectosService.crearGrupo(afId)
  }

  @Delete(':id/acciones/:afId/grupos/:grupoId')
  eliminarGrupo(@Param('grupoId', ParseIntPipe) grupoId: number) {
    return this.proyectosService.eliminarGrupo(grupoId)
  }

  @Put(':id/acciones/:afId/grupos/:grupoId/justificacion')
  guardarJustificacion(
    @Param('grupoId', ParseIntPipe) grupoId: number,
    @Body() dto: { justificacion: string | null },
  ) {
    return this.proyectosService.guardarJustificacionGrupo(grupoId, dto.justificacion)
  }

  @Get(':id/acciones/:afId/grupos/:grupoId/coberturas')
  getCoberturaGrupo(@Param('grupoId', ParseIntPipe) grupoId: number) {
    return this.proyectosService.getCoberturaGrupo(grupoId)
  }

  @Post(':id/acciones/:afId/grupos/:grupoId/coberturas')
  guardarCoberturaGrupo(
    @Param('grupoId', ParseIntPipe) grupoId: number,
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: { coberturas: { deptoId: number; ciudadId?: number | null; benef: number; modal: string; rural?: number }[] },
  ) {
    return this.proyectosService.guardarCoberturaGrupo(grupoId, afId, dto.coberturas)
  }

  // ── Material de Formación ─────────────────────────────────────────────────

  @Get(':id/acciones/:afId/material')
  getMaterialAF(@Param('afId', ParseIntPipe) afId: number) {
    return this.proyectosService.getMaterialAF(afId)
  }

  @Put(':id/acciones/:afId/material')
  actualizarMaterialAF(
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: { tipoAmbienteId?: number | null; gestionConocimientoId?: number | null; materialFormacionId?: number | null; justMat?: string | null; insumo?: string | null; justInsumo?: string | null },
  ) {
    return this.proyectosService.actualizarMaterialAF(afId, dto)
  }

  @Post(':id/acciones/:afId/recursos')
  agregarRecursoAF(
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: { recursoId: number },
  ) {
    return this.proyectosService.agregarRecursoAF(afId, dto.recursoId)
  }

  @Delete(':id/acciones/:afId/recursos/:rdafId')
  eliminarRecursoAF(@Param('rdafId', ParseIntPipe) rdafId: number) {
    return this.proyectosService.eliminarRecursoAF(rdafId)
  }

  // ── Rubros ────────────────────────────────────────────────────────────────

  @Get(':id/acciones/:afId/rubros/prereqs')
  getPrerequisitosRubros(@Param('afId', ParseIntPipe) afId: number) {
    return this.proyectosService.getPrerequisitosRubros(afId)
  }

  @Get(':id/acciones/:afId/rubros/catalogo')
  getRubrosCatalogo(@Param('afId', ParseIntPipe) afId: number) {
    return this.proyectosService.getRubrosCatalogo(afId)
  }

  @Get(':id/acciones/:afId/rubros')
  getRubrosAF(@Param('afId', ParseIntPipe) afId: number) {
    return this.proyectosService.getRubrosAF(afId)
  }

  @Post(':id/acciones/:afId/rubros')
  guardarRubroAF(
    @Param('id', ParseIntPipe) proyectoId: number,
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: {
      rubroId: number; justificacion: string
      numHoras: number; cantidad: number; beneficiarios: number; dias: number; numGrupos: number
      totalRubro: number; cofSena: number; contraEspecie: number; contraDinero: number
      valorMaximo: number; valorBenef: number; paquete: string
    },
  ) {
    return this.proyectosService.guardarRubroAF(proyectoId, afId, dto)
  }

  @Get(':id/acciones/:afId/rubros/go')
  getGastosOperacion(@Param('afId', ParseIntPipe) afId: number) {
    return this.proyectosService.getGastosOperacion(afId)
  }

  @Post(':id/acciones/:afId/rubros/go')
  guardarGastosOperacion(
    @Param('id', ParseIntPipe) proyectoId: number,
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: { cofSena: number; especie: number; dinero: number },
  ) {
    return this.proyectosService.guardarGastosOperacion(proyectoId, afId, dto)
  }

  @Get(':id/acciones/:afId/rubros/transferencia')
  getTransferencia(@Param('afId', ParseIntPipe) afId: number) {
    return this.proyectosService.getTransferencia(afId)
  }

  @Post(':id/acciones/:afId/rubros/transferencia')
  guardarTransferencia(
    @Param('id', ParseIntPipe) proyectoId: number,
    @Param('afId', ParseIntPipe) afId: number,
    @Body() dto: { beneficiarios: number; valor: number },
  ) {
    return this.proyectosService.guardarTransferencia(proyectoId, afId, dto)
  }

  @Delete(':id/acciones/:afId/rubros/:afrubroid')
  eliminarRubroAF(
    @Param('afId', ParseIntPipe) afId: number,
    @Param('afrubroid', ParseIntPipe) afrubroid: number,
  ) {
    return this.proyectosService.eliminarRubroAF(afId, afrubroid)
  }

  // ── Presupuesto General del Proyecto ──────────────────────────────────────

  @Get(':id/presupuesto')
  getPresupuestoProyecto(@Param('id', ParseIntPipe) proyectoId: number) {
    return this.proyectosService.getPresupuestoProyecto(proyectoId)
  }

  @Post(':id/presupuesto/guardar')
  guardarPresupuestoProyecto(@Param('id', ParseIntPipe) proyectoId: number) {
    return this.proyectosService.guardarPresupuestoProyecto(proyectoId)
  }
}
