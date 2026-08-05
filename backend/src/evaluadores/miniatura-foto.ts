import { Jimp } from 'jimp'

/**
 * Achica la foto de un evaluador a un tamaño de pantalla.
 *
 * Las fotos que cargan son de 60 a 280 KB, y se muestran en tarjetas de unos
 * 100 píxeles. Mandar el archivo completo para eso desperdiciaba la espera de
 * quien abre el banco —más de 2 MB por página— y, peor, la más pesada se
 * cortaba a medio camino en redes que no van finas: la tarjeta quedaba con el
 * círculo de la inicial, como si la persona no tuviera foto.
 *
 * 400 píxeles alcanzan de sobra: el doble de lo que ocupa el retrato más
 * grande de la aplicación, para que se vea nítido en pantallas de alta
 * densidad. Sale en JPEG porque estas fotos son retratos —no hay transparencia
 * que perder— y en JPEG pesan una fracción de lo que pesan en PNG.
 *
 * La original no se toca: es la que se descarga y la que va en la ficha PDF,
 * que se imprime.
 */
const LADO_MAYOR = 400
const CALIDAD = 82

/** Miniatura JPEG de la imagen, o null si el contenido no se puede leer. */
export async function miniaturaDeFoto(original: Buffer): Promise<Buffer | null> {
  try {
    const img = await Jimp.read(original)

    // `scaleToFit` respeta la proporción y NO agranda: una foto que ya venga
    // pequeña se queda como está en vez de estirarse y verse borrosa.
    if (img.width > LADO_MAYOR || img.height > LADO_MAYOR) {
      img.scaleToFit({ w: LADO_MAYOR, h: LADO_MAYOR })
    }

    // Sobre blanco, no directamente a JPEG. El JPEG no guarda transparencia y
    // lo transparente le sale NEGRO — comprobado. A una foto de carné a la que
    // le quitaron el fondo le quedaría un manchón negro alrededor de la cara.
    const lienzo = new Jimp({ width: img.width, height: img.height, color: 0xffffffff })
    lienzo.composite(img, 0, 0)

    const mini = await lienzo.getBuffer('image/jpeg', { quality: CALIDAD })

    // Si la "miniatura" no salió más liviana —pasa con fotos ya pequeñas y muy
    // comprimidas— no vale la pena: se devuelve null y se sirve la original.
    return mini.length < original.length ? mini : null
  } catch {
    // Un archivo que Jimp no sabe leer no debe tumbar la pantalla: se sirve la
    // original, que es exactamente lo que pasaba antes de que esto existiera.
    return null
  }
}
