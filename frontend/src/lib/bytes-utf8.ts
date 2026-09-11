// Oracle mide las columnas VARCHAR2(n BYTE) en bytes del juego de caracteres de la base (AL32UTF8 en el XE y en el
// Exadata): una letra con tilde o una ñ ocupan 2, un emoji 4. Un maxLength del navegador cuenta otra cosa.

const codificador = new TextEncoder()

export function bytesUtf8(texto: string): number {
  return codificador.encode(texto).length
}

/** El comienzo del texto que cabe en `max` bytes, sin partir ningún carácter. */
export function recortarBytesUtf8(texto: string, max: number): string {
  if (bytesUtf8(texto) <= max) return texto
  let usados = 0
  let fin = 0
  // for...of recorre puntos de código: un emoji (dos unidades UTF-16) entra entero o no entra
  for (const caracter of texto) {
    const b = bytesUtf8(caracter)
    if (usados + b > max) break
    usados += b
    fin += caracter.length
  }
  return texto.slice(0, fin)
}

function esMitadAlta(unidad: number): boolean {
  return unidad >= 0xd800 && unidad <= 0xdbff
}

function esMitadBaja(unidad: number): boolean {
  return unidad >= 0xdc00 && unidad <= 0xdfff
}

// dónde quedó lo que se escribió o pegó: [inicio, fin) dentro de `nuevo`; lo de antes y lo de después ya estaba en
// `anterior`. El cursor dice dónde acaba (en "ab" → "abab" no hay otra forma de saberlo); sin él, lo común al final
function tramoEditado(anterior: string, nuevo: string, cursor: number | null): { inicio: number; fin: number } {
  let fin: number
  if (cursor !== null && Number.isInteger(cursor) && cursor >= 0 && cursor <= nuevo.length
      && anterior.endsWith(nuevo.slice(cursor))) {
    fin = cursor
  } else {
    const tope = Math.min(anterior.length, nuevo.length)
    let comun = 0
    while (comun < tope && anterior[anterior.length - 1 - comun] === nuevo[nuevo.length - 1 - comun]) comun++
    fin = nuevo.length - comun
  }
  // un emoji son dos unidades UTF-16: el tramo no empieza ni acaba en la mitad de uno
  if (fin < nuevo.length && esMitadBaja(nuevo.charCodeAt(fin))) fin++
  const tope = Math.min(fin, anterior.length - (nuevo.length - fin))
  let inicio = 0
  while (inicio < tope && anterior[inicio] === nuevo[inicio]) inicio++
  if (inicio > 0 && esMitadAlta(nuevo.charCodeAt(inicio - 1))) inicio--
  return { inicio, fin }
}

/**
 * Lo que queda de un cambio del usuario en un campo de `max` bytes, como haría un maxLength que contara bytes: si no
 * cabe, se recorta solo lo que se escribió o pegó (el resto del texto no se toca), y un valor que ya pasaba del
 * máximo (lo guardó una base que admitía más) no se deja crecer, solo acortar. `cursor` es el selectionStart del campo
 * después del cambio, o null si no se conoce; se devuelve dónde dejarlo.
 */
export function limitarEdicionBytes(
  anterior: string,
  nuevo: string,
  cursor: number | null,
  max: number,
): { valor: string; cursor: number; recortado: boolean } {
  const bytesNuevo = bytesUtf8(nuevo)
  const bytesAnterior = bytesUtf8(anterior)
  if (bytesNuevo <= max || bytesNuevo <= bytesAnterior) {
    return { valor: nuevo, cursor: cursor ?? nuevo.length, recortado: false }
  }
  const { inicio, fin } = tramoEditado(anterior, nuevo, cursor)
  if (bytesAnterior > max) return { valor: anterior, cursor: inicio, recortado: true }
  // lo de antes y lo de después son trozos de `anterior`, que cabía: siempre queda sitio para 0 o más bytes
  const antes = nuevo.slice(0, inicio)
  const despues = nuevo.slice(fin)
  const cabe = recortarBytesUtf8(nuevo.slice(inicio, fin), max - bytesUtf8(antes) - bytesUtf8(despues))
  return { valor: antes + cabe + despues, cursor: inicio + cabe.length, recortado: true }
}
