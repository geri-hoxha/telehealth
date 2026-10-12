import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DoctorProfile, User } from '../generated/prisma/client';

export function fullName(user: Pick<User, 'firstName' | 'lastName'>): string {
  return `${user.firstName} ${user.lastName}`;
}

/** Avatars are public files with unguessable names; the app prefixes the API's address. */
export function avatarUrl(user: Pick<User, 'avatarFile'>): string | null {
  return user.avatarFile ? `/api/files/avatars/${user.avatarFile}` : null;
}

/** A person as other screens show them: a name and a photo, plus the specialty for doctors. */
export class PersonDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Arben Mjeku' })
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '/api/files/avatars/0199….jpg' })
  avatarUrl: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Mjekësi familjare' })
  specialty: string | null;
}

export function toPersonDto(user: User & { doctorProfile?: DoctorProfile | null }): PersonDto {
  return {
    id: user.id,
    name: fullName(user),
    avatarUrl: avatarUrl(user),
    specialty: user.doctorProfile?.specialty ?? null,
  };
}

/** Prisma include for toPersonDto. */
export const personInclude = { doctorProfile: true } as const;
