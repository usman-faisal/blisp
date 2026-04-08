import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from 'src/ai/ai.module';
import { PrismaService } from 'src/common/services/prisma.service';
import { BrainDumpsController } from './brain-dumps.controller';
import { BrainDumpsService } from './brain-dumps.service';
import { QUEUES } from 'src/common/lib/constants';
import { BrainDumpsProcessor } from './brain-dumps.processor';
import { DailyPlanModule } from 'src/daily_plan/daily-plan.module';

@Module({
  imports: [
    AiModule,
    DailyPlanModule,
    BullModule.registerQueue({
      name: QUEUES.INCUBATOR,
    }),
  ],
  controllers: [BrainDumpsController],
  providers: [BrainDumpsService, PrismaService, BrainDumpsProcessor],
})
export class BrainDumpsModule {}
