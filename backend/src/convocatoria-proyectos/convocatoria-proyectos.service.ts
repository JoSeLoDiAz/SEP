import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import * as XLSX from 'xlsx'
import { ImportarProyectoService, PreviewImportacion } from '../importar-proyecto/importar-proyecto.service'

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Banco de proyectos GUARDADOS de una convocatoria (sin importarlos).        ║
// ║                                                                            ║
// ║ Reutiliza el parseo/preview del importador para obtener TODO el proyecto   ║
// ║ (PreviewImportacion) y lo persiste como JSON (CLOB) en CONVPROYGUARDADO,   ║
// ║ junto con columnas clave para filtrar y reportar. Permite ver un reporte   ║
// ║ general por convocatoria y descargar una sábana (Excel multi-hoja) de      ║
// ║ acciones de formación, unidades temáticas, actividades y rubros.           ║
// ╚══════════════════════════════════════════════════════════════════════════╝

type AF = PreviewImportacion['afs'][number]
type Rubro = AF['rubros'][number]

const n0 = (x: unknown) => Number(x) || 0
const s = (x: unknown) => (x == null ? '' : String(x)).trim()
const arr = (a?: unknown[]) => (a ?? []).map(s).filter(Boolean).join(', ')
const code = (r: Rubro) => s(r.idRubro)
const name = (r: Rubro) => s(r.nombreRubro)
const esGO = (r: Rubro) => /^R0?9(\D|$)/i.test(code(r)) || /GASTOS\s+DE\s+OPERACI/i.test(name(r))
const esTransf = (r: Rubro) =>
  /^R0?15(\D|$)/i.test(code(r)) || /TRANSFERENCIA\s+DE\s+CONOCIMIENTO/i.test(name(r))

interface Bloque { cofSena: number; especie: number; dinero: number; total: number }
const sumBloque = (rs: Rubro[]): Bloque => ({
  cofSena: rs.reduce((a, r) => a + n0(r.cofinanciacionSena), 0),
  especie: rs.reduce((a, r) => a + n0(r.contrapartidaEspecie), 0),
  dinero:  rs.reduce((a, r) => a + n0(r.contrapartidaDinero), 0),
  total:   rs.reduce((a, r) => a + n0(r.totalRubro), 0),
})

function finanzasAF(af: AF) {
  const normales = (af.rubros ?? []).filter(r => !esGO(r) && !esTransf(r))
  const go = sumBloque((af.rubros ?? []).filter(esGO))
  const tr = sumBloque((af.rubros ?? []).filter(esTransf))
  const afSub = sumBloque(normales)
  const tot = sumBloque(af.rubros ?? [])
  const grupos = n0(af.numeroGrupos)
  const benefGrupo = n0(af.beneficiariosPresenciales) + n0(af.beneficiariosSincronicos)
  const totalBenef = grupos * benefGrupo
  return { afSub, go, tr, tot, grupos, totalBenef, totalHoras: n0(af.horasPorGrupo) * grupos }
}

export interface FilaLista {
  id: number
  convocatoriaId: number
  nit: string
  razonSocial: string
  nombreProyecto: string
  modalidad: string
  numAF: number
  numBenef: number
  valorTotal: number
  cofinSena: number
  fechaGuardado: string
}

export interface AnaliticaGrupo {
  clave: string
  afs: number
  proyectos: number
  beneficiarios: number
  cofinSena: number
  valorTotal: number
}

export interface AnaliticaFiltros {
  convocatoriaId?: number
  proponente?: string
  evento?: string
  modalidad?: string
  sector?: string
}

export interface AccionFila {
  guardadoId: number
  nit: string
  proponente: string
  proyecto: string
  consecutivo: number
  nombre: string
  evento: string
  modalidad: string
  metodologia: string
  grupos: number
  beneficiarios: number
  horas: number
  uts: number
  valorAF: number
  gastosOperacion: number
  transferencia: number
  valorTotal: number
  cofinSena: number
}

@Injectable()
export class ConvocatoriaProyectosService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly importar: ImportarProyectoService,
  ) {}

  // node-oracledb puede devolver los CLOB como Lob (stream) o como string según
  // la configuración; leemos ambos casos de forma segura.
  private async readClob(v: unknown): Promise<string> {
    if (v == null) return ''
    if (typeof v === 'string') return v
    const maybe = v as { getData?: () => Promise<string> }
    if (typeof maybe.getData === 'function') return (await maybe.getData()) ?? ''
    return String(v)
  }

  // ── Guardar un proyecto (re-parsea el .xlsx y persiste el JSON completo) ────
  async guardar(buffer: Buffer, convocatoriaId: number, usuarioId?: number) {
    const preview = await this.importar.preview(buffer, convocatoriaId)
    const pres = preview.proyecto?.presupuesto
    const json = JSON.stringify(preview)

    const idRow: Array<{ id: number }> = await this.dataSource.query(
      `SELECT CONVPROYGUARDADO_SEQ.NEXTVAL AS "id" FROM dual`,
    )
    const id = Number(idRow[0].id)

    // El CLOB se inserta por trozos (TO_CLOB(:n) || …) porque node-oracledb liga los
    // strings como VARCHAR2. Para ser portable incluso en BD con MAX_STRING_SIZE=STANDARD
    // (límite 4000 bytes) usamos trozos de 900 chars (≤ 3600 bytes aun en UTF-8 multibyte).
    const CHUNK = 900
    const chunks: string[] = []
    for (let i = 0; i < json.length; i += CHUNK) chunks.push(json.slice(i, i + CHUNK))
    if (chunks.length === 0) chunks.push('{}')
    const clobExpr = chunks.map((_, i) => `TO_CLOB(:${12 + i})`).join(' || ')

    await this.dataSource.query(
      `INSERT INTO CONVPROYGUARDADO
         (GUARDADOID, CONVOCATORIAID, NIT, RAZONSOCIAL, NOMBREPROYECTO, MODALIDAD,
          NUMAF, NUMBENEF, VALORTOTAL, COFINSENA, USUARIOID, FECHAGUARDADO, DATOSJSON)
       VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, SYSDATE, ${clobExpr})`,
      [
        id,
        convocatoriaId,
        s(preview.empresa?.nit).slice(0, 30),
        s(preview.basicos?.razonSocial).slice(0, 300),
        s(preview.proyecto?.nombre).slice(0, 400),
        s(preview.basicos?.modalidadParticipacion).slice(0, 60),
        preview.afs?.length ?? 0,
        n0(pres?.beneficiarios),
        n0(pres?.valorTotal),
        n0(pres?.cofinanciacionSena),
        usuarioId ?? null,
        ...chunks,
      ],
    )
    return { id, nombreProyecto: s(preview.proyecto?.nombre), razonSocial: s(preview.basicos?.razonSocial) }
  }

  // ── Listado filtrable de proyectos guardados ────────────────────────────────
  async listar(convocatoriaId?: number, q?: string): Promise<FilaLista[]> {
    const params: unknown[] = []
    let where = '1 = 1'
    if (convocatoriaId) {
      params.push(convocatoriaId)
      where += ` AND CONVOCATORIAID = :${params.length}`
    }
    const term = s(q)
    if (term) {
      const like = `%${term.toUpperCase()}%`
      const a = params.push(like)
      const b = params.push(like)
      const c = params.push(like)
      where += ` AND (UPPER(RAZONSOCIAL) LIKE :${a} OR UPPER(NOMBREPROYECTO) LIKE :${b} OR UPPER(NIT) LIKE :${c})`
    }
    const rows = await this.dataSource.query(
      `SELECT GUARDADOID                                  AS "id",
              CONVOCATORIAID                              AS "convocatoriaId",
              NIT                                         AS "nit",
              RAZONSOCIAL                                 AS "razonSocial",
              NOMBREPROYECTO                              AS "nombreProyecto",
              MODALIDAD                                   AS "modalidad",
              NUMAF                                       AS "numAF",
              NUMBENEF                                    AS "numBenef",
              VALORTOTAL                                  AS "valorTotal",
              COFINSENA                                   AS "cofinSena",
              TO_CHAR(FECHAGUARDADO, 'YYYY-MM-DD HH24:MI') AS "fechaGuardado"
         FROM CONVPROYGUARDADO
        WHERE ${where}
        ORDER BY FECHAGUARDADO DESC, GUARDADOID DESC`,
      params,
    )
    return rows.map((r: FilaLista) => ({
      ...r,
      numAF: n0(r.numAF), numBenef: n0(r.numBenef),
      valorTotal: n0(r.valorTotal), cofinSena: n0(r.cofinSena),
    }))
  }

  // ── Convocatorias con conteo de proyectos guardados (para el filtro) ────────
  async convocatorias() {
    return this.dataSource.query(
      `SELECT c.CONVOCATORIAID           AS "id",
              TRIM(c.CONVOCATORIANOMBRE) AS "nombre",
              c.CONVOCATORIAANIO         AS "anio",
              (SELECT COUNT(*) FROM CONVPROYGUARDADO g WHERE g.CONVOCATORIAID = c.CONVOCATORIAID) AS "guardados"
         FROM CONVOCATORIA c
        ORDER BY c.CONVOCATORIAANIO DESC, c.CONVOCATORIAID DESC`,
    )
  }

  // ── Resumen agregado de una convocatoria ────────────────────────────────────
  async resumen(convocatoriaId?: number) {
    const params: unknown[] = []
    let where = '1 = 1'
    if (convocatoriaId) { params.push(convocatoriaId); where += ` AND CONVOCATORIAID = :1` }
    const r = await this.dataSource.query(
      `SELECT COUNT(*)                 AS "proyectos",
              NVL(SUM(NUMAF), 0)       AS "afs",
              NVL(SUM(NUMBENEF), 0)    AS "beneficiarios",
              NVL(SUM(VALORTOTAL), 0)  AS "valorTotal",
              NVL(SUM(COFINSENA), 0)   AS "cofinSena"
         FROM CONVPROYGUARDADO WHERE ${where}`,
      params,
    )
    const row = r[0] ?? {}
    return {
      proyectos: n0(row.proyectos), afs: n0(row.afs), beneficiarios: n0(row.beneficiarios),
      valorTotal: n0(row.valorTotal), cofinSena: n0(row.cofinSena),
    }
  }

  // ── Detalle: devuelve el PreviewImportacion completo (para el reporte) ──────
  async detalle(id: number): Promise<PreviewImportacion> {
    const rows = await this.dataSource.query(
      `SELECT DATOSJSON AS "datos" FROM CONVPROYGUARDADO WHERE GUARDADOID = :1`,
      [id],
    )
    if (!rows[0]) throw new NotFoundException('Proyecto guardado no encontrado')
    const json = await this.readClob(rows[0].datos)
    return JSON.parse(json) as PreviewImportacion
  }

  async eliminar(id: number) {
    await this.dataSource.query(`DELETE FROM CONVPROYGUARDADO WHERE GUARDADOID = :1`, [id])
    return { ok: true }
  }

  // Carga y parsea el JSON de los proyectos guardados (con su id de guardado).
  private async cargarProyectos(convocatoriaId?: number): Promise<Array<{ id: number; p: PreviewImportacion }>> {
    const params: unknown[] = []
    let where = '1 = 1'
    if (convocatoriaId) { params.push(convocatoriaId); where += ' AND CONVOCATORIAID = :1' }
    const rows = await this.dataSource.query(
      `SELECT GUARDADOID AS "id", DATOSJSON AS "datos" FROM CONVPROYGUARDADO WHERE ${where} ORDER BY GUARDADOID`,
      params,
    )
    const out: Array<{ id: number; p: PreviewImportacion }> = []
    for (const r of rows) {
      try { out.push({ id: Number(r.id), p: JSON.parse(await this.readClob(r.datos)) as PreviewImportacion }) } catch { /* JSON corrupto: se ignora */ }
    }
    return out
  }

  // Aplica los filtros: proponente a nivel proyecto; evento/modalidad/sector a
  // nivel AF. Devuelve los proyectos con SOLO sus AF que pasan el filtro.
  private aplicarFiltros(
    proys: Array<{ id: number; p: PreviewImportacion }>, f: AnaliticaFiltros,
  ): Array<{ id: number; p: PreviewImportacion; afs: AF[] }> {
    const prop = s(f.proponente).toUpperCase()
    const evtF = s(f.evento).toUpperCase()
    const modF = s(f.modalidad).toUpperCase()
    const secF = s(f.sector).toUpperCase()
    const res: Array<{ id: number; p: PreviewImportacion; afs: AF[] }> = []
    for (const { id, p } of proys) {
      const propKey = s(p.basicos?.razonSocial) || s(p.empresa?.nit) || '—'
      if (prop && !`${propKey} ${s(p.empresa?.nit)}`.toUpperCase().includes(prop)) continue
      const afs = (p.afs ?? []).filter(af => {
        if (evtF && !s(af.eventoFormacion).toUpperCase().includes(evtF)) return false
        if (modF && !s(af.modalidadFormacion).toUpperCase().includes(modF)) return false
        if (secF) {
          const af2 = af as unknown as { sectoresBeneficia?: string[]; sectoresPertenecen?: string[] }
          const sectores = [...(af2.sectoresBeneficia ?? []), ...(af2.sectoresPertenecen ?? [])].join(' ').toUpperCase()
          if (!sectores.includes(secF)) return false
        }
        return true
      })
      if (afs.length) res.push({ id, p, afs })
    }
    return res
  }

  // Totales + desgloses (por evento, modalidad y proponente) del set filtrado.
  private agregados(filtrados: Array<{ p: PreviewImportacion; afs: AF[] }>) {
    const tot = {
      proyectos: 0, afs: 0, unidades: 0, grupos: 0, beneficiarios: 0, valorTotal: 0, cofinSena: 0,
      especie: 0, dinero: 0, gastosOperacion: 0, transferencia: 0,
    }
    const byEvento = new Map<string, AnaliticaGrupo>()
    const byModalidad = new Map<string, AnaliticaGrupo>()
    const byProponente = new Map<string, AnaliticaGrupo>()
    const bump = (m: Map<string, AnaliticaGrupo>, clave: string, benef: number, cof: number, val: number) => {
      const g = m.get(clave) ?? { clave, afs: 0, proyectos: 0, beneficiarios: 0, cofinSena: 0, valorTotal: 0 }
      g.afs++; g.beneficiarios += benef; g.cofinSena += cof; g.valorTotal += val
      m.set(clave, g)
    }
    for (const { p, afs } of filtrados) {
      tot.proyectos++
      const propKey = s(p.basicos?.razonSocial) || s(p.empresa?.nit) || '—'
      for (const af of afs) {
        const fin = finanzasAF(af)
        tot.afs++
        tot.unidades += (af.uts ?? []).length
        tot.grupos += fin.grupos
        tot.beneficiarios += fin.totalBenef
        tot.valorTotal += fin.tot.total
        tot.cofinSena += fin.tot.cofSena
        tot.especie += fin.tot.especie
        tot.dinero += fin.tot.dinero
        tot.gastosOperacion += fin.go.total
        tot.transferencia += fin.tr.total
        bump(byEvento, s(af.eventoFormacion) || '(sin evento)', fin.totalBenef, fin.tot.cofSena, fin.tot.total)
        bump(byModalidad, s(af.modalidadFormacion) || '(sin modalidad)', fin.totalBenef, fin.tot.cofSena, fin.tot.total)
        bump(byProponente, propKey, fin.totalBenef, fin.tot.cofSena, fin.tot.total)
      }
      const gp = byProponente.get(propKey)
      if (gp) gp.proyectos++
    }
    const arr = (m: Map<string, AnaliticaGrupo>) => [...m.values()].sort((a, b) => b.cofinSena - a.cofinSena)
    return { totales: tot, porEvento: arr(byEvento), porModalidad: arr(byModalidad), porProponente: arr(byProponente) }
  }

  // Presupuesto DECLARADO (Datos_Presupuesto de cada proyecto) + cobertura territorial.
  // Se calcula por proyecto (no por rubro) porque los topes, la transferencia y los
  // beneficiarios de transferencia son conceptos a nivel de presupuesto del proyecto.
  private enriquecido(filtrados: Array<{ p: PreviewImportacion; afs: AF[] }>) {
    const pres = {
      valorAFs: 0, gastosOperacion: 0, valorTransferencia: 0, beneficiariosTransferencia: 0,
      cofinanciacionSena: 0, contrapartidaEspecie: 0, contrapartidaDinero: 0, valorTotal: 0, beneficiarios: 0,
    }
    type Cob = { clave: string; beneficiarios: number; afs: number }
    const byDepto = new Map<string, Cob>()
    const byCiudad = new Map<string, Cob>()
    const bumpCob = (m: Map<string, Cob>, clave: string, benef: number) => {
      const g = m.get(clave) ?? { clave, beneficiarios: 0, afs: 0 }
      g.beneficiarios += benef; g.afs++; m.set(clave, g)
    }
    for (const { p, afs } of filtrados) {
      const pr = p.proyecto?.presupuesto
      if (pr) {
        pres.valorAFs += n0(pr.valorAFs)
        pres.gastosOperacion += n0(pr.gastosOperacion)
        pres.valorTransferencia += n0(pr.valorTransferencia)
        pres.beneficiariosTransferencia += n0(pr.beneficiariosTransferencia)
        pres.cofinanciacionSena += n0(pr.cofinanciacionSena)
        pres.contrapartidaEspecie += n0(pr.contrapartidaEspecie)
        pres.contrapartidaDinero += n0(pr.contrapartidaDinero)
        pres.valorTotal += n0(pr.valorTotal)
        pres.beneficiarios += n0(pr.beneficiarios)
      }
      for (const af of afs) {
        const cob = (af as unknown as {
          cobertura?: Array<{ departamentoPresencial?: string; ciudadPresencial?: string; beneficiariosPresencial?: number; departamentos?: Array<{ departamento?: string; beneficiarios?: number }> }>
        }).cobertura ?? []
        for (const c of cob) {
          const dp = s(c.departamentoPresencial)
          if (dp) bumpCob(byDepto, dp, n0(c.beneficiariosPresencial))
          const cd = s(c.ciudadPresencial)
          if (cd) bumpCob(byCiudad, dp ? `${cd} (${dp})` : cd, n0(c.beneficiariosPresencial))
          for (const d of c.departamentos ?? []) {
            const dd = s(d.departamento)
            if (dd) bumpCob(byDepto, dd, n0(d.beneficiarios))
          }
        }
      }
    }
    const pctGO = pres.valorAFs > 0 ? (pres.gastosOperacion / pres.valorAFs) * 100 : 0
    const topeGO = pres.valorAFs > 200_000_000 ? 10 : 16
    const baseTransf = pres.valorAFs + pres.gastosOperacion
    const pctTransfValor = baseTransf > 0 ? (pres.valorTransferencia / baseTransf) * 100 : 0
    const pctTransfBenef = pres.beneficiarios > 0 ? (pres.beneficiariosTransferencia / pres.beneficiarios) * 100 : 0
    const arr = (m: Map<string, Cob>) => [...m.values()].sort((a, b) => b.beneficiarios - a.beneficiarios)
    return {
      presupuesto: { ...pres, pctGO, topeGO, pctTransfValor, pctTransfBenef },
      porDepartamento: arr(byDepto),
      porCiudad: arr(byCiudad),
    }
  }

  // ── Analítica filtrable: "cuánto de cofinanciación solicitan", con filtros por
  // proponente/evento/modalidad/sector y desglose (ranking de quién solicita más).
  // Incluye presupuesto declarado (topes, transferencia) y cobertura territorial.
  async analitica(f: AnaliticaFiltros) {
    const filtrados = this.aplicarFiltros(await this.cargarProyectos(f.convocatoriaId), f)
    return { ...this.agregados(filtrados), ...this.enriquecido(filtrados) }
  }

  // ── Listado plano de TODAS las acciones de formación (con su proyecto) ──────
  async acciones(f: AnaliticaFiltros): Promise<AccionFila[]> {
    const filtrados = this.aplicarFiltros(await this.cargarProyectos(f.convocatoriaId), f)
    const out: AccionFila[] = []
    for (const { id, p, afs } of filtrados) {
      const nit = s(p.empresa?.nit)
      const proponente = s(p.basicos?.razonSocial)
      const proyecto = s(p.proyecto?.nombre)
      for (const af of afs) {
        const fin = finanzasAF(af)
        out.push({
          guardadoId: id,
          nit, proponente, proyecto,
          consecutivo: n0(af.consecutivo),
          nombre: s(af.nombre),
          evento: s(af.eventoFormacion),
          modalidad: s(af.modalidadFormacion),
          metodologia: s(af.metodologia),
          grupos: fin.grupos,
          beneficiarios: fin.totalBenef,
          horas: fin.totalHoras,
          uts: (af.uts ?? []).length,
          valorAF: fin.afSub.total,
          gastosOperacion: fin.go.total,
          transferencia: fin.tr.total,
          valorTotal: fin.tot.total,
          cofinSena: fin.tot.cofSena,
        })
      }
    }
    return out
  }

  // ── Sábana Excel multi-hoja (respeta los filtros de la analítica) ───────────
  async exportarExcel(f: AnaliticaFiltros = {}): Promise<Buffer> {
    const filtrados = this.aplicarFiltros(await this.cargarProyectos(f.convocatoriaId), f)
    const ag = this.agregados(filtrados)

    const resumenSheet: Record<string, unknown>[] = [{
      'Proyectos': ag.totales.proyectos,
      'Acciones de formación': ag.totales.afs,
      'Beneficiarios': ag.totales.beneficiarios,
      'Valor total': ag.totales.valorTotal,
      'Cofinanciación SENA': ag.totales.cofinSena,
      'Contrapartida especie': ag.totales.especie,
      'Contrapartida dinero': ag.totales.dinero,
      'Gastos de operación': ag.totales.gastosOperacion,
      'Transferencia': ag.totales.transferencia,
    }]
    const porEventoSheet = ag.porEvento.map(g => ({
      'Evento': g.clave, 'AF': g.afs, 'Beneficiarios': g.beneficiarios,
      'Cofinanciación SENA': g.cofinSena, 'Valor total': g.valorTotal,
    }))
    const porModalidadSheet = ag.porModalidad.map(g => ({
      'Modalidad': g.clave, 'AF': g.afs, 'Beneficiarios': g.beneficiarios,
      'Cofinanciación SENA': g.cofinSena, 'Valor total': g.valorTotal,
    }))
    const porProponenteSheet = ag.porProponente.map(g => ({
      'Proponente': g.clave, 'Proyectos': g.proyectos, 'AF': g.afs, 'Beneficiarios': g.beneficiarios,
      'Cofinanciación SENA': g.cofinSena, 'Valor total': g.valorTotal,
    }))

    const proyectos: Record<string, unknown>[] = []
    const afsSheet: Record<string, unknown>[] = []
    const utsSheet: Record<string, unknown>[] = []

    for (const { p, afs: afsMatch } of filtrados) {
      const nit = s(p.empresa?.nit)
      const proyecto = s(p.proyecto?.nombre)
      const razon = s(p.basicos?.razonSocial)
      const pr = p.proyecto?.presupuesto
      // Totales del proyecto CALCULADOS desde sus AF filtradas (así concilian con las
      // hojas Resumen/Por-* y respetan el filtro). El presupuesto declarado va aparte.
      let cBenef = 0, cCof = 0, cEsp = 0, cDin = 0, cGO = 0, cTr = 0, cTot = 0
      for (const af of afsMatch) {
        const fin = finanzasAF(af)
        cBenef += fin.totalBenef; cCof += fin.tot.cofSena; cEsp += fin.tot.especie
        cDin += fin.tot.dinero; cGO += fin.go.total; cTr += fin.tr.total; cTot += fin.tot.total
      }

      proyectos.push({
        'Convocatoria': s(p.convocatoria?.nombre),
        'NIT': nit,
        'Razón social': razon,
        'Sigla': s(p.basicos?.sigla),
        'Proyecto': proyecto,
        'Modalidad': s(p.basicos?.modalidadParticipacion),
        'N.º AF': afsMatch.length,
        'Beneficiarios': cBenef,
        'Valor total': cTot,
        'Cofinanciación SENA': cCof,
        'Contrapartida especie': cEsp,
        'Contrapartida dinero': cDin,
        'Gastos de operación': cGO,
        'Transferencia': cTr,
        'Valor total (declarado)': n0(pr?.valorTotal),
        'Cofinanciación SENA (declarado)': n0(pr?.cofinanciacionSena),
        'Beneficiarios (declarado)': n0(pr?.beneficiarios),
      })

      for (const af of afsMatch) {
        const f = finanzasAF(af)
        afsSheet.push({
          'NIT': nit,
          'Proponente': razon,
          'N.º AF': n0(af.consecutivo),
          'Nombre de la AF': s(af.nombre),
          'Problema o necesidad detectada': s(af.diagnostico),
          'Justificación de la necesidad detectada': s(af.justificacion),
          'Causas del problema o necesidad': s(af.causasEfectos),
          'Efectos del problema o necesidad': s(af.efectos),
          'Objetivo de la acción de formación': s(af.objetivos),
          'Evento de formación': s(af.eventoFormacion),
          'Modalidad': s(af.modalidadFormacion),
          'Metodología': s(af.metodologia),
          'N.º de horas por grupo': n0(af.horasPorGrupo),
          'N.º de grupos': n0(af.numeroGrupos),
          'Beneficiarios presenciales / grupo': n0(af.beneficiariosPresenciales),
          'Beneficiarios virtuales / grupo': n0(af.beneficiariosSincronicos),
          'Total de horas de la AF': f.totalHoras,
          'Total de beneficiarios de la AF': f.totalBenef,
          'Áreas funcionales': arr(af.areas),
          'Justificación de áreas funcionales': s(af.justificacionAreas),
          'Niveles ocupacionales': arr(af.niveles),
          'Justificación de niveles ocupacionales': s(af.justificacionNiveles),
          'Ocupaciones CUOC': arr(af.ocupacionesCuoc),
          'Trabajadores mujeres': n0(af.trabajadoresMujeres),
          'En condición de discapacidad': n0(af.trabajadoresDiscapacidad),
          'Empresas con modelo BIC': n0(af.empresasBic),
          'N.º empresas MIPYMES': n0(af.mipymesEmpresas),
          'N.º trabajadores MIPYMES': n0(af.mipymesTrabajadores),
          'Justificación MIPYMES': s(af.justificacionMipymes),
          'N.º empresas cadena productiva': n0(af.cadenaEmpresas),
          'N.º trabajadores cadena productiva': n0(af.cadenaTrabajadores),
          'Justificación cadena productiva': s(af.justificacionCadena),
          'N.º trabajadores economía campesina': n0(af.trabajadoresCampesinos),
          'Justificación economía campesina': s(af.trabajadoresCampesinosTexto),
          'N.º trabajadores economía popular': n0(af.trabajadoresPopular),
          'Justificación economía popular': s(af.trabajadoresPopularTexto),
          'Sector(es) al que pertenecen los beneficiarios': arr(af.sectoresPertenecen),
          'Subsector(es) al que pertenecen los beneficiarios': arr(af.subsectoresPertenecen),
          'Clasificación de la AF por sector(es)': arr(af.sectoresBeneficia),
          'Clasificación de la AF por subsector(es)': arr(af.subsectoresBeneficia),
          'Justificación de sectores y subsectores': s(af.justificacionSectores),
          'Alineación · Reto nacional': s(af.componenteAlineacion),
          'Alineación · Componente estratégico': s(af.descripcionAlineacion),
          'Justificación de la alineación': s(af.justificacionAlineacion),
          'Justificación de la acción de formación especializada': s(af.justificacionEspecializada),
          'Impacto en el desempeño del trabajador': (af.impactosTrabajador ?? []).map(s).filter(Boolean).join('\n'),
          'Impacto en la productividad y competitividad': (af.impactosProductividad ?? []).map(s).filter(Boolean).join('\n'),
        })

        for (const u of af.uts ?? []) {
          const hp = n0(u.horasPracticas), ht = n0(u.horasTeoricas)
          utsSheet.push({
            'NIT': nit,
            'Proponente': razon,
            'N.º AF': n0(af.consecutivo),
            'Nombre de la AF': s(af.nombre),
            'N.º UT': n0(u.numeroUT),
            'Nombre de la unidad temática': s(u.nombre),
            'Horas prácticas': hp,
            'Horas teóricas': ht,
            'Total de horas': hp + ht,
            'Contenido de la unidad temática': s(u.contenido),
            'Competencia': s(u.competencia),
            'Actividades': arr(u.actividades),
            'Justificación de la actividad de aprendizaje': s(u.descripcionActividad),
          })
        }
      }
    }

    const wb = XLSX.utils.book_new()
    const add = (data: Record<string, unknown>[], nombre: string) => {
      const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ '(sin datos)': '' }])
      XLSX.utils.book_append_sheet(wb, ws, nombre)
    }
    add(resumenSheet, 'Resumen')
    add(porEventoSheet, 'Por evento')
    add(porModalidadSheet, 'Por modalidad')
    add(porProponenteSheet, 'Por proponente')
    add(proyectos, 'Proyectos')
    add(afsSheet, 'Acciones de formacion')
    add(utsSheet, 'Unidades tematicas')

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  }
}
