import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../users/role.enum.js';

export class UserResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: 'fc6ec825-9f9c-4b65-bf45-6e325587dd44',
  })
  id: string;

  @ApiProperty({ example: 'Técnico de prueba' })
  name: string;

  @ApiProperty({ format: 'email', example: 'tecnico@example.com' })
  email: string;

  @ApiProperty({ enum: Role, example: Role.TECHNICIAN })
  role: Role;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'Token JWT; copiar en Authorize → bearer',
    example: 'eyJhbGciOiJIUzI1NiJ9...',
  })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 3600, description: 'Duración del token en segundos' })
  expiresIn: number;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class IntegrationStatusResponseDto {
  @ApiProperty({ example: 'FleetCore' })
  service: string;

  @ApiProperty({ example: 'ok' })
  status: string;
}
