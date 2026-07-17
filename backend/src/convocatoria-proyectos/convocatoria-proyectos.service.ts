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
// Elemento i de un arreglo como texto (para expandir en columnas 1..N).
const at = (a: unknown, i: number) => s(Array.isArray(a) ? a[i] : undefined)
// Fecha serial de Excel → dd/mm/aaaa (si no es serial, devuelve el texto tal cual).
const fmtFecha = (v: unknown): string => {
  const str = s(v)
  if (!str) return ''
  const num = Number(str)
  if (Number.isFinite(num) && num > 20000 && num < 80000) {
    const d = new Date(Math.round((num - 25569) * 86400000))
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getUTCDate()).padStart(2, '0')
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      return `${dd}/${mm}/${d.getUTCFullYear()}`
    }
  }
  return str
}
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
    // Los CLOB se leen/parsean en paralelo para acelerar la descarga.
    const out = await Promise.all((rows as Array<{ id: number; datos: unknown }>).map(async (r) => {
      try { return { id: Number(r.id), p: JSON.parse(await this.readClob(r.datos)) as PreviewImportacion } } catch { return null }
    }))
    return out.filter((x): x is { id: number; p: PreviewImportacion } => x !== null)
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

  // ── Sábana Excel: hojas normalizadas tipo Datos_* del formulador ────────────
  async exportarExcel(f: AnaliticaFiltros = {}): Promise<Buffer> {
    const filtrados = this.aplicarFiltros(await this.cargarProyectos(f.convocatoriaId), f)
    const ag = this.agregados(filtrados)

    const resumenSheet: Record<string, unknown>[] = [{
      'Proyectos': ag.totales.proyectos,
      'Acciones de formación': ag.totales.afs,
      'Unidades temáticas': ag.totales.unidades,
      'Beneficiarios': ag.totales.beneficiarios,
      'Valor total': ag.totales.valorTotal,
      'Cofinanciación SENA': ag.totales.cofinSena,
      'Contrapartida especie': ag.totales.especie,
      'Contrapartida dinero': ag.totales.dinero,
      'Gastos de operación': ag.totales.gastosOperacion,
      'Transferencia': ag.totales.transferencia,
    }]
    const porProponenteSheet = ag.porProponente.map(g => ({
      'Proponente': g.clave, 'Proyectos': g.proyectos, 'AF': g.afs, 'Beneficiarios': g.beneficiarios,
      'Cofinanciación SENA': g.cofinSena, 'Valor total': g.valorTotal,
    }))

    const basicosSheet: Record<string, unknown>[] = []
    const contactoSheet: Record<string, unknown>[] = []
    const generalesSheet: Record<string, unknown>[] = []
    const diagnosticoSheet: Record<string, unknown>[] = []
    const necesidadesSheet: Record<string, unknown>[] = []
    const afSheet: Record<string, unknown>[] = []
    const utSheet: Record<string, unknown>[] = []
    const coberturaSheet: Record<string, unknown>[] = []
    const presupuestoSheet: Record<string, unknown>[] = []
    // Rubros con claves de orden (proponente → AF → id de rubro).
    const rubrosRows: Array<{ prop: string; af: number; id: number; row: Record<string, unknown> }> = []

    for (const { p, afs: afsMatch } of filtrados) {
      const b = p.basicos, c = p.contactos, g = p.generalidades, pres = p.proyecto?.presupuesto
      const nit = s(b?.nit)
      const razon = s(b?.razonSocial)

      // ── Datos básicos ──
      basicosSheet.push({
        'NÚMERO DE IDENTIFICACIÓN': s(b?.nit),
        'DÍGITO VERIFICACIÓN': s(b?.digitoVerificacion),
        'NOMBRE DE LA ENTIDAD PROPONENTE': s(b?.razonSocial),
        'SIGLA': s(b?.sigla),
        'CORREO ELECTRÓNICO': s(b?.email),
        'DEPARTAMENTO DE DOMICILIO': s(b?.departamentoDomicilio),
        'CIUDAD/MUNICIPIO DE DOMICILIO': s(b?.ciudadDomicilio),
        'DIRECCIÓN DE DOMICILIO': s(b?.direccionDomicilio),
        'TELÉFONO': s(b?.telefono),
        'PÁGINA WEB': s(b?.paginaWeb),
        'ACTIVIDAD ECONÓMICA (RUT/CIIU)': s(b?.ciiu),
        'TIPO DE ORGANIZACIÓN': s(b?.tipoOrganizacion),
        'CERTIFICACIÓN DE COMPETENCIAS LABORALES': s(b?.certificacionCompetencias),
        'VINCULÓ EXPERTOS TÉCNICOS': s(b?.vinculoExpertosTecnicos),
        'COBERTURA': s(b?.cobertura),
        'CÓDIGO INDICATIVO': s(b?.codigoIndicativo),
        'TAMAÑO EMPRESA': s(b?.tamanoEmpresa),
        'CELULAR': s(b?.celular),
        'MESA SECTORIAL 1': s(b?.mesa1),
        'MESA SECTORIAL 2': s(b?.mesa2),
        'MESA SECTORIAL 3': s(b?.mesa3),
        'MODALIDAD DE PARTICIPACIÓN': s(b?.modalidadParticipacion),
        'TIPO DE IDENTIFICACIÓN': s(b?.tipoIdentificacion),
      })

      // ── Datos contacto ──
      const rl = c?.representanteLegal, k1 = c?.contacto1, ks = c?.contactoSustenta
      contactoSheet.push({
        'NIT': nit,
        'Proponente': razon,
        'NÚMERO DE IDENTIFICACIÓN REPRESENTANTE LEGAL': s(rl?.id),
        'TIPO REPRESENTANTE LEGAL': s(rl?.tipo),
        'NOMBRE REPRESENTANTE LEGAL': s(rl?.nombre),
        'EMAIL REPRESENTANTE LEGAL': s(rl?.email),
        'TELÉFONO/CELULAR REPRESENTANTE LEGAL': s(rl?.telefono),
        'NÚMERO DE IDENTIFICACIÓN PRIMER CONTACTO': s(k1?.id),
        'TIPO IDENTIFICACIÓN PRIMER CONTACTO': s(k1?.tipo),
        'NOMBRE COMPLETO PRIMER CONTACTO': s(k1?.nombre),
        'EMAIL PRIMER CONTACTO': s(k1?.email),
        'TELÉFONO/CELULAR PRIMER CONTACTO': s(k1?.telefono),
        'TIPO IDENTIFICACIÓN PERSONA QUE SUSTENTA': s(ks?.tipo),
        'NÚMERO IDENTIFICACIÓN CONTACTO 2': s(ks?.id),
        'NOMBRE COMPLETO PERSONA QUE SUSTENTA': s(ks?.nombre),
        'EMAIL PERSONA QUE SUSTENTA': s(ks?.email),
        'TELÉFONO/CELULAR PERSONA QUE SUSTENTA': s(ks?.telefono),
      })

      // ── Datos generales ──
      generalesSheet.push({
        'NIT': nit,
        'Proponente': razon,
        'OBJETO SOCIAL DE LA EMPRESA / GREMIO': s(g?.objetoSocial),
        'PRODUCTOS Y/O SERVICIOS OFRECIDOS Y MERCADO': s(g?.productosServicios),
        'SITUACIÓN ACTUAL Y PROYECCIÓN': s(g?.situacionActual),
        'PAPEL EN EL SECTOR(ES) Y/O REGIÓN': s(g?.papelSector),
        'RETOS ESTRATÉGICOS VINCULADOS A LA FORMACIÓN': s(g?.retos),
        'EXPERIENCIA EN ACTIVIDADES FORMATIVAS': s(g?.experienciaFormativa),
        'OBJETIVO GENERAL DEL PROYECTO': s(g?.objetivoProyecto),
        'SECTOR AL QUE PERTENECE': s(g?.sectorPertenece),
        'SUBSECTOR AL QUE PERTENECE': s(g?.subsectorPertenece),
        'SECTOR 1 AL QUE REPRESENTA': at(g?.sectoresRepresenta, 0),
        'SECTOR 2 AL QUE REPRESENTA': at(g?.sectoresRepresenta, 1),
        'SECTOR 3 AL QUE REPRESENTA': at(g?.sectoresRepresenta, 2),
        'SUB-SECTOR 1 AL QUE REPRESENTA': at(g?.subsectoresRepresenta, 0),
        'SUB-SECTOR 2 AL QUE REPRESENTA': at(g?.subsectoresRepresenta, 1),
        'SUB-SECTOR 3 AL QUE REPRESENTA': at(g?.subsectoresRepresenta, 2),
        'ESLABONES DE LA CADENA PRODUCTIVA': s(g?.cadenaProductiva),
        'INTERACCIONES CON OTROS ACTORES': s(g?.interacciones),
      })

      // ── Diagnóstico ──
      for (const d of p.diagnosticos ?? []) {
        const h = d.herramientas ?? []
        diagnosticoSheet.push({
          'NIT': nit,
          'Proponente': razon,
          'NÚMERO DIAGNÓSTICO': n0(d.numero),
          'HERRAMIENTA 1': s(h[0]?.nombre), 'MUESTRA 1': s(h[0]?.muestra),
          'HERRAMIENTA 2': s(h[1]?.nombre), 'MUESTRA 2': s(h[1]?.muestra),
          'HERRAMIENTA 3': s(h[2]?.nombre), 'MUESTRA 3': s(h[2]?.muestra),
          'HERRAMIENTA 4': s(h[3]?.nombre), 'MUESTRA 4': s(h[3]?.muestra),
          'HERRAMIENTA 5': s(h[4]?.nombre), 'MUESTRA 5': s(h[4]?.muestra),
          'FECHA DE DIAGNÓSTICO': fmtFecha(d.fecha),
          '¿LA HERRAMIENTA ES DE CREACIÓN PROPIA?': s(d.herramientaPropia),
          'OTRO TIPO DE HERRAMIENTA, ¿CUÁL?': s(d.otraHerramienta),
          '¿CUENTA CON PLAN DE CAPACITACIÓN?': s(d.planCapacitacion),
          'DESCRIPCIÓN DE LAS HERRAMIENTAS Y MUESTRA': s(d.descripcion),
          'RESUMEN DE RESULTADOS DEL DIAGNÓSTICO': s(d.resumen),
        })
      }

      // ── Necesidades ──
      for (const ne of p.necesidades ?? []) {
        necesidadesSheet.push({
          'NIT': nit,
          'Proponente': razon,
          'NÚMERO DE NECESIDAD': n0(ne.numeroNecesidad),
          'NÚMERO DIAGNÓSTICO': n0(ne.numeroDiagnostico),
          'NECESIDAD': s(ne.necesidad),
          'NÚMERO DE BENEFICIARIOS': n0(ne.numeroBeneficiarios),
        })
      }

      for (const af of afsMatch) {
        const fin = finanzasAF(af)
        // ── Datos AF (columnas expandidas como el formulador) ──
        afSheet.push({
          'NIT': nit,
          'Proponente': razon,
          'CONSECUTIVO DE LA ACCIÓN DE FORMACIÓN': n0(af.consecutivo),
          'NOMBRE DE LA ACCIÓN DE FORMACIÓN': s(af.nombre),
          'DIAGNÓSTICO DE NECESIDADES': s(af.diagnostico),
          'ANÁLISIS DE CAUSAS Y EFECTOS': s(af.causasEfectos),
          'OBJETIVO(S) DE LA ACCIÓN DE FORMACIÓN': s(af.objetivos),
          'ENFOQUE DE LA ACCIÓN DE FORMACIÓN': s(af.enfoque),
          'EVENTO DE FORMACIÓN': s(af.eventoFormacion),
          'MODALIDAD DE FORMACIÓN': s(af.modalidadFormacion),
          'METODOLOGÍA DE FORMACIÓN': s(af.metodologia),
          'NÚMERO DE HORAS POR GRUPO': n0(af.horasPorGrupo),
          'NÚMERO DE GRUPOS': n0(af.numeroGrupos),
          'BENEFICIARIOS PRESENCIALES POR GRUPO': n0(af.beneficiariosPresenciales),
          'BENEFICIARIOS SINCRÓNICOS POR GRUPO': n0(af.beneficiariosSincronicos),
          'TOTAL DE HORAS DE LA AF': fin.totalHoras,
          'TOTAL DE BENEFICIARIOS DE LA AF': fin.totalBenef,
          'AREA 1': at(af.areas, 0), 'AREA 2': at(af.areas, 1), 'AREA 3': at(af.areas, 2), 'AREA 4': at(af.areas, 3), 'AREA 5': at(af.areas, 4),
          'JUSTIFICACIÓN ÁREAS FUNCIONALES': s(af.justificacionAreas),
          'NIVEL 1': at(af.niveles, 0), 'NIVEL 2': at(af.niveles, 1), 'NIVEL 3': at(af.niveles, 2),
          'JUSTIFICACIÓN NIVELES': s(af.justificacionNiveles),
          'IMPACTO DESEMPEÑO TRABAJADOR 1': at(af.impactosTrabajador, 0), 'IMPACTO DESEMPEÑO TRABAJADOR 2': at(af.impactosTrabajador, 1),
          'IMPACTO DESEMPEÑO TRABAJADOR 3': at(af.impactosTrabajador, 2), 'IMPACTO DESEMPEÑO TRABAJADOR 4': at(af.impactosTrabajador, 3),
          'IMPACTO DESEMPEÑO TRABAJADOR 5': at(af.impactosTrabajador, 4),
          'IMPACTO PRODUCTIVIDAD 1': at(af.impactosProductividad, 0), 'IMPACTO PRODUCTIVIDAD 2': at(af.impactosProductividad, 1),
          'IMPACTO PRODUCTIVIDAD 3': at(af.impactosProductividad, 2), 'IMPACTO PRODUCTIVIDAD 4': at(af.impactosProductividad, 3),
          'IMPACTO PRODUCTIVIDAD 5': at(af.impactosProductividad, 4),
          'NÚMERO DE EMPRESAS MIPYMES A BENEFICIAR': n0(af.mipymesEmpresas),
          'NÚMERO DE TRABAJADORES MIPYMES A BENEFICIAR': n0(af.mipymesTrabajadores),
          'JUSTIFICACIÓN MIPYMES A BENEFICIAR': s(af.justificacionMipymes),
          'NÚMERO DE EMPRESAS CADENA PRODUCTIVA A BENEFICIAR': n0(af.cadenaEmpresas),
          'NÚMERO DE TRABAJADORES CADENA PRODUCTIVA A BENEFICIAR': n0(af.cadenaTrabajadores),
          'JUSTIFICACIÓN CADENA PRODUCTIVA A BENEFICIAR': s(af.justificacionCadena),
          'NÚMERO DE TRABAJADORES MUJERES': n0(af.trabajadoresMujeres),
          'NÚMERO DE TRABAJADORES CAMPESINOS': n0(af.trabajadoresCampesinos),
          'NÚMERO DE TRABAJADORES EN CONDICIÓN DE DISCAPACIDAD': n0(af.trabajadoresDiscapacidad),
          'NÚMERO DE EMPRESAS BIC A BENEFICIAR': n0(af.empresasBic),
          'SECTOR 1': at(af.sectoresPertenecen, 0), 'SECTOR 2': at(af.sectoresPertenecen, 1), 'SECTOR 3': at(af.sectoresPertenecen, 2),
          'SECTOR 4': at(af.sectoresPertenecen, 3), 'SECTOR 5': at(af.sectoresPertenecen, 4),
          'SUBSECTOR 1': at(af.subsectoresPertenecen, 0), 'SUBSECTOR 2': at(af.subsectoresPertenecen, 1), 'SUBSECTOR 3': at(af.subsectoresPertenecen, 2),
          'SUBSECTOR 4': at(af.subsectoresPertenecen, 3), 'SUBSECTOR 5': at(af.subsectoresPertenecen, 4),
          'CLASIFICACIÓN POR SECTOR 1': at(af.sectoresBeneficia, 0), 'CLASIFICACIÓN POR SECTOR 2': at(af.sectoresBeneficia, 1),
          'CLASIFICACIÓN POR SECTOR 3': at(af.sectoresBeneficia, 2), 'CLASIFICACIÓN POR SECTOR 4': at(af.sectoresBeneficia, 3),
          'CLASIFICACIÓN POR SECTOR 5': at(af.sectoresBeneficia, 4),
          'CLASIFICACIÓN POR SUBSECTOR 1': at(af.subsectoresBeneficia, 0), 'CLASIFICACIÓN POR SUBSECTOR 2': at(af.subsectoresBeneficia, 1),
          'CLASIFICACIÓN POR SUBSECTOR 3': at(af.subsectoresBeneficia, 2), 'CLASIFICACIÓN POR SUBSECTOR 4': at(af.subsectoresBeneficia, 3),
          'CLASIFICACIÓN POR SUBSECTOR 5': at(af.subsectoresBeneficia, 4),
          'COMPONENTE ALINEACIÓN': s(af.componenteAlineacion),
          'DESCRIPCIÓN DE LA ALINEACIÓN': s(af.descripcionAlineacion),
          'JUSTIFICACIÓN ALINEACIÓN': s(af.justificacionAlineacion),
          'JUSTIFICACIÓN AF ESPECIALIZADA': s(af.justificacionEspecializada),
          'AMBIENTE DE APRENDIZAJE': s(af.ambiente),
          'MATERIAL DE FORMACIÓN': s(af.material),
          'JUSTIFICACIÓN SI APLICA (MATERIAL)': s(af.justificacionSiAplica),
          'GESTIÓN DEL CONOCIMIENTO': s(af.gestionConocimiento),
          '¿INCLUIR ESTA AF EN LA FORMULACIÓN?': s(af.incluirEnFormulacion),
          'INSUMOS': s(af.insumos),
          'JUSTIFICACIÓN DEL INSUMO': s(af.justificacionInsumo),
          'RECURSOS DIDÁCTICOS': s(af.recursosDidacticos),
          'CÓDIGO DE LA NECESIDAD': af.codigoNecesidad == null ? '' : n0(af.codigoNecesidad),
          'CÓDIGO DEL DIAGNÓSTICO': af.codigoDiagnostico == null ? '' : n0(af.codigoDiagnostico),
          'OCUPACIÓN CUOC 1': at(af.ocupacionesCuoc, 0), 'OCUPACIÓN CUOC 2': at(af.ocupacionesCuoc, 1), 'OCUPACIÓN CUOC 3': at(af.ocupacionesCuoc, 2),
          'OCUPACIÓN CUOC 4': at(af.ocupacionesCuoc, 3), 'OCUPACIÓN CUOC 5': at(af.ocupacionesCuoc, 4), 'OCUPACIÓN CUOC 6': at(af.ocupacionesCuoc, 5),
          'OCUPACIÓN CUOC 7': at(af.ocupacionesCuoc, 6), 'OCUPACIÓN CUOC 8': at(af.ocupacionesCuoc, 7), 'OCUPACIÓN CUOC 9': at(af.ocupacionesCuoc, 8),
          'OCUPACIÓN CUOC 10': at(af.ocupacionesCuoc, 9), 'OCUPACIÓN CUOC 11': at(af.ocupacionesCuoc, 10), 'OCUPACIÓN CUOC 12': at(af.ocupacionesCuoc, 11),
          'OCUPACIÓN CUOC 13': at(af.ocupacionesCuoc, 12), 'OCUPACIÓN CUOC 14': at(af.ocupacionesCuoc, 13), 'OCUPACIÓN CUOC 15': at(af.ocupacionesCuoc, 14),
          'OCUPACIÓN CUOC 16': at(af.ocupacionesCuoc, 15), 'OCUPACIÓN CUOC 17': at(af.ocupacionesCuoc, 16), 'OCUPACIÓN CUOC 18': at(af.ocupacionesCuoc, 17),
          'OCUPACIÓN CUOC 19': at(af.ocupacionesCuoc, 18), 'OCUPACIÓN CUOC 20': at(af.ocupacionesCuoc, 19),
          'VALIDACIÓN PRESUPUESTO AF': s(af.validacionPresupuesto),
          'JUSTIFICACIÓN AF': s(af.justificacion),
          'JUSTIFICACIÓN SECTORES Y SUB-SECTORES': s(af.justificacionSectores),
          'JUSTIFICACIÓN TRABAJADORES ECONOMÍA CAMPESINA': s(af.trabajadoresCampesinosTexto),
          'NÚMERO DE TRABAJADORES ECONOMÍA POPULAR': n0(af.trabajadoresPopular),
          'JUSTIFICACIÓN TRABAJADORES ECONOMÍA POPULAR': s(af.trabajadoresPopularTexto),
          'JUSTIFICACIÓN BENEFICIARIOS TALLER-PUESTO DE TRABAJO REAL': s(af.justificacionTallerPuesto),
          'EFECTOS DEL PROBLEMA O NECESIDAD': s(af.efectos),
        })

        // ── Datos UT ──
        for (const u of af.uts ?? []) {
          const pf = u.perfiles ?? []
          utSheet.push({
            'NIT': nit,
            'Proponente': razon,
            'NÚMERO AF': n0(af.consecutivo),
            'NOMBRE AF': s(af.nombre),
            'NÚMERO UT': n0(u.numeroUT),
            'NOMBRE UT': s(u.nombre),
            'HORAS PRÁCTICAS': n0(u.horasPracticas),
            'HORAS TEÓRICAS': n0(u.horasTeoricas),
            'TOTAL HORAS UT': n0(u.horasPracticas) + n0(u.horasTeoricas),
            'CONTENIDO UT': s(u.contenido),
            'COMPETENCIA UT': s(u.competencia),
            'ACTIVIDAD UT 1': at(u.actividades, 0), 'ACTIVIDAD UT 2': at(u.actividades, 1), 'ACTIVIDAD UT 3': at(u.actividades, 2),
            'ACTIVIDAD UT 4': at(u.actividades, 3), 'ACTIVIDAD UT 5': at(u.actividades, 4),
            'DESCRIPCIÓN DE LA ACTIVIDAD': s(u.descripcionActividad),
            'PERFIL 1': s(pf[0]?.perfil), 'HORAS EJECUTADAS 1': n0(pf[0]?.horas),
            'PERFIL 2': s(pf[1]?.perfil), 'HORAS EJECUTADAS 2': n0(pf[1]?.horas),
            'PERFIL 3': s(pf[2]?.perfil), 'HORAS EJECUTADAS 3': n0(pf[2]?.horas),
            'PERFIL 4': s(pf[3]?.perfil), 'HORAS EJECUTADAS 4': n0(pf[3]?.horas),
            'PERFIL 5': s(pf[4]?.perfil), 'HORAS EJECUTADAS 5': n0(pf[4]?.horas),
            'HABILIDAD TRANSVERSAL': s(u.articulacionTerritorial),
            '¿ES ARTICULACIÓN PARA EL DESARROLLO?': u.esArticulacionTerritorial ? 'SI' : 'NO',
          })
        }

        // ── Datos cobertura ──
        for (const cob of af.cobertura ?? []) {
          const dep = cob.departamentos ?? []
          const row: Record<string, unknown> = {
            'NIT': nit,
            'Proponente': razon,
            'AF': n0(af.consecutivo),
            'GRUPO': n0(cob.numeroGrupo),
            'DEPARTAMENTO PRE': s(cob.departamentoPresencial),
            'CIUDAD PRE': s(cob.ciudadPresencial),
            'BENEFICIARIOS': n0(cob.beneficiariosPresencial),
          }
          for (let i = 0; i < 25; i++) {
            row[`DEPARTAMENTO ${i + 1}`] = s(dep[i]?.departamento)
            row[`BENEFICIARIOS ${i + 1}`] = n0(dep[i]?.beneficiarios)
          }
          row['JUSTIFICACIÓN DE LA RELACIÓN CON LOS LUGARES DE EJECUCIÓN'] = s(cob.justificacion)
          coberturaSheet.push(row)
        }

        // ── Datos rubros ──
        for (const r of af.rubros ?? []) {
          const id = Number(r.idRubro)
          rubrosRows.push({
            prop: razon,
            af: n0(af.consecutivo),
            id: Number.isFinite(id) ? id : Number.MAX_SAFE_INTEGER,
            row: {
              'NIT': nit,
              'Proponente': razon,
              'N° AF': n0(af.consecutivo),
              'IDRUBRO': s(r.idRubro),
              'NOMBRERUBRO': s(r.nombreRubro),
              'DESCRIPCIÓN': s(r.descripcion),
              'JUSTIFICACIÓN': s(r.justificacion),
              'TARIFA MÁXIMA': n0(r.tarifaMaxima),
              '# HORAS': n0(r.numHoras),
              '# PÁGINAS/UNIDADES': n0(r.numPaginasUnidades),
              '# DE BENEFICIARIOS': n0(r.numBeneficiarios),
              '# DE DÍAS': n0(r.numDias),
              'TOTALRUBRO': n0(r.totalRubro),
              'VALOR MÁXIMO': n0(r.valorMaximo),
              'CASO': s(r.caso),
              'PAQUETE': s(r.paquete),
              'VALOR * BENEFICIARIOS': n0(r.valorPorBeneficiarios),
              'COFINANCIACIÓN SENA': n0(r.cofinanciacionSena),
              'CONTRAPARTIDA ESPECIE': n0(r.contrapartidaEspecie),
              'CONTRAPARTIDA DINERO': n0(r.contrapartidaDinero),
            },
          })
        }
      }

      // ── Datos presupuesto ──
      presupuestoSheet.push({
        'NIT': nit,
        'Proponente': razon,
        '# AF DEL PROYECTO': n0(pres?.numeroAFs),
        '# DE BENEFICIARIOS': n0(pres?.beneficiarios),
        'VALOR DE LAS AF': n0(pres?.valorAFs),
        'GASTOS DE OPERACIÓN': n0(pres?.gastosOperacion),
        'VALOR TRANSFERENCIA': n0(pres?.valorTransferencia),
        '# DE BENEFICIARIOS TRANSFERENCIA': n0(pres?.beneficiariosTransferencia),
        'POLIZA': n0(pres?.poliza),
        'VALOR TOTAL DEL PROYECTO': n0(pres?.valorTotal),
        'COFINANCIACIÓN SENA': n0(pres?.cofinanciacionSena),
        'CONTRAPARTIDA EN ESPECIE': n0(pres?.contrapartidaEspecie),
        'CONTRAPARTIDA EN DINERO': n0(pres?.contrapartidaDinero),
        'GASTOS OPERACIÓN COFINANCIACIÓN SENA': n0(pres?.gastosOpCofinSena),
        'GASTOS OPERACIÓN CONTRAPARTIDA ESPECIE': n0(pres?.gastosOpContraEspecie),
        'GASTOS OPERACIÓN CONTRAPARTIDA DINERO': n0(pres?.gastosOpContraDinero),
      })
    }

    // Orden final de los rubros: proponente → acción de formación → id de rubro.
    rubrosRows.sort((a, b) => a.prop.localeCompare(b.prop) || (a.af - b.af) || (a.id - b.id))
    const rubrosSheet = rubrosRows.map(x => x.row)

    const wb = XLSX.utils.book_new()
    const add = (data: Record<string, unknown>[], nombre: string) => {
      const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ '(sin datos)': '' }])
      XLSX.utils.book_append_sheet(wb, ws, nombre)
    }
    add(resumenSheet, 'Resumen')
    add(porProponenteSheet, 'Por proponente')
    add(basicosSheet, 'Datos basicos')
    add(contactoSheet, 'Datos contacto')
    add(generalesSheet, 'Datos generales')
    add(diagnosticoSheet, 'Diagnostico')
    add(necesidadesSheet, 'Necesidades')
    add(afSheet, 'Datos AF')
    add(utSheet, 'Datos UT')
    add(coberturaSheet, 'Datos cobertura')
    add(rubrosSheet, 'Datos rubros')
    add(presupuestoSheet, 'Datos presupuesto')

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  }
}
