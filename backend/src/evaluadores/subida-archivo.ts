import { BadRequestException } from '@nestjs/common'
import { nombreArchivoUtf8 } from '../common/text/nombre-archivo'

interface ArchivoEntrante {
  originalname: string
  mimetype: string
}
type Aceptar = (error: Error | null, aceptar: boolean) => void

// multer decodifica el nombre en latin1; corregirlo aquí basta porque usa este mismo objeto al almacenar
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

export const filtroSoloNombre = filtroArchivo(() => true, '')
