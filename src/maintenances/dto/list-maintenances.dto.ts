import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsEnum, IsOptional, IsUUID } from 'class-validator';
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

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  mechanicId?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'], description: 'true: SCHEDULED o IN_PROGRESS; false: estados finales.' })
  @IsOptional()
  @IsIn(['true', 'false'])
  active?: string;
}
