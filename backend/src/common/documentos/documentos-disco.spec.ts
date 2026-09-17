import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  buscarDocumento,
  documentosEnDisco,
  fijarDocumentosEnDisco,
  leerDocumento,
  reiniciarDocumentosEnDisco,
} from './documentos-disco'

// datos inventados: nunca documentos ni nombres reales en un fixture

let raiz: string

function crear(rel: string, contenido: string): void {
  const p = path.join(raiz, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, contenido)
}

beforeEach(() => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-sep-'))
  crear('evaluadordocumento/archivopdf/771.pdf', 'pdf de mentira')
  crear('evaluador/evaluadorfoto/12.png', 'png de mentira')
  crear('documentospersonas/documentospersonasdoc/5.docx', 'docx de mentira')
  crear('evaluadorestudio/archivopdf/9.pdf', '') // vacío: no cuenta como documento
})

afterEach(() => {
  reiniciarDocumentosEnDisco()
  fs.rmSync(raiz, { recursive: true, force: true })
})

describe('el interruptor', () => {
  it('nace apagado: sin encenderlo no se lee nada de disco', () => {
    expect(documentosEnDisco()).toBe(false)
    expect(buscarDocumento('evaluadordocumento', 'archivopdf', 771)).toBeNull()
  })

  it('encendido sin ruta sigue apagado', () => {
    expect(fijarDocumentosEnDisco('1', undefined)).toBeNull()
    expect(documentosEnDisco()).toBe(false)
  })

  it('con ruta pero sin encender, sigue apagado', () => {
    expect(fijarDocumentosEnDisco(undefined, raiz)).toBeNull()
    expect(documentosEnDisco()).toBe(false)
  })

  it('acepta las formas de decir que sí', () => {
    for (const v of ['1', 'true', 'si', 'SÍ', ' True ']) {
      reiniciarDocumentosEnDisco()
      expect(fijarDocumentosEnDisco(v, raiz)).toBe(raiz)
    }
  })
})

describe('buscar el archivo cuando la extensión no está en la base', () => {
  beforeEach(() => fijarDocumentosEnDisco('1', raiz))

  it('lo encuentra probando extensiones', () => {
    expect(buscarDocumento('evaluadordocumento', 'archivopdf', 771)?.extension).toBe('pdf')
    expect(buscarDocumento('evaluador', 'evaluadorfoto', 12)?.extension).toBe('png')
    expect(buscarDocumento('documentospersonas', 'documentospersonasdoc', 5)?.extension).toBe('docx')
  })

  it('devuelve la ruta y el tamaño', () => {
    const a = buscarDocumento('evaluadordocumento', 'archivopdf', 771)
    expect(a?.bytes).toBe('pdf de mentira'.length)
    expect(a?.ruta.endsWith(path.join('evaluadordocumento', 'archivopdf', '771.pdf'))).toBe(true)
  })

  it('un archivo vacío no es un documento', () => {
    expect(buscarDocumento('evaluadorestudio', 'archivopdf', 9)).toBeNull()
  })

  it('devuelve null si no está, para que quien llama vuelva al BLOB', () => {
    expect(buscarDocumento('evaluadordocumento', 'archivopdf', 99999)).toBeNull()
    expect(buscarDocumento('tablaquenoexiste', 'archivopdf', 1)).toBeNull()
  })

  it('el id da igual si llega como número o como texto', () => {
    expect(buscarDocumento('evaluador', 'evaluadorfoto', '12')?.extension).toBe('png')
  })
})

describe('no se puede salir del directorio', () => {
  beforeEach(() => {
    fijarDocumentosEnDisco('1', raiz)
    fs.writeFileSync(path.join(raiz, 'secreto.pdf'), 'no se debe leer')
  })

  it('rechaza un id que no sea un entero', () => {
    for (const id of ['../../secreto', '1/../../secreto', '..', '1;rm', '']) {
      expect(buscarDocumento('evaluadordocumento', 'archivopdf', id)).toBeNull()
    }
  })

  it('rechaza nombres de tabla o columna con rutas', () => {
    expect(buscarDocumento('../..', 'archivopdf', 1)).toBeNull()
    expect(buscarDocumento('evaluadordocumento', '../../secreto', 1)).toBeNull()
  })
})

describe('leerDocumento', () => {
  it('devuelve el contenido cuando el interruptor está encendido', () => {
    fijarDocumentosEnDisco('1', raiz)
    expect(leerDocumento('evaluadordocumento', 'archivopdf', 771)?.toString()).toBe('pdf de mentira')
  })

  it('devuelve null con el interruptor apagado, aunque el archivo exista', () => {
    expect(leerDocumento('evaluadordocumento', 'archivopdf', 771)).toBeNull()
  })
})
