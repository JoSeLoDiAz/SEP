import { Column, Entity, PrimaryColumn } from 'typeorm'
import { NUMERO, TEXTO_FIJO, FECHA, nombreEnBase } from '../../common/db/tipos-entidad'

@Entity(nombreEnBase('EMPRESA'))
export class Empresa {
  @PrimaryColumn({ name: nombreEnBase('EMPRESAID'), type: NUMERO })
  empresaId: number

  @Column({ name: nombreEnBase('TIPODOCUMENTOIDENTIDADID'), type: NUMERO })
  tipoDocumentoIdentidadId: number

  @Column({ name: nombreEnBase('EMPRESAIDENTIFICACION'), type: NUMERO })
  empresaIdentificacion: number

  @Column({ name: nombreEnBase('EMPRESADIGITOVERIFICACION'), type: NUMERO, default: 0 })
  empresaDigitoVerificacion: number

  @Column({ name: nombreEnBase('EMPRESARAZONSOCIAL'), type: TEXTO_FIJO, length: 300 })
  empresaRazonSocial: string

  @Column({ name: nombreEnBase('EMPRESASIGLA'), type: TEXTO_FIJO, length: 100 })
  empresaSigla: string

  @Column({ name: nombreEnBase('EMPRESAEMAIL'), length: 200, nullable: true })
  empresaEmail: string

  @Column({ name: nombreEnBase('EMPRESAFECHAREGISTRO'), type: FECHA })
  empresaFechaRegistro: Date

  @Column({ name: nombreEnBase('COBERTURAEMPRESAID'), type: NUMERO, nullable: true })
  coberturaEmpresaId: number

  @Column({ name: nombreEnBase('DEPARTAMENTOEMPRESAID'), type: NUMERO, nullable: true })
  departamentoEmpresaId: number

  @Column({ name: nombreEnBase('CIUDADEMPRESAID'), type: NUMERO, nullable: true })
  ciudadEmpresaId: number

  @Column({ name: nombreEnBase('CIIUID'), type: NUMERO, nullable: true })
  ciiuId: number

  @Column({ name: nombreEnBase('TIPOEMPRESAID'), type: NUMERO, nullable: true })
  tipoEmpresaId: number

  @Column({ name: nombreEnBase('TAMANOEMPRESAID'), type: NUMERO, nullable: true })
  tamanoEmpresaId: number

  @Column({ name: nombreEnBase('SECTORID'), type: NUMERO, nullable: true })
  sectorId: number

  @Column({ name: nombreEnBase('SUBSECTORID'), type: NUMERO, nullable: true })
  subSectorId: number

  @Column({ name: nombreEnBase('TIPOIDENTIFICACIONREP'), type: NUMERO, nullable: true })
  tipoIdentificacionRep: number

  // ── Ubicación ─────────────────────────────────────────────────────────────

  @Column({ name: nombreEnBase('EMPRESADIRECCION'), length: 300, nullable: true })
  empresaDireccion: string

  @Column({ name: nombreEnBase('EMPRESATELEFONO'), length: 50, nullable: true })
  empresaTelefono: string

  @Column({ name: nombreEnBase('EMPRESACELULAR'), length: 50, nullable: true })
  empresaCelular: string

  @Column({ name: nombreEnBase('EMPRESAINDICATIVO'), type: NUMERO, nullable: true })
  empresaIndicativo: number

  @Column({ name: nombreEnBase('EMPRESAWEBSITE'), length: 200, nullable: true })
  empresaWebsite: string

  // ── Económicos ────────────────────────────────────────────────────────────

  @Column({ name: nombreEnBase('EMPRESACERTIFCOMP'), length: 10, nullable: true })
  empresaCertifComp: string

  @Column({ name: nombreEnBase('EMPRESAEXPERTTECN'), length: 10, nullable: true })
  empresaExpertTecn: string

  @Column({ name: nombreEnBase('EMPRESAEXPORTADORA'), length: 10, nullable: true })
  empresaExportadora: string

  // ── Representante legal ───────────────────────────────────────────────────

  @Column({ name: nombreEnBase('EMPRESAREPDOCUMENTO'), length: 50, nullable: true })
  empresaRepDocumento: string

  @Column({ name: nombreEnBase('EMPRESAREP'), length: 200, nullable: true })
  empresaRep: string

  @Column({ name: nombreEnBase('EMPRESAREPCARGO'), length: 100, nullable: true })
  empresaRepCargo: string

  @Column({ name: nombreEnBase('EMPRESAREPCORREO'), length: 200, nullable: true })
  empresaRepCorreo: string

  @Column({ name: nombreEnBase('EMPRESAREPTEL'), length: 50, nullable: true })
  empresaRepTel: string
}
