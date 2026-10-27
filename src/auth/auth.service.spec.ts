import { jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/user.entity.js';
import { Role } from '../users/role.enum.js';

const id = '10000000-0000-4000-8000-000000000001';
const jwt = new JwtService({ secret: 'test-secret-used-only-by-unit-tests', signOptions: { expiresIn: '1h' } });

// Replace only persistence; exercise the real password hashing and JWT implementations.
describe('AuthService', () => {
  let stored: User;
  let service: AuthService;
  let users: {
    create: ReturnType<typeof jest.fn<UsersService['create']>>;
    findForLogin: ReturnType<typeof jest.fn<UsersService['findForLogin']>>;
  };

  beforeAll(async () => {
    stored = Object.assign(new User(), { id, name: 'Técnico', email: 'tech@example.com', role: Role.TECHNICIAN, createdAt: new Date(), passwordHash: await hashPassword('ClaveSegura123!') });
  });

  beforeEach(() => {
    users = { create: jest.fn<UsersService['create']>(), findForLogin: jest.fn<UsersService['findForLogin']>() };
    service = new AuthService(users as unknown as UsersService, jwt);
  });

  it('registra con hash verificable sin devolver contraseña ni hash', async () => {
    users.create.mockImplementation(async (name, email, passwordHash) => Object.assign(new User(), { ...stored, name, email, passwordHash }));
    const result = await service.register({ name: 'Técnico', email: stored.email, password: 'ClaveSegura123!' });
    expect(result).toMatchObject({ id, email: stored.email, role: Role.TECHNICIAN });
    expect(result).not.toHaveProperty('passwordHash');
    const hash = users.create.mock.calls[0][2];
    expect(hash).not.toBe('ClaveSegura123!');
    expect(await verifyPassword(hash, 'ClaveSegura123!')).toBe(true);
    expect(users.create.mock.calls[0]).toHaveLength(3);
  });

  it('registra ADMIN o TECHNICIAN desde el flujo administrativo y omite el hash', async () => {
    users.create.mockImplementation(async (name, email, passwordHash, role) => Object.assign(new User(), { ...stored, name, email, passwordHash, role }));
    for (const role of [Role.ADMIN, Role.TECHNICIAN]) {
      const result = await service.registerUser({ name: 'Usuario', email: stored.email, password: 'ClaveSegura123!', role });
      expect(result.role).toBe(role);
      expect(result).not.toHaveProperty('passwordHash');
      const call = users.create.mock.calls.at(-1)!;
      expect(call[3]).toBe(role);
      expect(await verifyPassword(call[2], 'ClaveSegura123!')).toBe(true);
    }
  });

  it('conserva el conflicto de correo duplicado', async () => {
    users.create.mockRejectedValue(new ConflictException('El correo ya está registrado'));
    await expect(service.register({ name: 'Técnico', email: stored.email, password: 'ClaveSegura123!' })).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([false, true])('rechaza usuario ausente o contraseña equivocada (usuario existe: %s)', async (exists) => {
    users.findForLogin.mockResolvedValue(exists ? stored : null);
    await expect(service.login({ email: stored.email, password: 'Incorrecta' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('entrega un JWT firmado con sujeto, rol y caducidad; omite el hash', async () => {
    users.findForLogin.mockResolvedValue(stored);
    const result = await service.login({ email: stored.email, password: 'ClaveSegura123!' });
    const payload = await jwt.verifyAsync<{ sub: string; role: Role; iat: number; exp: number }>(result.accessToken);
    expect(payload).toMatchObject({ sub: id, role: Role.TECHNICIAN });
    expect(payload.exp - payload.iat).toBe(3600);
    expect(result).toMatchObject({ tokenType: 'Bearer', expiresIn: 3600 });
    expect(result.user).not.toHaveProperty('passwordHash');
  });
});
