type Opcion = { id: number; nombre: string }

/**
 * Busca en un catálogo (MODALIDAD, TIPOEVENTO) el nombre que trae el Excel del VBA.
 *
 * El Excel dice "EMPRESA INDIVIDUAL" y la BD guarda solo "INDIVIDUAL". Primero va la coincidencia exacta; si no hay,
 * la coincidencia por subcadena más larga y, entre iguales, el nombre de largo más parecido al texto. Antes ganaba la
 * primera subcadena del catálogo, así que un nombre corto contenido en el texto le quitaba el lugar a uno más largo
 * y más preciso según el orden en que viniera el catálogo.
 */
export function matchModalidad<T extends Opcion>(texto: string, catalogo: T[]): T | undefined {
  if (!texto) return undefined
  const norm = (s: string) => s
    .trim().toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/^EMPRESAS?\s+/, '')
  const t = norm(texto)
  if (!t) return undefined
  const exacta = catalogo.find(m => norm(m.nombre) === t)
  if (exacta) return exacta

  let mejor: T | undefined
  let largoMejor = 0
  let difMejor = Infinity
  for (const m of catalogo) {
    const c = norm(m.nombre)
    if (c.length <= 2 || !(t.includes(c) || c.includes(t))) continue
    // lo que coincide es el nombre entero (si está dentro del texto) o el texto entero (si está dentro del nombre)
    const largo = Math.min(c.length, t.length)
    const dif = Math.abs(c.length - t.length)
    if (largo > largoMejor || (largo === largoMejor && dif < difMejor)) {
      mejor = m
      largoMejor = largo
      difMejor = dif
    }
  }
  return mejor
}
