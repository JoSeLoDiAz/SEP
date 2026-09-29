import { BadRequestException, ConflictException } from '@nestjs/common'

// traduce errores de Oracle a mensajes que el usuario pueda resolver

// nombre de columna -> como se llama en pantalla
export type Etiquetas = Record<string, string>

const nombreDe = (columna: string, etiquetas: Etiquetas) =>
  etiquetas[columna.toUpperCase()] ?? columna.toLowerCase().replace(/_/g, ' ')

// mayor número que cabe en NUMBER(p,s): 999.99 para (5,2)
function topeNumerico(precision: number, escala: number): string {
  const enteros = precision - escala
  return escala > 0
    ? `${'9'.repeat(enteros)}.${'9'.repeat(escala)}`
    : '9'.repeat(enteros)
}

// null si no reconoce el error, para que el llamador lo re-lance tal cual
export function traducirErrorOracle(
  e: unknown,
  etiquetas: Etiquetas = {},
): BadRequestException | ConflictException | null {
  const msg = String((e as Error)?.message ?? '')

  const largo = /ORA-12899[^"]*"[^"]+"\."[^"]+"\."([^"]+)"\s*\(actual:\s*(\d+),\s*maximum:\s*(\d+)\)/i
    .exec(msg)
  if (largo) {
    const [, col, actual, maximo] = largo
    const sobran = Number(actual) - Number(maximo)
    return new BadRequestException(
      `"${nombreDe(col, etiquetas)}" admite hasta ${maximo} caracteres y se enviaron ${actual}: ` +
      `sobra${sobran === 1 ? '' : 'n'} ${sobran}.`,
    )
  }

  // el ORA-01438 no trae la columna en el mensaje: hay que sacarla de la traza
  if (/ORA-01438/i.test(msg)) {
    const conCol = /"([A-Z0-9_]+)"\s*\(actual:.*?precision:\s*(\d+),\s*scale:\s*(\d+)\)/i.exec(msg)
    if (conCol) {
      const [, col, p, s] = conCol
      return new BadRequestException(
        `"${nombreDe(col, etiquetas)}" admite como máximo ${topeNumerico(Number(p), Number(s))}. ` +
        'Revise el valor: parece tener dígitos de más.',
      )
    }
    return new BadRequestException(
      'Uno de los números enviados es más grande de lo que admite el campo. ' +
      'Revise los puntajes y las calificaciones: parecen tener dígitos de más.',
    )
  }

  const obligatorio = /ORA-01400[^(]*\("[^"]+"\."[^"]+"\."([^"]+)"\)/i.exec(msg)
  if (obligatorio) {
    return new BadRequestException(`Falta "${nombreDe(obligatorio[1], etiquetas)}", que es obligatorio.`)
  }

  if (/ORA-02290/i.test(msg)) {
    return new BadRequestException(
      'Los datos enviados no cumplen una regla de la tabla. Revise que los campos ' +
      'obligatorios del registro estén completos.',
    )
  }

  if (/ORA-02291/i.test(msg)) {
    return new BadRequestException(
      'Se está apuntando a un registro que no existe. Vuelva a cargar la pantalla ' +
      'y escoja de nuevo: puede que lo hayan borrado mientras tanto.',
    )
  }

  if (/ORA-02292/i.test(msg)) {
    return new ConflictException(
      'No se puede borrar porque tiene información asociada. Elimine primero lo que ' +
      'cuelga de este registro.',
    )
  }

  if (/ORA-00001/i.test(msg)) {
    return new ConflictException('Ese registro ya existe. Búsquelo en la lista en vez de crearlo otra vez.')
  }

  if (/ORA-01722/i.test(msg)) {
    return new BadRequestException('Uno de los campos numéricos trae letras o símbolos.')
  }

  if (/ORA-01847|ORA-01858|ORA-01861/i.test(msg)) {
    return new BadRequestException('Una de las fechas no es válida. Revise el día y el mes.')
  }

  return null
}

// igual que la anterior pero lanzando
export function traducirValorLargo(e: unknown, etiquetas: Etiquetas = {}): void {
  const traducido = traducirErrorOracle(e, etiquetas)
  if (traducido) throw traducido
}
