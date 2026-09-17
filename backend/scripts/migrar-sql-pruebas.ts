/**
 * Pone al día el SQL que las pruebas esperan, después de migrar el código a PostgreSQL.
 *
 *   pnpm exec ts-node -T scripts/migrar-sql-pruebas.ts            # ensayo
 *   pnpm exec ts-node -T scripts/migrar-sql-pruebas.ts --escribir
 *
 * POR QUÉ HACE FALTA. Las pruebas de los servicios no tocan ninguna base: simulan el ejecutor de consultas y
 * reconocen cada consulta por un trozo de su texto —`sql.includes('NVL(CONVENIOSESTADO, 0)')`—. Al migrar el código,
 * ese texto cambió: el simulador ya no reconoce la consulta, devuelve lo que no toca y la prueba falla por un motivo
 * que no tiene nada que ver con lo que quería comprobar.
 *
 * POR QUÉ ES OTRA HERRAMIENTA. La del código solo mira las plantillas con acentos graves, que es donde viven las
 * consultas. En las pruebas los trozos de SQL están casi siempre en comillas simples, dentro de un `includes` o un
 * `startsWith`, así que hay que mirar los tres tipos de literal.
 *
 * QUÉ NO TOCA:
 *  - `postgres-sql.spec.ts` y las demás pruebas de la capa de base de datos: comprueban el traductor, así que su SQL
 *    de Oracle es el dato de entrada y traducirlo las dejaría sin sentido.
 *  - Los literales que no nombran nada de SQL.
 *
 * NO ES UNA HERRAMIENTA DE UN SOLO USO A CIEGAS: deja los fallos que no pueda arreglar para mirarlos a mano. Si
 * después de pasarla siguen fallando pruebas, es que esas esperaban algo más que un cambio de dialecto.
 */
import * as fs from 'fs'
import * as path from 'path'
import { aPostgres } from '../src/common/db/postgres-sql'

const RAIZ = path.join(__dirname, '..', 'src')
const ESCRIBIR = process.argv.includes('--escribir')

/**
 * Las únicas pruebas que no se tocan: las del traductor.
 *
 * Su SQL de Oracle es el **dato de entrada** —comprueban que `NVL` se convierte en `COALESCE`—, así que traducirlo
 * las dejaría comprobando que PostgreSQL se convierte en PostgreSQL. Las demás de `common/db` sí se migran: prueban
 * `insertarConId` y compañía, y ahí el SQL de Oracle es lo que hay que cambiar.
 */
const NO_TOCAR = /(postgres-sql|postgres-runner)\.spec\.ts$/

/** Un literal se traduce solo si nombra algo que sea inequívocamente SQL. */
const ES_SQL = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|FROM|WHERE|VALUES|SET|NVL|TRIM|DBMS_LOB|ROWNUM|SYSDATE|SYS_EXTRACT_UTC|TO_CHAR|RETURNING)\b/i

/**
 * Recorre los literales del fichero y traduce los que traigan SQL.
 *
 * Se parte a mano en vez de con una expresión regular porque hay que saber en qué tipo de comilla se está: un
 * apóstrofo dentro de un comentario en español —«la búsqueda del año»— desharía el emparejamiento si se buscaran
 * las comillas simples por su cuenta.
 */
function migrar(texto: string): string {
  let salida = ''
  let i = 0

  while (i < texto.length) {
    const c = texto[i]

    // comentarios: se copian tal cual, para no tomar un apóstrofo por el inicio de un literal
    if (c === '/' && texto[i + 1] === '/') {
      const fin = texto.indexOf('\n', i)
      const hasta = fin < 0 ? texto.length : fin
      salida += texto.slice(i, hasta)
      i = hasta
      continue
    }
    if (c === '/' && texto[i + 1] === '*') {
      const fin = texto.indexOf('*/', i)
      const hasta = fin < 0 ? texto.length : fin + 2
      salida += texto.slice(i, hasta)
      i = hasta
      continue
    }

    if (c === "'" || c === '"' || c === '`') {
      const cierre = c
      let j = i + 1
      while (j < texto.length) {
        if (texto[j] === '\\') { j += 2; continue }
        if (texto[j] === cierre) break
        j++
      }
      const dentro = texto.slice(i + 1, j)
      // Un literal que ya trae barras de escape se deja en paz: al traductor esos `\'` le parecen el inicio de un
      // literal de SQL y partiría el texto por donde no debe. Son pocos y se miran a mano.
      const traducible = ES_SQL.test(dentro) && !dentro.includes('\\')
      if (traducible) {
        // La traducción mete comillas simples propias —`date_trunc('day', ...)`, `AT TIME ZONE 'UTC'`—, y si el
        // literal de JavaScript va entre comillas simples, esas comillas lo cortan por la mitad. Hay que escaparlas.
        const traducido = aPostgres(dentro).split(cierre).join('\\' + cierre)
        salida += cierre + traducido + cierre
      } else {
        salida += cierre + dentro + cierre
      }
      i = j + 1
      continue
    }

    salida += c
    i++
  }

  return salida
}

function recorrer(dir: string, salida: string[]): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) recorrer(p, salida)
    else if (e.name.endsWith('.spec.ts') && !NO_TOCAR.test(p)) salida.push(p)
  }
}

function main(): void {
  const ficheros: string[] = []
  recorrer(RAIZ, ficheros)

  console.log(ESCRIBIR ? '=== ESCRIBIENDO ===' : '=== ENSAYO (añade --escribir) ===')
  let cambiados = 0

  for (const f of ficheros) {
    const antes = fs.readFileSync(f, 'utf8')
    const despues = migrar(antes)
    if (antes === despues) continue
    cambiados++
    const rel = path.relative(RAIZ, f).split(path.sep).join('/')
    const a = antes.split('\n')
    const b = despues.split('\n')
    let n = 0
    for (let k = 0; k < Math.max(a.length, b.length); k++) if (a[k] !== b[k]) n++
    console.log(`  ${rel}  (${n} líneas)`)
    if (ESCRIBIR) fs.writeFileSync(f, despues)
  }

  console.log(`\npruebas miradas: ${ficheros.length}   cambian: ${cambiados}`)
}

main()
