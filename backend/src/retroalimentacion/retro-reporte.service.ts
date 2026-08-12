import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import ExcelJS from 'exceljs'

// reporte excel de la retroalimentación de un ciclo: 7 hojas, orden fijo.

const NAVY = 'FF00304D'
const VERDE = 'FF39A900'
const GRIS = 'FFF2F2F2'
const BLANCO = 'FFFFFFFF'

// verde → amarillo → rojo según cercanía al máximo de la escala.
function colorPromedio(valor: number | null, max: number): string | null {
  if (valor == null) return null
  const pct = valor / max
  if (pct >= 0.9) return 'FFD6F5E3'
  if (pct >= 0.75) return 'FFFFF4CC'
  if (pct >= 0.6) return 'FFFFE0CC'
  return 'FFFFD6D6'
}

@Injectable()
export class RetroReporteService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async generar(convocatoriaId: number): Promise<{ buffer: Buffer; nombre: string }> {
    const cab: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT c.ANIO AS "anio", TRIM(c.NOMBRE) AS "nombre",
              f.RETROFORMULARIOID AS "formularioId", f.ESCALAMAX AS "escalaMax"
         FROM EVALUADORCONVOCATORIA c
         LEFT JOIN RETROFORMULARIO f ON f.CONVOCATORIAID = c.CONVOCATORIAID AND f.ACTIVO = 1
        WHERE c.CONVOCATORIAID = :1`,
      [convocatoriaId],
    )
    if (!cab[0]) throw new NotFoundException('Convocatoria no encontrada')
    if (cab[0].formularioId == null) {
      throw new NotFoundException('Esta convocatoria todavía no tiene instrumento de retroalimentación')
    }

    const escalaMax = Number(cab[0].escalaMax ?? 5)
    const [participantes, preguntas, asignaciones, respuestas, items, sugerencias, sesiones] =
      await Promise.all([
        this.participantes(convocatoriaId),
        this.preguntas(Number(cab[0].formularioId)),
        this.asignaciones(convocatoriaId),
        this.respuestas(convocatoriaId),
        this.items(convocatoriaId),
        this.sugerencias(convocatoriaId),
        this.sesiones(convocatoriaId),
      ])

    const wb = new ExcelJS.Workbook()
    wb.creator = 'SEP — Banco de Evaluadores'
    wb.created = new Date()

    this.hojaDistribucion(wb, asignaciones)
    this.hojaConsolidado(wb, participantes, preguntas, items, escalaMax)
    this.hojaDetallePar(wb, respuestas, preguntas, items)
    this.hojaComentarios(wb, respuestas, items)
    this.hojaSugerencias(wb, sugerencias)
    this.hojaProgreso(wb, participantes, asignaciones, sesiones)
    this.hojaMatrizCruzada(wb, participantes, respuestas, escalaMax)

    const buffer = Buffer.from(await wb.xlsx.writeBuffer())
    const nombre = `Retroalimentacion_${cab[0].anio}_${String(cab[0].nombre ?? '')
      .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'ciclo'}.xlsx`
    return { buffer, nombre }
  }

  // hojas

  private hojaDistribucion(wb: ExcelJS.Workbook, asignaciones: Asignacion[]) {
    const s = wb.addWorksheet('1. Distribución', { views: [{ state: 'frozen', ySplit: 1 }] })
    this.encabezado(s, [
      ['Evaluador', 30], ['Rol evaluador', 20], ['Área', 14],
      ['Evaluado', 30], ['Rol evaluado', 20],
      ['Estado', 14], ['Origen', 12], ['Regla', 34],
    ])
    for (const a of asignaciones) {
      const fila = s.addRow([
        a.evaluadorNombre, a.evaluadorRol, a.evaluadorArea,
        a.evaluadoNombre, a.evaluadoRol,
        a.estado, a.origen, a.motivo,
      ])
      if (a.estado === 'ENVIADA') {
        fila.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6F5E3' } }
      } else if (a.estado === 'ANULADA') {
        fila.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } }
        fila.font = { color: { argb: 'FF999999' }, italic: true }
      }
    }
    this.zebra(s, 8)
  }

  private hojaConsolidado(
    wb: ExcelJS.Workbook, participantes: Participante[], preguntas: Pregunta[],
    items: Item[], escalaMax: number,
  ) {
    const escalas = preguntas.filter(p => p.tipo === 'ESCALA')
    const s = wb.addWorksheet('2. Consolidado', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] })

    this.encabezado(s, [
      ['Persona evaluada', 32], ['Rol', 20], ['Área', 14],
      ...escalas.map(p => [`P${p.numero}`, 8] as [string, number]),
      ['Promedio', 11], ['Recibidas', 11],
    ])

    const acumulado = new Map<string, { suma: number; n: number }>()
    for (const i of items) {
      if (i.calificacion == null) continue
      const k = `${i.evaluadoId}::${i.preguntaNumero}`
      const acc = acumulado.get(k) ?? { suma: 0, n: 0 }
      acc.suma += i.calificacion; acc.n++
      acumulado.set(k, acc)
    }
    const recibidasPor = new Map<number, Set<number>>()
    for (const i of items) {
      if (!recibidasPor.has(i.evaluadoId)) recibidasPor.set(i.evaluadoId, new Set())
      recibidasPor.get(i.evaluadoId)!.add(i.respuestaId)
    }

    for (const p of participantes) {
      const valores: Array<number | null> = escalas.map(q => {
        const acc = acumulado.get(`${p.participacionId}::${q.numero}`)
        return acc && acc.n > 0 ? Math.round((acc.suma / acc.n) * 100) / 100 : null
      })
      const conDato = valores.filter((v): v is number => v != null)
      const promedio = conDato.length
        ? Math.round((conDato.reduce((a, b) => a + b, 0) / conDato.length) * 100) / 100
        : null

      const fila = s.addRow([
        p.nombre, p.rol ?? '', p.area ?? '',
        ...valores.map(v => v ?? ''),
        promedio ?? '', recibidasPor.get(p.participacionId)?.size ?? 0,
      ])

      valores.forEach((v, idx) => {
        const argb = colorPromedio(v, escalaMax)
        if (argb) fila.getCell(4 + idx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
      })
      const argbProm = colorPromedio(promedio, escalaMax)
      if (argbProm) {
        const celda = fila.getCell(4 + escalas.length)
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbProm } }
        celda.font = { bold: true }
      }
    }

    // leyenda al pie: en el encabezado P1..P10 no cabe el texto de la pregunta.
    s.addRow([])
    const titulo = s.addRow(['Preguntas de la escala'])
    titulo.font = { bold: true, color: { argb: NAVY } }
    for (const q of escalas) {
      s.addRow([`P${q.numero}`, q.criterios ?? '', q.texto])
    }
  }

  private hojaDetallePar(
    wb: ExcelJS.Workbook, respuestas: Respuesta[], preguntas: Pregunta[], items: Item[],
  ) {
    const escalas = preguntas.filter(p => p.tipo === 'ESCALA')
    const s = wb.addWorksheet('3. Detalle por par', { views: [{ state: 'frozen', ySplit: 1 }] })
    this.encabezado(s, [
      ['Evaluador', 30], ['Evaluado', 30], ['Rol evaluado', 20],
      ...escalas.map(p => [`P${p.numero}`, 7] as [string, number]),
      ['Puntaje', 10], ['Máximo', 10], ['Promedio', 10], ['Enviada', 18],
    ])

    const porRespuesta = new Map<number, Map<number, number>>()
    for (const i of items) {
      if (i.calificacion == null) continue
      if (!porRespuesta.has(i.respuestaId)) porRespuesta.set(i.respuestaId, new Map())
      porRespuesta.get(i.respuestaId)!.set(i.preguntaNumero, i.calificacion)
    }

    for (const r of respuestas) {
      const notas = porRespuesta.get(r.respuestaId) ?? new Map()
      s.addRow([
        r.evaluadorNombre, r.evaluadoNombre, r.evaluadoRol ?? '',
        ...escalas.map(q => notas.get(q.numero) ?? ''),
        r.puntaje, r.maximo, r.promedio ?? '', this.fecha(r.fechaEnvio),
      ])
    }
    this.zebra(s, 7 + escalas.length)
  }

  private hojaComentarios(wb: ExcelJS.Workbook, respuestas: Respuesta[], items: Item[]) {
    const s = wb.addWorksheet('4. Comentarios', { views: [{ state: 'frozen', ySplit: 1 }] })
    this.encabezado(s, [
      ['Persona evaluada', 30], ['Rol', 20], ['Evaluador', 30], ['Comentario', 90],
    ])
    const porRespuesta = new Map(respuestas.map(r => [r.respuestaId, r]))
    let hubo = false
    for (const i of items) {
      if (!i.comentario?.trim()) continue
      const r = porRespuesta.get(i.respuestaId)
      if (!r) continue
      hubo = true
      const fila = s.addRow([r.evaluadoNombre, r.evaluadoRol ?? '', r.evaluadorNombre, i.comentario.trim()])
      fila.getCell(4).alignment = { wrapText: true, vertical: 'top' }
    }
    if (!hubo) s.addRow(['(Sin comentarios registrados)'])
    this.zebra(s, 4)
  }

  private hojaSugerencias(wb: ExcelJS.Workbook, sugerencias: Sugerencia[]) {
    const s = wb.addWorksheet('5. Sugerencias', { views: [{ state: 'frozen', ySplit: 1 }] })
    this.encabezado(s, [['Origen', 28], ['Fecha', 18], ['Sugerencia para el proceso', 110]])
    // sin nombre a propósito: la sugerencia no va firmada.
    if (sugerencias.length === 0) s.addRow(['(Sin sugerencias registradas)'])
    for (const g of sugerencias) {
      const fila = s.addRow([g.origen, this.fecha(g.fecha), g.texto])
      fila.getCell(3).alignment = { wrapText: true, vertical: 'top' }
    }
    this.zebra(s, 3)
  }

  private hojaProgreso(
    wb: ExcelJS.Workbook, participantes: Participante[], asignaciones: Asignacion[], sesiones: Sesion[],
  ) {
    const s = wb.addWorksheet('6. Progreso y tiempos', { views: [{ state: 'frozen', ySplit: 1 }] })
    this.encabezado(s, [
      ['Persona', 30], ['Rol', 20], ['Área', 14], ['Correo', 30],
      ['Asignadas', 11], ['Enviadas', 11], ['Pendientes', 11], ['% avance', 10],
      ['Minutos', 10], ['Excedió tiempo', 14],
    ])

    const asignadasPor = new Map<number, number>()
    const enviadasPor = new Map<number, number>()
    for (const a of asignaciones) {
      if (a.estado === 'ANULADA') continue
      asignadasPor.set(a.evaluadorId, (asignadasPor.get(a.evaluadorId) ?? 0) + 1)
      if (a.estado === 'ENVIADA') enviadasPor.set(a.evaluadorId, (enviadasPor.get(a.evaluadorId) ?? 0) + 1)
    }
    const sesionPor = new Map(sesiones.map(x => [x.participacionId, x]))

    for (const p of participantes) {
      const asig = asignadasPor.get(p.participacionId) ?? 0
      const env = enviadasPor.get(p.participacionId) ?? 0
      const ses = sesionPor.get(p.participacionId)
      const pct = asig > 0 ? Math.round((env / asig) * 100) : null

      const fila = s.addRow([
        p.nombre, p.rol ?? '', p.area ?? '', p.email ?? '',
        asig, env, asig - env, pct != null ? `${pct}%` : '',
        ses?.minutos ?? '', ses?.seExcedio ? 'SÍ' : '',
      ])

      if (asig > 0 && env === asig) {
        fila.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6F5E3' } }
      } else if (asig > 0 && env === 0) {
        fila.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD6D6' } }
      }
      if (ses?.seExcedio) {
        fila.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4CC' } }
      }
    }
    this.zebra(s, 10)
  }

  private hojaMatrizCruzada(
    wb: ExcelJS.Workbook, participantes: Participante[], respuestas: Respuesta[], escalaMax: number,
  ) {
    const s = wb.addWorksheet('7. Matriz cruzada', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] })

    // filas = evaluador, columnas = evaluado; vacío = no le tocaba.
    const cabecera = ['Evaluador \\ Evaluado', ...participantes.map(p => p.nombre)]
    const fh = s.addRow(cabecera)
    fh.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      c.font = { color: { argb: BLANCO }, bold: true, size: 9 }
      c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
    })
    fh.height = 60
    s.getColumn(1).width = 30
    participantes.forEach((_, i) => { s.getColumn(i + 2).width = 12 })

    const porPar = new Map<string, number | null>()
    for (const r of respuestas) porPar.set(`${r.evaluadorId}::${r.evaluadoId}`, r.promedio)

    for (const evaluador of participantes) {
      const fila = s.addRow([
        evaluador.nombre,
        ...participantes.map(evaluado => {
          if (evaluado.participacionId === evaluador.participacionId) return '—'
          const v = porPar.get(`${evaluador.participacionId}::${evaluado.participacionId}`)
          return v ?? ''
        }),
      ])
      fila.getCell(1).font = { bold: true, size: 9 }
      participantes.forEach((evaluado, i) => {
        const celda = fila.getCell(i + 2)
        celda.alignment = { horizontal: 'center' }
        if (evaluado.participacionId === evaluador.participacionId) {
          celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
          return
        }
        const v = porPar.get(`${evaluador.participacionId}::${evaluado.participacionId}`)
        const argb = colorPromedio(v ?? null, escalaMax)
        if (argb) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
      })
    }
  }

  // estilos

  private encabezado(s: ExcelJS.Worksheet, columnas: Array<[string, number]>) {
    s.columns = columnas.map(([header, width]) => ({ header, width }))
    const fila = s.getRow(1)
    fila.height = 26
    fila.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      c.font = { color: { argb: BLANCO }, bold: true, size: 10 }
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      c.border = { bottom: { style: 'medium', color: { argb: VERDE } } }
    })
  }

  private zebra(s: ExcelJS.Worksheet, columnas: number) {
    s.eachRow((fila, n) => {
      if (n === 1 || n % 2 !== 0) return
      for (let c = 1; c <= columnas; c++) {
        const celda = fila.getCell(c)
        if (!celda.fill || celda.fill.type !== 'pattern') {
          celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } }
        }
      }
    })
  }

  private fecha(v: unknown): string {
    if (!v) return ''
    const d = v instanceof Date ? v : new Date(String(v))
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' })
  }

  // consultas

  private async participantes(convocatoriaId: number): Promise<Participante[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pa.PARTICIPACIONID AS "participacionId",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) AS "nombre",
              TRIM(p.PERSONAEMAIL) AS "email",
              TRIM(r.ROLEVALUADORNOMBRE) AS "rol",
              TRIM(ar.NOMBRE) AS "area"
         FROM EVALUADORPARTICIPACION pa
         JOIN EVALUADOR e ON e.EVALUADORID = pa.EVALUADORID
         JOIN PERSONA   p ON p.PERSONAID  = e.PERSONAID
         LEFT JOIN ROLEVALUADOR   r  ON r.ROLEVALUADORID = pa.ROLEVALUADORID
         LEFT JOIN AREAEVALUACION ar ON ar.AREAID = pa.AREAID
        WHERE pa.CONVOCATORIAID = :1
        ORDER BY NVL(r.ROLEVALUADORORDEN, 99), p.PERSONAPRIMERAPELLIDO`,
      [convocatoriaId],
    )
    return rows.map(r => ({
      participacionId: Number(r.participacionId),
      nombre: (r.nombre as string ?? '').trim(),
      email: r.email as string | null,
      rol: r.rol as string | null,
      area: r.area as string | null,
    }))
  }

  private async preguntas(formularioId: number): Promise<Pregunta[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT NUMERO AS "numero", TEXTO AS "texto", TRIM(CRITERIOS) AS "criterios", TRIM(TIPO) AS "tipo"
         FROM RETROPREGUNTA WHERE RETROFORMULARIOID = :1 AND ACTIVO = 1 ORDER BY ORDEN, NUMERO`,
      [formularioId],
    )
    return rows.map(r => ({
      numero: Number(r.numero),
      texto: r.texto as string,
      criterios: r.criterios as string | null,
      tipo: r.tipo as Pregunta['tipo'],
    }))
  }

  private async asignaciones(convocatoriaId: number): Promise<Asignacion[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT a.PARTEVALUADORID AS "evaluadorId", a.PARTEVALUADOID AS "evaluadoId",
              TRIM(a.ESTADO) AS "estado", TRIM(a.ORIGEN) AS "origen", TRIM(a.MOTIVOREGLA) AS "motivo",
              TRIM(pev.PERSONANOMBRES) || ' ' || TRIM(pev.PERSONAPRIMERAPELLIDO) AS "evaluadorNombre",
              TRIM(rev.ROLEVALUADORNOMBRE) AS "evaluadorRol",
              TRIM(arev.NOMBRE) AS "evaluadorArea",
              TRIM(pdo.PERSONANOMBRES) || ' ' || TRIM(pdo.PERSONAPRIMERAPELLIDO) AS "evaluadoNombre",
              TRIM(rdo.ROLEVALUADORNOMBRE) AS "evaluadoRol"
         FROM RETROASIGNACION a
         JOIN EVALUADORPARTICIPACION pav ON pav.PARTICIPACIONID = a.PARTEVALUADORID
         JOIN EVALUADOR eev ON eev.EVALUADORID = pav.EVALUADORID
         JOIN PERSONA   pev ON pev.PERSONAID  = eev.PERSONAID
         JOIN EVALUADORPARTICIPACION pad ON pad.PARTICIPACIONID = a.PARTEVALUADOID
         JOIN EVALUADOR edo ON edo.EVALUADORID = pad.EVALUADORID
         JOIN PERSONA   pdo ON pdo.PERSONAID  = edo.PERSONAID
         LEFT JOIN ROLEVALUADOR   rev  ON rev.ROLEVALUADORID = pav.ROLEVALUADORID
         LEFT JOIN AREAEVALUACION arev ON arev.AREAID = pav.AREAID
         LEFT JOIN ROLEVALUADOR   rdo  ON rdo.ROLEVALUADORID = pad.ROLEVALUADORID
        WHERE pav.CONVOCATORIAID = :1
        ORDER BY pev.PERSONAPRIMERAPELLIDO, pdo.PERSONAPRIMERAPELLIDO`,
      [convocatoriaId],
    )
    return rows.map(r => ({
      evaluadorId: Number(r.evaluadorId),
      evaluadoId: Number(r.evaluadoId),
      estado: (r.estado as string ?? '').trim(),
      origen: (r.origen as string ?? '').trim(),
      motivo: (r.motivo as string ?? '').trim(),
      evaluadorNombre: (r.evaluadorNombre as string ?? '').trim(),
      evaluadorRol: r.evaluadorRol as string | null,
      evaluadorArea: r.evaluadorArea as string | null,
      evaluadoNombre: (r.evaluadoNombre as string ?? '').trim(),
      evaluadoRol: r.evaluadoRol as string | null,
    }))
  }

  private async respuestas(convocatoriaId: number): Promise<Respuesta[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT rr.RETRORESPUESTAID AS "respuestaId",
              rr.PARTEVALUADORID AS "evaluadorId", rr.PARTEVALUADOID AS "evaluadoId",
              rr.PUNTAJEESCALA AS "puntaje", rr.PUNTAJEMAXIMO AS "maximo",
              rr.PROMEDIO AS "promedio", rr.FECHAENVIO AS "fechaEnvio",
              TRIM(pev.PERSONANOMBRES) || ' ' || TRIM(pev.PERSONAPRIMERAPELLIDO) AS "evaluadorNombre",
              TRIM(pdo.PERSONANOMBRES) || ' ' || TRIM(pdo.PERSONAPRIMERAPELLIDO) AS "evaluadoNombre",
              TRIM(rdo.ROLEVALUADORNOMBRE) AS "evaluadoRol"
         FROM RETRORESPUESTA rr
         JOIN EVALUADORPARTICIPACION pav ON pav.PARTICIPACIONID = rr.PARTEVALUADORID
         JOIN EVALUADOR eev ON eev.EVALUADORID = pav.EVALUADORID
         JOIN PERSONA   pev ON pev.PERSONAID  = eev.PERSONAID
         JOIN EVALUADORPARTICIPACION pad ON pad.PARTICIPACIONID = rr.PARTEVALUADOID
         JOIN EVALUADOR edo ON edo.EVALUADORID = pad.EVALUADORID
         JOIN PERSONA   pdo ON pdo.PERSONAID  = edo.PERSONAID
         LEFT JOIN ROLEVALUADOR rdo ON rdo.ROLEVALUADORID = pad.ROLEVALUADORID
        WHERE pav.CONVOCATORIAID = :1
        ORDER BY pev.PERSONAPRIMERAPELLIDO, pdo.PERSONAPRIMERAPELLIDO`,
      [convocatoriaId],
    )
    return rows.map(r => ({
      respuestaId: Number(r.respuestaId),
      evaluadorId: Number(r.evaluadorId),
      evaluadoId: Number(r.evaluadoId),
      puntaje: Number(r.puntaje ?? 0),
      maximo: Number(r.maximo ?? 0),
      promedio: r.promedio != null ? Number(r.promedio) : null,
      fechaEnvio: r.fechaEnvio,
      evaluadorNombre: (r.evaluadorNombre as string ?? '').trim(),
      evaluadoNombre: (r.evaluadoNombre as string ?? '').trim(),
      evaluadoRol: r.evaluadoRol as string | null,
    }))
  }

  private async items(convocatoriaId: number): Promise<Item[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT i.RETRORESPUESTAID AS "respuestaId", i.PREGUNTANUMERO AS "preguntaNumero",
              i.CALIFICACION AS "calificacion", i.COMENTARIO AS "comentario",
              rr.PARTEVALUADOID AS "evaluadoId"
         FROM RETRORESPUESTAITEM i
         JOIN RETRORESPUESTA rr ON rr.RETRORESPUESTAID = i.RETRORESPUESTAID
         JOIN EVALUADORPARTICIPACION pav ON pav.PARTICIPACIONID = rr.PARTEVALUADORID
        WHERE pav.CONVOCATORIAID = :1`,
      [convocatoriaId],
    )
    return rows.map(r => ({
      respuestaId: Number(r.respuestaId),
      evaluadoId: Number(r.evaluadoId),
      preguntaNumero: Number(r.preguntaNumero),
      calificacion: r.calificacion != null ? Number(r.calificacion) : null,
      comentario: r.comentario as string | null,
    }))
  }

  private async sugerencias(convocatoriaId: number): Promise<Sugerencia[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT s.TEXTO AS "texto", s.FECHAENVIO AS "fecha",
              TRIM(r.ROLEVALUADORNOMBRE) AS "rol", TRIM(ar.NOMBRE) AS "area"
         FROM RETROSUGERENCIA s
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = s.PARTICIPACIONID
         LEFT JOIN ROLEVALUADOR   r  ON r.ROLEVALUADORID = pa.ROLEVALUADORID
         LEFT JOIN AREAEVALUACION ar ON ar.AREAID = pa.AREAID
        WHERE pa.CONVOCATORIAID = :1
        ORDER BY s.FECHAENVIO`,
      [convocatoriaId],
    )
    return rows.map(r => ({
      texto: (r.texto as string ?? '').trim(),
      fecha: r.fecha,
      origen: [r.rol, r.area].filter(Boolean).join(' · ') || 'Participante',
    }))
  }

  private async sesiones(convocatoriaId: number): Promise<Sesion[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT s.PARTICIPACIONID AS "participacionId",
              MAX(s.MINUTOSTRANSCURRIDOS) AS "minutos",
              MAX(CASE WHEN s.SEEXCEDIO = 1 THEN 1 ELSE 0 END) AS "seExcedio"
         FROM RETROSESION s
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = s.PARTICIPACIONID
        WHERE pa.CONVOCATORIAID = :1
        GROUP BY s.PARTICIPACIONID`,
      [convocatoriaId],
    )
    return rows.map(r => ({
      participacionId: Number(r.participacionId),
      minutos: r.minutos != null ? Number(r.minutos) : null,
      seExcedio: Number(r.seExcedio ?? 0) === 1,
    }))
  }
}

interface Participante {
  participacionId: number; nombre: string; email: string | null
  rol: string | null; area: string | null
}
interface Pregunta {
  numero: number; texto: string; criterios: string | null
  tipo: 'ESCALA' | 'TEXTO_POR_PERSONA' | 'TEXTO_GENERAL'
}
interface Asignacion {
  evaluadorId: number; evaluadoId: number; estado: string; origen: string; motivo: string
  evaluadorNombre: string; evaluadorRol: string | null; evaluadorArea: string | null
  evaluadoNombre: string; evaluadoRol: string | null
}
interface Respuesta {
  respuestaId: number; evaluadorId: number; evaluadoId: number
  puntaje: number; maximo: number; promedio: number | null; fechaEnvio: unknown
  evaluadorNombre: string; evaluadoNombre: string; evaluadoRol: string | null
}
interface Item {
  respuestaId: number; evaluadoId: number; preguntaNumero: number
  calificacion: number | null; comentario: string | null
}
interface Sugerencia { texto: string; fecha: unknown; origen: string }
interface Sesion { participacionId: number; minutos: number | null; seExcedio: boolean }
