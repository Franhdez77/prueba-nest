import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import { MechanicsService } from './mechanics.service.js';
import { Mechanic } from './mechanic.entity.js';
import { MechanicStatus as Status } from './mechanic-status.enum.js';
import { User } from '../users/user.entity.js';
import { Role } from '../users/role.enum.js';

describe('MechanicsService', () => {
  let service: MechanicsService;
  let mechanic: Mechanic;
  let user: User;
  let users: { findOneBy: ReturnType<typeof jest.fn<(query: unknown) => Promise<User | null>>> };
  let repository: {
    create: ReturnType<typeof jest.fn<(data: Partial<Mechanic>) => Mechanic>>;
    save: ReturnType<typeof jest.fn<(data: Mechanic) => Promise<Mechanic>>>;
    findOne: ReturnType<typeof jest.fn<(query: unknown) => Promise<Mechanic | null>>>;
  };
  const dto = { name: 'Juan Pérez', email: 'juan@example.com', specialty: 'Motor' };

  beforeEach(() => {
    mechanic = Object.assign(new Mechanic(), { ...dto, id: 'mechanic-id', userId: 'tech-id', status: Status.ACTIVE });
    user = Object.assign(new User(), { id: 'tech-id', role: Role.TECHNICIAN });
    users = { findOneBy: jest.fn<(query: unknown) => Promise<User | null>>().mockResolvedValue(user) };
    repository = {
      create: jest.fn<(data: Partial<Mechanic>) => Mechanic>().mockImplementation(data => Object.assign(new Mechanic(), data)),
      save: jest.fn<(data: Mechanic) => Promise<Mechanic>>().mockImplementation(async data => data),
      findOne: jest.fn<(query: unknown) => Promise<Mechanic | null>>().mockResolvedValue(mechanic),
    };
    const manager = { getRepository: (entity: unknown) => entity === User ? users : repository } as unknown as EntityManager;
    service = new MechanicsService({ manager: { transaction: (callback: (manager: EntityManager) => Promise<unknown>) => callback(manager) } } as unknown as Repository<Mechanic>);
  });

  it('registra un mecánico activo sin exigir cuenta de acceso', async () => {
    expect(await service.create(dto)).toMatchObject({ ...dto, status: Status.ACTIVE, userId: null });
    expect(users.findOneBy).not.toHaveBeenCalled();
  });

  it('vincula una cuenta técnica existente', async () => {
    expect(await service.create({ ...dto, userId: user.id })).toMatchObject({ userId: user.id, status: Status.ACTIVE });
  });

  it('rechaza cuentas inexistentes o con rol administrador antes de guardar', async () => {
    users.findOneBy.mockResolvedValueOnce(null);
    await expect(service.create({ ...dto, userId: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
    user.role = Role.ADMIN;
    await expect(service.create({ ...dto, userId: user.id })).rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('inactiva y reactiva conservando identidad y vínculo con el técnico', async () => {
    expect(await service.deactivate(mechanic.id)).toMatchObject({ id: mechanic.id, status: Status.INACTIVE, userId: user.id });
    expect(await service.update(mechanic.id, { status: Status.ACTIVE })).toMatchObject({ id: mechanic.id, status: Status.ACTIVE, userId: user.id });
  });

  it('desvincula explícitamente sin borrar el mecánico', async () => {
    expect(await service.update(mechanic.id, { userId: null })).toMatchObject({ id: mechanic.id, userId: null });
    expect(users.findOneBy).not.toHaveBeenCalled();
  });

  it('no persiste cambios si la nueva cuenta no es técnica', async () => {
    user.role = Role.ADMIN;
    await expect(service.update(mechanic.id, { name: 'Cambio', userId: user.id })).rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
    expect(mechanic.name).toBe(dto.name);
  });

  it('responde 404 sin guardar cuando el mecánico no existe', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.update('missing', { status: Status.ACTIVE })).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
