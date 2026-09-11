import { matchModalidad } from './match-modalidad'

const catalogo = (...nombres: string[]) => nombres.map((nombre, i) => ({ id: i + 1, nombre }))

describe('matchModalidad', () => {
  it('prefiere la coincidencia exacta, sin el prefijo EMPRESA', () => {
    const c = catalogo('EMPRESAS INDIVIDUALES', 'INDIVIDUAL', 'GREMIO')
    expect(matchModalidad('EMPRESA INDIVIDUAL', c)?.id).toBe(2)
    expect(matchModalidad('  empresa   individual ', c)?.id).toBe(2)
  })

  it('sin exacta, gana la subcadena más larga y no la primera del catálogo', () => {
    const texto = 'TALLER EN PUESTO DE TRABAJO REAL (TPTR)'
    expect(matchModalidad(texto, catalogo('TALLER', 'TALLER EN PUESTO DE TRABAJO REAL'))?.id).toBe(2)
    expect(matchModalidad(texto, catalogo('TALLER EN PUESTO DE TRABAJO REAL', 'TALLER'))?.id).toBe(1)
  })

  it('un nombre que contiene todo el texto gana a uno corto contenido en el texto', () => {
    expect(matchModalidad('CADENA PRODUCTIVA', catalogo('CADENA', 'CADENA PRODUCTIVA REGIONAL'))?.id).toBe(2)
  })

  it('entre coincidencias del mismo largo, el nombre de largo más parecido al texto', () => {
    expect(matchModalidad('GREMIO', catalogo('GREMIOS Y ASOCIACIONES DE SEGUNDO NIVEL', 'GREMIOS'))?.id).toBe(2)
  })

  it('ignora nombres de 2 letras o menos y no inventa coincidencias', () => {
    expect(matchModalidad('NACIONAL', catalogo('NA', 'SI'))).toBeUndefined()
    expect(matchModalidad('XYZ', catalogo('INDIVIDUAL'))).toBeUndefined()
    expect(matchModalidad('', catalogo('INDIVIDUAL'))).toBeUndefined()
    expect(matchModalidad('   ', catalogo('INDIVIDUAL'))).toBeUndefined()
  })
})
