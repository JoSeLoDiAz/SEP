import { BadRequestException } from '@nestjs/common'
import { DataSource, Repository } from 'typeorm'
import { Empresa } from '../auth/entities/empresa.entity'
import { reiniciarTriggersDeId } from '../common/db/ids'
import { ConveniosService } from './convenios.service'

// pruebas sin Oracle: DataSource y QueryRunner falsos que responden según el texto del SQL
// datos inventados: nunca cédulas ni nombres reales en un fixture

type Llamada = { sql: string; params?: unknown[] }
type Responder = (sql: string, params?: unknown[]) => unknown

function falsos(responderQr: Responder, responderDs?: Responder) {
  const enDs: Llamada[] = []
  const enQr: Llamada[] = []
  const qr = {
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      enQr.push({ sql, params })
      return responderQr(sql, params)
    }),
  }
  // fuera de la transacción: primero lo que pida la prueba; si no, las lecturas de acceso (detalle del convenio y estado)
  const ds = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      enDs.push({ sql, params })
      const propia = responderDs?.(sql, params)
      if (propia !== undefined) return propia
      if (sql.includes('AS "convenioId"')) return [{ convenioId: 1, empresaId: 50 }]
      if (sql.includes('NVL(CONVENIOSESTADO, 0)')) return [{ estado: 1 }]
      return []
    }),
    createQueryRunner: () => qr,
  }
  const empresaRepo = { findOne: jest.fn(async () => ({ empresaId: 50 })) }
  const servicio = new ConveniosService(empresaRepo as unknown as Repository<Empresa>, ds as unknown as DataSource)
  return { servicio, qr, enDs, enQr }
}

const escribe = (l: Llamada) => /^\s*(INSERT|UPDATE|DELETE)/.test(l.sql)

const dto = {
  tipoDocumentoId: 1, identificacion: '10000001',
  nombres: 'Marta Elena', primerApellido: 'Ríos', email: 'mrios@ejemplo.local',
}

describe('ConveniosService.crearDirector', () => {
  afterEach(() => reiniciarTriggersDeId())

  it('con trigger de id crea persona y director en una transacción y enlaza el id que devolvió la base', async () => {
    reiniciarTriggersDeId(new Map([['PERSONA', 'PERSONAID'], ['DIRECTORES', 'DIRECTORID']]))
    const { servicio, qr, enDs, enQr } = falsos((sql) => {
      if (sql.startsWith('INSERT INTO PERSONA')) return [[313500]]
      if (sql.startsWith('INSERT INTO DIRECTORES')) return [[1700]]
      return []
    })

    const r = await servicio.crearDirector('empresa@ejemplo.local', 77, dto)

    expect(r).toMatchObject({ directorId: 1700, personaId: 313500 })
    const insDir = enQr.find((l) => l.sql.startsWith('INSERT INTO DIRECTORES'))
    expect(insDir?.sql).toContain('VALUES (NULL, ')
    expect(insDir?.params?.slice(0, 2)).toEqual([313500, 77])
    expect(enQr.some((l) => l.sql.includes('MAX(PERSONAID)') || l.sql.includes('MAX(DIRECTORID)'))).toBe(false)
    // nada escribe fuera de la transacción
    expect(enDs.some(escribe)).toBe(false)
    expect(enQr.find((l) => l.sql.includes('UPDATE DIRECTORES'))?.sql).toContain('CAST(SYS_EXTRACT_UTC(SYSTIMESTAMP) AS DATE)')
    expect(qr.startTransaction).toHaveBeenCalledTimes(1)
    expect(qr.commitTransaction).toHaveBeenCalledTimes(1)
    expect(qr.rollbackTransaction).not.toHaveBeenCalled()
    expect(qr.release).toHaveBeenCalledTimes(1)
  })

  it('si falla el director deshace todo: ni la persona ni la inactivación del anterior quedan', async () => {
    reiniciarTriggersDeId(new Map([['PERSONA', 'PERSONAID'], ['DIRECTORES', 'DIRECTORID']]))
    const { servicio, qr } = falsos((sql) => {
      if (sql.startsWith('INSERT INTO PERSONA')) return [[313500]]
      if (sql.startsWith('INSERT INTO DIRECTORES')) throw new Error('ORA-02291: integrity constraint violated')
      return []
    })

    await expect(servicio.crearDirector('empresa@ejemplo.local', 77, dto)).rejects.toThrow('ORA-02291')
    expect(qr.rollbackTransaction).toHaveBeenCalledTimes(1)
    expect(qr.commitTransaction).not.toHaveBeenCalled()
    expect(qr.release).toHaveBeenCalledTimes(1)
  })

  it('sin trigger (XE) sigue con MAX+1, dentro de la misma transacción', async () => {
    reiniciarTriggersDeId(new Map())
    const { servicio, enDs, enQr } = falsos((sql) => {
      if (sql.startsWith('SELECT NVL(MAX(PERSONAID)')) return [{ id: 313071 }]
      if (sql.startsWith('SELECT NVL(MAX(DIRECTORID)')) return [{ id: 1609 }]
      if (sql.startsWith('INSERT INTO PERSONA')) return [[313071]]
      if (sql.startsWith('INSERT INTO DIRECTORES')) return [[1609]]
      return []
    })

    const r = await servicio.crearDirector('empresa@ejemplo.local', 77, dto)

    expect(r).toMatchObject({ directorId: 1609, personaId: 313071 })
    expect(enQr.find((l) => l.sql.startsWith('INSERT INTO PERSONA'))?.params?.[0]).toBe(313071)
    expect(enQr.find((l) => l.sql.startsWith('INSERT INTO DIRECTORES'))?.params?.slice(0, 2)).toEqual([1609, 313071])
    expect(enDs.some((l) => l.sql.includes('MAX('))).toBe(false)
  })
})

describe('ConveniosService.asociarDirector', () => {
  afterEach(() => reiniciarTriggersDeId())

  // la persona existe, todavía no es el director activo y no tiene conflicto en la convocatoria
  const lecturas: Responder = (sql) =>
    sql.includes('FROM PERSONA WHERE PERSONAID = :1') ? [{ id: 313500 }] : undefined

  it('inactiva al anterior y crea el nuevo en una transacción, con el id que devolvió la base', async () => {
    reiniciarTriggersDeId(new Map([['DIRECTORES', 'DIRECTORID']]))
    const { servicio, qr, enDs, enQr } = falsos((sql) => {
      if (sql.startsWith('INSERT INTO DIRECTORES')) return [[1700]]
      return []
    }, lecturas)

    const r = await servicio.asociarDirector('empresa@ejemplo.local', 77, 313500)

    expect(r).toMatchObject({ directorId: 1700, personaId: 313500 })
    const iUpd = enQr.findIndex((l) => l.sql.includes('UPDATE DIRECTORES'))
    const iIns = enQr.findIndex((l) => l.sql.startsWith('INSERT INTO DIRECTORES'))
    expect(iUpd).toBeGreaterThanOrEqual(0)
    expect(iIns).toBeGreaterThan(iUpd)
    expect(enDs.some(escribe)).toBe(false)
    expect(qr.startTransaction).toHaveBeenCalledTimes(1)
    expect(qr.commitTransaction).toHaveBeenCalledTimes(1)
    expect(qr.rollbackTransaction).not.toHaveBeenCalled()
    expect(qr.release).toHaveBeenCalledTimes(1)
  })

  it('si falla el INSERT deshace la inactivación: el proyecto no queda sin director ACTIVO', async () => {
    reiniciarTriggersDeId(new Map([['DIRECTORES', 'DIRECTORID']]))
    const { servicio, qr, enDs, enQr } = falsos((sql) => {
      if (sql.startsWith('INSERT INTO DIRECTORES')) throw new Error('ORA-02291: integrity constraint violated')
      return []
    }, lecturas)

    await expect(servicio.asociarDirector('empresa@ejemplo.local', 77, 313500)).rejects.toThrow('ORA-02291')
    expect(enQr.some((l) => l.sql.includes('UPDATE DIRECTORES'))).toBe(true)
    expect(enDs.some(escribe)).toBe(false)
    expect(qr.rollbackTransaction).toHaveBeenCalledTimes(1)
    expect(qr.commitTransaction).not.toHaveBeenCalled()
    expect(qr.release).toHaveBeenCalledTimes(1)
  })
})

describe('ConveniosService.guardarPersonaBeneficiaria: fecha de nacimiento', () => {
  afterEach(() => reiniciarTriggersDeId())

  it.each(['1990-02-30', '30/05/1990', '05/30/1990', '1990-5-3', '1990-13-01', '0990-05-30'])(
    'rechaza %s al crear y al actualizar, sin escribir nada',
    async (fecha) => {
      reiniciarTriggersDeId(new Map([['PERSONA', 'PERSONAID']]))
      const { servicio, enDs } = falsos(() => [])

      await expect(servicio.guardarPersonaBeneficiaria('empresa@ejemplo.local', 77, { ...dto, fechaNacimiento: fecha }))
        .rejects.toThrow(BadRequestException)
      await expect(servicio.guardarPersonaBeneficiaria('empresa@ejemplo.local', 77, { ...dto, personaId: 9, fechaNacimiento: fecha }))
        .rejects.toThrow('Fecha de nacimiento no válida.')
      expect(enDs.some(escribe)).toBe(false)
    },
  )

  it('con una fecha válida crea la persona a medianoche de ese día y devuelve el id del RETURNING', async () => {
    reiniciarTriggersDeId(new Map([['PERSONA', 'PERSONAID']]))
    const { servicio, enDs } = falsos(() => [], (sql) => (sql.startsWith('INSERT INTO PERSONA') ? [[313500]] : undefined))

    const r = await servicio.guardarPersonaBeneficiaria('empresa@ejemplo.local', 77, { ...dto, fechaNacimiento: '1990-05-30' })

    expect(r).toEqual({ mensaje: 'Persona registrada exitosamente', accion: 'creada', personaId: 313500 })
    expect(enDs.find((l) => l.sql.startsWith('INSERT INTO PERSONA'))?.params).toContainEqual(new Date(1990, 4, 30))
  })

  it('al actualizar le pasa a TO_DATE el mismo texto ya validado', async () => {
    const { servicio, enDs } = falsos(() => [])

    const r = await servicio.guardarPersonaBeneficiaria('empresa@ejemplo.local', 77, { ...dto, personaId: 9, fechaNacimiento: '1990-05-30' })

    expect(r).toMatchObject({ accion: 'actualizada', personaId: 9 })
    expect(enDs.find((l) => l.sql.includes('UPDATE PERSONA'))?.params?.slice(7, 9)).toEqual(['1990-05-30', '1990-05-30'])
  })

  it('sin fecha no valida nada y guarda NULL, como antes', async () => {
    reiniciarTriggersDeId(new Map([['PERSONA', 'PERSONAID']]))
    const { servicio, enDs } = falsos(() => [], (sql) => (sql.startsWith('INSERT INTO PERSONA') ? [[313501]] : undefined))

    const r = await servicio.guardarPersonaBeneficiaria('empresa@ejemplo.local', 77, { ...dto, fechaNacimiento: '  ' })

    expect(r.personaId).toBe(313501)
    const ins = enDs.find((l) => l.sql.startsWith('INSERT INTO PERSONA'))
    expect(ins?.sql).toContain('PERSONAFECHANACIMIENTO')
    expect(ins?.params?.some((p) => p instanceof Date)).toBe(false)
  })
})
