/**
 * Restaurar las tablas vivas de un proyecto desde el snapshot de su versión FINAL (al aprobar).
 *
 * El snapshot guarda los ids que tenían las filas cuando se tomó. En el XE se reinsertan con esos mismos ids, como
 * antes; en el Exadata los triggers de id les ponen el siguiente número de la secuencia del SENA. Por eso cada padre
 * (AF, grupo, UT) se inserta leyendo con RETURNING el id que quedó, y las hijas usan ese id, no el del snapshot.
 *
 * Todo sale de un "plan": los valores que la restauración escribe, sacados del snapshot. Con el mismo plan se compara
 * el vivo contra el FINAL: si coinciden (sin contar los ids de las filas) no hace falta reescribir nada.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AHORA_UTC } from '../common/db/fecha-utc'
import { Ejecutor, SqlCrudo, insertarConId, leerId, sqlCrudo, tieneTriggerDeId } from '../common/db/ids'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const oracledb = require('oracledb') as { BIND_OUT: number; NUMBER: unknown }

type Json = Record<string, unknown>
type Valores = Record<string, unknown>

/** Una fila del snapshot: el id que traía y las columnas que se escriben, sin la llave ni la del padre. */
export interface Fila {
  idViejo: number
  valores: Valores
}
export interface PlanGrupo extends Fila {
  coberturas: Fila[]
}
export interface PlanUt extends Fila {
  actividades: Fila[]
  perfiles: Fila[]
}
export interface PlanAf extends Fila {
  // los snapshots viejos pueden traer el catálogo solo por nombre
  buscar: { tipoEvento: unknown; modalidad: unknown; metodologia: unknown }
  areas: Fila[]
  niveles: Fila[]
  cuoc: Fila[]
  sectoresBenef: Fila[]
  subsectoresBenef: Fila[]
  sectoresAf: Fila[]
  subsectoresAf: Fila[]
  gestionConocimientoId: number | null
  materialFormacionId: number | null
  recursos: Fila[]
  grupos: PlanGrupo[]
  uts: PlanUt[]
  rubros: Fila[]
  go: { idViejo: number; total: number; cofSena: number; especie: number; dinero: number } | null
  trans: { idViejo: number; beneficiarios: number; valor: number } | null
}
export interface PlanContacto {
  tipoDoc: unknown
  valores: Valores
}
export interface PlanRestauracion {
  proyecto: { nombre: unknown; objetivo: unknown } | null
  contactos: PlanContacto[]
  afs: PlanAf[]
}

/** id del snapshot -> id que quedó en la fila, por tabla padre. */
export interface MapasRestauracion {
  af: Map<number, number>
  grupo: Map<number, number>
  ut: Map<number, number>
}

export interface Contexto {
  proyectoId: number
  empresaId: number
  convocatoriaId: number
}

export interface RubroFijo {
  rubroId: number
  paquete: unknown
}

const esObjeto = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const obj = (v: unknown): Json => (esObjeto(v) ? v : {})
const lista = (v: unknown): Json[] => (Array.isArray(v) ? v.filter(esObjeto) : [])
const fila = (id: unknown, valores: Valores): Fila => ({ idViejo: Number(id), valores })

export function snapshotRestaurable(s: unknown): Json {
  if (!esObjeto(s)) throw new BadRequestException('Snapshot inválido: no se puede restaurar.')
  return s
}

// el plan

export function planDesdeSnapshot(snap: Json): PlanRestauracion {
  const meta = new Map<number, Json>()
  for (const a of lista(snap.acciones)) meta.set(Number(a.afId), a)
  const p = snap.proyecto
  return {
    proyecto: esObjeto(p) ? { nombre: p.nombre ?? null, objetivo: p.objetivo ?? null } : null,
    contactos: lista(snap.contactos).map((c) => ({
      tipoDoc: c.tipoDoc ?? null,
      valores: {
        CONTACTOEMPRESANOMBRE: c.nombre ?? null,
        CONTACTOEMPRESACARGO: c.cargo ?? null,
        CONTACTOEMPRESACORREO: c.correo ?? null,
        CONTACTOEMPRESATELEFONO: c.telefono ?? null,
        CONTACTOEMPRESADOCUMENTO: c.documento ?? null,
      },
    })),
    afs: lista(snap.accionesDetalle).map((det) => planAf(det, meta.get(Number(det.afId)) ?? {})),
  }
}

function planAf(det: Json, m: Json): PlanAf {
  const perfil = obj(det.perfil)
  const sectores = obj(det.sectores)
  const material = obj(det.material)
  const alineacion = obj(det.alineacion)
  const go = det.gastoOperacion
  const trans = det.transferencia
  return {
    idViejo: Number(det.afId),
    buscar: { tipoEvento: m.tipoEvento ?? null, modalidad: m.modalidad ?? null, metodologia: m.metodologia ?? null },
    valores: {
      ACCIONFORMACIONNUMERO: m.numero ?? null,
      ACCIONFORMACIONNOMBRE: m.nombre ?? null,
      NECESIDADFORMACIONIDAF: m.necesidadFormacionId ?? null,
      ACCIONFORMACIONJUSTNEC: m.justnec ?? null,
      ACCIONFORMACIONCAUSA: m.causa ?? null,
      ACCIONFORMACIONRESULTADOS: m.efectos ?? null,
      ACCIONFORMACIONOBJETIVO: m.objetivo ?? null,
      TIPOEVENTOID: m.tipoEventoId ?? null,
      MODALIDADFORMACIONID: m.modalidadFormacionId ?? null,
      METODOLOGIAAPRENDIZAJEID: m.metodologiaAprendizajeId ?? null,
      MODELOAPRENDIZAJEID: m.modeloAprendizajeId ?? null,
      ACCIONFORMACIONNUMHORAGRUPO: m.numHorasGrupo ?? null,
      ACCIONFORMACIONNUMGRUPOS: m.numGrupos ?? null,
      ACCIONFORMACIONNUMTOTHORASGRUP: m.numTotHoras ?? null,
      ACCIONFORMACIONBENEFGRUPO: m.benefGrupo ?? null,
      ACCIONFORMACIONBENEFVIGRUPO: m.benefViGrupo ?? null,
      ACCIONFORMACIONNUMBENEF: m.numBenef ?? null,
      AFENFOQUEID: perfil.afEnfoqueId ?? null,
      ACCIONFORMACIONAREAFUN: perfil.justAreas ?? null,
      ACCIONFORMACIONNIVELOCUPD: perfil.justNivelesOcu ?? null,
      ACCIONFORMACIONMUJER: perfil.mujer ?? null,
      ACCIONFORMACIONNUMCAMPESINO: perfil.numCampesino ?? null,
      ACCIONFORMACIONJUSTCAMPESINO: perfil.justCampesino ?? null,
      ACCIONFORMACIONNUMPOPULAR: perfil.numPopular ?? null,
      ACCIONFORMACIONJUSTPOPULAR: perfil.justPopular ?? null,
      ACCIONFORMACIONTRABDISCAPAC: perfil.trabDiscapac ?? null,
      ACCIONFORMACIONTRABAJADORBIC: perfil.trabajadorBic ?? null,
      ACCIONFORMACIONMIPYMES: perfil.mipymes ?? null,
      ACCIONFORMACIONTRABMIPYMES: perfil.trabMipymes ?? null,
      ACCIONFORMACIONMIPYMESD: perfil.mipymesD ?? null,
      ACCIONFORMACIONCADENAPROD: perfil.cadenaProd ?? null,
      ACCIONFORMACIONTRABCADPROD: perfil.trabCadProd ?? null,
      ACCIONFORMACIONCADENAPRODD: perfil.cadenaProdD ?? null,
      ACCIONFORMACIONSECSUBD: sectores.justificacion ?? null,
      ACCIONFORMACIONCOMPONENTEID: alineacion.componenteId ?? null,
      ACCIONFORMACIONCOMPOD: alineacion.compod ?? null,
      ACCIONFORMACIONJUSTIFICACION: alineacion.justificacion ?? null,
      ACCIONFORMACIONRESDESEM: alineacion.resDesem ?? null,
      ACCIONFORMACIONRESFORM: alineacion.resForm ?? null,
      TIPOAMBIENTEID: material.tipoAmbienteId ?? null,
      ACCIONFORMACIONJUSTMAT: material.justMat ?? null,
      ACCIONFORMACIONINSUMO: material.insumo ?? null,
      ACCIONFORMACIONJUSTINSUMO: material.justInsumo ?? null,
    },
    areas: lista(perfil.areas).map((a) =>
      fila(a.aafId, { AREAFUNCIONALIDAF: Number(a.areaId), AFAREAFUNCIONALOTRO: a.otro ?? null }),
    ),
    niveles: lista(perfil.niveles).map((n) => fila(n.anId, { NIVELOCUPACIONALIDAF: Number(n.nivelId) })),
    cuoc: lista(perfil.cuoc).map((c) => fila(c.ocAfId, { OCUPACIONCUOCID: Number(c.cuocId) })),
    sectoresBenef: lista(sectores.sectoresBenef).map((s) =>
      fila(s.psId, { SECTORAFID: Number(s.sectorId), AFPSECTORESTADO: 1 }),
    ),
    subsectoresBenef: lista(sectores.subsectoresBenef).map((s) =>
      fila(s.pssId, { SUBSECTORAFID: Number(s.subsectorId), AFPSUBSECTORESTADO: 1 }),
    ),
    sectoresAf: lista(sectores.sectoresAf).map((s) => fila(s.saId, { SECTORAFID: Number(s.sectorId) })),
    subsectoresAf: lista(sectores.subsectoresAf).map((s) => fila(s.ssaId, { SUBSECTORAFID: Number(s.subsectorId) })),
    gestionConocimientoId: material.gestionConocimientoId ? Number(material.gestionConocimientoId) : null,
    materialFormacionId: material.materialFormacionId ? Number(material.materialFormacionId) : null,
    recursos: lista(material.recursos).map((r) => fila(r.rdafId, { RECURSOSDIDACTICOSID: Number(r.recursoId) })),
    grupos: lista(det.grupos).map((g) => ({
      ...fila(g.grupoId, { AFGRUPONUMERO: Number(g.grupoNumero), AFGRUPOJUSTIFICACION: g.justificacion ?? null }),
      coberturas: lista(g.coberturas).map((cob) =>
        fila(cob.cobId, {
          DEPARTAMENTOGRUPOID: cob.deptoId ?? null,
          CIUDADGRUPOID: cob.ciudadId ?? null,
          AFGRUPOCOBERTURABENEF: cob.benef ?? 0,
          AFGRUPOCOBERTURAMOD: cob.modal ?? 'P',
          AFGRUPOCOBERTURARURAL: cob.rural ?? 0,
        }),
      ),
    })),
    uts: lista(det.unidadesTematicas).map((ut) => ({
      ...fila(ut.utId, {
        UNIDADTEMATICANUMERO: Number(ut.numero),
        UNIDADTEMATICANOMBRE: ut.nombre ?? null,
        UNIDADTEMATICACOMPETENCIAS: ut.competencias ?? null,
        UNIDADTEMATICACONTENIDO: ut.contenido ?? null,
        UNIDADTEMATICAJUSTACTIVIDAD: ut.justActividad ?? null,
        UNIDADTEMATICAHORASPP: ut.horasPP ?? 0,
        UNIDADTEMATICAHORASPV: ut.horasPV ?? 0,
        UNIDADTEMATICAHORASPPAT: ut.horasPPAT ?? 0,
        UNIDADTEMATICAHORASPHIB: ut.horasPHib ?? 0,
        UNIDADTEMATICAHORASTP: ut.horasTP ?? 0,
        UNIDADTEMATICAHORASTV: ut.horasTV ?? 0,
        UNIDADTEMATICAHORASTPAT: ut.horasTPAT ?? 0,
        UNIDADTEMATICAHORASTHIB: ut.horasTHib ?? 0,
        UNIDADTEMATICAESTRANSVERSAL: Number(ut.esTransversal) || 0,
        UNIDADTEMATICAHORASTRANSVERSAL: ut.horasTransversal ?? null,
        ARTICULACIONTERRITORIALID: ut.articulacionTerritorialId ?? null,
      }),
      actividades: lista(ut.actividades).map((a) =>
        fila(a.actId, { UTACTIVIDADESID: Number(a.actividadId), ACTIVIDADUTOTRO: a.otro ?? null }),
      ),
      perfiles: lista(ut.perfiles).map((p) =>
        fila(p.perfilId, { RUBROIDUT: Number(p.rubroId), PERFILUTHORASCAP: p.horasCap ?? 0, PERFILUTDIAS: p.dias ?? null }),
      ),
    })),
    rubros: lista(det.rubros).map((r) =>
      fila(r.afrubroid, {
        RUBROID: Number(r.rubroId),
        AFRUBROJUSTIFICACION: r.justificacion ?? null,
        AFRUBRONUMHORAS: r.numHoras ?? 0,
        AFRUBROCANTIDAD: r.cantidad ?? 0,
        AFRUBROBENEFICIARIOS: r.beneficiarios ?? 0,
        AFRUBRODIAS: r.dias ?? 0,
        AFRUBRONUMEROGRUPOS: r.numGrupos ?? 0,
        AFRUBROVALOR: Number(r.totalRubro) || 0,
        AFRUBROCOFINANCIACION: Number(r.cofSena) || 0,
        AFRUBROESPECIE: Number(r.contraEspecie) || 0,
        AFRUBRODINERO: Number(r.contraDinero) || 0,
        AFRUBROVALORMAXIMO: Number(r.valorMaximo) || 0,
        AFRUBROVALORPORBENEFICIARIO: Number(r.valorBenef) || 0,
        AFRUBROPAQUETE: r.paquete ?? null,
        AFRUBROPORCENTAJECOFINANCIACION: Number(r.porcSena) || 0,
        AFRUBROPORCENTAJEESPECIE: Number(r.porcEspecie) || 0,
        AFRUBROPORCENTAJEDINERO: Number(r.porcDinero) || 0,
      }),
    ),
    go:
      esObjeto(go) && Number(go.total) > 0
        ? {
            idViejo: Number(go.afrubroid),
            total: Number(go.total) || 0,
            cofSena: Number(go.cofSena) || 0,
            especie: Number(go.especie) || 0,
            dinero: Number(go.dinero) || 0,
          }
        : null,
    trans:
      esObjeto(trans) && Number(trans.valor) > 0
        ? {
            idViejo: Number(trans.afrubroid),
            beneficiarios: Number(trans.beneficiarios) || 0,
            valor: Number(trans.valor) || 0,
          }
        : null,
  }
}

// vivo contra FINAL

// lo que la restauración escribiría, sin los ids de las filas ni los nombres de catálogo de los snapshots viejos
function firma(plan: PlanRestauracion): string {
  return JSON.stringify(plan, (clave: string, valor: unknown) =>
    clave === 'idViejo' || clave === 'buscar' ? undefined : valor,
  )
}

/**
 * Si el vivo ya tiene el mismo contenido que el FINAL (aunque sus filas tengan otros ids), devuelve el mapa
 * afId del FINAL -> afId vivo, emparejadas en orden; si no, null y hay que restaurar.
 */
export function emparejarSiMismoContenido(
  vivo: PlanRestauracion,
  final: PlanRestauracion,
): Map<number, number> | null {
  if (firma(vivo) !== firma(final)) return null
  return new Map(final.afs.map((a, i): [number, number] => [a.idViejo, vivo.afs[i].idViejo]))
}

/**
 * Sin restaurar, el frontend manda los afId del FINAL (lo normal: el admin aprueba viendo el snapshot) o los vivos
 * (si no pudo cargar el snapshot), todos de la misma fuente. Devuelve afId enviado -> afId vivo. Si un id enviado es
 * en el FINAL de una AF y en el vivo de otra, la fuente la dicen los demás ids enviados; si no alcanzan, se rechaza:
 * no se adivina a qué AF va un concepto o un motivo.
 */
export function aceptarTambienVivos(emparejados: Map<number, number>, enviados: number[]): Map<number, number> {
  const vivos = new Map([...emparejados.values()].map((v): [number, number] => [v, v]))
  const ids = [...new Set(enviados.map(Number))]
  const ambiguos = ids.filter((id) => vivos.has(id) && emparejados.has(id) && emparejados.get(id) !== id)
  if (!ambiguos.length) return new Map([...vivos, ...emparejados])
  const hayDelFinal = ids.some((id) => emparejados.has(id) && !vivos.has(id))
  const hayVivos = ids.some((id) => vivos.has(id) && !emparejados.has(id))
  if (hayDelFinal !== hayVivos) return hayDelFinal ? emparejados : vivos
  throw new BadRequestException(
    `No se puede saber a qué acción de formación van el concepto o el motivo enviados para ${muestra(ambiguos)}: ` +
      'ese id es de una AF en la versión FINAL y de otra en el proyecto. No se modificó nada.',
  )
}

/** Las AF que manda el frontend llevadas a su id vivo; las que no están en el mapa se descartan. */
export function traducirAfs<T extends { afId: number }>(
  items: T[],
  mapa: Map<number, number>,
): Array<T & { afIdVivo: number }> {
  const salida: Array<T & { afIdVivo: number }> = []
  for (const it of items) {
    const vivo = mapa.get(Number(it.afId))
    if (vivo !== undefined) salida.push({ ...it, afIdVivo: vivo })
  }
  return salida
}

// la guarda

const SQL_DUENO_AF = `SELECT ACCIONFORMACIONID AS "id", PROYECTOID AS "dueno"
   FROM ACCIONFORMACION WHERE ACCIONFORMACIONID IN ({ids})`
const SQL_DUENO_GRUPO = `SELECT g.AFGRUPOID AS "id", a.PROYECTOID AS "dueno"
   FROM AFGRUPO g LEFT JOIN ACCIONFORMACION a ON a.ACCIONFORMACIONID = g.ACCIONFORMACIONID
  WHERE g.AFGRUPOID IN ({ids})`
const SQL_DUENO_UT = `SELECT UNIDADTEMATICAID AS "id", PROYECTOIDUT AS "dueno"
   FROM UNIDADTEMATICA WHERE UNIDADTEMATICAID IN ({ids})`
const SQL_RUBROS = `SELECT RUBROID AS "id", CONVOCATORIAIDRUBRO AS "dueno"
   FROM RUBRO WHERE RUBROID IN ({ids})`
const SQL_NECESIDADES = `SELECT nf.NECESIDADFORMACIONID AS "id", n.EMPRESANECESIDADID AS "dueno"
   FROM NECESIDADFORMACION nf LEFT JOIN NECESIDAD n ON n.NECESIDADID = nf.NECESIDADID
  WHERE nf.NECESIDADFORMACIONID IN ({ids})`
const SQL_COMPONENTES = `SELECT AFCOMPONENTEID AS "id", AFCOMPONENTEID AS "dueno"
   FROM AFCOMPONENTE WHERE AFCOMPONENTEID IN ({ids})`
// R09 y R015 de la convocatoria del proyecto: con ROWNUM = 1 a secas salía el de otra convocatoria
const SQL_RUBRO_FIJO = `SELECT r.RUBROID AS "rubroId", r.RUBROPAQUETE AS "paquete"
   FROM RUBRO r
  WHERE TRIM(r.RUBROCODIGO) = :1
    AND r.CONVOCATORIAIDRUBRO = :2
    AND ROWNUM = 1`

const esIdValido = (n: number) => Number.isSafeInteger(n) && n > 0

// IN con binds y en trozos: Oracle no admite más de 1000 elementos en una lista
async function porIds(ej: Ejecutor, sql: string, ids: number[]): Promise<Json[]> {
  const unicos = [...new Set(ids.filter(esIdValido))]
  const filas: Json[] = []
  for (let i = 0; i < unicos.length; i += 500) {
    const trozo = unicos.slice(i, i + 500)
    const binds = trozo.map((_, j) => `:${j + 1}`).join(', ')
    filas.push(...((await ej.query(sql.replace('{ids}', binds), trozo)) as Json[]))
  }
  return filas
}

/** Filas cuyo dueño (proyecto, convocatoria o empresa) no es el esperado. */
function deOtroDueno(filas: Json[], esperado: number, ignorarSinDueno: boolean): number[] {
  return filas
    .filter((f) => !(ignorarSinDueno && f.dueno == null) && Number(f.dueno) !== esperado)
    .map((f) => Number(f.id))
}

function faltantes(ids: number[], filas: Json[]): number[] {
  const hay = new Set(filas.map((f) => Number(f.id)))
  return [...new Set(ids)].filter((id) => !hay.has(id))
}

const muestra = (ids: number[]) =>
  ids.slice(0, 10).join(', ') + (ids.length > 10 ? ` y ${ids.length - 10} más` : '')

async function leerContexto(ej: Ejecutor, proyectoId: number): Promise<Contexto> {
  const filas = (await ej.query(
    `SELECT EMPRESAID AS "empresaId", CONVOCATORIAID AS "convocatoriaId" FROM PROYECTO WHERE PROYECTOID = :1`,
    [proyectoId],
  )) as Json[]
  const p = filas[0]
  if (!p) throw new NotFoundException('Proyecto no encontrado')
  return { proyectoId, empresaId: Number(p.empresaId), convocatoriaId: Number(p.convocatoriaId) }
}

async function rubroFijo(ej: Ejecutor, codigo: string, convocatoriaId: number): Promise<RubroFijo | null> {
  const [r] = (await ej.query(SQL_RUBRO_FIJO, [codigo, convocatoriaId])) as Json[]
  return r ? { rubroId: Number(r.rubroId), paquete: r.paquete ?? null } : null
}

/**
 * Antes de borrar nada: el snapshot tiene que ser de este proyecto y sus referencias tienen que existir en esta base.
 * El id de proyecto que trae el snapshot no se mira: en el Exadata los proyectos migrados tienen otro número.
 */
export async function validarSnapshot(
  ej: Ejecutor,
  ctx: Contexto,
  snap: Json,
  plan: PlanRestauracion,
): Promise<{ r09: RubroFijo | null; r015: RubroFijo | null }> {
  const problemas: string[] = []

  const convSnap = Number(obj(snap.proyecto).convocatoriaId) || 0
  if (convSnap !== ctx.convocatoriaId) {
    problemas.push(`la versión es de la convocatoria ${convSnap || '(sin dato)'} y el proyecto es de la ${ctx.convocatoriaId}`)
  }

  // el dueño solo cuenta donde se reinserta el id del snapshot (tabla sin trigger de id, hoy el XE). Con trigger va
  // NULL y la base pone el número: que ese id sea aquí de otro proyecto no choca con nada
  const ajenas: Array<[string, string, string, string, number[]]> = [
    ['acciones de formación', SQL_DUENO_AF, 'ACCIONFORMACION', 'ACCIONFORMACIONID', plan.afs.map((a) => a.idViejo)],
    ['grupos', SQL_DUENO_GRUPO, 'AFGRUPO', 'AFGRUPOID', plan.afs.flatMap((a) => a.grupos.map((g) => g.idViejo))],
    ['unidades temáticas', SQL_DUENO_UT, 'UNIDADTEMATICA', 'UNIDADTEMATICAID',
      plan.afs.flatMap((a) => a.uts.map((u) => u.idViejo))],
  ]
  for (const [que, sql, tabla, pk, ids] of ajenas) {
    if (await tieneTriggerDeId(ej, tabla, pk)) continue
    const otras = deOtroDueno(await porIds(ej, sql, ids), ctx.proyectoId, true)
    if (otras.length) problemas.push(`sus ${que} (${muestra(otras)}) son de otro proyecto en esta base`)
  }

  // en el SEP una AF solo ofrece rubros de su convocatoria y necesidades de su empresa: si un id del snapshot es aquí
  // de otra, en esta base ese número es otra fila (snapshot tomado en el XE) y restaurarlo la enlazaría mal
  const rubroIds = plan.afs.flatMap((a) => [
    ...a.rubros.map((r) => Number(r.valores.RUBROID)),
    ...a.uts.flatMap((u) => u.perfiles.map((p) => Number(p.valores.RUBROIDUT))),
  ])
  const rubros = await porIds(ej, SQL_RUBROS, rubroIds)
  const sinRubro = faltantes(rubroIds, rubros)
  if (sinRubro.length) problemas.push(`apunta a rubros que no existen (${muestra(sinRubro)})`)
  const rubrosAjenos = deOtroDueno(rubros, ctx.convocatoriaId, false)
  if (rubrosAjenos.length) problemas.push(`apunta a rubros de otra convocatoria (${muestra(rubrosAjenos)})`)

  const necIds = plan.afs.map((a) => a.valores.NECESIDADFORMACIONIDAF).filter((v) => v != null).map(Number)
  const necesidades = await porIds(ej, SQL_NECESIDADES, necIds)
  const sinNec = faltantes(necIds, necesidades)
  if (sinNec.length) problemas.push(`apunta a necesidades de formación que no existen (${muestra(sinNec)})`)
  const necAjenas = deOtroDueno(necesidades, ctx.empresaId, false)
  if (necAjenas.length) problemas.push(`apunta a necesidades de formación de otra empresa (${muestra(necAjenas)})`)

  const compIds = plan.afs.map((a) => a.valores.ACCIONFORMACIONCOMPONENTEID).filter((v) => v != null).map(Number)
  const sinComp = faltantes(compIds, await porIds(ej, SQL_COMPONENTES, compIds))
  if (sinComp.length) problemas.push(`apunta a componentes que no existen (${muestra(sinComp)})`)

  const r09 = plan.afs.some((a) => a.go) ? await rubroFijo(ej, 'R09', ctx.convocatoriaId) : null
  if (plan.afs.some((a) => a.go) && !r09) {
    problemas.push(`tiene gastos de operación y la convocatoria ${ctx.convocatoriaId} no tiene rubro R09`)
  }
  const r015 = plan.afs.some((a) => a.trans) ? await rubroFijo(ej, 'R015', ctx.convocatoriaId) : null
  if (plan.afs.some((a) => a.trans) && !r015) {
    problemas.push(`tiene transferencia y la convocatoria ${ctx.convocatoriaId} no tiene rubro R015`)
  }

  if (problemas.length) {
    throw new BadRequestException(
      `No se puede restaurar la versión FINAL sobre este proyecto: ${problemas.join('; ')}. No se modificó nada.`,
    )
  }
  return { r09, r015 }
}

// la restauración

const IDENT = /^[A-Z][A-Z0-9_]*$/

/**
 * INSERT que conserva el id del snapshot donde la tabla no tiene trigger de id (hoy, el XE: lo que hacía el código
 * antes) y, donde lo tiene (el Exadata), manda NULL para que el trigger ponga el siguiente número de la secuencia.
 * Devuelve el id que quedó en la fila (RETURNING, en la misma sentencia).
 */
export async function insertarConservandoId(
  ej: Ejecutor,
  tabla: string,
  pk: string,
  idViejo: number,
  valores: Valores,
): Promise<number> {
  const cols = Object.keys(valores)
  for (const n of [tabla, pk, ...cols]) {
    if (!IDENT.test(n)) throw new Error(`insertarConservandoId: identificador inválido (${n})`)
  }
  if (cols.includes(pk)) throw new Error(`insertarConservandoId: ${pk} no va en los valores`)

  const conTrigger = await tieneTriggerDeId(ej, tabla, pk)
  if (!conTrigger && !esIdValido(idViejo)) {
    throw new BadRequestException(`El snapshot no trae un id válido para ${tabla}: no se puede restaurar.`)
  }
  const params: unknown[] = conTrigger ? [] : [idViejo]
  const vals = cols.map((c) => {
    const v = valores[c]
    if (v instanceof SqlCrudo) return v.texto
    params.push(v)
    return `:${params.length}`
  })
  params.push({ dir: oracledb.BIND_OUT, type: oracledb.NUMBER })
  const sql =
    `INSERT INTO ${tabla} (${[pk, ...cols].join(', ')}) VALUES (${[conTrigger ? 'NULL' : ':1', ...vals].join(', ')}) ` +
    `RETURNING ${pk} INTO :${params.length}`
  return leerId(await ej.query(sql, params), tabla)
}

async function buscarPorNombre(
  ej: Ejecutor,
  tabla: string,
  colNombre: string,
  colId: string,
  nombre: unknown,
): Promise<number | null> {
  if (!nombre) return null
  const rows = (await ej.query(
    `SELECT ${colId} AS "id" FROM ${tabla} WHERE UPPER(TRIM(${colNombre})) = UPPER(TRIM(:1))`,
    [String(nombre).trim()],
  )) as Json[]
  return rows[0]?.id ? Number(rows[0].id) : null
}

// fallback para snapshots viejos: los catálogos de la AF por nombre si no vienen por id
async function resolverCatalogosAf(ej: Ejecutor, af: PlanAf): Promise<Valores> {
  const v: Valores = { ...af.valores }
  if (v.TIPOEVENTOID == null) {
    v.TIPOEVENTOID = await buscarPorNombre(ej, 'TIPOEVENTO', 'TIPOEVENTONOMBRE', 'TIPOEVENTOID', af.buscar.tipoEvento)
  }
  if (v.MODALIDADFORMACIONID == null) {
    v.MODALIDADFORMACIONID = await buscarPorNombre(
      ej, 'MODALIDADFORMACION', 'MODALIDADFORMACIONNOMBRE', 'MODALIDADFORMACIONID', af.buscar.modalidad,
    )
  }
  if (v.METODOLOGIAAPRENDIZAJEID == null) {
    v.METODOLOGIAAPRENDIZAJEID = await buscarPorNombre(
      ej, 'METODOLOGIAAPRENDIZAJE', 'METODOLOGIAAPRENDIZAJENOMBRE', 'METODOLOGIAAPRENDIZAJEID', af.buscar.metodologia,
    )
  }
  const etiqueta = String(v.ACCIONFORMACIONNUMERO ?? af.idViejo)
  if (v.MODALIDADFORMACIONID == null) {
    throw new BadRequestException(
      `No se pudo resolver MODALIDADFORMACIONID para la AF ${etiqueta} (modalidad="${String(af.buscar.modalidad ?? '')}"). ` +
      'El snapshot está incompleto. Crea una nueva versión con el código actualizado y márcala como FINAL antes de aprobar.',
    )
  }
  if (v.TIPOEVENTOID == null) {
    throw new BadRequestException(
      `No se pudo resolver TIPOEVENTOID para la AF ${etiqueta} (evento="${String(af.buscar.tipoEvento ?? '')}"). ` +
      'El snapshot está incompleto. Crea una nueva versión con el código actualizado y márcala como FINAL antes de aprobar.',
    )
  }
  return v
}

// el snapshot guarda el tipo de documento del contacto por nombre, no por id
async function tipoDocumento(ej: Ejecutor, tipoDoc: unknown): Promise<unknown> {
  if (!tipoDoc) return null
  const rows = (await ej.query(
    `SELECT TIPODOCUMENTOIDENTIDADID AS "id"
       FROM TIPODOCUMENTOIDENTIDAD
      WHERE UPPER(TRIM(TIPODOCUMENTOIDENTIDADNOMBRE)) = UPPER(TRIM(:1))`,
    [tipoDoc],
  )) as Json[]
  return rows[0]?.id ?? null
}

// DELETE en orden de FKs
async function borrarVivo(ej: Ejecutor, proyectoId: number): Promise<void> {
  const q = (sql: string) => ej.query(sql, [proyectoId])
  const afIds = (await q(`SELECT ACCIONFORMACIONID AS "id" FROM ACCIONFORMACION WHERE PROYECTOID = :1`)) as Json[]
  if (afIds.length > 0) {
    await q(`DELETE FROM AFRUBRO WHERE PROYECTOIDRUBROAF = :1`)
    await q(`DELETE FROM AFGRUPOCOBERTURA WHERE AFGRUPOID IN
               (SELECT AFGRUPOID FROM AFGRUPO WHERE ACCIONFORMACIONID IN
                 (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1))`)
    await q(`DELETE FROM AFGRUPO WHERE ACCIONFORMACIONID IN
               (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`)
    await q(`DELETE FROM ACTIVIDADUT WHERE UNIDADTEMATICAID IN
               (SELECT UNIDADTEMATICAID FROM UNIDADTEMATICA WHERE PROYECTOIDUT = :1)`)
    await q(`DELETE FROM PERFILUT WHERE UNIDADTEMATICAID IN
               (SELECT UNIDADTEMATICAID FROM UNIDADTEMATICA WHERE PROYECTOIDUT = :1)`)
    await q(`DELETE FROM UNIDADTEMATICA WHERE PROYECTOIDUT = :1`)
    await q(`DELETE FROM AFAREAFUNCIONAL WHERE ACCIONFORMACIONIDAF IN
               (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`)
    await q(`DELETE FROM AFNIVELOCUPACIONAL WHERE ACCIONFORMACIONID IN
               (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`)
    await q(`DELETE FROM OCUPACIONCOUCAF WHERE ACCIONFORMACIONID IN
               (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`)
    await q(`DELETE FROM AFPSECTOR WHERE ACCIONFORMACIONID IN
               (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`)
    await q(`DELETE FROM AFPSUBSECTOR WHERE ACCIONFORMACIONID IN
               (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`)
    await q(`DELETE FROM AFSECTOR WHERE ACCIONFORMACIONID IN
               (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`)
    await q(`DELETE FROM AFSUBSECTOR WHERE ACCIONFORMACIONID IN
               (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`)
    await q(`DELETE FROM AFGESTIONCONOCIMIENTO WHERE ACCIONFORMACIONID IN
               (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`)
    await q(`DELETE FROM MATERIALFORMACIONAF WHERE ACCIONFORMACIONID IN
               (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`)
    await q(`DELETE FROM RECURSOSDIDACTICOSAF WHERE ACCIONFORMACIONID IN
               (SELECT ACCIONFORMACIONID FROM ACCIONFORMACION WHERE PROYECTOID = :1)`)
    await q(`DELETE FROM ACCIONFORMACION WHERE PROYECTOID = :1`)
  }
  // Contactos del proyecto (no contactos generales de la empresa)
  await q(`DELETE FROM CONTACTOEMPRESA WHERE PROYECTOIDCONTACTOS = :1`)
}

async function insertarAf(
  ej: Ejecutor,
  ctx: Contexto,
  af: PlanAf,
  valores: Valores,
  fijos: { r09: RubroFijo | null; r015: RubroFijo | null },
  mapas: MapasRestauracion,
): Promise<void> {
  const afId = await insertarConservandoId(ej, 'ACCIONFORMACION', 'ACCIONFORMACIONID', af.idViejo, {
    PROYECTOID: ctx.proyectoId,
    ...valores,
    ACCIONFORMACIONFECHAREGISTRO: sqlCrudo(AHORA_UTC),
  })
  mapas.af.set(af.idViejo, afId)

  const hijas = async (tabla: string, pk: string, colAf: string, filas: Fila[]) => {
    for (const f of filas) await insertarConservandoId(ej, tabla, pk, f.idViejo, { [colAf]: afId, ...f.valores })
  }
  // Áreas funcionales / Niveles / CUOC
  await hijas('AFAREAFUNCIONAL', 'AFAREAFUNCIONALID', 'ACCIONFORMACIONIDAF', af.areas)
  await hijas('AFNIVELOCUPACIONAL', 'AFNIVELOCUPACIONALID', 'ACCIONFORMACIONID', af.niveles)
  await hijas('OCUPACIONCOUCAF', 'OCUPACIONCOUCAFID', 'ACCIONFORMACIONID', af.cuoc)
  // Sectores / Subsectores benef + AF
  await hijas('AFPSECTOR', 'AFPSECTORID', 'ACCIONFORMACIONID', af.sectoresBenef)
  await hijas('AFPSUBSECTOR', 'AFPSUBSECTORID', 'ACCIONFORMACIONID', af.subsectoresBenef)
  await hijas('AFSECTOR', 'AFSECTORID', 'ACCIONFORMACIONID', af.sectoresAf)
  await hijas('AFSUBSECTOR', 'AFSUBSECTORID', 'ACCIONFORMACIONID', af.subsectoresAf)
  // Material — gestión / material / recursos
  if (af.gestionConocimientoId) {
    await insertarConId(ej, 'AFGESTIONCONOCIMIENTO', 'AFGESTIONCONOCIMIENTOID', { maxMasUno: true }, {
      ACCIONFORMACIONID: afId,
      GESTIONCONOCIMIENTOID: af.gestionConocimientoId,
    })
  }
  if (af.materialFormacionId) {
    await insertarConId(ej, 'MATERIALFORMACIONAF', 'MATERIALFORMACIONAFID', { maxMasUno: true }, {
      ACCIONFORMACIONID: afId,
      MATERIALFORMACIONID: af.materialFormacionId,
    })
  }
  await hijas('RECURSOSDIDACTICOSAF', 'RECURSOSDIDACTICOSAFID', 'ACCIONFORMACIONID', af.recursos)

  // Grupos + coberturas
  for (const g of af.grupos) {
    const grupoId = await insertarConservandoId(ej, 'AFGRUPO', 'AFGRUPOID', g.idViejo, {
      ACCIONFORMACIONID: afId,
      ...g.valores,
    })
    mapas.grupo.set(g.idViejo, grupoId)
    for (const cob of g.coberturas) {
      // AFGRUPOFILTRO guarda la AF del grupo
      await insertarConservandoId(ej, 'AFGRUPOCOBERTURA', 'AFGRUPOCOBERTURAID', cob.idViejo, {
        AFGRUPOID: grupoId,
        AFGRUPOFILTRO: afId,
        ...cob.valores,
      })
    }
  }

  // Unidades temáticas + actividades + perfiles
  for (const ut of af.uts) {
    const utId = await insertarConservandoId(ej, 'UNIDADTEMATICA', 'UNIDADTEMATICAID', ut.idViejo, {
      PROYECTOIDUT: ctx.proyectoId,
      ACCIONFORMACIONID: afId,
      ...ut.valores,
      UNIDADTEMATICAFECHAREGISTRO: sqlCrudo(AHORA_UTC),
    })
    mapas.ut.set(ut.idViejo, utId)
    for (const a of ut.actividades) {
      await insertarConservandoId(ej, 'ACTIVIDADUT', 'ACTIVIDADUTID', a.idViejo, { UNIDADTEMATICAID: utId, ...a.valores })
    }
    for (const p of ut.perfiles) {
      await insertarConservandoId(ej, 'PERFILUT', 'PERFILUTID', p.idViejo, {
        UNIDADTEMATICAID: utId,
        ...p.valores,
        PERFILUTFECHAREGISTRO: sqlCrudo(AHORA_UTC),
      })
    }
  }

  // Rubros (excluye R09 / R015 que se insertan aparte abajo)
  const rubro = (idViejo: number, v: Valores) =>
    insertarConservandoId(ej, 'AFRUBRO', 'AFRUBROID', idViejo, {
      PROYECTOIDRUBROAF: ctx.proyectoId,
      ACCIONFORMACIONID: afId,
      ...v,
      AFRUBROFECHAREGISTRO: sqlCrudo(AHORA_UTC),
    })
  for (const r of af.rubros) await rubro(r.idViejo, r.valores)

  // Gasto de operación (R09)
  if (af.go && fijos.r09) {
    const { total, cofSena, especie, dinero } = af.go
    await rubro(af.go.idViejo, {
      RUBROID: fijos.r09.rubroId,
      AFRUBROJUSTIFICACION: 'GASTOS DE OPERACIÓN',
      AFRUBROCANTIDAD: 1,
      AFRUBROVALOR: total,
      AFRUBROCOFINANCIACION: cofSena,
      AFRUBROESPECIE: especie,
      AFRUBRODINERO: dinero,
      AFRUBROPAQUETE: fijos.r09.paquete,
      AFRUBROPORCENTAJECOFINANCIACION: total > 0 ? (cofSena / total) * 100 : 0,
      AFRUBROPORCENTAJEESPECIE: total > 0 ? (especie / total) * 100 : 0,
      AFRUBROPORCENTAJEDINERO: total > 0 ? (dinero / total) * 100 : 0,
    })
  }

  // Transferencia (R015)
  if (af.trans && fijos.r015) {
    await rubro(af.trans.idViejo, {
      RUBROID: fijos.r015.rubroId,
      AFRUBROJUSTIFICACION: 'TRANSFERENCIA CONOCIMIENTO',
      AFRUBROCANTIDAD: 1,
      AFRUBROBENEFICIARIOS: af.trans.beneficiarios,
      AFRUBROVALOR: af.trans.valor,
      AFRUBRODINERO: af.trans.valor,
      AFRUBROPAQUETE: fijos.r015.paquete,
      AFRUBROPORCENTAJEDINERO: 100,
    })
  }
}

/**
 * Borra el contenido vivo del proyecto y lo vuelve a escribir desde el snapshot, en el ejecutor que le pasen (la
 * transacción de quien llama). La guarda y los catálogos se resuelven antes de borrar.
 */
export async function restaurarContenido(ej: Ejecutor, proyectoId: number, snap: Json): Promise<MapasRestauracion> {
  const ctx = await leerContexto(ej, proyectoId)
  const plan = planDesdeSnapshot(snap)
  const fijos = await validarSnapshot(ej, ctx, snap, plan)
  const afs: Valores[] = []
  for (const af of plan.afs) afs.push(await resolverCatalogosAf(ej, af))
  const contactos: Valores[] = []
  for (const c of plan.contactos) {
    contactos.push({ ...c.valores, TIPOIDENTIFICACIONCONTACTOP: await tipoDocumento(ej, c.tipoDoc) })
  }

  await borrarVivo(ej, proyectoId)

  // UPDATE PROYECTO con datos del snapshot
  if (plan.proyecto) {
    await ej.query(
      `UPDATE PROYECTO
          SET PROYECTONOMBRE  = :1,
              PROYECTOOBJETIVO = :2
        WHERE PROYECTOID = :3`,
      [plan.proyecto.nombre, plan.proyecto.objetivo, proyectoId],
    )
  }

  for (const c of contactos) {
    await insertarConId(ej, 'CONTACTOEMPRESA', 'CONTACTOEMPRESAID', { maxMasUno: true }, {
      EMPRESAIDCONTACTO: ctx.empresaId,
      ...c,
      PROYECTOIDCONTACTOS: proyectoId,
    })
  }

  const mapas: MapasRestauracion = { af: new Map(), grupo: new Map(), ut: new Map() }
  for (let i = 0; i < plan.afs.length; i++) await insertarAf(ej, ctx, plan.afs[i], afs[i], fijos, mapas)
  return mapas
}
