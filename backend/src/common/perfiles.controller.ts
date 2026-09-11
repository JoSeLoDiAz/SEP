import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PERFIL_ADMIN, PERFIL_COORDINADOR, PERFIL_EVALUADOR, perfilGestorEvaluadores } from './perfiles'

/**
 * Los ids de perfil con reglas propias en el frontend. El del gestor de evaluadores cambia de una base a otra
 * (15 en el XE, 103 en el Exadata), así que el frontend no lo tiene escrito: lo pide aquí.
 */
@ApiTags('perfiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('perfiles')
export class PerfilesController {
  @Get('claves')
  @ApiOperation({ summary: 'Ids de los perfiles con reglas propias en el frontend' })
  claves() {
    return {
      admin: PERFIL_ADMIN,
      coordinador: PERFIL_COORDINADOR,
      evaluador: PERFIL_EVALUADOR,
      gestorEvaluadores: perfilGestorEvaluadores(),
    }
  }
}
