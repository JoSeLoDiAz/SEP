// Partículas en español que van en minúscula cuando no son la primera palabra.
// (Cubre castellano y algunas portuguesas comunes en apellidos compuestos: "da", "do", "das", "dos".)
const PARTICULAS = new Set([
  'de', 'del', 'la', 'las', 'los', 'y', 'e', 'o', 'u', 'da', 'do', 'das', 'dos',
])

/**
 * Convierte un texto a Title Case respetando el español:
 *   - Partículas en medio de la frase quedan en minúscula ("María de los Ángeles").
 *   - Apóstrofes como separador de sub-partes ("D'Angelo").
 *   - Guiones como separador de sub-partes ("Ana-María").
 *
 * Retorna null si el input queda vacío tras trim (para poder pasar directo al bind
 * de Oracle sin insertar cadenas vacías).
 */
export function aTitleCase(input?: string | null): string | null {
  if (input == null) return null
  const s = input.trim().toLowerCase()
  if (!s) return null
  return s
    .split(/\s+/)
    .map((palabra, idx) => {
      if (idx > 0 && PARTICULAS.has(palabra)) return palabra
      // Divide por guion o apóstrofe manteniendo el separador para reensamblar.
      return palabra
        .split(/([-'])/)
        .map(parte => (/^[-']$/.test(parte) ? parte : parte.charAt(0).toUpperCase() + parte.slice(1)))
        .join('')
    })
    .join(' ')
}
