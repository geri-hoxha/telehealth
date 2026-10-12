import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigModule } from './app-config/app-config.module';
import { AuthModule } from './auth/auth.module';
import { CallsModule } from './calls/calls.module';
import { CareModule } from './care/care.module';
import { ContentModule } from './content/content.module';
import { DevicesModule } from './devices/devices.module';
import { DoctorsModule } from './doctors/doctors.module';
import { EventsModule } from './events/events.module';
import { FilesModule } from './files/files.module';
import { FoldersModule } from './folders/folders.module';
import { LabReportsModule } from './lab-reports/lab-reports.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PatientsModule } from './patients/patients.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { PushModule } from './push/push.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Shared services (global modules).
    PrismaModule,
    UsersModule,
    AuthModule,
    MailModule,
    FilesModule,
    PushModule,
    NotificationsModule,
    SubscriptionsModule,
    CareModule,
    // Features.
    ProfileModule,
    DevicesModule,
    CallsModule,
    DoctorsModule,
    PatientsModule,
    FoldersModule,
    LabReportsModule,
    EventsModule,
    ContentModule,
    AppConfigModule,
  ],
})
export class AppModule {}
