import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from 'src/ai/ai.module';
import { PrismaService } from 'src/common/services/prisma.service';
import { QUEUES } from 'src/common/lib/constants';
import { DailyPlanCronService } from './daily-plan.service';
import { DailyPlansService } from './daily-plans.service';
import { DailyPlansController } from './daily-plans.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AiModule,
    BullModule.registerQueue({
      name: QUEUES.INCUBATOR,
    }),
  ],
  controllers: [DailyPlansController],
  providers: [DailyPlanCronService, DailyPlansService, PrismaService],
  exports: [DailyPlanCronService],
})
export class DailyPlanModule { }

