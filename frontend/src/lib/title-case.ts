// espejo de backend/src/common/text/title-case.ts: el backend renormaliza antes de guardar
const PARTICULAS = new Set([
  'de', 'del', 'la', 'las', 'los', 'y', 'e', 'o', 'u',
  'da', 'do', 'das', 'dos',
])

export function aTitleCase(input?: string | null): string | null {
  if (input == null) return input ?? null
  const s = input.trim().toLowerCase()
  if (!s) return null
  return s.split(/\s+/).map((w, i) => {
    if (i > 0 && PARTICULAS.has(w)) return w
    // grupo de captura en el split: conserva los separadores - y ' en el array
    return w.split(/([-'])/).map(p =>
      /^[-']$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)
    ).join('')
  }).join(' ')
}
