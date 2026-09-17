import type { DataSource } from 'typeorm'
import { reiniciarTriggersDeId } from '../common/db/ids'
import { PlataformasVirtualesService } from './plataformas-virtuales.service'

// DataSource falso: guarda cada SQL; el RETURNING responde el id dado y el MAX+1 el número dado
function falso(respuestas: { id?: number; max?: number } = {}) {
  const llamadas: { sql: string; params?: unknown[] }[] = []
  const ds = {
    query: (sql: string, params?: unknown[]) => {
      llamadas.push({ sql, params })
      if (sql.includes('RETURNING')) return Promise.resolve([[respuestas.id ?? 24]])
      if (sql.includes('COALESCE(MAX(')) return Promise.resolve([{ nid: respuestas.max ?? 24 }])
      return Promise.resolve([])
    },
  } as unknown as DataSource
  return { servicio: new PlataformasVirtualesService(ds), llamadas }
}

// separa por las comas de primer nivel: las de TO_DATE(...) y CAST(...) no cuentan
function partes(lista: string): string[] {
  const salida: string[] = []
  let nivel = 0
  let actual = ''
  for (const ch of lista) {
    if (ch === '(') nivel++
    if (ch === ')') nivel--
    if (ch === ',' && nivel === 0) {
      salida.push(actual.trim())
      actual = ''
    } else actual += ch
  }
  salida.push(actual.trim())
  return salida
}

/** columna -> expresión del VALUES */
function columnas(sql: string): Map<string, string> {
  const m = /INSERT INTO \w+\s*\(([^)]*)\)\s*VALUES\s*\(([\s\S]*)\)\s*RETURNING/.exec(sql)
  if (!m) throw new Error(`no es un INSERT ... RETURNING: ${sql}`)
  const cols = partes(m[1])
  const vals = partes(m[2])
  expect(vals).toHaveLength(cols.length)
  return new Map(cols.map((c, i) => [c, vals[i]]))
}

// las 44 columnas de PLATAFORMASVIRTUALES son NOT NULL en el XE y en el Exadata (ALL_TAB_COLUMNS)
const P = 'PLATAFORMASVIRTUALES'
const CRITERIOS = [
  'RENDI', 'COMTEC', 'DISPO', 'INTHERRA', 'IA', 'REDIGI', 'REDIDA', 'FORVIR', 'SESINC', 'FORHIB', 'PAT', 'DISATE',
  'GESAF', 'GESGRU', 'GESUSU', 'ASIGUSU', 'GESPER', 'GESADM', 'GESCAP', 'GESBEN', 'GESINTER', 'GESSENA',
  'GESSESSINC', 'REPEXCEL',
].map((c) => P + c)
const TODAS = [
  `${P}ID`, 'PROYECTOID', `${P}FECHAREMI`, `${P}RADINTER`, `${P}RADRESINTE`, `${P}FECRADRES`, `${P}RADSENA`,
  `${P}NISSENA`, `${P}FECRADSENA`, `${P}LINK`, `${P}USUARIO`, `${P}CLAVE`, `${P}ESTADO`, `${P}FECHAREG`,
  `${P}USUREGISTR`, `${P}OBSERVACIO`, `${P}USUSENA`, `${P}OBSSENA`, `${P}VALSENA`, `${P}FECHACON`, ...CRITERIOS,
]

const AHORA = 'CAST((now() AT TIME ZONE \'UTC\') AS timestamp)'
const horaLocal = /SYSDATE|(?<!SYS_EXTRACT_UTC\()SYSTIMESTAMP/
const dto = { fechaRemi: '2026-09-01', link: ' https://aula.prueba.co ', usuario: 'interventor', clave: 'x1' }

describe('PlataformasVirtualesService.crear', () => {
  afterEach(() => reiniciarTriggersDeId())

  it('llena las 44 columnas NOT NULL, con FECHACON en UTC y los criterios de GeneXus en 0', async () => {
    reiniciarTriggersDeId(new Map([[P, `${P}ID`]]))
    const { servicio, llamadas } = falso({ id: 24 })

    const r = await servicio.crear(3050, dto)

    expect(r).toEqual({ mensaje: 'Plataforma virtual registrada correctamente.', id: 24 })
    expect(llamadas).toHaveLength(1)
    const { sql, params } = llamadas[0]
    const c = columnas(sql)
    expect([...c.keys()].sort()).toEqual([...TODAS].sort())
    expect(c.get(`${P}ID`)).toBe(':1')
    expect(c.get(`${P}FECHAREMI`)).toBe("TO_DATE(:3, 'YYYY-MM-DD')")
    expect(c.get(`${P}FECHACON`)).toBe(AHORA)
    expect(c.get(`${P}FECHAREG`)).toBe(AHORA)
    expect(c.get(`${P}FECRADRES`)).toBe(AHORA)
    expect(c.get(`${P}FECRADSENA`)).toBe(AHORA)
    for (const k of CRITERIOS) expect(c.get(k)).toBe('0')
    expect(sql).toContain(`RETURNING ${P}ID INTO $7`)
    expect(params?.slice(0, 6)).toEqual([null, 3050, '2026-09-01', 'https://aula.prueba.co', 'interventor', 'x1'])
    expect(params?.[6]).toMatchObject({ dir: expect.any(Number) })
    expect(horaLocal.test(sql)).toBe(false)
  })

  it('sin trigger vuelve al MAX+1 de antes, pero responde el id que quedó en la fila', async () => {
    reiniciarTriggersDeId(new Map())
    const { servicio, llamadas } = falso({ id: 1, max: 1 })

    const r = await servicio.crear(3050, dto)

    expect(r.id).toBe(1)
    expect(llamadas[0].sql).toContain(`SELECT COALESCE(MAX(${P}ID), 0) + 1`)
    expect(llamadas[1].params?.[0]).toBe(1)
  })
})
