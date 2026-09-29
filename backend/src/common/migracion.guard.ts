import {
  CanActivate, ExecutionContext, Injectable, ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'

/**
 * Pausa del SEP mientras la información se traslada al Exadata del SENA.
 *
 * El candado vive aquí y no en la pantalla de ingreso a propósito: quien ya
 * tenía una sesión abierta conserva su token y seguiría escribiendo sin pasar
 * por el login. Al ser un guard global, cierra TODAS las rutas —lectura y
 * escritura, con sesión y sin ella—, que es justo lo que hace falta para que la
 * base de origen deje de moverse mientras se copia.
 *
 * Se enciende con MODO_MIGRACION en el .env del backend y se apaga quitándolo.
 * No hace falta reconstruir el frontend: la pantalla de ingreso pregunta por el
 * estado a /estado, que es la única ruta que sigue abierta.
 */

/** Lo que se le dice a quien intente entrar. */
export const MENSAJE_MIGRACION =
  'El SEP está en migración: la información se está trasladando a la base de '
  + 'datos del SENA. El servicio no está disponible mientras dura el traslado.'

/** Único camino que queda abierto, para que el login pueda explicar por qué. */
const RUTA_ESTADO = '/estado'

const ENCENDIDO = new Set(
  ['1', 'true', 'si', 'sí', 'yes', 'y', 'on', 'activo', 'activa', 'enabled'])
const APAGADO = new Set(
  ['0', 'false', 'no', 'off', 'n', 'inactivo', 'inactiva', 'disabled'])

/**
 * Ausente o vacía = servicio normal, que es el caso de todos los días.
 *
 * Un valor puesto pero irreconocible —MODO_MIGRACION=activar, =ON!, un espacio
 * de más— enciende la pausa y avisa por consola. Falla CERRADO a propósito: si
 * alguien quiso poner el candado y escribió mal, cerrar de más se nota y se
 * arregla en un minuto; abrir de menos deja la base moviéndose mientras se copia
 * y eso no se arregla.
 */
export function enMigracion(config: ConfigService): boolean {
  const bruto = String(config.get<string>('MODO_MIGRACION') ?? '').trim()
  if (!bruto) return false
  const v = bruto.toLowerCase()
  if (ENCENDIDO.has(v)) return true
  if (APAGADO.has(v)) return false
  console.warn(
    `⚠  MODO_MIGRACION="${bruto}" no se reconoce: se asume ENCENDIDA. `
    + 'Use 1 para encender o quite la variable para apagar.')
  return true
}

@Injectable()
export class MigracionGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(contexto: ExecutionContext): boolean {
    if (contexto.getType() !== 'http') return true
    if (!enMigracion(this.config)) return true

    const req = contexto.switchToHttp().getRequest<Request>()
    if (this.esEstado(req)) return true
    if (this.traeLlave(req)) return true

    // 503 y no 403: esto es un servicio detenido a propósito, no un permiso
    // denegado. El código va aparte del texto para que la pantalla pueda
    // distinguirlo de cualquier otro error.
    throw new ServiceUnavailableException({
      codigo: 'EN_MIGRACION',
      message: MENSAJE_MIGRACION,
    })
  }

  private esEstado(req: Request): boolean {
    const ruta = (req.path ?? req.url ?? '').split('?')[0].replace(/\/+$/, '')
    return ruta === RUTA_ESTADO
  }

  /**
   * Salida de emergencia para el propio equipo. Solo existe si MIGRACION_LLAVE
   * está puesta y no vacía: sin esa variable no hay forma de saltarse el
   * candado, que es como debe quedar por defecto.
   */
  private traeLlave(req: Request): boolean {
    const esperada = String(this.config.get<string>('MIGRACION_LLAVE') ?? '').trim()
    if (!esperada) return false
    const dada = String(req.headers['x-migracion-llave'] ?? '').trim()
    return dada.length > 0 && dada === esperada
  }
}
