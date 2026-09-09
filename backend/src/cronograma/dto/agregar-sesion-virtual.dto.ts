import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString,
  Max, MaxLength, Min,
} from 'class-validator'

export class AgregarSesionVirtualDto {
  @ApiProperty({ example: 'EVALUACIÓN INICIAL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombreActividad: string

  @ApiProperty({ example: '2025-12-02', description: 'YYYY-MM-DD' })
  @IsDateString()
  fechaInicio: string

  @ApiProperty({ example: '2025-12-03', description: 'YYYY-MM-DD' })
  @IsDateString()
  fechaFin: string

  @ApiProperty({ example: 16, description: 'Horas totales de la actividad' })
  @IsNumber()
  @Min(0.5)
  @Max(999)
  horas: number

  @ApiProperty({ example: 'TECNOVERTICE' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  plataforma: string

  @ApiProperty({ example: 'https://plataforma.com/curso' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  url: string

  @ApiPropertyOptional({ example: 'auditor2025' })
  @IsOptional() @IsString() @MaxLength(100)
  usuarioSena?: string

  @ApiPropertyOptional({ example: 'auditor2025' })
  @IsOptional() @IsString() @MaxLength(100)
  claveSena?: string

  @ApiProperty({ example: 6358 })
  @IsInt() @Min(1)
  capacitadorId: number

  @ApiProperty({ example: 14032 })
  @IsInt() @Min(1)
  perfilUTId: number

  // 3 = Híbrida, 4 = Virtual
  @ApiProperty({ example: 4 })
  @IsInt() @Min(3) @Max(4)
  modalidadId: number

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) capSup1Id?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) capSup2Id?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) capSup3Id?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) capSup4Id?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) perfilSup1Id?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) perfilSup2Id?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) perfilSup3Id?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) perfilSup4Id?: number
}
