import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { ApiException } from '../common/api-exception';
import { formatDate, localize } from '../common/language';
import { personInclude, PersonDto, toPersonDto } from '../common/people';
import type { DoctorProfile, Event, Prisma, User } from '../generated/prisma/client';
import type { Language } from '../generated/prisma/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsersService } from '../users/users.service';

export type EventStatus = 'UPCOMING' | 'LIVE' | 'ENDED';

export class EventDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: PersonDto })
  specialist: PersonDto;

  @ApiProperty()
  startsAt: Date;

  @ApiProperty()
  endsAt: Date;

  @ApiProperty()
  capacity: number;

  @ApiProperty()
  participantCount: number;

  @ApiProperty({ description: '0 shows "No free places"' })
  freePlaces: number;

  @ApiProperty({ description: 'Whether the signed-in patient has a seat' })
  joined: boolean;

  @ApiProperty({ enum: ['UPCOMING', 'LIVE', 'ENDED'], description: 'LIVE: "Request a call" is possible' })
  status: EventStatus;
}

type EventWithCounts = Event & {
  specialist: User & { doctorProfile: DoctorProfile | null };
  _count: { participants: number };
  participants: { userId: string }[];
};

/** Activities: sessions with a specialist and a limited number of seats. */
@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Upcoming includes events happening now; past is newest first. */
  async list(userId: string, when: 'upcoming' | 'past', language: Language): Promise<EventDto[]> {
    const now = new Date();
    const events = await this.prisma.event.findMany({
      where: when === 'upcoming' ? { endsAt: { gt: now } } : { endsAt: { lte: now } },
      orderBy: { startsAt: when === 'upcoming' ? 'asc' : 'desc' },
      take: 50,
      include: this.include(userId),
    });
    return events.map((event) => toEventDto(event, language, now));
  }

  async get(userId: string, eventId: string, language: Language): Promise<EventDto> {
    return toEventDto(await this.require(userId, eventId), language);
  }

  /** Takes a seat. 409 EVENT_FULL or EVENT_ENDED; 403 SUBSCRIPTION_REQUIRED. Safe to repeat. */
  async join(userId: string, eventId: string, language: Language): Promise<EventDto> {
    await this.users.requireRole(userId, 'PATIENT');
    await this.subscriptions.requireActive(userId);

    const joined = await this.prisma.$transaction(async (tx) => {
      // Locks the event so two patients can't take the last seat at the same time.
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId}::uuid FOR UPDATE`;
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: { _count: { select: { participants: true } } },
      });
      if (!event) throw new NotFoundException('Event not found');
      if (event.endsAt <= new Date()) {
        throw new ApiException(HttpStatus.CONFLICT, 'EVENT_ENDED', 'The event is over');
      }
      const existing = await tx.eventParticipant.findUnique({ where: { eventId_userId: { eventId, userId } } });
      if (existing) return null;
      if (event._count.participants >= event.capacity) {
        throw new ApiException(HttpStatus.CONFLICT, 'EVENT_FULL', 'No free places');
      }
      await tx.eventParticipant.create({ data: { eventId, userId } });
      return event;
    });

    if (joined) {
      await this.notifications.notify(userId, {
        type: 'EVENT_JOINED',
        params: { event: joined.title as Prisma.InputJsonValue, date: formatDate(joined.startsAt) },
        eventId,
      });
    }
    return this.get(userId, eventId, language);
  }

  async leave(userId: string, eventId: string, language: Language): Promise<EventDto> {
    await this.require(userId, eventId);
    await this.prisma.eventParticipant.deleteMany({ where: { eventId, userId } });
    return this.get(userId, eventId, language);
  }

  private async require(userId: string, eventId: string): Promise<EventWithCounts> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: this.include(userId) });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private include(userId: string) {
    return {
      specialist: { include: personInclude },
      _count: { select: { participants: true } },
      participants: { where: { userId }, select: { userId: true } },
    } as const;
  }
}

function toEventDto(event: EventWithCounts, language: Language, now = new Date()): EventDto {
  const participantCount = event._count.participants;
  return {
    id: event.id,
    title: localize(event.title, language),
    description: localize(event.description, language),
    specialist: toPersonDto(event.specialist),
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    capacity: event.capacity,
    participantCount,
    freePlaces: Math.max(0, event.capacity - participantCount),
    joined: event.participants.length > 0,
    status: event.endsAt <= now ? 'ENDED' : event.startsAt <= now ? 'LIVE' : 'UPCOMING',
  };
}
