/**
 * Helper para consultas Oracle que necesitan el MISMO valor en varios sitios.
 *
 * El driver `oracledb` cuenta cada aparición de un placeholder como un bind
 * independiente: escribir `:1` ocho veces y pasar un solo valor falla con
 * `NJS-098: 8 bind placeholders were used but 1 bind values were provided`.
 * No reutiliza el valor aunque el número se repita.
 *
 * Numerar a mano funciona pero se rompe en silencio en cuanto alguien agrega
 * o quita una subconsulta. Aquí se escribe un token con nombre y el helper lo
 * numera en orden de aparición y repite el valor tantas veces como haga falta.
 *
 * @example
 *   const { sql, params } = bindRepetido(
 *     `SELECT (SELECT COUNT(*) FROM A WHERE ID = :ev) AS a,
 *             (SELECT COUNT(*) FROM B WHERE ID = :ev) AS b FROM DUAL`,
 *     'ev', evaluadorId,
 *   )
 *   await dataSource.query(sql, params)   // → ':1' y ':2', params [id, id]
 */
export function bindRepetido(
  plantilla: string,
  token: string,
  valor: unknown,
  desde = 0,
): { sql: string; params: unknown[] } {
  let n = desde
  const sql = plantilla.replace(new RegExp(`:${token}\\b`, 'g'), () => `:${++n}`)
  return { sql, params: Array(n - desde).fill(valor) }
}

/**
 * Versión para varios tokens. Los numera en el orden en que aparecen en el
 * texto, no en el orden del objeto — que es lo que exige el bind posicional.
 *
 * @example
 *   bindsRepetidos(`... :pid ... :anio ... :pid ...`, { pid: 7, anio: 2025 })
 *   // → ':1 ... :2 ... :3', params [7, 2025, 7]
 */
export function bindsRepetidos(
  plantilla: string,
  valores: Record<string, unknown>,
): { sql: string; params: unknown[] } {
  const nombres = Object.keys(valores)
  if (nombres.length === 0) return { sql: plantilla, params: [] }

  const params: unknown[] = []
  const patron = new RegExp(`:(${nombres.join('|')})\\b`, 'g')
  const sql = plantilla.replace(patron, (_m, nombre: string) => {
    params.push(valores[nombre])
    return `:${params.length}`
  })
  return { sql, params }
}

/**
 * Parte una lista de ids en bloques que quepan en un `IN (...)`.
 *
 * Oracle rechaza con `ORA-01795` una lista literal de más de 1000 elementos.
 * Es un límite que no aparece en desarrollo —con 40 evaluadores nunca se toca—
 * y revienta el día que el banco crece. Quien consulta por ids debe recorrer
 * los bloques y concatenar resultados.
 */
export function enBloques<T>(ids: T[], tam = 900): T[][] {
  if (ids.length <= tam) return ids.length ? [ids] : []
  const bloques: T[][] = []
  for (let i = 0; i < ids.length; i += tam) bloques.push(ids.slice(i, i + tam))
  return bloques
}
