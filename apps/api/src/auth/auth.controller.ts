import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { languageFromHeader, RequestLanguage } from '../common/language';
import type { Language } from '../generated/prisma/enums';
import { UserDto } from '../users/user.dto';
import { verifiedPage } from './auth-texts';
import { AuthService } from './auth.service';
import { CurrentUserId } from './current-user-id.decorator';
import {
  AuthResponseDto,
  BiometricKeyDto,
  ChangePasswordDto,
  CheckEmailResponseDto,
  EmailDto,
  LoginDto,
  RegisterDto,
  RegisterResponseDto,
  ResetCodeDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Onboarding: whether to show the password step or sign-up. */
  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CheckEmailResponseDto })
  async checkEmail(@Body() dto: EmailDto): Promise<CheckEmailResponseDto> {
    return { exists: await this.auth.checkEmail(dto.email) };
  }

  /** 401 INVALID_CREDENTIALS, or 403 EMAIL_NOT_VERIFIED for a patient who hasn't confirmed yet. */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() dto: LoginDto, @RequestLanguage() language: Language): Promise<AuthResponseDto> {
    return this.auth.login(dto, language);
  }

  /** Patient sign-up. Sends a confirmation email; no session until it is confirmed. */
  @Post('register')
  @ApiCreatedResponse({ type: RegisterResponseDto })
  register(@Body() dto: RegisterDto, @RequestLanguage() language: Language): Promise<RegisterResponseDto> {
    return this.auth.register(dto, language);
  }

  /** The link in the confirmation email. Shows a small page in the browser. */
  @Get('verify-email')
  @Header('content-type', 'text/html; charset=utf-8')
  @ApiProduces('text/html')
  async verifyEmail(@Query('token') token: string | undefined, @Req() request: Request): Promise<string> {
    const result = token ? await this.auth.verifyEmail(token) : { ok: false };
    const language = result.language ?? languageFromHeader(request.headers['accept-language']) ?? 'SQ';
    return verifiedPage(language, result.ok);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  resendVerification(@Body() dto: EmailDto): Promise<void> {
    return this.auth.resendVerification(dto.email);
  }

  /** Emails a 6-digit code (valid 15 minutes). */
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  forgotPassword(@Body() dto: EmailDto): Promise<void> {
    return this.auth.forgotPassword(dto.email);
  }

  /** 400 INVALID_CODE when the code is wrong or expired. */
  @Post('verify-reset-code')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  verifyResetCode(@Body() dto: ResetCodeDto): Promise<void> {
    return this.auth.verifyResetCode(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.auth.resetPassword(dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  changePassword(@CurrentUserId() userId: string, @Body() dto: ChangePasswordDto): Promise<void> {
    return this.auth.changePassword(userId, dto);
  }

  /** Turns on biometric login on this phone: returns the key to keep behind Face ID / fingerprint. */
  @Post('biometric')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: BiometricKeyDto })
  async createBiometricKey(@CurrentUserId() userId: string): Promise<BiometricKeyDto> {
    return { key: await this.auth.createBiometricKey(userId) };
  }

  @Delete('biometric')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  revokeBiometricKey(@CurrentUserId() userId: string, @Body() dto: BiometricKeyDto): Promise<void> {
    return this.auth.revokeBiometricKey(userId, dto.key);
  }

  /** 401 BIOMETRIC_KEY_INVALID once the key is revoked (e.g. after a password reset). */
  @Post('biometric/login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  biometricLogin(@Body() dto: BiometricKeyDto, @RequestLanguage() language: Language): Promise<AuthResponseDto> {
    return this.auth.biometricLogin(dto.key, language);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserDto })
  me(@CurrentUserId() userId: string): Promise<UserDto> {
    return this.auth.me(userId);
  }
}
