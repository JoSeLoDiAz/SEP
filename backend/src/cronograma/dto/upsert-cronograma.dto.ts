import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsInt, IsNotEmpty, Min } from 'class-validator'

export class UpsertCronogramaDto {
  @ApiProperty({ example: 19475 })
  @IsInt()
  @Min(1)
  grupoId: number

  @ApiProperty({ example: 19591 })
  @IsInt()
  @Min(1)
  utId: number

  @ApiProperty({ example: '2025-11-24' })
  @IsDateString()
  @IsNotEmpty()
  fechaInicio: string

  @ApiProperty({ example: '2025-11-28' })
  @IsDateString()
  @IsNotEmpty()
  fechaFin: string
}
