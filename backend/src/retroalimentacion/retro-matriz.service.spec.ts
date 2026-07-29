import { RetroMatrizService } from './retro-matriz.service'
import type { NodoMatriz } from './retro-matriz.service'

/**
 * Fidelidad del port de la matriz de retroalimentación.
 *
 * El motor viene de `helpers/eval/matriz.js` (FormularioInscripcionGGPC), que
 * ya corrió un ciclo real con las reglas que el área definió por correo. Este
 * archivo transcribe ese algoritmo tal como estaba y compara sus pares con los
 * del port, para que cualquier retoque futuro tenga que justificar la
 * diferencia en vez de introducirla sin querer.
 *
 * El escenario reproduce los casos que el original documentaba como reales:
 * un apoyo jurídico repartido entre grupos técnicos y el jurídico, un
 * transversal con alcance explícito, y varios pares del mismo rol y grupo.
 */

type PersonaOriginal = {
  _id: string
  rol: string
  area: string
  grupos: number[]
  esTransversal: boolean
  alcanceEvaluacion: Array<{ area: string; roles: string[] }>
}

const ESCENARIO: Array<[string, string, string, number[]]> = [
  ['Lider Tecnica',      'LIDER',              'TECNICA',    [1, 2, 3, 4, 5, 6]],
  ['Analista G1',        'ANALISTA',           'TECNICA',    [1]],
  ['Analista G2',        'ANALISTA',           'TECNICA',    [2]],
  ['Evaluador A G1',     'EVALUADOR',          'TECNICA',    [1]],
  ['Evaluador B G1',     'EVALUADOR',          'TECNICA',    [1]],
  ['Evaluador C G2',     'EVALUADOR',          'TECNICA',    [2]],
  ['Apoyo Tec G1',       'APOYO_TECNICO',      'TECNICA',    [1]],
  ['Apoyo Presu G1',     'APOYO_PRESUPUESTAL', 'TECNICA',    [1]],
  ['Fernanda ApoyoJur',  'APOYO_JURIDICO',     'JURIDICA',   [1, 2, 8]],
  ['Lider Juridica',     'LIDER',              'JURIDICA',   [8]],
  ['Evaluador Jur',      'EVALUADOR',          'JURIDICA',   [8]],
  ['Lider Financiera',   'LIDER',              'FINANCIERA', [7]],
  ['Apoyo Fin G7',       'APOYO_FINANCIERO',   'FINANCIERA', [7]],
  ['Apoyo Presu G7',     'APOYO_PRESUPUESTAL', 'FINANCIERA', [7]],
]

/**
 * Dos transversales, uno por área, porque se comportan distinto: al técnico
 * nadie lo evalúa (ninguna regla lo pone como evaluado), mientras que al
 * financiero sí lo evalúa su líder — regla que el motor original agregó
 * después, justamente para cerrar ese hueco.
 */
const TRANSVERSALES = [
  {
    nombre: 'Natalia Transversal',
    rol: 'TRANSVERSAL',
    area: 'TECNICA',
    grupos: [] as number[],
    alcance: [{ area: 'TECNICA', roles: ['ANALISTA', 'EVALUADOR'] }],
  },
  {
    nombre: 'Soraya Transversal',
    rol: 'TRANSVERSAL',
    area: 'FINANCIERA',
    grupos: [] as number[],
    alcance: [{ area: 'FINANCIERA', roles: ['LIDER', 'APOYO_FINANCIERO', 'APOYO_PRESUPUESTAL'] }],
  },
]
const TRANSVERSAL = TRANSVERSALES[0]

/** Transcripción literal de `calcularPares()` del sistema original. */
function calcularParesOriginal(personas: PersonaOriginal[]): Set<string> {
  const GRUPOS_TECNICOS = [1, 2, 3, 4, 5, 6]
  const AREA_GRUPOS: Record<string, number[]> = {
    tecnica: [1, 2, 3, 4, 5, 6], juridica: [8], financiera: [7],
  }
  const APOYOS = ['apoyo_tecnico', 'apoyo_presupuestal', 'apoyo_juridico']
  const pares = new Set<string>()
  const agregar = (a?: PersonaOriginal, b?: PersonaOriginal) => {
    if (!a || !b || a._id === b._id) return
    pares.add(`${a._id}::${b._id}`)
  }
  const conRolEnGrupo = (rol: string, g: number) =>
    personas.filter(p => p.rol === rol && p.grupos.includes(g))
  const conRolesEnGrupo = (roles: string[], g: number) =>
    personas.filter(p => roles.includes(p.rol) && p.grupos.includes(g))
  const lideresDe = (area: string) => personas.filter(p => p.area === area && p.rol === 'lider')

  for (const p of personas) {
    if (p.esTransversal) {
      for (const al of p.alcanceEvaluacion) {
        const gruposArea = AREA_GRUPOS[al.area] || []
        for (const c of personas.filter(c =>
          al.roles.includes(c.rol) && (c.area === al.area || c.grupos.some(g => gruposArea.includes(g))),
        )) agregar(p, c)
      }
      continue
    }
    if (p.area === 'tecnica') {
      if (p.rol === 'lider') {
        for (const c of personas) {
          if ((c.rol === 'analista' || APOYOS.includes(c.rol))
              && c.grupos.some(g => GRUPOS_TECNICOS.includes(g))) agregar(p, c)
        }
      } else if (p.rol === 'analista') {
        for (const l of lideresDe('tecnica')) agregar(p, l)
        for (const g of p.grupos) {
          for (const c of conRolEnGrupo('evaluador', g)) agregar(p, c)
          for (const c of conRolesEnGrupo(APOYOS, g)) agregar(p, c)
        }
      } else if (p.rol === 'evaluador') {
        for (const g of p.grupos) {
          for (const c of conRolEnGrupo('analista', g)) agregar(p, c)
          for (const c of conRolesEnGrupo(APOYOS, g)) agregar(p, c)
        }
      } else if (p.rol === 'apoyo_tecnico' || p.rol === 'apoyo_presupuestal') {
        for (const g of p.grupos) {
          for (const c of conRolEnGrupo('analista', g)) agregar(p, c)
          for (const c of conRolEnGrupo('evaluador', g)) agregar(p, c)
        }
      }
    }
    if (p.area === 'juridica' && p.grupos.includes(8)) {
      const enG8 = personas.filter(c => c.grupos.includes(8))
      if (p.rol === 'evaluador') {
        for (const c of enG8) {
          if (['lider', 'analista', 'apoyo_juridico'].includes(c.rol) && c.area === 'juridica') agregar(p, c)
        }
      } else if (p.rol === 'analista' || p.rol === 'lider') {
        for (const c of enG8) {
          if (['evaluador', 'apoyo_juridico'].includes(c.rol) && c.area === 'juridica') agregar(p, c)
        }
      } else if (p.rol === 'apoyo_juridico') {
        for (const c of enG8) {
          if (['evaluador', 'lider', 'analista'].includes(c.rol) && c.area === 'juridica') agregar(p, c)
        }
      }
    }
    if (p.rol === 'apoyo_juridico') {
      for (const g of p.grupos.filter(g => GRUPOS_TECNICOS.includes(g))) {
        for (const c of conRolEnGrupo('analista', g)) agregar(p, c)
        for (const c of conRolEnGrupo('evaluador', g)) agregar(p, c)
      }
    }
    if (p.area === 'financiera' && p.grupos.includes(7) && p.rol === 'lider') {
      for (const c of personas) {
        if (c._id === p._id) continue
        if (c.rol === 'lider' && c.area === 'financiera' && c.grupos.includes(7)) agregar(p, c)
        if ((c.rol === 'apoyo_financiero' || c.rol === 'apoyo_presupuestal') && c.grupos.includes(7)) agregar(p, c)
        // Regla agregada en el motor original: las líderes financieras
        // también evalúan a los transversales de su área, que no tienen grupo.
        if (c.esTransversal && c.area === 'financiera') agregar(p, c)
      }
    }
    if ((p.rol === 'apoyo_financiero' || p.rol === 'apoyo_presupuestal') && p.grupos.includes(7)) {
      for (const c of personas) {
        if (!c.grupos.includes(7)) continue
        if (c.rol === 'lider' && c.area === 'financiera') agregar(p, c)
      }
    }
    for (const g of p.grupos) {
      for (const c of personas) {
        if (c.rol === p.rol && c.area === p.area && c.grupos.includes(g)) agregar(p, c)
      }
    }
  }
  return pares
}

describe('RetroMatrizService — fidelidad del port', () => {
  const nombres = [...ESCENARIO.map(e => e[0]), ...TRANSVERSALES.map(t => t.nombre)]
  const idDe = new Map(nombres.map((n, i) => [n, i + 1]))
  const nombreDe = new Map([...idDe.entries()].map(([n, i]) => [i, n]))

  const nodos: NodoMatriz[] = [
    ...ESCENARIO.map(([nombre, rol, area, grupos]) => ({
      participacionId: idDe.get(nombre)!,
      evaluadorId: idDe.get(nombre)!,
      nombre, rol, area, grupos: [...grupos],
      esTransversal: false,
      alcance: [],
    })),
    ...TRANSVERSALES.map(t => ({
      participacionId: idDe.get(t.nombre)!,
      evaluadorId: idDe.get(t.nombre)!,
      nombre: t.nombre, rol: t.rol, area: t.area, grupos: [...t.grupos],
      esTransversal: true,
      alcance: t.alcance.map(a => ({ ...a, roles: [...a.roles] })),
    })),
  ]

  const personasOriginal: PersonaOriginal[] = [
    ...ESCENARIO.map(([nombre, rol, area, grupos]) => ({
      _id: nombre, rol: rol.toLowerCase(), area: area.toLowerCase(),
      grupos: [...grupos], esTransversal: false, alcanceEvaluacion: [],
    })),
    ...TRANSVERSALES.map(t => ({
      _id: t.nombre,
      rol: t.rol.toLowerCase(), area: t.area.toLowerCase(),
      grupos: [...t.grupos], esTransversal: true,
      alcanceEvaluacion: t.alcance.map(a => ({
        area: a.area.toLowerCase(), roles: a.roles.map(r => r.toLowerCase()),
      })),
    })),
  ]

  // El servicio no toca la base de datos en `calcularSobre`, así que no hace
  // falta levantar el módulo ni mockear el DataSource.
  const service = new RetroMatrizService(null as never)

  it('produce exactamente los mismos pares que el motor original', () => {
    const { pares } = service.calcularSobre(nodos)
    const portado = new Set(
      pares.map(p => `${nombreDe.get(p.evaluadorParticipacionId)}::${nombreDe.get(p.evaluadoParticipacionId)}`),
    )
    const original = calcularParesOriginal(personasOriginal)

    expect([...original].filter(k => !portado.has(k))).toEqual([])
    expect([...portado].filter(k => !original.has(k))).toEqual([])
    expect(portado.size).toBe(original.size)
  })

  it('nunca genera autoevaluación', () => {
    const { pares } = service.calcularSobre(nodos)
    expect(pares.filter(p => p.evaluadorParticipacionId === p.evaluadoParticipacionId)).toEqual([])
  })

  it('no repite un par aunque lo produzcan varias reglas', () => {
    const { pares } = service.calcularSobre(nodos)
    const claves = pares.map(p => `${p.evaluadorParticipacionId}::${p.evaluadoParticipacionId}`)
    expect(new Set(claves).size).toBe(claves.length)
  })

  it('atribuye cada par a la regla que lo generó', () => {
    const { pares, stats } = service.calcularSobre(nodos)
    expect(pares.every(p => !!p.motivo)).toBe(true)
    expect(Object.values(stats.porRegla).reduce((a, b) => a + b, 0)).toBe(pares.length)
  })

  it('alcanza al apoyo jurídico que trabaja en grupos técnicos', () => {
    // Fernanda tiene área JURIDICA y grupos [1, 2, 8]: debe retroalimentar
    // también al analista y a los evaluadores de sus grupos técnicos.
    const { pares } = service.calcularSobre(nodos)
    const fernanda = idDe.get('Fernanda ApoyoJur')!
    const suyos = pares.filter(p => p.evaluadorParticipacionId === fernanda)
      .map(p => nombreDe.get(p.evaluadoParticipacionId))
    expect(suyos).toEqual(expect.arrayContaining(['Analista G1', 'Evaluador A G1', 'Lider Juridica']))
  })

  it('respeta el alcance explícito del transversal', () => {
    const { pares } = service.calcularSobre(nodos)
    const natalia = idDe.get(TRANSVERSAL.nombre)!
    const suyos = pares.filter(p => p.evaluadorParticipacionId === natalia)
      .map(p => nombreDe.get(p.evaluadoParticipacionId)!)
    // Su alcance es ANALISTA + EVALUADOR del área técnica, nada más.
    expect(suyos).toEqual(expect.arrayContaining(['Analista G1', 'Evaluador A G1']))
    expect(suyos).not.toEqual(expect.arrayContaining(['Lider Financiera']))
  })

  it('permite apagar la evaluación entre pares sin tocar el resto', () => {
    const con = service.calcularSobre(nodos)
    const sin = service.calcularSobre(nodos, {
      gruposPorArea: { TECNICA: [1, 2, 3, 4, 5, 6], FINANCIERA: [7], JURIDICA: [8] },
      apoyosDeGrupo: ['APOYO_TECNICO', 'APOYO_PRESUPUESTAL', 'APOYO_JURIDICO'],
      peerEvaluation: false,
      alcanceForzado: [],
    })
    expect(sin.pares.length).toBeLessThan(con.pares.length)
    expect(sin.stats.porRegla['pares-mismo-rol-y-grupo']).toBeUndefined()
  })

  it('permite forzar el alcance de un transversal desde la configuración', () => {
    // Equivale al OVERRIDE_TRANSVERSAL del motor original, pero como dato de
    // la convocatoria en vez de nombres propios hardcodeados en el código.
    const reglas = {
      gruposPorArea: { TECNICA: [1, 2, 3, 4, 5, 6], FINANCIERA: [7], JURIDICA: [8] },
      apoyosDeGrupo: ['APOYO_TECNICO', 'APOYO_PRESUPUESTAL', 'APOYO_JURIDICO'],
      peerEvaluation: true,
      alcanceForzado: [
        { nombreContiene: 'Natalia', alcance: [{ area: 'TECNICA', roles: ['LIDER'] }] },
      ],
    }
    const { pares } = service.calcularSobre(nodos, reglas)
    const natalia = idDe.get('Natalia Transversal')!
    const suyos = pares.filter(p => p.evaluadorParticipacionId === natalia)
      .map(p => nombreDe.get(p.evaluadoParticipacionId)!)

    // Su alcance en el nodo era ANALISTA + EVALUADOR; forzado queda solo LIDER.
    expect(suyos).toContain('Lider Tecnica')
    expect(suyos).not.toContain('Analista G1')
  })

  it('el alcance forzado no toca a quien no coincide por nombre', () => {
    const reglas = {
      gruposPorArea: { TECNICA: [1, 2, 3, 4, 5, 6], FINANCIERA: [7], JURIDICA: [8] },
      apoyosDeGrupo: ['APOYO_TECNICO', 'APOYO_PRESUPUESTAL', 'APOYO_JURIDICO'],
      peerEvaluation: true,
      alcanceForzado: [
        { nombreContiene: 'Natalia', alcance: [{ area: 'TECNICA', roles: ['LIDER'] }] },
      ],
    }
    const soraya = idDe.get('Soraya Transversal')!
    const base = service.calcularSobre(nodos).pares
      .filter(p => p.evaluadorParticipacionId === soraya).length
    const conOverride = service.calcularSobre(nodos, reglas).pares
      .filter(p => p.evaluadorParticipacionId === soraya).length
    expect(conOverride).toBe(base)
  })

  it('la líder financiera retroalimenta al transversal de su área', () => {
    // Regla agregada al motor original después del primer ciclo. El
    // transversal no tiene grupo, así que el filtro por grupo 7 NO puede
    // aplicársele: exigírselo era lo que lo dejaba sin evaluar.
    const { pares } = service.calcularSobre(nodos)
    const lider = idDe.get('Lider Financiera')!
    const soraya = idDe.get('Soraya Transversal')!
    const par = pares.find(
      p => p.evaluadorParticipacionId === lider && p.evaluadoParticipacionId === soraya,
    )
    expect(par).toBeDefined()
    expect(par!.motivo).toBe('lider-financiera→transversales')
  })

  it('a los transversales técnico y jurídico no los retroalimenta nadie', () => {
    // DECISIÓN DEL ÁREA, confirmada: es intencional. Solo el transversal
    // financiero recibe retroalimentación (de su líder). Este test existe para
    // que, si algún día la matriz empieza a asignarles evaluadores, alguien
    // tenga que venir aquí a cambiarlo a conciencia y no por accidente.
    const { stats } = service.calcularSobre(nodos)
    const sinEvaluar = stats.sinSerEvaluado.map(s => s.nombre)
    expect(sinEvaluar).toContain('Natalia Transversal')
    expect(sinEvaluar).not.toContain('Soraya Transversal')
  })
})
