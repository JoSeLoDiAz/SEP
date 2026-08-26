// Fechas sin hora (fecha de grado, de inicio, de presentación…).
//
// new Date('2017-12-01') se interpreta como medianoche UTC, así que en un
// proceso con zona -05:00 Oracle termina guardando 2017-11-30 19:00 y la
// fecha se corre un día. Armarla por partes da medianoche LOCAL, que es lo
// que Oracle espera, y funciona igual con el contenedor en UTC o en Bogotá.
export function fechaSolo(valor?: string | Date | null): Date | null {
  if (valor == null || valor === '') return null
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor

  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor).trim())
  if (!m) {
    // trae hora o viene en otro formato: se respeta tal cual
    const d = new Date(valor)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}
