import { createHash, timingSafeEqual } from 'node:crypto';
import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { API_KEY_AUTH } from '../decorators/api-key-auth.decorator.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (
      !this.reflector.getAllAndOverride<boolean>(API_KEY_AUTH, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-api-key'];
    if (typeof provided !== 'string' || !provided) {
      throw new UnauthorizedException('Se requiere x-api-key');
    }
    // Compare fixed-length hashes with a timing-safe operation.
    const expectedHash = createHash('sha256')
      .update(this.config.getOrThrow<string>('API_KEY'))
      .digest();
    const providedHash = createHash('sha256').update(provided).digest();
    if (!timingSafeEqual(expectedHash, providedHash)) {
      throw new UnauthorizedException('API Key incorrecta');
    }
    return true;
  }
}
