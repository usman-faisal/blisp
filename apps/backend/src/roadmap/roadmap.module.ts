import { Module } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectsModule } from 'src/projects/projects.module';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';

/**
 * Roadmap and progress tracking.
 *
 * Owns the single source of truth for progress (progress.ts) and the schedule
 * assessment (scheduler.ts), both pure functions so they are testable without
 * a database.
 */
@Module({
  // For ProjectAccessService — membership authorises roadmap access.
  imports: [ProjectsModule],
  controllers: [RoadmapController],
  providers: [RoadmapService, PrismaService],
  exports: [RoadmapService],
})
export class RoadmapModule {}
