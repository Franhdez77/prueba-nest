import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WorkshopsDao } from './workshops.dao.js';
import { WorkshopStatus } from './workshop-status.enum.js';
import type { CreateWorkshopDto } from './dto/create-workshop.dto.js';

@Injectable()
export class WorkshopsService {
  constructor(
    @Inject(WorkshopsDao) private readonly workshops: WorkshopsDao,
  ) {}

  create(dto: CreateWorkshopDto) {
    return this.workshops.create({
      name: dto.name,
      address: dto.address,
      status: WorkshopStatus.ACTIVE,
    });
  }

  findActive() {
    return this.workshops.findByStatus(WorkshopStatus.ACTIVE);
  }

  async findOne(id: number) {
    const workshop = await this.workshops.findById(id);
    if (!workshop) throw new NotFoundException('Taller no encontrado');
    return workshop;
  }

  updateStatus(id: number, status: WorkshopStatus) {
    // Lock the workshop row to coordinate status changes with maintenance assignments.
    return this.workshops.transaction(async (dao) => {
      const workshop = await dao.findLocked(id);
      if (!workshop) throw new NotFoundException('Taller no encontrado');
      workshop.status = status;
      return dao.save(workshop);
    });
  }
}
