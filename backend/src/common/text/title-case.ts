// partículas en minúscula salvo al inicio; incluye portuguesas de apellidos compuestos
const PARTICULAS = new Set([
  'de', 'del', 'la', 'las', 'los', 'y', 'e', 'o', 'u', 'da', 'do', 'das', 'dos',
])

// devuelve null y no cadena vacía para que el bind de Oracle no inserte ''
export function aTitleCase(input?: string | null): string | null {
  if (input == null) return null
  const s = input.trim().toLowerCase()
  if (!s) return null
  return s
    .split(/\s+/)
    .map((palabra, idx) => {
      if (idx > 0 && PARTICULAS.has(palabra)) return palabra
      return palabra
        .split(/([-'])/)
        .map(parte => (/^[-']$/.test(parte) ? parte : parte.charAt(0).toUpperCase() + parte.slice(1)))
        .join('')
    })
    .join(' ')
}
