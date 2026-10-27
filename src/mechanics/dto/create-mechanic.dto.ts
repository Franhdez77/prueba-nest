import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsInt, Min, Max, Length, MaxLength } from 'class-validator';

export class CreateMechanicDto {
  @ApiProperty({ example: 'Juan Pérez', minLength: 2, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiProperty({
    example: 'mecanico@example.com',
    format: 'email',
    maxLength: 254,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Motores diésel', minLength: 2, maxLength: 150 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 150)
  specialty: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    nullable: true,
    description: 'Usuario TECHNICIAN. Null permite desvincular al actualizar.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  userId?: number | null;
}
