import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workshop } from './workshop.entity.js';
import type { WorkshopStatus } from './workshop-status.enum.js';

@Injectable()
export class WorkshopsDao {
  constructor(@InjectRepository(Workshop) private readonly repository: Repository<Workshop>) {}

  transaction<T>(work: (dao: WorkshopsDao) => Promise<T>): Promise<T> {
    return this.repository.manager.transaction(manager => work(new WorkshopsDao(manager.getRepository(Workshop))));
  }
  create(data: Pick<Workshop, 'name' | 'address' | 'status'>) {
    return this.repository.save(this.repository.create(data));
  }
  findByStatus(status: WorkshopStatus) {
    return this.repository.find({ where: { status }, order: { name: 'ASC', id: 'ASC' } });
  }
  findById(id: number) { return this.repository.findOneBy({ id }); }
  findLocked(id: number) {
    return this.repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }
  findLockedOrFail(id: number) {
    return this.repository.findOneOrFail({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }
  save(workshop: Workshop) { return this.repository.save(workshop); }
}
