import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../users/user.entity.js';
import { MechanicStatus } from './mechanic-status.enum.js';

@Entity('mechanics')
export class Mechanic {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiProperty({ format: 'email', example: 'mecanico@example.com' })
  @Column({ type: 'varchar', length: 254, unique: true })
  email: string;

  @ApiProperty({ example: 'Motores diésel' })
  @Column({ type: 'varchar', length: 150 })
  specialty: string;

  @ApiProperty({ enum: MechanicStatus })
  @Column({
    type: 'enum',
    enum: MechanicStatus,
    enumName: 'mechanic_status',
    default: MechanicStatus.ACTIVE,
  })
  status: MechanicStatus;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Usuario TECHNICIAN vinculado, si existe.',
  })
  @Column({ name: 'user_id', type: 'uuid', nullable: true, unique: true })
  userId: string | null;

  @OneToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
