import ExcelJS from 'exceljs'
import { RetroReporteService } from './retro-reporte.service'

// Ciclo de juguete: 3 personas, todas se evalúan entre sí menos un par.
const PARTICIPANTES = [
  { participacionId: 10, nombre: 'Ana Gómez',   email: 'ana@sena.edu.co',   rol: 'EVALUADOR', area: 'Técnica' },
  { participacionId: 20, nombre: 'Beto Ruiz',   email: 'beto@sena.edu.co',  rol: 'ANALISTA',  area: 'Técnica' },
  { participacionId: 30, nombre: 'Caro Díaz',   email: 'caro@sena.edu.co',  rol: 'EVALUADOR', area: 'Técnica' },
]

const PREGUNTAS = [
  { numero: 1, texto: '¿Cumplió los tiempos?',  criterios: 'Responsabilidad', tipo: 'ESCALA' },
  { numero: 2, texto: '¿Dominio técnico?',      criterios: 'Conocimiento',    tipo: 'ESCALA' },
  { numero: 11, texto: '¿Recomendaciones?',     criterios: null,              tipo: 'TEXTO_POR_PERSONA' },
  { numero: 12, texto: '¿Mejoras al proceso?',  criterios: null,              tipo: 'TEXTO_GENERAL' },
]

const ASIGNACIONES = [
  { evaluadorId: 10, evaluadoId: 20, estado: 'ENVIADA',   origen: 'AUTOMATICA', motivo: 'evaluador→analista',
    evaluadorNombre: 'Ana Gómez', evaluadorRol: 'EVALUADOR', evaluadorArea: 'Técnica',
    evaluadoNombre: 'Beto Ruiz', evaluadoRol: 'ANALISTA' },
  { evaluadorId: 30, evaluadoId: 20, estado: 'ENVIADA',   origen: 'AUTOMATICA', motivo: 'evaluador→analista',
    evaluadorNombre: 'Caro Díaz', evaluadorRol: 'EVALUADOR', evaluadorArea: 'Técnica',
    evaluadoNombre: 'Beto Ruiz', evaluadoRol: 'ANALISTA' },
  { evaluadorId: 20, evaluadoId: 10, estado: 'PENDIENTE', origen: 'AUTOMATICA', motivo: 'analista→evaluador',
    evaluadorNombre: 'Beto Ruiz', evaluadorRol: 'ANALISTA', evaluadorArea: 'Técnica',
    evaluadoNombre: 'Ana Gómez', evaluadoRol: 'EVALUADOR' },
  { evaluadorId: 20, evaluadoId: 30, estado: 'ANULADA',   origen: 'MANUAL', motivo: 'se retiró',
    evaluadorNombre: 'Beto Ruiz', evaluadorRol: 'ANALISTA', evaluadorArea: 'Técnica',
    evaluadoNombre: 'Caro Díaz', evaluadoRol: 'EVALUADOR' },
]

const RESPUESTAS = [
  { respuestaId: 100, evaluadorId: 10, evaluadoId: 20, puntaje: 9, maximo: 10, promedio: 4.5,
    fechaEnvio: new Date('2026-03-10T15:00:00Z'),
    evaluadorNombre: 'Ana Gómez', evaluadoNombre: 'Beto Ruiz', evaluadoRol: 'ANALISTA' },
  { respuestaId: 200, evaluadorId: 30, evaluadoId: 20, puntaje: 7, maximo: 10, promedio: 3.5,
    fechaEnvio: new Date('2026-03-11T15:00:00Z'),
    evaluadorNombre: 'Caro Díaz', evaluadoNombre: 'Beto Ruiz', evaluadoRol: 'ANALISTA' },
]

const ITEMS = [
  { respuestaId: 100, evaluadoId: 20, preguntaNumero: 1, calificacion: 5, comentario: null },
  { respuestaId: 100, evaluadoId: 20, preguntaNumero: 2, calificacion: 4, comentario: null },
  { respuestaId: 100, evaluadoId: 20, preguntaNumero: 11, calificacion: null, comentario: 'Muy buen trabajo' },
  { respuestaId: 200, evaluadoId: 20, preguntaNumero: 1, calificacion: 4, comentario: null },
  { respuestaId: 200, evaluadoId: 20, preguntaNumero: 2, calificacion: 3, comentario: null },
]

const SUGERENCIAS = [
  { texto: 'Más tiempo para la lectura de los proyectos', fecha: new Date('2026-03-11T16:00:00Z'),
    rol: 'ANALISTA', area: 'Técnica' },
]

const SESIONES = [
  { participacionId: 10, minutos: 45, seExcedio: 0 },
  { participacionId: 30, minutos: 82, seExcedio: 1 },
]

// enruta por palabra clave de la consulta: si alguien reescribe una query, el test falla a propósito
function dataSourceFalso() {
  return {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('EVALUADORCONVOCATORIA c')) {
        return [{ anio: 2026, nombre: 'FCE 2026', formularioId: 1, escalaMax: 5 }]
      }
      if (sql.includes('FROM RETROPREGUNTA')) return PREGUNTAS
      if (sql.includes('FROM RETROASIGNACION a')) return ASIGNACIONES
      if (sql.includes('FROM RETRORESPUESTA rr')) return RESPUESTAS
      if (sql.includes('FROM RETRORESPUESTAITEM i')) return ITEMS
      if (sql.includes('FROM RETROSUGERENCIA s')) return SUGERENCIAS
      if (sql.includes('FROM RETROSESION s')) return SESIONES
      if (sql.includes('FROM EVALUADORPARTICIPACION pa')) return PARTICIPANTES
      throw new Error('Consulta no prevista en el fixture:\n' + sql.slice(0, 120))
    }),
  }
}

describe('RetroReporteService', () => {
  let wb: ExcelJS.Workbook
  let nombreArchivo: string

  beforeAll(async () => {
    const service = new RetroReporteService(dataSourceFalso() as never)
    const { buffer, nombre } = await service.generar(1)
    nombreArchivo = nombre
    wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  })

  const valor = (hoja: string, fila: number, col: number) =>
    wb.getWorksheet(hoja)!.getRow(fila).getCell(col).value

  it('genera las 7 hojas en el orden esperado', () => {
    expect(wb.worksheets.map(w => w.name)).toEqual([
      '1. Distribución', '2. Consolidado', '3. Detalle por par',
      '4. Comentarios', '5. Sugerencias', '6. Progreso y tiempos', '7. Matriz cruzada',
    ])
  })

  it('nombra el archivo con el año y el ciclo', () => {
    expect(nombreArchivo).toBe('Retroalimentacion_2026_FCE_2026.xlsx')
  })

  it('Distribución lista todas las asignaciones, incluidas las anuladas', () => {
    const s = wb.getWorksheet('1. Distribución')!
    expect(s.rowCount).toBe(1 + ASIGNACIONES.length)
    expect(valor('1. Distribución', 2, 1)).toBe('Ana Gómez')
    expect(valor('1. Distribución', 5, 6)).toBe('ANULADA')
  })

  it('Consolidado promedia por pregunta y deja las columnas alineadas', () => {
    // Columnas: 1 nombre, 2 rol, 3 área, 4 P1, 5 P2, 6 promedio, 7 recibidas.
    const s = wb.getWorksheet('2. Consolidado')!
    const filaBeto = s.getRow(3)
    expect(filaBeto.getCell(1).value).toBe('Beto Ruiz')
    expect(filaBeto.getCell(4).value).toBe(4.5)
    expect(filaBeto.getCell(5).value).toBe(3.5)
    expect(filaBeto.getCell(6).value).toBe(4)
    expect(filaBeto.getCell(7).value).toBe(2)
  })

  it('Consolidado deja vacías las personas sin retroalimentación recibida', () => {
    const s = wb.getWorksheet('2. Consolidado')!
    const filaAna = s.getRow(2)
    expect(filaAna.getCell(1).value).toBe('Ana Gómez')
    expect(filaAna.getCell(4).value ?? '').toBe('')
    expect(filaAna.getCell(7).value).toBe(0)
  })

  it('Consolidado incluye la leyenda de las preguntas al pie', () => {
    const textos: string[] = []
    wb.getWorksheet('2. Consolidado')!.eachRow(f => {
      const v = f.getCell(3).value
      if (typeof v === 'string') textos.push(v)
    })
    expect(textos).toContain('¿Cumplió los tiempos?')
  })

  it('Detalle por par muestra una fila por respuesta con sus notas', () => {
    const s = wb.getWorksheet('3. Detalle por par')!
    expect(s.rowCount).toBe(1 + RESPUESTAS.length)
    // 1 evaluador, 2 evaluado, 3 rol, 4 P1, 5 P2, 6 puntaje, 7 máximo, 8 promedio
    expect(valor('3. Detalle por par', 2, 4)).toBe(5)
    expect(valor('3. Detalle por par', 2, 5)).toBe(4)
    expect(valor('3. Detalle por par', 2, 6)).toBe(9)
    expect(valor('3. Detalle por par', 2, 8)).toBe(4.5)
  })

  it('Comentarios recoge solo los ítems con texto', () => {
    const s = wb.getWorksheet('4. Comentarios')!
    expect(s.rowCount).toBe(2)
    expect(valor('4. Comentarios', 2, 1)).toBe('Beto Ruiz')
    expect(valor('4. Comentarios', 2, 3)).toBe('Ana Gómez')
    expect(valor('4. Comentarios', 2, 4)).toBe('Muy buen trabajo')
  })

  it('Sugerencias no expone el nombre de quien las escribió', () => {
    const s = wb.getWorksheet('5. Sugerencias')!
    expect(valor('5. Sugerencias', 2, 1)).toBe('ANALISTA · Técnica')
    expect(valor('5. Sugerencias', 2, 3)).toBe('Más tiempo para la lectura de los proyectos')
    const plano = JSON.stringify(s.getSheetValues())
    for (const p of PARTICIPANTES) expect(plano).not.toContain(p.nombre)
  })

  it('Progreso descuenta las anuladas y marca el exceso de tiempo', () => {
    const s = wb.getWorksheet('6. Progreso y tiempos')!
    const filas = new Map<string, ExcelJS.Row>()
    s.eachRow((f, n) => { if (n > 1) filas.set(String(f.getCell(1).value), f) })

    const beto = filas.get('Beto Ruiz')!
    expect(beto.getCell(5).value).toBe(1)   // asignadas
    expect(beto.getCell(6).value).toBe(0)   // enviadas
    expect(beto.getCell(8).value).toBe('0%')

    const caro = filas.get('Caro Díaz')!
    expect(caro.getCell(9).value).toBe(82)  // minutos
    expect(caro.getCell(10).value).toBe('SÍ')

    const ana = filas.get('Ana Gómez')!
    expect(ana.getCell(10).value ?? '').toBe('')
  })

  it('Matriz cruzada cruza a todos contra todos con la diagonal marcada', () => {
    const s = wb.getWorksheet('7. Matriz cruzada')!
    expect(s.rowCount).toBe(1 + PARTICIPANTES.length)
    expect(s.getRow(1).getCell(1).value).toBe('Evaluador \\ Evaluado')
    // Fila 2 = Ana; columna 3 = Beto (col 1 es la etiqueta).
    expect(s.getRow(2).getCell(3).value).toBe(4.5)
    expect(s.getRow(2).getCell(2).value).toBe('—')
    // Ana no evaluó a Caro: celda vacía, no cero.
    expect(s.getRow(2).getCell(4).value ?? '').toBe('')
  })

  it('colorea el promedio según qué tan cerca esté del máximo', () => {
    const s = wb.getWorksheet('2. Consolidado')!
    const celda = s.getRow(3).getCell(6)      // promedio de Beto = 4 sobre 5
    const fill = celda.fill as ExcelJS.FillPattern
    expect(fill?.fgColor?.argb).toBeDefined()
    // 4/5 = 80 % → banda amarilla, no la verde de ≥ 90 %.
    expect(fill.fgColor!.argb).toBe('FFFFF4CC')
  })
})
