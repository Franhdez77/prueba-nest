import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './user.entity.js';
import { Role } from './role.enum.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(
    name: string,
    email: string,
    passwordHash: string,
    role = Role.TECHNICIAN,
  ) {
    try {
      return await this.users.save(
        this.users.create({
          name,
          email: email.trim().toLowerCase(),
          passwordHash,
          role,
        }),
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('El correo ya está registrado');
      }
      throw error;
    }
  }

  findById(id: string) {
    return this.users.findOneBy({ id });
  }

  findForLogin(email: string) {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }
}
