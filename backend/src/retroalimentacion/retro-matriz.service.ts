import { Injectable, Logger } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

/**
 * Motor de la matriz de retroalimentación.
 *
 * Port 1:1 de `helpers/eval/matriz.js` del sistema FormularioInscripcionGGPC.
 * Las reglas vienen del correo del área y ya corrieron un ciclo real, así que
 * se conserva la lógica tal cual. Dos cambios respecto del original:
 *
 *   1. La unidad no es una persona sino una PARTICIPACIÓN. El rol, el área y
 *      los grupos son contexto del año, no atributos permanentes de la
 *      persona — que es justo lo que el rediseño por año vino a arreglar.
 *   2. Los mapas de grupos por área, que estaban hardcodeados, salen de
 *      `AREAEVALUACION.GRUPOSDEFECTO` y pueden sobrescribirse por convocatoria
 *      con `RETROFORMULARIO.REGLASMATRIZ`. Cambiar la topología de un año ya
 *      no exige desplegar.
 *
 * El servicio NO escribe: calcula y devuelve los pares. Persistirlos es
 * decisión de quien lo llama, y así el preview es gratis.
 */

/** Una participación vista por el motor. */
export interface NodoMatriz {
  participacionId: number
  evaluadorId: number
  nombre: string
  rol: string          // código: LIDER, ANALISTA, EVALUADOR, APOYO_TECNICO…
  area: string         // código: TECNICA, JURIDICA, FINANCIERA
  grupos: number[]
  esTransversal: boolean
  alcance: Array<{ area: string; roles: string[] }>
}

export interface Par {
  evaluadorParticipacionId: number
  evaluadoParticipacionId: number
  /** Regla que produjo el par. Sirve para auditar y depurar la matriz. */
  motivo: string
}

export interface ResultadoMatriz {
  pares: Par[]
  stats: {
    totalPares: number
    totalParticipantes: number
    sinEvaluar: Array<{ participacionId: number; nombre: string; rol: string; area: string }>
    sinSerEvaluado: Array<{ participacionId: number; nombre: string; rol: string; area: string }>
    porRegla: Record<string, number>
  }
}

/** Configuración de topología. Se puede sobrescribir por convocatoria. */
export interface ReglasMatriz {
  gruposPorArea: Record<string, number[]>
  /** Apoyos que un líder o analista técnico evalúa como "apoyos del grupo". */
  apoyosDeGrupo: string[]
  /** Si es false, no se generan pares entre iguales del mismo rol y grupo. */
  peerEvaluation: boolean
  /**
   * Alcance forzado para transversales concretos, por si el registrado en
   * `EVALUADORPARTALCANCE` quedó desactualizado y no da tiempo de corregirlo
   * antes de generar.
   *
   * Es una válvula de escape, no el camino normal: lo correcto es arreglar el
   * dato del año. El motor original resolvió esto con cinco nombres propios
   * hardcodeados en el código; aquí vive en la configuración de la
   * convocatoria para que un cambio de personas no obligue a desplegar y para
   * que quede escrito de quién se está hablando.
   */
  alcanceForzado: Array<{ nombreContiene: string; alcance: Array<{ area: string; roles: string[] }> }>
}

const REGLAS_DEFECTO: ReglasMatriz = {
  gruposPorArea: { TECNICA: [1, 2, 3, 4, 5, 6], FINANCIERA: [7], JURIDICA: [8] },
  apoyosDeGrupo: ['APOYO_TECNICO', 'APOYO_PRESUPUESTAL', 'APOYO_JURIDICO'],
  peerEvaluation: true,
  // Vacío a propósito: en SEP el alcance es dato por participación y por año,
  // así que por defecto manda la base de datos.
  alcanceForzado: [],
}

@Injectable()
export class RetroMatrizService {
  private readonly logger = new Logger(RetroMatrizService.name)

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Entrada principal                                                     ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  /**
   * Calcula todos los pares que deberían existir en una convocatoria.
   * No persiste nada — el preview y la generación usan exactamente el mismo
   * cálculo, así que lo que se ve en el preview es lo que se va a guardar.
   */
  async calcular(convocatoriaId: number, reglasJson?: string | null): Promise<ResultadoMatriz> {
    const nodos = await this.cargarNodos(convocatoriaId)
    const reglas = this.resolverReglas(reglasJson)
    return this.calcularSobre(nodos, reglas)
  }

  /** Separado de la carga para poder testear el algoritmo sin base de datos. */
  calcularSobre(nodos: NodoMatriz[], reglas: ReglasMatriz = REGLAS_DEFECTO): ResultadoMatriz {
    const pares: Par[] = []
    const vistos = new Set<string>()
    const porRegla: Record<string, number> = {}

    const agregar = (a: NodoMatriz | undefined, b: NodoMatriz | undefined, motivo: string) => {
      if (!a || !b) return
      if (a.participacionId === b.participacionId) return   // sin autoevaluación
      const clave = `${a.participacionId}::${b.participacionId}`
      if (vistos.has(clave)) return
      vistos.add(clave)
      pares.push({
        evaluadorParticipacionId: a.participacionId,
        evaluadoParticipacionId: b.participacionId,
        motivo,
      })
      porRegla[motivo] = (porRegla[motivo] ?? 0) + 1
    }

    const gruposDe = (area: string) => reglas.gruposPorArea[area] ?? []
    const GRUPOS_TECNICOS = gruposDe('TECNICA')
    const APOYOS = reglas.apoyosDeGrupo

    const conRolEnGrupo = (rol: string, g: number) =>
      nodos.filter(n => n.rol === rol && n.grupos.includes(g))
    const conRolesEnGrupo = (roles: string[], g: number) =>
      nodos.filter(n => roles.includes(n.rol) && n.grupos.includes(g))
    const lideresDe = (area: string) =>
      nodos.filter(n => n.area === area && n.rol === 'LIDER')

    for (const p of nodos) {
      // ── Transversales: alcance explícito {área, roles[]} ────────────────
      // Matchea por área exacta O por participar en algún grupo del área. Lo
      // segundo cubre al apoyo jurídico que tiene área JURIDICA pero trabaja
      // en grupos técnicos: un transversal técnico también debe alcanzarlo.
      if (p.esTransversal) {
        for (const al of this.alcanceDe(p, reglas)) {
          const gruposArea = gruposDe(al.area)
          const candidatos = nodos.filter(c => {
            if (!al.roles.includes(c.rol)) return false
            if (c.area === al.area) return true
            return c.grupos.some(g => gruposArea.includes(g))
          })
          for (const c of candidatos) agregar(p, c, `transversal→${al.area.toLowerCase()}`)
        }
        continue
      }

      // ── Área técnica ────────────────────────────────────────────────────
      if (p.area === 'TECNICA') {
        if (p.rol === 'LIDER') {
          // Evalúa a TODOS los analistas y apoyos que participen en algún
          // grupo técnico, sin importar su área nominal.
          for (const c of nodos) {
            if (c.rol !== 'ANALISTA' && !APOYOS.includes(c.rol)) continue
            if (c.grupos.some(g => GRUPOS_TECNICOS.includes(g))) {
              agregar(p, c, 'lider-tecnica→analistas-y-apoyos')
            }
          }
        } else if (p.rol === 'ANALISTA') {
          for (const lider of lideresDe('TECNICA')) agregar(p, lider, 'analista→lider-tecnica')
          for (const g of p.grupos) {
            for (const c of conRolEnGrupo('EVALUADOR', g)) agregar(p, c, 'analista→evaluadores-de-su-grupo')
            for (const c of conRolesEnGrupo(APOYOS, g)) agregar(p, c, 'analista→apoyos-de-su-grupo')
          }
        } else if (p.rol === 'EVALUADOR') {
          for (const g of p.grupos) {
            for (const c of conRolEnGrupo('ANALISTA', g)) agregar(p, c, 'evaluador→analista-de-su-grupo')
            for (const c of conRolesEnGrupo(APOYOS, g)) agregar(p, c, 'evaluador→apoyos-de-su-grupo')
          }
        } else if (p.rol === 'APOYO_TECNICO' || p.rol === 'APOYO_PRESUPUESTAL') {
          for (const g of p.grupos) {
            for (const c of conRolEnGrupo('ANALISTA', g)) agregar(p, c, 'apoyo→analista-de-su-grupo')
            for (const c of conRolEnGrupo('EVALUADOR', g)) agregar(p, c, 'apoyo→evaluadores-de-su-grupo')
          }
        }
        // APOYO_JURIDICO con área técnica no evalúa por esta vía (así está en
        // el correo original); lo cubre el bloque de grupos técnicos de abajo.
      }

      // ── Área jurídica ───────────────────────────────────────────────────
      const gruposJuridica = gruposDe('JURIDICA')
      if (p.area === 'JURIDICA' && p.grupos.some(g => gruposJuridica.includes(g))) {
        const enArea = nodos.filter(
          c => c.area === 'JURIDICA' && c.grupos.some(g => gruposJuridica.includes(g)),
        )
        if (p.rol === 'EVALUADOR') {
          for (const c of enArea) {
            if (['LIDER', 'ANALISTA', 'APOYO_JURIDICO'].includes(c.rol)) {
              agregar(p, c, 'evaluador-juridica→lider-y-apoyos')
            }
          }
        } else if (p.rol === 'ANALISTA' || p.rol === 'LIDER') {
          for (const c of enArea) {
            if (['EVALUADOR', 'APOYO_JURIDICO'].includes(c.rol)) {
              agregar(p, c, 'lider-juridica→evaluadores-y-apoyos')
            }
          }
        } else if (p.rol === 'APOYO_JURIDICO') {
          for (const c of enArea) {
            if (['EVALUADOR', 'LIDER', 'ANALISTA'].includes(c.rol)) {
              agregar(p, c, 'apoyo-juridico→evaluadores-y-lider')
            }
          }
        }
      }

      // ── Apoyo jurídico que además está en grupos técnicos ───────────────
      // Caso real: un apoyo jurídico con grupos [1, 2, 8]. En sus grupos
      // técnicos evalúa igual que cualquier otro apoyo del grupo.
      if (p.rol === 'APOYO_JURIDICO') {
        for (const g of p.grupos.filter(g => GRUPOS_TECNICOS.includes(g))) {
          for (const c of conRolEnGrupo('ANALISTA', g)) agregar(p, c, 'apoyo-juridico→analista-grupo-tecnico')
          for (const c of conRolEnGrupo('EVALUADOR', g)) agregar(p, c, 'apoyo-juridico→evaluadores-grupo-tecnico')
        }
      }

      // ── Área financiera ─────────────────────────────────────────────────
      // Los "apoyos financieros" del correo son en la práctica apoyos
      // presupuestales asignados al grupo financiero; se tratan igual.
      const gruposFin = gruposDe('FINANCIERA')
      const enFinanciera = p.grupos.some(g => gruposFin.includes(g))

      if (p.area === 'FINANCIERA' && enFinanciera && p.rol === 'LIDER') {
        for (const c of nodos) {
          if (c.participacionId === p.participacionId) continue
          const enGrupoFin = c.grupos.some(g => gruposFin.includes(g))
          if (c.rol === 'LIDER' && c.area === 'FINANCIERA' && enGrupoFin) {
            agregar(p, c, 'lider-financiera→otros-lideres')
          }
          if ((c.rol === 'APOYO_FINANCIERO' || c.rol === 'APOYO_PRESUPUESTAL') && enGrupoFin) {
            agregar(p, c, 'lider-financiera→apoyos')
          }
          // Las líderes financieras también retroalimentan a los transversales
          // de su área. El filtro de grupo NO aplica aquí: un transversal no
          // pertenece a un grupo, y exigírselo lo dejaba fuera — era la causa
          // de que a los transversales nadie los evaluara.
          if (c.esTransversal && c.area === 'FINANCIERA') {
            agregar(p, c, 'lider-financiera→transversales')
          }
        }
      }
      // Simetría: los apoyos del grupo financiero evalúan a sus líderes.
      if ((p.rol === 'APOYO_FINANCIERO' || p.rol === 'APOYO_PRESUPUESTAL') && enFinanciera) {
        for (const c of nodos) {
          if (!c.grupos.some(g => gruposFin.includes(g))) continue
          if (c.rol === 'LIDER' && c.area === 'FINANCIERA') agregar(p, c, 'apoyo-financiera→lider')
        }
      }

      // ── Evaluación entre pares del mismo rol y grupo ────────────────────
      // En un grupo con cuatro evaluadores, cada uno evalúa a los otros tres.
      // No aplica a transversales: ellos ya tienen su alcance explícito.
      if (reglas.peerEvaluation) {
        for (const g of p.grupos) {
          for (const c of nodos) {
            if (c.rol !== p.rol || c.area !== p.area) continue
            if (!c.grupos.includes(g)) continue
            agregar(p, c, 'pares-mismo-rol-y-grupo')
          }
        }
      }
    }

    const evaluadores = new Set(pares.map(x => x.evaluadorParticipacionId))
    const evaluados = new Set(pares.map(x => x.evaluadoParticipacionId))
    const resumir = (n: NodoMatriz) => ({
      participacionId: n.participacionId, nombre: n.nombre, rol: n.rol, area: n.area,
    })

    return {
      pares,
      stats: {
        totalPares: pares.length,
        totalParticipantes: nodos.length,
        sinEvaluar: nodos.filter(n => !evaluadores.has(n.participacionId)).map(resumir),
        sinSerEvaluado: nodos.filter(n => !evaluados.has(n.participacionId)).map(resumir),
        porRegla,
      },
    }
  }

  /**
   * Alcance efectivo de un transversal: el forzado en la configuración del
   * ciclo si alguien lo puso, y si no el registrado en su participación.
   *
   * Se expone en el preview (`alcanceEfectivo`) para que quien genera vea con
   * qué reglas va a salir la matriz ANTES de escribirla. Un override
   * silencioso sería peor que el dato desactualizado que viene a corregir.
   */
  alcanceDe(nodo: NodoMatriz, reglas: ReglasMatriz): Array<{ area: string; roles: string[] }> {
    const forzado = (reglas.alcanceForzado ?? []).find(f =>
      (nodo.nombre ?? '').toLowerCase().includes((f.nombreContiene ?? '').toLowerCase()) &&
      (f.nombreContiene ?? '').trim().length > 0,
    )
    if (!forzado) return nodo.alcance
    return forzado.alcance.map(a => ({
      area: (a.area ?? '').toUpperCase(),
      roles: (a.roles ?? []).map(r => (r ?? '').toUpperCase()),
    }))
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ Carga de datos                                                        ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  /**
   * Participaciones de la convocatoria que entran a la matriz.
   *
   * Se excluyen los ciclos cerrados en negativo (declinó, no aprobó,
   * revocado): asignarle pares a alguien que no participó genera trabajo
   * imposible de completar y ensucia el reporte de avance.
   */
  async cargarNodos(convocatoriaId: number): Promise<NodoMatriz[]> {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT pa.PARTICIPACIONID  AS "participacionId",
              pa.EVALUADORID      AS "evaluadorId",
              TRIM(p.PERSONANOMBRES) || ' ' || TRIM(p.PERSONAPRIMERAPELLIDO) AS "nombre",
              TRIM(r.ROLEVALUADORCODIGO) AS "rol",
              TRIM(ar.CODIGO)     AS "area",
              NVL(pa.ESTRANSVERSAL, 0)   AS "esTransversal"
         FROM EVALUADORPARTICIPACION pa
         JOIN EVALUADOR e  ON e.EVALUADORID = pa.EVALUADORID
         JOIN PERSONA   p  ON p.PERSONAID   = e.PERSONAID
         LEFT JOIN ROLEVALUADOR    r  ON r.ROLEVALUADORID = pa.ROLEVALUADORID
         LEFT JOIN AREAEVALUACION  ar ON ar.AREAID        = pa.AREAID
         LEFT JOIN ESTADOPARTICIPACION es ON es.ESTADOPARTID = pa.ESTADOPARTID
        WHERE pa.CONVOCATORIAID = :1
          AND NVL(es.ESNEGATIVO, 0) = 0
        ORDER BY pa.PARTICIPACIONID`,
      [convocatoriaId],
    )
    if (filas.length === 0) return []

    const ids = filas.map(f => Number(f.participacionId))
    const [grupos, alcances] = await Promise.all([
      this.cargarGrupos(convocatoriaId),
      this.cargarAlcances(convocatoriaId),
    ])

    return filas.map(f => {
      const id = Number(f.participacionId)
      return {
        participacionId: id,
        evaluadorId: Number(f.evaluadorId),
        nombre: (f.nombre as string ?? '').trim() || `Participación ${id}`,
        rol: (f.rol as string ?? '').trim().toUpperCase(),
        area: (f.area as string ?? '').trim().toUpperCase(),
        grupos: grupos.get(id) ?? [],
        esTransversal: Number(f.esTransversal) === 1,
        alcance: alcances.get(id) ?? [],
      }
    }).filter(n => {
      // Sin rol no hay regla que aplicar. Se avisa en el log para que se note
      // en el preview en vez de desaparecer sin explicación.
      if (!n.rol) this.logger.warn(`Participación ${n.participacionId} sin rol: queda fuera de la matriz`)
      return !!n.rol && ids.includes(n.participacionId)
    })
  }

  private async cargarGrupos(convocatoriaId: number): Promise<Map<number, number[]>> {
    const filas: Array<{ participacionId: number; grupo: number }> = await this.dataSource.query(
      `SELECT pg.PARTICIPACIONID AS "participacionId", pg.GRUPONUMERO AS "grupo"
         FROM EVALUADORPARTGRUPO pg
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = pg.PARTICIPACIONID
        WHERE pa.CONVOCATORIAID = :1
        ORDER BY pg.GRUPONUMERO`,
      [convocatoriaId],
    )
    const mapa = new Map<number, number[]>()
    for (const f of filas) {
      const id = Number(f.participacionId)
      if (!mapa.has(id)) mapa.set(id, [])
      mapa.get(id)!.push(Number(f.grupo))
    }
    return mapa
  }

  private async cargarAlcances(
    convocatoriaId: number,
  ): Promise<Map<number, Array<{ area: string; roles: string[] }>>> {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT al.PARTICIPACIONID AS "participacionId",
              TRIM(ar.CODIGO)    AS "area",
              TRIM(r.ROLEVALUADORCODIGO) AS "rol"
         FROM EVALUADORPARTALCANCE al
         JOIN EVALUADORPARTICIPACION pa ON pa.PARTICIPACIONID = al.PARTICIPACIONID
         JOIN AREAEVALUACION ar ON ar.AREAID = al.AREAID
         JOIN ROLEVALUADOR   r  ON r.ROLEVALUADORID = al.ROLEVALUADORID
        WHERE pa.CONVOCATORIAID = :1`,
      [convocatoriaId],
    )
    const mapa = new Map<number, Array<{ area: string; roles: string[] }>>()
    for (const f of filas) {
      const id = Number(f.participacionId)
      const area = (f.area as string ?? '').trim().toUpperCase()
      const rol = (f.rol as string ?? '').trim().toUpperCase()
      if (!area || !rol) continue
      if (!mapa.has(id)) mapa.set(id, [])
      const lista = mapa.get(id)!
      const existente = lista.find(a => a.area === area)
      if (existente) existente.roles.push(rol)
      else lista.push({ area, roles: [rol] })
    }
    return mapa
  }

  /**
   * Mezcla las reglas de la convocatoria con los valores por defecto. Un JSON
   * inválido no debe tumbar la generación: se avisa y se usan los defectos.
   */
  resolverReglas(json?: string | null): ReglasMatriz {
    if (!json?.trim()) return REGLAS_DEFECTO
    try {
      const parsed = JSON.parse(json) as Partial<ReglasMatriz>
      return {
        gruposPorArea: parsed.gruposPorArea ?? REGLAS_DEFECTO.gruposPorArea,
        apoyosDeGrupo: parsed.apoyosDeGrupo ?? REGLAS_DEFECTO.apoyosDeGrupo,
        peerEvaluation: parsed.peerEvaluation ?? REGLAS_DEFECTO.peerEvaluation,
        alcanceForzado: parsed.alcanceForzado ?? REGLAS_DEFECTO.alcanceForzado,
      }
    } catch {
      this.logger.warn('REGLASMATRIZ no es JSON válido; se usan las reglas por defecto')
      return REGLAS_DEFECTO
    }
  }
}
