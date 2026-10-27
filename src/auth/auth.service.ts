import type { RegisterUserDto } from './dto/register-user.dto.js';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from './password.js';
import { UsersService } from '../users/users.service.js';
import { publicUser, type User } from '../users/user.entity.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // Persist only the password hash and return a profile without credentials.
    const passwordHash = await hashPassword(dto.password);
    return publicUser(
      await this.users.create(dto.name, dto.email, passwordHash),
    );
  }

  async registerUser(dto: RegisterUserDto) {
    const passwordHash = await hashPassword(dto.password);
    return publicUser(
      await this.users.create(dto.name, dto.email, passwordHash, dto.role),
    );
  }

  async login(dto: LoginDto) {
    const user = await this.users.findForLogin(dto.email);
    if (!user || !(await verifyPassword(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    return this.issueToken(user);
  }

  async issueToken(user: User) {
    // Keep credentials out of the token; authorization rechecks the database role.
    return {
      accessToken: await this.jwt.signAsync({ sub: String(user.id), role: user.role }),
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: publicUser(user),
    };
  }
}
