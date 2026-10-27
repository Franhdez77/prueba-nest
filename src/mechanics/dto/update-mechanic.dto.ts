import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, ValidateIf } from 'class-validator';
import { CreateMechanicDto } from './create-mechanic.dto.js';
import { MechanicStatus } from '../mechanic-status.enum.js';

export class UpdateMechanicDto extends PartialType(CreateMechanicDto, {
  skipNullProperties: false,
}) {
  @ApiPropertyOptional({ enum: MechanicStatus })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(MechanicStatus)
  status?: MechanicStatus;
}
