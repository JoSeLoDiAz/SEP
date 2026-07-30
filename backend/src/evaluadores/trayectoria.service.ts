import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { bindRepetido } from '../common/db/binds'

/**
 * Trayectoria del evaluador — la vista por año del banco.
 *
 * Mientras `EvaluadoresService` sigue siendo el CRUD plano de la ficha, este
 * servicio arma la vista agregada que consume el panel: el rail de años, el
 * estado de cada ciclo y el detalle de un ciclo concreto.
 *
 * Regla que gobierna todo el archivo: **una llamada por pantalla**. El rail
 * completo sale de dos consultas, no de una por participación.
 */

/** Hito del checklist de un ciclo. Se calcula, nunca se guarda. */
export interface Hito {
  codigo: string
  nombre: string
  cumplido: boolean
  /** Detalle corto para el tooltip (ej. "Puntaje 92 / mínimo 80"). */
  detalle?: string | null
}

export interface ProgresoCiclo {
  cumplidos: number
  total: number
  hitos: Hito[]
}

/** Códigos del catálogo ESTADOPARTICIPACION (v29). */
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

/** Filas crudas de los contadores por participación. */
interface ContadoresRow {
  participacionId: number
  tieneInvitacion: number
  tieneAprobacion: number
  tieneConfidencialidad: number
  cursoAprobado: number
  cursoCalificacion: number | null
  pruebaAprobada: number
  pruebaPuntaje: number | null
  pruebaMinimo: number | null
  tieneAsignacion: number
  totalProyectos: number
  totalDocumentos: number
  retroAsignadas: number
  retroPendientes: number
  retroRecibidas: number
  retroPromedio: number | null
  tieneCertificado: number
}

@Injectable()
export class TrayectoriaService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Resumen — los KPIs del hero                                           ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  async getResumen(evaluadorId: number) {
    await this.exigirEvaluador(evaluadorId)

    // Los estados con ESNEGATIVO = 1 (declinó / no aprobó / revocado) se
    // excluyen del promedio de desempeño: un año en que no participó no debe
    // contar como mala calificación.
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
         (SELECT COUNT(*)
            FROM EVALUADORCERTIFICADO c
            JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = c.PARTICIPACIONID
           WHERE pa.EVALUADORID = :ev AND c.ANULADO = 0)               AS "totalCertificados",
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

    // Prueba vigente = la más reciente aprobada. "Vigente" se interpreta como
    // del año en curso o del anterior; más atrás se considera vencida.
    const pruebaRows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pr.ANIO           AS "anio",
              pr.PUNTAJEMAYOR   AS "puntaje",
              pr.PUNTAJEMINIMO  AS "minimo",
              pr.APROBADA       AS "aprobada"
         FROM EVALUADORPRUEBA pr
        WHERE pr.EVALUADORID = :1
        ORDER BY pr.ANIO DESC, pr.PRUEBAID DESC
        FETCH FIRST 1 ROWS ONLY`,
      [evaluadorId],
    )
    const ultimaPrueba = pruebaRows[0]
    const anioActual = new Date().getFullYear()
    const aprobada = ultimaPrueba ? this.esPruebaAprobada(ultimaPrueba) : false

    return {
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
            aprobada,
            vigente: aprobada && Number(ultimaPrueba.anio) >= anioActual - 1,
          }
        : null,
    }
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Trayectoria — el rail de años                                         ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  /**
   * Devuelve los años del evaluador en orden descendente. Cada año trae sus
   * participaciones con estado, progreso y contadores.
   *
   * Incluye además los años que solo tienen pruebas sueltas (histórico
   * 2021-2023 sin participación asociada): en el rail salen marcados como
   * `soloPrueba` en vez de desaparecer.
   */
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

    // Años con prueba pero sin ninguna participación → histórico suelto.
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
        // El año ya existe: las pruebas sueltas se anotan pero no lo marcan.
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

    // Los huecos se marcan explícitamente para que el rail no comprima la
    // línea de tiempo: un año en blanco entre dos activos es información.
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

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Detalle de un ciclo                                                   ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  /**
   * Todo lo del año en una sola respuesta: ficha, aprobación, capacitación,
   * pruebas, grupos, proyectos, documentos propios y heredados.
   *
   * Los documentos vienen en tres bloques porque significan cosas distintas:
   *   - propios      → EVALUADORDOCUMENTO con este PARTICIPACIONID
   *   - heredados    → CONVOCATORIADOCUMENTO del ciclo (compartidos, solo lectura)
   *   - permanentes  → EVALUADORDOCUMENTO sin participación (cédula, HV)
   */
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
      },
    }
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Checklist y estado sugerido                                           ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  /**
   * Los nueve hitos del ciclo. Todos se derivan de los datos cargados — nadie
   * marca casillas, así que el progreso no puede mentir respecto de los
   * archivos que hay en el sistema.
   */
  private calcularProgreso(
    cabecera: Record<string, unknown>,
    c: ContadoresRow | undefined,
  ): ProgresoCiclo {
    const n = (v: unknown) => Number(v ?? 0)

    const puntaje = c?.pruebaPuntaje != null ? Number(c.pruebaPuntaje) : null
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
        detalle: puntaje != null
          ? `Puntaje ${puntaje}${minimo != null ? ` / mínimo ${minimo}` : ''}`
          : null,
      },
      {
        // El nombre menciona el proceso porque la condición lo exige: sin él
        // el hito no enciende, y decir solo "mesa y equipo" hacía parecer que
        // faltaba algo distinto de lo que realmente faltaba.
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
        nombre: 'Retroalimentación diligenciada',
        // Solo cuenta como hito si le asignaron pares. Sin asignaciones no hay
        // nada que diligenciar, y marcarlo en rojo sería culpar al evaluador
        // de algo que no depende de él.
        cumplido: n(c?.retroAsignadas) > 0 && n(c?.retroPendientes) === 0,
        detalle: n(c?.retroAsignadas) > 0
          ? `${n(c?.retroAsignadas) - n(c?.retroPendientes)} de ${n(c?.retroAsignadas)}`
          : 'Sin asignaciones',
      },
      {
        codigo: 'CERTIFICADO',
        nombre: 'Certificado emitido',
        cumplido: n(c?.tieneCertificado) > 0,
      },
    ]

    return {
      cumplidos: hitos.filter(h => h.cumplido).length,
      total: hitos.length,
      hitos,
    }
  }

  /**
   * Estado que el checklist sugiere. El estado real lo declara una persona
   * (DECLINO no se deduce de nada), así que esto solo alimenta el aviso de
   * "el estado guardado no coincide con lo que hay cargado".
   */
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

  private esPruebaAprobada(p: Record<string, unknown>): boolean {
    if (Number(p.aprobada ?? 0) === 1) return true
    // El histórico anterior a v34 no tiene APROBADA; se infiere del corte
    // cuando ambos valores existen.
    if (p.puntaje == null || p.minimo == null) return false
    return Number(p.puntaje) >= Number(p.minimo)
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Consultas                                                             ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  private async exigirEvaluador(evaluadorId: number) {
    if (!evaluadorId || Number.isNaN(evaluadorId)) {
      throw new BadRequestException('Identificador de evaluador inválido')
    }
    const ok = await this.dataSource.query(
      `SELECT 1 FROM EVALUADOR WHERE EVALUADORID = :1`, [evaluadorId],
    )
    if (!ok[0]) throw new NotFoundException('Evaluador no encontrado')
  }

  /** Columnas comunes de una participación, con todos los catálogos resueltos. */
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
           NVL(pa.ESTRANSVERSAL, 0)    AS "esTransversal",
           TRIM(pa.MOTIVONOPARTICIPA)  AS "motivoNoParticipa",
           pa.FECHAINICIO              AS "fechaInicio",
           pa.FECHAFIN                 AS "fechaFin",
           TRIM(pa.MESA)               AS "mesa",
           TRIM(pa.EQUIPOEVALUADOR)    AS "equipoEvaluador",
           pa.DINAMIZADORPERSONAID     AS "dinamizadorPersonaId",
           TRIM(di.PERSONANOMBRES) || ' ' || TRIM(di.PERSONAPRIMERAPELLIDO) AS "dinamizadorNombre"
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

  /**
   * Un solo SELECT con subconsultas escalares para todos los ciclos del
   * evaluador. Evita el N+1 que tendría el frontend si pidiera cada bloque por
   * separado, y como el N por evaluador es de una decena de filas, el costo de
   * las escalares es despreciable frente a diez round-trips.
   */
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

         (SELECT COUNT(*) FROM EVALUADORPRUEBA pr
           WHERE pr.PARTICIPACIONID = pa.PARTICIPACIONID
             AND (pr.APROBADA = 1
                  OR (pr.PUNTAJEMINIMO IS NOT NULL
                      AND pr.PUNTAJEMAYOR >= pr.PUNTAJEMINIMO)))      AS "pruebaAprobada",
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

         (SELECT COUNT(*) FROM EVALUADORCERTIFICADO ce
           WHERE ce.PARTICIPACIONID = pa.PARTICIPACIONID
             AND ce.ANULADO = 0)                                      AS "tieneCertificado"

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
      aprobada: this.esPruebaAprobada({
        aprobada: r.aprobada, puntaje: r.puntajeMayor, minimo: r.puntajeMinimo,
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

  /**
   * Los proyectos que evaluó en un ciclo.
   *
   * El NIT y la razón social se resuelven contra el proyecto real, no contra
   * la copia de la tabla pivote: al asignar desde la pantalla solo se guarda
   * el identificador, así que esas columnas quedan vacías y la lista salía
   * entera como "Sin identificar". La copia solo manda para los registros
   * históricos escritos a mano, que no apuntan a ningún proyecto.
   */
  private async cargarProyectos(participacionId: number) {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pp.PARTPROYECTOID     AS "partProyectoId",
              pp.PROYECTOID         AS "proyectoId",
              pp.GUARDADOID         AS "guardadoId",
              -- TO_NCHAR sobre el NIT: en EMPRESA es NUMBER y las otras dos
              -- son NVARCHAR2. Sin igualar el juego de caracteres, el COALESCE
              -- falla con ORA-12704 y la pestaña entera se cae.
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

  /**
   * Documentos generales del ciclo. Viven una sola vez en la convocatoria y se
   * muestran en la ficha de todos sus evaluadores — por eso van marcados como
   * solo lectura: editarlos desde aquí afectaría a los demás sin que se note.
   */
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
