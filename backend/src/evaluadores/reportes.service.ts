import { Injectable } from '@nestjs/common'
import ExcelJS from 'exceljs'
import { EvaluadoresService } from './evaluadores.service'
import type { EvaluadorFiltros } from './evaluadores.service'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { enBloques } from '../common/db/binds'

// sábana del banco de evaluadores: hoja 1 por persona, hoja 2 por participación

const NAVY = 'FF00304D'
const VERDE = 'FF39A900'
const BLANCO = 'FFFFFFFF'

const MAX_FILAS = 5000

type ItemBanco = Awaited<ReturnType<EvaluadoresService['listar']>>['items'][number]

@Injectable()
export class ReportesEvaluadorService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly evaluadores: EvaluadoresService,
  ) {}

  async sabanaBanco(
    busqueda: string, filtros: EvaluadorFiltros,
  ): Promise<{ buffer: Buffer; nombre: string }> {
    // el 5º argumento sube el tope por página, que por defecto es 100
    const { items, total } = await this.evaluadores.listar(busqueda, 1, MAX_FILAS, filtros, MAX_FILAS)

    const wb = new ExcelJS.Workbook()
    wb.creator = 'SEP — Banco de Evaluadores'
    wb.created = new Date()

    this.hojaEvaluadores(wb, items, { busqueda, filtros, total })
    await this.hojaCiclos(wb, items.map(i => i.evaluadorId), filtros)

    const buffer = Buffer.from(await wb.xlsx.writeBuffer())
    const sufijo = filtros.anio ? `_${filtros.anio}` : ''
    return { buffer, nombre: `Banco_evaluadores${sufijo}.xlsx` }
  }

  // hoja 1 — evaluadores
  private hojaEvaluadores(
    wb: ExcelJS.Workbook,
    items: ItemBanco[],
    ctx: { busqueda: string; filtros: EvaluadorFiltros; total: number },
  ) {
    const s = wb.addWorksheet('1. Evaluadores', { views: [{ state: 'frozen', ySplit: 3 }] })

    const activos = Object.entries(ctx.filtros)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}=${v}`)
    const truncado = ctx.total > items.length
      ? ` · ⚠ TRUNCADO: se exportaron ${items.length} de ${ctx.total}`
      : ''
    s.getCell('A1').value =
      `Banco de evaluadores — ${ctx.total} registro(s)` +
      (ctx.busqueda ? ` · búsqueda: "${ctx.busqueda}"` : '') +
      (activos.length ? ` · filtros: ${activos.join(', ')}` : ' · sin filtros') +
      truncado
    s.getCell('A1').font = { bold: true, color: { argb: NAVY }, size: 11 }
    s.getCell('A2').value = `Generado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`
    s.getCell('A2').font = { size: 9, color: { argb: 'FF888888' } }

    const columnas: Array<[string, number]> = [
      ['Identificación', 16], ['Nombres', 22], ['Apellidos', 24], ['Correo', 30],
      ['Cargo', 22], ['Profesión', 26], ['Regional', 22],
      // "ciclos válidos": el promedio excluye DECLINO, NO_APROBO y REVOCADO
      ['Ciclos', 9], ['Último año', 11], ['Proyectos', 11], ['Retroalim. (ciclos válidos)', 22],
      ['Cédula', 10], ['Foto', 9], ['Prueba vigente', 14], ['Estado', 10],
    ]
    const cab = s.getRow(3)
    columnas.forEach(([titulo, ancho], i) => {
      cab.getCell(i + 1).value = titulo
      s.getColumn(i + 1).width = ancho
    })
    cab.height = 26
    cab.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      c.font = { color: { argb: BLANCO }, bold: true, size: 10 }
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      c.border = { bottom: { style: 'medium', color: { argb: VERDE } } }
    })

    for (const it of items) {
      const fila = s.addRow([
        it.identificacion, it.nombres,
        [it.primerApellido, it.segundoApellido].filter(Boolean).join(' '),
        it.email, it.cargo ?? '', it.profesion ?? '', it.regionalNombre ?? '',
        it.totalCiclos, it.ultimoAnio ?? '', it.totalProyectos,
        it.promedioRetro ?? '',
        it.tieneCedula ? 'Sí' : 'NO', it.tieneFoto ? 'Sí' : 'NO',
        it.pruebaVigente ? 'Sí' : 'NO',
        it.activo ? 'Activo' : 'Inactivo',
      ])
      const rojo = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFD6D6' } }
      if (!it.tieneCedula) fila.getCell(12).fill = rojo
      if (!it.tieneFoto) fila.getCell(13).fill = rojo
      if (!it.pruebaVigente) fila.getCell(14).fill = rojo
      if (!it.activo) fila.font = { color: { argb: 'FF999999' }, italic: true }
    }

    s.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columnas.length } }
  }

  // hoja 2 — una fila por participación; los filtros de ciclo se reaplican aquí
  private async hojaCiclos(
    wb: ExcelJS.Workbook, evaluadorIds: number[], filtros: EvaluadorFiltros,
  ) {
    const s = wb.addWorksheet('2. Ciclos', { views: [{ state: 'frozen', ySplit: 1 }] })
    const columnas: Array<[string, number]> = [
      ['Identificación', 16], ['Evaluador', 30], ['Año', 8], ['Periodo', 9],
      ['Rol', 20], ['Área', 14], ['Proceso', 12], ['Modalidad', 14],
      ['Mesa', 14], ['Equipo', 14], ['Estado', 22],
      ['Proyectos', 11], ['Retroalim. recibida', 18], ['Certificado', 16],
    ]
    const cab = s.getRow(1)
    columnas.forEach(([titulo, ancho], i) => {
      cab.getCell(i + 1).value = titulo
      s.getColumn(i + 1).width = ancho
    })
    cab.height = 26
    cab.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      c.font = { color: { argb: BLANCO }, bold: true, size: 10 }
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      c.border = { bottom: { style: 'medium', color: { argb: VERDE } } }
    })

    if (evaluadorIds.length === 0) {
      s.addRow(['(Sin evaluadores en el filtro aplicado)'])
      return
    }

    const filas: Array<Record<string, unknown>> = []
    for (const bloque of enBloques(evaluadorIds)) {
      // Oracle no acepta un array en el IN: binds posicionales, y los del filtro numeran desde bloque.length
      const marcadores = bloque.map((_, i) => `:${i + 1}`).join(',')
      const extra: unknown[] = []
      const bind = (v: unknown) => { extra.push(v); return `:${bloque.length + extra.length}` }
      const cond: string[] = []
      if (filtros.anio) cond.push(`pa.ANIO = ${bind(filtros.anio)}`)
      if (filtros.procesoId) cond.push(`pa.PROCESOID = ${bind(filtros.procesoId)}`)
      if (filtros.rolEvaluadorId) cond.push(`pa.ROLEVALUADORID = ${bind(filtros.rolEvaluadorId)}`)
      if (filtros.areaId) cond.push(`pa.AREAID = ${bind(filtros.areaId)}`)
      if (filtros.estadoCodigo) {
        cond.push(`es.CODIGO = ${bind(filtros.estadoCodigo.trim().toUpperCase())}`)
      }

      filas.push(...await this.dataSource.query(
        `SELECT TRIM(p.PERSONAIDENTIFICACION) AS "identificacion",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) AS "evaluador",
              pa.ANIO                    AS "anio",
              TRIM(pa.PERIODO)           AS "periodo",
              TRIM(r.ROLEVALUADORNOMBRE) AS "rol",
              TRIM(ar.NOMBRE)            AS "area",
              TRIM(pe.PROCESONOMBRE)     AS "proceso",
              TRIM(mo.NOMBRE)            AS "modalidad",
              TRIM(pa.MESA)              AS "mesa",
              TRIM(pa.EQUIPOEVALUADOR)   AS "equipo",
              TRIM(es.NOMBRE)            AS "estado",
              (SELECT COUNT(*) FROM EVALUADORPARTPROYECTO pp
                WHERE pp.PARTICIPACIONID = pa.PARTICIPACIONID)     AS "proyectos",
              (SELECT ROUND(AVG(rr.PROMEDIO), 2) FROM RETRORESPUESTA rr
                WHERE rr.PARTEVALUADOID = pa.PARTICIPACIONID)      AS "retro",
              (SELECT MAX(ce.ANIO || '-' || LPAD(ce.CONSECUTIVO, 4, '0'))
                 FROM EVALUADORCERTIFICADO ce
                WHERE ce.PARTICIPACIONID = pa.PARTICIPACIONID AND ce.ANULADO = 0) AS "certificado"
         FROM EVALUADORPARTICIPACION pa
         JOIN EVALUADOR e ON e.EVALUADORID = pa.EVALUADORID
         JOIN PERSONA   p ON p.PERSONAID  = e.PERSONAID
         LEFT JOIN ROLEVALUADOR       r  ON r.ROLEVALUADORID   = pa.ROLEVALUADORID
         LEFT JOIN AREAEVALUACION     ar ON ar.AREAID          = pa.AREAID
         LEFT JOIN PROCESOEVAL        pe ON pe.PROCESOID       = pa.PROCESOID
         LEFT JOIN MODALIDADPART      mo ON mo.MODALIDADPARTID = pa.MODALIDADPARTID
         LEFT JOIN ESTADOPARTICIPACION es ON es.ESTADOPARTID   = pa.ESTADOPARTID
        WHERE pa.EVALUADORID IN (${marcadores})
          ${cond.length ? 'AND ' + cond.join(' AND ') : ''}`,
        [...bloque, ...extra],
      ))
    }

    // orden en memoria: cada bloque llega ordenado por su cuenta
    filas.sort((a, b) =>
      Number(b.anio) - Number(a.anio) ||
      String(a.evaluador ?? '').localeCompare(String(b.evaluador ?? ''), 'es'))

    if (filas.length === 0) {
      s.addRow(['(Los evaluadores del filtro no tienen ciclos registrados)'])
      return
    }

    for (const f of filas) {
      s.addRow([
        f.identificacion, (f.evaluador as string ?? '').trim(),
        Number(f.anio), f.periodo ?? '',
        f.rol ?? '', f.area ?? '', f.proceso ?? '', f.modalidad ?? '',
        f.mesa ?? '', f.equipo ?? '', f.estado ?? '',
        Number(f.proyectos ?? 0),
        f.retro != null ? Number(f.retro) : '',
        f.certificado ?? '',
      ])
    }

    s.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } }
  }
}
