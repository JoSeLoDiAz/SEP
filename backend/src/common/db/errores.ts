import { BadRequestException, ConflictException } from '@nestjs/common'

/**
 * Traduce los errores de Oracle a algo que el usuario pueda resolver.
 *
 * Oracle dice exactamente qué pasó —qué columna, cuánto sobra, qué
 * restricción— pero ese detalle se pierde en el camino y a la pantalla llega
 * "Internal server error". Con un formulario de diez campos, eso obliga a
 * adivinar borrando de a uno.
 *
 * Casos reales que llegaron así:
 *   ORA-12899  el equipo evaluador con 124 caracteres en una columna de 120
 *   ORA-01438  un puntaje de 26450 en una columna que admite hasta 999.99
 *   ORA-02290  un proyecto sin nombre ni proponente
 */

/** Nombre de columna -> como se llama en pantalla. */
export type Etiquetas = Record<string, string>

const nombreDe = (columna: string, etiquetas: Etiquetas) =>
  etiquetas[columna.toUpperCase()] ?? columna.toLowerCase().replace(/_/g, ' ')

/** El mayor número que cabe en NUMBER(p,s): 999.99 para (5,2). */
function topeNumerico(precision: number, escala: number): string {
  const enteros = precision - escala
  return escala > 0
    ? `${'9'.repeat(enteros)}.${'9'.repeat(escala)}`
    : '9'.repeat(enteros)
}

/**
 * Convierte un error de Oracle en una excepción con mensaje entendible.
 * Devuelve `null` si no lo reconoce, para que el llamador lo re-lance tal cual
 * en vez de disfrazar de "dato inválido" una falla real del servidor.
 */
export function traducirErrorOracle(
  e: unknown,
  etiquetas: Etiquetas = {},
): BadRequestException | ConflictException | null {
  const msg = String((e as Error)?.message ?? '')

  // ── Texto más largo que la columna ────────────────────────────────────
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

  // ── Número más grande de lo que la columna admite ─────────────────────
  // Oracle no dice qué columna en el ORA-01438, así que se busca el detalle
  // en la traza; si no está, al menos se explica el tipo de problema.
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

  // ── Falta un dato obligatorio ─────────────────────────────────────────
  const obligatorio = /ORA-01400[^(]*\("[^"]+"\."[^"]+"\."([^"]+)"\)/i.exec(msg)
  if (obligatorio) {
    return new BadRequestException(`Falta "${nombreDe(obligatorio[1], etiquetas)}", que es obligatorio.`)
  }

  // ── Restricción de la tabla ───────────────────────────────────────────
  if (/ORA-02290/i.test(msg)) {
    return new BadRequestException(
      'Los datos enviados no cumplen una regla de la tabla. Revise que los campos ' +
      'obligatorios del registro estén completos.',
    )
  }

  // ── Apunta a algo que no existe ───────────────────────────────────────
  if (/ORA-02291/i.test(msg)) {
    return new BadRequestException(
      'Se está apuntando a un registro que no existe. Vuelva a cargar la pantalla ' +
      'y escoja de nuevo: puede que lo hayan borrado mientras tanto.',
    )
  }

  // ── Tiene cosas colgando ──────────────────────────────────────────────
  if (/ORA-02292/i.test(msg)) {
    return new ConflictException(
      'No se puede borrar porque tiene información asociada. Elimine primero lo que ' +
      'cuelga de este registro.',
    )
  }

  // ── Ya existe ─────────────────────────────────────────────────────────
  if (/ORA-00001/i.test(msg)) {
    return new ConflictException('Ese registro ya existe. Búsquelo en la lista en vez de crearlo otra vez.')
  }

  // ── Un texto donde iba un número ──────────────────────────────────────
  if (/ORA-01722/i.test(msg)) {
    return new BadRequestException('Uno de los campos numéricos trae letras o símbolos.')
  }

  // ── Fecha mal formada ─────────────────────────────────────────────────
  if (/ORA-01847|ORA-01858|ORA-01861/i.test(msg)) {
    return new BadRequestException('Una de las fechas no es válida. Revise el día y el mes.')
  }

  return null
}

/**
 * Igual que la anterior pero lanzando. Para envolver un INSERT o UPDATE
 * concreto donde ya se sabe cómo se llaman los campos en pantalla.
 */
export function traducirValorLargo(e: unknown, etiquetas: Etiquetas = {}): void {
  const traducido = traducirErrorOracle(e, etiquetas)
  if (traducido) throw traducido
}
