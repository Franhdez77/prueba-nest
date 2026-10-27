import { jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { QueryFailedError, type Repository } from 'typeorm';
import { UsersService } from './users.service.js';
import { User } from './user.entity.js';
import { Role } from './role.enum.js';

describe('UsersService', () => {
  const repository = {
    create: jest.fn<(data: Partial<User>) => User>(),
    save: jest.fn<(user: User) => Promise<User>>(),
  };
  const service = new UsersService(repository as unknown as Repository<User>);
  beforeEach(() => {
    repository.create.mockReset().mockImplementation(data => Object.assign(new User(), data));
    repository.save.mockReset().mockImplementation(async user => user);
  });

  it('normaliza correos y usa el rol TECHNICIAN por defecto', async () => {
    const user = await service.create('Técnico', ' TECH@EXAMPLE.COM ', 'hash');
    expect(user).toMatchObject({ email: 'tech@example.com', role: Role.TECHNICIAN, passwordHash: 'hash' });
  });

  it('conserva el rol ADMIN cuando lo crea el flujo autorizado', async () => {
    expect((await service.create('Admin', 'admin@example.com', 'hash', Role.ADMIN)).role).toBe(Role.ADMIN);
  });

  it('traduce unicidad a 409 y conserva otros errores', async () => {
    repository.save.mockRejectedValueOnce(new QueryFailedError('INSERT', [], Object.assign(new Error('duplicate'), { code: '23505' })));
    await expect(service.create('Técnico', 'tech@example.com', 'hash')).rejects.toBeInstanceOf(ConflictException);
    const failure = new Error('database offline');
    repository.save.mockRejectedValueOnce(failure);
    await expect(service.create('Técnico', 'tech@example.com', 'hash')).rejects.toBe(failure);
  });
});
