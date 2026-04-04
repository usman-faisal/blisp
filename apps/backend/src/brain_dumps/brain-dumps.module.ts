import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from 'src/ai/ai.module';
import { PrismaService } from 'src/common/services/prisma.service';
import { BrainDumpsController } from './brain-dumps.controller';
import { BrainDumpsService } from './brain-dumps.service';
import { QUEUES } from 'src/common/lib/constants';
import { BrainDumpsProcessor } from './brain-dumps.processor';

@Module({
  imports: [
    AiModule,
    BullModule.registerQueue({
      name: QUEUES.INCUBATOR,
    }),
  ],
  controllers: [BrainDumpsController],
  providers: [BrainDumpsService, PrismaService, BrainDumpsProcessor],
})
export class BrainDumpsModule {}
