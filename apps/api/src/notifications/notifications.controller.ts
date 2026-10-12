import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestLanguage } from '../common/language';
import type { Language } from '../generated/prisma/enums';
import { NotificationDto, UnreadCountDto } from './notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** Newest first, 30 at a time; pass the last one's createdAt as `before` for more. */
  @Get()
  @ApiQuery({ name: 'before', required: false, type: String })
  @ApiOkResponse({ type: NotificationDto, isArray: true })
  list(
    @CurrentUserId() userId: string,
    @RequestLanguage() language: Language,
    @Query('before') before?: string,
  ): Promise<NotificationDto[]> {
    const date = before ? new Date(before) : undefined;
    return this.notifications.list(userId, language, date && !Number.isNaN(date.getTime()) ? date : undefined);
  }

  @Get('unread')
  @ApiOkResponse({ type: UnreadCountDto })
  unread(@CurrentUserId() userId: string, @RequestLanguage() language: Language): Promise<UnreadCountDto> {
    return this.notifications.unread(userId, language);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  markAllRead(@CurrentUserId() userId: string): Promise<void> {
    return this.notifications.markAllRead(userId);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  markRead(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.notifications.markRead(userId, id);
  }
}
