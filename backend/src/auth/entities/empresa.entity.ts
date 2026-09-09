import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('EMPRESA')
export class Empresa {
  @PrimaryColumn({ name: 'EMPRESAID', type: 'number' })
  empresaId: number

  @Column({ name: 'TIPODOCUMENTOIDENTIDADID', type: 'number' })
  tipoDocumentoIdentidadId: number

  @Column({ name: 'EMPRESAIDENTIFICACION', type: 'number' })
  empresaIdentificacion: number

  @Column({ name: 'EMPRESADIGITOVERIFICACION', type: 'number', default: 0 })
  empresaDigitoVerificacion: number

  @Column({ name: 'EMPRESARAZONSOCIAL', type: 'nchar', length: 300 })
  empresaRazonSocial: string

  @Column({ name: 'EMPRESASIGLA', type: 'nchar', length: 100 })
  empresaSigla: string

  @Column({ name: 'EMPRESAEMAIL', length: 200, nullable: true })
  empresaEmail: string

  @Column({ name: 'EMPRESAFECHAREGISTRO', type: 'date' })
  empresaFechaRegistro: Date

  @Column({ name: 'COBERTURAEMPRESAID', type: 'number', nullable: true })
  coberturaEmpresaId: number

  @Column({ name: 'DEPARTAMENTOEMPRESAID', type: 'number', nullable: true })
  departamentoEmpresaId: number

  @Column({ name: 'CIUDADEMPRESAID', type: 'number', nullable: true })
  ciudadEmpresaId: number

  @Column({ name: 'CIIUID', type: 'number', nullable: true })
  ciiuId: number

  @Column({ name: 'TIPOEMPRESAID', type: 'number', nullable: true })
  tipoEmpresaId: number

  @Column({ name: 'TAMANOEMPRESAID', type: 'number', nullable: true })
  tamanoEmpresaId: number

  @Column({ name: 'SECTORID', type: 'number', nullable: true })
  sectorId: number

  @Column({ name: 'SUBSECTORID', type: 'number', nullable: true })
  subSectorId: number

  @Column({ name: 'TIPOIDENTIFICACIONREP', type: 'number', nullable: true })
  tipoIdentificacionRep: number

  // ── Ubicación ─────────────────────────────────────────────────────────────

  @Column({ name: 'EMPRESADIRECCION', length: 300, nullable: true })
  empresaDireccion: string

  @Column({ name: 'EMPRESATELEFONO', length: 50, nullable: true })
  empresaTelefono: string

  @Column({ name: 'EMPRESACELULAR', length: 50, nullable: true })
  empresaCelular: string

  @Column({ name: 'EMPRESAINDICATIVO', type: 'number', nullable: true })
  empresaIndicativo: number

  @Column({ name: 'EMPRESAWEBSITE', length: 200, nullable: true })
  empresaWebsite: string

  // ── Económicos ────────────────────────────────────────────────────────────

  @Column({ name: 'EMPRESACERTIFCOMP', length: 10, nullable: true })
  empresaCertifComp: string

  @Column({ name: 'EMPRESAEXPERTTECN', length: 10, nullable: true })
  empresaExpertTecn: string

  @Column({ name: 'EMPRESAEXPORTADORA', length: 10, nullable: true })
  empresaExportadora: string

  // ── Representante legal ───────────────────────────────────────────────────

  @Column({ name: 'EMPRESAREPDOCUMENTO', length: 50, nullable: true })
  empresaRepDocumento: string

  @Column({ name: 'EMPRESAREP', length: 200, nullable: true })
  empresaRep: string

  @Column({ name: 'EMPRESAREPCARGO', length: 100, nullable: true })
  empresaRepCargo: string

  @Column({ name: 'EMPRESAREPCORREO', length: 200, nullable: true })
  empresaRepCorreo: string

  @Column({ name: 'EMPRESAREPTEL', length: 50, nullable: true })
  empresaRepTel: string
}
