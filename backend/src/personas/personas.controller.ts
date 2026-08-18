import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe,
  Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { PersonasService } from './personas.service'
import type { PersonaDto, TipoDocPersona } from './personas.service'

interface JwtUser { usuarioId: number; email: string; perfilId: number }

// el namespace global Express.Multer.File no resuelve con module:"nodenext"
interface MulterFile {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

const MAX_PDF_BYTES = 8 * 1024 * 1024

@ApiTags('personas')
@Controller('personas')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PersonasController {
  constructor(private readonly personasService: PersonasService) {}

  // busqueda y crud de persona

  @Get('buscar')
  buscar(
    @Query('tipoDoc', ParseIntPipe) tipoDocumentoId: number,
    @Query('doc') identificacion: string,
  ) {
    if (!identificacion) throw new BadRequestException('Falta el número de documento.')
    return this.personasService.buscarPorDocumento(tipoDocumentoId, identificacion)
  }

  @Get(':id')
  getPersona(@Param('id', ParseIntPipe) id: number) {
    return this.personasService.getPersona(id)
  }

  @Post()
  crear(@Body() dto: PersonaDto) {
    return this.personasService.crearPersonaSiNoExiste(dto, null)
  }

  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<PersonaDto>,
  ) {
    return this.personasService.actualizarPersona(id, dto)
  }

  // catalogos

  @Get('catalogos/tipos-experiencia')
  tiposExperiencia() {
    return this.personasService.listarTiposExperiencia()
  }

  @Get('catalogos/tipos-titulo')
  tiposTitulo() {
    return this.personasService.listarTiposTitulo()
  }

  @Get('catalogos/tipos-doc-adicional')
  tiposDocAdicional() {
    return this.personasService.listarTiposDocAdicional()
  }

  // experiencia laboral

  @Get(':id/experiencia')
  listarExperiencia(
    @Param('id', ParseIntPipe) personaId: number,
    @Query('proyectoId') proyectoId?: string,
  ) {
    return this.personasService.listarExperiencia(
      personaId, proyectoId ? Number(proyectoId) : undefined,
    )
  }

  @Post(':id/experiencia')
  crearExperiencia(
    @Param('id', ParseIntPipe) personaId: number,
    @Body() dto: {
      tipoExperienciaId: number; descripcion: string
      fechaInicio: string; fechaFin: string
      proyectoId?: number
    },
  ) {
    return this.personasService.crearExperiencia(personaId, dto)
  }

  @Put('experiencia/:expId')
  actualizarExperiencia(
    @Param('expId', ParseIntPipe) expId: number,
    @Body() dto: {
      tipoExperienciaId?: number; descripcion?: string
      fechaInicio?: string; fechaFin?: string
      proyectoId?: number
    },
  ) {
    return this.personasService.actualizarExperiencia(expId, dto)
  }

  @Delete('experiencia/:expId')
  eliminarExperiencia(
    @Param('expId', ParseIntPipe) expId: number,
    @Query('proyectoId') proyectoId?: string,
  ) {
    return this.personasService.eliminarExperiencia(
      expId, proyectoId ? Number(proyectoId) : undefined,
    )
  }

  // titulos academicos

  @Get(':id/titulos')
  listarTitulos(
    @Param('id', ParseIntPipe) personaId: number,
    @Query('proyectoId') proyectoId?: string,
  ) {
    return this.personasService.listarTitulos(
      personaId, proyectoId ? Number(proyectoId) : undefined,
    )
  }

  @Post(':id/titulos')
  crearTitulo(
    @Param('id', ParseIntPipe) personaId: number,
    @Body() dto: {
      tipoTituloId: number; descripcion: string
      fechaGraduacion: string; proyectoId?: number
    },
  ) {
    return this.personasService.crearTitulo(personaId, dto)
  }

  @Put('titulos/:tituloId')
  actualizarTitulo(
    @Param('tituloId', ParseIntPipe) tituloId: number,
    @Body() dto: {
      tipoTituloId?: number; descripcion?: string
      fechaGraduacion?: string; proyectoId?: number
    },
  ) {
    return this.personasService.actualizarTitulo(tituloId, dto)
  }

  @Delete('titulos/:tituloId')
  eliminarTitulo(
    @Param('tituloId', ParseIntPipe) tituloId: number,
    @Query('proyectoId') proyectoId?: string,
  ) {
    return this.personasService.eliminarTitulo(
      tituloId, proyectoId ? Number(proyectoId) : undefined,
    )
  }

  // documentos adicionales

  @Get(':id/docs-adicionales')
  listarDocsAdicionales(@Param('id', ParseIntPipe) personaId: number) {
    return this.personasService.listarDocsAdicionales(personaId)
  }

  @Post(':id/docs-adicionales')
  crearDocAdicional(
    @Param('id', ParseIntPipe) personaId: number,
    @Body() dto: { tipoDocId: number; proyectoId?: number },
  ) {
    return this.personasService.crearDocAdicional(personaId, dto)
  }

  @Delete('docs-adicionales/:docAdicId')
  eliminarDocAdicional(
    @CurrentUser() user: JwtUser,
    @Param('docAdicId', ParseIntPipe) docAdicId: number,
  ) {
    return this.personasService.eliminarDocAdicional(docAdicId, user.perfilId)
  }

  // documentos pdf

  @Get(':id/documentos')
  listarDocumentos(
    @Param('id', ParseIntPipe) personaId: number,
    @Query('tipo') tipo?: TipoDocPersona,
    @Query('num') num?: string,
  ) {
    return this.personasService.listarDocumentos(
      personaId, tipo, num ? Number(num) : undefined,
    )
  }

  // multipart: archivo, tipo (HV|EX|TI|DA), num (id del registro; 0 para HV)
  @Post(':id/documentos')
  @UseInterceptors(FileInterceptor('archivo', {
    limits: { fileSize: MAX_PDF_BYTES },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype !== 'application/pdf') {
        cb(new BadRequestException('Solo se permiten archivos PDF.'), false)
        return
      }
      cb(null, true)
    },
  }))
  subirDocumento(
    @Param('id', ParseIntPipe) personaId: number,
    @UploadedFile() file: MulterFile,
    @Body() body: { tipo?: string; num?: string },
  ) {
    if (!file) throw new BadRequestException('Adjunta un archivo PDF en el campo "archivo".')
    const tipo = String(body?.tipo ?? '').toUpperCase() as TipoDocPersona
    const num = body?.num ? Number(body.num) : 0
    return this.personasService.subirDocumento(personaId, tipo, num, file)
  }

  @Get('documentos/:docId/archivo')
  async descargarDocumento(
    @Param('docId', ParseIntPipe) docId: number,
    @Res() res: Response,
  ) {
    const { nombreArchivo, buffer } = await this.personasService.getDocumentoArchivo(docId)
    res.setHeader('Content-Type', 'application/pdf')
    // inline para previsualizar; el front fuerza descarga con download=""
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombreArchivo)}"`)
    res.setHeader('Content-Length', String(buffer.length))
    res.end(buffer)
  }

  @Delete('documentos/:docId')
  eliminarDocumento(
    @CurrentUser() user: JwtUser,
    @Param('docId', ParseIntPipe) docId: number,
  ) {
    return this.personasService.eliminarDocumento(docId, user.perfilId)
  }
}
