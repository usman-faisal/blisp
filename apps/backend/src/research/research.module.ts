import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AiModule } from 'src/ai/ai.module';
import { QUEUES } from 'src/common/lib/constants';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectsModule } from 'src/projects/projects.module';
import { ResearchController } from './research.controller';
import { ResearchService } from './research.service';

/**
 * On-demand product discovery reports.
 *
 * Generation runs on the existing INCUBATOR queue rather than a new one, so
 * there is a single worker pool and the pipeline-event timeline stays in one
 * place. The job handler lives in BrainDumpsProcessor, which already owns that
 * queue; this module exports the service it calls.
 */
@Module({
  imports: [
    AiModule,
    // PipelineEventsModule is @Global() and so is not imported here.
    // For ProjectAccessService — membership is what authorises report access.
    ProjectsModule,
    BullModule.registerQueue({ name: QUEUES.INCUBATOR }),
  ],
  controllers: [ResearchController],
  providers: [ResearchService, PrismaService],
  exports: [ResearchService],
})
export class ResearchModule {}
