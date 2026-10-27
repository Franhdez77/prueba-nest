import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workshop } from './workshop.entity.js';
import { WorkshopStatus } from './workshop-status.enum.js';
import type { CreateWorkshopDto } from './dto/create-workshop.dto.js';

@Injectable()
export class WorkshopsService {
  constructor(
    @InjectRepository(Workshop)
    private readonly workshops: Repository<Workshop>,
  ) {}

  create(dto: CreateWorkshopDto) {
    return this.workshops.save(this.workshops.create({
      name: dto.name,
      address: dto.address,
      status: WorkshopStatus.ACTIVE,
    }));
  }

  findActive() {
    return this.workshops.find({
      where: { status: WorkshopStatus.ACTIVE },
      order: { name: 'ASC', id: 'ASC' },
    });
  }

  async findOne(id: string) {
    const workshop = await this.workshops.findOneBy({ id });
    if (!workshop) throw new NotFoundException('Taller no encontrado');
    return workshop;
  }

  updateStatus(id: string, status: WorkshopStatus) {
    // Lock the workshop row to coordinate status changes with maintenance assignments.
    return this.workshops.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Workshop);
      const workshop = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!workshop) throw new NotFoundException('Taller no encontrado');
      workshop.status = status;
      return repository.save(workshop);
    });
  }
}
