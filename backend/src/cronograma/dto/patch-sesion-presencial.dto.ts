import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator'

export class PatchSesionPresencialDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  nombreSesion?: string

  @ApiPropertyOptional({ example: '2025-11-24' })
  @IsOptional() @IsDateString()
  fechaInicio?: string

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional() @Matches(/^\d{2}:\d{2}$/)
  horaInicio?: string

  @ApiPropertyOptional({ example: '12:00' })
  @IsOptional() @Matches(/^\d{2}:\d{2}$/)
  horaFin?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  nombreSede?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(300)
  direccion?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(40)
  aula?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  herramienta?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(300)
  url?: string

  @ApiPropertyOptional({ example: 68322 })
  @IsOptional() @IsInt() @Min(1)
  coberturaId?: number

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0)
  capacitadorId?: number

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0)
  capSup1Id?: number

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0)
  capSup2Id?: number

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0)
  capSup3Id?: number

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0)
  capSup4Id?: number

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0)
  perfilUTId?: number

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0)
  perfilSup1Id?: number

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0)
  perfilSup2Id?: number

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0)
  perfilSup3Id?: number

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0)
  perfilSup4Id?: number
}
