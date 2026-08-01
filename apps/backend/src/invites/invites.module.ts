import { Module } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectAccessService } from 'src/projects/project-access.service';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

@Module({
  controllers: [InvitesController],
  // ProjectAccessService is provided directly rather than by importing
  // ProjectsModule, which pulls in DailyPlanModule. It only needs PrismaService.
  providers: [InvitesService, ProjectAccessService, PrismaService],
  exports: [InvitesService],
})
export class InvitesModule {}
