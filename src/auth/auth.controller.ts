import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors, ApiSuccess } from '../docs/api-responses.decorator.js';
import {
  UserResponseDto,
  LoginResponseDto,
} from '../docs/response.dto.js';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { PublicUser } from '../users/user.entity.js';

@ApiTags('Autenticación')
@ApiErrors(500)
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @ApiOperation({
    summary: 'Registrar un técnico',
    description:
      'Registro público. No acepta el campo role; siempre crea TECHNICIAN.',
  })
  @ApiSuccess(201, UserResponseDto)
  @ApiErrors(400, 409)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description: 'El token está en data.accessToken y dura una hora.',
  })
  @ApiSuccess(200, LoginResponseDto)
  @ApiErrors(400, 401)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar mi perfil' })
  @ApiSuccess(200, UserResponseDto)
  @ApiErrors(401)
  @Get('me')
  me(@CurrentUser() user: PublicUser) {
    return user;
  }

}
