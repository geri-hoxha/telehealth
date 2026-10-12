import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ApiException } from '../common/api-exception';
import type { Prisma } from '../generated/prisma/client';
import type { Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { UserWithProfile } from './user.dto';

// Emails are stored lower-case so lookups are case-insensitive.
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { doctorProfile: true },
    });
  }

  findById(id: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findUnique({ where: { id }, include: { doctorProfile: true } });
  }

  create(data: Prisma.UserCreateInput): Promise<UserWithProfile> {
    return this.prisma.user.create({
      data: { ...data, email: data.email.trim().toLowerCase() },
      include: { doctorProfile: true },
    });
  }

  /** The signed-in user. A token for a deleted account is a 401, so the app signs out. */
  async require(id: string): Promise<UserWithProfile> {
    const user = await this.findById(id);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  /** The signed-in user, who must have `role` (e.g. only doctors write medical folders). */
  async requireRole(id: string, role: Role): Promise<UserWithProfile> {
    const user = await this.require(id);
    if (user.role !== role) {
      throw new ApiException(HttpStatus.FORBIDDEN, 'WRONG_ROLE', `Only for ${role.toLowerCase()}s`);
    }
    return user;
  }
}
