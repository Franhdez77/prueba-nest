import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { MaintenanceStatus, MaintenanceType } from '../maintenance.enums.js';

export class ListMaintenancesDto {
  @ApiPropertyOptional({ enum: MaintenanceStatus })
  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @ApiPropertyOptional({ enum: MaintenanceType })
  @IsOptional()
  @IsEnum(MaintenanceType)
  type?: MaintenanceType;

  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  vehicleId?: number;

  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  mechanicId?: number;

  @ApiPropertyOptional({ enum: ['true', 'false'], description: 'true: SCHEDULED o IN_PROGRESS; false: estados finales.' })
  @IsOptional()
  @IsIn(['true', 'false'])
  active?: string;
}
