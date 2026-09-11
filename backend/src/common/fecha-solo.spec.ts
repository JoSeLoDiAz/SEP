import { BadRequestException } from '@nestjs/common'
import { fechaSolo } from './fecha-solo'

// lo que llega de un <input type="date"> y sale hacia Oracle

const partes = (d: Date | null) => d && [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours()]

describe('fechaSolo', () => {
  it('vacío o nulo es null', () => {
    expect(fechaSolo(null)).toBeNull()
    expect(fechaSolo(undefined)).toBeNull()
    expect(fechaSolo('')).toBeNull()
  })

  it('arma la fecha a medianoche local, sin correrse un día', () => {
    expect(partes(fechaSolo('2017-12-01'))).toEqual([2017, 12, 1, 0])
  })

  it('si trae hora detrás, toma solo la fecha', () => {
    expect(partes(fechaSolo('2012-07-13T22:03:11.000Z'))).toEqual([2012, 7, 13, 0])
  })

  it('lo que no es fecha sigue siendo null', () => {
    expect(fechaSolo('no es fecha')).toBeNull()
    expect(fechaSolo(new Date('no es fecha'))).toBeNull()
  })

  // así llegaron al XE las dos fechas de grado corruptas
  it.each(['20012-07-13', '20219-10-31', '+020012-07-13'])('rechaza el año de 5 cifras: %s', v => {
    expect(() => fechaSolo(v)).toThrow(BadRequestException)
  })

  it('rechaza el año de menos de 4 cifras, que new Date() volvería 19xx', () => {
    expect(() => fechaSolo('0012-07-13')).toThrow(BadRequestException)
  })

  it('rechaza un Date con el año desbordado', () => {
    expect(() => fechaSolo(new Date(20012, 6, 13))).toThrow(BadRequestException)
  })

  it('deja pasar los bordes del rango', () => {
    expect(partes(fechaSolo('1000-01-01'))).toEqual([1000, 1, 1, 0])
    expect(partes(fechaSolo('9999-12-31'))).toEqual([9999, 12, 31, 0])
  })
})
