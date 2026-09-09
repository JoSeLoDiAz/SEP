import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('TIPODOCUMENTOIDENTIDAD')
export class TipoDocumentoIdentidad {
  @PrimaryColumn({ name: 'TIPODOCUMENTOIDENTIDADID', type: 'number' })
  id: number

  @Column({ name: 'TIPODOCUMENTOIDENTIDADNOMBRE', length: 200 })
  nombre: string

  @Column({ name: 'TIPODOCUMENTOIDENTIDADPERSONA', type: 'number', default: 0 })
  persona: number

  @Column({ name: 'TIPODOCUMENTOIDENTIDADEMPRESA', type: 'number', default: 0 })
  empresa: number
}
