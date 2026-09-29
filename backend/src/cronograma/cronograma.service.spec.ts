import { ForbiddenException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { reiniciarTriggersDeId } from '../common/db/ids'
import { CronogramaService } from './cronograma.service'
import { AgregarSesionVirtualDto } from './dto/agregar-sesion-virtual.dto'

// pruebas sin Oracle: DataSource y QueryRunner falsos que responden según el texto del SQL

type Llamada = { sql: string; params?: unknown[] }
type Responder = (sql: string, params?: unknown[]) => unknown

function falsos(responderDs: Responder, responderQr: Responder) {
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
  const ds = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      enDs.push({ sql, params })
      return responderDs(sql, params)
    }),
    createQueryRunner: () => qr,
  }
  return { servicio: new CronogramaService(ds as unknown as DataSource), qr, enDs, enQr }
}

// convenio en ejecución y lo pendiente por radicar: dos sesiones presenciales y una actividad virtual
const pendientes: Responder = (sql) => {
  if (sql.includes('FROM CONVENIOS WHERE PROYECTOID')) return [{ estado: 1 }]
  if (sql.includes('FROM CRONOGRAMAPRESENCIAL cp')) return [{ id: 11, sigla: 'CP000001' }, { id: 12, sigla: 'CP000002' }]
  if (sql.includes('FROM CRONOGRAMAVIRTUAL cv')) return [{ id: 21, sigla: 'CV000001' }]
  return []
}

describe('CronogramaService.radicarCronograma', () => {
  afterEach(() => reiniciarTriggersDeId())

  it('con trigger de id marca las sesiones con el id que devuelve el RETURNING, no con MAX+1', async () => {
    reiniciarTriggersDeId(new Map([['CRONOGRAMARADICADO', 'RADICADOID']]))
    const { servicio, qr, enDs, enQr } = falsos(pendientes, (sql) => {
      if (sql.includes('MAX(NUMERORADICADO)')) return [{ n: 4 }]
      if (sql.startsWith('INSERT INTO CRONOGRAMARADICADO')) return [[9001]]
      return []
    })

    const r = await servicio.radicarCronograma(77)

    expect(r).toEqual({ radicadoId: 9001, numero: 4, sesionesRadicadas: 2, actividadesRadicadas: 1 })
    expect(enQr.find((l) => l.sql.includes('UPDATE CRONOGRAMAPRESENCIAL'))?.params).toEqual([9001, 11, 12])
    expect(enQr.find((l) => l.sql.includes('UPDATE CRONOGRAMAVIRTUAL'))?.params).toEqual([9001, 21])
    expect([...enDs, ...enQr].some((l) => l.sql.includes('MAX(RADICADOID)'))).toBe(false)

    const ins = enQr.find((l) => l.sql.startsWith('INSERT INTO CRONOGRAMARADICADO'))
    expect(ins?.sql).toContain('VALUES (NULL, ')
    expect(ins?.sql).toContain('RETURNING RADICADOID INTO')
    expect(ins?.sql).toContain('CAST((now() AT TIME ZONE \'UTC\') AS timestamp)')
    expect(ins?.sql).not.toContain('(now() AT TIME ZONE \'UTC\')')
    // los históricos van como NCLOB tipado (LOB temporal)
    expect(ins?.params).toContainEqual({ type: expect.anything(), val: 'CP000001-RADICADO;CP000002-RADICADO' })
    expect(ins?.params).toContainEqual({ type: expect.anything(), val: 'CV000001-RADICADO' })

    expect(qr.commitTransaction).toHaveBeenCalledTimes(1)
    expect(qr.rollbackTransaction).not.toHaveBeenCalled()
  })

  it('sin trigger (XE) sigue con MAX+1 y marca las sesiones con ese mismo id', async () => {
    reiniciarTriggersDeId(new Map())
    const { servicio, enQr } = falsos(pendientes, (sql) => {
      if (sql.startsWith('SELECT COALESCE(MAX(RADICADOID)')) return [{ id: 3015 }]
      if (sql.includes('MAX(NUMERORADICADO)')) return [{ n: 1 }]
      if (sql.startsWith('INSERT INTO CRONOGRAMARADICADO')) return [[3015]]
      return []
    })

    const r = await servicio.radicarCronograma(77)

    expect(r.radicadoId).toBe(3015)
    const ins = enQr.find((l) => l.sql.startsWith('INSERT INTO CRONOGRAMARADICADO'))
    expect(ins?.sql).toContain('VALUES ($1, ')
    expect(ins?.params?.[0]).toBe(3015)
    expect(enQr.find((l) => l.sql.includes('UPDATE CRONOGRAMAPRESENCIAL'))?.params).toEqual([3015, 11, 12])
    expect(enQr.find((l) => l.sql.includes('UPDATE CRONOGRAMAVIRTUAL'))?.params).toEqual([3015, 21])
  })
})

describe('CronogramaService: gates por convenio', () => {
  afterEach(() => reiniciarTriggersDeId())

  it('el radicado resuelve su proyecto por RADICADOID y bloquea si el convenio no está en ejecución', async () => {
    const { servicio, qr, enDs } = falsos((sql) => {
      if (sql.includes('FROM CRONOGRAMARADICADO WHERE RADICADOID = $1')) return [{ proyectoId: 77 }]
      if (sql.includes('FROM CONVENIOS WHERE PROYECTOID')) return [{ estado: 0 }]
      return []
    }, () => [])

    await expect(servicio.marcarTodasActualizadas(5)).rejects.toBeInstanceOf(ForbiddenException)
    expect(enDs[0]).toEqual({
      sql: 'SELECT PROYECTOID AS "proyectoId" FROM CRONOGRAMARADICADO WHERE RADICADOID = $1',
      params: [5],
    })
    expect(enDs[1].params).toEqual([77])
    expect(qr.startTransaction).not.toHaveBeenCalled()
  })

  it('agregarSesionVirtual toma el proyecto de CRONOPROYECTO, llena TIPOCAPACIADORVIR y devuelve el id del RETURNING', async () => {
    reiniciarTriggersDeId(new Map([['CRONOGRAMAVIRTUAL', 'CRONOGRAMAVIRTUALID']]))
    const { servicio, enDs, enQr } = falsos((sql) => {
      if (sql.includes('SELECT CRONOPROYECTO AS "proyectoId" FROM CRONOGRAMA')) return [{ proyectoId: 77 }]
      if (sql.includes('FROM CONVENIOS WHERE PROYECTOID')) return [{ estado: 1 }]
      return []
    }, (sql) => {
      if (sql.startsWith('UPDATE')) return []
      if (sql.includes('JOIN UNIDADTEMATICA ut')) {
        return [{
          cronogramaId: 5, grupoId: 1, utId: 2, proyectoId: 77,
          fechaInicio: new Date('2026-01-01T05:00:00.000Z'), fechaFin: new Date('2026-12-31T05:00:00.000Z'),
          horasPV: 10, horasTV: 10, horasPHib: 0, horasTHib: 0,
        }]
      }
      if (sql.includes('FROM CAPACITADORES') || sql.includes('FROM PERFILUT')) return [{ ok: 1 }]
      if (sql.includes('SUM(CRONOGRAMAVIRTUALNUMHORAS)')) return [{ horas: 0 }]
      if (sql.includes('CONVENIOSCRONOCONSECUTIVOV')) return [{ convId: 9, consec: 6 }]
      if (sql.includes('MAX(CRONOGRAMAVIRTUALNUMSESION)')) return [{ next: 1 }]
      if (sql.startsWith('INSERT INTO CRONOGRAMAVIRTUAL')) return [[8123]]
      return []
    })
    const dto = {
      nombreActividad: 'EVALUACIÓN INICIAL', fechaInicio: '2026-02-01', fechaFin: '2026-02-02', horas: 4,
      plataforma: 'PLATAFORMA DE PRUEBA', url: 'https://plataforma.local/curso',
      capacitadorId: 3, perfilUTId: 4, modalidadId: 4,
    } as AgregarSesionVirtualDto

    const r = await servicio.agregarSesionVirtual(5, dto)

    expect(r).toEqual({ actividadId: 8123, sigla: 'CV000007', numSesion: 1, horas: 4 })
    expect(enDs[0]).toEqual({ sql: expect.stringContaining('SELECT CRONOPROYECTO AS "proyectoId" FROM CRONOGRAMA'), params: [5] })
    const ins = enQr.find((l) => l.sql.startsWith('INSERT INTO CRONOGRAMAVIRTUAL'))
    expect(ins?.sql).toContain('TIPOCAPACIADORVIR')
    expect(ins?.sql).toContain('VALUES (NULL, ')
    expect(ins?.params).toContain('CAPACITADOR NACIONAL')
    expect(enQr.some((l) => l.sql.includes('MAX(CRONOGRAMAVIRTUALID)'))).toBe(false)
  })
})
