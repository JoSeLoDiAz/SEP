import { Column, Entity, PrimaryColumn } from 'typeorm'
import { NUMERO, nombreEnBase } from '../../common/db/tipos-entidad'

@Entity(nombreEnBase('PERFIL'))
export class Perfil {
  @PrimaryColumn({ name: nombreEnBase('PERFILID'), type: NUMERO })
  perfilId: number

  @Column({ name: nombreEnBase('PERFILNOMBRE'), length: 200 })
  perfilNombre: string
}
