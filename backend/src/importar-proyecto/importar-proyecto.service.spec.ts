import { BadRequestException } from '@nestjs/common'
import type { DataSource } from 'typeorm'
import { reiniciarTriggersDeId } from '../common/db/ids'
import {
  ExcelAF,
  ExcelBasicos,
  ExcelCoberturaFila,
  ExcelRubro,
  ExcelUT,
  ImportarProyectoService,
  ProyectoExcel,
} from './importar-proyecto.service'

type Llamada = { sql: string; params?: unknown[] }

// catálogos que consulta la importación; lo que no está aquí responde vacío
const CATALOGOS: [RegExp, unknown[]][] = [
  [/FROM CONVOCATORIA\b/, [{ id: 10, nombre: 'FCE-2026', estado: 1, anio: 2026 }]],
  [/FROM MODALIDAD\b/, [{ id: 3, nombre: 'AGRUPADA' }, { id: 21, nombre: 'INDIVIDUAL' }]],
  [/FROM FUENTEHERRAMIENTA\b/, [{ id: 3, nombre: 'ENCUESTA' }]],
  [/FROM AREAFUNCIONAL\b/, [{ id: 11, nombre: 'PRODUCCION' }]],
  [/FROM NIVELOCUPACIONAL\b/, [{ id: 12, nombre: 'OPERATIVO' }]],
  [/FROM OCUPACIONCUOC\b/, [{ id: 13, nombre: 'SOLDADOR' }]],
  [/FROM SECTOR\b/, [{ id: 14, nombre: 'INDUSTRIA' }]],
  [/FROM SUBSECTOR\b/, [{ id: 15, nombre: 'METALMECANICA' }]],
  [/FROM TIPOAMBIENTE\b/, [{ id: 16, nombre: 'AULA' }]],
  [/FROM MATERIALFORMACION\b/, [{ id: 17, nombre: 'GUIAS' }]],
  [/FROM RECURSOSDIDACTICOS\b/, [{ id: 18, nombre: 'VIDEOS' }]],
  [/FROM GESTIONCONOCIMIENTO\b/, [{ id: 19, nombre: 'REPOSITORIO' }]],
  [/FROM DEPARTAMENTO\b/, [{ id: 20, nombre: 'ANTIOQUIA' }]],
  [/FROM UTACTIVIDADES\b/, [{ id: 21, nombre: 'TALLER PRACTICO' }]],
  [/FROM TIPOEVENTO\b/, [{ id: 5, nombre: 'CURSO' }]],
  [/FROM MODALIDADFORMACION\b/, [{ id: 1, nombre: 'PRESENCIAL' }]],
  [/FROM RUBRO\b/, [{ id: 50, codigo: 'R01', nombre: 'CAPACITADOR' }]],
  [/FROM CIUDAD\b/, [{ id: 88 }]],
]

// primer id que "asigna la base" en cada tabla; en el camino MAX+1 la fila queda con el id que se mandó
const PRIMER_ID: Record<string, number> = {
  EMPRESA: 5000, USUARIO: 86000, PROYECTO: 3100, NECESIDAD: 700, HERRAMIENTANECESIDAD: 800,
  NECESIDADFORMACION: 900, ACCIONFORMACION: 9600, AFGRUPO: 20100, UNIDADTEMATICA: 20000,
}

// extra: respuestas que van antes de CATALOGOS (p. ej. una empresa que ya existe)
function falso(extra: [RegExp, unknown[]][] = []) {
  const llamadas: Llamada[] = []
  const estado = { qr: 0, commit: 0, rollback: 0 }
  const siguiente = new Map<string, number>()
  const catalogos = [...extra, ...CATALOGOS]
  const responder = (sql: string, params?: unknown[]): Promise<unknown> => {
    llamadas.push({ sql, params })
    const ins = /^INSERT INTO (\w+)/.exec(sql)
    if (ins && sql.includes('RETURNING')) {
      if (/VALUES \(:1,/.test(sql)) return Promise.resolve([[params?.[0]]])
      const n = siguiente.get(ins[1]) ?? PRIMER_ID[ins[1]] ?? 100
      siguiente.set(ins[1], n + 1)
      return Promise.resolve([[n]])
    }
    if (sql.startsWith('SELECT COALESCE(MAX(')) return Promise.resolve([{ id: 40 }])
    return Promise.resolve(catalogos.find(([re]) => re.test(sql))?.[1] ?? [])
  }
  const qr = {
    connect: () => Promise.resolve(),
    startTransaction: () => Promise.resolve(),
    commitTransaction: () => {
      estado.commit++
      return Promise.resolve()
    },
    rollbackTransaction: () => {
      estado.rollback++
      return Promise.resolve()
    },
    release: () => Promise.resolve(),
    query: responder,
  }
  const ds = {
    createQueryRunner: () => {
      estado.qr++
      return qr
    },
    query: responder,
  } as unknown as DataSource
  return { servicio: new ImportarProyectoService(ds), llamadas, estado }
}

// separa por las comas de primer nivel: las de CAST(...) no cuentan
function partes(lista: string): string[] {
  const salida: string[] = []
  let nivel = 0
  let actual = ''
  for (const ch of lista) {
    if (ch === '(') nivel++
    if (ch === ')') nivel--
    if (ch === ',' && nivel === 0) {
      salida.push(actual.trim())
      actual = ''
    } else actual += ch
  }
  salida.push(actual.trim())
  return salida
}

/** El valor que un INSERT ... RETURNING manda en una columna: el bind si es :n, o la expresión. */
function valor(l: Llamada, col: string): unknown {
  const m = /INSERT INTO \w+\s*\(([^)]*)\)\s*VALUES\s*\(([\s\S]*)\)\s*RETURNING/.exec(l.sql)
  if (!m) throw new Error(`no es un INSERT ... RETURNING: ${l.sql}`)
  const cols = partes(m[1])
  const expr = partes(m[2])[cols.indexOf(col)]
  const bind = /^:(\d+)$/.exec(expr ?? '')
  return bind ? l.params?.[Number(bind[1]) - 1] : expr
}

const inserts = (llamadas: Llamada[], tabla: string) =>
  llamadas.filter((l) => new RegExp(`^INSERT INTO ${tabla}\\s`).test(l.sql))
const horaLocal = /SYSDATE|(?<!SYS_EXTRACT_UTC\()SYSTIMESTAMP/

const AF: ExcelAF = {
  consecutivo: 1, nombre: 'Soldadura MIG', diagnostico: 'Brecha', causasEfectos: null, objetivos: 'Soldar',
  enfoque: null, eventoFormacion: 'CURSO', modalidadFormacion: 'PRESENCIAL', metodologia: null,
  horasPorGrupo: 20, numeroGrupos: 1, beneficiariosPresenciales: 20, beneficiariosSincronicos: 0,
  areas: ['PRODUCCION'], justificacionAreas: null, niveles: ['OPERATIVO'], justificacionNiveles: null,
  impactosTrabajador: [], impactosProductividad: [], mipymesEmpresas: null, mipymesTrabajadores: null,
  justificacionMipymes: null, cadenaEmpresas: null, cadenaTrabajadores: null, justificacionCadena: null,
  trabajadoresMujeres: null, trabajadoresCampesinos: null, trabajadoresDiscapacidad: null, empresasBic: null,
  sectoresPertenecen: ['INDUSTRIA'], subsectoresPertenecen: ['METALMECANICA'],
  sectoresBeneficia: ['INDUSTRIA'], subsectoresBeneficia: ['METALMECANICA'], justificacionSectores: null,
  componenteAlineacion: null, descripcionAlineacion: null, justificacionAlineacion: null,
  justificacionEspecializada: null, ambiente: 'AULA', material: 'GUIAS', justificacionSiAplica: null,
  gestionConocimiento: 'REPOSITORIO', incluirEnFormulacion: null, insumos: null, justificacionInsumo: null,
  recursosDidacticos: 'VIDEOS', codigoNecesidad: 1, codigoDiagnostico: 1, ocupacionesCuoc: ['SOLDADOR'],
  validacionPresupuesto: null, justificacion: null, trabajadoresCampesinosTexto: null, trabajadoresPopular: null,
  trabajadoresPopularTexto: null, justificacionTallerPuesto: null, efectos: null,
}
const UT: ExcelUT = {
  numeroAF: 1, numeroUT: 1, nombre: 'Seguridad', horasPracticas: 10, horasTeoricas: 10, contenido: 'EPP',
  competencia: 'Aplicar', actividades: ['TALLER PRACTICO'], descripcionActividad: null,
  perfiles: [{ perfil: 'CAPACITADOR', horas: 20 }], articulacionTerritorial: null, esArticulacionTerritorial: false,
}
const RUBRO: ExcelRubro = {
  numeroAF: 1, idRubro: 'R01', nombreRubro: 'CAPACITADOR', descripcion: null, justificacion: 'Honorarios',
  tarifaMaxima: null, numHoras: 20, numPaginasUnidades: 1, numBeneficiarios: 20, numDias: 1, totalRubro: 1000,
  valorMaximo: 1000, caso: null, paquete: null, valorPorBeneficiarios: 50, cofinanciacionSena: 800,
  contrapartidaEspecie: 100, contrapartidaDinero: 100,
}
const COBERTURA: ExcelCoberturaFila = {
  numeroAF: 1, numeroGrupo: 1, departamentoPresencial: 'ANTIOQUIA', ciudadPresencial: 'MEDELLIN',
  beneficiariosPresencial: 20, departamentos: [{ departamento: 'ANTIOQUIA', beneficiarios: 5 }], justificacion: null,
}
const sinContacto = { id: '', tipo: '', nombre: '', email: '', telefono: '' }

function excel(otraHerramienta: string | null = 'Grupo focal'): ProyectoExcel {
  return {
    basicos: {
      nit: '900.123.456', digitoVerificacion: '7', razonSocial: 'Metales de Prueba SAS', sigla: 'MDP',
      email: 'Proponente@Prueba.co', departamentoDomicilio: null, ciudadDomicilio: null, direccionDomicilio: 'Calle 1',
      telefono: '6041234', paginaWeb: 'https://prueba.co', ciiu: null, tipoOrganizacion: null,
      certificacionCompetencias: null, vinculoExpertosTecnicos: null, cobertura: null, codigoIndicativo: null,
      tamanoEmpresa: null, celular: '3000000000', mesa1: null, mesa2: null, mesa3: null,
      modalidadParticipacion: 'EMPRESA INDIVIDUAL', tipoIdentificacion: null,
    },
    contactos: {
      representanteLegal: { id: '123', tipo: 'CC', nombre: 'Representante', email: 'rep@prueba.co', telefono: '1' },
      contacto1: sinContacto,
      contactoSustenta: sinContacto,
    },
    generalidades: {
      objetoSocial: null, productosServicios: null, situacionActual: null, papelSector: null, retos: null,
      experienciaFormativa: null, objetivoProyecto: 'Formar soldadores', sectorPertenece: null, subsectorPertenece: null,
      sectoresRepresenta: [], subsectoresRepresenta: [], cadenaProductiva: null, interacciones: null,
    },
    diagnosticos: [{
      numero: 1, herramientas: [{ nombre: 'Encuesta', muestra: '30' }], fecha: null, herramientaPropia: 'NO',
      otraHerramienta, planCapacitacion: 'SI', descripcion: 'Descripción', resumen: 'Resumen',
    }],
    necesidades: [{ numeroDiagnostico: 1, numeroNecesidad: 1, necesidad: 'Soldadura', numeroBeneficiarios: 20 }],
    presupuesto: {
      numeroAFs: 1, beneficiarios: 20, valorAFs: 1000, gastosOperacion: 0, valorTransferencia: 0,
      beneficiariosTransferencia: 0, poliza: 0, valorTotal: 1000, cofinanciacionSena: 800, contrapartidaEspecie: 100,
      contrapartidaDinero: 100, gastosOpCofinSena: 0, gastosOpContraEspecie: 0, gastosOpContraDinero: 0,
    },
    afs: [AF],
    uts: [UT],
    rubros: [RUBRO],
    cobertura: [COBERTURA],
  }
}
const conBasicos = (cambios: Partial<ExcelBasicos>): ProyectoExcel => {
  const d = excel()
  return { ...d, basicos: { ...d.basicos, ...cambios } }
}
const EMPRESA_EXISTENTE: [RegExp, unknown[]] = [/FROM EMPRESA\b/, [{ id: 77 }]]
const hayEscrituras = (llamadas: Llamada[]) => llamadas.some((l) => /^\s*(INSERT|UPDATE)\b/.test(l.sql))

// tablas con trigger de id (tablas-trigger-id.json)
const TABLAS_IMPORTACION = [
  'EMPRESA', 'USUARIO', 'PROYECTO', 'CONTACTOEMPRESA', 'NECESIDAD', 'HERRAMIENTANECESIDAD', 'NECESIDADFORMACION',
  'ACCIONFORMACION', 'AFAREAFUNCIONAL', 'AFNIVELOCUPACIONAL', 'OCUPACIONCOUCAF', 'AFPSECTOR', 'AFPSUBSECTOR',
  'AFSECTOR', 'AFSUBSECTOR', 'AFGESTIONCONOCIMIENTO', 'MATERIALFORMACIONAF', 'RECURSOSDIDACTICOSAF', 'AFGRUPO',
  'AFGRUPOCOBERTURA', 'UNIDADTEMATICA', 'ACTIVIDADUT', 'PERFILUT', 'AFRUBRO',
]
const EN_XE = [
  'CONTACTOEMPRESA', 'NECESIDAD', 'AFAREAFUNCIONAL', 'OCUPACIONCOUCAF', 'AFPSECTOR', 'AFPSUBSECTOR',
  'AFGESTIONCONOCIMIENTO', 'MATERIALFORMACIONAF', 'RECURSOSDIDACTICOSAF', 'ACTIVIDADUT', 'AFRUBRO',
]
const mapa = (tablas: string[]) => new Map(tablas.map((t) => [t, `${t}ID`]))
const HIJAS_DE_AF = [
  'AFNIVELOCUPACIONAL', 'OCUPACIONCOUCAF', 'AFPSECTOR', 'AFPSUBSECTOR', 'AFSECTOR', 'AFSUBSECTOR',
  'AFGESTIONCONOCIMIENTO', 'MATERIALFORMACIONAF', 'RECURSOSDIDACTICOSAF', 'AFGRUPO', 'UNIDADTEMATICA', 'AFRUBRO',
]

describe('ImportarProyectoService.confirmar', () => {
  afterEach(() => {
    reiniciarTriggersDeId()
    jest.restoreAllMocks()
  })

  it('en el Exadata cada fila hija usa el id que el trigger le puso a su padre', async () => {
    reiniciarTriggersDeId(mapa(TABLAS_IMPORTACION))
    const { servicio, llamadas, estado } = falso()
    jest.spyOn(servicio, 'parseExcel').mockReturnValue(excel())

    const r = await servicio.confirmar(Buffer.from(''), { convocatoriaId: 10, claveUsuario: 'Clave2026*' })

    expect(r).toMatchObject({ empresaId: 5000, usuarioId: 86000, proyectoId: 3100, afsCreadas: 1, utsCreadas: 1 })
    expect(estado).toEqual({ qr: 1, commit: 1, rollback: 0 })

    const [empresa] = inserts(llamadas, 'EMPRESA')
    expect(valor(empresa, 'EMPRESAWEBSITE')).toBe('https://prueba.co')
    expect(valor(empresa, 'EMPRESAIDENTIFICACION')).toBe(900123456)
    expect(llamadas.some((l) => l.sql.includes('PAGINAWEB'))).toBe(false)

    expect(inserts(llamadas, 'USUARIOPERFIL')[0].params).toEqual([86000])
    const [proyecto] = inserts(llamadas, 'PROYECTO')
    expect(valor(proyecto, 'EMPRESAID')).toBe(5000)
    expect(valor(proyecto, 'MODALIDADID')).toBe(21)
    expect(inserts(llamadas, 'CONTACTOEMPRESA')[0].params?.[0]).toBe(5000)

    const [necesidad] = inserts(llamadas, 'NECESIDAD')
    expect(valor(necesidad, 'EMPRESANECESIDADID')).toBe(5000)
    expect(valor(necesidad, 'USUREGISTRONECESIDAD')).toBe(86000)
    const update = llamadas.find((l) => l.sql.includes('UPDATE NECESIDAD'))?.params ?? []
    expect(update[update.length - 1]).toBe(700)
    expect(valor(inserts(llamadas, 'HERRAMIENTANECESIDAD')[0], 'NECESIDADID')).toBe(700)
    expect(valor(inserts(llamadas, 'NECESIDADFORMACION')[0], 'NECESIDADID')).toBe(700)

    const [af] = inserts(llamadas, 'ACCIONFORMACION')
    expect(valor(af, 'PROYECTOID')).toBe(3100)
    expect(valor(af, 'NECESIDADFORMACIONIDAF')).toBe(900)
    expect(valor(inserts(llamadas, 'AFAREAFUNCIONAL')[0], 'ACCIONFORMACIONIDAF')).toBe(9600)
    for (const t of HIJAS_DE_AF) {
      const filas = inserts(llamadas, t)
      expect(filas.length).toBeGreaterThan(0)
      for (const f of filas) expect(valor(f, 'ACCIONFORMACIONID')).toBe(9600)
    }
    const coberturas = inserts(llamadas, 'AFGRUPOCOBERTURA')
    expect(coberturas).toHaveLength(2)
    for (const f of coberturas) {
      expect(valor(f, 'AFGRUPOID')).toBe(20100)
      expect(valor(f, 'AFGRUPOFILTRO')).toBe(9600)
    }
    expect(valor(inserts(llamadas, 'UNIDADTEMATICA')[0], 'PROYECTOIDUT')).toBe(3100)
    expect(valor(inserts(llamadas, 'ACTIVIDADUT')[0], 'UNIDADTEMATICAID')).toBe(20000)
    expect(valor(inserts(llamadas, 'PERFILUT')[0], 'UNIDADTEMATICAID')).toBe(20000)
    expect(valor(inserts(llamadas, 'AFRUBRO')[0], 'PROYECTOIDRUBROAF')).toBe(3100)

    // el id lo pone el trigger: ni NEXTVAL/CURRVAL aparte ni MAX+1, y todo INSERT de esas tablas manda NULL
    expect(llamadas.some((l) => /FROM dual/i.test(l.sql) || l.sql.includes('COALESCE(MAX('))).toBe(false)
    for (const t of TABLAS_IMPORTACION.filter((t) => t !== 'CONTACTOEMPRESA')) {
      for (const f of inserts(llamadas, t)) expect(valor(f, `${t}ID`)).toBe('NULL')
    }
    expect(llamadas.some((l) => horaLocal.test(l.sql))).toBe(false)
  })

  it('en el XE hace lo de antes (secuencia o MAX+1) y también usa el id que quedó en la fila', async () => {
    reiniciarTriggersDeId(mapa(EN_XE))
    const { servicio, llamadas, estado } = falso()
    jest.spyOn(servicio, 'parseExcel').mockReturnValue(excel())

    const r = await servicio.confirmar(Buffer.from(''), { convocatoriaId: 10, claveUsuario: 'Clave2026*' })

    expect(r).toMatchObject({ empresaId: 5000, usuarioId: 86000, proyectoId: 3100 })
    expect(estado.commit).toBe(1)
    for (const t of ['EMPRESA', 'USUARIO', 'PROYECTO', 'HERRAMIENTANECESIDAD', 'NECESIDADFORMACION', 'ACCIONFORMACION']) {
      expect(valor(inserts(llamadas, t)[0], `${t}ID`)).toBe(`${t}ID.NEXTVAL`)
    }
    // sin trigger en el XE: MAX+1, y la fila hija apunta a ese mismo número
    for (const t of ['AFNIVELOCUPACIONAL', 'AFSECTOR', 'AFSUBSECTOR', 'AFGRUPO', 'AFGRUPOCOBERTURA', 'UNIDADTEMATICA', 'PERFILUT']) {
      expect(llamadas.some((l) => l.sql === `SELECT COALESCE(MAX(${t}ID), 0) + 1 AS "id" FROM ${t}`)).toBe(true)
    }
    for (const f of inserts(llamadas, 'AFGRUPOCOBERTURA')) expect(valor(f, 'AFGRUPOID')).toBe(40)
    expect(valor(inserts(llamadas, 'PERFILUT')[0], 'UNIDADTEMATICAID')).toBe(40)
    // con trigger también en el XE: NULL, sin MAX+1
    expect(valor(inserts(llamadas, 'AFAREAFUNCIONAL')[0], 'AFAREAFUNCIONALID')).toBe('NULL')
    expect(llamadas.some((l) => l.sql.includes('COALESCE(MAX(AFAREAFUNCIONALID)'))).toBe(false)
    expect(llamadas.some((l) => horaLocal.test(l.sql))).toBe(false)
  })

  it('rechaza con 400 un "otra herramienta" de más de 40 bytes antes de abrir la transacción', async () => {
    reiniciarTriggersDeId(mapa(TABLAS_IMPORTACION))
    const { servicio, llamadas, estado } = falso()
    // 40 caracteres, pero la ñ ocupa 2 bytes: 41
    jest.spyOn(servicio, 'parseExcel').mockReturnValue(excel(`${'x'.repeat(39)}ñ`))

    const intento = servicio.confirmar(Buffer.from(''), { convocatoriaId: 10, claveUsuario: 'Clave2026*' })

    await expect(intento).rejects.toBeInstanceOf(BadRequestException)
    await expect(intento).rejects.toThrow(/Diagnóstico 1 del Excel: .*admite hasta 40 bytes/)
    expect(estado.qr).toBe(0)
    expect(llamadas).toHaveLength(0)
  })

  // antes el INSERT y el UPDATE de EMPRESA fallaban siempre (EMPRESAPAGINAWEB no existe): sus textos se escriben ahora
  it('rechaza con 400 una empresa nueva con un dato que no cabe en EMPRESA, antes de escribir nada', async () => {
    reiniciarTriggersDeId(mapa(TABLAS_IMPORTACION))
    const { servicio, llamadas, estado } = falso()
    jest.spyOn(servicio, 'parseExcel').mockReturnValue(conBasicos({ paginaWeb: 'w'.repeat(101) }))

    const intento = servicio.confirmar(Buffer.from(''), { convocatoriaId: 10, claveUsuario: 'Clave2026*' })

    await expect(intento).rejects.toBeInstanceOf(BadRequestException)
    await expect(intento).rejects.toThrow(
      'Datos básicos del Excel que no caben: PÁGINA WEB admite hasta 100 caracteres y trae 101.',
    )
    expect(estado).toEqual({ qr: 1, commit: 0, rollback: 1 })
    expect(hayEscrituras(llamadas)).toBe(false)
  })

  it('con la empresa existente y sin actualizar sus datos, un dato que no cabe no estorba', async () => {
    reiniciarTriggersDeId(mapa(TABLAS_IMPORTACION))
    const { servicio, llamadas, estado } = falso([EMPRESA_EXISTENTE])
    // 21 caracteres: EMPRESATELEFONO es NCHAR(20), pero aquí no se escribe
    jest.spyOn(servicio, 'parseExcel').mockReturnValue(conBasicos({ telefono: '604 444 1234 ext. 105' }))

    const r = await servicio.confirmar(Buffer.from(''), { convocatoriaId: 10, claveUsuario: 'Clave2026*' })

    expect(r.empresaId).toBe(77)
    expect(estado).toEqual({ qr: 1, commit: 1, rollback: 0 })
    expect(inserts(llamadas, 'EMPRESA')).toHaveLength(0)
    expect(llamadas.some((l) => l.sql.includes('UPDATE EMPRESA'))).toBe(false)
    expect(valor(inserts(llamadas, 'PROYECTO')[0], 'EMPRESAID')).toBe(77)
  })

  it('con actualizarDatosEmpresa rechaza con 400 antes del UPDATE si un dato no cabe', async () => {
    reiniciarTriggersDeId(mapa(TABLAS_IMPORTACION))
    const { servicio, llamadas, estado } = falso([EMPRESA_EXISTENTE])
    jest.spyOn(servicio, 'parseExcel').mockReturnValue(
      conBasicos({ celular: '300 000 0000 / 301 111 1111', paginaWeb: 'w'.repeat(100) }),
    )

    const intento = servicio.confirmar(Buffer.from(''), { convocatoriaId: 10, actualizarDatosEmpresa: true })

    // la página web de 100 cabe justo; solo sobra el celular
    await expect(intento).rejects.toThrow('Datos básicos del Excel que no caben: CELULAR admite hasta 20 caracteres y trae 27.')
    expect(estado).toEqual({ qr: 1, commit: 0, rollback: 1 })
    expect(hayEscrituras(llamadas)).toBe(false)
  })

  it('con actualizarDatosEmpresa y todo en su tope, el UPDATE escribe EMPRESAWEBSITE', async () => {
    reiniciarTriggersDeId(mapa(TABLAS_IMPORTACION))
    const { servicio, llamadas, estado } = falso([EMPRESA_EXISTENTE])
    jest.spyOn(servicio, 'parseExcel').mockReturnValue(conBasicos({ telefono: '1'.repeat(20), paginaWeb: 'w'.repeat(100) }))

    await servicio.confirmar(Buffer.from(''), { convocatoriaId: 10, claveUsuario: 'Clave2026*', actualizarDatosEmpresa: true })

    expect(estado.commit).toBe(1)
    const update = llamadas.find((l) => l.sql.includes('UPDATE EMPRESA'))
    expect(update?.sql).toContain('EMPRESAWEBSITE = :6')
    expect(update?.params?.slice(4, 6)).toEqual(['1'.repeat(20), 'w'.repeat(100)])
    expect(update?.params?.[7]).toBe(77)
  })
})

describe('ImportarProyectoService.preview', () => {
  it('marca como error el "otra herramienta" que no cabe en el Exadata', async () => {
    const { servicio } = falso()
    jest.spyOn(servicio, 'parseExcel').mockReturnValue(excel('ñ'.repeat(21)))

    const p = await servicio.preview(Buffer.from(''), 10)

    expect(p.validaciones).toContainEqual(expect.objectContaining({
      nivel: 'error', campo: 'Diagnóstico 1', mensaje: expect.stringMatching(/hasta 40 bytes y trae 42/),
    }))
    expect(p.proyecto.modalidadProyectoId).toBe(21)
  })

  it('con la empresa nueva, un dato que no cabe en EMPRESA es error; justo en el tope, no', async () => {
    const { servicio } = falso()
    jest.spyOn(servicio, 'parseExcel').mockReturnValue(conBasicos({ paginaWeb: 'w'.repeat(101), telefono: '1'.repeat(20) }))

    const p = await servicio.preview(Buffer.from(''), 10)

    expect(p.empresa.estado).toBe('nueva')
    expect(p.validaciones).toContainEqual({
      nivel: 'error', campo: 'PÁGINA WEB', mensaje: 'Admite hasta 100 caracteres y trae 101. Acórtelo en el Excel.',
    })
    expect(p.validaciones.some((v) => v.campo === 'TELÉFONO')).toBe(false)
  })

  it('con la empresa existente es solo aviso: el dato se escribe únicamente si se actualizan sus datos', async () => {
    const { servicio } = falso([EMPRESA_EXISTENTE])
    jest.spyOn(servicio, 'parseExcel').mockReturnValue(conBasicos({ sigla: 'S'.repeat(41) }))

    const p = await servicio.preview(Buffer.from(''), 10)

    expect(p.empresa.estado).toBe('existente')
    expect(p.validaciones.filter((v) => v.campo === 'SIGLA')).toEqual([{
      nivel: 'warning',
      campo: 'SIGLA',
      mensaje: 'Admite hasta 40 caracteres y trae 41: si al confirmar se actualizan los datos de la empresa, la importación se rechazará.',
    }])
  })
})
