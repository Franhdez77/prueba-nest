import { ApiProperty } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity.js';
import { Maintenance } from './maintenance.entity.js';
import { MaintenanceStatus } from './maintenance.enums.js';

@Index('IX_maintenance_audits', ['maintenanceId', 'createdAt'])
@Entity('maintenance_audits')
export class MaintenanceAudit {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'maintenance_id', type: 'uuid' })
  maintenanceId: string;

  @ManyToOne(() => Maintenance, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'maintenance_id' })
  maintenance: Maintenance;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_id' })
  actor: User;

  @ApiProperty({ enum: MaintenanceStatus, nullable: true })
  @Column({ name: 'from_status', type: 'enum', enum: MaintenanceStatus, enumName: 'maintenance_status', nullable: true })
  fromStatus: MaintenanceStatus | null;

  @ApiProperty({ enum: MaintenanceStatus })
  @Column({ name: 'to_status', type: 'enum', enum: MaintenanceStatus, enumName: 'maintenance_status' })
  toStatus: MaintenanceStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
