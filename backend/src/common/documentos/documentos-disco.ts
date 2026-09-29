/**
 * Documentos leídos del sistema de archivos en vez de como BLOB de la base.
 *
 * Apagado por defecto: sin `DOCUMENTOS_EN_DISCO`, nada cambia y la app sigue leyendo el BLOB igual que hoy. Se
 * enciende cuando el volumen de almacenamiento esté montado, y si un archivo no aparece, quien llama vuelve al BLOB:
 * encender esto nunca deja a un usuario sin su documento.
 *
 * Por qué existe: los documentos son el 95 % del peso de la base y no se consultan por contenido. Dentro engordan
 * los respaldos y vuelven lentas las búsquedas; fuera, el almacenamiento crece aparte y se amplía sin tocar la base.
 * Infraestructura pidió un volumen propio, con la RUTA RELATIVA en la app, que es justo lo que se guarda aquí.
 *
 * La ruta es `<raíz>/<tabla>/<columna>/<id>.<extensión>`, donde `<id>` es la llave primaria de la fila. La raíz vive
 * en la configuración: mover los archivos al volumen definitivo es cambiar una variable, sin tocar un solo dato.
 *
 * LA EXTENSIÓN NO ESTÁ EN LA BASE. Salió de los bytes de cabecera del archivo al extraerlo, porque 28.186 de 28.395
 * documentos no traían una extensión utilizable en su nombre. Así que el archivo no se construye: se busca, probando
 * las extensiones que de verdad produjo la extracción. Listar el directorio en cada petición no es opción: en
 * `documentospersonas` hay 28.394 archivos en una sola carpeta.
 *
 * El nombre original y el tipo siguen en la base, que es de donde la app los lee para ofrecer la descarga.
 */
import * as fs from 'fs'
import * as path from 'path'

/** Las extensiones que produjo la extracción, de la más frecuente a la más rara. */
const EXTENSIONES = ['pdf', 'png', 'jpg', 'doc', 'docx', 'xlsx', 'eml', 'zip', 'gif', 'rtf', 'pptx', 'xml', 'bin']

/** Nombre de tabla o columna: minúsculas, sin nada que pueda salirse del directorio. */
const NOMBRE = /^[a-z][a-z0-9_$#]*$/

export interface ArchivoEnDisco {
  ruta: string
  bytes: number
  extension: string
}

let raiz: string | null = null

/**
 * Lo llama el arranque. Sin `activo` o sin ruta, queda apagado y `documentosEnDisco()` devuelve false.
 * Devuelve la raíz que quedó fijada, o null, para que el arranque pueda decirlo por consola.
 */
export function fijarDocumentosEnDisco(activo: string | undefined, rutaBase: string | undefined): string | null {
  const encendido = ['1', 'true', 'si', 'sí'].includes(String(activo ?? '').trim().toLowerCase())
  const base = String(rutaBase ?? '').trim()
  raiz = encendido && base ? base : null
  return raiz
}

export function documentosEnDisco(): boolean {
  return raiz !== null
}

/** Solo para pruebas. */
export function reiniciarDocumentosEnDisco(): void {
  raiz = null
}

/**
 * Busca el archivo de una fila. Devuelve null si está apagado, si los nombres no son válidos, si no hay archivo o
 * si el que hay está vacío. Nunca lanza: quien llama debe poder seguir con el BLOB.
 */
export function buscarDocumento(tabla: string, columna: string, id: number | string): ArchivoEnDisco | null {
  if (raiz === null) return null
  const t = String(tabla).toLowerCase()
  const c = String(columna).toLowerCase()
  const n = String(id)
  // el id solo puede ser un entero: cierra cualquier intento de salirse del directorio con '..' o barras
  if (!NOMBRE.test(t) || !NOMBRE.test(c) || !/^\d+$/.test(n)) return null

  const carpeta = path.join(raiz, t, c)
  for (const ext of EXTENSIONES) {
    const ruta = path.join(carpeta, `${n}.${ext}`)
    try {
      const st = fs.statSync(ruta)
      // un archivo de 0 bytes no es un documento, igual que el marcador de un byte no lo era en la base
      if (st.isFile() && st.size > 0) return { ruta, bytes: st.size, extension: ext }
    } catch {
      // no existe con esa extensión: se prueba la siguiente
    }
  }
  return null
}

/** El contenido del archivo, o null si no hay. Para archivos grandes conviene usar `buscarDocumento` y transmitir. */
export function leerDocumento(tabla: string, columna: string, id: number | string): Buffer | null {
  const a = buscarDocumento(tabla, columna, id)
  if (!a) return null
  try {
    return fs.readFileSync(a.ruta)
  } catch {
    return null
  }
}
