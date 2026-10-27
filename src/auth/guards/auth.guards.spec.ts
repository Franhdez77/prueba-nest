import 'reflect-metadata';
import { jest } from '@jest/globals';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';
import { ApiKeyGuard } from './api-key.guard.js';
import { Public } from '../decorators/public.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { ApiKeyAuth } from '../decorators/api-key-auth.decorator.js';
import { UsersService } from '../../users/users.service.js';
import { Role } from '../../users/role.enum.js';
import { User, type PublicUser } from '../../users/user.entity.js';

class Endpoints {
  @Public() public() {}
  @ApiKeyAuth() integration() {}
  @Roles(Role.ADMIN) admin() {}
  plain() {}
}
@Roles(Role.ADMIN)
class RestrictedEndpoints {
  plain() {}
  @Roles(Role.TECHNICIAN) technician() {}
}

function contextFor(handler: Function, controller: Function, headers: Record<string, string | string[]> = {}, user?: PublicUser) {
  const request = { headers, user };
  const context = {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

const id = '10000000-0000-4000-8000-000000000001';
const user = Object.assign(new User(), { id, name: 'Técnico', email: 'tech@example.com', role: Role.TECHNICIAN, createdAt: new Date(), passwordHash: 'private' });
const reflector = new Reflector();
const jwt = new JwtService({ secret: 'test-secret-used-only-by-unit-tests' });

describe('JwtAuthGuard', () => {
  const users = { findById: jest.fn<UsersService['findById']>() };
  const guard = new JwtAuthGuard(reflector, jwt, users as unknown as UsersService);
  beforeEach(() => users.findById.mockReset());

  it.each([Endpoints.prototype.public, Endpoints.prototype.integration])('delega las rutas públicas y de integración sin consultar usuarios', async (handler) => {
    const { context } = contextFor(handler, Endpoints);
    expect(await guard.canActivate(context)).toBe(true);
    expect(users.findById).not.toHaveBeenCalled();
  });

  it.each([undefined, 'Basic token', 'Bearer ', 'Bearer token extra'])('rechaza encabezados ausentes o mal formados: %s', async (authorization) => {
    const { context } = contextFor(Endpoints.prototype.plain, Endpoints, authorization ? { authorization } : {});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('rechaza tokens inválidos, expirados, con otra firma o sin un sujeto UUID', async () => {
    const otherJwt = new JwtService({ secret: 'other-secret' });
    for (const token of ['invalid', await jwt.signAsync({ sub: id }, { expiresIn: -1 }), await otherJwt.signAsync({ sub: id }), await jwt.signAsync({ sub: 'invalid' }), await jwt.signAsync({}), await jwt.signAsync({ sub: 123 })]) {
      const { context } = contextFor(Endpoints.prototype.plain, Endpoints, { authorization: `Bearer ${token}` });
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    }
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('rechaza tokens cuyo usuario ya no existe', async () => {
    users.findById.mockResolvedValue(null);
    const { context } = contextFor(Endpoints.prototype.plain, Endpoints, { authorization: `Bearer ${await jwt.signAsync({ sub: id })}` });
    await expect(guard.canActivate(context)).rejects.toThrow('Usuario no disponible');
  });

  it('usa el rol vigente en la base y no expone el hash', async () => {
    users.findById.mockResolvedValue(user);
    const { context, request } = contextFor(Endpoints.prototype.plain, Endpoints, { authorization: `Bearer ${await jwt.signAsync({ sub: id, role: Role.ADMIN })}` });
    expect(await guard.canActivate(context)).toBe(true);
    expect(request.user?.role).toBe(Role.TECHNICIAN);
    expect(request.user).not.toHaveProperty('passwordHash');
  });

  it('no disfraza fallos de persistencia como credenciales inválidas', async () => {
    const failure = new Error('database offline');
    users.findById.mockRejectedValue(failure);
    const { context } = contextFor(Endpoints.prototype.plain, Endpoints, { authorization: `Bearer ${await jwt.signAsync({ sub: id })}` });
    await expect(guard.canActivate(context)).rejects.toBe(failure);
  });
});

describe('RolesGuard', () => {
  const guard = new RolesGuard(reflector);
  it('permite rutas sin restricción de rol', () => {
    expect(guard.canActivate(contextFor(Endpoints.prototype.plain, Endpoints).context)).toBe(true);
  });
  it('rechaza usuario ausente y roles no permitidos', () => {
    expect(() => guard.canActivate(contextFor(Endpoints.prototype.admin, Endpoints).context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor(Endpoints.prototype.admin, Endpoints, {}, user).context)).toThrow(ForbiddenException);
  });
  it('aplica roles de clase y da prioridad a los del endpoint', () => {
    expect(guard.canActivate(contextFor(RestrictedEndpoints.prototype.plain, RestrictedEndpoints, {}, { ...user, role: Role.ADMIN }).context)).toBe(true);
    expect(() => guard.canActivate(contextFor(RestrictedEndpoints.prototype.plain, RestrictedEndpoints, {}, user).context)).toThrow(ForbiddenException);
    expect(guard.canActivate(contextFor(RestrictedEndpoints.prototype.technician, RestrictedEndpoints, {}, user).context)).toBe(true);
  });
});

describe('ApiKeyGuard', () => {
  const key = 'test-integration-api-key';
  const guard = new ApiKeyGuard(reflector, new ConfigService({ API_KEY: key }));
  it('no exige API Key en rutas que usan otro mecanismo', () => {
    expect(guard.canActivate(contextFor(Endpoints.prototype.plain, Endpoints).context)).toBe(true);
  });
  it.each([undefined, '', ['one', 'two'], 'incorrect', 'long-incorrect-key-value'])('rechaza claves ausentes o incorrectas: %s', (value) => {
    const { context } = contextFor(Endpoints.prototype.integration, Endpoints, value === undefined ? {} : { 'x-api-key': value });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
  it('permite únicamente la clave configurada', () => {
    const { context } = contextFor(Endpoints.prototype.integration, Endpoints, { 'x-api-key': key });
    expect(guard.canActivate(context)).toBe(true);
  });
});
