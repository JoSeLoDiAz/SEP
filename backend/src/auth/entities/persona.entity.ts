import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('PERSONA')
export class Persona {
  @PrimaryColumn({ name: 'PERSONAID', type: 'number' })
  personaId: number

  @Column({ name: 'TIPODOCUMENTOIDENTIDADID', type: 'number' })
  tipoDocumentoIdentidadId: number

  @Column({ name: 'PERSONAIDENTIFICACION', type: 'number' })
  personaIdentificacion: number

  @Column({ name: 'PERSONANOMBRES', type: 'nchar', length: 200 })
  personaNombres: string

  @Column({ name: 'PERSONAPRIMERAPELLIDO', type: 'nchar', length: 100 })
  personaPrimerApellido: string

  @Column({ name: 'PERSONASEGUNDOAPELLIDO', type: 'nchar', length: 100, nullable: true })
  personaSegundoApellido: string

  @Column({ name: 'PERSONAEMAIL', length: 200, nullable: true })
  personaEmail: string

  @Column({ name: 'PERSONAFECHAREGISTRO', type: 'date', nullable: true })
  personaFechaRegistro: Date

  @Column({ name: 'GENEROID', type: 'number', nullable: true })
  generoId: number

  @Column({ name: 'CIUDADID', type: 'number', nullable: true })
  ciudadId: number

  @Column({ name: 'PERSONAHABEASDATA', length: 10, nullable: true })
  personaHabeasData: string

  @Column({ name: 'PERSONAHABEASDATAE', length: 10, nullable: true })
  personaHabeasDataE: string
}
