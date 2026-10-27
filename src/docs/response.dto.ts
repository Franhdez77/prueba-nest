import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../users/role.enum.js';

export class UserResponseDto {
  @ApiProperty({
    type: Number, minimum: 1,
    example: 1,
  })
  id: number;

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
