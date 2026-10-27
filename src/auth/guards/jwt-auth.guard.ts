import { API_KEY_AUTH } from '../decorators/api-key-auth.decorator.js';
import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service.js';
import { publicUser } from '../../users/user.entity.js';
import { IS_PUBLIC } from '../decorators/public.decorator.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Only explicitly marked public endpoints bypass JWT authentication.
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    // Integration endpoints delegate authentication to the API Key guard.
    if (
      this.reflector.getAllAndOverride<boolean>(API_KEY_AUTH, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer (\S+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Se requiere un token Bearer');
    let subject: number;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: unknown }>(match[1], {
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string' || !/^[1-9]\d*$/.test(payload.sub)) {
        throw new Error('Invalid subject');
      }
      subject = Number(payload.sub);
      if (!Number.isSafeInteger(subject) || subject > 2147483647) {
        throw new Error('Invalid subject');
      }
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    // Read the current role from the database instead of trusting the token alone.
    const user = await this.users.findById(subject);
    if (!user) throw new UnauthorizedException('Usuario no disponible');
    request.user = publicUser(user);
    return true;
  }
}
