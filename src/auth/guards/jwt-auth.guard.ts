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
import { isUUID } from 'class-validator';
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
    // Solo los endpoints marcados explícitamente quedan fuera de la protección JWT.
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    // Las integraciones usan el guard de API Key en lugar del token JWT.
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
    let subject: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(match[1], {
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string' || !isUUID(payload.sub))
        throw new Error('Invalid subject');
      subject = payload.sub;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    // El rol vigente se consulta en la base, no se confía únicamente en el token.
    const user = await this.users.findById(subject);
    if (!user) throw new UnauthorizedException('Usuario no disponible');
    request.user = publicUser(user);
    return true;
  }
}
