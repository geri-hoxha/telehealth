import { Body, Controller, Delete, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './register-device.dto';

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Registers this phone's push token for incoming calls. A token moves to whoever registered it last. */
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async register(@CurrentUserId() userId: string, @Body() dto: RegisterDeviceDto): Promise<void> {
    await this.prisma.device.upsert({
      where: { token: dto.token },
      create: { userId, platform: dto.platform, kind: dto.kind, token: dto.token },
      update: { userId, platform: dto.platform, kind: dto.kind },
    });
  }

  /** Stops ringing this phone, e.g. on sign-out. */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async unregister(@CurrentUserId() userId: string, @Body() dto: RegisterDeviceDto): Promise<void> {
    await this.prisma.device.deleteMany({ where: { userId, token: dto.token } });
  }
}
