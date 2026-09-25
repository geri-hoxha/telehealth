import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import type { User } from '../generated/prisma/client';
import { toUserDto, UserDto } from '../users/user.dto';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './jwt-auth.guard';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    if (await this.users.findByUsername(dto.username)) {
      throw new ConflictException('Username is already taken');
    }
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('Email is already registered');
    }
    const user = await this.users.create({
      username: dto.username,
      email: dto.email,
      passwordHash: await hash(dto.password),
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    return this.issueToken(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.users.findByUsername(dto.username);
    if (!user || !(await verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid username or password');
    }
    return this.issueToken(user);
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return toUserDto(user);
  }

  private async issueToken(user: User): Promise<AuthResponseDto> {
    const payload: JwtPayload = { sub: user.id };
    return { accessToken: await this.jwt.signAsync(payload), user: toUserDto(user) };
  }
}
