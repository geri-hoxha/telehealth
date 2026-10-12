import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { avatarUrl } from '../common/people';
import type { DoctorProfile, User } from '../generated/prisma/client';
import { Language, Role, Sex } from '../generated/prisma/enums';

export class DoctorProfileDto {
  @ApiPropertyOptional({ type: String, nullable: true, example: 'Mjekësi familjare' })
  specialty: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  bio: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'AL-MED-10234' })
  licenceNumber: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Shqipëri' })
  country: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Tiranë' })
  city: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Qendra Shëndetësore Nr. 3' })
  healthCentre: string | null;
}

/** The signed-in user's own account. */
export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'geri@telehealth.al' })
  email: string;

  @ApiProperty({ example: 'Geri' })
  firstName: string;

  @ApiProperty({ example: 'Demo' })
  lastName: string;

  @ApiProperty({ enum: Role, description: 'PATIENT calls doctors; DOCTOR receives calls' })
  role: Role;

  @ApiPropertyOptional({ type: String, nullable: true, example: '+355691234567' })
  phone: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'J90101001A' })
  personalId: string | null;

  @ApiPropertyOptional({ enum: Sex, nullable: true })
  sex: Sex | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ enum: Language })
  language: Language;

  @ApiPropertyOptional({ type: DoctorProfileDto, nullable: true, description: 'Only for doctors' })
  doctorProfile: DoctorProfileDto | null;

  @ApiProperty()
  createdAt: Date;
}

export type UserWithProfile = User & { doctorProfile: DoctorProfile | null };

/** Strips private fields (like the password hash) before a user leaves the API. */
export function toUserDto(user: UserWithProfile): UserDto {
  const profile = user.doctorProfile;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    phone: user.phone,
    personalId: user.personalId,
    sex: user.sex,
    avatarUrl: avatarUrl(user),
    language: user.language,
    doctorProfile:
      user.role === 'DOCTOR'
        ? {
            specialty: profile?.specialty ?? null,
            bio: profile?.bio ?? null,
            licenceNumber: profile?.licenceNumber ?? null,
            country: profile?.country ?? null,
            city: profile?.city ?? null,
            healthCentre: profile?.healthCentre ?? null,
          }
        : null,
    createdAt: user.createdAt,
  };
}
