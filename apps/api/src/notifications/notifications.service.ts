import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Notification, Prisma } from '../generated/prisma/client';
import type { Language, NotificationType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import type { NotificationDto, UnreadCountDto } from './notification.dto';
import { renderNotification } from './templates';

const PAGE_SIZE = 30;

export interface NewNotification {
  type: NotificationType;
  /** Template values: plain strings, or {"sq","en","mk"} objects such as an event's title. */
  params?: Record<string, Prisma.InputJsonValue>;
  folderId?: string;
  eventId?: string;
  doctorId?: string;
  url?: string;
  /** ANNOUNCEMENT only: its own localized texts. */
  title?: Prisma.InputJsonValue;
  body?: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  /** Stores a notification and pushes it to the user's phones in their language. Never throws. */
  async notify(userId: string, input: NewNotification): Promise<void> {
    try {
      const notification = await this.prisma.notification.create({
        data: { userId, ...input, params: input.params ?? {} },
        include: { user: { select: { language: true } } },
      });
      const { title, body } = renderNotification(notification, notification.user.language);
      const data: Record<string, string> = { notificationId: notification.id, type: notification.type };
      for (const key of ['folderId', 'eventId', 'doctorId', 'url'] as const) {
        const value = notification[key];
        if (value) data[key] = value;
      }
      void this.push.sendNotification(userId, { title, body, data });
    } catch (error) {
      this.logger.error(`Could not notify user ${userId}: ${String(error)}`);
    }
  }

  async list(userId: string, language: Language, before?: Date): Promise<NotificationDto[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId, ...(before ? { createdAt: { lt: before } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
    });
    return notifications.map((notification) => toNotificationDto(notification, language));
  }

  /** Polled by the open app: a new latest one shows a snackbar when no push arrived. */
  async unread(userId: string, language: Language): Promise<UnreadCountDto> {
    const where = { userId, readAt: null };
    const [count, latest] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findFirst({ where, orderBy: { createdAt: 'desc' } }),
    ]);
    return { count, latest: latest ? toNotificationDto(latest, language) : null };
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (count === 0) throw new NotFoundException('Notification not found');
  }
}

function toNotificationDto(notification: Notification, language: Language): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    ...renderNotification(notification, language),
    folderId: notification.folderId,
    eventId: notification.eventId,
    doctorId: notification.doctorId,
    url: notification.url,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}
