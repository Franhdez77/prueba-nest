import { SetMetadata } from '@nestjs/common';
import { Role } from '../../users/role.enum.js';
export const ROLES = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
