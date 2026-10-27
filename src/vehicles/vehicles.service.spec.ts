import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import { VehiclesService } from './vehicles.service.js';
import { Vehicle } from './vehicle.entity.js';
import { VehicleStatus as Status } from './vehicle-status.enum.js';

describe('VehiclesService', () => {
  let vehicle: Vehicle;
  let service: VehiclesService;
  let findOne: ReturnType<typeof jest.fn<(query: unknown) => Promise<Vehicle | null>>>;
  let save: ReturnType<typeof jest.fn<(data: Vehicle) => Promise<Vehicle>>>;
  let transaction: ReturnType<typeof jest.fn<(callback: (manager: EntityManager) => Promise<unknown>) => Promise<unknown>>>;

  beforeEach(() => {
    vehicle = Object.assign(new Vehicle(), { id: 'vehicle-id', plate: 'ABC123', brand: 'Toyota', model: 'Hilux', year: 2024, mileage: 45000, status: Status.AVAILABLE });
    findOne = jest.fn<(query: unknown) => Promise<Vehicle | null>>().mockResolvedValue(vehicle);
    save = jest.fn<(data: Vehicle) => Promise<Vehicle>>().mockImplementation(async data => data);
    const repository = { findOne, save };
    const manager = { getRepository: () => repository } as unknown as EntityManager;
    transaction = jest.fn<(callback: (manager: EntityManager) => Promise<unknown>) => Promise<unknown>>().mockImplementation(callback => callback(manager));
    service = new VehiclesService({ manager: { transaction } } as unknown as Repository<Vehicle>);
  });

  it('inactiva conservando identidad, placa y kilometraje dentro de una transacción', async () => {
    const result = await service.deactivate(vehicle.id);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ id: vehicle.id, plate: 'ABC123', mileage: 45000, status: Status.INACTIVE });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('reactiva un vehículo inactivo sin reemplazar el registro', async () => {
    vehicle.status = Status.INACTIVE;
    expect(await service.update(vehicle.id, { status: Status.AVAILABLE })).toBe(vehicle);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: vehicle.id, status: Status.AVAILABLE }));
  });

  it.each([{ status: Status.AVAILABLE }, { status: Status.INACTIVE }, { mileage: 45100 }] as const)('impide cambios manuales durante una intervención: %j', async (update) => {
    vehicle.status = Status.IN_MAINTENANCE;
    await expect(service.update(vehicle.id, update)).rejects.toBeInstanceOf(ConflictException);
    expect(save).not.toHaveBeenCalled();
    expect(vehicle).toMatchObject({ status: Status.IN_MAINTENANCE, mileage: 45000 });
  });

  it('permite corregir datos descriptivos sin liberar un vehículo en intervención', async () => {
    vehicle.status = Status.IN_MAINTENANCE;
    await service.update(vehicle.id, { model: 'Hilux 4x4' });
    expect(vehicle).toMatchObject({ model: 'Hilux 4x4', status: Status.IN_MAINTENANCE });
  });

  it('responde 404 sin guardar cuando el vehículo no existe', async () => {
    findOne.mockResolvedValue(null);
    await expect(service.update('missing', { model: 'Otro' })).rejects.toBeInstanceOf(NotFoundException);
    expect(save).not.toHaveBeenCalled();
  });

  it('normaliza la placa en consultas y distingue recursos inexistentes', async () => {
    const findOneBy = jest.fn<(query: unknown) => Promise<Vehicle | null>>().mockResolvedValue(vehicle);
    const reads = new VehiclesService({ findOneBy } as unknown as Repository<Vehicle>);
    expect(await reads.findByPlate(' abc123 ')).toBe(vehicle);
    expect(findOneBy).toHaveBeenCalledWith({ plate: 'ABC123' });
    findOneBy.mockResolvedValue(null);
    await expect(reads.findByPlate('missing')).rejects.toBeInstanceOf(NotFoundException);
    await expect(reads.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
