import * as crypto from 'crypto'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { twofish } = require('twofish')

/**
 * Cifrado de las claves de USUARIO — heredado de GeneXus.
 *
 * Cada usuario guarda su propia llave en `USUARIO.USUARIOLLAVEENCRIPTACION`
 * y la clave cifrada con Twofish en `USUARIO.USUARIOCLAVE`. No es un hash:
 * es cifrado reversible, que es como lo dejó el sistema original y no se
 * puede cambiar sin migrar todas las cuentas a la vez.
 *
 * Vive aquí porque lo necesitan varios módulos (usuarios-admin, evaluadores)
 * y una copia divergente rompería el login de las cuentas creadas por el
 * módulo desalineado — un fallo que no se nota hasta que alguien intenta
 * entrar.
 */

/** Llave nueva por usuario. Se guarda junto a la clave cifrada. */
export function generarLlaveEncriptacion(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase()
}

/** Cifra la clave con la llave del usuario. Rellena a 16 bytes con espacios. */
export function cifrarClave(clavePlana: string, llave: string): string {
  const tf = twofish(new Array(16).fill(0))
  const keyArr = Array.from(Buffer.from(llave, 'hex')) as number[]
  const padded = Array.from(Buffer.from(clavePlana, 'utf8')) as number[]
  while (padded.length < 16) padded.push(0x20)
  return Buffer.from(tf.encrypt(keyArr, padded)).toString('base64')
}

/**
 * Clave inicial legible para cuentas que crea un gestor.
 *
 * Sin caracteres ambiguos (O/0, l/1/I) porque estas claves se dictan por
 * teléfono o se copian de un correo, y una confusión ahí termina en un
 * "no me deja entrar" que cuesta más que la contraseña.
 */
export function generarClaveInicial(longitud = 10): string {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(longitud)
  let clave = ''
  for (let i = 0; i < longitud; i++) clave += alfabeto[bytes[i] % alfabeto.length]
  return clave
}
