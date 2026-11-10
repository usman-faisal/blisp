import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from 'src/ai/ai.module';
import { PrismaService } from 'src/common/services/prisma.service';
import { BrainDumpsController } from './brain-dumps.controller';
import { BrainDumpsService } from './brain-dumps.service';
import { QUEUES } from 'src/common/lib/constants';
import { BrainDumpsProcessor } from './brain-dumps.processor';
import { DailyPlanModule } from 'src/daily_plan/daily-plan.module';
import { ResearchModule } from 'src/research/research.module';

@Module({
  imports: [
    AiModule,
    DailyPlanModule,
    // The processor handles the DISCOVERY_REPORT job by delegating to
    // ResearchService, so this module needs it injectable here.
    ResearchModule,
    BullModule.registerQueue({
      name: QUEUES.INCUBATOR,
    }),
  ],
  controllers: [BrainDumpsController],
  providers: [BrainDumpsService, PrismaService, BrainDumpsProcessor],
})
export class BrainDumpsModule {}
