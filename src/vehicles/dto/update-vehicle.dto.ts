import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, ValidateIf } from 'class-validator';
import { CreateVehicleDto } from './create-vehicle.dto.js';
import { VehicleStatus } from '../vehicle-status.enum.js';

export class UpdateVehicleDto extends PartialType(CreateVehicleDto, {
  skipNullProperties: false,
}) {
  @ApiPropertyOptional({
    enum: [VehicleStatus.AVAILABLE, VehicleStatus.INACTIVE],
    description: 'IN_MAINTENANCE se administra desde mantenimientos.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn([VehicleStatus.AVAILABLE, VehicleStatus.INACTIVE])
  status?: VehicleStatus.AVAILABLE | VehicleStatus.INACTIVE;
}
