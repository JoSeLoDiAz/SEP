import { Column, Entity, PrimaryColumn } from 'typeorm'
import { NUMERO, FECHA, nombreEnBase } from '../../common/db/tipos-entidad'

@Entity(nombreEnBase('USUARIO'))
export class Usuario {
  @PrimaryColumn({ name: nombreEnBase('USUARIOID'), type: NUMERO })
  usuarioId: number

  @Column({ name: nombreEnBase('USUARIOEMAIL'), length: 200 })
  usuarioEmail: string

  @Column({ name: nombreEnBase('USUARIOCLAVE'), length: 500 })
  usuarioClave: string

  @Column({ name: nombreEnBase('USUARIOLLAVEENCRIPTACION'), length: 200 })
  usuarioLlaveEncriptacion: string

  @Column({ name: nombreEnBase('USUARIOESTADO'), type: NUMERO, default: 1 })
  usuarioEstado: number

  @Column({ name: nombreEnBase('PERFILID'), type: NUMERO })
  perfilId: number

  @Column({ name: nombreEnBase('USUARIOTIPO'), type: NUMERO, nullable: true })
  usuarioTipo: number

  @Column({ name: nombreEnBase('USUARIOFECHAREGISTRO'), type: FECHA, nullable: true })
  usuarioFechaRegistro: Date
}
