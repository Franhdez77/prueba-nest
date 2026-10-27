import { ApiProperty } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity.js';
import { Mechanic } from '../mechanics/mechanic.entity.js';
import { Workshop } from '../workshops/workshop.entity.js';
import { MaintenanceStatus, MaintenanceType } from './maintenance.enums.js';

@Index('UQ_maintenance_active_vehicle', ['vehicleId'], { unique: true, where: "\"status\" IN ('SCHEDULED', 'IN_PROGRESS')" })
@Index('UQ_maintenance_running_mechanic', ['mechanicId'], { unique: true, where: "\"status\" = 'IN_PROGRESS'" })
@Index('IX_maintenance_mechanic_schedule', ['mechanicId', 'scheduledStart', 'scheduledEnd'], { where: "\"status\" IN ('SCHEDULED', 'IN_PROGRESS')" })
@Index('IX_maintenance_vehicle_history', ['vehicleId', 'scheduledStart'])
@Entity('maintenances')
export class Maintenance {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ enum: MaintenanceType })
  @Column({ type: 'enum', enum: MaintenanceType, enumName: 'maintenance_type' })
  type: MaintenanceType;

  @ApiProperty({ example: 'Cambio de aceite y filtros' })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ example: 45000 })
  @Column({ type: 'integer' })
  mileage: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Column({ name: 'scheduled_start', type: 'timestamptz' })
  scheduledStart: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Column({ name: 'scheduled_end', type: 'timestamptz' })
  scheduledEnd: Date;

  @ApiProperty({ enum: MaintenanceStatus })
  @Column({ type: 'enum', enum: MaintenanceStatus, enumName: 'maintenance_status', default: MaintenanceStatus.SCHEDULED })
  status: MaintenanceStatus;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId: string;

  @ApiProperty({ type: () => Vehicle })
  @ManyToOne(() => Vehicle, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'mechanic_id', type: 'uuid' })
  mechanicId: string;

  @ApiProperty({ type: () => Mechanic })
  @ManyToOne(() => Mechanic, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'mechanic_id' })
  mechanic: Mechanic;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'workshop_id', type: 'uuid' })
  workshopId: string;

  @ApiProperty({ type: () => Workshop })
  @ManyToOne(() => Workshop, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workshop_id' })
  workshop: Workshop;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  @Column({ name: 'work_performed', type: 'text', nullable: true })
  workPerformed: string | null;

  @ApiProperty({ type: String, example: '250000.00', nullable: true, description: 'Importe decimal representado sin pérdida de precisión.' })
  @Column({ name: 'final_cost', type: 'numeric', precision: 12, scale: 2, nullable: true })
  finalCost: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @ApiProperty({ type: Number, nullable: true })
  @Column({ name: 'final_mileage', type: 'integer', nullable: true })
  finalMileage: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
