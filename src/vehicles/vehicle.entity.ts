import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { VehicleStatus } from './vehicle-status.enum.js';

@Entity('vehicles')
export class Vehicle {
  @ApiProperty({ type: Number, minimum: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'ABC123' })
  @Column({ type: 'varchar', length: 20, unique: true })
  plate: string;

  @ApiProperty({ example: 'Toyota' })
  @Column({ type: 'varchar', length: 100 })
  brand: string;

  @ApiProperty({ example: 'Hilux' })
  @Column({ type: 'varchar', length: 100 })
  model: string;

  @ApiProperty({ example: 2024 })
  @Column({ type: 'integer' })
  year: number;

  @ApiProperty({ example: 45000, minimum: 0 })
  @Column({ type: 'integer' })
  mileage: number;

  @ApiProperty({ enum: VehicleStatus })
  @Column({
    type: 'enum',
    enum: VehicleStatus,
    enumName: 'vehicle_status',
    default: VehicleStatus.AVAILABLE,
  })
  status: VehicleStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
