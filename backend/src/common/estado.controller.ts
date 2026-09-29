import { Controller, Get } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { MENSAJE_MIGRACION, enMigracion } from './migracion.guard'

/**
 * La única ruta que sigue abierta durante la migración, y por eso no consulta
 * la base de datos ni pide sesión: si respondiera algo más que esto, sería una
 * grieta en el candado.
 *
 * Existe para que la pantalla de ingreso pueda decir por qué no se puede
 * entrar, en vez de fallar sin explicación. Al preguntarlo en caliente, encender
 * y apagar la pausa es cambiar el .env y reiniciar el backend: el frontend no
 * se recompila.
 */
@ApiTags('estado')
@Controller('estado')
export class EstadoController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Si el servicio está disponible. Pública y sin base de datos.' })
  estado() {
    const pausado = enMigracion(this.config)
    return {
      enMigracion: pausado,
      mensaje: pausado ? MENSAJE_MIGRACION : null,
    }
  }
}
