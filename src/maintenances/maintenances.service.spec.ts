import { jest } from '@jest/globals';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { EntityManager, ObjectLiteral, Repository } from 'typeorm';
import { MaintenancesService } from './maintenances.service.js';
import { Maintenance } from './maintenance.entity.js';
import { MaintenanceAudit } from './maintenance-audit.entity.js';
import { MaintenanceStatus as Status, MaintenanceType } from './maintenance.enums.js';
import { Vehicle } from '../vehicles/vehicle.entity.js';
import { VehicleStatus } from '../vehicles/vehicle-status.enum.js';
import { Mechanic } from '../mechanics/mechanic.entity.js';
import { MechanicStatus } from '../mechanics/mechanic-status.enum.js';
import { Workshop } from '../workshops/workshop.entity.js';
import { WorkshopStatus } from '../workshops/workshop-status.enum.js';
import { Role } from '../users/role.enum.js';
import type { PublicUser } from '../users/user.entity.js';

function mockRepository<T extends ObjectLiteral>() {
  return {
    create: jest.fn<(data: Partial<T>) => T>().mockImplementation(data => ({ ...data }) as T),
    save: jest.fn<(data: T) => Promise<T>>().mockImplementation(async data => data),
    findOne: jest.fn<(query: unknown) => Promise<T | null>>(),
    findOneOrFail: jest.fn<(query: unknown) => Promise<T>>(),
    findOneBy: jest.fn<(query: unknown) => Promise<T | null>>(),
    existsBy: jest.fn<(query: unknown) => Promise<boolean>>().mockResolvedValue(false),
    find: jest.fn<(query: unknown) => Promise<T[]>>().mockResolvedValue([]),
  };
}

function mockQuery() {
  const query = {
    leftJoinAndSelect: jest.fn(), where: jest.fn(), andWhere: jest.fn(),
    orderBy: jest.fn(), addOrderBy: jest.fn(),
    getExists: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
    getMany: jest.fn<() => Promise<Maintenance[]>>().mockResolvedValue([]),
  };
  for (const method of [query.leftJoinAndSelect, query.where, query.andWhere, query.orderBy, query.addOrderBy]) method.mockReturnValue(query);
  return query;
}

const actor: PublicUser = { id: 'user-id', name: 'Técnico', email: 'tech@example.com', role: Role.TECHNICIAN, createdAt: new Date() };
const admin: PublicUser = { ...actor, id: 'admin-id', role: Role.ADMIN };
const dto = { type: MaintenanceType.PREVENTIVE, description: 'Revisión de frenos', mileage: 45000, vehicleId: 'vehicle-id', mechanicId: 'mechanic-id', workshopId: 'workshop-id', scheduledStart: '2026-11-01T07:30:00-05:00', scheduledEnd: '2026-11-01T09:00:00-05:00' };

describe('MaintenancesService', () => {
  let service: MaintenancesService;
  let maintenances: ReturnType<typeof mockRepository<Maintenance>>;
  let vehicles: ReturnType<typeof mockRepository<Vehicle>>;
  let mechanics: ReturnType<typeof mockRepository<Mechanic>>;
  let workshops: ReturnType<typeof mockRepository<Workshop>>;
  let audits: ReturnType<typeof mockRepository<MaintenanceAudit>>;
  let query: ReturnType<typeof mockQuery>;
  let transaction: ReturnType<typeof jest.fn<(callback: (manager: EntityManager) => Promise<unknown>) => Promise<unknown>>>;
  let maintenance: Maintenance;
  let vehicle: Vehicle;
  let mechanic: Mechanic;
  let workshop: Workshop;

  beforeEach(() => {
    maintenances = mockRepository<Maintenance>();
    vehicles = mockRepository<Vehicle>();
    mechanics = mockRepository<Mechanic>();
    workshops = mockRepository<Workshop>();
    audits = mockRepository<MaintenanceAudit>();
    query = mockQuery();
    vehicle = Object.assign(new Vehicle(), { id: dto.vehicleId, mileage: 45000, status: VehicleStatus.AVAILABLE });
    mechanic = Object.assign(new Mechanic(), { id: dto.mechanicId, userId: actor.id, status: MechanicStatus.ACTIVE });
    workshop = Object.assign(new Workshop(), { id: dto.workshopId, status: WorkshopStatus.ACTIVE });
    maintenance = Object.assign(new Maintenance(), { id: 'maintenance-id', status: Status.SCHEDULED, vehicleId: vehicle.id, mechanicId: mechanic.id, workshopId: workshop.id, mileage: 45000, startedAt: new Date('2026-11-01T12:30:00Z'), vehicle, mechanic, workshop });
    vehicles.findOne.mockResolvedValue(vehicle);
    vehicles.findOneOrFail.mockResolvedValue(vehicle);
    vehicles.existsBy.mockResolvedValue(true);
    mechanics.findOne.mockResolvedValue(mechanic);
    mechanics.findOneOrFail.mockResolvedValue(mechanic);
    mechanics.findOneBy.mockResolvedValue(mechanic);
    workshops.findOne.mockResolvedValue(workshop);
    workshops.findOneOrFail.mockResolvedValue(workshop);
    maintenances.findOne.mockResolvedValue(maintenance);
    maintenances.findOneOrFail.mockResolvedValue(maintenance);
    maintenances.save.mockImplementation(async data => Object.assign(data, { id: maintenance.id }));
    const manager = { getRepository: (entity: unknown) => {
      if (entity === Maintenance) return maintenances;
      if (entity === MaintenanceAudit) return audits;
      if (entity === Vehicle) return vehicles;
      if (entity === Mechanic) return mechanics;
      if (entity === Workshop) return workshops;
      throw new Error('Entidad inesperada');
    } } as unknown as EntityManager;
    transaction = jest.fn<(callback: (manager: EntityManager) => Promise<unknown>) => Promise<unknown>>().mockImplementation(callback => callback(manager));
    const repository = Object.assign(maintenances, { createQueryBuilder: () => query, manager: { ...manager, transaction } });
    service = new MaintenancesService(repository as unknown as Repository<Maintenance>);
  });

  it('reserva mediante transacción y registra autor y estado inicial', async () => {
    await service.create(dto, admin);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(maintenances.save).toHaveBeenCalledWith(expect.objectContaining({ status: Status.SCHEDULED, vehicleId: vehicle.id, mechanicId: mechanic.id }));
    expect(audits.save).toHaveBeenCalledWith(expect.objectContaining({ maintenanceId: maintenance.id, actorId: admin.id, fromStatus: null, toStatus: Status.SCHEDULED }));
    expect(vehicles.save).not.toHaveBeenCalled();
    expect(mechanics.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
  });

  it.each(['mechanic', 'vehicle', 'workshop'])('rechaza %s inexistente sin guardar mantenimiento ni auditoría', async (resource) => {
    if (resource === 'mechanic') mechanics.findOne.mockResolvedValue(null);
    if (resource === 'vehicle') vehicles.findOne.mockResolvedValue(null);
    if (resource === 'workshop') workshops.findOne.mockResolvedValue(null);
    await expect(service.create(dto, admin)).rejects.toBeInstanceOf(NotFoundException);
    expect(maintenances.save).not.toHaveBeenCalled();
    expect(audits.save).not.toHaveBeenCalled();
  });

  it.each(['mechanic', 'vehicle', 'workshop'])('rechaza %s inactivo sin guardar la reserva', async (resource) => {
    if (resource === 'mechanic') mechanic.status = MechanicStatus.INACTIVE;
    if (resource === 'vehicle') vehicle.status = VehicleStatus.INACTIVE;
    if (resource === 'workshop') workshop.status = WorkshopStatus.INACTIVE;
    await expect(service.create(dto, admin)).rejects.toBeInstanceOf(ConflictException);
    expect(maintenances.save).not.toHaveBeenCalled();
  });

  it('rechaza kilometraje inferior, vehículo reservado y horario cruzado', async () => {
    await expect(service.create({ ...dto, mileage: 44999 }, admin)).rejects.toThrow('kilometraje');
    maintenances.existsBy.mockResolvedValueOnce(true);
    await expect(service.create(dto, admin)).rejects.toThrow('vehículo ya tiene');
    query.getExists.mockResolvedValueOnce(true);
    await expect(service.create(dto, admin)).rejects.toThrow('cruza');
    expect(maintenances.save).not.toHaveBeenCalled();
    expect(audits.save).not.toHaveBeenCalled();
  });

  it('aplica el ámbito del técnico junto con todos los filtros solicitados', async () => {
    await service.findAll({ status: Status.SCHEDULED, type: MaintenanceType.PREVENTIVE, vehicleId: 'v', mechanicId: 'other', active: 'true' }, actor);
    expect(query.andWhere).toHaveBeenCalledWith('mechanic.userId = :userId', { userId: actor.id });
    expect(query.andWhere).toHaveBeenCalledWith('m.mechanicId = :mechanicId', { mechanicId: 'other' });
    expect(query.andWhere).toHaveBeenCalledWith('m.vehicleId = :vehicleId', { vehicleId: 'v' });
    expect(query.andWhere).toHaveBeenCalledWith('m.status = :status', { status: Status.SCHEDULED });
    expect(query.andWhere).toHaveBeenCalledWith('m.type = :type', { type: MaintenanceType.PREVENTIVE });
    expect(query.andWhere).toHaveBeenCalledWith(expect.stringContaining('IN ('), expect.any(Object));
  });

  it('permite consultas globales al administrador y filtra los estados finales', async () => {
    await service.findAll({ active: 'false' }, admin);
    expect(query.andWhere).toHaveBeenCalledWith(expect.stringContaining('NOT IN'), expect.any(Object));
    expect(query.andWhere).not.toHaveBeenCalledWith('mechanic.userId = :userId', expect.anything());
  });

  it('restringe detalles de intervenciones ajenas y responde 404 si no existen', async () => {
    expect(await service.findOne(maintenance.id, actor)).toBe(maintenance);
    expect(await service.findOne(maintenance.id, admin)).toBe(maintenance);
    await expect(service.findOne(maintenance.id, { ...actor, id: 'outsider' })).rejects.toBeInstanceOf(ForbiddenException);
    maintenances.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing', admin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('valida vehículos y mecánicos antes de devolver historiales', async () => {
    await service.history(vehicle.id, actor);
    expect(query.andWhere).toHaveBeenCalledWith('m.vehicleId = :vehicleId', { vehicleId: vehicle.id });
    vehicles.existsBy.mockResolvedValue(false);
    await expect(service.history('missing', admin)).rejects.toBeInstanceOf(NotFoundException);
    await service.byMechanic(mechanic.id, actor);
    await expect(service.byMechanic(mechanic.id, { ...actor, id: 'outsider' })).rejects.toBeInstanceOf(ForbiddenException);
    mechanics.findOneBy.mockResolvedValue(null);
    await expect(service.byMechanic('missing', admin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('consulta la auditoría del mantenimiento existente', async () => {
    await service.audits(maintenance.id, admin);
    expect(audits.find).toHaveBeenCalledWith({ where: { maintenanceId: maintenance.id }, order: { createdAt: 'ASC', id: 'ASC' } });
  });

  it('rechaza transiciones de usuarios ajenos antes de escribir', async () => {
    await expect(service.updateStatus(maintenance.id, { status: Status.IN_PROGRESS }, { ...actor, id: 'outsider' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(vehicles.save).not.toHaveBeenCalled();
    expect(audits.save).not.toHaveBeenCalled();
    maintenances.findOne.mockResolvedValue(null);
    await expect(service.updateStatus('missing', { status: Status.IN_PROGRESS }, admin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([Status.COMPLETED, Status.CANCELLED])('no reabre el estado final %s', async (status) => {
    maintenance.status = status;
    await expect(service.updateStatus(maintenance.id, { status: Status.IN_PROGRESS }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(vehicles.save).not.toHaveBeenCalled();
    expect(audits.save).not.toHaveBeenCalled();
  });

  it('inicia la intervención y marca el vehículo en mantenimiento', async () => {
    await service.updateStatus(maintenance.id, { status: Status.IN_PROGRESS }, actor);
    expect(vehicles.save).toHaveBeenCalledWith(expect.objectContaining({ status: VehicleStatus.IN_MAINTENANCE }));
    expect(maintenances.save).toHaveBeenCalledWith(expect.objectContaining({ status: Status.IN_PROGRESS, startedAt: expect.any(Date) }));
    expect(audits.save).toHaveBeenCalledWith(expect.objectContaining({ actorId: actor.id, fromStatus: Status.SCHEDULED, toStatus: Status.IN_PROGRESS }));
  });

  it.each(['mechanic', 'vehicle', 'workshop', 'already-running'])('rechaza iniciar por recurso no disponible: %s', async (reason) => {
    if (reason === 'mechanic') mechanic.status = MechanicStatus.INACTIVE;
    if (reason === 'vehicle') vehicle.status = VehicleStatus.INACTIVE;
    if (reason === 'workshop') workshop.status = WorkshopStatus.INACTIVE;
    if (reason === 'already-running') maintenances.existsBy.mockResolvedValue(true);
    await expect(service.updateStatus(maintenance.id, { status: Status.IN_PROGRESS }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(vehicles.save).not.toHaveBeenCalled();
    expect(audits.save).not.toHaveBeenCalled();
  });

  it('cancela pendientes sin cambiar el estado del vehículo', async () => {
    await service.updateStatus(maintenance.id, { status: Status.CANCELLED }, actor);
    expect(vehicles.save).not.toHaveBeenCalled();
    expect(audits.save).toHaveBeenCalledWith(expect.objectContaining({ fromStatus: Status.SCHEDULED, toStatus: Status.CANCELLED }));
  });

  it('no admite datos de cierre al cancelar', async () => {
    await expect(service.updateStatus(maintenance.id, { status: Status.CANCELLED, finalCost: 10 }, actor)).rejects.toThrow('solo se admiten al completar');
    expect(maintenances.save).not.toHaveBeenCalled();
  });

  it('completa con kilometraje actualizado y disponibilidad del vehículo', async () => {
    maintenance.status = Status.IN_PROGRESS;
    vehicle.status = VehicleStatus.IN_MAINTENANCE;
    await service.updateStatus(maintenance.id, { status: Status.COMPLETED, workPerformed: 'Cambio de filtros', finalCost: 200.5, finishedAt: '2026-11-01T14:00:00Z', finalMileage: 45100 }, actor);
    expect(maintenances.save).toHaveBeenCalledWith(expect.objectContaining({ status: Status.COMPLETED, finalCost: '200.50', finalMileage: 45100 }));
    expect(vehicles.save).toHaveBeenCalledWith(expect.objectContaining({ status: VehicleStatus.AVAILABLE, mileage: 45100 }));
    expect(audits.save).toHaveBeenCalledWith(expect.objectContaining({ fromStatus: Status.IN_PROGRESS, toStatus: Status.COMPLETED }));
  });

  it('rechaza cierre incompleto o con kilometraje desactualizado sin cambiar el vehículo', async () => {
    maintenance.status = Status.IN_PROGRESS;
    await expect(service.updateStatus(maintenance.id, { status: Status.COMPLETED }, actor)).rejects.toThrow('se requiere');
    vehicle.mileage = 47000;
    await expect(service.updateStatus(maintenance.id, { status: Status.COMPLETED, workPerformed: 'Cambio de filtros', finalCost: 200, finishedAt: '2026-11-01T14:00:00Z', finalMileage: 45100 }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(vehicles.save).not.toHaveBeenCalled();
    expect(audits.save).not.toHaveBeenCalled();
  });
});
