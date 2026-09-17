/**
 * Ids que asigna la base.
 *
 * En el Exadata, los triggers de id de GeneXus (BEFORE INSERT FOR EACH ROW, sin condición:
 * `SELECT <seq>.NEXTVAL INTO :new.<ID>`) pisan siempre el id que manda la app; en el XE faltan en 97 tablas.
 * Si el backend saca el id antes (NEXTVAL o MAX+1) y lo reusa en las hijas, en el Exadata apunta a otra fila.
 *
 * insertarConId inserta y lee, en la misma sentencia, el id que de verdad quedó en la fila:
 *  - si la tabla pone el id sola, deja que lo ponga y lo devuelve con RETURNING;
 *  - si no, hace lo que hacía el código antes: NEXTVAL de su secuencia o MAX+1.
 * Así el mismo código da el mismo resultado en las dos bases.
 *
 * La diferencia entre motores no es un detalle de sintaxis y por eso no la puede resolver el traductor:
 *  - Oracle: la llave va como NULL y el trigger la pisa. El id vuelve por un bind de salida (RETURNING ... INTO).
 *  - PostgreSQL: no hay triggers; el id lo pone el valor por defecto de la columna (nextval de su secuencia). Ahí
 *    mandar NULL guardaría un nulo de verdad, así que la llave NO se manda: se omite y el RETURNING la devuelve
 *    como una fila más.
 */
import { esPostgres } from './motor'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const oracledb = require('oracledb') as { BIND_OUT: number; NUMBER: unknown }

/** Lo que tienen en común DataSource, EntityManager y QueryRunner de TypeORM. */
export interface Ejecutor {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(sql: string, parametros?: any[]): Promise<any>
}

/** Cómo sale el id cuando la tabla NO lo pone sola. */
export type SinTrigger = { secuencia: string } | { maxMasUno: true }

/** Un valor que va tal cual en el SQL, sin bind (por ejemplo AHORA_UTC). */
export class SqlCrudo {
  constructor(readonly texto: string) {}
}
export const sqlCrudo = (texto: string) => new SqlCrudo(texto)

const IDENT = /^[A-Z][A-Z0-9_$#]*$/i
function ident(s: string, que: string): string {
  if (!IDENT.test(s)) throw new Error(`insertarConId: ${que} inválido (${s})`)
  return s.toUpperCase()
}

// SEP_APP ve los triggers de SEPLOCAL por ALL_TRIGGERS, con su cuerpo, pero no por ALL_TRIGGER_COLS: por eso la
// columna sale del cuerpo. El dueño de las tablas es el de los sinónimos de SEP_APP (XE) o el esquema actual (Exadata).
const SQL_TRIGGERS = `SELECT t.TABLE_NAME AS "tabla", t.TRIGGER_BODY AS "cuerpo" FROM ALL_TRIGGERS t
  WHERE t.TABLE_OWNER = (SELECT COALESCE(MAX(s.TABLE_OWNER), SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA'))
                           FROM ALL_SYNONYMS s WHERE s.OWNER = USER AND s.SYNONYM_NAME = 'USUARIO')
    AND t.STATUS = 'ENABLED' AND t.TRIGGER_TYPE = 'BEFORE EACH ROW' AND t.TRIGGERING_EVENT LIKE '%INSERT%'`

// En PostgreSQL lo mismo se pregunta al diccionario: qué columnas traen por defecto el siguiente valor de su
// secuencia. Es el equivalente del trigger de GeneXus, y el esquema migrado lo puso en las mismas 166 tablas.
const SQL_DEFECTOS = `SELECT table_name AS "tabla", column_name AS "columna"
  FROM information_schema.columns
  WHERE table_schema = current_schema() AND column_default LIKE 'nextval(%'`

/** La columna que asigna el cuerpo de un trigger de id ('... INTO :new.RadicadoId ...' -> 'RADICADOID'). */
export function columnaAsignada(cuerpo: unknown): string | null {
  const m = /INTO\s+:new\.("?)([A-Za-z][A-Za-z0-9_$#]*)\1/i.exec(String(cuerpo ?? ''))
  return m ? m[2].toUpperCase() : null
}

export async function cargarTriggersDeId(ej: Ejecutor): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  if (esPostgres()) {
    const filas = (await ej.query(SQL_DEFECTOS)) as { tabla: string; columna: string }[]
    for (const f of filas) mapa.set(String(f.tabla).toUpperCase(), String(f.columna).toUpperCase())
    return mapa
  }
  const filas = (await ej.query(SQL_TRIGGERS)) as { tabla: string; cuerpo: unknown }[]
  for (const f of filas) {
    const c = columnaAsignada(f.cuerpo)
    if (c) mapa.set(String(f.tabla).toUpperCase(), c)
  }
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
 * SqlCrudo va tal cual en el SQL. Con un QueryRunner o EntityManager de una transacción corre en esa conexión.
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

  const pg = esPostgres()
  const params: unknown[] = []
  const laPoneLaBase = await tieneTriggerDeId(ej, T, P)

  // En PostgreSQL, cuando la pone la base, la llave se omite del INSERT: mandar NULL guardaría un nulo.
  let valorPk: string | null
  if (laPoneLaBase) {
    valorPk = pg ? null : 'NULL'
  } else if ('secuencia' in sinTrigger) {
    const S = ident(sinTrigger.secuencia, 'secuencia')
    valorPk = pg ? `nextval('${S.toLowerCase()}')` : `${S}.NEXTVAL`
  } else {
    const r = (await ej.query(`SELECT ${pg ? 'COALESCE' : 'NVL'}(MAX(${P}), 0) + 1 AS "id" FROM ${T}`)) as { id: unknown }[]
    params.push(Number(r[0].id))
    valorPk = '$1'
  }

  const vals = nombres.map((c) => {
    const v = valores[c]
    if (v instanceof SqlCrudo) return v.texto
    params.push(v)
    return `$${params.length}`
  })

  const columnas = valorPk === null ? cols : [P, ...cols]
  const puestos = valorPk === null ? vals : [valorPk, ...vals]
  if (pg) {
    // PostgreSQL devuelve la llave como una fila más del resultado; no hay bind de salida
    const sql = `INSERT INTO ${T} (${columnas.join(', ')}) VALUES (${puestos.join(', ')}) RETURNING ${P}`
    return leerId(await ej.query(sql, params), T)
  }
  params.push({ dir: oracledb.BIND_OUT, type: oracledb.NUMBER })
  const sql =
    `INSERT INTO ${T} (${columnas.join(', ')}) VALUES (${puestos.join(', ')}) ` +
    `RETURNING ${P} INTO $${params.length}`
  return leerId(await ej.query(sql, params), T)
}

/**
 * El id que devolvió la base, venga como venga:
 *  - Oracle: bind posicional de salida; outBinds trae solo los de salida, en orden, y en un DML con RETURNING cada
 *    uno es un arreglo.
 *  - PostgreSQL: una fila con una sola columna.
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
