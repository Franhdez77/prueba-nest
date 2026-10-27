import type { RegisterUserDto } from './dto/register-user.dto.js';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from './password.js';
import { UsersService } from '../users/users.service.js';
import { publicUser } from '../users/user.entity.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
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
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id, role: user.role }),
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: publicUser(user),
    };
  }
}
