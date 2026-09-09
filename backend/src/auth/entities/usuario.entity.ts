import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('USUARIO')
export class Usuario {
  @PrimaryColumn({ name: 'USUARIOID', type: 'number' })
  usuarioId: number

  @Column({ name: 'USUARIOEMAIL', length: 200 })
  usuarioEmail: string

  @Column({ name: 'USUARIOCLAVE', length: 500 })
  usuarioClave: string

  @Column({ name: 'USUARIOLLAVEENCRIPTACION', length: 200 })
  usuarioLlaveEncriptacion: string

  @Column({ name: 'USUARIOESTADO', type: 'number', default: 1 })
  usuarioEstado: number

  @Column({ name: 'PERFILID', type: 'number' })
  perfilId: number

  @Column({ name: 'USUARIOTIPO', type: 'number', nullable: true })
  usuarioTipo: number

  @Column({ name: 'USUARIOFECHAREGISTRO', type: 'date', nullable: true })
  usuarioFechaRegistro: Date
}
