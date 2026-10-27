import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Maintenance } from './maintenance.entity.js';
import { MaintenanceAudit } from './maintenance-audit.entity.js';
import { ACTIVE_MAINTENANCE_STATUSES, MaintenanceStatus } from './maintenance.enums.js';
import { Vehicle } from '../vehicles/vehicle.entity.js';
import { VehicleStatus } from '../vehicles/vehicle-status.enum.js';
import { Mechanic } from '../mechanics/mechanic.entity.js';
import { MechanicStatus } from '../mechanics/mechanic-status.enum.js';
import { Workshop } from '../workshops/workshop.entity.js';
import { WorkshopStatus } from '../workshops/workshop-status.enum.js';
import { Role } from '../users/role.enum.js';
import type { PublicUser } from '../users/user.entity.js';
import type { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';
import type { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto.js';
import type { ListMaintenancesDto } from './dto/list-maintenances.dto.js';
import { assertTransition, closingData, scheduleInterval } from './maintenance.rules.js';

@Injectable()
export class MaintenancesService {
  constructor(
    @InjectRepository(Maintenance) private readonly maintenances: Repository<Maintenance>,
  ) {}

  private detail(manager: EntityManager, id: string) {
    return manager.getRepository(Maintenance).findOneOrFail({
      where: { id }, relations: { vehicle: true, mechanic: true, workshop: true },
    });
  }

  private assertOwner(user: PublicUser, mechanic: Mechanic) {
    if (user.role !== Role.ADMIN && mechanic.userId !== user.id) {
      throw new ForbiddenException('Solo puedes acceder a tus mantenimientos asignados');
    }
  }

  private audit(manager: EntityManager, maintenanceId: string, actorId: string, fromStatus: MaintenanceStatus | null, toStatus: MaintenanceStatus) {
    const audits = manager.getRepository(MaintenanceAudit);
    return audits.save(audits.create({ maintenanceId, actorId, fromStatus, toStatus }));
  }

  async create(dto: CreateMaintenanceDto, user: PublicUser) {
    const interval = scheduleInterval(dto.scheduledStart, dto.scheduledEnd);
    // Bloquea siempre mecánico → vehículo → taller: serializa reservas concurrentes.
    // El mantenimiento y su auditoría se confirman o revierten juntos.
    return this.maintenances.manager.transaction(async (manager) => {
      const mechanic = await manager.getRepository(Mechanic).findOne({ where: { id: dto.mechanicId }, lock: { mode: 'pessimistic_write' } });
      if (!mechanic) throw new NotFoundException('Mecánico no encontrado');
      if (mechanic.status !== MechanicStatus.ACTIVE) throw new ConflictException('El mecánico está inactivo');
      const vehicle = await manager.getRepository(Vehicle).findOne({ where: { id: dto.vehicleId }, lock: { mode: 'pessimistic_write' } });
      if (!vehicle) throw new NotFoundException('Vehículo no encontrado');
      if (vehicle.status !== VehicleStatus.AVAILABLE) throw new ConflictException('El vehículo no está disponible');
      const workshop = await manager.getRepository(Workshop).findOne({ where: { id: dto.workshopId }, lock: { mode: 'pessimistic_write' } });
      if (!workshop) throw new NotFoundException('Taller no encontrado');
      if (workshop.status !== WorkshopStatus.ACTIVE) throw new ConflictException('El taller está inactivo');
      if (dto.mileage < vehicle.mileage) throw new ConflictException('El kilometraje no puede ser inferior al actual del vehículo');
      const repository = manager.getRepository(Maintenance);
      if (await repository.existsBy({ vehicleId: vehicle.id, status: In(ACTIVE_MAINTENANCE_STATUSES) })) {
        throw new ConflictException('El vehículo ya tiene un mantenimiento activo');
      }
      // Intervalos [inicio, fin): un mantenimiento puede comenzar cuando otro termina.
      const overlap = await repository.createQueryBuilder('m')
        .where('m.mechanicId = :mechanicId', { mechanicId: mechanic.id })
        .andWhere('m.status IN (:...statuses)', { statuses: ACTIVE_MAINTENANCE_STATUSES })
        .andWhere('m.scheduledStart < :end AND m.scheduledEnd > :start', { start: interval.scheduledStart, end: interval.scheduledEnd })
        .getExists();
      if (overlap) throw new ConflictException('El mecánico tiene otro mantenimiento que se cruza con ese horario');
      const maintenance = await repository.save(repository.create({
        type: dto.type, description: dto.description, mileage: dto.mileage,
        ...interval, vehicleId: vehicle.id, mechanicId: mechanic.id, workshopId: workshop.id,
        status: MaintenanceStatus.SCHEDULED,
      }));
      await this.audit(manager, maintenance.id, user.id, null, maintenance.status);
      return this.detail(manager, maintenance.id);
    });
  }

  findAll(query: ListMaintenancesDto, user: PublicUser) {
    const builder = this.maintenances.createQueryBuilder('m')
      .leftJoinAndSelect('m.vehicle', 'vehicle')
      .leftJoinAndSelect('m.mechanic', 'mechanic')
      .leftJoinAndSelect('m.workshop', 'workshop');
    if (user.role !== Role.ADMIN) builder.andWhere('mechanic.userId = :userId', { userId: user.id });
    if (query.status) builder.andWhere('m.status = :status', { status: query.status });
    if (query.type) builder.andWhere('m.type = :type', { type: query.type });
    if (query.vehicleId) builder.andWhere('m.vehicleId = :vehicleId', { vehicleId: query.vehicleId });
    if (query.mechanicId) builder.andWhere('m.mechanicId = :mechanicId', { mechanicId: query.mechanicId });
    if (query.active !== undefined) {
      builder.andWhere(query.active === 'true' ? 'm.status IN (:...activeStatuses)' : 'm.status NOT IN (:...activeStatuses)', { activeStatuses: ACTIVE_MAINTENANCE_STATUSES });
    }
    return builder.orderBy('m.scheduledStart', 'DESC').addOrderBy('m.id', 'ASC').getMany();
  }

  async findOne(id: string, user: PublicUser) {
    const maintenance = await this.maintenances.findOne({ where: { id }, relations: { vehicle: true, mechanic: true, workshop: true } });
    if (!maintenance) throw new NotFoundException('Mantenimiento no encontrado');
    this.assertOwner(user, maintenance.mechanic);
    return maintenance;
  }

  async history(vehicleId: string, user: PublicUser) {
    if (!await this.maintenances.manager.getRepository(Vehicle).existsBy({ id: vehicleId })) {
      throw new NotFoundException('Vehículo no encontrado');
    }
    return this.findAll({ vehicleId }, user);
  }

  async byMechanic(mechanicId: string, user: PublicUser) {
    const mechanic = await this.maintenances.manager.getRepository(Mechanic).findOneBy({ id: mechanicId });
    if (!mechanic) throw new NotFoundException('Mecánico no encontrado');
    this.assertOwner(user, mechanic);
    return this.findAll({ mechanicId }, user);
  }

  async audits(id: string, user: PublicUser) {
    await this.findOne(id, user);
    return this.maintenances.manager.getRepository(MaintenanceAudit).find({ where: { maintenanceId: id }, order: { createdAt: 'ASC', id: 'ASC' } });
  }

  updateStatus(id: string, dto: UpdateMaintenanceStatusDto, user: PublicUser) {
    // La transición, la disponibilidad, el kilometraje y la auditoría son atómicos.
    return this.maintenances.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Maintenance);
      const maintenance = await repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!maintenance) throw new NotFoundException('Mantenimiento no encontrado');
      const mechanic = await manager.getRepository(Mechanic).findOneOrFail({ where: { id: maintenance.mechanicId }, lock: { mode: 'pessimistic_write' } });
      this.assertOwner(user, mechanic);
      assertTransition(maintenance.status, dto.status);
      const hasClosingData = [dto.workPerformed, dto.finalCost, dto.finishedAt, dto.finalMileage].some(value => value !== undefined);
      if (dto.status !== MaintenanceStatus.COMPLETED && hasClosingData) throw new BadRequestException('Los datos de cierre solo se admiten al completar');
      const vehicles = manager.getRepository(Vehicle);
      const vehicle = await vehicles.findOneOrFail({ where: { id: maintenance.vehicleId }, lock: { mode: 'pessimistic_write' } });
      if (dto.status === MaintenanceStatus.IN_PROGRESS) {
        if (mechanic.status !== MechanicStatus.ACTIVE) throw new ConflictException('El mecánico está inactivo');
        if (vehicle.status !== VehicleStatus.AVAILABLE) throw new ConflictException('El vehículo no está disponible');
        const workshop = await manager.getRepository(Workshop).findOneOrFail({ where: { id: maintenance.workshopId }, lock: { mode: 'pessimistic_write' } });
        if (workshop.status !== WorkshopStatus.ACTIVE) throw new ConflictException('El taller está inactivo');
        if (await repository.existsBy({ mechanicId: mechanic.id, status: MaintenanceStatus.IN_PROGRESS })) {
          throw new ConflictException('El mecánico ya tiene un mantenimiento en proceso');
        }
        maintenance.startedAt = new Date();
        vehicle.status = VehicleStatus.IN_MAINTENANCE;
        await vehicles.save(vehicle);
      }
      if (dto.status === MaintenanceStatus.COMPLETED) {
        const closing = closingData(dto, Math.max(vehicle.mileage, maintenance.mileage), maintenance.startedAt);
        Object.assign(maintenance, closing);
        vehicle.mileage = closing.finalMileage;
        vehicle.status = VehicleStatus.AVAILABLE;
        await vehicles.save(vehicle);
      }
      const previous = maintenance.status;
      maintenance.status = dto.status;
      await repository.save(maintenance);
      await this.audit(manager, maintenance.id, user.id, previous, maintenance.status);
      return this.detail(manager, id);
    });
  }
}
