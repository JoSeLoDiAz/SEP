import ExcelJS from 'exceljs'
import { ReportesEvaluadorService } from './reportes.service'

/**
 * La sábana del banco tiene dos trampas silenciosas:
 *
 *   1. El listado de pantalla topa en 100 filas. Si la exportación no sube ese
 *      tope, sale un archivo de 100 filas que parece completo. Nadie lo nota.
 *   2. La hoja de ciclos concatena bloques de ids (límite de 1000 en el `IN`
 *      de Oracle), y cada bloque llega con su propio orden. Sin reordenar en
 *      memoria, la hoja queda mezclada solo cuando el banco pasa de 900.
 *
 * Ninguna de las dos revienta: producen un archivo válido y equivocado. Estas
 * pruebas leen el .xlsx celda por celda. No tocan Oracle.
 */

// Personas inventadas. Nunca datos de evaluadores reales: un fixture acaba
// en el repositorio y en el historial, y ahí no van cédulas ni nombres.
const EVALUADORES = [
  {
    evaluadorId: 7, personaId: 70, identificacion: '10000001',
    nombres: 'Marta Elena', primerApellido: 'Ríos', segundoApellido: 'Vargas',
    email: 'mrios@ejemplo.local', cargo: 'Instructor G20', profesion: 'Ingeniera',
    regionalNombre: 'Huila', activo: true, tieneFoto: true, tieneCedula: false,
    pruebaVigente: false, totalCiclos: 2, totalProyectos: 5, ultimoAnio: 2026,
    promedioRetro: 4.6, ciclos: [],
  },
  {
    evaluadorId: 9, personaId: 90, identificacion: '10000002',
    nombres: 'Diego Alberto', primerApellido: 'Naranjo', segundoApellido: null,
    email: 'dnaranjo@ejemplo.local', cargo: null, profesion: null,
    regionalNombre: null, activo: false, tieneFoto: false, tieneCedula: true,
    pruebaVigente: true, totalCiclos: 1, totalProyectos: 0, ultimoAnio: 2025,
    promedioRetro: null, ciclos: [],
  },
]

/** A propósito desordenado: el service debe ordenarlo por año descendente. */
const CICLOS = [
  {
    identificacion: '10000002', evaluador: 'DIEGO ALBERTO NARANJO', anio: 2025, periodo: null,
    rol: 'EVALUADOR', area: null, proceso: null, modalidad: null, mesa: null, equipo: null,
    estado: 'Finalizó la evaluación', proyectos: 0, retro: null, certificado: null,
  },
  {
    identificacion: '10000001', evaluador: 'MARTA ELENA RÍOS', anio: 2026, periodo: 'I',
    rol: 'ANALISTA', area: 'Técnica', proceso: 'FCE', modalidad: 'Virtual', mesa: 'Mesa 3',
    equipo: 'Equipo A', estado: 'Certificado', proyectos: 5, retro: 4.6, certificado: '2026-0012',
  },
  {
    identificacion: '10000001', evaluador: 'MARTA ELENA RÍOS', anio: 2024, periodo: 'II',
    rol: 'EVALUADOR', area: 'Técnica', proceso: 'FCE', modalidad: 'Presencial', mesa: null,
    equipo: null, estado: 'Finalizó la evaluación', proyectos: 0, retro: null, certificado: null,
  },
]

function dataSourceFalso() {
  return {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM EVALUADORPARTICIPACION pa')) {
        // El fixture no simula Oracle; lo que importa es qué WHERE y qué binds
        // se mandaron, y eso se comprueba leyendo `query.mock.calls`.
        void params
        return CICLOS
      }
      throw new Error('Consulta no prevista en el fixture:\n' + sql.slice(0, 160))
    }),
  }
}

/** Registra con qué argumentos se pidió el listado, que es la mitad del contrato. */
function evaluadoresFalso() {
  const llamadas: unknown[][] = []
  return {
    llamadas,
    servicio: {
      listar: jest.fn(async (...args: unknown[]) => {
        llamadas.push(args)
        return { items: EVALUADORES, total: EVALUADORES.length, page: 1, limit: 5000 }
      }),
    },
  }
}

describe('ReportesEvaluadorService — sábana del banco', () => {
  let wb: ExcelJS.Workbook
  let nombreArchivo: string
  let ds: ReturnType<typeof dataSourceFalso>
  let ev: ReturnType<typeof evaluadoresFalso>

  beforeAll(async () => {
    ds = dataSourceFalso()
    ev = evaluadoresFalso()
    const service = new ReportesEvaluadorService(ds as never, ev.servicio as never)
    const { buffer, nombre } = await service.sabanaBanco('', {})
    nombreArchivo = nombre
    wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  })

  const celda = (hoja: string, fila: number, col: number) =>
    wb.getWorksheet(hoja)!.getRow(fila).getCell(col).value

  it('sube el tope de página: la exportación no puede salir cortada en 100', () => {
    const [, page, limit, , topePagina] = ev.llamadas[0]
    expect(page).toBe(1)
    expect(limit).toBeGreaterThan(100)
    expect(topePagina).toBe(limit)
  })

  it('genera las dos hojas', () => {
    expect(wb.worksheets.map(w => w.name)).toEqual(['1. Evaluadores', '2. Ciclos'])
  })

  it('deja constancia de los filtros que produjeron el archivo', async () => {
    // Sin filtros: hay que decirlo, no dejar la celda ambigua.
    expect(String(celda('1. Evaluadores', 1, 1))).toContain('2 registro(s)')
    expect(String(celda('1. Evaluadores', 1, 1))).toContain('sin filtros')

    // Con filtros: deben quedar escritos, y el año va en el nombre del archivo.
    const otro = new ReportesEvaluadorService(dataSourceFalso() as never, evaluadoresFalso().servicio as never)
    const r = await otro.sabanaBanco('rios', { anio: 2026, sinCedula: true })
    const wb2 = new ExcelJS.Workbook()
    await wb2.xlsx.load(r.buffer as unknown as ArrayBuffer)
    const a1 = String(wb2.getWorksheet('1. Evaluadores')!.getCell('A1').value)
    expect(a1).toContain('"rios"')
    expect(a1).toContain('anio=2026')
    expect(a1).toContain('sinCedula=true')
    expect(r.nombre).toBe('Banco_evaluadores_2026.xlsx')
  })

  it('nombra el archivo sin sufijo cuando no se filtra por año', () => {
    expect(nombreArchivo).toBe('Banco_evaluadores.xlsx')
  })

  it('Evaluadores: una fila por persona, bajo el encabezado de la fila 3', () => {
    const s = wb.getWorksheet('1. Evaluadores')!
    expect(s.rowCount).toBe(3 + EVALUADORES.length)
    expect(celda('1. Evaluadores', 3, 1)).toBe('Identificación')
    expect(celda('1. Evaluadores', 3, 15)).toBe('Estado')
  })

  it('rotula el promedio como "ciclos válidos": excluye los estados negativos', () => {
    // La hoja 2 muestra el valor crudo de cada ciclo, incluidos los revocados.
    // Sin este rótulo, promediar la hoja 2 a mano no reproduce la hoja 1 y
    // parece un error de cálculo.
    expect(String(celda('1. Evaluadores', 3, 11))).toContain('ciclos válidos')
    expect(celda('2. Ciclos', 1, 13)).toBe('Retroalim. recibida')
  })

  it('avisa cuando el archivo salió truncado', async () => {
    const parcial = {
      listar: jest.fn(async () => ({
        items: EVALUADORES, total: 6200, page: 1, limit: 5000,
      })),
    }
    const r = await new ReportesEvaluadorService(dataSourceFalso() as never, parcial as never)
      .sabanaBanco('', {})
    const w = new ExcelJS.Workbook()
    await w.xlsx.load(r.buffer as unknown as ArrayBuffer)
    const a1 = String(w.getWorksheet('1. Evaluadores')!.getCell('A1').value)
    expect(a1).toContain('TRUNCADO')
    expect(a1).toContain(`${EVALUADORES.length} de 6200`)
  })

  it('no avisa de truncamiento cuando el archivo está completo', () => {
    expect(String(celda('1. Evaluadores', 1, 1))).not.toContain('TRUNCADO')
  })

  it('propaga los filtros de ciclo a la hoja 2, no solo a la selección de personas', async () => {
    // Sin esto, filtrar por 2026 traía a las personas que participaron en 2026
    // pero con TODOS sus años encima, y la tabla dinámica no cuadraba con la
    // cabecera de la hoja 1.
    const ds2 = dataSourceFalso()
    await new ReportesEvaluadorService(ds2 as never, evaluadoresFalso().servicio as never)
      .sabanaBanco('', { anio: 2026, estadoCodigo: 'FINALIZADO' })

    const [sql, params] = ds2.query.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('pa.ANIO =')
    expect(sql).toContain('es.CODIGO =')
    // Los ids del IN van primero y los del filtro después: con bind posicional
    // el orden ES el contrato, y numerarlos mal es un error mudo.
    expect(params).toEqual([...EVALUADORES.map(e => e.evaluadorId), 2026, 'FINALIZADO'])
    const ids = EVALUADORES.length
    expect(sql).toContain(`:${ids + 1}`)
    expect(sql).toContain(`:${ids + 2}`)
  })

  it('sin filtros de ciclo, la hoja 2 no añade condiciones ni binds de más', async () => {
    const ds2 = dataSourceFalso()
    await new ReportesEvaluadorService(ds2 as never, evaluadoresFalso().servicio as never)
      .sabanaBanco('', {})
    const [sql, params] = ds2.query.mock.calls[0] as [string, unknown[]]
    expect(sql).not.toContain('pa.ANIO =')
    expect(params).toEqual(EVALUADORES.map(e => e.evaluadorId))
  })

  it('Evaluadores: junta los dos apellidos y no imprime "null" cuando falta el segundo', () => {
    expect(celda('1. Evaluadores', 4, 3)).toBe('Ríos Vargas')
    expect(celda('1. Evaluadores', 5, 3)).toBe('Naranjo')
  })

  it('Evaluadores: los campos vacíos salen en blanco, nunca como "null"', () => {
    // El segundo no tiene cargo, ni profesión, ni regional, ni promedio.
    for (const col of [5, 6, 7, 11]) {
      expect(celda('1. Evaluadores', 5, col)).toBe('')
    }
  })

  it('Evaluadores: traduce los booleanos a Sí/NO y marca en rojo lo que falta', () => {
    const s = wb.getWorksheet('1. Evaluadores')!
    // El primero: sin cédula, con foto, sin prueba vigente.
    expect(celda('1. Evaluadores', 4, 12)).toBe('NO')
    expect(celda('1. Evaluadores', 4, 13)).toBe('Sí')
    expect(celda('1. Evaluadores', 4, 14)).toBe('NO')

    const relleno = (f: number, c: number) =>
      (s.getRow(f).getCell(c).fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb
    expect(relleno(4, 12)).toBe('FFFFD6D6')  // sin cédula → resaltado
    expect(relleno(4, 13)).toBeUndefined()   // con foto  → limpio
    expect(relleno(4, 14)).toBe('FFFFD6D6')  // sin prueba vigente → resaltado
  })

  it('Evaluadores: distingue al inactivo', () => {
    expect(celda('1. Evaluadores', 4, 15)).toBe('Activo')
    expect(celda('1. Evaluadores', 5, 15)).toBe('Inactivo')
    expect(wb.getWorksheet('1. Evaluadores')!.getRow(5).font?.italic).toBe(true)
  })

  it('Ciclos: ordena por año descendente aunque la consulta llegue desordenada', () => {
    const s = wb.getWorksheet('2. Ciclos')!
    expect(s.rowCount).toBe(1 + CICLOS.length)
    expect([2, 3, 4].map(f => celda('2. Ciclos', f, 3))).toEqual([2026, 2025, 2024])
  })

  it('Ciclos: el año es número, para que la tabla dinámica pueda agrupar', () => {
    expect(typeof celda('2. Ciclos', 2, 3)).toBe('number')
    expect(typeof celda('2. Ciclos', 2, 12)).toBe('number')
  })

  it('Ciclos: arrastra rol, mesa, estado, proyectos, retro y certificado', () => {
    expect(celda('2. Ciclos', 2, 5)).toBe('ANALISTA')
    expect(celda('2. Ciclos', 2, 9)).toBe('Mesa 3')
    expect(celda('2. Ciclos', 2, 11)).toBe('Certificado')
    expect(celda('2. Ciclos', 2, 12)).toBe(5)
    expect(celda('2. Ciclos', 2, 13)).toBe(4.6)
    expect(celda('2. Ciclos', 2, 14)).toBe('2026-0012')
  })

  it('Ciclos: sin certificado ni retro deja la celda vacía, no un 0 engañoso', () => {
    expect(celda('2. Ciclos', 3, 13)).toBe('')
    expect(celda('2. Ciclos', 3, 14)).toBe('')
    expect(celda('2. Ciclos', 3, 12)).toBe(0)   // proyectos sí es un 0 real
  })

  it('la suma de "Ciclos" de la hoja 1 debe cuadrar con las filas de la hoja 2', () => {
    const suma = EVALUADORES.reduce((t, e) => t + e.totalCiclos, 0)
    expect(wb.getWorksheet('2. Ciclos')!.rowCount - 1).toBe(suma)
  })

  it('con el banco vacío genera un archivo legible en vez de reventar', async () => {
    const vacio = {
      listar: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 5000 })),
    }
    const service = new ReportesEvaluadorService(dataSourceFalso() as never, vacio as never)
    const { buffer } = await service.sabanaBanco('nadie', {})
    const w = new ExcelJS.Workbook()
    await w.xlsx.load(buffer as unknown as ArrayBuffer)

    expect(w.getWorksheet('1. Evaluadores')!.rowCount).toBe(3)          // solo encabezados
    expect(String(w.getWorksheet('1. Evaluadores')!.getCell('A1').value)).toContain('0 registro(s)')
    expect(String(w.getWorksheet('2. Ciclos')!.getRow(2).getCell(1).value)).toContain('Sin evaluadores')
  })

  it('no consulta ciclos cuando no hay evaluadores: sería un IN () inválido', async () => {
    const ds2 = dataSourceFalso()
    const vacio = { listar: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 5000 })) }
    await new ReportesEvaluadorService(ds2 as never, vacio as never).sabanaBanco('', {})
    expect(ds2.query).not.toHaveBeenCalled()
  })
})
