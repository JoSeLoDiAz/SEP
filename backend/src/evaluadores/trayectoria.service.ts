import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { bindRepetido } from '../common/db/binds'

// hito del checklist: se calcula, no se guarda
export interface Hito {
  codigo: string
  nombre: string
  cumplido: boolean
  detalle?: string | null
}

export interface ProgresoCiclo {
  cumplidos: number
  total: number
  hitos: Hito[]
}

// catálogo ESTADOPARTICIPACION
const ESTADO = {
  POSTULADO: 'POSTULADO',
  AUTORIZADO: 'AUTORIZADO',
  EN_FORMACION: 'EN_FORMACION',
  HABILITADO: 'HABILITADO',
  ASIGNADO: 'ASIGNADO',
  EVALUANDO: 'EVALUANDO',
  FINALIZADO: 'FINALIZADO',
  CERTIFICADO: 'CERTIFICADO',
} as const

interface ContadoresRow {
  participacionId: number
  tieneInvitacion: number
  tieneAprobacion: number
  tieneConfidencialidad: number
  cursoAprobado: number
  cursoCalificacion: number | null
  pruebaAprobada: number
  pruebaEfectividad: number | null
  pruebaPuntaje: number | null
  pruebaMinimo: number | null
  tieneAsignacion: number
  totalProyectos: number
  totalDocumentos: number
  retroAsignadas: number
  retroPendientes: number
  retroRecibidas: number
  retroMinimo: number | null
  retroMaximo: number | null
  retroPromedio: number | null
  tieneCertificado: number
  // cargado como documento, no emitido
  certificadoCargado: number
}

@Injectable()
export class TrayectoriaService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getResumen(evaluadorId: number) {
    await this.exigirEvaluador(evaluadorId)

    // ESNEGATIVO = 1 no entra al promedio
    const resumen = bindRepetido(
      `SELECT
         (SELECT COUNT(DISTINCT pa.ANIO)
            FROM EVALUADORPARTICIPACION pa
           WHERE pa.EVALUADORID = :ev)                                 AS "aniosParticipados",
         (SELECT COUNT(*)
            FROM EVALUADORPARTICIPACION pa
           WHERE pa.EVALUADORID = :ev)                                 AS "totalParticipaciones",
         (SELECT MIN(pa.ANIO)
            FROM EVALUADORPARTICIPACION pa
           WHERE pa.EVALUADORID = :ev)                                 AS "primerAnio",
         (SELECT MAX(pa.ANIO)
            FROM EVALUADORPARTICIPACION pa
           WHERE pa.EVALUADORID = :ev)                                 AS "ultimoAnio",
         (SELECT COUNT(*)
            FROM EVALUADORPARTPROYECTO pp
            JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = pp.PARTICIPACIONID
           WHERE pa.EVALUADORID = :ev)                                 AS "totalProyectos",
         -- cuenta los emitidos y los cargados a mano (los historicos llegaron asi)
         ((SELECT COUNT(*)
             FROM EVALUADORCERTIFICADO c
             JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = c.PARTICIPACIONID
            WHERE pa.EVALUADORID = :ev AND c.ANULADO = 0)
        + (SELECT COUNT(*)
             FROM EVALUADORDOCUMENTO dc
             JOIN TIPODOCUMENTOEVAL td ON td.TIPODOCUMENTOEVALID = dc.TIPODOCUMENTOEVALID
            WHERE dc.EVALUADORID = :ev
              AND TRIM(td.CODIGO) = 'CERTIFICADO_PARTICIPACION'))      AS "totalCertificados",
         (SELECT ROUND(AVG(rr.PROMEDIO), 2)
            FROM RETRORESPUESTA rr
            JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = rr.PARTEVALUADOID
            LEFT JOIN ESTADOPARTICIPACION es ON es.ESTADOPARTID = pa.ESTADOPARTID
           WHERE pa.EVALUADORID = :ev
             AND NVL(es.ESNEGATIVO, 0) = 0)                            AS "promedioRetro",
         (SELECT COUNT(*)
            FROM RETRORESPUESTA rr
            JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = rr.PARTEVALUADOID
           WHERE pa.EVALUADORID = :ev)                                 AS "totalRetroRecibidas"
       FROM DUAL`,
      'ev', evaluadorId,
    )
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      resumen.sql, resumen.params,
    )

    const r = rows[0] ?? {}

    // vigente = aprobada del año en curso o el anterior
    const pruebaRows: Array<Record<string, unknown>> = await this.dataSource.query(
      // del año más reciente, la mejor: por id se tomaba la última cargada, que
      // en 22 pares evaluador-año no es la mejor (hasta 17 puntos de diferencia)
      `SELECT pr.ANIO           AS "anio",
              pr.PUNTAJEMAYOR   AS "puntaje",
              pr.EFECTIVIDAD    AS "porcentaje",
              pr.PUNTAJEMINIMO  AS "minimo",
              pr.APROBADA       AS "aprobada"
         FROM EVALUADORPRUEBA pr
        WHERE pr.EVALUADORID = :1
        ORDER BY pr.ANIO DESC, pr.EFECTIVIDAD DESC NULLS LAST, pr.PRUEBAID DESC
        FETCH FIRST 1 ROWS ONLY`,
      [evaluadorId],
    )
    const ultimaPrueba = pruebaRows[0]
    const anioActual = new Date().getFullYear()
    const aprobada = ultimaPrueba ? this.esPruebaAprobada(ultimaPrueba) : false

    const recorrido = await this.recorridoPorAnio(evaluadorId)

    return {
      recorrido,
      aniosParticipados: Number(r.aniosParticipados ?? 0),
      totalParticipaciones: Number(r.totalParticipaciones ?? 0),
      primerAnio: r.primerAnio != null ? Number(r.primerAnio) : null,
      ultimoAnio: r.ultimoAnio != null ? Number(r.ultimoAnio) : null,
      totalProyectos: Number(r.totalProyectos ?? 0),
      totalCertificados: Number(r.totalCertificados ?? 0),
      promedioRetro: r.promedioRetro != null ? Number(r.promedioRetro) : null,
      totalRetroRecibidas: Number(r.totalRetroRecibidas ?? 0),
      pruebaVigente: ultimaPrueba
        ? {
            anio: Number(ultimaPrueba.anio),
            puntaje: ultimaPrueba.puntaje != null ? Number(ultimaPrueba.puntaje) : null,
            porcentaje: ultimaPrueba.porcentaje != null ? Number(ultimaPrueba.porcentaje) : null,
            minimo: ultimaPrueba.minimo != null ? Number(ultimaPrueba.minimo) : null,
            aprobada,
            vigente: aprobada && Number(ultimaPrueba.anio) >= anioActual - 1,
          }
        : null,
    }
  }

  // años en orden descendente; los que solo tienen prueba salen como soloPrueba
  async getTrayectoria(evaluadorId: number) {
    await this.exigirEvaluador(evaluadorId)

    const participaciones = await this.cargarParticipaciones(evaluadorId)
    const contadores = await this.cargarContadores(evaluadorId)
    const porId = new Map(contadores.map(c => [Number(c.participacionId), c]))

    const items = participaciones.map(p => {
      const c = porId.get(p.participacionId)
      const progreso = this.calcularProgreso(p, c)
      return {
        ...p,
        progreso,
        estadoSugerido: this.sugerirEstado(progreso),
        contadores: {
          documentos: Number(c?.totalDocumentos ?? 0),
          proyectos: Number(c?.totalProyectos ?? 0),
          retroAsignadas: Number(c?.retroAsignadas ?? 0),
          retroPendientes: Number(c?.retroPendientes ?? 0),
          retroRecibidas: Number(c?.retroRecibidas ?? 0),
        },
        promedioRetro: c?.retroPromedio != null ? Number(c.retroPromedio) : null,
      }
    })

    // años con prueba y sin participación
    const aniosConParticipacion = new Set(items.map(i => i.anio))
    const sueltosRows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pr.ANIO          AS "anio",
              COUNT(*)         AS "pruebas",
              MAX(pr.PUNTAJEMAYOR) AS "mejorPuntaje"
         FROM EVALUADORPRUEBA pr
        WHERE pr.EVALUADORID = :1
          AND pr.PARTICIPACIONID IS NULL
        GROUP BY pr.ANIO
        ORDER BY pr.ANIO DESC`,
      [evaluadorId],
    )

    const anios = new Map<number, {
      anio: number
      participaciones: typeof items
      soloPrueba: boolean
      pruebasSueltas: number
      mejorPuntajeSuelto: number | null
    }>()

    for (const it of items) {
      if (!anios.has(it.anio)) {
        anios.set(it.anio, {
          anio: it.anio, participaciones: [], soloPrueba: false,
          pruebasSueltas: 0, mejorPuntajeSuelto: null,
        })
      }
      anios.get(it.anio)!.participaciones.push(it)
    }

    for (const s of sueltosRows) {
      const anio = Number(s.anio)
      if (aniosConParticipacion.has(anio)) {
        const y = anios.get(anio)!
        y.pruebasSueltas = Number(s.pruebas)
        continue
      }
      anios.set(anio, {
        anio,
        participaciones: [],
        soloPrueba: true,
        pruebasSueltas: Number(s.pruebas),
        mejorPuntajeSuelto: s.mejorPuntaje != null ? Number(s.mejorPuntaje) : null,
      })
    }

    const ordenados = [...anios.values()].sort((a, b) => b.anio - a.anio)

    // los huecos van marcados para que el rail no comprima la línea de tiempo
    const conGaps: Array<Record<string, unknown>> = []
    for (let i = 0; i < ordenados.length; i++) {
      conGaps.push(ordenados[i])
      const siguiente = ordenados[i + 1]
      if (siguiente && ordenados[i].anio - siguiente.anio > 1) {
        conGaps.push({
          gap: true,
          desde: siguiente.anio + 1,
          hasta: ordenados[i].anio - 1,
          anios: ordenados[i].anio - siguiente.anio - 1,
        })
      }
    }

    return { evaluadorId, anios: conGaps }
  }

  // todo el ciclo en una respuesta
  async getParticipacion(participacionId: number) {
    const cabecera = await this.cargarCabecera(participacionId)
    if (!cabecera) throw new NotFoundException('Participación no encontrada')

    const [
      aprobacion, capacitaciones, pruebas, grupos, alcance,
      proyectos, docsPropios, docsHeredados, docsPermanentes, certificado,
    ] = await Promise.all([
      this.cargarAprobacion(participacionId),
      this.cargarCapacitaciones(participacionId),
      this.cargarPruebas(participacionId),
      this.cargarGrupos(participacionId),
      this.cargarAlcance(participacionId),
      this.cargarProyectos(participacionId),
      this.cargarDocumentosPropios(participacionId),
      this.cargarDocumentosHeredados(cabecera.convocatoriaId as number | null),
      this.cargarDocumentosPermanentes(cabecera.evaluadorId as number),
      this.cargarCertificado(participacionId),
    ])

    const contadores = await this.cargarContadores(cabecera.evaluadorId as number)
    const c = contadores.find(x => Number(x.participacionId) === participacionId)
    const progreso = this.calcularProgreso(cabecera, c)

    return {
      ...cabecera,
      progreso,
      estadoSugerido: this.sugerirEstado(progreso),
      aprobacion,
      capacitaciones,
      pruebas,
      grupos,
      alcance,
      proyectos,
      documentos: {
        propios: docsPropios,
        heredados: docsHeredados,
        permanentes: docsPermanentes,
      },
      certificado,
      retroalimentacion: {
        recibidas: Number(c?.retroRecibidas ?? 0),
        promedio: c?.retroPromedio != null ? Number(c.retroPromedio) : null,
        asignadas: Number(c?.retroAsignadas ?? 0),
        pendientes: Number(c?.retroPendientes ?? 0),
        minimo: c?.retroMinimo != null ? Number(c.retroMinimo) : null,
        maximo: c?.retroMaximo != null ? Number(c.retroMaximo) : null,
      },
    }
  }

  // los hitos se derivan de los datos, nadie marca casillas
  private calcularProgreso(
    cabecera: Record<string, unknown>,
    c: ContadoresRow | undefined,
  ): ProgresoCiclo {
    const n = (v: unknown) => Number(v ?? 0)

    const puntaje = c?.pruebaPuntaje != null ? Number(c.pruebaPuntaje) : null

    const efectividad = c?.pruebaEfectividad != null ? Number(c.pruebaEfectividad) : null
    const minimo = c?.pruebaMinimo != null ? Number(c.pruebaMinimo) : null

    const hitos: Hito[] = [
      {
        codigo: 'INVITACION',
        nombre: 'Invitación recibida',
        cumplido: n(c?.tieneInvitacion) > 0,
        detalle: cabecera.convocatoriaNombre as string | null,
      },
      {
        codigo: 'AUTORIZACION',
        nombre: 'Autorización del jefe',
        cumplido: n(c?.tieneAprobacion) > 0,
      },
      {
        codigo: 'CONFIDENCIALIDAD',
        nombre: 'Confidencialidad firmada',
        cumplido: n(c?.tieneConfidencialidad) > 0,
      },
      {
        codigo: 'CURSO',
        nombre: 'Curso de formación aprobado',
        cumplido: n(c?.cursoAprobado) > 0,
        detalle: c?.cursoCalificacion != null ? `Nota ${Number(c.cursoCalificacion)}` : null,
      },
      {
        codigo: 'PRUEBA',
        nombre: 'Prueba de conocimiento aprobada',
        cumplido: n(c?.pruebaAprobada) > 0,
        // se rotula con el porcentaje, que es lo que se compara contra el mínimo
        detalle: efectividad != null
          ? `Efectividad ${efectividad}%${minimo != null ? ` / mínimo ${minimo}%` : ''}`
          : puntaje != null
            ? `${puntaje} aciertos${minimo != null ? ` · mínimo ${minimo}%` : ''}`
            : null,
      },
      {
        codigo: 'ASIGNACION',
        nombre: 'Asignación a proceso, mesa y equipo',
        cumplido: n(c?.tieneAsignacion) > 0,
        detalle: [cabecera.procesoNombre, cabecera.mesa, cabecera.equipoEvaluador]
          .filter(Boolean).join(' · ') || null,
      },
      {
        codigo: 'PROYECTOS',
        nombre: 'Proyectos evaluados registrados',
        cumplido: n(c?.totalProyectos) > 0,
        detalle: n(c?.totalProyectos) > 0 ? `${n(c?.totalProyectos)} proyectos` : null,
      },
      {
        codigo: 'RETROALIMENTO',
        nombre: 'Retroalimentación',
        // sin asignaciones no hay nada que diligenciar
        cumplido: n(c?.retroAsignadas) > 0 && n(c?.retroPendientes) === 0,
        detalle: n(c?.retroAsignadas) > 0
          ? `${n(c?.retroAsignadas) - n(c?.retroPendientes)} de ${n(c?.retroAsignadas)}`
          : 'Sin asignaciones',
      },
      {
        codigo: 'CERTIFICADO',
        nombre: 'Certificado emitido',
        cumplido: n(c?.tieneCertificado) > 0 || n(c?.certificadoCargado) > 0,
        detalle: n(c?.tieneCertificado) > 0
          ? undefined
          : n(c?.certificadoCargado) > 0 ? 'Cargado de un año anterior' : undefined,
      },
    ]

    return {
      cumplidos: hitos.filter(h => h.cumplido).length,
      total: hitos.length,
      hitos,
    }
  }

  // sugerencia: el estado real lo declara una persona (DECLINO no se deduce)
  private sugerirEstado(progreso: ProgresoCiclo): string {
    const tiene = (cod: string) => progreso.hitos.find(h => h.codigo === cod)?.cumplido ?? false

    if (tiene('CERTIFICADO')) return ESTADO.CERTIFICADO
    if (tiene('PROYECTOS')) return ESTADO.FINALIZADO
    if (tiene('ASIGNACION')) return ESTADO.ASIGNADO
    if (tiene('PRUEBA')) return ESTADO.HABILITADO
    if (tiene('CURSO')) return ESTADO.EN_FORMACION
    if (tiene('AUTORIZACION')) return ESTADO.AUTORIZADO
    return ESTADO.POSTULADO
  }

  // parte de los años en que participó, no de los años con prueba: así se ven los huecos
  private async recorridoPorAnio(evaluadorId: number) {
    // el id se repite en cada subconsulta y Oracle numera los binds por posición
    const { sql, params } = bindRepetido(
      `SELECT a.ANIO AS "anio",
              (SELECT pr.EFECTIVIDAD FROM EVALUADORPRUEBA pr
                WHERE pr.EVALUADORID = :ev AND pr.ANIO = a.ANIO
                ORDER BY pr.EFECTIVIDAD DESC NULLS LAST, pr.PRUEBAID DESC
                FETCH FIRST 1 ROWS ONLY)   AS "porcentaje",
              (SELECT pr.PUNTAJEMAYOR FROM EVALUADORPRUEBA pr
                WHERE pr.EVALUADORID = :ev AND pr.ANIO = a.ANIO
                ORDER BY pr.EFECTIVIDAD DESC NULLS LAST, pr.PRUEBAID DESC
                FETCH FIRST 1 ROWS ONLY)   AS "puntaje",
              (SELECT pr.PUNTAJEMINIMO FROM EVALUADORPRUEBA pr
                WHERE pr.EVALUADORID = :ev AND pr.ANIO = a.ANIO
                ORDER BY pr.EFECTIVIDAD DESC NULLS LAST, pr.PRUEBAID DESC
                FETCH FIRST 1 ROWS ONLY)   AS "minimo",
              (SELECT pr.APROBADA FROM EVALUADORPRUEBA pr
                WHERE pr.EVALUADORID = :ev AND pr.ANIO = a.ANIO
                ORDER BY pr.EFECTIVIDAD DESC NULLS LAST, pr.PRUEBAID DESC
                FETCH FIRST 1 ROWS ONLY)   AS "aprobada",
              (SELECT pr.INTENTOS FROM EVALUADORPRUEBA pr
                WHERE pr.EVALUADORID = :ev AND pr.ANIO = a.ANIO
                ORDER BY pr.EFECTIVIDAD DESC NULLS LAST, pr.PRUEBAID DESC
                FETCH FIRST 1 ROWS ONLY)   AS "intentos",
              -- cuántas pruebas hubo ese año: si son varias, la franja muestra la
              -- mejor y la tarjeta lo dice, en vez de callar las otras
              (SELECT COUNT(*) FROM EVALUADORPRUEBA pr
                WHERE pr.EVALUADORID = :ev AND pr.ANIO = a.ANIO)      AS "pruebasDelAnio",
              (SELECT ROUND(AVG(rr.PROMEDIO), 2)
                 FROM RETRORESPUESTA rr
                 JOIN EVALUADORPARTICIPACION pe ON pe.PARTICIPACIONID = rr.PARTEVALUADOID
                WHERE pe.EVALUADORID = :ev AND pe.ANIO = a.ANIO)     AS "retro",
              -- pregunta 10 = ¿recomendaría a esta persona?, va aparte del promedio
              (SELECT ROUND(AVG(ri.CALIFICACION), 2)
                 FROM RETRORESPUESTAITEM ri
                 JOIN RETRORESPUESTA rr ON rr.RETRORESPUESTAID = ri.RETRORESPUESTAID
                 JOIN EVALUADORPARTICIPACION pe ON pe.PARTICIPACIONID = rr.PARTEVALUADOID
                WHERE pe.EVALUADORID = :ev AND pe.ANIO = a.ANIO
                  AND ri.PREGUNTANUMERO = 10)                        AS "recomendado",
              (SELECT MAX(ca.CALIFICACION)
                 FROM EVALUADORCAPACITACION ca
                 JOIN EVALUADORPARTICIPACION pe ON pe.PARTICIPACIONID = ca.PARTICIPACIONID
                WHERE pe.EVALUADORID = :ev AND pe.ANIO = a.ANIO)     AS "curso",
              (SELECT MAX(ca.APROBADO)
                 FROM EVALUADORCAPACITACION ca
                 JOIN EVALUADORPARTICIPACION pe ON pe.PARTICIPACIONID = ca.PARTICIPACIONID
                WHERE pe.EVALUADORID = :ev AND pe.ANIO = a.ANIO)     AS "cursoAprobado"
         FROM (SELECT DISTINCT pa.ANIO
                 FROM EVALUADORPARTICIPACION pa
                WHERE pa.EVALUADORID = :ev) a
        ORDER BY a.ANIO`,
      'ev', evaluadorId,
    )
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(sql, params)

    return filas.map(f => ({
      anio: Number(f.anio),
      porcentaje: f.porcentaje != null ? Number(f.porcentaje) : null,
      puntaje: f.puntaje != null ? Number(f.puntaje) : null,
      pruebasDelAnio: f.pruebasDelAnio != null ? Number(f.pruebasDelAnio) : 0,
      intentos: f.intentos != null ? Number(f.intentos) : null,
      curso: f.curso != null ? Number(f.curso) : null,
      cursoAprobado: f.cursoAprobado != null ? Number(f.cursoAprobado) === 1 : null,
      // null = sin evaluar, distinto de reprobada
      pruebaAprobada: f.aprobada != null
        ? Number(f.aprobada) === 1
        : (f.porcentaje != null && f.minimo != null
            ? Number(f.porcentaje) >= Number(f.minimo)
            : null),
      retro: f.retro != null ? Number(f.retro) : null,
      recomendado: f.recomendado != null ? Number(f.recomendado) : null,
    }))
  }

  private esPruebaAprobada(p: Record<string, unknown>): boolean {
    if (Number(p.aprobada ?? 0) === 1) return true
    // El histórico anterior a v34 no tiene APROBADA: se infiere del corte, y el
    // corte es porcentual, así que se compara contra EFECTIVIDAD. En las 173
    // pruebas que sí traen APROBADA, esta regla coincide con ella sin excepción.
    if (p.minimo == null) return false
    if (p.porcentaje != null) return Number(p.porcentaje) >= Number(p.minimo)
    return false
  }

  private async exigirEvaluador(evaluadorId: number) {
    if (!evaluadorId || Number.isNaN(evaluadorId)) {
      throw new BadRequestException('Identificador de evaluador inválido')
    }
    const ok = await this.dataSource.query(
      `SELECT 1 FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId],
    )
    if (!ok[0]) throw new NotFoundException('Evaluador no encontrado')
  }

  // columnas de una participación con los catálogos resueltos
  private readonly SELECT_PARTICIPACION = `
    SELECT pa.PARTICIPACIONID          AS "participacionId",
           pa.EVALUADORID              AS "evaluadorId",
           pa.ANIO                     AS "anio",
           TRIM(pa.PERIODO)            AS "periodo",
           pa.ROLEVALUADORID           AS "rolEvaluadorId",
           TRIM(r.ROLEVALUADORNOMBRE)  AS "rolNombre",
           TRIM(r.ROLEVALUADORCODIGO)  AS "rolCodigo",
           pa.PROCESOID                AS "procesoId",
           TRIM(pe.PROCESONOMBRE)      AS "procesoNombre",
           pa.MODALIDADPARTID          AS "modalidadId",
           TRIM(mo.NOMBRE)             AS "modalidadNombre",
           pa.AREAID                   AS "areaId",
           TRIM(ar.NOMBRE)             AS "areaNombre",
           pa.ESTADOPARTID             AS "estadoId",
           TRIM(es.CODIGO)             AS "estadoCodigo",
           TRIM(es.NOMBRE)             AS "estadoNombre",
           TRIM(es.COLOR)              AS "estadoColor",
           NVL(es.ESFINAL, 0)          AS "estadoFinal",
           NVL(es.ESNEGATIVO, 0)       AS "estadoNegativo",
           pa.CONVOCATORIAID           AS "convocatoriaId",
           TRIM(cv.NOMBRE)             AS "convocatoriaNombre",
           -- sin notas de corte no hay cómo marcar aprobado el curso ni la prueba
           cv.CALIFICACIONMINIMACURSO  AS "corteCurso",
           cv.PUNTAJEMINIMOPRUEBA      AS "cortePrueba",
           NVL(pa.ESTRANSVERSAL, 0)    AS "esTransversal",
           TRIM(pa.MOTIVONOPARTICIPA)  AS "motivoNoParticipa",
           pa.FECHAINICIO              AS "fechaInicio",
           pa.FECHAFIN                 AS "fechaFin",
           TRIM(pa.MESA)               AS "mesa",
           TRIM(pa.EQUIPOEVALUADOR)    AS "equipoEvaluador",
           pa.DINAMIZADORPERSONAID     AS "dinamizadorPersonaId",
           -- primero el texto libre (v51); si no hay, el nombre de la persona relacionada.
           -- TO_NCHAR: DINAMIZADOR es VARCHAR2 y los nombres NVARCHAR2
           TRIM(COALESCE(TO_NCHAR(pa.DINAMIZADOR),
                         TRIM(di.PERSONANOMBRES) || ' ' || TRIM(di.PERSONAPRIMERAPELLIDO))) AS "dinamizadorNombre"
      FROM EVALUADORPARTICIPACION pa
      LEFT JOIN ROLEVALUADOR         r  ON r.ROLEVALUADORID  = pa.ROLEVALUADORID
      LEFT JOIN PROCESOEVAL          pe ON pe.PROCESOID      = pa.PROCESOID
      LEFT JOIN MODALIDADPART        mo ON mo.MODALIDADPARTID = pa.MODALIDADPARTID
      LEFT JOIN AREAEVALUACION       ar ON ar.AREAID         = pa.AREAID
      LEFT JOIN ESTADOPARTICIPACION  es ON es.ESTADOPARTID   = pa.ESTADOPARTID
      LEFT JOIN EVALUADORCONVOCATORIA cv ON cv.CONVOCATORIAID = pa.CONVOCATORIAID
      LEFT JOIN PERSONA              di ON di.PERSONAID      = pa.DINAMIZADORPERSONAID`

  private async cargarParticipaciones(evaluadorId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `${this.SELECT_PARTICIPACION}
        WHERE pa.EVALUADORID = :1
        ORDER BY pa.ANIO DESC, pa.PERIODO NULLS FIRST, pa.PARTICIPACIONID DESC`,
      [evaluadorId],
    )
    return rows.map(r => this.normalizarParticipacion(r))
  }

  private async cargarCabecera(participacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `${this.SELECT_PARTICIPACION} WHERE pa.PARTICIPACIONID = :1`,
      [participacionId],
    )
    return rows[0] ? this.normalizarParticipacion(rows[0]) : null
  }

  private normalizarParticipacion(r: Record<string, unknown>) {
    return {
      ...r,
      participacionId: Number(r.participacionId),
      evaluadorId: Number(r.evaluadorId),
      anio: Number(r.anio),
      convocatoriaId: r.convocatoriaId != null ? Number(r.convocatoriaId) : null,
      esTransversal: Number(r.esTransversal) === 1,
      estadoFinal: Number(r.estadoFinal) === 1,
      estadoNegativo: Number(r.estadoNegativo) === 1,
      dinamizadorNombre: (r.dinamizadorNombre as string | null)?.trim() || null,
    }
  }

  // un solo SELECT con escalares para todos los ciclos, evita el N+1
  private async cargarContadores(evaluadorId: number): Promise<ContadoresRow[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pa.PARTICIPACIONID AS "participacionId",

         (SELECT COUNT(*) FROM CONVOCATORIADOCUMENTO cd
            JOIN TIPODOCUMENTOCONV tc ON tc.TIPODOCUMENTOCONVID = cd.TIPODOCUMENTOCONVID
           WHERE cd.CONVOCATORIAID = pa.CONVOCATORIAID
             AND UPPER(tc.CODIGO) = 'INVITACION')                     AS "tieneInvitacion",

         (SELECT COUNT(*) FROM EVALUADORAPROBACION ap
           WHERE ap.PARTICIPACIONID = pa.PARTICIPACIONID)             AS "tieneAprobacion",

         (SELECT COUNT(*) FROM EVALUADORDOCUMENTO ed
            JOIN TIPODOCUMENTOEVAL te ON te.TIPODOCUMENTOEVALID = ed.TIPODOCUMENTOEVALID
           WHERE ed.PARTICIPACIONID = pa.PARTICIPACIONID
             AND UPPER(te.CODIGO) = 'CONFIDENCIALIDAD')               AS "tieneConfidencialidad",

         (SELECT COUNT(*) FROM EVALUADORCAPACITACION ca
           WHERE ca.PARTICIPACIONID = pa.PARTICIPACIONID
             AND ca.APROBADO = 1)                                     AS "cursoAprobado",
         (SELECT MAX(ca.CALIFICACION) FROM EVALUADORCAPACITACION ca
           WHERE ca.PARTICIPACIONID = pa.PARTICIPACIONID)             AS "cursoCalificacion",

         -- PUNTAJEMINIMO es un corte PORCENTUAL: lo comparable es EFECTIVIDAD,
         -- no PUNTAJEMAYOR, que son aciertos crudos (41 sobre 50). Compararlos
         -- daba "41 >= 80" falso en 156 de las 180 pruebas del banco.
         (SELECT COUNT(*) FROM EVALUADORPRUEBA pr
           WHERE pr.PARTICIPACIONID = pa.PARTICIPACIONID
             AND (pr.APROBADA = 1
                  OR (pr.PUNTAJEMINIMO IS NOT NULL
                      AND pr.EFECTIVIDAD >= pr.PUNTAJEMINIMO)))       AS "pruebaAprobada",
         (SELECT MAX(pr.EFECTIVIDAD) FROM EVALUADORPRUEBA pr
           WHERE pr.PARTICIPACIONID = pa.PARTICIPACIONID)             AS "pruebaEfectividad",
         (SELECT MAX(pr.PUNTAJEMAYOR) FROM EVALUADORPRUEBA pr
           WHERE pr.PARTICIPACIONID = pa.PARTICIPACIONID)             AS "pruebaPuntaje",
         (SELECT MAX(pr.PUNTAJEMINIMO) FROM EVALUADORPRUEBA pr
           WHERE pr.PARTICIPACIONID = pa.PARTICIPACIONID)             AS "pruebaMinimo",

         CASE WHEN pa.MESA IS NOT NULL
               AND pa.EQUIPOEVALUADOR IS NOT NULL
               AND pa.PROCESOID IS NOT NULL
              THEN 1 ELSE 0 END                                       AS "tieneAsignacion",

         (SELECT COUNT(*) FROM EVALUADORPARTPROYECTO pp
           WHERE pp.PARTICIPACIONID = pa.PARTICIPACIONID)             AS "totalProyectos",

         (SELECT COUNT(*) FROM EVALUADORDOCUMENTO ed
           WHERE ed.PARTICIPACIONID = pa.PARTICIPACIONID)             AS "totalDocumentos",

         (SELECT COUNT(*) FROM RETROASIGNACION ra
           WHERE ra.PARTEVALUADORID = pa.PARTICIPACIONID
             AND ra.ESTADO <> 'ANULADA')                              AS "retroAsignadas",
         (SELECT COUNT(*) FROM RETROASIGNACION ra
           WHERE ra.PARTEVALUADORID = pa.PARTICIPACIONID
             AND ra.ESTADO = 'PENDIENTE')                             AS "retroPendientes",

         (SELECT COUNT(*) FROM RETRORESPUESTA rr
           WHERE rr.PARTEVALUADOID = pa.PARTICIPACIONID)              AS "retroRecibidas",
         (SELECT ROUND(AVG(rr.PROMEDIO), 2) FROM RETRORESPUESTA rr
           WHERE rr.PARTEVALUADOID = pa.PARTICIPACIONID)              AS "retroPromedio",
         (SELECT MIN(rr.PROMEDIO) FROM RETRORESPUESTA rr
           WHERE rr.PARTEVALUADOID = pa.PARTICIPACIONID)              AS "retroMinimo",
         (SELECT MAX(rr.PROMEDIO) FROM RETRORESPUESTA rr
           WHERE rr.PARTEVALUADOID = pa.PARTICIPACIONID)              AS "retroMaximo",

         (SELECT COUNT(*) FROM EVALUADORCERTIFICADO ce
           WHERE ce.PARTICIPACIONID = pa.PARTICIPACIONID
             AND ce.ANULADO = 0)                                      AS "tieneCertificado",
         -- los históricos se cargaron sin participación, solo con año
         (SELECT COUNT(*) FROM EVALUADORDOCUMENTO dc
            JOIN TIPODOCUMENTOEVAL td ON td.TIPODOCUMENTOEVALID = dc.TIPODOCUMENTOEVALID
           WHERE TRIM(td.CODIGO) = 'CERTIFICADO_PARTICIPACION'
             AND (dc.PARTICIPACIONID = pa.PARTICIPACIONID
               OR (dc.PARTICIPACIONID IS NULL
                   AND dc.EVALUADORID = pa.EVALUADORID
                   AND dc.ANIOREFERENCIA = pa.ANIO)))                 AS "certificadoCargado"

       FROM EVALUADORPARTICIPACION pa
      WHERE pa.EVALUADORID = :1`,
      [evaluadorId],
    )
    return rows as unknown as ContadoresRow[]
  }

  private async cargarAprobacion(participacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT ap.APROBACIONID                 AS "aprobacionId",
              TRIM(ap.APROBADORNOMBRE)        AS "aprobadorNombre",
              TRIM(ap.APROBADOREMAIL)         AS "aprobadorEmail",
              TRIM(ap.APROBADORCARGO)         AS "aprobadorCargo",
              ap.FECHAAPROBACION              AS "fechaAprobacion",
              TRIM(ap.CORREOEVIDENCIANOMBRE)  AS "evidenciaNombre",
              TRIM(ap.CORREOEVIDENCIAMIME)    AS "evidenciaMime",
              CASE WHEN ap.CORREOEVIDENCIA IS NULL THEN 0 ELSE 1 END AS "tieneEvidencia",
              TRIM(ap.OBSERVACIONES)          AS "observaciones"
         FROM EVALUADORAPROBACION ap
        WHERE ap.PARTICIPACIONID = :1`,
      [participacionId],
    )
    if (!rows[0]) return null
    return {
      ...rows[0],
      aprobacionId: Number(rows[0].aprobacionId),
      tieneEvidencia: Number(rows[0].tieneEvidencia) === 1,
    }
  }

  private async cargarCapacitaciones(participacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT ca.CAPACITACIONID       AS "capacitacionId",
              TRIM(ca.NOMBRE)         AS "nombre",
              TRIM(ca.ORIGEN)         AS "origen",
              TRIM(ca.PLATAFORMA)     AS "plataforma",
              ca.HORAS                AS "horas",
              ca.FECHAINICIO          AS "fechaInicio",
              ca.FECHAFIN             AS "fechaFin",
              ca.CALIFICACION         AS "calificacion",
              ca.CALIFICACIONMINIMA   AS "calificacionMinima",
              ca.APROBADO             AS "aprobado",
              ca.INTENTOS             AS "intentos",
              TRIM(ca.ARCHIVONOMBRE)  AS "archivoNombre",
              CASE WHEN ca.ARCHIVOPDF IS NULL THEN 0 ELSE 1 END AS "tieneArchivo",
              TRIM(ca.OBSERVACIONES)  AS "observaciones"
         FROM EVALUADORCAPACITACION ca
        WHERE ca.PARTICIPACIONID = :1
        ORDER BY ca.FECHAFIN DESC NULLS LAST, ca.CAPACITACIONID DESC`,
      [participacionId],
    )
    return rows.map(r => ({
      ...r,
      capacitacionId: Number(r.capacitacionId),
      aprobado: Number(r.aprobado) === 1,
      tieneArchivo: Number(r.tieneArchivo) === 1,
    }))
  }

  private async cargarPruebas(participacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pr.PRUEBAID         AS "pruebaId",
              pr.ANIO             AS "anio",
              TRIM(pr.PERIODO)    AS "periodo",
              pr.FECHAPRESENTACION AS "fechaPresentacion",
              TRIM(pr.HORARIO)    AS "horario",
              pr.INTENTOS         AS "intentos",
              pr.PUNTAJEMAYOR     AS "puntajeMayor",
              pr.PUNTAJEMINIMO    AS "puntajeMinimo",
              pr.APROBADA         AS "aprobada",
              pr.EFECTIVIDAD      AS "efectividad",
              pr.CORRECTAS        AS "correctas",
              pr.INCORRECTAS      AS "incorrectas",
              TRIM(pr.TOTALTIEMPO) AS "totalTiempo",
              TRIM(pr.OBSERVACION) AS "observacion"
         FROM EVALUADORPRUEBA pr
        WHERE pr.PARTICIPACIONID = :1
        ORDER BY pr.FECHAPRESENTACION DESC NULLS LAST, pr.PRUEBAID DESC`,
      [participacionId],
    )
    return rows.map(r => ({
      ...r,
      pruebaId: Number(r.pruebaId),
      anio: Number(r.anio),
      // el corte es porcentual: se compara con EFECTIVIDAD, no con los aciertos
      aprobada: this.esPruebaAprobada({
        aprobada: r.aprobada, porcentaje: r.efectividad, minimo: r.puntajeMinimo,
      }),
    }))
  }

  private async cargarGrupos(participacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pg.PARTGRUPOID AS "partGrupoId",
              pg.GRUPONUMERO AS "grupo",
              pg.ESPRINCIPAL AS "esPrincipal"
         FROM EVALUADORPARTGRUPO pg
        WHERE pg.PARTICIPACIONID = :1
        ORDER BY pg.GRUPONUMERO`,
      [participacionId],
    )
    return rows.map(r => ({
      partGrupoId: Number(r.partGrupoId),
      grupo: Number(r.grupo),
      esPrincipal: Number(r.esPrincipal) === 1,
    }))
  }

  private async cargarAlcance(participacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT al.PARTALCANCEID          AS "partAlcanceId",
              al.AREAID                 AS "areaId",
              TRIM(ar.NOMBRE)           AS "areaNombre",
              al.ROLEVALUADORID         AS "rolEvaluadorId",
              TRIM(r.ROLEVALUADORNOMBRE) AS "rolNombre"
         FROM EVALUADORPARTALCANCE al
         JOIN AREAEVALUACION ar ON ar.AREAID = al.AREAID
         JOIN ROLEVALUADOR   r  ON r.ROLEVALUADORID = al.ROLEVALUADORID
        WHERE al.PARTICIPACIONID = :1
        ORDER BY ar.ORDEN, r.ROLEVALUADORORDEN`,
      [participacionId],
    )
    return rows.map(r => ({ ...r, partAlcanceId: Number(r.partAlcanceId) }))
  }

  // el NIT y la razón social salen del proyecto real; la copia de la pivote solo sirve para históricos
  private async cargarProyectos(participacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pp.PARTPROYECTOID     AS "partProyectoId",
              pp.PROYECTOID         AS "proyectoId",
              pp.GUARDADOID         AS "guardadoId",
              -- TO_NCHAR: el NIT es NUMBER en EMPRESA y NVARCHAR2 en las otras (ORA-12704)
              COALESCE(TO_NCHAR(em.EMPRESAIDENTIFICACION), TRIM(g.NIT),
                       TRIM(pp.NIT))                    AS "nit",
              COALESCE(TRIM(em.EMPRESARAZONSOCIAL), TRIM(g.RAZONSOCIAL),
                       TRIM(pp.RAZONSOCIAL))            AS "razonSocial",
              COALESCE(TRIM(pr.PROYECTONOMBRE), TRIM(g.NOMBREPROYECTO),
                       TRIM(pp.NOMBREPROYECTO))         AS "nombreProyecto",
              pp.PUNTAJEOTORGADO    AS "puntajeOtorgado",
              pp.FECHAEVALUACION    AS "fechaEvaluacion",
              TRIM(pp.OBSERVACIONES) AS "observaciones",
              CASE WHEN pp.PROYECTOID IS NOT NULL THEN 'PROYECTO'
                   WHEN pp.GUARDADOID IS NOT NULL THEN 'FORMULADO'
                   ELSE 'HISTORICO' END AS "origen"
         FROM EVALUADORPARTPROYECTO pp
         LEFT JOIN PROYECTO pr ON pr.PROYECTOID = pp.PROYECTOID
         LEFT JOIN EMPRESA  em ON em.EMPRESAID  = pr.EMPRESAID
         LEFT JOIN CONVPROYGUARDADO g ON g.GUARDADOID = pp.GUARDADOID
        WHERE pp.PARTICIPACIONID = :1
        ORDER BY pp.FECHAEVALUACION DESC NULLS LAST, pp.PARTPROYECTOID`,
      [participacionId],
    )
    return rows.map(r => ({
      ...r,
      partProyectoId: Number(r.partProyectoId),
      proyectoId: r.proyectoId != null ? Number(r.proyectoId) : null,
      guardadoId: r.guardadoId != null ? Number(r.guardadoId) : null,
    }))
  }

  private async cargarDocumentosPropios(participacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT ed.DOCUMENTOID            AS "documentoId",
              ed.TIPODOCUMENTOEVALID    AS "tipoId",
              TRIM(te.CODIGO)           AS "tipoCodigo",
              TRIM(te.NOMBRE)           AS "tipoNombre",
              TRIM(ed.DOCUMENTODESCRIPCION) AS "descripcion",
              ed.ANIOREFERENCIA         AS "anioReferencia",
              TRIM(ed.ARCHIVONOMBRE)    AS "archivoNombre",
              TRIM(ed.ARCHIVOMIME)      AS "mime",
              ed.FECHACARGUE            AS "fechaCargue"
         FROM EVALUADORDOCUMENTO ed
         JOIN TIPODOCUMENTOEVAL te ON te.TIPODOCUMENTOEVALID = ed.TIPODOCUMENTOEVALID
        WHERE ed.PARTICIPACIONID = :1
        ORDER BY te.ORDEN, ed.FECHACARGUE DESC`,
      [participacionId],
    )
    return rows.map(r => ({ ...r, documentoId: Number(r.documentoId), ambito: 'PROPIO' }))
  }

  // viven en la convocatoria y los comparten todos sus evaluadores: solo lectura
  private async cargarDocumentosHeredados(convocatoriaId: number | null) {
    if (!convocatoriaId) return []
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT cd.DOCUMENTOID           AS "documentoId",
              cd.TIPODOCUMENTOCONVID   AS "tipoId",
              TRIM(tc.CODIGO)          AS "tipoCodigo",
              TRIM(tc.NOMBRE)          AS "tipoNombre",
              TRIM(cd.DOCUMENTODESCRIPCION) AS "descripcion",
              TRIM(cd.ARCHIVONOMBRE)   AS "archivoNombre",
              TRIM(cd.ARCHIVOMIME)     AS "mime",
              cd.FECHACARGUE           AS "fechaCargue"
         FROM CONVOCATORIADOCUMENTO cd
         JOIN TIPODOCUMENTOCONV tc ON tc.TIPODOCUMENTOCONVID = cd.TIPODOCUMENTOCONVID
        WHERE cd.CONVOCATORIAID = :1
        ORDER BY tc.ORDEN, cd.FECHACARGUE DESC`,
      [convocatoriaId],
    )
    return rows.map(r => ({
      ...r,
      documentoId: Number(r.documentoId),
      ambito: 'HEREDADO',
      soloLectura: true,
      convocatoriaId,
    }))
  }

  private async cargarDocumentosPermanentes(evaluadorId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT ed.DOCUMENTOID            AS "documentoId",
              ed.TIPODOCUMENTOEVALID    AS "tipoId",
              TRIM(te.CODIGO)           AS "tipoCodigo",
              TRIM(te.NOMBRE)           AS "tipoNombre",
              TRIM(ed.DOCUMENTODESCRIPCION) AS "descripcion",
              -- un permanente con año pertenece a ese ciclo
              ed.ANIOREFERENCIA         AS "anioReferencia",
              TRIM(ed.ARCHIVONOMBRE)    AS "archivoNombre",
              TRIM(ed.ARCHIVOMIME)      AS "mime",
              ed.FECHACARGUE            AS "fechaCargue"
         FROM EVALUADORDOCUMENTO ed
         JOIN TIPODOCUMENTOEVAL te ON te.TIPODOCUMENTOEVALID = ed.TIPODOCUMENTOEVALID
        WHERE ed.EVALUADORID = :1
          AND ed.PARTICIPACIONID IS NULL
        ORDER BY te.ORDEN, ed.FECHACARGUE DESC`,
      [evaluadorId],
    )
    return rows.map(r => ({ ...r, documentoId: Number(r.documentoId), ambito: 'PERMANENTE' }))
  }

  private async cargarCertificado(participacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT ce.CERTIFICADOID          AS "certificadoId",
              ce.ANIO                   AS "anio",
              ce.CONSECUTIVO            AS "consecutivo",
              TRIM(ce.CODIGOVERIFICACION) AS "codigoVerificacion",
              ce.FECHAEMISION           AS "fechaEmision",
              TRIM(ce.EMITIDOPOR)       AS "emitidoPor",
              ce.HORASCERTIFICADAS      AS "horas",
              ce.ANULADO                AS "anulado",
              TRIM(ce.MOTIVOANULACION)  AS "motivoAnulacion"
         FROM EVALUADORCERTIFICADO ce
        WHERE ce.PARTICIPACIONID = :1
        ORDER BY ce.ANULADO, ce.CERTIFICADOID DESC
        FETCH FIRST 1 ROWS ONLY`,
      [participacionId],
    )
    if (!rows[0]) return null
    return {
      ...rows[0],
      certificadoId: Number(rows[0].certificadoId),
      consecutivo: Number(rows[0].consecutivo),
      anulado: Number(rows[0].anulado) === 1,
    }
  }
}
