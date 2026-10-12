import { createHash, randomBytes, randomInt } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { ApiException } from '../common/api-exception';
import { Prisma } from '../generated/prisma/client';
import type { Language } from '../generated/prisma/enums';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { toUserDto, type UserDto, type UserWithProfile } from '../users/user.dto';
import { UsersService } from '../users/users.service';
import { resetCodeEmail, verificationEmail } from './auth-texts';
import type {
  AuthResponseDto,
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  RegisterResponseDto,
  ResetCodeDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import type { JwtPayload } from './jwt-auth.guard';

const VERIFY_LINK_MS = 48 * 60 * 60 * 1000;
const RESET_CODE_MS = 15 * 60 * 1000;
/** Wrong guesses allowed per reset code; a 6-digit code needs about 500,000. */
const MAX_CODE_ATTEMPTS = 5;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly publicApiUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.publicApiUrl = config.get<string>('PUBLIC_API_URL') ?? `http://localhost:${config.get('PORT', 3000)}`;
  }

  /** The first onboarding step: decides between the password step and sign-up. */
  async checkEmail(email: string): Promise<boolean> {
    return !!(await this.users.findByEmail(email));
  }

  async login(dto: LoginDto, language: Language): Promise<AuthResponseDto> {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !(await verify(user.passwordHash, dto.password))) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Wrong email or password');
    }
    return this.signIn(user, language);
  }

  /** Creates a patient account. The patient can log in once they open the link in the email. */
  async register(dto: RegisterDto, language: Language): Promise<RegisterResponseDto> {
    if (await this.users.findByEmail(dto.email)) {
      throw new ApiException(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'Email is already registered');
    }
    let user: UserWithProfile;
    try {
      user = await this.users.create({
        email: dto.email,
        passwordHash: await hash(dto.password),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        personalId: dto.personalId,
        sex: dto.sex,
        language,
        role: 'PATIENT',
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const personalId = JSON.stringify(error.meta ?? {}).includes('personalId');
        throw personalId
          ? new ApiException(HttpStatus.CONFLICT, 'PERSONAL_ID_TAKEN', 'Personal ID is already registered')
          : new ApiException(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'Email is already registered');
      }
      throw error;
    }
    await this.sendVerification(user);
    return { email: user.email };
  }

  /** Opens from the confirmation email. Returns whether the link was valid. */
  async verifyEmail(token: string): Promise<{ ok: boolean; language?: Language }> {
    const record = await this.prisma.authToken.findFirst({
      where: { kind: 'EMAIL_VERIFICATION', tokenHash: sha256(token), usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!record) return { ok: false };
    await this.prisma.$transaction([
      this.prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: record.user.emailVerifiedAt ?? new Date() },
      }),
    ]);
    return { ok: true, language: record.user.language };
  }

  /** Says nothing about whether the account exists. */
  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (user && !user.emailVerifiedAt) await this.sendVerification(user);
  }

  /** Emails a 6-digit code. Says nothing about whether the account exists. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.$transaction([
      // Only the newest code works.
      this.prisma.authToken.updateMany({
        where: { userId: user.id, kind: 'PASSWORD_RESET', usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.authToken.create({
        data: {
          userId: user.id,
          kind: 'PASSWORD_RESET',
          tokenHash: sha256(`${user.id}:${code}`),
          expiresAt: new Date(Date.now() + RESET_CODE_MS),
        },
      }),
    ]);
    await this.mail.send({ to: user.email, ...resetCodeEmail(user.language, user.firstName, code) });
  }

  /** Lets the app check the code before asking for the new password. */
  async verifyResetCode(dto: ResetCodeDto): Promise<void> {
    await this.checkResetCode(dto, false);
  }

  /** Sets a new password. Biometric keys stop working: whoever forgot the password may not hold the phone. */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.checkResetCode(dto, true);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hash(dto.newPassword),
          // The code arrived by email, so the address works.
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      }),
      this.revokeBiometricKeys(user.id),
    ]);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users.require(userId);
    if (!(await verify(user.passwordHash, dto.currentPassword))) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'WRONG_PASSWORD', 'The current password is wrong');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hash(dto.newPassword) } });
  }

  /** A secret the phone keeps behind Face ID / fingerprint and trades for a session later. */
  async createBiometricKey(userId: string): Promise<string> {
    await this.users.require(userId);
    const key = randomBytes(32).toString('base64url');
    await this.prisma.authToken.create({ data: { userId, kind: 'BIOMETRIC', tokenHash: sha256(key) } });
    return key;
  }

  async revokeBiometricKey(userId: string, key: string): Promise<void> {
    await this.prisma.authToken.updateMany({
      where: { userId, kind: 'BIOMETRIC', tokenHash: sha256(key), usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  async biometricLogin(key: string, language: Language): Promise<AuthResponseDto> {
    const record = await this.prisma.authToken.findFirst({
      where: { kind: 'BIOMETRIC', tokenHash: sha256(key), usedAt: null },
      include: { user: { include: { doctorProfile: true } } },
    });
    if (!record) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'BIOMETRIC_KEY_INVALID', 'Log in with your password');
    }
    return this.signIn(record.user, language);
  }

  async me(userId: string): Promise<UserDto> {
    return toUserDto(await this.users.require(userId));
  }

  // --- helpers ---

  private async signIn(user: UserWithProfile, language: Language): Promise<AuthResponseDto> {
    if (user.role === 'PATIENT' && !user.emailVerifiedAt) {
      throw new ApiException(HttpStatus.FORBIDDEN, 'EMAIL_NOT_VERIFIED', 'Confirm your email first');
    }
    // Pushes and server texts follow the app's language.
    if (user.language !== language) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { language }, include: { doctorProfile: true } });
    }
    const payload: JwtPayload = { sub: user.id };
    return { accessToken: await this.jwt.signAsync(payload), user: toUserDto(user) };
  }

  private async sendVerification(user: UserWithProfile): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.authToken.create({
      data: {
        userId: user.id,
        kind: 'EMAIL_VERIFICATION',
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + VERIFY_LINK_MS),
      },
    });
    const link = `${this.publicApiUrl}/api/auth/verify-email?token=${token}`;
    await this.mail.send({ to: user.email, ...verificationEmail(user.language, user.firstName, link) });
  }

  private async checkResetCode(dto: ResetCodeDto, consume: boolean): Promise<UserWithProfile> {
    const invalid = new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_CODE', 'The code is wrong or expired');
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw invalid;
    const record = await this.prisma.authToken.findFirst({
      where: { userId: user.id, kind: 'PASSWORD_RESET', usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.attempts >= MAX_CODE_ATTEMPTS) throw invalid;
    if (record.tokenHash !== sha256(`${user.id}:${dto.code}`)) {
      await this.prisma.authToken.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw invalid;
    }
    if (consume) {
      const { count } = await this.prisma.authToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (count === 0) throw invalid;
    }
    return user;
  }

  private revokeBiometricKeys(userId: string) {
    return this.prisma.authToken.updateMany({
      where: { userId, kind: 'BIOMETRIC', usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
