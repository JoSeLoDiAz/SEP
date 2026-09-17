import { Column, Entity, PrimaryColumn } from 'typeorm'
import { NUMERO, nombreEnBase } from '../../common/db/tipos-entidad'

@Entity(nombreEnBase('TIPODOCUMENTOIDENTIDAD'))
export class TipoDocumentoIdentidad {
  @PrimaryColumn({ name: nombreEnBase('TIPODOCUMENTOIDENTIDADID'), type: NUMERO })
  id: number

  @Column({ name: nombreEnBase('TIPODOCUMENTOIDENTIDADNOMBRE'), length: 200 })
  nombre: string

  @Column({ name: nombreEnBase('TIPODOCUMENTOIDENTIDADPERSONA'), type: NUMERO, default: 0 })
  persona: number

  @Column({ name: nombreEnBase('TIPODOCUMENTOIDENTIDADEMPRESA'), type: NUMERO, default: 0 })
  empresa: number
}
