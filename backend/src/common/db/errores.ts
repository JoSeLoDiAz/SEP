import { BadRequestException } from '@nestjs/common'

/**
 * Traduce el "valor demasiado grande" de Oracle a algo accionable.
 *
 * ORA-12899 llega como `value too large for column "SEPLOCAL"."TABLA"."COL"
 * (actual: 124, maximum: 120)`. Sin traducir sale al usuario como "Internal
 * server error": no dice qué campo, ni cuánto sobra, ni qué hacer. Con un
 * formulario de diez campos eso obliga a adivinar borrando de a uno.
 *
 * `etiquetas` traduce el nombre de la columna a como se llama en pantalla.
 */
export function traducirValorLargo(
  e: unknown,
  etiquetas: Record<string, string> = {},
): never | void {
  const msg = String((e as Error)?.message ?? '')
  const m = /ORA-12899[^"]*"[^"]+"\."[^"]+"\."([^"]+)"\s*\(actual:\s*(\d+),\s*maximum:\s*(\d+)\)/i
    .exec(msg)
  if (!m) return

  const [, columna, actual, maximo] = m
  const nombre = etiquetas[columna.toUpperCase()] ?? columna.toLowerCase()
  const sobran = Number(actual) - Number(maximo)

  throw new BadRequestException(
    `"${nombre}" admite hasta ${maximo} caracteres y se enviaron ${actual}: ` +
    `sobra${sobran === 1 ? '' : 'n'} ${sobran}.`,
  )
}
