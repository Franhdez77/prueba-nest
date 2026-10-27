import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './vehicle.entity.js';
import type { VehicleStatus } from './vehicle-status.enum.js';

@Injectable()
export class VehiclesDao {
  constructor(@InjectRepository(Vehicle) private readonly repository: Repository<Vehicle>) {}

  transaction<T>(work: (dao: VehiclesDao) => Promise<T>): Promise<T> {
    return this.repository.manager.transaction(manager => work(new VehiclesDao(manager.getRepository(Vehicle))));
  }

  create(data: Pick<Vehicle, 'plate' | 'brand' | 'model' | 'year' | 'mileage' | 'status'>) {
    return this.repository.save(this.repository.create(data));
  }

  findAll(status?: VehicleStatus) {
    return this.repository.find({ where: status ? { status } : {}, order: { createdAt: 'DESC', id: 'ASC' } });
  }

  findById(id: number) { return this.repository.findOneBy({ id }); }
  findByPlate(plate: string) { return this.repository.findOneBy({ plate }); }
  exists(id: number) { return this.repository.existsBy({ id }); }
  findLocked(id: number) {
    return this.repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }
  findLockedOrFail(id: number) {
    return this.repository.findOneOrFail({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }
  save(vehicle: Vehicle) { return this.repository.save(vehicle); }
}
