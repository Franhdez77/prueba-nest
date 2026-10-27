import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { WorkshopStatus } from '../workshop-status.enum.js';

export class UpdateWorkshopStatusDto {
  @ApiProperty({ enum: WorkshopStatus })
  @IsEnum(WorkshopStatus)
  status: WorkshopStatus;
}
