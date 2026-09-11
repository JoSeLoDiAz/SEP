import { AHORA_UTC } from '../common/db/fecha-utc'
import { SqlCrudo } from '../common/db/ids'
import { valoresUtHoras } from './certificacion.service'

describe('valoresUtHoras', () => {
  it('arma UTHORAS1..UTHORAS20 en orden, con el total y la fecha en UTC, sin la llave', () => {
    const horas = Array.from({ length: 20 }, (_, i) => i + 1)
    const v = valoresUtHoras(10, 20, 30, horas, 210)

    expect(Object.keys(v)).toEqual([
      'AFGRUPOID', 'PERSONAID', 'UNIDADTEMATICAID',
      ...horas.map((_, i) => `UTHORAS${i + 1}`),
      'UTHORASTOTAL', 'UTHORASFECHAREGISTRO',
    ])
    expect([v.AFGRUPOID, v.PERSONAID, v.UNIDADTEMATICAID]).toEqual([10, 20, 30])
    expect(v.UTHORAS1).toBe(1)
    expect(v.UTHORAS20).toBe(20)
    expect(v.UTHORASTOTAL).toBe(210)
    expect(v.UTHORASFECHAREGISTRO).toBeInstanceOf(SqlCrudo)
    expect((v.UTHORASFECHAREGISTRO as SqlCrudo).texto).toBe(AHORA_UTC)
    expect(v).not.toHaveProperty('UTHORASID')
  })
})
