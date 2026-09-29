// Ni oracledb ni pg reutilizan el valor de un parámetro repetido: cada aparición cuenta como uno distinto, así
// que `:ev` escrito cinco veces se numera $1..$5 y el valor se repite otras tantas en el array.
export function bindRepetido(
  plantilla: string,
  token: string,
  valor: unknown,
  desde = 0,
): { sql: string; params: unknown[] } {
  let n = desde
  const sql = plantilla.replace(new RegExp(`:${token}\\b`, 'g'), () => `$${++n}`)
  return { sql, params: Array(n - desde).fill(valor) }
}

// numera por orden de aparición en el texto, no por orden del objeto: lo exige el bind posicional
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
    return `$${params.length}`
  })
  return { sql, params }
}

// ORA-01795: Oracle no acepta más de 1000 elementos en un IN (...)
export function enBloques<T>(ids: T[], tam = 900): T[][] {
  if (ids.length <= tam) return ids.length ? [ids] : []
  const bloques: T[][] = []
  for (let i = 0; i < ids.length; i += tam) bloques.push(ids.slice(i, i + tam))
  return bloques
}
