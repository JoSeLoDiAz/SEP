import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class PatchSesionVirtualDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  nombreActividad?: string

  @ApiPropertyOptional({ example: '2025-12-02' })
  @IsOptional() @IsDateString()
  fechaInicio?: string

  @ApiPropertyOptional({ example: '2025-12-03' })
  @IsOptional() @IsDateString()
  fechaFin?: string

  @ApiPropertyOptional({ example: 16 })
  @IsOptional() @IsNumber() @Min(0.5) @Max(999)
  horas?: number

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  plataforma?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(300)
  url?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  usuarioSena?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  claveSena?: string

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
