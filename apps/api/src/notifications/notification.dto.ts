import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../generated/prisma/enums';

export class NotificationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty({ description: 'In the language of the request' })
  title: string;

  @ApiProperty()
  body: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Open this medical folder' })
  folderId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Open this event' })
  eventId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'FREE_LINE: "Call now" prefers this doctor' })
  doctorId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Open this link' })
  url: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  readAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}

export class UnreadCountDto {
  @ApiProperty()
  count: number;

  @ApiPropertyOptional({ type: NotificationDto, nullable: true, description: 'The newest unread one' })
  latest: NotificationDto | null;
}
