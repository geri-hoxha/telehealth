import {
  Body,
  Controller,
  Delete,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiException } from '../common/api-exception';
import { UploadsService } from '../files/uploads.service';
import { Language, Sex } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { toUserDto, UserDto } from '../users/user.dto';
import { UsersService } from '../users/users.service';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** An empty string clears an optional field. */
const trimOrNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @Matches(/^\+?[0-9 ]{6,20}$/, { message: 'phone must be 6-20 digits, optionally starting with +' })
  phone?: string | null;

  @ApiPropertyOptional({ enum: Sex })
  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @ApiPropertyOptional({ enum: Language, description: 'For pushes and emails' })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  // Doctors only:

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  licenceNumber?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  healthCentre?: string | null;
}

const DOCTOR_FIELDS = ['bio', 'licenceNumber', 'country', 'city', 'healthCentre'] as const;

/** The signed-in user's own profile and photo. */
@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class ProfileController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly uploads: UploadsService,
  ) {}

  /** Doctor-only fields are ignored for patients. */
  @Patch()
  @ApiOkResponse({ type: UserDto })
  async update(@CurrentUserId() userId: string, @Body() dto: UpdateProfileDto): Promise<UserDto> {
    const user = await this.users.require(userId);
    const { firstName, lastName, phone, sex, language } = dto;
    await this.prisma.user.update({ where: { id: userId }, data: { firstName, lastName, phone, sex, language } });

    if (user.role === 'DOCTOR') {
      const profile = Object.fromEntries(DOCTOR_FIELDS.filter((field) => dto[field] !== undefined).map((field) => [field, dto[field]]));
      await this.prisma.doctorProfile.upsert({
        where: { userId },
        create: { userId, ...profile },
        update: profile,
      });
    }
    return toUserDto(await this.users.require(userId));
  }

  /** Multipart upload of one `photo` (JPEG, PNG, HEIC or WebP, up to 5 MB). */
  @Post('avatar')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_AVATAR_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { photo: { type: 'string', format: 'binary' } } } })
  @ApiOkResponse({ type: UserDto })
  async setAvatar(
    @CurrentUserId() userId: string,
    @UploadedFile() photo: { originalname: string; mimetype: string; buffer: Buffer } | undefined,
  ): Promise<UserDto> {
    const user = await this.users.require(userId);
    if (!photo || !/^image\/(jpeg|png|heic|heif|webp)$/.test(photo.mimetype)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'UNSUPPORTED_FILE', 'Send a JPEG, PNG, HEIC or WebP as "photo"');
    }
    const name = await this.uploads.save('avatars', photo.buffer, photo.originalname || 'photo.jpg');
    await this.prisma.user.update({ where: { id: userId }, data: { avatarFile: name } });
    if (user.avatarFile) await this.uploads.remove('avatars', user.avatarFile);
    return toUserDto(await this.users.require(userId));
  }

  @Delete('avatar')
  @ApiOkResponse({ type: UserDto })
  async removeAvatar(@CurrentUserId() userId: string): Promise<UserDto> {
    const user = await this.users.require(userId);
    if (user.avatarFile) {
      await this.prisma.user.update({ where: { id: userId }, data: { avatarFile: null } });
      await this.uploads.remove('avatars', user.avatarFile);
    }
    return toUserDto(await this.users.require(userId));
  }
}
