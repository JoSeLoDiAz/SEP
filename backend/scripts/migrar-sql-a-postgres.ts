/**
 * Pasa el SQL de Oracle del código fuente a SQL de PostgreSQL, de una vez y para siempre.
 *
 *   pnpm exec ts-node -T scripts/migrar-sql-a-postgres.ts            # ensayo: dice qué cambiaría
 *   pnpm exec ts-node -T scripts/migrar-sql-a-postgres.ts --escribir # escribe los ficheros
 *   pnpm exec ts-node -T scripts/migrar-sql-a-postgres.ts --escribir evaluadores  # solo esa carpeta
 *
 * POR QUÉ. Hoy el SQL se traduce al vuelo, en el ejecutor de consultas. Funciona —resuelve el 98 % de las 1.106
 * consultas— pero deja el código escrito en un dialecto que ya no se usa, y obliga a mantener el traductor para
 * siempre. Esto aplica la misma traducción **al código**, para poder retirar el traductor y que lo que se lee en el
 * servicio sea exactamente lo que recibe la base.
 *
 * CÓMO. Reutiliza `aPostgres`, el mismo traductor que lleva 220 pruebas encima y meses en ejecución. No se reescribe
 * la lógica de traducción: si algo estaba bien traducido en ejecución, queda igual de bien en el fichero.
 *
 * LAS INTERPOLACIONES SON EL ÚNICO PELIGRO. Las consultas viven en plantillas con acentos graves, y 165 de las 1.092
 * llevan `${...}` dentro: trozos de SQL armados en JavaScript, nombres de columna, condiciones enteras. El traductor
 * no sabe nada de JavaScript y podría destrozarlos. Por eso cada `${...}` se sustituye antes por un marcador inerte,
 * se traduce, y luego se repone tal cual. El traductor nunca ve una interpolación.
 *
 * Y UN CASO QUE HAY QUE TRATAR APARTE: `:${i++}` —un parámetro cuyo número se calcula— no lo reconocería el
 * traductor, porque para él `:__MARCA__` no es un parámetro. Se convierte antes a `$${i++}`, que es su equivalente.
 *
 * NO TOCA: los ficheros de prueba, ni las plantillas sin SQL, ni nada fuera de los acentos graves.
 */
import * as fs from 'fs'
import * as path from 'path'
import { aPostgres, restosDeOracle } from '../src/common/db/postgres-sql'

const RAIZ = path.join(__dirname, '..', 'src')
const ESCRIBIR = process.argv.includes('--escribir')
const SOLO = process.argv.slice(2).find((a) => !a.startsWith('--'))

/** Una plantilla se considera SQL si nombra una de estas. Con eso basta: no hay falsos positivos en este repo. */
const ES_SQL = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO)\b/i

const ACENTO = '`'

type Cambio = { fichero: string; antes: string; despues: string }

/**
 * Traduce el contenido de una plantilla, dejando las interpolaciones intactas.
 *
 * El marcador lleva letras y dígitos a propósito: para el traductor es un identificador cualquiera, así que lo
 * arrastra sin mirarlo. Si llevara paréntesis o comas, `argumentos()` lo tomaría por parte de una llamada.
 */
function traducirPlantilla(texto: string): string {
  // `:${n}` es un parametro cuyo numero se calcula en JavaScript: en PostgreSQL se escribe `$${n}`
  let resto = texto.replace(/:\$\{/g, '$$${')

  // se apartan las interpolaciones contando llaves, para admitir las que llevan objetos o llamadas dentro
  const trozos: string[] = []
  let salida = ''
  while (true) {
    const i = resto.indexOf('${')
    if (i < 0) {
      salida += resto
      break
    }
    salida += resto.slice(0, i)
    let j = i + 2
    let hondo = 1
    while (j < resto.length && hondo > 0) {
      if (resto[j] === '{') hondo++
      else if (resto[j] === '}') hondo--
      j++
    }
    trozos.push(resto.slice(i, j))
    salida += `MARCAINTERP${trozos.length - 1}FIN`
    resto = resto.slice(j)
  }

  let traducido = aPostgres(salida)
  traducido = traducido.replace(/MARCAINTERP(\d+)FIN/g, (_m, n: string) => trozos[Number(n)])
  return traducido
}

/** Parte el fichero en trozos y traduce solo las plantillas que traen SQL. */
function migrarFichero(ruta: string): Cambio | null {
  const original = fs.readFileSync(ruta, 'utf8')
  const partes = original.split(ACENTO)
  let toco = false

  for (let i = 1; i < partes.length; i += 2) {
    if (!ES_SQL.test(partes[i])) continue
    const nuevo = traducirPlantilla(partes[i])
    if (nuevo !== partes[i]) {
      partes[i] = nuevo
      toco = true
    }
  }

  if (!toco) return null
  return { fichero: ruta, antes: original, despues: partes.join(ACENTO) }
}

/**
 * Ficheros que la herramienta NO debe tocar, aunque contengan SQL.
 *
 * `postgres-sql.ts` es el propio traductor, y dentro lleva la plantilla que sustituye a `ALL_TAB_COLUMNS`: como esa
 * plantilla contiene un `SELECT` y acaba con la palabra `all_tab_columns`, la herramienta la tomó por una consulta y
 * la tradujo, dejando la constante duplicada y el traductor roto. Lo mismo vale para las demás piezas de la capa de
 * base de datos: son las que *generan* SQL, no consultas que se ejecuten.
 */
const NO_TOCAR = [
  'common/db/postgres-sql.ts',
  'common/db/postgres-runner.ts',
  'common/db/fecha-utc.ts',
  'common/db/binds.ts',
]

function recorrer(dir: string, salida: string[]): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) recorrer(p, salida)
    else if (e.name.endsWith('.ts') && !e.name.includes('.spec.')) {
      const rel = path.relative(RAIZ, p).split(path.sep).join('/')
      if (NO_TOCAR.includes(rel)) continue
      salida.push(p)
    }
  }
}

function main(): void {
  const ficheros: string[] = []
  recorrer(SOLO ? path.join(RAIZ, SOLO) : RAIZ, ficheros)

  const cambios: Cambio[] = []
  for (const f of ficheros) {
    const c = migrarFichero(f)
    if (c) cambios.push(c)
  }

  console.log(ESCRIBIR ? '=== ESCRIBIENDO ===' : '=== ENSAYO (nada se escribe; añade --escribir) ===')
  console.log(`ficheros mirados: ${ficheros.length}`)
  console.log(`ficheros que cambian: ${cambios.length}\n`)

  for (const c of cambios) {
    const rel = path.relative(RAIZ, c.fichero).split(path.sep).join('/')
    // cuántas líneas cambian, para que el informe sea legible sin volcar el diff entero
    const a = c.antes.split('\n')
    const b = c.despues.split('\n')
    let n = 0
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) n++
    console.log(`  ${rel}  (${n} líneas)`)
    if (ESCRIBIR) fs.writeFileSync(c.fichero, c.despues)
  }

  // lo que sigue siendo de Oracle DESPUÉS de traducir: lo que hay que mirar a mano
  const pendientes = new Map<string, string[]>()
  for (const f of ficheros) {
    const t = fs.readFileSync(f, 'utf8')
    const partes = t.split(ACENTO)
    for (let i = 1; i < partes.length; i += 2) {
      if (!ES_SQL.test(partes[i])) continue
      for (const r of restosDeOracle(partes[i])) {
        const rel = path.relative(RAIZ, f).split(path.sep).join('/')
        if (!pendientes.has(r)) pendientes.set(r, [])
        const lista = pendientes.get(r)!
        if (!lista.includes(rel)) lista.push(rel)
      }
    }
  }

  if (pendientes.size) {
    console.log('\n=== queda de Oracle, para mirar a mano ===')
    for (const [motivo, donde] of [...pendientes].sort((x, y) => y[1].length - x[1].length)) {
      console.log(`  ${motivo}`)
      console.log(`     en: ${donde.join(', ')}`)
    }
  } else {
    console.log('\nNo queda SQL de Oracle en las plantillas.')
  }
}

main()
