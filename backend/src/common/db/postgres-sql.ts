/**
 * Traduce el SQL de Oracle que escribe el SEP al que entiende PostgreSQL.
 *
 * Se aplica en un solo punto —el ejecutor de consultas— y no en cada servicio: `DataSource.query` y
 * `EntityManager.query` terminan los dos en `QueryRunner.query`, así que envolviendo ese método quedan cubiertas las
 * 1.027 consultas crudas del backend sin tocarlas una por una.
 *
 * Lo que traduce, por reemplazo directo:
 *  - `:1, :2` -> `$1, $2`, y `:param_0` -> `$1`. Es el cambio más extendido (1.368 apariciones): oracledb usa
 *    parámetros posicionales con dos puntos y el conector de PostgreSQL los quiere con dólar.
 *  - `NVL(a, b)` -> `COALESCE(a, b)`, y `NVL2` queda señalado porque no tiene equivalente directo.
 *  - `SYS_EXTRACT_UTC(SYSTIMESTAMP)` -> `(now() AT TIME ZONE 'UTC')`, que es la hora UTC en las dos bases.
 *  - `FROM DUAL` se quita: PostgreSQL permite `SELECT` sin tabla.
 *
 * Y en `traducirFunciones`, mirando los argumentos uno por uno: `TO_CHAR` de uno, `TRIM`, `DBMS_LOB.GETLENGTH`,
 * `DBMS_LOB.SUBSTR`, `NLSSORT`, `INSTR`, `TRUNC` y `MONTHS_BETWEEN`. Cada una lleva su porqué al lado.
 *
 * Lo que NO traduce, a propósito: `ROWNUM`, `CONNECT BY`, `LISTAGG`, `DECODE`, `TO_DATE`, el `TO_CHAR` con máscara de
 * formato y el `RETURNING ... INTO` con binds de Oracle. Son cambios con criterio, no mecánicos, y traducirlos a
 * ciegas es peor que dejarlos ver: `restosDeOracle` los enumera para que salgan en una revisión en vez de fallar en
 * producción.
 *
 * Nada de esto mira dentro de las comillas: un literal `'NVL(x)'` o una hora `'12:30'` se dejan intactos, que es el
 * error clásico de hacer esto con un reemplazo simple.
 */

/** Trozo de SQL: `texto` es código traducible; lo que va entre comillas viaja como está. */
type Trozo = { codigo: boolean; texto: string }

/**
 * Parte el SQL en código y literales. Reconoce comillas simples (texto), dobles (identificadores) y los comentarios,
 * que tampoco se tocan.
 */
function partir(sql: string): Trozo[] {
  const trozos: Trozo[] = []
  let i = 0
  let desde = 0
  const cerrar = (hasta: number, codigo: boolean) => {
    if (hasta > desde) trozos.push({ codigo, texto: sql.slice(desde, hasta) })
    desde = hasta
  }
  while (i < sql.length) {
    const c = sql[i]
    if (c === "'" || c === '"') {
      cerrar(i, true)
      const fin = c
      i++
      while (i < sql.length) {
        if (sql[i] === fin) {
          // dos comillas seguidas son una comilla dentro del literal, no el cierre
          if (sql[i + 1] === fin) i += 2
          else { i++; break }
        } else i++
      }
      cerrar(i, false)
      continue
    }
    if (c === '-' && sql[i + 1] === '-') {
      cerrar(i, true)
      while (i < sql.length && sql[i] !== '\n') i++
      cerrar(i, false)
      continue
    }
    if (c === '/' && sql[i + 1] === '*') {
      cerrar(i, true)
      i += 2
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++
      i = Math.min(i + 2, sql.length)
      cerrar(i, false)
      continue
    }
    i++
  }
  cerrar(sql.length, true)
  return trozos
}

/** Aplica una traducción solo al código, dejando literales y comentarios como están. */
function enCodigo(sql: string, cambiar: (trozo: string) => string): string {
  return partir(sql)
    .map((t) => (t.codigo ? cambiar(t.texto) : t.texto))
    .join('')
}

function traducir(codigo: string): string {
  let s = codigo
  // `:param_0` -> `$1`. El SEP escribe este estilo en 25 sitios y el número del nombre ya dice la posición en el
  // array, así que la conversión es exacta: `param_0` es el primer elemento. Va antes que la regla de `:1` porque
  // aquella solo mira dígitos pegados a los dos puntos y no reconocería este nombre.
  s = s.replace(/(^|[^:\w]):param_(\d+)\b/gi, (_m, antes: string, n: string) => `${antes}$${Number(n) + 1}`)
  // parámetros posicionales: :1 -> $1. El (^|[^:]) evita tocar el operador de conversión :: de PostgreSQL
  s = s.replace(/(^|[^:]):(\d+)\b/g, (_m, antes: string, n: string) => `${antes}$${n}`)
  s = s.replace(/\bNVL\s*\(/gi, 'COALESCE(')
  s = s.replace(/\bSYS_EXTRACT_UTC\s*\(\s*SYSTIMESTAMP\s*\)/gi, "(now() AT TIME ZONE 'UTC')")
  s = s.replace(/\bSYSTIMESTAMP\b/gi, "(now() AT TIME ZONE 'UTC')")
  s = s.replace(/\bSYSDATE\b/gi, "(now() AT TIME ZONE 'UTC')")
  // SELECT ... FROM DUAL -> SELECT ...: en PostgreSQL no hace falta tabla
  s = s.replace(/\bFROM\s+DUAL\b/gi, '')
  s = s.replace(/\bALL_TAB_COLUMNS\b/gi, DICCIONARIO_COLUMNAS)
  return s
}

/**
 * `ALL_TAB_COLUMNS` de Oracle, con la forma que espera el SEP, sobre el diccionario de PostgreSQL.
 *
 * Dos sitios preguntan al diccionario en vez de fiarse de un error: uno describe las tres tablas del cronograma y
 * otro comprueba si existe la columna `DINAMIZADOR`, que se añadió después. Sin esto, el segundo da por ausente una
 * columna que sí está y la ficha del evaluador se queda sin el nombre del dinamizador.
 *
 * Se traduce la vista entera, con sus nombres de columna, no solo el nombre de la tabla: en Oracle todo va en
 * MAYÚSCULA y `NULLABLE` es `Y`/`N`, mientras que PostgreSQL guarda los nombres en minúscula y dice `YES`/`NO`.
 * El esquema sale de `current_schema()` y no de un literal, para que valga igual si algún día cambia de nombre.
 *
 * El alias es `all_tab_cols` y no `all_tab_columns` a propósito: si se llamara igual que lo que sustituye, la
 * expresión regular lo volvería a encontrar y expandiría la subconsulta dentro de sí misma en cada pasada. En
 * ejecución no se veía —cada consulta pasa una sola vez por aquí—, pero al traducir el código fuente sí.
 */
const DICCIONARIO_COLUMNAS = `(SELECT upper(table_name) AS table_name, upper(column_name) AS column_name,
         upper(data_type) AS data_type, ordinal_position AS column_id,
         CASE WHEN is_nullable = 'YES' THEN 'Y' ELSE 'N' END AS nullable
    FROM information_schema.columns WHERE table_schema = current_schema()) all_tab_cols`

/** Qué posiciones del SQL son código, y cuáles van dentro de comillas o de un comentario. */
function mascaraDeCodigo(sql: string): Uint8Array {
  const esCodigo = new Uint8Array(sql.length)
  let pos = 0
  for (const t of partir(sql)) {
    if (t.codigo) esCodigo.fill(1, pos, pos + t.texto.length)
    pos += t.texto.length
  }
  return esCodigo
}

/**
 * Los argumentos de una llamada cuyo paréntesis abre en `desde`, más la posición del paréntesis que la cierra.
 * Devuelve `null` si no cierra. Las comas que van dentro de otro paréntesis, de un literal o de un comentario no
 * separan argumentos.
 */
function argumentos(
  sql: string,
  esCodigo: Uint8Array,
  desde: number,
): { args: string[]; fin: number } | null {
  const args: string[] = []
  let inicio = desde
  let hondo = 1
  let i = desde
  while (i < sql.length) {
    if (esCodigo[i]) {
      const c = sql[i]
      if (c === '(') hondo++
      else if (c === ')') {
        hondo--
        if (hondo === 0) break
      } else if (c === ',' && hondo === 1) {
        args.push(sql.slice(inicio, i).trim())
        inicio = i + 1
      }
    }
    i++
  }
  if (hondo !== 0) return null
  args.push(sql.slice(inicio, i).trim())
  return { args, fin: i }
}

/** Las máscaras de `NLSSORT` que ignoran las tildes: acaban en `_AI` («accent insensitive»). */
const ACENTO_INSENSIBLE = /_AI\s*'\s*$/i

/**
 * `TRIM(BOTH ' ' FROM x)` y sus parientes, donde lo de dentro no es una expresión sino la sintaxis del propio `TRIM`.
 * Hoy el SEP no usa ninguna —los 1.099 `TRIM` son de un argumento—, pero si aparece una hay que dejarla en paz:
 * envolverla en `::text` daría un SQL inválido.
 */
const TRIM_CON_PALABRA = /^\s*(BOTH|LEADING|TRAILING)\b|\bFROM\b/i

/**
 * El `AS DATE` de un `CAST`, que en los dos motores se escribe igual y significa cosas distintas.
 *
 * El `DATE` de Oracle **lleva hora**; el `date` de PostgreSQL no, y el cast la tira. El SEP fecha con
 * `CAST(SYS_EXTRACT_UTC(SYSTIMESTAMP) AS DATE)` en `fecha-utc.ts`, que se usa en 163 sitios, así que sin esto cada
 * fecha de registro, de guardado o de aprobación quedaría a medianoche. No da ningún error: la fila se escribe, con
 * la hora perdida.
 *
 * El equivalente exacto es `timestamp`, y no hay ambigüedad posible: de las 231 columnas de fecha del esquema en
 * PostgreSQL, las 231 son `timestamp without time zone` y ninguna es `date`.
 */
const CAST_A_DATE = /\s+AS\s+DATE\s*$/i

const CON_TILDE = 'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ'
const SIN_TILDE = 'AAAAAEEEEIIIIOOOOOUUUUNC'

/**
 * Lo que hace `NLSSORT(x, 'NLS_SORT=WEST_EUROPEAN_AI')` en Oracle: ordenar sin mirar mayúsculas ni tildes.
 *
 * Sin esto, el orden binario de PostgreSQL pone todas las MAYÚSCULAS antes que las minúsculas y las tildes al final,
 * que es justo lo que el comentario del listado de evaluadores dice que había que evitar: «CORREDOR» aparecía entre
 * Barón y Caballero. Se resuelve con `translate` y no con una intercalación ICU para no depender de que alguien haya
 * creado la colación en la base: si falta, el listado saldría mal ordenado sin avisar.
 */
function sinTildesNiCaja(expresion: string): string {
  return `translate(upper(${expresion}), '${CON_TILDE}', '${SIN_TILDE}')`
}

/**
 * Lo que hace `MONTHS_BETWEEN(a, b)` en Oracle: los meses que hay entre dos fechas, con decimales.
 *
 * PostgreSQL no tiene equivalente, pero `age(a, b)` da la diferencia ya descompuesta en años, meses y días, y de ahí
 * salen los meses. El único sitio que la usa calcula una edad —`FLOOR(MONTHS_BETWEEN(hoy, nacimiento) / 12)`—, y ahí
 * el resultado es exacto: los años y los meses los pone `age` bien, y la parte de los días no llega a mover el
 * `FLOOR`.
 */
function mesesEntre(a: string, b: string): string {
  const edad = `age(${a}, ${b})`
  return `(EXTRACT(YEAR FROM ${edad}) * 12 + EXTRACT(MONTH FROM ${edad}) + EXTRACT(DAY FROM ${edad}) / 31.0)`
}

/**
 * Traduce las funciones de Oracle que hay que mirar argumento por argumento.
 *
 *  - **`TO_CHAR(x)` con un solo argumento.** En Oracle, sobre texto, no convierte nada: pasa de `NVARCHAR2` a
 *    `VARCHAR2` y se escribe por costumbre. PostgreSQL no tiene esa forma y falla la consulta entera con «function
 *    to_char(character varying) does not exist». `(x)::text` hace lo mismo y vale para texto, número y CLOB. Los de
 *    dos argumentos se dejan estar: la máscara del formato sí pide criterio, y `restosDeOracle` los saca.
 *  - **`DBMS_LOB.GETLENGTH(x)` -> `length(x)`.** Coinciden: los dos cuentan bytes en binario y caracteres en texto.
 *  - **`DBMS_LOB.SUBSTR(x, cuantos, desde)` -> `substr(x, desde, cuantos)`.** Aquí está la trampa: Oracle pone
 *    primero la cantidad y después la posición, y PostgreSQL al revés. Copiarlos en el mismo orden no da ningún
 *    error, solo devuelve el texto equivocado; `DBMS_LOB.SUBSTR(col, 2000, 1)` —la forma que usa el SEP en sus 8
 *    sitios— pasaría a leer 1 carácter desde el 2000 en vez de los 2000 primeros.
 *
 * Se resuelve sobre el SQL completo y no trozo a trozo porque `TO_CHAR(F, 'DD/MM')` reparte sus argumentos entre
 * varios trozos —el formato es un literal y viaja aparte—, así que contar paréntesis dentro de un solo trozo daría
 * un resultado falso.
 *
 * Se repite hasta que no queda nada por cambiar, para que una llamada dentro de otra también se traduzca: los
 * reemplazos se aplican de atrás hacia delante y el de fuera pisaría al de dentro en una sola pasada. Convergen
 * porque ninguna de las tres formas traducidas vuelve a coincidir con el patrón.
 */
function traducirFunciones(sql: string): string {
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const esCodigo = mascaraDeCodigo(sql)
    const cambios: [number, number, string][] = []
    const re = /\b(?:(TO_CHAR|TO_NCHAR|NLSSORT|INSTR|TRUNC|MONTHS_BETWEEN|TRIM|CAST)|DBMS_LOB\s*\.\s*(GETLENGTH|SUBSTR))\s*\(/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(sql)) !== null) {
      if (!esCodigo[m.index]) continue
      const trozo = argumentos(sql, esCodigo, m.index + m[0].length)
      if (!trozo) continue // sin cierre: SQL cortado, se deja como está
      const { args, fin } = trozo
      const nombre = (m[1] ?? m[2]).toUpperCase()
      let nuevo: string | null = null
      if ((nombre === 'TO_CHAR' || nombre === 'TO_NCHAR') && args.length === 1) nuevo = `(${args[0]})::text`
      else if (nombre === 'GETLENGTH' && args.length === 1) nuevo = `length(${args[0]})`
      // el tercer argumento de Oracle es desde dónde, y en PostgreSQL va antes que la cantidad
      else if (nombre === 'SUBSTR' && args.length === 3) nuevo = `substr(${args[0]}, ${args[2]}, ${args[1]})`
      // sin el tercero, Oracle empieza por el primer carácter
      else if (nombre === 'SUBSTR' && args.length === 2) nuevo = `substr(${args[0]}, 1, ${args[1]})`
      else if (nombre === 'NLSSORT' && args.length === 2 && ACENTO_INSENSIBLE.test(args[1]))
        nuevo = sinTildesNiCaja(args[0])
      else if (nombre === 'INSTR' && args.length === 2) nuevo = `strpos(${args[0]}, ${args[1]})`
      else if (nombre === 'TRIM' && args.length === 1 && !TRIM_CON_PALABRA.test(args[0]))
        // si lo de dentro ya se convirtió a texto —un TO_CHAR traducido, por ejemplo—, no se convierte otra vez
        nuevo = args[0].endsWith('::text') ? `btrim(${args[0]})` : `btrim((${args[0]})::text)`
      else if (nombre === 'TRUNC' && args.length === 1) nuevo = `date_trunc('day', ${args[0]})`
      else if (nombre === 'MONTHS_BETWEEN' && args.length === 2) nuevo = mesesEntre(args[0], args[1])
      else if (nombre === 'CAST' && args.length === 1 && CAST_A_DATE.test(args[0]))
        nuevo = `CAST(${args[0].replace(CAST_A_DATE, '')} AS timestamp)`
      if (nuevo !== null) cambios.push([m.index, fin + 1, nuevo])
    }
    // Un nivel por vuelta: si una llamada va dentro de otra, se queda la de fuera y la de dentro espera. Aplicar las
    // dos a la vez se come el texto que sigue, porque los índices de la de fuera se calcularon antes de que la de
    // dentro cambiara de longitud. Como `exec` recorre de izquierda a derecha, la de fuera siempre llega primero.
    const sinSolape: [number, number, string][] = []
    let ultimoFin = -1
    for (const c of cambios) {
      if (c[0] < ultimoFin) continue
      sinSolape.push(c)
      ultimoFin = c[1]
    }
    if (!sinSolape.length) break
    // de atrás hacia delante: reemplazar por el principio correría los índices que faltan
    for (const [desde, hasta, texto] of sinSolape.reverse()) sql = sql.slice(0, desde) + texto + sql.slice(hasta)
  }
  return sql
}

/**
 * `ROWNUM = 1` y `ROWNUM <= n` pasan a `LIMIT`, con dos cuidados que hacen la diferencia entre traducir y romper.
 *
 * **Dónde va el LIMIT.** No al final de la consulta, sino al final del `SELECT` al que pertenece ese `WHERE`. En
 * `(SELECT dp.DOCUMENTOID FROM (...) dp LIMIT 1) AS "documentoId"` el `LIMIT` tiene que quedar dentro del
 * paréntesis: pegarlo al final dejaría un SQL inválido, o peor, limitaría la consulta entera. Por eso se busca el
 * paréntesis que cierra el nivel donde está el `ROWNUM`, y se inserta justo antes.
 *
 * **Cuándo NO traducir.** En Oracle `ROWNUM` se aplica *antes* del `ORDER BY` y `LIMIT` *después*. Mientras no haya
 * `ORDER BY` en ese mismo nivel las dos formas dan lo mismo —y el SEP ya anida las consultas donde importa, con un
 * comentario diciéndolo—, pero si algún día aparecen juntos el resultado cambiaría sin dar error. En ese caso se
 * deja el `ROWNUM` como está y `restosDeOracle` lo señala, que es la forma de que se vea.
 */
function rownumALimite(sql: string): string {
  // como en traducirFunciones: un nivel por vuelta, para que dos ROWNUM anidados no se pisen los índices
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const antes = sql
    sql = unaVueltaDeRownum(sql)
    if (sql === antes) break
  }
  return sql
}

function unaVueltaDeRownum(sql: string): string {
  const esCodigo = mascaraDeCodigo(sql)
  const re = /\bROWNUM\s*(<=|<|=)\s*(\$\d+|\d+)/gi
  const cambios: { desde: number; hasta: number; limite: string; nivel: number }[] = []
  let m: RegExpExecArray | null

  while ((m = re.exec(sql)) !== null) {
    if (!esCodigo[m.index]) continue
    const finCond = m.index + m[0].length
    const limite = m[1] === '<' ? String(Number(m[2]) - 1) : m[2]
    if (m[1] === '<' && !/^\d+$/.test(m[2])) continue // `ROWNUM < $n` pediría restar en SQL: se deja a la vista

    // hasta dónde llega este nivel de paréntesis, que es donde tiene que ir el LIMIT
    let i = finCond
    let hondo = 0
    while (i < sql.length) {
      if (esCodigo[i]) {
        if (sql[i] === '(') hondo++
        else if (sql[i] === ')') {
          if (hondo === 0) break
          hondo--
        }
      }
      i++
    }
    const finNivel = i

    // un ORDER BY en este mismo nivel cambiaría el resultado: no se traduce
    const resto = sql.slice(finCond, finNivel)
    if (/\bORDER\s+BY\b/i.test(quitarParentesis(resto))) continue

    const antes = sql.slice(0, m.index)
    const despues = sql.slice(finCond)
    const conAnd = /\bAND\s*$/i.exec(antes)
    const conWhere = /\bWHERE\s*$/i.exec(antes)
    const luegoAnd = /^\s*AND\b/i.exec(despues)

    let desde = m.index
    let hasta = finCond
    if (conAnd) desde = conAnd.index
    else if (conWhere && luegoAnd) hasta = finCond + luegoAnd[0].length
    else if (conWhere) desde = conWhere.index
    else continue // otra forma: mejor dejarla ver que adivinar

    cambios.push({ desde, hasta, limite, nivel: finNivel })
  }

  // los anidados esperan a la vuelta siguiente: reescribir dos rangos que se contienen corre los índices del de fuera
  const sinSolape: typeof cambios = []
  let ultimoFin = -1
  for (const c of cambios) {
    if (c.desde < ultimoFin) continue
    sinSolape.push(c)
    ultimoFin = c.nivel
  }

  // cada cambio reescribe su nivel entero de una vez: quita la condición y deja el LIMIT al final
  for (const c of sinSolape.reverse()) {
    // se recortan espacios y tabuladores, nunca el salto de línea: si la línea de antes acaba en un comentario `--`,
    // juntarla con lo que sigue metería el LIMIT dentro del comentario
    const cabeza = sql.slice(0, c.desde).replace(/[ \t]+$/, '')
    const medio = sql.slice(c.hasta, c.nivel).replace(/^[ \t]+/, '').replace(/[ \t]+$/, '')
    const cuerpo = medio ? `${cabeza} ${medio}` : cabeza
    sql = `${cuerpo} LIMIT ${c.limite}${sql.slice(c.nivel)}`
  }
  return sql
}

/** El texto sin lo que va dentro de paréntesis, para mirar solo lo que hay en este nivel. */
function quitarParentesis(s: string): string {
  let fuera = ''
  let hondo = 0
  for (const c of s) {
    if (c === '(') hondo++
    else if (c === ')') hondo--
    else if (hondo === 0) fuera += c
  }
  return fuera
}

/** El SQL de Oracle del SEP, traducido a PostgreSQL. */
export function aPostgres(sql: string): string {
  return rownumALimite(traducirFunciones(enCodigo(sql, traducir)))
}

/**
 * Lo de Oracle que sigue sin equivalente y hay que resolver a mano. Vacío significa que la consulta ya es portable.
 *
 * Mira el SQL **ya traducido**, no el original: así no hay que repetir en cada patrón la forma exacta que el
 * traductor sí resuelve. `NLSSORT` con la máscara que ignora tildes desaparece y solo se avisa de las demás;
 * `TO_CHAR` de un argumento desaparece y solo queda el que lleva formato. Con la lista escrita a mano, cada regla
 * nueva del traductor obligaba a afinar su patrón, y olvidarlo llenaba el inventario de avisos falsos.
 */
export function restosDeOracle(sql: string): string[] {
  const codigo = partir(aPostgres(sql))
    .filter((t) => t.codigo)
    .map((t) => t.texto)
    .join(' ')
  const encontrados = new Set<string>()
  const buscar: [RegExp, string][] = [
    [/\bROWNUM\b/i, 'ROWNUM (en PostgreSQL es LIMIT / OFFSET, o una función de ventana)'],
    [/\bCONNECT\s+BY\b/i, 'CONNECT BY (en PostgreSQL es WITH RECURSIVE)'],
    [/\bNVL2\s*\(/i, 'NVL2 (no existe: CASE WHEN ... IS NOT NULL)'],
    [/\bDECODE\s*\(/i, 'DECODE (no existe: CASE)'],
    [/\bLISTAGG\s*\(/i, 'LISTAGG (en PostgreSQL es STRING_AGG)'],
    [/\bDBMS_LOB\b/i, 'DBMS_LOB distinto de GETLENGTH y SUBSTR, que ya se traducen'],
    [/\bRETURNING\b[\s\S]*\bINTO\b/i, 'RETURNING ... INTO (en PostgreSQL el RETURNING devuelve filas, sin bind de salida)'],
    [/\bMINUS\b/i, 'MINUS (en PostgreSQL es EXCEPT)'],
    [/\bTO_CHAR\s*\(/i, 'TO_CHAR con formato (el de un argumento ya se traduce; los formatos de fecha no coinciden del todo)'],
    [/\bTO_DATE\s*\(/i, 'TO_DATE (existe, pero los formatos de fecha no coinciden del todo)'],
    [/\(\+\)/, 'unión externa con (+) (en PostgreSQL es LEFT JOIN)'],
    // lo que sí se traduce, pero solo en la forma que usa el SEP: cualquier otra tiene que verse
    [/\bNLSSORT\s*\(/i, 'NLSSORT con una máscara que no acaba en _AI (solo se traduce la que ignora tildes)'],
    [/\bINSTR\s*\(/i, 'INSTR con posición u ocurrencia (solo se traduce el de dos argumentos)'],
    [/\bTRUNC\s*\(/i, 'TRUNC con segundo argumento (el de uno se traduce como fecha, a date_trunc)'],
    [/\bMONTHS_BETWEEN\s*\(/i, 'MONTHS_BETWEEN con un número de argumentos que no es dos'],
    // existen en los dos motores pero no significan lo mismo
    [/\b(GREATEST|LEAST)\s*\(/i, 'GREATEST/LEAST (en Oracle un NULL manda y devuelve NULL; en PostgreSQL se ignora)'],
  ]
  for (const [re, aviso] of buscar) if (re.test(codigo)) encontrados.add(aviso)
  return [...encontrados]
}

/**
 * Los identificadores que el SQL escribe entre comillas dobles, que son los únicos cuya forma respeta PostgreSQL.
 *
 * Hace falta para devolver las filas con los nombres de columna que espera la app. PostgreSQL pliega a minúscula todo
 * lo que no va entrecomillado, así que `SELECT P.PERSONAID` vuelve como `personaid` y un `r['PERSONAID']` da
 * `undefined` —sin error, sin fila, sin rastro—, mientras que Oracle lo devuelve en MAYÚSCULA. Pasar todo a mayúscula
 * a ciegas rompería los alias que el SEP sí escribe entre comillas y en minúscula, como `AS "aprobaciones"`, así que
 * la lista de citados dice cuáles hay que dejar en paz.
 */
export function identificadoresCitados(sql: string): Set<string> {
  const citados = new Set<string>()
  for (const t of partir(sql)) {
    if (t.codigo || t.texto[0] !== '"') continue
    // quita las comillas de los extremos y deshace las dobles de dentro
    citados.add(t.texto.slice(1, -1).split('""').join('"'))
  }
  return citados
}
