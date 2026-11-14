import { Module } from '@nestjs/common';
import { GithubModule } from 'src/github/github.module';
import { PrismaService } from 'src/common/services/prisma.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { ProjectAccessService } from 'src/projects/project-access.service';

@Module({
  // GithubModule for verification: completing a task re-judges its claim.
  imports: [GithubModule],
  controllers: [TasksController],
  // ProjectAccessService is provided directly rather than by importing
  // ProjectsModule: that module pulls in DailyPlanModule, and importing it here
  // would create a cycle. The service only needs PrismaService.
  providers: [TasksService, ProjectAccessService, PrismaService],
})
export class TasksModule {}
