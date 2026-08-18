import * as crypto from 'crypto'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { twofish } = require('twofish')

// twofish reversible, no hash: viene de GeneXus y cambiarlo obliga a migrar todas las cuentas

export function generarLlaveEncriptacion(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase()
}

export function cifrarClave(clavePlana: string, llave: string): string {
  const tf = twofish(new Array(16).fill(0))
  const keyArr = Array.from(Buffer.from(llave, 'hex')) as number[]
  const padded = Array.from(Buffer.from(clavePlana, 'utf8')) as number[]
  while (padded.length < 16) padded.push(0x20)
  return Buffer.from(tf.encrypt(keyArr, padded)).toString('base64')
}

// alfabeto sin O/0 ni l/1/I: estas claves se dictan por teléfono
export function generarClaveInicial(longitud = 10): string {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(longitud)
  let clave = ''
  for (let i = 0; i < longitud; i++) clave += alfabeto[bytes[i] % alfabeto.length]
  return clave
}
