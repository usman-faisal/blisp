import { Module } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectAccessService } from 'src/projects/project-access.service';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  controllers: [CommentsController],
  // ProjectAccessService provided directly rather than by importing
  // ProjectsModule, which pulls in DailyPlanModule. It only needs PrismaService.
  providers: [CommentsService, ProjectAccessService, PrismaService],
  exports: [CommentsService],
})
export class CommentsModule {}
