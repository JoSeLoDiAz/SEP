import { BadRequestException } from '@nestjs/common'
import type { DataSource, Repository } from 'typeorm'
import type { Empresa } from '../auth/entities/empresa.entity'
import { reiniciarTriggersDeId } from '../common/db/ids'
import { HERR_OTRA_MAX_BYTES, mensajeHerrOtraLarga } from './herr-otra'
import { NecesidadesService } from './necesidades.service'

// DataSource falso: guarda cada SQL y el RETURNING responde el id dado
function falso(id = 777) {
  const llamadas: { sql: string; params?: unknown[] }[] = []
  const ds = {
    query: (sql: string, params?: unknown[]) => {
      llamadas.push({ sql, params })
      if (sql.includes('RETURNING')) return Promise.resolve([[id]])
      if (sql.includes('COUNT(')) return Promise.resolve([{ total: 2 }])
      return Promise.resolve([])
    },
  } as unknown as DataSource
  const repo = { findOne: () => Promise.resolve({ empresaId: 55 }) } as unknown as Repository<Empresa>
  return { servicio: new NecesidadesService(repo, ds), llamadas }
}

// SYSDATE/SYSTIMESTAMP sueltos dan hora de Colombia en el Exadata; solo vale SYSTIMESTAMP dentro de SYS_EXTRACT_UTC
const horaLocal = /SYSDATE|(?<!SYS_EXTRACT_UTC\()SYSTIMESTAMP/

const EXADATA = new Map([
  ['NECESIDAD', 'NECESIDADID'],
  ['HERRAMIENTANECESIDAD', 'HERRAMIENTANECESIDADID'],
  ['NECESIDADFORMACION', 'NECESIDADFORMACIONID'],
])

describe('NecesidadesService', () => {
  afterEach(() => reiniciarTriggersDeId())

  it('crear devuelve el id que puso el trigger, en la misma sentencia y sin CURRVAL', async () => {
    reiniciarTriggersDeId(EXADATA)
    const { servicio, llamadas } = falso(4321)

    const r = await servicio.crear('empresa@prueba.co', 9)

    expect(r.necesidadId).toBe(4321)
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0].sql).toBe(
      'INSERT INTO NECESIDAD (NECESIDADID, EMPRESANECESIDADID, NECESIDADFECHAREGISTRO, USUREGISTRONECESIDAD) ' +
        'VALUES (NULL, $1, CAST((now() AT TIME ZONE \'UTC\') AS timestamp), $2) RETURNING NECESIDADID INTO $3',
    )
    expect(llamadas[0].params?.slice(0, 2)).toEqual([55, 9])
  })

  it('sin trigger, las altas usan la secuencia de antes', async () => {
    reiniciarTriggersDeId(new Map())
    const { servicio, llamadas } = falso()

    await servicio.crear('empresa@prueba.co', 9)
    await servicio.registrarHerramienta(10, 3, 25, 9)
    await servicio.registrarNecesidadFormacion(10, 'Soldadura', 20, 9)

    expect(llamadas[0].sql).toContain('VALUES (NECESIDADID.NEXTVAL, $1,')
    expect(llamadas[1].sql).toContain('VALUES (HERRAMIENTANECESIDADID.NEXTVAL, $1,')
    expect(llamadas[3].sql).toContain('VALUES (NECESIDADFORMACIONID.NEXTVAL, $1,')
  })

  it('herramienta y necesidad de formación dejan el id al trigger y graban la hora en UTC', async () => {
    reiniciarTriggersDeId(EXADATA)
    const { servicio, llamadas } = falso()

    await servicio.registrarHerramienta(10, 3, 25, 9)
    await servicio.registrarNecesidadFormacion(10, 'Soldadura', 20, 9)

    const [herramienta, conteo, necesidad] = llamadas
    expect(herramienta.sql).toMatch(/^INSERT INTO HERRAMIENTANECESIDAD \(HERRAMIENTANECESIDADID, .*\) VALUES \(NULL, /)
    expect(herramienta.params?.slice(0, 5)).toEqual([10, 3, 25, ' ', 9])
    expect(conteo.sql).toContain('COUNT(')
    expect(necesidad.sql).toMatch(/^INSERT INTO NECESIDADFORMACION \(NECESIDADFORMACIONID, .*\) VALUES \(NULL, /)
    // número = COUNT + 1
    expect(necesidad.params?.slice(0, 5)).toEqual([10, 3, 'Soldadura', 20, 9])
    expect(llamadas.some((l) => horaLocal.test(l.sql))).toBe(false)
  })

  describe('guardarDiagnostico y el tope de NECESIDADHERROTRA', () => {
    it('rechaza con 400 lo que pase de 40 bytes UTF-8, sin tocar la base', async () => {
      const { servicio, llamadas } = falso()
      // 21 letras con tilde = 42 bytes
      await expect(servicio.guardarDiagnostico(10, { herrOtra: 'á'.repeat(21) })).rejects.toBeInstanceOf(BadRequestException)
      await expect(servicio.guardarDiagnostico(10, { herrOtra: 'x'.repeat(41) })).rejects.toThrow(/hasta 40 bytes y trae 41/)
      expect(llamadas).toHaveLength(0)
    })

    it('deja pasar hasta 40 bytes justos y el campo vacío', async () => {
      const { servicio, llamadas } = falso()
      await servicio.guardarDiagnostico(10, { herrOtra: 'á'.repeat(20) })
      await servicio.guardarDiagnostico(10, { herrOtra: 'x'.repeat(40) })
      await servicio.guardarDiagnostico(10, { herrOtra: null })
      await servicio.guardarDiagnostico(10, {})
      expect(llamadas).toHaveLength(4)
      expect(llamadas[0].params).toContain('á'.repeat(20))
    })
  })
})

describe('mensajeHerrOtraLarga', () => {
  it('cuenta bytes, no caracteres', () => {
    expect(HERR_OTRA_MAX_BYTES).toBe(40)
    expect(mensajeHerrOtraLarga(null)).toBeNull()
    expect(mensajeHerrOtraLarga(undefined)).toBeNull()
    expect(mensajeHerrOtraLarga('ñ'.repeat(20))).toBeNull()
    expect(mensajeHerrOtraLarga('ñ'.repeat(21))).toMatch(/admite hasta 40 bytes y trae 42/)
  })
})
