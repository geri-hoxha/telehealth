import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateUserData {
  username: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
}

// Usernames and emails are stored lower-case so lookups are case-insensitive.
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: CreateUserData) {
    return this.prisma.user.create({
      data: { ...data, username: data.username.toLowerCase(), email: data.email.toLowerCase() },
    });
  }
}
