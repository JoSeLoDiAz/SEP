import { ApiProperty } from '@nestjs/swagger'
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator'

export class RegistrarEmpresaDto {
  @ApiProperty({ example: 6, description: 'ID tipo documento (6=NIT)' })
  @IsNumber()
  tipoDocumentoIdentidadId: number

  @ApiProperty({ example: 900123456 })
  @IsNumber()
  @Min(1, { message: 'El número de identificación debe ser mayor a 0.' })
  @Max(9_999_999_999, { message: 'El número de identificación no puede tener más de 10 dígitos.' })
  empresaIdentificacion: number

  @ApiProperty({ example: 7, description: 'Dígito de verificación del NIT' })
  @IsNumber()
  @Min(0)
  @Max(9, { message: 'El dígito de verificación debe estar entre 0 y 9.' })
  empresaDigitoVerificacion: number

  @ApiProperty({ example: 'EMPRESA EJEMPLO S.A.S.' })
  @IsString()
  @IsNotEmpty()
  empresaRazonSocial: string

  @ApiProperty({ example: 'EE SAS' })
  @IsString()
  @IsNotEmpty()
  empresaSigla: string

  @ApiProperty({ example: 'empresa@ejemplo.com' })
  @IsEmail()
  usuarioEmail: string

  @ApiProperty({ example: 'Clave2024*' })
  @IsString()
  @IsNotEmpty()
  usuarioClave: string

  @ApiProperty({ example: true })
  @IsBoolean()
  habeasData: boolean
}
