import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Maintenance } from './maintenance.entity.js';
import { MaintenanceAudit } from './maintenance-audit.entity.js';
import { MaintenanceAuditsDao } from './maintenance-audits.dao.js';
import { ACTIVE_MAINTENANCE_STATUSES, MaintenanceStatus } from './maintenance.enums.js';
import type { ListMaintenancesDto } from './dto/list-maintenances.dto.js';
import { Vehicle } from '../vehicles/vehicle.entity.js';
import { VehiclesDao } from '../vehicles/vehicles.dao.js';
import { Mechanic } from '../mechanics/mechanic.entity.js';
import { MechanicsDao } from '../mechanics/mechanics.dao.js';
import { Workshop } from '../workshops/workshop.entity.js';
import { WorkshopsDao } from '../workshops/workshops.dao.js';

@Injectable()
export class MaintenancesDao {
  constructor(@InjectRepository(Maintenance) private readonly repository: Repository<Maintenance>) {}

  // All DAOs created here share the transaction's manager and database connection.
  transaction<T>(work: (dao: MaintenancesDao) => Promise<T>): Promise<T> {
    return this.repository.manager.transaction(manager => work(new MaintenancesDao(manager.getRepository(Maintenance))));
  }
  get vehicles() { return new VehiclesDao(this.repository.manager.getRepository(Vehicle)); }
  get mechanics() { return new MechanicsDao(this.repository.manager.getRepository(Mechanic)); }
  get workshops() { return new WorkshopsDao(this.repository.manager.getRepository(Workshop)); }
  get audits() { return new MaintenanceAuditsDao(this.repository.manager.getRepository(MaintenanceAudit)); }

  create(data: Pick<Maintenance, 'type' | 'description' | 'mileage' | 'scheduledStart' | 'scheduledEnd' | 'vehicleId' | 'mechanicId' | 'workshopId' | 'status'>) {
    return this.repository.save(this.repository.create(data));
  }
  save(maintenance: Maintenance) { return this.repository.save(maintenance); }
  findById(id: number) {
    return this.repository.findOne({ where: { id }, relations: { vehicle: true, mechanic: true, workshop: true } });
  }
  detail(id: number) {
    return this.repository.findOneOrFail({ where: { id }, relations: { vehicle: true, mechanic: true, workshop: true } });
  }
  findLocked(id: number) {
    return this.repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }
  hasActiveVehicle(vehicleId: number) {
    return this.repository.existsBy({ vehicleId, status: In(ACTIVE_MAINTENANCE_STATUSES) });
  }
  hasRunningMechanic(mechanicId: number) {
    return this.repository.existsBy({ mechanicId, status: MaintenanceStatus.IN_PROGRESS });
  }
  hasOverlap(mechanicId: number, start: Date, end: Date) {
    // Half-open intervals allow consecutive jobs to share an endpoint.
    return this.repository.createQueryBuilder('m')
      .where('m.mechanicId = :mechanicId', { mechanicId })
      .andWhere('m.status IN (:...statuses)', { statuses: ACTIVE_MAINTENANCE_STATUSES })
      .andWhere('m.scheduledStart < :end AND m.scheduledEnd > :start', { start, end }).getExists();
  }
  findAll(query: ListMaintenancesDto, ownerUserId?: number) {
    const builder = this.repository.createQueryBuilder('m')
      .leftJoinAndSelect('m.vehicle', 'vehicle')
      .leftJoinAndSelect('m.mechanic', 'mechanic')
      .leftJoinAndSelect('m.workshop', 'workshop');
    if (ownerUserId !== undefined) builder.andWhere('mechanic.userId = :userId', { userId: ownerUserId });
    if (query.status) builder.andWhere('m.status = :status', { status: query.status });
    if (query.type) builder.andWhere('m.type = :type', { type: query.type });
    if (query.vehicleId) builder.andWhere('m.vehicleId = :vehicleId', { vehicleId: query.vehicleId });
    if (query.mechanicId) builder.andWhere('m.mechanicId = :mechanicId', { mechanicId: query.mechanicId });
    if (query.active !== undefined) {
      builder.andWhere(query.active === 'true' ? 'm.status IN (:...activeStatuses)' : 'm.status NOT IN (:...activeStatuses)', { activeStatuses: ACTIVE_MAINTENANCE_STATUSES });
    }
    return builder.orderBy('m.scheduledStart', 'DESC').addOrderBy('m.id', 'ASC').getMany();
  }
}
