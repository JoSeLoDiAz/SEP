import {
  fijarPerfilGestorEvaluadores,
  perfilGestorEvaluadores,
  perfilesGestion,
  resolverPerfiles,
} from './perfiles'
import type { Ejecutor } from './db/ids'

const conFilas = (filas: { id: unknown }[]): Ejecutor => ({ query: () => Promise.resolve(filas) })

describe('perfiles', () => {
  afterEach(() => fijarPerfilGestorEvaluadores(null))

  it('sin resolver no adivina: falla', () => {
    expect(() => perfilGestorEvaluadores()).toThrow(/no se resolvieron/)
  })

  it('el .env manda sobre la base', async () => {
    const r = await resolverPerfiles(conFilas([{ id: 15 }]), ' 103 ')
    expect(r).toEqual({ gestorEvaluadores: 103, origen: 'PERFIL_GESTOR_EVALUADORES' })
    expect(perfilesGestion()).toEqual([1, 2, 103])
  })

  it('sin .env lo busca por nombre (15 en el XE, 103 en el Exadata)', async () => {
    await resolverPerfiles(conFilas([{ id: '103' }]))
    expect(perfilGestorEvaluadores()).toBe(103)
    await resolverPerfiles(conFilas([{ id: 15 }]), '')
    expect(perfilGestorEvaluadores()).toBe(15)
  })

  it('cero o varias coincidencias, o un .env raro, no arrancan', async () => {
    await expect(resolverPerfiles(conFilas([]))).rejects.toThrow(/0 coincidencias/)
    await expect(resolverPerfiles(conFilas([{ id: 15 }, { id: 103 }]))).rejects.toThrow(/2 coincidencias/)
    await expect(resolverPerfiles(conFilas([]), 'abc')).rejects.toThrow(/no es un id válido/)
  })
})
