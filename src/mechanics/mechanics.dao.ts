import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mechanic } from './mechanic.entity.js';
import type { MechanicStatus } from './mechanic-status.enum.js';
import { User } from '../users/user.entity.js';
import { UsersDao } from '../users/users.dao.js';

@Injectable()
export class MechanicsDao {
  constructor(@InjectRepository(Mechanic) private readonly repository: Repository<Mechanic>) {}

  transaction<T>(work: (dao: MechanicsDao) => Promise<T>): Promise<T> {
    return this.repository.manager.transaction(manager => work(new MechanicsDao(manager.getRepository(Mechanic))));
  }
  findUser(userId: number) {
    return new UsersDao(this.repository.manager.getRepository(User)).findById(userId);
  }
  create(data: Pick<Mechanic, 'name' | 'email' | 'specialty' | 'userId' | 'status'>) {
    return this.repository.save(this.repository.create(data));
  }
  findAll(status?: MechanicStatus) {
    return this.repository.find({ where: status ? { status } : {}, order: { createdAt: 'DESC', id: 'ASC' } });
  }
  findById(id: number) { return this.repository.findOneBy({ id }); }
  findLocked(id: number) {
    return this.repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }
  findLockedOrFail(id: number) {
    return this.repository.findOneOrFail({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }
  save(mechanic: Mechanic) { return this.repository.save(mechanic); }
}
