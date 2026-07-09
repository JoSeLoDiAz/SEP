/**
 * Convierte un texto libre a formato "Title Case" respetando partículas
 * ("de", "del", "la", etc.), apóstrofes y guiones.
 *
 * Mismo algoritmo que `backend/src/common/text/title-case.ts` — la sanitización
 * en el frontend es solo para feedback inmediato en `onBlur`; el backend
 * también aplica la normalización antes de escribir en BD.
 *
 * Ejemplos:
 *   aTitleCase("MARÍA DE LOS ÁNGELES") -> "María de los Ángeles"
 *   aTitleCase("juan d'angelo")        -> "Juan D'Angelo"
 *   aTitleCase("ana-maría lópez")      -> "Ana-María López"
 *   aTitleCase("")                      -> null
 *   aTitleCase(null)                    -> null
 */
const PARTICULAS = new Set([
  'de', 'del', 'la', 'las', 'los', 'y', 'e', 'o', 'u',
  'da', 'do', 'das', 'dos',
])

export function aTitleCase(input?: string | null): string | null {
  if (input == null) return input ?? null
  const s = input.trim().toLowerCase()
  if (!s) return null
  return s.split(/\s+/).map((w, i) => {
    // Las partículas van en minúscula, salvo cuando abren la cadena.
    if (i > 0 && PARTICULAS.has(w)) return w
    // Respeta apóstrofes (D'Angelo) y guiones (Ana-María):
    // capitaliza el primer caracter alfabético de cada fragmento.
    return w.split(/([-'])/).map(p =>
      /^[-']$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)
    ).join('')
  }).join(' ')
}
