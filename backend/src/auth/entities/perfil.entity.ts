import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('PERFIL')
export class Perfil {
  @PrimaryColumn({ name: 'PERFILID', type: 'number' })
  perfilId: number

  @Column({ name: 'PERFILNOMBRE', length: 200 })
  perfilNombre: string
}
