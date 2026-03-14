import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UserModule } from './user/user.module';
import { NotificationModule } from './notification/notification.module';
import { MailerModule } from './mailer/mailer.module';
import { BullModule } from '@nestjs/bullmq';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => {

        const redisHost = configService.get<string>('REDIS_HOST') || 'localhost';
        const redisPortValue = configService.get<string>('REDIS_PORT');
        const redisPort = redisPortValue ? Number(redisPortValue) : 6379;

        return {
          connection: {
            host: redisHost,
            port: redisPort,
          },
        };
      },
      inject: [ConfigService],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    AuthModule,
    UserModule,
    NotificationModule,
    MailerModule,
    WebhookModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
