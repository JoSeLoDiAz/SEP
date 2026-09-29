/**
 * Ids que asigna la base.
 *
 * El esquema pone el id en 166 tablas con el valor por defecto de la columna: `nextval` de su secuencia. Si el
 * backend saca el id antes por su cuenta y lo reutiliza en las filas hijas, puede acabar apuntando a otra fila.
 *
 * `insertarConId` inserta y lee, en la misma sentencia, el id que de verdad quedó:
 *  - si la tabla lo pone sola, **la llave no se manda** —mandar `NULL` guardaría un nulo de verdad— y el `RETURNING`
 *    la devuelve como una fila más del resultado;
 *  - si no, sale del `nextval` de su secuencia o de `MAX + 1`.
 *
 * Antes este fichero tenía dos caminos, uno por motor, porque en Oracle los ids los ponían los triggers de GeneXus y
 * el id volvía por un bind de salida (`RETURNING ... INTO`). Esa diferencia no era de sintaxis y por eso no la podía
 * resolver el traductor de SQL. Con Oracle fuera, queda un solo camino. El estado con los dos está en la rama
 * `sep-oracle`.
 */

/** Lo que tienen en común DataSource, EntityManager y QueryRunner de TypeORM. */
export interface Ejecutor {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(sql: string, parametros?: any[]): Promise<any>
}

/** Cómo sale el id cuando la tabla NO lo pone sola. */
export type SinTrigger = { secuencia: string } | { maxMasUno: true }

/** Un valor que va tal cual en el SQL, sin parámetro (por ejemplo AHORA_UTC). */
export class SqlCrudo {
  constructor(readonly texto: string) {}
}
export const sqlCrudo = (texto: string) => new SqlCrudo(texto)

const IDENT = /^[A-Z][A-Z0-9_$#]*$/i
function ident(s: string, que: string): string {
  if (!IDENT.test(s)) throw new Error(`insertarConId: ${que} inválido (${s})`)
  return s.toUpperCase()
}

/**
 * Qué columnas traen por defecto el siguiente valor de su secuencia. Es el equivalente de los triggers de id de
 * GeneXus, y el esquema migrado lo puso en las mismas 166 tablas.
 */
const SQL_DEFECTOS = `SELECT table_name AS "tabla", column_name AS "columna"
  FROM information_schema.columns
  WHERE table_schema = current_schema() AND column_default LIKE 'nextval(%'`

export async function cargarTriggersDeId(ej: Ejecutor): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  const filas = (await ej.query(SQL_DEFECTOS)) as { tabla: string; columna: string }[]
  for (const f of filas) mapa.set(String(f.tabla).toUpperCase(), String(f.columna).toUpperCase())
  return mapa
}

let cache: Promise<Map<string, string>> | null = null

/** Las tablas cuyo id pone la base (tabla -> columna). Se carga una vez: al arrancar o en el primer uso. */
export function triggersDeId(ej: Ejecutor): Promise<Map<string, string>> {
  if (!cache) {
    cache = cargarTriggersDeId(ej).catch((e: unknown) => {
      cache = null
      throw e
    })
  }
  return cache
}

/** Solo para pruebas. */
export function reiniciarTriggersDeId(mapa?: Map<string, string>): void {
  cache = mapa ? Promise.resolve(mapa) : null
}

export async function tieneTriggerDeId(ej: Ejecutor, tabla: string, pk: string): Promise<boolean> {
  return (await triggersDeId(ej)).get(tabla.toUpperCase()) === pk.toUpperCase()
}

/**
 * INSERT que devuelve el id que quedó en la fila. `valores` son las demás columnas (sin la llave); un valor
 * `SqlCrudo` va tal cual en el SQL. Con un QueryRunner o EntityManager de una transacción corre en esa conexión.
 */
export async function insertarConId(
  ej: Ejecutor,
  tabla: string,
  pk: string,
  sinTrigger: SinTrigger,
  valores: Record<string, unknown>,
): Promise<number> {
  const T = ident(tabla, 'tabla')
  const P = ident(pk, 'llave')
  const nombres = Object.keys(valores)
  const cols = nombres.map((c) => ident(c, 'columna'))
  if (cols.includes(P)) throw new Error(`insertarConId: ${P} no va en los valores; lo pone la base`)

  const params: unknown[] = []
  const laPoneLaBase = await tieneTriggerDeId(ej, T, P)

  // Cuando la pone la base, la llave se omite del INSERT: mandar NULL guardaría un nulo de verdad.
  let valorPk: string | null = null
  if (!laPoneLaBase) {
    if ('secuencia' in sinTrigger) {
      const S = ident(sinTrigger.secuencia, 'secuencia')
      valorPk = `nextval('${S.toLowerCase()}')`
    } else {
      const r = (await ej.query(`SELECT COALESCE(MAX(${P}), 0) + 1 AS "id" FROM ${T}`)) as { id: unknown }[]
      params.push(Number(r[0].id))
      valorPk = '$1'
    }
  }

  const vals = nombres.map((c) => {
    const v = valores[c]
    if (v instanceof SqlCrudo) return v.texto
    params.push(v)
    return `$${params.length}`
  })

  const columnas = valorPk === null ? cols : [P, ...cols]
  const puestos = valorPk === null ? vals : [valorPk, ...vals]
  const sql = `INSERT INTO ${T} (${columnas.join(', ')}) VALUES (${puestos.join(', ')}) RETURNING ${P}`
  return leerId(await ej.query(sql, params), T)
}

/**
 * El id que devolvió la base: una fila con una sola columna.
 *
 * Sigue aceptando varias formas —un arreglo de filas, una fila suelta, un arreglo de valores— porque `query` de
 * TypeORM no promete siempre la misma según por dónde se llame, y porque un `RETURNING` de varias filas trae la
 * última al final.
 */
export function leerId(salida: unknown, tabla = ''): number {
  let v: unknown = Array.isArray(salida) ? salida[salida.length - 1] : salida
  if (Array.isArray(v)) v = v[0]
  if (v && typeof v === 'object') {
    const valores = Object.values(v as Record<string, unknown>)
    if (valores.length) v = valores[0]
  }
  const n = Number(v)
  if (v === null || v === undefined || !Number.isSafeInteger(n) || n <= 0) {
    throw new Error(`insertarConId ${tabla}: el RETURNING no devolvió un id válido`)
  }
  return n
}
