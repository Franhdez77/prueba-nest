import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsNumber, IsString, Length, Matches, Max, Min, ValidateIf } from 'class-validator';
import { MaintenanceStatus } from '../maintenance.enums.js';

const closingField = (dto: UpdateMaintenanceStatusDto, value: unknown) =>
  dto.status === MaintenanceStatus.COMPLETED || value !== undefined;

export class UpdateMaintenanceStatusDto {
  @ApiProperty({ enum: MaintenanceStatus })
  @IsEnum(MaintenanceStatus)
  status: MaintenanceStatus;

  @ApiPropertyOptional({ description: 'Obligatorio al completar.', example: 'Cambio de aceite y filtros realizado' })
  @ValidateIf(closingField)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 5000)
  workPerformed?: string;

  @ApiPropertyOptional({ minimum: 0, example: 250000, description: 'Obligatorio al completar; máximo dos decimales.' })
  @ValidateIf(closingField)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  finalCost?: number;

  @ApiPropertyOptional({ format: 'date-time', description: 'Obligatoria al completar; incluye zona horaria.' })
  @ValidateIf(closingField)
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  finishedAt?: string;

  @ApiPropertyOptional({ minimum: 0, example: 45100, description: 'Obligatorio al completar.' })
  @ValidateIf(closingField)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  finalMileage?: number;
}
