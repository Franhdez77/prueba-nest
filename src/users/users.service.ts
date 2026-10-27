import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersDao } from './users.dao.js';
import { Role } from './role.enum.js';

@Injectable()
export class UsersService {
  constructor(@Inject(UsersDao) private readonly users: UsersDao) {}

  create(name: string, email: string, passwordHash: string, role = Role.TECHNICIAN) {
    return this.users.create({ name, email: email.trim().toLowerCase(), passwordHash, role });
  }

  linkGithub(userId: number, githubId: string) {
    return this.users.transaction(async dao => {
      const user = await dao.findLockedWithGithub(userId);
      if (!user) throw new UnauthorizedException('FleetCore account no longer exists');
      if (user.githubId && user.githubId !== githubId) {
        throw new ConflictException('This FleetCore account already has a different GitHub account linked');
      }
      user.githubId = githubId;
      return dao.saveGithubLink(user);
    });
  }

  findByGithubId(githubId: string) { return this.users.findByGithubId(githubId); }
  findById(id: number) { return this.users.findById(id); }
  findForLogin(email: string) { return this.users.findForLogin(email.trim().toLowerCase()); }
}
