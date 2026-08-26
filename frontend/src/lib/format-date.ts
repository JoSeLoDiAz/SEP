// formateo de fechas en zona Bogotá

const BOGOTA_TZ = 'America/Bogota'

function parseBackendDate(d: string | Date): Date {
  if (d instanceof Date) return d
  if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(d)) return new Date(d)
  // oracledb manda las fechas sin TZ y son UTC
  return new Date(d + 'Z')
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return parseBackendDate(d).toLocaleString('es-CO', {
    dateStyle: 'short', timeStyle: 'short',
    timeZone: BOGOTA_TZ,
  })
}

export function fmtDateTimeFull(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return parseBackendDate(d).toLocaleString('es-CO', { timeZone: BOGOTA_TZ })
}

export function fmtDateTimeNumeric(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return parseBackendDate(d).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: BOGOTA_TZ,
  })
}

// Fechas SIN hora (fecha de grado, de inicio, de presentación…).
//
// El backend corre en UTC a propósito (main.ts), así que una fecha de
// calendario llega como 2003-12-13T00:00:00.000Z. Formatearla en zona
// Bogotá le resta cinco horas y la corre al día anterior. Aquí se leen
// las partes en UTC, que son las que el usuario escribió.
export function fmtFecha(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const f = parseBackendDate(d)
  if (Number.isNaN(f.getTime())) return '—'
  return f.toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  })
}

// la misma idea, en formato corto: "dic 2003"
export function fmtMesAnio(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const f = parseBackendDate(d)
  if (Number.isNaN(f.getTime())) return '—'
  return f.toLocaleDateString('es-CO', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}
