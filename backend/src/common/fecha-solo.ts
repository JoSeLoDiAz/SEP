import { BadRequestException } from '@nestjs/common'

// Fechas sin hora (fecha de grado, de inicio, de presentación…).
//
// new Date('2017-12-01') se interpreta como medianoche UTC, así que en un
// proceso con zona -05:00 Oracle termina guardando 2017-11-30 19:00 y la
// fecha se corre un día. Armarla por partes da medianoche LOCAL, que es lo
// que Oracle espera, y funciona igual con el contenedor en UTC o en Bogotá.
//
// Y el año tiene que ser de 4 cifras. Un <input type="date"> deja teclear
// 20012-07-13 y new Date() lo acepta, pero Oracle no tiene años de 5 cifras:
// el driver escribe el año desbordado, la base no lo valida y la fecha queda
// corrupta (TO_CHAR la devuelve como 0000-00-00). Así llegaron dos fechas de
// grado al banco de evaluadores. Mejor un 400 que eso.
export function fechaSolo(valor?: string | Date | null): Date | null {
  if (valor == null || valor === '') return null
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : conAnioValido(valor.getFullYear(), valor, valor)
  }

  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor).trim())
  if (!m) {
    // trae hora o viene en otro formato: se respeta tal cual
    const d = new Date(valor)
    return Number.isNaN(d.getTime()) ? null : conAnioValido(d.getFullYear(), valor, d)
  }
  // el año se lee del texto: new Date(12, …) lo volvería 1912 y pasaría
  return conAnioValido(Number(m[1]), valor, new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

function conAnioValido(anio: number, valor: string | Date, fecha: Date): Date {
  if (anio >= 1000 && anio <= 9999) return fecha
  const texto = valor instanceof Date ? valor.toISOString() : String(valor).trim()
  throw new BadRequestException(`Fecha no válida (${texto}): el año debe tener 4 cifras`)
}
