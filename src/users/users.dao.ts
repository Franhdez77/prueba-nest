import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './user.entity.js';

@Injectable()
export class UsersDao {
  constructor(@InjectRepository(User) private readonly repository: Repository<User>) {}

  transaction<T>(work: (dao: UsersDao) => Promise<T>): Promise<T> {
    return this.repository.manager.transaction(manager => work(new UsersDao(manager.getRepository(User))));
  }

  async create(data: Pick<User, 'name' | 'email' | 'passwordHash' | 'role'>) {
    try {
      return await this.repository.save(this.repository.create(data));
    } catch (error) {
      this.translateConflict(error, 'El correo ya está registrado');
    }
  }

  private translateConflict(error: unknown, message: string): never {
    if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') {
      throw new ConflictException(message);
    }
    throw error;
  }

  async saveGithubLink(user: User) {
    try { return await this.repository.save(user); }
    catch (error) { this.translateConflict(error, 'This GitHub account is already linked to another user'); }
  }

  findById(id: number) { return this.repository.findOneBy({ id }); }
  findByGithubId(githubId: string) { return this.repository.findOneBy({ githubId }); }
  findLockedWithGithub(userId: number) {
    return this.repository.createQueryBuilder('user')
      .addSelect('user.githubId').setLock('pessimistic_write')
      .where('user.id = :userId', { userId }).getOne();
  }
  findForLogin(email: string) {
    return this.repository.createQueryBuilder('user').addSelect('user.passwordHash')
      .where('user.email = :email', { email }).getOne();
  }
}
