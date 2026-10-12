import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestLanguage } from '../common/language';
import type { Language } from '../generated/prisma/enums';
import { EventDto, EventsService } from './events.service';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiQuery({ name: 'when', enum: ['upcoming', 'past'], required: false })
  @ApiOkResponse({ type: EventDto, isArray: true })
  list(
    @CurrentUserId() userId: string,
    @RequestLanguage() language: Language,
    @Query('when') when?: string,
  ): Promise<EventDto[]> {
    return this.events.list(userId, when === 'past' ? 'past' : 'upcoming', language);
  }

  @Get(':id')
  @ApiOkResponse({ type: EventDto })
  get(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @RequestLanguage() language: Language,
  ): Promise<EventDto> {
    return this.events.get(userId, id, language);
  }

  /** Patient: take a seat. 409 EVENT_FULL / EVENT_ENDED, 403 SUBSCRIPTION_REQUIRED. */
  @Post(':id/participation')
  @ApiOkResponse({ type: EventDto })
  join(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @RequestLanguage() language: Language,
  ): Promise<EventDto> {
    return this.events.join(userId, id, language);
  }

  @Delete(':id/participation')
  @ApiOkResponse({ type: EventDto })
  leave(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @RequestLanguage() language: Language,
  ): Promise<EventDto> {
    return this.events.leave(userId, id, language);
  }
}
