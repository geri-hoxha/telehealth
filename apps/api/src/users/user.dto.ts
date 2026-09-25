import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../generated/prisma/client';

export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'geri' })
  username: string;

  @ApiProperty({ example: 'geri@telehealth.al' })
  email: string;

  @ApiProperty({ example: 'Geri' })
  firstName: string;

  @ApiProperty({ example: 'Demo' })
  lastName: string;

  @ApiProperty()
  createdAt: Date;
}

/** Strips private fields (like the password hash) before a user leaves the API. */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
  };
}
