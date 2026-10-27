import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';
import { MaintenanceType } from '../maintenance.enums.js';

export class CreateMaintenanceDto {
  @ApiProperty({ enum: MaintenanceType })
  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @ApiProperty({ example: 'Cambio de aceite y filtros' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 5000)
  description: string;

  @ApiProperty({ minimum: 0, example: 45000 })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  mileage: number;

  @ApiProperty({ format: 'date-time', example: '2026-11-01T07:30:00-05:00', description: 'Fecha y hora con zona horaria.' })
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  scheduledStart: string;

  @ApiProperty({ format: 'date-time', example: '2026-11-01T09:00:00-05:00' })
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  scheduledEnd: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vehicleId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  mechanicId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  workshopId: string;
}
