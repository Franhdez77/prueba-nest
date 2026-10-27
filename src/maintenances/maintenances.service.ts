import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MaintenancesDao } from './maintenances.dao.js';
import { MaintenanceStatus } from './maintenance.enums.js';
import { VehicleStatus } from '../vehicles/vehicle-status.enum.js';
import { Mechanic } from '../mechanics/mechanic.entity.js';
import { MechanicStatus } from '../mechanics/mechanic-status.enum.js';
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
    @Inject(MaintenancesDao) private readonly maintenances: MaintenancesDao,
  ) {}

  private assertOwner(user: PublicUser, mechanic: Mechanic) {
    if (user.role !== Role.ADMIN && mechanic.userId !== user.id) {
      throw new ForbiddenException('Solo puedes acceder a tus mantenimientos asignados');
    }
  }

  async create(dto: CreateMaintenanceDto, user: PublicUser) {
    const interval = scheduleInterval(dto.scheduledStart, dto.scheduledEnd);
    // Lock mechanic, vehicle, and workshop rows in that order to serialize reservations.
    // Commit or roll back the maintenance record and its audit entry together.
    return this.maintenances.transaction(async (dao) => {
      const mechanic = await dao.mechanics.findLocked(dto.mechanicId);
      if (!mechanic) throw new NotFoundException('Mecánico no encontrado');
      if (mechanic.status !== MechanicStatus.ACTIVE) throw new ConflictException('El mecánico está inactivo');
      const vehicle = await dao.vehicles.findLocked(dto.vehicleId);
      if (!vehicle) throw new NotFoundException('Vehículo no encontrado');
      if (vehicle.status !== VehicleStatus.AVAILABLE) throw new ConflictException('El vehículo no está disponible');
      const workshop = await dao.workshops.findLocked(dto.workshopId);
      if (!workshop) throw new NotFoundException('Taller no encontrado');
      if (workshop.status !== WorkshopStatus.ACTIVE) throw new ConflictException('El taller está inactivo');
      if (dto.mileage < vehicle.mileage) throw new ConflictException('El kilometraje no puede ser inferior al actual del vehículo');
      if (await dao.hasActiveVehicle(vehicle.id)) {
        throw new ConflictException('El vehículo ya tiene un mantenimiento activo');
      }
      const overlap = await dao.hasOverlap(mechanic.id, interval.scheduledStart, interval.scheduledEnd);
      if (overlap) throw new ConflictException('El mecánico tiene otro mantenimiento que se cruza con ese horario');
      const maintenance = await dao.create({
        type: dto.type, description: dto.description, mileage: dto.mileage,
        ...interval, vehicleId: vehicle.id, mechanicId: mechanic.id, workshopId: workshop.id,
        status: MaintenanceStatus.SCHEDULED,
      });
      await dao.audits.create({ maintenanceId: maintenance.id, actorId: user.id, fromStatus: null, toStatus: maintenance.status });
      return dao.detail(maintenance.id);
    });
  }

  findAll(query: ListMaintenancesDto, user: PublicUser) {
    return this.maintenances.findAll(query, user.role === Role.ADMIN ? undefined : user.id);
  }

  async findOne(id: number, user: PublicUser) {
    const maintenance = await this.maintenances.findById(id);
    if (!maintenance) throw new NotFoundException('Mantenimiento no encontrado');
    this.assertOwner(user, maintenance.mechanic);
    return maintenance;
  }

  async history(vehicleId: number, user: PublicUser) {
    if (!await this.maintenances.vehicles.exists(vehicleId)) {
      throw new NotFoundException('Vehículo no encontrado');
    }
    return this.findAll({ vehicleId }, user);
  }

  async byMechanic(mechanicId: number, user: PublicUser) {
    const mechanic = await this.maintenances.mechanics.findById(mechanicId);
    if (!mechanic) throw new NotFoundException('Mecánico no encontrado');
    this.assertOwner(user, mechanic);
    return this.findAll({ mechanicId }, user);
  }

  async audits(id: number, user: PublicUser) {
    await this.findOne(id, user);
    return this.maintenances.audits.findByMaintenance(id);
  }

  updateStatus(id: number, dto: UpdateMaintenanceStatusDto, user: PublicUser) {
    // Update the maintenance status, vehicle availability, mileage, and audit atomically.
    return this.maintenances.transaction(async (dao) => {
      const maintenance = await dao.findLocked(id);
      if (!maintenance) throw new NotFoundException('Mantenimiento no encontrado');
      const mechanic = await dao.mechanics.findLockedOrFail(maintenance.mechanicId);
      this.assertOwner(user, mechanic);
      assertTransition(maintenance.status, dto.status);
      const hasClosingData = [dto.workPerformed, dto.finalCost, dto.finishedAt, dto.finalMileage].some(value => value !== undefined);
      if (dto.status !== MaintenanceStatus.COMPLETED && hasClosingData) throw new BadRequestException('Los datos de cierre solo se admiten al completar');
      const vehicle = await dao.vehicles.findLockedOrFail(maintenance.vehicleId);
      if (dto.status === MaintenanceStatus.IN_PROGRESS) {
        if (mechanic.status !== MechanicStatus.ACTIVE) throw new ConflictException('El mecánico está inactivo');
        if (vehicle.status !== VehicleStatus.AVAILABLE) throw new ConflictException('El vehículo no está disponible');
        const workshop = await dao.workshops.findLockedOrFail(maintenance.workshopId);
        if (workshop.status !== WorkshopStatus.ACTIVE) throw new ConflictException('El taller está inactivo');
        if (await dao.hasRunningMechanic(mechanic.id)) {
          throw new ConflictException('El mecánico ya tiene un mantenimiento en proceso');
        }
        maintenance.startedAt = new Date();
        vehicle.status = VehicleStatus.IN_MAINTENANCE;
        await dao.vehicles.save(vehicle);
      }
      if (dto.status === MaintenanceStatus.COMPLETED) {
        const closing = closingData(dto, Math.max(vehicle.mileage, maintenance.mileage), maintenance.startedAt);
        Object.assign(maintenance, closing);
        vehicle.mileage = closing.finalMileage;
        vehicle.status = VehicleStatus.AVAILABLE;
        await dao.vehicles.save(vehicle);
      }
      const previous = maintenance.status;
      maintenance.status = dto.status;
      await dao.save(maintenance);
      await dao.audits.create({ maintenanceId: maintenance.id, actorId: user.id, fromStatus: previous, toStatus: maintenance.status });
      return dao.detail(id);
    });
  }
}
