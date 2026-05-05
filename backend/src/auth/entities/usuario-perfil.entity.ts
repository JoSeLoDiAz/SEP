import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('USUARIOPERFIL')
export class UsuarioPerfil {
  @PrimaryColumn({ name: 'USUARIOPERFILID', type: 'number' })
  usuarioPerfilId: number

  @Column({ name: 'USUARIOID', type: 'number' })
  usuarioId: number

  @Column({ name: 'PERFILID', type: 'number' })
  perfilId: number

  @Column({ name: 'PREDETERMINADO', type: 'number', default: 0 })
  predeterminado: number

  @Column({ name: 'ESTADO', type: 'number', default: 1 })
  estado: number

  @Column({ name: 'FECHAULTIMOACCESO', type: 'timestamp', nullable: true })
  fechaUltimoAcceso: Date | null

  @Column({ name: 'FECHACREACION', type: 'timestamp' })
  fechaCreacion: Date
}
