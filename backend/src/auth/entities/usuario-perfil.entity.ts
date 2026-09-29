import { Column, Entity, PrimaryColumn } from 'typeorm'
import { NUMERO, FECHA, nombreEnBase } from '../../common/db/tipos-entidad'

@Entity(nombreEnBase('USUARIOPERFIL'))
export class UsuarioPerfil {
  @PrimaryColumn({ name: nombreEnBase('USUARIOPERFILID'), type: NUMERO })
  usuarioPerfilId: number

  @Column({ name: nombreEnBase('USUARIOID'), type: NUMERO })
  usuarioId: number

  @Column({ name: nombreEnBase('PERFILID'), type: NUMERO })
  perfilId: number

  @Column({ name: nombreEnBase('PREDETERMINADO'), type: NUMERO, default: 0 })
  predeterminado: number

  @Column({ name: nombreEnBase('ESTADO'), type: NUMERO, default: 1 })
  estado: number

  @Column({ name: nombreEnBase('FECHAULTIMOACCESO'), type: 'timestamp', nullable: true })
  fechaUltimoAcceso: Date | null

  @Column({ name: nombreEnBase('FECHACREACION'), type: 'timestamp' })
  fechaCreacion: Date
}
