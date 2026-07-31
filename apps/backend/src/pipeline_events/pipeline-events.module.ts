import { Global, Module } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { PipelineEventsService } from './pipeline-events.service';
import { ProjectAccessService } from 'src/projects/project-access.service';

@Global()
@Module({
  // Provided directly: this module is @Global(), so importing ProjectsModule
  // here would risk a cycle. ProjectAccessService only needs PrismaService.
  providers: [PipelineEventsService, ProjectAccessService, PrismaService],
  exports: [PipelineEventsService],
})
export class PipelineEventsModule {}
