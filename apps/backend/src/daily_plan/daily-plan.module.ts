import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AiModule } from 'src/ai/ai.module';
import { PrismaService } from 'src/common/services/prisma.service';
import { DailyPlanCronService } from './daily-plan.service';
import { DailyPlansService } from './daily-plans.service';
import { DailyPlansController } from './daily-plans.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AiModule,
  ],
  controllers: [DailyPlansController],
  providers: [DailyPlanCronService, DailyPlansService, PrismaService],
})
export class DailyPlanModule { }

