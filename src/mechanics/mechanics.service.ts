import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Mechanic } from './mechanic.entity.js';
import { MechanicStatus } from './mechanic-status.enum.js';
import { User } from '../users/user.entity.js';
import { Role } from '../users/role.enum.js';
import type { CreateMechanicDto } from './dto/create-mechanic.dto.js';
import type { UpdateMechanicDto } from './dto/update-mechanic.dto.js';
import type { ListMechanicsDto } from './dto/list-mechanics.dto.js';

@Injectable()
export class MechanicsService {
  constructor(
    @InjectRepository(Mechanic)
    private readonly mechanics: Repository<Mechanic>,
  ) {}

  private async validateTechnician(
    manager: EntityManager,
    userId: string | null | undefined,
  ) {
    if (!userId) return;
    const user = await manager.getRepository(User).findOneBy({ id: userId });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role !== Role.TECHNICIAN)
      throw new ConflictException(
        'El usuario vinculado debe tener rol TECHNICIAN',
      );
  }

  create(dto: CreateMechanicDto) {
    return this.mechanics.manager.transaction(async (manager) => {
      await this.validateTechnician(manager, dto.userId);
      const repository = manager.getRepository(Mechanic);
      return repository.save(
        repository.create({
          name: dto.name,
          email: dto.email,
          specialty: dto.specialty,
          userId: dto.userId ?? null,
          status: MechanicStatus.ACTIVE,
        }),
      );
    });
  }

  findAll(query: ListMechanicsDto) {
    return this.mechanics.find({
      where: query.status ? { status: query.status } : {},
      order: { createdAt: 'DESC', id: 'ASC' },
    });
  }

  async findOne(id: string) {
    const mechanic = await this.mechanics.findOneBy({ id });
    if (!mechanic) throw new NotFoundException('Mecánico no encontrado');
    return mechanic;
  }

  update(id: string, dto: UpdateMechanicDto) {
    // Serialize mechanic updates with maintenance assignments that lock the same row.
    return this.mechanics.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Mechanic);
      const mechanic = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!mechanic) throw new NotFoundException('Mecánico no encontrado');
      await this.validateTechnician(manager, dto.userId);
      Object.assign(mechanic, dto);
      return repository.save(mechanic);
    });
  }

  deactivate(id: string) {
    // Keep the record so deactivation preserves the maintenance history.
    return this.update(id, { status: MechanicStatus.INACTIVE });
  }
}
