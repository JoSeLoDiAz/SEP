import { DataSource } from 'typeorm'
import { reiniciarTriggersDeId } from '../common/db/ids'
import { CapacitadoresService } from './capacitadores.service'

// pruebas sin Oracle: un DataSource falso que responde según el texto del SQL
// datos inventados: nunca documentos ni nombres reales en un fixture

type Llamada = { sql: string; params?: unknown[] }
type Responder = (sql: string, params?: unknown[]) => unknown

function falso(responder: Responder) {
  const llamadas: Llamada[] = []
  const ds = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      llamadas.push({ sql, params })
      return responder(sql, params)
    }),
  }
  return { servicio: new CapacitadoresService(ds as unknown as DataSource), llamadas }
}

const empresa = {
  tipoDocumentoId: 2, identificacion: '900000001', razonSocial: 'EMPRESA DE PRUEBA', sigla: 'EDP',
  email: 'contacto@ejemplo.local', telefono: '6010000000', direccion: 'CALLE 1 # 2-3',
}

describe('CapacitadoresService', () => {
  afterEach(() => reiniciarTriggersDeId())

  it('toggleEstado busca el proyecto en CAPACITADORES (la tabla CAPACITADOR no existe) y fecha en UTC', async () => {
    const { servicio, llamadas } = falso((sql) => {
      if (sql.includes('SELECT PROYECTOID AS "proyectoId" FROM CAPACITADORES')) return [{ proyectoId: 77 }]
      if (sql.includes('COALESCE(CONVENIOSESTADO, 0)')) return [{ estado: 1 }]
      if (sql.includes('AS "inter"')) return [{ inter: 'PENDIENTE DE APROBACION', trans: null }]
      return []
    })

    await expect(servicio.toggleEstado(6358, 'INACTIVO')).resolves.toEqual({ ok: true })
    expect(llamadas.some((l) => /\bFROM CAPACITADOR\b/.test(l.sql))).toBe(false)
    const upd = llamadas.find((l) => l.sql.startsWith('UPDATE CAPACITADORES'))
    expect(upd?.sql).toContain('CAST((now() AT TIME ZONE \'UTC\') AS timestamp)')
    expect(upd?.params).toEqual(['INACTIVO', 6358])
  })

  it('crearEmpresa devuelve el id del RETURNING: sin trigger usa la secuencia EMPRESAID, con trigger manda NULL', async () => {
    reiniciarTriggersDeId(new Map())
    const xe = falso((sql) => (sql.startsWith('INSERT INTO EMPRESA') ? [[4048]] : []))
    await expect(xe.servicio.crearEmpresa(empresa)).resolves.toEqual({ empresaId: 4048 })
    expect(xe.llamadas).toHaveLength(1)
    expect(xe.llamadas[0].sql).toContain('VALUES (EMPRESAID.NEXTVAL, ')
    expect(xe.llamadas[0].sql).not.toContain('MAX(EMPRESAID)')

    reiniciarTriggersDeId(new Map([['EMPRESA', 'EMPRESAID']]))
    const exa = falso((sql) => (sql.startsWith('INSERT INTO EMPRESA') ? [[5120]] : []))
    await expect(exa.servicio.crearEmpresa(empresa)).resolves.toEqual({ empresaId: 5120 })
    expect(exa.llamadas[0].sql).toContain('VALUES (NULL, ')
  })

  it('subirDocumentoEmpresa manda el archivo como BLOB tipado y devuelve el id del RETURNING', async () => {
    reiniciarTriggersDeId(new Map([['DOCUMENTOSCAPJURIDICO', 'DOCUMENTOSCAPJURIDICOID']]))
    const buffer = Buffer.from('%PDF-1.4 prueba')
    const { servicio, llamadas } = falso((sql) => (sql.startsWith('INSERT INTO DOCUMENTOSCAPJURIDICO') ? [[2700]] : []))

    const r = await servicio.subirDocumentoEmpresa(4046, 'CC', 1, {
      originalname: 'documento.pdf', mimetype: 'application/pdf', size: buffer.length, buffer,
    })

    expect(r).toEqual({ docId: 2700 })
    const ins = llamadas.find((l) => l.sql.startsWith('INSERT INTO DOCUMENTOSCAPJURIDICO'))
    expect(ins?.params).toContainEqual({ type: expect.anything(), val: buffer })
    expect(ins?.params).not.toContain(buffer)
  })
})
