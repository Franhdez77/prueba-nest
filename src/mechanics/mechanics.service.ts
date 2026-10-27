import {
  ConflictException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { MechanicsDao } from './mechanics.dao.js';
import { MechanicStatus } from './mechanic-status.enum.js';
import { Role } from '../users/role.enum.js';
import type { CreateMechanicDto } from './dto/create-mechanic.dto.js';
import type { UpdateMechanicDto } from './dto/update-mechanic.dto.js';
import type { ListMechanicsDto } from './dto/list-mechanics.dto.js';

@Injectable()
export class MechanicsService {
  constructor(
    @Inject(MechanicsDao) private readonly mechanics: MechanicsDao,
  ) {}

  private async validateTechnician(
    dao: MechanicsDao,
    userId: number | null | undefined,
  ) {
    if (!userId) return;
    const user = await dao.findUser(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role !== Role.TECHNICIAN)
      throw new ConflictException(
        'El usuario vinculado debe tener rol TECHNICIAN',
      );
  }

  create(dto: CreateMechanicDto) {
    return this.mechanics.transaction(async (dao) => {
      await this.validateTechnician(dao, dto.userId);
      return dao.create({
        name: dto.name, email: dto.email, specialty: dto.specialty,
        userId: dto.userId ?? null, status: MechanicStatus.ACTIVE,
      });
    });
  }

  findAll(query: ListMechanicsDto) {
    return this.mechanics.findAll(query.status);
  }

  async findOne(id: number) {
    const mechanic = await this.mechanics.findById(id);
    if (!mechanic) throw new NotFoundException('Mecánico no encontrado');
    return mechanic;
  }

  update(id: number, dto: UpdateMechanicDto) {
    // Serialize mechanic updates with maintenance assignments that lock the same row.
    return this.mechanics.transaction(async (dao) => {
      const mechanic = await dao.findLocked(id);
      if (!mechanic) throw new NotFoundException('Mecánico no encontrado');
      await this.validateTechnician(dao, dto.userId);
      Object.assign(mechanic, dto);
      return dao.save(mechanic);
    });
  }

  deactivate(id: number) {
    // Keep the record so deactivation preserves the maintenance history.
    return this.update(id, { status: MechanicStatus.INACTIVE });
  }
}
