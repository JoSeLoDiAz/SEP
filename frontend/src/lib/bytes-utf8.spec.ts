// el frontend no tiene jest: se corre con node --test sobre la salida de tsc (ver el resumen del cambio)
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bytesUtf8, limitarEdicionBytes, recortarBytesUtf8 } from './bytes-utf8'

describe('bytesUtf8', () => {
  it('las tildes y la ñ cuentan 2 y un emoji 4', () => {
    assert.equal(bytesUtf8(''), 0)
    assert.equal(bytesUtf8('abc'), 3)
    assert.equal(bytesUtf8('ñ'), 2)
    assert.equal(bytesUtf8('Encuesta técnica'), 17)
    assert.equal(bytesUtf8('😀'), 4)
  })
})

describe('recortarBytesUtf8', () => {
  it('deja igual lo que cabe', () => {
    const t = 'a'.repeat(38) + 'é'
    assert.equal(recortarBytesUtf8(t, 40), t)
    assert.equal(recortarBytesUtf8('', 40), '')
  })

  it('corta por bytes, no por letras', () => {
    assert.equal(recortarBytesUtf8('á'.repeat(25), 40), 'á'.repeat(20))
  })

  it('una tilde que no cabe entera se queda por fuera', () => {
    assert.equal(recortarBytesUtf8('a'.repeat(39) + 'é', 40), 'a'.repeat(39))
  })

  it('no parte un emoji', () => {
    const r = recortarBytesUtf8('a'.repeat(38) + '😀', 40)
    assert.equal(r, 'a'.repeat(38))
    assert.ok(bytesUtf8(r) <= 40)
  })

  it('lo recortado nunca pasa del máximo', () => {
    const t = 'Diagnóstico de campaña 😀 con ñandú y más señales'
    for (let max = 0; max <= bytesUtf8(t); max++) {
      const r = recortarBytesUtf8(t, max)
      assert.ok(bytesUtf8(r) <= max)
      assert.ok(t.startsWith(r))
      // lo que falta no cabría ni con un carácter más
      const siguiente = [...t.slice(r.length)][0]
      if (siguiente) assert.ok(bytesUtf8(r + siguiente) > max)
    }
  })
})

describe('limitarEdicionBytes', () => {
  const MAX = 40
  // comparten mitades UTF-16: 😀 = D83D DE00, 😃 = D83D DE03, 🈀 = D83C DE00
  const SONRISA = '\u{1F600}'
  const RISA = '\u{1F603}'
  const HOKA = '\u{1F200}'

  it('lo que cabe pasa tal cual', () => {
    assert.deepEqual(limitarEdicionBytes('abc', 'abcd', 4, MAX), { valor: 'abcd', cursor: 4, recortado: false })
    const casi = 'a'.repeat(38)
    assert.deepEqual(limitarEdicionBytes(casi, casi + 'ñ', 39, MAX), { valor: casi + 'ñ', cursor: 39, recortado: false })
  })

  it('un valor que ya pasaba del máximo no crece con una tecla', () => {
    // el XE admite 100 bytes y tiene filas de 98
    const largo = 'x'.repeat(98)
    assert.deepEqual(limitarEdicionBytes(largo, largo + 'a', 99, MAX), { valor: largo, cursor: 98, recortado: true })
    // ni cambiando una letra por una ñ, que ocupa uno más
    assert.deepEqual(
      limitarEdicionBytes(largo, 'x'.repeat(50) + 'ñ' + 'x'.repeat(47), 51, MAX),
      { valor: largo, cursor: 50, recortado: true },
    )
  })

  it('un valor que ya pasaba del máximo sí se deja acortar', () => {
    const largo = 'x'.repeat(98)
    const corto = 'x'.repeat(97)
    assert.deepEqual(limitarEdicionBytes(largo, corto, 97, MAX), { valor: corto, cursor: 97, recortado: false })
  })

  it('con el campo lleno, una letra en medio se descarta y el final queda entero', () => {
    const lleno = 'a'.repeat(20) + 'b'.repeat(20)
    assert.deepEqual(
      limitarEdicionBytes(lleno, 'a'.repeat(20) + 'X' + 'b'.repeat(20), 21, MAX),
      { valor: lleno, cursor: 20, recortado: true },
    )
  })

  it('lo pegado en medio se recorta, no la cola', () => {
    const cabeza = 'inicio '
    const cola = ' final'
    const pegado = 'z'.repeat(40)
    assert.deepEqual(
      limitarEdicionBytes(cabeza + cola, cabeza + pegado + cola, cabeza.length + pegado.length, MAX),
      { valor: cabeza + 'z'.repeat(27) + cola, cursor: cabeza.length + 27, recortado: true },
    )
  })

  it('pegar sobre una selección la reemplaza con lo que quepa', () => {
    // se selecciona "cd" en un texto de 36 bytes
    const anterior = 'ab' + 'cd' + 'g'.repeat(32)
    const nuevo = 'ab' + 'Z'.repeat(10) + 'g'.repeat(32)
    assert.deepEqual(
      limitarEdicionBytes(anterior, nuevo, 12, MAX),
      { valor: 'ab' + 'Z'.repeat(6) + 'g'.repeat(32), cursor: 8, recortado: true },
    )
  })

  it('una ñ no entra en el último byte libre', () => {
    const anterior = 'a'.repeat(39)
    assert.deepEqual(limitarEdicionBytes(anterior, anterior + 'ñ', 40, MAX), { valor: anterior, cursor: 39, recortado: true })
  })

  it('no parte un emoji', () => {
    const anterior = 'a'.repeat(37)
    assert.deepEqual(
      limitarEdicionBytes(anterior, anterior + 'b' + SONRISA + 'c', 41, MAX),
      { valor: anterior + 'b', cursor: 38, recortado: true },
    )
  })

  it('cambiar un emoji por dos: el tramo no empieza en la mitad del primero', () => {
    const anterior = 'a'.repeat(34) + SONRISA
    const nuevo = 'a'.repeat(34) + RISA + RISA
    const esperado = { valor: 'a'.repeat(34) + RISA, cursor: 36, recortado: true }
    assert.deepEqual(limitarEdicionBytes(anterior, nuevo, 38, MAX), esperado)
    assert.deepEqual(limitarEdicionBytes(anterior, nuevo, null, MAX), esperado)
  })

  it('sin cursor, lo común al final tampoco parte un emoji', () => {
    const anterior = 'a'.repeat(34) + SONRISA
    assert.deepEqual(
      limitarEdicionBytes(anterior, 'a'.repeat(34) + 'bcd' + HOKA, null, MAX),
      { valor: 'a'.repeat(34) + 'bcd', cursor: 37, recortado: true },
    )
  })

  it('con el cursor se sabe dónde se escribió aunque el texto se repita', () => {
    // "ab" pegado al final de "ab": sin el cursor no se distingue de pegarlo al principio
    assert.equal(limitarEdicionBytes('ab', 'abab', 4, 3).valor, 'aba')
    assert.ok(bytesUtf8(limitarEdicionBytes('ab', 'abab', null, 3).valor) <= 3)
  })

  it('un cursor que no cuadra con el texto se ignora', () => {
    const anterior = 'a'.repeat(39)
    assert.deepEqual(
      limitarEdicionBytes(anterior, anterior + 'bc', 0, MAX),
      { valor: anterior + 'b', cursor: 40, recortado: true },
    )
  })

  it('lo que queda nunca pasa del máximo ni toca lo que había fuera de la selección', () => {
    const piezas = ['a', 'Z', ' ', 'ñ', 'é', SONRISA, RISA, HOKA]
    let semilla = 20260911
    const azar = (n: number) => { semilla = (semilla * 48271) % 2147483647; return semilla % n }
    const texto = (largo: number) => Array.from({ length: largo }, () => piezas[azar(piezas.length)]).join('')
    for (let vuelta = 0; vuelta < 2000; vuelta++) {
      const anterior = recortarBytesUtf8(texto(azar(30)), MAX)
      const letras = [...anterior]
      const desde = azar(letras.length + 1)
      const hasta = desde + azar(letras.length - desde + 1)
      const cabeza = letras.slice(0, desde).join('')
      const cola = letras.slice(hasta).join('')
      const pegado = texto(1 + azar(20))
      const nuevo = cabeza + pegado + cola
      const r = limitarEdicionBytes(anterior, nuevo, cabeza.length + pegado.length, MAX)
      assert.ok(bytesUtf8(r.valor) <= MAX)
      assert.ok(r.valor.startsWith(cabeza) && r.valor.endsWith(cola))
      const puesto = r.valor.slice(cabeza.length, r.valor.length - cola.length)
      assert.ok(pegado.startsWith(puesto))
      assert.equal(r.cursor, cabeza.length + puesto.length)
      // sin cursor tampoco pasa del máximo
      assert.ok(bytesUtf8(limitarEdicionBytes(anterior, nuevo, null, MAX).valor) <= MAX)
    }
  })
})
