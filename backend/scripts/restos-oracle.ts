/**
 * Cuánto del SQL del backend queda resuelto por el traductor y cuánto exige criterio humano.
 *
 *   pnpm exec ts-node scripts/restos-oracle.ts
 *
 * Recorre el código, saca cada texto que parezca SQL y le pasa `restosDeOracle`. No ejecuta nada contra ninguna
 * base y no imprime el SQL: solo el archivo y qué le falta, porque una consulta puede llevar datos en su texto.
 *
 * Sirve para dimensionar la migración de la app con un número medido, no con una estimación.
 */
import * as fs from 'fs'
import * as path from 'path'
import { restosDeOracle } from '../src/common/db/postgres-sql'

const RAIZ = path.join(__dirname, '..', 'src')

function archivos(dir: string): string[] {
  const salida: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) salida.push(...archivos(p))
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) salida.push(p)
  }
  return salida
}

/** Textos del archivo que parecen SQL: plantillas con acento grave y cadenas normales. */
function sqlDe(fuente: string): string[] {
  const trozos: string[] = []
  const plantillas = fuente.match(/`(?:[^`\\]|\\[\s\S])*`/g) ?? []
  const comillas = fuente.match(/'(?:[^'\\\n]|\\.)*'/g) ?? []
  for (const t of [...plantillas, ...comillas]) {
    const s = t.slice(1, -1)
    if (/\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE)\b/i.test(s)) trozos.push(s)
  }
  return trozos
}

function main(): void {
  const porMotivo = new Map<string, number>()
  const porArchivo = new Map<string, number>()
  let consultas = 0
  let limpias = 0

  for (const f of archivos(RAIZ)) {
    const rel = path.relative(RAIZ, f).replace(/\\/g, '/')
    for (const sql of sqlDe(fs.readFileSync(f, 'utf8'))) {
      consultas++
      const restos = restosDeOracle(sql)
      if (!restos.length) { limpias++; continue }
      porArchivo.set(rel, (porArchivo.get(rel) ?? 0) + 1)
      for (const r of restos) porMotivo.set(r, (porMotivo.get(r) ?? 0) + 1)
    }
  }

  const pct = consultas ? Math.round((limpias / consultas) * 100) : 0
  console.log(`consultas encontradas: ${consultas}`)
  console.log(`las resuelve el traductor: ${limpias} (${pct} %)`)
  console.log(`necesitan criterio humano: ${consultas - limpias}`)
  console.log('\npor motivo:')
  for (const [m, n] of [...porMotivo].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${m}`)
  console.log('\npor archivo (los 15 con más):')
  for (const [a, n] of [...porArchivo].sort((x, y) => y[1] - x[1]).slice(0, 15)) console.log(`  ${String(n).padStart(4)}  ${a}`)
}

main()
