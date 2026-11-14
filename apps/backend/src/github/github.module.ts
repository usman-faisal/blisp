import { Module } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectAccessService } from 'src/projects/project-access.service';
import { GithubClient } from './github.client';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';

/**
 * Read-only GitHub integration and completion verification.
 *
 * Exports GithubService so TasksModule can re-judge a task when its status
 * changes: a completion claim and the evidence for it are two halves of the
 * same question, and letting them drift apart would leave stale verdicts on
 * screen.
 */
@Module({
  controllers: [GithubController],
  // ProjectAccessService is provided directly rather than by importing
  // ProjectsModule, which pulls in DailyPlanModule and would risk a cycle —
  // the same reasoning as TasksModule. The service only needs PrismaService.
  providers: [GithubService, GithubClient, ProjectAccessService, PrismaService],
  exports: [GithubService],
})
export class GithubModule {}
