/**
 * Helpers para formatear fechas siempre en zona Bogotá (UTC-5),
 * independiente del timezone del navegador o servidor.
 *
 * Importante: el backend (Oracle vía oracledb) puede enviar fechas SIN
 * marcador de zona (ej. `"2026-04-28T19:14:11"`). En ese caso el navegador
 * las interpreta como hora local y la conversión queda mal. Para evitarlo,
 * `parseBackendDate` añade `Z` cuando falta — asume que toda fecha sin TZ
 * es UTC, que es lo que envía oracledb por defecto cuando el proceso Node
 * está en UTC.
 */

const BOGOTA_TZ = 'America/Bogota'

function parseBackendDate(d: string | Date): Date {
  if (d instanceof Date) return d
  // Si ya tiene timezone (Z, +HH:MM, -HH:MM al final), respetarla.
  if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(d)) return new Date(d)
  // Sin TZ → asumir UTC (oracledb default cuando proceso Node está en UTC).
  return new Date(d + 'Z')
}

/** Fecha + hora en formato corto, locale es-CO, timezone Bogotá. */
export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return parseBackendDate(d).toLocaleString('es-CO', {
    dateStyle: 'short', timeStyle: 'short',
    timeZone: BOGOTA_TZ,
  })
}

/** Fecha + hora completa con segundos, locale es-CO, timezone Bogotá. */
export function fmtDateTimeFull(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return parseBackendDate(d).toLocaleString('es-CO', { timeZone: BOGOTA_TZ })
}

/** Fecha + hora con formato dd/MM/yyyy, hh:mm. */
export function fmtDateTimeNumeric(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return parseBackendDate(d).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: BOGOTA_TZ,
  })
}
