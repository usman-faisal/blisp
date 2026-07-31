import { Module } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectAccessService } from './project-access.service';
import { DailyPlanModule } from 'src/daily_plan/daily-plan.module';

@Module({
  imports: [DailyPlanModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectAccessService, PrismaService],
  // Exported so tasks, pipeline events and (later) invites and comments can
  // reuse the same access checks instead of re-implementing them.
  exports: [ProjectsService, ProjectAccessService],
})
export class ProjectsModule {}
