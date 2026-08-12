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
