import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsDateString, IsInt, IsNotEmpty, IsOptional, IsString,
  Matches, Max, MaxLength, Min,
} from 'class-validator'

export class AgregarSesionPresencialDto {
  @ApiProperty({ example: 'CONFERENCIA DE EXPERTO' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombreSesion: string

  @ApiProperty({ example: '2025-11-24', description: 'YYYY-MM-DD' })
  @IsDateString()
  fechaInicio: string

  @ApiProperty({ example: '08:00', description: 'HH:mm 24h' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'Hora inicio debe estar en formato HH:mm' })
  horaInicio: string

  @ApiProperty({ example: '12:00', description: 'HH:mm 24h' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'Hora fin debe estar en formato HH:mm' })
  horaFin: string

  // Solo presencial / híbrida
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  nombreSede?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(300)
  direccion?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(40)
  aula?: string

  // Solo PAT / híbrida
  @ApiPropertyOptional({ example: 'TEAMS' })
  @IsOptional() @IsString() @MaxLength(100)
  herramienta?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(300)
  url?: string

  // Capacitador y perfil (obligatorios)
  @ApiProperty({ example: 6226 })
  @IsInt() @Min(1)
  capacitadorId: number

  @ApiProperty({ example: 15112 })
  @IsInt() @Min(1)
  perfilUTId: number

  // Modalidad de la AF: 1=Presencial, 2=PAT, 3=Híbrida (sirve para validar campos visibles)
  @ApiProperty({ example: 1 })
  @IsInt() @Min(1) @Max(3)
  modalidadId: number

  // Cobertura (depto/ciudad) del grupo a la que pertenece la sesion. Si no
  // se envia, el backend usa la primera del grupo.
  @ApiPropertyOptional({ example: 68322 })
  @IsOptional() @IsInt() @Min(1)
  coberturaId?: number

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) capSup1Id?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) capSup2Id?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) capSup3Id?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) capSup4Id?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) perfilSup1Id?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) perfilSup2Id?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) perfilSup3Id?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) perfilSup4Id?: number
}
