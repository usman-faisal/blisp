import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaService } from 'src/common/services/prisma.service';
import { CollaborationNotificationsListener } from './collaboration-notifications.listener';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    // Registering the listener is enough for @OnEvent to bind — no import is
    // needed at the emitting sites, which keeps them decoupled.
    CollaborationNotificationsListener,
    PrismaService,
  ],
  exports: [NotificationsService],
})
export class NotificationModule {}
