import { Module } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { ProjectAccessService } from 'src/projects/project-access.service';

@Module({
  controllers: [TasksController],
  // ProjectAccessService is provided directly rather than by importing
  // ProjectsModule: that module pulls in DailyPlanModule, and importing it here
  // would create a cycle. The service only needs PrismaService.
  providers: [TasksService, ProjectAccessService, PrismaService],
})
export class TasksModule {}
