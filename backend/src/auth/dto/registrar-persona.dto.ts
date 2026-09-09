import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

export class RegistrarPersonaDto {
  @ApiProperty({ example: 1, description: 'ID tipo documento (1=CC, 2=CE, 3=Pasaporte)' })
  @IsNumber()
  tipoDocumentoIdentidadId: number

  @ApiProperty({ example: 1234567890 })
  @IsNumber()
  @Min(1, { message: 'El número de identificación debe ser mayor a 0.' })
  @Max(9_999_999_999, { message: 'El número de identificación no puede tener más de 10 dígitos.' })
  personaIdentificacion: number

  @ApiProperty({ example: 'Juan Carlos' })
  @IsString()
  @IsNotEmpty()
  personaNombres: string

  @ApiProperty({ example: 'Gómez' })
  @IsString()
  @IsNotEmpty()
  personaPrimerApellido: string

  @ApiPropertyOptional({ example: 'Martínez' })
  @IsString()
  @IsOptional()
  personaSegundoApellido?: string

  @ApiProperty({ example: 'juan@ejemplo.com' })
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
