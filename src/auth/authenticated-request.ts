import type { Request } from 'express';
import type { PublicUser } from '../users/user.entity.js';
export interface AuthenticatedRequest extends Request {
  user: PublicUser;
}
