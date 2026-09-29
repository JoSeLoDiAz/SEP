import { aPostgres, restosDeOracle } from './postgres-sql'

describe('aPostgres: parámetros', () => {
  it('cambia los posicionales de Oracle por los de PostgreSQL', () => {
    expect(aPostgres('SELECT A FROM T WHERE B = :1 AND C = :2')).toBe('SELECT A FROM T WHERE B = $1 AND C = $2')
  })

  it('no confunde el operador de conversión :: con un parámetro', () => {
    expect(aPostgres('SELECT ID::text FROM T WHERE ID = :1')).toBe('SELECT ID::text FROM T WHERE ID = $1')
  })

  it('numera bien más allá de nueve', () => {
    expect(aPostgres('VALUES (:9, :10, :11)')).toBe('VALUES ($9, $10, $11)')
  })
})

describe('aPostgres: lo que va entre comillas no se toca', () => {
  it('deja una hora dentro de un literal', () => {
    expect(aPostgres("SELECT '12:30' FROM T WHERE A = :1")).toBe("SELECT '12:30' FROM T WHERE A = $1")
  })

  it('deja el nombre de una función dentro de un literal', () => {
    expect(aPostgres("UPDATE T SET NOTA = 'usa NVL(x, 0)' WHERE ID = :1"))
      .toBe("UPDATE T SET NOTA = 'usa NVL(x, 0)' WHERE ID = $1")
  })

  it('entiende la comilla escrita dos veces dentro del literal', () => {
    expect(aPostgres("SELECT 'o''clock :1' , NVL(A, 0) FROM T")).toBe("SELECT 'o''clock :1' , COALESCE(A, 0) FROM T")
  })

  it('no traduce dentro de un comentario', () => {
    expect(aPostgres('-- ojo con NVL y :1\nSELECT NVL(A, 0) FROM T')).toBe('-- ojo con NVL y :1\nSELECT COALESCE(A, 0) FROM T')
  })

  it('deja en paz un identificador entre comillas dobles', () => {
    expect(aPostgres('SELECT A AS "NVL(raro)" FROM T')).toBe('SELECT A AS "NVL(raro)" FROM T')
  })
})

describe('aPostgres: funciones', () => {
  it('NVL pasa a COALESCE, en cualquier caja', () => {
    expect(aPostgres('SELECT nvl(A, 0), NVL(B, 1) FROM T')).toBe('SELECT COALESCE(A, 0), COALESCE(B, 1) FROM T')
  })

  it('la hora UTC del SEP se traduce', () => {
    expect(aPostgres('SELECT SYS_EXTRACT_UTC(SYSTIMESTAMP) FROM T')).toBe("SELECT (now() AT TIME ZONE 'UTC') FROM T")
  })

  it('CAST de la hora UTC a fecha sigue siendo válido', () => {
    expect(aPostgres('SELECT CAST(SYS_EXTRACT_UTC(SYSTIMESTAMP) AS DATE) FROM T'))
      .toBe("SELECT CAST((now() AT TIME ZONE 'UTC') AS timestamp) FROM T")
  })

  it('quita FROM DUAL', () => {
    expect(aPostgres('SELECT 1 FROM DUAL').trim()).toBe('SELECT 1')
  })
})

describe('restosDeOracle: lo que hay que resolver a mano', () => {
  it('no señala nada en una consulta ya portable', () => {
    expect(restosDeOracle('SELECT A FROM T WHERE B = :1')).toEqual([])
  })

  it('ya no señala el ROWNUM que se traduce, y sí el que no', () => {
    expect(restosDeOracle('SELECT A FROM T WHERE ROWNUM <= 10')).toEqual([])
    // ROWNUM > n no es un tope: no tiene equivalente con LIMIT y tiene que verse
    expect(restosDeOracle('SELECT A FROM T WHERE ROWNUM > 5').join(' ')).toContain('ROWNUM')
  })

  it('señala el RETURNING con bind de salida', () => {
    expect(restosDeOracle('INSERT INTO T (A) VALUES (:1) RETURNING ID INTO :2').join(' ')).toContain('RETURNING')
  })

  it('señala DECODE y LISTAGG', () => {
    const r = restosDeOracle('SELECT DECODE(A, 1, 2), LISTAGG(B) FROM T').join(' ')
    expect(r).toContain('DECODE')
    expect(r).toContain('LISTAGG')
  })

  it('no señala lo que solo aparece dentro de un literal', () => {
    expect(restosDeOracle("SELECT 'ROWNUM' FROM T")).toEqual([])
  })

  it('traduce TO_CHAR de un argumento a ::text', () => {
    expect(aPostgres('SELECT TO_CHAR(P.PERSONAIDENTIFICACION) FROM PERSONA P'))
      .toBe('SELECT (P.PERSONAIDENTIFICACION)::text FROM PERSONA P')
  })

  it('deja intacto el TO_CHAR que lleva formato', () => {
    const sql = "SELECT TO_CHAR(F.FECHA, 'DD/MM/YYYY') FROM T F"
    expect(aPostgres(sql)).toBe(sql)
  })

  it('traduce el TO_CHAR que envuelve otra función con comas', () => {
    expect(aPostgres('SELECT TRIM(TO_CHAR(NVL(A.B, A.C))) FROM T A'))
      .toBe('SELECT btrim(((COALESCE(A.B, A.C))::text)::text) FROM T A')
  })

  it('no toca el TO_CHAR que vive dentro de un literal', () => {
    const sql = "SELECT 'TO_CHAR(X)' FROM T"
    expect(aPostgres(sql)).toBe(sql)
  })

  it('traduce el filtro de certificados tal como lo escribe el servicio', () => {
    const sql = "WHERE TRIM(TO_CHAR(AFGB.CERTIFICA)) = 'SI'"
    expect(aPostgres(sql)).toBe("WHERE btrim(((AFGB.CERTIFICA)::text)::text) = 'SI'")
  })

  it('ya no señala el TO_CHAR de un argumento, que se traduce solo', () => {
    expect(restosDeOracle('SELECT TO_CHAR(A) FROM T')).toEqual([])
  })

  it('sigue señalando el TO_CHAR con formato', () => {
    expect(restosDeOracle("SELECT TO_CHAR(A, 'YYYY') FROM T").join(' ')).toContain('TO_CHAR')
  })

  it('DBMS_LOB.GETLENGTH pasa a length', () => {
    expect(aPostgres('SELECT DBMS_LOB.GETLENGTH(e.EVALUADORFOTO) AS L FROM EVALUADOR e'))
      .toBe('SELECT length(e.EVALUADORFOTO) AS L FROM EVALUADOR e')
  })

  it('DBMS_LOB.SUBSTR invierte la cantidad y la posición, que Oracle pone al revés', () => {
    expect(aPostgres('SELECT DBMS_LOB.SUBSTR(r.RUBRODESCRIPCION, 2000, 1) FROM RUBRO r'))
      .toBe('SELECT substr(r.RUBRODESCRIPCION, 1, 2000) FROM RUBRO r')
  })

  it('DBMS_LOB.SUBSTR sin posición empieza por el primer carácter', () => {
    expect(aPostgres('SELECT DBMS_LOB.SUBSTR(A, 100) FROM T')).toBe('SELECT substr(A, 1, 100) FROM T')
  })

  it('traduce el GETLENGTH que va dentro de un NVL, como lo escribe el banco de evaluadores', () => {
    expect(aPostgres('WHERE NVL(DBMS_LOB.GETLENGTH(e.EVALUADORFOTO), 0) > 0'))
      .toBe('WHERE COALESCE(length(e.EVALUADORFOTO), 0) > 0')
  })

  it('traduce una llamada dentro de otra', () => {
    expect(aPostgres('SELECT TO_CHAR(DBMS_LOB.SUBSTR(A, 10, 1)) FROM T'))
      .toBe('SELECT (substr(A, 1, 10))::text FROM T')
  })

  it('ya no señala GETLENGTH ni SUBSTR, pero sí el resto de DBMS_LOB', () => {
    expect(restosDeOracle('SELECT DBMS_LOB.GETLENGTH(A), DBMS_LOB.SUBSTR(B,10,1) FROM T')).toEqual([])
    expect(restosDeOracle('SELECT DBMS_LOB.INSTR(A, 1) FROM T').join(' ')).toContain('DBMS_LOB')
  })

  it('TRIM convierte a texto: en Oracle valía sobre un número y en PostgreSQL no', () => {
    expect(aPostgres('SELECT TRIM(e.EMPRESAIDENTIFICACION) FROM EMPRESA e'))
      .toBe('SELECT btrim((e.EMPRESAIDENTIFICACION)::text) FROM EMPRESA e')
  })

  it('NLSSORT con máscara _AI ordena sin mayúsculas ni tildes', () => {
    const sql = "ORDER BY NLSSORT(TRIM(p.PERSONAPRIMERAPELLIDO), 'NLS_SORT=WEST_EUROPEAN_AI')"
    const r = aPostgres(sql)
    expect(r).toContain('translate(upper(btrim((p.PERSONAPRIMERAPELLIDO)::text))')
    expect(r).not.toContain('NLSSORT')
  })

  it('NLSSORT con otra máscara se deja y se señala', () => {
    const sql = "ORDER BY NLSSORT(A, 'NLS_SORT=BINARY')"
    expect(aPostgres(sql)).toContain('NLSSORT')
    expect(restosDeOracle(sql).join(' ')).toContain('NLSSORT')
  })

  it('INSTR de dos argumentos pasa a strpos', () => {
    expect(aPostgres('WHERE INSTR(A.B, $1) > 0')).toBe('WHERE strpos(A.B, $1) > 0')
  })

  it('TRUNC de un argumento es la fecha sin hora', () => {
    expect(aPostgres("TRUNC(SYS_EXTRACT_UTC(SYSTIMESTAMP))")).toBe("date_trunc('day', (now() AT TIME ZONE 'UTC'))")
  })

  it('MONTHS_BETWEEN pasa a una expresión con age', () => {
    const r = aPostgres('SELECT FLOOR(MONTHS_BETWEEN(A, B) / 12) FROM T')
    expect(r).toContain('age(A, B)')
    expect(r).not.toContain('MONTHS_BETWEEN')
  })

  it('ROWNUM = 1 al final del WHERE pasa a LIMIT 1', () => {
    expect(aPostgres('SELECT A FROM T WHERE B = :1 AND ROWNUM = 1'))
      .toBe('SELECT A FROM T WHERE B = $1 LIMIT 1')
  })

  it('ROWNUM como única condición se lleva el WHERE por delante', () => {
    expect(aPostgres('SELECT * FROM (SELECT A FROM T) WHERE ROWNUM = 1'))
      .toBe('SELECT * FROM (SELECT A FROM T) LIMIT 1')
  })

  it('ROWNUM <= :n conserva el parámetro', () => {
    expect(aPostgres('SELECT * FROM (SELECT A FROM T) WHERE ROWNUM <= :2'))
      .toBe('SELECT * FROM (SELECT A FROM T) LIMIT $2')
  })

  it('el LIMIT va DENTRO del paréntesis de la subconsulta, no al final', () => {
    const sql = 'SELECT (SELECT dp.ID FROM (SELECT ID FROM D ORDER BY F DESC) dp WHERE ROWNUM = 1) AS "docId" FROM P'
    const r = aPostgres(sql)
    expect(r).toBe('SELECT (SELECT dp.ID FROM (SELECT ID FROM D ORDER BY F DESC) dp LIMIT 1) AS "docId" FROM P')
    expect(r).not.toContain('ROWNUM')
  })

  it('con ORDER BY en el mismo nivel NO se traduce: en Oracle ROWNUM va antes de ordenar', () => {
    const sql = 'SELECT A FROM T WHERE B = :1 AND ROWNUM = 1 ORDER BY C'
    expect(aPostgres(sql)).toContain('ROWNUM')
    expect(restosDeOracle(sql).join(' ')).toContain('ROWNUM')
  })

  it('ROWNUM dentro de un literal no se toca', () => {
    expect(aPostgres("SELECT 'ROWNUM = 1' FROM T")).toBe("SELECT 'ROWNUM = 1' FROM T")
  })

  it('CAST AS DATE pasa a timestamp: el DATE de Oracle lleva hora y el de PostgreSQL no', () => {
    expect(aPostgres("CAST(SYS_EXTRACT_UTC(SYSTIMESTAMP) AS DATE)"))
      .toBe("CAST((now() AT TIME ZONE 'UTC') AS timestamp)")
  })

  it('un CAST a otro tipo se deja como está', () => {
    expect(aPostgres('CAST(A AS NUMBER)')).toBe('CAST(A AS NUMBER)')
  })

  // Este es el fallo que corrompio dos ficheros al traducir el codigo fuente: la subconsulta que sustituye a
  // ALL_TAB_COLUMNS acababa con ese mismo nombre como alias, asi que cada pasada la expandia dentro de si misma.
  it('traducir dos veces da lo mismo que traducir una', () => {
    const consultas = [
      'SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = :1',
      'SELECT NVL(DBMS_LOB.GETLENGTH(A), 0) FROM T WHERE ROWNUM = 1',
      "SELECT TRIM(A), TO_CHAR(B), NLSSORT(C, 'NLS_SORT=WEST_EUROPEAN_AI') FROM T",
      'SELECT CAST(SYS_EXTRACT_UTC(SYSTIMESTAMP) AS DATE) FROM DUAL',
      'SELECT INSTR(A, :1), TRUNC(B), MONTHS_BETWEEN(C, D) FROM T',
    ]
    for (const sql of consultas) {
      const una = aPostgres(sql)
      expect(aPostgres(una)).toBe(una)
    }
  })
})
