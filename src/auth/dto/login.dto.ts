import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class LoginDto {
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
  @Length(1, 128)
  @ApiProperty({
    format: 'password',
    example: 'UnaClaveSegura123!',
    minLength: 1,
    maxLength: 128,
    writeOnly: true,
  })
  password: string;
}
