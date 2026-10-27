import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Role } from '../../users/role.enum.js';
import { RegisterDto } from './register.dto.js';

export class RegisterUserDto extends RegisterDto {
  @ApiProperty({ enum: Role, description: 'Rol de la cuenta que registra el administrador.' })
  @IsEnum(Role)
  role: Role;
}
