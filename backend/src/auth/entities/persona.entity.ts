import { Column, Entity, PrimaryColumn } from 'typeorm'
import { NUMERO, TEXTO_FIJO, FECHA, nombreEnBase } from '../../common/db/tipos-entidad'

@Entity(nombreEnBase('PERSONA'))
export class Persona {
  @PrimaryColumn({ name: nombreEnBase('PERSONAID'), type: NUMERO })
  personaId: number

  @Column({ name: nombreEnBase('TIPODOCUMENTOIDENTIDADID'), type: NUMERO })
  tipoDocumentoIdentidadId: number

  @Column({ name: nombreEnBase('PERSONAIDENTIFICACION'), type: NUMERO })
  personaIdentificacion: number

  @Column({ name: nombreEnBase('PERSONANOMBRES'), type: TEXTO_FIJO, length: 200 })
  personaNombres: string

  @Column({ name: nombreEnBase('PERSONAPRIMERAPELLIDO'), type: TEXTO_FIJO, length: 100 })
  personaPrimerApellido: string

  @Column({ name: nombreEnBase('PERSONASEGUNDOAPELLIDO'), type: TEXTO_FIJO, length: 100, nullable: true })
  personaSegundoApellido: string

  @Column({ name: nombreEnBase('PERSONAEMAIL'), length: 200, nullable: true })
  personaEmail: string

  @Column({ name: nombreEnBase('PERSONAFECHAREGISTRO'), type: FECHA, nullable: true })
  personaFechaRegistro: Date

  @Column({ name: nombreEnBase('GENEROID'), type: NUMERO, nullable: true })
  generoId: number

  @Column({ name: nombreEnBase('CIUDADID'), type: NUMERO, nullable: true })
  ciudadId: number

  @Column({ name: nombreEnBase('PERSONAHABEASDATA'), length: 10, nullable: true })
  personaHabeasData: string

  @Column({ name: nombreEnBase('PERSONAHABEASDATAE'), length: 10, nullable: true })
  personaHabeasDataE: string
}
