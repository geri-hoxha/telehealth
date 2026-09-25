import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RegisterDto {
  @ApiProperty({ example: 'arta', pattern: '^[a-zA-Z0-9._-]{3,30}$' })
  @Transform(trim)
  @Matches(/^[a-zA-Z0-9._-]{3,30}$/, {
    message: 'username must be 3-30 letters, numbers, dots, dashes or underscores',
  })
  username: string;

  @ApiProperty({ example: 'arta@example.com' })
  @Transform(trim)
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, example: 'Sekret123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'Arta' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Kola' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;
}
