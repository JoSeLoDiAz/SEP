import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe,
  Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { EvaluadoresService } from './evaluadores.service'
import type {
  EstudioDto, EvaluadorActualizarDto, EvaluadorCrearDto, ExperienciaDto,
  MulterFile, ParticipacionDto, PruebaDto, TicDto,
} from './evaluadores.service'
import { CatalogosEvaluadorService } from './catalogos.service'
import { TrayectoriaService } from './trayectoria.service'
import { AuditoriaService } from './auditoria.service'
import { CicloService } from './ciclo.service'
import { CertificadoService } from './certificado.service'
import { FichaPdfService } from './ficha-pdf.service'
import { ReportesEvaluadorService } from './reportes.service'
import type { AprobacionDto, CapacitacionDto, PartProyectoDto } from './ciclo.service'

interface JwtUser { usuarioId: number; email: string; perfilId: number }

const PERFIL_ADMIN = 1
const PERFIL_COORDINADOR = 2
const PERFIL_GESTOR_EVALUADORES = 15
const PERFILES_GESTION = [PERFIL_ADMIN, PERFIL_COORDINADOR, PERFIL_GESTOR_EVALUADORES]

const MAX_PDF_BYTES = 8 * 1024 * 1024 // 8 MB
const MAX_FOTO_BYTES = 8 * 1024 * 1024 // 8 MB
// Los .msg de Outlook con adjuntos pesan bastante más que un PDF suelto.
const MAX_EVIDENCIA_BYTES = 20 * 1024 * 1024 // 20 MB

@ApiTags('evaluadores')
@Controller('evaluadores')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EvaluadoresController {
  constructor(
    private readonly service: EvaluadoresService,
    private readonly catalogos: CatalogosEvaluadorService,
    private readonly trayectoria: TrayectoriaService,
    private readonly auditoria: AuditoriaService,
    private readonly ciclo: CicloService,
    private readonly certificados: CertificadoService,
    private readonly reportes: ReportesEvaluadorService,
    private readonly fichaPdf: FichaPdfService,
  ) {}


  /** Contexto de auditoría que acompaña a toda escritura del ciclo. */
  private ctx(user: JwtUser) {
    return { usuarioEmail: user.email, usuarioPerfilId: user.perfilId }
  }

  /**
   * Sirve un BLOB. `descargar = true` fuerza el guardado con el nombre
   * original; los .msg no se pueden previsualizar en el navegador, así que
   * ahí siempre va como adjunto.
   */
  private responderArchivo(
    res: Response, buffer: Buffer, mime: string, nombre: string, descargar: boolean,
  ) {
    const limpio = (nombre ?? '').trim() || 'archivo'
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Length', String(buffer.length))
    res.setHeader(
      'Content-Disposition',
      descargar
        // filename* (RFC 5987) preserva UTF-8 en navegadores modernos.
        ? `attachment; filename="${limpio.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(limpio)}`
        : `inline; filename="${encodeURIComponent(limpio)}"`,
    )
    res.end(buffer)
  }

  /**
   * Único control de acceso del módulo.
   *
   * Decisión explícita: quien gestiona el banco de evaluadores lo gestiona
   * completo — fichas, ciclos, matriz, resultados, certificados y auditoría.
   * No hay funciones reservadas a un perfil dentro del módulo: repartirlas
   * obligaba a que dos personas se turnaran para completar un mismo trámite.
   *
   * Lo único que queda fuera son los catálogos del sistema (`exigirAdmin`),
   * que no son parte de la operación del banco sino de su configuración.
   */
  private exigirGestion(user: JwtUser) {
    if (!PERFILES_GESTION.includes(user.perfilId)) {
      throw new ForbiddenException('No tiene permisos para gestionar el banco de evaluadores')
    }
  }

  private exigirAdmin(user: JwtUser) {
    if (user.perfilId !== PERFIL_ADMIN) {
      throw new ForbiddenException('Solo un administrador puede modificar los catálogos')
    }
  }


  /**
   * Borrar un ciclo completo lo puede hacer cualquiera que gestione el banco:
   * el caso de todos los días es corregir una participación recién creada por
   * error, y mandar eso a otro perfil convertía una corrección de segundos en
   * un trámite.
   *
   * Los límites que quedan no son de permiso sino de integridad, y aplican
   * igual a todos: un ciclo con certificado emitido no se borra nunca, y uno
   * con historia avisa antes de arrastrarla.
   */
  private puedeForzarBorrado(_user: JwtUser) {
    return true
  }

  // ── Catálogos ──────────────────────────────────────────────────────────

  @Get('catalogos/roles')
  rolesCat(@CurrentUser() user: JwtUser, @Query('todos') todos?: string) {
    this.exigirGestion(user)
    return this.catalogos.listarRoles(todos !== '1')
  }

  @Post('catalogos/roles')
  crearRol(@CurrentUser() user: JwtUser, @Body() dto: { nombre: string; descripcion?: string }) {
    this.exigirAdmin(user)
    return this.catalogos.crearRol(dto.nombre, dto.descripcion)
  }

  @Put('catalogos/roles/:id')
  actualizarRol(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { nombre?: string; descripcion?: string; activo?: boolean },
  ) {
    this.exigirAdmin(user)
    return this.catalogos.actualizarRol(id, dto)
  }

  @Get('catalogos/procesos')
  procesosCat(@CurrentUser() user: JwtUser, @Query('todos') todos?: string) {
    this.exigirGestion(user)
    return this.catalogos.listarProcesos(todos !== '1')
  }

  @Post('catalogos/procesos')
  crearProceso(@CurrentUser() user: JwtUser, @Body() dto: { nombre: string; descripcion?: string }) {
    this.exigirAdmin(user)
    return this.catalogos.crearProceso(dto.nombre, dto.descripcion)
  }

  @Put('catalogos/procesos/:id')
  actualizarProceso(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { nombre?: string; descripcion?: string; activo?: boolean },
  ) {
    this.exigirAdmin(user)
    return this.catalogos.actualizarProceso(id, dto)
  }

  @Get('catalogos/tipos-estudio')
  tiposEstudioCat(
    @CurrentUser() user: JwtUser,
    @Query('todos') todos?: string,
    @Query('excluirHv') excluirHv?: string,
  ) {
    this.exigirGestion(user)
    return this.catalogos.listarTiposEstudio(todos !== '1', excluirHv === '1')
  }

  @Post('catalogos/tipos-estudio')
  crearTipoEstudio(@CurrentUser() user: JwtUser, @Body() dto: { nombre: string }) {
    this.exigirAdmin(user)
    return this.catalogos.crearTipoEstudio(dto.nombre)
  }

  @Put('catalogos/tipos-estudio/:id')
  actualizarTipoEstudio(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { nombre?: string; activo?: boolean },
  ) {
    this.exigirAdmin(user)
    return this.catalogos.actualizarTipoEstudio(id, dto)
  }

  @Get('catalogos/tipos-documento-evaluador')
  @ApiOperation({ summary: 'Catálogo de tipos de documento del evaluador (cédula, autorización, ...)' })
  tiposDocEvalCat(@CurrentUser() user: JwtUser, @Query('soloActivos') soloActivos?: string) {
    this.exigirGestion(user)
    return this.catalogos.listarTiposDocumentoEvaluador(soloActivos !== '0')
  }

  @Post('catalogos/tipos-documento-evaluador')
  crearTipoDocEval(
    @CurrentUser() user: JwtUser,
    @Body() dto: { codigo: string; nombre: string; admiteMultiple?: boolean; orden?: number },
  ) {
    this.exigirAdmin(user)
    return this.catalogos.crearTipoDocumentoEvaluador(dto)
  }

  @Put('catalogos/tipos-documento-evaluador/:id')
  actualizarTipoDocEval(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { nombre?: string; admiteMultiple?: boolean; orden?: number; activo?: boolean },
  ) {
    this.exigirAdmin(user)
    return this.catalogos.actualizarTipoDocumentoEvaluador(id, dto)
  }

  // Catálogo de tipos de documento para convocatorias (Fase 5).

  @Get('catalogos/tipos-documento-convocatoria')
  @ApiOperation({ summary: 'Catálogo de tipos de documento aplicables a una convocatoria' })
  tiposDocConvCat(@CurrentUser() user: JwtUser, @Query('soloActivos') soloActivos?: string) {
    this.exigirGestion(user)
    return this.catalogos.listarTiposDocumentoConvocatoria(soloActivos !== '0')
  }

  @Post('catalogos/tipos-documento-convocatoria')
  crearTipoDocConv(
    @CurrentUser() user: JwtUser,
    @Body() dto: { codigo: string; nombre: string; extensionesPermitidas?: string; orden?: number },
  ) {
    this.exigirAdmin(user)
    return this.catalogos.crearTipoDocumentoConvocatoria(dto)
  }

  @Put('catalogos/tipos-documento-convocatoria/:id')
  actualizarTipoDocConv(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { nombre?: string; extensionesPermitidas?: string; orden?: number; activo?: boolean },
  ) {
    this.exigirAdmin(user)
    return this.catalogos.actualizarTipoDocumentoConvocatoria(id, dto)
  }

  // Catálogos del ciclo (v29). Solo lectura: son el vocabulario del proceso,
  // no datos operativos — cambiarlos es una migración, no una pantalla.

  @Get('catalogos/estados-participacion')
  @ApiOperation({ summary: 'Estados del año, para los filtros del banco y el select del ciclo' })
  estadosPartCat(@CurrentUser() user: JwtUser, @Query('todos') todos?: string) {
    this.exigirGestion(user)
    return this.catalogos.listarEstadosParticipacion(todos !== '1')
  }

  @Get('catalogos/areas')
  @ApiOperation({ summary: 'Áreas de evaluación (técnica, jurídica, transversal…)' })
  areasCat(@CurrentUser() user: JwtUser, @Query('todos') todos?: string) {
    this.exigirGestion(user)
    return this.catalogos.listarAreas(todos !== '1')
  }

  @Get('catalogos/convocatorias-sep')
  @ApiOperation({ summary: 'Convocatorias reales del SEP, para atarles el ciclo de evaluadores' })
  convocatoriasSepCat(@CurrentUser() user: JwtUser, @Query('anio') anio?: string) {
    this.exigirGestion(user)
    const n = anio != null && anio !== '' ? Number(anio) : undefined
    return this.catalogos.listarConvocatoriasSep(Number.isFinite(n) ? n : undefined)
  }

  @Get('catalogos/firmas')
  @ApiOperation({ summary: 'Firmas disponibles para los certificados' })
  firmasCat(@CurrentUser() user: JwtUser) {
    this.exigirGestion(user)
    return this.catalogos.listarFirmasCertificado()
  }

  @Get('catalogos/anios')
  @ApiOperation({ summary: 'Años con participaciones registradas, para el filtro del banco' })
  aniosCat(@CurrentUser() user: JwtUser) {
    this.exigirGestion(user)
    return this.catalogos.listarAniosParticipacion()
  }

  @Get('catalogos/modalidades')
  @ApiOperation({ summary: 'Modalidades de participación' })
  modalidadesCat(@CurrentUser() user: JwtUser, @Query('todos') todos?: string) {
    this.exigirGestion(user)
    return this.catalogos.listarModalidades(todos !== '1')
  }

  // Catálogos para Fase 3 (regional / centro de formación / municipio)

  @Get('catalogos/regionales')
  @ApiOperation({ summary: 'Regionales del SENA (dropdown asignación del evaluador)' })
  regionalesCat(@CurrentUser() user: JwtUser, @Query('todos') todos?: string) {
    this.exigirGestion(user)
    return this.catalogos.listarRegionales(todos !== '1')
  }

  @Get('catalogos/centros')
  @ApiOperation({ summary: 'Centros de formación (opcionalmente filtrados por regional)' })
  centrosCat(
    @CurrentUser() user: JwtUser,
    @Query('regionalId') regionalId?: string,
    @Query('todos') todos?: string,
  ) {
    this.exigirGestion(user)
    const rid = regionalId != null && regionalId !== '' ? Number(regionalId) : undefined
    return this.catalogos.listarCentros(rid, todos !== '1')
  }

  @Get('catalogos/ciudades/buscar')
  @ApiOperation({ summary: 'Autocomplete de municipios — devuelve "Ciudad, Departamento"' })
  buscarCiudadesCat(
    @CurrentUser() user: JwtUser,
    @Query('q') q?: string,
    @Query('limite') limite?: string,
  ) {
    this.exigirGestion(user)
    const lim = limite ? Number(limite) : 20
    return this.catalogos.buscarCiudades(q ?? '', Number.isFinite(lim) ? lim : 20)
  }

  // ── Búsqueda previa (al crear) ─────────────────────────────────────────

  @Get('buscar-persona')
  @ApiOperation({ summary: 'Buscar persona por documento — devuelve si ya es evaluador o si se puede precargar' })
  buscarPersona(
    @CurrentUser() user: JwtUser,
    @Query('tipoDoc', ParseIntPipe) tipoDocumentoIdentidadId: number,
    @Query('doc') doc: string,
  ) {
    this.exigirGestion(user)
    return this.service.buscarPorDocumento(tipoDocumentoIdentidadId, doc)
  }

  // ── Auditoría ──────────────────────────────────────────────────────────
  // Va antes de @Get(':id') a propósito: si se declarara después, la ruta
  // paramétrica se tragaría 'auditoria' y ParseIntPipe reventaría con 400.

  @Get('auditoria')
  @ApiOperation({ summary: 'Log de auditoría del banco (coordinación y admin)' })
  auditoriaGlobal(
    @CurrentUser() user: JwtUser,
    @Query('tabla') tabla?: string,
    @Query('operacion') operacion?: string,
    @Query('usuarioEmail') usuarioEmail?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    this.exigirGestion(user)
    return this.auditoria.listar({
      tabla, operacion, usuarioEmail, desde, hasta,
      page: Number(page), limit: Number(limit),
    })
  }

  @Get('auditoria/:logId')
  @ApiOperation({ summary: 'Snapshots antes/después de un registro del log' })
  auditoriaDetalle(@CurrentUser() user: JwtUser, @Param('logId', ParseIntPipe) logId: number) {
    this.exigirGestion(user)
    return this.auditoria.getDetalle(logId)
  }

  @Get('buscar-proyectos')
  @ApiOperation({ summary: 'Typeahead de proyectos (ejecutados + formulados) para asignar a un ciclo' })
  buscarProyectos(
    @CurrentUser() user: JwtUser,
    @Query('q') q = '',
    @Query('limit') limit = '15',
  ) {
    this.exigirGestion(user)
    return this.ciclo.buscarProyectos(q, Number(limit))
  }

  // ── Listado y ficha ────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listado del banco con filtros por año, estado, proceso, rol y alertas' })
  listar(
    @CurrentUser() user: JwtUser,
    @Query('busqueda') busqueda = '',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query() query: Record<string, string> = {},
  ) {
    this.exigirGestion(user)
    return this.service.listar(busqueda, Number(page), Number(limit), this.leerFiltros(query))
  }

  /**
   * Los query params llegan como texto. Se descarta lo que no sea número para
   * que un `?anio=abc` no termine como NaN en un bind de Oracle, y los
   * booleanos solo cuentan si vienen explícitos — "no filtrar" y "filtrar por
   * false" son cosas distintas.
   */
  private leerFiltros(query: Record<string, string>) {
    const num = (v?: string) => {
      const n = Number(v)
      return v != null && v !== '' && Number.isFinite(n) ? n : undefined
    }
    const bool = (v?: string) =>
      v === '1' || v === 'true' ? true : v === '0' || v === 'false' ? false : undefined

    return {
      anio: num(query.anio),
      procesoId: num(query.procesoId),
      rolEvaluadorId: num(query.rolEvaluadorId),
      areaId: num(query.areaId),
      regionalId: num(query.regionalId),
      centroId: num(query.centroId),
      estadoCodigo: query.estadoCodigo?.trim() || undefined,
      sinCedula: bool(query.sinCedula),
      sinFoto: bool(query.sinFoto),
      pruebaVigente: bool(query.pruebaVigente),
      incluirInactivos: bool(query.incluirInactivos),
    }
  }

  @Get('reportes/banco.xlsx')
  @ApiOperation({ summary: 'Sábana del banco en Excel, con los mismos filtros del listado' })
  async sabanaBanco(
    @CurrentUser() user: JwtUser,
    @Query('busqueda') busqueda = '',
    @Query() query: Record<string, string> = {},
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, nombre } = await this.reportes.sabanaBanco(busqueda, this.leerFiltros(query))
    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Length', String(buffer.length))
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombre}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    )
    res.end(buffer)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha completa del evaluador' })
  ficha(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.getFicha(id)
  }

  // Dos segmentos a propósito: `@Get(':id')` captura cualquier ruta de uno solo.
  @Get(':id/ficha.pdf')
  @ApiOperation({ summary: 'Hoja de vida imprimible del evaluador (PDF)' })
  async fichaPdfDe(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, nombre } = await this.fichaPdf.generar(id)
    this.responderArchivo(res, buffer, 'application/pdf', nombre, true)
  }

  // ── Trayectoria (vista por año) ────────────────────────────────────────

  @Get(':id/resumen')
  @ApiOperation({ summary: 'KPIs del evaluador para la cabecera de la ficha' })
  resumen(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.trayectoria.getResumen(id)
  }

  @Get(':id/trayectoria')
  @ApiOperation({ summary: 'Años del evaluador con estado, progreso y contadores por ciclo' })
  trayectoriaDe(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.trayectoria.getTrayectoria(id)
  }

  @Get(':id/auditoria')
  @ApiOperation({ summary: 'Log de auditoría de este evaluador' })
  auditoriaDeEvaluador(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    this.exigirGestion(user)
    return this.auditoria.listar({ evaluadorId: id, page: Number(page), limit: Number(limit) })
  }

  @Get('participaciones/:pid/detalle')
  @ApiOperation({ summary: 'Detalle completo de un ciclo: ficha, hitos, documentos propios y heredados' })
  detalleParticipacion(@CurrentUser() user: JwtUser, @Param('pid', ParseIntPipe) pid: number) {
    this.exigirGestion(user)
    return this.trayectoria.getParticipacion(pid)
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo evaluador' })
  crear(@CurrentUser() user: JwtUser, @Body() dto: EvaluadorCrearDto) {
    this.exigirGestion(user)
    return this.service.crear(dto)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar datos del evaluador' })
  actualizar(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EvaluadorActualizarDto,
  ) {
    this.exigirGestion(user)
    return this.service.actualizar(id, dto)
  }

  @Put(':id/estado')
  @ApiOperation({ summary: 'Activar / desactivar evaluador' })
  cambiarEstado(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { activo: boolean },
  ) {
    this.exigirGestion(user)
    return this.service.cambiarEstado(id, Boolean(dto.activo))
  }

  // ── Foto ───────────────────────────────────────────────────────────────

  @Post(':id/foto')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_FOTO_BYTES },
    fileFilter: (_r, f, cb) => {
      if (!f.mimetype.startsWith('image/')) return cb(new BadRequestException('Solo imágenes (JPG, PNG)'), false)
      cb(null, true)
    },
  }))
  subirFoto(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: MulterFile,
  ) {
    this.exigirGestion(user)
    return this.service.subirFoto(id, file)
  }

  @Get(':id/foto')
  async getFoto(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, mime, nombre } = await this.service.getFoto(id)
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Length', String(buffer.length))
    res.setHeader('Cache-Control', 'private, max-age=300')
    // Expone el nombre para que el frontend lo pueda leer via CORS.
    if (nombre) {
      res.setHeader('X-Filename', encodeURIComponent(nombre))
      res.setHeader('Access-Control-Expose-Headers', 'X-Filename')
    }
    res.end(buffer)
  }

  @Get(':id/foto/descargar')
  async descargarFoto(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, mime, nombre } = await this.service.getFoto(id)
    // Nombre por defecto si el registro no tiene el original (p. ej. filas antiguas).
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
    const fallback = `evaluador_${id}_foto.${ext}`
    const nombreFinal = nombre?.trim() || fallback
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Length', String(buffer.length))
    // filename* (RFC 5987) preserva UTF-8 en navegadores modernos.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreFinal.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(nombreFinal)}`,
    )
    res.end(buffer)
  }

  @Delete(':id/foto')
  borrarFoto(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.borrarFoto(id)
  }

  // ── Participaciones ────────────────────────────────────────────────────

  @Get(':id/participaciones')
  listarParticipaciones(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.listarParticipaciones(id)
  }

  @Post(':id/participaciones')
  crearParticipacion(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ParticipacionDto,
  ) {
    this.exigirGestion(user)
    // `usuarioEmail` sale del JWT, nunca del body: es la columna de auditoría.
    return this.service.crearParticipacion(id, { ...dto, usuarioEmail: user.email })
  }

  @Put('participaciones/:pid')
  actualizarParticipacion(
    @CurrentUser() user: JwtUser,
    @Param('pid', ParseIntPipe) pid: number,
    @Body() dto: Partial<ParticipacionDto>,
  ) {
    this.exigirGestion(user)
    return this.service.actualizarParticipacion(pid, dto)
  }

  @Delete('participaciones/:pid')
  @ApiOperation({ summary: 'Eliminar un ciclo vacío. Si tiene historia, responde 409 y hay que anular' })
  eliminarParticipacion(@CurrentUser() user: JwtUser, @Param('pid', ParseIntPipe) pid: number) {
    this.exigirGestion(user)
    return this.service.eliminarParticipacion(pid, {
      forzar: this.puedeForzarBorrado(user),
      usuarioEmail: user.email,
      usuarioPerfilId: user.perfilId,
    })
  }

  @Put('participaciones/:pid/estado')
  @ApiOperation({ summary: 'Cambiar el estado del ciclo (anular, revocar, declinar…). Queda en el log' })
  cambiarEstadoParticipacion(
    @CurrentUser() user: JwtUser,
    @Param('pid', ParseIntPipe) pid: number,
    @Body() dto: { estadoCodigo: string; motivo?: string },
  ) {
    this.exigirGestion(user)
    return this.service.cambiarEstadoParticipacion(pid, dto, {
      usuarioEmail: user.email,
      usuarioPerfilId: user.perfilId,
    })
  }

  // ── Hoja de vida (separada de Estudios) ────────────────────────────────

  @Get(':id/hoja-vida')
  @ApiOperation({ summary: 'Obtener metadatos de la hoja de vida del evaluador' })
  getHV(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.getHojaVida(id)
  }

  @Post(':id/hoja-vida')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_PDF_BYTES },
    fileFilter: (_r, f, cb) => {
      if (f.mimetype !== 'application/pdf') return cb(new BadRequestException('Solo PDF'), false)
      cb(null, true)
    },
  }))
  subirHV(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: MulterFile,
  ) {
    this.exigirGestion(user)
    return this.service.guardarHojaVida(id, file)
  }

  @Delete(':id/hoja-vida')
  borrarHV(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.eliminarHojaVida(id)
  }

  // ── Estudios (diplomas, certificados — excluye HV) ─────────────────────

  @Get(':id/estudios')
  listarEstudios(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.listarEstudios(id)
  }

  @Post(':id/estudios')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_PDF_BYTES },
    fileFilter: (_r, f, cb) => {
      if (f.mimetype !== 'application/pdf') return cb(new BadRequestException('Solo PDF'), false)
      cb(null, true)
    },
  }))
  crearEstudio(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: MulterFile | undefined,
    @Body() body: { tipoEstudioId?: string; titulo?: string; institucion?: string; fechaGrado?: string },
  ) {
    this.exigirGestion(user)
    const dto: EstudioDto = {
      tipoEstudioId: Number(body.tipoEstudioId),
      titulo: body.titulo,
      institucion: body.institucion,
      fechaGrado: body.fechaGrado,
    }
    return this.service.crearEstudio(id, dto, file)
  }

  @Get('estudios/:sid/archivo')
  async getEstudioArchivo(
    @CurrentUser() user: JwtUser,
    @Param('sid', ParseIntPipe) sid: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, mime, nombre } = await this.service.getEstudioArchivo(sid)
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre)}"`)
    res.setHeader('Content-Length', String(buffer.length))
    res.end(buffer)
  }

  @Delete('estudios/:sid')
  eliminarEstudio(@CurrentUser() user: JwtUser, @Param('sid', ParseIntPipe) sid: number) {
    this.exigirGestion(user)
    return this.service.eliminarEstudio(sid)
  }

  // ── Experiencia laboral ────────────────────────────────────────────────

  @Get(':id/experiencia')
  listarExperiencias(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.listarExperiencias(id)
  }

  @Post(':id/experiencia')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_PDF_BYTES },
    fileFilter: (_r, f, cb) => {
      if (f.mimetype !== 'application/pdf') return cb(new BadRequestException('Solo PDF'), false)
      cb(null, true)
    },
  }))
  crearExperiencia(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: MulterFile | undefined,
    @Body() body: { cargo?: string; entidad?: string; fechaInicio?: string; fechaFin?: string },
  ) {
    this.exigirGestion(user)
    const dto: ExperienciaDto = {
      cargo: body.cargo ?? '',
      entidad: body.entidad ?? '',
      fechaInicio: body.fechaInicio,
      fechaFin: body.fechaFin || null,
    }
    return this.service.crearExperiencia(id, dto, file)
  }

  @Get('experiencia/:eid/archivo')
  async getExperienciaArchivo(
    @CurrentUser() user: JwtUser,
    @Param('eid', ParseIntPipe) eid: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, mime, nombre } = await this.service.getExperienciaArchivo(eid)
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre)}"`)
    res.setHeader('Content-Length', String(buffer.length))
    res.end(buffer)
  }

  @Delete('experiencia/:eid')
  eliminarExperiencia(@CurrentUser() user: JwtUser, @Param('eid', ParseIntPipe) eid: number) {
    this.exigirGestion(user)
    return this.service.eliminarExperiencia(eid)
  }

  // ── TIC ────────────────────────────────────────────────────────────────

  @Get(':id/tic')
  listarTics(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.listarTics(id)
  }

  @Post(':id/tic')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_PDF_BYTES },
    fileFilter: (_r, f, cb) => {
      if (f.mimetype !== 'application/pdf') return cb(new BadRequestException('Solo PDF'), false)
      cb(null, true)
    },
  }))
  crearTic(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: MulterFile | undefined,
    @Body() body: { tipoEventoId?: string; nombre?: string; horas?: string; fechaFin?: string },
  ) {
    this.exigirGestion(user)
    const dto: TicDto = {
      tipoEventoId: body.tipoEventoId ? Number(body.tipoEventoId) : null,
      nombre: body.nombre ?? '',
      horas: body.horas ? Number(body.horas) : undefined,
      fechaFin: body.fechaFin || null,
    }
    return this.service.crearTic(id, dto, file)
  }

  @Get('tic/:tid/archivo')
  async getTicArchivo(
    @CurrentUser() user: JwtUser,
    @Param('tid', ParseIntPipe) tid: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, mime, nombre } = await this.service.getTicArchivo(tid)
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre)}"`)
    res.setHeader('Content-Length', String(buffer.length))
    res.end(buffer)
  }

  @Delete('tic/:tid')
  eliminarTic(@CurrentUser() user: JwtUser, @Param('tid', ParseIntPipe) tid: number) {
    this.exigirGestion(user)
    return this.service.eliminarTic(tid)
  }

  // ── Pruebas de conocimiento ────────────────────────────────────────────

  @Get(':id/pruebas')
  listarPruebas(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.listarPruebas(id)
  }

  @Post(':id/pruebas')
  crearPrueba(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PruebaDto,
  ) {
    this.exigirGestion(user)
    return this.service.crearPrueba(id, dto)
  }

  @Put('pruebas/:pid')
  actualizarPrueba(
    @CurrentUser() user: JwtUser,
    @Param('pid', ParseIntPipe) pid: number,
    @Body() dto: Partial<PruebaDto>,
  ) {
    this.exigirGestion(user)
    return this.service.actualizarPrueba(pid, dto)
  }

  @Delete('pruebas/:pid')
  eliminarPrueba(@CurrentUser() user: JwtUser, @Param('pid', ParseIntPipe) pid: number) {
    this.exigirGestion(user)
    return this.service.eliminarPrueba(pid)
  }

  // ── Ciclo: aprobación del jefe ─────────────────────────────────────────

  @Post('participaciones/:pid/aprobacion')
  @ApiOperation({ summary: 'Registrar la autorización del jefe para este ciclo' })
  crearAprobacion(
    @CurrentUser() user: JwtUser,
    @Param('pid', ParseIntPipe) pid: number,
    @Body() dto: AprobacionDto,
  ) {
    this.exigirGestion(user)
    return this.ciclo.crearAprobacion(pid, dto, this.ctx(user))
  }

  @Put('aprobaciones/:aid')
  actualizarAprobacion(
    @CurrentUser() user: JwtUser,
    @Param('aid', ParseIntPipe) aid: number,
    @Body() dto: Partial<AprobacionDto>,
  ) {
    this.exigirGestion(user)
    return this.ciclo.actualizarAprobacion(aid, dto, this.ctx(user))
  }

  @Post('aprobaciones/:aid/evidencia')
  @ApiOperation({ summary: 'Subir el correo de autorización (.msg, .eml o PDF, hasta 20 MB)' })
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: MAX_EVIDENCIA_BYTES } }))
  subirEvidenciaAprobacion(
    @CurrentUser() user: JwtUser,
    @Param('aid', ParseIntPipe) aid: number,
    @UploadedFile() file: MulterFile,
  ) {
    this.exigirGestion(user)
    return this.ciclo.subirEvidenciaAprobacion(aid, file, this.ctx(user))
  }

  @Get('aprobaciones/:aid/evidencia')
  async descargarEvidenciaAprobacion(
    @CurrentUser() user: JwtUser,
    @Param('aid', ParseIntPipe) aid: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, mime, nombre } = await this.ciclo.getEvidenciaAprobacion(aid)
    this.responderArchivo(res, buffer, mime, nombre, true)
  }

  @Delete('aprobaciones/:aid')
  eliminarAprobacion(@CurrentUser() user: JwtUser, @Param('aid', ParseIntPipe) aid: number) {
    this.exigirGestion(user)
    return this.ciclo.eliminarAprobacion(aid, this.ctx(user))
  }

  // ── Ciclo: capacitación ────────────────────────────────────────────────

  @Post('participaciones/:pid/capacitacion')
  @ApiOperation({ summary: 'Registrar el curso de formación del ciclo. APROBADO se deriva de la nota' })
  crearCapacitacion(
    @CurrentUser() user: JwtUser,
    @Param('pid', ParseIntPipe) pid: number,
    @Body() dto: CapacitacionDto,
  ) {
    this.exigirGestion(user)
    return this.ciclo.crearCapacitacion(pid, dto, this.ctx(user))
  }

  @Put('capacitaciones/:cid')
  actualizarCapacitacion(
    @CurrentUser() user: JwtUser,
    @Param('cid', ParseIntPipe) cid: number,
    @Body() dto: Partial<CapacitacionDto>,
  ) {
    this.exigirGestion(user)
    return this.ciclo.actualizarCapacitacion(cid, dto, this.ctx(user))
  }

  @Post('capacitaciones/:cid/certificado')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_PDF_BYTES },
    fileFilter: (_r, f, cb) => {
      if (f.mimetype !== 'application/pdf') return cb(new BadRequestException('Solo PDF'), false)
      cb(null, true)
    },
  }))
  subirCertificadoCapacitacion(
    @CurrentUser() user: JwtUser,
    @Param('cid', ParseIntPipe) cid: number,
    @UploadedFile() file: MulterFile,
  ) {
    this.exigirGestion(user)
    return this.ciclo.subirCertificadoCapacitacion(cid, file, this.ctx(user))
  }

  @Get('capacitaciones/:cid/certificado')
  async descargarCertificadoCapacitacion(
    @CurrentUser() user: JwtUser,
    @Param('cid', ParseIntPipe) cid: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, mime, nombre } = await this.ciclo.getCertificadoCapacitacion(cid)
    this.responderArchivo(res, buffer, mime, nombre, false)
  }

  @Delete('capacitaciones/:cid')
  eliminarCapacitacion(@CurrentUser() user: JwtUser, @Param('cid', ParseIntPipe) cid: number) {
    this.exigirGestion(user)
    return this.ciclo.eliminarCapacitacion(cid, this.ctx(user))
  }

  // ── Ciclo: proyectos evaluados ─────────────────────────────────────────

  @Post('participaciones/:pid/proyectos')
  agregarProyecto(
    @CurrentUser() user: JwtUser,
    @Param('pid', ParseIntPipe) pid: number,
    @Body() dto: PartProyectoDto,
  ) {
    this.exigirGestion(user)
    return this.ciclo.agregarProyecto(pid, dto, this.ctx(user))
  }

  @Delete('proyectos-evaluados/:ppid')
  eliminarProyectoEvaluado(@CurrentUser() user: JwtUser, @Param('ppid', ParseIntPipe) ppid: number) {
    this.exigirGestion(user)
    return this.ciclo.eliminarProyecto(ppid, this.ctx(user))
  }

  // ── Certificados ───────────────────────────────────────────────────────

  @Post('participaciones/:pid/certificado')
  @ApiOperation({ summary: 'Emite el certificado del ciclo con consecutivo y código de verificación' })
  emitirCertificado(
    @CurrentUser() user: JwtUser,
    @Param('pid', ParseIntPipe) pid: number,
    @Body() dto: { horas?: number },
  ) {
    this.exigirGestion(user)
    return this.certificados.emitir(pid, this.ctx(user), dto?.horas ?? null)
  }

  @Get('certificados/lote/:cid')
  @ApiOperation({ summary: 'A quiénes les falta certificado en el ciclo, sin emitir nada' })
  previsualizarLote(@CurrentUser() user: JwtUser, @Param('cid', ParseIntPipe) cid: number) {
    this.exigirGestion(user)
    return this.certificados.pendientesDeCertificado(cid)
  }

  @Post('certificados/lote/:cid')
  @ApiOperation({ summary: 'Emite los certificados que falten de un ciclo. No aborta si alguno falla' })
  emitirLote(@CurrentUser() user: JwtUser, @Param('cid', ParseIntPipe) cid: number) {
    this.exigirGestion(user)
    return this.certificados.emitirLote(cid, this.ctx(user))
  }

  @Get('certificados/:cid/pdf')
  @ApiOperation({ summary: 'Descarga el PDF. Si el BLOB se perdió, lo regenera desde el snapshot' })
  async descargarCertificado(
    @CurrentUser() user: JwtUser,
    @Param('cid', ParseIntPipe) cid: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, nombre } = await this.certificados.getPdf(cid)
    this.responderArchivo(res, buffer, 'application/pdf', nombre, true)
  }

  @Put('certificados/:cid/anular')
  @ApiOperation({ summary: 'Anula un certificado emitido. Exige motivo; el consecutivo no se reutiliza' })
  anularCertificado(
    @CurrentUser() user: JwtUser,
    @Param('cid', ParseIntPipe) cid: number,
    @Body() dto: { motivo: string },
  ) {
    this.exigirGestion(user)
    return this.certificados.anular(cid, dto?.motivo ?? '', this.ctx(user))
  }

  // ── Ciclo: grupos / mesas ──────────────────────────────────────────────

  @Put('participaciones/:pid/grupos')
  @ApiOperation({ summary: 'Reemplaza el conjunto de grupos del ciclo (set, no add)' })
  definirGrupos(
    @CurrentUser() user: JwtUser,
    @Param('pid', ParseIntPipe) pid: number,
    @Body() dto: { grupos: number[] },
  ) {
    this.exigirGestion(user)
    return this.ciclo.definirGrupos(pid, dto?.grupos ?? [], this.ctx(user))
  }

  // ── Documentos genéricos (cédula en Fase 1) ────────────────────────────

  @Get(':id/cedula')
  @ApiOperation({ summary: 'Shortcut — indica si el evaluador ya tiene cédula cargada' })
  getCedula(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    this.exigirGestion(user)
    return this.service.getCedula(id)
  }

  @Get(':id/documentos')
  @ApiOperation({
    summary:
      'Listado de documentos del evaluador (filtrable por código de tipo). ' +
      'Por defecto excluye la CÉDULA (usar ?incluirCedula=1 para incluirla).',
  })
  listarDocumentos(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('tipo') tipo?: string,
    @Query('incluirCedula') incluirCedula?: string,
  ) {
    this.exigirGestion(user)
    return this.service.listarDocumentos(id, {
      tipoCodigo: tipo,
      incluirCedula: incluirCedula === '1',
    })
  }

  @Post(':id/documentos')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_PDF_BYTES },
    fileFilter: (_r, f, cb) => {
      if (f.mimetype !== 'application/pdf') return cb(new BadRequestException('Solo PDF'), false)
      cb(null, true)
    },
  }))
  subirDocumento(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: MulterFile,
    @Body() body: {
      tipoDocumentoEvalId?: string; descripcion?: string
      anioReferencia?: string; participacionId?: string
    },
  ) {
    this.exigirGestion(user)
    const tipoId = Number(body.tipoDocumentoEvalId)
    if (!Number.isFinite(tipoId) || tipoId <= 0) {
      throw new BadRequestException('tipoDocumentoEvalId es obligatorio')
    }
    // multipart manda todo como texto: los números hay que convertirlos y
    // descartar los que no lo sean, o Oracle recibe NaN.
    const anio = body.anioReferencia ? Number(body.anioReferencia) : undefined
    const participacionId = body.participacionId ? Number(body.participacionId) : undefined
    return this.service.subirDocumento(id, tipoId, file, {
      descripcion: body.descripcion,
      anioReferencia: Number.isFinite(anio) ? anio : undefined,
      participacionId: Number.isFinite(participacionId) ? participacionId : undefined,
    })
  }

  @Get('documentos/:docId/archivo')
  async getDocumentoArchivo(
    @CurrentUser() user: JwtUser,
    @Param('docId', ParseIntPipe) docId: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, mime, nombre } = await this.service.getDocumentoArchivo(docId)
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre)}"`)
    res.setHeader('Content-Length', String(buffer.length))
    res.end(buffer)
  }

  @Get('documentos/:docId/descargar')
  async descargarDocumento(
    @CurrentUser() user: JwtUser,
    @Param('docId', ParseIntPipe) docId: number,
    @Res() res: Response,
  ) {
    this.exigirGestion(user)
    const { buffer, mime, nombre } = await this.service.getDocumentoArchivo(docId)
    const nombreFinal = nombre?.trim() || `documento_${docId}.pdf`
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Length', String(buffer.length))
    // filename* (RFC 5987) preserva UTF-8 en navegadores modernos.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreFinal.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(nombreFinal)}`,
    )
    res.end(buffer)
  }

  @Delete('documentos/:docId')
  eliminarDocumento(
    @CurrentUser() user: JwtUser,
    @Param('docId', ParseIntPipe) docId: number,
  ) {
    this.exigirGestion(user)
    return this.service.eliminarDocumento(docId)
  }
}
