import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';
import { THROTTLE_DEFAULT } from './common/lib/throttle';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UsersModule } from './users/users.module';
import { NotificationModule } from './notifications/notification.module';
import { MailerModule } from './mailer/mailer.module';
import { BullModule } from '@nestjs/bullmq';
import { WebhookModule } from './webhook/webhook.module';
import { BrainDumpsModule } from './brain_dumps/brain-dumps.module';
import { AiModule } from './ai/ai.module';
import { DailyPlanModule } from './daily_plan/daily-plan.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { PipelineEventsModule } from './pipeline_events/pipeline-events.module';
import { InvitesModule } from './invites/invites.module';
import { CommentsModule } from './comments/comments.module';
import { DevTokensModule } from './dev/dev-tokens.module';
import { TranscriptionModule } from './transcription/transcription.module';
import { ResearchModule } from './research/research.module';
import { GithubModule } from './github/github.module';
import { RoadmapModule } from './roadmap/roadmap.module';

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
    // Named 'default' so a route can override it with @Throttle({ default: ... })
    // without having to restate every other bucket.
    ThrottlerModule.forRoot([{ name: 'default', ...THROTTLE_DEFAULT }]),
    EventEmitterModule.forRoot(),
    AuthModule,
    UsersModule,
    NotificationModule,
    MailerModule,
    WebhookModule,
    BrainDumpsModule,
    TranscriptionModule,
    ResearchModule,
    RoadmapModule,
    GithubModule,
    AiModule,
    DailyPlanModule,
    ProjectsModule,
    TasksModule,
    PipelineEventsModule,
    InvitesModule,
    CommentsModule,
    // Token-minting helper for local testing. Never registered in production —
    // it can impersonate any user. The controller also re-checks at runtime.
    ...(process.env.NODE_ENV === 'production' ? [] : [DevTokensModule]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global, so a new controller is rate limited without anyone remembering to
    // decorate it. Routes that need a tighter budget add @Throttle.
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
})
export class AppModule {}
