import { BadRequestException } from '@nestjs/common'
import { AHORA_UTC } from '../common/db/fecha-utc'
import { Ejecutor, reiniciarTriggersDeId } from '../common/db/ids'
import {
  aceptarTambienVivos,
  emparejarSiMismoContenido,
  insertarConservandoId,
  planDesdeSnapshot,
  restaurarContenido,
  traducirAfs,
} from './restaurar-snapshot'

// tablas de la restauración con trigger de id (tablas-trigger-id.json); en el XE faltan las "soloExadata"
const LLAVES: Record<string, string> = {
  ACCIONFORMACION: 'ACCIONFORMACIONID',
  AFAREAFUNCIONAL: 'AFAREAFUNCIONALID',
  AFNIVELOCUPACIONAL: 'AFNIVELOCUPACIONALID',
  OCUPACIONCOUCAF: 'OCUPACIONCOUCAFID',
  AFPSECTOR: 'AFPSECTORID',
  AFPSUBSECTOR: 'AFPSUBSECTORID',
  AFSECTOR: 'AFSECTORID',
  AFSUBSECTOR: 'AFSUBSECTORID',
  AFGESTIONCONOCIMIENTO: 'AFGESTIONCONOCIMIENTOID',
  MATERIALFORMACIONAF: 'MATERIALFORMACIONAFID',
  RECURSOSDIDACTICOSAF: 'RECURSOSDIDACTICOSAFID',
  AFGRUPO: 'AFGRUPOID',
  AFGRUPOCOBERTURA: 'AFGRUPOCOBERTURAID',
  UNIDADTEMATICA: 'UNIDADTEMATICAID',
  ACTIVIDADUT: 'ACTIVIDADUTID',
  PERFILUT: 'PERFILUTID',
  AFRUBRO: 'AFRUBROID',
  CONTACTOEMPRESA: 'CONTACTOEMPRESAID',
}
const SOLO_EXADATA = [
  'ACCIONFORMACION', 'AFNIVELOCUPACIONAL', 'AFSECTOR', 'AFSUBSECTOR',
  'AFGRUPO', 'AFGRUPOCOBERTURA', 'UNIDADTEMATICA', 'PERFILUT',
]
const exadata = () => new Map(Object.entries(LLAVES))
const xe = () => new Map(Object.entries(LLAVES).filter(([t]) => !SOLO_EXADATA.includes(t)))

function snapshotDePrueba(
  o: { afId?: number; grupoId?: number; utId?: number; totalRubro?: number; nombreRubro?: string } = {},
): Record<string, unknown> {
  const afId = o.afId ?? 9669
  return {
    proyecto: { id: 3091, convocatoriaId: 10, nombre: 'Proyecto', objetivo: 'Objetivo' },
    contactos: [{ nombre: 'Contacto', cargo: 'Cargo', correo: 'contacto@ejemplo.co', telefono: null, documento: null, tipoDoc: 'CC' }],
    acciones: [{
      afId, numero: 1, nombre: 'AF 1', necesidadFormacionId: 55, tipoEventoId: 3, tipoEvento: 'CURSO',
      modalidadFormacionId: 1, metodologiaAprendizajeId: 2, numHorasGrupo: 20, numGrupos: 1, numBenef: 10,
    }],
    accionesDetalle: [{
      afId,
      perfil: {
        afId, afEnfoqueId: 1, enfoque: 'Enfoque',
        areas: [{ aafId: 11, areaId: 4, nombre: 'Área', otro: null }],
        niveles: [{ anId: 12, nivelId: 2 }],
        cuoc: [{ ocAfId: 13, cuocId: 7 }],
      },
      sectores: {
        justificacion: 'J',
        sectoresBenef: [{ psId: 14, sectorId: 1 }], subsectoresBenef: [{ pssId: 15, subsectorId: 1 }],
        sectoresAf: [{ saId: 16, sectorId: 1 }], subsectoresAf: [{ ssaId: 17, subsectorId: 1 }],
      },
      material: { tipoAmbienteId: 1, gestionConocimientoId: 2, materialFormacionId: 3, recursos: [{ rdafId: 18, recursoId: 5 }] },
      alineacion: { componenteId: 8, compod: 'C' },
      grupos: [{
        grupoId: o.grupoId ?? 500, grupoNumero: 1, justificacion: null,
        coberturas: [{ cobId: 700, deptoId: 11, ciudadId: 1, benef: 10, modal: 'P', rural: 0 }],
      }],
      unidadesTematicas: [{
        utId: o.utId ?? 600, afId, numero: 1, nombre: 'UT 1', horasPP: 10, horasTP: 10, esTransversal: 0,
        actividades: [{ actId: 800, actividadId: 3, otro: null }],
        perfiles: [{ perfilId: 900, rubroId: 301, rubroNombre: 'Perfil', horasCap: 10, dias: null }],
      }],
      rubros: [{
        afrubroid: 1000, rubroId: 302, nombre: o.nombreRubro ?? 'R01', totalRubro: o.totalRubro ?? 100,
        cofSena: 50, contraEspecie: 25, contraDinero: 25,
      }],
      gastoOperacion: { afrubroid: 1001, total: 16, cofSena: 16, especie: 0, dinero: 0 },
      transferencia: { afrubroid: 1002, beneficiarios: 1, valor: 5 },
    }],
  }
}

interface Base {
  conv: number
  empresa: number
  af: Record<number, number | null> // id -> proyecto dueño
  grupo: Record<number, number | null>
  ut: Record<number, number | null>
  rubro: Record<number, number> // id -> convocatoria
  necesidad: Record<number, number> // id -> empresa
  componente: number[]
  fijos: Record<string, number> // 'R09@10' -> rubroId
  afsVivas: number[]
}
interface Llamada {
  sql: string
  params: unknown[]
}

// Ejecutor falso: responde según el texto de la consulta; un INSERT con NULL en la llave hace de trigger
function baseFalsa(cambios: Partial<Base> = {}) {
  const b: Base = {
    conv: 10, empresa: 4046, af: {}, grupo: {}, ut: {},
    rubro: { 301: 10, 302: 10 }, necesidad: { 55: 4046 }, componente: [8],
    fijos: { 'R09@10': 7009, 'R015@10': 7015 }, afsVivas: [], ...cambios,
  }
  const llamadas: Llamada[] = []
  let secuencia = 70000
  const duenos = (mapa: Record<number, unknown>, params: unknown[]) =>
    params.filter((id) => Number(id) in mapa).map((id) => ({ id, dueno: mapa[Number(id)] }))
  const ej: Ejecutor = {
    query: (sql: string, params: unknown[] = []) => {
      llamadas.push({ sql, params })
      const s = sql.replace(/\s+/g, ' ').trim()
      let r: unknown = []
      if (s.startsWith('SELECT EMPRESAID AS "empresaId", CONVOCATORIAID')) r = [{ empresaId: b.empresa, convocatoriaId: b.conv }]
      else if (s.includes('FROM ACCIONFORMACION WHERE ACCIONFORMACIONID IN')) r = duenos(b.af, params)
      else if (s.includes('FROM AFGRUPO g')) r = duenos(b.grupo, params)
      else if (s.includes('FROM UNIDADTEMATICA WHERE UNIDADTEMATICAID IN')) r = duenos(b.ut, params)
      else if (s.includes('FROM RUBRO WHERE RUBROID IN')) r = duenos(b.rubro, params)
      else if (s.includes('FROM NECESIDADFORMACION nf')) r = duenos(b.necesidad, params)
      else if (s.includes('FROM AFCOMPONENTE')) r = params.filter((id) => b.componente.includes(Number(id))).map((id) => ({ id, dueno: id }))
      else if (s.includes('btrim((r.RUBROCODIGO)::text) = $1')) {
        const id = b.fijos[`${String(params[0])}@${String(params[1])}`]
        r = id ? [{ rubroId: id, paquete: 'PAQ' }] : []
      } else if (s.includes('FROM TIPODOCUMENTOIDENTIDAD')) r = [{ id: 1 }]
      else if (s.startsWith('SELECT ACCIONFORMACIONID AS "id" FROM ACCIONFORMACION WHERE PROYECTOID')) r = b.afsVivas.map((id) => ({ id }))
      else if (s.startsWith('SELECT COALESCE(MAX(')) r = [{ id: 41 }]
      else if (s.startsWith('INSERT INTO')) r = [[/VALUES \(NULL/.test(s) ? ++secuencia : params[0]]]
      return Promise.resolve(r)
    },
  }
  // columnas -> valor de cada INSERT (un bind se reemplaza por su parámetro)
  const inserts = (tabla?: string) =>
    llamadas
      .map((l) => {
        const s = l.sql.replace(/\s+/g, ' ').trim()
        const m = /^INSERT INTO (\w+) \(([^)]*)\) VALUES \((.*)\) RETURNING \w+ INTO :\d+$/.exec(s)
        if (!m) return null
        const vals = m[3].split(', ')
        const valor = (v: string) => (/^:\d+$/.test(v) ? l.params[Number(v.slice(1)) - 1] : v)
        return { tabla: m[1], columnas: Object.fromEntries(m[2].split(', ').map((c, i) => [c, valor(vals[i])])) }
      })
      .filter((x): x is { tabla: string; columnas: Record<string, unknown> } => x !== null && (!tabla || x.tabla === tabla))
  return { ej, llamadas, inserts }
}

// las consultas del dueño de AF, grupos y UT (las de rubros, necesidades y componentes no traen PROYECTOID)
const esConsultaDeDueno = (sql: string) => /PROYECTOID(UT)? AS "dueno"/.test(sql)

afterEach(() => reiniciarTriggersDeId())

describe('restaurarContenido', () => {
  it('en el Exadata los padres toman el id del trigger y las hijas se enlazan a ese id, no al del snapshot', async () => {
    reiniciarTriggersDeId(exadata())
    const { ej, inserts } = baseFalsa({ af: { 9669: 3050 }, afsVivas: [9669] })
    const mapas = await restaurarContenido(ej, 3050, snapshotDePrueba())

    const afNuevo = Number(mapas.af.get(9669))
    const grupoNuevo = Number(mapas.grupo.get(500))
    const utNuevo = Number(mapas.ut.get(600))
    expect([afNuevo, grupoNuevo, utNuevo].every((id) => id > 70000)).toBe(true)

    // ninguna fila lleva el id del snapshot: todas mandan NULL y el trigger pone el número
    for (const i of inserts()) expect(i.columnas[LLAVES[i.tabla]]).toBe('NULL')

    expect(inserts('ACCIONFORMACION')[0].columnas.PROYECTOID).toBe(3050)
    expect(inserts('AFGRUPO')[0].columnas.ACCIONFORMACIONID).toBe(afNuevo)
    expect(inserts('AFGRUPOCOBERTURA')[0].columnas).toMatchObject({ AFGRUPOID: grupoNuevo, AFGRUPOFILTRO: afNuevo })
    expect(inserts('UNIDADTEMATICA')[0].columnas).toMatchObject({ ACCIONFORMACIONID: afNuevo, PROYECTOIDUT: 3050 })
    expect(inserts('ACTIVIDADUT')[0].columnas.UNIDADTEMATICAID).toBe(utNuevo)
    expect(inserts('PERFILUT')[0].columnas.UNIDADTEMATICAID).toBe(utNuevo)
    const hijasDeAf: Array<[string, string]> = [
      ['AFAREAFUNCIONAL', 'ACCIONFORMACIONIDAF'], ['AFNIVELOCUPACIONAL', 'ACCIONFORMACIONID'],
      ['OCUPACIONCOUCAF', 'ACCIONFORMACIONID'], ['AFPSECTOR', 'ACCIONFORMACIONID'],
      ['AFPSUBSECTOR', 'ACCIONFORMACIONID'], ['AFSECTOR', 'ACCIONFORMACIONID'], ['AFSUBSECTOR', 'ACCIONFORMACIONID'],
      ['AFGESTIONCONOCIMIENTO', 'ACCIONFORMACIONID'], ['MATERIALFORMACIONAF', 'ACCIONFORMACIONID'],
      ['RECURSOSDIDACTICOSAF', 'ACCIONFORMACIONID'],
    ]
    for (const [t, col] of hijasDeAf) expect(inserts(t)[0].columnas[col]).toBe(afNuevo)
    // rubro, gastos de operación y transferencia
    const rubros = inserts('AFRUBRO')
    expect(rubros.map((r) => r.columnas.RUBROID)).toEqual([302, 7009, 7015])
    for (const r of rubros) expect(r.columnas).toMatchObject({ ACCIONFORMACIONID: afNuevo, PROYECTOIDRUBROAF: 3050 })
  })

  it('en el XE conserva los ids del snapshot donde no hay trigger, como antes', async () => {
    reiniciarTriggersDeId(xe())
    const { ej, inserts } = baseFalsa({ af: { 9669: 3091 }, grupo: { 500: 3091 }, ut: { 600: 3091 }, afsVivas: [9669] })
    const mapas = await restaurarContenido(ej, 3091, snapshotDePrueba())

    expect([...mapas.af]).toEqual([[9669, 9669]])
    expect([...mapas.grupo]).toEqual([[500, 500]])
    expect([...mapas.ut]).toEqual([[600, 600]])
    expect(inserts('AFGRUPOCOBERTURA')[0].columnas).toMatchObject({ AFGRUPOCOBERTURAID: 700, AFGRUPOID: 500, AFGRUPOFILTRO: 9669 })
    expect(inserts('PERFILUT')[0].columnas).toMatchObject({ PERFILUTID: 900, UNIDADTEMATICAID: 600 })
    expect(inserts('AFNIVELOCUPACIONAL')[0].columnas.AFNIVELOCUPACIONALID).toBe(12)
    // las que también tienen trigger en el XE mandan NULL: antes el trigger pisaba el id que mandaba la app
    expect(inserts('AFRUBRO')[0].columnas.AFRUBROID).toBe('NULL')
    expect(inserts('AFAREAFUNCIONAL')[0].columnas.AFAREAFUNCIONALID).toBe('NULL')
  })

  it('en el Exadata no rechaza AF, grupos ni UT cuyo id del snapshot es aquí de otro proyecto: esos ids no se usan', async () => {
    reiniciarTriggersDeId(exadata())
    // la versión FINAL 4 del 3050 en el Exadata trae grupos y una UT con ids que allí son de otros proyectos
    const { ej, llamadas, inserts } = baseFalsa({
      af: { 9669: 3002 }, grupo: { 500: 3022 }, ut: { 600: 3002 }, afsVivas: [9669],
    })
    const mapas = await restaurarContenido(ej, 3050, snapshotDePrueba())

    expect(Number(mapas.grupo.get(500))).toBeGreaterThan(70000)
    expect(Number(mapas.ut.get(600))).toBeGreaterThan(70000)
    expect(inserts('AFGRUPO')[0].columnas.AFGRUPOID).toBe('NULL')
    expect(inserts('UNIDADTEMATICA')[0].columnas.UNIDADTEMATICAID).toBe('NULL')
    expect(llamadas.some((l) => esConsultaDeDueno(l.sql))).toBe(false)
  })

  it('borra lo vivo solo después de la guarda y escribe las fechas en UTC', async () => {
    reiniciarTriggersDeId(exadata())
    const { ej, llamadas, inserts } = baseFalsa({ afsVivas: [9669] })
    await restaurarContenido(ej, 3050, snapshotDePrueba())

    const primerBorrado = llamadas.findIndex((l) => /^\s*DELETE/.test(l.sql))
    const ultimaGuarda = llamadas.map((l) => l.sql).lastIndexOf(llamadas.filter((l) => l.sql.includes('ROWNUM = 1')).pop()?.sql ?? '')
    expect(primerBorrado).toBeGreaterThan(ultimaGuarda)
    expect(llamadas.some((l) => l.sql.includes('(now() AT TIME ZONE \'UTC\')'))).toBe(false)
    expect(inserts('ACCIONFORMACION')[0].columnas.ACCIONFORMACIONFECHAREGISTRO).toBe(AHORA_UTC)
    expect(inserts('UNIDADTEMATICA')[0].columnas.UNIDADTEMATICAFECHAREGISTRO).toBe(AHORA_UTC)
    expect(inserts('PERFILUT')[0].columnas.PERFILUTFECHAREGISTRO).toBe(AHORA_UTC)
    for (const r of inserts('AFRUBRO')) expect(r.columnas.AFRUBROFECHAREGISTRO).toBe(AHORA_UTC)
  })

  it('R09 y R015 se buscan en la convocatoria del proyecto', async () => {
    reiniciarTriggersDeId(exadata())
    const { ej, llamadas } = baseFalsa()
    await restaurarContenido(ej, 3050, snapshotDePrueba())
    const fijos = llamadas.filter((l) => l.sql.includes('btrim((r.RUBROCODIGO)::text) = $1'))
    expect(fijos.map((l) => l.params)).toEqual([['R09', 10], ['R015', 10]])
    for (const l of fijos) expect(l.sql).toContain('CONVOCATORIAIDRUBRO = :2')
  })

  async function rechazaSinTocar(triggers: Map<string, string>, cambios: Partial<Base>, mensaje: RegExp) {
    reiniciarTriggersDeId(triggers)
    const { ej, llamadas } = baseFalsa({ afsVivas: [9669], ...cambios })
    const error = await restaurarContenido(ej, 3050, snapshotDePrueba()).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BadRequestException)
    expect((error as Error).message).toMatch(mensaje)
    expect(llamadas.some((l) => /^\s*(DELETE|INSERT|UPDATE)/.test(l.sql))).toBe(false)
  }

  const casos: Array<[string, Partial<Base>, RegExp]> = [
    ['convocatoria distinta', { conv: 6 }, /convocatoria 10 y el proyecto es de la 6/],
    ['rubro que no existe', { rubro: { 301: 10 } }, /rubros que no existen \(302\)/],
    ['rubro de otra convocatoria', { rubro: { 301: 10, 302: 6 } }, /rubros de otra convocatoria \(302\)/],
    ['necesidad que no existe', { necesidad: {} }, /necesidades de formación que no existen \(55\)/],
    ['necesidad de otra empresa', { necesidad: { 55: 1 } }, /necesidades de formación de otra empresa \(55\)/],
    ['componente que no existe', { componente: [] }, /componentes que no existen \(8\)/],
    ['convocatoria sin R09', { fijos: { 'R015@10': 7015 } }, /no tiene rubro R09/],
    ['convocatoria sin R015', { fijos: { 'R09@10': 7009 } }, /no tiene rubro R015/],
  ]
  it.each(casos)('la guarda rechaza sin tocar nada: %s', (_caso, cambios, mensaje) =>
    rechazaSinTocar(exadata(), cambios, mensaje),
  )

  // en el XE esas tablas no tienen trigger: se reinserta el id del snapshot y chocaría con la fila del otro proyecto
  const ajenosEnXe: Array<[string, Partial<Base>, RegExp]> = [
    ['AF de otro proyecto', { af: { 9669: 3002 } }, /acciones de formación \(9669\) son de otro proyecto/],
    ['grupo de otro proyecto', { grupo: { 500: 3022 } }, /grupos \(500\) son de otro proyecto/],
    ['UT de otro proyecto', { ut: { 600: 3002 } }, /unidades temáticas \(600\) son de otro proyecto/],
  ]
  it.each(ajenosEnXe)('en el XE la guarda rechaza sin tocar nada: %s', (_caso, cambios, mensaje) =>
    rechazaSinTocar(xe(), cambios, mensaje),
  )

  it('una fila del snapshot sin trigger y sin id válido no se inserta', async () => {
    reiniciarTriggersDeId(new Map())
    const { ej } = baseFalsa()
    await expect(insertarConservandoId(ej, 'AFGRUPO', 'AFGRUPOID', NaN, { ACCIONFORMACIONID: 1 })).rejects.toThrow(
      /no trae un id válido para AFGRUPO/,
    )
  })
})

describe('emparejarSiMismoContenido', () => {
  it('el mismo contenido con otros ids empareja las AF: no hace falta restaurar', () => {
    const final = planDesdeSnapshot(snapshotDePrueba())
    const vivo = planDesdeSnapshot(snapshotDePrueba({ afId: 20001, grupoId: 20002, utId: 20003 }))
    expect(emparejarSiMismoContenido(vivo, final)).toEqual(new Map([[9669, 20001]]))
  })

  it('lo que la restauración no escribe (nombres de catálogo) no cuenta', () => {
    const final = planDesdeSnapshot(snapshotDePrueba())
    const vivo = planDesdeSnapshot(snapshotDePrueba({ nombreRubro: 'otro nombre' }))
    expect(emparejarSiMismoContenido(vivo, final)).toEqual(new Map([[9669, 9669]]))
  })

  it('si cambia algo que la restauración escribe, hay que restaurar', () => {
    const final = planDesdeSnapshot(snapshotDePrueba())
    expect(emparejarSiMismoContenido(planDesdeSnapshot(snapshotDePrueba({ totalRubro: 999 })), final)).toBeNull()
    expect(emparejarSiMismoContenido(planDesdeSnapshot({ ...snapshotDePrueba(), accionesDetalle: [] }), final)).toBeNull()
  })
})

describe('traducirAfs', () => {
  it('lleva los afId del frontend a su id vivo y descarta los que no están', () => {
    const r = traducirAfs([{ afId: 9669, motivo: 'm' }, { afId: 1, motivo: 'x' }], new Map([[9669, 70001]]))
    expect(r).toEqual([{ afId: 9669, motivo: 'm', afIdVivo: 70001 }])
  })
})

describe('aceptarTambienVivos', () => {
  it('sin restaurar acepta el afId del FINAL y también el vivo', () => {
    const m = aceptarTambienVivos(new Map([[9669, 20001]]), [9669, 20001])
    expect(m.get(9669)).toBe(20001)
    expect(m.get(20001)).toBe(20001)
  })

  // FINAL 9669 y 20001 -> vivas 20001 y 20002: el 20001 es de una AF en el FINAL y de otra en el vivo
  const cruzado = () => new Map([[9669, 20001], [20001, 20002]])

  it('un id que es de una AF en el FINAL y de otra en el vivo se decide por los demás ids enviados', () => {
    expect(aceptarTambienVivos(cruzado(), [20001, 9669]).get(20001)).toBe(20002)
    expect(aceptarTambienVivos(cruzado(), [20001, 20002]).get(20001)).toBe(20001)
  })

  it('si con los ids enviados no se puede saber, rechaza en vez de escoger el del FINAL', () => {
    expect(() => aceptarTambienVivos(cruzado(), [20001])).toThrow(BadRequestException)
    expect(() => aceptarTambienVivos(new Map([[1, 2], [2, 1]]), [1, 2])).toThrow(/No se modificó nada/)
  })

  it('un id ambiguo que nadie mandó no estorba', () => {
    expect(aceptarTambienVivos(cruzado(), [9669]).get(9669)).toBe(20001)
  })
})
