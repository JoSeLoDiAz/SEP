import { BadRequestException } from '@nestjs/common'
import { nombreArchivoUtf8 } from '../common/text/nombre-archivo'

/** Lo que Multer entrega al `fileFilter`, con lo poco que se usa aquí. */
interface ArchivoEntrante {
  originalname: string
  mimetype: string
}
type Aceptar = (error: Error | null, aceptar: boolean) => void

/**
 * Filtro de subida con el nombre del archivo ya corregido.
 *
 * Multer decodifica el nombre como latin1 y guarda "CertificaciÃ³n" donde
 * debía decir "Certificación". Arreglarlo en el `fileFilter` sirve porque
 * Multer usa ESE MISMO objeto para almacenar: lo que se corrija aquí es lo
 * que llega a la base. Poniéndolo en un solo sitio, ninguna ruta de subida
 * se queda por fuera cuando se agregue la siguiente.
 *
 * @param permitir  Decide si el archivo entra. Recibe el nombre ya corregido.
 * @param mensaje   Qué decirle a quien subió algo que no se acepta.
 */
export function filtroArchivo(
  permitir: (archivo: ArchivoEntrante) => boolean,
  mensaje: string,
) {
  return (_req: unknown, archivo: ArchivoEntrante, cb: Aceptar) => {
    archivo.originalname = nombreArchivoUtf8(archivo.originalname)
    if (!permitir(archivo)) return cb(new BadRequestException(mensaje), false)
    cb(null, true)
  }
}

/** Filtro que no rechaza nada: solo corrige el nombre. */
export const filtroSoloNombre = filtroArchivo(() => true, '')
