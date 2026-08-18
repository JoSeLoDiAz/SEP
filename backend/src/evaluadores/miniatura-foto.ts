import { Jimp } from 'jimp'

// miniatura para las tarjetas del banco; la original se conserva para descarga y PDF
const LADO_MAYOR = 400
const CALIDAD = 82

export async function miniaturaDeFoto(original: Buffer): Promise<Buffer | null> {
  try {
    const img = await Jimp.read(original)

    if (img.width > LADO_MAYOR || img.height > LADO_MAYOR) {
      img.scaleToFit({ w: LADO_MAYOR, h: LADO_MAYOR })
    }

    // JPEG pinta lo transparente en negro: por eso va sobre lienzo blanco
    const lienzo = new Jimp({ width: img.width, height: img.height, color: 0xffffffff })
    lienzo.composite(img, 0, 0)

    const mini = await lienzo.getBuffer('image/jpeg', { quality: CALIDAD })

    // null = usar la original
    return mini.length < original.length ? mini : null
  } catch {
    return null
  }
}
