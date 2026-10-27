import {
  Inject,
  Injectable,
  ForbiddenException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../users/role.enum.js';
import { ROLES } from '../decorators/roles.decorator.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    // Endpoint roles override controller roles; the JWT guard supplies the current user.
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user || !roles.includes(user.role))
      throw new ForbiddenException('No tienes permisos para esta operación');
    return true;
  }
}
