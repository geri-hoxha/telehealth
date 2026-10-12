import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Sex } from '../../generated/prisma/enums';
import { UserDto } from '../../users/user.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const toEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const toUpperCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() : value;

export class EmailDto {
  @ApiProperty({ example: 'geri@telehealth.al' })
  @Transform(toEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class LoginDto extends EmailDto {
  @ApiProperty({ example: '1234' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

/** Patients sign themselves up; doctors are created by admins. */
export class RegisterDto extends EmailDto {
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

  @ApiProperty({ example: '+355691234567' })
  @Transform(trim)
  @Matches(/^\+?[0-9 ]{6,20}$/, { message: 'phone must be 6-20 digits, optionally starting with +' })
  phone: string;

  @ApiProperty({ example: 'J90101001A', description: 'Albanian NID or Macedonian EMBG' })
  @Transform(toUpperCode)
  @Matches(/^[A-Z0-9]{6,20}$/, { message: 'personalId must be 6-20 letters or digits' })
  personalId: string;

  @ApiProperty({ enum: Sex })
  @IsEnum(Sex)
  sex: Sex;
}

export class ResetCodeDto extends EmailDto {
  @ApiProperty({ example: '123456' })
  @Transform(trim)
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}

export class ResetPasswordDto extends ResetCodeDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

export class BiometricKeyDto {
  @ApiProperty({ description: 'The key this phone keeps behind Face ID / fingerprint' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  key: string;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: UserDto })
  user: UserDto;
}

export class CheckEmailResponseDto {
  @ApiProperty({ description: 'Whether an account with this email exists' })
  exists: boolean;
}

export class RegisterResponseDto {
  @ApiProperty({ description: 'Where the confirmation email went' })
  email: string;
}
