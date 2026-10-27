import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { WorkshopStatus } from './workshop-status.enum.js';

@Entity('workshops')
export class Workshop {
  @ApiProperty({ type: Number, minimum: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Taller Norte' })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiProperty({ example: 'Calle 50 # 20-30' })
  @Column({ type: 'varchar', length: 255 })
  address: string;

  @ApiProperty({ enum: WorkshopStatus })
  @Column({
    type: 'enum',
    enum: WorkshopStatus,
    enumName: 'workshop_status',
    default: WorkshopStatus.ACTIVE,
  })
  status: WorkshopStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
