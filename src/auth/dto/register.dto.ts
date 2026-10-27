import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 100)
  @ApiProperty({ example: 'Técnico de prueba', minLength: 2, maxLength: 100 })
  name: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  @ApiProperty({
    format: 'email',
    example: 'tecnico@example.com',
    maxLength: 254,
  })
  email: string;

  @IsString()
  @Length(8, 128)
  @ApiProperty({
    format: 'password',
    example: 'UnaClaveSegura123!',
    minLength: 8,
    maxLength: 128,
    writeOnly: true,
  })
  password: string;
}
